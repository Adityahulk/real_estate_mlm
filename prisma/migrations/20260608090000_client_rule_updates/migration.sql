ALTER TYPE "MemberRank" ADD VALUE IF NOT EXISTS 'SILVER';
ALTER TYPE "MemberRank" ADD VALUE IF NOT EXISTS 'GOLD';

UPDATE "SystemSetting" SET "value" = '300240' WHERE "key" = 'plot_price';
UPDATE "SystemSetting" SET "value" = '500' WHERE "key" = 'min_payout_threshold';
UPDATE "SystemSetting" SET "value" = '1' WHERE "key" = 'payment_window_start_day';
UPDATE "SystemSetting" SET "value" = '25' WHERE "key" = 'payment_window_end_day';
