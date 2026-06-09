import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export { hashPassword, verifyPassword } from "./password";

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev_secret");
if (!SECRET) throw new Error("JWT_SECRET is required in production");
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

export const MEMBER_COOKIE = "ssv_member";
export const ADMIN_COOKIE = "ssv_admin";

export type MemberSession = { sub: string; memberId: string; kind: "member" };
export type AdminSession = { sub: string; role: string; kind: "admin" };

const signOpts = { expiresIn: EXPIRES } as jwt.SignOptions;

export function signMember(payload: Omit<MemberSession, "kind">): string {
  return jwt.sign({ ...payload, kind: "member" }, SECRET, signOpts);
}

export function signAdmin(payload: Omit<AdminSession, "kind">): string {
  return jwt.sign({ ...payload, kind: "admin" }, SECRET, signOpts);
}

function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}

export async function setMemberCookie(token: string) {
  (await cookies()).set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function setAdminCookie(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearMemberCookie() {
  (await cookies()).delete(MEMBER_COOKIE);
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getMemberSession(): Promise<MemberSession | null> {
  return verify<MemberSession>((await cookies()).get(MEMBER_COOKIE)?.value);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return verify<AdminSession>((await cookies()).get(ADMIN_COOKIE)?.value);
}
