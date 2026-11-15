// ── Money page cash model route ──────────────────────────────────────────────
// Loads the plan, funding and ownership from the database, applies the stored
// inputs over CASH_MODEL_DEFAULTS, and runs the pure engine in lib/cash-model.
// GET /projects/:id/cash-model?scenario=base&months=12|36

import { Router } from "express";
import { db } from "@workspace/db";
import {
  financialsTable, phasesTable, tasksTable, propertiesTable, propertyTaskOverridesTable,
  investmentsTable, shareholdersTable, cardEntriesTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
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
  /** paid: from the bank, so already in the bank balance. paidOnCard: paid by a card on the
   *  card register; still owed on the card, so the model keeps it as card spend to repay. */
  recorded: number; paid: number; paidOnCard: number; remainingExVat: number; vatBasis: string;
  /** recorded, ex VAT: the board's phase hover splits each line into ex VAT and VAT with it. */
  exVat: number;
  plan: { month: string; share: number; method: "bank" | "card" | "personal" }[]; planProblem: string | null;
};

// The bank today, entered on the Money page: the balance, its date, and the funding the owner
// has ticked as already in it. Stored in cash_model_json under "bank".
export type BankBalance = { balanceGbp: number; asAt: string; inBalance: number[] };
function readBank(stored: unknown): BankBalance | null {
  const b = (stored as any)?.bank;
  if (!b || typeof b.balanceGbp !== "number" || !Number.isFinite(b.balanceGbp) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.asAt ?? ""))) return null;
  return { balanceGbp: b.balanceGbp, asAt: String(b.asAt), inBalance: Array.isArray(b.inBalance) ? b.inBalance.map(Number).filter(Number.isInteger) : [], ...(Array.isArray(b.accounts) ? { accounts: b.accounts } : {}) } as BankBalance;
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
    const dayToDay = first.total.contribution - first.running.utilities - first.running.general - (marketingOnCard ? 0 : first.running.marketing) - first.ratesPaid;
    tradedSoFar = Math.round(elapsedShare * dayToDay * 100) / 100;
  }
  return { ...bank, startMonth: ym, elapsedShare, tradedSoFar, openingUsed: Math.round((bank.balanceGbp - tradedSoFar) * 100) / 100 };
}

// The ads plan's spend for each month: every live or planned campaign's daily budget for the days it
// runs that month (conditional campaigns, such as Google search, are left out until their conditions
// hold). From the latest ads snapshot, which carries ads-plan.json as data.plan.
async function adsPlanByMonth(projectId: number): Promise<Record<string, number> | undefined> {
  try {
    const r = await db.execute(sql`SELECT data->'plan'->'campaigns' AS c FROM ads_pathway_snapshots WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 1`);
    const camps: any[] = (((r as any).rows ?? r)[0]?.c) ?? [];
    if (!camps.length) return undefined;
    const out: Record<string, number> = {};
    const day = (d: string) => Date.parse(d + "T12:00:00Z");
    for (const c of camps) {
      if (c.status === "conditional" || c.status === "done" || !c.start || !Number(c.perDay)) continue;
      const end = c.end ?? "2028-12-31";
      for (let t = day(c.start); t <= day(end); t += 86400000) {
        const ym = new Date(t).toISOString().slice(0, 7);
        out[ym] = (out[ym] ?? 0) + Number(c.perDay);
      }
    }
    for (const k of Object.keys(out)) out[k] = Math.max(0, Math.round(out[k] * 100) / 100);
    return out;
  } catch { return undefined; }
}

export async function buildCashModel(projectId: number, opts: { scenario?: string; months?: number; drawAvailableLoans?: boolean } = {}) {
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

  // What the card register holds against each plan line: purchases less refunds. A line paid
  // by card is still owed on the card, not out of the bank, so that much of its payment
  // counts as unpaid card spend, in the line's own card plan.
  const onCard = new Map<number, number>();
  for (const e of await db.select().from(cardEntriesTable).where(eq(cardEntriesTable.projectId, projectId))) {
    if (e.taskId == null || (e.kind !== "purchase" && e.kind !== "refund")) continue;
    onCard.set(e.taskId, (onCard.get(e.taskId) ?? 0) + (e.kind === "refund" ? -e.amountGbp : e.amountGbp));
  }

  const lines: ProjectLine[] = [];
  const payments: ProjectPayment[] = [];
  const cbsCfg = ((config as any).cbs ?? {}) as { finalPayDate?: string; vatPaid?: { month: string; paidOn?: string; amount: number; label: string; abiLentOn?: string | null }[] };
  const cbsPayMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(cbsCfg.finalPayDate ?? "")) ? String(cbsCfg.finalPayDate).slice(0, 7) : null;
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
    const paidAll = status === "paid" ? recorded : status === "part-paid" ? (amountPaid || actual) : 0;
    const paidOnCard = Math.min(paidAll, Math.max(0, onCard.get(t.id) ?? 0));
    const paid = paidAll - paidOnCard;
    // CBS: Tide pays each valuation in full, VAT and all, and reclaims the VAT. Abi lends the VAT
    // into Tide the month it is paid and is repaid when the refund lands (owner, 1 November
    // 2026; her October loan went into Tide on the 26th). Her loan is modelled below.
    const isCbs = /^Ref \d+ - /.test(t.title);
    const remainingRecorded = Math.max(0, recorded - (isCbs ? paidAll : paid));
    const remainingExVat = remainingRecorded * (vat.ex / recorded);
    let plan: ProjectLine["plan"] = [];
    try { const p = JSON.parse((t as any).paymentPlanJson || "[]"); if (Array.isArray(p)) plan = p; } catch { plan = []; }
    // A payment planned for a month that has gone (the bank today moves the start on) is still
    // owed: it falls in the first month the model shows, rather than out of the model.
    plan = plan.map(p => (p.month && p.month < config.startMonth ? { ...p, month: config.startMonth } : p));
    // CBS's last invoice has a pay date (owner, 15 Nov 2026: invoiced in about two weeks, payable a
    // week after): what the plan still held for an earlier month is paid then. Retention keeps its month.
    if (isCbs && cbsPayMonth) plan = plan.map(p => (p.month && p.month < cbsPayMonth ? { ...p, month: cbsPayMonth } : p));
    const shares = plan.reduce((s, p) => s + (Number(p.share) || 0), 0);
    const planProblem = remainingExVat < 0.5 ? null
      : !plan.length ? "No payment month set"
      : Math.abs(shares - 1) > 0.001 ? `Payment shares add up to ${Math.round(shares * 100)}%, not 100%`
      : null;
    lines.push({ taskId: t.id, title: t.title, phase: phaseName.get(t.phaseId) ?? "", status, recorded, paid, paidOnCard, remainingExVat, vatBasis: vat.basis, exVat: vat.ex, plan, planProblem });
    if (remainingExVat >= 0.5 && !planProblem) {
      // VAT is paid with the bill and reclaimed on the VAT return, unless the line carries none.
      const vatRate = vat.basis === "no VAT" ? 0 : config.vatRate;
      for (const p of plan) payments.push({ month: p.month, amountExVat: remainingExVat * p.share, vat: remainingExVat * p.share * vatRate, method: p.method === "card" ? "card" : p.method === "personal" ? "personal" : "bank", label: t.title, taskId: t.id });
    }
  }

  // ── Funding and loans ──
  const inv = (await db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId))).filter(i => !(i as any).archived);
  const ym = (d: string | null) => (d ? d.slice(0, 7) : config.startMonth);
  // Funding ticked as already in the bank balance is not counted again.
  const funding: CashInputs["funding"] = inv.filter(i => (i.type === "equity" || i.type === "gift") && !bank?.inBalance.includes(i.id))
    .map(i => ({ month: ym(i.depositDate), amount: i.amountGbp, kind: i.type as "equity" | "gift", label: i.name, date: i.depositDate }));
  // A loan with no draw date is available, not drawn (owner, 15 Nov 2026: "whenever we wish to take
  // it"). It is left out of the forecast unless asked for (drawAvailableLoans), and shown apart.
  const asLoan = (i: any, month: string) => ({ label: i.name, principal: i.amountGbp, drawMonth: month, annualRatePct: i.interestRatePercent, holidayMonths: i.holidayMonths ?? 0, repayments: i.repaymentTermMonths });
  const thisYm = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const availableLoans = inv.filter(i => i.type === "loan" && !i.depositDate).map(i => asLoan(i, thisYm < config.startMonth ? config.startMonth : thisYm));
  const loans: CashInputs["loans"] = [...inv.filter(i => i.type === "loan" && i.depositDate).map(i => asLoan(i, ym(i.depositDate))), ...(opts.drawAvailableLoans ? availableLoans : [])];
  const fundingOptions = inv.filter(i => i.type === "equity" || i.type === "gift").map(i => ({ id: i.id, label: i.name, month: ym(i.depositDate), amount: i.amountGbp }));

  // Abi's VAT loans: for each month with CBS VAT to pay from the bank, she lends that VAT into
  // Tide (money in) and is repaid the month the refund lands (money out). Her 26 October loan is
  // already in the bank today, so only its repayment is modelled, when October's VAT comes back.
  const abiLoans: CashInputs["funding"] = [], abiRepay: CashInputs["oneOffs"] = [];
  const cbsVatByMonth = new Map<string, number>();
  for (const p of payments) if (/^Ref \d+ - /.test(p.label) && p.method === "bank" && (p.vat ?? 0) > 0) cbsVatByMonth.set(p.month, (cbsVatByMonth.get(p.month) ?? 0) + (p.vat ?? 0));
  const lag = config.vatReturns?.refundLagMonths ?? 1;
  for (const [m, v] of cbsVatByMonth) {
    const amt = Math.round(v * 100) / 100;
    abiLoans.push({ month: m, amount: amt, kind: "gift", label: "Abi lends the VAT on CBS's bill (director's loan)" });
    abiRepay.push({ month: addMonths(m, lag), amount: amt, method: "bank", label: "Abi repaid her VAT loan from the refund", pnl: false });
  }
  const octRow = ((await db.execute(sql`SELECT coalesce(sum(e.amount_gbp), 0) AS v FROM card_entries e JOIN credit_cards c ON c.id = e.card_id WHERE e.project_id = ${projectId} AND e.kind = 'purchase' AND c.holder = 'Abi Flitney' AND e.description LIKE 'CBS interim payment 1: VAT on %'`)) as any).rows?.[0];
  const octVat = Number(octRow?.v ?? 0);
  // HMRC refunds still to land for VAT already paid: October's (CBS valuation 1, Abi repaid from
  // it) and each later valuation paid before the bank date. Abi lends that VAT in if she has not
  // yet, and is repaid the month its refund lands (owner, 15 Nov 2026).
  const vatRefundsDue: NonNullable<CashInputs["vatRefundsDue"]> = [];
  if (octVat > 0 && addMonths("2026-10", lag) >= config.startMonth) vatRefundsDue.push({ month: addMonths("2026-10", lag), amount: Math.round(octVat * 100) / 100, label: "October's VAT refund (CBS valuation 1)" });
  for (const v of cbsCfg.vatPaid ?? []) {
    const back = addMonths(v.month, lag);
    if (!(v.amount > 0) || back < config.startMonth) continue;
    const amt = Math.round(v.amount * 100) / 100;
    vatRefundsDue.push({ month: back, amount: amt, label: `VAT refund on CBS ${v.label}` });
    if (!v.abiLentOn || (bank && v.abiLentOn > bank.asAt)) abiLoans.push({ month: v.month < config.startMonth ? config.startMonth : v.month, amount: amt, kind: "gift", label: `Abi lends the VAT on CBS ${v.label} (director's loan)` });
    abiRepay.push({ month: back, amount: amt, method: "bank", label: `Abi repaid her VAT loan on CBS ${v.label} from the refund`, pnl: false });
  }
  if (octVat > 0 && addMonths("2026-10", lag) >= config.startMonth) abiRepay.push({ month: addMonths("2026-10", lag), amount: Math.round(octVat * 100) / 100, method: "bank", label: "Abi repaid her October VAT loan from the refund", pnl: false });
  const fundingAll = [...funding, ...abiLoans], oneOffsAll = [...(config.oneOffs ?? []), ...abiRepay];

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
    projectPayments: payments, funding: fundingAll, loans, oneOffs: oneOffsAll, vatRefundsDue,
    // The ads plan's spend by month: on once marketing.useAdsPlan is set in the stored model (owner, 15 Nov 2026).
    marketing: { ...config.marketing, byMonth: (config.marketing as any).useAdsPlan ? await adsPlanByMonth(projectId) : undefined },

  };
  (planned as any).standAloneLoans = opts.drawAvailableLoans ? [] : availableLoans;
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
    funding: fundingAll, loans, ownership, oneOffs: oneOffsAll,
    bank: bankView, fundingOptions, bankAccounts: (bank as any)?.accounts ?? null,
    availableLoans: availableLoans.map(l => ({ label: l.label, principal: l.principal, annualRatePct: l.annualRatePct, repayments: l.repayments })),
    marketingByMonth: (planned as any).marketing.byMonth,
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
      // Each Tide account with where its figure came from ("statement", "owner stated", "export, to
      // confirm", "screenshot") and its date; arriving money (unsettled card takings) is kept apart.
      const SOURCES = ["statement", "owner stated", "export, to confirm", "screenshot", "not known"];
      const accounts = Array.isArray(body.accounts) ? (body.accounts as any[]).slice(0, 8).map((a) => ({
        name: String(a?.name ?? "").slice(0, 40),
        balanceGbp: a?.balanceGbp == null || a?.balanceGbp === "" ? null : Math.round(Number(a.balanceGbp) * 100) / 100,
        source: SOURCES.includes(String(a?.source)) ? String(a.source) : "owner stated",
        asAt: /^\d{4}-\d{2}-\d{2}$/.test(String(a?.asAt ?? "")) ? String(a.asAt) : asAt,
        arriving: a?.arriving === true,
      })).filter((a) => a.name) : undefined;
      stored.bank = { balanceGbp: Math.round(n * 100) / 100, asAt, inBalance, ...(accounts ? { accounts } : {}), savedAt: new Date().toISOString() };
    }
    await db.update(financialsTable).set({ cashModelJson: JSON.stringify(stored) } as any).where(eq(financialsTable.projectId, projectId));
    res.json({ ok: true, bank: (stored as any).bank ?? null });
  } catch (err) {
    console.error("[cash-model bank]", err);
    res.status(500).json({ error: "Could not save the balance" });
  }
});

export default router;
