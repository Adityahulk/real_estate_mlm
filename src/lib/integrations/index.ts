import crypto from "crypto";
import fs from "fs";
import path from "path";

// ============================================================================
// Integration adapters. Each is an interface with a stub implementation chosen
// by INTEGRATIONS_MODE. Real providers (Razorpay, Cashfree, Interakt, Surepass,
// S3, Random.org) slot in behind the same interfaces without touching callers.
// ============================================================================

const MODE = process.env.INTEGRATIONS_MODE || "stub";
const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

// ---------------------------- Payment Gateway ----------------------------
export interface PaymentGateway {
  createOrder(input: { amount: number; memberId: string; emiScheduleId?: string }): Promise<{
    orderId: string;
    gatewayTxnId: string;
  }>;
}

class StubPaymentGateway implements PaymentGateway {
  async createOrder() {
    const id = "stub_" + crypto.randomBytes(8).toString("hex");
    return { orderId: id, gatewayTxnId: "txn_" + id };
  }
}

// ---------------------------- Payout Provider ----------------------------
export interface PayoutProvider {
  bulkTransfer(
    transfers: { memberId: string; amount: number; mode: string }[]
  ): Promise<{ memberId: string; utr: string; success: boolean }[]>;
}

class StubPayoutProvider implements PayoutProvider {
  async bulkTransfer(transfers: { memberId: string; amount: number }[]) {
    return transfers.map((t) => ({
      memberId: t.memberId,
      utr: "UTR" + crypto.randomBytes(6).toString("hex").toUpperCase(),
      success: true,
    }));
  }
}

// ---------------------------- Notifier ----------------------------
export type NotifyChannel = "SMS" | "WHATSAPP" | "EMAIL" | "PUSH" | "IN_APP";
export interface Notifier {
  send(input: { channel: NotifyChannel; to: string; title: string; message: string }): Promise<boolean>;
}

class StubNotifier implements Notifier {
  async send(input: { channel: NotifyChannel; to: string; title: string; message: string }) {
    console.log(`[notify:${input.channel}] -> ${input.to} :: ${input.title} — ${input.message}`);
    return true;
  }
}

// ---------------------------- Storage ----------------------------
export interface Storage {
  save(input: { folder: string; filename: string; data: Buffer }): Promise<string>;
}

class LocalStorage implements Storage {
  async save(input: { folder: string; filename: string; data: Buffer }): Promise<string> {
    const dir = path.join(STORAGE_DIR, input.folder);
    fs.mkdirSync(dir, { recursive: true });
    const safe = `${Date.now()}_${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    fs.writeFileSync(path.join(dir, safe), input.data);
    return `/api/files/${input.folder}/${safe}`;
  }
}

// ---------------------------- KYC Verify ----------------------------
export interface KycVerify {
  verifyPan(pan: string): Promise<{ valid: boolean }>;
  verifyBank(account: string, ifsc: string): Promise<{ valid: boolean }>;
}

class StubKycVerify implements KycVerify {
  async verifyPan() {
    return { valid: true };
  }
  async verifyBank() {
    return { valid: true };
  }
}

// ---------------------------- Random Source ----------------------------
export interface RandomSource {
  pick(count: number, poolSize: number): Promise<{ indices: number[]; seed: string }>;
}

class StubRandomSource implements RandomSource {
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
export const paymentGateway: PaymentGateway = new StubPaymentGateway();
export const payoutProvider: PayoutProvider = new StubPayoutProvider();
export const notifier: Notifier = new StubNotifier();
export const storage: Storage = new LocalStorage();
export const kycVerify: KycVerify = new StubKycVerify();
export const randomSource: RandomSource = new StubRandomSource();

export const integrationsMode = MODE;
