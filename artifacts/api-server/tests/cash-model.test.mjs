// Cash model tests. Run from artifacts/api-server with: pnpm run test:money
// The owner's rule: the Money page must reproduce his reference table to within
// 50 pounds a month, and fail loudly otherwise. Since then the model has moved on
// (ads from the bank, build VAT paid and reclaimed, Bedhampton open until
// Winchester stands alone, a patient-based forecast), and each change is tested
// here, with the brief's own setup kept as a fixed point.
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const tmp = mkdtempSync(join(tmpdir(), "cash-model-"));
const out = join(tmp, "bundle.mjs");
execSync(`npx esbuild tests/cash-model-entry.ts --bundle --platform=node --format=esm --outfile=${out} --log-level=error`);
const lib = await import("file://" + out.replace(/\\/g, "/"));
const d = lib.CASH_MODEL_DEFAULTS;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

// The owner's section 2 schedule, ex VAT, with his 30 September answers. VAT is
// carried on each line except the rent deposit, insurance and the reverse-charged
// launch ads.
const CBS = 71177;
const P = (month, amountExVat, method, label, vatable = true) => ({ month, amountExVat, method, label, vat: vatable ? amountExVat * 0.2 : 0 });
const projectPayments = [
  P("2026-10", 5416, "bank", "Rent deposit", false),
  P("2026-10", 2140, "bank", "Solicitor balance"),
  P("2026-10", 1593.33, "bank", "Signage balance"),
  P("2026-10", 1800, "bank", "Croma fire alarm"),
  P("2026-10", 1500, "card", "Joinery materials"),
  P("2026-10", 3183.33, "card", "Furniture"),
  P("2026-10", CBS * 0.20, "bank", "CBS valuation (20%)"),
  P("2026-11", CBS * 0.60, "bank", "CBS valuations (60%)"),
  P("2026-12", CBS * 0.17, "bank", "CBS valuation (17%)"),
  P("2027-05", CBS * 0.03, "bank", "CBS retention (3%)"),
  P("2026-11", 2000, "card", "Opening stock"),
  P("2026-11", 950, "card", "Insurance (no VAT)", false),
  P("2026-11", 1025, "card", "Pre-opening checks"),
  P("2026-11", 425, "card", "Broadband, deep clean, scrubs"),
  P("2026-11", 1000, "card", "Launch Meta", false),
  P("2026-12", 500, "card", "Launch Google", false),
];
const noVat = projectPayments.map(p => ({ ...p, vat: 0 }));
const funding = [
  { month: "2026-10", amount: 37000, kind: "equity", label: "James Gibbons" },
  { month: "2026-10", amount: 10000, kind: "gift", label: "Bill Peters" },
];
const loans = [{ label: "James Gibbons loan", principal: 10000, drawMonth: "2026-11", annualRatePct: 5, holidayMonths: 6, repayments: 30 }];

// As the route builds it: the chosen forecast, David's growth line scaled for others.
const growthFor = scenario => {
  const t = lib.WINC_SCENARIOS[scenario].takings, b = lib.WINC_SCENARIOS.base.takings;
  return { month: d.winc.growth.month, target: Math.round(d.winc.growth.target * (t["2027-06"] / b["2027-06"])) };
};
const inputs = (months = 36, scenario = "central", over = {}) => ({
  ...d, months, projectPayments, funding, loans,
  winc: { contributionPct: d.winc.contributionPct, takings: lib.WINC_SCENARIOS[scenario].takings, productCost: lib.WINC_SCENARIOS[scenario].productCost, growth: growthFor(scenario), capacity: d.winc.capacity },
  ...over,
});
const withPlan = (i, plan) => ({ ...i, bedh: { ...i.bedh, plan: { ...i.bedh.plan, ...plan } } });

// The brief's own setup: Bedhampton at 3,000 from December and closed from April,
// ongoing ads on the card, no VAT on the build in the company, David's forecast,
// no limit on Winchester's days.
const briefInputs = (months = 9, scenario = "base") => {
  const i = inputs(months, scenario);
  return { ...i, projectPayments: noVat, vatReturns: undefined,
    bedh: { takings: { "2026-10": 8000, "2026-11": 9000, "2026-12": 3000, "2027-01": 3000, "2027-02": 3000, "2027-03": 3000 }, contributionPct: 54 },
    marketing: { ...i.marketing, cardFrom: "2026-12" }, winc: { ...i.winc, contributionPct: 58, productCost: undefined, capacity: undefined } };
};
const REF = [
  ["2026-10", 51320, 27777, 58543, 4683, 4683],
  ["2026-11", 15730, 45564, 28709, 5400, 9888],
  ["2026-12", 3940, 21884, 10765, 1100, 10568],
  ["2027-01", 5100, 2529, 13336, 600, 10702],
  ["2027-02", 6260, 2554, 17042, 600, 10811],
  ["2027-03", 7130, 10704, 13468, 600, 10895],
  ["2027-04", 6380, 2604, 17244, 600, 10954],
  ["2027-05", 7540, 4764, 20020, 600, 10988],
  ["2027-06", 8526, 11144, 17402, 600, 10997],
];

const res = lib.runCashModel(inputs());
const brief = lib.runCashModel(briefInputs());
const row = (r, m) => r.rows.find(x => x.month === m);
const salary = r => r.rows.reduce((s, x) => s + x.paySalary, 0);

test("reproduces the brief's reference table within 50 pounds a month, in the brief's setup", () => {
  REF.forEach(([m, inn, out, bank, drawn, owed], i) => {
    const r = brief.rows[i];
    assert.equal(r.month, m);
    for (const [name, got, want] of [["money in", r.moneyIn, inn], ["money out", r.moneyOutBank, out], ["bank", r.closingBank, bank], ["card drawn", r.cardDrawn, drawn], ["card owed", r.cardOwed, owed]]) {
      assert.ok(Math.abs(got - want) <= 50, `${m} ${name}: got ${Math.round(got)}, reference ${want}`);
    }
  });
});

test("every built-in check passes on the recommended plan (roll-forwards, VAT, cash ties to profit, VAT reclaimed)", () => {
  for (const c of res.checks) assert.ok(c.pass, `${c.name}: ${c.detail}`);
  assert.ok(res.checks.some(c => c.name === "Build VAT is all reclaimed"));
});

test("the patient model reproduces Bedhampton's March to September 2026 takings (75,646) from its own new patients", () => {
  const cohorts = Object.entries(lib.BEDH_NEW_PATIENTS).map(([month, patients]) => ({ month, patients, priceFactor: 1 }));
  const t = lib.cohortTakings(lib.PATIENT_MODEL, cohorts, ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  const total = Object.values(t).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 75646) / 75646 < 0.01, `model ${Math.round(total)}`);
});

test("David's 14,700 in June 2027 needs about 30 new patients a month from December on the patient model", () => {
  const o = { founding: { month: "2026-11", patients: 30, firstMonthTotal: 1184 }, firstCohort: "2026-12", founderPrice: lib.PRICES.foundersVsBedhampton, listPrice: lib.PRICES.listVsBedhampton, founderUntil: "2027-01" };
  const june = n => lib.wincForecast(lib.PATIENT_MODEL, { early: n, earlyUntil: "2027-02", start: n, growthPerMonth: 0, cap: n }, o, lib.monthsFrom("2026-10", 12))["2027-06"];
  assert.ok(june(29) < 14700 && june(30) >= 14700, `29: ${Math.round(june(29))}, 30: ${Math.round(june(30))}`);
  assert.ok(lib.WINC_SCENARIOS.central.takings["2027-06"] < 9500, "the recommended forecast is about 60% of David's in June 2027");
});

test("Winchester keeps more of each pound than Bedhampton: prices 1.48 times, same product costs", () => {
  assert.equal(d.bedh.contributionPct, 52.7);
  assert.ok(Math.abs(d.bedh.contributionPct - 100 * (1 - 1 / 6 - lib.PRICES.productShare)) < 0.05);
  // At list prices the same treatments keep about 62.7p; founders about 57.5p.
  const keep = pf => 100 * (1 - 1 / 6 - lib.PRICES.productShare / pf);
  assert.ok(Math.abs(keep(lib.PRICES.listVsBedhampton) - 62.7) < 0.1 && Math.abs(keep(lib.PRICES.foundersVsBedhampton) - 57.5) < 0.1);
  assert.ok(lib.WINC_KEEP_PCT > 61 && lib.WINC_KEEP_PCT < 63, `blended ${lib.WINC_KEEP_PCT}`);
  // Each month Winchester keeps its takings less VAT less the product cost of what it sold.
  for (const r of res.rows.filter(x => x.month >= "2026-12" && x.transferIn === 0)) {
    assert.ok(Math.abs(r.winc.contribution - (r.winc.gross * 5 / 6 - lib.WINC_SCENARIOS.central.productCost[r.month])) < 1, r.month);
  }
  assert.equal(lib.STANDS_ALONE_TAKINGS, 14100);
});

test("recommended forecast: Bedhampton on two days until Winchester stands alone in late 2028, bank never below 10,000", () => {
  const closed = res.rows.find(r => r.bedhDays === 0);
  assert.equal(closed.label, "Dec 28");
  assert.ok(res.rows.filter(r => r.month >= "2026-12" && r.month < closed.month).every(r => r.bedhDays === 2 && r.wincDays === 3));
  assert.ok(res.rows.every(r => !r.belowFloor), `lowest ${Math.round(res.lowest.bank)} in ${res.lowest.month}`);
  assert.equal(res.lowest.month, "Dec 26");
});

test("Bedhampton closes the month after Winchester stands on its own for two months running (David's forecast: August 2027)", () => {
  const r = lib.runCashModel(inputs(36, "base"));
  const k = r.rows.findIndex(x => x.bedhDays === 0);
  assert.equal(r.rows[k].label, "Aug 27");
  assert.equal(r.rows[k].wincDays, 5);
  assert.ok(r.rows[k - 1].wincStandMargin >= 0 && r.rows[k - 2].wincStandMargin >= 0 && r.rows[k - 3].wincStandMargin < 0);
  // The margin is Winchester's own contribution less full running costs, the level loan repayment and the 3,000 kept.
  const x = r.rows[k - 1];
  const full = d.rates.monthly + d.utilities.monthly + d.rent.annual / 12 + d.marketing.monthly + d.running.monthly;
  assert.ok(Math.abs(x.wincStandMargin - (x.winc.contribution - full - 364.8 - d.pay.retention)) < 2, `margin ${x.wincStandMargin}`);
  // 15% of Bedhampton patients' return visits follow to Winchester once it closes.
  const first = r.rows[k];
  assert.ok(Math.abs(first.transferIn - 0.15 * d.bedh.plan.demand.returns[first.month]) < 0.01 && first.transferIn > 0);
  assert.ok(r.rows.every(y => !y.belowFloor));
});

test("two days beat one: one Bedhampton day costs Abi's pay, and on the slow forecast most of the bank", () => {
  const one = lib.runCashModel(withPlan(inputs(), { oneDayFrom: "2027-05" }));
  assert.ok(salary(one) < salary(res) - 10000, `two days ${Math.round(salary(res))}, one day ${Math.round(salary(one))}`);
  const slowOne = lib.runCashModel(withPlan(inputs(36, "low"), { oneDayFrom: "2027-05" }));
  const slowTwo = lib.runCashModel(inputs(36, "low"));
  assert.ok(slowTwo.rows[35].closingBank - slowOne.rows[35].closingBank > 20000);
  assert.ok(slowTwo.rows.every(r => !r.belowFloor), "two days keep the slow forecast above the floor");
});

test("closing Bedhampton on a date instead: after April 2027 halves Abi's pay on the recommended forecast and sinks the slow one", () => {
  const r = lib.runCashModel(withPlan(inputs(), { closeAfter: "2027-04" }));
  assert.equal(row(r, "2027-05").bedhDays, 0);
  assert.ok(salary(r) < salary(res) / 2, `april ${Math.round(salary(r))}, rule ${Math.round(salary(res))}`);
  const slow = lib.runCashModel(withPlan(inputs(36, "low"), { closeAfter: "2027-04" }));
  assert.ok(slow.rows.some(x => x.belowFloor));
  assert.equal(slow.checks.find(c => c.name.startsWith("Bank stays above")).pass, false);
});

test("a single Bedhampton day that averages under 400 closes it the month after", () => {
  const quiet = { ...d.bedh.plan.demand, one: Object.fromEntries(Object.keys(d.bedh.plan.demand.one).map(k => [k, 1000])) };
  const r = lib.runCashModel(withPlan(inputs(), { oneDayFrom: "2027-05", demand: quiet }));
  assert.equal(row(r, "2027-05").bedhDays, 1);
  assert.equal(row(r, "2027-06").bedhDays, 0);
});

test("Winchester's three days hold about 31,600 a month, and standing alone is about 36% of them booked", () => {
  assert.ok(Math.abs(lib.wincCapacityFor(inputs(), 3) - 31598) < 5, `${lib.wincCapacityFor(inputs(), 3)}`);
  const occ = lib.STANDS_ALONE_TAKINGS / lib.wincCapacityFor(inputs(), 3, 100);
  assert.ok(occ > 0.34 && occ < 0.38, `occupancy ${occ}`);
});

test("stopping the 3,000 retention once the bank is at 25,000 pays Abi more and still holds the floor", () => {
  const r = lib.runCashModel(inputs(36, "central", { pay: { ...d.pay, retentionUntilBank: 25000 } }));
  assert.ok(salary(r) > salary(res) + 40000, `retained ${Math.round(salary(res))}, released ${Math.round(salary(r))}`);
  assert.ok(r.rows.every(x => !x.belowFloor));
});

test("build VAT is paid with each bill and refunded the month after on the monthly return", () => {
  const nov = row(res, "2026-11"), dec = row(res, "2026-12");
  assert.ok(Math.abs(nov.vatPaidBank - CBS * 0.6 * 0.2) < 0.01, `November VAT from the bank ${nov.vatPaidBank}`);
  assert.ok(Math.abs(nov.vatPaidCard - (2000 + 1025 + 425) * 0.2) < 0.01, "card VAT on stock, checks and broadband; none on insurance or ads");
  assert.ok(Math.abs(dec.vatRefund - (nov.vatPaidBank + nov.vatPaidCard)) < 0.01);
  const paid = res.rows.reduce((s, r) => s + r.vatPaidBank + r.vatPaidCard, 0), back = res.rows.reduce((s, r) => s + r.vatRefund, 0);
  assert.ok(Math.abs(paid - back) < 0.01 && row(res, "2029-09").vatOwedBack < 0.01);
});

test("James's loan: 6-month holiday with interest, then about 364 a month from June 2027, interest in the P&L", () => {
  const long = lib.runCashModel(inputs(40));
  const jun = row(long, "2027-06");
  assert.ok(Math.abs(jun.loanRepayment - 364.3) < 1, `June repayment ${jun.loanRepayment}`);
  assert.equal(row(long, "2027-05").loanRepayment, 0);
  const total = long.rows.reduce((s, r) => s + r.loanRepayment, 0), interest = long.rows.reduce((s, r) => s + r.loanInterest, 0);
  assert.ok(Math.abs(total - 10929) < 5, `total repaid ${total}`);
  assert.ok(Math.abs(interest - (total - 10000)) < 1, "interest is the repayments above the 10,000 lent");
  assert.ok(row(long, "2029-11").loanOwed < 0.01);
  for (const r of long.rows) assert.ok(Math.abs(r.profitAfterInterest - (r.operatingProfit - r.loanInterest)) < 1e-9);
  assert.ok(Math.abs(jun.profitRetained - (jun.operatingProfit - jun.loanInterest - jun.payCost)) < 1e-9);
});

test("the card holds build and pre-opening purchases and their VAT only, and clears in December 2028", () => {
  const drawnTotal = res.rows.reduce((s, r) => s + r.cardDrawn, 0);
  const onCard = projectPayments.filter(p => p.method === "card").reduce((s, p) => s + p.amountExVat + p.vat, 0);
  assert.ok(Math.abs(drawnTotal - onCard) < 0.01, `drawn ${drawnTotal}, build ${onCard}`);
  assert.ok(res.rows.filter(r => r.month > "2026-12").every(r => r.cardDrawn === 0 && r.cardFundedCosts === 0));
  assert.ok(row(res, "2028-11").cardOwed > 1 && row(res, "2028-12").cardOwed < 0.01);
});

test("marketing counts against Bedhampton to November and Winchester from December, whoever pays", () => {
  const nov = row(res, "2026-11");
  assert.ok(Math.abs(nov.bedhOwnProfit - (nov.bedh.contribution - 600 - 450)) < 0.01);
  const onCard = lib.runCashModel(inputs(36, "central", { marketing: { ...d.marketing, cardFrom: "2026-12" } }));
  assert.ok(Math.abs(row(onCard, "2026-12").wincOwnProfit - row(res, "2026-12").wincOwnProfit) < 0.01);
  assert.ok(Math.abs(row(onCard, "2026-12").operatingProfit - row(res, "2026-12").operatingProfit) < 0.01);
});

test("first rent payment is 7,301 on 25 December, then 8,125 per quarter day", () => {
  const r = lib.rentSchedule(inputs(), "2026-10", "2027-12");
  assert.equal(Math.round(r["2026-12"]), 7301);
  assert.equal(r["2027-03"], 8125); assert.equal(r["2027-06"], 8125); assert.equal(r["2027-09"], 8125); assert.equal(r["2027-12"], 8125);
  assert.equal(r["2026-10"], undefined); assert.equal(r["2027-01"], undefined);
});

test("salary solver: employer NI above the threshold and the basic-rate cap", () => {
  const p = d.pay;
  assert.deepEqual(lib.salaryFor(0, p), { salary: 0, cost: 0 });
  assert.deepEqual(lib.salaryFor(300, p), { salary: 300, cost: 300 });
  const mid = lib.salaryFor(2000, p);
  assert.ok(Math.abs(mid.cost - 2000) < 0.02 && mid.salary < 2000);
  const cap = lib.salaryFor(10000, p);
  assert.equal(cap.salary, 4189.17); assert.ok(Math.abs(cap.cost - 4755) < 1);
});

test("David's forecast after June 2027 runs straight to 22,000 by February 2029, then holds", () => {
  const i = inputs(40, "base");
  assert.equal(lib.wincTakings(i, "2027-06"), 14700);
  assert.ok(Math.abs(lib.wincTakings(i, "2027-07") - (14700 + 7300 / 20)) < 0.01);
  assert.equal(lib.wincTakings(i, "2029-02"), 22000);
  assert.equal(lib.wincTakings(i, "2029-09"), 22000);
});

test("fire alarm maintenance is a single 220 in October 2027, not monthly", () => {
  assert.equal(row(res, "2027-10").running.oneOff, 220);
  assert.equal(res.rows.filter(r => r.running.oneOff > 0).length, 1);
});

test("VAT on sales is exactly one sixth of gross at both sites", () => {
  for (const r of res.rows) {
    assert.ok(Math.abs(r.bedh.vat - r.bedh.gross / 6) < 0.01);
    assert.ok(Math.abs(r.winc.vat - r.winc.gross / 6) < 0.01);
  }
});

test("financial years run August to July", () => {
  assert.equal(lib.fyOf("2026-07"), "FY25/26");
  assert.equal(lib.fyOf("2026-08"), "FY26/27");
  assert.equal(lib.fyOf("2027-07"), "FY26/27");
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} tests passed.`);
