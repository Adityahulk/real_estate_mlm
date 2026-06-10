-- Square-foot adjusted plot values are reference-only. Normalize every unpaid
-- installment to the confirmed flat monthly amount.
UPDATE "EmiSchedule"
SET "amountDue" = 10000.00;

-- Booking and monthly EMI collections are always the confirmed flat amount,
-- including historical rows that previously inherited square-foot rounding.
UPDATE "Payment"
SET "amount" = 10000.00
WHERE "paymentType" IN ('BOOKING', 'EMI');

-- Plot price is also fixed, regardless of the square-foot reference conversion.
UPDATE "Plot"
SET "plotPrice" = 300000.00;

ALTER TABLE "Plot"
ALTER COLUMN "plotPrice" SET DEFAULT 300000.00;

ALTER TABLE "Plot"
ADD CONSTRAINT "Plot_plotPrice_fixed_check" CHECK ("plotPrice" = 300000.00);

-- These values are intentionally no longer editable or used by application
-- logic; the business rules now live in code.
DELETE FROM "SystemSetting"
WHERE "key" IN ('booking_amount', 'plot_price');
