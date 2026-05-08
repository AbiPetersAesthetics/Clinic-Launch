import { Router } from "express";
import { db } from "@workspace/db";
import { costItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/tasks/:taskId/cost-items", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const items = await db.select().from(costItemsTable).where(eq(costItemsTable.taskId, taskId)).orderBy(costItemsTable.sortOrder);
  return res.json(items);
});

router.post("/tasks/:taskId/cost-items", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const { label, category, costLow, costMid, costHigh, notes, sortOrder } = req.body;

  const [item] = await db.insert(costItemsTable).values({
    taskId,
    label,
    category,
    costLow: costLow ?? 0,
    costMid: costMid ?? 0,
    costHigh: costHigh ?? 0,
    notes,
    sortOrder: sortOrder ?? 0,
  }).returning();

  return res.status(201).json(item);
});

router.put("/cost-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [item] = await db.update(costItemsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(costItemsTable.id, id))
    .returning();
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json(item);
});

router.delete("/cost-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(costItemsTable).where(eq(costItemsTable.id, id));
  res.status(204).send();
});

export default router;
