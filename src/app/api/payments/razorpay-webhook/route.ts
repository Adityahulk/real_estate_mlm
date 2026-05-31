import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { confirmPayment } from "@/lib/services/payments";

// Razorpay (or any gateway) calls this on payment success. In stub mode the
// member action confirms inline; this endpoint exists so the real provider can
// drive the exact same confirmation path once live keys are wired.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const paymentId = body?.paymentId || body?.payload?.payment?.entity?.notes?.paymentId;
  if (!paymentId) return fail("Missing paymentId", 400);
  try {
    await confirmPayment(paymentId);
    return ok({ confirmed: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Webhook failed", 500);
  }
}
