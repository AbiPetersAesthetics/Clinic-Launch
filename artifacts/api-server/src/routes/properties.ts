import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable, propertyAiAnalysesTable, financialsTable, decisionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/properties", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const props = await db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId));
  res.json(props);
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

router.delete("/properties/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(propertiesTable).where(eq(propertiesTable.id, id));
  res.status(204).send();
});

// ─── Set Active Property ──────────────────────────────────────────────────────

router.put("/properties/:id/set-active", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) return res.status(404).json({ error: "Property not found" });

  // Clear active flag on all other properties for this project
  await db.update(propertiesTable)
    .set({ isActiveForProject: false })
    .where(and(
      eq(propertiesTable.projectId, property.projectId),
      eq(propertiesTable.isActiveForProject, true)
    ));

  // Set this property as active
  const [updated] = await db.update(propertiesTable)
    .set({ isActiveForProject: true, pipelineStatus: "selected", status: "active", updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();

  // Sync rent and rates into financial model
  const monthlyRent = property.monthlyRentGbp ?? 0;
  const monthlyRates = property.businessRatesGbp ? Math.round(property.businessRatesGbp / 12) : 0;

  const [existingModel] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, property.projectId));
  if (existingModel) {
    await db.update(financialsTable)
      .set({ rentGbp: monthlyRent, ratesGbp: monthlyRates, updatedAt: new Date() })
      .where(eq(financialsTable.projectId, property.projectId));
  } else {
    await db.insert(financialsTable).values({
      projectId: property.projectId,
      rentGbp: monthlyRent,
      ratesGbp: monthlyRates,
    });
  }

  // Create a Decision Log entry
  const annualCost = (monthlyRent + monthlyRates) * 12;
  await db.insert(decisionsTable).values({
    projectId: property.projectId,
    title: `Selected ${property.address || "property"} as active clinic location`,
    reasoning: `Property at ${property.address || "unknown address"} (${property.postcode || "no postcode"}) has been selected as the active project location. Monthly rent: £${monthlyRent.toFixed(0)}, monthly rates: £${monthlyRates.toFixed(0)}. Rent and business rates have been automatically synced into the financial model.`,
    expectedImpact: `Annual occupancy cost of approximately £${annualCost.toFixed(0)} has been updated in the financial model.`,
    financialImpactGbp: -annualCost,
    category: "property",
  });

  return res.json(updated);
});

// ─── Property Ranking Engine ──────────────────────────────────────────────────

const RANKING_MODES = ["overall", "safest", "highest-revenue", "premium-brand", "lowest-risk", "fastest-launch"] as const;
type RankingMode = typeof RANKING_MODES[number];

function computePropertyScore(
  prop: typeof propertiesTable.$inferSelect,
  latestAnalysis: typeof propertyAiAnalysesTable.$inferSelect | null,
  mode: RankingMode
): { score: number; breakdown: Record<string, number>; rationale: string } {
  const breakdown: Record<string, number> = {};

  // Base scores from raw property data
  const monthlyRent = prop.monthlyRentGbp ?? 0;
  const sqFt = prop.sqFootage ?? 0;
  const parking = prop.parkingSpaces ?? 0;
  const frontage = prop.frontageMeters ?? 0;

  // Rent per sq ft efficiency (lower = better for safest/lowest-risk)
  const rentPerSqFt = sqFt > 0 && monthlyRent > 0 ? monthlyRent / sqFt : 10;
  const affordabilityScore = Math.max(0, Math.min(25, 25 - (rentPerSqFt - 1) * 5));
  breakdown.affordability = Math.round(affordabilityScore);

  // Size score (800–2000 sq ft is ideal for aesthetics clinic)
  const sizeScore = sqFt >= 800 && sqFt <= 2000
    ? 20
    : sqFt > 500 && sqFt < 800
    ? 12
    : sqFt > 2000 && sqFt <= 3000
    ? 15
    : sqFt > 0
    ? 8
    : 0;
  breakdown.size = sizeScore;

  // Parking score
  const parkingScore = parking >= 3 ? 15 : parking === 2 ? 12 : parking === 1 ? 8 : 2;
  breakdown.parking = parkingScore;

  // Frontage score
  const frontageScore = frontage >= 6 ? 15 : frontage >= 4 ? 12 : frontage >= 2 ? 8 : frontage > 0 ? 5 : 3;
  breakdown.frontage = frontageScore;

  // Pipeline stage score (further along = more validated)
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

  if (latestAnalysis && latestAnalysis.analysisJson) {
    const aj = latestAnalysis.analysisJson as {
      locationScore?: { total: number };
      commercialViabilityScore?: { total: number };
      clinicSuitabilityScore?: { total: number };
      competition?: { opportunityScore: number };
    };
    aiLocationScore = aj.locationScore?.total ?? 0;
    aiViabilityScore = aj.commercialViabilityScore?.total ?? 0;
    aiClinicScore = aj.clinicSuitabilityScore?.total ?? 0;
    breakdown.aiLocation = aiLocationScore;
    breakdown.aiViability = aiViabilityScore;
    breakdown.aiClinic = aiClinicScore;
    breakdown.aiCompetitionOpportunity = aj.competition?.opportunityScore ?? 0;
  }

  let totalScore: number;
  let rationale: string;

  switch (mode) {
    case "safest": {
      // Prioritise affordability, lower competition, and further pipeline validation
      const rentAffordable = monthlyRent < 3000 ? 30 : monthlyRent < 5000 ? 20 : 10;
      totalScore = rentAffordable + breakdown.parking + breakdown.pipeline + (aiViabilityScore * 0.4) + (breakdown.aiCompetitionOpportunity ?? 0) * 0.3;
      rationale = `Safest launch: affordable rent (£${monthlyRent.toFixed(0)}/mo), ${parking} parking space${parking !== 1 ? "s" : ""}, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
      break;
    }
    case "highest-revenue": {
      // Prioritise size, location quality, and viability score
      totalScore = breakdown.size * 2 + (aiLocationScore * 0.5) + (aiViabilityScore * 0.6) + breakdown.frontage;
      rationale = `Revenue focus: ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"} space, AI viability ${aiViabilityScore}/100, AI location ${aiLocationScore}/100.`;
      break;
    }
    case "premium-brand": {
      // Prioritise frontage, location, clinic suitability
      totalScore = breakdown.frontage * 2 + (aiLocationScore * 0.6) + (aiClinicScore * 0.7) + breakdown.favourite * 2;
      rationale = `Premium brand fit: ${frontage > 0 ? frontage + "m frontage" : "frontage unknown"}, AI clinic suitability ${aiClinicScore}/100, AI location ${aiLocationScore}/100.`;
      break;
    }
    case "lowest-risk": {
      // Minimise rent exposure, maximise pipeline progress, penalise missing data
      const dataCompleteness = [prop.address, prop.postcode, prop.monthlyRentGbp, prop.sqFootage, prop.agentName].filter(Boolean).length * 4;
      totalScore = breakdown.affordability * 1.5 + dataCompleteness + breakdown.pipeline * 1.5 + (aiViabilityScore * 0.3);
      rationale = `Lowest risk: ${breakdown.affordability > 15 ? "affordable rent" : "moderate rent"}, ${Math.round(dataCompleteness / 4 * 20)}% data complete, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
      break;
    }
    case "fastest-launch": {
      // Prioritise availability date and pipeline stage
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
      // Overall balanced score
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
        ? `Overall score: AI grades — location ${aiLocationScore}/100, viability ${aiViabilityScore}/100, clinic fit ${aiClinicScore}/100. Physical: ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"}, ${parking} parking, ${frontage > 0 ? frontage + "m frontage" : "frontage unknown"}.`
        : `Overall score (no AI analysis yet): ${sqFt > 0 ? sqFt.toFixed(0) + " sq ft" : "size unknown"}, rent £${monthlyRent.toFixed(0)}/mo, ${parking} parking, ${prop.pipelineStatus?.replace("_", " ")} stage.`;
    }
  }

  // Apply manual rank override — if set, boost by a large amount to force it above others
  // (handled at ranking level by sorting overrides first)

  return { score: Math.round(totalScore), breakdown, rationale };
}

router.get("/projects/:projectId/properties/ranking", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const mode = (req.query["mode"] as string | undefined) ?? "overall";

  if (!RANKING_MODES.includes(mode as RankingMode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${RANKING_MODES.join(", ")}` });
  }

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
      const { score, breakdown, rationale } = computePropertyScore(prop, analysis, mode as RankingMode);
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

export default router;
