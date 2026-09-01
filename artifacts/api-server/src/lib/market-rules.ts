// ─────────────────────────────────────────────────────────────────────────────
// Market module business rules. Pure functions: no DB, no Express.
// Shared by the market routes and by tests/market-rules.test.mjs.
//
// Regulatory basis (enforced here, at the write layer, not the render layer):
//  - Botulinum toxin is a prescription-only medicine (POM). CAP Code rule 12.12
//    and MHRA guidance prohibit advertising POMs to the public, which includes
//    naming them inside promotable memberships, packages, discounts or offers.
//  - Referral incentives are generic clinic credit, never framed against a POM.
//  - Prices are VAT inclusive; the VAT element is gross / 6.
// ─────────────────────────────────────────────────────────────────────────────

export type TreatmentLite = {
  key: string;
  displayName: string;
  isPom: boolean;
  durationMinutes: number;
  priceWinchester: number | null;
  priceBedhampton: number | null;
};

export type InclusionSpec = {
  treatmentKey?: string;            // a specific treatment included
  choiceOf?: string[];              // client's monthly choice from these keys
  qtyPerMonth?: number;
  qtyPerYear?: number;
  addOnKey?: string;                // included as an add-on (uses add-on pricing where noted)
  addOnPriceW?: number;
  addOnPriceB?: number;
  label?: string;                   // non-treatment inclusions (rescan, notes, discounts)
};

// ── POM validation ───────────────────────────────────────────────────────────
export function validateMembershipInclusions(
  inclusions: InclusionSpec[],
  isPublic: boolean,
  treatmentsByKey: Map<string, TreatmentLite>,
): { ok: true } | { ok: false; error: string } {
  if (!isPublic) return { ok: true }; // private, post-consultation plans may carry prescribed schedules
  const offending: string[] = [];
  for (const inc of inclusions) {
    const keys = [
      ...(inc.treatmentKey ? [inc.treatmentKey] : []),
      ...(inc.choiceOf ?? []),
      ...(inc.addOnKey ? [inc.addOnKey] : []),
    ];
    for (const k of keys) {
      const t = treatmentsByKey.get(k);
      if (t?.isPom) offending.push(t.displayName || k);
    }
  }
  if (offending.length > 0) {
    return {
      ok: false,
      error:
        `Blocked: a public membership or package cannot include a prescription-only medicine (${[...new Set(offending)].join(", ")}). ` +
        `Botulinum toxin is a POM; advertising POMs to the public breaches CAP Code 12.12 and MHRA guidance. ` +
        `Set is_public to false (private, post-consultation enrolment) or remove the POM inclusion.`,
    };
  }
  return { ok: true };
}

// ── Public export builder (website / ads / founders funnel / GHL non-patient) ─
export function buildPublicMembershipExport<T extends { isPublic: boolean }>(memberships: T[]): T[] {
  // The private tier (Frown Free Club / APA Treatment Plan) must never reach a
  // public surface. Enforced here so every export path shares the same gate.
  return memberships.filter(m => m.isPublic === true);
}

// ── Median engine ────────────────────────────────────────────────────────────
export type PriceSample = { priceGbp: number; qualifier: string; competitorId: number };
export type MedianResult = {
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
  lowConfidence: boolean;           // n < 4
};

export function computeMedian(samples: PriceSample[]): MedianResult {
  const prices = samples.filter(s => s.priceGbp != null && s.priceGbp > 0 && s.qualifier !== "poa").map(s => s.priceGbp);
  const n = prices.length;
  if (n === 0) return { n: 0, median: null, q1: null, q3: null, min: null, max: null, lowConfidence: true };
  const s = [...prices].sort((a, b) => a - b);
  const at = (p: number) => {
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return {
    n,
    median: Math.round(at(0.5)),
    q1: Math.round(at(0.25)),
    q3: Math.round(at(0.75)),
    min: s[0],
    max: s[s.length - 1],
    lowConfidence: n < 4,
  };
}

// ── Variance alerting ────────────────────────────────────────────────────────
export function varianceFlag(ourPrice: number | null, median: number | null): "below" | "above" | null {
  if (ourPrice == null || median == null || median <= 0) return null;
  const delta = (ourPrice - median) / median;
  if (delta < -0.15) return "below";  // margin left on the table
  if (delta > 0.15) return "above";   // conversion risk
  return null;
}

// ── Face value (computed from the treatments table, never typed) ─────────────
export function computeFaceValue(
  inclusions: InclusionSpec[],
  site: "winchester" | "bedhampton",
  treatmentsByKey: Map<string, TreatmentLite>,
): number {
  let monthly = 0;
  const priceOf = (k: string) => {
    const t = treatmentsByKey.get(k);
    if (!t) return 0;
    return (site === "winchester" ? t.priceWinchester : t.priceBedhampton) ?? 0;
  };
  for (const inc of inclusions) {
    const perMonth = inc.qtyPerMonth ?? (inc.qtyPerYear ? inc.qtyPerYear / 12 : 0);
    if (inc.treatmentKey && perMonth > 0) monthly += priceOf(inc.treatmentKey) * perMonth;
    if (inc.choiceOf && inc.choiceOf.length > 0 && perMonth > 0) {
      const avg = inc.choiceOf.map(priceOf).filter(v => v > 0);
      if (avg.length) monthly += (avg.reduce((a, b) => a + b, 0) / avg.length) * perMonth;
    }
    if (inc.addOnKey) {
      const addOn = site === "winchester" ? (inc.addOnPriceW ?? priceOf(inc.addOnKey)) : (inc.addOnPriceB ?? priceOf(inc.addOnKey));
      monthly += addOn * (perMonth > 0 ? perMonth : 1);
    }
  }
  return Math.round(monthly);
}

// ── Revenue per clinical hour ────────────────────────────────────────────────
export function revenuePerHour(priceGbp: number | null, durationMinutes: number): number | null {
  if (priceGbp == null || priceGbp <= 0 || durationMinutes <= 0) return null;
  return Math.round((priceGbp / durationMinutes) * 60);
}

// ── VAT split (VAT inclusive pricing; VRN 523 3501 30) ───────────────────────
export function vatElement(grossGbp: number): number {
  return Math.round((grossGbp / 6) * 100) / 100;
}

// ── Membership price-band gap detection (≥ £30 empty bands, recomputed) ──────
export type PricePoint = { low: number; high: number };
export function detectGaps(points: PricePoint[], minGap = 30): { from: number; to: number; width: number }[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.low - b.low);
  // Merge overlapping covered intervals
  const covered: PricePoint[] = [];
  for (const p of sorted) {
    const last = covered[covered.length - 1];
    if (last && p.low <= last.high) last.high = Math.max(last.high, p.high);
    else covered.push({ ...p });
  }
  const gaps: { from: number; to: number; width: number }[] = [];
  for (let i = 0; i < covered.length - 1; i++) {
    const from = covered[i].high, to = covered[i + 1].low;
    if (to - from >= minGap) gaps.push({ from, to, width: Math.round(to - from) });
  }
  return gaps;
}

// ── Copy compliance (applies to generated copy and seeded descriptions) ──────
export function copyComplianceIssues(text: string): string[] {
  const issues: string[] = [];
  if (/botox/i.test(text)) issues.push("Uses the word Botox; say anti-wrinkle treatment");
  if (/[—–]/.test(text)) issues.push("Contains an em or en dash");
  if (/inject(ed|ing)?\s+exosome|exosome[s]?\s+inject/i.test(text)) issues.push("Describes exosomes as injected; they are applied topically post-microneedling");
  if (/listed building/i.test(text)) issues.push("Describes 9A Jewry Street as a listed building; it is not");
  return issues;
}
