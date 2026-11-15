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
  area: "ads" | "money" | "clinic" | "growth";
  level: "act" | "watch";
  title: string;
  detail?: string;
  sources: Chip[];
  href?: string;
}

export interface Summary {
  key: string;
  area: "money" | "growth" | "clinic";
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
  if (open.length) alerts.push({
    id: "ads-open-leads", area: "ads", level: "watch",
    title: `Call ${open.length === 1 ? open[0].name : `${num(open.length)} open leads`}: no booking after two days`,
    detail: `${open.map((o) => `${o.name} (${o.days} days)`).join(", ")}. A call from Abi is the next step; ALFRED never messages leads.`,
    sources: [sources[1]], href: "/growth/ads/leads",
  });
  // An ad that has spent £20 with no lead meets the playbook's pause rule.
  const groups = new Map<string, { spend: number; leads: number; active: boolean }>();
  for (const a of p.ads ?? []) { const g = groups.get(a.creative) ?? { spend: 0, leads: 0, active: false }; g.spend += a.spend; g.leads += a.leads; g.active ||= a.status === "Active"; groups.set(a.creative, g); }
  const pause = [...groups.entries()].filter(([, g]) => g.active && g.leads === 0 && g.spend >= 20).sort((a, b) => b[1].spend - a[1].spend);
  if (pause.length) alerts.push({ id: "ads-pause", area: "ads", level: "watch", title: `Pause "${pause[0][0]}": ${gbp(pause[0][1].spend)} spent, no lead`, detail: `The playbook pauses an ad at £20 with no lead while others in its ad set produce; the Meta review (Mon and Thu) does it and logs it${pause.length > 1 ? `. ${pause.length - 1} more at the same point` : ""}.`, sources: [sources[0]], href: "/growth/ads/every-ad" });
  const due = (videos?.videos ?? []).filter((v: any) => v.filmBy && !["live", "filmed", "done", "dropped"].includes(String(v.status)) && v.filmBy <= addDays(today, 7)).sort((a: any, b: any) => a.filmBy.localeCompare(b.filmBy));
  if (due.length) alerts.push({ id: "ads-film", area: "ads", level: due[0].filmBy < today ? "act" : "watch", title: `Film ${due[0].id} "${due[0].title}" by ${dayMonth(due[0].filmBy)}`, detail: `For ${due[0].forCampaign}. Hook: ${due[0].hook}${due.length > 1 ? ` (${due.length - 1} more due this week)` : ""}`, sources: [freshness("videos", videos?.pushedIso ?? null, { now })], href: "/growth/social" });
  const uncertain: string[] = p.checks?.uncertain ?? [];
  if (uncertain.length) alerts.push({ id: "ads-uncertain", area: "ads", level: "watch", title: `${cap(num(uncertain.length))} ${uncertain.length === 1 ? "booking needs" : "bookings need"} checking`, detail: uncertain.slice(0, 2).join(" "), sources, href: "/growth/ads/leads" });

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

  return { key: "ads", area: "growth", title: "Ads", state, verdict, detail: p.summary, kpis, sources, alerts, keeper, extra: { leads: n, booked, spend, cpp, firstClose, pathway, thisMonth, leadsW, bookedW } };
}

// ── Clinic ──────────────────────────────────────────────────────────────────

export function clinicSummary(c: any | null, now = new Date()): Summary {
  const keeper = "Kept current by the clinic refresh, daily at about 07:40 from ANS";
  if (!c) return { key: "clinic", area: "clinic", title: "Clinic", state: "stale", verdict: "No clinic snapshot yet: the daily refresh at about 07:40 saves one each morning.", kpis: [], sources: [], alerts: [], keeper };
  const src = freshness("ansTakings", c.updatedIso ?? null, { now });
  const sources = [src];
  const rows: any[] = c.takings?.rows ?? [];
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
  const week = rows[0];

  const alerts: Alert[] = [];
  if (fill7 != null && fill7 < 0.3) alerts.push({ id: "clinic-diary-low", area: "clinic", level: "watch", title: `The diary is ${pct(fill7)} booked for the next 7 days`, detail: `${where}: under 30% of open clinical time is booked.`, sources, href: "/clinic/board" });

  let state: Tone = alerts.length ? "watch" : "good";
  let verdict = `${week ? `${gbp0(week.total)} taken ${/week/i.test(week.period) ? "this week" : week.period}` : "Takings not read yet"}; ${appts} appointments in the next 14 days${fill7 != null ? `, ${pct(fill7)} of the next 7 days booked` : ""}.`;
  if (src.state === "stale") { state = "stale"; verdict = `Clinic figures are from ${c.updated}: the daily refresh at about 07:40 has not saved a newer snapshot.`; }

  const month = rows.find((r) => /so far/i.test(r.period));
  const kpis: Kpi[] = [];
  if (week) kpis.push({ label: "Taken this week", value: gbp0(week.total), compare: `${week.period.replace(/^This week /i, "")}, ${where}, as invoiced (with any VAT)`, source: src });
  if (month) kpis.push({ label: "Taken this month", value: gbp0(month.total), compare: month.booked ? `plus ${gbp0(month.booked)} booked to ${month.bookedTo}, not yet taken` : where, source: src });
  kpis.push({ label: "Next 14 days", value: `${appts} appts`, compare: `${hours.toFixed(1)} h booked, ${where}`, source: src });
  kpis.push({ label: "Diary, next 7 days", value: fill7 != null ? pct(fill7) : null, compare: "of open clinical time booked", source: src, notMeasured: fill7 == null ? { reason: "no clinic days in the next 7 days" } : undefined });
  kpis.push(c.attendance
    ? { label: "Attended", value: pct(c.attendance.attended / Math.max(1, c.attendance.attended + c.attendance.noShows)), compare: "of booked, last 4 weeks", source: src }
    : { label: "Attended", value: null, notMeasured: { reason: "read from ANS once Winchester is seeing patients", from: dayMonth(opening) }, source: src });
  return { key: "clinic", area: "clinic", title: "Clinic", state, verdict, kpis: kpis.slice(0, 4), sources, alerts, keeper, extra: { toOpen, appts, fill7 } };
}

// ── Money ───────────────────────────────────────────────────────────────────

export interface CardLite { name: string; limit: number; balance: number; lastEntry: string | null }

export function moneySummary(J: any | null, cards: CardLite[], now = new Date()): Summary {
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
  else if (low && low.bank < 0) { state = "act"; verdict = `The plan goes overdrawn: its lowest month-end balance is ${gbp0(low.bank)} (${low.month}).`; }
  else if (low && low.bank < floor) { state = "watch"; verdict = `The plan's lowest month-end balance is ${gbp0(low.bank)} (${low.month}), under the ${gbp0(floor)} floor. Bank ${gbp0(bank.balanceGbp)} typed for ${dayMonth(bank.asAt)}.`; }
  else verdict = `Every month-end balance in the plan stays above the ${gbp0(floor)} floor${low ? ` (lowest ${gbp0(low.bank)}, ${low.month})` : ""}. Bank ${gbp0(bank.balanceGbp)} typed for ${dayMonth(bank.asAt)}, before funding still to land.`;
  if (state !== "stale" && alerts.some((a) => a.level === "act")) state = "act";
  else if (state === "good" && alerts.length) state = "watch";

  const kpis: Kpi[] = [
    bank ? { label: "Bank", value: gbp0(bank.balanceGbp), compare: `Tide, typed for ${dayMonth(bank.asAt)}`, source: bankChip } : { label: "Bank", value: null, notMeasured: { reason: "type today's balance on Money" }, source: bankChip },
    low ? { label: "Lowest month-end", value: gbp0(low.bank), compare: `${low.month}, from the plan${bankChip.state === "stale" ? " (built on a stale bank figure)" : ""}`, source: bankChip, tone: low.bank < 0 ? "act" : low.bank < floor ? "watch" : undefined } : { label: "Lowest month-end", value: null, notMeasured: { reason: "the plan has no months ahead" } },
    { label: "Credit cards owed", value: gbp0(owed), compare: limit ? `of ${gbp0(limit)} limits, ${credit.length} cards` : "no credit cards on the register", source: cardChip },
  ];
  return {
    key: "money", area: "money", title: "Money", state, verdict, kpis, sources, alerts, keeper,
    extra: { bank: bank ? { balanceGbp: bank.balanceGbp, asAt: bank.asAt, inBalance: bank.inBalance ?? [] } : null, fundingOptions: J?.fundingOptions ?? [], bankStale: bankChip.state === "stale" || !bank },
  };
}
