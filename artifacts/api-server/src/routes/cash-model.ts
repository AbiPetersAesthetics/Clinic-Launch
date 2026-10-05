// ── Money page cash model route ──────────────────────────────────────────────
// Loads the plan, funding and ownership from the database, applies the stored
// inputs over CASH_MODEL_DEFAULTS, and runs the pure engine in lib/cash-model.
// GET /projects/:id/cash-model?scenario=base&months=12|36

import { Router } from "express";
import { db } from "@workspace/db";
import {
  financialsTable, phasesTable, tasksTable, propertiesTable, propertyTaskOverridesTable,
  investmentsTable, shareholdersTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { runCashModel, addMonths, type CashInputs, type ProjectPayment, type CashCheck } from "../lib/cash-model";
import { CASH_MODEL_DEFAULTS, WINC_SCENARIOS, type CashModelConfig } from "../lib/cash-model-defaults";
import { exVatOf } from "../lib/vat-basis";

const router = Router();

function mergeDeep<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(over)) return (over === undefined ? base : (over as T));
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(over as object)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? mergeDeep(out[k], v) : v;
  }
  return out;
}

// Ex VAT value of a plan line. Invoice status wins; otherwise the planning flag.
export type ProjectLine = {
  taskId: number; title: string; phase: string; status: "paid" | "part-paid" | "unpaid";
  recorded: number; paid: number; remainingExVat: number; vatBasis: string;
  plan: { month: string; share: number; method: "bank" | "card" }[]; planProblem: string | null;
};

// The bank today, entered on the Money page: the balance, its date, and the funding the owner
// has ticked as already in it. Stored in cash_model_json under "bank".
export type BankBalance = { balanceGbp: number; asAt: string; inBalance: number[] };
function readBank(stored: unknown): BankBalance | null {
  const b = (stored as any)?.bank;
  if (!b || typeof b.balanceGbp !== "number" || !Number.isFinite(b.balanceGbp) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.asAt ?? ""))) return null;
  return { balanceGbp: b.balanceGbp, asAt: String(b.asAt), inBalance: Array.isArray(b.inBalance) ? b.inBalance.map(Number).filter(Number.isInteger) : [] };
}

// The opening for the model's first month when the balance is entered part-way through it:
// the balance, less the day-to-day trading of the days already gone (takings kept after VAT
// and products, less running costs paid from the bank and rates), so the month counts only
// what is still to come. Dated items (unpaid plan bills, funding, loans, rent, VAT, Abi's
// pay) count in full; lines marked paid are already in the balance.
function openFromBank(inputs: CashInputs, bank: BankBalance) {
  const ym = inputs.startMonth;
  let elapsedShare = 0;
  if (bank.asAt.slice(0, 7) === ym) {
    const day = Number(bank.asAt.slice(8, 10));
    const daysInMonth = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
    elapsedShare = Math.min(1, Math.max(0, (day - 1) / daysInMonth));
  }
  let tradedSoFar = 0;
  if (elapsedShare > 0) {
    const first = runCashModel({ ...inputs, openingBank: 0 }).rows[0];
    const marketingOnCard = inputs.marketing.cardFrom != null && ym >= inputs.marketing.cardFrom;
    const dayToDay = first.total.contribution - first.running.utilities - first.running.general - (marketingOnCard ? 0 : first.running.marketing) - first.rates;
    tradedSoFar = Math.round(elapsedShare * dayToDay * 100) / 100;
  }
  return { ...bank, startMonth: ym, elapsedShare, tradedSoFar, openingUsed: Math.round((bank.balanceGbp - tradedSoFar) * 100) / 100 };
}

export async function buildCashModel(projectId: number, opts: { scenario?: string; months?: number } = {}) {
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let stored: unknown = {};
  try { stored = JSON.parse((model as any)?.cashModelJson || "{}"); } catch { stored = {}; }
  const config = mergeDeep<CashModelConfig>(CASH_MODEL_DEFAULTS, stored);
  // The bank today, when entered, is where the model starts.
  const bank = readBank(stored);
  if (bank && bank.asAt.slice(0, 7) > config.startMonth) config.startMonth = bank.asAt.slice(0, 7);
  const scenarioKey = opts.scenario && WINC_SCENARIOS[opts.scenario] ? opts.scenario : (WINC_SCENARIOS[config.winc.scenario] ? config.winc.scenario : "base");
  const scen = WINC_SCENARIOS[scenarioKey];
  // Alternatives follow the same growth shape, scaled to their own June 2027 level.
  const lastKey = Object.keys(scen.takings).sort().pop()!;
  const scale = scen.takings[lastKey] / (WINC_SCENARIOS.base.takings[lastKey] || scen.takings[lastKey]);
  const growth = { month: config.winc.growth.month, target: Math.round(config.winc.growth.target * scale) };

  // ── Plan lines: live tasks in active phases, active property overrides merged ──
  const phases = await db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const phaseName = new Map(phases.map(p => [p.id, p.name]));
  const baseTasks = phases.length
    ? (await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phases.map(p => p.id)))).filter(t => !t.archived)
    : [];
  const [prop] = await db.select().from(propertiesTable).where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
  const ovr = new Map<number, any>();
  if (prop) for (const o of await db.select().from(propertyTaskOverridesTable).where(eq(propertyTaskOverridesTable.propertyId, prop.id))) ovr.set(o.taskId, o);

  const lines: ProjectLine[] = [];
  const payments: ProjectPayment[] = [];
  for (const t of baseTasks) {
    const o = ovr.get(t.id) ?? {};
    const pick = (k: string) => (o[k] != null ? o[k] : (t as any)[k]);
    const selected = Number(pick("selectedCost") ?? 0), committed = Number(pick("committedCost") ?? 0), actual = Number(pick("actualCost") ?? 0);
    const amountPaid = Number(pick("amountPaidGbp") ?? 0);
    const paidStatus = String(pick("paidStatus") ?? "");
    const recorded = paidStatus === "paid" && actual > 0 ? actual : committed > 0 ? committed : selected;
    if (!recorded) continue;
    const vat = exVatOf(recorded, pick("invoiceVatStatus"), pick("costVatStatus"));
    const status: ProjectLine["status"] = paidStatus === "paid" ? "paid" : paidStatus === "part-paid" ? "part-paid" : "unpaid";
    const paid = status === "paid" ? recorded : status === "part-paid" ? (amountPaid || actual) : 0;
    const remainingRecorded = Math.max(0, recorded - paid);
    const remainingExVat = remainingRecorded * (vat.ex / recorded);
    let plan: ProjectLine["plan"] = [];
    try { const p = JSON.parse((t as any).paymentPlanJson || "[]"); if (Array.isArray(p)) plan = p; } catch { plan = []; }
    const shares = plan.reduce((s, p) => s + (Number(p.share) || 0), 0);
    const planProblem = remainingExVat < 0.5 ? null
      : !plan.length ? "No payment month set"
      : Math.abs(shares - 1) > 0.001 ? `Payment shares add up to ${Math.round(shares * 100)}%, not 100%`
      : null;
    lines.push({ taskId: t.id, title: t.title, phase: phaseName.get(t.phaseId) ?? "", status, recorded, paid, remainingExVat, vatBasis: vat.basis, plan, planProblem });
    if (remainingExVat >= 0.5 && !planProblem) {
      // VAT is paid with the bill and reclaimed on the VAT return, unless the line carries none.
      const vatRate = vat.basis === "no VAT" ? 0 : config.vatRate;
      for (const p of plan) payments.push({ month: p.month, amountExVat: remainingExVat * p.share, vat: remainingExVat * p.share * vatRate, method: p.method === "card" ? "card" : "bank", label: t.title, taskId: t.id });
    }
  }

  // ── Funding and loans ──
  const inv = (await db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId))).filter(i => !(i as any).archived);
  const ym = (d: string | null) => (d ? d.slice(0, 7) : config.startMonth);
  // Funding ticked as already in the bank balance is not counted again.
  const funding: CashInputs["funding"] = inv.filter(i => (i.type === "equity" || i.type === "gift") && !bank?.inBalance.includes(i.id))
    .map(i => ({ month: ym(i.depositDate), amount: i.amountGbp, kind: i.type as "equity" | "gift", label: i.name }));
  const loans: CashInputs["loans"] = inv.filter(i => i.type === "loan")
    .map(i => ({ label: i.name, principal: i.amountGbp, drawMonth: ym(i.depositDate), annualRatePct: i.interestRatePercent, holidayMonths: (i as any).holidayMonths ?? 0, repayments: i.repaymentTermMonths }));
  const fundingOptions = inv.filter(i => i.type === "equity" || i.type === "gift").map(i => ({ id: i.id, label: i.name, month: ym(i.depositDate), amount: i.amountGbp }));

  // ── Ownership over time ──
  const sh = await db.select().from(shareholdersTable).where(eq(shareholdersTable.projectId, projectId));
  type Period = { from: string | null; status: string; holders: { name: string; equityPercent: number }[] };
  const periods = new Map<string, Period>();
  for (const s of sh) {
    const key = `${(s as any).status ?? "current"}|${(s as any).effectiveFrom ?? ""}`;
    const p: Period = periods.get(key) ?? { from: (s as any).effectiveFrom ?? null, status: (s as any).status ?? "current", holders: [] };
    p.holders.push({ name: s.name, equityPercent: s.equityPercent });
    periods.set(key, p);
  }
  const ownership = [...periods.values()].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));

  const months = Math.min(Math.max(opts.months ?? 12, 9), 48);
  const planned: CashInputs = {
    ...config, months,
    winc: { contributionPct: config.winc.contributionPct, takings: scen.takings, productCost: scen.productCost, growth, capacity: config.winc.capacity },
    projectPayments: payments, funding, loans,
  };
  const bankView = bank ? openFromBank(planned, bank) : null;
  const inputs: CashInputs = bankView ? { ...planned, openingBank: bankView.openingUsed } : planned;
  const result = runCashModel(inputs);

  // Sanity check 5: every unpaid pound has exactly one payment month.
  const unscheduled = lines.filter(l => l.planProblem);
  const remaining = lines.reduce((s, l) => s + l.remainingExVat, 0);
  const scheduled = payments.reduce((s, p) => s + p.amountExVat, 0);
  const lastYm = addMonths(config.startMonth, months - 1);
  const beyond = payments.filter(p => p.month > lastYm || p.month < config.startMonth);
  const coverage: CashCheck = {
    name: "Every unpaid plan pound has one payment month",
    pass: unscheduled.length === 0 && Math.abs(remaining - scheduled) < 1,
    detail: unscheduled.length
      ? `Not scheduled: ${unscheduled.map(l => `${l.title} (${l.planProblem})`).join("; ")}`
      : `Unpaid ex VAT ${Math.round(remaining).toLocaleString("en-GB")} = scheduled ${Math.round(scheduled).toLocaleString("en-GB")}${beyond.length ? `; ${beyond.length} payment(s) fall outside the months shown` : ""}`,
  };
  const paidToDate = lines.reduce((s, l) => s + l.paid, 0);

  const firstPay = result.rows.find(r => r.payCost > 0);
  return {
    scenario: scenarioKey,
    scenarios: Object.fromEntries(Object.entries(WINC_SCENARIOS).map(([k, v]) => [k, { label: v.label, note: v.note }])),
    config: { ...config, ...(bankView ? { openingBank: bankView.balanceGbp, openingDate: bankView.asAt } : {}), winc: { ...config.winc, scenario: scenarioKey, growth } },
    rows: result.rows, fyTotals: result.fyTotals,
    checks: [...result.checks, coverage],
    lowest: result.lowest,
    firstPayMonth: firstPay ? firstPay.label : null,
    projectLines: lines.sort((a, b) => a.phase.localeCompare(b.phase) || a.title.localeCompare(b.title)),
    paidToDate,
    funding, loans, ownership,
    bank: bankView, fundingOptions,
    history: config.history,
  };
}

router.get("/projects/:projectId/cash-model", async (req, res) => {
  try {
    const out = await buildCashModel(parseInt(req.params.projectId), {
      scenario: req.query.scenario as string | undefined,
      months: parseInt((req.query.months as string) || "12"),
    });
    res.json(out);
  } catch (err) {
    console.error("[cash-model]", err);
    res.status(500).json({ error: "Cash model failed" });
  }
});

// PUT /projects/:id/cash-model/bank { balanceGbp, asAt, inBalance } sets the bank today;
// { balanceGbp: null } clears it, and the model goes back to its planned opening.
router.put("/projects/:projectId/cash-model/bank", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
    if (!model) { res.status(404).json({ error: "There is no financial model for this project" }); return; }
    let stored: Record<string, unknown> = {};
    try { stored = JSON.parse((model as any).cashModelJson || "{}") || {}; } catch { stored = {}; }
    if (body.balanceGbp === null) delete stored.bank;
    else {
      const n = typeof body.balanceGbp === "number" ? body.balanceGbp : parseFloat(String(body.balanceGbp ?? "").replace(/[£,\s]/g, ""));
      if (!Number.isFinite(n) || Math.abs(n) > 10_000_000) { res.status(400).json({ error: "The balance must be a number of pounds" }); return; }
      const asAt = String(body.asAt ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asAt) || Number.isNaN(Date.parse(asAt))) { res.status(400).json({ error: "Give the date of the balance" }); return; }
      const inBalance = Array.isArray(body.inBalance) ? body.inBalance.map(Number).filter(Number.isInteger) : [];
      stored.bank = { balanceGbp: Math.round(n * 100) / 100, asAt, inBalance, savedAt: new Date().toISOString() };
    }
    await db.update(financialsTable).set({ cashModelJson: JSON.stringify(stored) } as any).where(eq(financialsTable.projectId, projectId));
    res.json({ ok: true, bank: (stored as any).bank ?? null });
  } catch (err) {
    console.error("[cash-model bank]", err);
    res.status(500).json({ error: "Could not save the balance" });
  }
});

export default router;
