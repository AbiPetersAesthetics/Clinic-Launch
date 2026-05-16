import { Router } from "express";
import { db } from "@workspace/db";
import { marketingItemsTable, projectsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

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

// POST AI complete — generates tailored notes (and optional status nudge) for every item in a tab
router.post("/projects/:projectId/marketing/ai-complete", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { category } = req.body as { category: string };

  if (!["brand", "platform", "content", "launch"].includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const items = await db
    .select()
    .from(marketingItemsTable)
    .where(and(eq(marketingItemsTable.projectId, projectId), eq(marketingItemsTable.category, category)))
    .orderBy(asc(marketingItemsTable.sortOrder));

  const applicable = items.filter(i => !i.title.startsWith("⚠"));

  // Fetch opening date from project
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const openingDateStr: string = (project as any)?.targetOpeningDate ?? "2026-11-01";
  const openDate = new Date(openingDateStr + "T12:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const wBefore = (n: number) => fmt(new Date(openDate.getTime() - n * 7 * 86400000));

  const dateTimeline = `PLANNED OPENING DATE: ${fmt(openDate)}
Pre-launch calendar (calculated from opening date):
  • 16 weeks before opening: ${wBefore(16)} — brand brief / logo commission
  • 14 weeks before opening: ${wBefore(14)} — brand colours & fonts locked
  • 12 weeks before opening: ${wBefore(12)} — ALL brand assets approved; photography complete; content calendar starts
  • 10 weeks before opening: ${wBefore(10)} — Google Business Profile created & submitted for verification; Instagram live
  • 8 weeks before opening:  ${wBefore(8)}  — website live; Fresha fully bookable; GBP verified
  • 6 weeks before opening:  ${wBefore(6)}  — email list & welcome sequence live; social proof content published
  • 4 weeks before opening:  ${wBefore(4)}  — waitlist CTA live; opening announcement; Google Ads drafted
  • 2 weeks before opening:  ${wBefore(2)}  — all logistics confirmed; countdown content scheduled
  • 1 week before opening:   ${wBefore(1)}  — soft launch (friends, family, Bedhampton regulars — invite only)
  • Opening day:             ${fmt(openDate)}

For EVERY item's notes, include the specific recommended completion date from the above timeline.`;

  const categoryContext: Record<string, string> = {
    brand: `Brand Setup tab — these are the identity and asset tasks Abi needs to complete before any platforms or marketing go live.
Help Abi by writing specific, actionable notes for each task based on her context:
- Clinic name is "Abi Peters Aesthetics" (APA)
- Premium, nurse-led aesthetics — clinical yet warm and approachable
- Located at 9A Jewry Street, Winchester, Hampshire SO23 8RZ
- Target clients: affluent Winchester women aged 30–55, ABC1 demographic
- Treatments: injectables (Botox, fillers), advanced skin treatments, medical skincare retail
- Brand tone should feel: premium, trustworthy, clinical-chic — think Trinny London or Medik8 meets local warmth
- Domain options to consider: abiapetersaesthetics.co.uk, apaesthetics.co.uk, abiaestetica.co.uk
For photography: Winchester city centre backdrops, clean clinical setting at 9A Jewry Street, natural light.
For price list: Winchester market rates — competitor analysis suggests Botox £180–£220/area, fillers £280–£380/ml.`,

    platform: `Platform Setup tab — these are the digital channels Abi needs to configure before launch.
Help Abi by writing specific, setup-ready notes for each platform task:
- Business address: 9A Jewry Street, Winchester, Hampshire SO23 8RZ
- Business name: Abi Peters Aesthetics
- Category: Medical aesthetics / Skin clinic
- Instagram handle to use: @abiapetersaesthetics (check availability first; fallback: @abi.peters.aesthetics)
- For Google Business Profile: category = "Medical Spa" or "Skin Care Clinic"; phone, opening hours (Tue–Sat 9–5 suggested), booking link
- Fresha listing: add all treatments with prices, enable instant booking, link to Instagram
- Website domain: abiapetersaesthetics.co.uk — hosted on Squarespace, Wix or WordPress; booking via Fresha embed
- SEO keywords: "aesthetics clinic Winchester", "botox Winchester", "lip filler Winchester Hampshire", "medical aesthetics SO23"
- Mailchimp welcome sequence: Email 1 = welcome + meet Abi; Email 2 = what to expect at your first appointment; Email 3 = opening offer reveal
- Meta Ads: target Winchester + 15-mile radius, women 28–55, interests: beauty, skincare, wellness`,

    content: `Content Calendar tab — these are the 12-week pre-launch content phases leading up to the November 2026 opening.
Help Abi by writing specific, ready-to-brief notes for each content phase:
- Opening date: 1 November 2026
- Platform: primarily Instagram + Facebook Reels; cross-post to Google Business Profile
- Voice: expert but approachable, warm, educational — "your knowledgeable friend who happens to be a nurse"
- Winchester audience: local pride matters — reference Winchester Cathedral, the high street, Hampshire countryside
- Compliance: no before/after photos without separate written consent; no "guaranteed results" language (ASA/CAP guidelines)
Include suggested post ideas, caption hooks, hashtags, and content types (Reel / static / carousel) for each phase.
Key hashtags: #WinchesterAesthetics #AbiPetersAesthetics #HampshireAesthetics #WinchesterBeauty #MedicalAesthetics`,

    launch: `Launch Week tab — these are the final logistics to confirm for the opening of the clinic.
Help Abi by writing specific, contact-ready notes for each launch task:
- Soft launch: suggest 25–29 October 2026, invite-only for friends, family, Bedhampton regulars, and local contacts
- Grand opening: 1 November 2026
- Hampshire press contacts: Hampshire Chronicle, Winchester BID, So Hampshire Magazine, About My Area Winchester
- Local micro-influencers: search Instagram for #WinchesterBeauty, #HampshireLifestyle — look for 2–10k follower accounts with high engagement
- Gifted treatment: offer a complimentary treatment in exchange for an honest Instagram post/Reel (no endorsement required — just an experience share); get this agreed in writing
- Opening offer: suggested "Introductory Offer — £150 off your first treatment package (min £350 spend), first 30 clients only — closes 30 November 2026"
- Photographer: search Hampshire Wedding & Portrait Photographers Association; day rate £400–£600; brief them on: clean clinical shots, hero treatment shots, practitioner headshots
- Waitlist email: subject line ideas, content structure, booking link CTA`,
  };

  const itemList = applicable.map(i => `ID:${i.id} | "${i.title}"`).join("\n");

  const prompt = `You are a marketing specialist helping set up Abi Peters Aesthetics, a premium nurse-led aesthetics clinic opening at 9A Jewry Street, Winchester, Hampshire on 1 November 2026.

${dateTimeline}

${categoryContext[category]}

Here are the ${category} checklist items that need notes. For each item, write practical, specific, APA-tailored notes (2–6 sentences each) that give Abi a concrete head start — specific supplier names, wording suggestions, contact types, or next actions where relevant.

Start every note with "📅 Target: [specific date from the timeline above]" so Abi knows exactly when each task needs to be done.

Also suggest a status: use "in_progress" only if it would make sense for Abi to start this immediately (i.e. the deadline is within the next 4 weeks); otherwise use "not_started". Never use "done".

Items:
${itemList}

Respond with a JSON object in this exact shape:
{
  "updates": [
    { "id": <number>, "notes": "<string>", "status": "not_started" | "in_progress" }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4000,
  });

  const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
    updates?: Array<{ id: number; notes: string; status?: string }>;
  };

  const updates = (raw.updates ?? []).filter(u => applicable.some(i => i.id === u.id));

  // Persist all updates
  await Promise.all(
    updates.map(u =>
      db
        .update(marketingItemsTable)
        .set({
          notes: u.notes ?? "",
          status: (u.status === "in_progress" ? "in_progress" : undefined) as any,
          updatedAt: new Date(),
        })
        .where(eq(marketingItemsTable.id, u.id))
    )
  );

  return res.json({ updates });
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
