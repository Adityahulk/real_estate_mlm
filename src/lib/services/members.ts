import { prisma } from "../db";
import { hashPassword } from "../password";
import { encryptPII, last4 } from "../crypto";
import { findBfsPlacement, ancestorIncrements, type TreeNode, type Side } from "../engines/tree";
import { isBronze } from "../engines/eligibility";
import { getNumberSetting, getBoolSetting } from "../settings";
import { generateInstallmentSchedule, addMonths } from "../engines/emi";
import { Prisma } from "@prisma/client";

export const COMPANY_ROOT_MEMBER_ID = "COMPANY";

export interface RegisterInput {
  fullName: string;
  aadhaarNumber: string;
  mobile: string;
  whatsapp?: string;
  email: string;
  password: string;
  sponsorMemberId?: string; // the human-facing member_id of the sponsor
  paymentPlan?: "INSTALLMENT" | "CASHBACK";
  preferredSide?: "LEFT" | "RIGHT";
}

export async function registerMember(input: RegisterInput) {
  const allowMultiple = await getBoolSetting("allow_multiple_plots");

  return prisma.$transaction(async (tx) => {
    // 1. Resolve sponsor (default to company root).
    const root = await tx.member.findUnique({ where: { memberId: COMPANY_ROOT_MEMBER_ID } });
    if (!root) throw new Error("Company root member missing — run the seed");

    let sponsor = root;
    if (input.sponsorMemberId && input.sponsorMemberId !== COMPANY_ROOT_MEMBER_ID) {
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

    // 3. BFS tree placement over existing members (incl. company root).
    const nodes = await tx.member.findMany({
      select: { id: true, treeParentId: true, treeSide: true },
    });
    const placement = findBfsPlacement(nodes as TreeNode[], root.id);

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
        sponsorId: sponsor.id,
        treeParentId: placement.parentId,
        treeSide: placement.side as Side,
        treeLevel: placement.level,
        paymentPlan: input.paymentPlan ?? "INSTALLMENT",
        kycStatus: "NOT_STARTED",
      },
    });

    // 5. Reserve the plot.
    await tx.plot.update({ where: { id: plot.id }, data: { status: "BOOKED" } });

    // 6. Increment ancestor team counts up the tree.
    const allForChain = await tx.member.findMany({
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
      await tx.member.update({
        where: { id: inc.ancestorId },
        data:
          inc.side === "LEFT"
            ? { leftTeamCount: { increment: 1 } }
            : { rightTeamCount: { increment: 1 } },
      });
    }

    // 7. Bump sponsor's direct referral count + bronze rank.
    if (sponsor.id !== root.id || input.sponsorMemberId) {
      const minRef = await getNumberSetting("bronze_min_referrals");
      const updated = await tx.member.update({
        where: { id: sponsor.id },
        data: { directReferralCount: { increment: 1 } },
      });
      if (isBronze(updated.directReferralCount, minRef) && updated.rank !== "BRONZE") {
        await tx.member.update({ where: { id: sponsor.id }, data: { rank: "BRONZE" } });
      }
    }

    // 8. Generate the EMI schedule for installment plan.
    if ((input.paymentPlan ?? "INSTALLMENT") === "INSTALLMENT") {
      await createInstallmentScheduleTx(tx, member.id, plot.plotPrice);
    }

    return member;
  });
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
