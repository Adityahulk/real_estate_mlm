-- The preceding v5 migration already adds the new payout columns and indexes.
-- The original payout rows cannot satisfy the required payment-trigger relation,
-- so clear them before tightening triggeredById to match the Prisma schema.
UPDATE "CommissionLedger" SET "payoutId" = NULL;
DELETE FROM "Payout";

ALTER TABLE "Payout"
ALTER COLUMN "triggeredById" SET NOT NULL;

ALTER TABLE "Payout"
DROP CONSTRAINT "Payout_triggeredById_fkey";

ALTER TABLE "Payout" ADD CONSTRAINT "Payout_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
