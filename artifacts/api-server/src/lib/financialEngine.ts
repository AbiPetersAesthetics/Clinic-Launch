// ─── Shared Financial Engine ──────────────────────────────────────────────────
// Single source of truth for all financial calculations across api-server routes.
// All routes computing revenue, costs, break-even, VAT or cashflow MUST use
// these functions — never inline their own versions.
//
// Assumptions documented here:
// - VAT threshold: £90,000 rolling 12-month across ALL clinic entities
// - VAT rate: 20% on gross revenue once registered (conservative: prices not raised)
// - Break-even: (fixedCosts + fixedVarItems) / (1 − variableRatio − vatRate)
//   where fixedVarItems = marketing + staffing + consumables
// - Self-funding: Winchester netProfit ≥ selfFundingBufferPercent% of gross revenue
// - Bedhampton closes when Winchester hits self-funding target
// - Solo practitioner: revenue capacity = 1 practitioner across N rooms, not N × capacity

export const VAT_THRESHOLD = 90000;
export const VAT_RATE = 0.20;

// ─── Legacy fixed cost fallback ───────────────────────────────────────────────
// Sums the hardcoded individual fields from financialsTable.
// Use ONLY when no dynamic fixed_cost_items exist for this project.
export function calcLegacyFixed(model: any): number {
  return (
    (model.rentGbp || 0) + (model.ratesGbp || 0) + (model.utilitiesGbp || 0) +
    (model.internetGbp || 0) + (model.insuranceGbp || 0) + (model.accountantGbp || 0) +
    (model.softwareGbp || 0) + (model.wasteContractGbp || 0) + (model.cleanerGbp || 0) +
    (model.subscriptionsGbp || 0) + (model.financeRepaymentsGbp || 0)
  );
}

// ─── Winchester metrics at given occupancy ────────────────────────────────────
// injectedFixedCosts: sum of dynamic fixed_cost_items rows (preferred).
//   If undefined, falls back to calcLegacyFixed(model).
export function calcWincAtOccupancy(
  model: any,
  occupancy: number,
  acvMultiplier: number,
  vatRate = 0,
  injectedFixedCosts?: number,
) {
  // Always prefer wincAcvGbp (Winchester-specific ACV) over legacy averageClientValueGbp
  const acv = (model.wincAcvGbp || model.averageClientValueGbp) * acvMultiplier;
  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;
  const bookedSlots = slotsPerMonth * (occupancy / 100);
  const grossRevenue = bookedSlots * acv + (model.membershipRevenueGbp || 0);

  const fixedCosts = injectedFixedCosts !== undefined ? injectedFixedCosts : calcLegacyFixed(model);

  // Variable costs: stock + commissions as % of revenue, plus fixed-amount variable items
  const variableCosts =
    grossRevenue * (((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100) +
    (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);

  // VAT is a business-level liability on gross revenue
  const vatLiability = grossRevenue * vatRate;
  const totalCosts = fixedCosts + variableCosts + vatLiability;
  const netProfit = grossRevenue - totalCosts;
  const grossMarginPercent = grossRevenue > 0 ? ((grossRevenue - variableCosts) / grossRevenue) * 100 : 0;

  return { acv, slotsPerMonth, grossRevenue, fixedCosts, variableCosts, vatLiability, totalCosts, netProfit, grossMarginPercent };
}

// ─── Full Winchester projection at target occupancy ───────────────────────────
export function calcWinchester(
  model: any,
  targetOcc: number,
  acvMultiplier: number,
  vatRate = 0,
  injectedFixedCosts?: number,
) {
  const base = calcWincAtOccupancy(model, targetOcc, acvMultiplier, vatRate, injectedFixedCosts);
  const { acv, slotsPerMonth, grossRevenue, fixedCosts, variableCosts, vatLiability, totalCosts, netProfit, grossMarginPercent } = base;

  const variableRatio = ((model.stockPercent || 0) + (model.commissionsPercent || 0)) / 100;
  // fixedVarItems = marketing + staffing + consumables (fixed monthly amounts, not % of revenue)
  const fixedVarItems = (model.marketingGbp || 0) + (model.staffingGbp || 0) + (model.consumablesGbp || 0);

  // Break-even: revenue at which netProfit = 0
  // Derivation: revenue × (1 − variableRatio − vatRate) = fixedCosts + fixedVarItems
  // Therefore: breakEvenRevenue = (fixedCosts + fixedVarItems) / (1 − variableRatio − vatRate)
  const effectiveMargin = 1 - variableRatio - vatRate;
  const breakEvenRevenue = effectiveMargin > 0.001
    ? (fixedCosts + fixedVarItems) / effectiveMargin
    : (fixedCosts + fixedVarItems) * 3; // fallback if margin near-zero
  const breakEvenSlots = (breakEvenRevenue - (model.membershipRevenueGbp || 0)) / Math.max(acv, 1);
  const breakEvenOccupancy = slotsPerMonth > 0 ? (breakEvenSlots / slotsPerMonth) * 100 : 0;
  const treatmentsPerWeek = breakEvenSlots / Math.max((model.workingDaysPerMonth || 22) / 4.33, 1);

  // Self-funding: netProfit ≥ bufferPct × grossRevenue
  // Derivation: revenue × (1 − variableRatio − vatRate − bufferPct) = fixedCosts + fixedVarItems
  const bufferPct = (model.selfFundingBufferPercent ?? 20) / 100;
  const sfDenominator = 1 - variableRatio - vatRate - bufferPct;
  const sfRevenueTarget = sfDenominator > 0.001
    ? (fixedCosts + fixedVarItems) / sfDenominator
    : Infinity;
  const sfNetProfitTarget = isFinite(sfRevenueTarget) ? Math.round(sfRevenueTarget * bufferPct) : 9999999;
  const sfSlots = isFinite(sfRevenueTarget)
    ? ((sfRevenueTarget - (model.membershipRevenueGbp || 0)) / Math.max(acv, 1))
    : 9999;
  const selfFundingOccupancy = slotsPerMonth > 0 ? (sfSlots / slotsPerMonth) * 100 : 0;

  const warnings: string[] = [];
  if (targetOcc > 75) warnings.push("Projected occupancy exceeds typical first-year premium clinic ramp (>75%).");
  if (selfFundingOccupancy > targetOcc) warnings.push(
    `Self-funding target (${model.selfFundingBufferPercent ?? 20}% net margin) requires ${Math.round(selfFundingOccupancy)}% occupancy — above this scenario's target. Bedhampton may not close within 12 months.`
  );
  if (breakEvenOccupancy > targetOcc * 0.8) warnings.push("Break-even occupancy is close to target — little margin for underperformance.");
  // Solo practitioner warning: if rooms > 1, capacity is inflated
  if ((model.treatmentRoomsCount || 1) > 1) {
    warnings.push(
      `Revenue capacity assumes ${model.treatmentRoomsCount} treatment rooms simultaneously. As a solo practitioner, only 1 room can be used at a time — set Treatment Rooms to 1 unless you plan to hire additional clinicians.`
    );
  }

  return {
    grossRevenue: Math.round(grossRevenue),
    fixedCosts: Math.round(fixedCosts),
    variableCosts: Math.round(variableCosts),
    vatLiability: Math.round(vatLiability),
    vatApplied: vatRate > 0,
    totalCosts: Math.round(totalCosts),
    netProfit: Math.round(netProfit),
    grossMarginPercent: Math.round(grossMarginPercent),
    occupancyUsed: targetOcc,
    breakEvenRevenue: Math.round(breakEvenRevenue),
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    treatmentsPerWeekToBreakeven: Math.round(treatmentsPerWeek * 10) / 10,
    selfFundingOccupancy: Math.round(selfFundingOccupancy * 10) / 10,
    sfNetProfitTarget,
    sfRevenueTarget: isFinite(sfRevenueTarget) ? Math.round(sfRevenueTarget) : 0,
    selfFundingBufferPercent: model.selfFundingBufferPercent ?? 20,
    slotsPerMonth,
    warnings,
  };
}

// ─── Bedhampton — temporary support clinic ────────────────────────────────────
// Running costs: location-specific only (bedhRentGbp, bedhMarketingGbp, bedhamptonCostsGbp).
// Shared costs (software, insurance, staffing) should be entered as "dual" fixed cost items
// on Winchester and counted once — they must NOT appear here.
export function calcBedhampton(model: any) {
  const grossRevenue = model.existingClinicRevenueGbp || 0;
  const stockPct = (model.bedhStockPercent ?? 35) / 100;
  const productCosts = grossRevenue * stockPct;
  const runningCosts =
    (model.bedhRentGbp || 0) +
    (model.bedhMarketingGbp || 0) +
    (model.bedhamptonCostsGbp || 0);
  // Legacy fields (bedhSoftwareGbp, bedhStaffingGbp, bedhInsuranceGbp) are no longer
  // user-editable — they default to 0. Shared costs go in Winchester's dual fixed items.
  const costs = productCosts + runningCosts;
  const netProfit = grossRevenue - costs;
  return {
    grossRevenue: Math.round(grossRevenue),
    productCosts: Math.round(productCosts),
    runningCosts: Math.round(runningCosts),
    costs: Math.round(costs),
    netProfit: Math.round(netProfit),
  };
}

// ─── Find the month Winchester hits the self-funding target ──────────────────
// Returns 1-based month number (Month 1 = first operating month after opening).
// Uses 0-indexed month internally to align with cashflow endpoint's ramp formula.
export function findSelfFundingMonth(
  model: any,
  targetOcc: number,
  acvMultiplier: number,
  profile: { startOcc: number; rampMonths: number },
  injectedFixedCosts?: number,
): number | null {
  const bufferPct = (model.selfFundingBufferPercent ?? 20) / 100;
  const { startOcc, rampMonths } = profile;
  for (let m = 1; m <= 24; m++) {
    const occ = Math.min(startOcc + ((m - 1) * (targetOcc - startOcc) / rampMonths), targetOcc);
    const sim = calcWincAtOccupancy(model, occ, acvMultiplier, 0, injectedFixedCosts);
    if (sim.grossRevenue > 0 && sim.netProfit >= sim.grossRevenue * bufferPct) return m;
  }
  return null;
}

// ─── Combined business (support phase model) ──────────────────────────────────
export function calcCombined(winc: any, bedh: any, model: any, selfFundingMonth: number | null) {
  const selfFundingTarget = winc.sfNetProfitTarget ?? (model.wincSelfFundingTargetGbp || 12000);
  const preSelfFundingMonthlyNet = winc.netProfit + bedh.netProfit;
  const postSelfFundingMonthlyNet = winc.netProfit;

  const annualRevenue = winc.grossRevenue * 12; // Winchester at steady state
  const annualNetProfit = winc.netProfit * 12;

  // VAT threshold is a BUSINESS-WIDE rolling 12-month obligation across ALL clinics.
  // vatCurrentTurnoverGbp = current rolling revenue from all existing clinics.
  // monthsUntilVat = how many months of Winchester revenue until the combined total
  // crosses £90k. Correct formula: (threshold - currentTurnover) / monthlyWincRevenue.
  const vatCurrentTurnover = (model.vatCurrentTurnoverGbp ?? 0);
  const combinedAnnualTurnover = vatCurrentTurnover + annualRevenue;

  let monthsUntilVat: number;
  if (vatCurrentTurnover >= VAT_THRESHOLD) {
    // Already registered before Winchester opens
    monthsUntilVat = 0;
  } else if (combinedAnnualTurnover >= VAT_THRESHOLD && winc.grossRevenue > 0) {
    // Winchester revenue will push them over — calculate how many months
    monthsUntilVat = Math.ceil((VAT_THRESHOLD - vatCurrentTurnover) / winc.grossRevenue);
  } else {
    // Won't hit threshold even at steady state
    monthsUntilVat = 99;
  }

  return {
    selfFundingTargetGbp: selfFundingTarget,
    selfFundingMonth,
    preSelfFundingMonthlyNet: Math.round(preSelfFundingMonthlyNet),
    postSelfFundingMonthlyNet: Math.round(postSelfFundingMonthlyNet),
    bedhamptonMonthlySupport: Math.round(bedh.netProfit),
    totalBedhamptonSupport: selfFundingMonth !== null ? Math.round(bedh.netProfit * selfFundingMonth) : null,
    monthlyRevenue: Math.round(winc.grossRevenue + bedh.grossRevenue),
    monthlyCosts: Math.round(winc.totalCosts + bedh.costs),
    monthlyNetProfit: Math.round(preSelfFundingMonthlyNet),
    annualRevenue: Math.round(annualRevenue),
    annualNetProfit: Math.round(annualNetProfit),
    vatThreshold: VAT_THRESHOLD,
    monthsUntilVatRegistration: Math.min(monthsUntilVat, 99),
    vatRegistrationWarning: combinedAnnualTurnover > VAT_THRESHOLD * 0.75,
    ebitda: Math.round(annualNetProfit + (model.financeRepaymentsGbp || 0) * 12),
    // Combined annual for VAT tracker (existing turnover + Winchester annual)
    combinedAnnualRevenue: Math.round(combinedAnnualTurnover),
    vatCurrentTurnover: Math.round(vatCurrentTurnover),
  };
}

// ─── Owner survivability (three phases) ───────────────────────────────────────
// injectedFixedCosts: use the same dynamic fixed costs value used in calcWinchester,
//   so minimumCashRequired and recommendedCash are consistent.
export function calcOwner(
  winc: any,
  bedh: any,
  model: any,
  nursingIncome: number,
  injectedFixedCosts?: number,
) {
  const target = model.targetDrawingsGbp || model.personalSalaryNeedsGbp || 4000;

  // Phase 1: Winchester ramping + Bedhampton still open + nursing
  const phase1Income = winc.netProfit + bedh.netProfit + nursingIncome;
  const phase1IsSafe = phase1Income >= target;

  // Phase 2: Bedhampton closed — Winchester + nursing
  const phase2Income = winc.netProfit + nursingIncome;
  const phase2IsSafe = phase2Income >= target;

  // Phase 3: Nursing exited — Winchester alone
  const phase3Income = winc.netProfit;
  const phase3IsSafe = phase3Income >= target;

  // Use injected fixed costs (dynamic items) if available; else legacy fields
  const fixedCosts = injectedFixedCosts !== undefined ? injectedFixedCosts : calcLegacyFixed(model);

  // Minimum cash: 3 months of fixed costs + £20k operating buffer
  const minimumCashRequired = fixedCosts * 3 + 20000;
  const recommendedCash = fixedCosts * 4 + 30000;

  // Cash runway: if Phase 1 income < target drawings, savings get depleted
  const monthlyCashDrain = Math.max(target - phase1Income, 0);
  const cashRunway = monthlyCashDrain > 0
    ? Math.min((model.runwaySavingsGbp || 0) / monthlyCashDrain, 99)
    : 99;

  return {
    nursingIncome: Math.round(nursingIncome),
    phase1Income: Math.round(phase1Income),
    phase1Shortfall: Math.round(Math.max(target - phase1Income, 0)),
    phase1IsSafe,
    phase2Income: Math.round(phase2Income),
    phase2Shortfall: Math.round(Math.max(target - phase2Income, 0)),
    phase2IsSafe,
    phase3Income: Math.round(phase3Income),
    phase3IsSafe,
    targetDrawings: Math.round(target),
    cashRunwayMonths: Math.round(cashRunway),
    minimumCashRequired: Math.round(minimumCashRequired),
    recommendedCash: Math.round(recommendedCash),
    runwaySavings: model.runwaySavingsGbp || 0,
    // Legacy compat fields
    clinicExtractable: Math.round(winc.netProfit + bedh.netProfit),
    totalAvailableIncome: Math.round(phase1Income),
    monthlyShortfall: Math.round(Math.max(target - phase1Income, 0)),
    isSafeToLeaveNursing: phase2IsSafe,
  };
}

// ─── Bedhampton data health check ────────────────────────────────────────────
// Compares the manually entered existingClinicRevenueGbp against the live
// 3-month average from the external API. Warns when they diverge by >thresholdPct.
// Call this whenever both model and live data are available.
export function checkBedhamptonDataHealth(
  modelledRevenue: number,
  liveAvg3m: number,
  thresholdPct = 20,
): { ok: boolean; divergencePct: number; warning: string | null } {
  if (modelledRevenue <= 0 || liveAvg3m <= 0) {
    return { ok: true, divergencePct: 0, warning: null };
  }
  const divergencePct = Math.round(Math.abs(modelledRevenue - liveAvg3m) / liveAvg3m * 100);
  if (divergencePct > thresholdPct) {
    const direction = modelledRevenue > liveAvg3m ? "overstated" : "understated";
    return {
      ok: false,
      divergencePct,
      warning: `Model Bedhampton revenue (£${Math.round(modelledRevenue).toLocaleString()}/mo) is ${divergencePct}% ${direction} vs live 3-month average (£${Math.round(liveAvg3m).toLocaleString()}/mo). Update the model to match actual performance.`,
    };
  }
  return { ok: true, divergencePct, warning: null };
}
