import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAdminSession, getMemberSession } from "@/lib/auth";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const [admin, member] = await Promise.all([getAdminSession(), getMemberSession()]);
  if (!admin && !member) return new NextResponse("Unauthorized", { status: 401 });

  const { path: pathParts } = await params;
  const [folder, ownerId] = pathParts;
  if (member && !admin && ["kyc", "insurance", "receipts"].includes(folder) && ownerId !== member.sub) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rel = pathParts.join("/");
  const full = path.resolve(STORAGE_DIR, rel);
  const root = path.resolve(STORAGE_DIR);
  if ((full !== root && !full.startsWith(`${root}${path.sep}`)) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const data = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "text/plain";
  return new NextResponse(data, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
