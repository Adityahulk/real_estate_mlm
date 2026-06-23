"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { confirmPayment, recalculateUnpaidCommissions, recomputeEligibilityTx } from "@/lib/services/payments";
import { processDuePayouts, releaseHeldPayouts } from "@/lib/services/payouts";
import { approveMemberApplication, rebuildPaidBinaryTree } from "@/lib/services/members";
import { conductDraw, markDrawPrizeClaimed } from "@/lib/services/draws";
import { approveInsuranceClaim, processDueCashbacks, syncAllPairRewards, transferMemberPlot, updateEmiStatusesAndReminders } from "@/lib/services/operations";
import { hashPassword } from "@/lib/password";
import { storage } from "@/lib/integrations";
// formatINR removed — processDuePayouts no longer returns paidNow amount
import { Prisma } from "@prisma/client";
import { SETTING_META, type SettingKey } from "@/lib/settings";
import { FIXED_BOOKING_AMOUNT, FIXED_PLOT_PRICE } from "@/lib/business-rules";

async function adminId(): Promise<string> {
  const s = await getAdminSession();
  if (!s) throw new Error("Admin auth required");
  const admin = await prisma.user.findUnique({ where: { id: s.sub }, select: { isActive: true } });
  if (!admin?.isActive) throw new Error("Admin account is inactive");
  return s.sub;
}

export async function approveKycAction(memberId: string) {
  const uid = await adminId();
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
    data: { memberId, type: "KYC_UPDATE", title: "KYC approved", message: "Your KYC is approved. Held income payouts can now be released.", channel: "IN_APP", status: "SENT", sentAt: new Date() },
  });
  revalidatePath("/admin/kyc");
}

export async function rejectKycAction(memberId: string, reason: string) {
  const uid = await adminId();
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
    data: { memberId, type: "KYC_UPDATE", title: "KYC rejected", message: `Your KYC was rejected: ${reason}`, channel: "IN_APP", status: "SENT", sentAt: new Date() },
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
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OFFLINE"]),
  plotNumber: z.string().trim().min(1, "Enter customer selected plot number"),
  referenceNumber: z.string().optional(),
});

export async function approveApplicationAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
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
        after: { memberId: member.memberId, tokenAmount: FIXED_BOOKING_AMOUNT },
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/members");
    revalidatePath("/admin/plots");
    return { success: `Approved member ${member.memberId}, collected booking amount, and activated plot ${parsed.data.plotNumber.toUpperCase()}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Approval failed" };
  }
}

export async function rejectApplicationAction(applicationId: string) {
  const uid = await adminId();
  const application = await prisma.memberApplication.findUnique({ where: { id: applicationId } });
  if (!application || application.status !== "PENDING") throw new Error("Pending application not found");
  await prisma.$transaction([
    prisma.memberApplication.update({ where: { id: applicationId }, data: { status: "REJECTED" } }),
    prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "MEMBER_APPLICATION_REJECT",
        entity: "MemberApplication",
        entityId: applicationId,
        before: { applicationCode: application.applicationCode, status: application.status },
        after: { status: "REJECTED" },
      },
    }),
  ]);
  revalidatePath("/admin");
}

export async function rebuildBinaryTreeAction() {
  const uid = await adminId();
  const treeResult = await rebuildPaidBinaryTree();
  const recalculation = await recalculateUnpaidCommissions();
  await prisma.auditLog.create({
    data: {
      actorId: uid,
      action: "BINARY_TREE_REBUILD",
      entity: "Member",
      after: {
        rebuilt: treeResult.rebuilt,
        recalculatedPayments: recalculation.recalculated,
        preservedSettledPayments: recalculation.skippedSettled,
      },
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/payouts");
  revalidatePath("/member/commissions");
}

export async function resetMemberPasswordAction(formData: FormData) {
  const uid = await adminId();
  const memberId = String(formData.get("memberId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { memberId: true } });
  if (!member) throw new Error("Member not found");
  await prisma.$transaction([
    prisma.member.update({ where: { id: memberId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.auditLog.create({
      data: { actorId: uid, action: "MEMBER_PASSWORD_RESET", entity: "Member", entityId: memberId, after: { memberId: member.memberId } },
    }),
  ]);
  revalidatePath("/admin/members");
}

const adminPasswordRecoverySchema = z.object({
  memberLookup: z.string().trim().min(1, "Enter Member ID, mobile, or email"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function adminPasswordRecoveryAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
  const parsed = adminPasswordRecoverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const lookup = parsed.data.memberLookup.trim();
  const lookupUpper = lookup.toUpperCase();
  const members = await prisma.member.findMany({
    where: {
      OR: [
        { memberId: { equals: lookupUpper, mode: "insensitive" } },
        { mobile: lookup },
        { email: lookup.toLowerCase() },
      ],
      NOT: { memberId: "COMPANY" },
    },
    select: { id: true, memberId: true, fullName: true },
    take: 5,
  });

  if (!members.length) return { error: "Member not found" };
  if (members.length > 1) return { error: "Multiple IDs match this contact. Reset using the generated Member ID." };

  await prisma.$transaction([
    prisma.member.update({
      where: { id: members[0].id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    }),
    prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "MEMBER_PASSWORD_RESET",
        entity: "Member",
        entityId: members[0].id,
        after: { memberId: members[0].memberId, via: "ADMIN_PASSWORD_RECOVERY" },
      },
    }),
  ]);
  revalidatePath("/admin/members");
  return { success: `Password updated for ${members[0].memberId} · ${members[0].fullName}` };
}

const offlineSchema = z.object({
  memberId: z.string().min(1),
  paymentType: z.enum(["EMI", "CASHBACK_FULL"]),
  emiScheduleId: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OFFLINE"]),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(),
});

export async function recordOfflinePaymentAction(_prev: { error?: string } | undefined, formData: FormData) {
  const uid = await adminId();
  const parsed = offlineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const emiScheduleId = d.emiScheduleId || null;
  const member = await prisma.member.findUnique({ where: { id: d.memberId } });
  if (!member) return { error: "Member not found" };

  const paymentType = d.paymentType;
  if (paymentType === "EMI") {
    if (!emiScheduleId) return { error: "Select the EMI installment being paid" };
    const emi = await prisma.emiSchedule.findUnique({ where: { id: emiScheduleId } });
    if (!emi || emi.memberId !== d.memberId) return { error: "Invalid EMI for selected member" };
    if (emi.status === "PAID") return { error: "This EMI is already paid" };
    if (!emi.amountDue.equals(d.amount)) return { error: `EMI amount must be exactly ${emi.amountDue.toFixed(2)}` };
  } else {
    if (emiScheduleId) return { error: "Do not select an EMI for a cashback full payment" };
    const cashbackMember = await prisma.member.findUnique({ where: { id: d.memberId }, include: { plot: true } });
    if (!cashbackMember?.plot || cashbackMember.paymentPlan !== "CASHBACK") return { error: "Selected member is not on the cashback plan" };
    const existingCashback = await prisma.payment.findFirst({
      where: { memberId: d.memberId, paymentType: "CASHBACK_FULL", status: "VERIFIED" },
    });
    if (existingCashback) return { error: "Cashback full payment is already verified" };
    const paid = await prisma.payment.aggregate({ where: { memberId: d.memberId, status: "VERIFIED" }, _sum: { amount: true } });
    const remaining = cashbackMember.plot.plotPrice.minus(paid._sum.amount ?? 0);
    if (!remaining.equals(d.amount)) return { error: `Cashback full payment must be exactly ${remaining.toFixed(2)}` };
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

const generatePaymentSchema = z.object({
  memberId: z.string().min(1),
  paymentType: z.enum(["EMI", "CASHBACK_FULL"]),
  emiScheduleId: z.string().optional(),
  notes: z.string().optional(),
});

export async function generatePaymentRequestAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
  const parsed = generatePaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const emiScheduleId = d.emiScheduleId || null;

  try {
    const member = await prisma.member.findUnique({ where: { id: d.memberId }, include: { plot: true } });
    if (!member) return { error: "Member not found" };

    let amount = new Prisma.Decimal(0);
    let message = "";

    if (d.paymentType === "EMI") {
      if (!emiScheduleId) return { error: "Select the EMI installment to generate" };
      const emi = await prisma.emiSchedule.findUnique({ where: { id: emiScheduleId } });
      if (!emi || emi.memberId !== member.id) return { error: "Invalid EMI for selected member" };
      if (emi.status === "PAID") return { error: "This EMI is already paid" };
      const existing = await prisma.payment.findFirst({
        where: { memberId: member.id, emiScheduleId, paymentType: "EMI", status: "PENDING" },
      });
      if (existing) return { error: "A pending payment request already exists for this EMI" };
      amount = emi.amountDue;
      message = `Admin generated EMI #${emi.installmentNo} payment request for ${amount.toFixed(2)}.`;
    } else {
      if (emiScheduleId) return { error: "Do not select EMI for cashback full payment" };
      if (!member.plot || member.paymentPlan !== "CASHBACK") return { error: "Selected member is not on cashback plan" };
      const existing = await prisma.payment.findFirst({
        where: { memberId: member.id, paymentType: "CASHBACK_FULL", status: { in: ["PENDING", "VERIFIED"] } },
      });
      if (existing) return { error: "Cashback full payment is already generated or verified" };
      const paid = await prisma.payment.aggregate({ where: { memberId: member.id, status: "VERIFIED" }, _sum: { amount: true } });
      amount = member.plot.plotPrice.minus(paid._sum.amount ?? 0);
      if (amount.lte(0)) return { error: "No cashback balance is pending" };
      message = `Admin generated cashback full payment request for ${amount.toFixed(2)}.`;
    }

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          memberId: member.id,
          emiScheduleId,
          paymentType: d.paymentType,
          amount,
          paymentMode: "ONLINE",
          status: "PENDING",
          notes: d.notes || message,
        },
      });
      await tx.notification.create({
        data: {
          memberId: member.id,
          type: "PAYMENT_REQUEST",
          title: "Payment request generated",
          message,
          channel: "IN_APP",
          status: "SENT",
          sentAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: uid,
          action: "PAYMENT_REQUEST_GENERATE",
          entity: "Payment",
          entityId: created.id,
          after: { memberId: member.memberId, paymentType: d.paymentType, amount: amount.toFixed(2) },
        },
      });
      return created;
    });

    revalidatePath("/admin/payments");
    revalidatePath("/member/payments");
    revalidatePath("/member/notifications");
    return { success: `Generated payment request ${payment.id.slice(0, 8)} for ${member.memberId}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment request generation failed" };
  }
}

export async function verifyPendingPaymentAction(paymentId: string) {
  const uid = await adminId();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "PENDING") throw new Error("Only pending payments can be verified");
  await confirmPayment(paymentId, uid);
  await prisma.auditLog.create({
    data: { actorId: uid, action: "PAYMENT_REQUEST_VERIFY", entity: "Payment", entityId: paymentId },
  });
  revalidatePath("/admin/payments");
  revalidatePath("/member/payments");
}

const supportReplySchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  adminReply: z.string().trim().optional(),
});

export async function updateSupportRequestAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
  const parsed = supportReplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const request = await prisma.supportRequest.findUnique({
    where: { id: d.requestId },
    include: { member: { select: { memberId: true, fullName: true } } },
  });
  if (!request) return { error: "Request not found" };

  await prisma.$transaction([
    prisma.supportRequest.update({
      where: { id: d.requestId },
      data: {
        status: d.status,
        adminReply: d.adminReply || null,
        handledById: uid,
        handledAt: new Date(),
      },
    }),
    prisma.notification.create({
      data: {
        memberId: request.memberId,
        type: "ADMIN_REQUEST_UPDATE",
        title: `Admin request ${d.status.replace("_", " ").toLowerCase()}`,
        message: d.adminReply || `Your request "${request.subject}" is now ${d.status.replace("_", " ").toLowerCase()}.`,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "SUPPORT_REQUEST_UPDATE",
        entity: "SupportRequest",
        entityId: d.requestId,
        after: { memberId: request.member.memberId, status: d.status },
      },
    }),
  ]);

  revalidatePath("/admin/requests");
  revalidatePath("/member/admin-request");
  revalidatePath("/member/notifications");
  return { success: `Updated request for ${request.member.memberId}` };
}

const plotSchema = z.object({
  plotNumber: z.string().min(1),
  developmentCharges: z.coerce.number().min(0).default(0),
  documentationCharges: z.coerce.number().min(0).default(0),
  locationBlock: z.string().optional(),
  rowNumber: z.string().optional(),
  roadFacing: z.coerce.boolean().optional(),
});

export async function createPlotAction(_prev: { error?: string } | undefined, formData: FormData) {
  await adminId();
  const parsed = plotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = { ...parsed.data, plotNumber: parsed.data.plotNumber.trim().toUpperCase() };
  const exists = await prisma.plot.findUnique({ where: { plotNumber: d.plotNumber } });
  if (exists) return { error: "Plot number already exists" };
  await prisma.plot.create({
    data: {
      plotNumber: d.plotNumber,
      plotPrice: new Prisma.Decimal(FIXED_PLOT_PRICE),
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
  await adminId();
  const parsed = bulkPlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const numbers = Array.from(
    new Set(
      parsed.data.plotNumbers
        .split(/[\s,]+/)
        .map((n) => n.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  if (!numbers.length) return { error: "Enter at least one plot number" };

  const defaultPrice = new Prisma.Decimal(FIXED_PLOT_PRICE);
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
  await adminId();
  const parsed = updatePlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const d = { ...parsed.data, plotNumber: parsed.data.plotNumber.trim().toUpperCase() };

  const current = await prisma.plot.findUnique({ where: { id: d.id }, include: { member: { select: { id: true } } } });
  if (!current) throw new Error("Plot not found");
  if (current.member && current.plotNumber !== d.plotNumber) throw new Error("An assigned plot number cannot be changed");
  if (current.member && d.status === "AVAILABLE") throw new Error("An assigned plot cannot be marked available");

  const duplicate = await prisma.plot.findFirst({
    where: { plotNumber: d.plotNumber, NOT: { id: d.id } },
  });
  if (duplicate) throw new Error("Another plot already uses this plot number");

  await prisma.plot.update({
    where: { id: d.id },
    data: {
      plotNumber: d.plotNumber,
      plotPrice: new Prisma.Decimal(FIXED_PLOT_PRICE),
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

const plotReassignmentSchema = z.object({
  memberId: z.string().min(1, "Select a member"),
  newPlotNumber: z.string().trim().min(1, "Enter the new plot number"),
});

export async function reassignMemberPlotAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
  const parsed = plotReassignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const plotNumber = parsed.data.newPlotNumber.toUpperCase();
    const member = await prisma.member.findUnique({
      where: { id: parsed.data.memberId },
      include: { plot: true },
    });
    if (!member) return { error: "Member not found" };
    if (!member.plotId || !member.plot) return { error: "This member does not have an assigned plot yet" };
    const currentPlot = member.plot;
    if (member.plot.plotNumber === plotNumber) return { error: "Member already has this plot number" };

    const newPlot = await prisma.plot.findUnique({ where: { plotNumber } });
    if (!newPlot) return { error: "Selected plot number does not exist" };
    if (newPlot.status !== "AVAILABLE") return { error: "Selected plot is not available" };

    await prisma.$transaction(async (tx) => {
      await tx.plot.update({
        where: { id: member.plotId! },
        data: { status: "AVAILABLE", bookingDate: null },
      });
      await tx.plot.update({
        where: { id: newPlot.id },
        data: { status: "BOOKED", bookingDate: currentPlot.bookingDate ?? new Date() },
      });
      await tx.member.update({
        where: { id: member.id },
        data: { plotId: newPlot.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: uid,
          action: "MEMBER_PLOT_REASSIGN",
          entity: "Member",
          entityId: member.id,
          before: { memberId: member.memberId, plotNumber: currentPlot.plotNumber },
          after: { plotNumber: newPlot.plotNumber },
        },
      });
    });

    revalidatePath("/admin/plots");
    revalidatePath("/admin/members");
    revalidatePath("/member");
    revalidatePath("/member/plot");
    return { success: `Changed ${member.memberId} from plot ${currentPlot.plotNumber} to ${newPlot.plotNumber}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Plot change failed" };
  }
}

async function saveAdminFile(file: FormDataEntryValue | null, folder: string) {
  if (!file || typeof file === "string" || !file.size) return undefined;
  if (file.size > 10 * 1024 * 1024) throw new Error("Each upload must be 10 MB or smaller");
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Uploads must be PDF, JPG, PNG, or WebP files");
  }
  return storage.save({ folder, filename: file.name || "upload", data: Buffer.from(await file.arrayBuffer()) });
}

export async function updatePlotDocumentsAction(formData: FormData) {
  await adminId();
  const plotId = String(formData.get("plotId") ?? "");
  const [satbaraDocUrl, mappingDocUrl, entryDocUrl, legalDocUrl] = await Promise.all([
    saveAdminFile(formData.get("satbara"), `plot-docs/${plotId}`),
    saveAdminFile(formData.get("mapping"), `plot-docs/${plotId}`),
    saveAdminFile(formData.get("entry"), `plot-docs/${plotId}`),
    saveAdminFile(formData.get("legal"), `plot-docs/${plotId}`),
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
  const uid = await adminId();

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
  await adminId();
  await markDrawPrizeClaimed(winnerId);
  revalidatePath("/admin/draws");
  revalidatePath("/member/draws");
}

export async function runDailyOperationsAction() {
  await adminId();
  await updateEmiStatusesAndReminders();
  await processDueCashbacks();
  await syncAllPairRewards();
  revalidatePath("/admin/operations");
}

export async function recalculateUnpaidIncomeAction() {
  const uid = await adminId();
  try {
    const result = await recalculateUnpaidCommissions();
    await prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "RECALCULATE_UNPAID_INCOME",
        entity: "CommissionLedger",
        after: result,
      },
    });
    revalidatePath("/admin/operations");
    revalidatePath("/admin/payouts");
    revalidatePath("/member/commissions");
    return { success: `Recalculated ${result.recalculated} verified payment(s). Preserved ${result.skippedSettled} settled payment(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Income recalculation failed" };
  }
}

const transferSchema = z.object({
  memberId: z.string().min(1),
  newFullName: z.string().min(2),
  newMobile: z.string().regex(/^\d{10}$/),
  newEmail: z.string().email(),
  newPassword: z.string().min(6),
});

export async function transferPlotAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const uid = await adminId();
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
  const uid = await adminId();
  await approveInsuranceClaim(claimId, uid);
  revalidatePath("/admin/operations");
}

export async function rejectInsuranceClaimAction(claimId: string) {
  const uid = await adminId();
  await prisma.insuranceClaim.update({
    where: { id: claimId },
    data: { status: "REJECTED", reviewedById: uid, reviewedAt: new Date() },
  });
  revalidatePath("/admin/operations");
}

export async function processDuePayoutsAction(_prev: { error?: string; success?: string } | undefined, _formData: FormData) {
  const uid = await adminId();
  try {
    const selectedIds = String(_formData.get("selectedIds") ?? "");
    const payoutIds = selectedIds.split(",").filter(Boolean);
    const amountToPay = Number(_formData.get("amountToPay"));
    const paymentMode = z.enum(["BANK_TRANSFER", "UPI", "CASH", "ONLINE"]).parse(_formData.get("paymentMode"));
    const result = await processDuePayouts({ processedById: uid, payoutIds, amountToPay, paymentMode });
    await prisma.auditLog.create({
      data: {
        actorId: uid,
        action: "PAYOUT_RECORD",
        entity: "Payout",
        after: { payoutIds, amount: result.paidNow, paymentMode },
      },
    });
    revalidatePath("/admin/payouts");
    return { success: `Recorded ${result.paidNow.toFixed(2)} across ${result.processed} payout line(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Payout processing failed" };
  }
}

export async function updateSettingsAction(formData: FormData) {
  const uid = await adminId();
  const updates: { key: SettingKey; value: string }[] = [];
  for (const key of Object.keys(SETTING_META) as SettingKey[]) {
    const raw = formData.get(key);
    if (typeof raw !== "string") continue;
    if (SETTING_META[key].type === "BOOLEAN") {
      if (!["true", "false"].includes(raw)) throw new Error(`Invalid value for ${SETTING_META[key].label}`);
    } else if (SETTING_META[key].type === "NUMBER") {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${SETTING_META[key].label} must be a non-negative number`);
    }
    updates.push({ key, value: raw });
  }
  const startDay = Number(updates.find((entry) => entry.key === "payment_window_start_day")?.value);
  const endDay = Number(updates.find((entry) => entry.key === "payment_window_end_day")?.value);
  if (startDay && (startDay < 1 || startDay > 31)) throw new Error("Payment window start day must be between 1 and 31");
  if (endDay && (endDay < 1 || endDay > 31)) throw new Error("Payment window end day must be between 1 and 31");
  if (startDay && endDay && startDay > endDay) throw new Error("Payment window start day cannot be after the end day");

  for (const entry of updates) {
    await prisma.systemSetting.update({ where: { key: entry.key }, data: { value: entry.value } });
  }
  await prisma.auditLog.create({ data: { actorId: uid, action: "UPDATE_SETTINGS", entity: "SystemSetting" } });
  revalidatePath("/admin/settings");
}
