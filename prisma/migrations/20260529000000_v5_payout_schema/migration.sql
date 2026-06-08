-- v5.0: Extend enums
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "MemberRank" ADD VALUE IF NOT EXISTS 'SILVER';
ALTER TYPE "MemberRank" ADD VALUE IF NOT EXISTS 'GOLD';
ALTER TYPE "PayoutMode" ADD VALUE IF NOT EXISTS 'CASH';
ALTER TYPE "PayoutMode" ADD VALUE IF NOT EXISTS 'ONLINE';

-- v5.0: Restructure Payout table
-- Add new columns
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "triggeredById" TEXT;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "grossAmount" DECIMAL(12,2);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "adminCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "payoutDate" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "onHoldReason" TEXT;

-- Backfill grossAmount and payoutDate from existing rows so NOT NULL is safe
UPDATE "Payout" SET "grossAmount" = "netAmount" WHERE "grossAmount" IS NULL;
UPDATE "Payout" SET "payoutDate" = "createdAt" WHERE "payoutDate" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "Payout" ALTER COLUMN "grossAmount" SET NOT NULL;
ALTER TABLE "Payout" ALTER COLUMN "payoutDate" SET NOT NULL;

-- Drop old columns
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "payoutMonth";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "totalPoints";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "tdsAmount";

-- Add FK to Payment (only if triggeredById has been populated)
-- First add the constraint conditionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Payout_triggeredById_fkey'
  ) THEN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_triggeredById_fkey"
      FOREIGN KEY ("triggeredById") REFERENCES "Payment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add unique constraint
DO $$
BEGIN
  IF to_regclass('"Payout_triggeredById_memberId_key"') IS NULL THEN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_triggeredById_memberId_key"
      UNIQUE ("triggeredById", "memberId");
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "Payout_memberId_status_idx" ON "Payout"("memberId", "status");
CREATE INDEX IF NOT EXISTS "Payout_status_payoutDate_idx" ON "Payout"("status", "payoutDate");
