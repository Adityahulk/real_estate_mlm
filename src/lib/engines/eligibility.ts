// Pure rule helpers for ranks, draw eligibility, and pair rewards.

// v5.0: Bronze at EXACTLY 11 or more direct referrals (>=).
export function isBronze(directReferralCount: number, minReferrals: number): boolean {
  return directReferralCount >= minReferrals;
}

export function isDrawEligible(args: {
  kycApproved: boolean;
  isActive: boolean;
  hasOverdueEmi: boolean;
}): boolean {
  return args.kycApproved && args.isActive && !args.hasOverdueEmi;
}

export type PairReward = "ACTIVA" | "CAR";

export function unlockedPairRewards(leftCount: number, rightCount: number): PairReward[] {
  const out: PairReward[] = [];
  if (leftCount >= 25 && rightCount >= 25) out.push("ACTIVA");
  if (leftCount >= 150 && rightCount >= 150) out.push("CAR");
  return out;
}

export function insuranceEligible(monthsPaid: number, minMonths: number): boolean {
  return monthsPaid >= minMonths;
}
