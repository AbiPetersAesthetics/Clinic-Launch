import { Router } from "express";
import { db } from "@workspace/db";
import { marketingItemsTable, projectsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Remodelled marketing plan — 3 channels (social / email / paid), week by week,
// from 1 Sep 2026 to Winchester opening (2 Nov 2026) + the two months after.
// Each item is owner-tagged (Abi / David / both) and phase-grouped.
//   phase (category): p0 Foundations · p1 Sep · p2 Oct · p3 Launch · p4 Nov · p5 Dec
//   channel: found (setup) · social · email · meta (Facebook/Instagram ads) · google (Search ads)
//   owner: abi · david · both
//   weekStart: ISO Monday of that week, or "" for one-off setup
// ─────────────────────────────────────────────────────────────────────────────
type Seed = {
  phase: string;
  channel: string;
  owner: string;
  week: string;
  title: string;
  detail: string;
};

const P: Seed[] = [
  // ── P0 · FOUNDATIONS (do this week — mostly David) ────────────────────────
  { phase: "p0", channel: "found", owner: "david", week: "", title: "Reconnect Google Business Profile (Bedhampton + Waterlooville)", detail: "Both GBP connections are EXPIRED in GHL. Reconnect them — without it you lose Maps ranking, reviews and posts. 10 minutes, highest-yield fix on the list." },
  { phase: "p0", channel: "found", owner: "david", week: "", title: "Create Winchester GBP (9A Jewry Street) + start verification", detail: "New profile for the Winchester clinic. Verification takes 5-14 days, so start now. Category: Skin care clinic / Medical spa. This is your #1 free local-search asset." },
  { phase: "p0", channel: "meta", owner: "david", week: "", title: "Switch ON the two Bedhampton ads — Cold + Warm", detail: "Re-activate the most recent Bedhampton Cold + Warm consultation campaigns. Point both at the complimentary skin analysis + 20% off offer. Warm (the 443 + page engagers) should beat the ~£17 cold CPL." },
  { phase: "p0", channel: "found", owner: "both", week: "", title: "Lock the Sep/Oct offer + Bedhampton booking calendar", detail: "Complimentary skin analysis at Bedhampton, 1 Sep-31 Oct. 20% off ANY treatment taken after the analysis (Bedhampton clients). Set the calendar + capacity so the diary can fill." },
  { phase: "p0", channel: "email", owner: "david", week: "", title: "Build the GHL nurture sequence for the 443 founding leads", detail: "You have 443 warm Winchester leads at £3.08 each. Auto SMS+email: complimentary skin analysis (20% off after) at Bedhampton now → priority Winchester booking from Nov. Move them through the Founding List pipeline." },
  { phase: "p0", channel: "google", owner: "david", week: "", title: "Set up Google Ads + draft Winchester Search campaign", detail: "High-intent terms: 'skin clinic Winchester', 'skin consultation Winchester', 'aesthetics Winchester'. NOT Botox/prescription terms (ad-restricted). Keep it drafted; go live mid-Oct." },
  { phase: "p0", channel: "found", owner: "david", week: "", title: "Turn on review-request automation", detail: "Post-appointment SMS/email asking for a Google review. Once GBP is reconnected this compounds your local ranking every single week." },
  { phase: "p0", channel: "social", owner: "abi", week: "", title: "Batch-record 6 Reels (a fortnight of content)", detail: "Film 6 short clips in one sitting: 3 treatment/skin explainers, 2 meet-Abi / behind-the-scenes, 1 the offer. This single session feeds two weeks of posting — the whole low-effort engine." },
  { phase: "p0", channel: "social", owner: "david", week: "", title: "Load the 3-posts-a-week template into the GHL planner", detail: "Mon = authority/education · Wed = behind-the-scenes/human · Fri = proof/offer/CTA. Schedule a fortnight ahead (FB + Instagram) so it runs itself." },
  { phase: "p0", channel: "found", owner: "both", week: "", title: "Standing weekly 15-minute marketing check-in", detail: "Once a week: what got posted, what leads came in, what to tweak. Keeps the plan alive without big meetings." },

  // ── P1 · SEPTEMBER — warm & convert at Bedhampton ─────────────────────────
  { phase: "p1", channel: "email", owner: "david", week: "2026-09-01", title: "Email + SMS: complimentary analysis + 20% off, to founding list & Bedhampton clients", detail: "Relaunch the offer to everyone you have. One clear CTA: book your complimentary skin analysis at Bedhampton, 20% off any treatment after, ends 31 Oct." },
  { phase: "p1", channel: "social", owner: "both", week: "2026-09-01", title: "3 posts — theme: introduce the complimentary skin analysis", detail: "Mon authority (why a skin analysis matters) · Wed BTS (meet Abi) · Fri offer (book it, 20% off after). Abi records, David schedules." },
  { phase: "p1", channel: "meta", owner: "david", week: "2026-09-01", title: "Bedhampton Cold + Warm live; retarget the 443 to book", detail: "Offer-led creative. Warm audience = the 443 founding leads + page engagers. Watch cost per booked analysis, not just per lead." },
  { phase: "p1", channel: "social", owner: "both", week: "2026-09-08", title: "3 posts — theme: skin-health education", detail: "Skin boosters, skincare basics, a myth-bust. Authority content is ASA-safe and builds trust with the Winchester audience." },
  { phase: "p1", channel: "google", owner: "david", week: "2026-09-08", title: "Google Search live on a soft budget (~£10/day)", detail: "Test Winchester intent terms early so you learn real CPCs and which keywords convert before launch spend ramps." },
  { phase: "p1", channel: "email", owner: "david", week: "2026-09-15", title: "Value newsletter: skin tips + book your complimentary analysis", detail: "Give value first (3 quick skin tips), then the soft CTA. Keeps the list warm without feeling salesy." },
  { phase: "p1", channel: "social", owner: "both", week: "2026-09-15", title: "3 posts — theme: meet Abi / why nurse-led", detail: "Your biggest differentiator is Abi as a nurse. Put her on camera — trust converts." },
  { phase: "p1", channel: "social", owner: "both", week: "2026-09-22", title: "3 posts — theme: Bedhampton client love", detail: "Reviews and happy-client stories (with written consent — no before/after without it). Social proof drives bookings." },
  { phase: "p1", channel: "email", owner: "david", week: "2026-09-29", title: "'Last month for the complimentary analysis' heads-up", detail: "Create urgency: the free analysis + 20% off closes 31 Oct. Prompts the fence-sitters to book October." },
  { phase: "p1", channel: "social", owner: "both", week: "2026-09-29", title: "3 posts — theme: Winchester coming soon (teaser)", detail: "Start seeding the Winchester story: the location, the vision, the countdown begins." },

  // ── P2 · OCTOBER — convert + build the launch runway ──────────────────────
  { phase: "p2", channel: "email", owner: "david", week: "2026-10-06", title: "Open Winchester founding-client priority booking", detail: "Invite the 443 + engaged clients to reserve a November slot (small deposit). Founding perks: priority diary, launch pricing. Turns warm leads into booked revenue." },
  { phase: "p2", channel: "social", owner: "both", week: "2026-10-06", title: "3 posts — theme: countdown to Winchester + offer reminder", detail: "Split focus: 'analysis closes soon' at Bedhampton + 'Winchester opening / founding spots' teaser." },
  { phase: "p2", channel: "meta", owner: "david", week: "2026-10-06", title: "Shift Meta toward conversion; keep the Bedhampton offer running", detail: "Move budget toward booked appointments. Keep the free-analysis offer live until 31 Oct." },
  { phase: "p2", channel: "found", owner: "david", week: "2026-10-13", title: "Winchester GBP verified + first post; send the press release", detail: "Once verified, post opening hours + photos. Send a short press release: Hampshire Chronicle, So Hampshire, Winchester BID. David drafts, Abi approves." },
  { phase: "p2", channel: "social", owner: "both", week: "2026-10-13", title: "3 posts — theme: behind-the-scenes Winchester fit-out", detail: "The clinic taking shape is your best content — people love a build. Reels of the space, the sign going up, first-look." },
  { phase: "p2", channel: "email", owner: "david", week: "2026-10-20", title: "'Complimentary analysis closes 31 Oct' — final push", detail: "Last call to the whole list. Book now for the free analysis + 20% off before it's gone." },
  { phase: "p2", channel: "social", owner: "both", week: "2026-10-20", title: "3 posts — theme: testimonials + last-chance offer", detail: "Proof-heavy week. Real results/words (consent) + the closing offer." },
  { phase: "p2", channel: "found", owner: "both", week: "2026-10-20", title: "Finalise launch-week content + Winchester opening offer", detail: "Decide the founding-client launch offer and write/film every launch-week post now, so week 1 is hands-free." },
  { phase: "p2", channel: "social", owner: "both", week: "2026-10-27", title: "3 posts — launch countdown (days to go)", detail: "Daily-style countdown into opening. Build anticipation; push founding bookings." },
  { phase: "p2", channel: "found", owner: "david", week: "2026-10-27", title: "Pre-schedule ALL launch-week posts + the launch email", detail: "Load opening posts, stories and the launch email/SMS now so launch week runs itself while you're on the floor." },
  { phase: "p2", channel: "meta", owner: "david", week: "2026-10-27", title: "Build Winchester launch campaigns (Meta + Google), ready to switch on 2 Nov", detail: "Conversion/booking objective, Winchester + travel radius. Staged and paused, ready to go live opening day." },

  // ── P3 · LAUNCH WEEK (opens Mon 2 Nov) ────────────────────────────────────
  { phase: "p3", channel: "found", owner: "both", week: "2026-11-02", title: "Soft launch — founding clients, friends & family first (30 Oct-1 Nov)", detail: "A quiet preview to iron out the flow and generate first reviews/photos before the public open." },
  { phase: "p3", channel: "email", owner: "david", week: "2026-11-02", title: "LAUNCH email + SMS to the 443 + full list: we're open, book now", detail: "The big one. Winchester is open, here's the founding offer, book link front and centre. This is where the pre-built list pays off." },
  { phase: "p3", channel: "social", owner: "abi", week: "2026-11-02", title: "Grand opening Reel + story series", detail: "Abi welcoming people into the Winchester clinic. Face-to-camera, warm, real. Pin it to the grid." },
  { phase: "p3", channel: "meta", owner: "david", week: "2026-11-02", title: "Winchester Meta conversion/booking campaign LIVE", detail: "Switch on the staged launch campaign. Retarget everyone who engaged with the pre-launch content." },
  { phase: "p3", channel: "google", owner: "david", week: "2026-11-02", title: "Winchester Google Search campaign LIVE (full budget)", detail: "Capture high-intent 'aesthetics/skin clinic Winchester' searches from day one." },
  { phase: "p3", channel: "found", owner: "abi", week: "2026-11-02", title: "Ask every launch client for a Google review", detail: "In-clinic, at the end of each appointment. First reviews are the hardest and the most valuable for a brand-new location." },

  // ── P4 · NOVEMBER — fill the diary ────────────────────────────────────────
  { phase: "p4", channel: "social", owner: "both", week: "2026-11-09", title: "3 posts — opening highlights + book CTA", detail: "Show the buzz: opening moments, first clients (consent), the space in action. Every post ends with 'book now'." },
  { phase: "p4", channel: "email", owner: "david", week: "2026-11-09", title: "'We're open' recap + founding-offer reminder", detail: "To anyone who hasn't booked yet: here's what opening week looked like, the offer's still on, grab a slot." },
  { phase: "p4", channel: "found", owner: "both", week: "2026-11-09", title: "Reviews push — target 10 Google reviews in month 1", detail: "Keep the review automation running and ask in person. 10 reviews transforms a new clinic's Maps credibility." },
  { phase: "p4", channel: "social", owner: "both", week: "2026-11-16", title: "3 posts — treatment spotlight + results (consent)", detail: "Feature one treatment in depth. Educational + a real result (with written consent) + CTA." },
  { phase: "p4", channel: "meta", owner: "david", week: "2026-11-16", title: "Retarget website visitors & engagers → booking", detail: "Warm retargeting is your cheapest conversion. Anyone who clicked but didn't book gets a gentle nudge." },
  { phase: "p4", channel: "email", owner: "david", week: "2026-11-16", title: "Turn on rebooking + referral automation", detail: "After each treatment: auto rebooking prompt + 'refer a friend' offer. Turns one visit into a habit and a referral." },
  { phase: "p4", channel: "social", owner: "both", week: "2026-11-23", title: "3 posts — memberships / packages", detail: "Introduce a simple membership or course-of-treatment package for predictable repeat revenue." },
  { phase: "p4", channel: "email", owner: "david", week: "2026-11-23", title: "Black Friday / gifting teaser (skincare + vouchers)", detail: "Warm the list for December: teaser on gift vouchers and skincare offers coming." },
  { phase: "p4", channel: "social", owner: "both", week: "2026-11-30", title: "3 posts — Christmas gifting kick-off", detail: "'Give the gift of great skin' — vouchers + skincare. Gifting is huge for aesthetics in December." },

  // ── P5 · DECEMBER — Christmas retail + retain ─────────────────────────────
  { phase: "p5", channel: "email", owner: "david", week: "2026-12-07", title: "Christmas gift vouchers + skincare gifting campaign launch", detail: "The big December revenue lever. Vouchers (no capacity limit) + skincare bundles. Make buying effortless." },
  { phase: "p5", channel: "social", owner: "both", week: "2026-12-07", title: "3 posts — gift ideas / voucher CTA", detail: "Gift-guide style posts. Every post links to buy a voucher or shop skincare." },
  { phase: "p5", channel: "meta", owner: "david", week: "2026-12-07", title: "Gift-voucher + skincare retail campaigns (Meta + Google)", detail: "Low-friction 'buy a voucher' conversion ads to warm audiences + local intent." },
  { phase: "p5", channel: "social", owner: "both", week: "2026-12-14", title: "3 posts — 'order by X for Christmas' retail push", detail: "Urgency on last order/collection dates. Push vouchers as the easy last-minute gift." },
  { phase: "p5", channel: "email", owner: "david", week: "2026-12-14", title: "Last-order dates + book-your-January reminder", detail: "Two jobs: close Christmas sales + start filling January (traditionally strong for aesthetics)." },
  { phase: "p5", channel: "social", owner: "both", week: "2026-12-21", title: "2 posts — festive thank-you + January pre-sell", detail: "Ease off over the holidays. A warm thank-you to founding clients + a nudge toward January." },
  { phase: "p5", channel: "email", owner: "david", week: "2026-12-21", title: "'New year, new skin' January pre-sell to the full list", detail: "Get January booked before the year ends. A simple new-year offer or skin-goal consultation." },
  { phase: "p5", channel: "found", owner: "both", week: "2026-12-21", title: "Year-end review: what worked, double down", detail: "Look at cost per booking by channel, which posts landed, which offers converted. Kill what didn't, scale what did — into January." },
];

const SEED_ITEMS = P.map((s, i) => ({
  category: s.phase,
  title: s.title,
  detail: s.detail,
  channel: s.channel,
  owner: s.owner,
  weekStart: s.week,
  sortOrder: (i + 1) * 10,
  dueWeeksBeforeOpen: null as number | null,
}));

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
      status: "not_started",
      dueWeeksBeforeOpen: s.dueWeeksBeforeOpen,
      notes: "",
      sortOrder: s.sortOrder,
    }))
  ).returning();
  return seeded.sort((a, b) => a.sortOrder - b.sortOrder);
}

// GET all items + waitlist count (auto-seeds if empty; auto-upgrades the old plan)
router.get("/projects/:projectId/marketing", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  let items = await db.select().from(marketingItemsTable)
    .where(eq(marketingItemsTable.projectId, projectId))
    .orderBy(asc(marketingItemsTable.sortOrder));

  // Reseed when empty, or when the stored rows predate the remodel (no channel set).
  const isOldPlan = items.length > 0 && items.every(i => !(i as any).channel);
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
