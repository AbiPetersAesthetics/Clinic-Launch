// Data for ALFRED's pages beyond the board summaries (ALFRED-PLAN.md section 2): the dates this week,
// Obligations, Stands Alone, Takings, Studio, Search and reviews, Pathway, Follow up, Sources, Stock
// and Abi's screen. Every figure comes from a source with its date; what is not measured yet says
// so and when it will be. Patients appear as first name and initial at most.
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildCashModel } from "./cash-model";
import { latestAds, latestBoard, latestBoardRow, cardBalances } from "../lib/board-data";
import { freshness, dayMonth, RULES, type SourceKey } from "../lib/freshness";
import { SCHEDULES } from "../lib/heartbeat";
import { recentActivity } from "./proposals";
import { STANDS_ALONE_TAKINGS } from "../lib/cash-model-defaults";
import { rowsOf } from "../lib/agent-tables";

const router = Router();
const londonToday = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const plusMonth = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, end)).padStart(2, "0")}`; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const handle = (fn: (projectId: number, req: any) => Promise<unknown>) => async (req: any, res: any) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json(await fn(parseInt(req.params.projectId), req)); }
  catch (err) { console.error(`[pages ${req.path}]`, err); res.status(500).json({ error: err instanceof Error ? err.message : "Could not build this page" }); }
};
async function cash(projectId: number) { try { return await buildCashModel(projectId, { months: 24 }); } catch (err) { console.error("[pages cash]", err); return null; } }

// ── Cards with their offers and due days ──
async function cardsFull(projectId: number) {
  const bal = await cardBalances(projectId);
  const rows = rowsOf<any>(await db.execute(sql`SELECT id, name, holder, account, credit_limit_gbp, offers_json, due_day, status FROM credit_cards WHERE project_id = ${projectId} AND status <> 'closed' ORDER BY sort_order, id`));
  return rows.map((c) => {
    let offers: any[] = []; try { offers = JSON.parse(c.offers_json || "[]"); } catch { offers = []; }
    const b = bal.find((x) => x.name === c.name);
    return { name: c.name, holder: c.holder, account: c.account, limit: Number(c.credit_limit_gbp ?? 0), balance: b?.balance ?? 0, lastEntry: b?.lastEntry ?? null, dueDay: c.due_day, offers: offers.filter((o) => o?.end).map((o) => ({ kind: o.kind, ratePct: o.ratePct, end: o.end, buyBy: o.buyBy ?? null })) };
  });
}

// What the company owes each director: purchases on personal accounts, less refunds, not yet paid back.
async function directorsLoan(projectId: number) {
  const r = rowsOf<any>(await db.execute(sql`SELECT c.holder, sum(CASE WHEN e.kind = 'refund' THEN -e.amount_gbp ELSE e.amount_gbp END) AS owed, count(*) AS n, max(e.date) AS last
    FROM card_entries e JOIN credit_cards c ON c.id = e.card_id
    WHERE e.project_id = ${projectId} AND c.account = 'personal' AND e.kind IN ('purchase', 'refund') AND e.repaid_date IS NULL GROUP BY c.holder`));
  return r.map((x) => ({ holder: x.holder ?? "Director", owed: r2(Number(x.owed ?? 0)), entries: Number(x.n), last: x.last }));
}

// VAT returns are monthly; each is due one month and seven days after its period ends.
function vatReturns(J: any, today: string) {
  if (!J?.config?.vatReturns) return [];
  const rows: any[] = J.rows ?? [];
  const out: any[] = [];
  for (const r of rows) {
    const due = addDays(plusMonth(lastDay(r.month), 1), 7);
    if (due < today || out.length >= 3) continue;
    const next = rows.find((x) => x.month > r.month);
    out.push({ period: r.label, month: r.month, due, vatOnSales: r2((r.total?.vat ?? 0)), vatOnBuild: r2((r.vatPaidBank ?? 0) + (r.vatPaidCard ?? 0)), refundNextMonth: r2(next?.vatRefund ?? 0) });
  }
  return out;
}

router.get("/projects/:projectId/pages/obligations", handle(async (projectId) => {
  const today = londonToday();
  const [J, cards, loan] = await Promise.all([cash(projectId), cardsFull(projectId), directorsLoan(projectId)]);
  const vat = vatReturns(J, today);
  const loans = (J?.loans ?? []).map((l: any) => {
    const next = (J?.rows ?? []).find((r: any) => r.month >= today.slice(0, 7) && (r.loanRepayment ?? 0) > 0);
    return { label: l.label, principal: l.principal, ratePct: l.annualRatePct, drawMonth: l.drawMonth, holidayMonths: l.holidayMonths, repayments: l.repayments, nextMonth: next?.label ?? null, nextAmount: next ? r2(next.loanRepayment) : null };
  });
  const dated: { date: string; what: string; amount: number | null; note: string; href: string }[] = [];
  for (const v of vat) dated.push({ date: v.due, what: `VAT return for ${v.period}`, amount: null, note: `the plan's VAT on sales ${v.vatOnSales ? `£${Math.round(v.vatOnSales).toLocaleString("en-GB")}` : "nil"}; build VAT reclaimed ${v.vatOnBuild ? `£${Math.round(v.vatOnBuild).toLocaleString("en-GB")}` : "nil"}`, href: "/money/plan" });
  for (const c of cards) for (const o of c.offers) if (o.end >= today) dated.push({ date: o.end, what: `${c.name}: ${o.ratePct}% ${o.kind} offer ends`, amount: c.balance, note: `balance £${Math.round(c.balance).toLocaleString("en-GB")} of £${Math.round(c.limit).toLocaleString("en-GB")}`, href: "/archive/cards" });
  dated.sort((a, b) => a.date.localeCompare(b.date));
  const chip = freshness("cards", cards.map((c) => c.lastEntry).filter(Boolean).sort().pop() ?? null);
  return { asOf: new Date().toISOString(), vat, cards, loans, directorsLoan: loan, dated, sources: [chip, freshness("bank", J?.bank?.asAt ?? null)] };
}));

router.get("/projects/:projectId/pages/stands-alone", handle(async (projectId) => {
  const J = await cash(projectId);
  const today = londonToday();
  const rows = (J?.rows ?? []).filter((r: any) => r.month >= "2026-12").slice(0, 18).map((r: any) => ({ month: r.month, label: r.label, margin: r2(r.wincStandMargin ?? 0), why: r.why?.standAlone ?? "", bedhOpen: r.bedhOpen, pay: r2(r.paySalary ?? 0) }));
  let met: string | null = null;
  for (let i = 1; i < rows.length; i++) if (rows[i - 1].margin >= 0 && rows[i].margin >= 0) { met = rows[i].label; break; }
  const firstPay = (J?.rows ?? []).find((r: any) => (r.paySalary ?? 0) > 0);
  const bedhClose = (J?.rows ?? []).find((r: any, i: number, a: any[]) => i > 0 && a[i - 1].bedhOpen && !r.bedhOpen);
  return {
    asOf: new Date().toISOString(),
    line: { takingsNeeded: STANDS_ALONE_TAKINGS, definition: "Winchester's own contribution covers its full running costs, James's level repayment and the £3,000 kept, two months running." },
    thisMonth: today < "2026-12-08" ? { measured: false, reason: "Winchester takes its first money on 8 December; the first month measured is December, read from ANS by the clinic refresh." } : { measured: false, reason: "Measured from ANS takings at the end of each month." },
    forecastMet: met, firstPay: firstPay?.label ?? null, bedhamptonCloses: bedhClose?.label ?? null,
    rows, sources: [freshness("bank", J?.bank?.asAt ?? null)],
  };
}));

router.get("/projects/:projectId/pages/takings", handle(async (projectId) => {
  const [clinicRow, J] = await Promise.all([latestBoardRow(projectId, "clinic"), cash(projectId)]);
  const today = londonToday();
  const plan = (J?.rows ?? []).find((r: any) => r.month === today.slice(0, 7));
  const hist = rowsOf<any>(await db.execute(sql`SELECT created_at, data->>'updatedIso' AS iso, data->'takings'->'rows'->0 AS week FROM board_snapshots WHERE project_id = ${projectId} AND key = 'clinic' ORDER BY created_at DESC LIMIT 60`));
  const weeks = new Map<string, any>();
  for (const h of hist) { const w = h.week; if (w?.period && !weeks.has(w.period)) weeks.set(w.period, { period: w.period, total: w.total, asOf: h.iso }); }
  return {
    asOf: new Date().toISOString(),
    rows: clinicRow?.takings?.rows ?? [], note: clinicRow?.takings?.byClinicNote ?? "", source: clinicRow?.takings?.source ?? "",
    weeks: [...weeks.values()].slice(0, 12),
    planThisMonth: plan ? { label: plan.label, bedhampton: r2(plan.bedh?.gross ?? 0), winchester: r2(plan.winc?.gross ?? 0), total: r2(plan.total?.gross ?? 0) } : null,
    sources: [freshness("ansTakings", clinicRow?.updatedIso ?? null)],
  };
}));

router.get("/projects/:projectId/pages/studio", handle(async (projectId) => {
  const [v, social] = await Promise.all([latestBoardRow(projectId, "videos"), latestBoardRow(projectId, "social")]);
  const today = londonToday();
  const all: any[] = v?.videos ?? [];
  const done = (s: string) => ["live", "filmed", "done", "dropped"].includes(String(s));
  const next = all.filter((x) => !done(x.status) && x.filmBy).sort((a, b) => a.filmBy.localeCompare(b.filmBy));
  const pick = (x: any) => ({ id: x.id, title: x.title, hook: x.hook, filmBy: x.filmBy, forCampaign: x.forCampaign, forMonth: x.forMonth, scriptRef: x.scriptRef, where: x.where, length: x.length, status: x.status, notes: x.notes, overdue: x.filmBy < today });
  return {
    asOf: new Date().toISOString(), cadence: v?.cadence ?? null, total: all.length,
    next: next.slice(0, 6).map(pick), thisWeek: next.filter((x) => x.filmBy <= addDays(today, 7)).length,
    live: all.filter((x) => x.status === "live").map(pick),
    posts: social?.posts ?? null,
    sources: [freshness("videos", v?.pushedIso ?? null), ...(social ? [freshness("videos", social.pushedIso)] : [])],
    postsNote: social ? null : "Not measured yet: the Meta review (Mondays and Thursdays 09:30) reads Instagram and Facebook post performance from the Meta connector and pushes it here.",
  };
}));

router.get("/projects/:projectId/pages/search", handle(async (projectId) => {
  const [seo, reviews] = await Promise.all([latestBoardRow(projectId, "seo"), latestBoardRow(projectId, "reviews")]);
  const chip = freshness("gsc", seo?.lastRefreshed ?? null);
  const sites = seo?.sites ?? {};
  const siteOf = (q: string) => {
    const s = q.toLowerCase();
    if ((sites.bedhampton?.match ?? []).some((m: string) => s.includes(m))) return "Bedhampton";
    if ((sites.winchester?.match ?? []).some((m: string) => s.includes(m))) return "Winchester";
    return "Both";
  };
  const queries = (seo?.clusters ?? []).flatMap((c: any) => (c.queries ?? []).map((q: any) => ({ q: q.q, cluster: c.id, site: siteOf(q.q), impressions: q.impressions, position: q.position, prior: q.priorPosition ?? null, clicks: q.clicks })))
    .filter((q: any) => q.impressions >= 1).sort((a: any, b: any) => b.impressions - a.impressions);
  return {
    asOf: new Date().toISOString(), lastRefreshed: seo?.lastRefreshed ?? null, window: seo?.windowUsed ?? null, totals: seo?.siteTotals ?? null,
    winchester: queries.filter((q: any) => q.site === "Winchester").slice(0, 10), bedhampton: queries.filter((q: any) => q.site === "Bedhampton").slice(0, 10), shared: queries.filter((q: any) => q.site === "Both").slice(0, 8),
    reviews: reviews ?? null,
    reviewsNote: reviews ? null : "Not measured yet: the Search and reviews run (Tuesdays 08:30) reads both Google profiles and the named competitors through Local Falcon and pushes them here.",
    stale: chip.state === "stale", sources: [chip, ...(reviews ? [freshness("gsc", reviews.pushedIso)] : [])],
  };
}));

// First name and initial only, as the pathway file already holds them.
router.get("/projects/:projectId/pages/pathway", handle(async (projectId) => {
  const p = await latestAds(projectId);
  const leads = (p?.leads ?? []).map((l: any) => ({ name: l.name, ad: l.ad, formSent: l.formSent, formIso: l.formIso, status: l.status, statusText: l.statusText, appt: l.appt ?? null, apptIso: l.apptIso ?? null, what: l.what ?? null, match: l.match ?? null, attended: l.attended ?? null, treated: l.treated ?? null, returned: l.returned ?? null, visit: l.visit ?? null }));
  return { asOf: new Date().toISOString(), windowFrom: p?.windowFrom ?? null, leads, other: p?.other ?? [], checks: p?.checks ?? null, sources: [freshness("ghl", p?.updatedIso ?? null), freshness("ans", p?.updatedIso ?? null)] };
}));

// A personal message for Abi to send herself: ALFRED never messages patients.
function draftFor(l: any, kind: "lead" | "consult") {
  const first = String(l.name ?? "").split(" ")[0] || "there";
  return kind === "lead"
    ? `Hi ${first}, it's Abi from Abi Peters Skin Clinic in Winchester. Thank you for getting in touch about your skin. I'd love to help you work out what is right for you, with no pressure at all. Would a free skin consultation suit you this week or next? Just reply and I'll find a time. Abi`
    : `Hi ${first}, it's Abi. It was lovely to meet you at your consultation. If you have any questions about the plan we talked through, or would like to book your first treatment, just reply and I'll sort a time that suits you. Abi`;
}

export async function followUps(projectId: number) {
  const p = await latestAds(projectId);
  const now = Date.now();
  const open = (p?.leads ?? []).filter((l: any) => l.status === "open" && l.formIso).map((l: any) => ({ name: l.name, kind: "lead" as const, since: l.formIso, days: Math.floor((now - Date.parse(l.formIso)) / 86400000), ad: l.ad, why: "Sent the form and has not booked.", draft: draftFor(l, "lead") }));
  const unconverted = (p?.leads ?? []).filter((l: any) => l.attended === true && l.treated !== true && l.apptIso).map((l: any) => ({ name: l.name, kind: "consult" as const, since: l.apptIso, days: Math.floor((now - Date.parse(l.apptIso)) / 86400000), ad: l.ad, why: "Came to the consultation and has not booked a treatment yet.", draft: draftFor(l, "consult") }));
  return { asOf: new Date().toISOString(), items: [...unconverted, ...open].sort((a, b) => b.days - a.days), sources: [freshness("ghl", p?.updatedIso ?? null), freshness("ans", p?.updatedIso ?? null)] };
}
router.get("/projects/:projectId/pages/follow-up", handle(followUps));

router.get("/projects/:projectId/pages/sources", handle(async (projectId) => {
  const [ads, clinic, videos, seo, reviews, social, J, runs] = await Promise.all([latestAds(projectId), latestBoard(projectId, "clinic"), latestBoardRow(projectId, "videos"), latestBoardRow(projectId, "seo"), latestBoardRow(projectId, "reviews"), latestBoardRow(projectId, "social"), cash(projectId), recentActivity(projectId, undefined, 200)]);
  const cards = await cardBalances(projectId);
  const lastRun = (agent: string) => runs.find((r) => r.agent === agent) ?? null;
  const nextOf = (agent: string) => { const s = SCHEDULES.find((x) => x.agent === agent); return s ? s.label : null; };
  const list: { key: string; label: string; what: string; chip: any; agent: string | null; next: string | null; last: any }[] = [
    { key: "meta", label: "Meta Ads", what: "Spend, leads and every ad", chip: freshness("meta", ads?.updatedIso), agent: "Pathway check", next: nextOf("Pathway check"), last: lastRun("Pathway check") },
    { key: "ghl", label: "GoHighLevel", what: "Leads and their follow-up", chip: freshness("ghl", ads?.updatedIso), agent: "Pathway check", next: nextOf("Pathway check"), last: lastRun("Pathway check") },
    { key: "ans", label: "ANS bookings", what: "Bookings, attendance and outcomes for ad leads", chip: freshness("ans", ads?.updatedIso), agent: "Pathway check", next: nextOf("Pathway check"), last: lastRun("Pathway check") },
    { key: "ansTakings", label: "ANS takings and diary", what: "Money taken and booked, the 14 day diary", chip: freshness("ansTakings", clinic?.updatedIso), agent: "Clinic refresh", next: nextOf("Clinic refresh"), last: lastRun("Clinic refresh") },
    { key: "bank", label: "Bank (Tide)", what: "Typed by David on Money", chip: freshness("bank", J?.bank?.asAt ?? null), agent: null, next: "when you type it", last: null },
    { key: "cards", label: "Credit Cards register", what: "Balances, limits, 0% dates", chip: freshness("cards", cards.map((c) => c.lastEntry).filter(Boolean).sort().pop() ?? null), agent: null, next: "when an entry is added", last: null },
    { key: "gsc", label: "Search Console", what: "Rankings for the tracked queries", chip: freshness("gsc", seo?.lastRefreshed ?? null), agent: "Search and reviews", next: "GitHub Action daily 03:17 UTC; pushed Tuesdays 08:30", last: lastRun("Search and reviews") },
    { key: "reviews", label: "Google profiles", what: "Review count and rating against rivals", chip: freshness("gsc", reviews?.pushedIso ?? null), agent: "Search and reviews", next: nextOf("Search and reviews"), last: lastRun("Search and reviews") },
    { key: "videos", label: "Filming queue", what: "ads/meta/videos.json", chip: freshness("videos", videos?.pushedIso ?? null), agent: "Meta review", next: nextOf("Meta review"), last: lastRun("Meta review") },
    { key: "social", label: "Instagram and Facebook posts", what: "How posts and Reels performed", chip: freshness("videos", social?.pushedIso ?? null), agent: "Meta review", next: nextOf("Meta review"), last: lastRun("Meta review") },
    { key: "semrush", label: "Semrush market data", what: "Search volumes, a one-off snapshot", chip: freshness("semrush", "2026-09-19"), agent: null, next: "never refreshes", last: null },
  ];
  return { asOf: new Date().toISOString(), sources: list, rules: Object.fromEntries(Object.entries(RULES).map(([k, v]) => [k, v.by])) };
}));

// ── Stock: a simple list Abi keeps on her screen ──
const STOCK_DDL = `CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'retail',
  clinic TEXT NOT NULL DEFAULT 'Winchester', on_hand INTEGER NOT NULL DEFAULT 0, reorder_at INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
let stockReady: Promise<void> | null = null;
const ensureStock = () => (stockReady ??= (async () => { try { await db.execute(sql.raw(STOCK_DDL)); } catch (e: any) { if ((e?.cause?.code ?? e?.code) !== "23505") { stockReady = null; throw e; } } })());
export async function stockList(projectId: number) {
  await ensureStock();
  const items = rowsOf<any>(await db.execute(sql`SELECT * FROM stock_items WHERE project_id = ${projectId} ORDER BY (on_hand <= reorder_at) DESC, name`));
  return items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, clinic: i.clinic, onHand: Number(i.on_hand), reorderAt: Number(i.reorder_at), low: Number(i.on_hand) <= Number(i.reorder_at), updatedAt: new Date(i.updated_at).toISOString() }));
}
router.get("/projects/:projectId/stock", handle(async (projectId) => ({ items: await stockList(projectId) })));
router.post("/projects/:projectId/stock", handle(async (projectId, req) => {
  await ensureStock();
  const b = req.body ?? {};
  const name = String(b.name ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Give the item a name");
  if (/[–—]/.test(name)) throw new Error("No dashes, please");
  const onHand = Math.max(0, Math.min(9999, parseInt(b.onHand ?? 0) || 0)), reorderAt = Math.max(0, Math.min(9999, parseInt(b.reorderAt ?? 1) || 0));
  await db.execute(sql`INSERT INTO stock_items (project_id, name, kind, clinic, on_hand, reorder_at) VALUES (${projectId}, ${name}, ${String(b.kind ?? "retail").slice(0, 30)}, ${String(b.clinic ?? "Winchester").slice(0, 30)}, ${onHand}, ${reorderAt})`);
  return { items: await stockList(projectId) };
}));
router.patch("/projects/:projectId/stock/:id", handle(async (projectId, req) => {
  await ensureStock();
  const onHand = Math.max(0, Math.min(9999, parseInt(req.body?.onHand) || 0));
  await db.execute(sql`UPDATE stock_items SET on_hand = ${onHand}, updated_at = NOW() WHERE project_id = ${projectId} AND id = ${parseInt(req.params.id)}`);
  return { items: await stockList(projectId) };
}));

// ── Dates this week, merged from every area (Today) ──
export async function datesAhead(projectId: number, days = 7) {
  const today = londonToday();
  const end = addDays(today, days);
  const [ads, videos, cards, J] = await Promise.all([latestAds(projectId), latestBoardRow(projectId, "videos"), cardsFull(projectId), cash(projectId)]);
  const out: { date: string; area: string; what: string; href: string }[] = [];
  const inWin = (d?: string | null) => !!d && d >= today && d <= end;
  for (const c of ads?.plan?.campaigns ?? []) {
    if (inWin(c.start)) out.push({ date: c.start, area: "Growth", what: `${c.name} switches on`, href: "/growth/plan" });
    if (inWin(c.end)) out.push({ date: c.end, area: "Growth", what: `${c.name} ends`, href: "/growth/plan" });
  }
  for (const v of videos?.videos ?? []) if (inWin(v.filmBy) && !["live", "filmed", "done", "dropped"].includes(String(v.status))) out.push({ date: v.filmBy, area: "Growth", what: `Film ${v.id} "${v.title}"`, href: "/growth/studio" });
  for (const c of cards) for (const o of c.offers) if (inWin(o.end)) out.push({ date: o.end, area: "Money", what: `${c.name} ${o.kind} offer ends`, href: "/money/obligations" });
  for (const v of vatReturns(J, today)) if (inWin(v.due)) out.push({ date: v.due, area: "Money", what: `VAT return for ${v.period} due`, href: "/money/obligations" });
  try {
    const comp = rowsOf<any>(await db.execute(sql`SELECT title, required_by_date FROM compliance_items WHERE project_id = ${projectId} AND required_by_date IS NOT NULL AND required_by_date >= ${today} AND required_by_date <= ${end} AND coalesce(status, '') NOT IN ('complete', 'done', 'not_applicable')`));
    for (const c of comp) out.push({ date: String(c.required_by_date).slice(0, 10), area: "Clinic", what: `${c.title} due`, href: "/clinic/compliance" });
  } catch { /* no compliance list */ }
  for (const m of [{ date: "2026-12-02", what: "Winchester model days begin (2 and 3 December)" }, { date: "2026-12-08", what: "Winchester opens at 9A Jewry Street" }]) if (inWin(m.date)) out.push({ date: m.date, area: "Clinic", what: m.what, href: "/clinic/opening" });
  return out.sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, label: d.date === today ? "Today" : d.date === addDays(today, 1) ? "Tomorrow" : new Date(d.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) }));
}
router.get("/projects/:projectId/pages/dates", handle(async (projectId, req) => ({ dates: await datesAhead(projectId, Math.min(31, parseInt(req.query.days) || 7)) })));

// ── Abi's screen ──
router.get("/projects/:projectId/pages/abi", handle(async (projectId) => {
  const today = londonToday(), tomorrow = addDays(today, 1);
  const [clinic, videos, fu, stock] = await Promise.all([latestBoard(projectId, "clinic"), latestBoardRow(projectId, "videos"), followUps(projectId), stockList(projectId)]);
  const day = (d: string) => { const x = (clinic?.diary?.days ?? []).find((z: any) => z.date === d); return x ? { date: d, clinic: x.clinic, appts: x.appts, first: x.first, last: x.last, consults: x.consults, blocked: x.blockedMins >= (clinic?.diary?.clinicDayHours ?? 7) * 60 - 30 } : { date: d, clinic: null, appts: 0, first: null, last: null, consults: 0, blocked: false }; };
  const film = (videos?.videos ?? []).filter((v: any) => v.filmBy && !["live", "filmed", "done", "dropped"].includes(String(v.status)) && v.filmBy <= addDays(today, 7)).sort((a: any, b: any) => a.filmBy.localeCompare(b.filmBy)).map((v: any) => ({ id: v.id, title: v.title, hook: v.hook, filmBy: v.filmBy, scriptRef: v.scriptRef, where: v.where }));
  return {
    asOf: new Date().toISOString(), today: day(today), tomorrow: day(tomorrow), film, messages: fu.items.slice(0, 5), stock: stock.filter((s) => s.low),
    reviewsNote: "From opening on 8 December, the patients to ask for a Google review appear here.",
    sources: [freshness("ansTakings", clinic?.updatedIso ?? null), freshness("videos", videos?.pushedIso ?? null), ...fu.sources],
  };
}));

export default router;
