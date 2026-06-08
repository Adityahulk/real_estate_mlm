ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- The original payout model was never used by the current payment-triggered
-- payout engine. Clear legacy rows before enforcing the final schema.
UPDATE "CommissionLedger" SET "payoutId" = NULL;
DELETE FROM "Payout";

DROP INDEX IF EXISTS "Payout_memberId_payoutMonth_key";

ALTER TABLE "Payout" DROP COLUMN IF EXISTS "payoutMonth";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "tdsAmount";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "totalPoints";
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "adminCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "grossAmount" DECIMAL(12,2);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "onHoldReason" TEXT;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "payoutDate" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "triggeredById" TEXT;

ALTER TABLE "Payout" ALTER COLUMN "grossAmount" SET NOT NULL;
ALTER TABLE "Payout" ALTER COLUMN "payoutDate" SET NOT NULL;
ALTER TABLE "Payout" ALTER COLUMN "triggeredById" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Payout_memberId_status_idx" ON "Payout"("memberId", "status");
CREATE INDEX IF NOT EXISTS "Payout_status_payoutDate_idx" ON "Payout"("status", "payoutDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_triggeredById_memberId_key" ON "Payout"("triggeredById", "memberId");

ALTER TABLE "Payout" DROP CONSTRAINT IF EXISTS "Payout_triggeredById_fkey";
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_triggeredById_fkey"
  FOREIGN KEY ("triggeredById") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
