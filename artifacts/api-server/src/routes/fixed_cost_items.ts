import { Router } from "express";
import { db } from "@workspace/db";
import { fixedCostItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── GET /projects/:projectId/fixed-cost-items ────────────────────────────────
router.get("/projects/:projectId/fixed-cost-items", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const items = await db
    .select()
    .from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId))
    .orderBy(fixedCostItemsTable.sortOrder, fixedCostItemsTable.createdAt);
  return res.json(items);
});

// ─── POST /projects/:projectId/fixed-cost-items ───────────────────────────────
router.post("/projects/:projectId/fixed-cost-items", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { name, amountGbp, costType, sortOrder } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  if (!["unique", "dual"].includes(costType)) {
    return res.status(400).json({ error: "costType must be 'unique' or 'dual'" });
  }

  const [item] = await db
    .insert(fixedCostItemsTable)
    .values({
      projectId,
      name: name.trim(),
      amountGbp: amountGbp ?? 0,
      costType: costType ?? "unique",
      sortOrder: sortOrder ?? 0,
    })
    .returning();

  return res.status(201).json(item);
});

// ─── PUT /fixed-cost-items/:id ────────────────────────────────────────────────
router.put("/fixed-cost-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, amountGbp, costType, sortOrder } = req.body;

  if (costType && !["unique", "dual"].includes(costType)) {
    return res.status(400).json({ error: "costType must be 'unique' or 'dual'" });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = String(name).trim();
  if (amountGbp !== undefined) updateData.amountGbp = Number(amountGbp) || 0;
  if (costType !== undefined) updateData.costType = costType;
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;

  const [item] = await db
    .update(fixedCostItemsTable)
    .set(updateData)
    .where(eq(fixedCostItemsTable.id, id))
    .returning();

  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json(item);
});

// ─── DELETE /fixed-cost-items/:id ────────────────────────────────────────────
router.delete("/fixed-cost-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(fixedCostItemsTable).where(eq(fixedCostItemsTable.id, id));
  res.status(204).send();
});

export default router;
