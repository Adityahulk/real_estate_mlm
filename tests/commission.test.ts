import { describe, it, expect } from "vitest";
import { computeCommissionLines, type CommissionRule } from "@/lib/engines/commission";
import { DEFAULT_COMMISSION_RULES } from "@/lib/engines/commissionRules";

const rules: CommissionRule[] = DEFAULT_COMMISSION_RULES;

// Full 7-deep sponsor chain so every rule fires.
const chain = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];

describe("commission engine — spec worked example (₹10,000 on ₹3,00,000)", () => {
  const lines = computeCommissionLines({
    amountPaid: 10000,
    plotPrice: 300000,
    uplineChain: chain,
    rules,
  });
  const byType = Object.fromEntries(lines.map((l) => [l.incomeType, l.points.toNumber()]));

  it("direct sponsor = ₹1,000", () => expect(byType.DIRECT_SPONSOR).toBe(1000));
  it("co-sponsor = ₹200", () => expect(byType.CO_SPONSOR).toBe(200));
  it("super sponsor = ₹100", () => expect(byType.SUPER_SPONSOR).toBe(100));
  it("level 1 = ₹100", () => expect(byType.LEVEL_1).toBe(100));
  it("level 2 = ₹100", () => expect(byType.LEVEL_2).toBe(100));
  it("level 6 = ₹200", () => expect(byType.LEVEL_6).toBe(200));
  it("level 7 = ₹200", () => expect(byType.LEVEL_7).toBe(200));

  it("total commission per ₹10,000 payment = ₹2,200", () => {
    const total = lines.reduce((a, l) => a + l.points.toNumber(), 0);
    expect(total).toBe(2200);
  });

  it("attributes each line to the correct upline depth", () => {
    const direct = lines.find((l) => l.incomeType === "DIRECT_SPONSOR")!;
    expect(direct.beneficiaryId).toBe("s1");
    const l3 = lines.find((l) => l.incomeType === "LEVEL_3")!;
    expect(l3.beneficiaryId).toBe("s3");
  });
});

describe("commission engine — chain shorter than 7 stops cleanly", () => {
  it("only emits lines for existing uplines", () => {
    const lines = computeCommissionLines({
      amountPaid: 10000,
      plotPrice: 300000,
      uplineChain: ["s1"], // only a direct sponsor exists
      rules,
    });
    const depths = Array.from(new Set(lines.map((l) => l.uplineDepth)));
    expect(depths).toEqual([1]);
    // depth 1 has both DIRECT_SPONSOR and LEVEL_1
    expect(lines.map((l) => l.incomeType).sort()).toEqual(["DIRECT_SPONSOR", "LEVEL_1"]);
  });
});

describe("commission engine — lifetime totals", () => {
  it("direct sponsor income sums to exactly ₹30,000 over the full plot price", () => {
    // booking 10k + 29 EMIs of 10k = 300000 total
    const payments = [10000, ...Array(29).fill(10000)];
    let total = 0;
    for (const amt of payments) {
      const lines = computeCommissionLines({
        amountPaid: amt,
        plotPrice: 300000,
        uplineChain: chain,
        rules,
      });
      total += lines.find((l) => l.incomeType === "DIRECT_SPONSOR")!.points.toNumber();
    }
    expect(total).toBe(30000);
  });
});
