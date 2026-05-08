import { Router, type Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import { z } from "zod";
import { db } from "@workspace/db";
import { propertiesTable, propertyAiAnalysesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

// ─── Zod schemas for LLM response validation ─────────────────────────────────

const ExtractionSchema = z.object({
  address: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  sqFootage: z.number().nullable().optional(),
  annualRentGbp: z.number().nullable().optional(),
  monthlyRentGbp: z.number().nullable().optional(),
  vatOnRent: z.boolean().nullable().optional(),
  businessRatesGbp: z.number().nullable().optional(),
  serviceChargeGbp: z.number().nullable().optional(),
  leaseLength: z.string().nullable().optional(),
  useClass: z.string().nullable().optional(),
  availabilityDate: z.string().nullable().optional(),
  parkingSpaces: z.number().nullable().optional(),
  frontageMeters: z.number().nullable().optional(),
  agentName: z.string().nullable().optional(),
  agentPhone: z.string().nullable().optional(),
  agentEmail: z.string().nullable().optional(),
  flags: z.array(z.string()).optional().default([]),
});

const ScoreFactorSchema = z.object({
  name: z.string(),
  score: z.number(),
  maxScore: z.number(),
  weight: z.number(),
  explanation: z.string(),
});

const PropertyScoreSchema = z.object({
  total: z.number(),
  maxTotal: z.number(),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  summary: z.string(),
  factors: z.array(ScoreFactorSchema),
});

const CompetitorItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  distanceMeters: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  reviewCount: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const CompetitionScoringSchema = z.object({
  saturationScore: z.number(),
  opportunityScore: z.number(),
  saturationVerdict: z.string(),
  opportunityVerdict: z.string(),
});

const ExecutiveSummarySchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  risks: z.array(z.string()),
  hiddenOpportunities: z.array(z.string()),
  likelyRevenueCeiling: z.string(),
  launchRecommendations: z.array(z.string()),
  suggestedPositioning: z.string(),
  overallVerdict: z.string(),
});

const AnalysisSchema = z.object({
  locationScore: PropertyScoreSchema,
  commercialViabilityScore: PropertyScoreSchema,
  clinicSuitabilityScore: PropertyScoreSchema,
  competition: CompetitionScoringSchema,
  executiveSummary: ExecutiveSummarySchema,
});

const ADVISOR_ACTIONS = [
  "suggest-offer",
  "identify-risks",
  "recommend-layout",
  "estimate-fitout",
  "estimate-revenue",
  "suggest-clinic-model",
  "suggest-negotiation",
  "suggest-launch",
] as const;

function parseLLMJson(raw: string): unknown {
  const cleaned = raw.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

// ─── Google Places helpers ────────────────────────────────────────────────────

type PlacesCompetitor = z.infer<typeof CompetitorItemSchema>;

async function geocodePostcode(postcode: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postcode + " UK")}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json() as {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };
  if (json.status !== "OK" || !json.results[0]) return null;
  return json.results[0].geometry.location;
}

async function findNearbyCompetitors(lat: number, lng: number, apiKey: string, radiusMeters: number): Promise<PlacesCompetitor[]> {
  const keywords = ["aesthetics clinic", "beauty salon", "medispa", "skin clinic", "cosmetic clinic", "dentist"];
  const seen = new Set<string>();
  const competitors: PlacesCompetitor[] = [];

  for (const keyword of keywords) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;
    const res = await fetch(url);
    const json = await res.json() as {
      status: string;
      results: Array<{
        name: string;
        types: string[];
        rating?: number;
        user_ratings_total?: number;
        geometry: { location: { lat: number; lng: number } };
        business_status?: string;
      }>;
    };
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") continue;
    for (const place of json.results ?? []) {
      if (seen.has(place.name)) continue;
      if (place.business_status === "CLOSED_PERMANENTLY") continue;
      seen.add(place.name);

      const dLat = place.geometry.location.lat - lat;
      const dLng = place.geometry.location.lng - lng;
      const distM = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 111_000);

      const primaryType = place.types.includes("spa") ? "medispa"
        : place.types.includes("beauty_salon") ? "beauty salon"
        : place.types.includes("hair_care") ? "hair salon"
        : "aesthetics clinic";

      competitors.push({
        name: place.name,
        type: primaryType,
        distanceMeters: distM,
        rating: place.rating ?? null,
        reviewCount: place.user_ratings_total ?? null,
        notes: null,
      });
    }
    if (competitors.length >= 10) break;
  }

  return competitors.slice(0, 10).sort((a, b) => (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999));
}

// ─── Manual Competitors CRUD ──────────────────────────────────────────────────

router.put("/properties/:id/competitors", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const body = req.body as unknown;
  if (!Array.isArray(body)) return res.status(400).json({ error: "Expected an array of competitors" });

  const ManualCompetitorSchema = z.object({ name: z.string().min(1), type: z.string().min(1), notes: z.string().nullable().optional() });
  const parsed = z.array(ManualCompetitorSchema).safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid competitor data", details: parsed.error.issues });

  await db.update(propertiesTable)
    .set({ manualCompetitors: parsed.data, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id));

  return res.json(parsed.data);
});

// ─── Document Upload / Extraction (review mode — no auto-save) ────────────────

router.post("/properties/:id/upload-document", upload.single("file"), async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let rawText = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(req.file.buffer);
    rawText = result.text;
  } catch {
    return res.status(400).json({ error: "Could not parse PDF. Please ensure it is a valid PDF document." });
  }

  const prompt = `You are a commercial property data extraction specialist. Extract structured data from this commercial property document. Return ONLY valid JSON.

Document:
${rawText.slice(0, 6000)}

Extract these fields (use null if not found):
address, postcode, sqFootage (number), annualRentGbp (number), monthlyRentGbp (number),
vatOnRent (boolean), businessRatesGbp (number), serviceChargeGbp (number),
leaseLength, useClass, availabilityDate (ISO string or null), parkingSpaces (number),
frontageMeters (number), agentName, agentPhone, agentEmail,
flags (string array — important notes/uncertainties e.g. "VAT status unclear")

Return JSON only, no markdown.`;

  let extraction: z.infer<typeof ExtractionSchema> = { flags: [] };
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseLLMJson(raw);
    const validated = ExtractionSchema.safeParse(parsed);
    extraction = validated.success ? validated.data : { flags: ["AI extraction returned unexpected format — please fill fields manually"] };
  } catch {
    extraction = { flags: ["AI extraction failed — please fill fields manually"] };
  }

  // Return extracted data for user review — do NOT auto-save
  return res.json({
    ...extraction,
    flags: extraction.flags ?? [],
    fileName: req.file.originalname,
    fileSizeBytes: req.file.size,
  });
});

// ─── Confirm Upload (saves reviewed extracted data + stores media file ref) ───

router.post("/properties/:id/confirm-upload", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const { fields, fileName, fileSizeBytes } = req.body as {
    fields: Record<string, unknown>;
    fileName?: string;
    fileSizeBytes?: number;
  };

  const updateData: Record<string, unknown> = {};
  const allowedFields = ["address", "postcode", "sqFootage", "annualRentGbp", "monthlyRentGbp", "vatOnRent", "businessRatesGbp", "serviceChargeGbp", "leaseLength", "useClass", "availabilityDate", "parkingSpaces", "frontageMeters", "agentName", "agentPhone", "agentEmail"];

  for (const field of allowedFields) {
    if (fields[field] !== undefined && fields[field] !== null && fields[field] !== "") {
      updateData[field] = fields[field];
    }
  }

  // Add media file reference
  const existingMedia = Array.isArray(property.mediaFiles) ? property.mediaFiles : [];
  const newMediaFile = {
    id: `pdf_${Date.now()}`,
    name: fileName ?? "brochure.pdf",
    type: "pdf" as const,
    url: `/uploads/${id}/${fileName ?? "document.pdf"}`,
    uploadedAt: new Date().toISOString(),
    sizeBytes: fileSizeBytes ?? null,
  };
  updateData.mediaFiles = [...existingMedia, newMediaFile];

  if (Object.keys(updateData).length > 0) {
    await db.update(propertiesTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(propertiesTable.id, id));
  }

  const [updated] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  return res.json(updated);
});

// ─── URL Import ───────────────────────────────────────────────────────────────

router.post("/projects/:projectId/properties/import-url", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const allowedHosts = ["rightmove.co.uk", "zoopla.co.uk", "novaloca.com", "commercialpeoplelisting.co.uk", "primelocation.com", "onthemarket.com", "costar.com"];
  const hostname = parsedUrl.hostname.replace("www.", "");
  const isKnownSite = allowedHosts.some(h => hostname.includes(h));

  // Attempt to fetch the page
  let pageText = "";
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicLaunchOS/1.0; property data extraction)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(422).json({
        error: `Could not fetch the listing page (HTTP ${response.status}). The site may require login or block automated access.`,
        extractable: false,
      });
    }

    const html = await response.text();
    // Strip HTML tags to get readable text
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("timeout") || msg.includes("AbortError")) {
      return res.status(422).json({
        error: "The listing page took too long to respond. Try copying and pasting the property details manually.",
        extractable: false,
      });
    }
    return res.status(422).json({
      error: isKnownSite
        ? `Could not access ${hostname} — it may require login or block automated requests. Try copying the listing details manually.`
        : "Could not fetch the listing page. Ensure the URL is publicly accessible.",
      extractable: false,
    });
  }

  const prompt = `You are a commercial property data extraction specialist. Extract structured commercial property data from this listing page text. Return ONLY valid JSON.

Source URL: ${url}

Page content:
${pageText}

Extract these fields (use null if not found):
address, postcode, sqFootage (number in sq ft), annualRentGbp (number), monthlyRentGbp (number),
vatOnRent (boolean), businessRatesGbp (number per year), serviceChargeGbp (number per year),
leaseLength (string), useClass (string e.g. "E"), availabilityDate (ISO string or null),
parkingSpaces (number), frontageMeters (number), agentName, agentPhone, agentEmail,
notes (string — any other useful info about the property),
flags (string array — any uncertainties, e.g. "Rent quoted as asking price only", "VAT status not stated")

Return JSON only, no markdown.`;

  let extraction: z.infer<typeof ExtractionSchema> & { notes?: string } = { flags: [] };
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseLLMJson(raw);

    const ExtractWithNotesSchema = ExtractionSchema.extend({ notes: z.string().nullable().optional() });
    const validated = ExtractWithNotesSchema.safeParse(parsed);
    extraction = validated.success ? validated.data : { flags: ["Could not extract property data from this page — please fill fields manually"] };
  } catch {
    extraction = { flags: ["AI extraction failed — please fill fields manually"] };
  }

  return res.json({
    ...extraction,
    sourceUrl: url,
    projectId,
    flags: extraction.flags ?? [],
  });
});

// ─── Analysis History ─────────────────────────────────────────────────────────

router.get("/properties/:id/analyses", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const analyses = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id))
    .orderBy(desc(propertyAiAnalysesTable.version));

  return res.json(analyses);
});

router.get("/properties/:id/analyses/latest", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const [latest] = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id))
    .orderBy(desc(propertyAiAnalysesTable.version))
    .limit(1);

  if (!latest) return res.status(404).json({ error: "No analysis found for this property" });
  return res.json(latest);
});

// ─── Full AI Property Analysis (persisted) ────────────────────────────────────

router.post("/properties/:id/analyse", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const rawRadius = req.body?.searchRadiusMeters;
  const searchRadius = typeof rawRadius === "number" && rawRadius >= 200 && rawRadius <= 2000
    ? rawRadius
    : 600;

  const propertyContext = `Address: ${property.address || "Unknown"}
Postcode: ${property.postcode || "Unknown"}
Square Footage: ${property.sqFootage || "Unknown"} sq ft
Annual Rent: £${property.annualRentGbp || "Unknown"}
Monthly Rent: £${property.monthlyRentGbp || "Unknown"}
VAT on Rent: ${property.vatOnRent ? "Yes" : "No"}
Business Rates: £${property.businessRatesGbp || "Unknown"}/yr
Service Charge: £${property.serviceChargeGbp || "Unknown"}/yr
Lease Length: ${property.leaseLength || "Unknown"}
Use Class: ${property.useClass || "Unknown"}
Availability: ${property.availabilityDate || "Unknown"}
Parking Spaces: ${property.parkingSpaces ?? "Unknown"}
Frontage: ${property.frontageMeters || "Unknown"}m
Notes: ${property.notes || "None"}`;

  // ── Competition: Google Places → manual entries → empty (no LLM fabrication) ──
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  let realCompetitors: PlacesCompetitor[] | null = null;
  let competitionDataSource: "google_places" | "manual" | "ai_estimate" = "ai_estimate";

  if (placesApiKey && property.postcode) {
    try {
      const coords = await geocodePostcode(property.postcode, placesApiKey);
      if (coords) {
        realCompetitors = await findNearbyCompetitors(coords.lat, coords.lng, placesApiKey, searchRadius);
        competitionDataSource = "google_places";
      }
    } catch {
      // Fall through — will use manual competitors or empty list
    }
  }

  const manualCompetitorsList = Array.isArray(property.manualCompetitors) ? property.manualCompetitors : [];

  if (manualCompetitorsList.length > 0 && realCompetitors === null) {
    competitionDataSource = "manual";
  }

  const competitorContext = realCompetitors !== null
    ? `Real competitor data from Google Places (within ${searchRadius}m of ${property.postcode}):
${JSON.stringify(realCompetitors, null, 2)}
Score saturation/opportunity based on this real data. Return the competitors array exactly as given above.`
    : manualCompetitorsList.length > 0
      ? `Manually-entered nearby competitors provided by the user:
${JSON.stringify(manualCompetitorsList, null, 2)}
Score saturation/opportunity based on this known competitor list. Return the competitors array exactly as given above (add distanceMeters: null, rating: null, reviewCount: null for each).`
      : `No competitor data available. Score saturation and opportunity based on your knowledge of ${property.postcode || property.address || "this area"} and typical UK aesthetics market density. Return an EMPTY competitors array — do not fabricate competitor names.`;

  const analysisPrompt = `You are a senior commercial property consultant specialising in aesthetics clinic acquisitions in the UK. Analyse this property for use as a premium aesthetics clinic.

Property:
${propertyContext}

Competition context:
${competitorContext}

Return a JSON object with this exact structure (no markdown):
{
  "locationScore": {
    "total": <0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<sentence>",
    "factors": [
      {"name": "Affluence & Demographics", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Footfall & Visibility", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Parking & Accessibility", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"},
      {"name": "Female Demographic Concentration", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"},
      {"name": "Transport Links", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"},
      {"name": "Proximity to Premium Retail", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"},
      {"name": "Local Spending Power", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Growth Area Potential", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"}
    ]
  },
  "commercialViabilityScore": {
    "total": <0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<sentence>",
    "factors": [
      {"name": "Rent vs Revenue Potential", "score": <0-25>, "maxScore": 25, "weight": 25, "explanation": "<brief>"},
      {"name": "Occupancy Demand", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Unit Size Suitability", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Running Cost Risk", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Market Timing", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"}
    ]
  },
  "clinicSuitabilityScore": {
    "total": <0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<sentence>",
    "factors": [
      {"name": "Treatment Room Potential", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Reception & Client Flow", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Frontage & Discretion", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Luxury & Branding Potential", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Compliance Suitability", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"},
      {"name": "Instagrammability", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"},
      {"name": "Plumbing & Infrastructure", "score": <0-10>, "maxScore": 10, "weight": 10, "explanation": "<brief>"}
    ]
  },
  "competition": {
    "saturationScore": <0-100>,
    "opportunityScore": <0-100>,
    "saturationVerdict": "<assessment>",
    "opportunityVerdict": "<assessment>",
    "competitors": []
  },
  "executiveSummary": {
    "strengths": ["<1>", "<2>", "<3>"],
    "weaknesses": ["<1>", "<2>"],
    "risks": ["<1>", "<2>"],
    "hiddenOpportunities": ["<1>", "<2>"],
    "likelyRevenueCeiling": "<e.g. £35k–£55k/month>",
    "launchRecommendations": ["<1>", "<2>", "<3>"],
    "suggestedPositioning": "<positioning statement>",
    "overallVerdict": "<2-3 sentence verdict>"
  }
}`;

  let rawAnalysis: unknown;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: analysisPrompt }],
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    rawAnalysis = parseLLMJson(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AI_INTEGRATIONS_OPENAI")) {
      return res.status(503).json({ error: "AI service is not configured. Please provision the OpenAI AI integration." });
    }
    return res.status(500).json({ error: "AI analysis failed. Please try again." });
  }

  const validated = AnalysisSchema.safeParse(rawAnalysis);
  if (!validated.success) {
    return res.status(500).json({ error: "AI returned an unexpected response format. Please try again." });
  }

  const analysis = validated.data;
  const finalCompetitors = realCompetitors ?? manualCompetitorsList;

  const fullResult = {
    propertyId: id,
    locationScore: analysis.locationScore,
    commercialViabilityScore: analysis.commercialViabilityScore,
    clinicSuitabilityScore: analysis.clinicSuitabilityScore,
    competition: {
      ...analysis.competition,
      competitors: finalCompetitors,
      dataSource: competitionDataSource,
    },
    executiveSummary: analysis.executiveSummary,
    generatedAt: new Date().toISOString(),
  };

  // Persist analysis to DB
  const [latestExisting] = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id))
    .orderBy(desc(propertyAiAnalysesTable.version))
    .limit(1);

  const newVersion = latestExisting ? latestExisting.version + 1 : 1;

  const [savedAnalysis] = await db.insert(propertyAiAnalysesTable).values({
    propertyId: id,
    version: newVersion,
    analysisJson: fullResult as unknown as Record<string, unknown>,
    confidenceLevel: analysis.clinicSuitabilityScore.grade === "A" || analysis.locationScore.grade === "A" ? "high" : "medium",
    sourceDataSnapshot: {
      address: property.address,
      postcode: property.postcode,
      sqFootage: property.sqFootage,
      monthlyRentGbp: property.monthlyRentGbp,
      annualRentGbp: property.annualRentGbp,
      businessRatesGbp: property.businessRatesGbp,
      parkingSpaces: property.parkingSpaces,
      frontageMeters: property.frontageMeters,
      competitorCount: finalCompetitors.length,
      competitionDataSource: competitionDataSource,
    } as Record<string, unknown>,
  }).returning();

  return res.json({
    ...fullResult,
    analysisId: savedAnalysis.id,
    version: newVersion,
    isStale: false,
  });
});

// ─── AI Advisor Actions ────────────────────────────────────────────────────────

router.post("/properties/:id/advisor-action", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const { action, prompt: customPrompt } = req.body as { action?: string; prompt?: string };

  if (!action || !ADVISOR_ACTIONS.includes(action as typeof ADVISOR_ACTIONS[number])) {
    return res.status(400).json({ error: `Invalid action. Must be one of: ${ADVISOR_ACTIONS.join(", ")}` });
  }

  const propertyContext = `Property: ${property.address || "Unknown address"} (${property.postcode || "no postcode"})
Size: ${property.sqFootage || "Unknown"} sq ft | Rent: £${property.monthlyRentGbp || "Unknown"}/mo | Annual: £${property.annualRentGbp || "Unknown"}
Business Rates: £${property.businessRatesGbp || "Unknown"}/yr | Lease: ${property.leaseLength || "Unknown"}
Parking: ${property.parkingSpaces ?? "Unknown"} spaces | Frontage: ${property.frontageMeters || "Unknown"}m
Use Class: ${property.useClass || "Unknown"} | Availability: ${property.availabilityDate || "Unknown"}
Agent: ${property.agentName || "Unknown"} | Notes: ${property.notes || "None"}`;

  const actionPrompts: Record<string, string> = {
    "suggest-offer": `As a commercial property negotiation expert for UK aesthetics clinics, suggest an opening offer amount and negotiation strategy for this property. Include: recommended opening offer, ideal target rent, maximum acceptable rent, negotiation tactics, what concessions to ask for (rent free periods, fit-out contributions, break clauses), and red lines.`,
    "identify-risks": `As a commercial property risk analyst, identify hidden risks for this property being used as a premium aesthetics clinic. Cover: legal/planning risks, structural/infrastructure concerns, lease trap clauses to watch for, competition threats, regulatory compliance challenges, financial risks, and any red flags in the details provided.`,
    "recommend-layout": `As a clinic design consultant, recommend an optimal treatment room layout for this property. Include: how many treatment rooms are feasible, reception area design, flow recommendations, essential specialist requirements (plumbing, ventilation, lighting), and any layout constraints to be aware of.`,
    "estimate-fitout": `As a clinic fit-out specialist, estimate the fit-out complexity and cost range for this property. Include: complexity rating (low/medium/high), cost estimate range (low/mid/high), key cost drivers, what's likely to be most expensive, timeline estimate, and money-saving recommendations.`,
    "estimate-revenue": `As a clinic business analyst, estimate the realistic first-year revenue potential for this property as a premium aesthetics clinic. Include: conservative/realistic/aggressive monthly revenue ranges, key assumptions, treatment room throughput calculations, occupancy ramp-up timeline, and the revenue ceiling for this location.`,
    "suggest-clinic-model": `As a clinic business strategist, recommend the optimal clinic model and positioning for this property. Include: recommended service mix (injectables, laser, skin, membership), pricing tier, brand positioning, staffing model, USP recommendations, and how to differentiate from local competition.`,
    "suggest-negotiation": `As a commercial lease negotiation specialist, provide a detailed negotiation strategy for this property. Include: key negotiation leverage points, rent review clause strategy, break clause terms to insist on, tenant improvement allowances to request, service charge cap strategy, and how to handle a landlord who is reluctant to negotiate.`,
    "suggest-launch": `As a clinic launch strategist, provide a 90-day launch strategy for this property. Include: pre-opening marketing timeline, soft launch vs hard launch recommendation, local PR strategy, social media launch plan, opening offer/promotion ideas, partnerships to establish, and first 30/60/90 day milestones.`,
  };

  const systemPrompt = `You are an expert advisor specialising in UK aesthetics clinic property acquisition, fit-out, and launch. Provide specific, actionable, UK-market-relevant advice. Be direct and practical.`;

  const userPrompt = customPrompt
    ? `${actionPrompts[action]}\n\nAdditional context from user: ${customPrompt}\n\nProperty details:\n${propertyContext}`
    : `${actionPrompts[action]}\n\nProperty details:\n${propertyContext}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "No response generated.";

    return res.json({
      action,
      propertyId: id,
      response: content,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AI_INTEGRATIONS_OPENAI")) {
      return res.status(503).json({ error: "AI service is not configured." });
    }
    return res.status(500).json({ error: "AI advisor action failed. Please try again." });
  }
});

export default router;
