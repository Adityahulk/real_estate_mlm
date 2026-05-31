import Decimal from "decimal.js";

// All money math goes through here so rounding never drifts.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(value: Decimal.Value): Decimal {
  return new Decimal(value ?? 0);
}

// Round to 2 decimal places (paise).
export function round2(value: Decimal.Value): Decimal {
  return new Decimal(value ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Splits a gross commission into the admin charge and the net payable.
// Net = gross × (1 - pct/100). e.g. applyAdminCharge(1000, 5) -> {admin:50, net:950}.
export function applyAdminCharge(gross: Decimal.Value, pct: Decimal.Value): { adminCharge: Decimal; net: Decimal } {
  const g = round2(gross);
  const adminCharge = round2(g.mul(pct).div(100));
  const net = round2(g.minus(adminCharge));
  return { adminCharge, net };
}

export function toNumber(value: Decimal.Value): number {
  return new Decimal(value ?? 0).toNumber();
}

// Format as Indian Rupee string, e.g. ₹1,23,456.78
export function formatINR(value: Decimal.Value, withSymbol = true): string {
  const n = new Decimal(value ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [intPartRaw, decPart] = n.abs().toFixed(2).split(".");
  // Indian grouping: last 3 digits, then groups of 2.
  const intPart = intPartRaw;
  let formatted = "";
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length) groups.unshift(rest);
    formatted = groups.join(",") + "," + last3;
  } else {
    formatted = intPart;
  }
  const sign = n.isNegative() ? "-" : "";
  return `${sign}${withSymbol ? "₹" : ""}${formatted}.${decPart}`;
}
