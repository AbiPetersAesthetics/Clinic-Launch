// ── Cash model defaults ──────────────────────────────────────────────────────
// The owner's specification of 30 September 2026, with his answers of the same
// day applied: Winchester trades from the end of November, marketing is 600 a
// month from the bank (the card is a one-off for the build and pre-opening
// purchases, never ongoing costs), launch ads are reverse charged, fire alarm
// maintenance is one payment of about 220 in October 2027, VAT returns are monthly.
// Stored inputs on financial_models.cash_model_json override any of these.
// Project payments, funding and loans come from the plan and investments tables.

import type { CashInputs, WincCapacity } from "./cash-model";
import { bedhDemand, monthsFrom, wincForecast, type NewPatientProfile, type PatientModel } from "./growth-model";

// ── The patient model (ANS export, 30 September 2026, totals only) ──
// A new patient spends about 168 in their first month and 134 a return visit, at
// Bedhampton prices. Return visits per new patient by month since the first, scaled
// so Bedhampton's own history reproduces its March to September 2026 takings.
export const PATIENT_MODEL: PatientModel = {
  firstMonth: 168.04, returnVisit: 134.22, tailFade: 0.97,
  returns: [0, 0.3345, 0.2897, 0.1913, 0.1611, 0.1325, 0.119, 0.1087, 0.0936, 0.0802, 0.0762, 0.077, 0.0725, 0.0674, 0.0614, 0.0495, 0.0428, 0.0459, 0.0404, 0.0478, 0.057, 0.0671, 0.0669, 0.0526, 0.051, 0.0494, 0.048, 0.0465, 0.0451, 0.0438, 0.0425, 0.0412, 0.04, 0.0388, 0.0376, 0.0365, 0.0354],
};
// New patients a month at Bedhampton (first appointment in ANS), May 2024 to Sep 2026.
export const BEDH_NEW_PATIENTS: Record<string, number> = {
  "2024-05": 2, "2024-06": 1, "2024-07": 1, "2024-08": 11, "2024-09": 10, "2024-10": 8, "2024-11": 13, "2024-12": 5,
  "2025-01": 25, "2025-02": 20, "2025-03": 34, "2025-04": 8, "2025-05": 29, "2025-06": 19, "2025-07": 22, "2025-08": 38, "2025-09": 13, "2025-10": 33, "2025-11": 19, "2025-12": 11,
  "2026-01": 30, "2026-02": 12, "2026-03": 32, "2026-04": 23, "2026-05": 39, "2026-06": 27, "2026-07": 21, "2026-08": 9, "2026-09": 18,
};

const MODEL_MONTHS = monthsFrom("2026-10", 48);
const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));

// Winchester new patients a month. Founders and the warm list lift December to
// February; after that the central case starts below Bedhampton's 23 a month and
// grows towards it as word spreads.
export const WINC_PROFILES: Record<"low" | "central" | "high", NewPatientProfile> = {
  low: { early: 12, earlyUntil: "2027-02", start: 10, growthPerMonth: 0, cap: 10 },
  central: { early: 22, earlyUntil: "2027-02", start: 16, growthPerMonth: 0.25, cap: 24 },
  high: { early: 32, earlyUntil: "2027-02", start: 26, growthPerMonth: 0.3, cap: 36 },
};
// The 30 founding bookings for November (mostly skin analysis, 1,184 booked). Founders
// pay about Bedhampton prices; patients from February pay the Winchester list, about
// 20% more once founders' prices are averaged in.
const WINC_OPTS = { founding: { month: "2026-11", patients: 30, firstMonthTotal: 1184 }, firstCohort: "2026-12", founderPrice: 1.0, listPrice: 1.2, founderUntil: "2027-01" };
const cohort = (k: keyof typeof WINC_PROFILES) => round(wincForecast(PATIENT_MODEL, WINC_PROFILES[k], WINC_OPTS, MODEL_MONTHS));

// Winchester takings, gross inc VAT. "central" is the recommended planning case.
export const WINC_SCENARIOS: Record<string, { label: string; note: string; takings: Record<string, number> }> = {
  central: {
    label: "Recommended",
    note: "Built from Bedhampton's real patients: 22 new patients a month from December to February (founders and the warm list), then 16 a month growing to 24, each spending what Bedhampton patients spend, at Winchester prices.",
    takings: cohort("central"),
  },
  base: {
    label: "David's forecast",
    note: "1,500 in November to 14,700 in June 2027, then a straight line to 22,000 by February 2029. On the patient model it needs about 37 new patients a month from December.",
    takings: { "2026-11": 1500, "2026-12": 4000, "2027-01": 6000, "2027-02": 8000, "2027-03": 9500, "2027-04": 11000, "2027-05": 13000, "2027-06": 14700 },
  },
  low: {
    label: "Slow",
    note: "10 new patients a month after the first three months: Winchester if leads keep converting to bookings at the pre-opening rate.",
    takings: cohort("low"),
  },
  high: {
    label: "Fast",
    note: "26 to 36 new patients a month: better than Bedhampton has done in any month so far.",
    takings: cohort("high"),
  },
};

// Bedhampton on two days or one day a week from December: its existing patients keep
// coming back (90% of them on two days, 75% on one), it finds 8 or 4 new patients a
// month without adverts, and a clinic day holds about 1,750 (80% of 7 hours at about
// 310 a booked hour).
const BEDH_DEMAND = bedhDemand(PATIENT_MODEL, BEDH_NEW_PATIENTS, {
  from: "2026-12", explicit: { "2026-10": 8000, "2026-11": 9000 }, newBefore: 20,
  newPerMonth: { two: 8, one: 4 }, keep: { two: 0.9, one: 0.75 },
}, MODEL_MONTHS);

export type CashModelConfig = Omit<CashInputs, "projectPayments" | "funding" | "loans" | "winc" | "months"> & {
  openingDate: string;
  winc: { contributionPct: number; scenario: string; growth: { target: number; month: string }; capacity: WincCapacity };
  // Actuals before the model starts, for the collapsed history block only.
  history: { bedhTakings: Record<string, number>; source: string };
};

export const CASH_MODEL_DEFAULTS: CashModelConfig = {
  startMonth: "2026-10",
  openingDate: "2026-09-30",
  openingBank: 35000,
  bedh: {
    takings: { "2026-10": 8000, "2026-11": 9000 },
    contributionPct: 54,
    // Owner, 30 Sep: Bedhampton stays open while Winchester is not making enough,
    // in every forecast. Abi works three days at Winchester and two at Bedhampton
    // until Winchester on its own takes 15,100 a month for two months running: enough
    // to pay its bills (5,371), James's loan (364) and the 3,000 the business keeps, at
    // 58p in the pound. Then Bedhampton closes and 15% of its patients follow.
    plan: {
      from: "2026-12", weekDays: 5, dayCapacity: 1750,
      demand: { two: round(BEDH_DEMAND.two), one: round(BEDH_DEMAND.one), returns: round(BEDH_DEMAND.returns) },
      oneDayFrom: null,
      closeWhen: { wincAtLeast: 15100, forMonths: 2 },
      closeAfter: null,
      floorPerDay: 400,
      transferShare: 0.15,
    },
  },
  // Capacity: about 310 of takings per booked hour at Bedhampton, 20% more at
  // Winchester prices; a day counts as full at 80% of 7 hours.
  winc: { contributionPct: 58, scenario: "central", growth: { target: 22000, month: "2029-02" }, capacity: { perBookedHour: 372, hoursPerDay: 7, maxBookedPct: 80 } },
  vatRate: 0.2,
  // Monthly VAT returns (owner, 30 Sep): build VAT is refunded the month after it is paid.
  vatReturns: { periodEndMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], refundLagMonths: 1 },
  rent: { annual: 32500, rentStart: "2027-01-02", quarterDays: ["03-25", "06-24", "09-29", "12-25"] },
  rates: { monthly: 1333, from: "2026-10" },
  utilities: { monthly: 280, buildMonthly: 210, buildUntil: "2026-10", from: "2026-10" },
  running: { monthly: 450 },
  // Bedhampton ads to November, Winchester ads from December. Always paid from the bank.
  marketing: { monthly: 600, wincFrom: "2026-12", cardFrom: null },
  card: { limit: 20000, repayMonths: 24 },
  cashFloor: 10000,
  // Basic-rate limit 50,270 a year = 4,189.17 a month. Employer NI 15% above 5,000 a year.
  pay: { retention: 3000, capMonthly: 4189.17, niRatePct: 15, niThresholdAnnual: 5000, gateMonths: 2, retentionUntilBank: null },
  oneOffs: [{ month: "2027-10", amount: 220, method: "bank", label: "Fire alarm maintenance (annual)", pnl: true }],
  history: {
    bedhTakings: { "2026-06": 13893, "2026-07": 9207, "2026-08": 6552, "2026-09": 10185 },
    source: "ANS export, 30 September 2026 (Client Treatments, excluding cancellations and no-shows)",
  },
};
