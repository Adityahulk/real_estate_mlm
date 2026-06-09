import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sendEmailOtp } from "@/lib/email";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

// ---------------------------- Notifier ----------------------------
export type NotifyChannel = "SMS" | "WHATSAPP" | "EMAIL" | "PUSH" | "IN_APP";
export interface Notifier {
  send(input: { channel: NotifyChannel; to: string; title: string; message: string }): Promise<boolean>;
}

class EmailNotifier implements Notifier {
  async send(input: { channel: NotifyChannel; to: string; title: string; message: string }) {
    if (input.channel === "EMAIL") {
      // Extract OTP from message if present (6-digit number)
      const otpMatch = input.message.match(/\b(\d{6})\b/);
      const otp = otpMatch?.[1];
      const isReset = input.title.toLowerCase().includes("reset");
      if (otp) {
        await sendEmailOtp(input.to, otp, isReset ? "RESET" : "VERIFY");
        return true;
      }
      // Fallback: send as plain email via Resend
      const { Resend } = await import("resend");
      const key = process.env.RESEND_API_KEY;
      if (key) {
        const r = new Resend(key);
        const FROM = process.env.RESEND_FROM_EMAIL || "SSV <noreply@shreeshyamvilla.com>";
        await r.emails.send({ from: FROM, to: input.to, subject: input.title, text: input.message });
      }
      return true;
    }
    throw new Error(`Notification channel ${input.channel} is not configured`);
  }
}

// ---------------------------- Storage ----------------------------
export interface Storage {
  save(input: { folder: string; filename: string; data: Buffer }): Promise<string>;
}

class LocalStorage implements Storage {
  async save(input: { folder: string; filename: string; data: Buffer }): Promise<string> {
    const root = path.resolve(STORAGE_DIR);
    const dir = path.resolve(root, input.folder);
    if (dir !== root && !dir.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage folder");
    fs.mkdirSync(dir, { recursive: true });
    const safe = `${Date.now()}_${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    fs.writeFileSync(path.join(dir, safe), input.data);
    return `/api/files/${input.folder}/${safe}`;
  }
}

// ---------------------------- Random Source ----------------------------
export interface RandomSource {
  pick(count: number, poolSize: number): Promise<{ indices: number[]; seed: string }>;
}

class SecureRandomSource implements RandomSource {
  async pick(count: number, poolSize: number) {
    const seed = crypto.randomBytes(16).toString("hex");
    const indices: number[] = [];
    const used = new Set<number>();
    let i = 0;
    while (indices.length < Math.min(count, poolSize)) {
      const h = crypto.createHash("sha256").update(seed + ":" + i).digest();
      const idx = h.readUInt32BE(0) % poolSize;
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
      i++;
    }
    return { indices, seed };
  }
}

// ---------------------------- Wiring ----------------------------
export const notifier: Notifier = new EmailNotifier();
export const storage: Storage = new LocalStorage();
export const randomSource: RandomSource = new SecureRandomSource();
