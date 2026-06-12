import { prisma } from "../db";
import { hashPassword } from "../password";
import { findBfsPlacement, findSponsorPlacementRoot, ancestorIncrements, type TreeNode, type Side } from "../engines/tree";
import { visibleRank } from "../engines/eligibility";
import { getNumberSetting } from "../settings";
import { generateInstallmentSchedule, addMonths } from "../engines/emi";
import { Prisma } from "@prisma/client";
import { FIXED_BOOKING_AMOUNT, FIXED_MONTHLY_EMI_AMOUNT } from "../business-rules";

export const COMPANY_ROOT_MEMBER_ID = "COMPANY";

export interface RegisterInput {
  fullName: string;
  aadhaarNumber?: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  password: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  sponsorMemberId?: string; // generated Member ID, e.g. SSV000001
  paymentPlan?: "INSTALLMENT" | "CASHBACK";
  preferredSide?: "LEFT" | "RIGHT";
}

export async function createMemberApplication(input: RegisterInput) {
  const referralId = input.sponsorMemberId?.trim().toUpperCase();
  if (!referralId) throw new Error("Sponsor ID is required");
  const sponsor = await prisma.member.findUnique({
    where: { memberId: referralId },
    select: { id: true, isActive: true },
  });
  if (!sponsor?.isActive) throw new Error("Invalid Sponsor ID. Enter a generated ID such as SSV000001.");

  const email = input.email?.trim().toLowerCase() || undefined;
  const memberConditions = [{ mobile: input.mobile }, ...(email ? [{ email }] : [])];
  const applicationConditions = [{ mobile: input.mobile }, ...(email ? [{ email }] : [])];
  const [existingMember, existingApplication] = await Promise.all([
    prisma.member.findFirst({ where: { OR: memberConditions } }),
    prisma.memberApplication.findFirst({ where: { OR: applicationConditions } }),
  ]);
  if (existingMember) throw new Error("A member with this mobile or email already exists");
  if (existingApplication) throw new Error("An application with this mobile or email already exists");

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const memberId = await generateMemberIdTx(tx);
    const member = await tx.member.create({
      data: {
        memberId,
        fullName: input.fullName,
        mobile: input.mobile,
        whatsapp: input.whatsapp ?? input.mobile,
        email,
        passwordHash,
        sponsorId: sponsor.id,
        paymentPlan: input.paymentPlan ?? "INSTALLMENT",
        isActive: true,
      },
    });
    if (input.nomineeName || input.nomineeRelation || input.nomineePhone) {
      await tx.memberKyc.create({
        data: {
          memberId: member.id,
          nomineeName: input.nomineeName,
          nomineeRelation: input.nomineeRelation,
          nomineePhone: input.nomineePhone,
          status: "NOT_STARTED",
        },
      });
    }
    const application = await tx.memberApplication.create({
      data: {
        fullName: input.fullName,
        mobile: input.mobile,
        whatsapp: input.whatsapp ?? input.mobile,
        email,
        passwordHash,
        nomineeName: input.nomineeName,
        nomineeRelation: input.nomineeRelation,
        nomineePhone: input.nomineePhone,
        applicationCode: memberId,
        sponsorId: sponsor.id,
        paymentPlan: input.paymentPlan ?? "INSTALLMENT",
      },
    });
    return { ...application, memberId: member.memberId };
  });
}

export async function approveMemberApplication(args: {
  applicationId: string;
  paymentMode: "CASH" | "UPI" | "BANK_TRANSFER" | "OFFLINE";
  plotNumber: string;
  referenceNumber?: string;
}) {
  const minRef = await getNumberSetting("bronze_min_referrals");

  return prisma.$transaction(async (tx) => {
    const application = await tx.memberApplication.findUnique({ where: { id: args.applicationId } });
    if (!application || application.status !== "PENDING") throw new Error("Pending application not found");

    const existingMember = await tx.member.findUnique({ where: { mobile: application.mobile } }) ?? await tx.member.create({
      data: {
        memberId: application.applicationCode,
        fullName: application.fullName,
        mobile: application.mobile,
        whatsapp: application.whatsapp,
        email: application.email,
        passwordHash: application.passwordHash,
        sponsorId: application.sponsorId,
        paymentPlan: application.paymentPlan,
        isActive: true,
      },
    });
    if (existingMember.plotId) throw new Error("This member already has a plot");

    const plot = await tx.plot.findUnique({ where: { plotNumber: args.plotNumber.trim().toUpperCase() } });
    if (!plot) throw new Error("Selected plot number does not exist in inventory");
    if (plot.status !== "AVAILABLE") throw new Error("Selected plot is not available");

    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72839402)::text`;
    const nodes = await tx.member.findMany({
      where: { plotId: { not: null }, NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
      select: { id: true, treeParentId: true, treeSide: true, treeLevel: true },
      orderBy: { joinDate: "asc" },
    });
    const sponsorRows = await tx.member.findMany({ select: { id: true, sponsorId: true } });
    const sponsorOf = new Map(sponsorRows.map((row) => [row.id, row.sponsorId]));
    const placementRootId = nodes.length
      ? findSponsorPlacementRoot({
          startSponsorId: existingMember.sponsorId,
          sponsorOf,
          paidMemberIds: new Set(nodes.map((node) => node.id)),
          fallbackRootId: nodes[0].id,
        })
      : null;
    const placement = placementRootId ? findBfsPlacement(nodes as TreeNode[], placementRootId) : null;
    const treeLevel = placement ? (nodes.find((node) => node.id === placement.parentId)?.treeLevel ?? 0) + 1 : 0;

    const member = await tx.member.update({
      where: { id: existingMember.id },
      data: {
        plotId: plot.id,
        treeParentId: placement?.parentId,
        treeSide: placement?.side as Side | undefined,
        treeLevel,
      },
    });

    await tx.plot.update({ where: { id: plot.id }, data: { status: "BOOKED" } });

    if (placement) {
      const allForChain = await tx.member.findMany({
        where: { plotId: { not: null }, NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
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

    if (member.sponsorId) {
      const sponsor = await tx.member.update({
        where: { id: member.sponsorId },
        data: { directReferralCount: { increment: 1 } },
      });
      await syncMemberRankTx(tx, sponsor.id, minRef);
    }

    if (application.paymentPlan === "INSTALLMENT") {
      await createInstallmentScheduleTx(tx, member.id);
    }

    const payment = await tx.payment.create({
      data: {
        memberId: member.id,
        paymentType: "BOOKING",
        amount: new Prisma.Decimal(FIXED_BOOKING_AMOUNT),
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

export async function rebuildPaidBinaryTree() {
  const minRef = await getNumberSetting("bronze_min_referrals");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72839402)::text`;
    const [paidMembers, sponsorRows] = await Promise.all([
      tx.member.findMany({
        where: { plotId: { not: null }, NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
        select: { id: true, sponsorId: true },
        orderBy: [{ joinDate: "asc" }, { createdAt: "asc" }],
      }),
      tx.member.findMany({ select: { id: true, sponsorId: true } }),
    ]);
    if (!paidMembers.length) return { rebuilt: 0 };

    await tx.member.updateMany({
      where: { plotId: { not: null }, NOT: { memberId: COMPANY_ROOT_MEMBER_ID } },
      data: { treeParentId: null, treeSide: null, treeLevel: 0, leftTeamCount: 0, rightTeamCount: 0 },
    });

    const sponsorOf = new Map(sponsorRows.map((row) => [row.id, row.sponsorId]));
    const placedNodes: TreeNode[] = [];
    const paidMemberIds = new Set<string>();
    const levelOf = new Map<string, number>();

    for (const member of paidMembers) {
      if (!placedNodes.length) {
        placedNodes.push({ id: member.id, treeParentId: null, treeSide: null });
        paidMemberIds.add(member.id);
        levelOf.set(member.id, 0);
        continue;
      }
      const placementRootId = findSponsorPlacementRoot({
        startSponsorId: member.sponsorId,
        sponsorOf,
        paidMemberIds,
        fallbackRootId: placedNodes[0].id,
      });
      const placement = findBfsPlacement(placedNodes, placementRootId);
      const treeLevel = (levelOf.get(placement.parentId) ?? 0) + 1;
      await tx.member.update({
        where: { id: member.id },
        data: { treeParentId: placement.parentId, treeSide: placement.side, treeLevel },
      });
      placedNodes.push({ id: member.id, treeParentId: placement.parentId, treeSide: placement.side });
      paidMemberIds.add(member.id);
      levelOf.set(member.id, treeLevel);
    }

    const parentOf = new Map(placedNodes.map((node) => [node.id, { parentId: node.treeParentId, side: node.treeSide }]));
    const counts = new Map<string, { left: number; right: number }>();
    for (const node of placedNodes) {
      if (!node.treeParentId || !node.treeSide) continue;
      for (const inc of ancestorIncrements({ newNodeParentId: node.treeParentId, newNodeSide: node.treeSide, parentOf })) {
        const count = counts.get(inc.ancestorId) ?? { left: 0, right: 0 };
        if (inc.side === "LEFT") count.left++;
        else count.right++;
        counts.set(inc.ancestorId, count);
      }
    }
    for (const member of paidMembers) {
      const count = counts.get(member.id) ?? { left: 0, right: 0 };
      await tx.member.update({ where: { id: member.id }, data: { leftTeamCount: count.left, rightTeamCount: count.right } });
      await syncMemberRankTx(tx, member.id, minRef);
    }
    return { rebuilt: paidMembers.length };
  });
}

export function nextMemberId(latestMemberId?: string | null): string {
  const next = Number(latestMemberId?.slice(3) || "0") + 1;
  return `SSV${String(next).padStart(6, "0")}`;
}

async function generateMemberIdTx(tx: Prisma.TransactionClient): Promise<string> {
  // Serialize ID allocation so simultaneous registrations cannot receive the same ID.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(72839401)::text`;
  const latest = await tx.member.findFirst({
    where: { memberId: { startsWith: "SSV" } },
    select: { memberId: true },
    orderBy: { memberId: "desc" },
  });
  return nextMemberId(latest?.memberId);
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
  memberId: string
) {
  const num = await getNumberSetting("num_installments");
  const payByDays = await getNumberSetting("emi_pay_by_days_before");
  const start = addMonths(new Date(), 1);
  const rows = generateInstallmentSchedule({
    installmentAmount: FIXED_MONTHLY_EMI_AMOUNT,
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
