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
    getTargetOcc: (m) => m.conservativeOccupancyPercent,
    acvMultiplier: 1, startOcc: 20, rampMonths: 8, nursingMultiplier: 1,
    note: "Conservative occupancy, steady 8-month ramp",
  },
  realistic: {
    getTargetOcc: (m) => m.realisticOccupancyPercent,
    acvMultiplier: 1, startOcc: 25, rampMonths: 6, nursingMultiplier: 1,
    note: "Realistic occupancy, standard 6-month ramp",
  },
  aggressive: {
    getTargetOcc: (m) => m.aggressiveOccupancyPercent,
    acvMultiplier: 1, startOcc: 35, rampMonths: 4, nursingMultiplier: 1,
    note: "High occupancy, fast 4-month ramp — strong marketing required",
  },
  delayed_ramp: {
    getTargetOcc: (m) => m.realisticOccupancyPercent,
    acvMultiplier: 1, startOcc: 15, rampMonths: 12, nursingMultiplier: 1,
    note: "Realistic target but 12-month ramp — marketing underperforms at launch",
  },
  economic_downturn: {
    getTargetOcc: (m) => m.conservativeOccupancyPercent * 0.8,
    acvMultiplier: 0.85, startOcc: 15, rampMonths: 9, nursingMultiplier: 1,
    note: "Economic pressure: lower consumer demand, −15% average spend",
  },
  stress_test: {
    getTargetOcc: (m) => Math.max(m.conservativeOccupancyPercent * 0.65, 12),
    acvMultiplier: 0.9, startOcc: 5, rampMonths: 10, nursingMultiplier: 1,
    note: "Worst case: 5% opening occupancy, very slow ramp, lower average spend",
  },
};

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

  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });
  model = await applyPropertyFallback(model as any, projectId);

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

  const profile = SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic;
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
  const vatRateForCalc = vatWillApplyAtOpening ? 0.20 : 0;

  const winc = calcWinchester(model, targetOcc, acvMultiplier, vatRateForCalc, dynamicFixedCosts);
  const bedh = calcBedhampton(model);
  const selfFundingMonth = findSelfFundingMonth(model, targetOcc, acvMultiplier, profile, dynamicFixedCosts);
  const combined = calcCombined(winc, bedh, model as any, selfFundingMonth);
  // Pass dynamicFixedCosts so minimumCashRequired/recommendedCash use the same cost base
  // as all other Winchester calculations — not the legacy hardcoded field sum.
  const owner = calcOwner(winc, bedh, model as any, nursingIncome, dynamicFixedCosts);

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

  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });
  model = await applyPropertyFallback(model as any, projectId);

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

  const profile = SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic;
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

  // Dual cost items are shared — they already count in Winchester's fixed costs above.
  // Bedhampton only carries location-specific costs (rent, marketing, other catch-all).
  // This eliminates the double-counting bug where software/insurance appeared in both clinics.
  const variableRatio = ((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100;
  const fixedVariableItems = (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);

  const bedhMonthlyRevenue = model.existingClinicRevenueGbp || 0;
  const bedhStockPct = ((model as any).bedhStockPercent ?? 35) / 100;
  const bedhProductCosts = bedhMonthlyRevenue * bedhStockPct;
  // Bedhampton running costs: location-specific only.
  // Shared costs (software, insurance, staffing) are now entered as "dual" fixed cost items
  // on Winchester and count once — they do NOT appear here to avoid double-counting.
  const bedhRunningCosts =
    ((model as any).bedhRentGbp || 0) +
    ((model as any).bedhMarketingGbp || 0) +
    ((model as any).bedhamptonCostsGbp || 0);
  const bedhMonthlyCosts = bedhProductCosts + bedhRunningCosts;
  const bufferPctCf = ((model as any).selfFundingBufferPercent ?? 20) / 100;
  const startingCash = model.runwaySavingsGbp || 0;
  const targetDrawings = model.ownerDrawingsGbp || model.targetDrawingsGbp || 0;

  // VAT — UK statutory threshold £90,000/year across the whole business (all clinics)
  // Start tracking from the user's current rolling 12-month turnover position
  const VAT_THRESHOLD = 90000;
  const VAT_RATE = 0.20;
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
  const TOTAL_MONTHS = 18;
  let openingMonthIndex = TOTAL_MONTHS;
  if (project?.targetOpeningDate) {
    const openDate = new Date(project.targetOpeningDate);
    const diff = (openDate.getFullYear() - calendarStart.getFullYear()) * 12
      + (openDate.getMonth() - calendarStart.getMonth());
    openingMonthIndex = Math.max(0, Math.min(diff, TOTAL_MONTHS));
  }

  // ── Build month-by-month project cost map from task due dates ──────────────
  // Tasks WITH a dueDate → cost lands in that calendar month.
  // Tasks WITHOUT a dueDate → spread across pre-opening months with a ramp
  // (undated tasks weighted toward the later months, where fit-out spend is heaviest).
  const monthCostMap: number[] = Array(TOTAL_MONTHS).fill(0);
  const monthTaskLabels: string[][] = Array.from({ length: TOTAL_MONTHS }, () => []);
  let undatedTaskCost = 0;

  for (const task of allTasks) {
    const cost = task.selectedCost || 0;
    if (!cost) continue;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const idx = (due.getFullYear() - calendarStart.getFullYear()) * 12
        + (due.getMonth() - calendarStart.getMonth());
      // Clamp past tasks to month 0, future-beyond-window tasks to last pre-opening month
      const clampedIdx = idx < 0 ? 0 : idx >= TOTAL_MONTHS ? Math.max(0, openingMonthIndex - 1) : idx;
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

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let cashBalance = startingCash;
  let selfFundingMonthIndex: number | null = null;

  const cashflow = Array.from({ length: TOTAL_MONTHS }, (_, i) => {
    const monthDate = new Date(calendarStart.getFullYear(), calendarStart.getMonth() + i, 1);
    const calendarLabel = `${MONTH_NAMES[monthDate.getMonth()]} '${String(monthDate.getFullYear()).slice(2)}`;

    const isPreOpening = i < openingMonthIndex;
    const isOpeningMonth = i === openingMonthIndex;

    // Project spend this month — tied to actual task due dates
    const projectCostBurn = monthCostMap[i] ?? 0;
    const taskLabelsThisMonth = monthTaskLabels[i] ?? [];

    // Bedhampton closes when Winchester becomes self-funding
    const bedhClosed = selfFundingMonthIndex !== null && i >= selfFundingMonthIndex;
    const bedhRevenueGross = bedhClosed ? 0 : bedhMonthlyRevenue;
    const bedhCosts = bedhClosed ? 0 : bedhMonthlyCosts;

    // Winchester: zero before opening, ramps from opening month
    let wincRevenue = 0;
    let wincCosts = 0;
    let wincNet = 0;
    let occupancyPercent = 0;

    if (!isPreOpening) {
      const wincMonth = i - openingMonthIndex;
      occupancyPercent = Math.round(Math.min(startOcc + (wincMonth * (targetOcc - startOcc) / rampMonths), targetOcc) * 10) / 10;
      const bookedSlots = slotsPerMonth * (occupancyPercent / 100);
      wincRevenue = bookedSlots * acv + (model.membershipRevenueGbp || 0);
      const variableCosts = wincRevenue * variableRatio + fixedVariableItems;
      wincCosts = wincFixedCosts + variableCosts;
    }

    // VAT — tracked across the whole business (Bedhampton + Winchester combined)
    // Cumulative turnover rolls forward each month; once it hits £90k the business must register.
    // VAT liability applies to ALL revenue from registration month onwards.
    const monthTotalRevenue = bedhRevenueGross + wincRevenue;
    if (!vatRegistered) {
      vatCumulativeTurnover += monthTotalRevenue;
      if (vatCumulativeTurnover >= VAT_THRESHOLD) vatRegistered = true;
    }
    const isVatRegistered = vatRegistered;
    // VAT is a liability on ALL turnover once registered — treated as a cost (conservative: prices not raised)
    const vatLiability = isVatRegistered ? monthTotalRevenue * VAT_RATE : 0;
    // Apply VAT proportionally across Bedhampton and Winchester costs
    const bedhVat = (bedhRevenueGross > 0 && isVatRegistered) ? bedhRevenueGross * VAT_RATE : 0;
    const wincVat = (wincRevenue > 0 && isVatRegistered) ? wincRevenue * VAT_RATE : 0;

    const bedhRevenue = bedhRevenueGross;
    const bedhNet = bedhRevenue - bedhCosts - bedhVat;

    const wincVariableCosts = !isPreOpening ? wincRevenue * variableRatio + fixedVariableItems : 0;
    const wincFixedCostsMonth = !isPreOpening ? wincFixedCosts : 0;
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
    const grossSurplus = wincNet + bedhNet - projectCostBurn;
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

// ─── DELETE /projects/:id/financial ──────────────────────────────────────────

router.delete("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  await db.delete(financialsTable).where(eq(financialsTable.projectId, projectId));
  res.status(204).send();
});

export default router;
