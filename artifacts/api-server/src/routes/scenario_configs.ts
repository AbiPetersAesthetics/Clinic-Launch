import { Router } from "express";
import { db } from "@workspace/db";
import { scenarioConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/scenario-configs", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const configs = await db.select().from(scenarioConfigsTable).where(eq(scenarioConfigsTable.projectId, projectId)).orderBy(scenarioConfigsTable.createdAt);
  return res.json(configs);
});

router.post("/projects/:projectId/scenario-configs", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { name, description, occupancyPercent, revenueMultiplier, notes, isDefault } = req.body;

  const [config] = await db.insert(scenarioConfigsTable).values({
    projectId,
    name,
    description,
    occupancyPercent: occupancyPercent ?? 65,
    revenueMultiplier: revenueMultiplier ?? 1,
    notes,
    isDefault: isDefault ?? false,
  }).returning();

  return res.status(201).json(config);
});

router.put("/scenario-configs/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [config] = await db.update(scenarioConfigsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(scenarioConfigsTable.id, id))
    .returning();
  if (!config) return res.status(404).json({ error: "Not found" });
  return res.json(config);
});

router.delete("/scenario-configs/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(scenarioConfigsTable).where(eq(scenarioConfigsTable.id, id));
  res.status(204).send();
});

export default router;
