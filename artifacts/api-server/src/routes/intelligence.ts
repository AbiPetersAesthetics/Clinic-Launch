import { Router, type Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import { z } from "zod";
import { db } from "@workspace/db";
import { propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

async function findNearbyCompetitors(lat: number, lng: number, apiKey: string): Promise<PlacesCompetitor[]> {
  const keywords = ["aesthetics clinic", "beauty salon", "medispa", "skin clinic", "cosmetic clinic"];
  const seen = new Set<string>();
  const competitors: PlacesCompetitor[] = [];

  for (const keyword of keywords) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=600&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;
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

// ─── Document Upload / Extraction ────────────────────────────────────────────

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

  const updateData: Record<string, unknown> = {};
  if (extraction.address) updateData.address = extraction.address;
  if (extraction.postcode) updateData.postcode = extraction.postcode;
  if (extraction.sqFootage != null) updateData.sqFootage = Number(extraction.sqFootage);
  if (extraction.annualRentGbp != null) updateData.annualRentGbp = Number(extraction.annualRentGbp);
  if (extraction.monthlyRentGbp != null) updateData.monthlyRentGbp = Number(extraction.monthlyRentGbp);
  if (extraction.vatOnRent != null) updateData.vatOnRent = Boolean(extraction.vatOnRent);
  if (extraction.businessRatesGbp != null) updateData.businessRatesGbp = Number(extraction.businessRatesGbp);
  if (extraction.serviceChargeGbp != null) updateData.serviceChargeGbp = Number(extraction.serviceChargeGbp);
  if (extraction.leaseLength) updateData.leaseLength = extraction.leaseLength;
  if (extraction.useClass) updateData.useClass = extraction.useClass;
  if (extraction.availabilityDate) updateData.availabilityDate = extraction.availabilityDate;
  if (extraction.parkingSpaces != null) updateData.parkingSpaces = Number(extraction.parkingSpaces);
  if (extraction.frontageMeters != null) updateData.frontageMeters = Number(extraction.frontageMeters);
  if (extraction.agentName) updateData.agentName = extraction.agentName;
  if (extraction.agentPhone) updateData.agentPhone = extraction.agentPhone;
  if (extraction.agentEmail) updateData.agentEmail = extraction.agentEmail;

  if (Object.keys(updateData).length > 0) {
    await db.update(propertiesTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(propertiesTable.id, id));
  }

  return res.json({
    ...extraction,
    flags: extraction.flags ?? [],
  });
});

// ─── Full AI Property Analysis ────────────────────────────────────────────────

router.post("/properties/:id/analyse", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

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

  // ── Competition: real Google Places data OR empty list (no LLM fabrication) ──
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  let realCompetitors: PlacesCompetitor[] | null = null;
  let competitionDataSource: "google_places" | "ai_estimate" = "ai_estimate";

  if (placesApiKey && property.postcode) {
    try {
      const coords = await geocodePostcode(property.postcode, placesApiKey);
      if (coords) {
        realCompetitors = await findNearbyCompetitors(coords.lat, coords.lng, placesApiKey);
        competitionDataSource = "google_places";
      }
    } catch {
      // Fall through — competition will be scored without real competitor list
    }
  }

  const competitorContext = realCompetitors !== null
    ? `Real competitor data from Google Places (within 600m of ${property.postcode}):
${JSON.stringify(realCompetitors, null, 2)}
Score saturation/opportunity based on this real data. Return the competitors array exactly as given above.`
    : `No Google Places API key is configured. Score saturation and opportunity based on your knowledge of ${property.postcode || property.address || "this area"} and typical UK aesthetics market density. Return an EMPTY competitors array — do not fabricate competitor names.`;

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
  } catch {
    return res.status(500).json({ error: "AI analysis failed. Please try again." });
  }

  const validated = AnalysisSchema.safeParse(rawAnalysis);
  if (!validated.success) {
    return res.status(500).json({ error: "AI returned an unexpected response format. Please try again." });
  }

  const analysis = validated.data;

  // Overwrite competitors with real Places data when available
  const finalCompetitors = realCompetitors ?? [];

  return res.json({
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
  });
});

export default router;
