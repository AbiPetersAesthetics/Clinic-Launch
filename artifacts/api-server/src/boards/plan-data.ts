// @ts-nocheck
// The figures the Money Plan is written from: each forecast, each Bedhampton and pay option,
// the recommended plan month by month, the year totals and Bedhampton on one or two days.
import { CASH_MODEL_DEFAULTS, WINC_SCENARIOS, WINC_KEEP_PCT, STANDS_ALONE_TAKINGS, PRICES, PATIENT_MODEL } from "../lib/cash-model-defaults";
import { wincCapacityFor } from "../lib/cash-model";
import { monthsFrom } from "../lib/growth-model";

export function planData(run) {
  const d = CASH_MODEL_DEFAULTS;
  const R = n => Math.round(n);
  const pick = r => ({ m: r.month, l: r.label, fy: r.fy, bd: r.bedhDays, wd: r.wincDays, occ: r.wincOccupancy == null ? null : +(r.wincOccupancy * 100).toFixed(0),
    bedh: R(r.bedh.gross), winc: R(r.winc.gross), take: R(r.total.gross), vat: R(r.total.vat), prod: R(r.total.product), contrib: R(r.total.contribution),
    run: R(r.running.total), rent: R(r.rentAccrued), rates: R(r.rates), op: R(r.operatingProfit), int: +r.loanInterest.toFixed(0), pay: R(r.payCost), sal: R(r.paySalary), kept: R(r.profitRetained),
    open: R(r.openingBank), fund: R(r.fundingIn), proj: R(r.projectBank), vatOut: R(r.vatPaidBank), vatBack: R(r.vatRefund), cardRep: R(r.cardRepayment), loanRep: R(r.loanRepayment), rentPaid: R(r.rentPaid),
    bank: R(r.closingBank), card: R(r.cardOwed), loan: R(r.loanOwed), inn: R(r.moneyIn), out: R(r.moneyOutBank), transfer: R(r.transferIn) });
  const summary = (r) => { const rows = r.rows; const closed = rows.find(x => x.bedhDays === 0); let reg = null; for (let i = 0; i < rows.length - 2; i++) if (rows[i].paySalary > 0 && rows[i + 1].paySalary > 0 && rows[i + 2].paySalary > 0) { reg = rows[i].label; break; }
    return { closes: closed ? closed.label : null, low: R(r.lowest.bank), lowMonth: r.lowest.month, end: R(rows[35].closingBank), salary: R(rows.reduce((s, x) => s + x.paySalary, 0)), regular: reg, under: rows.filter(x => x.belowFloor).length,
      twoDays: rows.filter(x => x.bedhDays === 2).length, oneDay: rows.filter(x => x.bedhDays === 1).length }; };
  const out = { scenarios: {}, plans: {}, main: null, fy: {} };
  for (const k of ["central", "base", "low", "high"]) { const rr = run(k).rows; let stand = null; for (let i = 1; i < rr.length; i++) if (rr[i - 1].wincStandMargin >= 0 && rr[i].wincStandMargin >= 0) { stand = rr[i].label; break; } out.scenarios[k] = { label: WINC_SCENARIOS[k].label, note: WINC_SCENARIOS[k].note, stand, winc: Object.fromEntries(monthsFrom("2026-10", 36).map(m => [m, R(rr.find(x => x.month === m)?.wincDemand ?? 0)])) }; }
  const variants = { two: {}, one: { plan: { oneDayFrom: "2027-05" } }, april: { plan: { closeAfter: "2027-04" } }, release: { pay: { retentionUntilBank: 25000 } } };
  for (const k of ["central", "base", "low", "high"]) { out.plans[k] = {}; for (const [vk, v] of Object.entries(variants)) out.plans[k][vk] = summary(run(k, v)); }
  const main = run("central"); out.main = main.rows.map(pick); out.checks = main.checks.map(c => ({ name: c.name, pass: c.pass }));
  for (const [k, t] of Object.entries(main.fyTotals)) out.fy[k] = Object.fromEntries(Object.entries(t).map(([a, b]) => [a, R(b)]));
  out.release = run("central", variants.release).rows.map(pick);
  out.david = run("base").rows.map(pick);
  // Bedhampton: what two days and one day take, month by month (capped by the days).
  const cap = n => n * (52 / 12) * d.bedh.plan.dayCapacity;
  out.bedh = monthsFrom("2026-12", 34).map(m => ({ m, two: R(Math.min(d.bedh.plan.demand.two[m], cap(2))), one: R(Math.min(d.bedh.plan.demand.one[m], cap(1))) }));
  out.params = { keepW: WINC_KEEP_PCT, keepB: CASH_MODEL_DEFAULTS.bedh.contributionPct, standAt: STANDS_ALONE_TAKINGS, prices: PRICES, firstMonth: R(PATIENT_MODEL.firstMonth), returnVisit: R(PATIENT_MODEL.returnVisit), newAvg2025: 22.6, newAvg2026: 23.4, closeAt: d.bedh.plan.closeWhen.wincAtLeast, winc3dayCap: R(wincCapacityFor({ ...d, winc: { ...d.winc } }, 3)), winc3dayFull: R(wincCapacityFor({ ...d, winc: { ...d.winc } }, 3, 100)) };
  return out;
}
