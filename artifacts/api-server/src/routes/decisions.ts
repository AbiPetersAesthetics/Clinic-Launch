import { Router } from "express";
import { db } from "@workspace/db";
import { decisionsTable } from "@workspace/db";
import { eq, and, desc, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/decisions", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { category, search } = req.query as { category?: string; search?: string };

  let query = db.select().from(decisionsTable).where(eq(decisionsTable.projectId, projectId));

  const conditions = [eq(decisionsTable.projectId, projectId)];
  if (category && category !== "all") {
    conditions.push(eq(decisionsTable.category, category));
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const rows = await db.select().from(decisionsTable)
      .where(and(
        eq(decisionsTable.projectId, projectId),
        or(ilike(decisionsTable.title, term), ilike(decisionsTable.reasoning, term))
      ))
      .orderBy(desc(decisionsTable.createdAt));
    if (category && category !== "all") {
      return res.json(rows.filter(r => r.category === category));
    }
    return res.json(rows);
  }

  const rows = await db.select().from(decisionsTable)
    .where(and(...conditions))
    .orderBy(desc(decisionsTable.createdAt));
  return res.json(rows);
});

router.post("/projects/:projectId/decisions", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { title, reasoning, expectedImpact, financialImpactGbp, category } = req.body;

  if (!title || !reasoning) {
    return res.status(400).json({ error: "title and reasoning are required" });
  }

  const [decision] = await db.insert(decisionsTable).values({
    projectId,
    title,
    reasoning,
    expectedImpact: expectedImpact ?? null,
    financialImpactGbp: financialImpactGbp ?? 0,
    category: category ?? "general",
  }).returning();
  return res.status(201).json(decision);
});

router.put("/decisions/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { title, reasoning, expectedImpact, financialImpactGbp, category } = req.body;

  const [decision] = await db.update(decisionsTable)
    .set({ title, reasoning, expectedImpact, financialImpactGbp, category, updatedAt: new Date() })
    .where(eq(decisionsTable.id, id))
    .returning();
  if (!decision) return res.status(404).json({ error: "Decision not found" });
  return res.json(decision);
});

router.delete("/decisions/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(decisionsTable).where(eq(decisionsTable.id, id));
  res.status(204).send();
});

export default router;
