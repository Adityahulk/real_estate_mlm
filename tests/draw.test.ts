import { describe, expect, it } from "vitest";
import { parseDrawPrizes } from "@/lib/services/draws";

describe("draw prize parser", () => {
  it("creates one ranked prize input per non-empty line", () => {
    expect(parseDrawPrizes("Bike | 75000\n\nGold Coin | 25000")).toEqual([
      { name: "Bike", value: 75000 },
      { name: "Gold Coin", value: 25000 },
    ]);
  });

  it("allows a prize without a declared value", () => {
    expect(parseDrawPrizes("Gift Hamper")).toEqual([{ name: "Gift Hamper", value: undefined }]);
  });

  it("rejects invalid prize values", () => {
    expect(() => parseDrawPrizes("Bike | abc")).toThrow("Invalid prize value");
  });
});
