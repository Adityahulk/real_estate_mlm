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

// Sponsor-program income follows the referral chain. Level income follows the
// physical binary-tree parent chain. They must never share the same chain.
export function computeProgramCommissionLines(args: {
  amountPaid: Decimal.Value;
  plotPrice: Decimal.Value;
  sponsorChain: string[];
  treeAncestorChain: string[];
  rules: CommissionRule[];
}): CommissionLine[] {
  const sponsorRules = args.rules.filter((rule) => !rule.incomeType.startsWith("LEVEL_"));
  const levelRules = args.rules.filter((rule) => rule.incomeType.startsWith("LEVEL_"));
  return [
    ...computeCommissionLines({
      amountPaid: args.amountPaid,
      plotPrice: args.plotPrice,
      uplineChain: args.sponsorChain,
      rules: sponsorRules,
    }),
    ...computeCommissionLines({
      amountPaid: args.amountPaid,
      plotPrice: args.plotPrice,
      uplineChain: args.treeAncestorChain,
      rules: levelRules,
    }),
  ];
}
