CREATE TYPE "CashbackStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TYPE "PairRewardType" AS ENUM ('ACTIVA', 'CAR');
CREATE TYPE "RewardStatus" AS ENUM ('UNLOCKED', 'CLAIMED');

ALTER TABLE "DrawEvent" ADD COLUMN "mediaUrl" TEXT;

CREATE TABLE "CashbackCredit" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "monthNo" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "creditDate" TIMESTAMP(3) NOT NULL,
    "status" "CashbackStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashbackCredit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PairRewardRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "PairRewardType" NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'UNLOCKED',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairRewardRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlotTransfer" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "previousFullName" TEXT NOT NULL,
    "previousMobile" TEXT NOT NULL,
    "previousEmail" TEXT NOT NULL,
    "newFullName" TEXT NOT NULL,
    "newMobile" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlotTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashbackCredit_status_creditDate_idx" ON "CashbackCredit"("status", "creditDate");
CREATE UNIQUE INDEX "CashbackCredit_memberId_monthNo_key" ON "CashbackCredit"("memberId", "monthNo");
CREATE UNIQUE INDEX "PairRewardRecord_memberId_type_key" ON "PairRewardRecord"("memberId", "type");
CREATE INDEX "PlotTransfer_memberId_createdAt_idx" ON "PlotTransfer"("memberId", "createdAt");

ALTER TABLE "CashbackCredit" ADD CONSTRAINT "CashbackCredit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PairRewardRecord" ADD CONSTRAINT "PairRewardRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlotTransfer" ADD CONSTRAINT "PlotTransfer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlotTransfer" ADD CONSTRAINT "PlotTransfer_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
