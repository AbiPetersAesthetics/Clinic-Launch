import { Router } from "express";
import { db } from "@workspace/db";
import { phasesTable, tasksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/phases", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId)).orderBy(phasesTable.sortOrder);

  // Enrich with task counts and cost totals
  const enriched = await Promise.all(phases.map(async (phase) => {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phase.id));
    const totalCostLow = tasks.reduce((sum, t) => sum + t.costLow, 0);
    const totalCostMid = tasks.reduce((sum, t) => sum + t.costMid, 0);
    const totalCostHigh = tasks.reduce((sum, t) => sum + t.costHigh, 0);
    const completedTaskCount = tasks.filter(t => t.status === "complete").length;
    return { ...phase, totalCostLow, totalCostMid, totalCostHigh, taskCount: tasks.length, completedTaskCount };
  }));

  res.json(enriched);
});

router.post("/projects/:projectId/phases", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { name, description, sortOrder, status } = req.body;
  const [phase] = await db.insert(phasesTable).values({
    projectId,
    name,
    description,
    sortOrder: sortOrder ?? 0,
    status: status ?? "not_started",
  }).returning();
  res.status(201).json({ ...phase, totalCostLow: 0, totalCostMid: 0, totalCostHigh: 0, taskCount: 0, completedTaskCount: 0 });
});

router.put("/phases/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, sortOrder, status } = req.body;
  const [phase] = await db.update(phasesTable)
    .set({ name, description, sortOrder, status, updatedAt: new Date() })
    .where(eq(phasesTable.id, id))
    .returning();
  if (!phase) return res.status(404).json({ error: "Not found" });
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, id));
  const totalCostLow = tasks.reduce((sum, t) => sum + t.costLow, 0);
  const totalCostMid = tasks.reduce((sum, t) => sum + t.costMid, 0);
  const totalCostHigh = tasks.reduce((sum, t) => sum + t.costHigh, 0);
  const completedTaskCount = tasks.filter(t => t.status === "complete").length;
  return res.json({ ...phase, totalCostLow, totalCostMid, totalCostHigh, taskCount: tasks.length, completedTaskCount });
});

router.delete("/phases/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(tasksTable).where(eq(tasksTable.phaseId, id));
  await db.delete(phasesTable).where(eq(phasesTable.id, id));
  res.status(204).send();
});

router.get("/projects/:projectId/phases-with-tasks", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId)).orderBy(phasesTable.sortOrder);

  const result = await Promise.all(phases.map(async (phase) => {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phase.id)).orderBy(tasksTable.sortOrder);
    const parsedTasks = tasks.map(t => ({
      ...t,
      dependencies: t.dependencies ? JSON.parse(t.dependencies) : [],
    }));
    const totalCostLow = parsedTasks.reduce((sum, t) => sum + t.costLow, 0);
    const totalCostMid = parsedTasks.reduce((sum, t) => sum + t.costMid, 0);
    const totalCostHigh = parsedTasks.reduce((sum, t) => sum + t.costHigh, 0);
    const selectedCostTotal = parsedTasks.reduce((sum, t) => sum + t.selectedCost, 0);
    const completedTaskCount = parsedTasks.filter(t => t.status === "complete").length;
    return {
      ...phase,
      totalCostLow, totalCostMid, totalCostHigh, selectedCostTotal,
      taskCount: parsedTasks.length, completedTaskCount,
      tasks: parsedTasks,
    };
  }));

  res.json(result);
});

export default router;
