import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, phasesTable, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_PHASE_DURATION_DAYS = 14;

router.get("/projects/:projectId/timeline", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Not found" });

  const phases = await db
    .select()
    .from(phasesTable)
    .where(eq(phasesTable.projectId, projectId))
    .orderBy(phasesTable.sortOrder);

  const phasesWithTasks = await Promise.all(
    phases.map(async (phase) => {
      const tasks = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.phaseId, phase.id));

      const parsedTasks = tasks.map((t) => ({
        ...t,
        dependencies: t.dependencies ? JSON.parse(t.dependencies) : [],
      }));

      const durationDays = parsedTasks.reduce((sum, t) => sum + (t.durationDays ?? 0), 0) || DEFAULT_PHASE_DURATION_DAYS;
      const criticalTasks = parsedTasks.filter((t) => t.isCriticalRisk);

      return { phase, durationDays, criticalTasks };
    })
  );

  const totalDurationDays = phasesWithTasks.reduce((sum, p) => sum + p.durationDays, 0);

  // Back-calculate dates from the target opening date, working backwards through phases
  const openingDate = project.targetOpeningDate
    ? new Date(project.targetOpeningDate)
    : null;

  let cursor = openingDate ? new Date(openingDate) : new Date();

  // Process phases in reverse sortOrder (last phase ends on opening date)
  const reversedPhases = [...phasesWithTasks].reverse();
  const dateMap: Map<number, { startDate: string; endDate: string }> = new Map();

  for (const { phase, durationDays } of reversedPhases) {
    const endDate = new Date(cursor);
    const startDate = new Date(cursor);
    startDate.setDate(startDate.getDate() - durationDays);

    dateMap.set(phase.id, {
      endDate: endDate.toISOString().split("T")[0],
      startDate: startDate.toISOString().split("T")[0],
    });

    cursor = startDate;
  }

  const phasesResult = phasesWithTasks.map(({ phase, durationDays, criticalTasks }) => {
    const dates = dateMap.get(phase.id) ?? {
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    };
    return {
      id: phase.id,
      projectId: phase.projectId,
      name: phase.name,
      description: phase.description,
      sortOrder: phase.sortOrder,
      status: phase.status,
      durationDays,
      startDate: dates.startDate,
      endDate: dates.endDate,
      criticalTasks,
    };
  });

  return res.json({
    projectId,
    targetOpeningDate: project.targetOpeningDate ?? null,
    totalDurationDays,
    phases: phasesResult,
  });
});

export default router;
