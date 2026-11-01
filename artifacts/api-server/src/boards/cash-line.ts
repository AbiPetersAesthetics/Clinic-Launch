// @ts-nocheck
// The Cash Line: the Tide balance day by day from the bank date to the end of December, one
// row per payment in date order, built from the live plan each time it is opened. The plan
// holds amounts by month; this page gives each one a day under rules listed on the page, so
// the owner can see the balance rise and fall. Card and personal rows leave the line where
// it is: the bank does not move for them. Winchester only, as the plan is.
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const r2 = v => Math.round(v * 100) / 100;
const iso = d => d.toISOString().slice(0, 10);
const at = (ym, day) => `${ym}-${String(day).padStart(2, "0")}`;
const addDays = (isoDate, n) => { const d = new Date(isoDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const addMonths = (ym, n) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + "-" + String(t % 12 + 1).padStart(2, "0"); };
const long = isoDate => { const [y, m, d] = isoDate.split("-").map(Number); return `${DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH_LONG[m - 1].slice(0, 3)}`; };
const gbp = v => (v < 0 ? "−" : "") + "£" + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp0 = v => (v < 0 ? "−" : "") + "£" + Math.abs(Math.round(v)).toLocaleString("en-GB");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const mondays = ym => { const [y, m] = ym.split("-").map(Number); const out = []; for (let d = 1; d <= 31; d++) { const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) break; if (dt.getUTCDay() === 1) out.push(iso(dt)); } return out; };

// The day each card buy is made (plan line id), spread through November as the owner asked.
const CARD_DAYS = { 335: 3, 369: 4, 339: 6, 337: 6, 367: 10, 368: 10, 360: 13, 379: 17, 373: 20, 403: 24, 389: 1 };
// Plain names for the plan's lines.
const NAMES = [[/^Treatment Couch/, "Treatment couch (Lapis electric bed)"], [/^Retail \/ Skincare/, "Obagi retail stock"], [/^Treatment Room Furniture/, "Room 1: Maru desk, two chairs, stool"],
  [/^Reception furniture/, "Reception: desk tray and reed diffuser"], [/Smallwares/, "Clinical smallwares and consumables"], [/^Opening Injectable/, "Opening injectable stock"], [/^Emergency Drugs/, "Emergency drugs and equipment kit"],
  [/^PAT Testing/, "PAT testing"], [/Hamilton Fraser/, "Insurance (Hamilton Fraser), no VAT"], [/deep clean/i, "Deep clean materials"], [/^Google Ads/, "Google launch adverts, no VAT"],
  [/^External Signage/, "Shop sign (Signs Express)"], [/^Reception desk, Artisan/, "Reception desk balance, no VAT"], [/Arundel/, "Fire alarm, 70% balance"]];

export function renderCashLine({ J, asOf, cbsLastPaid, octVatLoan }) {
  const start = J.bank ? J.bank.asAt : asOf, startBal = J.bank ? J.bank.balanceGbp : J.config.openingBank;
  const firstYm = start.slice(0, 7), endYm = firstYm.slice(0, 4) + "-12", endDate = endYm + "-31";
  const ym = s => s.slice(0, 7), inRange = d => d >= start && d <= endDate;
  const rows = [];
  const add = (date, what, who, how, amount, note = "") => { if (inRange(date)) rows.push({ date, what, who, how, amount: r2(amount), note }); };

  // 1. Funding.
  for (const f of J.funding || []) {
    if (/^Abi lends/.test(f.label)) continue;
    add(at(f.month, f.kind === "equity" ? 5 : 19), f.kind === "equity" ? "Equity investment" : "Gift", f.label.replace(/:.*$/, ""), "in", f.amount);
  }
  for (const l of J.loans || []) add(at(l.drawMonth, 1), `Loan drawn, ${l.annualRatePct}% a year`, l.label.replace(/:.*$/, ""), "in", l.principal);

  // 2. CBS: what is left less the 3% retention, half two and a half weeks after the last
  // payment and half two and a half weeks after that, Abi lending the VAT the same day.
  const cbs = J.projectLines.filter(l => /^Ref \d+ - /.test(l.title));
  const cbsLeftInc = cbs.reduce((s, l) => s + Math.max(0, l.recorded - l.paid - (l.paidOnCard || 0)), 0);
  const retentionInc = cbs.reduce((s, l) => s + 0.03 * l.recorded, 0);
  const cbsPayable = Math.max(0, cbsLeftInc - retentionInc), half = r2(cbsPayable / 2), halfVat = r2(half / 6);
  const v2 = addDays(cbsLastPaid, 17), v3 = addDays(v2, 18);
  const cbsVatByMonth = {};
  for (const [d, n] of [[v2, 2], [v3, 3]]) {
    add(d, `Abi lends the VAT on CBS valuation ${n} (director's loan)`, "Abi Flitney", "abi-in", halfVat);
    add(d, `CBS valuation ${n}: half of the balance, VAT included`, "Commercial Building Solutions", "bank", -half, `${gbp(half - halfVat)} work + ${gbp(halfVat)} VAT`);
    cbsVatByMonth[ym(d)] = (cbsVatByMonth[ym(d)] || 0) + halfVat;
  }

  // 3. The other plan lines, by their payment month and method.
  const otherVatByMonth = {};
  for (const l of J.projectLines) {
    if (/^Ref \d+ - /.test(l.title) || l.remainingExVat < 0.5 || l.planProblem) continue;
    const leftInc = Math.max(0, l.recorded - l.paid - (l.paidOnCard || 0)); if (leftInc < 0.5) continue;
    const vatInc = l.vatBasis === "no VAT" ? 0 : leftInc / 6;
    // A line's shares in one month are one payment (the desk's deposit and balance both fell
    // into November once October had gone).
    const byMonth = new Map();
    for (const p of l.plan) { const m = p.month < firstYm ? firstYm : p.month; const k = m + "|" + p.method; byMonth.set(k, (byMonth.get(k) || 0) + p.share); }
    for (const [k, share] of byMonth) {
      const [m, method] = k.split("|"), p = { month: m, method, share }, amt = r2(leftInc * p.share);
      const nm = NAMES.find(([re]) => re.test(l.title));
      const name = nm ? nm[1] : l.title.replace(/\s+[—–-]\s+.*$/, "").replace(/ \(.*\)$/, "");
      if (p.method === "card") {
        const day = CARD_DAYS[l.taskId] ?? 10;
        add(at(m, day), name, l.phase.replace(/ &.*$/, ""), "card", -amt, "on the M&S card: the bank does not move");
        if (vatInc) otherVatByMonth[m] = (otherVatByMonth[m] || 0) + r2(vatInc * p.share);
      } else {
        const day = /Arundel/.test(l.title) ? 3 : /Signage/.test(l.title) ? 5 : /Reception desk/.test(l.title) ? 9 : 15;
        add(at(m, day), name, /Arundel/.test(l.title) ? "Arundel Fire and Security" : /Signage/.test(l.title) ? "Signs Express" : /Reception desk/.test(l.title) ? "Artisan Deco" : l.phase, "bank", -amt);
        if (vatInc) otherVatByMonth[m] = (otherVatByMonth[m] || 0) + r2(vatInc * p.share);
      }
    }
  }

  // 4. VAT refunds: the return for a month is filed on the 7th of the next and the refund
  // lands on the 17th; Abi is repaid her CBS VAT the day it lands. October's refund is CBS's
  // VAT only (the kit's VAT waits on invoices in the company's name).
  const refundMonths = new Set([addMonths(firstYm, -1), ...Object.keys(cbsVatByMonth), ...Object.keys(otherVatByMonth)]);
  for (const m of [...refundMonths].sort()) {
    const landing = at(addMonths(m, 1), 17);
    const abi = m === addMonths(firstYm, -1) ? octVatLoan : (cbsVatByMonth[m] || 0), other = m === addMonths(firstYm, -1) ? 0 : (otherVatByMonth[m] || 0);
    if (abi + other < 0.5) continue;
    add(landing, `VAT refund for ${MONTH_LONG[+m.slice(5) - 1]}`, "HMRC", "in", r2(abi + other), other ? `${gbp(abi)} on CBS, ${gbp(other)} on the rest` : "CBS's VAT");
    if (abi > 0.5) add(landing, `Abi repaid her ${MONTH_LONG[+m.slice(5) - 1]} VAT loan`, "Abi Flitney", "abi-out", -abi);
  }

  // 5. Running costs, rent and the clinics' takings, from the Money page's months.
  for (const r of J.rows) {
    const m = r.month; if (m < firstYm || m > endYm) continue;
    if (r.rates) add(at(m, 1), "Business rates", "Winchester City Council", "bank", -r.rates);
    if (r.running.marketing) add(at(m, 1), "Advertising", "Meta and Google", "bank", -r.running.marketing);
    if (r.running.general) add(at(m, 10), "Everyday running costs", "accountant, software, bank, card machine", "bank", -r.running.general);
    if (r.running.utilities) add(at(m, 24), "Electricity, water and broadband", "EDF, Southern Water, Vodafone", "bank", -r.running.utilities);
    if (r.rentPaid) add(at(m, 25), "Rent, quarter in advance", "Rosemary (the landlord)", "bank", -r.rentPaid);
    if (r.cardRepayment) add(at(m, 28), "Card repayment: the company repays David", "David Savin", "bank", -r.cardRepayment);
    if (r.loanRepayment) add(at(m, 1), "Loan repayment", "James Gibbons", "bank", -r.loanRepayment);
    const take = r.total.contribution, mons = mondays(m).filter(d => d >= start);
    if (take > 0.5 && mons.length) for (const d of mons) add(d, "Clinics' net takings for the week", "Bedhampton and Winchester patients", "in", r2(take / mons.length));
  }

  // 6. In date order, money in before money out on a day, then the running balance.
  const order = { in: 0, "abi-in": 1, bank: 2, "abi-out": 3, card: 4, personal: 5 };
  rows.sort((a, b) => a.date.localeCompare(b.date) || order[a.how] - order[b.how]);
  let bal = startBal, low = { bal: startBal, date: start };
  const daily = new Map([[start, startBal]]);
  for (const r of rows) { if (r.how !== "card" && r.how !== "personal") bal = r2(bal + r.amount); r.balance = bal; daily.set(r.date, bal); if (bal < low.bal) low = { bal, date: r.date }; }
  const endBal = bal;
  const totalIn = rows.filter(r => r.amount > 0 && r.how !== "card").reduce((s, r) => s + r.amount, 0);
  const totalBank = -rows.filter(r => r.amount < 0 && r.how !== "card" && r.how !== "personal").reduce((s, r) => s + r.amount, 0);
  const totalCard = -rows.filter(r => r.how === "card").reduce((s, r) => s + r.amount, 0);
  const christmas = rows.filter(r => r.date <= endYm + "-25").slice(-1)[0]?.balance ?? startBal;

  // 7. The chart: a step line of the balance for every day, the floor, the lowest point.
  const days = []; for (let d = start; d <= endDate; d = addDays(d, 1)) days.push(d);
  let cur = startBal; const series = days.map(d => { if (daily.has(d)) cur = daily.get(d); return cur; });
  const FLOOR = J.config.cashFloor ?? 10000, W = 1200, H = 300, L = 70, R = 16, T = 16, B = 34;
  const maxV = Math.max(...series, FLOOR) * 1.08, minV = Math.min(0, ...series);
  const x = i => L + (i / (days.length - 1)) * (W - L - R), y = v => T + (1 - (v - minV) / (maxV - minV)) * (H - T - B);
  let path = ""; series.forEach((v, i) => { path += (i ? ` H${x(i).toFixed(1)} V${y(v).toFixed(1)}` : `M${x(0).toFixed(1)} ${y(v).toFixed(1)}`); });
  const area = path + ` V${y(minV).toFixed(1)} H${x(0).toFixed(1)} Z`;
  const ticks = []; for (let v = 0; v <= maxV; v += 10000) ticks.push(v);
  const weekLabels = days.map((d, i) => [d, i]).filter(([d]) => d.endsWith("-01") || new Date(d + "T00:00:00Z").getUTCDay() === 1);
  const lowI = days.indexOf(low.date);
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The bank balance day by day from ${long(start)} to ${long(endDate)}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1" /><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${gbp0(v)}</text>`).join("")}
    <line x1="${L}" x2="${W - R}" y1="${y(FLOOR).toFixed(1)}" y2="${y(FLOOR).toFixed(1)}" stroke="var(--bad)" stroke-dasharray="6 5" stroke-width="1.5" /><text x="${W - R}" y="${(y(FLOOR) - 6).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--bad)">${gbp0(FLOOR)} safety net</text>
    <path d="${area}" fill="var(--c-start)" opacity="0.08" /><path d="${path}" fill="none" stroke="var(--c-start)" stroke-width="2.2" />
    ${weekLabels.map(([d, i]) => `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${H - B}" y2="${H - B + 5}" stroke="var(--line)" /><text x="${x(i).toFixed(1)}" y="${H - B + 18}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${d.endsWith("-01") ? MONTH_LONG[+d.slice(5, 7) - 1].slice(0, 3) : +d.slice(8)}</text>`).join("")}
    <circle cx="${x(lowI).toFixed(1)}" cy="${y(low.bal).toFixed(1)}" r="5" fill="${low.bal < FLOOR ? "var(--bad)" : "var(--watch)"}" /><text x="${x(lowI).toFixed(1)}" y="${(y(low.bal) - 10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">lowest ${gbp0(low.bal)}, ${long(low.date)}</text>
  </svg>`;

  // 8. The table.
  const HOW = { in: ["Bank, in", "in"], bank: ["Bank, out", "bank"], "abi-in": ["Abi lends into Tide", "abi"], "abi-out": ["Tide repays Abi", "abi"], card: ["M&S card", "card"], personal: ["Personal", "card"] };
  const trs = rows.map(r => { const [label, cls] = HOW[r.how]; const flat = r.how === "card" || r.how === "personal"; return `<tr class="${cls}${flat ? " flat" : ""}${r.balance < FLOOR && !flat ? " under" : ""}">
      <td class="d">${long(r.date)}</td><td><b>${esc(r.what)}</b>${r.note ? `<span class="n">${esc(r.note)}</span>` : ""}</td><td class="w">${esc(r.who)}</td><td><span class="pill ${cls}">${label}</span></td>
      <td class="n-in">${r.amount > 0 && !flat ? gbp(r.amount) : ""}</td><td class="n-out">${r.amount < 0 ? gbp(-r.amount) : ""}</td><td class="bal">${flat ? `<span class="same">${gbp(r.balance)}</span>` : gbp(r.balance)}</td></tr>`; }).join("\n");

  const assumptions = [
    `Starts from the bank saved on the Money page: ${gbp(startBal)} on ${long(start)}, all Tide accounts as one.`,
    `James's £37,000 on the 5th of its month, Bill's £10,000 on the 19th, James's loan on the 1st of December.`,
    `CBS: the balance less the 3% retention, half on ${long(v2)} and half on ${long(v3)} (two and a half weeks after the last payment, then again). Abi lends the VAT into Tide the same day.`,
    `VAT returns are monthly: filed on the 7th, refund on the 17th of the following month, and Abi is repaid the day it lands. October's refund is CBS's VAT only; the kit's VAT waits on invoices in the company's name.`,
    `Arundel on the 3rd, the sign on the 5th (ordered when James's money lands), the desk balance on the 9th.`,
    `Card buys spread through November on the M&S card (3rd couch, 4th Obagi, 6th room 1 and the desk tray, 10th injectables and consumables, 13th emergency kit, 17th PAT, 20th insurance, 24th deep clean), the Google adverts on 1 December. None of these move the bank.`,
    `Rates and advertising on the 1st, everyday running costs on the 10th, utilities on the 24th, rent on 25 December, the company's repayment to David on the 28th.`,
    `The clinics' net takings from the Money page, paid in on Mondays.`,
  ];

  return `<!doctype html>
<html lang="en-GB" data-theme="light">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Winchester Cash Line</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<style>
:root { --bg: #F6F8FB; --sheet: #FFFFFF; --panel: #EFF3F8; --ink: #1F2A44; --muted: #5C6577; --line: #C3CCD9; --slate: #445B72; --good: #3F7A68; --watch: #8A5A12; --watch-bg: #F6EEDF; --bad: #A33A3A; --bad-bg: #F8E6E6; --c-start: #2a78d6; --in: #1baf7a; --in-bg: #E6F6EF; --card: #eda100; --card-bg: #FBF1DA; --abi: #6250d6; --abi-bg: #ECE9FA; --font-display: "Source Serif 4", Georgia, serif; --font-body: "Mulish", "Segoe UI", system-ui, sans-serif; color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 14px; line-height: 1.5; padding: 20px 16px 48px; }
.sheet { max-width: 1400px; margin: 0 auto; background: var(--sheet); border: 1px solid var(--line); border-radius: 2px; padding: 22px 24px 26px; display: grid; gap: 18px; }
h1, h2 { font-family: var(--font-display); font-weight: 600; margin: 0; line-height: 1.15; } h1 { font-size: clamp(24px, 3vw, 34px); } h2 { font-size: 17px; }
p { margin: 0; } .eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--slate); font-weight: 700; }
.lead { color: var(--muted); max-width: 95ch; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
.kpi { background: var(--panel); border-radius: 2px; padding: 12px 14px; display: grid; gap: 2px; } .kpi span { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.kpi b { font-family: var(--font-display); font-size: 24px; font-weight: 600; } .kpi em { font-style: normal; font-size: 12px; color: var(--muted); }
.kpi.bad b { color: var(--bad); } .kpi.watch b { color: var(--watch); } .kpi.good b { color: var(--good); }
.panel { border: 1px solid var(--line); border-radius: 2px; padding: 14px 16px; display: grid; gap: 8px; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--muted); } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { position: sticky; top: 0; background: var(--sheet); text-align: left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 8px 8px; border-bottom: 2px solid var(--line); z-index: 1; }
td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; } td.d { white-space: nowrap; color: var(--muted); width: 92px; } td.w { color: var(--muted); }
td.n-in, td.n-out, td.bal, th.r { text-align: right; white-space: nowrap; } td.n-in { color: var(--good); } td.n-out { color: var(--bad); } td.bal { font-weight: 700; }
tr.flat td { color: var(--muted); } tr.flat td b { font-weight: 600; color: var(--muted); } tr.flat td.n-out { color: var(--muted); } .same { font-weight: 400; color: var(--muted); }
tr.under td.bal { color: var(--bad); } .n { display: block; font-size: 12px; color: var(--muted); }
.pill { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
.pill.in { background: var(--in-bg); color: var(--good); } .pill.bank { background: var(--panel); color: var(--slate); } .pill.abi { background: var(--abi-bg); color: var(--abi); } .pill.card { background: var(--card-bg); color: var(--watch); }
ol { margin: 0; padding-left: 20px; color: var(--muted); display: grid; gap: 4px; } ol li { padding-left: 2px; }
.foot { font-size: 11px; color: var(--muted); }
@media (max-width: 720px) { td.w { display: none; } }
</style>
</head>
<body><div class="sheet">
  <div><div class="eyebrow">Abi Peters Skin Clinic · Winchester build · ${long(asOf)}</div><h1>The cash line, ${long(start)} to ${long(endDate)}</h1>
  <p class="lead">Every payment in the plan on the day it is expected, and the Tide balance after it. Bank rows move the line. Card and personal rows do not: the bank stays where it is and the row is greyed. The dates are the rules at the foot of the page where the plan has only a month; the amounts are the plan's.</p></div>
  <div class="kpis">
    <div class="kpi"><span>Bank today</span><b>${gbp0(startBal)}</b><em>${long(start)}</em></div>
    <div class="kpi ${low.bal < FLOOR ? "bad" : low.bal < FLOOR * 1.25 ? "watch" : "good"}"><span>Lowest</span><b>${gbp0(low.bal)}</b><em>${long(low.date)}${low.bal < FLOOR ? ", below the safety net" : ""}</em></div>
    <div class="kpi ${christmas < FLOOR ? "bad" : "good"}"><span>At Christmas</span><b>${gbp0(christmas)}</b><em>after the rent on 25 December</em></div>
    <div class="kpi"><span>End of December</span><b>${gbp0(endBal)}</b><em>${long(endDate)}</em></div>
    <div class="kpi"><span>In</span><b>${gbp0(totalIn)}</b><em>funding, refunds, takings</em></div>
    <div class="kpi"><span>Out of the bank</span><b>${gbp0(totalBank)}</b><em>build, bills, rent, repayments</em></div>
    <div class="kpi"><span>On the cards</span><b>${gbp0(totalCard)}</b><em>does not move the line</em></div>
  </div>
  <div class="panel"><h2>The balance, day by day</h2>${chart}
    <div class="legend"><span><i style="background: var(--c-start)"></i>Tide balance</span><span><i style="background: var(--bad)"></i>£10,000 safety net</span></div></div>
  <div class="panel"><h2>Every payment, in date order</h2>
    <div class="legend"><span class="pill in">Bank, in</span><span class="pill bank">Bank, out</span><span class="pill abi">Abi's VAT loan</span><span class="pill card">M&S card: the line does not move</span></div>
    <table><thead><tr><th>Date</th><th>What</th><th>To or from</th><th>How</th><th class="r">In</th><th class="r">Out</th><th class="r">Balance</th></tr></thead><tbody>
      <tr><td class="d">${long(start)}</td><td><b>Bank today</b><span class="n">All Tide accounts as one</span></td><td class="w">Tide</td><td></td><td class="n-in"></td><td class="n-out"></td><td class="bal">${gbp(startBal)}</td></tr>
${trs}
    </tbody></table></div>
  <div class="panel"><h2>The dates this line assumes</h2><ol>${assumptions.map(a => `<li>${a}</li>`).join("")}</ol>
    <p class="foot">Winchester only: Bedhampton's day-to-day costs and card are not in the plan, as the owner asked. Built from the Launch OS plan on ${long(asOf)}; change a line, its month or the bank balance and this page follows.</p></div>
</div></body></html>`;
}
