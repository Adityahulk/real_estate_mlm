import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { computeProgramCommissionLines } from "../engines/commission";
import { DEFAULT_COMMISSION_RULES, MAX_SPONSOR_DEPTH } from "../engines/commissionRules";
import { buildSponsorChain } from "../engines/tree";
import { getNumberSetting } from "../settings";
import { storage } from "../integrations";
import { formatINR, applyAdminCharge, round2 } from "../money";
import { addDays } from "../engines/emi";
import { createCashbackCreditsTx } from "./operations";
import { COMMISSION_PLAN_VALUE, FIXED_DISTRIBUTION_AMOUNT } from "../business-rules";

// The single confirmation path used by BOTH online (webhook) and offline (admin)
// payments. Idempotent: re-running on an already-verified payment is a no-op.
export async function confirmPayment(paymentId: string, verifiedById?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { include: { plot: true } }, emiSchedule: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "VERIFIED") return payment; // idempotent

  const pointRate = await getNumberSetting("point_to_inr_rate");
  const adminChargePct = 5;

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

    if (payment.paymentType === "CASHBACK_FULL" && payment.member.plot) {
      await createCashbackCreditsTx(tx, payment.memberId, payment.member.plot.plotPrice, payment.paymentDate);
    }

    // 4. Sponsor income follows referrals; level income follows tree placement.
    await postPaymentCommissionsTx(tx, {
      paymentId: payment.id,
      sourceMemberId: payment.memberId,
      sponsorId: payment.member.sponsorId,
      treeParentId: payment.member.treeParentId,
      pointRate,
      adminChargePct,
    });

    // 5. Recompute draw eligibility for the paying member.
    await recomputeEligibilityTx(tx, payment.memberId);
  });

  // 6. Generate a plain-text receipt and attach it.
  const receiptUrl = await generateReceipt(payment.id);
  await prisma.payment.update({ where: { id: payment.id }, data: { receiptUrl } });

  // 7. Notify member + beneficiaries.
  await prisma.notification.create({
    data: {
      memberId: payment.memberId,
      type: "PAYMENT_VERIFIED",
      title: "Payment received",
      message: `We received ${formatINR(payment.amount)}. Receipt is ready.`,
      channel: "IN_APP",
      status: "SENT",
      sentAt: new Date(),
    },
  });

  return prisma.payment.findUnique({ where: { id: payment.id } });
}

async function postPaymentCommissionsTx(
  tx: Prisma.TransactionClient,
  args: {
    paymentId: string;
    sourceMemberId: string;
    sponsorId: string | null;
    treeParentId: string | null;
    pointRate: number;
    adminChargePct: number;
  }
) {
  const memberRows = await tx.member.findMany({ select: { id: true, sponsorId: true, treeParentId: true } });
  const sponsorOf = new Map(memberRows.map((member) => [member.id, member.sponsorId]));
  const treeParentOf = new Map(memberRows.map((member) => [member.id, member.treeParentId]));
  const sponsorChain = buildSponsorChain({
    startSponsorId: args.sponsorId,
    sponsorOf,
    maxDepth: MAX_SPONSOR_DEPTH,
  });
  const treeAncestorChain = buildSponsorChain({
    startSponsorId: args.treeParentId,
    sponsorOf: treeParentOf,
    maxDepth: MAX_SPONSOR_DEPTH,
  });
  const calculatedLines = computeProgramCommissionLines({
    amountPaid: FIXED_DISTRIBUTION_AMOUNT,
    plotPrice: COMMISSION_PLAN_VALUE,
    sponsorChain,
    treeAncestorChain,
    rules: DEFAULT_COMMISSION_RULES,
  });
  const beneficiaries = await tx.member.findMany({
    where: { id: { in: Array.from(new Set(calculatedLines.map((line) => line.beneficiaryId))) } },
    select: { id: true, kycStatus: true, isActive: true, plotId: true },
  });
  const activePaidIds = new Set(beneficiaries.filter((beneficiary) => beneficiary.isActive && beneficiary.plotId).map((beneficiary) => beneficiary.id));
  const lines = calculatedLines.filter((line) => activePaidIds.has(line.beneficiaryId));
  const beneficiaryIds = Array.from(new Set(lines.map((line) => line.beneficiaryId)));
  if (!beneficiaryIds.length) return;
  const kycOf = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary.kycStatus]));
  const payByDate = addDays(new Date(), 1);

  for (const beneficiaryId of beneficiaryIds) {
    const myLines = lines.filter((line) => line.beneficiaryId === beneficiaryId);
    const grossPoints = myLines.reduce((total, line) => total.plus(line.points), new Prisma.Decimal(0));
    const grossCash = round2(grossPoints.mul(args.pointRate));
    const { adminCharge, net } = applyAdminCharge(grossCash, args.adminChargePct);
    const approved = kycOf.get(beneficiaryId) === "APPROVED";
    const ledgerStatus = approved ? "POINTS" : "HOLD";

    const payout = await tx.payout.upsert({
      where: { triggeredById_memberId: { triggeredById: args.paymentId, memberId: beneficiaryId } },
      create: {
        memberId: beneficiaryId,
        triggeredById: args.paymentId,
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
      const cash = round2(line.points.mul(args.pointRate));
      await tx.commissionLedger.upsert({
        where: {
          paymentId_beneficiaryId_incomeType: {
            paymentId: args.paymentId,
            beneficiaryId: line.beneficiaryId,
            incomeType: line.incomeType,
          },
        },
        create: {
          beneficiaryId: line.beneficiaryId,
          sourceMemberId: args.sourceMemberId,
          paymentId: args.paymentId,
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

export async function recalculateUnpaidCommissions() {
  const pointRate = await getNumberSetting("point_to_inr_rate");
  const payments = await prisma.payment.findMany({
    where: { status: "VERIFIED" },
    include: {
      member: { select: { sponsorId: true, treeParentId: true } },
      payouts: { select: { status: true, paidAmount: true } },
      commissions: { where: { status: "PAID" }, select: { id: true } },
    },
    orderBy: { paymentDate: "asc" },
  });
  let recalculated = 0;
  let skippedSettled = 0;
  for (const payment of payments) {
    const settled = payment.commissions.length > 0 || payment.payouts.some((payout) => payout.status === "PAID" || payout.paidAmount.gt(0));
    if (settled) {
      skippedSettled++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.commissionLedger.deleteMany({ where: { paymentId: payment.id } });
      await tx.payout.deleteMany({ where: { triggeredById: payment.id } });
      await postPaymentCommissionsTx(tx, {
        paymentId: payment.id,
        sourceMemberId: payment.memberId,
        sponsorId: payment.member.sponsorId,
        treeParentId: payment.member.treeParentId,
        pointRate,
        adminChargePct: 5,
      });
    });
    recalculated++;
  }
  return { recalculated, skippedSettled };
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
    folder: `receipts/${p.memberId}`,
    filename: `receipt_${p.id}.txt`,
    data: Buffer.from(content, "utf8"),
  });
}
