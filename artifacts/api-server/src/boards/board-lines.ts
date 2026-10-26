// @ts-nocheck
// The second Sankey on the Winchester Build Cash Board: every plan line, from the project
// total, through paid / committed / estimate, through its phase, to the line itself, with
// how each is paid (capital or card) and the uncosted lines from the layout pack in red.
// L: the plan lines with the active property's figures (planLines in routes/boards.ts);
// projectLines: the Money page's lines, for how each is paid.
export function boardLines(html: string, L, projectLines, asOf: string, extra: { items: any[]; card: any[] } = { items: [], card: [] }): string {
const PL = new Map(projectLines.map(l => [l.taskId, l]));
// How each line is paid: the plan's method. Lines already paid came from the bank (nothing
// is recorded on the cards); lines with no payment plan yet are "unset".
const methodOf = x => { const l = PL.get(x.id); const ms = l ? [...new Set(l.plan.map(p => p.method))] : [];
  if (ms.length === 1) return ms[0] === "card" ? "card" : "capital"; if (ms.length > 1) return "mixed";
  return l && (l.status === "paid" || l.status === "part-paid") ? "capital" : "unset"; };
let s = html;
function rep(o, n) { if (!s.includes(o)) throw new Error("board: missing " + o.slice(0, 90)); s = s.replace(o, () => n); }
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const asOfLong = (() => { const [y, m, d] = asOf.split("-").map(Number); return `${d} ${MONTH_LONG[m - 1]} ${y}`; })();

const PHASE = { "Pre-Lease Due Diligence": "Due diligence", "Legal, Lease & Handover": "Legal and lease", "Design, Approvals & Procurement": "Design and approvals",
  "Managed Building Works": "Building works", "FF&E, Equipment & Clinic Styling": "Furniture and equipment", "Clinical Governance & Compliance": "Clinical compliance",
  "Stock, Suppliers & Clinical Setup": "Stock and set-up", "Finance, Insurance & Admin": "Insurance and admin", "Marketing & Launch": "Launch adverts", "Handover, Snagging & Opening": "Handover" };
const NAME = [[/^Ref (\d+) - (.*)$/, (m, n, t) => `CBS ref ${n}: ${t}`], [/Asbestos/, "Asbestos survey"], [/Solicitor/, "Solicitor, lease"], [/RICS/, "RICS schedule of condition"],
  [/Rent Deposit/, "Rent deposit"], [/Design \/ Building Regulations/, "Design and Building Regs lead"], [/Building Control/, "Building Control"], [/Advertisement Consent/, "Advertisement consent"],
  [/Brand Identity/, "Brand identity"], [/CAD Drawings/, "CAD drawing pack"], [/Joinery/, "Clinical cabinetry (Howdens)"], [/External Signage/, "Shop sign"], [/Retail Shelving/, "Reception shelving unit"], [/^Lobby coffee station/, "Lobby coffee station"],
  [/Arundel/, "Fire alarm (Arundel)"], [/Treatment Couch/, "Treatment couch"], [/^Reception desk, Artisan/, "Reception desk (Artisan Deco)"], [/^Reception coat stand/, "Reception coat stand"], [/Reception furniture/, "Reception furniture"], [/Consultation Room Furniture/, "Treatment room 2 furniture"],
  [/Treatment Room Furniture/, "Treatment room furniture"], [/Skin Analysis/, "Skin analysis platform"], [/ACE Group/, "ACE membership"], [/Clinical Waste/, "Clinical waste contract"],
  [/Fire Risk/, "Fire risk assessment"], [/Emergency Drugs/, "Emergency drugs kit"], [/Opening Injectable/, "Opening injectable stock"], [/Smallwares/, "Smallwares and consumables"],
  [/Retail \/ Skincare/, "Retail and skincare stock"], [/FIGS/, "Scrubs (FIGS)"], [/^Trainers/, "Work trainers"], [/Hamilton Fraser/, "Insurance, Hamilton Fraser"], [/Broadband/, "Broadband"], [/Legionella/, "Legionella assessment"],
  [/PAT Testing/, "PAT testing"], [/Meta Ads/, "Meta launch adverts"], [/Google Ads/, "Google launch adverts"], [/deep clean/i, "Deep clean materials"]];
const nameOf = t => { if (/^Ref 21 /.test(t)) return "CBS ref 21: Building Regs and M&E CAD"; for (const [re, n] of NAME) if (re.test(t)) return typeof n === "function" ? t.replace(re, n) : n; return t; };
const r2 = v => Math.round(v * 100) / 100;
const lines = [];
for (const x of L) {
  const a = +x.act || 0, c = +x.com || 0, sel = +x.sel || 0, m = +x.amt || 0; let p = 0, cm = 0, e = 0;
  // Part paid against an estimate (no committed figure, as with furniture bought item by item):
  // what is paid shows as paid, the rest of the estimate as still to come.
  if (x.paid === "paid" && a > 0) p = a; else if (x.paid === "part-paid" && c > 0) { p = a > 0 ? a : m; cm = Math.max(0, c - p); }
  else if (x.paid === "part-paid" && (a > 0 || m > 0)) { p = a > 0 ? a : m; e = Math.max(0, sel - p); } else if (c > 0) cm = c; else e = sel;
  if (p + cm + e < 0.5) continue;
  const how = methodOf(x);
  // The share of the line that is ex VAT, from the Money page's VAT basis (1 where it carries none).
  const pl = PL.get(x.id), exFrac = pl && pl.recorded > 0 && pl.exVat > 0 ? Math.min(1, pl.exVat / pl.recorded) : 1;
  lines.push([PHASE[x.phase] ?? x.phase, nameOf(x.title), r2(p), r2(cm), r2(e), how === "mixed" ? "capital" : how, 0, x.id, Math.round(exFrac * 10000) / 10000]);
}
const PACK_GAP = /(price needed)|(CBS variation)|^Credit due from CBS|^Lobby coffee station|^Utility storage|^Fixings for our items|BG Nexus black nickel|^Herringbone LVT in the treatment rooms|^Laser supply and stop button/;
const ZERO = L.filter(x => PACK_GAP.test(x.title) && x.status !== "deferred" && !(+x.sel > 0) && !(+x.com > 0) && !(+x.act > 0)).length;
const UNC_NAME = [[/^Emergency lights/, "Emergency lights and exit signs"], [/^Ramp edge guarding/, "Ramp edge guarding"], [/^LED strips/, "LED strips, shelves and cupboards"], [/^Hang and power the two Tala/, "Tala pendants: hang, power, dimmers"],
  [/^Two high sockets/, "Two high sockets for audio"], [/^Reception desk power module/, "Desk power module and cable tray"], [/^Utility door re-hung/, "Utility door re-hung, with a closer"], [/^Fixings for our items/, "Fixings for our items"],
  [/^Coffee sink and tap/, "Coffee sink and tap"], [/BG Nexus black nickel/, "Black nickel switches (extra)"], [/^Herringbone LVT in the treatment rooms/, "Herringbone LVT, treatment rooms"], [/^Credit due from CBS: basins/, "CBS credit: basins and taps"],
  [/^Credit due from CBS: clinical/, "CBS credit: clinical fixings"], [/^Laser supply and stop button/, "Laser supply: keep or omit"], [/^WCs: replace/, "Replace the WCs (to discuss)"], [/^Lobby coffee station/, "Lobby coffee station"], [/^Utility storage/, "Utility storage"]];
for (const x of L) {
  if (!PACK_GAP.test(x.title) || x.status === "deferred" || +x.sel > 0 || +x.com > 0 || +x.act > 0) continue;
  const n = UNC_NAME.find(([re]) => re.test(x.title));
  lines.push([PHASE[x.phase] ?? x.phase, n ? n[1] : x.title, 0, 0, 0, "unset", 1, x.id, 1]);
}
const dashRe = new RegExp("\\s*[" + String.fromCharCode(0x2013, 0x2014) + "]\\s*", "g");
for (const l of lines) l[1] = l[1].replace(dashRe, ": ");

// What each line is made of, for the hover: its items on Abi's board, what the card register
// holds against it, and when the rest is due. Keyed by plan line id.
const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = v => { const [y, m] = String(v).split("-").map(Number); return MSHORT[m - 1] + " " + String(y).slice(2); };
const dm = v => { const [, m, d] = String(v).split("-").map(Number); return d + " " + MSHORT[m - 1]; };
const LDETAIL = {};
for (const l of lines) {
  const id = l[7]; if (id == null) continue;
  const its = extra.items.filter(i => i.task_id === id).map(i => [String(i.name).replace(dashRe, ": "), r2(+i.amount_gbp || 0), i.status]);
  const cd = extra.card.filter(c => c.task_id === id).map(c => [dm(c.date), String(c.description).replace(dashRe, ": "), r2(+c.amount_gbp || 0), c.card, c.kind]);
  const pl = PL.get(id); const left = pl && pl.remainingExVat >= 0.5 && pl.plan.length ? pl.plan : [];
  const how = left.length ? left.map(p => (left.length > 1 ? Math.round(p.share * 1000) / 10 + "% " : "") + ym(p.month)).join(", ") + (left.every(p => p.method === "card") ? ", on the card" : left.every(p => p.method !== "card") ? ", from the business bank" : "") : "";
  if (its.length || cd.length || how) LDETAIL[id] = { items: its, card: cd, due: how };
}

// 1. Styles.
rep(`footer { font-size: 11.5px;`, `.lsk-wrap { overflow-x: auto; position: relative; }
.lsk-tip { position: fixed; z-index: 50; width: 330px; max-height: calc(100vh - 16px); overflow: hidden; max-width: calc(100vw - 32px); box-sizing: border-box; background: var(--sheet); color: var(--ink); border: 1px solid var(--muted); border-radius: 4px; box-shadow: 0 6px 22px rgba(0,0,0,0.16); padding: 9px 11px; font-size: 11.5px; line-height: 1.35; pointer-events: none; }
.lsk-tip[hidden] { display: none; }
.lsk-tip .t { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.lsk-tip .h { font-weight: 700; color: var(--muted); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 8px; }
.lsk-tip .r { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
.lsk-tip .r span:first-child { min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lsk-tip .r span:last-child { white-space: nowrap; }
.lsk-tip .sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.lsk-tip .ok { color: var(--s-paid); font-weight: 700; } .lsk-tip .todo { color: var(--s-est); font-weight: 700; } .lsk-tip .none { color: var(--bad); font-weight: 700; }
.lsk-tip .m { color: var(--muted); }
.lsk-tip table { width: 100%; border-collapse: collapse; margin-top: 6px; font-variant-numeric: tabular-nums; }
.lsk-tip th { font-size: 10px; font-weight: 700; color: var(--muted); text-align: right; padding: 0 0 3px 8px; letter-spacing: 0.03em; text-transform: uppercase; }
.lsk-tip th:first-child, .lsk-tip td:first-child { text-align: left; padding-left: 0; }
.lsk-tip td { text-align: right; padding: 2px 0 2px 8px; white-space: nowrap; }
.lsk-tip tr.tot td { border-top: 1px solid var(--muted); font-weight: 700; padding-top: 4px; }
.lsk-tip .bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 7px; background: var(--panel); }
.lsk-wrap svg { min-width: 1000px; display: block; }
.lsk-pill { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; padding: 0 7px; border-radius: 8px; margin-right: 5px; line-height: 14px; border: 1px solid var(--ink); }
.lsk-pill.cap { color: var(--ink); } .lsk-pill.card { color: var(--sheet); background: var(--ink); } .lsk-pill.unset { color: var(--muted); border: 1px dashed var(--muted); }
.lsk-key { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 12px; color: var(--muted); }
.lsk-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; background: var(--panel); border-radius: 2px; padding: 8px 12px; font-size: 13px; color: var(--muted); }
.lsk-sum b { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums lining-nums; }
.lsk-sum .lbl { font-weight: 700; color: var(--ink); }
.lsk-key i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
:root { --s-paid: #3F7A68; --s-com: #2a78d6; --s-est: #c98500; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --s-paid: #8CC7B3; --s-com: #6aa5ec; --s-est: #E6B866; } }
:root[data-theme="dark"] { --s-paid: #8CC7B3; --s-com: #6aa5ec; --s-est: #E6B866; }
footer { font-size: 11.5px;`);

// 2. The card, straight after the funding Sankey.
rep(`      <p class="note" id="sankey-note"></p>
  </div>`, `      <p class="note" id="sankey-note"></p>
  </div>

  <div class="card">
      <div class="q">Every line of spend</div>
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px">
        <h2>The whole project, line by line: paid, committed or still an estimate (with VAT)</h2>
        <div class="seg" role="group" aria-label="Show" id="lsk-filter"><button type="button" data-v="all" aria-pressed="true">All lines</button><button type="button" data-v="paid" aria-pressed="false">Paid</button><button type="button" data-v="com" aria-pressed="false">Committed, not paid</button><button type="button" data-v="est" aria-pressed="false">Estimates</button><button type="button" data-v="capital" aria-pressed="false">From capital</button><button type="button" data-v="card" aria-pressed="false">On the card</button><button type="button" data-v="unc" aria-pressed="false">Uncosted</button></div>
      </div>
      <div class="lsk-key"><span><i style="background: var(--s-paid)"></i>Paid</span><span><i style="background: var(--s-com)"></i>Committed (quoted and agreed), not yet paid</span><span><i style="background: var(--s-est)"></i>Estimate, not yet committed</span><span><b class="lsk-pill cap">Capital</b>paid from the business bank</span><span><b class="lsk-pill card">Card</b>on the credit card</span><span><b class="lsk-pill unset">Not set</b>no payment month yet</span><span><i style="background: var(--bad)"></i><span style="color: var(--bad); font-weight: 700">Uncosted</span>&nbsp;in the plan at £0, price to come</span><span>Hover any line to see what it is made of, or a phase or the whole project for paid and still to pay, with and without VAT.</span></div>
      <p class="note">Every figure in this chart includes VAT, as the plan does. The rest of the board is before VAT, so the same line reads lower there: the joinery, desk and cabinetry is £1,800 here and £1,500 in What it buys.</p>
      <div class="lsk-sum" id="lsk-sum" aria-live="polite"></div>
      <div class="lsk-wrap"><div class="lsk-tip" id="lsk-tip" role="tooltip" hidden></div><svg id="lines-sankey" viewBox="0 0 1100 900" width="100%" role="img" aria-label="The project total flows into paid, committed and estimate, then into each phase, then into every costed line."><title>Every line of spend by status</title></svg></div>
      <p class="note" id="lsk-note"></p>
  </div>`);

// 3. Data and drawing, next to the funding Sankey's code.
rep(`  // ── panels ──`, `  // ── every line of spend: total, then paid / committed / estimate, then phase, then line ──
  // [phase, line, paid, committed not paid, estimate not committed, method, uncosted, plan id, ex VAT share], the plan's own figures, inc VAT where the line carries it, as at ${asOfLong}.
  const LINES = ${JSON.stringify(lines)};
  // What each line is made of: items on Abi's board, what the card register holds, when the rest is due.
  const LDETAIL = ${JSON.stringify(LDETAIL).replace(/</g, "\\u003c")};
  let lskFilter = "all";
  function lskTip(ev, l) {
    const box = document.getElementById("lsk-tip"); if (!box) return;
    const wrap = box.parentElement, d = LDETAIL[l[7]] || { items: [], card: [], due: "" };
    box.replaceChildren();
    const add = (cls, parent) => { const e = document.createElement("div"); if (cls) e.className = cls; (parent || box).appendChild(e); return e; };
    const span = (parent, text, cls, style) => { const e = document.createElement("span"); e.textContent = text; if (cls) e.className = cls; if (style) e.setAttribute("style", style); parent.appendChild(e); return e; };
    const row = (left, right, rcls) => { const r = add("r"); const a = span(r, ""); a.append(...[].concat(left)); span(r, right, rcls); return r; };
    const unc = l[6] === 1, total = l[2] + l[3] + l[4];
    add("t").textContent = l[1] + "   " + (unc ? "price to come" : gbp(total));
    if (unc) { add("m").textContent = "In the plan at £0 until it has a price (from the 9A layout pack)."; }
    else {
      const sw = k => { const e = document.createElement("span"); e.className = "sw"; e.style.background = tok("--s-" + k); return e; };
      [["paid", "Paid", 2], ["com", "Committed, not yet paid", 3], ["est", "Still to buy or price (estimate)", 4]].forEach(([k, n, i]) => { if (l[i] > 0.5) row([sw(k), n], gbp(l[i])); });
      add("m").textContent = l[5] === "card" ? "On the credit card" : l[5] === "capital" ? "From capital (the business bank)" : "No payment month set yet";
    }
    if (d.items.length) {
      add("h").textContent = "Made up of";
      d.items.forEach(([n, a, st]) => { const r = row(n, ""); r.lastChild.replaceChildren();
        const right = r.lastChild; if (st === "paid") { span(right, gbp(a) + "  ", ""); span(right, "paid", "ok"); }
        else if (a > 0) { span(right, gbp(a) + "  ", ""); span(right, st === "ordered" ? "ordered" : "to buy", "todo"); }
        else span(right, "price to come", "none"); });
      const sum = st => d.items.filter(i => i[2] === st).reduce((a, i) => a + i[1], 0);
      const paidItems = sum("paid"), ordered = sum("ordered"), open = d.items.filter(i => i[2] !== "paid" && i[2] !== "ordered").reduce((a, i) => a + i[1], 0);
      add("m").textContent = "Items: " + [paidItems > 0.5 ? gbp(paidItems) + " paid" : "", ordered > 0.5 ? gbp(ordered) + " ordered" : "", open > 0.5 ? gbp(open) + " still to buy" : ""].filter(Boolean).join(", ") + (d.items.some(i => i[2] !== "paid" && !(i[1] > 0)) ? (paidItems + ordered + open > 0.5 ? ", and some still to price" : "still to price") : "") + ".";
    }
    if (d.card.length && d.items.length) {
      const net = d.card.reduce((a, c) => a + (c[4] === "refund" ? -c[2] : c[2]), 0);
      add("h").textContent = /card/i.test(d.card[0][3]) ? "On the card" : "Paid personally, owed back by the company";
      add("").textContent = d.card.length + (d.card.length === 1 ? " charge, " : " charges, ") + gbp(net) + ", on the " + d.card[0][3] + " (" + d.card.map(c => c[0]).filter((v, i, a) => a.indexOf(v) === i).join(", ") + ")";
    } else if (d.card.length) {
      add("h").textContent = /card/i.test(d.card[0][3]) ? "On the card" : "Paid personally, owed back by the company";
      d.card.forEach(([when, what, a, card, kind]) => row(when + "  " + what, (kind === "refund" ? "-" : "") + gbp(a)));
      add("m").textContent = d.card[0][3];
    }
    if (d.due) { add("h").textContent = "Still to pay"; add("").textContent = d.due; }
    lskPlace(ev, box);
  }
  // Placed against the window, beside the pointer, and kept on screen.
  function lskPlace(ev, box) {
    box.hidden = false;
    const bw2 = box.offsetWidth, bh = box.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let x = ev.clientX + 16, y = ev.clientY - bh / 2;
    if (x + bw2 > vw - 8) x = ev.clientX - bw2 - 16;
    x = Math.max(8, Math.min(x, vw - bw2 - 8)); y = Math.max(8, Math.min(y, vh - bh - 8));
    box.style.left = x + "px"; box.style.top = y + "px";
  }
  // A phase, or the whole project: paid and still to pay against the total, each with and without VAT.
  function lskGroupTip(ev, name, ls) {
    const box = document.getElementById("lsk-tip"); if (!box) return;
    box.replaceChildren();
    const add = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; (parent || box).appendChild(e); return e; };
    const costed = ls.filter(l => l[6] !== 1);
    const sum = f => costed.reduce((a, l) => a + f(l), 0);
    const inc = i => sum(l => l[i]), ex = i => sum(l => l[i] * (l[8] ?? 1));
    const paidI = inc(2), comI = inc(3), estI = inc(4), totI = paidI + comI + estI;
    const paidE = ex(2), remE = ex(3) + ex(4), totE = paidE + remE;
    add("div", "t", null, name + "   " + gbp(totI));
    add("div", "m", null, costed.length + " costed line" + (costed.length === 1 ? "" : "s") + (totI > 0.5 ? ", " + Math.round(100 * paidI / totI) + "% paid" : ""));
    if (totI > 0.5) { const bar = add("div", "bar"); [["paid", paidI], ["com", comI], ["est", estI]].forEach(([k, v]) => { if (v < 0.5) return; const seg = add("span", "", bar); seg.style.width = (100 * v / totI) + "%"; seg.style.background = tok("--s-" + k); }); }
    const tb = add("table"), hr = add("tr", "", tb); ["", "Inc VAT", "Ex VAT", "VAT"].forEach(h => add("th", "", hr, h));
    const row = (label, i, e, cls) => { const r = add("tr", cls || "", tb); add("td", "", r, label); add("td", "", r, gbp(i)); add("td", "", r, gbp(e)); add("td", "", r, gbp(i - e)); };
    row("Paid", paidI, paidE);
    row("Still to pay", comI + estI, remE);
    row("Total", totI, totE, "tot");
    if (comI + estI > 0.5) add("div", "m", null, "Still to pay: " + [comI > 0.5 ? gbp(comI) + " committed" : "", estI > 0.5 ? gbp(estI) + " still an estimate" : ""].filter(Boolean).join(", ") + ", inc VAT.");
    const unc = ls.length - costed.length; if (unc) { const u = add("div", "m", null, "Plus " + unc + " uncosted line" + (unc === 1 ? "" : "s") + " at £0, price to come."); u.style.color = tok("--bad"); }
    add("div", "m", null, "VAT comes back on the VAT return. Lines that carry none, such as the rent deposit, insurance and adverts, count as ex VAT.");
    lskPlace(ev, box);
  }
  function lskTipHide() { const box = document.getElementById("lsk-tip"); if (box) box.hidden = true; }
  document.addEventListener("click", ev => { if (!ev.target.closest || !ev.target.closest("#lines-sankey")) lskTipHide(); });
  window.addEventListener("scroll", lskTipHide, { passive: true });
  function drawLines() {
    const svg = document.getElementById("lines-sankey"); if (!svg) return;
    while (svg.lastChild && svg.lastChild.tagName !== "title") svg.removeChild(svg.lastChild);
    const NS = "http://www.w3.org/2000/svg", W = 1100, top = 30, bw = 10, xT = 10, xS = 190, xP = 420, xL = 640, slot = 15, gGap = 10;
    const ST = [["paid", "Paid", 2], ["com", "Committed, not paid", 3], ["est", "Estimate", 4]];
    const col = k => tok("--s-" + k), ink = tok("--ink"), muted = tok("--muted"), sheet = tok("--sheet"), font = tok("--font-body");
    const phases = [...new Set(LINES.map(l => l[0]))];
    const val = l => l[2] + l[3] + l[4];
    const unc = l => l[6] === 1, red = tok("--bad");
    const rank = l => unc(l) ? 3 : l[2] > 0 ? 0 : l[3] > 0 ? 1 : 2;
    const byPhase = phases.map(p => ({ p, lines: LINES.filter(l => l[0] === p).sort((a, b) => rank(a) - rank(b) || val(b) - val(a)) }));
    const total = LINES.reduce((a, l) => a + val(l), 0);
    // Scale: line slots are at least 15px so every label reads; bands keep their true width.
    let k = 0.006; for (let i = 0; i < 30; i++) { const h = LINES.reduce((a, l) => a + Math.max(val(l) * k, slot), 0) + (phases.length - 1) * gGap; k *= ((820 + LINES.filter(unc).length * slot) / h); }
    const lineNodes = []; let y = top;
    byPhase.forEach(g => { g.y0 = y; g.lines.forEach(l => { const h = val(l) * k, sl = Math.max(h, slot); lineNodes.push({ l, y: y + (sl - h) / 2, h, mid: y + sl / 2 }); y += sl; }); g.y1 = y; y += gGap; });
    const H = y + 10; svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const el = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const q in a) e.setAttribute(q, a[q]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
    const tip = (e, t) => { const ti = document.createElementNS(NS, "title"); ti.textContent = t; e.appendChild(ti); return e; };
    const isM = lskFilter === "capital" || lskFilter === "card", isU = lskFilter === "unc";
    const band = (x0, y0, x1, y1, h, key, t, mk) => { const c = (x0 + x1) / 2; const on = lskFilter === "all" || lskFilter === key || (isM && mk === lskFilter);
      return tip(el("path", { d: \`M\${x0},\${y0}C\${c},\${y0} \${c},\${y1} \${x1},\${y1}L\${x1},\${y1 + h}C\${c},\${y1 + h} \${c},\${y0 + h} \${x0},\${y0 + h}Z\`, fill: col(key), "fill-opacity": on ? 0.34 : isM && !mk ? 0.12 : 0.05 }), t); };
    const txt = (x, yy, anchor, str, size, weight, fill, op) => el("text", { x, y: yy, "text-anchor": anchor, fill, "font-size": size, "font-weight": weight, "font-family": font, opacity: op ?? 1, style: \`paint-order: stroke; stroke: \${sheet}; stroke-width: 3px; stroke-linejoin: round\` }, str);
    // Phase nodes sit level with their lines; status nodes stack on the left; the total spans them.
    const phaseNodes = byPhase.map(g => { const v = g.lines.reduce((a, l) => a + val(l), 0), h = v * k; return { g, v, h, y: (g.y0 + g.y1) / 2 - h / 2 }; });
    const stVal = ST.map(([key, , i]) => LINES.reduce((a, l) => a + l[i], 0));
    const stH = stVal.map(v => v * k), stGap = 26, stTot = stH.reduce((a, b) => a + b, 0) + stGap * 2;
    let sy = (top + H - 10) / 2 - stTot / 2; const stY = stH.map(h => { const yy = sy; sy += h + stGap; return yy; });
    const totH = total * k, totY = (top + H - 10) / 2 - totH / 2;
    // Total to status.
    let ty = totY; ST.forEach(([key, name], i) => { band(xT + bw, ty, xS, stY[i], stH[i], key, \`\${name}: \${gbp(stVal[i])}\`); ty += stH[i]; });
    // Status to phase, and phase to line.
    const stOut = stY.slice(), phIn = phaseNodes.map(n => n.y);
    phaseNodes.forEach((n, pi) => ST.forEach(([key, name, i]) => { const v = n.g.lines.reduce((a, l) => a + l[i], 0); if (v < 0.5) return; const h = v * k;
      band(xS + bw, stOut[ST.findIndex(s => s[0] === key)], xP, phIn[pi], h, key, \`\${n.g.p}, \${name.toLowerCase()}: \${gbp(v)}\`); stOut[ST.findIndex(s => s[0] === key)] += h; phIn[pi] += h; }));
    const phOut = phaseNodes.map(n => n.y);
    lineNodes.forEach(ln => { const pi = phases.indexOf(ln.l[0]); let yy = ln.y; ST.forEach(([key, name, i]) => { const v = ln.l[i]; if (v < 0.5) return; const h = v * k;
      band(xP + bw, phOut[pi], xL, yy, h, key, \`\${ln.l[1]}, \${name.toLowerCase()}: \${gbp(v)}\`, ln.l[5]); phOut[pi] += h; yy += h; }); });
    // Nodes and labels.
    el("rect", { x: xT, y: totY, width: bw, height: totH, fill: ink, rx: 2 });
    txt(xT + bw + 6, totY - 8, "start", "Whole project " + gbp(total), "12", "700", ink);
    ST.forEach(([key, name], i) => { tip(el("rect", { x: xS, y: stY[i], width: bw, height: Math.max(2, stH[i]), fill: col(key), rx: 2 }), name + ": " + gbp(stVal[i]));
      const on = lskFilter === "all" || lskFilter === key || isM || isU; txt(xS + bw + 6, stY[i] + stH[i] / 2 - 2, "start", name, "12", "700", ink, on ? 1 : 0.35); txt(xS + bw + 6, stY[i] + stH[i] / 2 + 12, "start", gbp(stVal[i]) + " · " + Math.round(100 * stVal[i] / total) + "%", "11", "400", muted, on ? 1 : 0.35); });
    // Hover a phase, or the whole project, for paid and still to pay with and without VAT.
    const groupHit = (x, y0, w, h, name, ls) => { const hit = el("rect", { x, y: y0, width: w, height: h, fill: "transparent", style: "cursor: help" });
      hit.addEventListener("mousemove", ev => lskGroupTip(ev, name, ls)); hit.addEventListener("mouseleave", lskTipHide); hit.addEventListener("click", ev => { ev.stopPropagation(); lskGroupTip(ev, name, ls); }); };
    phaseNodes.forEach(n => { el("rect", { x: xP, y: n.y, width: bw, height: Math.max(2, n.h), fill: muted, rx: 2 });
      txt(xP + bw + 6, n.y + n.h / 2 - 2, "start", n.g.p, "11.5", "700", ink); txt(xP + bw + 6, n.y + n.h / 2 + 11, "start", gbp(n.v), "10.5", "400", muted);
      const hh = Math.max(n.h, 30); groupHit(xP - 4, n.y + n.h / 2 - hh / 2, 170, hh, n.g.p, n.g.lines); });
    groupHit(xT - 4, totY - 22, 170, totH + 22, "Whole project", LINES);
    lineNodes.forEach(ln => { const l = ln.l, key = l[2] > 0 && l[3] + l[4] < 0.5 ? "paid" : l[3] > 0 && l[2] < 0.5 ? "com" : l[4] > 0 ? "est" : "com";
      const parts = ST.filter(([, , i]) => l[i] > 0.5), on = lskFilter === "all" || parts.some(([k2]) => k2 === lskFilter) || (isM && l[5] === lskFilter) || (isU && unc(l)), mk = l[5];
      if (unc(l)) {
        tip(el("rect", { x: xL, y: ln.mid - 1.5, width: bw, height: 3, fill: red, rx: 1, opacity: on ? 1 : 0.3 }), \`\${l[1]}: uncosted, price to come\`);
        tip(txt(xL + bw + 6, ln.mid + 4, "start", \`\${l[1]}  price to come\`, "11", "600", red, on ? 1 : 0.3), \`\${l[1]}: in the plan at £0 until it has a price (from the 9A layout pack)\`);
        txt(W - 4, ln.mid + 4, "end", "uncosted", "10.5", "700", red, on ? 1 : 0.3);
        return;
      }
      let yy = ln.y; parts.forEach(([k2, , i]) => { const h = Math.max(1.5, l[i] * k); tip(el("rect", { x: xL, y: yy, width: bw, height: h, fill: col(k2), rx: 1 }), \`\${l[1]}: \${gbp(l[i])}\`); yy += l[i] * k; });
      const how = parts.map(([k2, name, i]) => parts.length > 1 ? \`\${name.toLowerCase()} \${gbp(l[i])}\` : name.toLowerCase()).join(", ");
      tip(txt(xL + bw + 6, ln.mid + 4, "start", \`\${l[1]}  \${gbp(val(l))}\`, "11", "600", ink, on ? 1 : 0.3), \`\${l[1]}: \${gbp(val(l))} (\${how}; \${mk === "card" ? "on the credit card" : mk === "capital" ? "from capital" : "payment not set yet"})\`);
      const px = W - 112, pw = 50, pill = { capital: ["Capital", "none", ink, ink, ""], card: ["Card", ink, ink, sheet, ""], unset: ["Not set", "none", muted, muted, "3 2"] }[mk];
      tip(el("rect", { x: px, y: ln.mid - 7, width: pw, height: 14, rx: 7, fill: pill[1], stroke: pill[2], "stroke-width": 1, "stroke-dasharray": pill[4], opacity: on ? 1 : 0.3 }), mk === "card" ? "On the credit card" : mk === "capital" ? "Paid from capital (the business bank)" : "No payment month or method set yet");
      el("text", { x: px + pw / 2, y: ln.mid + 3.5, "text-anchor": "middle", fill: pill[3], "font-size": "9.5", "font-weight": "700", "font-family": font, opacity: on ? 1 : 0.3 }, pill[0]);
      txt(W - 4, ln.mid + 4, "end", parts.length > 1 ? "part paid" : parts[0][1].replace("Committed, not paid", "committed").toLowerCase(), "10.5", "400", col(key), on ? 1 : 0.3); });
    lineNodes.forEach(ln => { const hit = el("rect", { x: xL - 4, y: ln.mid - slot / 2, width: W - xL + 4, height: slot, fill: "transparent", style: "cursor: help" });
      hit.addEventListener("mousemove", ev => lskTip(ev, ln.l)); hit.addEventListener("mouseleave", lskTipHide); hit.addEventListener("click", ev => { ev.stopPropagation(); lskTip(ev, ln.l); }); });
    txt(xT, 16, "start", "The project", "11", "600", muted); txt(xS, 16, "start", "Where each pound stands", "11", "600", muted); txt(xP, 16, "start", "Phase", "11", "600", muted); txt(xL, 16, "start", "Every line", "11", "600", muted); txt(W - 112 + 25, 16, "middle", "Paid from", "11", "600", muted);
    // The bucket picked by the buttons, in pounds, with its paid / committed / estimate split.
    {
      const costed = LINES.filter(l => !unc(l));
      if (isU) { const u = LINES.filter(unc); document.getElementById("lsk-sum").innerHTML = \`<span class="lbl" style="color: \${red}">Uncosted</span><b style="color: \${red}">\${u.length} lines</b><span>in the plan at £0, price to come: \${u.map(l => l[1]).join(", ")}</span>\`; }
      else {
      const pick = lskFilter === "all" ? costed : lskFilter === "capital" || lskFilter === "card" ? costed.filter(l => l[5] === lskFilter) : costed.filter(l => l[ST.find(s => s[0] === lskFilter)[2]] > 0.5);
      const part = i => pick.reduce((a, l) => a + l[i], 0);
      const name = { all: "Whole project", paid: "Paid", com: "Committed, not yet paid", est: "Estimates, not yet committed", capital: "From capital", card: "On the credit card" }[lskFilter];
      const amount = lskFilter === "paid" ? part(2) : lskFilter === "com" ? part(3) : lskFilter === "est" ? part(4) : pick.reduce((a, l) => a + val(l), 0);
      const split = ST.map(([k2, n2, i]) => [n2, part(i)]).filter(([, v]) => v > 0.5);
      const showSplit = lskFilter === "all" || lskFilter === "capital" || lskFilter === "card";
      document.getElementById("lsk-sum").innerHTML = \`<span class="lbl">\${name}</span><b>\${gbp(amount)}</b><span>\${pick.length} line\${pick.length === 1 ? "" : "s"}\${showSplit && split.length ? ": " + split.map(([n2, v]) => n2.toLowerCase().replace("committed, not paid", "committed") + " " + gbp(v)).join(", ") : ""}\${lskFilter === "capital" || lskFilter === "card" ? \` · \${Math.round(100 * amount / total)}% of the project\` : ""}\${lskFilter === "all" ? \` · plus \${LINES.filter(unc).length} uncosted lines in red\` : ""}</span>\`;
      }
    }
    const [p, c, e] = stVal;
    document.getElementById("lsk-note").textContent = \`\${LINES.filter(l => !unc(l)).length} costed lines, \${gbp(total)} in all, the same as the top of the Plan page: \${gbp(p)} paid, \${gbp(c)} committed but not yet paid, \${gbp(e)} still estimates. From capital \${gbp(LINES.filter(l => l[5] === "capital").reduce((a, l) => a + val(l), 0))}, on the card \${gbp(LINES.filter(l => l[5] === "card").reduce((a, l) => a + val(l), 0))}\${LINES.some(l => l[5] === "unset" && !unc(l)) ? \`, not set yet \${gbp(LINES.filter(l => l[5] === "unset" && !unc(l)).reduce((a, l) => a + val(l), 0))}\` : ""}. The shop sign is part paid (£350 of £2,262). Inc VAT where the line carries it, as in the plan. The ${ZERO} uncosted lines from the layout pack (at £0, price to come: the building extras and gaps, the CBS credits, the lobby and utility) are drawn in red: they are in the plan at £0 until they have a price. The plan as at ${asOfLong}.\`;
  }
  document.getElementById("lsk-filter").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; lskFilter = b.dataset.v;
    document.querySelectorAll("#lsk-filter button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawLines(); });

  // ── panels ──`);
rep(`    drawCharts(r); drawSankey(r, S);`, `    drawCharts(r); drawSankey(r, S); drawLines();`);
return s;
}
