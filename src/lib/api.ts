import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdminSession, getMemberSession, type AdminSession, type MemberSession } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ ok: false, error: message, extra }, { status });
}

// Wraps a handler with zod/error handling.
export function handler<T>(fn: () => Promise<T>) {
  return (async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ZodError) {
        return fail("Validation failed", 422, e.flatten());
      }
      if (e instanceof ApiError) {
        return fail(e.message, e.status);
      }
      console.error(e);
      return fail("Something went wrong", 500);
    }
  })();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireMember(): Promise<MemberSession> {
  const s = await getMemberSession();
  if (!s) throw new ApiError("Not authenticated", 401);
  return s;
}

export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) throw new ApiError("Admin authentication required", 401);
  return s;
}
