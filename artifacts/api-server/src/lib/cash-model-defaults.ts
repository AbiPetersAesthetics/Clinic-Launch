// ── Cash model defaults ──────────────────────────────────────────────────────
// The owner's specification of 30 September 2026, with his answers of the same
// day applied: Winchester trades from the end of November, marketing is 600 a
// month (by bank to November, by card from December), launch ads are reverse
// charged, fire alarm maintenance is one payment of about 220 in October 2027.
// Stored inputs on financial_models.cash_model_json override any of these.
// Project payments, funding and loans come from the plan and investments tables.

import type { CashInputs } from "./cash-model";

// Winchester takings, gross inc VAT. "base" is the owner's ramp; the other three
// are the evidence-led alternatives from analysis B (30 September), with the
// pre-opening bookings taken at the end of November in every case.
export const WINC_SCENARIOS: Record<string, { label: string; note: string; takings: Record<string, number> }> = {
  base: {
    label: "Your forecast",
    note: "The owner's ramp to 14,700 in June 2027 (break-even including pay at the time it was set).",
    takings: { "2026-11": 1500, "2026-12": 4000, "2027-01": 6000, "2027-02": 8000, "2027-03": 9500, "2027-04": 11000, "2027-05": 13000, "2027-06": 14700 },
  },
  cautious: {
    label: "Cautious",
    note: "8 to 12 new patients a month and about 10% of Bedhampton patients moving across. Falls below the cash floor from March 2027.",
    takings: { "2026-11": 1500, "2026-12": 3314, "2027-01": 3134, "2027-02": 3414, "2027-03": 6264, "2027-04": 6950, "2027-05": 7414, "2027-06": 9563 },
  },
  evidence: {
    label: "Evidence-based",
    note: "12 to 17 new patients a month (Bedhampton's recent intake) and about 20% of Bedhampton patients moving across, a third in December and the rest at closure.",
    takings: { "2026-11": 1500, "2026-12": 5011, "2027-01": 5391, "2027-02": 5671, "2027-03": 8889, "2027-04": 12497, "2027-05": 12961, "2027-06": 15351 },
  },
  strong: {
    label: "Strong",
    note: "18 to 24 new patients a month and about 25% of Bedhampton patients moving across.",
    takings: { "2026-11": 1500, "2026-12": 6398, "2027-01": 7898, "2027-02": 8458, "2027-03": 12323, "2027-04": 18600, "2027-05": 18967, "2027-06": 21502 },
  },
};

export type CashModelConfig = Omit<CashInputs, "projectPayments" | "funding" | "loans" | "winc" | "months"> & {
  openingDate: string;
  winc: { contributionPct: number; scenario: string; growth: { target: number; month: string } };
  // Actuals before the model starts, for the collapsed history block only.
  history: { bedhTakings: Record<string, number>; source: string };
};

export const CASH_MODEL_DEFAULTS: CashModelConfig = {
  startMonth: "2026-10",
  openingDate: "2026-09-30",
  openingBank: 35000,
  bedh: {
    takings: { "2026-10": 8000, "2026-11": 9000, "2026-12": 3000, "2027-01": 3000, "2027-02": 3000, "2027-03": 3000 },
    contributionPct: 54,
  },
  winc: { contributionPct: 58, scenario: "base", growth: { target: 22000, month: "2029-02" } },
  vatRate: 0.2,
  rent: { annual: 32500, rentStart: "2027-01-02", quarterDays: ["03-25", "06-24", "09-29", "12-25"] },
  rates: { monthly: 1333, from: "2026-10" },
  utilities: { monthly: 280, buildMonthly: 210, buildUntil: "2026-10", from: "2026-10" },
  running: { monthly: 450 },
  marketing: { monthly: 600, cardFrom: "2026-12" },
  card: { limit: 20000, repayMonths: 24 },
  cashFloor: 10000,
  // Basic-rate limit 50,270 a year = 4,189.17 a month. Employer NI 15% above 5,000 a year.
  pay: { retention: 3000, capMonthly: 4189.17, niRatePct: 15, niThresholdAnnual: 5000, gateMonths: 2 },
  oneOffs: [{ month: "2027-10", amount: 220, method: "bank", label: "Fire alarm maintenance (annual)", pnl: true }],
  history: {
    bedhTakings: { "2026-06": 13893, "2026-07": 9207, "2026-08": 6552, "2026-09": 10185 },
    source: "ANS export, 30 September 2026 (Client Treatments, excluding cancellations and no-shows)",
  },
};
