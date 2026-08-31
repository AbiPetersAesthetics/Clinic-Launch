import { Router } from "express";
import { db } from "@workspace/db";
import { marketingItemsTable, projectsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// The full day-by-day launch marketing plan, from Sun 30 Aug 2026 to 31 Dec 2026.
// Weeks run Sunday to Saturday. days[] is always 7 slots (index 0 = Sun ... 6 = Sat);
// each slot is {t:[tasks]} , {rest:"note"} or {} (nothing that day).
// task: { o: abi|david|both, c: found|social|email|meta|google, x: what to do, d?: child-level how/why }
// phase (category): p0 Foundations · p1 Sep · p2 Oct · p3 Launch · p4 Nov · p5 Dec
// ─────────────────────────────────────────────────────────────────────────────
type Task = { o: string; c: string; x: string; d?: string; m?: boolean };
type Day = { t?: Task[]; rest?: string };
type Week = { phase: string; sun: string; days: Day[] };

const T = (o: string, c: string, x: string, d?: string, m?: boolean): Task => ({ o, c, x, d, m });

const WEEKS: Week[] = [
  // ── W0 · Foundations ──────────────────────────────────────────────────────
  { phase: "p0", sun: "2026-08-30", days: [
    { t: [
      T("david", "found", "Reconnect BOTH Google Business Profiles", "Open GHL, go to Settings then Integrations. The two Bedhampton Google profiles say 'expired' - click reconnect and sign in with the clinic Google account. Until this is done you do not show up on Google Maps and you cannot collect reviews. 10 minutes, biggest quick win."),
      T("abi", "social", "Jot down 6 Reel ideas in your phone", "Just a list in your Notes app. 3 about a treatment or skin tip, 2 about you (meet Abi / a day at work), 1 about the free-analysis offer. You film them Wednesday."),
    ] },
    { t: [
      T("david", "meta", "Switch ON the two Bedhampton ads (Cold + Warm)", "In Meta Ads Manager, find the two most recent Bedhampton campaigns (one 'Cold', one 'Warm') and turn them ON. Check the wording points at the free skin analysis + 15% off."),
      T("david", "found", "Create the Winchester Google profile", "New Google Business Profile for 9A Jewry Street. Start the verification now - Google posts a code and it takes 5 to 14 days, so it must be started early. Category: Skin care clinic."),
    ] },
    { t: [
      T("david", "email", "Build the nurture messages for the 443 leads", "In GHL, set up an automated sequence (the exact SMS + emails are in the Copy Bank below). It messages every one of the 443 warm leads: come for a free skin analysis at Bedhampton, 15% off after."),
      T("both", "found", "Turn the offer on at Bedhampton", "Make sure the booking calendar has free-analysis slots, and everyone knows the deal: free skin analysis, then 15% off any treatment booked after. Runs to 31 Oct."),
    ] },
    { t: [
      T("abi", "social", "FILM 6 Reels in one sitting", "One session, 6 short clips (use your list from Sunday). This single afternoon gives you TWO WEEKS of posts. This is the whole low-effort engine - batch it, don't do it daily."),
      T("david", "found", "Switch on automatic review requests", "In GHL, turn on the automation that texts/emails each client after their appointment asking for a Google review. Set once, works forever."),
    ] },
    { t: [
      T("david", "google", "Set up Google Ads (don't launch yet)", "Create the Google Ads account and draft a Search campaign for Winchester ('skin clinic Winchester', 'skin consultation Winchester'). Do NOT use Botox or prescription words - those are banned in ads. Leave it as a draft."),
    ] },
    { t: [
      T("david", "email", "Send the offer to the whole list", "Email + text to the founding list and Bedhampton clients (copy in the Copy Bank). This is the big relaunch of the free-analysis offer."),
      T("david", "social", "Load 2 weeks of posts into the planner", "In the GHL social planner, schedule the 6 filmed Reels across the next two weeks: Mon, Wed, Fri. Then it posts itself."),
    ] },
    { rest: "Breather. Abi: reply to any comments or DMs when you get a minute." },
  ] },
  // ── W1 · September ────────────────────────────────────────────────────────
  { phase: "p1", sun: "2026-09-06", days: [
    { t: [ T("david", "found", "5-minute check-in + confirm this week's posts are scheduled") ] },
    { t: [ T("both", "social", "POST 1 - Authority: 'Why a skin analysis matters'", "Already filmed. David posts it (Instagram + Facebook). Abi: reply to any comments today.") ] },
    { t: [ T("david", "google", "Take Google Search live - soft budget ~£10/day", "Just to learn what clicks cost in Winchester before you spend big at launch. Small money.") ] },
    { t: [ T("both", "social", "POST 2 - Human: 'Meet Abi'") ] },
    { rest: "Light day. Abi: reply to DMs." },
    { t: [ T("both", "social", "POST 3 - Offer: free analysis + 15% off, with the booking link") ] },
    { rest: "Off." },
  ] },
  { phase: "p1", sun: "2026-09-13", days: [
    { t: [
      T("abi", "social", "FILM the next 6 Reels (fortnight 2)", "Same as before: one sitting, 6 clips, two weeks of content."),
      T("david", "found", "Schedule this week's posts"),
    ] },
    { t: [ T("both", "social", "POST - Authority: skin boosters, explained") ] },
    { t: [ T("david", "email", "Send the value newsletter", "3 quick skin tips, then 'book your free analysis'. Give value first. Copy in the Copy Bank.") ] },
    { t: [ T("both", "social", "POST - Human: behind the scenes / why nurse-led") ] },
    { t: [ T("david", "meta", "Check the ad numbers", "Look at cost per BOOKED analysis, not just per lead. If bookings are cheap, spend a bit more.") ] },
    { t: [ T("both", "social", "POST - Proof: a Bedhampton client review (with their consent)") ] },
    { rest: "Off." },
  ] },
  { phase: "p1", sun: "2026-09-20", days: [
    { t: [ T("david", "found", "Check-in + schedule posts") ] },
    { t: [ T("both", "social", "POST - Authority: a skincare myth, busted") ] },
    { rest: "Light. Abi: reply to comments/DMs." },
    { t: [ T("both", "social", "POST - Human: a day in the clinic") ] },
    { t: [ T("david", "meta", "Refresh the ad picture/video if the lead cost is creeping up") ] },
    { t: [ T("both", "social", "POST - Proof/offer: testimonial + book") ] },
    { rest: "Off." },
  ] },
  { phase: "p1", sun: "2026-09-27", days: [
    { t: [ T("abi", "social", "FILM 6 Reels (Winchester teaser + countdown)"), T("david", "found", "Schedule posts") ] },
    { t: [ T("both", "social", "POST - Authority") ] },
    { t: [ T("david", "email", "Send 'last month for the free analysis' email + text", "Gentle urgency - it ends 31 Oct. Copy in the Copy Bank.") ] },
    { t: [ T("both", "social", "POST - Human: Winchester coming soon") ] },
    { t: [ T("david", "meta", "Check the numbers") ] },
    { t: [ T("both", "social", "POST - Offer: analysis closing soon") ] },
    { rest: "Off." },
  ] },
  // ── W5 · October ──────────────────────────────────────────────────────────
  { phase: "p2", sun: "2026-10-04", days: [
    { t: [ T("david", "found", "Check-in + schedule") ] },
    { t: [
      T("david", "email", "OPEN Winchester Founding-client booking", "Email the 443 + anyone engaged: reserve a November slot as a Founding Client (priority booking, a free add-on, founding pricing locked in). NOT a discount. Copy in the Copy Bank.", true),
      T("both", "social", "POST - Authority"),
    ] },
    { t: [ T("david", "meta", "Point Meta at bookings now; keep the Bedhampton offer running") ] },
    { t: [ T("both", "social", "POST - Human: Winchester fit-out") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Offer: founding spots + analysis closing") ] },
    { rest: "Off." },
  ] },
  { phase: "p2", sun: "2026-10-11", days: [
    { t: [ T("abi", "social", "FILM 6 Reels (fit-out + launch teasers)"), T("david", "found", "Schedule") ] },
    { t: [ T("both", "social", "POST - Authority") ] },
    { t: [ T("david", "found", "Winchester Google profile verified: add hours, photos, first post; send the press release", "Once Google verifies you, fill the profile in and post. Email a short press release to Hampshire Chronicle, So Hampshire and Winchester BID (David writes it, Abi approves).", true) ] },
    { t: [ T("both", "social", "POST - Human: Winchester fit-out") ] },
    { t: [ T("david", "meta", "Check the numbers") ] },
    { t: [ T("both", "social", "POST - Proof") ] },
    { rest: "Off." },
  ] },
  { phase: "p2", sun: "2026-10-18", days: [
    { t: [ T("david", "found", "Check-in + schedule") ] },
    { t: [ T("both", "social", "POST - Authority") ] },
    { t: [ T("david", "email", "Send the 'free analysis closes 31 Oct' final push (whole list)") ] },
    { t: [ T("both", "social", "POST - Human: countdown") ] },
    { t: [ T("both", "found", "Finalise launch-week posts + the Winchester Founding offer", "Decide the exact founding offer and write/film every launch-week post now, so launch week runs itself.") ] },
    { t: [ T("both", "social", "POST - Proof / last chance") ] },
    { rest: "Off." },
  ] },
  { phase: "p2", sun: "2026-10-25", days: [
    { t: [
      T("david", "found", "PRE-SCHEDULE all launch-week posts + the launch email/text", "Load everything for opening week into the planner now, while you have time. Launch week you'll be on the clinic floor."),
      T("abi", "social", "FILM the grand-opening Reel"),
    ] },
    { t: [ T("both", "social", "POST - countdown: 7 days to go") ] },
    { t: [ T("david", "meta", "Build the Winchester launch ads (Meta + Google) - staged and paused", "Set them up ready, but keep them OFF until opening day.") ] },
    { t: [ T("both", "social", "POST - countdown") ] },
    { t: [ T("both", "found", "Soft-launch prep: invite Founding clients + family for 30 Oct to 1 Nov") ] },
    { t: [
      T("both", "found", "SOFT LAUNCH begins - friends, family, Founding clients", "A quiet preview before the public open. Iron out the flow, take photos, get your first reviews.", true),
      T("both", "social", "POST - countdown"),
    ] },
    { t: [ T("both", "found", "LAST DAY of the Bedhampton free-analysis + 15% offer", "The Sep/Oct offer closes tonight. Everything now points at Winchester.", true) ] },
  ] },
  // ── W9 · Launch week ──────────────────────────────────────────────────────
  { phase: "p3", sun: "2026-11-01", days: [
    { t: [ T("both", "found", "Final soft-launch day. Confirm tomorrow's launch email is scheduled") ] },
    { t: [
      T("both", "found", "WINCHESTER OPENS", "This is the day. Deep breath - you've got this.", true),
      T("david", "email", "Send the launch email + text to the 443 + full list", "The big one. 'We're open, book now, Founding spots.' Copy in the Copy Bank. This is where the whole pre-launch list pays off."),
      T("abi", "social", "POST - grand-opening Reel + story series"),
      T("david", "meta", "Switch the Meta + Google Winchester ads LIVE"),
      T("abi", "found", "Ask every client today for a Google review", "In person, at the end of the appointment. The first reviews are the hardest and the most valuable."),
    ] },
    { t: [ T("abi", "social", "POST - opening story series"), T("abi", "found", "Keep asking every client for a review") ] },
    { t: [ T("both", "social", "POST - Human: opening highlights") ] },
    { t: [ T("david", "meta", "Check launch numbers; retarget people who clicked but didn't book") ] },
    { t: [ T("both", "social", "POST - Proof: first clients (with consent) + book link") ] },
    { rest: "Light. Abi: chase any reviews that haven't landed." },
  ] },
  // ── W10 · November ────────────────────────────────────────────────────────
  { phase: "p4", sun: "2026-11-08", days: [
    { t: [ T("david", "found", "Check-in + schedule") ] },
    { t: [ T("both", "social", "POST - Authority"), T("david", "email", "Send 'we're open' recap + offer reminder to anyone who hasn't booked") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Human") ] },
    { t: [ T("david", "email", "Turn on rebooking + referral automation", "After each treatment, GHL auto-asks them to rebook and to refer a friend. Turns one visit into a habit.") ] },
    { t: [ T("both", "social", "POST - Proof") ] },
    { rest: "Off." },
  ] },
  { phase: "p4", sun: "2026-11-15", days: [
    { rest: "Light. Schedule the week." },
    { t: [ T("both", "social", "POST - treatment spotlight"), T("david", "meta", "Retarget website visitors, send them to booking") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Human") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Proof / results (with consent)"), T("both", "found", "Reviews push - aim for 10 Google reviews this month") ] },
    { rest: "Off." },
  ] },
  { phase: "p4", sun: "2026-11-22", days: [
    { rest: "Light. Schedule." },
    { t: [ T("both", "social", "POST - memberships / packages") ] },
    { t: [ T("david", "email", "Send the Black Friday / gifting teaser") ] },
    { t: [ T("both", "social", "POST - Human") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Christmas gifting kick-off + vouchers") ] },
    { rest: "Off." },
  ] },
  // ── W13 · December ────────────────────────────────────────────────────────
  { phase: "p5", sun: "2026-11-29", days: [
    { rest: "Light. Schedule." },
    { t: [ T("both", "social", "POST - gift ideas") ] },
    { t: [
      T("david", "email", "Launch Christmas gift vouchers + skincare campaign", "The big December earner. Vouchers have no capacity limit - make them dead easy to buy online.", true),
      T("david", "meta", "Voucher + skincare ads live (Meta + Google)"),
    ] },
    { t: [ T("both", "social", "POST - gift guide") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - voucher CTA") ] },
    { rest: "Off." },
  ] },
  { phase: "p5", sun: "2026-12-06", days: [
    { rest: "Light. Schedule." },
    { t: [ T("both", "social", "POST - gift ideas") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - Human") ] },
    { t: [ T("david", "email", "Send last-order dates + 'book your January' reminder") ] },
    { t: [ T("both", "social", "POST - 'order by X for Christmas'") ] },
    { rest: "Off." },
  ] },
  { phase: "p5", sun: "2026-12-13", days: [
    { rest: "Light. Schedule." },
    { t: [ T("both", "social", "POST - last-minute gift vouchers") ] },
    { t: [ T("david", "email", "Final last-order + January booking push") ] },
    { t: [ T("both", "social", "POST - Human: thank you") ] },
    { rest: "Light." },
    { t: [ T("both", "social", "POST - festive / proof") ] },
    { rest: "Off." },
  ] },
  { phase: "p5", sun: "2026-12-20", days: [
    { rest: "Light." },
    { t: [ T("both", "social", "POST - festive thank-you") ] },
    { t: [ T("david", "email", "Send the 'new year, new skin' January pre-sell to the full list") ] },
    { t: [ T("both", "social", "POST - January teaser") ] },
    { rest: "Christmas Eve - enjoy it." },
    { rest: "Merry Christmas." },
    { rest: "Off." },
  ] },
  { phase: "p5", sun: "2026-12-27", days: [
    { rest: "Light." },
    { t: [ T("both", "social", "POST - January offer") ] },
    { t: [ T("both", "found", "Year-end review: check cost per booking by channel. Keep what worked, cut what didn't.") ] },
    { rest: "Light." },
    { rest: "Plan January. Then celebrate - you launched a clinic." },
    {},
    {},
  ] },
];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Flatten the weeks into individual dated rows.
const SEED_ITEMS = (() => {
  const out: Array<{ category: string; title: string; detail: string; channel: string; owner: string; weekStart: string; dayDate: string; sortOrder: number; }> = [];
  WEEKS.forEach((wk, wi) => {
    wk.days.forEach((day, di) => {
      const dayDate = addDays(wk.sun, di);
      if (day.rest) {
        out.push({ category: wk.phase, title: day.rest, detail: "", channel: "rest", owner: "both", weekStart: wk.sun, dayDate, sortOrder: wi * 100 + di * 10 });
      }
      (day.t ?? []).forEach((tk, ti) => {
        out.push({ category: wk.phase, title: tk.x, detail: tk.d ?? "", channel: tk.c, owner: tk.o, weekStart: wk.sun, dayDate, sortOrder: wi * 100 + di * 10 + ti + 1 });
      });
    });
  });
  return out;
})();

async function reseed(projectId: number) {
  await db.delete(marketingItemsTable).where(eq(marketingItemsTable.projectId, projectId));
  const seeded = await db.insert(marketingItemsTable).values(
    SEED_ITEMS.map(s => ({
      projectId,
      category: s.category,
      title: s.title,
      detail: s.detail,
      channel: s.channel,
      owner: s.owner,
      weekStart: s.weekStart,
      dayDate: s.dayDate,
      status: "not_started",
      dueWeeksBeforeOpen: null,
      notes: "",
      sortOrder: s.sortOrder,
    }))
  ).returning();
  return seeded.sort((a, b) => a.sortOrder - b.sortOrder);
}

// GET all items + waitlist count (auto-seeds if empty; auto-upgrades an older plan shape)
router.get("/projects/:projectId/marketing", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  let items = await db.select().from(marketingItemsTable)
    .where(eq(marketingItemsTable.projectId, projectId))
    .orderBy(asc(marketingItemsTable.sortOrder));

  // Reseed when empty, or when the stored rows predate the day-by-day plan (no dayDate).
  const isOldPlan = items.length > 0 && items.every(i => !(i as any).dayDate);
  if (items.length === 0 || isOldPlan) {
    items = await reseed(projectId);
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const waitlistCount = (project as any)?.waitlistCount ?? 0;

  return res.json({ items, waitlistCount });
});

// POST force reseed (rebuild the plan from the template, wiping statuses/notes)
router.post("/projects/:projectId/marketing/reseed", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const items = await reseed(projectId);
  return res.json({ items, reseeded: items.length });
});

// PUT update a single item (status / notes)
router.put("/marketing/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { status, notes } = req.body;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  const [row] = await db.update(marketingItemsTable)
    .set(patch)
    .where(eq(marketingItemsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

// PATCH waitlist count
router.patch("/projects/:projectId/marketing/waitlist", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const count = Math.max(0, parseInt(req.body.count) || 0);
  await db.execute(
    `UPDATE projects SET waitlist_count = ${count}, updated_at = NOW() WHERE id = ${projectId}`
  );
  return res.json({ waitlistCount: count });
});

export default router;
