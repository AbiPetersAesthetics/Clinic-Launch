import { Router } from "express";
import { db, competitorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(eq(competitorsTable.projectId, projectId))
    .orderBy(competitorsTable.createdAt);
  return res.json({ competitors });
});

router.post("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const [created] = await db
    .insert(competitorsTable)
    .values({ ...req.body, projectId, updatedAt: new Date() })
    .returning();
  return res.json({ competitor: created });
});

router.put("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  const [updated] = await db
    .update(competitorsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)))
    .returning();
  return res.json({ competitor: updated });
});

router.delete("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  await db
    .delete(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));
  return res.json({ ok: true });
});

export default router;
