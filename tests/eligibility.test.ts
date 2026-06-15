import { describe, expect, it } from "vitest";
import { achievedRanks, unlockedPairRewards, visibleRank } from "@/lib/engines/eligibility";

describe("rank achievements", () => {
  it("sets bronze from 11 direct sponsors", () => {
    expect(visibleRank({ directReferralCount: 11, bronzeMinReferrals: 11, leftCount: 0, rightCount: 0 })).toBe("BRONZE");
  });

  it("sets silver from 25 left and 25 right", () => {
    expect(visibleRank({ directReferralCount: 0, bronzeMinReferrals: 11, leftCount: 25, rightCount: 25 })).toBe("SILVER");
    expect(unlockedPairRewards(25, 25)).toEqual(["ACTIVA"]);
  });

  it("sets gold from 150 left and 150 right", () => {
    expect(visibleRank({ directReferralCount: 0, bronzeMinReferrals: 11, leftCount: 150, rightCount: 150 })).toBe("GOLD");
    expect(unlockedPairRewards(150, 150)).toEqual(["ACTIVA", "CAR"]);
  });

  it("keeps every achieved rank after progressing", () => {
    expect(achievedRanks({ directReferralCount: 11, bronzeMinReferrals: 11, leftCount: 25, rightCount: 25 })).toEqual(["BRONZE", "SILVER"]);
    expect(achievedRanks({ directReferralCount: 11, bronzeMinReferrals: 11, leftCount: 150, rightCount: 150 })).toEqual(["BRONZE", "SILVER", "GOLD"]);
  });
});
