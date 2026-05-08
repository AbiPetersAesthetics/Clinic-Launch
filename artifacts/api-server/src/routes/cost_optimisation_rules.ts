import { Router } from "express";
import { db } from "@workspace/db";
import { costOptimisationRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VALID_CATEGORIES = new Set([
  "safe_to_reduce", "delayable", "non_negotiable",
  "dangerous_to_cut", "luxury_item", "operationally_critical",
]);
const VALID_SEVERITIES = new Set(["warning", "critical"]);

router.get("/projects/:projectId/cost-optimisation-rules", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const rows = await db.select().from(costOptimisationRulesTable)
    .where(eq(costOptimisationRulesTable.projectId, projectId))
    .orderBy(costOptimisationRulesTable.createdAt);
  return res.json(rows);
});

router.post("/projects/:projectId/cost-optimisation-rules", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const {
    keyword, itemTag, forceCategory, safeThreshold, dangerThreshold, notes,
    isAbsenceCheck, severityIfAbsent, rationale, isActive,
  } = req.body;

  if (!keyword || !rationale) {
    return res.status(400).json({ error: "keyword and rationale are required" });
  }
  if (forceCategory && !VALID_CATEGORIES.has(forceCategory)) {
    return res.status(400).json({ error: `Invalid forceCategory. Must be one of: ${[...VALID_CATEGORIES].join(", ")}` });
  }
  if (severityIfAbsent && !VALID_SEVERITIES.has(severityIfAbsent)) {
    return res.status(400).json({ error: "Invalid severityIfAbsent. Must be 'warning' or 'critical'" });
  }

  const [rule] = await db.insert(costOptimisationRulesTable).values({
    projectId,
    keyword,
    itemTag: itemTag ?? null,
    forceCategory: forceCategory ?? null,
    safeThreshold: safeThreshold != null ? Number(safeThreshold) : null,
    dangerThreshold: dangerThreshold != null ? Number(dangerThreshold) : null,
    notes: notes ?? null,
    isAbsenceCheck: isAbsenceCheck ?? false,
    severityIfAbsent: severityIfAbsent ?? "critical",
    rationale,
    isActive: isActive ?? true,
  }).returning();
  return res.status(201).json(rule);
});

router.put("/cost-optimisation-rules/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const {
    keyword, itemTag, forceCategory, safeThreshold, dangerThreshold, notes,
    isAbsenceCheck, severityIfAbsent, rationale, isActive,
  } = req.body;

  if (forceCategory && !VALID_CATEGORIES.has(forceCategory)) {
    return res.status(400).json({ error: `Invalid forceCategory. Must be one of: ${[...VALID_CATEGORIES].join(", ")}` });
  }
  if (severityIfAbsent && !VALID_SEVERITIES.has(severityIfAbsent)) {
    return res.status(400).json({ error: "Invalid severityIfAbsent. Must be 'warning' or 'critical'" });
  }

  const [rule] = await db.update(costOptimisationRulesTable)
    .set({
      keyword,
      itemTag: itemTag ?? null,
      forceCategory: forceCategory ?? null,
      safeThreshold: safeThreshold != null ? Number(safeThreshold) : null,
      dangerThreshold: dangerThreshold != null ? Number(dangerThreshold) : null,
      notes: notes ?? null,
      isAbsenceCheck,
      severityIfAbsent,
      rationale,
      isActive,
    })
    .where(eq(costOptimisationRulesTable.id, id))
    .returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  return res.json(rule);
});

router.delete("/cost-optimisation-rules/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(costOptimisationRulesTable).where(eq(costOptimisationRulesTable.id, id));
  res.status(204).send();
});

export default router;
