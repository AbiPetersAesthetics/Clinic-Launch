// Cash model tests. Run from artifacts/api-server with: pnpm run test:money
// The owner's rule: the Money page must reproduce his reference table to within
// 50 pounds a month, and fail loudly otherwise.
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const tmp = mkdtempSync(join(tmpdir(), "cash-model-"));
const out = join(tmp, "bundle.mjs");
execSync(`npx esbuild tests/cash-model-entry.ts --bundle --platform=node --format=esm --outfile=${out} --log-level=error`);
const lib = await import("file://" + out.replace(/\\/g, "/"));

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

// The owner's section 2 schedule, ex VAT, with his 30 September answers
// (launch Meta 1,000 and Google 500 reverse charged, so no VAT to remove).
const CBS = 71177;
const projectPayments = [
  { month: "2026-10", amountExVat: 5416, method: "bank", label: "Rent deposit" },
  { month: "2026-10", amountExVat: 2140, method: "bank", label: "Solicitor balance" },
  { month: "2026-10", amountExVat: 1593.33, method: "bank", label: "Signage balance" },
  { month: "2026-10", amountExVat: 1800, method: "bank", label: "Croma fire alarm" },
  { month: "2026-10", amountExVat: 1500, method: "card", label: "Joinery materials" },
  { month: "2026-10", amountExVat: 3183.33, method: "card", label: "Furniture" },
  { month: "2026-10", amountExVat: CBS * 0.20, method: "bank", label: "CBS valuation (20%)" },
  { month: "2026-11", amountExVat: CBS * 0.60, method: "bank", label: "CBS valuations (60%)" },
  { month: "2026-12", amountExVat: CBS * 0.17, method: "bank", label: "CBS valuation (17%)" },
  { month: "2027-05", amountExVat: CBS * 0.03, method: "bank", label: "CBS retention (3%)" },
  { month: "2026-11", amountExVat: 2000, method: "card", label: "Opening stock" },
  { month: "2026-11", amountExVat: 950, method: "card", label: "Insurance (no VAT)" },
  { month: "2026-11", amountExVat: 1025, method: "card", label: "Pre-opening checks" },
  { month: "2026-11", amountExVat: 425, method: "card", label: "Broadband, deep clean, scrubs" },
  { month: "2026-11", amountExVat: 1000, method: "card", label: "Launch Meta" },
  { month: "2026-12", amountExVat: 500, method: "card", label: "Launch Google" },
];
const funding = [
  { month: "2026-10", amount: 37000, kind: "equity", label: "James Gibbons" },
  { month: "2026-10", amount: 10000, kind: "gift", label: "Bill Peters" },
];
const loans = [{ label: "James Gibbons loan", principal: 10000, drawMonth: "2026-11", annualRatePct: 5, holidayMonths: 6, repayments: 30 }];

const inputs = (months = 9, scenario = "base") => {
  const d = lib.CASH_MODEL_DEFAULTS;
  return { ...d, months, projectPayments, funding, loans,
    winc: { contributionPct: d.winc.contributionPct, takings: lib.WINC_SCENARIOS[scenario].takings, growth: d.winc.growth, capacity: d.winc.capacity } };
};
// The brief's own setup: Bedhampton at 3,000 from December and closed from April,
// ongoing ads on the card, and no limit on Winchester's days.
const briefInputs = (months = 9, scenario = "base") => {
  const i = inputs(months, scenario);
  return { ...i,
    bedh: { takings: { "2026-10": 8000, "2026-11": 9000, "2026-12": 3000, "2027-01": 3000, "2027-02": 3000, "2027-03": 3000 }, contributionPct: 54 },
    marketing: { ...i.marketing, cardFrom: "2026-12" }, winc: { ...i.winc, capacity: undefined } };
};

// Reference table as updated on 30 September with the owner's answers. Since then
// the owner has said the card is a one-off for the build (ads come from the bank)
// and Bedhampton stays open on two days while Winchester builds. The table is
// still checked, in the brief's own setup.
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

test("reproduces the brief's reference table within 50 pounds a month, in the brief's setup", () => {
  REF.forEach(([m, inn, out, bank, drawn, owed], i) => {
    const r = brief.rows[i];
    assert.equal(r.month, m);
    for (const [name, got, want] of [["money in", r.moneyIn, inn], ["money out", r.moneyOutBank, out], ["bank", r.closingBank, bank], ["card drawn", r.cardDrawn, drawn], ["card owed", r.cardOwed, owed]]) {
      assert.ok(Math.abs(got - want) <= 50, `${m} ${name}: got ${Math.round(got)}, reference ${want}`);
    }
  });
});

test("lowest bank point is December 2026, about 12,593, above the 10,000 floor", () => {
  assert.equal(res.lowest.month, "Dec 26");
  assert.ok(Math.abs(res.lowest.bank - 12593) <= 50, `lowest ${res.lowest.bank}`);
  assert.ok(res.rows.every(r => !r.belowFloor));
});

test("the card holds build and pre-opening purchases only, and clears in December 2028", () => {
  const long = lib.runCashModel(inputs(36));
  const drawnTotal = long.rows.reduce((s, r) => s + r.cardDrawn, 0);
  const buildOnCard = projectPayments.filter(p => p.method === "card").reduce((s, p) => s + p.amountExVat, 0);
  assert.ok(Math.abs(drawnTotal - buildOnCard) < 0.01, `drawn ${drawnTotal}, build ${buildOnCard}`);
  assert.ok(long.rows.filter(r => r.month > "2026-12").every(r => r.cardDrawn === 0 && r.cardFundedCosts === 0));
  assert.ok(long.rows.find(r => r.month === "2028-11").cardOwed > 1);
  assert.ok(long.rows.find(r => r.month === "2028-12").cardOwed < 0.01);
});

test("marketing counts against Bedhampton to November and Winchester from December, whoever pays", () => {
  const nov = res.rows.find(r => r.month === "2026-11"), dec = res.rows.find(r => r.month === "2026-12");
  const onCard = lib.runCashModel({ ...inputs(), marketing: { ...lib.CASH_MODEL_DEFAULTS.marketing, cardFrom: "2026-12" } });
  const nb = onCard.rows.find(r => r.month === "2026-12");
  assert.ok(Math.abs(nov.bedhOwnProfit - (nov.bedh.contribution - 600 - 450)) < 0.01);
  assert.ok(Math.abs(dec.wincOwnProfit - nb.wincOwnProfit) < 0.01, "moving the ads off the card must not change site profit");
  assert.ok(Math.abs(dec.operatingProfit - nb.operatingProfit) < 0.01, "or the P&L");
});

test("every built-in check passes (roll-forwards, VAT, cash ties to profit)", () => {
  for (const c of res.checks) assert.ok(c.pass, `${c.name}: ${c.detail}`);
});

test("first rent payment is 7,301 on 25 December, then 8,125 per quarter day", () => {
  const r = lib.rentSchedule(inputs(), "2026-10", "2027-12");
  assert.equal(Math.round(r["2026-12"]), 7301);
  assert.equal(r["2027-03"], 8125); assert.equal(r["2027-06"], 8125); assert.equal(r["2027-09"], 8125); assert.equal(r["2027-12"], 8125);
  assert.equal(r["2026-10"], undefined); assert.equal(r["2027-01"], undefined);
});

test("James's loan: 6-month holiday with interest, then about 365 a month from June 2027", () => {
  const long = lib.runCashModel(inputs(40));
  const jun = long.rows.find(r => r.month === "2027-06");
  assert.ok(Math.abs(jun.loanRepayment - 364.3) < 1, `June repayment ${jun.loanRepayment}`);
  assert.equal(long.rows.find(r => r.month === "2027-05").loanRepayment, 0);
  const total = long.rows.reduce((s, r) => s + r.loanRepayment, 0);
  assert.ok(Math.abs(total - 10929) < 5, `total repaid ${total}`);
  assert.ok(long.rows.find(r => r.month === "2029-11").loanOwed < 0.01);
});

test("Abi's pay starts in April 2027: Winchester profitable two months running, and profit above the 3,000 kept", () => {
  assert.ok(res.rows.filter(r => r.month < "2027-04").every(r => r.payCost === 0));
  assert.ok(res.rows.find(r => r.month === "2027-04").paySalary > 0);
  // In the brief's setup (Bedhampton closing in April) nothing is paid by June 2027.
  assert.ok(brief.rows.every(r => r.payCost === 0));
  const jun = brief.rows[8];
  assert.ok(jun.payGate && jun.operatingProfit - jun.loanRepayment < 3000);
});

test("Bedhampton runs on two days from December at 7,500, and Winchester's three days hold 21,840", () => {
  assert.ok(Math.abs(lib.wincCapacityFor(inputs(), 3) - 21840) < 1);
  assert.ok(Math.abs(lib.wincCapacityFor(inputs(), 5) - 36400) < 1);
  const long = lib.runCashModel(inputs(36));
  for (const r of long.rows.filter(r => r.month >= "2026-12")) {
    assert.equal(r.bedh.gross, 7500); assert.ok(r.bedhOpen);
    assert.ok(r.winc.gross <= 21840 + 0.01);
  }
});

test("Bedhampton closes only when Winchester's overflow beyond three days beats Bedhampton's profit, two months running", () => {
  const i = inputs(36); i.winc = { ...i.winc, growth: { target: 40000, month: "2028-06" } };
  const long = lib.runCashModel(i);
  const k = long.rows.findIndex(r => r.month >= "2026-12" && !r.bedhOpen);
  assert.ok(k > 0, "closes when demand runs to 40,000");
  const passes = r => r.switchGain > r.switchLoss;
  assert.ok(passes(long.rows[k - 1]) && passes(long.rows[k - 2]) && !passes(long.rows[k - 3]));
  // The threshold: demand above 21,840 + (7,500 x 54%) / 58%, about 28,823.
  assert.ok(long.rows[k - 2].wincDemand > 28822.76 && long.rows[k - 3].wincDemand <= 28822.76);
  // After closing: no Bedhampton, and Winchester is held to five days' capacity.
  const full = lib.wincCapacityFor(i, 5);
  for (const r of long.rows.slice(k)) {
    assert.equal(r.bedh.gross, 0);
    assert.ok(Math.abs(r.winc.gross - Math.min(r.wincDemand, full)) < 0.01);
  }
});

test("salary solver: employer NI above the threshold and the basic-rate cap", () => {
  const p = lib.CASH_MODEL_DEFAULTS.pay;
  assert.deepEqual(lib.salaryFor(0, p), { salary: 0, cost: 0 });
  assert.deepEqual(lib.salaryFor(300, p), { salary: 300, cost: 300 });
  const mid = lib.salaryFor(2000, p);
  assert.ok(Math.abs(mid.cost - 2000) < 0.02 && mid.salary < 2000);
  const cap = lib.salaryFor(10000, p);
  assert.equal(cap.salary, 4189.17); assert.ok(Math.abs(cap.cost - 4755) < 1);
});

test("growth after June 2027 runs straight to 22,000 by February 2029, then holds", () => {
  const i = inputs(40);
  assert.equal(lib.wincTakings(i, "2027-06"), 14700);
  assert.ok(Math.abs(lib.wincTakings(i, "2027-07") - (14700 + 7300 / 20)) < 0.01);
  assert.equal(lib.wincTakings(i, "2029-02"), 22000);
  assert.equal(lib.wincTakings(i, "2029-09"), 22000);
});

test("fire alarm maintenance is a single 220 in October 2027, not monthly", () => {
  const long = lib.runCashModel(inputs(40));
  assert.equal(long.rows.find(r => r.month === "2027-10").running.oneOff, 220);
  assert.equal(long.rows.filter(r => r.running.oneOff > 0).length, 1);
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

test("the floor check fires in the brief's setup on the cautious ramp; two Bedhampton days keep it above the floor", () => {
  const b = lib.runCashModel(briefInputs(9, "cautious"));
  assert.ok(b.rows.some(r => r.belowFloor));
  assert.equal(b.checks.find(x => x.name.startsWith("Bank stays above")).pass, false);
  const c = lib.runCashModel(inputs(36, "cautious"));
  assert.ok(c.rows.every(r => !r.belowFloor), `cautious lowest ${Math.round(c.lowest.bank)}`);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} tests passed.`);
