import { describe, it, expect } from "vitest";
import { applyAdminCharge, formatINR } from "@/lib/money";

describe("applyAdminCharge (5% admin charge)", () => {
  it("Direct Sponsor ₹1,000 → admin ₹50, net ₹950", () => {
    const r = applyAdminCharge(1000, 5);
    expect(r.adminCharge.toNumber()).toBe(50);
    expect(r.net.toNumber()).toBe(950);
  });

  it("Co-Sponsor ₹200 → admin ₹10, net ₹190", () => {
    const r = applyAdminCharge(200, 5);
    expect(r.adminCharge.toNumber()).toBe(10);
    expect(r.net.toNumber()).toBe(190);
  });

  it("stacked depth-1 ₹1,100 (Direct+Level1) → admin ₹55, net ₹1,045", () => {
    const r = applyAdminCharge(1100, 5);
    expect(r.adminCharge.toNumber()).toBe(55);
    expect(r.net.toNumber()).toBe(1045);
  });

  it("0% charge leaves gross intact", () => {
    const r = applyAdminCharge(2200, 0);
    expect(r.adminCharge.toNumber()).toBe(0);
    expect(r.net.toNumber()).toBe(2200);
  });
});

describe("formatINR", () => {
  it("formats Indian grouping", () => {
    expect(formatINR(300000)).toBe("₹3,00,000.00");
  });
});
