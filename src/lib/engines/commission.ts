import Decimal from "decimal.js";
import { round2, money } from "../money";

export type IncomeTypeName =
  | "DIRECT_SPONSOR"
  | "CO_SPONSOR"
  | "SUPER_SPONSOR"
  | "LEVEL_1"
  | "LEVEL_2"
  | "LEVEL_3"
  | "LEVEL_4"
  | "LEVEL_5"
  | "LEVEL_6"
  | "LEVEL_7";

export interface CommissionRule {
  incomeType: IncomeTypeName;
  uplineDepth: number; // 1 = direct sponsor, 2 = sponsor's sponsor, ...
  fullAmount: Decimal.Value; // full commission earned over the whole plot price
}

export interface CommissionLine {
  beneficiaryId: string;
  incomeType: IncomeTypeName;
  uplineDepth: number;
  points: Decimal;
}

// The caller supplies the confirmed flat operational payment unit and plan
// value. Customer-facing square-foot adjusted plot values must never be passed
// into this engine.
//
// The engine walks the SPONSOR chain (not the tree). uplineChain[0] is the
// paying member's direct sponsor (depth 1), [1] is depth 2, etc. For each rule
// at a given depth, if an upline exists there, a commission line is produced.
export function computeCommissionLines(args: {
  amountPaid: Decimal.Value;
  plotPrice: Decimal.Value;
  uplineChain: string[]; // sponsor chain, depth 1 first
  rules: CommissionRule[];
}): CommissionLine[] {
  const { uplineChain, rules } = args;
  const plotPrice = money(args.plotPrice);
  const amountPaid = money(args.amountPaid);
  if (plotPrice.lte(0)) return [];
  const ratio = amountPaid.div(plotPrice);

  const lines: CommissionLine[] = [];
  for (const rule of rules) {
    const beneficiaryId = uplineChain[rule.uplineDepth - 1];
    if (!beneficiaryId) continue; // no upline at this depth (chain hit root)
    const points = round2(money(rule.fullAmount).mul(ratio));
    if (points.lte(0)) continue;
    lines.push({
      beneficiaryId,
      incomeType: rule.incomeType,
      uplineDepth: rule.uplineDepth,
      points,
    });
  }
  return lines;
}
