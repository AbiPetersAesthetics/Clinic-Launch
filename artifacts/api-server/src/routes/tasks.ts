import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, propertyTaskOverridesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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
  const propertyId: number | undefined = body.propertyId ? parseInt(body.propertyId) : undefined;

  // If a propertyId is provided, upsert into property_task_overrides instead of the base task
  if (propertyId) {
    const overridableFields: Record<string, unknown> = {};
    const mutableKeys = ["status", "notes", "owner", "contractor", "supplier",
      "costTier", "costLow", "costMid", "costHigh", "dueDate", "durationDays", "files", "quotes"] as const;
    for (const key of mutableKeys) {
      if (body[key] !== undefined) overridableFields[key === "costTier" ? "costTier" : key] = body[key];
    }

    const tier = (body.costTier ?? existing.costTier) as string;
    const low = body.costLow ?? existing.costLow;
    const mid = body.costMid ?? existing.costMid;
    const high = body.costHigh ?? existing.costHigh;
    overridableFields.selectedCost = getSelectedCost(tier, low, mid, high);
    overridableFields.updatedAt = new Date();

    // Map camelCase to snake_case column names for Drizzle
    const overrideRow = {
      propertyId,
      taskId: id,
      status: body.status ?? null,
      notes: body.notes ?? null,
      owner: body.owner ?? null,
      contractor: body.contractor ?? null,
      supplier: body.supplier ?? null,
      costTier: body.costTier ?? null,
      costLow: body.costLow ?? null,
      costMid: body.costMid ?? null,
      costHigh: body.costHigh ?? null,
      selectedCost: overridableFields.selectedCost as number,
      dueDate: body.dueDate ?? null,
      durationDays: body.durationDays ?? null,
      files: body.files ?? null,
      quotes: body.quotes ?? null,
      updatedAt: new Date(),
    };

    const [existing_override] = await db.select().from(propertyTaskOverridesTable)
      .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));

    if (existing_override) {
      await db.update(propertyTaskOverridesTable)
        .set(overrideRow)
        .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));
    } else {
      await db.insert(propertyTaskOverridesTable).values(overrideRow);
    }

    // Return the merged task
    const mergedTask = {
      ...existing,
      ...overrideRow,
      dependencies: existing.dependencies ? JSON.parse(existing.dependencies) : [],
      _hasOverride: true,
    };
    return res.json(mergedTask);
  }

  // No propertyId — update the base task directly
  const tier = body.costTier ?? existing.costTier;
  const low = body.costLow ?? existing.costLow;
  const mid = body.costMid ?? existing.costMid;
  const high = body.costHigh ?? existing.costHigh;

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  delete updates.propertyId;
  updates.selectedCost = getSelectedCost(tier, low, mid, high);

  if (body.dependencies !== undefined) {
    updates.dependencies = body.dependencies ? JSON.stringify(body.dependencies) : null;
  }

  if (body.quotes !== undefined) {
    updates.quotes = body.quotes ?? [];
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
