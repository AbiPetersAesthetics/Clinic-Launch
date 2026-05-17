import { Router } from "express";
import { db } from "@workspace/db";
import { financialsTable, propertiesTable, projectsTable, phasesTable, tasksTable, fixedCostItemsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  calcWincAtOccupancy,
  calcWinchester,
  calcBedhampton,
  findSelfFundingMonth,
  calcCombined,
  calcOwner,
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

  // If existingClinicRevenueGbp is 0 (not set / accidentally cleared),
  // use the live 3-month Bedhampton average so calculations are never silently zeroed.
  const bedhResolved = await resolveBedhamptonRevenue(model);
  if (bedhResolved.fromLive && bedhResolved.revenue > 0) {
    (model as any).existingClinicRevenueGbp = bedhResolved.revenue;
  }

  // Load dynamic fixed cost items — these replace the hardcoded fixed cost fields
  // if any exist. If none exist yet, fall back to legacy hardcoded fields.
  const fixedCostItems = await db
    .select()
    .from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId));

  // All fixed cost items go into Winchester's fixed cost base.
  // Dual items count once — they don't get added to Bedhampton separately.
  const dynamicFixedCosts = fixedCostItems.length > 0
    ? fixedCostItems.reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : undefined; // undefined = fall back to legacy hardcoded fields

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
  const bedhMonthlyRev = model.existingClinicRevenueGbp || 0;
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
    // Legacy backward-compat fields (dashboard uses these)
    monthlyRevenue: winc.grossRevenue,
    annualRevenue: combined.annualRevenue,
    monthlyFixedCosts: winc.fixedCosts,
    monthlyVariableCosts: winc.variableCosts,
    monthlyTotalCosts: winc.totalCosts,
    monthlyNetProfit: combined.preSelfFundingMonthlyNet,
    annualNetProfit: combined.annualNetProfit,
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
  const projectId = parseInt(req.params.projectId);
  const scenario = (req.query.scenario as string) ?? "realistic";
  const rampTier = (req.query.rampTier as string) ?? "average";
  const vatRateParam = parseFloat((req.query.vatRate as string) ?? "0.20");
  const VAT_RATE_EFFECTIVE = isNaN(vatRateParam) ? 0.20 : Math.min(Math.max(vatRateParam, 0.05), 0.20);

  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });
  model = await applyPropertyFallback(model as any, projectId);

  // If existingClinicRevenueGbp is 0 (not set / accidentally cleared),
  // use the live 3-month Bedhampton average so the cashflow is never silently zeroed.
  const bedhResolved = await resolveBedhamptonRevenue(model);
  if (bedhResolved.fromLive && bedhResolved.revenue > 0) {
    (model as any).existingClinicRevenueGbp = bedhResolved.revenue;
  }

  // Fetch project for start + open dates
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  // Fetch tasks (with due dates) to build a month-by-month cost map
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const phaseIds = phases.map((p) => p.id);
  const allTasks = phaseIds.length > 0
    ? await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phaseIds))
    : [];

  // Load dynamic fixed cost items
  const fixedCostItems = await db
    .select()
    .from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId));

  // months param: cashflow window (12–36 months). Chart uses 12, P&L table uses up to 36.
  const reqMonths = parseInt((req.query.months as string) || "12");
  const TOTAL_MONTHS_CF = Math.min(Math.max(reqMonths, 12), 36);

  const profile = applyRampTier(SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic, rampTier);
  const targetOcc = profile.getTargetOcc(model);
  const acvMultiplier = profile.acvMultiplier;
  const { startOcc, rampMonths } = profile;

  const acv = (model.wincAcvGbp || model.averageClientValueGbp) * acvMultiplier;
  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;

  // Use dynamic fixed cost items if any exist; fall back to legacy hardcoded fields
  const wincFixedCosts = fixedCostItems.length > 0
    ? fixedCostItems.reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : (model.rentGbp || 0) + (model.ratesGbp || 0) + (model.utilitiesGbp || 0) +
      (model.internetGbp || 0) + (model.insuranceGbp || 0) + (model.accountantGbp || 0) +
      (model.softwareGbp || 0) + (model.wasteContractGbp || 0) + (model.cleanerGbp || 0) +
      (model.subscriptionsGbp || 0) + (model.financeRepaymentsGbp || 0);

  // Free-rent period: identify rent component and compute reduced fixed costs
  const cfRentAmount = fixedCostItems.length > 0
    ? fixedCostItems.filter(item => /rent|lease/i.test(item.name)).reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : (model.rentGbp || 0);
  const cfFreeRentMonths = (model as any).freeRentMonths ?? 0;
  const wincFixedCostsNoRent = Math.max(0, wincFixedCosts - cfRentAmount);

  // Dual cost items — shared across both clinics, already counted ONCE in Winchester's fixed costs.
  // During pre-opening months Bedhampton bears them (Winchester is not yet open / paying).
  const dualFixedCosts = fixedCostItems
    .filter(item => item.costType === "dual")
    .reduce((sum, item) => sum + (item.amountGbp || 0), 0);

  const variableRatio = ((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100;
  const fixedVariableItems = (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);

  const bedhMonthlyRevenue = model.existingClinicRevenueGbp || 0;
  const bedhStockPct = ((model as any).bedhStockPercent ?? 35) / 100;
  const bedhProductCosts = bedhMonthlyRevenue * bedhStockPct;
  // Bedhampton running costs: location-specific only (rent, marketing, other catch-all).
  // Dual shared costs are handled separately — deducted from Bedh during pre-opening only.
  const bedhRunningCosts =
    ((model as any).bedhRentGbp || 0) +
    ((model as any).bedhMarketingGbp || 0) +
    ((model as any).bedhamptonCostsGbp || 0);
  const bedhBaseCosts = bedhProductCosts + bedhRunningCosts;

  // Bedhampton capacity ceiling: as Winchester fills slots, Bedhampton revenue tapers
  const bedhCapacityCeil = (model as any).bedhCapacityCeilGbp ?? 16000;

  // Pre-opening property costs: rent + rates apply from lease signing, before Winchester opens
  // IMPORTANT: use cfRentAmount (from fixedCostItems) not model.rentGbp — the active property
  // may have rentGbp=0 which applyPropertyFallback overwrites the model field with.
  const preOpenPropMonths = (model as any).preOpeningPropertyMonths ?? 2;
  const cfRatesAmount = fixedCostItems.length > 0
    ? fixedCostItems.filter(item => /rates/i.test(item.name)).reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : (model.ratesGbp || 0);
  const monthlyRent = cfRentAmount;   // rent from fixedCostItems (e.g. "Rent / Lease")
  const monthlyRates = cfRatesAmount; // rates from fixedCostItems (e.g. "Business Rates")

  const bufferPctCf = ((model as any).selfFundingBufferPercent ?? 20) / 100;
  const startingCash = model.runwaySavingsGbp || 0;
  const targetDrawings = model.ownerDrawingsGbp || model.targetDrawingsGbp || 0;

  // VAT — UK statutory threshold £90,000/year across the whole business (all clinics)
  // Start tracking from the user's current rolling 12-month turnover position
  const VAT_THRESHOLD = 90000;
  const VAT_RATE = VAT_RATE_EFFECTIVE;
  // How much of the £90k has already been used up by prior revenue
  const vatStartingTurnover = (model as any).vatCurrentTurnoverGbp ?? 75000;
  let vatCumulativeTurnover = vatStartingTurnover; // tracks rolling business revenue
  let vatRegistered = false; // flips true once threshold is crossed

  // Determine calendar anchor — always start from the earlier of project startDate or today
  const today = new Date();
  const rawStart = project?.startDate ? new Date(project.startDate) : today;
  const effectiveStart = rawStart < today ? rawStart : today;
  const calendarStart = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);

  // Opening month index (0-based offset from calendarStart)
  let openingMonthIndex = TOTAL_MONTHS_CF;
  if (project?.targetOpeningDate) {
    const openDate = new Date(project.targetOpeningDate);
    const diff = (openDate.getFullYear() - calendarStart.getFullYear()) * 12
      + (openDate.getMonth() - calendarStart.getMonth());
    openingMonthIndex = Math.max(0, Math.min(diff, TOTAL_MONTHS_CF));
  }

  // ── Build month-by-month project cost map from task due dates ──────────────
  const monthCostMap: number[] = Array(TOTAL_MONTHS_CF).fill(0);
  const monthTaskLabels: string[][] = Array.from({ length: TOTAL_MONTHS_CF }, () => []);
  let undatedTaskCost = 0;

  for (const task of allTasks) {
    const cost = task.selectedCost || 0;
    if (!cost) continue;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const idx = (due.getFullYear() - calendarStart.getFullYear()) * 12
        + (due.getMonth() - calendarStart.getMonth());
      const clampedIdx = idx < 0 ? 0 : idx >= TOTAL_MONTHS_CF ? Math.max(0, openingMonthIndex - 1) : idx;
      monthCostMap[clampedIdx] += cost;
      monthTaskLabels[clampedIdx].push(task.title);
    } else {
      undatedTaskCost += cost;
    }
  }

  // Spread undated costs across pre-opening months (ramp-weighted toward opening)
  if (undatedTaskCost > 0 && openingMonthIndex > 0) {
    const rawW = Array.from({ length: openingMonthIndex }, (_, i) => i + 1);
    const wSum = rawW.reduce((s, w) => s + w, 0);
    rawW.forEach((w, i) => { monthCostMap[i] += (w / wSum) * undatedTaskCost; });
  }

  // Lease signing index: rent + rates apply this many months before opening
  const propStartIndex = Math.max(0, openingMonthIndex - preOpenPropMonths);

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let cashBalance = startingCash;
  let selfFundingMonthIndex: number | null = null;

  const cashflow = Array.from({ length: TOTAL_MONTHS_CF }, (_, i) => {
    const monthDate = new Date(calendarStart.getFullYear(), calendarStart.getMonth() + i, 1);
    const calendarLabel = `${MONTH_NAMES[monthDate.getMonth()]} '${String(monthDate.getFullYear()).slice(2)}`;

    const isPreOpening = i < openingMonthIndex;
    const isOpeningMonth = i === openingMonthIndex;

    // Project spend this month — tied to actual task due dates
    const projectCostBurn = monthCostMap[i] ?? 0;
    const taskLabelsThisMonth = monthTaskLabels[i] ?? [];

    // ── Winchester first (Bedhampton capacity is capped against Winchester revenue) ──
    let wincRevenue = 0;
    let wincCosts = 0;
    let wincNet = 0;
    let occupancyPercent = 0;
    let effectiveFixed = 0; // hoisted so display uses same value as net calculation

    if (!isPreOpening) {
      const wincMonth = i - openingMonthIndex; // 0-based months since opening
      occupancyPercent = Math.round(Math.min(startOcc + (wincMonth * (targetOcc - startOcc) / rampMonths), targetOcc) * 10) / 10;
      const bookedSlots = slotsPerMonth * (occupancyPercent / 100);
      wincRevenue = bookedSlots * acv + (model.membershipRevenueGbp || 0);
      const variableCosts = wincRevenue * variableRatio + fixedVariableItems;
      // Free rent is a pre-opening (lease period) benefit — post-opening always pays full fixed costs
      effectiveFixed = wincFixedCosts;
      wincCosts = effectiveFixed + variableCosts;
    }

    // ── Bedhampton: closed flag, capacity cap, dual costs ─────────────────────
    const bedhClosed = selfFundingMonthIndex !== null && i >= selfFundingMonthIndex;

    // Capacity ceiling: as Winchester fills Abi's slots, Bedhampton revenue tapers
    const bedhRevenueUncapped = bedhClosed ? 0 : bedhMonthlyRevenue;
    const bedhRevenue = bedhClosed ? 0
      : Math.max(0, Math.min(bedhRevenueUncapped, Math.max(0, bedhCapacityCeil - wincRevenue)));

    // Dual costs: borne by Bedhampton during pre-opening (Winchester not yet paying them).
    // After opening, dual costs are already in wincFixedCosts — don't double-count.
    const bedhDualCosts = isPreOpening ? dualFixedCosts : 0;
    const bedhCosts = bedhClosed ? 0 : bedhBaseCosts + bedhDualCosts;

    // Pre-opening property costs: rent + rates from lease signing date.
    // Free rent runs from day 1 of the lease (pre-opening), NOT from opening day.
    // e.g. freeRentMonths=2 → Sep & Oct pay rates only; Nov (opening) pays full rent.
    const isInLeasePeriod = isPreOpening && i >= propStartIndex;
    const leaseMonthIndex = i - propStartIndex; // 0 = first month of lease
    const preOpenIsFreeRent = isInLeasePeriod && cfFreeRentMonths > 0 && leaseMonthIndex < cfFreeRentMonths;
    const preOpenPropertyCost = isInLeasePeriod
      ? (preOpenIsFreeRent ? monthlyRates : monthlyRent + monthlyRates)
      : 0;
    const preOpenRentWaived = preOpenIsFreeRent ? monthlyRent : 0;

    // VAT — tracked across the whole business (Bedhampton + Winchester combined)
    const monthTotalRevenue = bedhRevenue + wincRevenue;
    if (!vatRegistered) {
      vatCumulativeTurnover += monthTotalRevenue;
      if (vatCumulativeTurnover >= VAT_THRESHOLD) vatRegistered = true;
    }
    const isVatRegistered = vatRegistered;
    const vatLiability = isVatRegistered ? monthTotalRevenue * VAT_RATE : 0;
    const bedhVat = (bedhRevenue > 0 && isVatRegistered) ? bedhRevenue * VAT_RATE : 0;
    const wincVat = (wincRevenue > 0 && isVatRegistered) ? wincRevenue * VAT_RATE : 0;

    const bedhNet = bedhRevenue - bedhCosts - bedhVat;

    const wincVariableCosts = !isPreOpening ? wincRevenue * variableRatio + fixedVariableItems : 0;
    // Use effectiveFixed (not wincFixedCosts) so displayed fixed = what actually goes into wincNet
    const wincFixedCostsMonth = !isPreOpening ? effectiveFixed : 0;
    wincCosts += wincVat;
    wincNet = wincRevenue - wincCosts;

    // Self-funding check after VAT applied
    if (!isPreOpening && selfFundingMonthIndex === null && wincRevenue > 0 && wincNet >= wincRevenue * bufferPctCf) {
      selfFundingMonthIndex = i;
    }

    const isSelfFundingMonth = selfFundingMonthIndex === i;
    const isBedhamptonCloseMonth = isSelfFundingMonth;

    // Dynamic drawings:
    // - Before self-funding: no drawings from the business (Bedhampton income sustains Abi personally)
    // - After self-funding: Abi takes up to her desired income from the available surplus
    // - Any surplus above drawings accrues as business capital
    const drawingsActive = selfFundingMonthIndex !== null && i >= selfFundingMonthIndex;
    // Pre-opening property cost (rent + rates from lease signing) included in gross surplus drain
    const grossSurplus = wincNet + bedhNet - projectCostBurn - preOpenPropertyCost;
    const actualDrawings = drawingsActive ? Math.min(Math.max(0, grossSurplus), targetDrawings) : 0;
    const drawingsShortfall = Math.max(0, targetDrawings - actualDrawings);

    const monthlyCashflow = grossSurplus - actualDrawings;
    cashBalance += monthlyCashflow;

    return {
      month: i + 1,
      calendarLabel,
      monthLabel: calendarLabel,
      isPreOpening,
      isOpeningMonth,
      isBedhamptonCloseMonth,
      projectCostBurn: Math.round(projectCostBurn),
      preOpenPropertyCost: Math.round(preOpenPropertyCost),
      preOpenRentWaived: Math.round(preOpenRentWaived),
      taskLabels: taskLabelsThisMonth,
      vatLiability: Math.round(vatLiability),
      isVatRegistered,
      actualDrawings: Math.round(actualDrawings),
      targetDrawings: Math.round(targetDrawings),
      drawingsShortfall: Math.round(drawingsShortfall),
      drawingsActive,
      wincRevenue: Math.round(wincRevenue),
      wincVariableCosts: Math.round(wincVariableCosts),
      wincFixedCosts: Math.round(wincFixedCostsMonth),
      wincVat: Math.round(wincVat),
      wincCosts: Math.round(wincCosts),
      wincNet: Math.round(wincNet),
      bedhRevenue: Math.round(bedhRevenue),
      bedhDualCosts: Math.round(bedhDualCosts),
      bedhCosts: Math.round(bedhCosts),
      bedhNet: Math.round(bedhNet),
      monthlyCashflow: Math.round(monthlyCashflow),
      cashBalance: Math.round(cashBalance),
      occupancyPercent,
      isSelfFundingMonth,
      bedhClosed,
      bedhSupport: Math.round(Math.max(bedhNet, 0)),
      combinedNet: Math.round(wincNet + bedhNet),
    };
  });

  return res.json(cashflow);
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
