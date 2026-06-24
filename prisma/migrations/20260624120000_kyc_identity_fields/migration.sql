-- Store KYC identity details as fields instead of requiring document uploads.
ALTER TABLE "MemberKyc" ADD COLUMN "aadhaarCardNumber" TEXT;
ALTER TABLE "MemberKyc" ADD COLUMN "aadhaarCardLast4" TEXT;
ALTER TABLE "MemberKyc" ADD COLUMN "aadhaarCardAddress" TEXT;
ALTER TABLE "MemberKyc" ADD COLUMN "panCardNumber" TEXT;
ALTER TABLE "MemberKyc" ADD COLUMN "panCardLast4" TEXT;
