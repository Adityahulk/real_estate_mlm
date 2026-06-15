ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_REQUEST_UPDATE';

CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportRequestCategory" AS ENUM ('PAYMENT', 'LOGIN', 'KYC', 'PLOT', 'INCOME', 'TREE', 'OTHER');

CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "category" "SupportRequestCategory" NOT NULL DEFAULT 'OTHER',
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
  "adminReply" TEXT,
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_memberId_createdAt_idx" ON "SupportRequest"("memberId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
