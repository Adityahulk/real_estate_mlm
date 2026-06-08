ALTER TABLE "MemberApplication" ALTER COLUMN "sponsorId" DROP NOT NULL;

ALTER TABLE "MemberApplication" DROP CONSTRAINT IF EXISTS "MemberApplication_sponsorId_fkey";
ALTER TABLE "MemberApplication"
ADD CONSTRAINT "MemberApplication_sponsorId_fkey"
FOREIGN KEY ("sponsorId") REFERENCES "Member"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
