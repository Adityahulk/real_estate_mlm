import bcrypt from "bcryptjs";

// Pure password hashing — no next/headers import, so it is safe to use from
// scripts (seed) and services without dragging in request-scoped modules.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
