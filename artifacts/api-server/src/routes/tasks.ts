import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function getSelectedCost(costTier: string, costLow: number, costMid: number, costHigh: number): number {
  if (costTier === "low") return costLow;
  if (costTier === "high") return costHigh;
  return costMid;
}

router.get("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phaseId)).orderBy(tasksTable.sortOrder);
  res.json(tasks.map(t => ({ ...t, dependencies: t.dependencies ? JSON.parse(t.dependencies) : [] })));
});

router.post("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const {
    title, description, owner, contractor, supplier,
    status, riskLevel, costTier, costLow, costMid, costHigh,
    dueDate, durationDays, dependencies, notes,
    isNonNegotiable, isCriticalRisk, sortOrder,
  } = req.body;

  const tier = costTier ?? "mid";
  const low = costLow ?? 0;
  const mid = costMid ?? 0;
  const high = costHigh ?? 0;

  const [task] = await db.insert(tasksTable).values({
    phaseId,
    title,
    description,
    owner,
    contractor,
    supplier,
    status: status ?? "not_started",
    riskLevel: riskLevel ?? "low",
    costTier: tier,
    costLow: low,
    costMid: mid,
    costHigh: high,
    selectedCost: getSelectedCost(tier, low, mid, high),
    dueDate,
    durationDays,
    dependencies: dependencies ? JSON.stringify(dependencies) : null,
    notes,
    isNonNegotiable: isNonNegotiable ?? false,
    isCriticalRisk: isCriticalRisk ?? false,
    sortOrder: sortOrder ?? 0,
  }).returning();

  res.status(201).json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
});

router.get("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) return res.status(404).json({ error: "Not found" });
  return res.json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
});

async function handleTaskUpdate(req: import("express").Request, res: import("express").Response) {
  const id = parseInt(req.params.id);

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const body = req.body;

  const tier = body.costTier ?? existing.costTier;
  const low = body.costLow ?? existing.costLow;
  const mid = body.costMid ?? existing.costMid;
  const high = body.costHigh ?? existing.costHigh;

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  updates.selectedCost = getSelectedCost(tier, low, mid, high);

  if (body.dependencies !== undefined) {
    updates.dependencies = body.dependencies ? JSON.stringify(body.dependencies) : null;
  }

  const [task] = await db.update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, id))
    .returning();
  if (!task) return res.status(404).json({ error: "Not found" });
  return res.json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
}

router.put("/tasks/:id", handleTaskUpdate);

router.patch("/tasks/:id", handleTaskUpdate);

router.delete("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

export default router;
