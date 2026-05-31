import { prisma } from "../db";
import { payoutProvider, notifier } from "../integrations";
import { formatINR } from "../money";

// Lists payouts grouped by status for the admin screen.
export async function payoutSummary() {
  const [pending, onHold, paid] = await Promise.all([
    prisma.payout.aggregate({ where: { status: "PENDING" }, _sum: { netAmount: true }, _count: true }),
    prisma.payout.aggregate({ where: { status: "ON_HOLD" }, _sum: { netAmount: true }, _count: true }),
    prisma.payout.aggregate({ where: { status: "PAID" }, _sum: { netAmount: true }, _count: true }),
  ]);
  const recent = await prisma.payout.findMany({
    include: { member: { select: { memberId: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    pending: { count: pending._count, net: pending._sum.netAmount?.toNumber() ?? 0 },
    onHold: { count: onHold._count, net: onHold._sum.netAmount?.toNumber() ?? 0 },
    paid: { count: paid._count, net: paid._sum.netAmount?.toNumber() ?? 0 },
    recent,
  };
}

// Executes all due PENDING payouts via the (stubbed) bulk transfer, marks them
// PAID with a UTR, flips their commission ledger lines to PAID, and notifies.
export async function processDuePayouts(processedById: string) {
  const due = await prisma.payout.findMany({
    where: { status: "PENDING", payoutDate: { lte: endOfToday() } },
    include: { member: { select: { id: true, memberId: true, whatsapp: true, mobile: true } } },
  });
  if (!due.length) return { processed: 0 };

  const results = await payoutProvider.bulkTransfer(
    due.map((p) => ({ memberId: p.memberId, amount: p.netAmount.toNumber(), mode: "BANK_TRANSFER" }))
  );
  const resultByMember = new Map(results.map((r) => [r.memberId, r]));

  let processed = 0;
  for (const p of due) {
    const r = resultByMember.get(p.memberId);
    const success = r?.success ?? false;
    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: p.id },
        data: {
          status: success ? "PAID" : "FAILED",
          utrNumber: r?.utr,
          paidAt: success ? new Date() : null,
          processedById,
        },
      });
      if (success) {
        await tx.commissionLedger.updateMany({ where: { payoutId: p.id }, data: { status: "PAID" } });
      }
    });
    if (success) {
      processed++;
      await prisma.notification.create({
        data: {
          memberId: p.memberId,
          type: "PAYOUT_DONE",
          title: "Income credited",
          message: `${formatINR(p.netAmount)} credited (Gross ${formatINR(p.grossAmount)}, Admin ${formatINR(p.adminCharge)}). UTR ${r?.utr}.`,
          channel: "WHATSAPP",
          status: "SENT",
          sentAt: new Date(),
        },
      });
      await notifier.send({
        channel: "WHATSAPP",
        to: p.member.whatsapp ?? p.member.mobile,
        title: "Income credited",
        message: `${formatINR(p.netAmount)} credited to your account. UTR ${r?.utr}`,
      });
    }
  }
  return { processed };
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
