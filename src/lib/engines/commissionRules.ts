import type { CommissionRule } from "./commission";

// Default commission rule table (spec v5.0 Part 1.5 — CONFIRMED).
// Total = ₹66,000 across 30 fixed ₹10,000 operational payment units. Reference
// plot values based on square feet are intentionally excluded.
//
// Sponsor income follows the referral chain. Level income follows actual binary
// placement, so an active member earns level income from paid IDs physically
// below them even when they personally sponsored nobody.
//
// Per ₹10,000 payment (ratio 1/30): Direct 1000, Co 200, Super 100,
// L1–L5 100 each, L6 200, L7 200 → ₹2,200/payment, ₹66,000 lifetime.
export const DEFAULT_COMMISSION_RULES: CommissionRule[] = [
  // Sponsor program
  { incomeType: "DIRECT_SPONSOR", uplineDepth: 1, fullAmount: 30000 }, // 10%
  { incomeType: "CO_SPONSOR", uplineDepth: 2, fullAmount: 6000 }, //      2%
  { incomeType: "SUPER_SPONSOR", uplineDepth: 3, fullAmount: 3000 }, //   1%
  // Level program
  { incomeType: "LEVEL_1", uplineDepth: 1, fullAmount: 3000 }, // 1%
  { incomeType: "LEVEL_2", uplineDepth: 2, fullAmount: 3000 }, // 1%
  { incomeType: "LEVEL_3", uplineDepth: 3, fullAmount: 3000 }, // 1%
  { incomeType: "LEVEL_4", uplineDepth: 4, fullAmount: 3000 }, // 1%
  { incomeType: "LEVEL_5", uplineDepth: 5, fullAmount: 3000 }, // 1%
  { incomeType: "LEVEL_6", uplineDepth: 6, fullAmount: 6000 }, // 2%
  { incomeType: "LEVEL_7", uplineDepth: 7, fullAmount: 6000 }, // 2%
];

export const MAX_SPONSOR_DEPTH = 7;
