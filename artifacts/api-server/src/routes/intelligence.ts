import { Router, type Request } from "express";
import multer, { type FileFilterCallback } from "multer";
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

// ─── Google Places helpers ────────────────────────────────────────────────────

type PlacesCompetitor = {
  name: string;
  type: string;
  distanceMeters: number | null;
  rating: number | null;
  reviewCount: number | null;
  notes: string | null;
};

async function geocodePostcode(postcode: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postcode + " UK")}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json() as { status: string; results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
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

  const extractionPrompt = `You are a commercial property data extraction specialist. Extract structured data from this commercial property document. Return ONLY valid JSON matching the schema exactly.

Document text:
${rawText.slice(0, 6000)}

Extract these fields (use null if not found):
- address: full address string
- postcode: UK postcode
- sqFootage: square footage as a number
- annualRentGbp: annual rent in GBP as a number
- monthlyRentGbp: monthly rent in GBP (calculate from annual if needed)
- vatOnRent: boolean - true if VAT applies, false if "exclusive" or "landlord not elected for VAT"
- businessRatesGbp: annual business rates in GBP as a number
- serviceChargeGbp: annual service charge in GBP as a number
- leaseLength: lease term as a string (e.g. "10 years with 5 year break")
- useClass: planning use class (e.g. "E", "D1")
- availabilityDate: availability date as ISO string or null
- parkingSpaces: number of parking spaces as integer
- frontageMeters: frontage width in meters as number
- agentName: estate agent or agency name
- agentPhone: agent phone number
- agentEmail: agent email address
- flags: array of strings for any important flags or uncertainties detected (e.g. "Service charge estimated", "Rent review at year 5", "VAT status unclear")

Return JSON object only, no markdown, no explanation.`;

  let extraction: Record<string, unknown> = { flags: [] };
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: extractionPrompt }],
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    extraction = JSON.parse(cleaned);
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
    rawText: rawText.slice(0, 500),
    flags: Array.isArray(extraction.flags) ? extraction.flags : [],
  });
});

// ─── Full AI Property Analysis ────────────────────────────────────────────────

router.post("/properties/:id/analyse", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const propertyContext = `
Address: ${property.address || "Unknown"}
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
Notes: ${property.notes || "None"}`.trim();

  // ── Competition mapping: try Google Places first, fall back to LLM ──────────
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
      // Fall through to AI estimate
    }
  }

  // Build the competition section of the prompt
  const competitionContext = realCompetitors
    ? `
REAL competitor data retrieved from Google Places (within 600m of ${property.postcode}):
${JSON.stringify(realCompetitors, null, 2)}

Using this real data, provide:
- saturationScore (0–100, higher = more saturated market)
- opportunityScore (0–100, higher = better opportunity gap)
- saturationVerdict: 1–2 sentence interpretation of competitive density
- opportunityVerdict: 1–2 sentence interpretation of the market gap
- competitors: use the provided list exactly (do NOT fabricate extra competitors)`
    : `
No Google Places API key configured. Generate a realistic competition analysis for the area around ${property.postcode || property.address || "this location"} based on your knowledge of UK aesthetics market demographics.
Provide:
- saturationScore (0–100)
- opportunityScore (0–100)
- saturationVerdict
- opportunityVerdict
- competitors: up to 5 plausible named competitors (clearly estimated)`;

  const analysisPrompt = `You are a senior commercial property consultant specialising in aesthetics clinic acquisitions in the UK. Analyse this property for use as a premium aesthetics clinic.

Property details:
${propertyContext}

${competitionContext}

Return a comprehensive JSON analysis with this EXACT structure (no markdown, valid JSON only):

{
  "locationScore": {
    "total": <number 0-100>,
    "maxTotal": 100,
    "grade": <"A"|"B"|"C"|"D"|"F">,
    "summary": "<one sentence verdict>",
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
    "total": <number 0-100>,
    "maxTotal": 100,
    "grade": <"A"|"B"|"C"|"D"|"F">,
    "summary": "<one sentence verdict>",
    "factors": [
      {"name": "Rent vs Revenue Potential", "score": <0-25>, "maxScore": 25, "weight": 25, "explanation": "<brief>"},
      {"name": "Occupancy Demand", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Unit Size Suitability", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Running Cost Risk", "score": <0-20>, "maxScore": 20, "weight": 20, "explanation": "<brief>"},
      {"name": "Market Timing", "score": <0-15>, "maxScore": 15, "weight": 15, "explanation": "<brief>"}
    ]
  },
  "clinicSuitabilityScore": {
    "total": <number 0-100>,
    "maxTotal": 100,
    "grade": <"A"|"B"|"C"|"D"|"F">,
    "summary": "<one sentence verdict>",
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
    "saturationScore": <number 0-100, higher = more saturated>,
    "opportunityScore": <number 0-100, higher = better opportunity>,
    "saturationVerdict": "<brief assessment>",
    "opportunityVerdict": "<brief assessment>",
    "competitors": [
      {"name": "<name>", "type": "<type>", "distanceMeters": <number or null>, "rating": <number or null>, "reviewCount": <number or null>, "notes": "<brief or null>"}
    ]
  },
  "executiveSummary": {
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "risks": ["<risk 1>", "<risk 2>"],
    "hiddenOpportunities": ["<opportunity 1>", "<opportunity 2>"],
    "likelyRevenueCeiling": "<e.g. £35,000–£55,000/month at full occupancy>",
    "launchRecommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
    "suggestedPositioning": "<e.g. Premium medical-grade aesthetics targeting 30–55 professional women>",
    "overallVerdict": "<2-3 sentence executive summary verdict>"
  }
}`;

  let result: Record<string, unknown>;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: analysisPrompt }],
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    result = JSON.parse(cleaned);
  } catch {
    return res.status(500).json({ error: "AI analysis failed. Please try again." });
  }

  // Ensure competition data is from the correct source
  const competitionResult = result.competition as Record<string, unknown> | undefined ?? {};
  if (realCompetitors !== null) {
    competitionResult.competitors = realCompetitors;
  }
  competitionResult.dataSource = competitionDataSource;

  return res.json({
    propertyId: id,
    ...result,
    competition: competitionResult,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
