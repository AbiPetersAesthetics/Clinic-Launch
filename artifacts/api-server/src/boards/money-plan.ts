// @ts-nocheck
// The Winchester Money Plan: a walkthrough in numbered chapters, written from the live Money
// page (D from plan-data.ts, LIVE = buildCashModel), with the engine itself inlined for "Try
// it yourself". The chapters, words and design are the plan as published; the figures and
// dates follow Launch OS.
export function renderMoneyPlan({ D, LIVE, ENGINE, lib, asOf }) {
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = iso => { const [, m, d] = iso.split("-").map(Number); return d + " " + MONTH_LONG[m - 1]; };
const dmy = iso => { const [y, m, d] = iso.split("-").map(Number); return d + " " + MONTH_LONG[m - 1] + " " + y; };
const dmyShort = iso => { const [y, m, d] = iso.split("-").map(Number); return d + " " + MONTH_SHORT[m - 1] + " " + y; };
const BANK_AT = LIVE.bank ? LIVE.bank.asAt : (LIVE.config.openingDate || "2026-10-05");
const M = lib.PATIENT_MODEL, PR = lib.PRICES;

const f = n => (n < 0 ? "−" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lab = m => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m.slice(5) - 1] + " " + m.slice(2, 4);
const main = D.main, P = D.plans, c = P.central, dv = P.base;
const keepW = D.params.keepW, keepB = D.params.keepB, standAt = D.params.standAt;

// ── derived figures ──
const cumValue = (k, pf = 1) => (M.firstMonth + M.returnVisit * M.returns.slice(1, k + 1).reduce((s, v) => s + v, 0)) * pf;
const ret12 = M.returns.slice(1, 13).reduce((s, v) => s + v, 0), ret36 = M.returns.slice(1, 37).reduce((s, v) => s + v, 0);
const C36 = lib.monthsFrom("2026-10", 36), CS = lib.WINC_SCENARIOS.central;
const blendPf = C36.reduce((a, m) => a + CS.takings[m], 0) / C36.reduce((a, m) => a + CS.productCost[m] / PR.productShare, 0);
const perVisitB = 75408 / 561, perVisitW = perVisitB * blendPf;
const perWeek = t => t / perVisitW / (52 / 12);
const running = 5371.33, loanLevel = 364.3, kept3000 = 3000, salaryCost = 4755;
const billsAt = Math.round(running / (keepW / 100) / 100) * 100, salaryAt = Math.round((running + loanLevel + kept3000 + salaryCost) / (keepW / 100) / 100) * 100;
const flatO = { founding: { month: "2026-11", patients: 30, firstMonthTotal: 1184 }, firstCohort: "2026-12", founderPrice: PR.foundersVsBedhampton, listPrice: PR.listVsBedhampton, founderUntil: "2027-01" };
const flatAt = (n, m) => lib.wincForecast(M, { early: n, earlyUntil: "2027-02", start: n, growthPerMonth: 0, cap: n }, flatO, lib.monthsFrom("2026-10", 24))[m];
const extra5 = flatAt(21, "2027-12") - flatAt(16, "2027-12");
const fyKeys = ["FY26/27", "FY27/28", "FY28/29"];
const fyLabel = { "FY26/27": "Oct 2026 to Jul 2027", "FY27/28": "Aug 2027 to Jul 2028", "FY28/29": "Aug 2028 to Jul 2029" };
const salaryByFy = rows => Object.fromEntries(fyKeys.map(fy => [fy, rows.filter(r => r.fy === fy).reduce((s, r) => s + r.sal, 0)]));
const salNow = salaryByFy(main), salRelease = salaryByFy(D.release);

// ── chapter 3: the same treatments at each price (ANS Mar to Sep 2026, Launch OS product costs) ──
const TREAT = [
  ["Anti-wrinkle, three areas", 143, 215, 305, 60], ["Anti-wrinkle, two areas", 62, 181, 255, 40], ["Filler, 1ml", 48, 186, 300, 80],
  ["Filler, 0.5ml", 37, 137, 180, 35], ["Anti-wrinkle, one area", 28, 110, 190, 20], ["Microneedling, face", 22, 127, 215, 30],
  ["Filler, 2ml", 20, 284, 495, 160], ["Polynucleotides", 17, 179, 280, 70], ["Masseter", 6, 283, 335, 60],
];
const kept = (price, prod) => price * 5 / 6 - prod;
const treatRows = TREAT.map(([n, cnt, b, w, p]) => { const fo = w * 0.8, kb = kept(b, p), kw = kept(w, p), kf = kept(fo, p);
  return `<tr><td>${esc(n)}</td><td>${cnt}</td><td>${f(b)}</td><td>${f(w)}</td><td>${f(fo)}</td><td>${f(p)}</td><td>${f(kb)}</td><td class="strong">${f(kw)}</td><td>${f(kf)}</td><td class="up">+${f(kw - kb)}</td></tr>`; }).join("\n");
const per100 = pf => { const prod = 100 * PR.productShare / pf; return { vat: 100 / 6, prod, kept: 100 - 100 / 6 - prod }; };
const P100 = { b: per100(1), w: per100(PR.listVsBedhampton), fo: per100(PR.foundersVsBedhampton) };
const bar100 = (key, name, sub) => { const x = P100[key];
  return `<div class="hundred"><div class="h-head"><strong>${name}</strong><span>${sub}</span></div><div class="bar">
    <span class="seg s-vat" style="width:${x.vat.toFixed(2)}%"><em>VAT ${f(x.vat)}</em></span><span class="seg s-prod" style="width:${x.prod.toFixed(2)}%"><em>Products ${f(x.prod)}</em></span><span class="seg s-kept" style="width:${x.kept.toFixed(2)}%"><em>Kept ${f(x.kept)}</em></span></div></div>`; };

// ── chapter 4: the build and its VAT ──
const STAGE = { "2026-10": "first stage (20%)", "2026-11": "main stage (60%)", "2026-12": "final stage (17%)", "2027-05": "retention, held until snags are fixed (3%)" };
const itemOf = (t, ph, m) => /^Ref \d/.test(t) ? "CBS building work, " + (STAGE[m] || m)
  : /Arundel/.test(t) ? (m === "2026-10" ? "Fire alarm (Arundel), 30% on booking" : "Fire alarm (Arundel), 70% when finished")
  : /Signage Package/.test(t) ? "Shop sign, balance" : /Joinery/.test(t) ? "Joinery, reception desk and cabinetry"
  : /^FF&E/.test(ph) ? "Furniture and the couch" : /Injectable|Smallwares|FIGS/.test(t) ? "Opening stock, consumables and scrubs"
  : /Hamilton Fraser/.test(t) ? "Insurance for the year" : /Broadband|deep clean/i.test(t) ? "Broadband and deep clean"
  : /Meta Ads/.test(t) ? "Opening adverts, Facebook and Instagram" : /Google Ads/.test(t) ? "Opening adverts, Google"
  : /Retail \/ Skincare/.test(t) ? "Retail and skincare opening stock" : /Retail Shelving/.test(t) ? "Retail shelving and LED"
  : "Safety checks, waste contract and emergency kit";
const groups = new Map();
for (const l of LIVE.projectLines) {
  if (l.remainingExVat < 0.5) continue;
  const rate = l.vatBasis === "no VAT" ? 0 : 0.2;
  const parts = l.plan.length && !l.planProblem ? l.plan.map(p => [p.month, p.method === "card" ? "Card" : "Bank", p.share]) : [["none", "Not set", 1]];
  for (const [m, how, share] of parts) {
    const name = itemOf(l.title, l.phase, m), key = name + "|" + m + "|" + how;
    const g = groups.get(key) ?? { name, m, how, ex: 0, vat: 0 };
    g.ex += l.remainingExVat * share; g.vat += l.remainingExVat * share * rate; groups.set(key, g);
  }
}
const order = ["2026-10", "2026-11", "2026-12", "2027-05", "none"];
const build = [...groups.values()].sort((a, b) => order.indexOf(a.m) - order.indexOf(b.m) || (a.how > b.how ? 1 : -1) || b.ex - a.ex)
  .map(g => [g.name, g.ex, g.vat, g.m === "none" ? "No month set" : lab(g.m), g.how]);
const PAID = LIVE.paidToDate, BANK = LIVE.bank ? LIVE.bank.balanceGbp : LIVE.config.openingBank;
const unsched = LIVE.projectLines.filter(l => l.planProblem && l.remainingExVat >= 0.5);
const cardClears = (() => { const rows = LIVE.rows; let seen = false; for (const r of rows) { if (r.cardOwed > 0.5) seen = true; else if (seen) return r.label; } return null; })();
const nextM = { "Oct 26": "Nov 26", "Nov 26": "Dec 26", "Dec 26": "Jan 27", "May 27": "Jun 27" };
const buildEx = build.reduce((s, b) => s + b[1], 0), buildVat = build.reduce((s, b) => s + b[2], 0);
const cardEx = build.filter(b => b[4] === "Card").reduce((s, b) => s + b[1], 0), cardVat = build.filter(b => b[4] === "Card").reduce((s, b) => s + b[2], 0);
const buildRows = build.map(([w, ex, v, m, how]) => `<tr><td>${esc(w)}</td><td>${f(ex)}</td><td>${v > 0.5 ? f(v) : '<span class="muted">none</span>'}</td><td>${m}</td><td>${how}</td><td>${v > 0.5 && nextM[m] ? nextM[m] : '<span class="muted">n/a</span>'}</td></tr>`).join("\n");

// ── chapter 6: forecasts ──
const scen = ["central", "base", "low", "high"];
const scenName = { central: "Recommended", base: "David's forecast", low: "Slow", high: "Fast" };
const scenNew = { central: "22 a month to Feb 27, then 16 growing to 24", base: "about 30 a month needed", low: "10 a month", high: "26 to 36 a month" };
const forecastRows = scen.map(s => { const w = D.scenarios[s].winc; return `<tr><td><strong>${scenName[s]}</strong></td><td class="wrap-cell">${scenNew[s]}</td><td>${f(w["2027-06"])}</td><td>${f(w["2027-12"])}</td><td>${f(w["2028-06"])}</td><td>${f(w["2029-09"])}</td><td>${D.scenarios[s].stand ?? "After Sep 29"}</td></tr>`; }).join("\n");

// ── chapter 7: plans ──
const planName = { two: "Two days until Winchester stands alone", one: "One day from May 2027", april: "Close after April 2027" };
const planRows = scen.map(s => `<tr class="group"><td colspan="5"><strong>${scenName[s]}</strong></td></tr>\n` + ["two", "one", "april"].map(v => { const p = P[s][v];
  const low = p.low < 0 ? `<span class="bad">${f(p.low)} (${p.lowMonth})</span>` : p.low < 10000 ? `<span class="warn">${f(p.low)}</span>` : `${f(p.low)} (${p.lowMonth})`;
  return `<tr><td>${planName[v]}${v === "two" ? ' <span class="chip good">plan</span>' : ""}</td><td>${p.closes ? `from ${p.closes}` : "stays open"}</td><td>${low}</td><td>${f(p.end)}</td><td>${p.salary ? f(p.salary) : '<span class="bad">nothing</span>'}</td></tr>`; }).join("\n")).join("\n");

// ── chapters 8 and 9: monthly tables ──
const showMonths = main.filter((r, i) => i < 12 || ["2027-12", "2028-03", "2028-06", "2028-09", "2028-12", "2029-03", "2029-06", "2029-09"].includes(r.m));
const tint = v => { const a = Math.min(1, Math.abs(v) / 6000); return `style="background: color-mix(in srgb, var(${v >= 0 ? "--kept" : "--neg"}) ${Math.round(12 + a * 38)}%, transparent)"`; };
const plRows = showMonths.map((r, i) => (i === 12 ? `<tr class="gap"><td colspan="11">Then every three months</td></tr>\n` : "") + `<tr>
  <td>${r.l}${r.bd != null ? `<div class="sub">${r.bd === 0 ? "Winchester only" : `Bedhampton ${r.bd} days`}</div>` : ""}</td>
  <td>${r.bedh ? f(r.bedh) : '<span class="muted">closed</span>'}</td><td>${f(r.winc)}</td><td class="strong">${f(r.take)}</td>
  <td>${f(-r.vat)}</td><td>${f(-r.prod)}</td><td>${f(-r.run)}</td><td>${f(-(r.rent + r.rates))}</td><td>${r.int ? f(-r.int) : "£0"}</td><td>${r.pay ? f(-r.pay) : "£0"}</td><td class="strong" ${tint(r.kept)}>${f(r.kept)}</td></tr>`).join("\n");
const cashRows = showMonths.map((r, i) => (i === 12 ? `<tr class="gap"><td colspan="11">Then every three months</td></tr>\n` : "") + `<tr><td>${r.l}</td><td>${f(r.contrib)}</td><td>${r.fund ? f(r.fund) : ""}</td><td>${r.vatBack ? f(r.vatBack) : ""}</td><td>${r.proj || r.vatOut ? f(-(r.proj + r.vatOut)) : ""}</td><td>${r.rentPaid ? f(-r.rentPaid) : ""}</td><td>${f(-(r.rates + r.run))}</td><td>${r.cardRep ? f(-r.cardRep) : ""}</td><td>${r.loanRep ? `<span class="loan">${f(-r.loanRep)}</span>` : ""}</td><td>${r.pay ? f(-r.pay) : ""}</td><td><strong${r.bank < 10000 ? ' class="bad"' : ""}>${f(r.bank)}</strong></td></tr>`).join("\n");
const PL_KEYS = [["vat", "VAT to HMRC"], ["prod", "Products used"], ["run", "Running costs"], ["rent", "Rent and rates"], ["int", "Loan interest"], ["pay", "Abi's pay"], ["kept", "Kept in the business"]];
const fyBars = fyKeys.map(key => { const t = D.fy[key]; const take = t.grossBedh + t.grossWinc;
  const parts = [["vat", t.vat], ["prod", take - t.vat - t.contribution], ["run", t.runningTotal], ["rent", t.rentAccrued + t.rates], ["int", t.loanInterest], ["pay", t.payCost], ["kept", t.profitRetained]];
  const names = Object.fromEntries(PL_KEYS);
  return `<div class="fy"><div class="fy-head"><h3>${fyLabel[key]}</h3><span>${f(take)} of takings</span></div>
  <div class="bar tall" role="img" aria-label="${fyLabel[key]}: ${parts.map(([k2, v]) => `${names[k2]} ${f(v)}`).join(", ")}">${parts.map(([k2, v]) => `<span class="seg s-${k2}" style="width:${(100 * v / take).toFixed(2)}%" title="${names[k2]}: ${f(v)}"></span>`).join("")}</div>
  <ul class="fy-list">${parts.map(([k2, v]) => `<li><i class="dot s-${k2}"></i>${names[k2]}<b>${f(v)}</b><em>£${(100 * v / take).toFixed(0)} in every £100</em></li>`).join("")}</ul></div>`; }).join("\n");

// ── chart and engine data for the page ──
const chartData = {
  months36: main.map(r => r.l), bank: main.map(r => r.bank), bankDavid: D.david.map(r => r.bank),
  forecasts: Object.fromEntries(scen.map(s => [s, Object.values(D.scenarios[s].winc)])), standAt,
  bedhMonths: D.bedh.map(x => lab(x.m)), bedhTwo: D.bedh.map(x => x.two), bedhOne: D.bedh.map(x => x.one),
  calib: { months: ["Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"], actual: [12289, 8075, 15446, 13893, 9207, 6552, 10185], model: [11020, 10089, 13031, 11817, 11042, 8858, 9790] },
  valueB: Array.from({ length: 37 }, (_, i) => Math.round(cumValue(i))), valueW: Array.from({ length: 37 }, (_, i) => Math.round(cumValue(i, PR.listVsBedhampton))),
  treat: { names: TREAT.slice(0, 7).map(t => t[0]), b: TREAT.slice(0, 7).map(t => Math.round(kept(t[2], t[4]))), fo: TREAT.slice(0, 7).map(t => Math.round(kept(t[3] * .8, t[4]))), w: TREAT.slice(0, 7).map(t => Math.round(kept(t[3], t[4]))) },
};
const INPUTS = {
  opening: LIVE.bank ? LIVE.bank.openingUsed : LIVE.config.openingBank,
  funding: LIVE.funding, loans: LIVE.loans,
  payments: LIVE.projectLines.filter(l => l.remainingExVat >= 0.5 && !l.planProblem).flatMap(l => l.plan.map(p => [Math.round(l.remainingExVat * p.share * 100) / 100, p.method === "card" ? "card" : "bank", p.month, l.vatBasis === "no VAT" ? 0 : Math.round(l.remainingExVat * p.share * 20) / 100])),
};
const init = { closes: c.two.closes, low: c.two.low, lowMonth: c.two.lowMonth, salary: c.two.salary, regular: c.two.regular, end: c.two.end, stand: D.scenarios.central.stand };

const html = `<title>The Winchester Money Plan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<style>
/* Layout: a walkthrough in numbered chapters; a sticky contents rail on wide screens, a contents list on phones. Brand navy and slate for money that goes out, sage for Abi and the business. */
:root {
  --bg: #FFFFFF; --panel: #EFF3F8; --ink: #1F2A44; --muted: #5C6577; --line: #C3CCD9; --slate: #445B72; --sage: #A7C0B6; --sage-deep: #7FA49A;
  --good: #3F7A68; --watch: #8A5A12; --watch-bg: #F6EEDF; --bad: #A33A3A; --neg: #C98282;
  --vat: #D5DCE6; --prod: #A9B5C6; --run: #6F819A; --rent: #1F2A44; --int: #8A6D3B; --pay: #7FA49A; --kept: #A7C0B6;
  --font-display: "Source Serif 4", "Minion Pro", Georgia, serif; --font-body: "Mulish", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #131A2A; --panel: #1B2438; --ink: #E8EDF4; --muted: #A6B0C2; --line: #34405A; --slate: #9FB3CB; --sage: #7FA49A; --sage-deep: #A7C0B6;
  --good: #8CC7B3; --watch: #E6B866; --watch-bg: #2A2618; --bad: #EE9A9A; --neg: #9B4A4A;
  --vat: #3A4660; --prod: #55637D; --run: #7D90AB; --rent: #B9C7DB; --int: #C9A56A; --pay: #7FA49A; --kept: #A7C0B6; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #131A2A; --panel: #1B2438; --ink: #E8EDF4; --muted: #A6B0C2; --line: #34405A; --slate: #9FB3CB; --sage: #7FA49A; --sage-deep: #A7C0B6;
  --good: #8CC7B3; --watch: #E6B866; --watch-bg: #2A2618; --bad: #EE9A9A; --neg: #9B4A4A;
  --vat: #3A4660; --prod: #55637D; --run: #7D90AB; --rent: #B9C7DB; --int: #C9A56A; --pay: #7FA49A; --kept: #A7C0B6; color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 17px; line-height: 1.7; padding-inline: 20px; padding-block: 36px 72px; }
.layout { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }
@media (min-width: 1100px) { .layout { grid-template-columns: 230px minmax(0, 1fr); } }
.rail { display: none; }
@media (min-width: 1100px) { .rail { display: block; position: sticky; top: env(safe-area-inset-top, 0px); align-self: start; padding-top: 8px; max-height: 100vh; overflow-y: auto; } }
.rail ol, .toc ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; counter-reset: ch; font-size: 14px; }
.rail li, .toc li { counter-increment: ch; }
.rail a, .toc a { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 4px; padding: 5px 8px; border-radius: 2px; color: var(--muted); text-decoration: none; line-height: 1.35; }
.rail a::before, .toc a::before { content: counter(ch); font-variant-numeric: tabular-nums; color: var(--sage-deep); font-weight: 700; }
.rail a:hover, .toc a:hover, .rail a.on { background: var(--panel); color: var(--ink); }
.rail .eyebrow { display: block; margin: 0 0 10px 8px; }
main { max-width: 820px; display: grid; gap: 64px; min-width: 0; }
header { display: grid; gap: 12px; }
.eyebrow { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--slate); font-weight: 700; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 600; text-wrap: balance; line-height: 1.2; margin: 0; }
h1 { font-size: clamp(34px, 6vw, 48px); } h2 { font-size: clamp(24px, 3.6vw, 30px); } h3 { font-size: 20px; }
p { margin: 0; max-width: 68ch; } .lede { font-size: 19px; color: var(--muted); }
section { display: grid; gap: 18px; min-width: 0; scroll-margin-top: 16px; }
.ch-head { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 14px; align-items: start; border-top: 1px solid var(--line); padding-top: 28px; }
.ch-num { font-family: var(--font-display); font-size: 30px; font-weight: 600; color: var(--sage-deep); line-height: 1; padding-top: 4px; font-variant-numeric: lining-nums; }
.ch-head .q { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-bottom: 4px; }
.answer { background: var(--panel); border-radius: 2px; padding: 14px 18px; max-width: none; }
.answer strong:first-child { color: var(--slate); }
.toc { background: var(--panel); border-radius: 2px; padding: 18px 16px; }
.toc h2 { font-size: 20px; margin: 0 0 8px 8px; }
@media (min-width: 1100px) { .toc { display: none; } }
ul, ol { margin: 0; padding-left: 1.2em; display: grid; gap: 8px; max-width: 68ch; }
.changed { border: 1px solid var(--sage-deep); border-radius: 2px; padding: 16px 18px; display: grid; gap: 8px; }
.short ul li::marker { color: var(--sage-deep); }
dl.words { display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr); gap: 14px 24px; margin: 0; }
dl.words dt { font-weight: 700; } dl.words dd { margin: 0; } dl.words dd span { color: var(--muted); }
@media (max-width: 560px) { dl.words { grid-template-columns: minmax(0, 1fr); gap: 4px; } dl.words dd { margin-bottom: 12px; } }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 2px; }
table { border-collapse: collapse; width: 100%; font-size: 14.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 11px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); vertical-align: top; }
th:first-child, td:first-child { text-align: left; }
thead th { font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; background: var(--panel); }
tbody tr:last-child td { border-bottom: 0; }
tr.gap td, tr.group td { color: var(--muted); font-size: 13px; background: var(--panel); text-align: left; }
tr.group td { color: var(--ink); font-size: 14.5px; }
td.wrap-cell { white-space: normal; min-width: 180px; text-align: left; }
td .sub { font-size: 11.5px; color: var(--muted); }
td.strong, .strong { font-weight: 700; } td.up { color: var(--good); font-weight: 700; }
.muted { color: var(--muted); } .bad { color: var(--bad); font-weight: 700; } .warn { color: var(--watch); font-weight: 700; } .loan { color: var(--int); font-weight: 700; }
th i.dot, .legend i, .fy-list .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; }
.note { font-size: 14px; color: var(--muted); }
.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.fig { border: 1px solid var(--line); border-radius: 2px; padding: 14px 16px; display: grid; gap: 4px; align-content: start; }
.fig b { font-family: var(--font-display); font-size: 28px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums lining-nums; }
.fig span { font-size: 14px; color: var(--muted); line-height: 1.5; }
.chart { position: relative; height: 290px; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; color: var(--muted); }
.legend i.line { height: 0; border-top: 2px dashed var(--sage-deep); border-radius: 0; width: 18px; vertical-align: 4px; }
.steps { counter-reset: s; list-style: none; padding: 0; display: grid; gap: 14px; }
.steps li { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; align-items: start; }
.steps li::before { counter-increment: s; content: counter(s); font-family: var(--font-display); font-weight: 600; font-size: 18px; width: 30px; height: 30px; border: 1px solid var(--sage-deep); border-radius: 50%; display: grid; place-items: center; line-height: 1; margin-top: 2px; }
.chip { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 1px 7px; border-radius: 2px; vertical-align: 2px; margin-right: 6px; }
.chip.watch { background: var(--watch-bg); color: var(--watch); } .chip.decide { background: var(--panel); color: var(--slate); border: 1px solid var(--line); } .chip.good { background: var(--panel); color: var(--good); border: 1px solid var(--line); }
.callout { border: 1px solid var(--line); border-radius: 2px; padding: 18px 20px; display: grid; gap: 10px; }
.callout h3 { font-size: 19px; }
.discuss { border-left: 3px solid var(--sage-deep); padding: 6px 0 6px 14px; border-radius: 0; font-size: 15.5px; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
.bar { display: flex; height: 30px; border-radius: 2px; overflow: hidden; background: var(--panel); }
.bar.tall { height: 30px; }
.seg { display: flex; align-items: center; justify-content: center; height: 100%; overflow: hidden; }
.seg em { font-style: normal; font-size: 12px; font-weight: 700; white-space: nowrap; color: var(--ink); padding: 0 4px; }
.s-rent em, .s-run em { color: #fff; }
.s-vat { background: var(--vat); } .s-prod { background: var(--prod); } .s-run { background: var(--run); } .s-rent { background: var(--rent); } .s-int { background: var(--int); } .s-pay { background: var(--pay); } .s-kept { background: var(--kept); }
.hundred { display: grid; gap: 6px; } .hundred .h-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 15px; } .hundred .h-head span { color: var(--muted); }
.hundred .bar { height: 38px; }
.fy { display: grid; gap: 10px; padding: 16px 0 4px; border-bottom: 1px solid var(--line); }
.fy-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px; }
.fy-head span { color: var(--muted); font-variant-numeric: tabular-nums; }
.fy-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 4px 20px; max-width: none; font-size: 14.5px; }
.fy-list li { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; column-gap: 6px; align-items: baseline; }
.fy-list b { font-variant-numeric: tabular-nums; } .fy-list em { grid-column: 2 / 4; font-style: normal; font-size: 12.5px; color: var(--muted); }
/* Try it yourself */
.tool { border: 1px solid var(--line); border-radius: 2px; padding: 18px; display: grid; gap: 16px; background: var(--bg); }
.ctrl { display: grid; gap: 8px; } .ctrl > label, .ctrl > .lbl { font-weight: 700; font-size: 15px; }
.seg-ctl { display: flex; flex-wrap: wrap; gap: 6px; }
.seg-ctl button { font: inherit; font-size: 14px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 2px; background: var(--bg); color: var(--ink); cursor: pointer; }
.seg-ctl button[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.seg-ctl button:hover { border-color: var(--slate); }
.slider { display: flex; align-items: center; gap: 12px; } .slider input { flex: 1; accent-color: var(--slate); } .slider output { min-width: 3.5em; font-weight: 700; font-variant-numeric: tabular-nums; }
.results { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.res { background: var(--panel); border-radius: 2px; padding: 12px 14px; display: grid; gap: 2px; }
.res span { font-size: 12.5px; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; font-weight: 700; }
.res b { font-family: var(--font-display); font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums lining-nums; line-height: 1.2; }
.res em { font-style: normal; font-size: 13px; color: var(--muted); }
.res.bad b { color: var(--bad); }
footer { font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 20px; display: grid; gap: 6px; }
a { color: var(--slate); }
:focus-visible { outline: 2px solid var(--sage-deep); outline-offset: 2px; }
</style>

<div class="layout">
<nav class="rail" aria-label="Chapters"><span class="eyebrow">Chapters</span><ol id="rail"></ol></nav>
<main>

<header>
  <div class="eyebrow">Abi Peters Skin Clinic · ${dmy(asOf)} · live from Launch OS</div>
  <h1>The Winchester Money Plan</h1>
  <p class="lede">A walkthrough of the money behind the move to Winchester, for David and Abi to go through together, chapter by chapter. Every figure comes from the Money page in Launch OS, which now works from our own patient records and the prices patients actually pay.</p>
  <div class="changed"><strong>What changed in this version</strong><p>Brought up to today's cash position. The bank was ${f(BANK)} on ${dm(BANK_AT)}, after ${f(PAID)} already paid, including the rent deposit and the solicitor, so those are no longer in the bills below. Arundel now does the fire alarm (${f(1368)}, 30% on booking and 70% when finished) in place of Croma, the furniture and opening stock are as they now stand in the plan, with reception and treatment room 1 priced item by item from the 10 October layout pack, and CBS at their revised price of ${f(69362)} before VAT, and the card carries ${f(cardEx + cardVat)}. ${unsched.length ? `Two lines have no payment month yet, so the forecast leaves them out: the retail shelving and LED and the retail and skincare opening stock (${f(unsched.reduce((a, l) => a + l.remainingExVat, 0))} before VAT between them).` : ""} Version 3's change still stands: Winchester's real prices keep about ${f(163)} a treatment against ${f(93)} at Bedhampton (chapter 3).</p></div>
</header>

<nav class="toc" aria-label="Contents"><h2>Contents</h2><ol id="toc"></ol></nav>

<section id="stand" data-title="Where we stand">
  <div class="ch-head"><span class="ch-num">1</span><div><div class="q">The big picture</div><h2>Where we stand</h2></div></div>
  <div class="short"><ul>
    <li><strong>The money to open Winchester is there.</strong> The bank's lowest point is about ${f(c.two.low)} in December 2026, when the last building bill and the first rent land together. It never drops below our £10,000 safety net.</li>
    <li><strong>Winchester earns much more per appointment.</strong> The same treatment keeps about ${f(163)} at Winchester's prices against ${f(93)} at Bedhampton, because the prices are about 48% higher and the products cost the same.</li>
    <li><strong>But Winchester will take time to get busy.</strong> On our own records it takes about ${f(D.scenarios.central.winc["2027-06"])} a month by June 2027. David's forecast of £14,700 would need about 30 new patients a month from December; Bedhampton finds about 23.</li>
    <li><strong>Bedhampton stays open two days a week until Winchester stands on its own</strong>, then closes. On the recommended forecast that is ${c.two.closes === "Dec 28" ? "December 2028" : c.two.closes}; on David's forecast, ${dv.two.closes === "Aug 27" ? "August 2027" : dv.two.closes}.</li>
    <li><strong>Abi is paid from ${c.two.regular === "May 27" ? "May 2027" : c.two.regular}</strong>: about ${f(c.two.salary)} over three years under today's rule, or about ${f(c.release.salary)} if the business stops keeping £3,000 a month once the bank has £25,000.</li>
    <li><strong>The number to watch is new patients at Winchester each month.</strong> 16 to 24 is the recommended forecast; about 30 is David's.</li>
  </ul></div>
</section>

<section id="words" data-title="Words you'll see">
  <div class="ch-head"><span class="ch-num">2</span><div><div class="q">Before we start</div><h2>Words you'll see</h2></div></div>
  <dl class="words">
    <dt>Takings</dt><dd>What patients pay us, in total, including VAT.</dd>
    <dt>VAT</dt><dd>20% is added to everything we sell, so £20 of every £120 a patient pays goes to HMRC. <span>One sixth of takings is never ours.</span></dd>
    <dt>Kept</dt><dd>What is left of takings after VAT and the products used. It pays the bills. <span>Accountants call it the contribution.</span></dd>
    <dt>New patients</dt><dd>People coming to us for the first time. Everything grows from these.</dd>
    <dt>Return visits</dt><dd>A patient coming back. On our records a new patient comes back about ${ret12.toFixed(1)} times in their first year and keeps coming after that.</dd>
    <dt>Founders' prices</dt><dd>20% off the Winchester list for our founding patients. Still about 18% more than Bedhampton charges.</dd>
    <dt>The forecast</dt><dd>Our estimate of Winchester's takings month by month as it gets busier. <span>It has nothing to do with the £10,000 below.</span></dd>
    <dt>The £10,000 safety net</dt><dd>The least we ever want in the business bank account.</dd>
    <dt>Standing on its own</dt><dd>Winchester's own takings pay all the running costs, James's loan and the £3,000 a month the business keeps: about ${f(standAt)} a month.</dd>
    <dt>Interest and repayment</dt><dd>James's loan costs 5% a year. The interest, about £40 a month, is a cost in the profit and loss. The rest of each £364 repayment hands back the money he lent: real money leaving the bank, but not a cost.</dd>
    <dt>Cash and profit</dt><dd>Profit is what we earn in a month; cash is what is in the bank. Rent paid three months at a time, VAT on the build coming back a month later, and the loan and card being repaid slowly all make them differ.</dd>
  </dl>
</section>

<section id="per-appointment" data-title="Why Winchester makes more">
  <div class="ch-head"><span class="ch-num">3</span><div><div class="q">David's question</div><h2>Our prices are much higher, so why is the profit only a few pence more?</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> per pound, Winchester keeps ${(P100.w.kept).toFixed(0)}p against Bedhampton's ${(P100.b.kept).toFixed(0)}p, only 10p more. Per appointment it keeps about ${f(163)} against ${f(93)}, 75% more. Both are true. The pounds per appointment are what pay the bills.</p>
  <p>Take £100 of takings at each price. VAT always takes a sixth, however high the price. The products cost the same in pounds wherever Abi uses them, so at higher prices they are a smaller slice. The extra pence come only from that smaller slice, which is why the percentage moves less than you'd expect.</p>
  ${bar100("b", "£100 at Bedhampton", "what patients actually paid")}
  ${bar100("w", "£100 at Winchester's list prices", "1.48 times Bedhampton")}
  ${bar100("fo", "£100 at founders' prices", "20% off the list")}
  <p>Now per appointment. These are the treatments Bedhampton actually sold from March to September 2026, at what patients paid, set against the Winchester list for the same thing:</p>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--prod)"></i>Kept at Bedhampton</span><span><i style="background: var(--pay)"></i>Kept at founders' prices</span><span><i style="background: var(--ink)"></i>Kept at Winchester's list</span></div>
  <div class="chart" style="height:330px"><canvas id="treat" role="img" aria-label="What each treatment keeps after VAT and products: for three areas of anti-wrinkle, about 119 at Bedhampton, 143 at founders' prices and 194 at the Winchester list; for 1ml of filler, 75, 120 and 170.">Three areas: £119 Bedhampton, £194 Winchester. Filler 1ml: £75 Bedhampton, £170 Winchester.</canvas></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Treatment</th><th>Sold</th><th>Bedhampton charged</th><th>Winchester list</th><th>Founders</th><th>Products</th><th>Kept, Bedhampton</th><th>Kept, Winchester</th><th>Kept, founders</th><th>Extra per treatment</th></tr></thead>
    <tbody>
${treatRows}
      <tr class="group"><td><strong>All 427 treatments</strong></td><td></td><td>${f(75023)}</td><td>${f(111045)}</td><td>${f(111045 * .8)}</td><td>${f(22940)}</td><td>${f(93)} each</td><td class="strong">${f(163)} each</td><td>${f(120)} each</td><td class="up">+${f(70)} each</td></tr>
    </tbody>
  </table></div>
  <p class="note">"Bedhampton charged" is the average patients actually paid in ANS, which is lower than the Bedhampton prices in Launch OS (for example £215 for three areas against £235 listed). Product costs are the Launch OS estimates; polynucleotides had none, so £70 is assumed. Needles, gloves and card fees are not included at either site.</p>
  <div class="discuss"><strong>What it means for the plan:</strong> Winchester needs fewer patients to pay its way. It stands on its own at about ${f(standAt)} a month, around ${Math.round(perWeek(standAt))} appointments a week, which is about what Bedhampton sees today (18).</div>
  <div class="discuss"><strong>To talk about:</strong> how many Winchester patients will be founders? Every founder keeps about ${f(43)} less per treatment than a list-price patient (${f(120)} against ${f(163)}).</div>
</section>

<section id="opening" data-title="The money to open">
  <div class="ch-head"><span class="ch-num">4</span><div><div class="q">Where it comes from and where it goes</div><h2>The money to open, and the VAT on it</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> about ${f(buildEx)} of building and set-up still to pay, plus ${f(buildVat)} of VAT that HMRC pays back the month after. We had ${f(BANK)} in the bank on ${dm(BANK_AT)}, £47,000 coming from James and Bill, James's £10,000 loan and ${f(cardEx + cardVat)} on the card.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Money in</th><th>Amount</th><th>When</th><th>What it costs us</th></tr></thead>
    <tbody>
      <tr><td>Business bank account</td><td>${f(BANK)}</td><td>${dmyShort(BANK_AT)}</td><td class="wrap-cell">Already ours, after the ${f(PAID)} already paid (rent deposit, solicitor, design and Building Control, surveys, brand design, the skin analysis platform and the sign deposit).</td></tr>
      <tr><td>James Gibbons, for shares</td><td>£37,000</td><td>Oct 2026</td><td class="wrap-cell">James owns 10% of the company. Nothing to pay back.</td></tr>
      <tr><td>Bill Peters, a gift</td><td>£10,000</td><td>Oct 2026</td><td class="wrap-cell">Nothing to pay back.</td></tr>
      <tr><td>James Gibbons, a loan</td><td>£10,000</td><td>End Nov 2026</td><td class="wrap-cell">5% a year. Nothing to pay for six months, then about £364 a month for 30 months (June 2027 to November 2029): about £10,929 in total. James also gets 1% more of the company.</td></tr>
      <tr><td>Credit card at 0%</td><td>${f(cardEx + cardVat)}</td><td>Oct to Dec 2026</td><td class="wrap-cell">Build and opening purchases only (${f(cardEx)} plus ${f(cardVat)} VAT, which comes back). Repaid at about ${f((cardEx + cardVat) / 24)} a month, cleared by ${cardClears ? cardClears.replace(/(\w+) (\d+)/, (x, mo, y) => ({ Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" })[mo] + " 20" + y) : "the end"}.</td></tr>
    </tbody>
  </table></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Money out, once</th><th>Before VAT</th><th>VAT</th><th>Paid</th><th>How</th><th>VAT back</th></tr></thead>
    <tbody>
${buildRows}
      <tr class="group"><td><strong>Total</strong></td><td><strong>${f(buildEx)}</strong></td><td><strong>${f(buildVat)}</strong></td><td class="wrap-cell" colspan="3">${unsched.length ? `${f(unsched.reduce((a, l) => a + l.remainingExVat, 0))} of it has no month yet` : ""}</td></tr>
    </tbody>
  </table></div>
  <p class="note">We run monthly VAT returns, so the VAT on each bill normally comes back the month after. Insurance carries no VAT; the opening adverts are reverse charged, so no VAT changes hands. Ownership: today Abi and David own half each; from October 45%, 45% and 10% for James, then 44.5%, 44.5% and 11% once James's extra 1% is issued.</p>
</section>

<section id="running" data-title="What Winchester costs to run">
  <div class="ch-head"><span class="ch-num">5</span><div><div class="q">The monthly bills</div><h2>What Winchester costs to run, and when it stands on its own</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> £5,371 a month, plus James's £364 from June 2027 and the £3,000 the business keeps. Winchester covers all of that on its own at about ${f(standAt)} a month of takings.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Cost</th><th>A month</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Rent</td><td>£2,708</td><td class="wrap-cell">£32,500 a year, paid three months ahead: £7,301 on 25 December 2026, then £8,125 on 25 March, 24 June, 29 September and 25 December.</td></tr>
      <tr><td>Business rates</td><td>£1,333</td><td class="wrap-cell">From October 2026.</td></tr>
      <tr><td>Electricity, water and heating</td><td>£280</td><td class="wrap-cell">£210 during the build.</td></tr>
      <tr><td>Everyday business costs</td><td>£450</td><td class="wrap-cell">Software, accountant, bank, card machine.</td></tr>
      <tr><td>Advertising</td><td>£600</td><td class="wrap-cell">From the bank. Bedhampton's adverts to November, Winchester's from December.</td></tr>
      <tr class="group"><td><strong>Total</strong></td><td><strong>£5,371</strong></td><td class="wrap-cell">Plus fire alarm servicing, about £220 once a year.</td></tr>
    </tbody>
  </table></div>
  <div class="figures">
    <div class="fig"><b>${f(billsAt)}</b><span>pays Winchester's own bills. About ${Math.round(perWeek(billsAt))} appointments a week.</span></div>
    <div class="fig"><b>${f(standAt)}</b><span>also pays James's loan and the £3,000 kept: Winchester stands on its own. About ${Math.round(perWeek(standAt))} a week.</span></div>
    <div class="fig"><b>${f(salaryAt)}</b><span>also pays Abi's full salary. About ${Math.round(perWeek(salaryAt))} a week.</span></div>
  </div>
  <p class="note">At Winchester's prices, with founders mixed in, an average appointment brings in about ${f(perVisitW)} and Winchester keeps about ${keepW.toFixed(0)}p in the pound.</p>
</section>

<section id="forecast" data-title="How busy Winchester will get">
  <div class="ch-head"><span class="ch-num">6</span><div><div class="q">The deep dive</div><h2>How busy will Winchester get?</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> plan on the middle forecast: about ${f(D.scenarios.central.winc["2027-06"])} a month by June 2027, standing on its own by ${D.scenarios.central.stand === "Nov 28" ? "November 2028" : D.scenarios.central.stand}. David's forecast needs about 30 new patients a month from December; Bedhampton finds about 23.</p>
  <p>The forecast is built from patients, using Bedhampton's own records since 2024, in three steps:</p>
  <ol class="steps">
    <li><div><strong>New patients.</strong> Bedhampton has found about 23 a month for two years: ${D.params.newAvg2025} a month in 2025 and ${D.params.newAvg2026} in 2026.</div></li>
    <li><div><strong>Their first month.</strong> A new patient spends about £${D.params.firstMonth} in their first month at Bedhampton prices.</div></li>
    <li><div><strong>Return visits.</strong> They come back about ${ret12.toFixed(1)} times in the first year and ${ret36.toFixed(1)} times over three, at about £${D.params.returnVisit} a visit. So a Bedhampton patient is worth about ${f(cumValue(12))} in their first year; the same patient at Winchester's list prices about ${f(cumValue(12, PR.listVsBedhampton))}.</div></li>
  </ol>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--ink)"></i>At Winchester's list prices</span><span><i style="background: var(--prod)"></i>At Bedhampton's prices</span></div>
  <div class="chart" style="height:220px"><canvas id="value" role="img" aria-label="What an average new patient has spent by each month since their first visit: about ${Math.round(cumValue(12))} after a year at Bedhampton prices, about ${Math.round(cumValue(12, PR.listVsBedhampton))} at Winchester's list prices.">About ${f(cumValue(12))} after a year at Bedhampton, ${f(cumValue(12, PR.listVsBedhampton))} at Winchester.</canvas></div>
  <p><strong>We checked it against real takings.</strong> Run through the model, Bedhampton's own new patients give £75,646 for March to September 2026, exactly what Bedhampton took. Single months wobble by a couple of thousand, as real months do.</p>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--sage)"></i>What Bedhampton took</span><span><i style="background: var(--slate)"></i>What the model says</span></div>
  <div class="chart" style="height:210px"><canvas id="calib" role="img" aria-label="Bedhampton takings March to September 2026, actual against the model: seven months total 75,646 both ways.">Actual and model both £75,646.</canvas></div>
  <p><strong>Then Winchester.</strong> It starts with the 30 founding bookings in November. Founders (November to January) pay founders' prices; everyone after pays the list.</p>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--ink)"></i>Recommended</span><span><i style="background: var(--int)"></i>David's forecast</span><span><i style="background: var(--sage-deep)"></i>Fast</span><span><i style="background: var(--prod)"></i>Slow</span><span><i class="line"></i>Stands on its own</span></div>
  <div class="chart"><canvas id="forecasts" role="img" aria-label="Winchester monthly takings under four forecasts against the ${standAt} a month it needs to stand on its own.">Recommended crosses the line in late 2028; David's in summer 2027.</canvas></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Forecast</th><th>New patients a month</th><th>Jun 27</th><th>Dec 27</th><th>Jun 28</th><th>Sep 29</th><th>Stands on its own</th></tr></thead>
    <tbody>
${forecastRows}
    </tbody>
  </table></div>
  <div class="callout"><h3><span class="chip good">Recommended</span>Plan on the middle forecast</h3>
    <p>It assumes Winchester finds new patients at about Bedhampton's rate: 22 a month for the first three months, helped by the founders and the warm list, then 16 a month growing to 24 as word spreads. That matches what we can see: Bedhampton finds 23 a month after two years, and Winchester has 30 founding bookings, none since 26 September.</p>
    <p>David's forecast needs about 30 a month from December. It's possible, and if the first three months show that pace we switch to it.</p></div>
  <div class="discuss"><strong>To talk about:</strong> what would get Winchester to 25 or more new patients a month? Every extra 5 new patients a month adds about ${f(Math.round(extra5 / 100) * 100)} a month of takings within a year.</div>
</section>

<section id="bedhampton" data-title="Abi's week and Bedhampton">
  <div class="ch-head"><span class="ch-num">7</span><div><div class="q">Abi's week</div><h2>One day or two at Bedhampton, and when to close</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> two days a week at Bedhampton, three at Winchester, until Winchester stands on its own for two months running. Then close Bedhampton and invite its patients to Winchester.</p>
  <p>Bedhampton today sees about 18 appointments a week over three or four clinic days, but a typical day has only 2.3 hours booked, so its regulars can fit into fewer days. Once Winchester opens, Bedhampton's adverts move to Winchester and its takings drift down slowly.</p>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--sage)"></i>Bedhampton on two days</span><span><i style="background: var(--prod)"></i>Bedhampton on one day</span></div>
  <div class="chart" style="height:230px"><canvas id="bedh" role="img" aria-label="Bedhampton monthly takings on two days (about 7,700 falling to 6,200) against one day (about 6,000 falling to 3,800).">Two days about £7,700 falling to £6,200; one day about £6,000 falling to £3,800.</canvas></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Plan</th><th>Bedhampton</th><th>Lowest bank</th><th>Bank, Sep 29</th><th>Abi's pay, 3 years</th></tr></thead>
    <tbody>
${planRows}
    </tbody>
  </table></div>
  <ol class="steps">
    <li><div><strong>Two days, not one.</strong> The second day brings in about £2,000 a month, around £1,100 of it kept. One day saves Abi a day's travel but costs her about ${f(c.two.salary - c.one.salary)} of pay over three years on the recommended forecast.</div></li>
    <li><div><strong>Don't close on a date.</strong> Closing after April 2027 cuts Abi's pay to about ${f(c.april.salary)} over three years on the recommended forecast, and on the slow one it runs the bank out of money.</div></li>
    <li><div><strong>Close when Winchester stands on its own:</strong> about ${f(standAt)} a month for two months running, around ${Math.round(perWeek(standAt))} appointments a week, with its three days about 36% booked. We've assumed 15% of Bedhampton's patients follow.</div></li>
    <li><div><strong>Room isn't the issue.</strong> Winchester's three days can hold about ${f(D.params.winc3dayCap)} a month. The reason to close Bedhampton is money, not space.</div></li>
  </ol>
  <div class="discuss"><strong>To talk about:</strong> is two days at Bedhampton workable for Abi until then? If not, one day is the fallback: it keeps the bank safe and costs pay, not safety.</div>
</section>

<section id="pl" data-title="The profit and loss">
  <div class="ch-head"><span class="ch-num">8</span><div><div class="q">Profit and loss, in colour</div><h2>Where each year's takings go</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> of every £100 taken in 2027/28, about £${Math.round(100 * D.fy["FY27/28"].profitRetained / (D.fy["FY27/28"].grossBedh + D.fy["FY27/28"].grossWinc))} is kept in the business and £${Math.round(100 * D.fy["FY27/28"].payCost / (D.fy["FY27/28"].grossBedh + D.fy["FY27/28"].grossWinc))} goes on Abi's pay. Blues go out, greens are ours.</p>
  <div class="legend" aria-hidden="true">${PL_KEYS.map(([k2, n]) => `<span><i class="s-${k2}"></i>${n}</span>`).join("")}</div>
${fyBars}
  <p class="note">The first year runs October to July (the plan starts in October); later years run August to July, the company's financial year. When Bedhampton closes in December 2028, takings dip but more of each pound is kept.</p>
  <h3>Month by month</h3>
  <div class="table-wrap"><table>
    <thead><tr><th>Month</th><th>Bedhampton</th><th>Winchester</th><th>Takings</th><th><i class="dot s-vat"></i>VAT</th><th><i class="dot s-prod"></i>Products</th><th><i class="dot s-run"></i>Running</th><th><i class="dot s-rent"></i>Rent, rates</th><th><i class="dot s-int"></i>Interest</th><th><i class="dot s-pay"></i>Abi's pay</th><th><i class="dot s-kept"></i>Kept</th></tr></thead>
    <tbody>
${plRows}
    </tbody>
  </table></div>
  <p class="note">Green shading grows with the amount kept. Rent shows as £2,708 every month here because the profit and loss spreads it evenly; the bank pays it every three months, as the next chapter shows.</p>
</section>

<section id="cash" data-title="Money in and out">
  <div class="ch-head"><span class="ch-num">9</span><div><div class="q">Cash</div><h2>Money in and out each month</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> the bank's tight spot is December 2026 (${f(c.two.low)}). After that it builds steadily, with a dip each rent quarter, to about ${f(c.two.end)} by September 2029. <span class="loan">James's repayments</span> show from June 2027.</p>
  <div class="legend" aria-hidden="true"><span><i style="background: var(--slate)"></i>Bank, recommended plan</span><span><i style="background: var(--int)"></i>Bank, David's forecast</span><span><i class="line"></i>£10,000 safety net</span></div>
  <div class="chart"><canvas id="bank" role="img" aria-label="Bank balance each month: lowest about ${Math.round(c.two.low)} in December 2026, about ${Math.round(c.two.end)} by September 2029.">Lowest ${f(c.two.low)} in December 2026.</canvas></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Month</th><th>From patients</th><th>Funding</th><th>VAT back</th><th>Build, with VAT</th><th>Rent</th><th>Rates, running</th><th>Card</th><th>James's loan</th><th>Abi's pay</th><th>Bank</th></tr></thead>
    <tbody>
${cashRows}
    </tbody>
  </table></div>
  <p class="note">"From patients" is takings after VAT and products. In December 2026 the last big CBS bill and the first rent go out together, just as November's VAT comes back. If HMRC were slow with that refund, December would dip towards the safety net, so file November's return promptly.</p>
</section>

<section id="pay" data-title="Abi's pay">
  <div class="ch-head"><span class="ch-num">10</span><div><div class="q">The hard part</div><h2>How Abi gets paid, and the rule to decide</h2></div></div>
  <p class="answer"><strong>Short answer:</strong> regular pay from ${c.two.regular === "May 27" ? "May 2027" : c.two.regular}, about ${f(c.two.salary)} over three years, while the bank grows to about ${f(c.two.end)}. The £3,000 the business keeps each month is what holds it back.</p>
  <ol class="steps">
    <li><div><strong>Winchester has to make a profit by itself</strong> for two months running before anything is paid.</div></li>
    <li><div><strong>The business keeps the first £3,000</strong> of each month's profit, after James's repayment.</div></li>
    <li><div><strong>Abi takes the rest as salary</strong>, up to £4,189 a month, the top of the basic tax band.</div></li>
    <li><div><strong>The company adds employer's National Insurance</strong>, so the full salary costs about £4,755 a month.</div></li>
  </ol>
  <div class="table-wrap"><table>
    <thead><tr><th>Abi's salary</th>${fyKeys.map(k2 => `<th>${fyLabel[k2]}</th>`).join("")}<th>Aug to Sep 2029</th><th>3 years</th><th>Bank, Sep 29</th></tr></thead>
    <tbody>
      <tr><td>Keep £3,000 every month (today's rule)</td>${fyKeys.map(k2 => `<td>${f(salNow[k2])}</td>`).join("")}<td>${f(c.two.salary - fyKeys.reduce((a, k2) => a + salNow[k2], 0))}</td><td><strong>${f(c.two.salary)}</strong></td><td>${f(c.two.end)}</td></tr>
      <tr><td>Stop keeping it once the bank has £25,000</td>${fyKeys.map(k2 => `<td>${f(salRelease[k2])}</td>`).join("")}<td>${f(c.release.salary - fyKeys.reduce((a, k2) => a + salRelease[k2], 0))}</td><td><strong>${f(c.release.salary)}</strong></td><td>${f(c.release.end)}</td></tr>
    </tbody>
  </table></div>
  <p class="note">Either way the bank's lowest point stays at ${f(c.two.low)} in December 2026. Salary rather than dividends, because a dividend would be shared with James as a shareholder; the accountant should confirm.</p>
  <div class="discuss"><strong>To talk about:</strong> keep the £3,000 rule, or stop it once the bank has £25,000? Chapter 11 lets you see both.</div>
</section>

<section id="try" data-title="Try it yourself">
  <div class="ch-head"><span class="ch-num">11</span><div><div class="q">What if</div><h2>Try it yourself</h2></div></div>
  <p class="answer"><strong>How to use it:</strong> pick a forecast or set your own number of new patients, choose what happens to Bedhampton and the pay rule. The same engine as the Money page works it all out as you go.</p>
  <div class="tool" id="tool">
    <div class="ctrl"><span class="lbl" id="l-fc">Winchester forecast</span>
      <div class="seg-ctl" role="group" aria-labelledby="l-fc" data-key="forecast">
        <button type="button" data-v="central" aria-pressed="true">Recommended</button><button type="button" data-v="base" aria-pressed="false">David's forecast</button><button type="button" data-v="low" aria-pressed="false">Slow</button><button type="button" data-v="high" aria-pressed="false">Fast</button><button type="button" data-v="custom" aria-pressed="false">My own number</button>
      </div>
      <div class="slider"><label for="n" class="note">New patients a month from March 2027</label><input id="n" type="range" min="6" max="40" step="1" value="16"><output id="n-out" for="n">16</output></div>
    </div>
    <div class="ctrl"><span class="lbl" id="l-bd">Bedhampton</span>
      <div class="seg-ctl" role="group" aria-labelledby="l-bd" data-key="bedh">
        <button type="button" data-v="two" aria-pressed="true">Two days until Winchester stands alone</button><button type="button" data-v="one" aria-pressed="false">One day from May 2027</button><button type="button" data-v="april" aria-pressed="false">Close after April 2027</button><button type="button" data-v="never" aria-pressed="false">Never close</button>
      </div>
    </div>
    <div class="ctrl"><span class="lbl" id="l-pr">Abi's pay rule</span>
      <div class="seg-ctl" role="group" aria-labelledby="l-pr" data-key="pay">
        <button type="button" data-v="keep" aria-pressed="true">Keep £3,000 every month</button><button type="button" data-v="release" aria-pressed="false">Stop once the bank has £25,000</button>
      </div>
    </div>
    <div class="results" aria-live="polite">
      <div class="res"><span>Bedhampton</span><b id="r-close">${c.two.closes ? "Closes " + c.two.closes : "Stays open"}</b><em id="r-stand">Winchester stands alone ${init.stand ?? "not yet"}</em></div>
      <div class="res" id="r-low-box"><span>Lowest bank</span><b id="r-low">${f(c.two.low)}</b><em id="r-lowm">${c.two.lowMonth}</em></div>
      <div class="res"><span>Abi's pay, 3 years</span><b id="r-sal">${f(c.two.salary)}</b><em id="r-reg">regular from ${c.two.regular}</em></div>
      <div class="res"><span>Bank, Sep 2029</span><b id="r-end">${f(c.two.end)}</b><em id="r-jun">Winchester June 2027: ${f(D.scenarios.central.winc["2027-06"])}</em></div>
    </div>
    <div class="two">
      <div><div class="legend" aria-hidden="true"><span><i style="background: var(--ink)"></i>Winchester takings</span><span><i class="line"></i>Stands on its own</span></div><div class="chart" style="height:220px"><canvas id="t-winc" role="img" aria-label="Winchester takings for the chosen settings against the level where it stands on its own.">Winchester takings for the chosen settings.</canvas></div></div>
      <div><div class="legend" aria-hidden="true"><span><i style="background: var(--slate)"></i>Bank</span><span><i class="line"></i>£10,000 safety net</span></div><div class="chart" style="height:220px"><canvas id="t-bank" role="img" aria-label="Bank balance for the chosen settings against the 10,000 safety net.">Bank balance for the chosen settings.</canvas></div></div>
    </div>
  </div>
  <p class="note">"My own number" sets new patients a month from March 2027, with a lift of 6 a month from December to February for founders and the warm list, growing slowly as word spreads. The build, funding, loan and running costs are the same as the rest of this plan.</p>
</section>

<section id="decide" data-title="What we need to decide">
  <div class="ch-head"><span class="ch-num">12</span><div><div class="q">Decisions</div><h2>What we need to decide</h2></div></div>
  <ul>
    <li><span class="chip decide">Both</span><strong>Bedhampton on two days until Winchester stands on its own</strong>, then close, as the rule.</li>
    <li><span class="chip decide">Both</span><strong>The £3,000 kept each month:</strong> keep it, or stop once the bank has £25,000 so Abi is paid properly sooner.</li>
    <li><span class="chip decide">Both</span><strong>A target of 25 new patients a month at Winchester</strong>, and what we do if we are short.</li>
    <li><span class="chip decide">Both</span><strong>How far founders' prices go:</strong> each founder keeps about ${f(43)} less per treatment.</li>
    <li><span class="chip decide">David</span><strong>Re-run the forecast in March 2027</strong> with three months of real Winchester figures.</li>
    <li><span class="chip decide">David</span><strong>Ask the accountant</strong> for a corporation tax estimate, the fit-out allowances, and salary against dividends.</li>
    <li><span class="chip decide">Abi</span><strong>Confirm Bedhampton's prices and costs:</strong> are the Launch OS Bedhampton prices new, and does Bedhampton cost anything to keep open beyond products?</li>
  </ul>
</section>

<section id="watch" data-title="What we check every month">
  <div class="ch-head"><span class="ch-num">13</span><div><div class="q">Every month</div><h2>What we check every month</h2></div></div>
  <ul>
    <li><strong>New patients at Winchester.</strong> The number that decides everything: under 16 is the slow forecast, 25 or more is ahead, 30 is David's.</li>
    <li><strong>Winchester's takings</strong> against the recommended forecast and against ${f(standAt)}.</li>
    <li><strong>Founders against full price:</strong> the share of Winchester patients on founders' prices.</li>
    <li><strong>Bedhampton's two days:</strong> about £6,500 to £7,700 a month.</li>
    <li><strong>The bank</strong> against £10,000, especially around the rent days: 25 December, 25 March, 24 June and 29 September.</li>
    <li><strong>The VAT refund</strong> arriving the month after each big building bill.</li>
  </ul>
</section>

<section id="appendix" data-title="What the plan leaves out">
  <div class="ch-head"><span class="ch-num">A</span><div><div class="q">Appendix</div><h2>What the plan leaves out, and how it was built</h2></div></div>
  <div class="two">
    <div class="callout"><h3><span class="chip watch">Cost</span>Corporation tax</h3><p>Tax on the company's profit is not in the plan. It is paid nine months after each year end and could be several thousand pounds a year, less once the fit-out is claimed.</p></div>
    <div class="callout"><h3><span class="chip decide">Check</span>Needles, gloves, card fees</h3><p>Small costs per treatment not in the product costs. They trim a penny or two from each pound at both sites.</p></div>
    <div class="callout"><h3><span class="chip decide">Later</span>An associate injector</h3><p>A priority, but no dates or costs yet. It would add capacity Winchester won't need until it is much busier.</p></div>
    <div class="callout"><h3><span class="chip good">Bonus</span>Patients who follow</h3><p>We assume 15% of Bedhampton's patients follow Abi to Winchester when it closes. Every extra one helps.</p></div>
  </div>
  <p class="note">How it was built: ANS patient records from May 2024 to September 2026 (totals only, no names), the Launch OS price list and product cost estimates, and the Money page engine. The patient model reproduces Bedhampton's March to September 2026 takings exactly. Winchester prices are 1.48 times what Bedhampton patients actually paid for the same treatments (1.18 times at founders' prices).</p>
</section>

<footer>
  <div>Source: the Money page in Launch OS on ${dmy(asOf)} (bank as at ${dm(BANK_AT)}) and the ANS patient records to 30 September 2026. Takings include VAT; costs and build figures are before VAT unless shown. Figures are rounded to the nearest pound.</div>
  <div>This is a plan, not a promise. It depends most on how many new patients Winchester finds, and we will update it as real figures arrive.</div>
</footer>

</main>
</div>

<script>${ENGINE}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
(function () {
  // Contents: built from the chapters, with the current chapter marked in the rail.
  const secs = [...document.querySelectorAll("section[data-title]")];
  const items = secs.map(s => \`<li><a href="#\${s.id}">\${s.dataset.title}</a></li>\`).join("");
  document.getElementById("toc").innerHTML = items; document.getElementById("rail").innerHTML = items;
  try { const links = [...document.querySelectorAll("#rail a")]; const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-20% 0px -70% 0px" }); secs.forEach(s => io.observe(s)); } catch (e) {}

  const D = ${JSON.stringify(chartData)};
  const IN = ${JSON.stringify(INPUTS)};
  const gbp = v => (v < 0 ? "−" : "") + "£" + Math.abs(Math.round(v)).toLocaleString("en-GB");
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let charts = {};

  // ── Try it yourself: the Money page engine, run in the page ──
  const hasEngine = typeof CM !== "undefined";
  const state = { forecast: "central", n: 16, bedh: "two", pay: "keep" };
  function runModel() {
    const d = CM.CASH_MODEL_DEFAULTS, months = CM.monthsFrom("2026-10", 48);
    let takings, productCost, growth;
    if (state.forecast === "custom") {
      const pr = { early: state.n + 6, earlyUntil: "2027-02", start: state.n, growthPerMonth: 0.25, cap: state.n + 8 };
      const o = { founding: { month: "2026-11", patients: 30, firstMonthTotal: 1184 }, firstCohort: "2026-12", founderPrice: CM.PRICES.foundersVsBedhampton, listPrice: CM.PRICES.listVsBedhampton, founderUntil: "2027-01" };
      takings = CM.wincForecast(CM.PATIENT_MODEL, pr, o, months); productCost = CM.wincProductCost(CM.PATIENT_MODEL, pr, o, months, CM.PRICES.productShare);
    } else {
      const s = CM.WINC_SCENARIOS[state.forecast]; takings = s.takings; productCost = s.productCost;
      growth = { month: d.winc.growth.month, target: Math.round(d.winc.growth.target * (s.takings["2027-06"] / CM.WINC_SCENARIOS.base.takings["2027-06"])) };
    }
    const plan = Object.assign({}, d.bedh.plan, state.bedh === "one" ? { oneDayFrom: "2027-05" } : state.bedh === "april" ? { closeAfter: "2027-04" } : state.bedh === "never" ? { closeWhen: null } : {});
    const pays = IN.payments.map(([amt, method, month, vat], i) => ({ month, amountExVat: amt, method, label: "Build " + i, vat }));
    return CM.runCashModel(Object.assign({}, d, { months: 36, openingBank: IN.opening, projectPayments: pays,
      funding: IN.funding, loans: IN.loans,
      pay: Object.assign({}, d.pay, { retentionUntilBank: state.pay === "release" ? 25000 : null }),
      bedh: Object.assign({}, d.bedh, { plan }),
      winc: { contributionPct: d.winc.contributionPct, takings, productCost, growth, capacity: d.winc.capacity } }));
  }
  function update() {
    if (!hasEngine) return;
    const r = runModel(), rows = r.rows;
    const closed = rows.find(x => x.bedhDays === 0);
    let stand = null; for (let i = 1; i < rows.length; i++) if (rows[i - 1].wincStandMargin >= 0 && rows[i].wincStandMargin >= 0) { stand = rows[i].label; break; }
    let reg = null; for (let i = 0; i < rows.length - 2; i++) if (rows[i].paySalary > 0 && rows[i + 1].paySalary > 0 && rows[i + 2].paySalary > 0) { reg = rows[i].label; break; }
    const sal = rows.reduce((a, x) => a + x.paySalary, 0);
    document.getElementById("r-close").textContent = closed ? "Closes " + closed.label : "Stays open";
    document.getElementById("r-stand").textContent = "Winchester stands alone " + (stand || "not within 3 years");
    document.getElementById("r-low").textContent = gbp(r.lowest.bank);
    document.getElementById("r-lowm").textContent = r.lowest.bank < 10000 ? r.lowest.month + ", below the safety net" : r.lowest.month;
    document.getElementById("r-low-box").classList.toggle("bad", r.lowest.bank < 10000);
    document.getElementById("r-sal").textContent = sal ? gbp(sal) : "Nothing";
    document.getElementById("r-reg").textContent = reg ? "regular from " + reg : "no regular pay in 3 years";
    document.getElementById("r-end").textContent = gbp(rows[35].closingBank);
    document.getElementById("r-jun").textContent = "Winchester June 2027: " + gbp(rows.find(x => x.month === "2027-06").winc.gross);
    if (charts.tw) { charts.tw.data.datasets[0].data = rows.map(x => Math.round(x.wincDemand)); charts.tw.update("none"); }
    if (charts.tb) { charts.tb.data.datasets[0].data = rows.map(x => Math.round(x.closingBank)); charts.tb.update("none"); }
  }
  document.querySelectorAll(".seg-ctl").forEach(g => g.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    state[g.dataset.key] = b.dataset.v; update();
  }));
  const nIn = document.getElementById("n"), nOut = document.getElementById("n-out");
  nIn.addEventListener("input", () => { state.n = +nIn.value; nOut.textContent = nIn.value; state.forecast = "custom";
    document.querySelectorAll('[data-key="forecast"] button').forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === "custom"))); update(); });

  // ── charts ──
  function draw() {
    if (!window.Chart) return;
    Object.values(charts).forEach(ch => ch.destroy()); charts = {};
    const ink = tok("--ink"), muted = tok("--muted"), line = tok("--line"), slate = tok("--slate"), sage = tok("--sage"), sageDeep = tok("--sage-deep"), prod = tok("--prod"), intc = tok("--int"), pay = tok("--pay");
    Chart.defaults.font.family = tok("--font-body"); Chart.defaults.color = muted;
    const x = { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 11 } }, border: { color: line } };
    const y = { grid: { color: line }, border: { display: false }, ticks: { callback: v => "£" + (v / 1000) + "k", font: { size: 11 } } };
    const base = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ": " + gbp(c.raw) } } } };
    const mk = (id, cfg) => { const el = document.getElementById(id); return el ? new Chart(el, cfg) : null; };
    const flat = (v) => D.months36.map(() => v);
    charts.treat = mk("treat", { type: "bar", data: { labels: D.treat.names, datasets: [
      { label: "Bedhampton", data: D.treat.b, backgroundColor: prod, maxBarThickness: 12 },
      { label: "Founders", data: D.treat.fo, backgroundColor: pay, maxBarThickness: 12 },
      { label: "Winchester list", data: D.treat.w, backgroundColor: ink, maxBarThickness: 12 } ] },
      options: Object.assign({}, base, { indexAxis: "y", interaction: { mode: "index", axis: "y", intersect: false }, scales: { x: { grid: { color: line }, border: { display: false }, ticks: { callback: v => "£" + v, font: { size: 11 } } }, y: { grid: { display: false }, ticks: { font: { size: 12 } } } } }) });
    charts.value = mk("value", { type: "line", data: { labels: D.valueB.map((_, i) => i === 0 ? "First month" : i + (i === 1 ? " month" : " months")), datasets: [
      { label: "Winchester list", data: D.valueW, borderColor: ink, borderWidth: 2, pointRadius: 0 },
      { label: "Bedhampton", data: D.valueB, borderColor: prod, borderWidth: 2, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x: Object.assign({}, x, { ticks: Object.assign({}, x.ticks, { maxTicksLimit: 7 }) }), y: Object.assign({}, y, { min: 0, ticks: { callback: v => "£" + v, font: { size: 11 } } }) } }) });
    charts.calib = mk("calib", { type: "bar", data: { labels: D.calib.months, datasets: [{ label: "Actual", data: D.calib.actual, backgroundColor: sage, maxBarThickness: 22 }, { label: "Model", data: D.calib.model, backgroundColor: slate, maxBarThickness: 22 }] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y, { min: 0 }) } }) });
    charts.fc = mk("forecasts", { type: "line", data: { labels: D.months36, datasets: [
      { label: "Recommended", data: D.forecasts.central, borderColor: ink, borderWidth: 2.5, pointRadius: 0 },
      { label: "David's forecast", data: D.forecasts.base, borderColor: intc, borderWidth: 2, pointRadius: 0 },
      { label: "Fast", data: D.forecasts.high, borderColor: sageDeep, borderWidth: 2, pointRadius: 0 },
      { label: "Slow", data: D.forecasts.low, borderColor: prod, borderWidth: 2, pointRadius: 0 },
      { label: "Stands on its own", data: flat(D.standAt), borderColor: sageDeep, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y, { min: 0 }) } }) });
    charts.bedh = mk("bedh", { type: "line", data: { labels: D.bedhMonths, datasets: [
      { label: "Two days", data: D.bedhTwo, borderColor: sageDeep, backgroundColor: sage + "55", fill: true, borderWidth: 2, pointRadius: 0 },
      { label: "One day", data: D.bedhOne, borderColor: prod, borderWidth: 2, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y, { min: 0 }) } }) });
    charts.bank = mk("bank", { type: "line", data: { labels: D.months36, datasets: [
      { label: "Recommended", data: D.bank, borderColor: slate, backgroundColor: slate + "22", fill: true, borderWidth: 2, pointRadius: D.bank.map((v, i) => i === 2 ? 5 : 0), pointBackgroundColor: slate },
      { label: "David's forecast", data: D.bankDavid, borderColor: intc, borderWidth: 1.5, pointRadius: 0 },
      { label: "Safety net", data: flat(10000), borderColor: sageDeep, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y, { min: 0 }) } }) });
    charts.tw = mk("t-winc", { type: "line", data: { labels: D.months36, datasets: [
      { label: "Winchester", data: D.forecasts.central, borderColor: ink, borderWidth: 2, pointRadius: 0 },
      { label: "Stands on its own", data: flat(D.standAt), borderColor: sageDeep, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y, { min: 0 }) } }) });
    charts.tb = mk("t-bank", { type: "line", data: { labels: D.months36, datasets: [
      { label: "Bank", data: D.bank, borderColor: slate, backgroundColor: slate + "22", fill: true, borderWidth: 2, pointRadius: 0 },
      { label: "Safety net", data: flat(10000), borderColor: sageDeep, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 } ] }, options: Object.assign({}, base, { scales: { x, y: Object.assign({}, y) } }) });
    Object.keys(charts).forEach(k => { if (!charts[k]) delete charts[k]; });
    update();
  }
  draw();
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw); } catch (e) {}
  try { new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
})();
</script>
`;
return html;
}
