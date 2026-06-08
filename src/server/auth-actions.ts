"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, signMember, setMemberCookie, signAdmin, setAdminCookie, clearMemberCookie, clearAdminCookie } from "@/lib/auth";
import { createMemberApplication } from "@/lib/services/members";
import { notifier } from "@/lib/integrations";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";

export type ActionState = { error?: string; success?: string; data?: Record<string, string> } | undefined;

// ── Email verification (sent before registration) ──────────────────────────
export async function sendEmailVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address" };

  // Check not already registered
  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists. Please login." };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({
    data: {
      target: email,
      codeHash: sha256(code),
      purpose: "REGISTER",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  await notifier.send({ channel: "EMAIL", to: email, title: "Verify Your Email", message: `Your OTP is ${code}. It expires in 15 minutes.` });

  if (!process.env.RESEND_API_KEY) {
    return { success: `OTP (dev mode): ${code}`, data: { email } };
  }
  return { success: `OTP sent to ${email}. Enter it below to continue.`, data: { email } };
}

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter full name"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  email: z.string().email("Invalid email"),
  emailOtp: z.string().length(6, "Enter the 6-digit OTP sent to your email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  sponsorMemberId: z.string().optional(),
  paymentPlan: z.enum(["INSTALLMENT", "CASHBACK"]).default("INSTALLMENT"),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Verify email OTP
  const email = parsed.data.email.trim().toLowerCase();
  const otp = await prisma.otpCode.findFirst({
    where: { target: email, purpose: "REGISTER", consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.codeHash !== sha256(parsed.data.emailOtp)) {
    return { error: "Invalid or expired email OTP. Please request a new one." };
  }

  try {
    const application = await createMemberApplication({
      ...parsed.data,
      email,
      sponsorMemberId: parsed.data.sponsorMemberId?.trim() || undefined,
    });
    // Consume the OTP
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    return {
      success: `Your application is submitted with Application ID: ${application.id.slice(0, 8).toUpperCase()}. Contact admin for approval after booking payment.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Registration failed" };
  }
}

const loginSchema = z.object({
  loginId: z.string().min(1, "Enter mobile number or email"),
  password: z.string().min(1, "Enter password"),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const loginId = parsed.data.loginId.trim().toLowerCase();

  if (loginId.includes("@")) {
    const admin = await prisma.user.findUnique({ where: { email: loginId } });
    if (admin && admin.isActive && await verifyPassword(parsed.data.password, admin.passwordHash)) {
      setAdminCookie(signAdmin({ sub: admin.id, role: admin.role }));
      redirect("/admin");
    }
  }

  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { mobile: loginId },
        { email: loginId },
      ],
    },
  });
  if (!member || !(await verifyPassword(parsed.data.password, member.passwordHash))) {
    return { error: "Invalid mobile/email or password" };
  }
  if (!member.isActive) {
    return { error: "Your account is pending admin approval after booking payment verification." };
  }
  setMemberCookie(signMember({ sub: member.id, memberId: member.memberId }));
  redirect("/member");
}

export async function logoutMemberAction() {
  clearMemberCookie();
  redirect("/login");
}

export async function logoutAdminAction() {
  clearAdminCookie();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address" };
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) return { error: "No member account found for this email" };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({
    data: {
      target: email,
      codeHash: sha256(code),
      purpose: "RESET",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  await notifier.send({ channel: "EMAIL", to: email, title: "Password reset code", message: `Your reset code is ${code}. It expires in 15 minutes.` });
  if ((process.env.INTEGRATIONS_MODE || "stub") === "stub") {
    return { success: `OTP generated for testing: ${code}. Verify it below to reset your password.` };
  }
  return { success: "OTP sent to your registered email. Verify it below to reset your password." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  const otp = await prisma.otpCode.findFirst({
    where: { target: email, purpose: "RESET", consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.codeHash !== sha256(code)) return { error: "Invalid or expired reset code" };
  await prisma.$transaction([
    prisma.member.update({ where: { email }, data: { passwordHash: await hashPassword(password) } }),
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } }),
  ]);
  return { success: "Password updated. You can now log in." };
}
