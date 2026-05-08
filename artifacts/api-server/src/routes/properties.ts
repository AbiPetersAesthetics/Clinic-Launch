import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/properties", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const props = await db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId));
  res.json(props);
});

router.post("/projects/:projectId/properties", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = req.body;
  const [prop] = await db.insert(propertiesTable).values({
    ...body,
    projectId,
    status: body.status ?? "viewing",
  }).returning();
  res.status(201).json(prop);
});

router.get("/properties/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!prop) return res.status(404).json({ error: "Not found" });
  return res.json(prop);
});

router.put("/properties/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [prop] = await db.update(propertiesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();
  if (!prop) return res.status(404).json({ error: "Not found" });
  return res.json(prop);
});

router.delete("/properties/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(propertiesTable).where(eq(propertiesTable.id, id));
  res.status(204).send();
});

export default router;
