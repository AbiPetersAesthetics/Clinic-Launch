// The summary contract for each board (UX plan 2.4 and 2.8): a verdict, three to five KPIs, the
// sources behind them with their age, and alerts. Built from the same inputs the board renderers
// receive, so Today, the area overviews and the board shell read the same figures as the boards.
import { freshness, dayMonth, type Chip } from "../lib/freshness";

export type Tone = "good" | "watch" | "act" | "stale";

export interface Kpi {
  label: string;
  value: string | null;
  compare?: string;
  /** Shown in the value slot when there is no measured figure yet. */
  notMeasured?: { reason: string; from?: string };
  source?: Chip;
  tone?: "good" | "watch" | "act";
}

export interface Alert {
  id: string;
  area: "ads" | "money" | "clinic" | "growth" | "patients";
  level: "act" | "watch";
  title: string;
  detail?: string;
  sources: Chip[];
  href?: string;
}

export interface Summary {
  key: string;
  area: "money" | "growth" | "clinic" | "patients";
  title: string;
  state: Tone;
  verdict: string;
  detail?: string;
  kpis: Kpi[];
  sources: Chip[];
  alerts: Alert[];
  keeper: string;
  extra?: Record<string, unknown>;
}

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gbp0 = (n: number) => `${n < 0 ? "minus " : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const londonToday = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const daysTo = (ymd: string, now = new Date()) => Math.ceil((Date.parse(ymd + "T00:00:00Z") - now.getTime()) / 86400000);
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const num = (n: number) => (n <= 10 ? words[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Ads ─────────────────────────────────────────────────────────────────────

const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const ukDay = (iso: string) => londonToday(new Date(iso));

export interface PathStep { label: string; value: string; sub: string; pending?: boolean }

export function adsSummary(p: any | null, now = new Date(), videos: any | null = null): Summary {
  const keeper = "Kept current by the pathway check (08:00, 12:00 and 16:00) and the Monday capacity review";
  if (!p) {
    return { key: "ads", area: "growth", title: "Ads", state: "stale", verdict: "No ads data yet: the next pathway check pushes the first snapshot.", kpis: [], sources: [], alerts: [], keeper };
  }
  const asOf = p.updatedIso ?? null;
  const sources = [freshness("meta", asOf, { now }), freshness("ghl", asOf, { now }), freshness("ans", asOf, { now })];
  const T = p.plan?.targets ?? { costPerLead: [5, 10], costPerBooked: 30, costPerPaying: 60 };
  const leads: any[] = p.leads ?? [];
  const n = leads.length;
  const booked = leads.filter((l) => l.status === "booked").length;
  const paying = leads.filter((l) => l.treated === true);
  const spend = Number(p.spend?.total ?? 0);
  const cpb = booked ? spend / booked : null;
  const cpp = paying.length ? spend / paying.length : null;
  const appts = leads.map((l) => l.apptIso).filter(Boolean).sort() as string[];
  const firstAppt = appts[0] ? dayMonth(appts[0]) : "the first consultation";
  const firstClose = appts[0] ? dayMonth(new Date(Date.parse(appts[0]) + 30 * 86400000).toISOString()) : "30 days after it";
  const since = p.windowFrom ? `since ${p.windowFrom}` : "";

  // This week against last week: the last 7 UK days, then the 7 before them.
  const today = londonToday(now);
  const w0 = addDays(today, -6), p0 = addDays(today, -13), p1 = addDays(today, -7);
  const daily: any[] = p.daily ?? [];
  const firstDay = daily.map((d) => d.date).sort()[0] ?? today;
  const inW = (d: string) => d >= w0 && d <= today, inP = (d: string) => d >= p0 && d <= p1;
  const sum = (f: (d: any) => boolean) => Math.round(daily.filter(f).reduce((s, d) => s + Number(d.spend ?? 0), 0) * 100) / 100;
  const spendW = sum((d) => inW(d.date)), spendP = sum((d) => inP(d.date));
  const leadsW = leads.filter((l) => l.formIso && inW(ukDay(l.formIso))).length, leadsP = leads.filter((l) => l.formIso && inP(ukDay(l.formIso))).length;
  const bookedW = leads.filter((l) => l.status === "booked" && l.bookedIso && inW(ukDay(l.bookedIso))).length, bookedP = leads.filter((l) => l.status === "booked" && l.bookedIso && inP(ukDay(l.bookedIso))).length;
  const cplW = leadsW ? spendW / leadsW : null, cplP = leadsP ? spendP / leadsP : null;
  const hadPrev = firstDay <= p1;
  const vs = (fmt: string) => (hadPrev ? `last week ${fmt}` : `first week: ads began ${dayMonth(firstDay)}`);

  let state: Tone;
  let verdict: string;
  if (cpp != null) {
    state = cpp <= T.costPerPaying ? "good" : cpp <= 90 ? "watch" : "act";
    verdict = `${state === "good" ? "On target" : "Above target"}: ${gbp(cpp)} per paying patient against a target under £${T.costPerPaying}${cpb != null ? `; ${gbp(cpb)} per booked consultation` : ""}.`;
  } else if (n === 0) {
    state = "watch";
    verdict = `No leads yet ${since}; ${gbp0(spend)} spent.`;
  } else {
    state = cpb != null && cpb <= T.costPerBooked ? "good" : "watch";
    verdict = `${state === "good" ? "On track" : "Watch"}: ${cpb != null ? `${gbp(cpb)} per booked consultation (target under £${T.costPerBooked}), ${booked} of ${n} leads booked` : `${n} leads, none booked yet`}. Cost per paying patient is measured from about ${firstClose}.`;
  }

  const alerts: Alert[] = [];
  const open = leads.filter((l) => l.status === "open" && l.formIso && now.getTime() - Date.parse(l.formIso) > 48 * 3600000)
    .map((l) => ({ name: l.name as string, days: Math.floor((now.getTime() - Date.parse(l.formIso)) / 86400000) }))
    .sort((a, b) => b.days - a.days);
  // Leads still open are a Patients matter: they show on Pathway, and any follow-up comes as one card.

  // An ad that has spent £20 with no lead meets the playbook's pause rule.
  const groups = new Map<string, { spend: number; leads: number; active: boolean }>();
  for (const a of p.ads ?? []) { const g = groups.get(a.creative) ?? { spend: 0, leads: 0, active: false }; g.spend += a.spend; g.leads += a.leads; g.active ||= a.status === "Active"; groups.set(a.creative, g); }
  const pause = [...groups.entries()].filter(([, g]) => g.active && g.leads === 0 && g.spend >= 20).sort((a, b) => b[1].spend - a[1].spend);
  if (pause.length) alerts.push({ id: "ads-pause", area: "ads", level: "watch", title: `Pause "${pause[0][0]}": ${gbp(pause[0][1].spend)} spent, no lead`, detail: `The playbook pauses an ad at £20 with no lead while others in its ad set produce; the Meta review (Mon and Thu) does it and logs it${pause.length > 1 ? `. ${pause.length - 1} more at the same point` : ""}.`, sources: [sources[0]], href: "/growth/ads/every-ad" });
  const due = (videos?.videos ?? []).filter((v: any) => v.filmBy && !["live", "filmed", "done", "dropped"].includes(String(v.status)) && v.filmBy <= addDays(today, 7)).sort((a: any, b: any) => a.filmBy.localeCompare(b.filmBy));
  if (due.length) alerts.push({ id: "ads-film", area: "ads", level: due[0].filmBy < today ? "act" : "watch", title: `Film ${due[0].id} "${due[0].title}" by ${dayMonth(due[0].filmBy)}`, detail: `For ${due[0].forCampaign}. Hook: ${due[0].hook}${due.length > 1 ? ` (${due.length - 1} more due this week)` : ""}`, sources: [freshness("videos", videos?.pushedIso ?? null, { now })], href: "/growth/social" });
  const uncertain: string[] = p.checks?.uncertain ?? [];
  if (uncertain.length) alerts.push({ id: "ads-uncertain", area: "ads", level: "watch", title: `${cap(num(uncertain.length))} ${uncertain.length === 1 ? "booking needs" : "bookings need"} checking`, detail: uncertain.slice(0, 2).join(" "), sources, href: "/patients/pathway" });

  const stale = sources.some((s) => s.state === "stale");
  if (stale) {
    state = "stale";
    verdict = `Ads data is ${Math.round((now.getTime() - Date.parse(asOf)) / 3600000)} hours old: a pathway check did not run. Figures below are as at ${p.updated}.`;
  }

  const kpis: Kpi[] = [
    { label: "Spend, 7 days", value: gbp0(spendW), compare: vs(gbp0(spendP)), source: sources[0] },
    { label: "Leads, 7 days", value: String(leadsW), compare: vs(String(leadsP)), source: sources[1] },
    { label: "Cost per lead, 7 days", value: cplW != null ? gbp(cplW) : null, compare: `${hadPrev && cplP != null ? `last week ${gbp(cplP)}; ` : ""}target £${T.costPerLead[0]} to £${T.costPerLead[1]}`, source: sources[0], tone: cplW != null ? (cplW <= T.costPerLead[1] ? "good" : "watch") : undefined, notMeasured: cplW == null ? { reason: "no leads in the last 7 days" } : undefined },
    { label: "Booked, 7 days", value: String(bookedW), compare: vs(String(bookedP)), source: sources[2] },
  ];

  const o = p.outcomes;
  const pathway: PathStep[] = [
    { label: "Ads", value: gbp0(spend), sub: `${Number(p.totals?.linkClicks ?? 0).toLocaleString("en-GB")} clicks ${since}` },
    { label: "Leads", value: String(n), sub: n ? `${gbp(spend / n)} each` : "" },
    { label: "Booked", value: String(booked), sub: n ? `${pct(booked / n)} of leads` : "" },
    o ? { label: "Seen", value: String(o.attended), sub: booked ? `${pct(o.attended / booked)} of booked` : "" } : { label: "Seen", value: "soon", sub: `from ${firstAppt}`, pending: true },
    o && (o.treated || cpp != null) ? { label: "Paying", value: String(o.treated ?? paying.length), sub: cpp != null ? `${gbp(cpp)} each` : `${o.pending ?? 0} inside 30 days` } : { label: "Paying", value: "soon", sub: `about ${firstClose}`, pending: true },
  ];

  // This month: the campaigns live now and the next one to switch on.
  const camps: any[] = p.plan?.campaigns ?? [];
  const liveNow = camps.filter((c) => c.start <= today && (!c.end || c.end >= today) && c.status !== "done");
  const next = camps.filter((c) => c.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  const budget = p.budgetAdvice?.current ?? liveNow.reduce((s, c) => s + Math.max(0, Number(c.perDay ?? 0)), 0);
  const thisMonth = `${liveNow.length ? `Live: ${liveNow.map((c) => c.name).join(", ")}` : "Nothing live"}${budget ? ` (£${budget} a day)` : ""}.${next ? ` Next to switch on: ${next.name}, ${dayMonth(next.start)}.` : ""}`;

  const firstRevenue = paying.reduce((t, l) => t + (l.firstValue ?? 0), 0);
  const growthKpis: Kpi[] = [
    { label: "Cost per booked consultation", value: cpb != null ? gbp(cpb) : null, compare: `${booked} booked ${since}; target under £${T.costPerBooked}`, source: sources[2], tone: cpb != null ? (cpb <= T.costPerBooked ? "good" : "watch") : undefined, notMeasured: cpb == null ? { reason: "no consultations booked yet" } : undefined },
    cpp != null ? { label: "Cost per paying patient", value: gbp(cpp), compare: `target under £${T.costPerPaying}`, source: sources[2], tone: cpp <= T.costPerPaying ? "good" : "act" } : { label: "Cost per paying patient", value: null, notMeasured: { reason: `needs 30 days after the first consultation (${firstAppt})`, from: `about ${firstClose}` }, source: sources[2] },
    paying.length ? { label: "Return on ad spend, first visit", value: `${(firstRevenue / spend).toFixed(1)}x`, compare: "industry about 1.5x to 2x (agency figures)", source: sources[2] } : { label: "Return on ad spend", value: null, notMeasured: { reason: "needs the first paying patient; industry first visit about 1.5x to 2x", from: `about ${firstClose}` }, source: sources[2] },
    { label: "Leads, 7 days", value: String(leadsW), compare: `${bookedW} booked; ${hadPrev ? `last week ${leadsP} leads, ${bookedP} booked` : `first week: ads began ${dayMonth(firstDay)}`}`, source: sources[1] },
  ];
  // Chart data: leads per day for the last 14 days, the funnel, and the campaign timeline.
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({
    date: d, label: new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    leads: leads.filter((l) => l.formIso && ukDay(l.formIso) === d).length,
    booked: leads.filter((l) => l.status === "booked" && l.bookedIso && ukDay(l.bookedIso) === d).length,
    spend: Number(daily.find((x) => x.date === d)?.spend ?? 0),
    running: d >= firstDay,
  }));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ym0 = today.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => { const [y, m] = ym0.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + i, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; });
  const idx = (ymd: string) => months.indexOf(ymd.slice(0, 7));
  const timeline = camps.filter((c) => (c.start ?? "") <= months[5] + "-31" && (!c.end || c.end >= months[0] + "-01")).map((c) => ({
    label: c.name, from: Math.max(0, idx(c.start) < 0 ? 0 : idx(c.start)), to: !c.end || idx(c.end) < 0 ? 5 : idx(c.end), live: c.start <= today && (!c.end || c.end >= today),
  })).slice(0, 7);
  const viz = { cpb, cpbTarget: T.costPerBooked, cpl: n ? spend / n : null, cplLow: T.costPerLead[0], cplHigh: T.costPerLead[1], cpp, cppTarget: T.costPerPaying, days14, firstDay, timeline: { months: months.map((m) => MON[Number(m.slice(5)) - 1]), rows: timeline, todayIndex: 0 } };
  return { key: "ads", area: "growth", title: "Ads", state, verdict, detail: p.summary, kpis, sources, alerts, keeper, extra: { leads: n, booked, spend, cpp, firstClose, firstAppt, pathway, thisMonth, leadsW, bookedW, leadsP, bookedP, hadPrev, growthKpis, viz } };
}

// ── Clinic ──────────────────────────────────────────────────────────────────

export function clinicSummary(c: any | null, now = new Date(), extra: { expiring?: number | null } = {}): Summary {
  const keeper = "Kept current by the clinic refresh, daily at about 07:40 from ANS";
  if (!c) return { key: "clinic", area: "clinic", title: "Clinic", state: "stale", verdict: "No clinic snapshot yet: the daily refresh at about 07:40 saves one each morning.", kpis: [], sources: [], alerts: [], keeper };
  const src = freshness("ansTakings", c.updatedIso ?? null, { now });
  const sources = [src];
  const today = londonToday(now);
  const days: any[] = (c.diary?.days ?? []).filter((d: any) => d.date >= today);
  const H = Number(c.diary?.clinicDayHours ?? 7);
  const in7 = days.filter((d) => d.date < londonToday(new Date(now.getTime() + 7 * 86400000)));
  const open7 = in7.reduce((s, d) => s + Math.max(0, H * 60 - d.blockedMins), 0);
  const fill7 = open7 ? in7.reduce((s, d) => s + d.bookedMins, 0) / open7 : null;
  const appts = days.reduce((s, d) => s + d.appts, 0);
  const hours = days.reduce((s, d) => s + d.bookedMins, 0) / 60;
  const opening = c.openingDate ?? "2026-12-08";
  const toOpen = daysTo(opening, now);
  const where = toOpen > 0 ? "Bedhampton" : "both clinics";

  const alerts: Alert[] = [];
  if (fill7 != null && fill7 < 0.3) alerts.push({ id: "clinic-diary-low", area: "clinic", level: "watch", title: `The diary is ${pct(fill7)} booked for the next 7 days`, detail: `${where}: under 30% of open clinical time is booked.`, sources, href: "/clinic/diary" });

  let state: Tone = alerts.length ? "watch" : "good";
  let verdict = `${appts} appointments in the next 14 days at ${where}${fill7 != null ? `, ${pct(fill7)} of the next 7 days' open time booked` : ""}.${toOpen > 0 ? ` Winchester opens in ${toOpen} ${toOpen === 1 ? "day" : "days"}.` : ""}`;
  if (src.state === "stale") { state = "stale"; verdict = `Clinic figures are from ${c.updated}: the daily refresh at about 07:40 has not saved a newer snapshot.`; }

  const byClinic = new Map<string, { open: number; booked: number }>();
  for (const d of days) { const k = byClinic.get(d.clinic) ?? { open: 0, booked: 0 }; k.open += Math.max(0, H * 60 - d.blockedMins); k.booked += d.bookedMins; byClinic.set(d.clinic, k); }
  const fill14 = [...byClinic.entries()].map(([k, v]) => `${k} ${v.open ? pct(v.booked / v.open) : "closed"}`).join(", ");
  const tot = [...byClinic.values()].reduce((a, v) => ({ open: a.open + v.open, booked: a.booked + v.booked }), { open: 0, booked: 0 });
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7, monday = new Date(Date.parse(today + "T12:00:00Z") - dow * 86400000).toISOString().slice(0, 10), sunday = new Date(Date.parse(monday + "T12:00:00Z") + 6 * 86400000).toISOString().slice(0, 10);
  const weekMins = days.filter((d: any) => d.date >= monday && d.date <= sunday).reduce((t: number, d: any) => t + d.bookedMins, 0);
  const kpis: Kpi[] = [
    { label: "Diary, next 14 days", value: tot.open ? pct(tot.booked / tot.open) : null, compare: `of open clinical time; ${fill14 || "no clinic days"}`, source: src, notMeasured: tot.open ? undefined : { reason: "no clinic days in the next 14 days" } },
    { label: "Booked this week", value: `${(weekMins / 60).toFixed(1)} h`, compare: `Mon ${dayMonth(monday)} to Sun ${dayMonth(sunday)}, still to come`, source: src },
    toOpen > 0 ? { label: "Winchester opens in", value: `${toOpen} ${toOpen === 1 ? "day" : "days"}`, compare: `8 December at 9A Jewry Street; model days 2 and 3 December` } : { label: "Winchester", value: "Open", compare: `since ${dayMonth(opening)}` },
    { label: "Expiring in 30 days", value: extra?.expiring != null ? String(extra.expiring) : null, compare: "dated compliance items", notMeasured: extra?.expiring != null ? undefined : { reason: "no dated compliance items yet" } },
  ];
  const vizDays = days.map((d: any) => ({ label: new Date(d.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }), booked: d.bookedMins, open: Math.max(0, H * 60 - d.blockedMins), blocked: d.appts === 0 && d.blockedMins >= H * 60 - 30, clinic: d.clinic }));
  return { key: "clinic", area: "clinic", title: "Clinic", state, verdict, kpis: kpis.slice(0, 4), sources, alerts, keeper, extra: { toOpen, appts, fill7, fill14: tot.open ? tot.booked / tot.open : null, where, viz: { days: vizDays } } };
}

// ── Money ───────────────────────────────────────────────────────────────────

export interface CardLite { name: string; limit: number; balance: number; lastEntry: string | null }

export function moneySummary(J: any | null, cards: CardLite[], now = new Date(), clinic: any | null = null, withLoan: any | null = null): Summary {
  const keeper = "Bank typed by David; cards from the Credit Cards register; the plan follows Plan & Timeline";
  const bank = J?.bank ?? null;
  const bankChip = freshness("bank", bank?.asAt ?? null, { now });
  const lastCard = cards.map((c) => c.lastEntry).filter(Boolean).sort().pop() ?? null;
  const cardChip = freshness("cards", lastCard, { now });
  const sources = [bankChip, cardChip];
  const thisMonth = londonToday(now).slice(0, 7);
  const ahead = (J?.rows ?? []).filter((r: any) => r.month >= thisMonth);
  const low = ahead.reduce((a: any, r: any) => (a == null || r.closingBank < a.bank ? { month: r.label, bank: r.closingBank } : a), null as null | { month: string; bank: number });
  const floor = Number(J?.config?.cashFloor ?? 10000);
  const credit = cards.filter((c) => c.limit > 0);
  const owed = credit.reduce((s, c) => s + c.balance, 0), limit = credit.reduce((s, c) => s + c.limit, 0);

  const alerts: Alert[] = [];
  for (const c of credit) if (c.limit && c.balance / c.limit >= 0.8) alerts.push({ id: `card-${c.name}`, area: "money", level: c.balance > c.limit ? "act" : "watch", title: `${c.name} at ${pct(c.balance / c.limit)} of its limit`, detail: `${gbp0(c.balance)} of ${gbp0(c.limit)}.`, sources: [cardChip], href: "/money/cards" });

  let state: Tone = "good";
  let verdict: string;
  if (!bank) { state = "stale"; verdict = "No bank balance typed yet: the plan starts from its planned opening figure."; }
  else if (bankChip.state === "stale") { state = "stale"; verdict = `The bank figure is ${Math.floor((now.getTime() - Date.parse(bank.asAt + "T12:00:00Z")) / 86400000)} days old (${gbp0(bank.balanceGbp)} on ${dayMonth(bank.asAt)}): update it so the plan starts from today.`; }
  // The bank figure is today's; the plan's low point is a month-end balance after the funding and
  // payments due that month, so the two are never compared as if they were the same thing.
  // The £10,000 floor is a reference line, not an alarm (owner, 15 Nov 2026: "don't worry about the
  // 10k floor"). Only a forecast below zero is a problem.
  else if (low && low.bank < 0) { state = "act"; verdict = `The forecast goes overdrawn: its lowest month-end is ${gbp0(low.bank)}, in ${low.month}.`; }
  else verdict = `The bank stays in credit every month of the forecast. The lowest month-end is ${gbp0(low?.bank ?? 0)}, in ${low?.month ?? "the months shown"}.`;
  if (state !== "stale" && alerts.some((a) => a.level === "act")) state = "act";
  else if (state === "good" && alerts.length) state = "watch";

  const kpis: Kpi[] = [
    bank ? { label: "Bank", value: gbp0(bank.balanceGbp), compare: `Tide, typed for ${dayMonth(bank.asAt)}`, source: bankChip } : { label: "Bank", value: null, notMeasured: { reason: "type today's balance on Money" }, source: bankChip },
    low ? { label: "Lowest month-end ahead", value: gbp0(low.bank), compare: `${low.month}, from the plan${bankChip.state === "stale" ? " (built on a stale bank figure)" : ""}`, source: bankChip, tone: low.bank < 0 ? "act" : low.bank < floor ? "watch" : undefined } : { label: "Lowest month-end", value: null, notMeasured: { reason: "the plan has no months ahead" } },
    (() => {
      const wk = clinic?.takings?.rows?.[0], mo = (clinic?.takings?.rows ?? []).find((r: any) => /so far/i.test(r.period));
      const tChip = freshness("ansTakings", clinic?.updatedIso ?? null, { now });
      return wk ? { label: "Taken this week", value: gbp0(wk.total), compare: `${mo?.booked ? `plus ${gbp0(mo.booked)} booked to ${mo.bookedTo}; ` : ""}Bedhampton, as invoiced`, source: tChip } as Kpi
        : { label: "Taken this week", value: null, notMeasured: { reason: "the clinic refresh has not saved takings yet" }, source: tChip } as Kpi;
    })(),
    (() => {
      const row = (J?.rows ?? []).find((r: any) => r.month === londonToday(now).slice(0, 7));
      return row ? { label: "Out of the bank this month", value: gbp0(row.moneyOutBank), compare: `${row.label}, the plan's payments`, source: bankChip } as Kpi
        : { label: "Out of the bank this month", value: null, notMeasured: { reason: "the plan has no row for this month" } } as Kpi;
    })(),
  ];
  return {
    key: "money", area: "money", title: "Money", state, verdict, kpis, sources, alerts, keeper,
    extra: { bank: bank ? { balanceGbp: bank.balanceGbp, asAt: bank.asAt, inBalance: bank.inBalance ?? [] } : null, fundingOptions: J?.fundingOptions ?? [], bankStale: bankChip.state === "stale" || !bank,
      viz: { floor, low, points: ahead.slice(0, 12).map((r: any) => ({ label: r.label, value: Math.round(r.closingBank) })),
        withLoan: withLoan ? (withLoan.rows ?? []).filter((r: any) => r.month >= thisMonth).slice(0, 12).map((r: any) => ({ label: r.label, value: Math.round(r.closingBank) })) : null },
      availableLoans: J?.availableLoans ?? [],
      expected: (J?.fundingOptions ?? []).filter((f: any) => !(bank?.inBalance ?? []).includes(f.id) && f.month >= (bank?.asAt ?? thisMonth).slice(0, 7)).map((f: any) => ({ label: f.label, amount: f.amount, month: f.month })) },
  };
}

// ── Growth: the area command, from the ads figures ──
export function growthSummary(ads: Summary): Summary {
  return { ...ads, key: "growth", title: "Growth", kpis: (ads.extra?.growthKpis as Kpi[]) ?? ads.kpis, keeper: "Kept current by the pathway check, the capacity review and the Meta review" };
}

// ── Patients ──
export function patientsSummary(p: any | null, c: any | null, followUps: number, now = new Date()): Summary {
  const keeper = "Kept current by the pathway check (ad leads) and the clinic refresh (patients, from opening)";
  const asOf = p?.updatedIso ?? null;
  const ghl = freshness("ghl", asOf, { now }), ans = freshness("ans", asOf, { now }), takings = freshness("ansTakings", c?.updatedIso ?? null, { now });
  const leads: any[] = p?.leads ?? [];
  const booked = leads.filter((l) => l.status === "booked").length;
  const appts = leads.map((l) => l.apptIso).filter(Boolean).sort() as string[];
  const firstAppt = appts[0] ? dayMonth(appts[0]) : "the first consultation";
  const firstClose = appts[0] ? dayMonth(new Date(Date.parse(appts[0]) + 30 * 86400000).toISOString()) : "30 days after it";
  const opening = c?.openingDate ?? "2026-12-08";
  const closed = leads.filter((l) => l.treated === true || l.treated === false);
  const treated = leads.filter((l) => l.treated === true).length;
  const kpis: Kpi[] = [
    { label: "Consultations booked from the ads", value: String(booked), compare: `of ${leads.length} leads since ${p?.windowFrom ?? "the ads began"}; first ${firstAppt}`, source: ans },
    c?.patients ? { label: "New patients, last 4 weeks", value: String(c.patients.newPatients), compare: `${c.patients.returning} came back`, source: takings } : { label: "New patients this month", value: null, notMeasured: { reason: "read from ANS once Winchester is seeing patients", from: dayMonth(opening) }, source: takings },
    closed.length >= 5 ? { label: "Consultation to treatment", value: `${treated} of ${closed.length}`, compare: "ad leads past their 30 days", source: ans } : { label: "Consultation to treatment", value: null, notMeasured: { reason: "needs five consultations past their 30 days; only this campaign's own leads are used", from: `about ${firstClose}` }, source: ans },
    c?.attendance ? { label: "No-show rate", value: pct(c.attendance.noShows / Math.max(1, c.attendance.attended + c.attendance.noShows)), compare: "last 4 weeks", source: takings } : { label: "No-show rate", value: null, notMeasured: { reason: "read from ANS from the first Winchester consultations", from: dayMonth(opening) }, source: takings },
  ];
  const alerts: Alert[] = [];
  if (followUps) alerts.push({ id: "patients-follow-up", area: "patients", level: "watch", title: `${cap(num(followUps))} ${followUps === 1 ? "person has" : "people have"} not booked yet`, detail: "Listed on Pathway with how long each has waited. When a follow-up is worth sending, the pathway check proposes one WhatsApp from the clinic number for your yes; nothing is sent without it.", sources: [ghl], href: "/patients/pathway" });
  const stale = ghl.state === "stale";
  const verdict = stale ? `Lead figures are stale (as at ${p?.updated}); a pathway check did not run.`
    : !p ? "No lead data yet: the next pathway check pushes it."
    : `${booked} consultations are booked from the ads, the first on ${firstAppt}. New patients, conversion, returns and no-shows are measured from opening on ${dayMonth(opening)}.`;
  const funnel = [
    { label: "Leads", value: leads.length },
    { label: "Booked", value: booked },
    { label: "Seen", value: c?.attendance ? null : null, note: `from ${firstAppt}` },
    { label: "Paying", value: closed.length ? treated : null, note: `from about ${firstClose}` },
  ];
  return { key: "patients", area: "patients", title: "Patients", state: stale ? "stale" : followUps ? "watch" : "good", verdict, kpis, sources: [ghl, ans], alerts, keeper, extra: { booked, leads: leads.length, waiting: followUps, viz: { funnel } } };
}
