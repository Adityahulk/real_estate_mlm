"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getMemberSession } from "@/lib/auth";
import { encryptPII, last4 } from "@/lib/crypto";
import { storage } from "@/lib/integrations";
import { releaseHeldPayouts, requestMemberWithdrawal } from "@/lib/services/payouts";

async function memberId(): Promise<string> {
  const s = await getMemberSession();
  if (!s) throw new Error("Not authenticated");
  return s.sub;
}

async function saveFile(file: FormDataEntryValue | null, folder: string): Promise<string | undefined> {
  if (!file || typeof file === "string") return undefined;
  const f = file as File;
  if (!f.size) return undefined;
  if (f.size > 10 * 1024 * 1024) throw new Error("Each upload must be 10 MB or smaller");
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(f.type)) {
    throw new Error("Uploads must be PDF, JPG, PNG, or WebP files");
  }
  const buf = Buffer.from(await f.arrayBuffer());
  return storage.save({ folder, filename: f.name || "upload", data: buf });
}

const kycSchema = z.object({
  aadhaarCardNumber: z.string().trim().regex(/^\d{12}$/, "Aadhaar card number must be 12 digits"),
  aadhaarCardAddress: z.string().trim().min(1, "Enter Aadhaar card address"),
  panCardNumber: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, "Enter a valid PAN card number").transform((value) => value.toUpperCase()),
  bankName: z.string().trim().min(1, "Enter bank name"),
  accountNumber: z.string().trim().min(4, "Enter bank account number"),
  ifscCode: z.string().trim().min(4, "Enter IFSC code"),
  accountHolderName: z.string().trim().min(1, "Enter account holder name"),
  nomineeName: z.string().trim().min(1, "Enter nominee name"),
  nomineeRelation: z.string().trim().min(1, "Enter nominee relation"),
  nomineePhone: z.string().trim().regex(/^\d{10}$/, "Nominee mobile must be 10 digits"),
});

export async function submitKycAction(_prev: { error?: string } | undefined, formData: FormData) {
  const id = await memberId();
  const parsed = kycSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existing = await prisma.memberKyc.findUnique({ where: { memberId: id } });
  if (existing?.status === "APPROVED" && !existing.editAllowed) {
    return { error: "Your KYC is already approved. Contact admin if you need to edit it." };
  }

  const profilePhotoUrl = await saveFile(formData.get("profilePhoto"), `kyc/${id}`);

  const aadhaarNumber = encryptPII(d.aadhaarCardNumber);
  const panNumber = encryptPII(d.panCardNumber);
  const accountNumber = encryptPII(d.accountNumber);
  const reviewedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.memberKyc.upsert({
      where: { memberId: id },
      create: {
        memberId: id,
        aadhaarCardNumber: aadhaarNumber,
        aadhaarCardLast4: last4(d.aadhaarCardNumber),
        aadhaarCardAddress: d.aadhaarCardAddress,
        panCardNumber: panNumber,
        panCardLast4: last4(d.panCardNumber),
        bankName: d.bankName,
        accountNumber,
        accountLast4: last4(d.accountNumber),
        ifscCode: d.ifscCode,
        accountHolderName: d.accountHolderName,
        nomineeName: d.nomineeName || null,
        nomineeRelation: d.nomineeRelation || null,
        nomineePhone: d.nomineePhone || null,
        profilePhotoUrl,
        status: "APPROVED",
        editAllowed: false,
        reviewedAt,
      },
      update: {
        aadhaarCardNumber: aadhaarNumber,
        aadhaarCardLast4: last4(d.aadhaarCardNumber),
        aadhaarCardAddress: d.aadhaarCardAddress,
        panCardNumber: panNumber,
        panCardLast4: last4(d.panCardNumber),
        bankName: d.bankName,
        accountNumber,
        accountLast4: last4(d.accountNumber),
        ifscCode: d.ifscCode,
        accountHolderName: d.accountHolderName,
        nomineeName: d.nomineeName || null,
        nomineeRelation: d.nomineeRelation || null,
        nomineePhone: d.nomineePhone || null,
        ...(profilePhotoUrl && { profilePhotoUrl }),
        status: "APPROVED",
        editAllowed: false,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt,
      },
    });
    await tx.member.update({
      where: { id },
      data: { kycStatus: "APPROVED", aadhaarNumber, aadhaarLast4: last4(d.aadhaarCardNumber) },
    });
    await tx.auditLog.create({
      data: {
        action: "MEMBER_KYC_AUTO_APPROVE",
        entity: "MemberKyc",
        entityId: id,
        after: { memberId: id },
      },
    });
  });
  await releaseHeldPayouts(id);
  revalidatePath("/admin/kyc");
  revalidatePath("/member/kyc");
  revalidatePath("/member");
  return { success: "KYC completed and approved." };
}

const insuranceSchema = z.object({
  deathDate: z.string().min(1),
  deathType: z.string().min(1),
});

export async function submitInsuranceClaimAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const id = await memberId();
  const parsed = insuranceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const member = await prisma.member.findUniqueOrThrow({ where: { id }, include: { kyc: true } });
  if (!member.kyc?.nomineeName || !member.kyc.nomineeRelation || !member.kyc.nomineePhone) {
    return { error: "Complete nominee KYC details before submitting an insurance claim" };
  }
  const monthsPaid = await prisma.emiSchedule.count({ where: { memberId: id, status: "PAID" } });
  const deathCertificateUrl = await saveFile(formData.get("deathCertificate"), `insurance/${id}`);
  await prisma.insuranceClaim.create({
    data: {
      memberId: id,
      monthsPaid,
      deathDate: new Date(parsed.data.deathDate),
      deathType: parsed.data.deathType,
      nomineeName: member.kyc.nomineeName,
      nomineeRelation: member.kyc.nomineeRelation,
      nomineePhone: member.kyc.nomineePhone,
      deathCertificateUrl,
    },
  });
  revalidatePath("/member/insurance");
  return { success: "Insurance claim submitted for admin review" };
}

export async function requestWithdrawalAction(_prev: { error?: string; success?: string } | undefined) {
  void _prev;
  const id = await memberId();
  try {
    const result = await requestMemberWithdrawal(id);
    revalidatePath("/member");
    revalidatePath("/member/commissions");
    revalidatePath("/admin/payouts");
    return { success: `Withdrawal request sent for ${result.requested} payout line(s), total ${result.amount.toFixed(2)}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Withdrawal request failed" };
  }
}

const adminRequestSchema = z.object({
  category: z.enum(["PAYMENT", "LOGIN", "KYC", "PLOT", "INCOME", "TREE", "OTHER"]),
  subject: z.string().trim().min(3, "Enter a short subject"),
  message: z.string().trim().min(10, "Describe the issue in at least 10 characters"),
});

export async function submitAdminRequestAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const id = await memberId();
  const parsed = adminRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const request = await prisma.supportRequest.create({
    data: {
      memberId: id,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });

  revalidatePath("/member/admin-request");
  revalidatePath("/admin/requests");
  return { success: `Admin request submitted. Request ID: ${request.id.slice(0, 8).toUpperCase()}` };
}

export async function uploadPaymentProofAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const id = await memberId();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: "Payment request not found" };
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.memberId !== id) return { error: "Payment request not found" };
  if (payment.status !== "PENDING") return { error: "Proof can only be uploaded for a pending payment" };

  try {
    const proofUrl = await saveFile(formData.get("paymentProof"), `payment-proofs/${id}`);
    if (!proofUrl) return { error: "Select a PDF or image proof" };
    await prisma.payment.update({
      where: { id: payment.id },
      data: { proofUrl, proofUploadedAt: new Date() },
    });
    revalidatePath("/member/payments");
    revalidatePath("/admin/payments");
    return { success: "Payment proof uploaded. Admin can now review it." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment proof upload failed" };
  }
}
