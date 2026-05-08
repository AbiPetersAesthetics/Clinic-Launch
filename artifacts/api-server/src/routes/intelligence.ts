import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
Notes: ${property.notes || "None"}
`.trim();

  const analysisPrompt = `You are a senior commercial property consultant specialising in aesthetics clinic acquisitions in the UK. Analyse this property for use as a premium aesthetics clinic.

Property details:
${propertyContext}

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
    "saturationVerdict": "<brief assessment of local competition density>",
    "opportunityVerdict": "<brief assessment of market gap opportunity>",
    "competitors": [
      {"name": "<name>", "type": "<aesthetics clinic|beauty salon|medispa|dentist|skin clinic>", "distanceMeters": <number or null>, "rating": <number or null>, "reviewCount": <number or null>, "notes": "<brief>"}
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

  return res.json({
    propertyId: id,
    ...result,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
