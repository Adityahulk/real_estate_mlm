ALTER TABLE "MemberApplication"
ADD COLUMN "applicationCode" TEXT,
ADD COLUMN "referrerApplicationId" TEXT;

UPDATE "MemberApplication"
SET "applicationCode" = 'FREE-' || UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8));

ALTER TABLE "MemberApplication" ALTER COLUMN "applicationCode" SET NOT NULL;

CREATE UNIQUE INDEX "MemberApplication_applicationCode_key" ON "MemberApplication"("applicationCode");
CREATE INDEX "MemberApplication_referrerApplicationId_idx" ON "MemberApplication"("referrerApplicationId");

ALTER TABLE "MemberApplication"
ADD CONSTRAINT "MemberApplication_referrerApplicationId_fkey"
FOREIGN KEY ("referrerApplicationId") REFERENCES "MemberApplication"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
