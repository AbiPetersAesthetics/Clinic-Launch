import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable, propertyAiAnalysesTable, financialsTable, decisionsTable, projectsTable, fixedCostItemsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { ScoringWeights } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  affordability: 1.0,
  size: 1.0,
  parking: 1.0,
  frontage: 1.0,
  location: 1.0,
  competition: 1.0,
  fitoutComplexity: 1.0,
  demographics: 1.0,
};

router.get("/projects/:projectId/properties", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const props = await db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId));

  // Augment each property with latest analysis metadata for card-level stale indicators
  const augmented = await Promise.all(props.map(async (prop) => {
    const [latestAnalysis] = await db.select()
      .from(propertyAiAnalysesTable)
      .where(eq(propertyAiAnalysesTable.propertyId, prop.id))
      .orderBy(desc(propertyAiAnalysesTable.version))
      .limit(1);
    if (!latestAnalysis) {
      return { ...prop, latestAnalysisAt: null as string | null, isAnalysisStale: null as boolean | null };
    }
    const analysisDate = latestAnalysis.createdAt instanceof Date ? latestAnalysis.createdAt : new Date(latestAnalysis.createdAt);
    const isAnalysisStale = prop.updatedAt > analysisDate;
    return { ...prop, latestAnalysisAt: analysisDate.toISOString(), isAnalysisStale };
  }));

  res.json(augmented);
});

router.post("/projects/:projectId/properties", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const body = req.body;
  const [prop] = await db.insert(propertiesTable).values({
    ...body,
    projectId,
    status: body.status ?? "viewing",
    pipelineStatus: body.pipelineStatus ?? "found",
  }).returning();
  res.status(201).json(prop);
});

router.get("/properties/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!prop) return res.status(404).json({ error: "Not found" });
  return res.json(prop);
});

router.put("/properties/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [prop] = await db.update(propertiesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();
  if (!prop) return res.status(404).json({ error: "Not found" });
  return res.json(prop);
});

// Quick pipeline stage update — used by the inline selector in the detail panel
router.patch("/properties/:id/pipeline-status", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { pipelineStatus } = req.body;
  if (!pipelineStatus) return res.status(400).json({ error: "pipelineStatus required" });
  const [prop] = await db.update(propertiesTable)
    .set({ pipelineStatus, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();
  if (!prop) return res.status(404).json({ error: "Not found" });
  return res.json(prop);
});

router.delete("/properties/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(propertiesTable).where(eq(propertiesTable.id, id));
  res.status(204).send();
});

// ─── Set Active Property ──────────────────────────────────────────────────────

router.put("/properties/:id/set-active", async (req, res) => {
  try {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid property id" });
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const monthlyRent = property.monthlyRentGbp ?? 0;
  const monthlyRates = property.businessRatesGbp ? Math.round(property.businessRatesGbp / 12) : 0;
  const monthlyServiceCharge = property.serviceChargeGbp ? Math.round(property.serviceChargeGbp / 12) : 0;
  const vatOnRent = property.vatOnRent ?? false;

  // ── Step 1: Clear active flag + reset pipelineStatus on previously active property ──
  await db.update(propertiesTable)
    .set({ isActiveForProject: false, pipelineStatus: "viewing", updatedAt: new Date() })
    .where(and(
      eq(propertiesTable.projectId, property.projectId),
      eq(propertiesTable.isActiveForProject, true)
    ));

  // ── Step 2: Set this property as active ────────────────────────────────────
  const [updated] = await db.update(propertiesTable)
    .set({ isActiveForProject: true, pipelineStatus: "selected", status: "active", updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();

  // ── Step 3: Update ONLY property-specific fields in the financial model ─────
  // All other assumptions (variable costs, ACV, occupancy, etc.) are preserved.
  const [existingModel] = await db.select().from(financialsTable)
    .where(eq(financialsTable.projectId, property.projectId));

  if (existingModel) {
    await db.update(financialsTable)
      .set({ rentGbp: monthlyRent, ratesGbp: monthlyRates, vatOnRent, updatedAt: new Date() })
      .where(eq(financialsTable.projectId, property.projectId));
  } else {
    await db.insert(financialsTable).values({
      projectId: property.projectId,
      rentGbp: monthlyRent, ratesGbp: monthlyRates, vatOnRent,
    });
  }

  // ── Step 4: Sync property amounts into this property's fixed cost items ──────
  // Each property has its own set of fixed cost items (scoped by propertyId).
  // On first activation: seed a default list. On subsequent activations: only
  // update Rent/Lease, Business Rates, Service Charge — leave everything else.
  const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existingItems = await db.select().from(fixedCostItemsTable)
    .where(and(
      eq(fixedCostItemsTable.projectId, property.projectId),
      eq(fixedCostItemsTable.propertyId, id)
    ));

  if (existingItems.length > 0) {
    // Property already has items — only sync property-specific cost lines
    for (const item of existingItems) {
      const n = normName(item.name);
      let newAmount: number | null = null;
      if (n.includes("rent") || n.includes("lease")) newAmount = monthlyRent;
      else if (n.includes("rate") && !n.includes("stock") && !n.includes("booking") && !n.includes("commission")) newAmount = monthlyRates;
      else if (n.includes("service") && (n.includes("charge") || n.includes("estate"))) newAmount = monthlyServiceCharge;
      if (newAmount !== null) {
        await db.update(fixedCostItemsTable)
          .set({ amountGbp: newAmount, updatedAt: new Date() })
          .where(eq(fixedCostItemsTable.id, item.id));
      }
    }
  } else {
    // First time this property is activated — seed a default list scoped to it
    const defaultItems = [
      { name: "Rent / Lease",                     amountGbp: monthlyRent,          costType: "unique", sortOrder: 0 },
      { name: "Service Charge",                   amountGbp: monthlyServiceCharge, costType: "unique", sortOrder: 1 },
      { name: "Business Rates",                   amountGbp: monthlyRates,         costType: "unique", sortOrder: 2 },
      { name: "Utilities (Gas & Electric)",       amountGbp: 0,                    costType: "unique", sortOrder: 3 },
      { name: "Internet / WiFi",                  amountGbp: 0,                    costType: "unique", sortOrder: 4 },
      { name: "ANS Software",                     amountGbp: 0,                    costType: "dual",   sortOrder: 5 },
      { name: "Card Terminal Rental",             amountGbp: 0,                    costType: "dual",   sortOrder: 6 },
      { name: "Insurance (Indemnity + Premises)", amountGbp: 0,                    costType: "dual",   sortOrder: 7 },
      { name: "Accountant",                       amountGbp: 0,                    costType: "dual",   sortOrder: 8 },
      { name: "Waste Contract",                   amountGbp: 0,                    costType: "unique", sortOrder: 9 },
      { name: "Cleaner",                          amountGbp: 0,                    costType: "unique", sortOrder: 10 },
      { name: "Marketing Budget",                 amountGbp: 0,                    costType: "unique", sortOrder: 11 },
      { name: "Subscriptions & Sundries",         amountGbp: 0,                    costType: "dual",   sortOrder: 12 },
    ];
    await db.insert(fixedCostItemsTable).values(
      defaultItems.map(item => ({ projectId: property.projectId, propertyId: id, ...item }))
    );
  }

  // ── Step 5: Log the property selection decision ─────────────────────────────
  const annualCost = (monthlyRent + monthlyRates) * 12;
  await db.insert(decisionsTable).values({
    projectId: property.projectId,
    title: `Selected ${property.address || "property"} as active clinic location`,
    reasoning: `Property at ${property.address || "unknown address"} (${property.postcode || "no postcode"}) set as active. Monthly rent: £${monthlyRent.toFixed(0)}, monthly rates: £${monthlyRates.toFixed(0)}. Property costs synced — all other financial assumptions preserved.`,
    expectedImpact: `Annual occupancy cost of approximately £${annualCost.toFixed(0)} synced into the financial model.`,
    financialImpactGbp: -annualCost,
    category: "property",
  });

  return res.json({ ...updated, restored: false });
  } catch (err) {
    console.error("[set-active] unhandled error:", err);
    return res.status(500).json({ error: "Failed to set active property" });
  }
});

// ─── Unset Active Property ────────────────────────────────────────────────────

router.put("/properties/:id/unset-active", async (req, res) => {
  try {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid property id" });
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  const [updated] = await db.update(propertiesTable)
    .set({ isActiveForProject: false, pipelineStatus: "under_review", status: "viewing", updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();

  return res.json(updated);
  } catch (err) {
    console.error("[unset-active] unhandled error:", err);
    return res.status(500).json({ error: "Failed to unset active property" });
  }
});

// ─── Project Scoring Weights API ──────────────────────────────────────────────

router.get("/projects/:projectId/scoring-weights", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  return res.json(project.scoringWeights ?? DEFAULT_SCORING_WEIGHTS);
});

router.put("/projects/:projectId/scoring-weights", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const body = req.body as Partial<ScoringWeights>;

  // Merge with defaults to ensure all keys are present; clamp to 0-3
  const merged: ScoringWeights = {
    affordability: Math.max(0, Math.min(3, body.affordability ?? DEFAULT_SCORING_WEIGHTS.affordability)),
    size: Math.max(0, Math.min(3, body.size ?? DEFAULT_SCORING_WEIGHTS.size)),
    parking: Math.max(0, Math.min(3, body.parking ?? DEFAULT_SCORING_WEIGHTS.parking)),
    frontage: Math.max(0, Math.min(3, body.frontage ?? DEFAULT_SCORING_WEIGHTS.frontage)),
    location: Math.max(0, Math.min(3, body.location ?? DEFAULT_SCORING_WEIGHTS.location)),
    competition: Math.max(0, Math.min(3, body.competition ?? DEFAULT_SCORING_WEIGHTS.competition)),
    fitoutComplexity: Math.max(0, Math.min(3, body.fitoutComplexity ?? DEFAULT_SCORING_WEIGHTS.fitoutComplexity)),
    demographics: Math.max(0, Math.min(3, body.demographics ?? DEFAULT_SCORING_WEIGHTS.demographics)),
  };

  await db.update(projectsTable)
    .set({ scoringWeights: merged, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  return res.json(merged);
});

// ─── Per-Property Scoring Weight Override API ─────────────────────────────────

router.get("/properties/:id/scoring-weights", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!prop) return res.status(404).json({ error: "Property not found" });
  return res.json(prop.scoringWeights ?? null);
});

router.put("/properties/:id/scoring-weights", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!prop) return res.status(404).json({ error: "Property not found" });

  // null/empty body clears the per-property override (falls back to project weights)
  const body = req.body as Partial<ScoringWeights> | null;
  if (!body || Object.keys(body).length === 0) {
    await db.update(propertiesTable).set({ scoringWeights: null, updatedAt: new Date() }).where(eq(propertiesTable.id, id));
    return res.json(null);
  }

  const merged: ScoringWeights = {
    affordability: Math.max(0, Math.min(3, body.affordability ?? DEFAULT_SCORING_WEIGHTS.affordability)),
    size: Math.max(0, Math.min(3, body.size ?? DEFAULT_SCORING_WEIGHTS.size)),
    parking: Math.max(0, Math.min(3, body.parking ?? DEFAULT_SCORING_WEIGHTS.parking)),
    frontage: Math.max(0, Math.min(3, body.frontage ?? DEFAULT_SCORING_WEIGHTS.frontage)),
    location: Math.max(0, Math.min(3, body.location ?? DEFAULT_SCORING_WEIGHTS.location)),
    competition: Math.max(0, Math.min(3, body.competition ?? DEFAULT_SCORING_WEIGHTS.competition)),
    fitoutComplexity: Math.max(0, Math.min(3, body.fitoutComplexity ?? DEFAULT_SCORING_WEIGHTS.fitoutComplexity)),
    demographics: Math.max(0, Math.min(3, body.demographics ?? DEFAULT_SCORING_WEIGHTS.demographics)),
  };

  await db.update(propertiesTable).set({ scoringWeights: merged, updatedAt: new Date() }).where(eq(propertiesTable.id, id));
  return res.json(merged);
});

// ─── Property Ranking Engine ──────────────────────────────────────────────────

const RANKING_MODES = ["overall", "safest", "highest-revenue", "premium-brand", "lowest-risk", "fastest-launch"] as const;
type RankingMode = typeof RANKING_MODES[number];

function computePropertyScore(
  prop: typeof propertiesTable.$inferSelect,
  latestAnalysis: typeof propertyAiAnalysesTable.$inferSelect | null,
  mode: RankingMode,
  weights: ScoringWeights
): { score: number; breakdown: Record<string, number>; rationale: string } {
  const breakdown: Record<string, number> = {};

  // Effective weights: use per-property override if set, else project weights
  const effectiveWeights: ScoringWeights = (prop.scoringWeights as ScoringWeights | null) ?? weights;

  // Base scores from raw property data
  const monthlyRent = prop.monthlyRentGbp ?? 0;
  const sqFt = prop.sqFootage ?? 0;
  const parking = prop.parkingSpaces ?? 0;
  const frontage = prop.frontageMeters ?? 0;

  // Rent per sq ft efficiency (lower = better)
  const rentPerSqFt = sqFt > 0 && monthlyRent > 0 ? monthlyRent / sqFt : 10;
  const affordabilityScore = Math.max(0, Math.min(25, 25 - (rentPerSqFt - 1) * 5)) * effectiveWeights.affordability;
  breakdown.affordability = Math.round(affordabilityScore);

  // Size score (800–2000 sq ft is ideal)
  const rawSizeScore = sqFt >= 800 && sqFt <= 2000 ? 20
    : sqFt > 500 && sqFt < 800 ? 12
    : sqFt > 2000 && sqFt <= 3000 ? 15
    : sqFt > 0 ? 8 : 0;
  breakdown.size = Math.round(rawSizeScore * effectiveWeights.size);

  // Parking score
  const rawParkingScore = parking >= 3 ? 15 : parking === 2 ? 12 : parking === 1 ? 8 : 2;
  breakdown.parking = Math.round(rawParkingScore * effectiveWeights.parking);

  // Frontage score
  const rawFrontageScore = frontage >= 6 ? 15 : frontage >= 4 ? 12 : frontage >= 2 ? 8 : frontage > 0 ? 5 : 3;
  breakdown.frontage = Math.round(rawFrontageScore * effectiveWeights.frontage);

  // Pipeline stage score
  const pipelineStageScores: Record<string, number> = {
    found: 2, interesting: 4, brochure_requested: 6, viewing_booked: 8,
    viewed: 10, under_review: 12, due_diligence: 14, heads_of_terms: 16,
    negotiating: 16, rejected: 0, selected: 20,
  };
  const pipelineScore = pipelineStageScores[prop.pipelineStatus ?? "found"] ?? 5;
  breakdown.pipeline = pipelineScore;

  // Favourite bonus
  const favouriteBonus = prop.isFavourited ? 5 : 0;
  breakdown.favourite = favouriteBonus;

  // AI analysis scores (if available)
  let aiLocationScore = 0;
  let aiViabilityScore = 0;
  let aiClinicScore = 0;
  let aiCompetitionOpportunity = 0;

  if (latestAnalysis && latestAnalysis.analysisJson) {
    const aj = latestAnalysis.analysisJson as {
      locationScore?: { total: number };
      commercialViabilityScore?: { total: number };
      clinicSuitabilityScore?: { total: number };
      competition?: { opportunityScore: number };
    };
    aiLocationScore = (aj.locationScore?.total ?? 0) * effectiveWeights.location;
    aiViabilityScore = (aj.commercialViabilityScore?.total ?? 0) * effectiveWeights.demographics;
    aiClinicScore = (aj.clinicSuitabilityScore?.total ?? 0) * effectiveWeights.fitoutComplexity;
    aiCompetitionOpportunity = (aj.competition?.opportunityScore ?? 0) * effectiveWeights.competition;
    breakdown.aiLocation = Math.round(aiLocationScore);
    breakdown.aiViability = Math.round(aiViabilityScore);
    breakdown.aiClinic = Math.round(aiClinicScore);
    breakdown.aiCompetitionOpportunity = Math.round(aiCompetitionOpportunity);
  }

  let totalScore: number;
  let rationale: string;

  switch (mode) {
    case "safest": {
      const rentAffordable = monthlyRent < 3000 ? 30 : monthlyRent < 5000 ? 20 : 10;
      totalScore = rentAffordable + breakdown.parking + breakdown.pipeline + (aiViabilityScore * 0.4) + (aiCompetitionOpportunity * 0.3);
      rationale = `Safest launch: affordable rent (£${monthlyRent.toFixed(0)}/mo), ${parking} parking space${parking !== 1 ? "s" : ""}, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
      break;
    }
    case "highest-revenue": {
      totalScore = breakdown.size * 2 + (aiLocationScore * 0.5) + (aiViabilityScore * 0.6) + breakdown.frontage;
      rationale = `Revenue focus: ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"} space, AI viability ${Math.round(aiViabilityScore)}/100, AI location ${Math.round(aiLocationScore)}/100.`;
      break;
    }
    case "premium-brand": {
      totalScore = breakdown.frontage * 2 + (aiLocationScore * 0.6) + (aiClinicScore * 0.7) + breakdown.favourite * 2;
      rationale = `Premium brand fit: ${frontage > 0 ? frontage + "m frontage" : "frontage unknown"}, AI clinic suitability ${Math.round(aiClinicScore)}/100, AI location ${Math.round(aiLocationScore)}/100.`;
      break;
    }
    case "lowest-risk": {
      const dataCompleteness = [prop.address, prop.postcode, prop.monthlyRentGbp, prop.sqFootage, prop.agentName].filter(Boolean).length * 4;
      totalScore = breakdown.affordability * 1.5 + dataCompleteness + breakdown.pipeline * 1.5 + (aiViabilityScore * 0.3);
      rationale = `Lowest risk: ${breakdown.affordability > 15 ? "affordable rent" : "moderate rent"}, ${Math.round(dataCompleteness / 4 * 20)}% data complete, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
      break;
    }
    case "fastest-launch": {
      const today = new Date();
      let availabilityScore = 10;
      if (prop.availabilityDate) {
        const avail = new Date(prop.availabilityDate);
        const daysAway = (avail.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        availabilityScore = daysAway <= 30 ? 25 : daysAway <= 90 ? 20 : daysAway <= 180 ? 15 : 10;
      }
      totalScore = availabilityScore + breakdown.pipeline * 2 + breakdown.size + (aiClinicScore * 0.3);
      rationale = `Fastest launch: available ${prop.availabilityDate ? new Date(prop.availabilityDate).toLocaleDateString("en-GB") : "date TBD"}, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
      break;
    }
    default: {
      if (latestAnalysis) {
        totalScore = (aiLocationScore + aiViabilityScore + aiClinicScore) / 3
          + breakdown.parking
          + breakdown.frontage
          + breakdown.affordability
          + breakdown.pipeline
          + breakdown.favourite;
      } else {
        totalScore = breakdown.size
          + breakdown.parking
          + breakdown.frontage
          + breakdown.affordability
          + breakdown.pipeline
          + breakdown.favourite;
      }
      rationale = latestAnalysis
        ? `Overall score: AI grades — location ${Math.round(aiLocationScore)}/100, viability ${Math.round(aiViabilityScore)}/100, clinic fit ${Math.round(aiClinicScore)}/100. Physical: ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"}, ${parking} parking, ${frontage > 0 ? frontage + "m frontage" : "frontage unknown"}.`
        : `Overall score (no AI analysis yet): ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"}, rent £${monthlyRent.toFixed(0)}/mo, ${parking} parking, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
    }
  }

  return { score: Math.round(totalScore), breakdown, rationale };
}

router.get("/projects/:projectId/properties/ranking", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const mode = (req.query["mode"] as string | undefined) ?? "overall";

  if (!RANKING_MODES.includes(mode as RankingMode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${RANKING_MODES.join(", ")}` });
  }

  // Load project scoring weights
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const projectWeights: ScoringWeights = (project?.scoringWeights as ScoringWeights | null) ?? DEFAULT_SCORING_WEIGHTS;

  const properties = await db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId));

  // Fetch latest analysis for each property
  const analysesMap = new Map<number, typeof propertyAiAnalysesTable.$inferSelect>();
  for (const prop of properties) {
    const [latest] = await db.select()
      .from(propertyAiAnalysesTable)
      .where(eq(propertyAiAnalysesTable.propertyId, prop.id))
      .orderBy(desc(propertyAiAnalysesTable.version))
      .limit(1);
    if (latest) analysesMap.set(prop.id, latest);
  }

  // Score all non-rejected properties
  const scored = properties
    .filter(p => p.pipelineStatus !== "rejected")
    .map(prop => {
      const analysis = analysesMap.get(prop.id) ?? null;
      const { score, breakdown, rationale } = computePropertyScore(prop, analysis, mode as RankingMode, projectWeights);
      return { property: prop, score, breakdown, rationale, hasAnalysis: !!analysis };
    });

  // Sort: manual overrides first (ascending rank number), then by score descending
  scored.sort((a, b) => {
    const aOverride = a.property.manualRankOverride;
    const bOverride = b.property.manualRankOverride;
    if (aOverride !== null && aOverride !== undefined && bOverride !== null && bOverride !== undefined) {
      return aOverride - bOverride;
    }
    if (aOverride !== null && aOverride !== undefined) return -1;
    if (bOverride !== null && bOverride !== undefined) return 1;
    return b.score - a.score;
  });

  const rankings = scored.map((item, index) => ({
    rank: index + 1,
    propertyId: item.property.id,
    address: item.property.address,
    postcode: item.property.postcode,
    pipelineStatus: item.property.pipelineStatus,
    isActiveForProject: item.property.isActiveForProject,
    isFavourited: item.property.isFavourited,
    manualRankOverride: item.property.manualRankOverride,
    hasAnalysis: item.hasAnalysis,
    score: item.score,
    scoreBreakdown: item.breakdown,
    rationale: item.rationale,
  }));

  return res.json({ mode, rankings });
});

// ─── Property Location Search ──────────────────────────────────────────────────
router.post("/projects/:projectId/properties/search", async (req, res) => {
  const { location, radiusKm = 5, minSqft, maxSqft, minRentGbp, maxRentGbp, useClass, parkingRequired, highStreetOnly } = req.body;

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    return res.status(400).json({ error: "location is required" });
  }

  const criteria = {
    location: location.trim(),
    radiusKm,
    ...(minSqft != null && { minSqft }),
    ...(maxSqft != null && { maxSqft }),
    ...(minRentGbp != null && { minRentGbp }),
    ...(maxRentGbp != null && { maxRentGbp }),
    ...(useClass && { useClass }),
    ...(parkingRequired != null && { parkingRequired }),
    ...(highStreetOnly != null && { highStreetOnly }),
  };

  const sizeRange = minSqft || maxSqft
    ? `${minSqft ?? 0}–${maxSqft ?? "unlimited"} sq ft`
    : "any size";
  const rentRange = minRentGbp || maxRentGbp
    ? `£${minRentGbp ?? 0}–£${maxRentGbp ?? "unlimited"}/month`
    : "any rent";

  const prompt = `You are a commercial property specialist advising an aesthetics clinic operator in the UK.

The client is looking for clinic premises near: ${location.trim()}
Search radius: ${radiusKm}km
Size requirement: ${sizeRange}
Rent budget: ${rentRange}
${useClass ? `Use class preference: ${useClass}` : ""}
${parkingRequired ? "Parking: required" : ""}
${highStreetOnly ? "Location: high street / primary retail only" : ""}

Generate exactly 6 plausible UK commercial property locations within the specified area that would suit a premium aesthetics clinic. These should be real streets or commercial areas, not fictional addresses.

For each location return a JSON object with these exact fields:
- address: full street address (e.g. "14 High Street, Guildford")
- postcode: realistic UK postcode for this area
- lat: latitude (decimal, accurate to ~3 decimal places)
- lng: longitude (decimal, accurate to ~3 decimal places)
- estimatedMonthlyRentGbp: realistic monthly rent for a ~500-800 sq ft retail/clinic unit in this micro-location (integer)
- estimatedSqft: realistic size estimate for a clinic unit here (integer, 400-900 range)
- suitabilityScore: 0-100 integer — how suitable is this location for a premium aesthetics clinic (consider footfall, demographics, parking, competition saturation, unit type, discretion)
- rationale: 1-2 sentences explaining the score and suitability
- listingUrl: null (we cannot generate real listing URLs)
- useClass: most likely use class (e.g. "E(e)" or "E")
- strengths: array of 2-3 short strings (key positives)
- concerns: array of 1-2 short strings (key risks or drawbacks)

Return ONLY a JSON array of exactly 6 objects. No markdown, no explanation, just the raw JSON array.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let results: unknown[];

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      results = JSON.parse(cleaned);
      if (!Array.isArray(results)) throw new Error("not an array");
    } catch {
      return res.status(500).json({ error: "AI returned malformed data — please try again" });
    }

    // Normalise and validate each result
    const normalised = results.map((r: unknown) => {
      const item = r as Record<string, unknown>;
      return {
        address: String(item["address"] ?? ""),
        postcode: String(item["postcode"] ?? ""),
        lat: Number(item["lat"] ?? 0),
        lng: Number(item["lng"] ?? 0),
        estimatedMonthlyRentGbp: item["estimatedMonthlyRentGbp"] != null ? Number(item["estimatedMonthlyRentGbp"]) : null,
        estimatedSqft: item["estimatedSqft"] != null ? Number(item["estimatedSqft"]) : null,
        suitabilityScore: Math.min(100, Math.max(0, Math.round(Number(item["suitabilityScore"] ?? 50)))),
        rationale: String(item["rationale"] ?? ""),
        listingUrl: null,
        useClass: item["useClass"] != null ? String(item["useClass"]) : null,
        strengths: Array.isArray(item["strengths"]) ? item["strengths"].map(String) : [],
        concerns: Array.isArray(item["concerns"]) ? item["concerns"].map(String) : [],
      };
    });

    return res.json({ results: normalised, location: location.trim(), criteria });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("API key") || msg.includes("auth") || msg.includes("401")) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    return res.status(500).json({ error: msg });
  }
});

export default router;
