"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword, signMember, setMemberCookie, signAdmin, setAdminCookie, clearMemberCookie, clearAdminCookie } from "@/lib/auth";
import { createMemberApplication } from "@/lib/services/members";
import { notifier } from "@/lib/integrations";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import crypto from "crypto";

export type ActionState = { error?: string; success?: string } | undefined;

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter full name"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  sponsorMemberId: z.string().optional(),
  nomineeName: z.string().min(2, "Enter nominee name"),
  nomineeRelation: z.string().min(2, "Enter nominee relation"),
  nomineePhone: z.string().regex(/^\d{10}$/, "Nominee mobile must be 10 digits"),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    const application = await createMemberApplication({
      ...parsed.data,
      sponsorMemberId: parsed.data.sponsorMemberId?.trim() || undefined,
    });
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const base = (host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_BASE_URL || "https://shreeshyam.group").replace(/\/$/, "");
    const referralLink = `${base}/register?ref=${application.applicationCode}`;
    return {
      success: `Your application is submitted with Free ID: ${application.applicationCode}. Referral link: ${referralLink}. Contact the admin for approval.`,
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
      await setAdminCookie(signAdmin({ sub: admin.id, role: admin.role }));
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
  await setMemberCookie(signMember({ sub: member.id, memberId: member.memberId }));
  redirect("/member");
}

export async function logoutMemberAction() {
  await clearMemberCookie();
  redirect("/login");
}

export async function logoutAdminAction() {
  await clearAdminCookie();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address" };
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) return { success: "If this email belongs to a member, a reset OTP has been sent." };
  const recent = await prisma.otpCode.findFirst({
    where: { target: email, purpose: "RESET", createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent) return { error: "Please wait one minute before requesting another OTP" };
  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.otpCode.create({
    data: {
      target: email,
      codeHash: sha256(code),
      purpose: "RESET",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  const hasEmailProvider = !!(process.env.RESEND_API_KEY || process.env.SMTP_USER);
  if (!hasEmailProvider) {
    return { success: `[DEV] Reset OTP: ${code}` };
  }
  try {
    await notifier.send({ channel: "EMAIL", to: email, title: "Password reset code", message: `Your reset code is ${code}. It expires in 15 minutes.` });
  } catch (e) {
    console.error("Email send failed:", e);
    return { error: `Failed to send OTP: ${e instanceof Error ? e.message : "Unknown error"}` };
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
