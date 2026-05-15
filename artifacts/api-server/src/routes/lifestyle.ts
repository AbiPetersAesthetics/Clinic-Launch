import { Router } from "express";
import { db } from "@workspace/db";
import { lifestylePlanTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/lifestyle", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [plan] = await db.select().from(lifestylePlanTable).where(eq(lifestylePlanTable.projectId, projectId));
  return res.json(plan ?? null);
});

router.put("/projects/:projectId/lifestyle", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = { ...req.body };
  delete body.id;
  delete body.projectId;
  delete body.createdAt;
  delete body.updatedAt;

  const [existing] = await db.select().from(lifestylePlanTable).where(eq(lifestylePlanTable.projectId, projectId));
  let plan;
  if (existing) {
    [plan] = await db.update(lifestylePlanTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(lifestylePlanTable.projectId, projectId))
      .returning();
  } else {
    [plan] = await db.insert(lifestylePlanTable)
      .values({ ...body, projectId })
      .returning();
  }
  return res.json(plan);
});

export default router;
