import { Router } from "express";
import { db } from "@workspace/db";
import { financialsTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!model) return res.status(404).json({ error: "No financial model found" });

  // T008: Fallback — if rent/rates are zero in the financial model, populate from the active property
  if ((model.rentGbp === 0 || model.ratesGbp === 0)) {
    const [activeProperty] = await db.select()
      .from(propertiesTable)
      .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));

    if (activeProperty) {
      const fallbackRent = model.rentGbp === 0 && activeProperty.monthlyRentGbp
        ? activeProperty.monthlyRentGbp
        : model.rentGbp;
      const fallbackRates = model.ratesGbp === 0 && activeProperty.businessRatesGbp
        ? Math.round(activeProperty.businessRatesGbp / 12)
        : model.ratesGbp;

      return res.json({ ...model, rentGbp: fallbackRent, ratesGbp: fallbackRates });
    }
  }

  return res.json(model);
});

router.put("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = req.body;
  const [existing] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));

  let model;
  if (existing) {
    [model] = await db.update(financialsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(financialsTable.projectId, projectId))
      .returning();
  } else {
    [model] = await db.insert(financialsTable).values({ ...body, projectId }).returning();
  }
  res.json(model);
});

router.post("/projects/:projectId/financial/calculate", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { scenario } = req.body;
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));

  if (!model) return res.status(404).json({ error: "No financial model found" });

  const occupancy =
    scenario === "conservative" ? model.conservativeOccupancyPercent :
    scenario === "aggressive" ? model.aggressiveOccupancyPercent :
    model.realisticOccupancyPercent;

  // Revenue calculation
  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;
  const bookedSlots = slotsPerMonth * (occupancy / 100);
  const treatmentRevenue = bookedSlots * model.averageClientValueGbp;
  const monthlyRevenue = treatmentRevenue + model.membershipRevenueGbp;

  // Fixed costs monthly
  const monthlyFixedCosts =
    model.rentGbp + model.ratesGbp + model.utilitiesGbp +
    model.internetGbp + model.insuranceGbp + model.accountantGbp +
    model.softwareGbp + model.wasteContractGbp + model.cleanerGbp +
    model.subscriptionsGbp + model.financeRepaymentsGbp;

  // Variable costs monthly
  const stockCost = monthlyRevenue * (model.stockPercent / 100);
  const commissionsCost = monthlyRevenue * (model.commissionsPercent / 100);
  const monthlyVariableCosts = stockCost + model.marketingGbp + model.staffingGbp + commissionsCost + model.consumablesGbp;

  const monthlyTotalCosts = monthlyFixedCosts + monthlyVariableCosts;
  const monthlyNetProfit = monthlyRevenue - monthlyTotalCosts;
  const annualRevenue = monthlyRevenue * 12;
  const annualNetProfit = monthlyNetProfit * 12;
  const ebitda = annualNetProfit + (model.financeRepaymentsGbp * 12); // add back finance repayments

  // Break-even
  const breakEvenRevenueGbp = monthlyFixedCosts / (1 - (model.stockPercent + model.commissionsPercent) / 100);
  const breakEvenSlotsNeeded = breakEvenRevenueGbp / model.averageClientValueGbp;
  const breakEvenOccupancyPercent = slotsPerMonth > 0 ? (breakEvenSlotsNeeded / slotsPerMonth) * 100 : 0;
  const minimumViableRevenueGbp = monthlyFixedCosts * 1.1;
  const safeOperatingThresholdGbp = monthlyFixedCosts * 1.25;

  // Cash runway (existing clinic subsidy)
  const monthlyCashDrain = model.personalSalaryNeedsGbp + model.ownerDrawingsGbp - model.existingClinicRevenueGbp;
  const cashRunwayMonths = monthlyCashDrain > 0 ? model.runwaySavingsGbp / monthlyCashDrain : 99;

  // Months until profitable
  let monthsUntilProfitable = null;
  if (monthlyNetProfit < 0) {
    // Simple linear ramp: assume revenue grows by 5% per month from 20% starting occupancy
    let simOccupancy = 20;
    let month = 0;
    while (simOccupancy < occupancy && month < 24) {
      simOccupancy = Math.min(simOccupancy + 3, occupancy);
      month++;
    }
    const simRevenue = (slotsPerMonth * (simOccupancy / 100)) * model.averageClientValueGbp;
    if (simRevenue > monthlyTotalCosts) {
      monthsUntilProfitable = month;
    }
  } else {
    monthsUntilProfitable = 0;
  }

  return res.json({
    scenario,
    monthlyRevenue,
    annualRevenue,
    monthlyFixedCosts,
    monthlyVariableCosts,
    monthlyTotalCosts,
    monthlyNetProfit,
    annualNetProfit,
    ebitda,
    cashRunwayMonths,
    breakEvenRevenueGbp,
    breakEvenOccupancyPercent,
    minimumViableRevenueGbp,
    safeOperatingThresholdGbp,
    occupancyUsedPercent: occupancy,
    monthsUntilProfitable,
  });
});

router.get("/projects/:projectId/cashflow", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const scenario = (req.query.scenario as string) ?? "realistic";
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));

  if (!model) return res.status(404).json({ error: "No financial model found" });

  const isStressTest = scenario === "stress_test";
  const targetOccupancy =
    isStressTest ? Math.max(model.conservativeOccupancyPercent - 5, 15) :
    scenario === "conservative" ? model.conservativeOccupancyPercent :
    scenario === "aggressive" ? model.aggressiveOccupancyPercent :
    model.realisticOccupancyPercent;

  const slotsPerMonth = model.treatmentRoomsCount * model.practitionerHoursPerDay * model.workingDaysPerMonth;
  const monthlyFixedCosts =
    model.rentGbp + model.ratesGbp + model.utilitiesGbp +
    model.internetGbp + model.insuranceGbp + model.accountantGbp +
    model.softwareGbp + model.wasteContractGbp + model.cleanerGbp +
    model.subscriptionsGbp + model.financeRepaymentsGbp;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let cumulativeCashflow = 0;
  let hasReachedBreakeven = false;

  const cashflow = Array.from({ length: 12 }, (_, i) => {
    // Ramp: stress test starts at 5% over 10 months; standard starts at 25% over 6 months
    const startOccupancy = isStressTest ? 5 : 25;
    const rampMonths = isStressTest ? 10 : 6;
    const rampedOccupancy = Math.min(startOccupancy + (i * (targetOccupancy - startOccupancy) / rampMonths), targetOccupancy);
    const revenue = (slotsPerMonth * (rampedOccupancy / 100)) * model.averageClientValueGbp + model.membershipRevenueGbp;
    const variableCosts = revenue * ((model.stockPercent + model.commissionsPercent) / 100) + model.marketingGbp + model.staffingGbp + model.consumablesGbp;
    const totalCosts = monthlyFixedCosts + variableCosts;
    const netCashflow = revenue - totalCosts;
    cumulativeCashflow += netCashflow;
    const isBreakevenMonth = !hasReachedBreakeven && netCashflow >= 0;
    if (isBreakevenMonth) hasReachedBreakeven = true;

    return {
      month: i + 1,
      monthLabel: months[i],
      revenue: Math.round(revenue),
      fixedCosts: Math.round(monthlyFixedCosts),
      variableCosts: Math.round(variableCosts),
      netCashflow: Math.round(netCashflow),
      cumulativeCashflow: Math.round(cumulativeCashflow),
      isBreakevenMonth,
    };
  });

  return res.json(cashflow);
});

router.delete("/projects/:projectId/financial", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  await db.delete(financialsTable).where(eq(financialsTable.projectId, projectId));
  res.status(204).send();
});

export default router;
