"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getMemberSession } from "@/lib/auth";
import { encryptPII, last4 } from "@/lib/crypto";
import { storage, paymentGateway } from "@/lib/integrations";
import { confirmPayment } from "@/lib/services/payments";
import { Prisma } from "@prisma/client";

function memberId(): string {
  const s = getMemberSession();
  if (!s) throw new Error("Not authenticated");
  return s.sub;
}

async function saveFile(file: FormDataEntryValue | null, folder: string): Promise<string | undefined> {
  if (!file || typeof file === "string") return undefined;
  const f = file as File;
  if (!f.size) return undefined;
  const buf = Buffer.from(await f.arrayBuffer());
  return storage.save({ folder, filename: f.name || "upload", data: buf });
}

const kycSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(4),
  ifscCode: z.string().min(4),
  accountHolderName: z.string().min(1),
  nomineeName: z.string().min(1),
  nomineeRelation: z.string().min(1),
  nomineeAadhaar: z.string().regex(/^\d{12}$/, "Nominee Aadhaar must be 12 digits"),
  nomineePhone: z.string().regex(/^\d{10}$/, "Nominee phone must be 10 digits"),
});

export async function submitKycAction(_prev: { error?: string } | undefined, formData: FormData) {
  const id = memberId();
  const parsed = kycSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [aadhaarFrontUrl, aadhaarBackUrl, panCardUrl, profilePhotoUrl] = await Promise.all([
    saveFile(formData.get("aadhaarFront"), "kyc"),
    saveFile(formData.get("aadhaarBack"), "kyc"),
    saveFile(formData.get("panCard"), "kyc"),
    saveFile(formData.get("profilePhoto"), "kyc"),
  ]);

  await prisma.memberKyc.upsert({
    where: { memberId: id },
    create: {
      memberId: id,
      bankName: d.bankName,
      accountNumber: encryptPII(d.accountNumber),
      accountLast4: last4(d.accountNumber),
      ifscCode: d.ifscCode,
      accountHolderName: d.accountHolderName,
      nomineeName: d.nomineeName,
      nomineeRelation: d.nomineeRelation,
      nomineeAadhaar: encryptPII(d.nomineeAadhaar),
      nomineePhone: d.nomineePhone,
      aadhaarFrontUrl,
      aadhaarBackUrl,
      panCardUrl,
      profilePhotoUrl,
      status: "PENDING",
    },
    update: {
      bankName: d.bankName,
      accountNumber: encryptPII(d.accountNumber),
      accountLast4: last4(d.accountNumber),
      ifscCode: d.ifscCode,
      accountHolderName: d.accountHolderName,
      nomineeName: d.nomineeName,
      nomineeRelation: d.nomineeRelation,
      nomineeAadhaar: encryptPII(d.nomineeAadhaar),
      nomineePhone: d.nomineePhone,
      ...(aadhaarFrontUrl && { aadhaarFrontUrl }),
      ...(aadhaarBackUrl && { aadhaarBackUrl }),
      ...(panCardUrl && { panCardUrl }),
      ...(profilePhotoUrl && { profilePhotoUrl }),
      status: "PENDING",
      rejectionReason: null,
    },
  });
  await prisma.member.update({ where: { id }, data: { kycStatus: "PENDING" } });
  revalidatePath("/member/kyc");
  return { error: undefined };
}

// Member pays an EMI (or booking) online. KYC is not required for member-to-admin
// payments; it is only required before commission payouts are released.
export async function payOnlineAction(formData: FormData) {
  const id = memberId();
  const emiScheduleId = (formData.get("emiScheduleId") as string) || null;
  const member = await prisma.member.findUniqueOrThrow({ where: { id }, include: { plot: true } });
  if (!member.isActive) throw new Error("Account must be approved by admin before payment");

  let amount: Prisma.Decimal;
  let paymentType: "BOOKING" | "EMI" | "CASHBACK_FULL";
  if (emiScheduleId) {
    const emi = await prisma.emiSchedule.findUniqueOrThrow({ where: { id: emiScheduleId } });
    if (emi.status === "PAID") throw new Error("This installment is already paid");
    amount = emi.amountDue;
    paymentType = "EMI";
  } else if (member.paymentPlan === "CASHBACK") {
    const alreadyPaid = await prisma.payment.findFirst({
      where: { memberId: id, paymentType: "CASHBACK_FULL", status: "VERIFIED" },
    });
    if (alreadyPaid) throw new Error("Cashback plan full payment is already paid");
    const verified = await prisma.payment.aggregate({
      where: { memberId: id, status: "VERIFIED" },
      _sum: { amount: true },
    });
    amount = member.plot!.plotPrice.minus(verified._sum.amount ?? 0);
    paymentType = "CASHBACK_FULL";
  } else {
    // booking payment
    const alreadyBooked = await prisma.payment.findFirst({
      where: { memberId: id, paymentType: "BOOKING", status: "VERIFIED" },
    });
    if (alreadyBooked) throw new Error("Booking already paid");
    const bookingSetting = await prisma.systemSetting.findUnique({ where: { key: "booking_amount" } });
    amount = new Prisma.Decimal(bookingSetting?.value ?? "10000");
    paymentType = "BOOKING";
  }

  const order = await paymentGateway.createOrder({ amount: amount.toNumber(), memberId: id, emiScheduleId: emiScheduleId ?? undefined });
  const payment = await prisma.payment.create({
    data: {
      memberId: id,
      emiScheduleId,
      paymentType,
      amount,
      paymentMode: "ONLINE",
      gatewayTxnId: order.gatewayTxnId,
      status: "PENDING",
    },
  });
  // Stub gateway confirms immediately.
  await confirmPayment(payment.id);
  revalidatePath("/member/payments");
  revalidatePath("/member");
}

const insuranceSchema = z.object({
  deathDate: z.string().min(1),
  deathType: z.string().min(1),
});

export async function submitInsuranceClaimAction(_prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const id = memberId();
  const parsed = insuranceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const member = await prisma.member.findUniqueOrThrow({ where: { id }, include: { kyc: true } });
  if (!member.kyc?.nomineeName || !member.kyc.nomineeRelation || !member.kyc.nomineePhone) {
    return { error: "Complete nominee KYC details before submitting an insurance claim" };
  }
  const monthsPaid = await prisma.emiSchedule.count({ where: { memberId: id, status: "PAID" } });
  const deathCertificateUrl = await saveFile(formData.get("deathCertificate"), "insurance");
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
