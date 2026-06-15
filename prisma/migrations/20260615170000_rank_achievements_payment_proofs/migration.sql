ALTER TABLE "Payment" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofUploadedAt" TIMESTAMP(3);

CREATE TABLE "RankAchievement" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "rank" "MemberRank" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RankAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RankAchievement_memberId_rank_key" ON "RankAchievement"("memberId", "rank");
CREATE INDEX "RankAchievement_rank_createdAt_idx" ON "RankAchievement"("rank", "createdAt");

ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RankAchievement" ("id", "memberId", "rank", "createdAt")
SELECT gen_random_uuid()::text, "id", 'BRONZE'::"MemberRank", "updatedAt"
FROM "Member"
WHERE "rank" IN ('BRONZE', 'SILVER', 'GOLD') AND "memberId" <> 'COMPANY'
ON CONFLICT ("memberId", "rank") DO NOTHING;

INSERT INTO "RankAchievement" ("id", "memberId", "rank", "createdAt")
SELECT gen_random_uuid()::text, "id", 'SILVER'::"MemberRank", "updatedAt"
FROM "Member"
WHERE "rank" IN ('SILVER', 'GOLD') AND "memberId" <> 'COMPANY'
ON CONFLICT ("memberId", "rank") DO NOTHING;

INSERT INTO "RankAchievement" ("id", "memberId", "rank", "createdAt")
SELECT gen_random_uuid()::text, "id", 'GOLD'::"MemberRank", "updatedAt"
FROM "Member"
WHERE "rank" = 'GOLD' AND "memberId" <> 'COMPANY'
ON CONFLICT ("memberId", "rank") DO NOTHING;
