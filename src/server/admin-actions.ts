"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { confirmPayment, recomputeEligibilityTx } from "@/lib/services/payments";
import { processDuePayouts, releaseHeldPayouts } from "@/lib/services/payouts";
import { approveMemberApplication } from "@/lib/services/members";
import { conductDraw, markDrawPrizeClaimed } from "@/lib/services/draws";
import { approveInsuranceClaim, processDueCashbacks, syncAllPairRewards, transferMemberPlot, updateEmiStatusesAndReminders } from "@/lib/services/operations";
import { hashPassword } from "@/lib/password";
import { storage } from "@/lib/integrations";
import { formatINR } from "@/lib/money";
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

const approveApplicationSchema = z.object({
  applicationId: z.string().min(1),
  tokenAmount: z.coerce.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OFFLINE"]),
  plotNumber: z.string().trim().min(1, "Enter customer selected plot number"),
  referenceNumber: z.string().optional(),
});

export async function approveApplicationAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = adminId();
  const parsed = approveApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { member, payment } = await approveMemberApplication(parsed.data);
    await confirmPayment(payment.id, uid);
    await prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "MEMBER_APPLICATION_APPROVE",
        entity: "MemberApplication",
        entityId: parsed.data.applicationId,
        after: { memberId: member.memberId, tokenAmount: parsed.data.tokenAmount },
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/members");
    revalidatePath("/admin/plots");
    return { success: `Approved, collected booking amount, and activated plot ${member.memberId}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Approval failed" };
  }
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

  const defaultPrice = new Prisma.Decimal("300240");
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

async function saveAdminFile(file: FormDataEntryValue | null, folder: string) {
  if (!file || typeof file === "string" || !file.size) return undefined;
  return storage.save({ folder, filename: file.name || "upload", data: Buffer.from(await file.arrayBuffer()) });
}

export async function updatePlotDocumentsAction(formData: FormData) {
  adminId();
  const plotId = String(formData.get("plotId") ?? "");
  const [satbaraDocUrl, mappingDocUrl, entryDocUrl, legalDocUrl] = await Promise.all([
    saveAdminFile(formData.get("satbara"), "plot-docs"),
    saveAdminFile(formData.get("mapping"), "plot-docs"),
    saveAdminFile(formData.get("entry"), "plot-docs"),
    saveAdminFile(formData.get("legal"), "plot-docs"),
  ]);
  await prisma.plot.update({
    where: { id: plotId },
    data: {
      ...(satbaraDocUrl && { satbaraDocUrl }),
      ...(mappingDocUrl && { mappingDocUrl }),
      ...(entryDocUrl && { entryDocUrl }),
      ...(legalDocUrl && { legalDocUrl }),
    },
  });
  revalidatePath("/admin/plots");
}

export async function conductDrawAction(_prev: { error?: string; success?: string } | undefined, _formData: FormData) {
  void _prev;
  void _formData;
  const uid = adminId();

  try {
    const result = await conductDraw({ conductedById: uid });
    await prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "DRAW_CONDUCT",
        entity: "DrawEvent",
        entityId: result.draw.id,
        after: { drawNumber: result.draw.drawNumber, winnerCount: result.winners.length },
      },
    });
    revalidatePath("/admin/draws");
    revalidatePath("/member/draws");
    return { success: `Draw #${result.draw.drawNumber} completed with ${result.winners.length} winner(s)` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draw failed" };
  }
}

export async function markDrawPrizeClaimedAction(winnerId: string) {
  adminId();
  await markDrawPrizeClaimed(winnerId);
  revalidatePath("/admin/draws");
  revalidatePath("/member/draws");
}

export async function runDailyOperationsAction() {
  adminId();
  await updateEmiStatusesAndReminders();
  await processDueCashbacks();
  await syncAllPairRewards();
  revalidatePath("/admin/operations");
}

const transferSchema = z.object({
  memberId: z.string().min(1),
  newFullName: z.string().min(2),
  newMobile: z.string().regex(/^\d{10}$/),
  newEmail: z.string().email(),
  newPassword: z.string().min(6),
});

export async function transferPlotAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = adminId();
  const parsed = transferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const member = await transferMemberPlot({
      ...parsed.data,
      newPasswordHash: await hashPassword(parsed.data.newPassword),
      processedById: uid,
    });
    revalidatePath("/admin/operations");
    revalidatePath("/admin/members");
    return { success: `Transferred plot/member ID ${member.memberId}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Transfer failed" };
  }
}

export async function approveInsuranceClaimAction(claimId: string) {
  const uid = adminId();
  await approveInsuranceClaim(claimId, uid);
  revalidatePath("/admin/operations");
}

export async function rejectInsuranceClaimAction(claimId: string) {
  const uid = adminId();
  await prisma.insuranceClaim.update({
    where: { id: claimId },
    data: { status: "REJECTED", reviewedById: uid, reviewedAt: new Date() },
  });
  revalidatePath("/admin/operations");
}

export async function processDuePayoutsAction(_prev: { error?: string; success?: string } | undefined, _formData: FormData) {
  const uid = adminId();
  try {
    const selectedIds = String(_formData.get("selectedIds") ?? "");
    const payoutIds = selectedIds ? selectedIds.split(",").filter(Boolean) : undefined;
    const amount = Number(_formData.get("amountToPay") ?? 0);
    const modeRaw = String(_formData.get("paymentMode") ?? "CASH");
    const mode = modeRaw === "ONLINE" ? "ONLINE" : "CASH";
    const result = await processDuePayouts({ processedById: uid, payoutIds, amount, mode });
    revalidatePath("/admin/payouts");
    if (!result.processed && !result.failed) return { success: "No selected payouts are due today. Upcoming payouts will become available on their payout date." };
    if (result.failed) return { error: `Processed ${result.processed} payout(s); ${result.failed} payout(s) failed.` };
    return { success: `Recorded ${formatINR(result.paidNow ?? amount)} across ${result.processed} payout line(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Payout processing failed" };
  }
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
