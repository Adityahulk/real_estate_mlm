"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { confirmPayment, recomputeEligibilityTx } from "@/lib/services/payments";
import { processDuePayouts, releaseHeldPayouts } from "@/lib/services/payouts";
import { isBronze } from "@/lib/engines/eligibility";
import { getNumberSetting } from "@/lib/settings";
import { Prisma } from "@prisma/client";

function adminId(): string {
  const s = getAdminSession();
  if (!s) throw new Error("Admin auth required");
  return s.sub;
}

export async function approveKycAction(memberId: string) {
  const uid = adminId();
  await prisma.$transaction(async (tx) => {
    await tx.memberKyc.update({
      where: { memberId },
      data: { status: "APPROVED", reviewedById: uid, reviewedAt: new Date(), rejectionReason: null },
    });
    await tx.member.update({ where: { id: memberId }, data: { kycStatus: "APPROVED" } });
    await recomputeEligibilityTx(tx, memberId);
    await tx.auditLog.create({
      data: { actorId: uid, action: "KYC_APPROVE", entity: "Member", entityId: memberId },
    });
  });
  // Release any commission held while this member's KYC was pending.
  await releaseHeldPayouts(memberId);
  await prisma.notification.create({
    data: { memberId, type: "KYC_UPDATE", title: "KYC approved", message: "Your KYC is approved. You can now make payments.", channel: "WHATSAPP", status: "SENT", sentAt: new Date() },
  });
  revalidatePath("/admin/kyc");
}

export async function rejectKycAction(memberId: string, reason: string) {
  const uid = adminId();
  await prisma.$transaction(async (tx) => {
    await tx.memberKyc.update({
      where: { memberId },
      data: { status: "REJECTED", reviewedById: uid, reviewedAt: new Date(), rejectionReason: reason },
    });
    await tx.member.update({ where: { id: memberId }, data: { kycStatus: "REJECTED" } });
    await tx.auditLog.create({
      data: { actorId: uid, action: "KYC_REJECT", entity: "Member", entityId: memberId, after: { reason } },
    });
  });
  await prisma.notification.create({
    data: { memberId, type: "KYC_UPDATE", title: "KYC rejected", message: `Your KYC was rejected: ${reason}`, channel: "WHATSAPP", status: "SENT", sentAt: new Date() },
  });
  revalidatePath("/admin/kyc");
}

export async function rejectKycFormAction(formData: FormData) {
  const memberId = formData.get("memberId") as string;
  const reason = (formData.get("reason") as string) || "Documents not clear";
  await rejectKycAction(memberId, reason);
}

export async function approveMemberAction(memberId: string) {
  const uid = adminId();
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");
  if (member.isActive) return;

  const bookingPaid = await prisma.payment.findFirst({
    where: { memberId, paymentType: "BOOKING", status: "VERIFIED" },
  });
  if (!bookingPaid) {
    throw new Error("Booking amount must be verified before approving this account");
  }

  const minRef = await getNumberSetting("bronze_min_referrals");
  await prisma.$transaction(async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: { isActive: true } });
    if (member.sponsorId) {
      const sponsor = await tx.member.update({
        where: { id: member.sponsorId },
        data: { directReferralCount: { increment: 1 } },
      });
      if (isBronze(sponsor.directReferralCount, minRef) && sponsor.rank !== "BRONZE") {
        await tx.member.update({ where: { id: sponsor.id }, data: { rank: "BRONZE" } });
      }
    }
    await tx.auditLog.create({
      data: { actorId: uid, action: "MEMBER_APPROVE", entity: "Member", entityId: memberId },
    });
  });
  revalidatePath("/admin/members");
}

const offlineSchema = z.object({
  memberId: z.string().min(1),
  emiScheduleId: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OFFLINE"]),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(),
});

export async function recordOfflinePaymentAction(_prev: { error?: string } | undefined, formData: FormData) {
  const uid = adminId();
  const parsed = offlineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const emiScheduleId = d.emiScheduleId || null;
  const member = await prisma.member.findUnique({ where: { id: d.memberId } });
  if (!member) return { error: "Member not found" };

  const paymentType: "BOOKING" | "EMI" = emiScheduleId ? "EMI" : "BOOKING";
  if (emiScheduleId) {
    const emi = await prisma.emiSchedule.findUnique({ where: { id: emiScheduleId } });
    if (!emi || emi.memberId !== d.memberId) return { error: "Invalid EMI for selected member" };
    if (emi.status === "PAID") return { error: "This EMI is already paid" };
  } else {
    const existingBooking = await prisma.payment.findFirst({
      where: { memberId: d.memberId, paymentType: "BOOKING", status: "VERIFIED" },
    });
    if (existingBooking) return { error: "Booking payment is already verified" };
  }

  const payment = await prisma.payment.create({
    data: {
      memberId: d.memberId,
      emiScheduleId,
      paymentType,
      amount: new Prisma.Decimal(d.amount),
      paymentMode: d.paymentMode,
      referenceNumber: d.referenceNumber,
      paymentDate: d.paymentDate ? new Date(d.paymentDate) : new Date(),
      status: "PENDING",
    },
  });
  await confirmPayment(payment.id, uid);
  await prisma.auditLog.create({
    data: { actorId: uid, action: "OFFLINE_PAYMENT", entity: "Payment", entityId: payment.id, after: { amount: d.amount } },
  });
  revalidatePath("/admin/payments");
  return { error: undefined };
}

const plotSchema = z.object({
  plotNumber: z.string().min(1),
  plotPrice: z.coerce.number().positive(),
  developmentCharges: z.coerce.number().min(0).default(0),
  documentationCharges: z.coerce.number().min(0).default(0),
  locationBlock: z.string().optional(),
  rowNumber: z.string().optional(),
  roadFacing: z.coerce.boolean().optional(),
});

export async function createPlotAction(_prev: { error?: string } | undefined, formData: FormData) {
  adminId();
  const parsed = plotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const exists = await prisma.plot.findUnique({ where: { plotNumber: d.plotNumber } });
  if (exists) return { error: "Plot number already exists" };
  await prisma.plot.create({
    data: {
      plotNumber: d.plotNumber,
      plotPrice: new Prisma.Decimal(d.plotPrice),
      developmentCharges: new Prisma.Decimal(d.developmentCharges),
      documentationCharges: new Prisma.Decimal(d.documentationCharges),
      locationBlock: d.locationBlock,
      rowNumber: d.rowNumber,
      roadFacing: !!d.roadFacing,
    },
  });
  revalidatePath("/admin/plots");
  return { error: undefined };
}

const bulkPlotSchema = z.object({
  plotNumbers: z.string().min(1, "Enter at least one plot number"),
});

export async function bulkCreatePlotsAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  adminId();
  const parsed = bulkPlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const numbers = Array.from(
    new Set(
      parsed.data.plotNumbers
        .split(/[\s,]+/)
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );
  if (!numbers.length) return { error: "Enter at least one plot number" };

  const defaultPrice = new Prisma.Decimal("300000");
  const existing = await prisma.plot.findMany({
    where: { plotNumber: { in: numbers } },
    select: { plotNumber: true },
  });
  const existingSet = new Set(existing.map((p) => p.plotNumber));
  const toCreate = numbers.filter((n) => !existingSet.has(n));

  if (toCreate.length) {
    await prisma.plot.createMany({
      data: toCreate.map((plotNumber) => ({
        plotNumber,
        plotPrice: defaultPrice,
      })),
    });
  }

  revalidatePath("/admin/plots");
  return {
    success: `Added ${toCreate.length} plot(s). Skipped ${existing.length} duplicate(s).`,
  };
}

const updatePlotSchema = plotSchema.extend({
  id: z.string().min(1),
  status: z.enum(["AVAILABLE", "BOOKED", "SOLD", "DRAW_WON"]),
});

export async function updatePlotAction(formData: FormData) {
  adminId();
  const parsed = updatePlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const d = parsed.data;

  const duplicate = await prisma.plot.findFirst({
    where: { plotNumber: d.plotNumber, NOT: { id: d.id } },
  });
  if (duplicate) throw new Error("Another plot already uses this plot number");

  await prisma.plot.update({
    where: { id: d.id },
    data: {
      plotNumber: d.plotNumber,
      plotPrice: new Prisma.Decimal(d.plotPrice),
      developmentCharges: new Prisma.Decimal(d.developmentCharges),
      documentationCharges: new Prisma.Decimal(d.documentationCharges),
      locationBlock: d.locationBlock,
      rowNumber: d.rowNumber,
      roadFacing: !!d.roadFacing,
      status: d.status,
    },
  });
  revalidatePath("/admin/plots");
}

export async function processDuePayoutsAction() {
  const uid = adminId();
  await processDuePayouts(uid);
  revalidatePath("/admin/payouts");
}

export async function updateSettingsAction(formData: FormData) {
  const uid = adminId();
  const entries = Array.from(formData.entries());
  for (const [key, value] of entries) {
    if (typeof value !== "string") continue;
    await prisma.systemSetting.update({ where: { key }, data: { value } }).catch(() => {});
  }
  await prisma.auditLog.create({ data: { actorId: uid, action: "UPDATE_SETTINGS", entity: "SystemSetting" } });
  revalidatePath("/admin/settings");
}
