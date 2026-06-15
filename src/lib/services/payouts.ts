import { prisma } from "../db";
import { formatINR } from "../money";
import { Prisma, PayoutMode } from "@prisma/client";

// Lists payouts grouped by status for the admin screen.
export async function payoutSummary() {
  const dueBy = endOfToday();
  const [pending, upcoming, processing, onHold, paid] = await Promise.all([
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { lte: dueBy } }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { gt: dueBy } }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "PROCESSING" }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "ON_HOLD" }, select: { netAmount: true, paidAmount: true } }),
    prisma.payout.findMany({ where: { status: "PAID" }, select: { netAmount: true } }),
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
  const sumRemaining = (rows: { netAmount: { toNumber(): number }; paidAmount?: { toNumber(): number } }[]) =>
    rows.reduce((sum, row) => sum + Math.max(0, row.netAmount.toNumber() - (row.paidAmount?.toNumber() ?? 0)), 0);
  return {
    pending: { count: pending.length, net: sumRemaining(pending) },
    upcoming: { count: upcoming.length, net: sumRemaining(upcoming) },
    processing: { count: processing.length, net: sumRemaining(processing) },
    onHold: { count: onHold.length, net: sumRemaining(onHold) },
    paid: { count: paid.length, net: paid.reduce((sum, row) => sum + row.netAmount.toNumber(), 0) },
    recent,
  };
}

export async function processDuePayouts(args: {
  processedById: string;
  payoutIds: string[];
  amountToPay: number;
  paymentMode: PayoutMode;
}) {
  if (!args.payoutIds.length) throw new Error("Select at least one due payout");
  if (!Number.isFinite(args.amountToPay) || args.amountToPay <= 0) throw new Error("Enter a valid payout amount");

  const due = await prisma.payout.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      payoutDate: { lte: endOfToday() },
      id: { in: args.payoutIds },
    },
    select: { id: true, memberId: true, netAmount: true, paidAmount: true },
    orderBy: { createdAt: "asc" },
  });
  if (due.length !== new Set(args.payoutIds).size) throw new Error("One or more selected payouts are no longer due");

  const totalRemaining = due.reduce((sum, payout) => sum + Math.max(0, payout.netAmount.toNumber() - payout.paidAmount.toNumber()), 0);
  if (args.amountToPay > totalRemaining + 0.001) throw new Error(`Amount cannot exceed the selected pending total of ${formatINR(totalRemaining)}`);

  let remainingToAllocate = new Prisma.Decimal(args.amountToPay.toFixed(2));
  let processed = 0;
  const paidByMember = new Map<string, number>();

  for (const p of due) {
    if (remainingToAllocate.lte(0)) break;
    const pending = p.netAmount.minus(p.paidAmount);
    if (pending.lte(0)) continue;
    const paidNow = Prisma.Decimal.min(pending, remainingToAllocate);
    const newPaidAmount = p.paidAmount.plus(paidNow);
    const fullyPaid = newPaidAmount.gte(p.netAmount);

    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: p.id },
        data: {
          paidAmount: newPaidAmount,
          status: fullyPaid ? "PAID" : "PENDING",
          paymentMode: args.paymentMode,
          paidAt: fullyPaid ? new Date() : null,
          processedById: args.processedById,
        },
      });
      if (fullyPaid) {
        await tx.commissionLedger.updateMany({ where: { payoutId: p.id }, data: { status: "PAID" } });
      }
    });
    processed++;
    remainingToAllocate = remainingToAllocate.minus(paidNow);
    paidByMember.set(p.memberId, (paidByMember.get(p.memberId) ?? 0) + paidNow.toNumber());
  }

  for (const [memberId, amount] of Array.from(paidByMember.entries())) {
    await prisma.notification.create({
      data: {
        memberId,
        type: "PAYOUT_DONE",
        title: "Income payout recorded",
        message: `${formatINR(amount)} payout recorded by admin.`,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }

  return { processed, paidNow: args.amountToPay - remainingToAllocate.toNumber() };
}

export async function requestMemberWithdrawal(memberId: string) {
  const due = await prisma.payout.findMany({
    where: {
      memberId,
      status: "PENDING",
      payoutDate: { lte: endOfToday() },
    },
    select: { id: true, netAmount: true, paidAmount: true },
  });

  if (!due.length) throw new Error("No due payout is available for withdrawal right now");

  const requestable = due.filter((payout) => payout.netAmount.gt(payout.paidAmount));
  if (!requestable.length) throw new Error("No pending payout balance is available for withdrawal");
  const requestedAmount = requestable.reduce((sum, payout) => sum + Math.max(0, payout.netAmount.toNumber() - payout.paidAmount.toNumber()), 0);
  if (requestedAmount < 500) throw new Error("Minimum withdrawal amount is ₹500");

  await prisma.$transaction(async (tx) => {
    await tx.payout.updateMany({
      where: { id: { in: requestable.map((payout) => payout.id) } },
      data: { status: "PROCESSING" },
    });
    await tx.notification.create({
      data: {
        memberId,
        type: "PAYOUT_DONE",
        title: "Withdrawal request submitted",
        message: `Your withdrawal request for ${formatINR(requestedAmount)} has been sent to admin for processing.`,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  });

  return {
    requested: requestable.length,
    amount: requestedAmount,
  };
}

// When a member's KYC is approved, release their held payouts to PENDING.
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
