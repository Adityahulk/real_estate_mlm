DROP INDEX IF EXISTS "Member_mobile_key";
DROP INDEX IF EXISTS "Member_email_key";
DROP INDEX IF EXISTS "MemberApplication_mobile_key";
DROP INDEX IF EXISTS "MemberApplication_email_key";

CREATE INDEX "Member_mobile_idx" ON "Member"("mobile");
CREATE INDEX "Member_email_idx" ON "Member"("email");
CREATE INDEX "MemberApplication_mobile_idx" ON "MemberApplication"("mobile");
CREATE INDEX "MemberApplication_email_idx" ON "MemberApplication"("email");
