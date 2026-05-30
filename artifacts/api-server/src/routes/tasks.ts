import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, propertyTaskOverridesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

function getSelectedCost(costTier: string, costLow: number, costMid: number, costHigh: number, currentSelectedCost = 0): number {
  if (costTier === "quoted") return currentSelectedCost; // preserve quote-applied amount
  if (costTier === "low") return costLow;
  if (costTier === "high") return costHigh;
  return costMid;
}

router.get("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phaseId)).orderBy(sql`${tasksTable.dueDate} ASC NULLS LAST, ${tasksTable.sortOrder} ASC`);
  res.json(tasks.map(t => ({ ...t, dependencies: t.dependencies ? JSON.parse(t.dependencies) : [] })));
});

router.post("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const {
    title, description, owner, contractor, supplier,
    status, riskLevel, costTier, costLow, costMid, costHigh,
    dueDate, startDate, durationDays, dependencies, notes,
    isNonNegotiable, isCriticalRisk, sortOrder,
    costVatStatus, supplyScope, procurementStatus,
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
    startDate,
    dueDate,
    durationDays,
    dependencies: dependencies ? JSON.stringify(dependencies) : null,
    notes,
    isNonNegotiable: isNonNegotiable ?? false,
    isCriticalRisk: isCriticalRisk ?? false,
    costVatStatus: costVatStatus ?? "vat_unknown",
    supplyScope: supplyScope ?? "to_confirm",
    procurementStatus: procurementStatus ?? "to_specify",
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
  const id = parseInt(req.params["id"] as string);

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const body = req.body;
  const propertyId: number | undefined = body.propertyId ? parseInt(body.propertyId) : undefined;

  // If a propertyId is provided, upsert into property_task_overrides instead of the base task
  if (propertyId) {
    // Fetch existing override FIRST so we can use it as a fallback for selectedCost calculation
    const [existing_override] = await db.select().from(propertyTaskOverridesTable)
      .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));

    // Build a patch containing ONLY the fields explicitly present in the request body.
    // Never write null for fields not in the request — the merge in phases-with-tasks uses
    // `o.field !== undefined ? o.field : t.field`, so a stored null would wipe the base task value.
    const mutableKeys = ["status", "notes", "owner", "contractor", "supplier",
      "costTier", "costLow", "costMid", "costHigh", "startDate", "dueDate", "durationDays", "files", "quotes",
      "costVatStatus", "supplyScope", "procurementStatus"] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of mutableKeys) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    // Recalculate selectedCost using override → base fallback chain
    const tier = (body.costTier ?? existing_override?.costTier ?? existing.costTier) as string;
    const low = body.costLow ?? existing_override?.costLow ?? existing.costLow;
    const mid = body.costMid ?? existing_override?.costMid ?? existing.costMid;
    const high = body.costHigh ?? existing_override?.costHigh ?? existing.costHigh;
    const currentSelectedCost = body.selectedCost ?? existing_override?.selectedCost ?? existing.selectedCost;
    patch.selectedCost = getSelectedCost(tier, low, mid, high, currentSelectedCost);

    if (existing_override) {
      await db.update(propertyTaskOverridesTable)
        .set(patch)
        .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));
    } else {
      await db.insert(propertyTaskOverridesTable).values({ propertyId, taskId: id, ...patch });
    }

    // Build a synthetic overrideRow for the return value (merges patch over existing override)
    const overrideRow = { ...(existing_override ?? {}), ...patch, propertyId, taskId: id };

    // Global fields (not property-specific) must also be written back to the base task.
    // description, title, riskLevel, isNonNegotiable, isCriticalRisk have no columns in
    // property_task_overrides — without this they are silently dropped on every save.
    const globalUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)           globalUpdates.title = body.title;
    if (body.description !== undefined)     globalUpdates.description = body.description;
    if (body.riskLevel !== undefined)       globalUpdates.riskLevel = body.riskLevel;
    if (body.isNonNegotiable !== undefined) globalUpdates.isNonNegotiable = body.isNonNegotiable;
    if (body.isCriticalRisk !== undefined)  globalUpdates.isCriticalRisk = body.isCriticalRisk;
    if (body.phaseId !== undefined)         globalUpdates.phaseId = body.phaseId;
    if (body.dependencies !== undefined) {
      globalUpdates.dependencies = body.dependencies ? JSON.stringify(body.dependencies) : null;
    }

    const [updatedBase] = await db.update(tasksTable)
      .set(globalUpdates)
      .where(eq(tasksTable.id, id))
      .returning();

    // Return the merged task: base (with global updates) + property override
    const mergedTask = {
      ...(updatedBase ?? existing),
      ...overrideRow,
      dependencies: (updatedBase ?? existing).dependencies
        ? JSON.parse((updatedBase ?? existing).dependencies as string)
        : [],
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
  // For "quoted" tier, preserve the quote-set selectedCost unless explicitly overridden
  updates.selectedCost = getSelectedCost(tier, low, mid, high, body.selectedCost ?? existing.selectedCost);

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
