import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/projects", async (req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  res.json(projects);
});

router.post("/projects", async (req, res) => {
  const { name, description, targetLocation, targetOpeningDate, status } = req.body;
  const [project] = await db.insert(projectsTable).values({
    name,
    description,
    targetLocation,
    targetOpeningDate,
    status: status ?? "planning",
    launchReadinessPercent: 0,
  }).returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) return res.status(404).json({ error: "Not found" });
  return res.json(project);
});

router.put("/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, targetLocation, targetOpeningDate, status } = req.body;
  const [project] = await db.update(projectsTable)
    .set({ name, description, targetLocation, targetOpeningDate, status, updatedAt: new Date() })
    .where(eq(projectsTable.id, id))
    .returning();
  if (!project) return res.status(404).json({ error: "Not found" });
  return res.json(project);
});

router.delete("/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

export default router;
