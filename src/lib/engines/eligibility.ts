// Pure rule helpers for ranks, draw eligibility, and pair rewards.

// v5.0: Bronze at EXACTLY 11 or more direct referrals (>=).
export function isBronze(directReferralCount: number, minReferrals: number): boolean {
  return directReferralCount >= minReferrals;
}

export type VisibleRank = "NONE" | "BRONZE" | "SILVER" | "GOLD";

export function visibleRank(args: {
  directReferralCount: number;
  bronzeMinReferrals: number;
  leftCount: number;
  rightCount: number;
}): VisibleRank {
  if (args.leftCount >= 150 && args.rightCount >= 150) return "GOLD";
  if (args.leftCount >= 25 && args.rightCount >= 25) return "SILVER";
  if (isBronze(args.directReferralCount, args.bronzeMinReferrals)) return "BRONZE";
  return "NONE";
}

export function isDrawEligible(args: {
  kycApproved: boolean;
  isActive: boolean;
  hasOverdueEmi: boolean;
}): boolean {
  return args.kycApproved && args.isActive && !args.hasOverdueEmi;
}

export type PairReward = "ACTIVA" | "CAR";

export const PAIR_REWARD_LABELS: Record<PairReward, { rank: "SILVER" | "GOLD"; gift: string; target: string }> = {
  ACTIVA: { rank: "SILVER", gift: "Honda Activa", target: "25 Left + 25 Right" },
  CAR: { rank: "GOLD", gift: "Four Wheeler", target: "150 Left + 150 Right" },
};

export function unlockedPairRewards(leftCount: number, rightCount: number): PairReward[] {
  const out: PairReward[] = [];
  if (leftCount >= 25 && rightCount >= 25) out.push("ACTIVA");
  if (leftCount >= 150 && rightCount >= 150) out.push("CAR");
  return out;
}

export function insuranceEligible(monthsPaid: number, minMonths: number): boolean {
  return monthsPaid >= minMonths;
}
