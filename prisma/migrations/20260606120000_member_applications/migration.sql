-- CreateEnum
CREATE TYPE "MemberApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MemberApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "aadhaarNumber" TEXT,
    "aadhaarLast4" TEXT,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'INSTALLMENT',
    "status" "MemberApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberApplication_mobile_key" ON "MemberApplication"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "MemberApplication_email_key" ON "MemberApplication"("email");

-- CreateIndex
CREATE INDEX "MemberApplication_status_createdAt_idx" ON "MemberApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MemberApplication_sponsorId_idx" ON "MemberApplication"("sponsorId");

-- AddForeignKey
ALTER TABLE "MemberApplication" ADD CONSTRAINT "MemberApplication_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
