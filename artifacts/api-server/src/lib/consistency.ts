// The money consistency check (owner, 15 Nov 2026: "if we update finance then the entire relevant
// money area needs updating"). Every money screen reads the same records through the cash model and
// the summaries; this asserts they agree on the bank total and date, the lowest month-end, funding
// still to come, card balances and the VAT rule. A mismatch is a red item on Today, never a silent
// difference. It runs with the brief, after every applied money change, and as a test before a push.
import { buildCashModel } from "../routes/cash-model";
import { cardBalances, summaryFor } from "./board-data";

export interface Check { name: string; ok: boolean; detail: string }

const near = (a: number, b: number) => Math.abs(a - b) < 0.51;

export async function moneyConsistency(projectId = 1): Promise<Check[]> {
  const [money, J13, J24, cards] = await Promise.all([
    summaryFor(projectId, "money"), buildCashModel(projectId, { months: 13 }), buildCashModel(projectId, { months: 24 }), cardBalances(projectId),
  ]);
  const checks: Check[] = [];
  const bank = (money.extra as any)?.bank;
  checks.push({ name: "Bank total and date", ok: !!bank && !!J24.bank && near(bank.balanceGbp, J24.bank.balanceGbp) && bank.asAt === J24.bank.asAt, detail: `summary ${bank?.balanceGbp} at ${bank?.asAt}; model ${J24.bank?.balanceGbp} at ${J24.bank?.asAt}` });
  const months = (J: any) => (J.rows ?? []).slice(0, 12).map((r: any) => [r.month, Math.round(r.closingBank)]);
  const a = months(J13), b = months(J24);
  const same = a.every(([m, v]: [string, number], i: number) => b[i] && b[i][0] === m && Math.abs(b[i][1] - v) <= 1);
  checks.push({ name: "Month-end balances agree across screens", ok: same, detail: same ? "12 months agree" : `first difference at ${a.find(([m, v]: [string, number], i: number) => !b[i] || b[i][0] !== m || Math.abs(b[i][1] - v) > 1)?.[0]}` });
  const low = (money.extra as any)?.viz?.low;
  const lowModel = (J13.rows ?? []).filter((r: any) => r.month >= new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()).slice(0, 7)).reduce((x: any, r: any) => (!x || r.closingBank < x.bank ? { month: r.label, bank: r.closingBank } : x), null);
  checks.push({ name: "Lowest month-end", ok: !!low && !!lowModel && low.month === lowModel.month && near(low.bank, lowModel.bank), detail: `summary ${low?.month} ${Math.round(low?.bank ?? 0)}; model ${lowModel?.month} ${Math.round(lowModel?.bank ?? 0)}` });
  const fundA = JSON.stringify(((money.extra as any)?.expected ?? []).map((e: any) => [e.label, e.amount, e.month]));
  const fundB = JSON.stringify((J24.fundingOptions ?? []).filter((f: any) => !(J24.bank?.inBalance ?? []).includes(f.id) && f.month >= (J24.bank?.asAt ?? "").slice(0, 7)).map((f: any) => [f.label, f.amount, f.month]));
  checks.push({ name: "Funding still to come", ok: fundA === fundB, detail: fundA === fundB ? "agrees" : `summary ${fundA}; model ${fundB}` });
  const owedKpi = money.kpis.find((k) => k.label === "Credit cards owed");
  const owed = cards.filter((c) => c.limit > 0).reduce((s, c) => s + c.balance, 0);
  checks.push({ name: "Card balances", ok: !owedKpi || owedKpi.value === `£${Math.round(owed).toLocaleString("en-GB")}`, detail: `register ${owed.toFixed(2)}` });
  checks.push({ name: "VAT rule", ok: !!J24.config?.vatReturns, detail: (J24.config?.vatReturns as any)?.confirmed ? "confirmed by the owner" : "assumed monthly" });
  return checks;
}
