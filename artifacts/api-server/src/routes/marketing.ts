import { Router } from "express";
import { db } from "@workspace/db";
import { marketingItemsTable, projectsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

const SEED_ITEMS: Array<{
  category: string;
  title: string;
  sortOrder: number;
  dueWeeksBeforeOpen?: number;
}> = [
  // ── Brand Setup ──────────────────────────────────────────────────────────
  { category: "brand", title: "Logo finalised (JPEG, PNG & SVG versions)", sortOrder: 10 },
  { category: "brand", title: "Brand colour palette locked", sortOrder: 20 },
  { category: "brand", title: "Brand fonts selected and licensed", sortOrder: 30 },
  { category: "brand", title: "Photography session — booked", sortOrder: 40 },
  { category: "brand", title: "Photography session — completed", sortOrder: 50 },
  { category: "brand", title: "Price list finalised and designed", sortOrder: 60 },
  { category: "brand", title: "Treatment menu finalised", sortOrder: 70 },
  { category: "brand", title: "Consent form templates ready", sortOrder: 80 },
  { category: "brand", title: "Clinic name & domain name confirmed", sortOrder: 90 },
  { category: "brand", title: "Business cards & stationery ordered", sortOrder: 100 },

  // ── Platform Setup ───────────────────────────────────────────────────────
  { category: "platform", title: "Google Business Profile — created", sortOrder: 10 },
  { category: "platform", title: "Google Business Profile — verified (allow 5–14 days)", sortOrder: 20 },
  { category: "platform", title: "Google Business Profile — opening hours, photos & first post live", sortOrder: 30 },
  { category: "platform", title: "Instagram — handle, bio & highlight covers set", sortOrder: 40 },
  { category: "platform", title: "Instagram — link in bio set (booking URL or landing page)", sortOrder: 50 },
  { category: "platform", title: "Instagram — 9-post grid planned and ready for launch day", sortOrder: 60 },
  { category: "platform", title: "Facebook — business page created and optimised", sortOrder: 70 },
  { category: "platform", title: "Fresha listing — clinic profile created", sortOrder: 80 },
  { category: "platform", title: "Fresha listing — services, prices & online booking enabled", sortOrder: 90 },
  { category: "platform", title: "Website / landing page — live with custom domain", sortOrder: 100 },
  { category: "platform", title: "Website — SEO title, meta description & Google Search Console set up", sortOrder: 110 },
  { category: "platform", title: "Mailchimp / email list — account set up & sign-up form live", sortOrder: 120 },
  { category: "platform", title: "Mailchimp — welcome email sequence drafted (minimum 3 emails)", sortOrder: 130 },
  { category: "platform", title: "Google Ads — account created, search campaign drafted", sortOrder: 140 },
  { category: "platform", title: "Canva Pro / design tool — brand kit set up with logo, colours & fonts", sortOrder: 150 },

  // ── Content Calendar ─────────────────────────────────────────────────────
  { category: "content", title: "Week –12: Brand reveal teaser + introducing the practitioner", dueWeeksBeforeOpen: -12, sortOrder: 10 },
  { category: "content", title: "Week –10: Treatment education series begins (one treatment per post)", dueWeeksBeforeOpen: -10, sortOrder: 20 },
  { category: "content", title: "Week –8: Behind the scenes — fit-out, build & clinic taking shape", dueWeeksBeforeOpen: -8, sortOrder: 30 },
  { category: "content", title: "Week –6: Social proof — testimonials from Bedhampton clients (consent required)", dueWeeksBeforeOpen: -6, sortOrder: 40 },
  { category: "content", title: "Week –4: Pre-launch waitlist CTA + opening date announcement", dueWeeksBeforeOpen: -4, sortOrder: 50 },
  { category: "content", title: "Week –2: Countdown content — 14 days to go, final previews & anticipation", dueWeeksBeforeOpen: -2, sortOrder: 60 },
  { category: "content", title: "Launch week: Grand opening post, story series, first booking celebrations", dueWeeksBeforeOpen: 0, sortOrder: 70 },
  { category: "content", title: "⚠ Compliance reminder: no before/after client photos without separate written consent", sortOrder: 80 },

  // ── Launch Week ──────────────────────────────────────────────────────────
  { category: "launch", title: "Soft launch date set (invite-only — friends, family & Bedhampton regulars)", sortOrder: 10 },
  { category: "launch", title: "Grand opening date confirmed and announced publicly", sortOrder: 20 },
  { category: "launch", title: "PR press release drafted and sent to local Hampshire press", sortOrder: 30 },
  { category: "launch", title: "Photographer / videographer booked for opening day", sortOrder: 40 },
  { category: "launch", title: "Local micro-influencers identified (3–5 in Hampshire aesthetic space)", sortOrder: 50 },
  { category: "launch", title: "Influencer gifted treatment arranged and pre-launch content agreed", sortOrder: 60 },
  { category: "launch", title: "Google Ads campaigns set to go-live on opening date", sortOrder: 70 },
  { category: "launch", title: "Opening offer confirmed (e.g. 20% off first booking, limited to first 30 clients)", sortOrder: 80 },
  { category: "launch", title: "Waitlist email campaign drafted — opening announcement + direct booking link", sortOrder: 90 },
  { category: "launch", title: "Friends & family preview event run", sortOrder: 100 },
  { category: "launch", title: "Launch week content pre-scheduled (all posts loaded in advance)", sortOrder: 110 },
  { category: "launch", title: "Post-launch review booked (2 weeks after opening — what worked, what to double down on)", sortOrder: 120 },
];

// GET all items + waitlist count (auto-seeds if empty)
router.get("/projects/:projectId/marketing", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  let items = await db.select().from(marketingItemsTable)
    .where(eq(marketingItemsTable.projectId, projectId))
    .orderBy(asc(marketingItemsTable.category), asc(marketingItemsTable.sortOrder));

  if (items.length === 0) {
    const seeded = await db.insert(marketingItemsTable).values(
      SEED_ITEMS.map(s => ({
        projectId,
        category: s.category,
        title: s.title,
        status: "not_started",
        dueWeeksBeforeOpen: s.dueWeeksBeforeOpen ?? null,
        notes: "",
        sortOrder: s.sortOrder,
      }))
    ).returning();
    items = seeded.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const waitlistCount = (project as any)?.waitlistCount ?? 0;

  return res.json({ items, waitlistCount });
});

// PUT update a single item
router.put("/marketing/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { status, notes } = req.body;
  const [row] = await db.update(marketingItemsTable)
    .set({ status, notes, updatedAt: new Date() })
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
