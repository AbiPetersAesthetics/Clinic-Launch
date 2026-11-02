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
const CARD_DAYS = { 335: 10, 369: 4, 339: 6, 337: 6, 367: 10, 368: 10, 360: 13, 379: 17, 373: 20, 403: 24, 389: 1 };
// Plain names for the plan's lines.
const NAMES = [[/^Treatment Couch/, "Treatment couch (Clinic 4 Motor)"], [/^Retail \/ Skincare/, "Obagi retail stock"], [/^Treatment Room Furniture/, "Room 1: Maru desk, two chairs, stool"],
  [/^Reception furniture/, "Reception: desk tray and reed diffuser"], [/Smallwares/, "Clinical smallwares and consumables"], [/^Opening Injectable/, "Opening injectable stock"], [/^Emergency Drugs/, "Emergency drugs and equipment kit"],
  [/^PAT Testing/, "PAT testing"], [/Hamilton Fraser/, "Insurance (Hamilton Fraser), no VAT"], [/deep clean/i, "Deep clean materials"], [/^Google Ads/, "Google launch adverts, no VAT"],
  [/^External Signage/, "Shop sign (Signs Express)"], [/^Reception desk, Artisan/, "Reception desk balance, no VAT"], [/Arundel/, "Fire alarm, 70% balance"]];

export function renderCashLine({ J, asOf, cbsLastPaid, octVatLoan }) {
  const start = J.bank ? J.bank.asAt : asOf, startBal = J.bank ? J.bank.balanceGbp : J.config.openingBank;
  const firstYm = start.slice(0, 7), endYm = firstYm.slice(0, 4) + "-12", endDate = endYm + "-31";
  const ym = s => s.slice(0, 7), inRange = d => d >= start && d <= endDate;
  const rows = [];
  // vat: the VAT inside a payment where the plan knows it; null where the plan holds the cost before VAT.
  const add = (date, what, who, how, amount, note = "", vat = null) => { if (inRange(date)) rows.push({ date, what, who, how, amount: r2(amount), note, vat: vat == null ? null : r2(vat) }); };

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
    add(d, `CBS valuation ${n}: half of the balance, VAT included`, "Commercial Building Solutions", "bank", -half, `${gbp(half - halfVat)} work + ${gbp(halfVat)} VAT`, halfVat);
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
        add(at(m, day), name, l.phase.replace(/ &.*$/, ""), "card", -amt, "on a credit card: the bank does not move", vatInc * p.share);
        if (vatInc) otherVatByMonth[m] = (otherVatByMonth[m] || 0) + r2(vatInc * p.share);
      } else if (/Reception desk/.test(l.title)) {
        // David pays Artisan Deco himself, as he did the deposit: the bank does not move and
        // the company owes him the whole desk as a director's loan.
        add(at(m, 9), name, "Artisan Deco", "personal", -amt, `David pays this himself, as he did the ${gbp(l.paidOnCard || 0)} deposit: the bank does not move. The company owes him ${gbp((l.paidOnCard || 0) + amt)} for the desk in all.`, 0);
      } else {
        const day = /Arundel/.test(l.title) ? 3 : /Signage/.test(l.title) ? 5 : /Hamilton Fraser|^Google Ads/.test(l.title) ? 1 : 15;
        add(at(m, day), name, /Arundel/.test(l.title) ? "Arundel Fire and Security" : /Signage/.test(l.title) ? "Signs Express" : l.phase, "bank", -amt, "", vatInc * p.share);
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
    if (abi > 0.5) add(landing, `Abi repaid her ${MONTH_LONG[+m.slice(5) - 1]} VAT loan`, "Abi Flitney", "abi-out", -abi, "", 0);
  }

  // 5. Running costs, rent and the clinics' takings, from the Money page's months.
  for (const r of J.rows) {
    const m = r.month; if (m < firstYm || m > endYm) continue;
    // A bill due on the 1st of the bank's own month is not in the saved balance yet (the owner
    // keeps this month's rates aside in a pot), so it counts as paid on the bank's date.
    const due1 = at(m, 1) < start ? start : at(m, 1), early = at(m, 1) < start ? "due on the 1st, counted as spent: keep it aside" : "";
    if (r.rates) add(due1, "Business rates", "Winchester City Council", "bank", -r.rates, early, 0);
    if (r.running.marketing) add(due1, "Advertising", "Meta and Google", "bank", -r.running.marketing, early);
    if (r.running.general) add(at(m, 10), "Everyday running costs", "accountant, software, bank, card machine", "bank", -r.running.general);
    if (r.running.utilities) add(at(m, 24), "Electricity, water and broadband", "EDF, Southern Water, Vodafone", "bank", -r.running.utilities);
    if (r.rentPaid) add(at(m, 25), "Rent, quarter in advance", "Rosemary (the landlord)", "bank", -r.rentPaid);
    if (r.cardRepayment) add(at(m, 28), "Card repayment: the company repays David", "David Savin", "bank", -r.cardRepayment, "", 0);
    if (r.loanRepayment) add(at(m, 1), "Loan repayment", "James Gibbons", "bank", -r.loanRepayment, "", 0);
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
  const totalPersonal = -rows.filter(r => r.how === "personal").reduce((s, r) => s + r.amount, 0);
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
  // A mark on the line for every day something happens: solid where the bank moves, hollow
  // where only a card or personal payment falls. The hover reads the same rows by day.
  const byDay = new Map(); for (const r of rows) { if (!byDay.has(r.date)) byDay.set(r.date, []); byDay.get(r.date).push(r); }
  const marks = days.map((d, i) => { const rs = byDay.get(d); if (!rs) return ""; const moves = rs.some(r => r.how !== "card" && r.how !== "personal"), me = rs.some(r => r.how === "personal");
    return `<circle cx="${x(i).toFixed(1)}" cy="${y(series[i]).toFixed(1)}" r="${moves ? 3.2 : 3.6}" fill="${moves ? "var(--c-start)" : "var(--sheet)"}" stroke="${moves ? "var(--sheet)" : me ? "var(--me)" : "var(--card)"}" stroke-width="${moves ? 1.2 : 2}" />`; }).join("");
  const chart = `<svg id="cl-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The bank balance day by day from ${long(start)} to ${long(endDate)}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1" /><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${gbp0(v)}</text>`).join("")}
    <line x1="${L}" x2="${W - R}" y1="${y(FLOOR).toFixed(1)}" y2="${y(FLOOR).toFixed(1)}" stroke="var(--bad)" stroke-dasharray="6 5" stroke-width="1.5" /><text x="${W - R}" y="${(y(FLOOR) - 6).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--bad)">${gbp0(FLOOR)} safety net</text>
    <path d="${area}" fill="var(--c-start)" opacity="0.08" /><path d="${path}" fill="none" stroke="var(--c-start)" stroke-width="2.2" />
    ${weekLabels.map(([d, i]) => `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${H - B}" y2="${H - B + 5}" stroke="var(--line)" /><text x="${x(i).toFixed(1)}" y="${H - B + 18}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${d.endsWith("-01") ? MONTH_LONG[+d.slice(5, 7) - 1].slice(0, 3) : +d.slice(8)}</text>`).join("")}
    ${marks}
    <circle cx="${x(lowI).toFixed(1)}" cy="${y(low.bal).toFixed(1)}" r="5" fill="${low.bal < FLOOR ? "var(--bad)" : "var(--watch)"}" /><text x="${x(lowI).toFixed(1)}" y="${(y(low.bal) - 10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">lowest ${gbp0(low.bal)}, ${long(low.date)}</text>
    <line id="cl-guide" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden" /><circle id="cl-dot" cx="0" cy="0" r="5.5" fill="var(--sheet)" stroke="var(--ink)" stroke-width="2" visibility="hidden" />
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" style="cursor: crosshair" id="cl-hit" />
  </svg>`;
  // What the hover needs: each day, the balance at its end, and the rows that fall on it.
  const json = v => JSON.stringify(v).replace(/</g, "\\u003c");
  const hoverData = `const START = ${startBal}, FLOOR = ${FLOOR}, W = ${W}, L = ${L}, R = ${R}, DAYS = ${json(days)}, SERIES = ${json(series)}, ROWS = ${json(rows.map(r => [r.date, r.what, r.who, r.how, r.amount, r.note]))};`;

  // 7b. At a glance: every payment still to make to the end of December, in pots, with the VAT
  // inside it, who it goes to and what it is paid from. Spending first; repayments (the
  // company paying back David's cards, Abi's VAT loan and James's loan) apart, so the card buys
  // and the repayments of them are not counted twice.
  const POTS = [
    ["Building works", r => /^CBS/.test(r.what)],
    ["Safety and insurance", r => /Fire alarm|Emergency drugs|PAT testing|Insurance/.test(r.what)],
    ["Furniture and fit-out", r => /couch|Room 1|Reception|desk|Shop sign|Deep clean/i.test(r.what)],
    ["Stock and consumables", r => /Obagi|injectable|smallwares/i.test(r.what)],
    ["Marketing", r => /advert/i.test(r.what)],
    ["Rent and rates", r => /^Rent|Business rates/.test(r.what)],
    ["Running costs", r => /running costs|Electricity/.test(r.what)],
  ];
  const REPAY = r => r.how === "abi-out" || /^Card repayment|^Loan repayment/.test(r.what);
  const FROM = { bank: ["From the bank", "bank"], card: ["On the Barclaycard", "card"], personal: ["David pays personally", "me"], "abi-out": ["From the bank", "bank"] };
  const outs = rows.filter(r => r.amount < 0 && r.how !== "abi-in");
  const potOf = r => REPAY(r) ? "Repaying" : (POTS.find(([, t]) => t(r)) || ["Other"])[0];
  const sum = (rs, f) => r2(rs.reduce((s, r) => s + f(r), 0));
  const incOf = r => -r.amount, vatOf = r => r.vat ?? 0;
  const potRows = name => outs.filter(r => potOf(r) === name);
  const spend = outs.filter(r => !REPAY(r)), repay = outs.filter(REPAY);
  const unsplit = spend.filter(r => r.vat == null);
  const srcTiles = ["bank", "card", "personal"].map(k => { const rs = spend.filter(r => r.how === k); return { k, rs, inc: sum(rs, incOf), vat: sum(rs, vatOf) }; });
  const SRC_VAR = { bank: "var(--slate)", card: "var(--card)", me: "var(--me)" };
  const potHtml = (name, rs) => {
    const inc = sum(rs, incOf), vat = sum(rs, vatOf), parts = ["bank", "card", "personal", "abi-out"].map(k => [k, sum(rs.filter(r => r.how === k), incOf)]).filter(([, v]) => v > 0.005);
    const bar = parts.map(([k, v]) => `<i style="width:${(100 * v / inc).toFixed(2)}%;background:${SRC_VAR[FROM[k][1]]}" title="${FROM[k][0]}: ${gbp(v)}"></i>`).join("");
    const items = rs.map(r => `<tr><td class="d">${long(r.date)}</td><td><b>${esc(r.what)}</b><span class="n">${esc(r.who)}</span></td><td><span class="pill ${FROM[r.how][1]}">${FROM[r.how][0]}</span></td><td class="r">${gbp(incOf(r))}</td><td class="r">${r.vat == null ? `<span class="nv">not split</span>` : gbp(r.vat)}</td><td class="r">${gbp(incOf(r) - vatOf(r))}</td></tr>`).join("");
    return `<details class="pot"><summary><span class="pn">${esc(name)}<small>${rs.length} payment${rs.length === 1 ? "" : "s"}</small></span><span class="pb">${bar}</span><span class="r">${gbp0(inc)}</span><span class="r m">${rs.every(r => r.vat == null) ? `<span class="nv">not split</span>` : gbp0(vat)}</span><span class="r">${gbp0(inc - vat)}</span></summary>
      <div class="tscroll"><table class="gl"><thead><tr><th>Date</th><th>What, and to whom</th><th>Paid from</th><th class="r">With VAT</th><th class="r">VAT</th><th class="r">Before VAT</th></tr></thead><tbody>${items}</tbody></table></div></details>`;
  };
  const potNames = [...POTS.map(p => p[0]), "Other"].filter(n => potRows(n).length);
  const spendInc = sum(spend, incOf), spendVat = sum(spend, vatOf);
  const short = { bank: "bank", card: "card", personal: "David" };
  const glance = `<details class="glance" id="glance"><summary><span class="gt">Still to pay, at a glance</span><span class="gs">${gbp0(spendInc)} to ${long(endDate)}: ${srcTiles.filter(t => t.inc > 0.5).map(t => `${gbp0(t.inc)} ${short[t.k]}`).join(", ")}</span><span class="gx"></span></summary>
    <div class="gbody">
      <div class="gsrc">${srcTiles.map(t => `<div class="gtile ${FROM[t.k][1]}"><span>${FROM[t.k][0]}</span><b>${gbp0(t.inc)}</b><em>${gbp0(t.inc - t.vat)} before VAT, ${gbp0(t.vat)} VAT back</em><em>${t.rs.length} payment${t.rs.length === 1 ? "" : "s"}</em></div>`).join("")}</div>
      <div class="ghead"><span>Pot</span><span>Paid from</span><span class="r">With VAT</span><span class="r">VAT</span><span class="r">Before VAT</span></div>
      ${potNames.map(n => potHtml(n, potRows(n))).join("")}
      <div class="gtot"><span>All spending</span><span></span><span class="r">${gbp0(spendInc)}</span><span class="r">${gbp0(spendVat)}</span><span class="r">${gbp0(spendInc - spendVat)}</span></div>
      ${repay.length ? `<p class="gnote">Repaying, from the bank and not counted above: the company pays back what it owes.</p>${potHtml("Repaying David, Abi and James", repay)}` : ""}
      <div class="legend"><span><i style="background: var(--slate)"></i>From the bank</span><span><i style="background: var(--card)"></i>On the Barclaycard</span><span><i style="background: var(--me)"></i>David pays personally</span></div>
      <p class="foot">VAT back is what the VAT returns reclaim. ${unsplit.length ? `The plan holds ${[...new Set(unsplit.map(r => r.what.replace(/, quarter in advance$/, "").toLowerCase()))].join("; ")} before VAT, so their VAT is not split out here. ` : ""}Click a pot for its payments.</p>
    </div></details>`;

  // 8. The table.
  const HOW = { in: ["Bank, in", "in"], bank: ["Bank, out", "bank"], "abi-in": ["Abi lends into Tide", "abi"], "abi-out": ["Tide repays Abi", "abi"], card: ["Credit card", "card"], personal: ["David pays personally", "me"] };
  const trs = rows.map(r => { const [label, cls] = HOW[r.how]; const flat = r.how === "card" || r.how === "personal"; return `<tr class="${cls}${flat ? " flat" : ""}${r.balance < FLOOR && !flat ? " under" : ""}">
      <td class="d">${long(r.date)}</td><td><b>${esc(r.what)}</b>${r.note ? `<span class="n">${esc(r.note)}</span>` : ""}</td><td class="w">${esc(r.who)}</td><td><span class="pill ${cls}">${label}</span></td>
      <td class="n-in">${r.amount > 0 && !flat ? gbp(r.amount) : ""}</td><td class="n-out">${r.amount < 0 ? gbp(-r.amount) : ""}</td><td class="bal">${flat ? `<span class="same">${gbp(r.balance)}</span>` : gbp(r.balance)}</td></tr>`; }).join("\n");

  const assumptions = [
    `Starts from the bank saved on the Money page: ${gbp(startBal)} on ${long(start)}, all Tide accounts as one.`,
    `James's £37,000 on the 5th of its month, Bill's £10,000 on the 19th, James's loan on the 1st of December.`,
    `CBS: the balance less the 3% retention, half on ${long(v2)} and half on ${long(v3)} (two and a half weeks after the last payment, then again). Abi lends the VAT into Tide the same day.`,
    `VAT returns are monthly: filed on the 7th, refund on the 17th of the following month, and Abi is repaid the day it lands. October's refund is CBS's VAT only; the kit's VAT waits on invoices in the company's name.`,
    `Arundel on the 3rd, the sign on the 5th (ordered when James's money lands). The reception desk balance on the 9th is paid by David personally, as the deposit was, so it does not move the line: the company owes him for the whole desk.`,
    `Card buys spread through November on the Barclaycard (4th Obagi, 6th room 1 and the desk tray, 10th the couch, injectables and consumables, 13th emergency kit, 17th PAT, 24th deep clean). None of these move the bank. The insurance and the Google launch adverts are paid from the bank on 1 December.`,
    `Rates and advertising on the 1st (in the bank's own month, counted as spent on the bank's date, as they are not out of the balance yet), everyday running costs on the 10th, utilities on the 24th, rent on 25 December, the company's repayment to David on the 28th.`,
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
:root { --bg: #F6F8FB; --sheet: #FFFFFF; --panel: #EFF3F8; --ink: #1F2A44; --muted: #5C6577; --line: #C3CCD9; --slate: #445B72; --good: #3F7A68; --watch: #8A5A12; --watch-bg: #F6EEDF; --bad: #A33A3A; --bad-bg: #F8E6E6; --c-start: #2a78d6; --in: #1baf7a; --in-bg: #E6F6EF; --card: #eda100; --card-bg: #FBF1DA; --abi: #6250d6; --abi-bg: #ECE9FA; --me: #B4457A; --me-bg: #F8E8F0; --font-display: "Source Serif 4", Georgia, serif; --font-body: "Mulish", "Segoe UI", system-ui, sans-serif; color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 14px; line-height: 1.5; padding: 20px 16px 48px; }
.sheet { max-width: 1400px; margin: 0 auto; background: var(--sheet); border: 1px solid var(--line); border-radius: 2px; padding: 22px 24px 26px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.panel, .gbody, .pot { min-width: 0; } .tscroll { overflow-x: auto; }
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
.pill.in { background: var(--in-bg); color: var(--good); } .pill.bank { background: var(--panel); color: var(--slate); } .pill.abi { background: var(--abi-bg); color: var(--abi); } .pill.card { background: var(--card-bg); color: var(--watch); } .pill.me { background: var(--me-bg); color: var(--me); }
tr.me td b { color: var(--me); } tr.me td.n-out { color: var(--me); }
.cl-wrap { position: relative; } .cl-hint { font-size: 12px; color: var(--muted); }
.cl-tip { position: absolute; z-index: 5; width: 400px; max-width: calc(100% - 8px); background: var(--sheet); color: var(--ink); border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 8px 26px rgba(31, 42, 68, 0.18); padding: 10px 12px; font-size: 12px; line-height: 1.4; pointer-events: none; }
.cl-tip[hidden] { display: none; } .cl-tip.pin { pointer-events: auto; border-color: var(--ink); }
.cl-tip .dt { font-weight: 700; font-size: 13px; } .cl-tip .bal { font-family: var(--font-display); font-size: 24px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums lining-nums; } .cl-tip .bal.under { color: var(--bad); }
.cl-tip .chg { color: var(--muted); font-variant-numeric: tabular-nums; margin-bottom: 6px; }
.cl-tip .sec { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-top: 8px; padding-bottom: 2px; border-bottom: 1px solid var(--line); }
.cl-tip .r { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid var(--line); } .cl-tip .r:last-child { border-bottom: 0; }
.cl-tip .r .w { min-width: 0; flex: 1; } .cl-tip .r .w small { display: block; color: var(--muted); font-size: 11px; } .cl-tip .r .w .pill { margin-right: 5px; font-size: 10px; padding: 0 6px; vertical-align: 1px; }
.cl-tip .a { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700; } .cl-tip .a.in { color: var(--good); } .cl-tip .a.out { color: var(--bad); } .cl-tip .a.flat { color: var(--muted); font-weight: 600; } .cl-tip .a.me { color: var(--me); }
.cl-tip .nx { color: var(--muted); margin-top: 6px; } .cl-tip .pinned { font-size: 10.5px; color: var(--muted); margin-top: 6px; }
ol { margin: 0; padding-left: 20px; color: var(--muted); display: grid; gap: 4px; } ol li { padding-left: 2px; }
.foot { font-size: 11px; color: var(--muted); }
.glance { border: 1px solid var(--line); border-radius: 2px; background: var(--panel); }
.glance > summary { list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding: 10px 14px; }
.glance > summary::-webkit-details-marker, .pot > summary::-webkit-details-marker { display: none; }
.glance > summary:focus-visible, .pot > summary:focus-visible { outline: 2px solid var(--c-start); outline-offset: 2px; }
.glance .gt { font-family: var(--font-display); font-weight: 600; font-size: 16px; } .glance .gs { color: var(--muted); font-variant-numeric: tabular-nums; flex: 1; }
.glance .gx { font-size: 12px; font-weight: 700; color: var(--c-start); } .glance .gx::after { content: "Open"; } .glance[open] .gx::after { content: "Close"; }
.gbody { background: var(--sheet); border-top: 1px solid var(--line); padding: 14px; display: grid; gap: 10px; }
.gsrc { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.gtile { border-left: 4px solid var(--slate); background: var(--panel); padding: 10px 12px; display: grid; gap: 1px; } .gtile.card { border-color: var(--card); } .gtile.me { border-color: var(--me); }
.gtile span { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 700; } .gtile b { font-family: var(--font-display); font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; } .gtile em { font-style: normal; font-size: 12px; color: var(--muted); }
.ghead, .pot > summary, .gtot { display: grid; grid-template-columns: minmax(150px, 1.3fr) minmax(90px, 2fr) 96px 80px 96px; gap: 10px; align-items: center; font-variant-numeric: tabular-nums; }
.ghead { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 700; padding: 0 8px 4px; border-bottom: 2px solid var(--line); }
.ghead .r, .pot > summary .r, .gtot .r { text-align: right; } .pot > summary .m { color: var(--muted); }
.pot { border-bottom: 1px solid var(--line); } .pot > summary { list-style: none; cursor: pointer; padding: 8px; } .pot > summary:hover, .pot[open] > summary { background: var(--panel); }
.pot .pn { font-weight: 700; } .pot .pn small { display: block; font-weight: 400; font-size: 11.5px; color: var(--muted); }
.pot .pb { display: flex; height: 10px; border-radius: 2px; overflow: hidden; background: var(--panel); } .pot .pb i { display: block; height: 100%; }
.gtot { padding: 8px; font-weight: 700; border-top: 2px solid var(--ink); }
table.gl { margin: 4px 0 10px; } table.gl th, table.gl td { font-size: 12.5px; padding: 5px 8px; } table.gl th.r, table.gl td.r { text-align: right; white-space: nowrap; }
.nv { color: var(--muted); font-size: 11.5px; } .gnote { font-size: 12px; color: var(--muted); margin-top: 6px; }
@media (max-width: 720px) { .ghead, .pot > summary, .gtot { grid-template-columns: 1fr 76px 76px; } .ghead span:nth-child(2), .pot > summary .pb, .gtot span:nth-child(2), .ghead span:nth-child(4), .pot > summary .m, .gtot span:nth-child(4) { display: none; } }
@media (max-width: 720px) { td.w { display: none; } }
</style>
</head>
<body><div class="sheet">
  <div><div class="eyebrow">Abi Peters Skin Clinic · Winchester build · ${long(asOf)}</div><h1>The cash line, ${long(start)} to ${long(endDate)}</h1>
  <p class="lead">Every payment in the plan on the day it is expected, and the Tide balance after it. Bank rows move the line. Card and personal rows do not: the bank stays where it is and the row is greyed. The dates are the rules at the foot of the page where the plan has only a month; the amounts are the plan's.</p></div>
  ${glance}
  <div class="kpis">
    <div class="kpi"><span>Bank today</span><b>${gbp0(startBal)}</b><em>${long(start)}</em></div>
    <div class="kpi ${low.bal < FLOOR ? "bad" : low.bal < FLOOR * 1.25 ? "watch" : "good"}"><span>Lowest</span><b>${gbp0(low.bal)}</b><em>${long(low.date)}${low.bal < FLOOR ? ", below the safety net" : ""}</em></div>
    <div class="kpi ${christmas < FLOOR ? "bad" : "good"}"><span>At Christmas</span><b>${gbp0(christmas)}</b><em>after the rent on 25 December</em></div>
    <div class="kpi"><span>End of December</span><b>${gbp0(endBal)}</b><em>${long(endDate)}</em></div>
    <div class="kpi"><span>In</span><b>${gbp0(totalIn)}</b><em>funding, refunds, takings</em></div>
    <div class="kpi"><span>Out of the bank</span><b>${gbp0(totalBank)}</b><em>build, bills, rent, repayments</em></div>
    <div class="kpi"><span>On the cards</span><b>${gbp0(totalCard)}</b><em>does not move the line</em></div>
    <div class="kpi"><span>David pays personally</span><b style="color: var(--me)">${gbp0(totalPersonal)}</b><em>the desk balance; the company owes him</em></div>
  </div>
  <div class="panel"><h2>The balance, day by day</h2>
    <p class="cl-hint">Move along the line for what lands or leaves on each day and the balance after it. Click a day to hold it open; click again to let go.</p>
    <div class="cl-wrap">${chart}<div class="cl-tip" id="cl-tip" role="tooltip" hidden></div></div>
    <div class="legend"><span><i style="background: var(--c-start)"></i>Tide balance</span><span><i style="background: var(--bad)"></i>£10,000 safety net</span><span><i style="background: var(--c-start); border-radius: 50%"></i>a day the bank moves</span><span><i style="background: var(--sheet); border: 2px solid var(--card); border-radius: 50%"></i>a card day: the line stays put</span><span><i style="background: var(--sheet); border: 2px solid var(--me); border-radius: 50%"></i>David pays personally: the line stays put</span></div></div>
  <div class="panel"><h2>Every payment, in date order</h2>
    <div class="legend"><span class="pill in">Bank, in</span><span class="pill bank">Bank, out</span><span class="pill abi">Abi's VAT loan</span><span class="pill card">Credit card: the line does not move</span><span class="pill me">David pays personally: the line does not move</span></div>
    <div class="tscroll"><table><thead><tr><th>Date</th><th>What</th><th>To or from</th><th>How</th><th class="r">In</th><th class="r">Out</th><th class="r">Balance</th></tr></thead><tbody>
      <tr><td class="d">${long(start)}</td><td><b>Bank today</b><span class="n">All Tide accounts as one</span></td><td class="w">Tide</td><td></td><td class="n-in"></td><td class="n-out"></td><td class="bal">${gbp(startBal)}</td></tr>
${trs}
    </tbody></table></div></div>
  <div class="panel"><h2>The dates this line assumes</h2><ol>${assumptions.map(a => `<li>${a}</li>`).join("")}</ol>
    <p class="foot">Winchester only: Bedhampton's day-to-day costs and card are not in the plan, as the owner asked. Built from the Launch OS plan on ${long(asOf)}; change a line, its month or the bank balance and this page follows.</p></div>
</div>
<script>
(function () {
  ${hoverData}
  const DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const long = d => { const [y, m, dd] = d.split("-").map(Number); return DAYN[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] + " " + dd + " " + MON[m - 1]; };
  const gbp = v => (v < 0 ? "\\u2212" : "") + "\\u00a3" + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const HOW = { in: ["Bank, in", "in"], bank: ["Bank, out", "bank"], "abi-in": ["Abi lends", "abi"], "abi-out": ["Repays Abi", "abi"], card: ["Credit card", "card"], personal: ["David, personally", "me"] };
  const svg = document.getElementById("cl-chart"), hit = document.getElementById("cl-hit"), wrap = svg.parentElement, tip = document.getElementById("cl-tip"), guide = document.getElementById("cl-guide"), dot = document.getElementById("cl-dot");
  const byDay = new Map(); ROWS.forEach(r => { if (!byDay.has(r[0])) byDay.set(r[0], []); byDay.get(r[0]).push(r); });
  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; (parent || tip).appendChild(e); return e; };
  let pinned = -1, shown = -1;
  const dayAt = ev => { const b = svg.getBoundingClientRect(), sx = b.width / W; const f = (ev.clientX - b.left - L * sx) / ((W - L - R) * sx); return Math.max(0, Math.min(DAYS.length - 1, Math.round(f * (DAYS.length - 1)))); };
  const xOf = i => L + (i / (DAYS.length - 1)) * (W - L - R);
  function build(i) {
    const d = DAYS[i], rs = byDay.get(d) || [], bal = SERIES[i], prev = i ? SERIES[i - 1] : START, moves = rs.filter(r => r[3] !== "card" && r[3] !== "personal"), flat = rs.filter(r => r[3] === "card" || r[3] === "personal");
    tip.replaceChildren();
    el("div", "dt", long(d) + (i === 0 ? " \\u00b7 today" : ""));
    el("div", "bal" + (bal < FLOOR ? " under" : ""), gbp(bal));
    const chg = bal - prev;
    el("div", "chg", Math.abs(chg) < 0.005 ? (i === 0 ? "the bank as saved on the Money page" : "no change to the bank") : "from " + gbp(prev) + ", " + (chg > 0 ? "up " : "down ") + gbp(Math.abs(chg)) + (bal < FLOOR ? ", below the \\u00a310,000 safety net" : ""));
    const rowOf = r => { const [, what, who, how, amt, note] = r, e = el("div", "r"), w = el("div", "w", null, e); const p = el("span", "pill " + HOW[how][1], HOW[how][0], w); w.appendChild(document.createTextNode(what)); if (who || note) el("small", "", [who, note].filter(Boolean).join(" \\u00b7 "), w);
      const isFlat = how === "card" || how === "personal"; el("div", "a " + (isFlat ? (how === "personal" ? "me" : "flat") : amt > 0 ? "in" : "out"), (isFlat ? "" : amt > 0 ? "+ " : "\\u2212 ") + gbp(Math.abs(amt)) + (isFlat ? " (line stays)" : ""), e); };
    if (moves.length) { el("div", "sec", "Through the bank"); moves.forEach(rowOf); }
    if (flat.length) { el("div", "sec", "Not from the bank"); flat.forEach(rowOf); }
    if (!rs.length) {
      const nx = DAYS.slice(i + 1).find(x => byDay.has(x)), pv = DAYS.slice(0, i).reverse().find(x => byDay.has(x));
      el("div", "nx", "Nothing due this day." + (pv ? " Last: " + long(pv) + ", " + byDay.get(pv).map(r => r[1]).join("; ") + "." : "") + (nx ? " Next: " + long(nx) + ", " + byDay.get(nx).map(r => r[1]).join("; ") + "." : ""));
    }
    if (pinned === i) el("div", "pinned", "Held open: click the chart again to let go.");
  }
  function place(i, ev) {
    const b = svg.getBoundingClientRect(), wb = wrap.getBoundingClientRect(), sx = b.width / W, sy = b.height / VB.height;
    const px = (b.left - wb.left) + xOf(i) * sx;
    guide.setAttribute("x1", xOf(i).toFixed(1)); guide.setAttribute("x2", xOf(i).toFixed(1)); guide.setAttribute("visibility", "visible");
    const yv = yOf(SERIES[i]); dot.setAttribute("cx", xOf(i).toFixed(1)); dot.setAttribute("cy", yv.toFixed(1)); dot.setAttribute("visibility", "visible");
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px + 16; if (left + tw > wb.width - 4) left = px - tw - 16; left = Math.max(4, left);
    let top = (b.top - wb.top) + yv * sy - th / 2; top = Math.max(0, Math.min(top, wb.height - th));
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  // The chart's y scale, read back from the SVG so the dot sits on the line.
  const VB = svg.viewBox.baseVal; const maxV = Math.max.apply(null, SERIES.concat([FLOOR])) * 1.08, minV = Math.min.apply(null, [0].concat(SERIES)), T = 16, B = 34;
  const yOf = v => T + (1 - (v - minV) / (maxV - minV)) * (VB.height - T - B);
  function show(i, ev) { if (i === shown && !tip.hidden) { place(i, ev); return; } shown = i; build(i); place(i, ev); }
  function hide() { if (pinned >= 0) return; tip.hidden = true; guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); shown = -1; }
  hit.addEventListener("mousemove", ev => { if (pinned >= 0) return; show(dayAt(ev), ev); });
  hit.addEventListener("mouseleave", hide);
  hit.addEventListener("click", ev => { const i = dayAt(ev); if (pinned === i) { pinned = -1; tip.classList.remove("pin"); shown = -1; show(i, ev); } else { pinned = i; tip.classList.add("pin"); shown = -1; show(i, ev); } });
  document.addEventListener("click", ev => { if (pinned >= 0 && !ev.target.closest("#cl-chart") && !ev.target.closest("#cl-tip")) { pinned = -1; tip.classList.remove("pin"); hide(); } });
  hit.addEventListener("touchstart", ev => { const t = ev.touches[0]; pinned = -1; show(dayAt(t), t); }, { passive: true });
})();
</script>
</body></html>`;
}
