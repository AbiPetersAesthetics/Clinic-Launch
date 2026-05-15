import { Router } from "express";
import { db, competitorsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── GET competitors (optionally filter by propertyId) ────────────────────────
router.get("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;

  const where = propertyId
    ? and(eq(competitorsTable.projectId, projectId), eq(competitorsTable.propertyId, propertyId))
    : eq(competitorsTable.projectId, projectId);

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(where)
    .orderBy(competitorsTable.createdAt);
  return res.json({ competitors });
});

// ── GET competition summary (for dashboard) ──────────────────────────────────
router.get("/projects/:id/competition-summary", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;

  const where = propertyId
    ? and(eq(competitorsTable.projectId, projectId), eq(competitorsTable.propertyId, propertyId))
    : eq(competitorsTable.projectId, projectId);

  const competitors = await db.select().from(competitorsTable).where(where);

  if (competitors.length === 0) return res.json({ hasData: false, competitorCount: 0 });

  const scored = competitors.map(c => {
    const dist = parseFloat(c.distanceMiles || "5") || 5;
    const proxScore = dist <= 0.5 ? 88 : dist <= 1 ? 76 : dist <= 2 ? 62 : dist <= 3 ? 48 : 32;
    const rating = parseFloat(c.googleRating || "0") || 0;
    const reviewScore = Math.min((rating / 5) * 60 + Math.min((c.googleReviewCount || 0) / 300, 1) * 40, 100);
    const score = Math.round(proxScore * 0.15 + (c.clinicalAuthorityScore || 50) * 0.15 + reviewScore * 0.15 + (c.brandStrengthScore || 50) * 0.15 + (c.premisesStrengthScore || 50) * 0.10 + Math.min((c.instagramFollowers || 0) / 5000, 1) * 100 * 0.05 + 50 * 0.25);
    return { ...c, threatScore: score };
  }).sort((a, b) => b.threatScore - a.threatScore);

  const highThreatCount = scored.filter(c => c.threatScore >= 68).length;
  const topThreat = scored[0];
  const nurseLedIP = competitors.filter(c => c.clinicType === "nurse-led" && c.independentPrescriber).length;
  const saturation = nurseLedIP / Math.max(competitors.length, 1);
  const marketSpaceScore = Math.round(Math.max(25, Math.min(90, (1 - saturation * 0.6) * 75 + 15)));
  const ratedComps = competitors.filter(c => parseFloat(c.googleRating || "0") > 0);
  const avgCompRating = ratedComps.length ? Math.round((ratedComps.reduce((s, c) => s + parseFloat(c.googleRating || "0"), 0) / ratedComps.length) * 10) / 10 : null;

  return res.json({
    hasData: true,
    competitorCount: competitors.length,
    highThreatCount,
    topThreat: topThreat ? { name: topThreat.name, score: topThreat.threatScore, clinicType: topThreat.clinicType, distanceMiles: topThreat.distanceMiles } : null,
    marketSpaceScore,
    avgCompRating,
  });
});

// ── POST create competitor ───────────────────────────────────────────────────
router.post("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const [created] = await db
    .insert(competitorsTable)
    .values({ ...req.body, projectId, updatedAt: new Date() })
    .returning();
  return res.json({ competitor: created });
});

// ── PUT update competitor ────────────────────────────────────────────────────
router.put("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  const [updated] = await db
    .update(competitorsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)))
    .returning();
  return res.json({ competitor: updated });
});

// ── DELETE competitor ────────────────────────────────────────────────────────
router.delete("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  await db
    .delete(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));
  return res.json({ ok: true });
});

// ── POST AI competitor search ────────────────────────────────────────────────
router.post("/projects/:id/competitors/ai-search", async (req, res) => {
  const { location = "9A Jewry Street, Winchester, Hampshire, UK", radiusMiles = 5 } = req.body;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: `You are a neutral, independent market intelligence analyst. You have no affiliation with any clinic, brand, or business. Your sole job is to provide objective, honest competitor intelligence to help a business owner understand the real competitive landscape before launching. You must not downplay, soften, or overlook genuine threats. You must not favour any particular clinic or assume any clinic has advantages it has not clearly demonstrated. If a competitor is a serious threat — say so clearly. If you genuinely don't know about specific businesses in this area, be honest about that limitation rather than fabricating data.`,
      },
      {
        role: "user",
        content: `Search your knowledge for all aesthetics clinics, nurse injectors, medical aesthetics practitioners, skin clinics, laser clinics, beauty salons offering injectables, dental clinics offering aesthetics, and home-based injectors operating within approximately ${radiusMiles} miles of ${location}.

Return a JSON object:
{
  "competitors": [
    {
      "name": "clinic or practitioner name",
      "address": "full address if known, else 'Address not confirmed'",
      "distanceMiles": "estimated distance as string e.g. '0.4'",
      "website": "URL if known, else ''",
      "clinicType": "one of: nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
      "premisesType": "one of: high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
      "positioningCategory": "one of: luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
      "estimatedThreatScore": integer 0-100,
      "threatReason": "honest 1-2 sentence objective assessment of the competitive threat they pose — do not soften this",
      "heroTreatments": "main treatments comma-separated",
      "saveFace": false,
      "independentPrescriber": false,
      "instagramFollowers": 0,
      "googleRating": "",
      "googleReviewCount": 0,
      "confidenceLevel": "Likely | Unclear | Not found",
      "importantNote": "key caveat about this entry — e.g. data from training set, should be independently verified",
      "treatmentFocus": "injectables | laser/skin | full-service | skincare"
    }
  ],
  "marketNote": "1-2 honest sentences about overall competition intensity in this area — do not be optimistic unless the data warrants it",
  "dataWarning": "brief note about the limitations of AI-generated competitor data"
}

Rank by estimatedThreatScore highest first. Include ALL types of competition — chains, dental clinics, well-reviewed local clinics, and home-based injectors are all genuine competition. Do not exclude competitors because they are 'different' in positioning.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content || "{}";
  let result: { competitors?: unknown[]; marketNote?: string; dataWarning?: string } = {};
  try { result = JSON.parse(raw); } catch { result = {}; }

  const sorted = ((result.competitors || []) as Record<string, unknown>[])
    .sort((a, b) => ((b.estimatedThreatScore as number) || 0) - ((a.estimatedThreatScore as number) || 0));

  return res.json({
    competitors: sorted,
    marketNote: result.marketNote || "",
    dataWarning: result.dataWarning || "",
    disclaimer: "This list is generated from AI training data and may be incomplete, outdated, or contain inaccuracies. It is a starting point for research only — every entry must be independently verified before making any business decision. This is not a live internet search.",
    generatedAt: new Date().toISOString(),
    location,
    radiusMiles,
  });
});

export default router;
