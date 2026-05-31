import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { computeCommissionLines } from "../engines/commission";
import { DEFAULT_COMMISSION_RULES, MAX_SPONSOR_DEPTH } from "../engines/commissionRules";
import { buildSponsorChain } from "../engines/tree";
import { getNumberSetting } from "../settings";
import { notifier, storage } from "../integrations";
import { formatINR, applyAdminCharge, round2 } from "../money";
import { addDays } from "../engines/emi";

// The single confirmation path used by BOTH online (webhook) and offline (admin)
// payments. Idempotent: re-running on an already-verified payment is a no-op.
export async function confirmPayment(paymentId: string, verifiedById?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { include: { plot: true } }, emiSchedule: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "VERIFIED") return payment; // idempotent

  const plotPrice = payment.member.plot?.plotPrice ?? new Prisma.Decimal(0);
  const pointRate = await getNumberSetting("point_to_inr_rate");
  const adminChargePct = await getNumberSetting("admin_charge_pct");

  await prisma.$transaction(async (tx) => {
    // 1. Mark payment verified.
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: verifiedById ?? null },
    });

    // 2. Mark the EMI installment paid.
    if (payment.emiScheduleId) {
      await tx.emiSchedule.update({
        where: { id: payment.emiScheduleId },
        data: { status: "PAID" },
      });
    }

    // 3. On the booking payment, stamp the plot booking date.
    if (payment.paymentType === "BOOKING" && payment.member.plotId) {
      await tx.plot.update({
        where: { id: payment.member.plotId },
        data: { bookingDate: payment.paymentDate },
      });
    }

    // 4. Commission engine — walk the SPONSOR chain and post points.
    const sponsorRows = await tx.member.findMany({ select: { id: true, sponsorId: true } });
    const sponsorOf = new Map(sponsorRows.map((m) => [m.id, m.sponsorId]));
    const chain = buildSponsorChain({
      startSponsorId: payment.member.sponsorId,
      sponsorOf,
      maxDepth: MAX_SPONSOR_DEPTH,
    });

    if (chain.length && plotPrice.gt(0)) {
      const lines = computeCommissionLines({
        amountPaid: payment.amount.toNumber(),
        plotPrice: plotPrice.toNumber(),
        uplineChain: chain,
        rules: DEFAULT_COMMISSION_RULES,
      });

      // KYC status of every beneficiary decides PENDING vs ON_HOLD.
      const beneficiaryIds = Array.from(new Set(lines.map((l) => l.beneficiaryId)));
      const beneficiaries = await tx.member.findMany({
        where: { id: { in: beneficiaryIds } },
        select: { id: true, kycStatus: true },
      });
      const kycOf = new Map(beneficiaries.map((b) => [b.id, b.kycStatus]));
      const payByDate = addDays(new Date(), 1); // next-day transfer

      // Group commission lines per beneficiary -> one payout each.
      for (const beneficiaryId of beneficiaryIds) {
        const myLines = lines.filter((l) => l.beneficiaryId === beneficiaryId);
        const grossPoints = myLines.reduce((a, l) => a.plus(l.points), new Prisma.Decimal(0));
        const grossCash = round2(grossPoints.mul(pointRate));
        const { adminCharge, net } = applyAdminCharge(grossCash, adminChargePct);
        const approved = kycOf.get(beneficiaryId) === "APPROVED";
        const ledgerStatus = approved ? "POINTS" : "HOLD";

        const payout = await tx.payout.upsert({
          where: { triggeredById_memberId: { triggeredById: payment.id, memberId: beneficiaryId } },
          create: {
            memberId: beneficiaryId,
            triggeredById: payment.id,
            grossAmount: new Prisma.Decimal(grossCash.toFixed(2)),
            adminCharge: new Prisma.Decimal(adminCharge.toFixed(2)),
            netAmount: new Prisma.Decimal(net.toFixed(2)),
            payoutDate: payByDate,
            status: approved ? "PENDING" : "ON_HOLD",
            onHoldReason: approved ? null : "KYC not approved",
          },
          update: {},
        });

        for (const line of myLines) {
          const cash = round2(line.points.mul(pointRate));
          await tx.commissionLedger.upsert({
            where: {
              paymentId_beneficiaryId_incomeType: {
                paymentId: payment.id,
                beneficiaryId: line.beneficiaryId,
                incomeType: line.incomeType,
              },
            },
            create: {
              beneficiaryId: line.beneficiaryId,
              sourceMemberId: payment.memberId,
              paymentId: payment.id,
              incomeType: line.incomeType,
              pointsEarned: new Prisma.Decimal(line.points.toFixed(2)),
              cashAmount: new Prisma.Decimal(cash.toFixed(2)),
              status: ledgerStatus,
              payoutId: payout.id,
            },
            update: {},
          });
        }
      }
    }

    // 5. Recompute draw eligibility for the paying member.
    await recomputeEligibilityTx(tx, payment.memberId);
  });

  // 6. Generate a receipt (stub PDF -> text) and attach.
  const receiptUrl = await generateReceipt(payment.id);
  await prisma.payment.update({ where: { id: payment.id }, data: { receiptUrl } });

  // 7. Notify member + beneficiaries.
  await prisma.notification.create({
    data: {
      memberId: payment.memberId,
      type: "PAYMENT_VERIFIED",
      title: "Payment received",
      message: `We received ${formatINR(payment.amount)}. Receipt is ready.`,
      channel: "WHATSAPP",
      status: "SENT",
      sentAt: new Date(),
    },
  });
  await notifier.send({
    channel: "WHATSAPP",
    to: payment.member.whatsapp ?? payment.member.mobile,
    title: "Payment received",
    message: `Thank you! ${formatINR(payment.amount)} received for plot ${payment.member.memberId}.`,
  });

  return prisma.payment.findUnique({ where: { id: payment.id } });
}

export async function recomputeEligibilityTx(tx: Prisma.TransactionClient, memberId: string) {
  const member = await tx.member.findUnique({ where: { id: memberId } });
  if (!member) return;
  const overdue = await tx.emiSchedule.count({ where: { memberId, status: "OVERDUE" } });
  const eligible = member.kycStatus === "APPROVED" && member.isActive && overdue === 0;
  await tx.member.update({ where: { id: memberId }, data: { isDrawEligible: eligible } });
}

async function generateReceipt(paymentId: string): Promise<string> {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: true },
  });
  if (!p) return "";
  const content = [
    "SHREE SHYAM VILLA - 2",
    "Payment Receipt",
    "----------------------------------------",
    `Receipt for Payment: ${p.id}`,
    `Member ID: ${p.member.memberId}`,
    `Name: ${p.member.fullName}`,
    `Type: ${p.paymentType}`,
    `Amount: ${formatINR(p.amount)}`,
    `Mode: ${p.paymentMode}`,
    `Reference: ${p.referenceNumber ?? p.gatewayTxnId ?? "-"}`,
    `Date: ${p.paymentDate.toISOString().slice(0, 10)}`,
    `Status: VERIFIED`,
  ].join("\n");
  return storage.save({
    folder: "receipts",
    filename: `receipt_${p.id}.txt`,
    data: Buffer.from(content, "utf8"),
  });
}
