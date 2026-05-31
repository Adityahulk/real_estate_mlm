-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "PlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'SOLD', 'DRAW_WON');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TreeSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "MemberRank" AS ENUM ('NONE', 'BRONZE');

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('INSTALLMENT', 'CASHBACK');

-- CreateEnum
CREATE TYPE "EmiStatus" AS ENUM ('UPCOMING', 'DUE', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('BOOKING', 'EMI', 'CASHBACK_FULL', 'DEVELOPMENT', 'DOCUMENTATION', 'DRAW_SETTLEMENT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('ONLINE', 'OFFLINE', 'UPI', 'BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('DIRECT_SPONSOR', 'CO_SPONSOR', 'SUPER_SPONSOR', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'LEVEL_6', 'LEVEL_7');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('POINTS', 'APPROVED', 'PAID', 'HOLD');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DrawWinnerStatus" AS ENUM ('WON', 'CLAIMED', 'PENDING_DOCS');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMI_REMINDER', 'PAYMENT_VERIFIED', 'COMMISSION_EARNED', 'KYC_UPDATE', 'DRAW_RESULT', 'RANK_UPDATE', 'PAYOUT_DONE', 'WELCOME');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('NUMBER', 'STRING', 'BOOLEAN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "plotNumber" TEXT NOT NULL,
    "plotSize" TEXT NOT NULL DEFAULT '12x36',
    "plotPrice" DECIMAL(12,2) NOT NULL,
    "developmentCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "documentationCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "locationBlock" TEXT,
    "rowNumber" TEXT,
    "roadFacing" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "bookingDate" TIMESTAMP(3),
    "satbaraDocUrl" TEXT,
    "mappingDocUrl" TEXT,
    "entryDocUrl" TEXT,
    "legalDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "plotId" TEXT,
    "fullName" TEXT NOT NULL,
    "aadhaarNumber" TEXT,
    "aadhaarLast4" TEXT,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sponsorId" TEXT,
    "treeParentId" TEXT,
    "treeSide" "TreeSide",
    "treeLevel" INTEGER NOT NULL DEFAULT 0,
    "leftTeamCount" INTEGER NOT NULL DEFAULT 0,
    "rightTeamCount" INTEGER NOT NULL DEFAULT 0,
    "directReferralCount" INTEGER NOT NULL DEFAULT 0,
    "rank" "MemberRank" NOT NULL DEFAULT 'NONE',
    "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'INSTALLMENT',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDrawEligible" BOOLEAN NOT NULL DEFAULT false,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberKyc" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "aadhaarFrontUrl" TEXT,
    "aadhaarBackUrl" TEXT,
    "panCardUrl" TEXT,
    "profilePhotoUrl" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountLast4" TEXT,
    "ifscCode" TEXT,
    "accountHolderName" TEXT,
    "nomineeName" TEXT,
    "nomineeRelation" TEXT,
    "nomineeAadhaar" TEXT,
    "nomineePhone" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberKyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmiSchedule" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "payByDate" TIMESTAMP(3) NOT NULL,
    "status" "EmiStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmiSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "emiScheduleId" TEXT,
    "paymentType" "PaymentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNumber" TEXT,
    "receiptUrl" TEXT,
    "gatewayTxnId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "sourceMemberId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "incomeType" "IncomeType" NOT NULL,
    "pointsEarned" DECIMAL(12,2) NOT NULL,
    "cashAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'POINTS',
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "payoutMonth" TEXT NOT NULL,
    "totalPoints" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "tdsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMode" "PayoutMode" NOT NULL DEFAULT 'BANK_TRANSFER',
    "utrNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawEvent" (
    "id" TEXT NOT NULL,
    "drawNumber" INTEGER NOT NULL,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'SCHEDULED',
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "conductedById" TEXT,
    "randomSeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawWinner" (
    "id" TEXT NOT NULL,
    "drawEventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "prizeRank" INTEGER NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeValue" DECIMAL(12,2),
    "plotId" TEXT,
    "sponsorId" TEXT,
    "status" "DrawWinnerStatus" NOT NULL DEFAULT 'WON',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "monthsPaid" INTEGER NOT NULL,
    "deathDate" TIMESTAMP(3) NOT NULL,
    "deathType" TEXT NOT NULL,
    "claimSubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomineeName" TEXT NOT NULL,
    "nomineeRelation" TEXT NOT NULL,
    "nomineePhone" TEXT NOT NULL,
    "deathCertificateUrl" TEXT,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SettingType" NOT NULL DEFAULT 'STRING',
    "label" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "incomeType" "IncomeType" NOT NULL,
    "uplineDepth" INTEGER NOT NULL,
    "fullAmount" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_plotNumber_key" ON "Plot"("plotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_plotId_key" ON "Member"("plotId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_mobile_key" ON "Member"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_sponsorId_idx" ON "Member"("sponsorId");

-- CreateIndex
CREATE INDEX "Member_treeParentId_idx" ON "Member"("treeParentId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberKyc_memberId_key" ON "MemberKyc"("memberId");

-- CreateIndex
CREATE INDEX "EmiSchedule_memberId_status_idx" ON "EmiSchedule"("memberId", "status");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "CommissionLedger_beneficiaryId_status_idx" ON "CommissionLedger"("beneficiaryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_paymentId_beneficiaryId_incomeType_key" ON "CommissionLedger"("paymentId", "beneficiaryId", "incomeType");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_memberId_payoutMonth_key" ON "Payout"("memberId", "payoutMonth");

-- CreateIndex
CREATE UNIQUE INDEX "DrawEvent_drawNumber_key" ON "DrawEvent"("drawNumber");

-- CreateIndex
CREATE INDEX "Notification_memberId_idx" ON "Notification"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRule_incomeType_key" ON "CommissionRule"("incomeType");

-- CreateIndex
CREATE INDEX "OtpCode_target_purpose_idx" ON "OtpCode"("target", "purpose");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_treeParentId_fkey" FOREIGN KEY ("treeParentId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberKyc" ADD CONSTRAINT "MemberKyc_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberKyc" ADD CONSTRAINT "MemberKyc_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmiSchedule" ADD CONSTRAINT "EmiSchedule_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_emiScheduleId_fkey" FOREIGN KEY ("emiScheduleId") REFERENCES "EmiSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawEvent" ADD CONSTRAINT "DrawEvent_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_drawEventId_fkey" FOREIGN KEY ("drawEventId") REFERENCES "DrawEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
