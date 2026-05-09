import { Router } from "express";
import { db } from "@workspace/db";
import { financialsTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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
    acvMultiplier: 1,
    startOcc: 20,
    rampMonths: 8,
    nursingMultiplier: 1,
    note: "Conservative occupancy, steady 8-month ramp",
  },
  realistic: {
    getTargetOcc: (m) => m.realisticOccupancyPercent,
    acvMultiplier: 1,
    startOcc: 25,
    rampMonths: 6,
    nursingMultiplier: 1,
    note: "Realistic occupancy, standard 6-month ramp",
  },
  aggressive: {
    getTargetOcc: (m) => m.aggressiveOccupancyPercent,
    acvMultiplier: 1,
    startOcc: 35,
    rampMonths: 4,
    nursingMultiplier: 1,
    note: "High occupancy, fast 4-month ramp — strong marketing required",
  },
  delayed_ramp: {
    getTargetOcc: (m) => m.realisticOccupancyPercent,
    acvMultiplier: 1,
    startOcc: 15,
    rampMonths: 12,
    nursingMultiplier: 1,
    note: "Realistic target but 12-month ramp — marketing underperforms at launch",
  },
  economic_downturn: {
    getTargetOcc: (m) => m.conservativeOccupancyPercent * 0.8,
    acvMultiplier: 0.85,
    startOcc: 15,
    rampMonths: 9,
    nursingMultiplier: 1,
    note: "Economic pressure: lower consumer demand, −15% average spend",
  },
  abi_leaves_nursing: {
    getTargetOcc: (m) => m.realisticOccupancyPercent,
    acvMultiplier: 1,
    startOcc: 25,
    rampMonths: 6,
    nursingMultiplier: 0,
    note: "Full nursing exit — clinic must cover all personal income from Day 1",
  },
  stress_test: {
    getTargetOcc: (m) => Math.max(m.conservativeOccupancyPercent * 0.65, 12),
    acvMultiplier: 0.9,
    startOcc: 5,
    rampMonths: 10,
    nursingMultiplier: 1,
    note: "Worst case: 5% opening occupancy, very slow ramp, lower average spend",
  },
};

// ─── Helper: Winchester monthly metrics at a given occupancy ─────────────────

function calcWincAtOccupancy(model: any, occupancy: number, acvMultiplier: number) {
  const acv = (model.wincAcvGbp || model.averageClientValueGbp) * acvMultiplier;
  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;
  const bookedSlots = slotsPerMonth * (occupancy / 100);
  const grossRevenue = bookedSlots * acv + (model.membershipRevenueGbp || 0);
  const migratedRevenue = grossRevenue * ((model.cannibalPercent || 15) / 100);

  const fixedCosts =
    (model.rentGbp || 0) + (model.ratesGbp || 0) + (model.utilitiesGbp || 0) +
    (model.internetGbp || 0) + (model.insuranceGbp || 0) + (model.accountantGbp || 0) +
    (model.softwareGbp || 0) + (model.wasteContractGbp || 0) + (model.cleanerGbp || 0) +
    (model.subscriptionsGbp || 0) + (model.financeRepaymentsGbp || 0);

  const variableCosts =
    grossRevenue * (((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100) +
    (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);

  const totalCosts = fixedCosts + variableCosts;
  const netProfit = grossRevenue - totalCosts;
  const grossMarginPercent = grossRevenue > 0 ? ((grossRevenue - variableCosts) / grossRevenue) * 100 : 0;

  return { acv, slotsPerMonth, grossRevenue, migratedRevenue, fixedCosts, variableCosts, totalCosts, netProfit, grossMarginPercent };
}

// ─── Helper: Full Winchester projection ──────────────────────────────────────

function calcWinchester(model: any, targetOcc: number, acvMultiplier: number) {
  const base = calcWincAtOccupancy(model, targetOcc, acvMultiplier);
  const { acv, slotsPerMonth, grossRevenue, migratedRevenue, fixedCosts, variableCosts, totalCosts, netProfit, grossMarginPercent } = base;

  const variableCostRatio = ((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100;
  const breakEvenRevenue = variableCostRatio < 1 ? fixedCosts / (1 - variableCostRatio) : fixedCosts * 3;
  const breakEvenSlots = breakEvenRevenue / Math.max(acv, 1);
  const breakEvenOccupancy = slotsPerMonth > 0 ? (breakEvenSlots / slotsPerMonth) * 100 : 0;
  const treatmentsPerWeek = breakEvenSlots / Math.max((model.workingDaysPerMonth || 22) / 4.33, 1);

  const warnings: string[] = [];
  if (targetOcc > 75) warnings.push("Projected occupancy exceeds typical first-year premium clinic ramp (>75%).");
  if ((acv * acvMultiplier) > 250) warnings.push("Average client value may be optimistic for Year 1 Winchester.");
  if ((model.cannibalPercent || 15) < 5) warnings.push("Revenue cannibalisation below 5% may underestimate Bedhampton patient migration.");
  if (breakEvenOccupancy > targetOcc * 0.8) warnings.push("Break-even occupancy is very close to target — little margin for underperformance.");

  return {
    grossRevenue: Math.round(grossRevenue),
    migratedRevenue: Math.round(migratedRevenue),
    newRevenue: Math.round(grossRevenue - migratedRevenue),
    fixedCosts: Math.round(fixedCosts),
    variableCosts: Math.round(variableCosts),
    totalCosts: Math.round(totalCosts),
    netProfit: Math.round(netProfit),
    grossMarginPercent: Math.round(grossMarginPercent),
    occupancyUsed: targetOcc,
    breakEvenRevenue: Math.round(breakEvenRevenue),
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    treatmentsPerWeekToBreakeven: Math.round(treatmentsPerWeek * 10) / 10,
    slotsPerMonth,
    warnings,
  };
}

// ─── Helper: Bedhampton projection ───────────────────────────────────────────

function calcBedhampton(model: any, wincMigratedRevenue: number) {
  const grossRevenue = model.existingClinicRevenueGbp || 0;
  const retainedRevenue = Math.max(grossRevenue - wincMigratedRevenue, 0);
  const costs = model.bedhamptonCostsGbp || 3500;

  return {
    grossRevenue: Math.round(grossRevenue),
    migratedRevenue: Math.round(wincMigratedRevenue),
    retainedRevenue: Math.round(retainedRevenue),
    costs: Math.round(costs),
    grossNetProfit: Math.round(grossRevenue - costs),
    retainedNetProfit: Math.round(retainedRevenue - costs),
    migratedPercent: grossRevenue > 0 ? Math.round((wincMigratedRevenue / grossRevenue) * 100) : 0,
  };
}

// ─── Helper: Combined business ───────────────────────────────────────────────

function calcCombined(winc: any, bedh: any, model: any) {
  const monthlyRevenue = winc.grossRevenue + bedh.retainedRevenue;
  const monthlyCosts = winc.totalCosts + bedh.costs;
  const monthlyNetProfit = monthlyRevenue - monthlyCosts;
  const annualRevenue = monthlyRevenue * 12;
  const annualNetProfit = monthlyNetProfit * 12;
  const vatThreshold = 90000;

  const annualVatableRevenue = annualRevenue;
  const monthsUntilVat = annualVatableRevenue >= vatThreshold ? 0 :
    monthlyRevenue > 0 ? Math.ceil((vatThreshold - annualVatableRevenue) / (monthlyRevenue)) : 99;

  return {
    monthlyRevenue: Math.round(monthlyRevenue),
    monthlyCosts: Math.round(monthlyCosts),
    monthlyNetProfit: Math.round(monthlyNetProfit),
    annualRevenue: Math.round(annualRevenue),
    annualNetProfit: Math.round(annualNetProfit),
    vatThreshold,
    monthsUntilVatRegistration: Math.min(monthsUntilVat, 99),
    vatRegistrationWarning: annualVatableRevenue > vatThreshold * 0.75,
    ebitda: Math.round(annualNetProfit + (model.financeRepaymentsGbp || 0) * 12),
  };
}

// ─── Helper: Owner survivability ─────────────────────────────────────────────

function calcOwner(combined: any, model: any, nursingIncome: number) {
  const clinicExtractable = combined.monthlyNetProfit;
  const totalAvailable = clinicExtractable + nursingIncome;
  const target = model.targetDrawingsGbp || model.personalSalaryNeedsGbp || 4000;
  const shortfall = Math.max(target - totalAvailable, 0);
  const isSafe = totalAvailable >= target;

  const fixedCosts =
    (model.rentGbp || 0) + (model.ratesGbp || 0) + (model.utilitiesGbp || 0) +
    (model.internetGbp || 0) + (model.insuranceGbp || 0) + (model.accountantGbp || 0) +
    (model.softwareGbp || 0) + (model.wasteContractGbp || 0) + (model.cleanerGbp || 0) +
    (model.subscriptionsGbp || 0) + (model.financeRepaymentsGbp || 0);

  const minimumCashRequired = fixedCosts * 3 + 20000;
  const recommendedCash = fixedCosts * 4 + 30000;

  const monthlyCashDrain = Math.max(target - totalAvailable, 0);
  const cashRunway = monthlyCashDrain > 0
    ? Math.min((model.runwaySavingsGbp || 0) / monthlyCashDrain, 99)
    : 99;

  return {
    nursingIncome: Math.round(nursingIncome),
    clinicExtractable: Math.round(clinicExtractable),
    totalAvailableIncome: Math.round(totalAvailable),
    targetDrawings: Math.round(target),
    monthlyShortfall: Math.round(shortfall),
    isSafeToLeaveNursing: isSafe,
    cashRunwayMonths: Math.round(cashRunway),
    minimumCashRequired: Math.round(minimumCashRequired),
    recommendedCash: Math.round(recommendedCash),
    runwaySavings: model.runwaySavingsGbp || 0,
  };
}

// ─── GET /projects/:id/financial ─────────────────────────────────────────────

router.get("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });

  if (model.rentGbp === 0 || model.ratesGbp === 0) {
    const [activeProperty] = await db.select()
      .from(propertiesTable)
      .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
    if (activeProperty) {
      const fallbackRent = model.rentGbp === 0 && activeProperty.monthlyRentGbp ? activeProperty.monthlyRentGbp : model.rentGbp;
      const fallbackRates = model.ratesGbp === 0 && activeProperty.businessRatesGbp ? Math.round(activeProperty.businessRatesGbp / 12) : model.ratesGbp;
      return res.json({ ...model, rentGbp: fallbackRent, ratesGbp: fallbackRates });
    }
  }
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
  res.json(model);
});

// ─── POST /projects/:id/financial/calculate ──────────────────────────────────

router.post("/projects/:projectId/financial/calculate", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { scenario = "realistic" } = req.body;

  let [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });

  if (model.rentGbp === 0 || model.ratesGbp === 0) {
    const [activeProperty] = await db.select()
      .from(propertiesTable)
      .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
    if (activeProperty) {
      if (model.rentGbp === 0 && activeProperty.monthlyRentGbp) (model as any).rentGbp = activeProperty.monthlyRentGbp;
      if (model.ratesGbp === 0 && activeProperty.businessRatesGbp) (model as any).ratesGbp = Math.round(activeProperty.businessRatesGbp / 12);
    }
  }

  const profile = SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic;
  const targetOcc = profile.getTargetOcc(model);
  const acvMultiplier = profile.acvMultiplier;
  const nursingIncome = (model.nursingIncomeGbp || 4500) * profile.nursingMultiplier;

  const winc = calcWinchester(model, targetOcc, acvMultiplier);
  const bedh = calcBedhampton(model, winc.migratedRevenue);
  const combined = calcCombined(winc, bedh, model);
  const owner = calcOwner(combined, model, nursingIncome);

  const slotsPerMonth = winc.slotsPerMonth;
  const startOcc = profile.startOcc;
  const rampMonths = profile.rampMonths;

  let monthsUntilProfitable: number | null = null;
  if (winc.netProfit < 0) {
    for (let m = 1; m <= 24; m++) {
      const occ = Math.min(startOcc + (m * (targetOcc - startOcc) / rampMonths), targetOcc);
      const sim = calcWincAtOccupancy(model, occ, acvMultiplier);
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
    // Legacy backward-compat fields
    monthlyRevenue: winc.grossRevenue,
    annualRevenue: combined.annualRevenue,
    monthlyFixedCosts: winc.fixedCosts,
    monthlyVariableCosts: winc.variableCosts,
    monthlyTotalCosts: winc.totalCosts,
    monthlyNetProfit: combined.monthlyNetProfit,
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

  if (model.rentGbp === 0 || model.ratesGbp === 0) {
    const [activeProperty] = await db.select()
      .from(propertiesTable)
      .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
    if (activeProperty) {
      if (model.rentGbp === 0 && activeProperty.monthlyRentGbp) (model as any).rentGbp = activeProperty.monthlyRentGbp;
      if (model.ratesGbp === 0 && activeProperty.businessRatesGbp) (model as any).ratesGbp = Math.round(activeProperty.businessRatesGbp / 12);
    }
  }

  const profile = SCENARIO_PROFILES[scenario] ?? SCENARIO_PROFILES.realistic;
  const targetOcc = profile.getTargetOcc(model);
  const acvMultiplier = profile.acvMultiplier;
  const startOcc = profile.startOcc;
  const rampMonths = profile.rampMonths;

  const acv = (model.wincAcvGbp || model.averageClientValueGbp) * acvMultiplier;
  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;
  const fixedCosts =
    (model.rentGbp || 0) + (model.ratesGbp || 0) + (model.utilitiesGbp || 0) +
    (model.internetGbp || 0) + (model.insuranceGbp || 0) + (model.accountantGbp || 0) +
    (model.softwareGbp || 0) + (model.wasteContractGbp || 0) + (model.cleanerGbp || 0) +
    (model.subscriptionsGbp || 0) + (model.financeRepaymentsGbp || 0);

  const bedhMonthlyRevenue = model.existingClinicRevenueGbp || 0;
  const bedhMonthlyCosts = model.bedhamptonCostsGbp || 3500;
  const cannibal = (model.cannibalPercent || 15) / 100;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let wincCumulative = 0;
  let combinedCumulative = 0;
  let hasReachedBreakeven = false;
  let hasCombinedBreakeven = false;

  const cashflow = Array.from({ length: 12 }, (_, i) => {
    const occupancy = Math.min(startOcc + (i * (targetOcc - startOcc) / rampMonths), targetOcc);
    const bookedSlots = slotsPerMonth * (occupancy / 100);
    const wincRevenue = bookedSlots * acv + (model.membershipRevenueGbp || 0);
    const variableCosts =
      wincRevenue * (((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100) +
      (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);
    const wincTotalCosts = fixedCosts + variableCosts;
    const wincNet = wincRevenue - wincTotalCosts;
    wincCumulative += wincNet;

    const migratedFromBedh = wincRevenue * cannibal;
    const bedhRetained = Math.max(bedhMonthlyRevenue - migratedFromBedh, 0);
    const bedhNet = bedhRetained - bedhMonthlyCosts;

    const combinedRevenue = wincRevenue + bedhRetained;
    const combinedCosts = wincTotalCosts + bedhMonthlyCosts;
    const combinedNet = combinedRevenue - combinedCosts;
    combinedCumulative += combinedNet;

    const isBreakevenMonth = !hasReachedBreakeven && wincNet >= 0;
    if (isBreakevenMonth) hasReachedBreakeven = true;
    const isCombinedBreakevenMonth = !hasCombinedBreakeven && combinedNet >= 0;
    if (isCombinedBreakevenMonth) hasCombinedBreakeven = true;

    return {
      month: i + 1,
      monthLabel: months[i],
      revenue: Math.round(wincRevenue),
      fixedCosts: Math.round(fixedCosts),
      variableCosts: Math.round(variableCosts),
      netCashflow: Math.round(wincNet),
      cumulativeCashflow: Math.round(wincCumulative),
      isBreakevenMonth,
      occupancyPercent: Math.round(occupancy * 10) / 10,
      wincRevenue: Math.round(wincRevenue),
      wincCosts: Math.round(wincTotalCosts),
      wincNet: Math.round(wincNet),
      bedhRevenue: Math.round(bedhRetained),
      bedhCosts: Math.round(bedhMonthlyCosts),
      bedhNet: Math.round(bedhNet),
      combinedRevenue: Math.round(combinedRevenue),
      combinedCosts: Math.round(combinedCosts),
      combinedNet: Math.round(combinedNet),
      combinedCumulative: Math.round(combinedCumulative),
      isCombinedBreakevenMonth,
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
