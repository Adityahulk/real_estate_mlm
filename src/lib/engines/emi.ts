import { round2, money } from "../money";
import Decimal from "decimal.js";

export interface EmiRow {
  installmentNo: number;
  amountDue: Decimal;
  dueDate: Date;
  payByDate: Date;
}

export interface EmiScheduleInput {
  plotPrice: Decimal.Value;
  bookingAmount: Decimal.Value;
  numInstallments: number;
  startDate: Date; // first EMI due date (usually 1 month after booking)
  payByDays: number; // pay-by = dueDate - payByDays
}

// Generates the post-booking EMI schedule. The sum of all installments equals
// (plotPrice - bookingAmount) exactly — the last installment absorbs any
// rounding remainder so the member never over/under pays by a paisa.
export function generateInstallmentSchedule(input: EmiScheduleInput): EmiRow[] {
  const { numInstallments, startDate, payByDays } = input;
  const remaining = money(input.plotPrice).minus(money(input.bookingAmount));
  if (numInstallments <= 0) return [];

  const baseRaw = remaining.div(numInstallments);
  const base = round2(baseRaw);

  const rows: EmiRow[] = [];
  let accumulated = money(0);
  for (let i = 1; i <= numInstallments; i++) {
    let amount: Decimal;
    if (i < numInstallments) {
      amount = base;
      accumulated = accumulated.plus(base);
    } else {
      amount = round2(remaining.minus(accumulated)); // last absorbs remainder
    }
    const dueDate = addMonths(startDate, i - 1);
    const payByDate = addDays(dueDate, -payByDays);
    rows.push({ installmentNo: i, amountDue: amount, dueDate, payByDate });
  }
  return rows;
}

// Cashback plan: a single full payment + N monthly cashback credit dates.
export interface CashbackRow {
  monthNo: number;
  amount: Decimal;
  creditDate: Date;
}

export function generateCashbackSchedule(input: {
  plotPrice: Decimal.Value;
  ratePct: Decimal.Value;
  months: number;
  startDate: Date;
}): CashbackRow[] {
  const monthly = round2(money(input.plotPrice).mul(money(input.ratePct)).div(100));
  const rows: CashbackRow[] = [];
  for (let i = 1; i <= input.months; i++) {
    rows.push({ monthNo: i, amount: monthly, creditDate: addMonths(input.startDate, i) });
  }
  return rows;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // guard month overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
