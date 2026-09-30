// ── Growth model: takings from patients ──────────────────────────────────────
// A clinic's takings in a month are its new patients' first-month spend plus the
// return visits of every patient who came before. Built from the ANS export of
// 30 September 2026, totals only. Calibrated so that Bedhampton's own history of
// new patients reproduces its actual takings for March to September 2026 (£75,646).
// Pure: no database, no clock.

export type PatientModel = {
  firstMonth: number;   // £ a new patient spends in their first month, at Bedhampton prices
  returnVisit: number;  // £ a return visit, at Bedhampton prices
  returns: number[];    // return visits per new patient, months 1 to 36 after the first (index 0 unused)
  tailFade: number;     // after month 36 each month is this share of the one before
};

// A group of patients who first came in the same month.
export type Cohort = { month: string; patients: number; priceFactor: number; firstMonthTotal?: number };

// New patients a month at Winchester: `early` a month until earlyUntil (founders and
// the warm list), then `start`, growing by growthPerMonth up to `cap`.
export type NewPatientProfile = { early: number; earlyUntil: string; start: number; growthPerMonth: number; cap: number };

const idx = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y * 12 + m - 1; };
const ymOf = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
export const monthsFrom = (start: string, n: number) => Array.from({ length: n }, (_, i) => ymOf(idx(start) + i));

export function returnsAt(p: PatientModel, k: number): number {
  if (k < 1) return 0;
  const last = p.returns.length - 1;
  return k <= last ? p.returns[k] : p.returns[last] * Math.pow(p.tailFade, k - last);
}

export function cohortTakings(p: PatientModel, cohorts: Cohort[], months: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of months) {
    const t = idx(m);
    let v = 0;
    for (const c of cohorts) {
      const k = t - idx(c.month);
      if (k === 0) v += c.firstMonthTotal ?? c.patients * p.firstMonth * c.priceFactor;
      else if (k > 0) v += c.patients * returnsAt(p, k) * p.returnVisit * c.priceFactor;
    }
    out[m] = v;
  }
  return out;
}

export function newPatients(pr: NewPatientProfile, month: string, firstMonth: string): number {
  if (month <= pr.earlyUntil) return pr.early;
  const k = idx(month) - idx(pr.earlyUntil) - 1;
  return Math.min(pr.cap, pr.start + pr.growthPerMonth * k);
}

// Winchester: the founding cohort already booked, then a profile of new patients.
// Founders pay about Bedhampton prices; later patients the Winchester list.
export function wincForecast(p: PatientModel, pr: NewPatientProfile, o: {
  founding: { month: string; patients: number; firstMonthTotal: number };
  firstCohort: string; founderPrice: number; listPrice: number; founderUntil: string;
}, months: string[]): Record<string, number> {
  const cohorts: Cohort[] = [{ month: o.founding.month, patients: o.founding.patients, priceFactor: o.founderPrice, firstMonthTotal: o.founding.firstMonthTotal }];
  for (const m of months) if (m >= o.firstCohort) cohorts.push({ month: m, patients: newPatients(pr, m, o.firstCohort), priceFactor: m <= o.founderUntil ? o.founderPrice : o.listPrice });
  const t = cohortTakings(p, cohorts, months);
  for (const m of months) if (m < o.founding.month) t[m] = 0;
  return t;
}

// Product cost (ex VAT) of a Winchester forecast, month by month. A treatment costs the
// same to make at any price, so each cohort's product cost is its takings at Bedhampton
// prices (takings / priceFactor) times productShare, the product share of Bedhampton's
// takings.
export function wincProductCost(p: PatientModel, pr: NewPatientProfile, o: Parameters<typeof wincForecast>[2], months: string[], productShare: number): Record<string, number> {
  const atBedhamptonPrices = wincForecast(p, pr, { ...o, founderPrice: 1, listPrice: 1, founding: { ...o.founding, firstMonthTotal: o.founding.firstMonthTotal / o.founderPrice } }, months);
  return Object.fromEntries(months.map(m => [m, atBedhamptonPrices[m] * productShare]));
}

// Bedhampton if it runs two days or one day a week from `from`. Its existing patients
// keep coming back (keep.two or keep.one of them, as fewer days suit fewer people),
// and it finds newPerMonth new patients without advertising. `returns` is what its
// existing patients would spend on return visits, for the share who follow Abi to
// Winchester when it closes.
export function bedhDemand(p: PatientModel, history: Record<string, number>, o: {
  from: string; explicit: Record<string, number>; newBefore: number;
  newPerMonth: { two: number; one: number }; keep: { two: number; one: number };
}, months: string[]): { two: Record<string, number>; one: Record<string, number>; returns: Record<string, number> } {
  const two: Record<string, number> = {}, one: Record<string, number> = {}, returns: Record<string, number> = {};
  const before: Cohort[] = Object.entries(history).map(([month, patients]) => ({ month, patients, priceFactor: 1 }));
  for (const m of months) if (m < o.from && history[m] == null) before.push({ month: m, patients: o.newBefore, priceFactor: 1 });
  const baseReturns = cohortTakings(p, before.map(c => ({ ...c, firstMonthTotal: 0 })), months);
  for (const days of ["two", "one"] as const) {
    const fresh = months.filter(m => m >= o.from).map(m => ({ month: m, patients: o.newPerMonth[days], priceFactor: 1 }));
    const own = cohortTakings(p, fresh, months);
    for (const m of months) {
      const v = o.explicit[m] ?? (m < o.from ? baseReturns[m] : baseReturns[m] * o.keep[days] + own[m]);
      (days === "two" ? two : one)[m] = v;
    }
  }
  for (const m of months) returns[m] = baseReturns[m];
  return { two, one, returns };
}
