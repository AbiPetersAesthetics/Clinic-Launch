import { Router } from "express";
import { db, competitorsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function fetchPage(url: string, timeoutMs = 9000): Promise<{ html: string; ok: boolean }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(t);
    if (!resp.ok) return { html: "", ok: false };
    const html = await resp.text();
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

function extractText(html: string, maxLen = 3500): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function extractMeta(html: string): string {
  return (html.match(/<meta[^>]+>/gi) || [])
    .filter(m => /name="(description|keywords|title)"|property="og:|twitter:/i.test(m))
    .map(m => {
      const content = m.match(/content="([^"]+)"/)?.[1] || m.match(/content='([^']+)'/)?.[1] || "";
      const name = m.match(/(?:name|property)="([^"]+)"/)?.[1] || "";
      return `${name}: ${content}`;
    }).join("\n").slice(0, 1500);
}

function extractJsonLd(html: string): string {
  return (html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [])
    .map(m => m.replace(/<[^>]+>/g, "")).join("\n").slice(0, 3000);
}

function getTitle(html: string): string {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
}

// Serialise JSON fields for DB storage
function serialiseFields(data: Record<string, unknown>): Record<string, unknown> {
  for (const f of ["treatmentsJson", "strengthsJson", "weaknessesJson", "commonPraiseJson", "commonComplaintsJson"]) {
    if (Array.isArray(data[f])) data[f] = JSON.stringify(data[f]);
    else if (typeof data[f] !== "string") data[f] = "[]";
  }
  if (data.pricingJson && typeof data.pricingJson === "object" && !Array.isArray(data.pricingJson)) {
    data.pricingJson = JSON.stringify(data.pricingJson);
  } else if (typeof data.pricingJson !== "string") {
    data.pricingJson = "{}";
  }
  return data;
}

// Core lookup logic — used by both /lookup and /enrich
async function runLookup(url: string): Promise<{ data: Record<string, unknown>; sources: string[]; igFollowers: number; googleRating: string; googleReviewCount: number }> {
  const sources: string[] = [];

  // Detect Instagram
  let isInstagram = false;
  let igHandle = "";
  const igUrlMatch = url.match(/instagram\.com\/([^/?&#\s]+)/);
  if (igUrlMatch) {
    isInstagram = true;
    igHandle = igUrlMatch[1];
    url = `https://www.instagram.com/${igHandle}/`;
  }

  // ── Phase 1: Fetch main page ─────────────────────────────────────────────
  const mainResult = await fetchPage(url, 12000);
  if (!mainResult.ok || !mainResult.html) {
    throw new Error("Could not reach that page. Check the URL and try again.");
  }
  const mainHtml = mainResult.html;
  sources.push(url);

  // ── Phase 2: Discover sub-pages & Instagram in parallel ──────────────────
  let subPageHrefs: string[] = [];
  let baseUrl = "";

  try {
    baseUrl = new URL(url).origin;
    const subPagePattern = /\/(about|treatments?|services?|pric(e|ing|elist)|menu|treatment-menu|what-we-do|our-treatments|injectables|fillers?|book|contact|clinic)/i;
    const seen = new Set<string>();
    subPageHrefs = [...mainHtml.matchAll(/href="([^"#?]+)"/g)]
      .map(m => m[1])
      .filter(h => h.startsWith("/") && subPagePattern.test(h) && !seen.has(h) && seen.add(h) !== undefined)
      .slice(0, 4);
  } catch { /* ignore URL parse errors */ }

  // Find Instagram handle in main page HTML (if not already Instagram)
  if (!isInstagram) {
    const igPageMatch = mainHtml.match(/instagram\.com\/([^/?&#"'\s\\]+)/i);
    if (igPageMatch && !["p", "explore", "reel", "stories"].includes(igPageMatch[1])) {
      igHandle = igPageMatch[1];
    }
  }

  // Fetch sub-pages and Instagram page in parallel
  const subFetches = subPageHrefs.slice(0, 3).map(h => fetchPage(`${baseUrl}${h}`, 7000));
  const igFetch = igHandle ? fetchPage(`https://www.instagram.com/${igHandle}/`, 8000) : Promise.resolve({ html: "", ok: false });

  const [subResults, igPageResult] = await Promise.all([
    Promise.allSettled(subFetches),
    igFetch,
  ]);

  // ── Phase 3: Extract Instagram followers from og:description ─────────────
  let igFollowers = 0;
  const igHtml = isInstagram ? mainHtml : (igPageResult.ok ? igPageResult.html : "");
  if (igHtml) {
    // Instagram og:description: "1,234 Followers, 567 Following, 89 Posts..."
    const igDesc = igHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1]
      || igHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i)?.[1]
      || "";
    const followMatch = igDesc.match(/([\d,.]+[kKmM]?)\s*Followers/i);
    if (followMatch) {
      const raw = followMatch[1].replace(/,/g, "");
      if (raw.match(/[kK]$/)) igFollowers = Math.round(parseFloat(raw) * 1000);
      else if (raw.match(/[mM]$/)) igFollowers = Math.round(parseFloat(raw) * 1_000_000);
      else igFollowers = parseInt(raw) || 0;
    }
    // Also try from JSON embedded in page
    if (!igFollowers) {
      const edgeMatch = igHtml.match(/"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)\}/);
      if (edgeMatch) igFollowers = parseInt(edgeMatch[1]);
    }
    if (igHandle && igPageResult.ok) sources.push(`https://www.instagram.com/${igHandle}/`);
  }

  // ── Phase 4: Try Google search for reviews ───────────────────────────────
  let googleRating = "";
  let googleReviewCount = 0;
  try {
    // Extract business name from JSON-LD or title
    const ldNameMatch = extractJsonLd(mainHtml).match(/"name"\s*:\s*"([^"]+)"/);
    const candidateName = ldNameMatch?.[1] || getTitle(mainHtml).split(/[-|·]/)[0].trim();

    if (candidateName) {
      const q = encodeURIComponent(`${candidateName} aesthetics Winchester reviews`);
      const googleResult = await fetchPage(`https://www.google.com/search?q=${q}&hl=en-GB`, 7000);
      if (googleResult.ok) {
        const gh = googleResult.html;

        // JSON-LD aggregateRating
        const ratingMatch = gh.match(/"ratingValue"\s*:\s*"?(\d+\.?\d*)"?/)
          || gh.match(/(\d\.\d)\s*(?:out of 5|stars?|★)/i);
        const countMatch = gh.match(/"reviewCount"\s*:\s*"?(\d[\d,]*)"?/)
          || gh.match(/"ratingCount"\s*:\s*"?(\d[\d,]*)"?/)
          || gh.match(/([\d,]+)\s+Google\s+reviews?/i)
          || gh.match(/([\d,]+)\s+reviews?/i);

        if (ratingMatch) googleRating = ratingMatch[1];
        if (countMatch) googleReviewCount = parseInt(countMatch[1].replace(/,/g, ""));

        // Also try extracting from data-attrid="kc:/collection/knowledge_panels/has_feature_interest:rating"
        const structuredRating = gh.match(/aria-label="Rated (\d\.?\d?) out of 5[^"]*,\s*([\d,]+) reviews?"/i);
        if (structuredRating) {
          googleRating = structuredRating[1];
          googleReviewCount = parseInt(structuredRating[2].replace(/,/g, ""));
        }
      }
    }
  } catch { /* Google search is non-fatal */ }

  // ── Phase 5: Assemble combined page text ─────────────────────────────────
  const allTexts: string[] = [];

  const mainTitle = getTitle(mainHtml);
  const mainMeta = extractMeta(mainHtml);
  const mainJsonLd = extractJsonLd(mainHtml);
  const mainBody = extractText(mainHtml, 3000);
  allTexts.push(`=== MAIN PAGE: ${url} ===\nTITLE: ${mainTitle}\nMETA:\n${mainMeta}\nSTRUCTURED DATA:\n${mainJsonLd}\nBODY:\n${mainBody}`);

  subResults.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.ok && result.value.html) {
      const href = subPageHrefs[i];
      const t = getTitle(result.value.html);
      const body = extractText(result.value.html, 2000);
      const jsonLd = extractJsonLd(result.value.html).slice(0, 800);
      allTexts.push(`=== SUB-PAGE: ${baseUrl}${href} ===\nTITLE: ${t}\nSTRUCTURED DATA:\n${jsonLd}\nBODY:\n${body}`);
      sources.push(`${baseUrl}${href}`);
    }
  });

  if (igFollowers > 0 || igHandle) {
    allTexts.push(`=== INSTAGRAM DATA ===\nHandle: @${igHandle}\nFollowers extracted: ${igFollowers}`);
  }

  const combinedText = allTexts.join("\n\n").slice(0, 16000);

  // ── Phase 6: GPT extraction ───────────────────────────────────────────────
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: `You are a specialist medical aesthetics market intelligence analyst. Extract structured competitor data from multi-source web content. Prioritise JSON-LD structured data, explicit price mentions, and clear factual statements. Do not fabricate. If a field is absent, use the default (empty string, 0, false, or "unknown").`,
      },
      {
        role: "user",
        content: `Extract all competitor intelligence from this multi-source content and return a single JSON object.

${googleRating ? `IMPORTANT — Google rating confirmed from search: ${googleRating} — use this exact value for googleRating field.` : ""}
${googleReviewCount ? `IMPORTANT — Google review count confirmed from search: ${googleReviewCount} — use this exact value for googleReviewCount field.` : ""}
${igFollowers > 0 ? `IMPORTANT — Instagram followers confirmed: ${igFollowers} — use this for instagramFollowers field.` : ""}
${igHandle ? `IMPORTANT — Instagram handle confirmed: @${igHandle} — use this (without @) for instagram field.` : ""}

MULTI-SOURCE CONTENT:
${combinedText}

Return ONLY valid JSON with these fields (use defaults if absent):
{
  "name": "",
  "address": "",
  "phone": "",
  "website": "${isInstagram ? "" : url}",
  "instagram": "${igHandle}",
  "facebook": "",
  "bookingLink": "online booking URL if different from main website, else ''",
  "googleRating": "${googleRating}",
  "googleReviewCount": ${googleReviewCount},
  "instagramFollowers": ${igFollowers},
  "clinicType": "nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
  "premisesType": "high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
  "positioningCategory": "luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
  "targetAudience": "",
  "practitionerType": "",
  "yearsExperience": 0,
  "saveFace": false,
  "jccp": false,
  "independentPrescriber": false,
  "nhsBackground": false,
  "credentialsNotes": "list all qualifications, accreditations, training courses, professional memberships mentioned",
  "heroTreatments": "main featured treatments comma-separated",
  "treatmentsJson": ["use ONLY these keys: antiWrinkle1,antiWrinkle2,antiWrinkle3,fillerLips,fillerCheeks,fillerJaw,fillerNose,fillerHands,skinBooster,prp,mesotherapy,microneedling,chemicalPeel,hydrafacial,ipl,laserHairRemoval,cryolipolysis,hifu,dermaplaning,vitaminDrip,profhilo,polynucleotides,blepharoplasty,threadLift,fatDissolver,skinTag,mole,botulinum"],
  "pricingJson": {"treatmentKey": priceAsInteger — only for explicitly stated prices},
  "postingFrequency": "daily | few-per-week | weekly | few-per-month | monthly | rarely | unknown",
  "contentQualityScore": 3,
  "reviewSentimentSummary": "1-2 sentences summarising review themes if reviews are mentioned",
  "commonPraiseJson": ["themes mentioned as positives in reviews or testimonials"],
  "commonComplaintsJson": ["themes mentioned as negatives or complaints"],
  "strengthsJson": ["visible competitive strengths — be specific"],
  "weaknessesJson": ["apparent weaknesses or gaps — be specific"],
  "notes": "any other useful intelligence",
  "sourceLinks": "${sources.join(", ")}",
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

  // Override with directly-extracted values (don't let GPT hallucinate these)
  if (googleRating) data.googleRating = googleRating;
  if (googleReviewCount) data.googleReviewCount = googleReviewCount;
  if (igFollowers > 0) data.instagramFollowers = igFollowers;
  if (igHandle) data.instagram = igHandle;

  serialiseFields(data);

  return { data, sources, igFollowers, googleRating, googleReviewCount };
}

// ── Property filter helper ─────────────────────────────────────────────────
// When filtering by a property, include competitors tagged to that property
// AND competitors with no property (global/all-property competitors).
function buildWhere(projectId: number, propertyId: number | null) {
  if (propertyId) {
    return and(
      eq(competitorsTable.projectId, projectId),
      or(eq(competitorsTable.propertyId, propertyId), isNull(competitorsTable.propertyId))
    );
  }
  return eq(competitorsTable.projectId, projectId);
}

// ── GET competitors ───────────────────────────────────────────────────────────
router.get("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;
  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(buildWhere(projectId, propertyId))
    .orderBy(competitorsTable.createdAt);
  return res.json({ competitors });
});

// ── GET competition summary ───────────────────────────────────────────────────
router.get("/projects/:id/competition-summary", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;
  const competitors = await db.select().from(competitorsTable).where(buildWhere(projectId, propertyId));

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

// ── POST create competitor ─────────────────────────────────────────────────
router.post("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const [created] = await db
    .insert(competitorsTable)
    .values({ ...req.body, projectId, updatedAt: new Date() })
    .returning();
  return res.json({ competitor: created });
});

// ── PUT update competitor ──────────────────────────────────────────────────
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

// ── DELETE competitor ──────────────────────────────────────────────────────
router.delete("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  await db
    .delete(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));
  return res.json({ ok: true });
});

// ── POST URL / Instagram lookup (for new competitor form) ─────────────────
router.post("/projects/:id/competitors/lookup", async (req, res) => {
  let { url } = req.body as { url: string };
  if (!url?.trim()) return res.status(400).json({ error: "URL required" });

  // Normalise
  const igHandleOnly = url.match(/^@?([\w.]+)$/);
  if (igHandleOnly && !url.includes(".")) {
    url = `https://www.instagram.com/${igHandleOnly[1]}/`;
  } else if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  try {
    const result = await runLookup(url);
    return res.json({
      data: result.data,
      sources: result.sources,
      sourceCount: result.sources.length,
      googleRating: result.googleRating,
      googleReviewCount: result.googleReviewCount,
      igFollowers: result.igFollowers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 200) });
  }
});

// ── POST enrich existing competitor ───────────────────────────────────────
router.post("/projects/:id/competitors/:cid/enrich", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);

  const [existing] = await db
    .select()
    .from(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));

  if (!existing) return res.status(404).json({ error: "Competitor not found" });

  const lookupUrl = existing.website
    || (existing.instagram ? `https://www.instagram.com/${existing.instagram}/` : "");

  if (!lookupUrl) {
    return res.status(400).json({ error: "No website or Instagram stored for this competitor — add one first then enrich." });
  }

  try {
    const result = await runLookup(lookupUrl);
    const enriched = result.data;

    // Only overwrite fields that were actually found (non-empty/non-default)
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(enriched)) {
      if (v !== null && v !== "" && v !== 0 && v !== false && v !== "[]" && v !== "{}" && v !== "unknown" && v !== "Unclear") {
        updates[k] = v;
      }
    }
    updates.lastChecked = new Date().toISOString().split("T")[0];
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(competitorsTable)
      .set(updates)
      .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)))
      .returning();

    return res.json({
      competitor: updated,
      sources: result.sources,
      fieldsUpdated: Object.keys(updates).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 200) });
  }
});

// ── POST AI competitor search ──────────────────────────────────────────────
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
