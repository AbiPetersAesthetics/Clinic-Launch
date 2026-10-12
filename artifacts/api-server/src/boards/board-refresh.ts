// @ts-nocheck
// The Winchester Build Cash Board's data, from the live Money page: the bank and its date,
// the unpaid lines as they stand, what is already paid, what the money buys, and the
// clinics' net takings and running costs, October to June. It writes them into the board
// as first designed (board-template.html, 30 September 2026), so the board looks exactly
// as it did and only its figures and dates move.

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayMonth = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_LONG[m - 1]}`; };
export const longDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_LONG[m - 1]} ${y}`; };
export const shortDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`; };

// What the money buys, ex VAT: the CBS contract by trade and the kit by room. Each plan line
// still to pay (and with a payment month) lands in one place, so the groups add up to the
// payment lines. Names and notes as the board first showed them.
const TRADES: Record<number, [string, string]> = {
  3: ["Partitions and walls", "treatment-room partitions; the glass ramp panel is out (CBS revised price)"], 4: ["Curved frontage to the two treatment rooms", ""], 6: ["Two doors to the treatment rooms", "frames and architraves"],
  10: ["Plumbing and drainage", "two treatment-room basins, staff sink, hot water"], 11: ["Heating, cooling and fresh air", "existing system zoned, extra units, fresh-air supply"], 7: ["Electrics and M&E design", "small power, isolation, emergency stop, sockets"],
  8: ["Lighting", "reception, clinical and practical"], 13: ["Flooring", "herringbone LVT front of house, clinical vinyl in the treatment rooms"], 14: ["Decoration and finishes", "premium front of house, scrubbable in clinical areas"],
  17: ["Shopfront refurbishment", "subject to conservation consent"], 18: ["Security and access", "treatment-room locks, alarm adaptation"], 2: ["Strip-out and demolition", ""], 1: ["Preliminaries", "site set-up, management, welfare"],
  21: ["Building Regs coordination and M&E CAD", ""],
};
const TRADE_ORDER = [3, 4, 6, 10, 11, 7, 8, 13, 14, 17, 18, 2, 1, 21];
const KIT: [RegExp, string, string, string][] = [
  [/^Treatment Couch/i, "treat", "Treatment couch", ""],
  [/^Treatment Room Furniture/i, "treat", "Room 1 furniture and equipment", "Maru desk, two chairs, trolley, Omega 7 lamp, dispensers, basins and taps"],
  [/^Consultation Room Furniture/i, "treat", "Treatment room 2 furniture", "chairs, table"],
  [/^Joinery/i, "recep", "Reception desk and clinical cabinetry (joinery)", "shared with the treatment rooms"],
  [/^Reception furniture/i, "recep", "Reception furniture and styling", "Amboise sofa and pouffe, rug, side table, two Tala pendants, Lucia chair, the lobby chair"],
  [/^External Signage/i, "front", "External sign, balance", "the deposit is already paid"],
  [/^Arundel/i, "safety", "Fire alarm (Arundel)", ""],
  [/^Fire Risk/i, "safety", "Fire risk assessment after the fit-out", ""], [/^Emergency Drugs/i, "safety", "Emergency drugs and equipment", ""],
  [/^Legionella/i, "safety", "Legionella assessment", ""], [/^Clinical Waste/i, "safety", "Clinical waste contract", ""], [/^PAT Testing/i, "safety", "PAT testing", ""],
  [/^Opening Injectable/i, "open", "Opening injectable stock", ""], [/Smallwares/i, "open", "Clinical smallwares and consumables", ""], [/^Hamilton Fraser/i, "open", "Insurance for the year", "no VAT"],
  [/^Meta Ads/i, "open", "Launch adverts, Meta", "no VAT"], [/^Google Ads/i, "open", "Launch adverts, Google", "no VAT"], [/^FIGS/i, "open", "Scrubs (FIGS)", ""],
  [/^Trainers/i, "open", "Work trainers", ""], [/^Broadband/i, "open", "Broadband set-up", ""], [/deep clean/i, "open", "Deep clean materials", ""],
];
const GROUPS: [string, string, string][] = [["cbs", "The building work (CBS), by trade", "whole clinic: two treatment rooms, reception, utility, two WCs"], ["treat", "Treatment rooms, kit", ""], ["recep", "Reception, kit", ""],
  ["front", "Shop front", ""], ["safety", "Safety and compliance", ""], ["open", "Opening", ""], ["other", "Other", ""]];
function detailJs(lines) {
  const by = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
  const cbs = new Map();
  for (const l of lines) {
    if (l.remainingExVat < 0.5 || l.planProblem) continue;
    const ref = l.title.match(/^Ref (\d+) - /);
    if (ref) { cbs.set(+ref[1], (cbs.get(+ref[1]) || 0) + l.remainingExVat); continue; }
    const ki = KIT.findIndex(([re]) => re.test(l.title));
    if (ki < 0) { by.other.push([999, l.title, Math.round(l.remainingExVat), ""]); continue; }
    let [, g, name, sub] = KIT[ki];
    if (/^Arundel/i.test(l.title)) { if (l.paid > 0) { name = "Fire alarm (Arundel), the 70% balance"; sub = "commissioning; the 30% deposit is paid"; } else sub = "30% on booking, 70% when finished"; }
    by[g].push([ki, name, Math.round(l.remainingExVat), sub]);
  }
  for (const g of Object.keys(by)) by[g].sort((a, b) => a[0] - b[0]);
  const refs = [...TRADE_ORDER, ...[...cbs.keys()].filter(r => !TRADE_ORDER.includes(r)).sort((a, b) => a - b)];
  for (const n of refs) if (cbs.has(n)) by.cbs.push([0, TRADES[n] ? TRADES[n][0] : `Ref ${n}`, Math.round(cbs.get(n)), TRADES[n] ? TRADES[n][1] : ""]);
  const q = (x) => JSON.stringify(x);
  const groupJs = ([k, name, sub]) => {
    const ls = by[k]; if (!ls.length) return null;
    const body = ls.map(([, n, v, s]) => `[${q(n)}, ${v}, ${q(s)}]`);
    if (k === "cbs") { const rows = []; for (let i = 0; i < body.length; i += 3) rows.push("      " + body.slice(i, i + 3).join(", ")); return `    { name: ${q(name)}, sub: ${q(sub)}, lines: [\n${rows.join(",\n")} ] },`; }
    return `    { name: ${q(name)}, sub: ${q(sub)}, lines: [${body.join(", ")}] },`;
  };
  return `  const DETAIL = [\n${GROUPS.map(groupJs).filter(Boolean).join("\n")}\n  ];\n`;
}

export function boardRefresh(template: string, J, asOf: string): string {
  let s = template;
  function rep(o, n, all?) { if (!s.includes(o)) throw new Error("board template: missing " + o.slice(0, 90)); s = all ? s.split(o).join(n) : s.replace(o, () => n); }
  const cut = (a, b, n) => { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error("board template: markers missing " + a.slice(0, 60)); s = s.slice(0, i) + n + s.slice(j); };
  const r2 = v => Math.round(v * 100) / 100;
  const IDX = { "2026-10": 1, "2026-11": 2, "2026-12": 3, "2027-01": 4, "2027-02": 5, "2027-03": 6, "2027-04": 7, "2027-05": 8, "2027-06": 9 };
  if (J.rows[0].month !== "2026-10") throw new Error("The board covers October 2026 to June 2027 and needs the Money page to start in October; it now starts in " + J.rows[0].label + ".");
  const bankAt = J.bank ? J.bank.asAt : (J.config.openingDate || "2026-10-05");

  // 1. The unpaid lines, grouped as the board shows them.
  const STAGE = { 1: ["cbs1", "CBS stage 1 (20%)"], 2: ["cbs2", "CBS stage 2 (60%)"], 3: ["cbs3", "CBS stage 3 (17%)"], 8: ["cbs4", "CBS retention (3%), after snagging"] };
  const itemOf = (t, ph, m) => /^Ref \d/.test(t) ? [...STAGE[m], "cbs", true]
    : /Arundel/.test(t) ? (m === 1 ? ["arundel1", "Fire alarm (Arundel), 30% on booking", "kit"] : ["arundel2", "Fire alarm (Arundel), 70% when finished", "kit"])
    : /Signage Package/.test(t) ? ["sign", "Shop sign, balance", "kit"] : /Joinery/.test(t) ? ["joinery", "Joinery, desk and cabinetry", "kit"]
    : /^FF&E/.test(ph) ? ["furniture", "Furniture and the couch, four lines", "kit"] : /^(FIGS|Trainers)/.test(t) ? ["scrubs", "Scrubs and trainers", "kit"] : /Injectable|Smallwares/.test(t) ? ["stock", "Opening stock and consumables", "kit"]
    : /Hamilton Fraser/.test(t) ? ["insurance", "Insurance, annual (no VAT)", "kit"] : /Broadband|deep clean/i.test(t) ? ["broadband", "Broadband and deep clean", "kit"]
    : /Meta Ads/.test(t) ? ["meta", "Launch adverts, Meta (no VAT)", "kit"] : /Google Ads/.test(t) ? ["google", "Launch adverts, Google (no VAT)", "kit"]
    : ["checks", "Pre-opening checks, waste, emergency kit", "kit"];
  // A group's lines are one payment while they share a month, a method and a VAT basis. A
  // line that differs (moved to another month, put on the bank, no VAT) becomes its own
  // payment beside the group, named with its month, rather than stopping the board.
  const MNAME = { 1: "October", 2: "November", 3: "December", 4: "January", 5: "February", 6: "March", 7: "April", 8: "May", 9: "June" };
  const items = new Map(); const unsched = [];
  for (const l of J.projectLines) {
    if (l.remainingExVat < 0.5) continue;
    if (l.planProblem) { unsched.push(l); continue; }
    for (const p of l.plan) {
      const m = IDX[p.month]; if (!m) throw new Error("A payment falls outside October to June: " + l.title + ", " + p.month);
      const [id, name, group, locked] = itemOf(l.title, l.phase, m);
      const method = p.method === "card" ? "card" : "bank", vat = l.vatBasis !== "no VAT";
      const fits = (x) => x.m === m && x.method === method && (x.ex < 0.01 || x.vat === vat);
      let it = items.get(id);
      if (it && !fits(it)) {
        const key = `${id}_${m}_${method}${vat ? "" : "_novat"}`;
        it = items.get(key) ?? { id: key, base: id, name: `${name}, ${MNAME[m]}${method !== it.method ? ` (${method})` : ""}`, ex: 0, vatEx: 0, vat, method, m, locked: !!locked, group };
      }
      it = it ?? { id, base: id, name, ex: 0, vatEx: 0, vat, method, m, locked: !!locked, group };
      it.ex += l.remainingExVat * p.share; if (vat) it.vatEx += l.remainingExVat * p.share; items.set(it.id, it);
    }
  }
  const ORDER = ["sign", "arundel1", "cbs1", "cbs2", "arundel2", "cbs3", "cbs4", "joinery", "furniture", "scrubs", "stock", "insurance", "checks", "broadband", "meta", "google"];
  const list = [...items.values()].sort((a, b) => ORDER.indexOf(a.base) - ORDER.indexOf(b.base) || a.m - b.m);
  const itemsJs = list.map(i => `    { id: "${i.id}", name: "${i.name}", ex: ${r2(i.ex)}, vat: ${i.vatEx > 0.01}, method: "${i.method}", m: ${i.m},${i.locked ? " locked: true," : ""} group: "${i.group}" },`).join("\n");

  // 2. Already paid, ex VAT (it is in the bank balance).
  const NAMES = [[/Skin Analysis/, "Skin analysis platform and training"], [/Rent Deposit/, "Rent deposit"], [/Solicitor/, "Solicitor"], [/Design \/ Building Regulations/, "Design and Building Regulations lead"],
    [/Building Control/, "Building Control submission"], [/RICS/, "RICS schedule of condition"], [/Asbestos/, "Asbestos survey"], [/Brand Identity/, "Brand identity and visual assets"],
    [/External Signage/, "External sign, deposit"], [/CAD Drawings/, "CAD drawing pack"], [/Advertisement Consent/, "Advertisement consent"], [/ACE Group/, "ACE membership"], [/Arundel/, "Fire alarm (Arundel), 30% deposit"]];
  const paid = J.projectLines.filter(l => l.paid > 0).map(l => { const n = NAMES.find(([re]) => re.test(l.title)); const ex = /^no VAT/.test(l.vatBasis) ? l.paid : l.paid / 1.2;
    return [n ? n[1] : l.title, Math.round(ex), l.paid]; }).sort((a, b) => b[1] - a[1]);
  const paidEx = paid.reduce((a, p) => a + p[1], 0), paidInc = Math.round(paid.reduce((a, p) => a + p[2], 0));
  const paidJs = "[" + paid.map(p => `[${JSON.stringify(p[0])}, ${p[1]}]`).join(", ") + "]";

  // 3. The clinics' net takings, running costs and rent, October to June. October counts
  // only the days after the bank date, as on the Money page.
  const rows = J.rows.slice(0, 9), keep = 1 - (J.bank ? J.bank.elapsedShare : 0);
  const arr = f => "[0, " + rows.map((r, k) => Math.round(f(r) * (k === 0 ? keep : 1))).join(", ") + "]";
  const NET_B = arr(r => r.bedh.contribution), NET_W = arr(r => r.winc.contribution);
  const FIXED = arr(r => r.running.utilities + r.running.general + r.running.marketing + r.rates);
  const RENT = "[0, " + rows.map(r => Math.round(r.rentPaid)).join(", ") + "]";
  const startBank = J.bank ? J.bank.balanceGbp : J.config.openingBank;
  const loanMonth = IDX[J.loans[0]?.drawMonth] === 2 ? 2 : 1;

  cut(`  const MONTHS = [`, `  const DETAIL = [`, `  const MONTHS = [${JSON.stringify(shortDate(bankAt))}, "Oct 26", "Nov 26", "Dec 26", "Jan 27", "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27"];
  const ITEMS = [
${itemsJs}
  ];
  // What the money buys, ex VAT, grouped for Abi. The CBS lines are the contract by
  // trade (69,362, CBS's revised Q2002C of 6 October); the kit is the plan's lines split to rooms. Every pound here is one
  // of the ${list.length} payment lines above.
`);
  cut(`  const DETAIL = [`, `  const PAID = [`, detailJs(J.projectLines));
  cut(`  const PAID = [`, `  const NET_B = [`, `  const PAID = ${paidJs};\n`);
  cut(`  const NET_B = [`, `  const CAPITAL = {`, `  const NET_B = ${NET_B};\n  const NET_W = ${NET_W};\n  const FIXED = ${FIXED};\n  const RENT = ${RENT};\n`);
  rep(`start: 34000, loan: 10000, loanMonth: 1,`, `start: ${startBank}, loan: 10000, loanMonth: ${loanMonth},`, true);

  // 4. The words.
  const unschedText = unsched.length ? ` Not in the figures yet, because they have no payment month: ${unsched.map(l => /Shelving/.test(l.title) ? "retail shelving and LED" : /Retail \/ Skincare/.test(l.title) ? "retail and skincare opening stock" : l.title).join(" and ")} (${"£" + Math.round(unsched.reduce((a, l) => a + l.remainingExVat, 0)).toLocaleString("en-GB")} ex VAT).` : "";
  const paidNote = `On top of these, £${paidEx.toLocaleString("en-GB")} ex VAT has already been paid (£${paidInc.toLocaleString("en-GB")} as invoiced) and is in the starting bank: see What it buys.${unschedText}`;
  rep(`Abi Peters Skin Clinic · Winchester build · 30 September 2026`, `Abi Peters Skin Clinic · Winchester build · ${longDate(asOf)}, bank as at ${dayMonth(bankAt)}`);
  rep(`<label class="lbl" for="start">Bank at the end of September</label><input id="start" type="number" step="500" value="34000" min="0"><span class="hint">Business account, before anything lands.</span>`,
      `<label class="lbl" for="start">Bank on ${dayMonth(bankAt)}</label><input id="start" type="number" step="500" value="${startBank}" min="0"><span class="hint">Business account, after what is already paid and before James's and Bill's money lands.</span>`);
  rep(`<button type="button" data-v="1" aria-pressed="true">1 October</button><button type="button" data-v="2" aria-pressed="false">End of November</button>`,
      `<button type="button" data-v="1" aria-pressed="${loanMonth === 1}">October</button><button type="button" data-v="2" aria-pressed="${loanMonth === 2}">End of November</button>`);
  rep(`Money in, money out and the bank, September to June`, `Money in, money out and the bank, ${dayMonth(bankAt)} to June`);
  rep(`Bank and card can be swapped on the unlocked lines. CBS's four stages and the deposit stay on the bank. On top of these, £10,760 ex VAT has already been paid (£11,634 as invoiced): see What it buys.`,
      `Bank and card can be swapped on the unlocked lines. CBS's four stages stay on the bank. ${paidNote}`, true);
  rep(`grouped from the same 16 payment lines.`, `grouped from the same ${list.length} payment lines.`);
  rep(`Already paid before October<span class="sub"> · not in the model</span>`, `Already paid by ${dayMonth(bankAt)}<span class="sub"> · in the starting bank</span>`);
  rep(`for the clinics' net takings, 30 September 2026.`, `for the clinics' net takings, as on ${longDate(asOf)} with the bank as at ${dayMonth(bankAt)}. October counts only the trading after ${dayMonth(bankAt)}.`);
  return s;
}
