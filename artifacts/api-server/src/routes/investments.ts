import { Router } from "express";
import { db } from "@workspace/db";
import { investmentsTable, shareholdersTable, financialsTable, fixedCostItemsTable, projectsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { calcCliniciansMonthlyCost, calcPayeBreakdown } from "../lib/financialEngine";

const router = Router();

// ─── Scenario profiles (mirrors financials.ts) ────────────────────────────────
const INV_SCENARIO_PROFILES: Record<string, {
  getTargetOcc: (m: any) => number;
  acvMultiplier: number;
  startOcc: number;
  rampMonths: number;
}> = {
  conservative:      { getTargetOcc: (m) => m.conservativeOccupancyPercent || 40,             acvMultiplier: 1,    startOcc: 20, rampMonths: 8  },
  realistic:         { getTargetOcc: (m) => m.realisticOccupancyPercent    || 68,             acvMultiplier: 1,    startOcc: 25, rampMonths: 6  },
  aggressive:        { getTargetOcc: (m) => m.aggressiveOccupancyPercent   || 85,             acvMultiplier: 1,    startOcc: 35, rampMonths: 4  },
  delayed_ramp:      { getTargetOcc: (m) => m.realisticOccupancyPercent    || 68,             acvMultiplier: 1,    startOcc: 15, rampMonths: 12 },
  economic_downturn: { getTargetOcc: (m) => (m.conservativeOccupancyPercent || 40) * 0.8,    acvMultiplier: 0.85, startOcc: 15, rampMonths: 9  },
  stress_test:       { getTargetOcc: (m) => Math.max((m.conservativeOccupancyPercent || 40) * 0.65, 12), acvMultiplier: 0.9, startOcc: 5, rampMonths: 10 },
};
const INV_RAMP_TIER_MODIFIERS: Record<string, { startOccMult: number; rampMonthsMult: number }> = {
  slow:    { startOccMult: 0.30, rampMonthsMult: 2.0  },
  average: { startOccMult: 1.0,  rampMonthsMult: 1.0  },
  fast:    { startOccMult: 1.45, rampMonthsMult: 0.65 },
};

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

// ─── Investment Summary — 3-year payout analysis (aligned to Aug–Jul FY) ─────
// Revenue calculated per calendar month mapped to actual Aug–Jul financial years.
// Pre-opening months within FY1 contribute zero revenue. Each additional clinician
// has their own independent ramp from their start date.

router.get("/projects/:projectId/investment-summary", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [investments, shareholders, model, fixedCostItems, projectRow, taskCostRows] = await Promise.all([
    db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId)),
    db.select().from(shareholdersTable).where(eq(shareholdersTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)).limit(1),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1),
    db.execute(sql`
      SELECT
        COALESCE(SUM(COALESCE(pto.selected_cost, t.selected_cost)), 0) AS capital_selected,
        COALESCE(SUM(COALESCE(pto.cost_high,     t.cost_high)),     0) AS capital_high_risk
      FROM launch_tasks t
      JOIN launch_phases ph ON ph.id = t.phase_id
      LEFT JOIN property_task_overrides pto ON pto.task_id = t.id AND pto.property_id = 11
      WHERE ph.project_id = ${projectId}
        AND ph.status = 'active'
        AND COALESCE(pto.status, t.status) NOT IN ('superseded','deferred')
    `),
  ]);

  const fin = model[0];
  const project = projectRow[0];
  const costRow = (taskCostRows.rows as any[])[0] ?? {};
  const capitalSelectedGbp = Math.round(Number(costRow.capital_selected ?? 0));
  const capitalHighRiskGbp  = Math.round(Number(costRow.capital_high_risk ?? 0));

  const totalCapitalGbp = investments.reduce((s, i) => s + i.amountGbp, 0);

  // ── Real funding need: project cost net of existing resources ──────────────
  // The business already has capital + will earn Bedhampton income pre-opening.
  // The investor ask is only what's left after offsetting those.
  const businessCapitalGbp   = Math.round((fin as any)?.runwaySavingsGbp || 0);
  const bedhMonthlyRevenue   = (fin as any)?.existingClinicRevenueGbp || 0;
  const bedhStockPct         = (fin as any)?.bedhStockPercent ?? 35;
  const bedhRunningCosts     = ((fin as any)?.bedhRentGbp || 0) +
    ((fin as any)?.bedhMarketingGbp || 0) + ((fin as any)?.bedhamptonCostsGbp || 0) +
    ((fin as any)?.bedhSoftwareGbp || 0) + ((fin as any)?.bedhStaffingGbp || 0) +
    ((fin as any)?.bedhInsuranceGbp || 0);
  // Shared overhead costs Bedhampton bears pre-opening (dual items — split cost when Winchester opens)
  const bedhDualCostsMonthly = fixedCostItems
    .filter(item => (item as any).costType === "dual")
    .reduce((s, item) => s + (item.amountGbp || 0), 0);

  const targetOpenDate       = project?.targetOpeningDate ? new Date(project.targetOpeningDate) : null;
  const nowDate              = new Date();
  const preOpenMonths        = targetOpenDate
    ? Math.max(0, (targetOpenDate.getFullYear() - nowDate.getFullYear()) * 12 + (targetOpenDate.getMonth() - nowDate.getMonth()))
    : 0;

  // Compute pre-opening Bedhampton net month-by-month to correctly account for:
  //  1. Dual shared overhead costs (Bedhampton bears these pre-opening)
  //  2. VAT registration: once rolling 12-month turnover crosses £90k, 20% VAT is deducted
  const VAT_THRESHOLD_INV = 90000;
  const VAT_RATE_INV = 0.20;
  let vatCumulativeInv = (fin as any)?.vatCurrentTurnoverGbp ?? 0;
  let vatRegisteredInv = vatCumulativeInv >= VAT_THRESHOLD_INV;
  let preOpenBedhNetGbp = 0;
  for (let m = 0; m < preOpenMonths; m++) {
    if (!vatRegisteredInv) {
      vatCumulativeInv += bedhMonthlyRevenue;
      if (vatCumulativeInv >= VAT_THRESHOLD_INV) vatRegisteredInv = true;
    }
    const monthVat = vatRegisteredInv ? bedhMonthlyRevenue * VAT_RATE_INV : 0;
    const monthNet = Math.max(0,
      bedhMonthlyRevenue * (1 - bedhStockPct / 100) - bedhRunningCosts - bedhDualCostsMonthly - monthVat
    );
    preOpenBedhNetGbp += monthNet;
  }
  preOpenBedhNetGbp = Math.round(preOpenBedhNetGbp);

  const totalSelfFundableGbp = businessCapitalGbp + preOpenBedhNetGbp;
  const realFundingNeedGbp     = Math.max(0, capitalSelectedGbp   - totalSelfFundableGbp);
  const realFundingNeedHighGbp = Math.max(0, capitalHighRiskGbp   - totalSelfFundableGbp);
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

  // Helper: total loan repayments within trading-month window [fromMonth, toMonth] (1-based)
  function loanRepaymentsInWindow(fromMonth: number, toMonth: number): number {
    return loanInstruments.reduce((s, l) => {
      const startM = Math.max(1, l.repaymentStartMonth);
      const endM = startM + l.repaymentTermMonths - 1;
      const payments = Math.max(0, Math.min(endM, toMonth) - Math.max(startM, fromMonth) + 1);
      return s + l.monthlyPayment * payments;
    }, 0);
  }

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

  // ── Revenue model — scenario-aware ────────────────────────────────────────
  const scenarioKey = (req.query.scenario as string) || "realistic";
  const rampTierKey = (req.query.rampTier  as string) || "average";
  const baseProfile = INV_SCENARIO_PROFILES[scenarioKey] ?? INV_SCENARIO_PROFILES.realistic;
  const tierMod     = INV_RAMP_TIER_MODIFIERS[rampTierKey] ?? INV_RAMP_TIER_MODIFIERS.average;
  const effStartOcc    = Math.max(Math.round(baseProfile.startOcc    * tierMod.startOccMult),   3);
  const effRampMonths  = Math.max(Math.round(baseProfile.rampMonths  * tierMod.rampMonthsMult), 2);
  const targetOccPct   = baseProfile.getTargetOcc(fin);   // e.g. 68 for realistic
  // ramp factor for trading month m: interpolates startOcc→targetOcc over effRampMonths
  function getRampFactor(m: number): number {
    return (effStartOcc + (targetOccPct - effStartOcc) * Math.min(m / effRampMonths, 1)) / targetOccPct;
  }

  const acv = ((fin as any).wincAcvGbp || (fin as any).averageClientValueGbp || 155) * baseProfile.acvMultiplier;
  const rooms = (fin as any).treatmentRoomsCount ?? 1;
  const hours = (fin as any).practitionerHoursPerDay ?? 7;
  const days = (fin as any).workingDaysPerMonth ?? 17;
  const slotsPerMonth = rooms * hours * days;
  const occupancyPct = targetOccPct / 100;
  const ssRevenue = slotsPerMonth * occupancyPct * acv + ((fin as any).membershipRevenueGbp ?? 0);

  // ── Additional clinicians ─────────────────────────────────────────────────
  interface ExtraClinician { id?: string; name?: string; isPrimary?: boolean; annualGrossSalaryGbp?: number; startDate?: string; hoursPerDay?: number; daysPerMonth?: number; rooms?: number; }
  let additionalClinicians: ExtraClinician[] = [];
  try {
    const raw = (fin as any).additionalCliniciansJson;
    if (raw) {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) additionalClinicians = parsed;
    }
  } catch {}

  // ── Fixed costs — prefer dynamic items table over legacy fields ─────────────
  // Clinician costs split: primary (Abi) only pays employer NI + pension from fixed — her
  // gross salary is drawn conditionally from profit. Secondary clinicians: full employer cost.
  const clinicianFixedCost = (() => {
    const raw = (fin as any).additionalCliniciansJson;
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(String(raw));
      if (!Array.isArray(parsed)) return 0;
      return Math.round(parsed.reduce((sum: number, c: any) => {
        const g = (c.annualGrossSalaryGbp ?? 0);
        if (g <= 0) return (c.salaryGbp ?? 0) > 0 ? sum + c.salaryGbp : sum;
        if (c.isPrimary) {
          const p = calcPayeBreakdown(g);
          return sum + (p.employerNI + p.employerPension) / 12;
        }
        return sum + calcPayeBreakdown(g).totalCostMonthly;
      }, 0));
    } catch { return 0; }
  })();
  const fixedMonthly = (fixedCostItems.length > 0
    ? fixedCostItems.reduce((sum, item) => sum + (item.amountGbp || 0), 0)
    : ((fin as any).rentGbp ?? 0) + ((fin as any).ratesGbp ?? 0) + ((fin as any).utilitiesGbp ?? 0) +
      ((fin as any).internetGbp ?? 0) + ((fin as any).insuranceGbp ?? 0) + ((fin as any).accountantGbp ?? 0) +
      ((fin as any).softwareGbp ?? 0) + ((fin as any).wasteContractGbp ?? 0) + ((fin as any).cleanerGbp ?? 0) +
      ((fin as any).subscriptionsGbp ?? 0) + ((fin as any).financeRepaymentsGbp ?? 0)) + clinicianFixedCost;

  // Variable costs: percentage of revenue + fixed monthly overhead items
  const variableRatio = (((fin as any).stockPercent ?? 0) + ((fin as any).commissionsPercent ?? 0)) / 100;
  const variableOverheads = ((fin as any).marketingGbp ?? 0) + ((fin as any).staffingGbp ?? 0) + ((fin as any).consumablesGbp ?? 0);

  // Primary clinician (Abi) monthly gross salary — drawn conditionally from profit.
  // Falls back to legacy targetDrawingsGbp / ownerDrawingsGbp until the staff schedule is saved.
  const primaryClin = additionalClinicians.find(c => c.isPrimary === true);
  const primaryMonthlyGross = primaryClin && ((primaryClin as any).annualGrossSalaryGbp || 0) > 0
    ? Math.round(((primaryClin as any).annualGrossSalaryGbp || 0) / 12)
    : 0;
  const targetDrawings = primaryMonthlyGross > 0
    ? primaryMonthlyGross
    : Math.round(((fin as any).targetDrawingsGbp || (fin as any).ownerDrawingsGbp || 0));

  const MIN_SALARY_FLOOR = 3000; // Business always retains at least £3,000/mo before Abi draws salary

  // ── Financial Year alignment (Aug 1 – Jul 31) ─────────────────────────────
  const FY_START_MONTH = 7; // 0-indexed: August

  const openingDate: Date = project?.targetOpeningDate
    ? new Date(project.targetOpeningDate)
    : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
  const openingFirst = new Date(openingDate.getFullYear(), openingDate.getMonth(), 1);

  // FY1 starts in August of the year that contains or precedes the opening month.
  // e.g. opening Nov 2026 → Aug 2026 ≤ Nov 2026 → fy1StartYear = 2026
  const fy1StartYear = openingDate.getMonth() >= FY_START_MONTH
    ? openingDate.getFullYear()
    : openingDate.getFullYear() - 1;

  // Number of trading months in FY1 (non-pre-opening months within that Aug–Jul)
  const preOpenMonthsInFY1 = (openingFirst.getFullYear() - fy1StartYear) * 12
    + (openingFirst.getMonth() - FY_START_MONTH);
  const fy1TradingMonths = 12 - preOpenMonthsInFY1; // e.g. 9 for Nov opening

  // ── Per-FY P&L calculator ─────────────────────────────────────────────────
  // Director salary (Abi's gross salary) is drawn conditionally each month:
  // only when (operating − monthly loan repayment) > 0, capped so 20% buffer
  // is always retained. Fixed costs exclude Abi's gross salary (employer NI +
  // pension stay fixed; gross salary is the conditional director draw).
  function calcFyMetrics(fyStartYear: number) {
    interface MonthBrk {
      monthLabel: string; tradingMonthIdx: number;
      operating: number; loanRepayment: number; netPreSalary: number;
      buffer: number; directorDrawing: number; distributable: number; canDraw: boolean;
    }
    let totRevenue = 0, totVariable = 0, totGross = 0, totFixed = 0;
    let totOperating = 0, totLoans = 0, totBuffer = 0, totDirector = 0, totDistributable = 0;
    let tradingMonthsCount = 0;
    const monthlyBreakdown: MonthBrk[] = [];

    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(fyStartYear, FY_START_MONTH + m, 1);
      if (monthDate < openingFirst) continue;

      tradingMonthsCount++;
      const tradingMonthIdx = (monthDate.getFullYear() - openingFirst.getFullYear()) * 12
        + (monthDate.getMonth() - openingFirst.getMonth());

      const f = getRampFactor(tradingMonthIdx);
      let monthRevenue = ssRevenue * f;

      for (const clin of additionalClinicians) {
        if (clin.isPrimary || !clin.startDate) continue;
        const clinStart = new Date(clin.startDate);
        const clinFirst = new Date(clinStart.getFullYear(), clinStart.getMonth(), 1);
        if (monthDate < clinFirst) continue;
        const clinTradingIdx = (monthDate.getFullYear() - clinFirst.getFullYear()) * 12
          + (monthDate.getMonth() - clinFirst.getMonth());
        const cf = getRampFactor(clinTradingIdx);
        const clinRooms = clin.rooms ?? 1;
        const clinHours = clin.hoursPerDay ?? hours;
        const clinDays = clin.daysPerMonth ?? days;
        monthRevenue += clinRooms * clinHours * clinDays * occupancyPct * acv * cf;
      }

      const varCost = monthRevenue * variableRatio + variableOverheads * f;
      const gross = monthRevenue - varCost;
      const operating = gross - fixedMonthly;

      // Monthly loan repayment for this specific trading month (1-based)
      const tm1 = tradingMonthIdx + 1;
      const monthLoan = loanInstruments.reduce((s, l) => {
        const startM = Math.max(1, l.repaymentStartMonth);
        const endM = startM + l.repaymentTermMonths - 1;
        return (tm1 >= startM && tm1 <= endM) ? s + l.monthlyPayment : s;
      }, 0);

      // Director salary: only drawn when monthly net (after loans) exceeds the £3,000 floor.
      // The business always retains at least £3,000; Abi draws from the surplus above that.
      const netPre = operating - monthLoan;
      let buffer = 0, drawings = 0, distrib = 0;
      if (netPre > MIN_SALARY_FLOOR) {
        const surplus = netPre - MIN_SALARY_FLOOR;
        drawings = Math.round(Math.min(targetDrawings, surplus));
        distrib  = Math.max(surplus - drawings, 0);
        buffer   = MIN_SALARY_FLOOR;
      } else if (netPre > 0) {
        buffer = Math.round(netPre); // below floor — all retained, nothing drawn
      }

      totRevenue      += monthRevenue;
      totVariable     += varCost;
      totGross        += gross;
      totFixed        += fixedMonthly;
      totOperating    += operating;
      totLoans        += monthLoan;
      totBuffer       += buffer;
      totDirector     += drawings;
      totDistributable += distrib;

      monthlyBreakdown.push({
        monthLabel:      monthDate.toLocaleString("en-GB", { month: "short", year: "2-digit" }),
        tradingMonthIdx,
        operating:       Math.round(operating),
        loanRepayment:   Math.round(monthLoan),
        netPreSalary:    Math.round(netPre),
        buffer:          Math.round(buffer),
        directorDrawing: Math.round(drawings),
        distributable:   Math.round(distrib),
        canDraw:         drawings > 0,
      });
    }

    const shortY1 = String(fyStartYear).slice(2);
    const shortY2 = String(fyStartYear + 1).slice(2);
    const netPreSalary   = totOperating - totLoans;
    const netAfterDirector = netPreSalary - totDirector;

    return {
      fyLabel:           `FY${shortY1}/${shortY2}`,
      fyDesc:            `Aug '${shortY1} – Jul '${shortY2}`,
      tradingMonths:     tradingMonthsCount,
      revenue:           Math.round(totRevenue),
      variableCosts:     Math.round(totVariable),
      grossProfit:       Math.round(totGross),
      grossMarginPct:    totRevenue > 0 ? Math.round((totGross / totRevenue) * 100) : 0,
      fixedCosts:        Math.round(totFixed),
      operatingProfit:   Math.round(totOperating),
      loanRepayments:    Math.round(totLoans),
      netPreSalary:      Math.round(netPreSalary),
      bufferRetained:    Math.round(totBuffer),
      directorSalary:    Math.round(totDirector),
      netAfterDirector:  Math.round(netAfterDirector),
      netMarginPct:      totRevenue > 0 ? Math.round((netAfterDirector / totRevenue) * 100) : 0,
      distributable:     Math.round(totDistributable),
      monthlyBreakdown,
    };
  }

  const y1 = calcFyMetrics(fy1StartYear);
  const y2 = calcFyMetrics(fy1StartYear + 1);
  const y3 = calcFyMetrics(fy1StartYear + 2);

  // ── Per-FY shareholder payouts ────────────────────────────────────────────
  function fyPayouts(fy: { distributable: number }) {
    return shareholders.map(sh => ({
      ...sh,
      payoutGbp: Math.round(fy.distributable * (sh.equityPercent / 100)),
      payoutPercent: sh.equityPercent,
    }));
  }
  const y1WithPayouts = { ...y1, payouts: fyPayouts(y1) };
  const y2WithPayouts = { ...y2, payouts: fyPayouts(y2) };
  const y3WithPayouts = { ...y3, payouts: fyPayouts(y3) };

  // ── Rolling 12-month P&L from clinic opening (trading months 0–11) ──────────
  // Crosses FY boundaries (e.g. Nov '26 – Oct '27); fairest investor basis.
  // Same conditional-salary logic as calcFyMetrics.
  function calcRolling12m() {
    let totRevenue = 0, totVariable = 0, totGross = 0, totFixed = 0;
    let totOperating = 0, totLoans = 0, totBuffer = 0, totDirector = 0, totDistributable = 0;

    for (let tradingMonthIdx = 0; tradingMonthIdx < 12; tradingMonthIdx++) {
      const monthDate = new Date(
        openingFirst.getFullYear(),
        openingFirst.getMonth() + tradingMonthIdx,
        1,
      );

      const f = getRampFactor(tradingMonthIdx);
      let monthRevenue = ssRevenue * f;

      for (const clin of additionalClinicians) {
        if (clin.isPrimary || !clin.startDate) continue;
        const clinStart = new Date(clin.startDate);
        const clinFirst = new Date(clinStart.getFullYear(), clinStart.getMonth(), 1);
        if (monthDate < clinFirst) continue;
        const clinTradingIdx = (monthDate.getFullYear() - clinFirst.getFullYear()) * 12
          + (monthDate.getMonth() - clinFirst.getMonth());
        const cf = getRampFactor(clinTradingIdx);
        const clinRooms = clin.rooms ?? 1;
        const clinHours = clin.hoursPerDay ?? hours;
        const clinDays = clin.daysPerMonth ?? days;
        monthRevenue += clinRooms * clinHours * clinDays * occupancyPct * acv * cf;
      }

      const varCost = monthRevenue * variableRatio + variableOverheads * f;
      const gross = monthRevenue - varCost;
      const operating = gross - fixedMonthly;

      const tm1 = tradingMonthIdx + 1;
      const monthLoan = loanInstruments.reduce((s, l) => {
        const startM = Math.max(1, l.repaymentStartMonth);
        const endM = startM + l.repaymentTermMonths - 1;
        return (tm1 >= startM && tm1 <= endM) ? s + l.monthlyPayment : s;
      }, 0);

      const netPre = operating - monthLoan;
      let buffer = 0, drawings = 0, distrib = 0;
      if (netPre > MIN_SALARY_FLOOR) {
        const surplus = netPre - MIN_SALARY_FLOOR;
        drawings = Math.round(Math.min(targetDrawings, surplus));
        distrib  = Math.max(surplus - drawings, 0);
        buffer   = MIN_SALARY_FLOOR;
      } else if (netPre > 0) {
        buffer = Math.round(netPre);
      }

      totRevenue      += monthRevenue;
      totVariable     += varCost;
      totGross        += gross;
      totFixed        += fixedMonthly;
      totOperating    += operating;
      totLoans        += monthLoan;
      totBuffer       += buffer;
      totDirector     += drawings;
      totDistributable += distrib;
    }

    const netPreSalary    = totOperating - totLoans;
    const netAfterDirector = netPreSalary - totDirector;
    const endDate = new Date(openingFirst.getFullYear(), openingFirst.getMonth() + 11, 1);
    const fmt = (d: Date) =>
      `${d.toLocaleString("en-GB", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;

    return {
      label:            `${fmt(openingFirst)} – ${fmt(endDate)}`,
      tradingMonths:    12,
      revenue:          Math.round(totRevenue),
      variableCosts:    Math.round(totVariable),
      grossProfit:      Math.round(totGross),
      grossMarginPct:   totRevenue > 0 ? Math.round((totGross / totRevenue) * 100) : 0,
      fixedCosts:       Math.round(totFixed),
      operatingProfit:  Math.round(totOperating),
      loanRepayments:   Math.round(totLoans),
      netPreSalary:     Math.round(netPreSalary),
      bufferRetained:   Math.round(totBuffer),
      directorSalary:   Math.round(totDirector),
      netAfterDirector: Math.round(netAfterDirector),
      netMarginPct:     totRevenue > 0 ? Math.round((netAfterDirector / totRevenue) * 100) : 0,
      distributable:    Math.round(totDistributable),
    };
  }

  const rolling12m = calcRolling12m();

  const distributableProfit12m = rolling12m.distributable;
  const totalLoanRepaymentsYear1 = y1.loanRepayments;

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
    cashflowNote:               `Winchester P&L aligned to financial year (Aug–Jul). ${y1.fyLabel} includes ${y1.tradingMonths} trading months. Variable costs and director salary are dynamic; fixed costs are constant. 20% cash buffer retained before dividends.`,
    totalSharesPercent,
    payouts,
    annualSummary:              { y1: y1WithPayouts, y2: y2WithPayouts, y3: y3WithPayouts },
    rolling12m,
    breakdown12m:               y1,
    capitalSelectedGbp,
    capitalHighRiskGbp,
    businessCapitalGbp,
    preOpenBedhNetGbp,
    preOpenMonths,
    totalSelfFundableGbp,
    realFundingNeedGbp,
    realFundingNeedHighGbp,
  });
});

export default router;
