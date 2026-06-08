import { prisma } from "../db";
import { notifier } from "../integrations";
import { formatINR } from "../money";

// Lists payouts grouped by status for the admin screen.
export async function payoutSummary() {
  const dueBy = endOfToday();
  const [pending, upcoming, onHold, paid] = await Promise.all([
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { lte: dueBy } }, select: { netAmount: true } }),
    prisma.payout.findMany({ where: { status: "PENDING", payoutDate: { gt: dueBy } }, select: { netAmount: true } }),
    prisma.payout.findMany({ where: { status: "ON_HOLD" }, select: { netAmount: true } }),
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
  const sumNet = (rows: { netAmount: { toNumber(): number } }[]) =>
    rows.reduce((sum, row) => sum + row.netAmount.toNumber(), 0);
  return {
    pending: { count: pending.length, net: sumNet(pending) },
    upcoming: { count: upcoming.length, net: sumNet(upcoming) },
    onHold: { count: onHold.length, net: sumNet(onHold) },
    paid: { count: paid.length, net: sumNet(paid) },
    recent,
  };
}

export async function processDuePayouts(args: {
  processedById: string;
  payoutIds?: string[];
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

  let processed = 0;
  const paidByMember = new Map<string, { member: (typeof due)[number]["member"]; amount: number }>();

  for (const p of due) {
    await prisma.$transaction(async (tx) => {
      const utr = "UTR" + Math.random().toString(36).slice(2, 10).toUpperCase();
      await tx.payout.update({
        where: { id: p.id },
        data: {
          status: "PAID",
          utrNumber: utr,
          paidAt: new Date(),
          processedById: args.processedById,
        },
      });
      await tx.commissionLedger.updateMany({ where: { payoutId: p.id }, data: { status: "PAID" } });
    });
    processed++;
    const prev = paidByMember.get(p.memberId);
    paidByMember.set(p.memberId, {
      member: p.member,
      amount: (prev?.amount ?? 0) + p.netAmount.toNumber(),
    });
  }

  for (const [memberId, { member, amount }] of Array.from(paidByMember.entries())) {
    await prisma.notification.create({
      data: {
        memberId,
        type: "PAYOUT_DONE",
        title: "Income payout recorded",
        message: `${formatINR(amount)} payout recorded by admin.`,
        channel: "WHATSAPP",
        status: "SENT",
        sentAt: new Date(),
      },
    });
    await notifier.send({
      channel: "WHATSAPP",
      to: member.whatsapp ?? member.mobile,
      title: "Income payout recorded",
      message: `${formatINR(amount)} payout recorded by admin.`,
    });
  }

  return { processed, failed: 0 };
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
