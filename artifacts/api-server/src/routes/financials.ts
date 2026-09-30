import { Router } from "express";
import { buildCashModel } from "./cash-model";
import { db } from "@workspace/db";
import { financialsTable, propertiesTable, projectsTable, phasesTable, tasksTable, fixedCostItemsTable, lifestylePlanTable, propertyTaskOverridesTable, investmentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  calcWincAtOccupancy,
  calcWinchester,
  calcBedhampton,
  findSelfFundingMonth,
  calcCombined,
  calcOwner,
  calcPayeBreakdown,
  calcCliniciansMonthlyCost,
} from "../lib/financialEngine";
import { fetchBedhamptonLive } from "./bedhampton";

const router = Router();

// ─── Scenario Profiles ────────────────────────────────────────────────────────

const SCENARIO_PROFILES: Record<string, {
  getTargetOcc: (m: any) => number;
  acvMultiplier: number;
  startOcc: number;
  rampMonths: number;
  nursingMultiplier: number;
  note: string;
}> = {
  conservative: {
    getTargetOcc: (m) => m.conservativeOccupancyPercent || 40,
    acvMultiplier: 1, startOcc: 20, rampMonths: 8, nursingMultiplier: 1,
    note: "Conservative occupancy, steady 8-month ramp",
  },
  realistic: {
    getTargetOcc: (m) => m.realisticOccupancyPercent || 68,
    acvMultiplier: 1, startOcc: 25, rampMonths: 6, nursingMultiplier: 1,
    note: "Realistic occupancy, standard 6-month ramp",
  },
  aggressive: {
    getTargetOcc: (m) => m.aggressiveOccupancyPercent || 85,
    acvMultiplier: 1, startOcc: 35, rampMonths: 4, nursingMultiplier: 1,
    note: "High occupancy, fast 4-month ramp — strong marketing required",
  },
  delayed_ramp: {
    getTargetOcc: (m) => m.realisticOccupancyPercent || 68,
    acvMultiplier: 1, startOcc: 15, rampMonths: 12, nursingMultiplier: 1,
    note: "Realistic target but 12-month ramp — marketing underperforms at launch",
  },
  economic_downturn: {
    getTargetOcc: (m) => (m.conservativeOccupancyPercent || 40) * 0.8,
    acvMultiplier: 0.85, startOcc: 15, rampMonths: 9, nursingMultiplier: 1,
    note: "Economic pressure: lower consumer demand, −15% average spend",
  },
  stress_test: {
    getTargetOcc: (m) => Math.max((m.conservativeOccupancyPercent || 40) * 0.65, 12),
    acvMultiplier: 0.9, startOcc: 5, rampMonths: 10, nursingMultiplier: 1,
    note: "Worst case: 5% opening occupancy, very slow ramp, lower average spend",
  },
};

// ─── Ramp Growth Tiers ────────────────────────────────────────────────────────
// Applied on top of scenario profiles to model different growth trajectories.
// "slow"    = word-of-mouth only, no waiting list — realistic for a brand-new location
// "average" = typical UK aesthetics clinic launch with light pre-opening marketing
// "fast"    = above average: strong social presence, existing waiting list, prior brand
//
// Modifiers scale the scenario's startOcc and rampMonths independently.
// startOcc is clamped to a minimum of 3% (you can't open with zero bookings)
// and rampMonths is clamped to a minimum of 2.

const RAMP_TIER_MODIFIERS: Record<string, { startOccMult: number; rampMonthsMult: number; label: string }> = {
  slow:    { startOccMult: 0.30, rampMonthsMult: 2.0,  label: "Below Average" },
  average: { startOccMult: 1.0,  rampMonthsMult: 1.0,  label: "Average"       },
  fast:    { startOccMult: 1.45, rampMonthsMult: 0.65, label: "Above Average" },
};

function applyRampTier(
  profile: typeof SCENARIO_PROFILES[string],
  tier: string,
): typeof SCENARIO_PROFILES[string] {
  const mod = RAMP_TIER_MODIFIERS[tier] ?? RAMP_TIER_MODIFIERS.average;
  const newStartOcc    = Math.max(Math.round(profile.startOcc    * mod.startOccMult),    3);
  const newRampMonths  = Math.max(Math.round(profile.rampMonths  * mod.rampMonthsMult),  2);
  const tierLabel      = tier !== "average" ? ` · ${mod.label} growth` : "";
  return {
    ...profile,
    startOcc:   newStartOcc,
    rampMonths: newRampMonths,
    note: `${profile.note}${tierLabel} (opens at ${newStartOcc}% occ, ${newRampMonths}-mo ramp)`,
  };
}

// ─── Bedhampton live-data fallback ────────────────────────────────────────────
// When existingClinicRevenueGbp = 0 (not entered / accidentally cleared), use
// the live 3-month Bedhampton average so calculations are never silently zeroed.
// Returns an object with the resolved revenue + a flag indicating whether live
// data was used so callers can include a warning in the response.

async function resolveBedhamptonRevenue(
  model: any,
): Promise<{ revenue: number; fromLive: boolean; avg3m: number }> {
  const stored = model.existingClinicRevenueGbp || 0;
  if (stored > 0) return { revenue: stored, fromLive: false, avg3m: 0 };

  try {
    const { recentMonths } = await fetchBedhamptonLive();
    const last3 = recentMonths.slice(-3);
    const avg3m = last3.length > 0
      ? Math.round(last3.reduce((s, m) => s + m.revenue, 0) / last3.length)
      : 0;
    return { revenue: avg3m, fromLive: true, avg3m };
  } catch {
    return { revenue: 0, fromLive: false, avg3m: 0 };
  }
}

// ─── Property rent/rates fallback ─────────────────────────────────────────────

async function applyPropertyFallback(model: any, projectId: number) {
  const [activeProperty] = await db.select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
  if (activeProperty) {
    // Always derive property-specific fields from the active property record —
    // these must always reflect the currently selected property.
    if (activeProperty.monthlyRentGbp != null) model.rentGbp = activeProperty.monthlyRentGbp;
    if (activeProperty.businessRatesGbp != null) model.ratesGbp = Math.round(activeProperty.businessRatesGbp / 12);
    model.vatOnRent = activeProperty.vatOnRent ?? false;
  }
  return model;
}

// ─── Lifestyle schedule derivation ────────────────────────────────────────────
// Derives working_days_per_month and practitioner_hours_per_day from lifestyle_plan.
// Returns null if no lifestyle plan exists or values cannot be computed.
async function deriveLifestyleSchedule(projectId: number): Promise<{ workingDaysPerMonth: number; practitionerHoursPerDay: number } | null> {
  try {
    const [plan] = await db.select().from(lifestylePlanTable).where(eq(lifestylePlanTable.projectId, projectId));
    if (!plan) return null;
    const clinicDays: string[] = (() => {
      try {
        const v = plan.clinicDays;
        return typeof v === "string" ? JSON.parse(v) : (Array.isArray(v) ? v : []);
      } catch { return []; }
    })();
    const openTime = plan.clinicOpenTime ?? "09:00";
    const closeTime = plan.clinicCloseTime ?? "18:00";
    const [oh, om] = openTime.split(":").map(Number);
    const [ch, cm] = closeTime.split(":").map(Number);
    const totalHours = (ch + cm / 60) - (oh + om / 60) - 0.5; // subtract 0.5hr lunch
    if (clinicDays.length === 0 || totalHours <= 0) return null;
    return {
      workingDaysPerMonth: Math.round(clinicDays.length * 4.33),
      practitionerHoursPerDay: Math.round(totalHours * 10) / 10,
    };
  } catch { return null; }
}

// ─── Treatment mix parser ─────────────────────────────────────────────────────
// Parses plannedPricingJson as an array of treatment mix entries.
// Returns null if empty or not a valid array — caller falls back to ACV model.
interface TreatmentEntry { treatmentName: string; durationMins: number; revenueGbp: number; mixPercent: number; }

function parseTreatmentMix(json: string): TreatmentEntry[] | null {
  try {
    const data = JSON.parse(json || "{}");
    if (!Array.isArray(data) || data.length === 0) return null;
    const valid = data.filter((e: any) => e.durationMins > 0 && e.revenueGbp > 0 && e.mixPercent > 0);
    return valid.length > 0 ? valid : null;
  } catch { return null; }
}

// Applies treatment mix to the model object so calcWinchester uses the correct revenue formula.
// Sets model.wincAcvGbp = effective ACV per appointment and model._slotsPerMonthOverride = effective slot count.
// Returns the treatment mix metrics for inclusion in the response, or null if no valid mix.
function applyTreatmentMix(model: any): {
  rpm: number; avgDurationMins: number; availableProductiveMinutes: number;
  revenuePerProductiveHour: number; throughputCeiling: number;
} | null {
  const mix = parseTreatmentMix(model.plannedPricingJson ?? "{}");
  if (!mix) return null;

  const rpm = mix.reduce((sum, e) => sum + (e.revenueGbp / e.durationMins) * (e.mixPercent / 100), 0);
  const avgDurationMins = mix.reduce((sum, e) => sum + e.durationMins * (e.mixPercent / 100), 0);
  if (rpm <= 0 || avgDurationMins <= 0) return null;

  const workingDaysPerMonth: number = model.workingDaysPerMonth;
  const practitionerHoursPerDay: number = model.practitionerHoursPerDay;
  const treatmentRoomsCount: number = model.treatmentRoomsCount ?? 1;

  const raw = workingDaysPerMonth * practitionerHoursPerDay * 60 * treatmentRoomsCount;
  const nonBillable = workingDaysPerMonth * 45; // 30min lunch + 15min buffer per day
  const appointmentsPerDay = (practitionerHoursPerDay * 60 - 45) / avgDurationMins;
  const changeoverDrag = appointmentsPerDay * 10; // 10min reset per appointment
  const availableProductiveMinutes = raw - nonBillable - (workingDaysPerMonth * changeoverDrag);

  if (availableProductiveMinutes <= 0) return null;

  // Override model so calcWincAtOccupancy/_calcWinchester produces correct revenue
  // revenue = availableProductiveMinutes × occ% × rpm
  //         = (apm / avgDuration) × occ% × (rpm × avgDuration)   ← equivalent
  model.wincAcvGbp = rpm * avgDurationMins;            // effective revenue per appointment
  model._slotsPerMonthOverride = availableProductiveMinutes / avgDurationMins; // effective slot count

  return {
    rpm: Math.round(rpm * 100) / 100,
    avgDurationMins: Math.round(avgDurationMins * 10) / 10,
    availableProductiveMinutes: Math.round(availableProductiveMinutes),
    revenuePerProductiveHour: Math.round(rpm * 60 * 100) / 100,
    throughputCeiling: Math.round(availableProductiveMinutes * rpm * 100) / 100,
  };
}

// ─── GET /projects/:id/financial ─────────────────────────────────────────────

router.get("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });
  model = await applyPropertyFallback(model as any, projectId);
  return res.json(model);
});

// ─── PUT /projects/:id/financial ─────────────────────────────────────────────

router.put("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = req.body;
  const [existing] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let model;
  if (existing) {
    [model] = await db.update(financialsTable).set({ ...body, updatedAt: new Date() }).where(eq(financialsTable.projectId, projectId)).returning();
  } else {
    [model] = await db.insert(financialsTable).values({ ...body, projectId }).returning();
  }

  // Sync property-specific fields back to the active property record so GET
  // /financial always reads consistent values from the property source of truth.
  try {
    const [activeProperty] = await db.select().from(propertiesTable)
      .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
    if (activeProperty) {
      const propUpdates: Record<string, any> = { updatedAt: new Date() };
      if (typeof body.rentGbp === "number")   propUpdates.monthlyRentGbp = body.rentGbp;
      if (typeof body.ratesGbp === "number")  propUpdates.businessRatesGbp = body.ratesGbp * 12;
      if (typeof body.vatOnRent === "boolean") propUpdates.vatOnRent = body.vatOnRent;
      await db.update(propertiesTable).set(propUpdates).where(eq(propertiesTable.id, activeProperty.id));
    }
  } catch { /* non-fatal */ }

  res.json(model);
});

// ─── PATCH /projects/:id/financial/scenario ──────────────────────────────────
// Lightweight endpoint — only persists the selected scenario key.
router.patch("/projects/:projectId/financial/scenario", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { scenario } = req.body as { scenario: string };
  const valid = ["conservative", "realistic", "aggressive", "delayed_ramp", "economic_downturn", "stress_test"];
  if (!valid.includes(scenario)) return res.status(400).json({ error: "Invalid scenario" });
  const [existing] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!existing) return res.status(404).json({ error: "No financial model found" });
  await db.update(financialsTable).set({ selectedScenario: scenario, updatedAt: new Date() }).where(eq(financialsTable.projectId, projectId));
  return res.json({ selectedScenario: scenario });
});

// ─── POST /projects/:id/financial/calculate ──────────────────────────────────

router.post("/projects/:projectId/financial/calculate", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { scenario = "realistic" } = req.body;
  const reqVatRate = typeof req.body.vatRate === "number" ? req.body.vatRate : 0.20;

  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });
  model = await applyPropertyFallback(model as any, projectId);

  // Bedhampton revenue ALWAYS comes from the manually entered model assumption.
  // Live ANS data is displayed as reference only — never used in calculations.

  // Issue 1: Derive working_days_per_month and practitioner_hours_per_day from lifestyle_plan.
  // Falls back to stored financial_models values if no lifestyle plan exists.
  const lifestyleSchedule = await deriveLifestyleSchedule(projectId);
  if (lifestyleSchedule) {
    (model as any).workingDaysPerMonth = lifestyleSchedule.workingDaysPerMonth;
    (model as any).practitionerHoursPerDay = lifestyleSchedule.practitionerHoursPerDay;
  }

  // Load dynamic fixed cost items — these replace the hardcoded fixed cost fields
  // if any exist. If none exist yet, fall back to legacy hardcoded fields.
  const fixedCostItems = await db
    .select()
    .from(fixedCostItemsTable)
    .where(and(eq(fixedCostItemsTable.projectId, projectId), eq(fixedCostItemsTable.active, true)));

  // All fixed cost items go into Winchester's fixed cost base.
  // Dual items count once — they don't get added to Bedhampton separately.
  const fixedItemsTotal = fixedCostItems.reduce((sum, item) => sum + (item.amountGbp || 0), 0);
  // Winchester break-even / net-profit uses PREMISES + OVERHEAD fixed costs only.
  // Additional clinicians (e.g. the 2nd Winchester clinician) are deliberately NOT folded
  // in here: this block models a single room's revenue, so charging a second clinician's
  // salary against it — with none of her revenue — would understate the position and inflate
  // break-even. The 2nd clinician's full cost AND revenue are modelled from her start date
  // in the /cashflow projection, which is the true multi-room forward view.
  const dynamicFixedCosts = fixedCostItems.length > 0
    ? fixedItemsTotal
    : undefined; // undefined = fall back to legacy hardcoded fields

  // Issue 2: Apply treatment mix if plannedPricingJson contains valid entries.
  // Overrides model.wincAcvGbp and model._slotsPerMonthOverride for the revenue formula.
  // Falls back to existing ACV model if mix is empty or invalid.
  const treatmentMixMetrics = applyTreatmentMix(model as any);

  const rampTier = (req.body.rampTier as string) ?? "average";
  const profile = applyRampTier(SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic, rampTier);
  const targetOcc = profile.getTargetOcc(model);
  const acvMultiplier = profile.acvMultiplier;
  const nursingIncome = 0;

  // Determine VAT rate for Winchester calculations
  // VAT is a business-level obligation (£90k rolling threshold across all clinics).
  // If the business is already close enough that Winchester will open after registration,
  // include VAT in all Winchester projections and break-even figures.
  const vatCurrentTurnover = (model as any).vatCurrentTurnoverGbp ?? 75000;
  const bedhMonthlyRev = (model.existingClinicRevenueGbp || 0) + ((model as any).bedhMembershipRevenueGbp || 0);
  // Project 12 months of Bedhampton forward — will they cross the threshold?
  const vatWillApplyAtOpening = vatCurrentTurnover >= 90000 ||
    (vatCurrentTurnover + bedhMonthlyRev * 12 >= 90000);
  const vatRateForCalc = vatWillApplyAtOpening ? reqVatRate : 0;

  const winc = calcWinchester(model, targetOcc, acvMultiplier, vatRateForCalc, dynamicFixedCosts);
  const bedh = calcBedhampton(model);
  const selfFundingMonth = findSelfFundingMonth(model, targetOcc, acvMultiplier, profile, dynamicFixedCosts);
  const combined = calcCombined(winc, bedh, model as any, selfFundingMonth);
  // Pass dynamicFixedCosts so minimumCashRequired/recommendedCash use the same cost base
  // as all other Winchester calculations — not the legacy hardcoded field sum.
  const owner = calcOwner(winc, bedh, model as any, nursingIncome, dynamicFixedCosts);

  // ── Free-rent period metrics ──────────────────────────────────────────────
  // Identify the rent line item from dynamic items (name contains "rent" or "lease")
  // or fall back to model.rentGbp from the active property.
  const rentLineAmount = fixedCostItems.length > 0
    ? fixedCostItems.filter(item => /rent|lease/i.test(item.name)).reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : (model.rentGbp || 0);
  const freeRentMonthsVal = (model as any).freeRentMonths ?? 0;
  // During free-rent months only rates (not rent) apply to Winchester fixed costs
  const freeRentFixedCostsVal = dynamicFixedCosts !== undefined
    ? Math.max(0, dynamicFixedCosts - rentLineAmount)
    : Math.max(0, (model.rentGbp || 0) + (model.ratesGbp || 0) - rentLineAmount);
  const wincFreeRent = freeRentMonthsVal > 0
    ? calcWinchester(model, targetOcc, acvMultiplier, vatRateForCalc, freeRentFixedCostsVal)
    : null;

  // Legacy: months until Winchester itself breaks even (with VAT applied)
  let monthsUntilProfitable: number | null = null;
  if (winc.netProfit < 0) {
    for (let m = 1; m <= 24; m++) {
      const occ = Math.min(profile.startOcc + (m * (targetOcc - profile.startOcc) / profile.rampMonths), targetOcc);
      const sim = calcWincAtOccupancy(model, occ, acvMultiplier, vatRateForCalc);
      if (sim.netProfit >= 0) { monthsUntilProfitable = m; break; }
    }
  } else {
    monthsUntilProfitable = 0;
  }

  // Issue 3: 12-month cashflow array with ramp curve applied.
  // Month 1 = first full trading month (opening month).
  // Ramp formula: occ = startOcc + (targetOcc - startOcc) × (month / rampMonths) if month ≤ rampMonths, else targetOcc
  let cumulative = 0;
  const cashflowMonths = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const occ = month <= profile.rampMonths
      ? profile.startOcc + (targetOcc - profile.startOcc) * (month / profile.rampMonths)
      : targetOcc;
    const occRounded = Math.round(occ * 10) / 10;
    const sim = calcWincAtOccupancy(model, occRounded, acvMultiplier, vatRateForCalc, dynamicFixedCosts);
    const revenue = Math.round(sim.grossRevenue);
    const fixedCosts = Math.round(sim.fixedCosts);
    const variableCosts = Math.round(sim.variableCosts + sim.vatLiability);
    const netCashflow = Math.round(sim.netProfit);
    cumulative += netCashflow;
    // impliedAppointmentsPerMonth: only meaningful when treatment mix is active
    const impliedAppointments = treatmentMixMetrics
      ? Math.round((treatmentMixMetrics.availableProductiveMinutes / treatmentMixMetrics.avgDurationMins) * (occRounded / 100))
      : null;
    return { month, occupancyPercent: occRounded, revenue, fixedCosts, variableCosts, netCashflow, cumulative: Math.round(cumulative), impliedAppointmentsPerMonth: impliedAppointments };
  });

  // Issue 2: treatment mix response fields (null when falling back to ACV model)
  const treatmentMixResponse = treatmentMixMetrics ? {
    revenuePerProductiveHour: treatmentMixMetrics.revenuePerProductiveHour,
    availableProductiveMinutes: treatmentMixMetrics.availableProductiveMinutes,
    throughputCeiling: treatmentMixMetrics.throughputCeiling,
    avgAppointmentDurationMins: treatmentMixMetrics.avgDurationMins,
    revenuePerMinute: treatmentMixMetrics.rpm,
    impliedAppointmentsPerMonth: Math.round((treatmentMixMetrics.availableProductiveMinutes / treatmentMixMetrics.avgDurationMins) * (targetOcc / 100)),
  } : null;

  return res.json({
    scenario,
    scenarioNote: profile.note,
    winc,
    bedh,
    combined,
    owner,
    freeRentMonths: freeRentMonthsVal,
    rentLineAmount: Math.round(rentLineAmount),
    wincFreeRent,
    cashflowMonths,
    treatmentMix: treatmentMixResponse,
    lifestyleScheduleApplied: lifestyleSchedule !== null,
    // Legacy backward-compat fields (dashboard uses these)
    monthlyRevenue: winc.grossRevenue,
    annualRevenue: combined.annualRevenue,
    monthlyFixedCosts: winc.fixedCosts,
    monthlyVariableCosts: winc.variableCosts,
    monthlyTotalCosts: winc.totalCosts,
    monthlyNetProfit: combined.preSelfFundingMonthlyNet,
    annualNetProfit: combined.annualNetProfit, // steady-state run-rate (target occupancy × 12), NOT year 1
    firstYearNetProfit: cashflowMonths.length ? cashflowMonths[cashflowMonths.length - 1].cumulative : 0, // ramped first 12 months
    ebitda: combined.ebitda,
    cashRunwayMonths: owner.cashRunwayMonths,
    breakEvenRevenueGbp: winc.breakEvenRevenue,
    breakEvenOccupancyPercent: winc.breakEvenOccupancy,
    minimumViableRevenueGbp: Math.round(winc.fixedCosts * 1.1),
    safeOperatingThresholdGbp: Math.round(winc.fixedCosts * 1.25),
    occupancyUsedPercent: targetOcc,
    monthsUntilProfitable,
  });
});

// ─── GET /projects/:id/cashflow ──────────────────────────────────────────────

router.get("/projects/:projectId/cashflow", async (req, res) => {
  // Adapter over the Money page cash model (lib/cash-model). The old engine here
  // started in June with 32,500, charged plan costs by task date, spread undated
  // costs, capped Bedhampton against Winchester, and applied VAT thresholds and
  // offsets. All of that is gone: this returns the same field names the Today,
  // Export and Money widgets read, filled from the new model.
  try {
    const projectId = parseInt(req.params.projectId);
    const months = Math.min(Math.max(parseInt((req.query.months as string) || "12"), 12), 36);
    const m = await buildCashModel(projectId, { scenario: req.query.scenario as string | undefined, months });
    const rows = m.rows;
    const openIdx = rows.findIndex(r => r.winc.gross > 0);
    const lastBedh = rows.reduce((k, r, i) => (r.bedh.gross > 0 ? i : k), -1);
    const closeIdx = lastBedh >= 0 && lastBedh < rows.length - 1 ? lastBedh + 1 : -1;
    const selfIdx = rows.findIndex((r, i) => r.winc.gross > 0 && r.wincOwnProfit >= 0 && rows[i + 1] && rows[i + 1].wincOwnProfit >= 0);
    const cap = m.config.pay.capMonthly;
    const R = (v: number) => Math.round(v);
    res.json(rows.map((r, i) => {
      const [mon, yy] = r.label.split(" ");
      const lbl = `${mon} '${yy}`;
      const wincCosts = r.winc.gross - r.wincOwnProfit;
      return {
        month: i + 1, calendarLabel: lbl, monthLabel: lbl,
        isPreOpening: openIdx < 0 || i < openIdx, isOpeningMonth: i === openIdx,
        isBedhamptonCloseMonth: i === closeIdx, bedhClosed: closeIdx >= 0 && i >= closeIdx,
        projectCostBurn: R(r.projectBank), preOpenPropertyCost: 0, preOpenRentWaived: 0, bedhFreeRentRates: 0,
        taskLabels: r.why.projectBank && r.projectBank ? [r.why.projectBank] : [],
        vatLiability: R(r.total.vat), vatInputReclaim: 0, netVatPosition: R(r.total.vat), isVatRegistered: true,
        actualDrawings: R(r.paySalary), targetDrawings: R(cap), drawingsShortfall: R(Math.max(0, cap - r.paySalary)), drawingsActive: r.payGate,
        wincRevenue: R(r.winc.gross), wincVariableCosts: R(r.winc.product), wincFixedCosts: R(wincCosts - r.winc.vat - r.winc.product),
        wincVat: R(r.winc.vat), wincCosts: R(wincCosts), wincNet: R(r.wincOwnProfit),
        additionalClinicianRevenue: 0, additionalClinicianSalary: 0,
        bedhRevenue: R(r.bedh.gross), bedhDualCosts: 0, bedhCosts: R(r.bedh.gross - r.bedhOwnProfit), bedhVat: R(r.bedh.vat), bedhNet: R(r.bedhOwnProfit),
        monthlyCashflow: R(r.net), cashBalance: R(r.closingBank), occupancyPercent: 0,
        isSelfFundingMonth: i === selfIdx, bedhSupport: R(Math.max(r.bedhOwnProfit, 0)), combinedNet: R(r.operatingProfit),
        loanRepayments: R(r.loanRepayment), loanInflow: R(r.fundingIn),
        cardOwed: R(r.cardOwed), loanOwed: R(r.loanOwed), belowFloor: r.belowFloor,
      };
    }));
  } catch (err) {
    console.error("[cashflow]", err);
    res.status(500).json({ error: "Cashflow failed" });
  }
});

// ─── POST /projects/:id/financial/sync-bedhampton ───────────────────────────
// Fetches live Bedhampton data and writes the 3-month average revenue,
// rolling 8-month VAT turnover, and live gross margin into the model.
// Safe to call at any time — only updates the three Bedhampton-derived fields.

router.post("/projects/:projectId/financial/sync-bedhampton", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  try {
    const { summary, recentMonths } = await fetchBedhamptonLive();

    // 3-month average revenue (last 3 completed months)
    const last3 = recentMonths.slice(-3);
    const avg3m = last3.length > 0
      ? Math.round(last3.reduce((s, m) => s + m.revenue, 0) / last3.length)
      : 0;

    // Rolling total revenue from all available completed months (conservative VAT position)
    const rollingTotal = recentMonths.reduce((s, m) => s + m.revenue, 0);

    // Live gross margin → derive variable cost % (stock + consumables)
    const impliedVariablePct = Math.round((100 - summary.avgGrossMarginPct) * 10) / 10;

    const [existing] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
    if (!existing) return res.status(404).json({ error: "No financial model found" });

    const [updated] = await db.update(financialsTable)
      .set({
        existingClinicRevenueGbp: avg3m,
        vatCurrentTurnoverGbp: Math.round(rollingTotal),
        bedhStockPercent: Math.round(impliedVariablePct),
        updatedAt: new Date(),
      } as any)
      .where(eq(financialsTable.projectId, projectId))
      .returning();

    return res.json({
      ok: true,
      avg3m,
      rollingTotal: Math.round(rollingTotal),
      impliedVariablePct,
      avgGrossMarginPct: summary.avgGrossMarginPct,
      recentMonths: recentMonths.length,
      model: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return res.status(502).json({ error: msg });
  }
});

// ─── DELETE /projects/:id/financial ──────────────────────────────────────────

router.delete("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  await db.delete(financialsTable).where(eq(financialsTable.projectId, projectId));
  res.status(204).send();
});

export default router;
