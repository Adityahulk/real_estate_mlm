import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export { hashPassword, verifyPassword } from "./password";

const SECRET = process.env.JWT_SECRET || "dev_secret";
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

export function setMemberCookie(token: string) {
  cookies().set(MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function setAdminCookie(token: string) {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearMemberCookie() {
  cookies().delete(MEMBER_COOKIE);
}

export function clearAdminCookie() {
  cookies().delete(ADMIN_COOKIE);
}

export function getMemberSession(): MemberSession | null {
  return verify<MemberSession>(cookies().get(MEMBER_COOKIE)?.value);
}

export function getAdminSession(): AdminSession | null {
  return verify<AdminSession>(cookies().get(ADMIN_COOKIE)?.value);
}
