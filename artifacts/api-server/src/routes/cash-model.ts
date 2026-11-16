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
import { CASH_MODEL_DEFAULTS, WINC_SCENARIOS, WINC_OPTS, WINC_PROFILES, PATIENT_MODEL, PRICES, type CashModelConfig } from "../lib/cash-model-defaults";
import { wincForecast, wincProductCost, monthsFrom } from "../lib/growth-model";
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

// The assumptions that can be amended from the "How the numbers are built" page, and nothing else:
// a change outside this list is dropped, so the page can never write the bank, the build or the VAT.
const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
export function pickAssumptions(x: any): Record<string, any> {
  const out: any = {};
  const put = (path: string[], v: unknown) => { if (v === undefined) return; let o = out; path.slice(0, -1).forEach((k) => { o = o[k] ??= {}; }); o[path[path.length - 1]] = v; };
  if (!x || typeof x !== "object") return out;
  put(["rent", "annual"], num(x.rent?.annual, 0, 200000));
  put(["rates", "monthly"], num(x.rates?.monthly, 0, 20000));
  put(["utilities", "monthly"], num(x.utilities?.monthly, 0, 5000));
  put(["running", "monthly"], num(x.running?.monthly, 0, 20000));
  put(["marketing", "monthly"], num(x.marketing?.monthly, 0, 20000));
  if (typeof x.marketing?.useAdsPlan === "boolean") put(["marketing", "useAdsPlan"], x.marketing.useAdsPlan);
  put(["bedh", "contributionPct"], num(x.bedh?.contributionPct, 10, 83));
  put(["variable", "extraPct"], num(x.variable?.extraPct, 0, 30));
  put(["winc", "productScale"], num(x.winc?.productScale, 0.3, 3));
  // Winchester prices against what Bedhampton patients actually paid: the list, and introductory prices.
  put(["winc", "listPrice"], x.winc?.listPrice === null ? null : num(x.winc?.listPrice, 0.5, 3));
  put(["winc", "founderPrice"], x.winc?.founderPrice === null ? null : num(x.winc?.founderPrice, 0.5, 3));
  // December's founding cohort: how many of the people booked become paying patients, and what they take.
  put(["winc", "foundingPatients"], x.winc?.foundingPatients === null ? null : num(x.winc?.foundingPatients, 0, 500));
  put(["winc", "foundingTakings"], x.winc?.foundingTakings === null ? null : num(x.winc?.foundingTakings, 0, 100000));
  if (typeof x.winc?.scenario === "string" && WINC_SCENARIOS[x.winc.scenario]) put(["winc", "scenario"], x.winc.scenario);
  if (x.winc?.profile === null) put(["winc", "profile"], null);
  else if (x.winc?.profile && typeof x.winc.profile === "object") {
    const p = x.winc.profile, early = num(p.early, 0, 200), start = num(p.start, 0, 200), growthPerMonth = num(p.growthPerMonth, 0, 10), cap = num(p.cap, 0, 300);
    if (early !== undefined && start !== undefined && growthPerMonth !== undefined && cap !== undefined) put(["winc", "profile"], { early, earlyUntil: /^\d{4}-\d{2}$/.test(String(p.earlyUntil)) ? String(p.earlyUntil) : "2027-02", start, growthPerMonth, cap });
  }
  put(["pay", "capMonthly"], num(x.pay?.capMonthly, 0, 20000));
  put(["pay", "retention"], num(x.pay?.retention, 0, 20000));
  put(["pay", "retentionUntilBank"], x.pay?.retentionUntilBank === null ? null : num(x.pay?.retentionUntilBank, 0, 500000));
  return out;
}

export async function buildCashModel(projectId: number, opts: { scenario?: string; months?: number; drawAvailableLoans?: boolean; tryPay?: Partial<CashModelConfig["pay"]>; tryConfig?: unknown } = {}) {
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let stored: unknown = {};
  try { stored = JSON.parse((model as any)?.cashModelJson || "{}"); } catch { stored = {}; }
  // tryConfig: a what-if on the amendable assumptions, read only. Nothing is saved.
  const config = mergeDeep<CashModelConfig>(mergeDeep<CashModelConfig>(CASH_MODEL_DEFAULTS, stored), opts.tryConfig ? pickAssumptions(opts.tryConfig) : {});
  // A trial of the pay rules (Abi's pay cap, the monthly amount kept, the reserve at which keeping
  // stops): read only, for a before and after. Nothing is saved.
  if (opts.tryPay) config.pay = { ...config.pay, ...opts.tryPay };
  // The bank today, when entered, is where the model starts.
  const bank = readBank(stored);
  if (bank && bank.asAt.slice(0, 7) > config.startMonth) config.startMonth = bank.asAt.slice(0, 7);
  const scenarioKey = opts.scenario && WINC_SCENARIOS[opts.scenario] ? opts.scenario : (WINC_SCENARIOS[config.winc.scenario] ? config.winc.scenario : "base");
  const scenBase = WINC_SCENARIOS[scenarioKey];
  // A growth profile of our own (new patients a month) replaces the named model's takings, built
  // from the same patient records; productScale scales Winchester's product cost.
  const prof = (config.winc as any).profile as { early: number; earlyUntil: string; start: number; growthPerMonth: number; cap: number } | null | undefined;
  const modelMonths = monthsFrom("2026-10", 48);
  const roundMap = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  // Our own price multiples re-run the patient model for any forecast built from patients (not the
  // owner's straight-line forecast, which has no patients behind it).
  const listPrice = Number((config.winc as any).listPrice) || null, founderPrice = Number((config.winc as any).founderPrice) || null;
  const fPatients = (config.winc as any).foundingPatients, fTakings = (config.winc as any).foundingTakings;
  const ownFounding = fPatients != null || fTakings != null;
  const optsUse = { ...WINC_OPTS, ...(listPrice ? { listPrice } : {}), ...(founderPrice ? { founderPrice } : {}), ...(ownFounding ? { founding: { ...WINC_OPTS.founding, ...(fPatients != null ? { patients: Number(fPatients) } : {}), ...(fTakings != null ? { firstMonthTotal: Number(fTakings) } : {}) } } : {}) };
  const profUse = prof && !opts.scenario ? prof : (listPrice || founderPrice || ownFounding) ? ((WINC_PROFILES as any)[scenarioKey] ?? null) : null;
  const scen0 = profUse ? { ...scenBase, ...(prof && !opts.scenario ? { label: "Our own numbers" } : {}), takings: roundMap(wincForecast(PATIENT_MODEL, profUse, optsUse, modelMonths)), productCost: roundMap(wincProductCost(PATIENT_MODEL, profUse, optsUse, modelMonths, PRICES.productShare)) } : scenBase;
  const pScale = Number((config.winc as any).productScale ?? 1) || 1;
  const scen = pScale !== 1 && scen0.productCost ? { ...scen0, productCost: Object.fromEntries(Object.entries(scen0.productCost).map(([k, v]) => [k, v * pScale])) } : scen0;
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
    // David pays Artisan Deco himself, deposit and balance (owner, 15 Nov 2026): the bank does not
    // move for the desk, and the company owes him for it.
    if (/^Reception desk, Artisan/.test(t.title)) plan = plan.map(p => ({ ...p, method: "personal" as const }));
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

  // CBS retention after practical completion (owner, 15 Nov 2026: 3% until then, 1.5% through
  // snagging): the last invoice pays everything left but that share of the contract, which stays
  // in the month the plan already holds retention (the latest month on the CBS lines).
  const retPct = Number((cbsCfg as any).retentionAfterPcPct);
  if (cbsPayMonth && retPct > 0) {
    const cbsLines = lines.filter(l => /^Ref \d+ - /.test(l.title) && l.remainingExVat >= 0.5 && !l.planProblem);
    const totalRem = cbsLines.reduce((t, l) => t + l.remainingExVat, 0);
    const contractEx = lines.filter(l => /^Ref \d+ - /.test(l.title)).reduce((t, l) => t + l.exVat, 0);
    const f = totalRem > 0 ? Math.min(1, (retPct / 100) * contractEx / totalRem) : 0;
    const retMonth = cbsLines.flatMap(l => l.plan.map(p => p.month)).sort().pop() ?? cbsPayMonth;
    const ids = new Set(cbsLines.map(l => l.taskId));
    for (let i = payments.length - 1; i >= 0; i--) if (payments[i].taskId != null && ids.has(payments[i].taskId!)) payments.splice(i, 1);
    for (const l of cbsLines) {
      l.plan = retMonth > cbsPayMonth ? [{ month: cbsPayMonth, share: 1 - f, method: "bank" }, { month: retMonth, share: f, method: "bank" }] : [{ month: cbsPayMonth, share: 1, method: "bank" }];
      const vatRate = l.vatBasis === "no VAT" ? 0 : config.vatRate;
      for (const pl of l.plan) payments.push({ month: pl.month, amountExVat: l.remainingExVat * pl.share, vat: l.remainingExVat * pl.share * vatRate, method: "bank", label: l.title, taskId: l.taskId });
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
    vatRefundsDue,
    history: config.history,
  };
}

router.get("/projects/:projectId/cash-model", async (req, res) => {
  try {
    const out = await buildCashModel(parseInt(req.params.projectId), {
      scenario: req.query.scenario as string | undefined,
      months: parseInt((req.query.months as string) || "12"),
      tryConfig: (() => { try { return req.query.try ? JSON.parse(String(req.query.try)) : undefined; } catch { return undefined; } })(),
      tryPay: (req.query.try_cap || req.query.try_reserve || req.query.try_keep || req.query.try_cap2) ? {
        ...(req.query.try_cap2 ? { capFrom: [{ from: String(req.query.try_from2 ?? "2028-01"), capMonthly: Number(req.query.try_cap2) }] } : {}),
        ...(req.query.try_latch ? { reserveLatch: true } : {}),
        ...(req.query.try_cap ? { capMonthly: Number(req.query.try_cap) } : {}),
        ...(req.query.try_reserve ? { retentionUntilBank: Number(req.query.try_reserve) } : {}),
        ...(req.query.try_keep ? { retention: Number(req.query.try_keep) } : {}),
      } : undefined,
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

// What a forecast comes to, in the figures the owner judges it by.
function summarise(J: any) {
  const rows: any[] = J.rows ?? [];
  const year = (y: string, f: (r: any) => number) => Math.round(rows.filter((r) => r.month.startsWith(y)).reduce((s, r) => s + f(r), 0));
  const twoRunning = (ok: (r: any) => boolean) => { for (let i = 1; i < rows.length; i++) if (rows[i].winc.gross > 0 && ok(rows[i - 1]) && ok(rows[i])) return rows[i - 1].label as string; return null; };
  const low = rows.reduce((m, r) => (r.closingBank < m.closingBank ? r : m), rows[0]);
  return {
    monthEnds: rows.slice(0, 14).map((r) => ({ label: r.label, bank: Math.round(r.closingBank) })),
    lowest: { bank: Math.round(low.closingBank), month: low.label },
    bankEnd2027: Math.round(rows.find((r) => r.month === "2027-12")?.closingBank ?? 0),
    takings: { y2027: year("2027", (r) => r.total.gross), y2028: year("2028", (r) => r.total.gross) },
    winchester: { y2027: year("2027", (r) => r.winc.gross), y2028: year("2028", (r) => r.winc.gross) },
    profit: { y2027: year("2027", (r) => r.operatingProfit), y2028: year("2028", (r) => r.operatingProfit) },
    abiPay: { y2027: year("2027", (r) => r.paySalary), y2028: year("2028", (r) => r.paySalary) },
    firstPay: rows.find((r) => r.paySalary > 0)?.label ?? null,
    paysBills: twoRunning((r) => (r.wincStandMargin ?? 0) + (J.config?.pay?.retention ?? 0) >= 0),
    fixedMonthly: Math.round((rows.find((r) => r.month === "2027-06") ?? rows[rows.length - 1]).running.total + (rows.find((r) => r.month === "2027-06") ?? rows[rows.length - 1]).rates + (rows.find((r) => r.month === "2027-06") ?? rows[rows.length - 1]).rentAccrued),
  };
}

// POST /projects/:id/cash-model/compare { changes }: the plan now against the plan with these
// assumptions changed. Read only: it saves nothing.
router.post("/projects/:projectId/cash-model/compare", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const changes = pickAssumptions((req.body ?? {}).changes);
    const before = summarise(await buildCashModel(projectId, { months: 38 }));
    const after = Object.keys(changes).length ? summarise(await buildCashModel(projectId, { months: 38, tryConfig: changes })) : before;
    res.json({ changes, before, after });
  } catch (err) {
    console.error("[cash-model compare]", err);
    res.status(500).json({ error: "Could not run the comparison" });
  }
});

// POST /projects/:id/cash-model/assumptions { changes, note }: makes the changed assumptions the
// plan. The change is logged with its before and after, and the plan the Money page compares
// against is rebased to it, so the outlook does not read the change as better or worse than plan.
router.post("/projects/:projectId/cash-model/assumptions", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const changes = pickAssumptions((req.body ?? {}).changes);
    const note = String((req.body ?? {}).note ?? "").replace(/[\u2013\u2014]/g, ",").slice(0, 400);
    if (!Object.keys(changes).length) { res.status(400).json({ error: "Nothing to change" }); return; }
    const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
    if (!model) { res.status(404).json({ error: "There is no financial model for this project" }); return; }
    let stored: Record<string, any> = {};
    try { stored = JSON.parse((model as any).cashModelJson || "{}") || {}; } catch { stored = {}; }
    const before = summarise(await buildCashModel(projectId, { months: 38 }));
    const next = mergeDeep<Record<string, any>>(stored, changes);
    const at = new Date().toISOString();
    next.assumptionLog = [...(Array.isArray(stored.assumptionLog) ? stored.assumptionLog : []), { at, changes, note, lowestBefore: before.lowest }].slice(-60);
    await db.update(financialsTable).set({ cashModelJson: JSON.stringify(next) } as any).where(eq(financialsTable.projectId, projectId));
    const J: any = await buildCashModel(projectId, { months: 38 });
    const after = summarise(J);
    const rows = J.rows.slice(0, 13).map((r: any) => ({ month: r.month, bedhGross: Math.round(r.bedh?.gross ?? 0), wincGross: Math.round(r.winc?.gross ?? 0), marketing: Math.round(r.running?.marketing ?? 0), fundingIn: Math.round(r.fundingIn ?? 0), loanDrawn: Math.round(r.loanDrawn ?? 0), buildVatRefund: Math.round(r.vatRefund ?? 0), closingBank: Math.round(r.closingBank) }));
    const base = { asOf: at, bank: J.bank ? { balanceGbp: J.bank.balanceGbp, asAt: J.bank.asAt } : null, rows, _note: "Rebased when an assumption was changed on the How the numbers are built page." };
    await db.execute(sql`INSERT INTO board_snapshots (project_id, key, data) VALUES (${projectId}, 'plan-baseline', ${JSON.stringify(base)})`);
    const gbp = (n: number) => `${n < 0 ? "minus " : ""}${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
    const summary = `An assumption was changed on "How the numbers are built"${note ? `: ${note}` : ""}. Lowest bank ${gbp(before.lowest.bank)} (${before.lowest.month}) before, ${gbp(after.lowest.bank)} (${after.lowest.month}) after; bank at the end of 2027 ${gbp(before.bankEnd2027)} before, ${gbp(after.bankEnd2027)} after. Changed: ${JSON.stringify(changes)}`.slice(0, 900);
    await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${summary}, NOW(), NOW())`);
    res.json({ ok: true, changes, before, after });
  } catch (err) {
    console.error("[cash-model assumptions]", err);
    res.status(500).json({ error: "Could not save the change" });
  }
});

// ── Stock cost, treatment by treatment (owner, 16 Nov 2026: "the stock needs to be for all Bedhampton
// and all Winchester treatments... filler in Winchester is a different, more premium product"). Each
// treatment carries its own product cost at each clinic and its introductory Winchester price; the
// owner's figures are kept in the stored model under stock.items and win over the Launch OS estimate.
// Introductory prices start from the ANS record of 6 Nov 2026 (ans-winchester-opening-prices.md).
const INTRO_FROM_ANS: Record<string, number> = { profhiloFace: 255, skinvive: 235, polyFace: 215, polyEye: 215, sculptraVial: 425, obagiBlueRadiance: 75, exoFace: 255, mnFaceNeckDec: 130, mnFace: 105, restylaneSkinboosters: 125, filler05: 155, filler1: 255, filler2: 420, aw3: 260, aw2: 220, aw1: 145 };
async function stockView(projectId: number) {
  const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let stored: any = {};
  try { stored = JSON.parse((model as any)?.cashModelJson || "{}") || {}; } catch { stored = {}; }
  const mine: Record<string, any> = stored.stock?.items ?? {};
  const t: any[] = ((await db.execute(sql`SELECT key, display_name, category, price_bedhampton, price_winchester, actual_price_bedhampton, actual_price_winchester, product_cost_estimate_gbp, course_size, sort_order FROM treatments ORDER BY sort_order, id`)) as any).rows ?? [];
  const num = (v: any) => (v == null || v === "" ? null : Number(v));
  const items = t.filter((x) => x.category !== "consultation").map((x) => {
    const m = mine[x.key] ?? {};
    const est = num(x.product_cost_estimate_gbp);
    return {
      key: x.key, name: x.display_name, category: x.category, courseSize: x.course_size ?? null,
      bedhPrice: m.bedhPrice !== undefined && m.bedhPrice !== null ? num(m.bedhPrice) : num(x.actual_price_bedhampton) ?? num(x.price_bedhampton), wincList: m.wincList !== undefined && m.wincList !== null ? num(m.wincList) : num(x.actual_price_winchester) ?? num(x.price_winchester),
      bedhPriceSource: m.bedhPriceSource ?? (m.bedhPrice != null ? "you" : "price list"), wincListSource: m.wincListSource ?? (m.wincList != null ? "you" : "price list"),
      introPrice: m.introPrice !== undefined ? num(m.introPrice) : INTRO_FROM_ANS[x.key] ?? null,
      introSource: m.introPrice !== undefined ? "you" : INTRO_FROM_ANS[x.key] != null ? "ANS, 6 Nov" : null,
      bedhCost: m.bedhCost !== undefined ? num(m.bedhCost) : est, wincCost: m.wincCost !== undefined ? num(m.wincCost) : est,
      bedhSource: m.bedhCost !== undefined ? "you" : est != null ? "Launch OS estimate" : null, wincSource: m.wincCost !== undefined ? "you" : est != null ? "Launch OS estimate" : null,
    };
  });
  return { items, savedAt: stored.stock?.savedAt ?? null, vatRate: stored.vatRate ?? CASH_MODEL_DEFAULTS.vatRate };
}
router.get("/projects/:projectId/stock-costs", async (req, res) => {
  try { res.json(await stockView(parseInt(req.params.projectId))); } catch (err) { console.error("[stock-costs]", err); res.status(500).json({ error: "Could not load stock costs" }); }
});
// PUT { items: { [key]: { bedhCost?, wincCost?, introPrice? } } }: saves the owner's figures (null clears one).
router.put("/projects/:projectId/stock-costs", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const body = (req.body ?? {}).items;
    if (!body || typeof body !== "object") { res.status(400).json({ error: "Nothing to save" }); return; }
    const known = new Set((((await db.execute(sql`SELECT key FROM treatments`)) as any).rows ?? []).map((r: any) => r.key));
    const [model] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
    if (!model) { res.status(404).json({ error: "There is no financial model for this project" }); return; }
    let stored: any = {};
    try { stored = JSON.parse((model as any).cashModelJson || "{}") || {}; } catch { stored = {}; }
    const items: Record<string, any> = { ...(stored.stock?.items ?? {}) };
    const changed: string[] = [];
    for (const [key, v] of Object.entries(body as Record<string, any>)) {
      if (!known.has(key) || !v || typeof v !== "object") continue;
      const cur = { ...(items[key] ?? {}) };
      if (typeof (v as any).bedhPriceSource === "string") cur.bedhPriceSource = String((v as any).bedhPriceSource).slice(0, 40);
      if (typeof (v as any).wincListSource === "string") cur.wincListSource = String((v as any).wincListSource).slice(0, 40);
      for (const f of ["bedhCost", "wincCost", "introPrice", "bedhPrice", "wincList"]) {
        if (!(f in v)) continue;
        const raw = (v as any)[f];
        if (raw === null || raw === "") { cur[f] = null; changed.push(`${key} ${f} cleared`); continue; }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 5000) { res.status(400).json({ error: `${key}: ${f} must be a number of pounds` }); return; }
        cur[f] = Math.round(n * 100) / 100; changed.push(`${key} ${f} ${cur[f]}`);
      }
      items[key] = cur;
    }
    if (!changed.length) { res.status(400).json({ error: "Nothing to save" }); return; }
    stored.stock = { items, savedAt: new Date().toISOString() };
    await db.update(financialsTable).set({ cashModelJson: JSON.stringify(stored) } as any).where(eq(financialsTable.projectId, projectId));
    await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${`Stock costs updated on How the numbers are built: ${changed.join("; ")}`.slice(0, 900)}, NOW(), NOW())`);
    res.json(await stockView(projectId));
  } catch (err) {
    console.error("[stock-costs save]", err);
    res.status(500).json({ error: "Could not save the stock costs" });
  }
});

export default router;
