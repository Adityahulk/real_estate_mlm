ALTER TYPE "PayoutStatus" ADD VALUE 'ON_HOLD';

-- The original payout model was never used by the current payment-triggered
-- payout engine. Clear legacy rows before replacing its incompatible columns.
UPDATE "CommissionLedger" SET "payoutId" = NULL;
DELETE FROM "Payout";

DROP INDEX "Payout_memberId_payoutMonth_key";

ALTER TABLE "Payout" DROP COLUMN "payoutMonth",
DROP COLUMN "tdsAmount",
DROP COLUMN "totalAmount",
DROP COLUMN "totalPoints",
ADD COLUMN "adminCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "grossAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN "onHoldReason" TEXT,
ADD COLUMN "payoutDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN "triggeredById" TEXT NOT NULL;

CREATE INDEX "Payout_memberId_status_idx" ON "Payout"("memberId", "status");
CREATE INDEX "Payout_status_payoutDate_idx" ON "Payout"("status", "payoutDate");
CREATE UNIQUE INDEX "Payout_triggeredById_memberId_key" ON "Payout"("triggeredById", "memberId");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
