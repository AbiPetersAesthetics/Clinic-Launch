import { Router, type Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { db } from "@workspace/db";
import { propertiesTable, propertyAiAnalysesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getBedhamptonContext } from "./bedhampton";

const router = Router();
const ACCEPTED_MIMETYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ACCEPTED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Accepted file types: PDF, JPG, PNG, WebP, GIF"));
    }
  },
});

const AI_MODEL = "gpt-5.1";
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "properties");

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

const RiskItemSchema = z.object({
  risk: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string(),
});

const RiskAnalysisSchema = z.object({
  overall: z.enum(["low", "medium", "high"]),
  verdict: z.string(),
  risks: z.array(RiskItemSchema),
});

const NegotiationLeverageSchema = z.object({
  verdict: z.string(),
  landlordMotivators: z.array(z.string()),
  strengths: z.array(z.string()),
  tactics: z.array(z.string()),
  suggestedOpeningOffer: z.string(),
  redLines: z.array(z.string()),
});

const LaunchStrategySchema = z.object({
  estimatedTimeToLaunch: z.string(),
  firstYearRevenueForecast: z.string(),
  phase1: z.string(),
  phase2: z.string(),
  phase3: z.string(),
  keyMilestones: z.array(z.string()),
  criticalSuccessFactors: z.array(z.string()),
});

const AnalysisSchema = z.object({
  locationScore: PropertyScoreSchema,
  commercialViabilityScore: PropertyScoreSchema,
  clinicSuitabilityScore: PropertyScoreSchema,
  competition: CompetitionScoringSchema,
  executiveSummary: ExecutiveSummarySchema,
  riskAnalysis: RiskAnalysisSchema,
  negotiationLeverage: NegotiationLeverageSchema,
  launchStrategy: LaunchStrategySchema,
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

const ALLOWED_IMPORT_HOSTS = [
  "rightmove.co.uk",
  "zoopla.co.uk",
  "novaloca.com",
  "commercialpeoplelisting.co.uk",
  "primelocation.com",
  "onthemarket.com",
  "costar.com",
];

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

// ─── Document Upload / Extraction (review mode — saves temp file to disk) ─────

router.post("/properties/:id/upload-document", upload.single("file"), async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const isImage = req.file.mimetype.startsWith("image/");
  const isPdf = req.file.mimetype === "application/pdf";

  // Save file to disk with a temp ID so confirm-upload can persist it.
  // We store the EXACT temp filename (with MIME-derived extension) and return it
  // in the response so confirm-upload can locate the file reliably — no extension
  // reconstruction needed, avoiding jpeg vs jpg mismatches.
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const propertyUploadsDir = path.join(UPLOADS_DIR, String(id));
  const tempExt = isPdf ? "pdf" : (req.file.mimetype.split("/")[1] ?? "bin");
  const tempFileName = `${tempId}.${tempExt}`;
  let tempFileSaved = false;
  try {
    await fs.promises.mkdir(propertyUploadsDir, { recursive: true });
    await fs.promises.writeFile(path.join(propertyUploadsDir, tempFileName), req.file.buffer);
    tempFileSaved = true;
  } catch {
    // Non-fatal — extraction still proceeds; confirm-upload will detect missing file
  }

  // For images: skip PDF text extraction, return empty extraction with image flag
  if (isImage) {
    return res.json({
      flags: ["Image uploaded — no text extraction available. Fill in property details manually if needed."],
      tempFileId: tempId,
      tempFileName,
      tempFileSaved,
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      fileType: "image",
    });
  }

  if (!isPdf) {
    return res.status(400).json({ error: "Unsupported file type for text extraction." });
  }

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
      model: AI_MODEL,
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

  return res.json({
    ...extraction,
    flags: extraction.flags ?? [],
    tempFileId: tempId,
    tempFileName,
    tempFileSaved,
    fileName: req.file.originalname,
    fileSizeBytes: req.file.size,
    fileType: "pdf",
  });
});

// ─── Confirm Upload (saves reviewed extracted data + finalises stored file) ───

router.post("/properties/:id/confirm-upload", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const ConfirmUploadBodySchema = z.object({
    fields: z.record(z.unknown()).optional().default({}),
    fileName: z.string().optional(),
    fileSizeBytes: z.number().optional(),
    tempFileId: z.string().optional(),
    // tempFileName is the exact filename (including MIME-derived extension) as saved
    // by upload-document — use this directly to locate the temp file.
    tempFileName: z.string().optional(),
    fileType: z.enum(["pdf", "image"]).optional().default("pdf"),
  });

  const parseResult = ConfirmUploadBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request body", details: parseResult.error.issues });
  }

  const { fields, fileName, fileSizeBytes, tempFileName, fileType } = parseResult.data;

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "address", "postcode", "sqFootage", "annualRentGbp", "monthlyRentGbp",
    "vatOnRent", "businessRatesGbp", "serviceChargeGbp", "leaseLength",
    "useClass", "availabilityDate", "parkingSpaces", "frontageMeters",
    "agentName", "agentPhone", "agentEmail",
  ];

  for (const field of allowedFields) {
    if (fields[field] !== undefined && fields[field] !== null && fields[field] !== "") {
      updateData[field] = fields[field];
    }
  }

  // Move temp file to permanent location using the exact tempFileName stored by upload-document.
  // This avoids any MIME extension vs filename extension mismatch (e.g. jpeg vs jpg).
  const propertyUploadsDir = path.join(UPLOADS_DIR, String(id));
  const safeName = (fileName ?? "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalFileName = `${Date.now()}_${safeName}`;
  const finalPath = path.join(propertyUploadsDir, finalFileName);
  const fileUrl = `/uploads/properties/${id}/${finalFileName}`;

  const resolvedType = fileType === "image" ? "image" : "pdf";

  // tempFileName is required to add a media entry — without it we cannot guarantee
  // the file exists on disk, so reject rather than persist a broken URL.
  if (!tempFileName) {
    return res.status(400).json({ error: "tempFileName is required to finalise a media upload." });
  }

  const tempPath = path.join(propertyUploadsDir, tempFileName);
  try {
    await fs.promises.mkdir(propertyUploadsDir, { recursive: true });
    await fs.promises.rename(tempPath, finalPath);
  } catch {
    // Temp file could not be moved — reject so we never record a broken URL.
    return res.status(500).json({ error: "Could not finalise file — the uploaded file may have expired. Please re-upload." });
  }

  // Add media file reference — only reached once file is confirmed on disk.
  const existingMedia = Array.isArray(property.mediaFiles) ? property.mediaFiles : [];
  const newMediaFile = {
    id: `${resolvedType}_${Date.now()}`,
    name: fileName ?? (resolvedType === "image" ? "photo.jpg" : "brochure.pdf"),
    type: resolvedType as "pdf" | "image",
    url: fileUrl,
    uploadedAt: new Date().toISOString(),
    sizeBytes: fileSizeBytes ?? null,
  };
  updateData.mediaFiles = [...existingMedia, newMediaFile];

  await db.update(propertiesTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id));

  const [updated] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  return res.json(updated);
});

// ─── URL Import (SSRF-protected) ──────────────────────────────────────────────

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

  // Enforce HTTPS-only
  if (parsedUrl.protocol !== "https:") {
    return res.status(400).json({ error: "Only HTTPS URLs are supported for security reasons." });
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  // ── PDF URL path (S3 brochures, direct PDF links) ──────────────────────────
  // Detect PDFs by URL extension or by sniffing the Content-Type header.
  // PDFs bypass the listing-site allowlist — they are downloaded and processed
  // with the same pdf-parse + AI pipeline as a manually-uploaded brochure.
  const looksLikePdf = parsedUrl.pathname.toLowerCase().endsWith(".pdf");

  if (looksLikePdf) {
    let pdfBuffer: Buffer;
    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ClinicLaunchOS/1.0; brochure download)" },
        signal: AbortSignal.timeout(20000),
        redirect: "follow",
      });
      if (!response.ok) {
        return res.status(422).json({
          error: `Could not download the PDF (HTTP ${response.status}). Check the link is still valid.`,
          extractable: false,
        });
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
        return res.status(422).json({
          error: "The URL did not return a PDF file. Try uploading the brochure directly instead.",
          extractable: false,
        });
      }
      const arrayBuf = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("timeout") || msg.includes("AbortError")) {
        return res.status(422).json({ error: "The PDF download timed out. Try uploading the file directly.", extractable: false });
      }
      return res.status(422).json({ error: "Could not download the PDF. Try uploading the file directly.", extractable: false });
    }

    let rawText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(pdfBuffer);
      rawText = result.text;
    } catch {
      return res.status(422).json({ error: "Could not read the PDF. It may be scanned or password-protected. Try uploading a different brochure.", extractable: false });
    }

    const pdfPrompt = `You are a commercial property data extraction specialist. Extract structured data from this commercial property brochure. Return ONLY valid JSON.

Source PDF URL: ${parsedUrl.toString()}

Document text:
${rawText.slice(0, 6000)}

Extract these fields (use null if not found):
address, postcode, sqFootage (number in sq ft), annualRentGbp (number), monthlyRentGbp (number),
vatOnRent (boolean), businessRatesGbp (number per year), serviceChargeGbp (number per year),
leaseLength (string), useClass (string e.g. "E"), availabilityDate (ISO string or null),
parkingSpaces (number), frontageMeters (number), agentName, agentPhone, agentEmail,
notes (string — any other useful info about the property),
flags (string array — important notes/uncertainties e.g. "VAT status unclear", "Rent is asking price only")

Return JSON only, no markdown.`;

    const ExtractWithNotesSchema = ExtractionSchema.extend({ notes: z.string().nullable().optional() });
    let extraction: z.infer<typeof ExtractWithNotesSchema> = { flags: [] };
    try {
      const aiResp = await openai.chat.completions.create({
        model: AI_MODEL,
        max_completion_tokens: 2048,
        messages: [{ role: "user", content: pdfPrompt }],
      });
      const raw = aiResp.choices[0]?.message?.content ?? "{}";
      const parsed = parseLLMJson(raw);
      const validated = ExtractWithNotesSchema.safeParse(parsed);
      extraction = validated.success ? validated.data : { flags: ["AI could not extract data from brochure — please fill fields manually"] };
    } catch {
      extraction = { flags: ["AI extraction failed — please fill fields manually"] };
    }

    return res.json({
      ...extraction,
      sourceUrl: parsedUrl.toString(),
      projectId,
      flags: extraction.flags ?? [],
    });
  }

  // ── Listing page path (Rightmove, Zoopla, etc.) ────────────────────────────
  const isAllowed = ALLOWED_IMPORT_HOSTS.some(h => hostname === h || hostname.endsWith("." + h));
  if (!isAllowed) {
    return res.status(400).json({
      error: `URL must be from a supported property listing site or a direct PDF link. Supported listing sites: ${ALLOWED_IMPORT_HOSTS.join(", ")}`,
      extractable: false,
    });
  }

  // Attempt to fetch the page
  let pageText = "";
  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicLaunchOS/1.0; property data extraction)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    // Re-validate final URL after redirects to prevent SSRF via open redirect
    try {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:") {
        return res.status(422).json({ error: "Redirect to non-HTTPS URL blocked for security.", extractable: false });
      }
      const finalHostname = finalUrl.hostname.toLowerCase().replace(/^www\./, "");
      const finalAllowed = ALLOWED_IMPORT_HOSTS.some(h => finalHostname === h || finalHostname.endsWith("." + h));
      if (!finalAllowed) {
        return res.status(422).json({ error: "Redirect to an external domain was blocked for security.", extractable: false });
      }
    } catch {
      return res.status(422).json({ error: "Could not validate redirect destination.", extractable: false });
    }

    if (!response.ok) {
      return res.status(422).json({
        error: `Could not fetch the listing page (HTTP ${response.status}). The site may require login or block automated access.`,
        extractable: false,
      });
    }

    const html = await response.text();
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
      error: `Could not access ${hostname} — it may require login or block automated requests. Try copying the listing details manually.`,
      extractable: false,
    });
  }

  const prompt = `You are a commercial property data extraction specialist. Extract structured commercial property data from this listing page text. Return ONLY valid JSON.

Source URL: ${parsedUrl.toString()}

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

  const ExtractWithNotesSchema = ExtractionSchema.extend({ notes: z.string().nullable().optional() });
  let extraction: z.infer<typeof ExtractWithNotesSchema> = { flags: [] };
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseLLMJson(raw);
    const validated = ExtractWithNotesSchema.safeParse(parsed);
    extraction = validated.success ? validated.data : { flags: ["Could not extract property data from this page — please fill fields manually"] };
  } catch {
    extraction = { flags: ["AI extraction failed — please fill fields manually"] };
  }

  return res.json({
    ...extraction,
    sourceUrl: parsedUrl.toString(),
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

  // Add isStale flag: analysis is stale if property was updated after the analysis was created
  const withStale = analyses.map(a => ({
    ...a,
    isStale: property.updatedAt > new Date(a.createdAt),
  }));

  return res.json(withStale);
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

  return res.json({
    ...latest,
    isStale: property.updatedAt > new Date(latest.createdAt),
  });
});

// ─── Analysis Version Comparison ─────────────────────────────────────────────

router.get("/properties/:id/analyses/compare", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const v1 = parseInt(req.query["v1"] as string);
  const v2 = parseInt(req.query["v2"] as string);

  if (isNaN(v1) || isNaN(v2)) {
    return res.status(400).json({ error: "v1 and v2 query params (version numbers) are required" });
  }

  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const analyses = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id));

  const analysis1 = analyses.find(a => a.version === v1);
  const analysis2 = analyses.find(a => a.version === v2);

  if (!analysis1 || !analysis2) {
    return res.status(404).json({ error: "One or both specified versions not found" });
  }

  return res.json({ v1: analysis1, v2: analysis2 });
});

// ─── Full AI Property Analysis (persisted, all 8 sections) — SSE streaming ────

router.post("/properties/:id/analyse", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  // SSE headers — keeps the connection alive and lets the frontend show progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

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

  // ── Stage 1: Locate property ───────────────────────────────────────────────
  send({ stage: "geocoding", message: "Locating property…" });

  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  let realCompetitors: PlacesCompetitor[] | null = null;
  let competitionDataSource: "google_places" | "manual" | "ai_estimate" = "ai_estimate";

  if (placesApiKey && property.postcode) {
    try {
      const coords = await geocodePostcode(property.postcode, placesApiKey);
      if (coords) {
        // ── Stage 2: Map competitors ──────────────────────────────────────────
        send({ stage: "competitors", message: `Mapping competitors within ${searchRadius}m…` });
        realCompetitors = await findNearbyCompetitors(coords.lat, coords.lng, placesApiKey, searchRadius);
        competitionDataSource = "google_places";
      }
    } catch {
      // Fall through to AI estimate
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

  const bedhamptonContext = await getBedhamptonContext();

  // ── Stage 3: AI analysis ────────────────────────────────────────────────────
  send({ stage: "analysing", message: "Running deep AI analysis — this takes 60–90 seconds…" });

  // Keep connection alive with a heartbeat every 12s while the model works
  const heartbeat = setInterval(() => send({ stage: "heartbeat" }), 12000);

  const analysisPrompt = `You are a senior commercial property consultant specialising in aesthetics clinic acquisitions in the UK. Conduct a thorough, expert-grade analysis of this property for use as a premium aesthetics clinic.

Be highly analytical and specific. Every factor explanation must be 2-4 sentences covering: what the data tells you, why it matters for an aesthetics clinic specifically, and any nuance or caveat. Every verdict, summary, and recommendation must be substantive — no single-sentence answers.

${bedhamptonContext}

Property:
${propertyContext}

Competition context:
${competitorContext}

Return a JSON object with EXACTLY this structure (no markdown, all 8 sections required):
{
  "locationScore": {
    "total": <integer 0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<2-3 sentence summary of the location's overall suitability, citing specific characteristics>",
    "factors": [
      {"name": "Affluence & Demographics", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: local income levels, Acorn/Mosaic profile if inferrable from postcode, relevance to premium aesthetics spend>"},
      {"name": "Footfall & Visibility", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: type and volume of passing traffic, whether footfall is browsing vs destination, visibility considerations>"},
      {"name": "Parking & Accessibility", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: nearest car parks, distance, cost, disabled access, how this affects client acquisition for a discretionary appointment clinic>"},
      {"name": "Female Demographic Concentration", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: proximity to female-skewed footfall generators — gyms, schools, fashion retail, cafes, offices — and the quality of that audience>"},
      {"name": "Transport Links", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: train/bus access, journey times from nearby towns, whether public transport serves the client profile>"},
      {"name": "Proximity to Premium Retail", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: nearby premium or aspirational brands, how they validate the location for high-end aesthetics and what halo effect they create>"},
      {"name": "Local Spending Power", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: evidence of discretionary spend in the area, average treatment price benchmarks for this market, spend per client potential>"},
      {"name": "Growth Area Potential", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: regeneration, development pipeline, demographic shifts, whether the market will grow over a 3-5 year lease horizon>"}
    ]
  },
  "commercialViabilityScore": {
    "total": <integer 0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<2-3 sentence assessment of commercial viability including the rent-to-revenue relationship and key financial risk factors>",
    "factors": [
      {"name": "Rent vs Revenue Potential", "score": <integer 0-25>, "maxScore": 25, "weight": 25, "explanation": "<2-3 sentences: rent as % of achievable revenue, what occupancy/throughput is needed to cover rent, whether this is achievable in year 1>"},
      {"name": "Occupancy Demand", "score": <integer 0-20>, "maxScore": 20, "weight": 20, "explanation": "<2-3 sentences: strength of local demand for premium aesthetics, waiting list dynamics, whether demand is price-sensitive or premium>"},
      {"name": "Unit Size Suitability", "score": <integer 0-20>, "maxScore": 20, "weight": 20, "explanation": "<2-3 sentences: whether sq footage supports the planned room count and reception, what the optimal layout could achieve, any size-related constraints>"},
      {"name": "Running Cost Risk", "score": <integer 0-20>, "maxScore": 20, "weight": 20, "explanation": "<2-3 sentences: total occupancy cost including rates, service charge, insurance — as a % of revenue, and hidden cost risks specific to this property type>"},
      {"name": "Market Timing", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: current aesthetics market conditions in this area, post-regulation environment under the new licensing regime, demand trajectory>"}
    ]
  },
  "clinicSuitabilityScore": {
    "total": <integer 0-100>, "maxTotal": 100, "grade": <"A"|"B"|"C"|"D"|"F">, "summary": "<2-3 sentence assessment of how well the physical space suits a premium nurse-led aesthetics clinic>",
    "factors": [
      {"name": "Treatment Room Potential", "score": <integer 0-20>, "maxScore": 20, "weight": 20, "explanation": "<2-3 sentences: estimated treatment rooms achievable from the footprint, minimum viable layout, what room count means for revenue ceiling>"},
      {"name": "Reception & Client Flow", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: feasibility of a professional reception, client privacy from public areas, flow from entry to treatment room>"},
      {"name": "Frontage & Discretion", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: prominence vs discretion trade-off for aesthetics clients, signage potential, whether the entrance signals the right brand values>"},
      {"name": "Luxury & Branding Potential", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: ceiling height, natural light, architectural features, potential for a premium interior finish within a realistic budget>"},
      {"name": "Compliance Suitability", "score": <integer 0-15>, "maxScore": 15, "weight": 15, "explanation": "<2-3 sentences: CQC-relevant considerations — clinical waste disposal access, ventilation, handwashing facilities, infection control suitability, any obvious red flags>"},
      {"name": "Instagrammability", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: potential for a photogenic interior that drives social proof, whether the location itself is content-worthy, local influencer/media opportunity>"},
      {"name": "Plumbing & Infrastructure", "score": <integer 0-10>, "maxScore": 10, "weight": 10, "explanation": "<2-3 sentences: likely state of existing services, what fit-out modifications are needed, risk of unexpected infrastructure costs in an older building>"}
    ]
  },
  "competition": {
    "saturationScore": <integer 0-100>,
    "opportunityScore": <integer 0-100>,
    "saturationVerdict": "<2-3 sentences: characterise the competitive landscape, note the type and quality of competitors, whether saturation is a real barrier>",
    "opportunityVerdict": "<2-3 sentences: identify the specific gap in the market, what unmet demand exists, how a nurse-led premium clinic differentiates>",
    "competitors": []
  },
  "executiveSummary": {
    "strengths": ["<detailed strength 1 — one full sentence>", "<detailed strength 2>", "<detailed strength 3>", "<detailed strength 4>", "<detailed strength 5>"],
    "weaknesses": ["<detailed weakness 1 — one full sentence>", "<detailed weakness 2>", "<detailed weakness 3>", "<detailed weakness 4>"],
    "risks": ["<specific risk 1 — one full sentence stating risk and why it matters>", "<risk 2>", "<risk 3>", "<risk 4>"],
    "hiddenOpportunities": ["<specific opportunity 1 not obvious from the headline data>", "<opportunity 2>", "<opportunity 3>"],
    "likelyRevenueCeiling": "<specific range e.g. '£38k–£62k/month at full occupancy (2 treatment rooms, 5 days/week, blended £420 ATV)'>",
    "launchRecommendations": ["<specific recommendation 1>", "<recommendation 2>", "<recommendation 3>", "<recommendation 4>", "<recommendation 5>"],
    "suggestedPositioning": "<2-3 sentence positioning statement covering brand tier, target client, key differentiators, and price positioning vs local competition>",
    "overallVerdict": "<4-5 sentence overall verdict: should Abi proceed, what are the critical conditions, what would make this property a strong yes or a pass, and what is the single most important factor>"
  },
  "riskAnalysis": {
    "overall": "<low|medium|high>",
    "verdict": "<3-4 sentence overall risk assessment covering financial risk, operational risk, regulatory risk, and market risk in aggregate>",
    "risks": [
      {"risk": "<specific risk — full sentence>", "severity": "<low|medium|high>", "mitigation": "<practical 1-2 sentence mitigation with specific actions>"},
      {"risk": "<specific risk>", "severity": "<low|medium|high>", "mitigation": "<practical mitigation>"},
      {"risk": "<specific risk>", "severity": "<low|medium|high>", "mitigation": "<practical mitigation>"},
      {"risk": "<specific risk>", "severity": "<low|medium|high>", "mitigation": "<practical mitigation>"},
      {"risk": "<specific risk>", "severity": "<low|medium|high>", "mitigation": "<practical mitigation>"}
    ]
  },
  "negotiationLeverage": {
    "verdict": "<3-4 sentence overall negotiation position: how strong is the tenant's hand, what market conditions favour negotiation, what is the walk-away point>",
    "landlordMotivators": ["<specific reason landlord may accept below-asking>", "<reason 2>", "<reason 3>"],
    "strengths": ["<specific tenant leverage point — why Abi is a good tenant>", "<leverage point 2>", "<leverage point 3>"],
    "tactics": ["<specific tactic 1 — what to ask for and how to frame it>", "<tactic 2>", "<tactic 3>", "<tactic 4>"],
    "suggestedOpeningOffer": "<specific, calculated guidance: opening offer amount, target rent, concessions to seek (rent-free, fit-out contribution, break clause), and how to sequence the ask>",
    "redLines": ["<lease clause or condition to refuse or insist on — explain why>", "<red line 2>", "<red line 3>"]
  },
  "launchStrategy": {
    "estimatedTimeToLaunch": "<specific range e.g. '9-14 months from lease signing' with explanation of what drives the range>",
    "firstYearRevenueForecast": "<specific tiered forecast e.g. 'Month 1-3: £8k-£15k/month; Month 4-6: £18k-£28k/month; Month 7-12: £28k-£45k/month'>",
    "phase1": "<months 1-3: specific activities — fit-out, CQC registration, soft marketing, systems setup, with key milestones and watch-outs>",
    "phase2": "<months 4-6: specific activities — soft launch, first clients, social proof building, local outreach, with targets>",
    "phase3": "<months 7-12: specific activities — full trading, marketing scale-up, memberships, referral programme, with revenue targets>",
    "keyMilestones": ["<specific milestone 1 with target date or trigger>", "<milestone 2>", "<milestone 3>", "<milestone 4>", "<milestone 5>"],
    "criticalSuccessFactors": ["<factor 1 — why it is critical and what failure looks like>", "<factor 2>", "<factor 3>", "<factor 4>"]
  }
}`;

  let rawAnalysis: unknown;
  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 120_000);
    const response = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        max_completion_tokens: 5000,
        messages: [{ role: "user", content: analysisPrompt }],
      },
      { signal: abort.signal },
    );
    clearTimeout(timeout);
    const content = response.choices[0]?.message?.content ?? "{}";
    rawAnalysis = parseLLMJson(content);
  } catch (err) {
    clearInterval(heartbeat);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AI_INTEGRATIONS_OPENAI")) {
      send({ stage: "error", error: "AI service is not configured. Please provision the OpenAI AI integration." });
    } else if (msg.includes("aborted") || msg.includes("AbortError")) {
      send({ stage: "error", error: "Analysis timed out after 2 minutes. Please try again." });
    } else {
      send({ stage: "error", error: "AI analysis failed. Please try again." });
    }
    res.end();
    return;
  }
  clearInterval(heartbeat);

  const validated = AnalysisSchema.safeParse(rawAnalysis);
  if (!validated.success) {
    send({
      stage: "error",
      error: "AI returned an unexpected response format. Please try again.",
      details: validated.error.issues.map(i => i.message).join("; "),
    });
    res.end();
    return;
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
    riskAnalysis: analysis.riskAnalysis,
    negotiationLeverage: analysis.negotiationLeverage,
    launchStrategy: analysis.launchStrategy,
    generatedAt: new Date().toISOString(),
  };

  // ── Stage 4: Persist ───────────────────────────────────────────────────────
  send({ stage: "saving", message: "Saving analysis…" });

  const [latestExisting] = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id))
    .orderBy(desc(propertyAiAnalysesTable.version))
    .limit(1);

  const newVersion = latestExisting ? latestExisting.version + 1 : 1;

  const grades = [analysis.locationScore.grade, analysis.commercialViabilityScore.grade, analysis.clinicSuitabilityScore.grade];
  const aCount = grades.filter(g => g === "A").length;
  const fCount = grades.filter(g => g === "F" || g === "D").length;
  const confidenceLevel = aCount >= 2 ? "high" : fCount >= 2 ? "low" : "medium";

  const [savedAnalysis] = await db.insert(propertyAiAnalysesTable).values({
    propertyId: id,
    version: newVersion,
    analysisJson: fullResult as unknown as Record<string, unknown>,
    confidenceLevel,
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

  // ── Stage 5: Complete ──────────────────────────────────────────────────────
  send({
    stage: "complete",
    result: {
      ...fullResult,
      analysisId: savedAnalysis.id,
      version: newVersion,
      isStale: false,
    },
  });
  res.end();
});

// ─── AI Advisor Actions — SSE streaming ───────────────────────────────────────

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

  const bedhamptonCtx = await getBedhamptonContext();

  const systemPrompt = `You are a senior expert advisor specialising in UK aesthetics clinic property acquisition, fit-out, launch strategy, and clinical governance. Provide thorough, analytical, deeply expert advice specific to the UK aesthetics market.

For every response:
- Structure your advice with clear bold section headers
- Include specific cost ranges in GBP (low/mid/high), named suppliers, organisations, or regulatory bodies where relevant
- Quantify recommendations wherever possible (costs, timelines, dimensions, occupancy rates)
- Flag CQC, JCCP, or other regulatory implications explicitly and explain their practical impact
- Include risk factors and how to mitigate them
- Close with a prioritised list of immediate next steps
- A thorough response of 500-900 words is expected — do not truncate or oversimplify

${bedhamptonCtx}`;

  const userPrompt = customPrompt
    ? `${actionPrompts[action]}\n\nAdditional context from user: ${customPrompt}\n\nProperty details:\n${propertyContext}`
    : `${actionPrompts[action]}\n\nProperty details:\n${propertyContext}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, action, propertyId: id })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// ─── Property Location Search ─────────────────────────────────────────────────

const PropertySearchBodySchema = z.object({
  location: z.string().min(1),
  radiusKm: z.number().optional().default(5),
  minSqft: z.number().optional(),
  maxSqft: z.number().optional(),
  minRentGbp: z.number().optional(),
  maxRentGbp: z.number().optional(),
  useClass: z.string().optional(),
  parkingRequired: z.boolean().optional(),
  highStreetOnly: z.boolean().optional(),
});

const SearchResultItemAISchema = z.object({
  address: z.string(),
  postcode: z.string(),
  lat: z.number(),
  lng: z.number(),
  estimatedMonthlyRentGbp: z.number().nullable().optional(),
  estimatedSqft: z.number().nullable().optional(),
  suitabilityScore: z.number(),
  rationale: z.string(),
  listingUrl: z.string().nullable().optional(),
  useClass: z.string().nullable().optional(),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
});

const SearchResultAISchema = z.object({
  results: z.array(SearchResultItemAISchema),
});

router.post("/projects/:projectId/properties/search", async (req, res) => {
  const bodyParse = PropertySearchBodySchema.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({ error: "Invalid search criteria", details: bodyParse.error.issues });
  }
  const body = bodyParse.data;

  const criteria: string[] = [`Location: ${body.location}`];
  if (body.radiusKm) criteria.push(`Within ${body.radiusKm} km radius`);
  if (body.minSqft || body.maxSqft) criteria.push(`Size: ${body.minSqft ?? 0}–${body.maxSqft ?? "unlimited"} sq ft`);
  if (body.minRentGbp || body.maxRentGbp) criteria.push(`Monthly rent: £${body.minRentGbp ?? 0}–£${body.maxRentGbp ?? "unlimited"}`);
  if (body.useClass) criteria.push(`Use class: ${body.useClass}`);
  if (body.parkingRequired) criteria.push("Parking required");
  if (body.highStreetOnly) criteria.push("High street or main retail area only");

  const prompt = `You are a UK commercial property sourcing expert for an aesthetics clinic business. Generate a shortlist of 6 specific real UK commercial property locations matching the search criteria below. Each result must be a plausible, real-world address in the specified area.

Search criteria:
${criteria.join("\n")}

For each result provide these fields exactly:
- address: specific street address (e.g. "12 High Street, Guildford")
- postcode: valid UK postcode for that location (e.g. "GU1 3DP")
- lat: approximate latitude as a decimal number accurate to 3 decimal places
- lng: approximate longitude as a decimal number accurate to 3 decimal places
- estimatedMonthlyRentGbp: estimated monthly rent in GBP as integer, or null if unknown
- estimatedSqft: estimated floor area in sq ft as integer, or null if unknown
- suitabilityScore: integer 0-100 rating for aesthetics clinic suitability given the criteria
- rationale: 1-2 sentence explanation of why this location suits an aesthetics clinic
- listingUrl: try to provide an approximate commercial property search URL from Rightmove or Zoopla Commercial for this postcode. Format: "https://www.rightmove.co.uk/commercial-property-to-let.html?searchLocation=POSTCODE" with the actual postcode URL-encoded (spaces as +), e.g. "https://www.rightmove.co.uk/commercial-property-to-let.html?searchLocation=GU1+3DP". If the postcode is uncertain, return null.
- useClass: likely planning use class (e.g. "E", "A1", "D1"), or null
- strengths: array of 2-3 brief bullet points on strengths of this location
- concerns: array of 1-2 brief bullet points on concerns or risks

Return ONLY valid JSON with a "results" array. No markdown, no preamble.`;

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 90_000);
    const response = await openai.chat.completions.create(
      { model: AI_MODEL, max_completion_tokens: 3000, messages: [{ role: "user", content: prompt }] },
      { signal: abort.signal },
    );
    clearTimeout(timeout);
    const raw = response.choices[0]?.message?.content ?? '{"results":[]}';
    const parsed = parseLLMJson(raw);
    const validated = SearchResultAISchema.safeParse(parsed);
    if (!validated.success) {
      return res.status(500).json({ error: "Search returned unexpected format. Please try again." });
    }
    return res.json({ results: validated.data.results, location: body.location, criteria: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AI_INTEGRATIONS_OPENAI")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    if (msg.includes("aborted") || msg.includes("AbortError")) {
      return res.status(504).json({ error: "Search timed out. Please try again." });
    }
    return res.status(500).json({ error: "Property search failed. Please try again." });
  }
});

// ─── Brochure Visual Analysis (GPT-4o Vision) ────────────────────────────────

const BrochureVisualAnalysisSchema = z.object({
  layoutAssessment: z.object({
    estimatedRoomCount: z.number(),
    receptionViability: z.enum(["excellent", "good", "limited", "none"]),
    clientFlowRating: z.enum(["excellent", "good", "adequate", "poor"]),
    floorPlanNotes: z.string(),
    fitoutComplexity: z.enum(["low", "medium", "high"]),
  }),
  conditionAssessment: z.object({
    overallCondition: z.enum(["excellent", "good", "fair", "poor"]),
    decorativeStandard: z.enum(["high", "moderate", "low", "stripped"]),
    interiorNotes: z.string(),
    structuralObservations: z.string(),
    maintenanceEstimate: z.enum(["minimal", "moderate", "significant", "major"]),
  }),
  clinicSuitabilityFromImages: z.object({
    score: z.number(),
    grade: z.enum(["A", "B", "C", "D", "F"]),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    verdict: z.string(),
  }),
  fitOutEstimate: z.object({
    complexityRating: z.enum(["low", "medium", "high"]),
    estimatedCostRangeLow: z.number(),
    estimatedCostRangeHigh: z.number(),
    keyWorkRequired: z.array(z.string()),
    timelineWeeks: z.string(),
  }),
  cqcObservations: z.array(z.string()),
  visualSummary: z.string(),
});

router.post("/properties/:id/analyse-brochure", upload.array("images", 5), async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const files = req.files as Express.Multer.File[] | undefined;
  const imageFiles = (files ?? []).filter(f => f.mimetype.startsWith("image/"));

  if (imageFiles.length === 0) {
    return res.status(400).json({ error: "At least one image file is required (JPEG, PNG, or WebP)." });
  }

  const imageContent = imageFiles.map(f => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
      detail: "high" as const,
    },
  }));

  const propertyContext = [
    property.address && `Address: ${property.address}`,
    property.postcode && `Postcode: ${property.postcode}`,
    property.sqFootage && `Size: ${property.sqFootage} sq ft`,
    property.monthlyRentGbp && `Monthly rent: £${property.monthlyRentGbp}`,
  ].filter(Boolean).join(" | ") || "Address and details not yet entered";

  const visionPrompt = `You are a specialist clinic design consultant and commercial property surveyor assessing brochure images for a PREMIUM AESTHETICS CLINIC site in the UK.

Property context: ${propertyContext}
Images provided: ${imageFiles.length} (may include floor plans, interior photos, exterior photos, brochure pages)

Analyse ALL images carefully and assess:
1. LAYOUT: Max feasible treatment rooms, reception area potential, client flow, fit-out complexity.
2. CONDITION: Overall decorative and structural condition. What needs doing?
3. CLINIC SUITABILITY: Score 0-100 and grade A-F purely from what's visible in the images.
4. FIT-OUT ESTIMATE: Cost range in GBP (low/high), complexity, key works required, timeline.
5. CQC OBSERVATIONS: Any compliance implications visible — hand wash access, room sizes, ventilation, etc.

Return ONLY valid JSON, no markdown:
{
  "layoutAssessment": {
    "estimatedRoomCount": <integer — max feasible treatment rooms>,
    "receptionViability": <"excellent"|"good"|"limited"|"none">,
    "clientFlowRating": <"excellent"|"good"|"adequate"|"poor">,
    "floorPlanNotes": "<2-3 sentences on layout, room arrangement, circulation>",
    "fitoutComplexity": <"low"|"medium"|"high">
  },
  "conditionAssessment": {
    "overallCondition": <"excellent"|"good"|"fair"|"poor">,
    "decorativeStandard": <"high"|"moderate"|"low"|"stripped">,
    "interiorNotes": "<2-3 sentences on condition — what is good, what needs work>",
    "structuralObservations": "<brief note on structural or infrastructure observations>",
    "maintenanceEstimate": <"minimal"|"moderate"|"significant"|"major">
  },
  "clinicSuitabilityFromImages": {
    "score": <integer 0-100>,
    "grade": <"A"|"B"|"C"|"D"|"F">,
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "concerns": ["<concern 1>", "<concern 2>"],
    "verdict": "<2-3 sentence overall verdict on clinic suitability from the images>"
  },
  "fitOutEstimate": {
    "complexityRating": <"low"|"medium"|"high">,
    "estimatedCostRangeLow": <integer GBP>,
    "estimatedCostRangeHigh": <integer GBP>,
    "keyWorkRequired": ["<work item 1>", "<work item 2>", "<work item 3>"],
    "timelineWeeks": "<e.g. 8-12 weeks>"
  },
  "cqcObservations": ["<observation 1>", "<observation 2>"],
  "visualSummary": "<1 paragraph overall summary of what the images show and the property's potential as a premium clinic>"
}`;

  let rawAnalysis: unknown;
  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 90_000);
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        max_completion_tokens: 2000,
        messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, ...imageContent] }],
      },
      { signal: abort.signal },
    );
    clearTimeout(timeout);
    const content = response.choices[0]?.message?.content ?? "{}";
    rawAnalysis = parseLLMJson(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AI_INTEGRATIONS_OPENAI")) {
      return res.status(503).json({ error: "AI service is not configured. Please provision the OpenAI integration." });
    }
    if (msg.includes("aborted") || msg.includes("AbortError")) {
      return res.status(504).json({ error: "Visual analysis timed out. Please try again." });
    }
    return res.status(500).json({ error: "Visual analysis failed. Please try again.", details: msg });
  }

  const validated = BrochureVisualAnalysisSchema.safeParse(rawAnalysis);
  if (!validated.success) {
    return res.status(500).json({
      error: "AI returned an unexpected response format. Please try again.",
      details: validated.error.issues.map(i => i.message).join("; "),
    });
  }

  const analysis = validated.data;
  const fullResult = {
    analysisType: "brochure_visual" as const,
    propertyId: id,
    imageCount: imageFiles.length,
    ...analysis,
    generatedAt: new Date().toISOString(),
  };

  const [latestExisting] = await db.select()
    .from(propertyAiAnalysesTable)
    .where(eq(propertyAiAnalysesTable.propertyId, id))
    .orderBy(desc(propertyAiAnalysesTable.version))
    .limit(1);

  const newVersion = latestExisting ? latestExisting.version + 1 : 1;
  const score = analysis.clinicSuitabilityFromImages.score;
  const confidenceLevel = score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  const [savedAnalysis] = await db.insert(propertyAiAnalysesTable).values({
    propertyId: id,
    version: newVersion,
    analysisJson: fullResult as unknown as Record<string, unknown>,
    confidenceLevel,
    sourceDataSnapshot: {
      imageCount: imageFiles.length,
      propertyAddress: property.address,
      analysisType: "brochure_visual",
    } as Record<string, unknown>,
  }).returning();

  return res.json({
    ...fullResult,
    analysisId: savedAnalysis.id,
    version: newVersion,
  });
});

export default router;

