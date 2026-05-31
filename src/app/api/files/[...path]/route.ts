import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

// Serves locally-stored stub uploads (KYC docs, receipts). In production these
// would live in S3 and this route would not exist.
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const rel = params.path.join("/");
  const full = path.resolve(STORAGE_DIR, rel);
  const root = path.resolve(STORAGE_DIR);
  if (!full.startsWith(root) || !fs.existsSync(full)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const data = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "text/plain";
  return new NextResponse(data, { headers: { "Content-Type": type } });
}
