import { prisma } from "./db";

// Default business config. Every "pending client question" number lives here,
// not in code. Editable at runtime via Admin -> System Settings.
export const SETTING_DEFAULTS = {
  plot_price: "300000",
  booking_amount: "10000",
  num_installments: "29",
  cashback_rate_pct: "3",
  cashback_months: "34",
  development_charges: "0",
  documentation_charges: "0",
  admin_charge_pct: "5",
  tds_rate_pct: "0",
  min_payout_threshold: "0",
  draw_frequency_months: "2",
  draw_trigger_plots: "100",
  payment_window_start_day: "25",
  payment_window_end_day: "5",
  point_to_inr_rate: "1",
  allow_multiple_plots: "false",
  emi_pay_by_days_before: "5",
  insurance_min_months: "5",
  bronze_min_referrals: "11",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_META: Record<SettingKey, { label: string; type: "NUMBER" | "BOOLEAN" }> = {
  plot_price: { label: "Plot Price (₹)", type: "NUMBER" },
  booking_amount: { label: "Booking Amount (₹)", type: "NUMBER" },
  num_installments: { label: "Number of EMI Installments", type: "NUMBER" },
  cashback_rate_pct: { label: "Cashback Rate (% / month)", type: "NUMBER" },
  cashback_months: { label: "Cashback Duration (months)", type: "NUMBER" },
  development_charges: { label: "Development Charges (₹)", type: "NUMBER" },
  documentation_charges: { label: "Documentation Charges (₹)", type: "NUMBER" },
  admin_charge_pct: { label: "Admin Charge on Commission (%)", type: "NUMBER" },
  tds_rate_pct: { label: "TDS Rate (%) — unused", type: "NUMBER" },
  min_payout_threshold: { label: "Minimum Payout Threshold (₹)", type: "NUMBER" },
  draw_frequency_months: { label: "Lucky Draw Frequency (months)", type: "NUMBER" },
  draw_trigger_plots: { label: "Draw Starts After N Plots Booked", type: "NUMBER" },
  payment_window_start_day: { label: "Payment Window Start Day", type: "NUMBER" },
  payment_window_end_day: { label: "Payment Window End Day", type: "NUMBER" },
  point_to_inr_rate: { label: "Point → INR Rate", type: "NUMBER" },
  allow_multiple_plots: { label: "Allow Multiple Plots Per Person", type: "BOOLEAN" },
  emi_pay_by_days_before: { label: "EMI Pay-By Days Before Due", type: "NUMBER" },
  insurance_min_months: { label: "Insurance Eligibility (min months)", type: "NUMBER" },
  bronze_min_referrals: { label: "Bronze Rank Min Direct Referrals", type: "NUMBER" },
};

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.systemSetting.findMany();
  const map = { ...SETTING_DEFAULTS } as Record<string, string>;
  for (const r of rows) map[r.key] = r.value;
  return map as Record<SettingKey, string>;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function getNumberSetting(key: SettingKey): Promise<number> {
  return Number(await getSetting(key));
}

export async function getBoolSetting(key: SettingKey): Promise<boolean> {
  return (await getSetting(key)) === "true";
}
