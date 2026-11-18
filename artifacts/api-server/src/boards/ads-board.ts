// The Winchester Ads Board: the command centre for paid ads. Now (every ad, the funnel to paying
// patients, cost per paying patient and ROAS), how the data is collected (the scheduled runs), and
// the next 12 months (the evergreen plus the additional campaigns, switched on and off on dates).
// Built from the latest Ads Pathway snapshot, which carries the plan (ads-plan.json) as data.plan.
// Rulebook: ads/STRATEGY.md in the website repo.
import HEAD from "./ads-board-head.html";

interface Lead { name: string; ad: string; status: string; treated?: boolean | null; attended?: boolean | string; firstValue?: number; value90?: number; valueToDate?: number; visits?: number; returned?: boolean; formIso?: string; bookedIso?: string; apptIso?: string; match?: string; formSent?: string; visit?: string; statusText?: string }
interface Month { month: string; theme: string; keyDates: { date: string; moment: string; use: string }[]; treatmentsToPush: { treatment: string; why: string }[]; offer: { text: string; needsApproval?: boolean | string; ownerApproval?: string } | string; campaigns: { name: string; start: string; end: string; objective: string; audience: string; dailyBudget: number; creativeBrief: unknown; landing: string; measure: string }[]; organic: unknown; budgetPerDay: unknown; prepNeeded: { what: string; by: string }[]; risks: unknown }
interface Day { date: string; spend: number; leadFormSpend?: number; impressions: number; linkClicks: number; metaLeads?: number }
interface AdRow { creative: string; adset: string; status: string; spend: number; impressions: number; clicks: number; leads: number; frequency: number }
interface AdSet { name: string; spend: number; reach: number; frequency: number; leads: number }
interface Campaign { id: string; name: string; kind: string; start: string; end: string | null; perDay: number; what: string; status: string; meta?: string[]; creative?: { from: string; theme: string }[] }
interface MetaCamp { id: string; name: string; status: string; start: string; stop: string | null; perDay: number }
interface Plan {
  goal: string; targets: { costPerLead: number[]; costPerBooked: number; costPerPaying: number; roasFirstVisit: number; roasYearOne: number };
  caps: { from: string; perDay: number; why: string }[]; months: string[]; campaigns: Campaign[]; switching: string;
  schedule: { when: string; task: string; what: string }[];
  assumptions: { firstVisitValue: number; yearOneValue: number; kept: number; newPatientsPerWeekAlone: number; newPatientsPerWeekTwo: number; note: string };
}
interface Snapshot {
  updated: string; updatedIso?: string; windowFrom: string;
  spend: { total: number; leadForms: number; bookingAd: number };
  leadForms: { clicks: number }; bookingAd: { clicks: number; toLandingPage: number; traced: number };
  followUp: { sent: number; replies: number }; totals: { impressions: number; linkClicks: number };
  adsets: AdSet[]; ads: AdRow[]; leads: Lead[]; summary: string; other?: string[];
  capacity?: { asOf: string; fill21: number; method?: string };
  outcomes?: { attended: number; treated: number; pending: number };
  budgetAdvice?: { current: number; proposed: number; action: string; why: string };
  plan?: Plan;
  daily?: Day[];
  metaCampaigns?: { asOf: string; campaigns: MetaCamp[] };
  monthly?: { built: string; principles: string[]; months: Month[] };
  checks?: { asOf: string; metaLeadsVsGhl?: string; bookingsTriple?: string; openLeads?: string; uncertain?: string[] };
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const gbp0 = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

function kpi(label: string, value: string, note: string, tone = "") {
  return `<div class="kpi ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><em>${esc(note)}</em></div>`;
}

export function renderAdsBoard(p: Snapshot | null, section?: string): string {
  if (!p || !p.plan) {
    return page(`<div class="board"><h1>Winchester Ads Board</h1><p>No snapshot with a plan yet. The next pathway check pushes one.</p></div>`);
  }
  const plan = p.plan;
  const A = plan.assumptions;
  const T = plan.targets;
  const leads = p.leads.length;
  const bookedLeads = p.leads.filter((l) => l.status === "booked");
  const booked = bookedLeads.length;
  const paying = p.leads.filter((l) => l.treated === true);
  const revenue = paying.reduce((s, l) => s + (l.valueToDate ?? l.value90 ?? l.firstValue ?? 0), 0);
  const firstRevenue = paying.reduce((s, l) => s + (l.firstValue ?? 0), 0);
  const cameBack = paying.filter((l) => l.returned === true).length;
  const cpl = leads ? p.spend.total / leads : 0;
  const cpb = booked ? p.spend.total / booked : 0;
  const cpp = paying.length ? p.spend.total / paying.length : null;
  const roas = paying.length ? revenue / p.spend.total : null;
  const leadToBooked = leads ? booked / leads : 0.5;
  // Booked to paying: only this campaign's own leads (owner, 15 Nov 2026: no historic figures).
  // Measured once 5 booked leads have passed 60 days from their consultation (or paid sooner; owner, 18 Nov 2026: treatment or skincare within 60 days).
  const closed = p.leads.filter((l) => l.treated === true || l.treated === false).length;
  const b2p = closed >= 5 ? p.leads.filter((l) => l.treated === true).length / closed : null;
  const appts = p.leads.map((l) => l.apptIso).filter(Boolean).sort() as string[];
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const firstAppt = appts[0] ? fmtDay(appts[0]) : "December";
  const firstClose = appts[0] ? fmtDay(new Date(Date.parse(appts[0]) + 60 * 86400000).toISOString()) : "February";
  const notYet = `not measured yet: first consultation ${firstAppt}, first 30 day result about ${firstClose}`;
  // How fresh the figures are
  const ageH = p.updatedIso ? (Date.now() - Date.parse(p.updatedIso)) / 3600000 : null;
  const fresh = ageH == null ? "" : `<span class="pill ${ageH < 8 ? "good" : ageH < 26 ? "warn" : "bad"}">Figures ${ageH < 1 ? "under an hour" : Math.round(ageH) + (Math.round(ageH) === 1 ? " hour" : " hours")} old</span>`;

  // Verdict
  const tone = cpp != null ? (cpp <= T.costPerPaying ? "good" : cpp <= 90 ? "warn" : "bad") : (cpb <= T.costPerBooked ? "good" : "warn");
  const verdict = cpp != null
    ? `${tone === "good" ? "On target" : "Above target"}: ${gbp(cpp)} per paying patient, ROAS ${roas!.toFixed(1)}x`
    : `On track: ${gbp(cpb)} per booked consultation; paying patients counted from the first consultation, ${firstAppt}`;

  // KPIs
  const kpis = [
    kpi("Spent", gbp0(p.spend.total), `since ${p.windowFrom}`),
    kpi("Leads", String(leads), "Meta lead forms into GHL"),
    kpi("Cost per lead", gbp(cpl), `target £${T.costPerLead[0]} to £${T.costPerLead[1]}`, cpl <= T.costPerLead[1] ? "good" : "warn"),
    kpi("Booked consultations", String(booked), `${pct(leadToBooked)} of leads`),
    kpi("Cost per booked", booked ? gbp(cpb) : "n/a", `target under £${T.costPerBooked}`, cpb && cpb <= T.costPerBooked ? "good" : "warn"),
    kpi("Paying patients", paying.length ? String(paying.length) : "not yet", "paid for a treatment"),
    kpi("Cost per paying patient", cpp != null ? gbp(cpp) : "not yet", `target under £${T.costPerPaying}`, cpp == null ? "" : cpp <= T.costPerPaying ? "good" : "bad"),
    kpi("ROAS, first visit", paying.length ? `${(firstRevenue / p.spend.total).toFixed(1)}x` : "not yet", paying.length ? `${gbp0(firstRevenue)} from first treatments; industry about 1.5x to 2x` : "industry about 1.5x to 2x (agency figures)"),
    kpi("ROAS to date", roas != null ? `${roas.toFixed(1)}x` : "not yet", roas != null ? `${gbp0(revenue)} so far; industry year one about 4x to 5x` : "industry year one about 4x to 5x (estimate)"),
    kpi("Came back", paying.length ? `${cameBack} of ${paying.length}` : "not yet", "second paid visit; tracked 12 months"),
  ].join("");

  // Funnel
  const o = p.outcomes;
  const frow = (label: string, n: number | null, rate: string) => {
    const w = n == null ? 100 : leads ? Math.max(2, (100 * n) / leads) : 0;
    return `<div class="frow"><span>${esc(label)}</span><div><div class="fbar${n == null ? " pend" : ""}" style="width:${w.toFixed(1)}%"></div></div><b>${n == null ? "soon" : n}</b>${rate ? `<span class="rate">${esc(rate)}</span>` : ""}</div>`;
  };
  const funnel = [
    frow("Leads", leads, ""),
    frow("Booked consultation", booked, `${pct(leadToBooked)} of leads, mostly within three minutes of the form`),
    frow("Attended", o ? o.attended : null, o ? `${booked ? pct(o.attended / booked) : ""} of booked` : `read from ANS the morning after each consultation; first one ${firstAppt}`),
    frow("Paying patient", o ? o.treated : null, o ? `${o.pending} still inside their 60 days` : notYet),
  ].join("");

  // Diary and budget
  const fill = p.capacity?.fill21;
  const marker = fill == null ? "" : `<span class="marker" style="left:calc(${Math.min(100, Math.max(0, fill * 100)).toFixed(1)}% - 1px)"></span>`;
  const adv = p.budgetAdvice;
  const diary = `<div class="band" role="img" aria-label="Diary fill next 21 days: under 70% raise, 70 to 90% hold, over 90% lower"><div class="up"><b>Under 70%</b><br>raise 20%</div><div class="hold"><b>70 to 90%</b><br>hold</div><div class="down"><b>90%+</b><br>lower</div>${marker}</div>
    <p>${fill == null ? "First diary reading: Monday 12:30 (from the 2 December model days)." : `<b>${pct(fill)}</b> of Winchester's clinical hours booked in the next 21 days (${esc(p.capacity!.method ?? "ANS")}, ${esc(p.capacity!.asOf)}).`}</p>
    <p>${adv ? `<span class="pill ${adv.action === "hold" ? "" : "warn"}">This week: ${esc(adv.action)}</span> £${esc(adv.current)} to £${esc(adv.proposed)} a day. ${esc(adv.why)}` : `Budget now <b>£25 a day</b>: £15 cold, £7 warm, £3 landing page test. Cap £40 while Abi works alone.`}</p>
    <p style="color:var(--muted);font-size:12px">Steps of 20% at most, once a week, applied when you approve them. No raise while cost per paying patient is over £90.</p>`;

  // Every ad, grouped by creative
  const groups = new Map<string, { creative: string; status: string; spend: number; impressions: number; clicks: number; leads: number; frequency: number; sets: number }>();
  for (const a of p.ads) {
    const g = groups.get(a.creative) ?? { creative: a.creative, status: a.status, spend: 0, impressions: 0, clicks: 0, leads: 0, frequency: 0, sets: 0 };
    g.spend += a.spend; g.impressions += a.impressions; g.clicks += a.clicks; g.leads += a.leads; g.frequency = Math.max(g.frequency, a.frequency); g.sets += 1;
    if (a.status === "Active") g.status = "Active";
    groups.set(a.creative, g);
  }
  const keyFor = (ad: string) => [...groups.keys()].find((c) => c.startsWith(ad)) ?? ad;
  const bookedBy: Record<string, number> = {}; const payingBy: Record<string, number> = {};
  for (const l of p.leads) {
    if (l.status === "booked") bookedBy[keyFor(l.ad)] = (bookedBy[keyFor(l.ad)] ?? 0) + 1;
    if (l.treated === true) payingBy[keyFor(l.ad)] = (payingBy[keyFor(l.ad)] ?? 0) + 1;
  }
  const rank = (g: { status: string; leads: number }) => (g.status !== "Active" ? 2 : g.leads ? 0 : 1);
  const adRows = [...groups.values()].sort((x, y) => rank(x) - rank(y) || (rank(x) === 0 ? x.spend / x.leads - y.spend / y.leads : y.spend - x.spend)).map((g) => {
    const b = bookedBy[g.creative] ?? 0; const pay = payingBy[g.creative] ?? 0;
    const verdictPill = g.status !== "Active" ? `<span class="pill">Paused</span>` : g.leads && g.spend / g.leads <= T.costPerLead[1] ? `<span class="pill good">Keep</span>` : !g.leads && g.spend >= 20 ? `<span class="pill bad">Pause</span>` : !g.leads ? `<span class="pill warn">Learning</span>` : `<span class="pill warn">Watch</span>`;
    return `<tr${g.status !== "Active" ? ' style="color:var(--muted)"' : ""}><td>${esc(g.creative)}${g.sets > 1 ? ` <span style="color:var(--muted)">(${g.sets} ad sets)</span>` : ""}</td><td>${gbp(g.spend)}</td><td>${g.impressions.toLocaleString("en-GB")}</td><td>${g.clicks}</td><td>${g.impressions ? ((100 * g.clicks) / g.impressions).toFixed(1) + "%" : ""}</td><td>${g.leads}</td><td>${g.leads ? gbp(g.spend / g.leads) : ""}</td><td>${b}</td><td>${b ? gbp(g.spend / b) : ""}</td><td>${pay || ""}</td><td>${g.frequency.toFixed(2)}</td><td>${verdictPill}</td></tr>`;
  }).join("");
  const setRows = p.adsets.map((s) => {
    const f = s.frequency; const pill = f < 2 ? `<span class="pill good">Fresh</span>` : f <= 3 ? `<span class="pill warn">Watch</span>` : `<span class="pill bad">Refresh</span>`;
    return `<tr><td>${esc(s.name)}</td><td>${gbp(s.spend)}</td><td>${s.reach.toLocaleString("en-GB")}</td><td>${s.leads}</td><td>${s.leads ? gbp(s.spend / s.leads) : ""}</td><td>${f.toFixed(2)}</td><td>${pill}</td></tr>`;
  }).join("");

  // 12 month calendar
  const now = thisMonth();
  const active = (c: Campaign, ym: string) => c.start.slice(0, 7) <= ym && (!c.end || c.end.slice(0, 7) >= ym);
  const capFor = (ym: string) => [...plan.caps].filter((c) => c.from <= ym).pop()?.perDay ?? 40;
  // One Jan to Dec calendar per year, the current year shown first, this month outlined.
  const years = [...new Set(plan.months.map((m) => m.slice(0, 4)))];
  const curYear = years.includes(now.slice(0, 4)) ? now.slice(0, 4) : years[0];
  const started = (m: string) => plan.campaigns.some((c) => c.kind === "evergreen" && c.start.slice(0, 7) <= m);
  const calendar = (y: string) => {
    const ms = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    const cls = (m: string) => (m === now ? "now" : "");
    const head = `<tr><th>Campaign</th>${ms.map((m) => `<th class="${cls(m)}">${MONTHS[Number(m.slice(5)) - 1]}</th>`).join("")}</tr>`;
    const rows = plan.campaigns.filter((c) => ms.some((m) => active(c, m))).map((c) => {
      const cells = ms.map((m) => active(c, m) ? `<td class="on k-${c.kind} ${cls(m)}" title="${esc(c.name)}">${c.perDay > 0 ? "£" + c.perDay : c.perDay < 0 ? "−£" + -c.perDay : ""}</td>` : `<td class="${cls(m)}"></td>`).join("");
      return `<tr><td><b>${esc(c.name)}</b><br><span style="color:var(--muted);font-size:11.5px">${esc(c.what)}</span></td>${cells}</tr>`;
    }).join("");
    const perDay = (m: string) => plan.campaigns.filter((c) => active(c, m) && c.status !== "conditional").reduce((s, c) => s + c.perDay, 0);
    const totals = ms.map((m) => started(m) ? `<td class="${perDay(m) > capFor(m) ? "over" : ""} ${cls(m)}">£${perDay(m)}</td>` : `<td class="${cls(m)}"></td>`).join("");
    const caps = ms.map((m) => `<td class="${cls(m)}">${started(m) ? "£" + capFor(m) : ""}</td>`).join("");
    const monthly = ms.map((m) => `<td class="${cls(m)}">${started(m) ? gbp0(perDay(m) * 30.4) : ""}</td>`).join("");
    return `<div class="table-wrap" data-cal="${y}"${y === curYear ? "" : " hidden"}><table class="gantt"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="13">Nothing planned.</td></tr>`}
      <tr class="total"><td>Planned per day (excluding conditional)</td>${totals}</tr>
      <tr><td style="color:var(--muted)">Cap per day</td>${caps}</tr>
      <tr><td style="color:var(--muted)">About per month</td>${monthly}</tr></tbody></table></div>`;
  };
  void calendar; void curYear;
  const timeline = renderTimeline(plan, p.metaCampaigns);
  const themes = (plan.campaigns.find((c) => c.id === "evergreen")?.creative ?? []).map((t) => `<li><span>${esc(t.theme)}</span><b>${esc(new Date(t.from + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }))}</b></li>`).join("");

  // Every lead, newest first
  const leadRows = [...p.leads].sort((a, b) => (b.formIso ?? "").localeCompare(a.formIso ?? "")).map((l) => {
    const pill = l.status === "booked" ? "good" : l.status === "open" ? "warn" : "";
    const appt = l.apptIso ? new Date(l.apptIso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : "";
    const outcome = l.treated === true ? `Paying${l.valueToDate ? ", " + gbp0(l.valueToDate) + " so far" : ""}` : l.attended === true ? "Attended" : l.attended === false ? "No-show" : l.attended === "cancelled" ? "Cancelled" : l.apptIso ? "Not yet due" : "";
    return `<tr><td>${esc(l.name)}</td><td style="text-align:left">${esc(l.ad)}</td><td>${esc(l.formSent ?? "")}</td><td style="text-align:left;white-space:normal;min-width:160px">${esc(l.visit ?? "")}</td><td style="text-align:left"><span class="pill ${pill}">${esc(l.statusText ?? l.status)}</span>${l.match ? `<span class="why">matched on ${esc(l.match)}</span>` : ""}</td><td style="text-align:left">${esc(appt)}</td><td style="text-align:left">${esc(outcome)}</td></tr>`;
  }).join("");

  // Month by month: what to advertise when (ads/meta/monthly-plan.json)
  const txt = (v: unknown): string => v == null ? "" : typeof v === "string" ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(" ") : typeof v === "object" ? Object.values(v as Record<string, unknown>).map(txt).filter(Boolean).join(" ") : String(v);
  const fmtD = (iso: string) => /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : iso;
  const mm = p.monthly?.months ?? [];
  const curM = mm.find((m) => m.month === now) ?? mm[0];
  const monthTabs = mm.map((m) => `<button type="button" data-m="${esc(m.month)}" aria-pressed="${m === curM}">${esc(MONTHS[Number(m.month.slice(5)) - 1] + " " + m.month.slice(2, 4))}</button>`).join("");
  // Each month in short blocks: the decision first, then the ads with their dates, key dates,
  // what to push and what to prepare. Every reason and brief is one tap away, not on the page
  // (owner, 18 Nov 2026: "the rest is a wall of text, make it easier to digest").
  const firstSentence = (s: string) => { const i = s.search(/\.\s/); return i > 0 && i < s.length - 2 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ""]; };
  const fold = (label: string, body: string) => body.trim() ? `<details class="fold"><summary>${esc(label)}</summary><div>${body}</div></details>` : "";
  const monthPanels = mm.map((m) => {
    const offer = typeof m.offer === "string" ? m.offer : m.offer?.text ?? "";
    const o = typeof m.offer === "object" ? (m.offer as { needsApproval?: boolean | string; ownerApproval?: string }) : {};
    const ask = typeof o.ownerApproval === "string" ? o.ownerApproval : typeof o.needsApproval === "string" ? o.needsApproval : o.needsApproval ? "The offer needs your approval." : "";
    const [offerHead, offerRest] = firstSentence(offer);
    const ads = m.campaigns.map((c) => `<li><span><strong>${esc(c.name)}</strong><span class="why">${esc(fmtD(c.start))}${c.end ? ` to ${esc(fmtD(c.end))}` : ", always on"}</span>${fold("Who sees it, the creative and how it is judged", `<p><b>Who sees it:</b> ${esc(c.audience)}</p><p>${esc(txt(c.creativeBrief))}</p><p><b>Lands on:</b> ${esc(c.landing)}</p><p><b>Judged on:</b> ${esc(c.measure)}</p>`)}</span><b>£${esc(c.dailyBudget)} a day</b></li>`).join("");
    const dates = m.keyDates.map((k) => `<li><b class="d">${esc(fmtD(k.date))}</b><span>${k.use && k.use !== "None." ? `<details class="fold inline"><summary>${esc(k.moment)}</summary><div>${esc(k.use)}</div></details>` : esc(k.moment)}</span></li>`).join("");
    const push = m.treatmentsToPush.map((t) => `<span class="chip" title="${esc(t.why)}">${esc(t.treatment)}</span>`).join("");
    const pushWhy = m.treatmentsToPush.map((t) => `<p><b>${esc(t.treatment)}:</b> ${esc(t.why)}</p>`).join("");
    const prep = [...m.prepNeeded].sort((a, b) => String(a.by).localeCompare(String(b.by))).map((x) => `<li><b class="d">${esc(fmtD(x.by))}</b><span>${esc(x.what)}</span></li>`).join("");
    return `<div data-mp="${esc(m.month)}"${m === curM ? "" : " hidden"} class="mp">
      <h3>${esc(m.theme)}</h3>
      ${ask ? `<div class="ask"><span class="pill warn">Needs your decision</span><p>${esc(ask)}</p></div>` : ""}
      <div class="mp-grid">
        <div><span class="q">Ads running</span><ul class="steps">${ads || "<li><span>Evergreen only</span></li>"}</ul></div>
        <div><span class="q">Key dates</span><ul class="dl">${dates || "<li><span>None</span></li>"}</ul></div>
      </div>
      <div class="mp-grid">
        <div><span class="q">What to push</span><div class="chips">${push}</div>${fold("Why these", pushWhy)}
          <span class="q" style="display:block;margin-top:12px">Offer</span><p>${esc(offerHead)}</p>${fold("The full offer", `<p>${esc(offerRest)}</p>`)}</div>
        <div><span class="q">To prepare</span><ul class="dl">${prep || "<li><span>Nothing extra</span></li>"}</ul></div>
      </div>
      ${fold("Instagram, email, budget and risks", `<p><b>Instagram and email:</b> ${esc(txt(m.organic))}</p><p><b>Budget:</b> ${esc(txt(m.budgetPerDay))}</p><p><b>Watch out for:</b> ${esc(txt(m.risks))}</p>`)}
    </div>`;
  }).join("");
  const monthlyCard = mm.length ? `<div class="card"><span class="q">Month by month</span><h2>What we advertise, when, and what it needs</h2>
      <div class="seg" id="m-tabs" style="flex-wrap:wrap">${monthTabs}</div>${monthPanels}
      <p class="muted-s">Built ${esc(p.monthly!.built)}. ${esc((p.monthly!.principles ?? []).slice(0, 3).join(" "))}</p></div>` : "";

  // Schedule
  const sched = plan.schedule.map((s) => `<li><b>${esc(s.when)}</b><span>${esc(s.what)}</span></li>`).join("");

  // Simulator data
  const simData = JSON.stringify({ cpl: Math.round(cpl * 100) / 100, l2b: Math.round(leadToBooked * 100) / 100, b2p: b2p == null ? null : Math.round(b2p * 100) / 100, first: A.firstVisitValue, year: A.yearOneValue, kept: A.kept, capAlone: A.newPatientsPerWeekAlone, capTwo: A.newPatientsPerWeekTwo, target: T.costPerPaying }).replace(/</g, "\\u003c");

  // The board's sections, each also served on its own Growth page (owner, 15 Nov 2026: the Ads
  // Board is a command board now; the detail lives one tap away). Every figure and check is kept.
  const H = `  <div class="head">
    <div style="display:grid;gap:6px">
      <span class="eyebrow">Abi Peters Skin Clinic &middot; Ads Board &middot; figures ${esc(p.updated)}</span>
      <h1>Winchester Ads Board</h1>
      <p>${esc(plan.goal)}</p>
    </div>
    <div class="tag" style="display:grid;gap:6px;justify-items:end"><span class="verdict"><i class="dot ${tone === "good" ? "" : tone}"></i>${esc(verdict)}</span>${fresh}</div>
  </div>
`;
  const S = {
    rail: `    <aside class="rail sim" aria-label="Scale simulator">
      <div class="ctl"><span class="lbl">If we scale: what does it buy?</span><span class="hint">Every slider opens on a measured figure. Move one to ask "what if"; Reset puts the measured figures back.</span><div class="presets"><button type="button" id="s-reset">Reset to measured</button></div></div>
      <div class="ctl"><span class="lbl">Daily budget</span><div class="slide"><input id="s-budget" type="range" min="20" max="60" step="1" value="${Math.round(p.budgetAdvice?.current ?? 25)}"><output id="o-budget"></output></div><span class="hint">Live: £${Math.round(p.budgetAdvice?.current ?? 25)} a day across the three campaigns.</span></div>
      <div class="ctl"><span class="lbl">Cost per lead</span><div class="slide"><input id="s-cpl" type="range" min="3" max="25" step="0.01" value="${cpl.toFixed(2)}"><output id="o-cpl"></output></div><span class="hint">Measured: ${gbp(p.spend.total)} for ${leads} leads. Usually rises as spend rises.</span></div>
      <div class="ctl"><span class="lbl">Lead to booked</span><div class="slide"><input id="s-l2b" type="range" min="0.05" max="0.95" step="0.01" value="${leadToBooked.toFixed(2)}"><output id="o-l2b"></output></div><span class="hint">Measured: ${booked} of ${leads} leads booked.</span></div>
      ${b2p != null ? `<div class="ctl"><span class="lbl">Booked to paying</span><div class="slide"><input id="s-b2p" type="range" min="0.05" max="0.95" step="0.01" value="${b2p.toFixed(2)}"><output id="o-b2p"></output></div><span class="hint">Measured: ${closed} booked leads past their 60 days.</span></div>` : `<div class="ctl"><span class="lbl">Booked to paying</span><span class="hint">${esc(notYet.replace("not measured yet", "Not measured yet"))}. Until then the simulator stops at booked consultations; no historic figure is used.</span></div>`}
      <div class="ctl"><span class="lbl">Clinicians</span><div class="seg" id="s-team"><button type="button" aria-pressed="true" data-v="1">Abi alone</button><button type="button" aria-pressed="false" data-v="2">Two</button></div></div>
      <div class="ctl"><span class="lbl">Each month</span><div class="simout" id="simout"></div></div>
    </aside>
`,
    kpis: `      <span class="eyebrow">Since ${esc(p.windowFrom)}, all figures</span>
      <div class="kpis">${kpis}</div>
`,
    funnel: `        <div class="card"><span class="q">The funnel we judge on</span><h2>From a form to a paying patient</h2><div class="funnel">${funnel}</div>
          <p style="color:var(--muted);font-size:12px">Follow-up: ${p.followUp.sent} of ${leads} leads had the email and WhatsApp, ${p.followUp.replies} replies. ${esc(p.summary)}</p></div>
`,
    diary: `        <div class="card"><span class="q">Spend follows the diary</span><h2>Diary fill and this week's budget</h2>${diary}</div>
`,
    leads: `      <div class="card"><span class="q">Since ${esc(p.windowFrom)}</span><h2>Every lead, from form to diary</h2>
        <div class="table-wrap"><table><thead><tr><th>Lead</th><th style="text-align:left">Ad</th><th>Form sent</th><th style="text-align:left">Booking page</th><th style="text-align:left">Diary</th><th style="text-align:left">Consultation</th><th style="text-align:left">Outcome</th></tr></thead><tbody>${leadRows}</tbody></table></div>
        ${(p.other ?? []).length ? `<p class="muted-s"><b>Booked outside the lead forms (not counted):</b> ${esc((p.other ?? []).join(" "))}</p>` : ""}
        <p class="muted-s">Names are first name and initial only. "Matched on" shows how each booking was tied to its lead: phone, email or exact full name.</p>
      </div>
`,
    ads: `      <div class="card"><span class="q">Since ${esc(p.windowFrom)}</span><h2>Every ad, best first</h2>
        <div class="table-wrap"><table><thead><tr><th>Ad</th><th>Spend</th><th>Views</th><th>Clicks</th><th>Click rate</th><th>Leads</th><th>Per lead</th><th>Booked</th><th>Per booked</th><th>Paying</th><th>Freq</th><th>Verdict</th></tr></thead><tbody>${adRows}</tbody></table></div>
        <div class="table-wrap"><table><thead><tr><th>Audience</th><th>Spend</th><th>Reach</th><th>Leads</th><th>Per lead</th><th>Frequency</th><th>Fatigue</th></tr></thead><tbody>${setRows}</tbody></table></div>
        <p style="color:var(--muted);font-size:12px">An ad is judged after 7 days or £20. Keep: leads at or under £${T.costPerLead[1]}. Pause: £20 spent and no lead. Every lead, traced from ad to diary, is on <a href="/patients/pathway" target="_top">Pathway</a>.</p>
      </div>
`,
    calendar: `      <div class="card"><span class="q">The next 12 months</span><h2>Every campaign, on its real dates</h2>
        ${timeline}
        <div class="legend"><span><i class="k-evergreen"></i>Evergreen</span><span><i class="k-seasonal"></i>Seasonal</span><span><i class="k-launch"></i>Launch</span><span><i class="k-test"></i>Test</span><span><i class="k-conditional"></i>Only when conditions hold</span><span><i class="k-reduce"></i>Eased</span></div>
        <p style="color:var(--muted);font-size:12px">${esc(plan.switching)} The evergreen's figure is its starting budget; each Monday's diary reading moves it within the cap.</p>
      </div>
`,
    monthly: monthlyCard,
    creative: `        <div class="card"><span class="q">Evergreen creative</span><h2>What the always-on ads say, and when it changes</h2><ul class="steps">${themes}</ul></div>
`,
    sched: `        <div class="card"><span class="q">How the data is collected</span><h2>The scheduled runs that feed this board</h2><ul class="sched">${sched}</ul>
          <div class="life"><div><b>Minute 0</b>Form sent, lead in GHL</div><div><b>3 minutes</b>Most book from the thank-you button</div><div><b>Consultation day</b>Attended or not, from ANS</div><div><b>Within 60 days</b>First paid treatment or skincare: a paying patient</div><div><b>90 days</b>Takings so far: ROAS</div></div>
        </div>
`,
    note: `      <p style="color:var(--muted);font-size:11.5px">${esc(A.note)} Rulebook: ads/STRATEGY.md. Plan: ads/meta/pathway/ads-plan.json.</p>
`,
  };
  const SCRIPT = `<script>
(function(){
  var D=${simData}, team=1;
  function $(id){return document.getElementById(id);}
  function money(n){return "£"+Math.round(n).toLocaleString("en-GB");}
  function run(){
    var hasPay=!!$("s-b2p");
    var b=+$("s-budget").value, cpl=+$("s-cpl").value, l2b=+$("s-l2b").value, b2p=hasPay?+$("s-b2p").value:0;
    $("o-budget").textContent="£"+b; $("o-cpl").textContent="£"+cpl.toFixed(2); $("o-l2b").textContent=Math.round(l2b*100)+"%"; if(hasPay)$("o-b2p").textContent=Math.round(b2p*100)+"%";
    var spend=b*30.4, leads=spend/cpl, booked=leads*l2b, cpb=booked?spend/booked:0;
    var html="<div><span>Spend</span><b>"+money(spend)+"</b></div>"+
      "<div><span>Leads</span><b>"+Math.round(leads)+"</b></div>"+
      "<div><span>Booked consultations</span><b>"+Math.round(booked)+"</b></div>"+
      "<div><span>Cost per booked consultation</span><b class=\\""+(cpb<=30?"good":"warn")+"\\">"+money(cpb)+"</b></div>";
    if(hasPay){
      var paying=booked*b2p, cpp=paying?spend/paying:0, cap=(team===1?D.capAlone:D.capTwo)*4.33, over=paying>cap;
      var cls=cpp<=D.target?"good":cpp<=90?"warn":"bad";
      html+="<div><span>Paying patients</span><b class=\\""+(over?"bad":"")+"\\">"+Math.round(paying)+"</b></div>"+
        "<div><span>Cost per paying patient</span><b class=\\""+cls+"\\">"+money(cpp)+"</b></div>"+
        "<div><span>ROAS, first visit</span><b>"+(spend?paying*D.first/spend:0).toFixed(1)+"x</b></div>"+
        "<div><span>ROAS, first year</span><b>"+(spend?paying*D.year/spend:0).toFixed(1)+"x</b></div>"+
        "<div><span>Kept in year one, after ads</span><b>"+money(paying*D.year*D.kept-spend)+"</b></div>"+
        "<div><span>New patient room a month</span><b class=\\""+(over?"bad":"good")+"\\">"+Math.round(cap)+(over?", over":"")+"</b></div>";
    } else {
      html+="<div><span>Paying patients, cost each, ROAS</span><b>not measured yet</b></div>";
    }
    $("simout").innerHTML=html;
  }
  var SL=["s-budget","s-cpl","s-l2b","s-b2p"].filter(function(id){return $(id);});
  SL.forEach(function(id){var el=$(id); el.dataset.m=el.value; el.addEventListener("input",run);});
  var mt=$("m-tabs"); if(mt) mt.addEventListener("click",function(e){var b=e.target.closest("button"); if(!b)return; [].forEach.call(mt.querySelectorAll("button"),function(x){x.setAttribute("aria-pressed",String(x===b));}); [].forEach.call(document.querySelectorAll("[data-mp]"),function(d){d.hidden=d.dataset.mp!==b.dataset.m;});});
  if($("s-reset")) $("s-reset").addEventListener("click",function(){SL.forEach(function(id){$(id).value=$(id).dataset.m;}); run();});
  [].forEach.call(document.querySelectorAll("[data-year]"),function(b){b.addEventListener("click",function(){var y=b.dataset.year; [].forEach.call(document.querySelectorAll("[data-year]"),function(x){x.setAttribute("aria-pressed",String(x===b));}); [].forEach.call(document.querySelectorAll("[data-cal]"),function(t){t.hidden=t.dataset.cal!==y;});});});
  if($("s-team")) $("s-team").addEventListener("click",function(e){var t=e.target.closest("button"); if(!t)return; team=+t.dataset.v; [].forEach.call(this.querySelectorAll("button"),function(x){x.setAttribute("aria-pressed",String(x===t));}); run();});
  if($("s-budget")) run();
})();
</script>`;
  const two = (a: string, b: string) => `<div class="row">${a}${b}</div>`;
  const SECTIONS: Record<string, string> = {
    ads: `${S.kpis}${S.funnel}${S.ads}`,
    leads: S.leads,
    plan: `${S.calendar}${S.monthly}${two(S.creative, S.diary)}`,
    simulator: `<div class="grid">${S.rail}<div class="main">${S.funnel}${S.diary}</div></div>`,
    last14: renderNow(p, T),
    how: `${S.sched}${S.note}`,
  };
  const body = section && SECTIONS[section] !== undefined
    ? `<div class="board">${H}${SECTIONS[section]}</div>${SCRIPT}`
    : `<div class="board">${H}<div class="grid">${S.rail}<div class="main">${renderNow(p, T)}${S.kpis}${two(S.funnel, S.diary)}${S.leads}${S.ads}${S.calendar}${S.monthly}<div class="row2">${S.creative}${S.sched}</div>${S.note}</div></div></div>${SCRIPT}`;
  return page(body);
}

// ---------- The next 12 months, on real dates ----------
// Owner, 18 Nov 2026: "displayable by date of month and not just month because i have no idea when
// my ads start and stop". A rolling 12 months from the first of this month: one bar per campaign at
// its exact days, today marked, then every start, stop and creative change as a dated list with the
// total daily spend from that day.
function renderTimeline(plan: Plan, meta?: { asOf: string; campaigns: MetaCamp[] }): string {
  const DAY = 86400000;
  const t = (ymd: string) => Date.parse(ymd.slice(0, 10) + "T12:00:00Z");
  const today = ukDate(new Date().toISOString());
  const w0ymd = today.slice(0, 7) + "-01";
  const w1d = new Date(t(w0ymd)); w1d.setUTCMonth(w1d.getUTCMonth() + 12);
  const w1ymd = w1d.toISOString().slice(0, 10);
  const w0 = t(w0ymd), w1 = t(w1ymd), span = w1 - w0;
  const pos = (ymd: string) => Math.min(100, Math.max(0, ((t(ymd) - w0) / span) * 100));
  const nice = (ymd: string, wd = false) => new Date(t(ymd)).toLocaleDateString("en-GB", { ...(wd ? { weekday: "short" as const } : {}), day: "numeric", month: "short", timeZone: "UTC" });
  const short = (s: string) => s.split(/[:;(]/)[0].trim();
  const live = (c: Campaign, ymd: string) => c.start.slice(0, 10) <= ymd && (!c.end || c.end.slice(0, 10) >= ymd);
  const capOn = (ymd: string) => [...plan.caps].filter((c) => c.from <= ymd.slice(0, 7)).pop()?.perDay ?? 40;
  const totalOn = (ymd: string) => plan.campaigns.filter((c) => live(c, ymd) && c.status !== "conditional").reduce((s, c) => s + c.perDay, 0);
  const inWin = plan.campaigns.filter((c) => c.start.slice(0, 10) < w1ymd && (!c.end || c.end.slice(0, 10) >= w0ymd)).sort((a, b) => (a.kind === "evergreen" ? -1 : b.kind === "evergreen" ? 1 : a.start.localeCompare(b.start)));
  // Running, ready or scheduled, or forecast: read from Meta, never typed in (owner, 18 Nov 2026).
  type St = "running" | "ready" | "forecast" | "done";
  const mc = meta?.campaigns ?? [];
  const linked = (c: Campaign) => (c.meta ?? []).map((id) => mc.find((x) => x.id === id)).filter(Boolean) as MetaCamp[];
  const stateOf = (c: Campaign): St => {
    if (c.end && c.end.slice(0, 10) < today) return "done";
    const L = linked(c);
    if (!L.length) return "forecast";
    return L.some((x) => /ACTIVE/.test(x.status) && x.start <= today && (!x.stop || x.stop >= today)) ? "running" : "ready";
  };
  const readyNote = (c: Campaign) => { const L = linked(c); const x = L[0]; return !x ? "" : /PENDING|REVIEW/.test(x.status) ? "built, in Meta review" : /ACTIVE/.test(x.status) && x.start > today ? `scheduled in Meta to start ${nice(x.start)}` : `built and paused, switched on ${nice(c.start)}`; };
  const money = (n: number) => (n < 0 ? `less £${-n}` : n ? `£${n} a day` : "inside the evergreen budget");

  // Month ruler
  const months: string[] = [];
  for (let d = new Date(w0); d.getTime() < w1; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 10));
  const ruler = months.map((m) => `<span style="left:${pos(m).toFixed(3)}%">${MONTHS[Number(m.slice(5, 7)) - 1]}${m.slice(5, 7) === "01" || m === w0ymd ? ` ${m.slice(2, 4)}` : ""}</span>`).join("");
  const grid = months.map((m) => `<i style="left:${pos(m).toFixed(3)}%"></i>`).join("");
  const todayMark = `<i class="tl-today" style="left:${pos(today).toFixed(3)}%"></i>`;

  const rows = inWin.map((c) => {
    const s = c.start.slice(0, 10) < w0ymd ? w0ymd : c.start.slice(0, 10);
    const eIncl = c.end ? new Date(t(c.end) + DAY).toISOString().slice(0, 10) : w1ymd;
    const L = pos(s), W = Math.max(0.6, pos(eIncl) - L);
    const dates = `${nice(c.start)}${c.end ? ` to ${nice(c.end)}` : ", always on"}`;
    const label = `${dates} &middot; ${esc(money(c.perDay))}`;
    let inner = "";
    if (c.kind === "evergreen" && c.creative?.length) {
      inner = c.creative.filter((x) => x.from < w1ymd).map((x, i, arr) => {
        const a = pos(x.from < s ? s : x.from), b = arr[i + 1] ? pos(arr[i + 1].from) : pos(eIncl);
        const segW = ((b - a) / W) * 100, segL = ((a - L) / W) * 100;
        return `<span class="tl-seg" style="left:${segL.toFixed(2)}%;width:${segW.toFixed(2)}%" title="${esc(nice(x.from))}: ${esc(x.theme)}">${segW > 5 ? esc(nice(x.from)) : ""}</span>`;
      }).join("");
    }
    const wide = W > 22;
    const outside = !wide ? `<em class="tl-out" style="${L + W > 70 ? `right:${(100 - L + 0.8).toFixed(2)}%` : `left:${(L + W + 0.8).toFixed(2)}%`}">${label}</em>` : "";
    return `<div class="tl-row"><div class="tl-name"><b>${esc(short(c.name))}</b>${c.status === "conditional" ? `<span class="why">only if conditions hold</span>` : ""}</div>
      <div class="tl-track">${grid}${todayMark}<div class="tl-bar k-${esc(c.kind)} st-${stateOf(c)}" style="left:${L.toFixed(3)}%;width:${W.toFixed(3)}%" title="${esc(c.name)}: ${esc(dates)}">${inner || (wide ? `<span class="tl-lab">${label}</span>` : "")}</div>${outside}</div></div>`;
  }).join("");

  // Every start, stop and creative change from today, with the daily total from that day.
  type Ev = { d: string; kind: "start" | "stop" | "change"; text: string; sub: string; total: number; cap: number; cond: boolean };
  const evs: Ev[] = [];
  for (const c of plan.campaigns) {
    const cond = c.status === "conditional";
    if (c.start.slice(0, 10) >= today && c.start.slice(0, 10) < w1ymd) evs.push({ d: c.start.slice(0, 10), kind: "start", text: c.name, sub: money(c.perDay), total: totalOn(c.start.slice(0, 10)), cap: capOn(c.start), cond });
    if (c.end && c.end.slice(0, 10) >= today && c.end.slice(0, 10) < w1ymd) {
      const after = new Date(t(c.end) + DAY).toISOString().slice(0, 10);
      evs.push({ d: c.end.slice(0, 10), kind: "stop", text: c.name, sub: "last day", total: totalOn(after), cap: capOn(after), cond });
    }
    if (c.kind === "evergreen") for (const x of c.creative ?? []) if (x.from > today && x.from < w1ymd) evs.push({ d: x.from, kind: "change", text: `Evergreen ads change: ${short(x.theme)}`, sub: x.theme, total: totalOn(x.from), cap: capOn(x.from), cond: false });
  }
  const order = { stop: 0, change: 1, start: 2 };
  evs.sort((a, b) => a.d.localeCompare(b.d) || order[a.kind] - order[b.kind]);
  let lastM = "";
  const evHtml = evs.map((e) => {
    const m = e.d.slice(0, 7);
    const headM = m !== lastM ? `<li class="ev-m">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</li>` : "";
    lastM = m;
    const ec = plan.campaigns.find((c) => c.name === e.text); const notBuilt = e.kind === "start" && ec && stateOf(ec) === "forecast";
    const tag = e.kind === "start" ? `<span class="pill good">Starts</span>` : e.kind === "stop" ? `<span class="pill">Stops</span>` : `<span class="pill warn">New ads</span>`;
    const tot = e.kind === "change" ? "" : `<span class="ev-tot${e.total > e.cap ? " over" : ""}">£${e.total} a day in total${e.total > e.cap ? `, over the £${e.cap} cap` : ""}</span>`;
    return `${headM}<li><b class="d">${esc(nice(e.d, true))}</b>${tag}<span class="ev-t"><strong>${esc(e.kind === "change" ? e.text : short(e.text))}</strong>${notBuilt ? ` <span class="pill bad">not built yet</span>` : ""}<span class="why">${esc(e.kind === "change" ? "" : e.sub)}${e.cond ? (e.kind === "change" ? "" : " &middot; ") + "only if conditions hold" : ""}</span></span>${tot}</li>`;
  }).join("");
  const now = plan.campaigns.filter((c) => live(c, today));
  const DAYMS = 86400000;
  const days = (ymd: string) => Math.round((t(ymd) - t(today)) / DAYMS);
  const running = plan.campaigns.filter((c) => stateOf(c) === "running");
  const ready = plan.campaigns.filter((c) => stateOf(c) === "ready").sort((a, b) => a.start.localeCompare(b.start));
  const fc = plan.campaigns.filter((c) => stateOf(c) === "forecast" && c.start.slice(0, 10) < w1ymd).sort((a, b) => a.start.localeCompare(b.start));
  const fcItem = (c: Campaign) => { const by = new Date(t(c.start) - 7 * DAYMS).toISOString().slice(0, 10); const late = c.status !== "conditional" && by <= today; return `<li><span><strong>${esc(short(c.name))}</strong><span class="why">starts ${esc(nice(c.start, true))} &middot; ${esc(money(c.perDay))}${c.status === "conditional" ? " &middot; only if conditions hold" : ""}</span></span>${late ? `<span class="pill bad">Build now: starts in ${days(c.start)} days</span>` : `<b>build by ${esc(nice(by))}</b>`}</li>`; };
  const statusHtml = `<div class="st3">
    <div><span class="q">Running now</span><ul class="steps">${running.map((c) => `<li><span><strong>${esc(short(c.name))}</strong><span class="why">${c.end ? `until ${esc(nice(c.end))}` : "always on"}</span></span><b>${esc(money(c.perDay))}</b></li>`).join("") || "<li><span>Nothing running</span></li>"}</ul></div>
    <div><span class="q">Ready or scheduled</span><ul class="steps">${ready.map((c) => `<li><span><strong>${esc(short(c.name))}</strong><span class="why">${esc(readyNote(c))}</span></span><b>${esc(nice(c.start))}</b></li>`).join("") || "<li><span class=\"why\">Nothing built ahead yet</span></li>"}</ul></div>
    <div><span class="q">Forecast, not built</span><ul class="steps">${fc.slice(0, 4).map(fcItem).join("") || "<li><span>Nothing planned</span></li>"}</ul>${fc.length > 4 ? `<details class="fold"><summary>${fc.length - 4} more planned</summary><div><ul class="steps">${fc.slice(4).map(fcItem).join("")}</ul></div></details>` : ""}</div>
  </div>
  <p class="muted-s">Read from Meta ${meta ? esc(new Date(meta.asOf).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })) : "(no reading yet)"}. Each campaign is built and checked a week before it starts.</p>`;
  void now;
  const nowHtml = now.map((c) => `<span class="chip">${esc(short(c.name))} <em>${c.end ? `to ${esc(nice(c.end))}` : "always on"}</em></span>`).join("");
  const detail = inWin.map((c) => `<p><b>${esc(c.name)}</b> (${esc(nice(c.start))}${c.end ? ` to ${esc(nice(c.end))}` : ", always on"}): ${esc(c.what)}</p>`).join("");

  return `<style>
.tl-wrap{overflow-x:auto;margin:6px 0 4px}
.tl{min-width:760px;display:grid;gap:5px}
.tl-row,.tl-head{display:grid;grid-template-columns:170px minmax(0,1fr);gap:10px;align-items:center}
.tl-name{font-size:12.5px;line-height:1.25}
.tl-track,.tl-ruler{position:relative;height:26px}
.tl-ruler{height:16px;font-size:11px;color:var(--muted)}
.tl-ruler span{position:absolute;top:0;padding-left:3px;white-space:nowrap}
.tl-track>i,.tl-ruler i{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}
.tl-track>i.tl-today{width:2px;background:var(--ink);z-index:2}
.tl-bar{position:absolute;top:3px;bottom:3px;border-radius:4px;overflow:hidden;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center}
.tl-lab{padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-seg{position:absolute;top:0;bottom:0;border-left:2px solid rgba(255,255,255,.55);padding:0 6px;display:flex;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-seg:first-child{border-left:0}
.tl-out{position:absolute;top:5px;font-style:normal;font-size:11px;color:var(--ink);white-space:nowrap}
.k-conditional .tl-lab{color:var(--ink)}
.tl-bar.st-forecast{opacity:.45}
.tl-bar.st-ready{box-shadow:inset 0 0 0 2px var(--ink)}
.st3{display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:800px){.st3{grid-template-columns:minmax(0,1fr)}}
.nowline{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 4px;font-size:12.5px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
.chip{font-size:12px;padding:3px 10px;border-radius:999px;background:var(--panel);border:1px solid var(--line)}
.chip em{font-style:normal;color:var(--muted)}
.evs{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:0;font-size:13px}
.evs li{display:grid;grid-template-columns:86px 64px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.evs li.ev-m{display:block;border-bottom:0;padding:14px 0 2px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--sage-deep);font-weight:700}
.evs .d,.dl .d{font-variant-numeric:tabular-nums;white-space:nowrap}
.ev-tot{font-size:12px;color:var(--muted);white-space:nowrap}
.ev-tot.over{color:var(--bad);font-weight:700}
.dl{list-style:none;padding:0;margin:0;display:grid;font-size:13px}
.dl li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;padding:6px 0;border-bottom:1px solid var(--line)}
.dl li:last-child{border-bottom:0}
.fold{margin-top:6px;font-size:12.5px}
.fold summary{cursor:pointer;color:var(--sage-deep);font-weight:600}
.fold>div{padding:6px 0 2px;color:var(--muted);display:grid;gap:6px}
.fold>div p{margin:0}
.fold.inline{margin:0}.fold.inline summary{color:var(--ink);font-weight:400}
.ask{display:grid;gap:6px;justify-items:start;padding:10px 12px;border-radius:8px;background:var(--watch-bg)}
.ask p{margin:0;font-size:13px}
@media (max-width:640px){.tl-row,.tl-head{grid-template-columns:112px minmax(0,1fr)}.tl-head>span:first-child{position:sticky;left:0;z-index:3;background:var(--sheet);align-self:stretch}.tl-name{position:sticky;left:0;z-index:3;background:var(--sheet);font-size:11.5px;align-self:stretch;display:flex;flex-direction:column;justify-content:center}.evs li{grid-template-columns:70px minmax(0,1fr);row-gap:2px}.evs li .pill{grid-column:2;justify-self:start}.evs li .ev-t,.evs li .ev-tot{grid-column:2}}
</style>
  ${statusHtml}
  <span class="q" style="display:block;margin-top:10px">On the calendar</span>
  <div class="tl-wrap"><div class="tl" role="img" aria-label="Campaign timeline from ${esc(nice(w0ymd))} for 12 months">
    <div class="tl-head"><span></span><div class="tl-ruler">${ruler}</div></div>
    ${rows}
  </div></div>
  <p class="muted-s">Solid bars are running, outlined bars are built and waiting, faded bars are forecast and not built yet. The black line is today. The dates on the evergreen bar are when its ads change. Scroll sideways on a phone; every date is also listed below.</p>
  <span class="q" style="display:block;margin-top:14px">Every start and stop, from today</span>
  <ul class="evs">${evHtml || "<li><span>Nothing changes in the next 12 months.</span></li>"}</ul>
  ${`<details class="fold"><summary>What each campaign is</summary><div>${detail}</div></details>`}`;
}

// ---------- Now: the last 14 days ----------
const ukDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const dayLabel = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });

interface DayRow { date: string; spend: number; leads: number; booked: number; impressions: number; clicks: number; running: boolean; partial: boolean }

function nowRows(p: Snapshot): DayRow[] {
  const daily = [...(p.daily ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const end = daily.length ? daily[daily.length - 1].date : ukDate(new Date().toISOString());
  const today = ukDate(p.updatedIso ?? new Date().toISOString());
  const rows: DayRow[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(end, -i);
    const m = daily.find((x) => x.date === d);
    rows.push({
      date: d, running: !!m, partial: d === today,
      spend: m?.spend ?? 0, impressions: m?.impressions ?? 0, clicks: m?.linkClicks ?? 0,
      leads: p.leads.filter((l) => l.formIso && ukDate(l.formIso) === d).length,
      booked: p.leads.filter((l) => l.bookedIso && ukDate(l.bookedIso) === d).length,
    });
  }
  return rows;
}

function pathwaySvg(st: { label: string; num: string; sub: string; pend?: boolean }[], rates: string[]) {
  const W = 140, gap = 74, x0 = 2;
  const boxes = st.map((s, i) => {
    const x = x0 + i * (W + gap);
    return `<g><rect x="${x}" y="40" width="${W}" height="104" rx="6" class="p-box${s.pend ? " pend" : ""}"${s.pend ? ' fill="url(#now-pend)"' : ""}/>
      <text x="${x + 12}" y="62" class="p-lbl">${esc(s.label)}</text>
      <text x="${x + 12}" y="100" class="p-num">${esc(s.num)}</text>
      <text x="${x + 12}" y="126" class="p-sub">${esc(s.sub)}</text></g>`;
  }).join("");
  const arrows = rates.map((r, i) => {
    const x = x0 + (i + 1) * W + i * gap;
    return `<path d="M${x + 6} 92 H${x + gap - 6} M${x + gap - 12} 86 L${x + gap - 6} 92 L${x + gap - 12} 98" class="p-arrow"/><text x="${x + gap / 2}" y="78" text-anchor="middle" class="p-rate">${esc(r)}</text>`;
  }).join("");
  const desc = st.map((s) => `${s.label}: ${s.num}, ${s.sub}`).join("; ");
  return `<svg viewBox="0 0 1000 160" role="img" aria-label="${esc(desc)}"><defs><pattern id="now-pend" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" class="p-pend-bg"/><line x1="0" y1="0" x2="0" y2="10" class="p-pend-line"/></pattern></defs>${boxes}${arrows}</svg>`;
}

function dailySvg(rows: DayRow[]) {
  const L = 110, W = 1000, colW = (W - L - 10) / rows.length, bandH = 70, top = 10;
  const bands: { key: "spend" | "leads" | "booked"; name: string; cls: string; fmt: (n: number) => string }[] = [
    { key: "spend", name: "Spend", cls: "bar-spend", fmt: (n) => "£" + n.toFixed(n < 10 ? 2 : 0) },
    { key: "leads", name: "Leads", cls: "bar-leads", fmt: (n) => String(n) },
    { key: "booked", name: "Booked", cls: "bar-booked", fmt: (n) => String(n) },
  ];
  let out = "";
  bands.forEach((b, bi) => {
    const y0 = top + bi * (bandH + 16);
    const max = Math.max(1, ...rows.map((r) => r[b.key]));
    out += `<text x="0" y="${y0 + 16}" class="tick" font-weight="700">${b.name}</text><text x="0" y="${y0 + 32}" class="tick">most ${esc(b.fmt(max))}</text>`;
    out += `<line x1="${L}" y1="${y0 + bandH}" x2="${W - 10}" y2="${y0 + bandH}" class="axis"/>`;
    rows.forEach((r, i) => {
      const v = r[b.key]; const h = (v / max) * (bandH - 16); const x = L + i * colW + 4; const w = colW - 8;
      const tip = `${dayLabel(r.date)}: ${b.fmt(v)}${r.partial ? " so far" : ""}${r.running ? "" : " (not running)"}`;
      if (v > 0) out += `<rect x="${x.toFixed(1)}" y="${(y0 + bandH - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="${b.cls}${r.partial ? " bar-part" : ""}"><title>${esc(tip)}</title></rect><text x="${(x + w / 2).toFixed(1)}" y="${(y0 + bandH - h - 3).toFixed(1)}" text-anchor="middle" class="val">${esc(b.fmt(v))}</text>`;
      else out += `<rect x="${x.toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="${bandH}" fill="transparent"><title>${esc(tip)}</title></rect>`;
    });
  });
  const yd = top + 3 * (bandH + 16) + 4;
  rows.forEach((r, i) => {
    const x = L + i * colW + colW / 2;
    out += `<text x="${x.toFixed(1)}" y="${yd}" text-anchor="middle" class="tick">${esc(dayLabel(r.date).split(" ")[0])}</text><text x="${x.toFixed(1)}" y="${yd + 14}" text-anchor="middle" class="tick">${esc(r.date.slice(8).replace(/^0/, ""))}${r.partial ? " so far" : r.running ? "" : " off"}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${yd + 22}" role="img" aria-label="Spend, leads and bookings for each of the last 14 days">${out}</svg>`;
}

function verdict(cur: number, prev: number, better: "lower" | "higher" | "neutral", enough: boolean, unit: (n: number) => string) {
  if (!enough) return { cls: "flat", text: `Too few to tell yet: ${unit(cur)} against ${unit(prev)}` };
  if (better === "neutral") return { cls: "flat", text: cur === prev ? "Same as last week" : `${cur > prev ? "Up" : "Down"} ${unit(Math.abs(cur - prev))}` };
  if (!prev) return { cls: "flat", text: "Nothing to compare with last week" };
  const ch = (cur - prev) / prev;
  if (Math.abs(ch) <= 0.15) return { cls: "flat", text: "Steady" };
  const good = better === "lower" ? ch < 0 : ch > 0;
  return { cls: good ? "good" : "bad", text: `${good ? "Better" : "Worse"}: ${unit(cur)} against ${unit(prev)}` };
}

export function renderNow(p: Snapshot, T: Plan["targets"]): string {
  const rows = nowRows(p);
  const sum = (rs: DayRow[], k: "spend" | "leads" | "booked" | "impressions" | "clicks") => rs.reduce((s, r) => s + r[k], 0);
  const spend = sum(rows, "spend"), leads = sum(rows, "leads"), booked = sum(rows, "booked"), imps = sum(rows, "impressions"), clicks = sum(rows, "clicks");
  const inWindow = (iso?: string) => !!iso && ukDate(iso) >= rows[0].date && ukDate(iso) <= rows[13].date;
  const wLeads = p.leads.filter((l) => inWindow(l.formIso));
  const attended = wLeads.filter((l) => l.attended === true).length;
  const paying = wLeads.filter((l) => l.treated === true).length;
  const future = wLeads.filter((l) => l.apptIso && Date.parse(l.apptIso) > Date.now()).length;
  const anyAttendData = wLeads.some((l) => l.attended !== undefined);
  const nextAppt = wLeads.map((l) => l.apptIso).filter(Boolean).sort()[0];
  const firstApptNow = nextAppt ? new Date(nextAppt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : "the first";
  const g = (n: number) => "£" + n.toFixed(2);

  const headline = `Last 14 days: ${g(spend)} spent, ${leads} leads, ${booked} booked consultations${booked ? `, ${g(spend / booked)} each against a target under £${T.costPerBooked}` : ""}.`;
  const stages = [
    { label: "Ads", num: g(spend), sub: `${imps.toLocaleString("en-GB")} views, ${clicks} clicks` },
    { label: "Leads", num: String(leads), sub: leads ? `${g(spend / leads)} each` : "none yet" },
    { label: "Booked", num: String(booked), sub: booked ? `${g(spend / booked)} each` : "none yet" },
    { label: "Attended", num: anyAttendData ? String(attended) : "soon", sub: anyAttendData ? `${booked ? Math.round((100 * attended) / booked) : 0}% of booked` : `first on ${firstApptNow}`, pend: !anyAttendData },
    { label: "Paying", num: paying ? String(paying) : "soon", sub: paying ? `${g(spend / paying)} each` : "60 days after each", pend: !paying },
  ];
  const rates = [
    imps ? `${((100 * clicks) / imps).toFixed(1)}% click` : "",
    clicks ? `${Math.round((100 * leads) / clicks)}% send form` : "",
    leads ? `${Math.round((100 * booked) / leads)}% book` : "",
    anyAttendData && booked ? `${Math.round((100 * attended) / booked)}% come` : "aim 85%",
  ];

  // Week on week: last 7 complete days against the 7 before.
  const complete = rows.filter((r) => !r.partial);
  const thisW = complete.slice(-7), lastW = complete.slice(-14, -7);
  const running = (rs: DayRow[]) => rs.filter((r) => r.running).length;
  let wow = "";
  if (running(thisW) < 7 || running(lastW) < 7) {
    const firstDay = rows.find((r) => r.running)?.date ?? rows[13].date;
    wow = `<p class="muted-s">First week on week comparison on ${esc(dayLabel(addDays(firstDay, 14)))} ${esc(new Date(addDays(firstDay, 14) + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }))}, once the ads have run two full weeks.</p>`;
  } else {
    const c = { s: sum(thisW, "spend"), l: sum(thisW, "leads"), b: sum(thisW, "booked"), i: sum(thisW, "impressions"), k: sum(thisW, "clicks") };
    const q = { s: sum(lastW, "spend"), l: sum(lastW, "leads"), b: sum(lastW, "booked"), i: sum(lastW, "impressions"), k: sum(lastW, "clicks") };
    const enoughL = c.l >= 8 && q.l >= 8, enoughB = c.b >= 5 && q.b >= 5;
    const line = (name: string, why: string, cur: string, prev: string, v: { cls: string; text: string }) =>
      `<tr><td class="v">${esc(name)}<span class="why">${esc(why)}</span></td><td>${esc(cur)}</td><td>${esc(prev)}</td><td class="chg ${v.cls}" style="text-align:left;white-space:normal">${esc(v.text)}</td></tr>`;
    wow = `<div class="table-wrap"><table class="wow"><thead><tr><th>Measure</th><th>This week</th><th>Last week</th><th style="text-align:left">Verdict</th></tr></thead><tbody>
      ${line("Spend", "What Meta charged us.", g(c.s), g(q.s), verdict(c.s, q.s, "neutral", true, g))}
      ${line("Leads", "People who sent the form with their name and number.", String(c.l), String(q.l), verdict(c.l, q.l, "higher", enoughL, String))}
      ${line("Cost per lead", `What one enquiry costs. Target £${T.costPerLead[0]} to £${T.costPerLead[1]}.`, c.l ? g(c.s / c.l) : "n/a", q.l ? g(q.s / q.l) : "n/a", verdict(c.l ? c.s / c.l : 0, q.l ? q.s / q.l : 0, "lower", enoughL, g))}
      ${line("Booked consultations", "Leads who booked a consultation in Abi's diary.", String(c.b), String(q.b), verdict(c.b, q.b, "higher", enoughB, String))}
      ${line("Cost per booked consultation", `Spend divided by bookings. Target under £${T.costPerBooked}.`, c.b ? g(c.s / c.b) : "n/a", q.b ? g(q.s / q.b) : "n/a", verdict(c.b ? c.s / c.b : 0, q.b ? q.s / q.b : 0, "lower", enoughB, g))}
      ${line("Click rate", "Of every 100 views, how many tapped the ad.", c.i ? ((100 * c.k) / c.i).toFixed(1) + "%" : "n/a", q.i ? ((100 * q.k) / q.i).toFixed(1) + "%" : "n/a", verdict(c.i ? c.k / c.i : 0, q.i ? q.k / q.i : 0, "higher", c.i > 1000 && q.i > 1000, (n) => (100 * n).toFixed(1) + "%"))}
    </tbody></table></div>`;
  }

  const ch = p.checks;
  const checks = ch ? `<div class="checks"><b>Accuracy checks</b> (${esc(new Date(ch.asOf).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }))}): ${[ch.metaLeadsVsGhl, ch.bookingsTriple, ch.openLeads].filter(Boolean).map((x) => `<span class="ok">${esc(x)}</span>`).join(" ")}${ch.uncertain && ch.uncertain.length ? ` <span class="pill warn">Needs checking: ${esc(ch.uncertain.join("; "))}</span>` : ""}</div>` : "";

  return `<div class="card nowcard"><span class="q">Now</span><h2>The last 14 days</h2><p>${esc(headline)}</p>
    <div class="svgwrap">${pathwaySvg(stages, rates)}</div>
    <p class="muted-s">${future ? `${future} of these booked consultations are still in the diary ahead; they show as attended or not the morning after.` : ""} The pathway follows the leads who sent the form in these 14 days.</p>
    <h3>Each day</h3><div class="svgwrap">${dailySvg(rows)}</div><p class="muted-s">Hover a bar for the day. Today is faded until the day ends. Days marked off are before the ads started.</p>
    <h3>This week against last week</h3>${wow}
    ${checks}</div>`;
}

function page(body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${HEAD}</head><body>${body}</body></html>`;
}
