import { prisma } from "../db";
import { notifier } from "../integrations";
import { formatINR } from "../money";

// Lists payouts grouped by status for the admin screen.
export async function payoutSummary() {
  const dueBy = endOfToday();
  const [pending, upcoming, onHold, paid] = await Promise.all([
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { lte: dueBy } }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { gt: dueBy } }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "ON_HOLD" }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { paidAmount: { gt: 0 } }, select: { paidAmount: true } }),
  ]);
  const recent = await prisma.payout.findMany({
    include: {
      member: { select: { memberId: true, fullName: true } },
      commissions: {
        include: { sourceMember: { select: { memberId: true, fullName: true } } },
        orderBy: { incomeType: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const remaining = (rows: { netAmount: { toNumber(): number }; paidAmount: { toNumber(): number } }[]) =>
    rows.reduce((sum, row) => sum + Math.max(0, row.netAmount.toNumber() - row.paidAmount.toNumber()), 0);
  const paidSum = (rows: { paidAmount: { toNumber(): number } }[]) =>
    rows.reduce((sum, row) => sum + row.paidAmount.toNumber(), 0);
  return {
    pending: { count: pending.length, net: remaining(pending) },
    upcoming: { count: upcoming.length, net: remaining(upcoming) },
    onHold: { count: onHold.length, net: remaining(onHold) },
    paid: { count: paid.length, net: paidSum(paid) },
    recent,
  };
}

// Records how much admin is paying now against selected due payout lines.
// Fully paid lines become PAID; partially paid lines remain PENDING with a
// paidAmount balance so the UI can show paid vs pending clearly.
export async function processDuePayouts(args: {
  processedById: string;
  payoutIds?: string[];
  amount: number;
  mode: "CASH" | "ONLINE";
}) {
  const due = await prisma.payout.findMany({
    where: {
      status: "PENDING",
      payoutDate: { lte: endOfToday() },
      ...(args.payoutIds?.length ? { id: { in: args.payoutIds } } : {}),
    },
    include: { member: { select: { id: true, memberId: true, whatsapp: true, mobile: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!due.length) return { processed: 0, failed: 0 };

  let amountLeft = Math.round(args.amount * 100) / 100;
  const selectedRemaining = due.reduce((sum, p) => sum + Math.max(0, p.netAmount.toNumber() - p.paidAmount.toNumber()), 0);
  if (amountLeft <= 0) throw new Error("Enter payout amount");
  amountLeft = Math.min(amountLeft, selectedRemaining);

  let processed = 0;
  let paidNow = 0;
  const paidByMember = new Map<string, { member: (typeof due)[number]["member"]; amount: number }>();
  for (const p of due) {
    if (amountLeft <= 0) break;
    const remaining = Math.max(0, p.netAmount.toNumber() - p.paidAmount.toNumber());
    if (remaining <= 0) continue;
    const linePayment = Math.min(remaining, amountLeft);
    const nextPaid = Math.round((p.paidAmount.toNumber() + linePayment) * 100) / 100;
    const fullyPaid = nextPaid >= p.netAmount.toNumber();
    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: p.id },
        data: {
          paidAmount: nextPaid,
          paymentMode: args.mode,
          status: fullyPaid ? "PAID" : "PENDING",
          paidAt: fullyPaid ? new Date() : null,
          processedById: args.processedById,
        },
      });
      if (fullyPaid) {
        await tx.commissionLedger.updateMany({ where: { payoutId: p.id }, data: { status: "PAID" } });
      }
    });
    processed++;
    paidNow += linePayment;
    const memberPaid = paidByMember.get(p.memberId);
    paidByMember.set(p.memberId, { member: p.member, amount: (memberPaid?.amount ?? 0) + linePayment });
    amountLeft = Math.round((amountLeft - linePayment) * 100) / 100;
  }
  if (paidNow > 0) {
    for (const [memberId, { member, amount }] of Array.from(paidByMember.entries())) {
      await prisma.notification.create({
        data: {
          memberId,
          type: "PAYOUT_DONE",
          title: "Income payout recorded",
          message: `${formatINR(amount)} payout recorded by admin via ${args.mode}.`,
          channel: "WHATSAPP",
          status: "SENT",
          sentAt: new Date(),
        },
      });
      await notifier.send({
        channel: "WHATSAPP",
        to: member.whatsapp ?? member.mobile,
        title: "Income payout recorded",
        message: `${formatINR(amount)} payout recorded by admin via ${args.mode}.`,
      });
    }
  }
  return { processed, failed: 0, paidNow };
}

// When a member's KYC is approved, release their held payouts to PENDING so the
// next "process due payouts" run pays them out. Ledger HOLD -> POINTS.
export async function releaseHeldPayouts(memberId: string) {
  const held = await prisma.payout.findMany({ where: { memberId, status: "ON_HOLD" } });
  if (!held.length) return { released: 0 };
  await prisma.$transaction(async (tx) => {
    await tx.payout.updateMany({
      where: { memberId, status: "ON_HOLD" },
      data: { status: "PENDING", onHoldReason: null, payoutDate: new Date() },
    });
    await tx.commissionLedger.updateMany({
      where: { payoutId: { in: held.map((h) => h.id) }, status: "HOLD" },
      data: { status: "POINTS" },
    });
  });
  return { released: held.length };
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
