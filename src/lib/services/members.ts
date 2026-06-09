import { prisma } from "../db";
import { hashPassword } from "../password";
import { encryptPII, last4 } from "../crypto";
import { findBfsPlacement, ancestorIncrements, type TreeNode, type Side } from "../engines/tree";
import { visibleRank } from "../engines/eligibility";
import { getNumberSetting, getBoolSetting } from "../settings";
import { generateInstallmentSchedule, addMonths } from "../engines/emi";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const COMPANY_ROOT_MEMBER_ID = "COMPANY";

export interface RegisterInput {
  fullName: string;
  aadhaarNumber: string;
  mobile: string;
  whatsapp?: string;
  email: string;
  password: string;
  sponsorMemberId?: string; // paid member ID/plot number or free application ID
  paymentPlan?: "INSTALLMENT" | "CASHBACK";
  preferredSide?: "LEFT" | "RIGHT";
}

export async function createMemberApplication(input: RegisterInput) {
  let sponsor: { id: string; isActive: boolean } | null = null;
  let referrerApplication: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null = null;
  if (input.sponsorMemberId) {
    const referralId = input.sponsorMemberId.trim().toUpperCase();
    sponsor = await prisma.member.findUnique({
      where: { memberId: referralId },
      select: { id: true, isActive: true },
    });
    if (!sponsor) {
      referrerApplication = await prisma.memberApplication.findUnique({
        where: { applicationCode: referralId },
        select: { id: true, status: true },
      });
    }
    if (sponsor && !sponsor.isActive) throw new Error("Referrer member is not active");
    if (referrerApplication?.status === "REJECTED") throw new Error("Referrer free ID is rejected");
    if (!sponsor && !referrerApplication) throw new Error("Invalid sponsor or referral ID");
  }

  const [existingMember, existingApplication] = await Promise.all([
    prisma.member.findFirst({ where: { OR: [{ mobile: input.mobile }, { email: input.email }] } }),
    prisma.memberApplication.findFirst({ where: { OR: [{ mobile: input.mobile }, { email: input.email }] } }),
  ]);
  if (existingMember) throw new Error("A member with this mobile or email already exists");
  if (existingApplication) throw new Error("An application with this mobile or email already exists");

  return prisma.memberApplication.create({
    data: {
      fullName: input.fullName,
      aadhaarNumber: encryptPII(input.aadhaarNumber),
      aadhaarLast4: last4(input.aadhaarNumber),
      mobile: input.mobile,
      whatsapp: input.whatsapp ?? input.mobile,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      applicationCode: await generateApplicationCode(),
      sponsorId: sponsor?.id,
      referrerApplicationId: referrerApplication?.id,
      paymentPlan: input.paymentPlan ?? "INSTALLMENT",
    },
  });
}

export async function approveMemberApplication(args: {
  applicationId: string;
  tokenAmount: number;
  paymentMode: "CASH" | "UPI" | "BANK_TRANSFER" | "OFFLINE";
  plotNumber: string;
  referenceNumber?: string;
}) {
  const minRef = await getNumberSetting("bronze_min_referrals");

  return prisma.$transaction(async (tx) => {
    const application = await tx.memberApplication.findUnique({
      where: { id: args.applicationId },
      include: { referrerApplication: { select: { email: true, status: true } } },
    });
    if (!application || application.status !== "PENDING") throw new Error("Pending application not found");

    const duplicate = await tx.member.findFirst({
      where: { OR: [{ mobile: application.mobile }, { email: application.email }] },
    });
    if (duplicate) throw new Error("A member with this mobile or email already exists");

    const plot = await tx.plot.findUnique({ where: { plotNumber: args.plotNumber.trim() } });
    if (!plot) throw new Error("Selected plot number does not exist in inventory");
    if (plot.status !== "AVAILABLE") throw new Error("Selected plot is not available");

    const nodes = await tx.member.findMany({
      where: { NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
      select: { id: true, treeParentId: true, treeSide: true },
      orderBy: { joinDate: "asc" },
    });
    const placement = nodes.length ? findBfsPlacement(nodes as TreeNode[], nodes[0].id) : null;

    let resolvedSponsorId = application.sponsorId;
    if (!resolvedSponsorId && application.referrerApplication) {
      const referrerMember = await tx.member.findUnique({
        where: { email: application.referrerApplication.email },
        select: { id: true },
      });
      if (!referrerMember) throw new Error("The referring free ID must be approved before this application");
      resolvedSponsorId = referrerMember.id;
    }

    const member = await tx.member.create({
      data: {
        memberId: plot.plotNumber,
        plotId: plot.id,
        fullName: application.fullName,
        aadhaarNumber: application.aadhaarNumber,
        aadhaarLast4: application.aadhaarLast4,
        mobile: application.mobile,
        whatsapp: application.whatsapp,
        email: application.email,
        passwordHash: application.passwordHash,
        sponsorId: resolvedSponsorId,
        treeParentId: placement?.parentId,
        treeSide: placement?.side as Side | undefined,
        treeLevel: placement?.level ?? 0,
        paymentPlan: application.paymentPlan,
        kycStatus: "NOT_STARTED",
        isActive: true,
      },
    });

    await tx.plot.update({ where: { id: plot.id }, data: { status: "BOOKED" } });

    if (placement) {
      const allForChain = await tx.member.findMany({
        where: { NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
        select: { id: true, treeParentId: true, treeSide: true },
      });
      const parentOf = new Map(
        allForChain.map((m) => [m.id, { parentId: m.treeParentId, side: m.treeSide as Side | null }])
      );
      const incs = ancestorIncrements({
        newNodeParentId: placement.parentId,
        newNodeSide: placement.side,
        parentOf,
      });
      for (const inc of incs) {
        const ancestor = await tx.member.update({
          where: { id: inc.ancestorId },
          data:
            inc.side === "LEFT"
              ? { leftTeamCount: { increment: 1 } }
              : { rightTeamCount: { increment: 1 } },
        });
        await syncMemberRankTx(tx, ancestor.id, minRef);
      }
    }

    if (resolvedSponsorId) {
      const sponsor = await tx.member.update({
        where: { id: resolvedSponsorId },
        data: { directReferralCount: { increment: 1 } },
      });
      await syncMemberRankTx(tx, sponsor.id, minRef);
    }

    if (application.paymentPlan === "INSTALLMENT") {
      await createInstallmentScheduleTx(tx, member.id, plot.plotPrice);
    }

    const payment = await tx.payment.create({
      data: {
        memberId: member.id,
        paymentType: "BOOKING",
        amount: new Prisma.Decimal(args.tokenAmount),
        paymentMode: args.paymentMode,
        referenceNumber: args.referenceNumber,
        status: "PENDING",
      },
    });

    await tx.memberApplication.update({
      where: { id: application.id },
      data: { status: "APPROVED" },
    });

    return { member, payment };
  });
}

async function generateApplicationCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `FREE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const exists = await prisma.memberApplication.findUnique({ where: { applicationCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a free registration ID");
}

export async function registerMember(input: RegisterInput) {
  const allowMultiple = await getBoolSetting("allow_multiple_plots");
  const minRef = await getNumberSetting("bronze_min_referrals");

  return prisma.$transaction(async (tx) => {
    // 1. Resolve optional referrer. Blank means no sponsor/referrer.
    let sponsor: { id: string; directReferralCount: number; rank: "NONE" | "BRONZE" | "SILVER" | "GOLD" } | null = null;
    if (input.sponsorMemberId) {
      const found = await tx.member.findUnique({ where: { memberId: input.sponsorMemberId } });
      if (!found) throw new Error("Invalid sponsor ID");
      sponsor = found;
    }

    if (!allowMultiple) {
      const existing = await tx.member.findFirst({
        where: { OR: [{ mobile: input.mobile }, { email: input.email }] },
      });
      if (existing) throw new Error("A member with this mobile or email already exists");
    }

    // 2. Reserve the first available plot. plotNumber becomes the member_id.
    const plot = await tx.plot.findFirst({
      where: { status: "AVAILABLE" },
      orderBy: { plotNumber: "asc" },
    });
    if (!plot) throw new Error("No plots available");

    // 3. BFS tree placement over one common member tree. The first real member
    // becomes the root; all later members fill left-to-right, level-by-level.
    const nodes = await tx.member.findMany({
      where: { NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
      select: { id: true, treeParentId: true, treeSide: true },
      orderBy: { joinDate: "asc" },
    });
    const placement = nodes.length ? findBfsPlacement(nodes as TreeNode[], nodes[0].id) : null;

    // 4. Create the member.
    const member = await tx.member.create({
      data: {
        memberId: plot.plotNumber,
        plotId: plot.id,
        fullName: input.fullName,
        aadhaarNumber: encryptPII(input.aadhaarNumber),
        aadhaarLast4: last4(input.aadhaarNumber),
        mobile: input.mobile,
        whatsapp: input.whatsapp ?? input.mobile,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        sponsorId: sponsor?.id,
        treeParentId: placement?.parentId,
        treeSide: placement?.side as Side | undefined,
        treeLevel: placement?.level ?? 0,
        paymentPlan: input.paymentPlan ?? "INSTALLMENT",
        kycStatus: "NOT_STARTED",
        isActive: false,
      },
    });

    // 5. Reserve the plot.
    await tx.plot.update({ where: { id: plot.id }, data: { status: "BOOKED" } });

    // 6. Increment ancestor team counts up the tree.
    if (placement) {
      const allForChain = await tx.member.findMany({
        where: { NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
        select: { id: true, treeParentId: true, treeSide: true },
      });
      const parentOf = new Map(
        allForChain.map((m) => [m.id, { parentId: m.treeParentId, side: m.treeSide as Side | null }])
      );
      const incs = ancestorIncrements({
        newNodeParentId: placement.parentId,
        newNodeSide: placement.side,
        parentOf,
      });
      for (const inc of incs) {
        const ancestor = await tx.member.update({
          where: { id: inc.ancestorId },
          data:
            inc.side === "LEFT"
              ? { leftTeamCount: { increment: 1 } }
              : { rightTeamCount: { increment: 1 } },
        });
        await syncMemberRankTx(tx, ancestor.id, minRef);
      }
    }

    // 7. Generate the EMI schedule for installment plan.
    if ((input.paymentPlan ?? "INSTALLMENT") === "INSTALLMENT") {
      await createInstallmentScheduleTx(tx, member.id, plot.plotPrice);
    }

    return member;
  });
}

async function syncMemberRankTx(tx: Prisma.TransactionClient, memberId: string, bronzeMinReferrals: number) {
  const member = await tx.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { directReferralCount: true, leftTeamCount: true, rightTeamCount: true, rank: true },
  });
  const rank = visibleRank({
    directReferralCount: member.directReferralCount,
    bronzeMinReferrals,
    leftCount: member.leftTeamCount,
    rightCount: member.rightTeamCount,
  });
  if (rank !== member.rank) await tx.member.update({ where: { id: memberId }, data: { rank } });
}

export async function createInstallmentScheduleTx(
  tx: Prisma.TransactionClient,
  memberId: string,
  plotPrice: Prisma.Decimal
) {
  const plotPriceNum = plotPrice.toNumber();
  const booking = await getNumberSetting("booking_amount");
  const num = await getNumberSetting("num_installments");
  const payByDays = await getNumberSetting("emi_pay_by_days_before");
  const start = addMonths(new Date(), 1);
  const rows = generateInstallmentSchedule({
    plotPrice: plotPriceNum,
    bookingAmount: booking,
    numInstallments: num,
    startDate: start,
    payByDays,
  });
  await tx.emiSchedule.createMany({
    data: rows.map((r) => ({
      memberId,
      installmentNo: r.installmentNo,
      amountDue: new Prisma.Decimal(r.amountDue.toFixed(2)),
      dueDate: r.dueDate,
      payByDate: r.payByDate,
      status: "UPCOMING" as const,
    })),
  });
}
