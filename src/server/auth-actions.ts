"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, signMember, setMemberCookie, signAdmin, setAdminCookie, clearMemberCookie, clearAdminCookie } from "@/lib/auth";
import { createMemberApplication } from "@/lib/services/members";
import { notifier } from "@/lib/integrations";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";

export type ActionState = { error?: string; success?: string } | undefined;

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter full name"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  sponsorMemberId: z.string().min(1, "Referred By Plot Number is required"),
  paymentPlan: z.enum(["INSTALLMENT", "CASHBACK"]).default("INSTALLMENT"),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    await createMemberApplication(parsed.data);
    return {
      success: "Application submitted. Admin will collect the token amount, approve it, and assign your plot number.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Registration failed" };
  }
}

const loginSchema = z.object({
  mobile: z.string().min(1, "Enter mobile"),
  password: z.string().min(1, "Enter password"),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const member = await prisma.member.findUnique({ where: { mobile: parsed.data.mobile } });
  if (!member || !(await verifyPassword(parsed.data.password, member.passwordHash))) {
    return { error: "Invalid mobile or password" };
  }
  if (!member.isActive) {
    return { error: "Your account is pending admin approval after booking payment verification." };
  }
  setMemberCookie(signMember({ sub: member.id, memberId: member.memberId }));
  redirect("/member");
}

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = adminLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter email and password" };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid credentials" };
  }
  setAdminCookie(signAdmin({ sub: user.id, role: user.role }));
  redirect("/admin");
}

export async function logoutMemberAction() {
  clearMemberCookie();
  redirect("/login");
}

export async function logoutAdminAction() {
  clearAdminCookie();
  redirect("/admin/login");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
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
  return { success: "Reset code sent to your email" };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
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
