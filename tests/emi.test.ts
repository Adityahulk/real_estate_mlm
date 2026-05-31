import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { generateInstallmentSchedule } from "@/lib/engines/emi";

const sumRows = (rows: { amountDue: Decimal }[]) =>
  rows.reduce((a, r) => a.plus(r.amountDue), new Decimal(0)).toNumber();

describe("EMI schedule generator", () => {
  const rows = generateInstallmentSchedule({
    plotPrice: 300000,
    bookingAmount: 10000,
    numInstallments: 29,
    startDate: new Date("2026-07-01"),
    payByDays: 5,
  });

  it("creates the requested number of installments", () => {
    expect(rows.length).toBe(29);
  });

  it("sums to exactly (plotPrice - booking)", () => {
    expect(sumRows(rows)).toBe(290000);
  });

  it("each installment is ₹10,000 in the clean default", () => {
    expect(rows.every((r) => r.amountDue.toNumber() === 10000)).toBe(true);
  });

  it("pay-by date is 5 days before due date", () => {
    const due = rows[0].dueDate;
    const payBy = rows[0].payByDate;
    const diff = (due.getTime() - payBy.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(5);
  });

  it("absorbs rounding remainder in the last installment", () => {
    // 290000 / 30 is not clean -> last row differs but total stays exact
    const r = generateInstallmentSchedule({
      plotPrice: 300000,
      bookingAmount: 10000,
      numInstallments: 30,
      startDate: new Date("2026-07-01"),
      payByDays: 5,
    });
    expect(sumRows(r)).toBe(290000);
  });
});
