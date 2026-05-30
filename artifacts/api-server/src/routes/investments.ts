import { Router } from "express";
import { db } from "@workspace/db";
import { investmentsTable, shareholdersTable, financialsTable, fixedCostItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ─── Loan repayment helper ────────────────────────────────────────────────────
function monthlyRepayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  if (annualRatePercent <= 0) return principal / termMonths;
  const r = annualRatePercent / 100 / 12;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

// ─── Investments CRUD ─────────────────────────────────────────────────────────

router.get("/projects/:projectId/investments", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db.select().from(investmentsTable)
    .where(eq(investmentsTable.projectId, projectId))
    .orderBy(desc(investmentsTable.createdAt));
  return res.json(rows);
});

router.post("/projects/:projectId/investments", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { name, type, amountGbp, equityPercent, interestRatePercent, repaymentTermMonths, repaymentStartMonth, notes } = req.body;
  if (!name || !type) return res.status(400).json({ error: "name and type are required" });
  if (!["loan", "equity"].includes(type)) return res.status(400).json({ error: "type must be loan or equity" });

  const [row] = await db.insert(investmentsTable).values({
    projectId,
    name,
    type,
    amountGbp: amountGbp ?? 0,
    equityPercent: equityPercent ?? 0,
    interestRatePercent: interestRatePercent ?? 0,
    repaymentTermMonths: repaymentTermMonths ?? 0,
    repaymentStartMonth: repaymentStartMonth ?? 1,
    notes: notes ?? "",
  }).returning();
  return res.status(201).json(row);
});

router.put("/investments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, type, amountGbp, equityPercent, interestRatePercent, repaymentTermMonths, repaymentStartMonth, notes } = req.body;
  const [row] = await db.update(investmentsTable).set({
    name, type, amountGbp, equityPercent, interestRatePercent,
    repaymentTermMonths, repaymentStartMonth, notes,
    updatedAt: new Date(),
  }).where(eq(investmentsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Investment not found" });
  return res.json(row);
});

router.delete("/investments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(investmentsTable).where(eq(investmentsTable.id, id));
  res.status(204).send();
});

// ─── Shareholders CRUD ────────────────────────────────────────────────────────

router.get("/projects/:projectId/shareholders", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db.select().from(shareholdersTable)
    .where(eq(shareholdersTable.projectId, projectId))
    .orderBy(desc(shareholdersTable.createdAt));
  return res.json(rows);
});

router.post("/projects/:projectId/shareholders", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { name, role, equityPercent, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const [row] = await db.insert(shareholdersTable).values({
    projectId,
    name,
    role: role ?? "",
    equityPercent: equityPercent ?? 0,
    notes: notes ?? "",
  }).returning();
  return res.status(201).json(row);
});

router.put("/shareholders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, role, equityPercent, notes } = req.body;
  const [row] = await db.update(shareholdersTable).set({
    name, role, equityPercent, notes,
    updatedAt: new Date(),
  }).where(eq(shareholdersTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Shareholder not found" });
  return res.json(row);
});

router.delete("/shareholders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(shareholdersTable).where(eq(shareholdersTable.id, id));
  res.status(204).send();
});

// ─── Investment Summary — 3-year payout analysis ─────────────────────────────
// Calculates per-year P&L with proper ramp curve, constant fixed costs,
// per-month director drawings, 20% cash buffer retention before dividends.

router.get("/projects/:projectId/investment-summary", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [investments, shareholders, model, fixedCostItems] = await Promise.all([
    db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId)),
    db.select().from(shareholdersTable).where(eq(shareholdersTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)).limit(1),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
  ]);

  const fin = model[0];

  const totalCapitalGbp = investments.reduce((s, i) => s + i.amountGbp, 0);
  const totalEquityGivenUpPercent = investments.reduce((s, i) => s + i.equityPercent, 0);

  // Per-investment loan repayment schedule
  const loanInstruments = investments
    .filter(i => i.type === "loan")
    .map(i => {
      const monthlyPayment = monthlyRepayment(i.amountGbp, i.interestRatePercent, i.repaymentTermMonths);
      const startM = Math.max(1, i.repaymentStartMonth);
      const endM = startM + i.repaymentTermMonths - 1;
      const paymentsInYear1 = Math.max(0, Math.min(12, endM) - startM + 1);
      return {
        ...i,
        monthlyPayment: Math.round(monthlyPayment),
        totalRepaidYear1: Math.round(monthlyPayment * paymentsInYear1),
        paymentsInYear1,
      };
    });

  // Helper: total loan repayments within a given month window
  function loanRepaymentsInWindow(fromMonth: number, toMonth: number): number {
    return loanInstruments.reduce((s, l) => {
      const startM = Math.max(1, l.repaymentStartMonth);
      const endM = startM + l.repaymentTermMonths - 1;
      const payments = Math.max(0, Math.min(endM, toMonth) - Math.max(startM, fromMonth) + 1);
      return s + l.monthlyPayment * payments;
    }, 0);
  }

  const totalLoanRepaymentsYear1 = loanRepaymentsInWindow(1, 12);
  const totalLoanRepaymentsYear2 = loanRepaymentsInWindow(13, 24);
  const totalLoanRepaymentsYear3 = loanRepaymentsInWindow(25, 36);

  if (!fin) {
    return res.json({
      investments, shareholders, loanInstruments,
      equityInvestments: investments.filter(i => i.type === "equity"),
      totalCapitalGbp: Math.round(totalCapitalGbp),
      totalEquityGivenUpPercent,
      founderEquityPercent: Math.max(0, 100 - totalEquityGivenUpPercent),
      totalLoanRepaymentsYear1: 0,
      distributableProfit12m: 0,
      cashflowNote: "No financial model found. Set up your assumptions first.",
      totalSharesPercent: 0,
      payouts: [],
      annualSummary: null,
      breakdown12m: null,
    });
  }

  // ── Revenue model (Winchester at realistic occupancy) ──────────────────────
  const acv = (fin as any).wincAcvGbp || (fin as any).averageClientValueGbp || 155;
  const rooms = (fin as any).treatmentRoomsCount ?? 1;
  const hours = (fin as any).practitionerHoursPerDay ?? 7;
  const days = (fin as any).workingDaysPerMonth ?? 17;
  const slotsPerMonth = rooms * hours * days;
  const occupancyPct = ((fin as any).realisticOccupancyPercent ?? 65) / 100;
  const ssRevenue = slotsPerMonth * occupancyPct * acv + ((fin as any).membershipRevenueGbp ?? 0);

  // ── Fixed costs — prefer dynamic items table over legacy fields ─────────────
  const fixedMonthly = fixedCostItems.length > 0
    ? fixedCostItems.reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : ((fin as any).rentGbp ?? 0) + ((fin as any).ratesGbp ?? 0) + ((fin as any).utilitiesGbp ?? 0) +
      ((fin as any).internetGbp ?? 0) + ((fin as any).insuranceGbp ?? 0) + ((fin as any).accountantGbp ?? 0) +
      ((fin as any).softwareGbp ?? 0) + ((fin as any).wasteContractGbp ?? 0) + ((fin as any).cleanerGbp ?? 0) +
      ((fin as any).subscriptionsGbp ?? 0) + ((fin as any).financeRepaymentsGbp ?? 0);

  // Variable costs: percentage of revenue + fixed monthly overhead items
  const variableRatio = (((fin as any).stockPercent ?? 0) + ((fin as any).commissionsPercent ?? 0)) / 100;
  const variableOverheads = ((fin as any).marketingGbp ?? 0) + ((fin as any).staffingGbp ?? 0) + ((fin as any).consumablesGbp ?? 0);

  // Director salary/drawings
  const targetDrawings = (fin as any).ownerDrawingsGbp || (fin as any).targetDrawingsGbp || 0;

  // Cash reserve: retain this % of net before paying dividends
  const CASH_RESERVE_PCT = 0.20;
  // Minimum business cash retained monthly (same as cashflow route)
  const MIN_RETAINED = 3000;

  // ── Annual P&L calculator ─────────────────────────────────────────────────
  // factors: array of occupancy multipliers (one per month, where 1.0 = full realistic occ)
  // loanRepayments: total loan repayments for this year period
  function calcYearMetrics(factors: number[], loanRepayments: number) {
    let totRevenue = 0, totVariable = 0, totGross = 0, totFixed = 0;
    let totOperating = 0, totDirector = 0;

    for (const f of factors) {
      // Revenue and variable costs scale with occupancy/ramp factor
      const rev = ssRevenue * f;
      const varCost = rev * variableRatio + variableOverheads * f;
      const gross = rev - varCost;
      // Fixed costs are constant regardless of occupancy
      const operating = gross - fixedMonthly;
      // Director salary: only taken when monthly profit covers MIN_RETAINED after drawings
      const drawings = operating > MIN_RETAINED
        ? Math.min(operating - MIN_RETAINED, targetDrawings)
        : 0;
      totRevenue  += rev;
      totVariable += varCost;
      totGross    += gross;
      totFixed    += fixedMonthly;
      totOperating += operating;
      totDirector  += drawings;
    }

    const netAfterDirector = totOperating - totDirector;
    // Deduct loan repayments before declaring dividends
    const netAfterLoans = netAfterDirector - loanRepayments;
    // Retain 20% cash buffer in business before distributing
    const bufferRetained = netAfterLoans > 0 ? Math.round(netAfterLoans * CASH_RESERVE_PCT) : 0;
    const distributable  = Math.max(0, Math.round(netAfterLoans - bufferRetained));

    return {
      revenue:           Math.round(totRevenue),
      variableCosts:     Math.round(totVariable),
      grossProfit:       Math.round(totGross),
      grossMarginPct:    totRevenue > 0 ? Math.round((totGross    / totRevenue) * 100) : 0,
      fixedCosts:        Math.round(totFixed),
      operatingProfit:   Math.round(totOperating),
      directorSalary:    Math.round(totDirector),
      netAfterDirector:  Math.round(netAfterDirector),
      netMarginPct:      totRevenue > 0 ? Math.round((netAfterDirector / totRevenue) * 100) : 0,
      loanRepayments:    Math.round(loanRepayments),
      bufferRetained,
      distributable,
    };
  }

  // Year 1: standard ramp from 30% → 100% realistic occupancy over 12 months
  const rampFactors = [0.30, 0.45, 0.60, 0.70, 0.80, 0.90, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
  // Year 2 & 3: full realistic occupancy (ramp complete)
  const fullFactors = Array(12).fill(1.0);

  const y1 = calcYearMetrics(rampFactors, totalLoanRepaymentsYear1);
  const y2 = calcYearMetrics(fullFactors, totalLoanRepaymentsYear2);
  const y3 = calcYearMetrics(fullFactors, totalLoanRepaymentsYear3);

  const distributableProfit12m = y1.distributable;

  const totalSharesPercent = shareholders.reduce((s, sh) => s + sh.equityPercent, 0);
  const payouts = shareholders.map(sh => ({
    ...sh,
    payoutGbp: Math.round(distributableProfit12m * (sh.equityPercent / 100)),
    payoutPercent: sh.equityPercent,
  }));

  return res.json({
    investments,
    shareholders,
    loanInstruments,
    equityInvestments: investments.filter(i => i.type === "equity"),
    totalCapitalGbp:            Math.round(totalCapitalGbp),
    totalEquityGivenUpPercent,
    founderEquityPercent:       Math.max(0, 100 - totalEquityGivenUpPercent),
    totalLoanRepaymentsYear1:   Math.round(totalLoanRepaymentsYear1),
    distributableProfit12m,
    cashflowNote:               "Winchester only. Revenue and variable costs ramp 30%→100% over 12 months; fixed costs constant. Director salary deducted monthly once profitable. 20% cash buffer retained before dividends.",
    totalSharesPercent,
    payouts,
    annualSummary:              { y1, y2, y3 },
    breakdown12m:               y1,
  });
});

export default router;
