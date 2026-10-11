// @ts-nocheck
// The Money page's inputs, rebuilt from its own answer (buildCashModel), so the Money Plan
// can run the same engine for each forecast and each Bedhampton and pay option.
import { runCashModel } from "../lib/cash-model";
import { WINC_SCENARIOS } from "../lib/cash-model-defaults";

export function makeRun(J) {
  const cfg = { ...J.config, openingBank: J.bank ? J.bank.openingUsed : J.config.openingBank };
  delete cfg.openingDate;
  const payments = [];
  for (const l of J.projectLines) {
    if (l.remainingExVat < 0.5 || l.planProblem) continue;
    const rate = l.vatBasis === "no VAT" ? 0 : cfg.vatRate;
    for (const p of l.plan) payments.push({ month: p.month, amountExVat: l.remainingExVat * p.share, vat: l.remainingExVat * p.share * rate, method: p.method === "card" ? "card" : "bank", label: l.title, taskId: l.taskId });
  }
  return function run(scen = "central", o = {}) {
    const S = WINC_SCENARIOS[scen];
    const lastKey = Object.keys(S.takings).sort().pop();
    const scale = S.takings[lastKey] / (WINC_SCENARIOS.base.takings[lastKey] || S.takings[lastKey]);
    const growth = { month: cfg.winc.growth.month, target: Math.round(cfg.winc.growth.target * scale) };
    return runCashModel({ ...cfg, months: o.months ?? 36, projectPayments: payments, funding: J.funding, loans: J.loans,
      pay: { ...cfg.pay, ...(o.pay ?? {}) },
      bedh: { ...cfg.bedh, plan: { ...cfg.bedh.plan, ...(o.plan ?? {}) } },
      winc: { contributionPct: cfg.winc.contributionPct, takings: S.takings, productCost: S.productCost, growth, capacity: cfg.winc.capacity } });
  };
}
