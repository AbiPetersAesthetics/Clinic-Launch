// Patient Maths: the Entrepreneurs Circle budget method for the Winchester Meta ads (owner, 18 Nov 2026).
// Decide how many new consultations Abi can take, decide what a paying patient may cost, then work back
// through every step to the leads, clicks and spend needed. Every figure is worked out each time the page
// is opened, from: the treatment list (product costs, live from the database, so a changed stock cost moves
// the margin, break-even, target and budget at once), the latest Ads Pathway snapshot (Meta, GHL and the
// ANS outcomes the pathway check records), and the owner's rules below. Nothing is typed in by hand.
// Owner's rules: 2 consultations a day of 40 minutes, Tuesday to Friday (Saturday later); target a third of
// break-even; value over 12 months; paying means a treatment or skincare within 60 days; cost per patient is
// Meta only; Winchester only, with no Bedhampton figures borrowed: blank until Winchester has its own data.

export interface PMConfig {
  openFrom: string; consultSlotsPerDay: number; consultMinutes: number; clinicDays: number[]; saturdayFrom: string | null;
  targetShareOfBreakEven: number; valueWindowDays: number; paidWindowDays: number; minPayingForBudget: number; minSample: number;
  skincareCostShare: number | null; aliases: Record<string, string>;
}
export const PM_DEFAULTS: PMConfig = {
  openFrom: "2026-12-08", consultSlotsPerDay: 2, consultMinutes: 40, clinicDays: [2, 3, 4, 5], saturdayFrom: null,
  targetShareOfBreakEven: 1 / 3, valueWindowDays: 365, paidWindowDays: 60, minPayingForBudget: 10, minSample: 5,
  skincareCostShare: null, aliases: {},
};

interface Item { name: string; pounds: number; kind?: string }
interface Lead {
  name: string; ad?: string; formIso?: string; bookedIso?: string; apptIso?: string; attended?: boolean | string | null;
  treated?: boolean | null; firstValue?: number; firstItems?: Item[]; firstIso?: string; visits?: number; valueToDate?: number; value365?: number;
}
interface AdRow { adset: string; impressions: number; clicks: number; spend: number; leads: number }
interface CapDay { date: string; openMin: number; bookedMin: number }
export interface PMSnapshot {
  updated?: string; updatedIso?: string; windowFrom?: string;
  spend?: { total: number; leadForms: number; bookingAd: number }; leadForms?: { clicks: number };
  ads?: AdRow[]; leads?: Lead[]; capacity?: { asOf?: string; fill21?: number; days?: CapDay[] };
}
export interface Treatment { key: string; display_name: string; category: string; price_winchester: number | null; product_cost_estimate_gbp: number | null }

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gbp = (n: number) => (n < 10 ? `£${n.toFixed(2)}` : `£${Math.round(n).toLocaleString("en-GB")}`);
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const int = (n: number) => Math.ceil(n).toLocaleString("en-GB");
const DAY = 86400000;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * DAY).toISOString().slice(0, 10);
const nice = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Val = { v: number | null; note: string; ok: boolean };
const have = (v: number, note: string): Val => ({ v, note, ok: true });
const wait = (note: string): Val => ({ v: null, note, ok: false });

// A paid item's product cost, from the treatment list, or null when it cannot be costed yet.
function costOf(it: Item, T: Treatment[], cfg: PMConfig): { cost: number | null; why?: string } {
  if ((it.kind ?? "").toLowerCase() === "skincare") {
    return cfg.skincareCostShare != null ? { cost: it.pounds * cfg.skincareCostShare } : { cost: null, why: "skincare cost share not set" };
  }
  const n = norm(it.name);
  const alias = cfg.aliases[it.name] ?? cfg.aliases[n];
  let t = alias ? T.find((x) => x.key === alias) : undefined;
  if (!t) t = T.find((x) => norm(x.display_name) === n || norm(x.key) === n);
  if (!t) t = T.filter((x) => n.includes(norm(x.display_name)) || norm(x.display_name).includes(n)).sort((a, b) => b.display_name.length - a.display_name.length)[0];
  if (!t) return { cost: null, why: "not on the treatment list" };
  if (t.product_cost_estimate_gbp == null) return { cost: null, why: `${t.display_name} has no product cost` };
  return { cost: t.product_cost_estimate_gbp };
}

export function computePatientMaths(p: PMSnapshot | null, T: Treatment[], cfg: PMConfig, today: string) {
  const leads = p?.leads ?? [];
  const now = Date.parse(today + "T12:00:00Z");
  const lfAds = (p?.ads ?? []).filter((a) => !/landing page/i.test(a.adset));
  const spend = p?.spend?.leadForms ?? 0;
  const views = lfAds.reduce((a, x) => a + (x.impressions || 0), 0);
  const clicks = p?.leadForms?.clicks ?? lfAds.reduce((a, x) => a + (x.clicks || 0), 0);
  const nLeads = leads.length;
  const booked = leads.filter((l) => l.bookedIso);
  const past = booked.filter((l) => l.apptIso && Date.parse(l.apptIso) < now);
  const showDecided = past.filter((l) => l.attended != null && l.attended !== "moved");
  const shows = showDecided.filter((l) => l.attended === true);
  const payDecided = shows.filter((l) => l.treated === true || l.treated === false || (l.apptIso && now - Date.parse(l.apptIso) > cfg.paidWindowDays * DAY));
  const paying = leads.filter((l) => l.treated === true);

  // 12 to 14, 15, 16: each step's rate, measured only when there is enough to trust.
  const rate = (num: number, den: number, what: string): Val =>
    den >= cfg.minSample ? have(num / den, `${num} of ${den} ${what}`) : wait(den ? `${num} of ${den} so far: waiting for ${cfg.minSample}` : "not measured yet");
  const r = {
    ctr: rate(clicks, views, "views clicked"),
    c2l: rate(nLeads, clicks, "clicks became leads"),
    l2b: rate(booked.length, nLeads, "leads booked"),
    show: rate(shows.length, showDecided.length, "booked turned up"),
    paid: rate(payDecided.filter((l) => l.treated === true).length, payDecided.length, `seen paid within ${cfg.paidWindowDays} days`),
  };

  // 2: capacity. Planned slots on clinic days in the next 4 weeks from opening; the diary can only lower it.
  const start = today > cfg.openFrom ? today : cfg.openFrom;
  let days = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i), wd = new Date(d + "T12:00:00Z").getUTCDay();
    if (cfg.clinicDays.includes(wd) || (wd === 6 && cfg.saturdayFrom && d >= cfg.saturdayFrom)) days++;
  }
  const planned4w = days * cfg.consultSlotsPerDay;
  const capDays = (p?.capacity?.days ?? []).filter((d) => d.date >= start && d.date < addDays(start, 28));
  const free4w = capDays.length ? capDays.reduce((a, d) => a + Math.min(cfg.consultSlotsPerDay, Math.max(0, Math.floor((d.openMin - d.bookedMin) / cfg.consultMinutes))), 0) : null;
  const consultsMonth = Math.round((planned4w * 30.4) / 28);

  // 4 to 9: value, from the paying Meta leads only.
  const valued = paying.filter((l) => typeof l.firstValue === "number");
  const firstAvg = valued.length ? valued.reduce((a, l) => a + (l.firstValue as number), 0) / valued.length : null;
  const missing: Record<string, number> = {};
  let keptSum = 0, valSum = 0, costed = 0, uncosted = 0;
  for (const l of valued) {
    if (!l.firstItems?.length) { uncosted++; missing["items not recorded by the pathway check"] = (missing["items not recorded by the pathway check"] ?? 0) + 1; continue; }
    let c = 0, bad = false;
    for (const it of l.firstItems) { const x = costOf(it, T, cfg); if (x.cost == null) { bad = true; missing[x.why!] = (missing[x.why!] ?? 0) + 1; } else c += x.cost; }
    if (bad) { uncosted++; continue; }
    const v = l.firstItems.reduce((a, it) => a + it.pounds, 0);
    keptSum += (v * 5) / 6 - c; valSum += v; costed++;
  }
  const margin = valSum > 0 ? keptSum / valSum : null;
  const yearDone = paying.filter((l) => typeof l.value365 === "number");
  const year = yearDone.length ? yearDone.reduce((a, l) => a + (l.value365 as number), 0) / yearDone.length : null;
  const toDate = paying.filter((l) => typeof l.valueToDate === "number");
  const visits = paying.filter((l) => typeof l.visits === "number");

  const M: Record<string, Val> = {};
  M.first = firstAvg != null ? have(firstAvg, `average of ${valued.length} paying patient${valued.length === 1 ? "" : "s"}`) : wait("waiting for the first paying patient");
  M.returns = visits.length ? have(visits.reduce((a, l) => a + (l.visits as number) - 1, 0) / visits.length, `return visits per paying patient so far (${visits.length})`) : wait("waiting for paying patients");
  M.ltv = year != null ? have(year, `${yearDone.length} patients past 12 months`) : toDate.length ? wait(`not 12 months yet: ${gbp(toDate.reduce((a, l) => a + (l.valueToDate as number), 0) / toDate.length)} each so far`) : wait("waiting for paying patients");
  M.margin = margin != null ? have(margin, `kept after VAT and product cost, ${costed} costed${uncosted ? `, ${uncosted} not costed yet` : ""}`) : wait(uncosted ? `${uncosted} paying patient${uncosted === 1 ? "" : "s"} not costed yet` : "waiting for paying patients");
  M.lgp = year != null && margin != null ? have(year * margin, "12 month value times the margin") : wait("needs the 12 month value and the margin");
  M.be = firstAvg != null && margin != null ? have(firstAvg * margin, "first visit times the margin") : wait("needs the first visit and the margin");
  M.target = M.be.ok ? have((M.be.v as number) * cfg.targetShareOfBreakEven, `${Math.round(cfg.targetShareOfBreakEven * 100) === 33 ? "a third" : pct(cfg.targetShareOfBreakEven)} of break-even`) : wait("needs break-even");

  // 1 and 11: patients wanted, and the budget (only once enough have paid to trust the value).
  const allRates = r.show.ok && r.paid.ok;
  const patientsMonth = allRates ? consultsMonth * (r.show.v as number) * (r.paid.v as number) : null;
  M.patients = patientsMonth != null ? have(patientsMonth, `${consultsMonth} consultations x ${pct(r.show.v!)} turn up x ${pct(r.paid.v!)} pay`) : wait(`${consultsMonth} consultations a month; patients follow once turn-up and paying are measured`);
  const enough = paying.length >= cfg.minPayingForBudget;
  M.budget = enough && patientsMonth != null && M.target.ok ? have(patientsMonth * (M.target.v as number), "patients wanted x target cost") : wait(`waiting for data: ${paying.length} of ${cfg.minPayingForBudget} paying patients`);

  // 17 and 18: what each month needs, worked back from the consultations wanted, and what each may cost.
  const need: { key: string; label: string; n: number | null; actualCost: number | null; unit: string }[] = [];
  const leadsNeed = r.l2b.ok ? consultsMonth / (r.l2b.v as number) : null;
  const clicksNeed = leadsNeed != null && r.c2l.ok ? leadsNeed / (r.c2l.v as number) : null;
  const viewsNeed = clicksNeed != null && r.ctr.ok ? clicksNeed / (r.ctr.v as number) : null;
  need.push({ key: "views", label: "People who see the ad", n: viewsNeed, actualCost: views ? (spend / views) * 1000 : null, unit: "per 1,000 views" });
  need.push({ key: "clicks", label: "Link clicks", n: clicksNeed, actualCost: clicks ? spend / clicks : null, unit: "per click" });
  need.push({ key: "leads", label: "Leads", n: leadsNeed, actualCost: nLeads ? spend / nLeads : null, unit: "per lead" });
  need.push({ key: "booked", label: "Booked consultations", n: consultsMonth, actualCost: booked.length ? spend / booked.length : null, unit: "per booking" });
  need.push({ key: "seen", label: "Consultations attended", n: r.show.ok ? consultsMonth * (r.show.v as number) : null, actualCost: shows.length ? spend / shows.length : null, unit: "per attended" });
  need.push({ key: "paying", label: "New paying patients", n: patientsMonth, actualCost: paying.length ? spend / paying.length : null, unit: "per paying patient" });
  const B = M.budget.ok ? (M.budget.v as number) : null;
  const allowed = need.map((s) => ({ ...s, allowed: B != null && s.n ? (s.key === "views" ? (B / s.n) * 1000 : B / s.n) : null }));

  // 19 to 21: actual cost per paying patient (Meta only) and payback.
  M.cpp = paying.length ? have(spend / paying.length, `${gbp(spend)} lead form spend / ${paying.length} paying`) : wait(booked.length ? `${booked.length} booked, none paid yet` : "waiting for paying patients");
  if (M.cpp.ok && M.be.ok) M.payback = (M.cpp.v as number) <= (M.be.v as number) ? have(0, "paid back on the first visit") : M.lgp.ok && (M.lgp.v as number) >= (M.cpp.v as number) ? have(12, "paid back within 12 months") : M.lgp.ok ? have(99, "not paid back within 12 months") : wait("first visit does not cover it; needs the 12 month value");
  else M.payback = wait("needs cost per paying patient and break-even");

  const gaps = T.filter((t) => t.category !== "consultation" && t.price_winchester && t.product_cost_estimate_gbp == null).map((t) => t.display_name);
  return { r, M, need: allowed, consultsMonth, planned4w, free4w, days, start, spend, views, clicks, nLeads, booked: booked.length, shows: shows.length, paying: paying.length, missing, gaps, enough };
}

export function renderPatientMaths(p: PMSnapshot | null, T: Treatment[], cfg: PMConfig, today: string, head: string): string {
  const X = computePatientMaths(p, T, cfg, today);
  const { r, M } = X;
  const show = (v: Val, f: (n: number) => string) => (v.ok ? f(v.v as number) : "Not measured yet");
  const chip = (v: Val) => `<span class="pm-chip ${v.ok ? "ok" : "wait"}">${v.ok ? "Measured" : "Waiting"}</span>`;
  const row = (n: number, label: string, v: Val, fmt: (n: number) => string, source: string) =>
    `<li class="pm-row"><span class="pm-n">${n}</span><div class="pm-main"><div class="pm-top"><b>${esc(label)}</b>${chip(v)}</div><div class="pm-val">${esc(show(v, fmt))}</div><div class="pm-note">${esc(v.note)}</div><div class="pm-src">${esc(source)}</div></div></li>`;
  const fixed = (n: number, label: string, value: string, note: string, source: string, tag = "Set") =>
    `<li class="pm-row"><span class="pm-n">${n}</span><div class="pm-main"><div class="pm-top"><b>${esc(label)}</b><span class="pm-chip ok">${esc(tag)}</span></div><div class="pm-val">${esc(value)}</div><div class="pm-note">${esc(note)}</div><div class="pm-src">${esc(source)}</div></div></li>`;
  const fresh = p?.updated ? `Meta, GHL and ANS figures from the pathway check, ${esc(p.updated)}.` : "No pathway snapshot yet.";

  const verdict = M.budget.ok
    ? `Budget for the next month: <b>${gbp(M.budget.v as number)}</b>, about ${gbp((M.budget.v as number) / 30.4)} a day, for ${int(M.patients.v as number)} new paying patients at ${gbp(M.target.v as number)} each.`
    : `The budget appears once ${cfg.minPayingForBudget} Meta leads have paid (${X.paying} so far). Until then this page tracks capacity, the flow and today's costs.`;

  const flow = X.need.map((s) => {
    const tone = s.allowed == null || s.actualCost == null ? "none" : s.actualCost <= s.allowed * 0.8 ? "ok" : s.actualCost <= s.allowed ? "near" : "over";
    const word = { none: "", ok: "well within", near: "close to the limit", over: "over the limit" }[tone];
    return `<div class="pm-step"><div class="pm-step-h"><b>${esc(s.label)}</b><span class="pm-big">${s.n != null ? int(s.n) : "?"}</span></div>
      <div class="pm-step-m"><span>Most we can pay: <b>${s.allowed != null ? gbp(s.allowed) : "not set yet"}</b> ${esc(s.unit)}</span><span class="pm-pill ${tone}">Today ${s.actualCost != null ? gbp(s.actualCost) : "not measured"}${word ? `, ${word}` : ""}</span></div></div>`;
  }).join("");

  const missing = Object.entries(X.missing);
  const capNote = X.free4w != null && X.free4w < X.planned4w ? `The diary has only ${X.free4w} free ${cfg.consultMinutes} minute slots in that time, so it is the limit.` : X.free4w != null ? `The diary has room for all of them (${X.free4w} free).` : "Free slots in the diary are read by the pathway check once the Winchester diary opens.";

  const body = `<div class="board">
  <div class="head"><div><div class="eyebrow">Winchester · Meta lead ads · worked backwards</div><h1>Patient Maths</h1>
  <p>How many consultations Abi can take, what a paying patient may cost, and the leads, clicks and budget that follow. Worked out each time this page opens: product costs straight from the treatment list, so a changed stock cost changes the answer at once. ${fresh}</p></div></div>
  <div class="pm-verdict ${M.budget.ok ? "ok" : "wait"}">${verdict}</div>
  <div class="pm-formula"><div><span>New paying patients a month</span><b>${M.patients.ok ? int(M.patients.v as number) : "?"}</b></div><i>x</i><div><span>Target cost each</span><b>${M.target.ok ? gbp(M.target.v as number) : "?"}</b></div><i>=</i><div><span>Monthly budget</span><b>${M.budget.ok ? gbp(M.budget.v as number) : "?"}</b></div></div>

  <h2>What each month needs</h2>
  <p class="pm-lede">From ${X.consultsMonth} booked consultations a month, worked back through today's measured rates. Most we can pay is the budget divided by the number needed at that step.</p>
  <div class="pm-flow">${flow}</div>

  <h2>What we want</h2><ol class="pm-list">
  ${row(1, "New paying patients wanted a month", M.patients, (n) => int(n), "Capacity (2) x turn-up (15) x paying (16)")}
  ${fixed(2, "Capacity: new consultations a month", `${X.consultsMonth}`, `${cfg.consultSlotsPerDay} slots of ${cfg.consultMinutes} minutes on ${X.days} clinic days in the 4 weeks from ${nice(X.start)}${cfg.saturdayFrom ? `, Saturdays from ${nice(cfg.saturdayFrom)}` : ", Tuesday to Friday (Saturday not added yet)"}. ${capNote}`, "Owner's rule, checked against the ANS diary")}
  ${fixed(3, "Cash", "Not used", "You judge cash yourself (owner, 18 Nov 2026).", "Owner's rule")}
  </ol>

  <h2>What a patient is worth</h2><ol class="pm-list" start="4">
  ${row(4, "First visit spend", M.first, gbp, "ANS: first paid treatment or skincare within 60 days, via the pathway check")}
  ${row(5, "Return visits", M.returns, (n) => n.toFixed(1), "ANS: paid visits after the first, via the pathway check")}
  ${row(6, "12 month value", M.ltv, gbp, "ANS: all paid at Winchester in the first 12 months")}
  ${row(7, "Margin kept", M.margin, pct, "Treatment list product costs, read live, against what each patient paid")}
  ${row(8, "12 month profit after products", M.lgp, gbp, "6 x 7")}
  </ol>

  <h2>What we can afford</h2><ol class="pm-list" start="9">
  ${row(9, "Break-even cost per paying patient", M.be, gbp, "4 x 7")}
  ${row(10, "Target cost per paying patient", M.target, gbp, "Owner's rule: a third of break-even")}
  ${row(11, "Monthly budget", M.budget, gbp, "1 x 10")}
  </ol>

  <h2>The flow</h2><ol class="pm-list" start="12">
  ${row(12, "Views that click", r.ctr, pct, "Meta, lead form ads")}
  ${row(13, "Clicks that become leads", r.c2l, pct, "Meta clicks, Meta and GHL leads")}
  ${row(14, "Leads that book", r.l2b, pct, "GHL booked tag, matched in the ANS diary")}
  ${row(15, "Booked who turn up", r.show, pct, "ANS appointment status (attended, no-show, cancelled)")}
  ${row(16, "Seen who pay", r.paid, pct, "ANS: treatment or skincare within 60 days of the consultation")}
  ${fixed(17, "Leads needed a month", X.need[2].n != null ? int(X.need[2].n) : "Not measured yet", `${X.consultsMonth} consultations / leads that book`, "2 / 14", X.need[2].n != null ? "Worked out" : "Waiting")}
  </ol>

  <h2>Daily checks and the result</h2><ol class="pm-list" start="18">
  ${fixed(18, "Most we can pay per click, lead and booking", X.need[1].allowed != null ? `${gbp(X.need[1].allowed)} / ${gbp(X.need[2].allowed!)} / ${gbp(X.need[3].allowed!)}` : "Not set yet", "Budget / the number needed at each step (shown above).", "11 and 17", X.need[1].allowed != null ? "Worked out" : "Waiting")}
  ${fixed(19, "Today per click, lead and booking", `${X.clicks ? gbp(X.spend / X.clicks) : "?"} / ${X.nLeads ? gbp(X.spend / X.nLeads) : "?"} / ${X.booked ? gbp(X.spend / X.booked) : "?"}`, `${gbp(X.spend)} lead form spend, ${X.clicks} clicks, ${X.nLeads} leads, ${X.booked} booked.`, "Meta spend, Meta and GHL counts", "Measured")}
  ${row(20, "Cost per paying patient (Meta only)", M.cpp, gbp, "Meta lead form spend / paying patients from Meta leads")}
  ${row(21, "Payback", M.payback, () => M.payback.note, "20 against 9 and 8")}
  </ol>

  ${missing.length || X.gaps.length ? `<h2>To sharpen the margin</h2><ul class="pm-gaps">${missing.map(([k, n]) => `<li>${n} paying patient${n === 1 ? "" : "s"}: ${esc(k)}</li>`).join("")}${X.gaps.length ? `<li>No product cost yet on the treatment list: ${esc(X.gaps.join(", "))}. Add them on Market, Pricing and this page updates at once.</li>` : ""}</ul>` : ""}
  <p class="pm-foot">Method: Entrepreneurs Circle. Rules set by the owner on 18 Nov 2026. A rate shows once ${cfg.minSample} people have reached that step; the budget once ${cfg.minPayingForBudget} have paid. Budget changes still need the owner's yes.</p>
</div>
<style>
.pm-verdict{padding:14px 16px;border-radius:2px;font-size:15px}.pm-verdict.ok{background:var(--panel)}.pm-verdict.wait{background:var(--watch-bg)}
.pm-formula{display:flex;flex-wrap:wrap;gap:10px;align-items:center;border:1px solid var(--line);border-radius:2px;padding:12px 14px}
.pm-formula div{display:grid;gap:2px;flex:1 1 150px;min-width:0}.pm-formula span{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);font-weight:700}
.pm-formula b{font-family:var(--font-display);font-size:24px;font-weight:600}.pm-formula i{font-style:normal;color:var(--muted);font-size:20px}
.pm-lede{color:var(--muted);max-width:80ch}
.pm-flow{display:grid;gap:0;border-top:1px solid var(--line)}
.pm-step{padding:10px 0;border-bottom:1px solid var(--line);display:grid;gap:4px}
.pm-step-h{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.pm-big{font-family:var(--font-display);font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.pm-step-m{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted)}.pm-step-m b{color:var(--ink)}
.pm-pill{font-weight:700;font-size:12px;padding:1px 7px;border-radius:2px;background:var(--panel)}.pm-pill.ok{color:var(--good)}.pm-pill.near{background:var(--watch-bg);color:var(--watch)}.pm-pill.over{background:var(--bad-bg);color:var(--bad)}
.pm-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pm-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;border:1px solid var(--line);border-radius:2px;padding:10px 12px}
.pm-n{font-family:var(--font-display);font-size:18px;color:var(--slate);font-variant-numeric:tabular-nums}
.pm-main{display:grid;gap:2px;min-width:0}.pm-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.pm-val{font-family:var(--font-display);font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}
.pm-note{font-size:13px;color:var(--muted)}.pm-src{font-size:11.5px;color:var(--slate)}
.pm-chip{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:1px 7px;border-radius:2px}.pm-chip.ok{background:var(--panel);color:var(--good)}.pm-chip.wait{background:var(--watch-bg);color:var(--watch)}
.pm-gaps{margin:0;padding-left:18px;color:var(--muted);display:grid;gap:4px}.pm-foot{font-size:12px;color:var(--muted)}
</style>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head.replace("<title>Winchester Ads Board</title>", "<title>Patient Maths</title>")}</head><body>${body}</body></html>`;
}
