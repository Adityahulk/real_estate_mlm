"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, signMember, setMemberCookie, signAdmin, setAdminCookie, clearMemberCookie, clearAdminCookie } from "@/lib/auth";
import { registerMember } from "@/lib/services/members";

export type ActionState = { error?: string; success?: string } | undefined;

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter full name"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  sponsorMemberId: z.string().optional(),
  paymentPlan: z.enum(["INSTALLMENT", "CASHBACK"]).default("INSTALLMENT"),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    await registerMember({
      ...parsed.data,
      sponsorMemberId: parsed.data.sponsorMemberId || undefined,
    });
    return {
      success:
        "Account request created. Admin approval is required after your booking amount is verified.",
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
