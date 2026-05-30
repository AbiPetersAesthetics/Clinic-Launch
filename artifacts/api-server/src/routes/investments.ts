import { Router } from "express";
import { db } from "@workspace/db";
import { investmentsTable, shareholdersTable, financialsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ─── Loan repayment helper ────────────────────────────────────────────────────
// Calculates monthly repayment for a standard annuity loan.
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

// ─── Investment Summary — 12-month payout analysis ───────────────────────────
// Fetches investments + shareholders, calculates monthly loan repayments,
// then uses the realistic cashflow to estimate 12-month distributable profit
// and per-shareholder payout at the 12-month mark post-investment.

router.get("/projects/:projectId/investment-summary", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [investments, shareholders, model] = await Promise.all([
    db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId)),
    db.select().from(shareholdersTable).where(eq(shareholdersTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)).limit(1),
  ]);

  const fin = model[0];

  // Capital raised
  const totalCapitalGbp = investments.reduce((s, i) => s + i.amountGbp, 0);
  const totalEquityGivenUpPercent = investments.reduce((s, i) => s + i.equityPercent, 0);

  // Per-investment repayment schedule
  const loanInstruments = investments
    .filter(i => i.type === "loan")
    .map(i => {
      const monthlyPayment = monthlyRepayment(i.amountGbp, i.interestRatePercent, i.repaymentTermMonths);
      // How many of the 12 operating months fall within the repayment window?
      const startM = Math.max(1, i.repaymentStartMonth);
      const endM = startM + i.repaymentTermMonths - 1;
      const paymentsInYear1 = Math.max(0, Math.min(12, endM) - startM + 1);
      const totalRepaidYear1 = monthlyPayment * paymentsInYear1;
      return {
        ...i,
        monthlyPayment: Math.round(monthlyPayment),
        totalRepaidYear1: Math.round(totalRepaidYear1),
        paymentsInYear1,
      };
    });

  const totalLoanRepaymentsYear1 = loanInstruments.reduce((s, l) => s + l.totalRepaidYear1, 0);

  // 12-month cumulative cashflow — fetch from the cashflow endpoint (simplified inline calc)
  // We use the stored financial model's realistic occupancy to estimate 12-month net.
  // For a cleaner payout figure we call our own cashflow route internally via DB model.
  // For simplicity, compute a rough 12-month net from model fields if cashflow isn't available.
  let distributableProfit12m = 0;
  let cashflowNote = "";

  if (fin) {
    // Approximate 12-month net using realistic occupancy
    const acv = fin.wincAcvGbp ?? fin.averageClientValueGbp ?? 155;
    const rooms = fin.treatmentRoomsCount ?? 2;
    const hours = fin.practitionerHoursPerDay ?? 7;
    const days = fin.workingDaysPerMonth ?? 17;
    const slotsPerMonth = rooms * hours * days * (60 / 45); // assume 45-min avg slot
    const occupancy = (fin.realisticOccupancyPercent ?? 65) / 100;
    const monthlyRevenue = slotsPerMonth * occupancy * acv;

    // Fixed costs from model (simplified sum — ideally use fixedCostItems table)
    const fixedMonthly = (fin.rentGbp ?? 0) + (fin.ratesGbp ?? 0) + (fin.utilitiesGbp ?? 0) +
      (fin.internetGbp ?? 0) + (fin.insuranceGbp ?? 0) + (fin.accountantGbp ?? 0) +
      (fin.softwareGbp ?? 0) + (fin.wasteContractGbp ?? 0) + (fin.cleanerGbp ?? 0) +
      (fin.subscriptionsGbp ?? 0) + (fin.financeRepaymentsGbp ?? 0);

    const variableMonthly = monthlyRevenue * ((fin.stockPercent ?? 8) / 100) +
      (fin.consumablesGbp ?? 0) + (fin.staffingGbp ?? 0) +
      monthlyRevenue * ((fin.commissionsPercent ?? 0) / 100);

    const monthlyNet = monthlyRevenue - fixedMonthly - variableMonthly - (fin.ownerDrawingsGbp ?? 0);
    // Apply a simple ramp: months 1-3 at 40%, 4-6 at 65%, 7-12 at 100% of realistic
    const rampFactors = [0.3, 0.45, 0.60, 0.70, 0.80, 0.90, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    distributableProfit12m = Math.round(
      rampFactors.reduce((s, f) => s + monthlyNet * f, 0)
    );
    cashflowNote = "Estimated from model assumptions with standard ramp curve. For exact figures, use the Cashflow tab.";
  }

  // Total shares — validate they sum to ~100%
  const totalSharesPercent = shareholders.reduce((s, sh) => s + sh.equityPercent, 0);

  // Per-shareholder payout
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
    totalCapitalGbp: Math.round(totalCapitalGbp),
    totalEquityGivenUpPercent,
    founderEquityPercent: Math.max(0, 100 - totalEquityGivenUpPercent),
    totalLoanRepaymentsYear1: Math.round(totalLoanRepaymentsYear1),
    distributableProfit12m,
    cashflowNote,
    totalSharesPercent,
    payouts,
  });
});

export default router;
