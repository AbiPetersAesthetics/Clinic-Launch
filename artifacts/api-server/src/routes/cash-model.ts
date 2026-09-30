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
function exVatOf(amount: number, invoiceVat: string | null, costVat: string | null): { ex: number; basis: string } {
  const inv = (invoiceVat ?? "").toLowerCase();
  if (inv === "inc") return { ex: amount / 1.2, basis: "inc VAT on the invoice" };
  if (inv === "exc") return { ex: amount, basis: "ex VAT on the invoice" };
  if (inv === "exempt") return { ex: amount, basis: "no VAT" };
  const c = (costVat ?? "").toLowerCase();
  if (/exempt|vat_na|n\/a|no vat|not applicable/.test(c)) return { ex: amount, basis: "no VAT" };
  if (/inc/.test(c)) return { ex: amount / 1.2, basis: "planned inc VAT" };
  if (/ex_vat|ex vat|exc/.test(c)) return { ex: amount, basis: "planned ex VAT" };
  return { ex: amount / 1.2, basis: "VAT basis not set, assumed inc VAT" };
}

export type ProjectLine = {
  taskId: number; title: string; phase: string; status: "paid" | "part-paid" | "unpaid";
  recorded: number; paid: number; remainingExVat: number; vatBasis: string;
  plan: { month: string; share: number; method: "bank" | "card" }[]; planProblem: string | null;
};

export async function buildCashModel(projectId: number, opts: { scenario?: string; months?: number } = {}) {
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let stored: unknown = {};
  try { stored = JSON.parse((model as any)?.cashModelJson || "{}"); } catch { stored = {}; }
  const config = mergeDeep<CashModelConfig>(CASH_MODEL_DEFAULTS, stored);
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
      for (const p of plan) payments.push({ month: p.month, amountExVat: remainingExVat * p.share, method: p.method === "card" ? "card" : "bank", label: t.title, taskId: t.id });
    }
  }

  // ── Funding and loans ──
  const inv = (await db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId))).filter(i => !(i as any).archived);
  const ym = (d: string | null) => (d ? d.slice(0, 7) : config.startMonth);
  const funding: CashInputs["funding"] = inv.filter(i => i.type === "equity" || i.type === "gift")
    .map(i => ({ month: ym(i.depositDate), amount: i.amountGbp, kind: i.type as "equity" | "gift", label: i.name }));
  const loans: CashInputs["loans"] = inv.filter(i => i.type === "loan")
    .map(i => ({ label: i.name, principal: i.amountGbp, drawMonth: ym(i.depositDate), annualRatePct: i.interestRatePercent, holidayMonths: (i as any).holidayMonths ?? 0, repayments: i.repaymentTermMonths }));

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
  const inputs: CashInputs = {
    ...config, months,
    winc: { contributionPct: config.winc.contributionPct, takings: scen.takings, growth },
    projectPayments: payments, funding, loans,
  };
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
    config: { ...config, winc: { ...config.winc, scenario: scenarioKey, growth } },
    rows: result.rows, fyTotals: result.fyTotals,
    checks: [...result.checks, coverage],
    lowest: result.lowest,
    firstPayMonth: firstPay ? firstPay.label : null,
    projectLines: lines.sort((a, b) => a.phase.localeCompare(b.phase) || a.title.localeCompare(b.title)),
    paidToDate,
    funding, loans, ownership,
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

export default router;
