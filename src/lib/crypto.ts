import crypto from "crypto";

// AES-256-GCM encryption for PII at rest (Aadhaar, bank account, nominee Aadhaar).
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptPII(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptPII(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) return null;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export function last4(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\s/g, "");
  return digits.slice(-4);
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
