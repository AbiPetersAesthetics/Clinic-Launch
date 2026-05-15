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

// ── POST URL / Instagram lookup ──────────────────────────────────────────────
router.post("/projects/:id/competitors/lookup", async (req, res) => {
  let { url } = req.body as { url: string };
  if (!url?.trim()) return res.status(400).json({ error: "URL required" });

  // Normalise Instagram handles: @handle, handle, instagram.com/handle
  let isInstagram = false;
  const igHandleOnly = url.match(/^@?([\w.]+)$/);
  if (igHandleOnly && !url.includes(".")) {
    url = `https://www.instagram.com/${igHandleOnly[1]}/`;
    isInstagram = true;
  } else if (url.includes("instagram.com")) {
    const igMatch = url.match(/instagram\.com\/([^/?&#\s]+)/);
    if (igMatch) {
      url = `https://www.instagram.com/${igMatch[1]}/`;
      isInstagram = true;
    }
  } else if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  // Fetch the page
  let pageText = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);
    const html = await resp.text();

    // JSON-LD structured data (businesses often have LocalBusiness schema)
    const jsonLdRaw = (html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [])
      .map(m => m.replace(/<[^>]+>/g, "")).join("\n").slice(0, 3000);

    // Meta tags: description, og:*, twitter:*
    const metaText = (html.match(/<meta[^>]+>/gi) || [])
      .filter(m => /name="(description|keywords|title)"|property="og:|twitter:/i.test(m))
      .map(m => {
        const content = m.match(/content="([^"]+)"/)?.[1] || m.match(/content='([^']+)'/)?.[1] || "";
        const name = m.match(/(?:name|property)="([^"]+)"/)?.[1] || "";
        return `${name}: ${content}`;
      }).join("\n").slice(0, 1500);

    // Title tag
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();

    // Strip all HTML tags for body text
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);

    pageText = `URL: ${url}\nTITLE: ${title}\n\nMETA TAGS:\n${metaText}\n\nSTRUCTURED DATA:\n${jsonLdRaw}\n\nPAGE BODY TEXT:\n${bodyText}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("AbortError")) {
      return res.status(408).json({ error: "Page took too long to respond. Try pasting the website URL directly." });
    }
    return res.status(502).json({ error: `Could not reach that page: ${msg.slice(0, 120)}` });
  }

  // GPT extraction — comprehensive, covering all competitor schema fields
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: `You are a specialist medical aesthetics market intelligence analyst. Your job is to extract structured competitor data from web page content about an aesthetics clinic, nurse injector, skin clinic, or similar business. Extract only what is actually present in the content — do not fabricate or guess values. If a field is genuinely absent, use null, empty string, 0, or false as appropriate.`,
      },
      {
        role: "user",
        content: `Extract all available competitor intelligence from this page and return a single JSON object.

PAGE CONTENT:
${pageText}

Return ONLY valid JSON with these exact fields:
{
  "name": "clinic or practitioner name",
  "address": "full address if present, else ''",
  "phone": "phone number if present, else ''",
  "website": "main website URL, else ''",
  "instagram": "instagram handle WITHOUT @ if found, else ''",
  "facebook": "facebook page URL or name if found, else ''",
  "bookingLink": "online booking URL if different from website, else ''",
  "googleRating": "google rating as string e.g. '4.8' if mentioned, else ''",
  "googleReviewCount": 0,
  "instagramFollowers": 0,
  "clinicType": "nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
  "premisesType": "high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
  "positioningCategory": "luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
  "targetAudience": "",
  "practitionerType": "e.g. Aesthetic Nurse, GP, Dentist, Beauty Therapist — or '' if unclear",
  "yearsExperience": 0,
  "saveFace": false,
  "jccp": false,
  "independentPrescriber": false,
  "nhsBackground": false,
  "credentialsNotes": "any qualifications, accreditations, training mentioned",
  "heroTreatments": "main featured treatments comma-separated",
  "treatmentsJson": ["only keys from this exact list: antiWrinkle1,antiWrinkle2,antiWrinkle3,fillerLips,fillerCheeks,fillerJaw,fillerNose,fillerHands,skinBooster,prp,mesotherapy,microneedling,chemicalPeel,hydrafacial,ipl,laserHairRemoval,cryolipolysis,hifu,dermaplaning,vitaminDrip,profhilo,polynucleotides,blepharoplasty,threadLift,fatDissolver,skinTag,mole,botulinum"],
  "pricingJson": {},
  "postingFrequency": "daily | few-per-week | weekly | few-per-month | monthly | rarely | unknown",
  "contentQualityScore": 3,
  "reviewSentimentSummary": "",
  "commonPraiseJson": [],
  "commonComplaintsJson": [],
  "strengthsJson": [],
  "weaknessesJson": [],
  "notes": "any other useful intelligence not captured above",
  "sourceLinks": "${url}",
  "confidenceLevel": "Verified"
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content || "{}";
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { data = {}; }

  // Serialise array/object fields to JSON strings (DB stores them as text)
  for (const f of ["treatmentsJson", "strengthsJson", "weaknessesJson", "commonPraiseJson", "commonComplaintsJson"]) {
    if (Array.isArray(data[f])) data[f] = JSON.stringify(data[f]);
    else if (typeof data[f] !== "string") data[f] = "[]";
  }
  if (data.pricingJson && typeof data.pricingJson === "object" && !Array.isArray(data.pricingJson)) {
    data.pricingJson = JSON.stringify(data.pricingJson);
  } else if (typeof data.pricingJson !== "string") {
    data.pricingJson = "{}";
  }

  return res.json({ data, url, isInstagram });
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
