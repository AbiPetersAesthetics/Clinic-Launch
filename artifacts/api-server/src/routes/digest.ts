import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable, phasesTable, tasksTable, propertyTaskOverridesTable,
  propertiesTable, supplierQuotesTable, suppliersTable, complianceItemsTable,
  staffRolesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { claudeComplete } from "@workspace/integrations-anthropic-ai";

const router = Router();

// ── GET /projects/:projectId/weekly-digest ──────────────────────────────────
// The Monday brief: countdown, movement this week, due/overdue, money, tenders.
// ?ai=1 adds a short Claude-written "focus for the week".
router.get("/projects/:projectId/weekly-digest", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const withAi = req.query.ai === "1";

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const phases = await db.select().from(phasesTable)
    .where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const phaseIds = phases.map(p => p.id);
  const phaseName = new Map(phases.map(p => [p.id, p.name]));

  const baseTasks = phaseIds.length
    ? await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phaseIds))
    : [];

  // Merge property overrides (same pattern as the dashboard)
  const [activeProperty] = await db.select().from(propertiesTable)
    .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)))
    .limit(1);
  const overrides = activeProperty
    ? await db.select().from(propertyTaskOverridesTable)
        .where(eq(propertyTaskOverridesTable.propertyId, activeProperty.id))
    : [];
  const oMap = new Map(overrides.map(o => [o.taskId, o]));
  const tasks = baseTasks.map(t => {
    const o = oMap.get(t.id);
    return {
      ...t,
      status: (o?.status ?? t.status) as string,
      actualCost: (o?.actualCost ?? (t as Record<string, unknown>).actualCost ?? null) as number | null,
      committedCost: (o?.committedCost ?? (t as Record<string, unknown>).committedCost ?? null) as number | null,
      amountPaidGbp: (o?.amountPaidGbp ?? (t as Record<string, unknown>).amountPaidGbp ?? null) as number | null,
      updatedAt: (o?.updatedAt ?? t.updatedAt) as Date,
    };
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const openDate = project.targetOpeningDate ? new Date(project.targetOpeningDate) : null;
  const daysToOpen = openDate ? Math.ceil((openDate.getTime() - now.getTime()) / 86400000) : null;

  const brief = {
    generatedAt: now.toISOString(),
    daysToOpen,
    targetOpeningDate: project.targetOpeningDate ?? null,
    completedThisWeek: tasks
      .filter(t => t.status === "complete" && t.updatedAt && new Date(t.updatedAt) >= weekAgo)
      .map(t => ({ id: t.id, title: t.title, phase: phaseName.get(t.phaseId) })),
    inProgress: tasks
      .filter(t => t.status === "in_progress")
      .map(t => ({ id: t.id, title: t.title, phase: phaseName.get(t.phaseId), owner: t.owner })),
    overdue: tasks
      .filter(t => t.dueDate && new Date(t.dueDate) < now && !["complete", "deferred"].includes(t.status))
      .map(t => ({ id: t.id, title: t.title, due: t.dueDate, phase: phaseName.get(t.phaseId) })),
    dueNext7Days: tasks
      .filter(t => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= weekAhead && !["complete", "deferred"].includes(t.status))
      .map(t => ({ id: t.id, title: t.title, due: t.dueDate, phase: phaseName.get(t.phaseId) })),
    money: {
      paidToDate: Math.round(tasks.reduce((s, t) => s + (t.amountPaidGbp ?? (t.status !== "part-paid" ? t.actualCost ?? 0 : 0) ?? 0), 0)),
      committed: Math.round(tasks.reduce((s, t) => s + (t.committedCost ?? 0), 0)),
      plannedTotal: Math.round(tasks.reduce((s, t) => s + (t.selectedCost ?? 0), 0)),
    },
    tenders: await (async () => {
      const quotes = await db.select({ status: supplierQuotesTable.status })
        .from(supplierQuotesTable).where(eq(supplierQuotesTable.projectId, projectId));
      const suppliers = await db.select({ status: suppliersTable.status })
        .from(suppliersTable).where(eq(suppliersTable.projectId, projectId));
      return {
        suppliers: suppliers.length,
        contracted: suppliers.filter(s => s.status === "Contracted").length,
        quotesAwaitingDecision: quotes.filter(q => ["Received", "Shortlisted"].includes(q.status)).length,
      };
    })(),
    compliance: await (async () => {
      const items = await db.select({ status: complianceItemsTable.status })
        .from(complianceItemsTable).where(eq(complianceItemsTable.projectId, projectId));
      const done = items.filter(i => i.status === "complete").length;
      return { done, total: items.length };
    })(),
    hiring: await (async () => {
      const roles = await db.select().from(staffRolesTable).where(eq(staffRolesTable.projectId, projectId));
      const due: { name: string; startMonth: string | null; overdue: boolean }[] = [];
      for (const r of roles) {
        if (!["planned", "recruiting"].includes(r.status) || !r.startDate) continue;
        const [y, m] = r.startDate.split("-").map(Number);
        const recruitBy = new Date(y, m - 1 - Math.round(r.leadTimeWeeks / 4.345), 1);
        if (recruitBy <= now) due.push({ name: r.name, startMonth: r.startDate, overdue: recruitBy < new Date(now.getFullYear(), now.getMonth() - 1, 1) });
      }
      return due;
    })(),
  };

  let focus: string | null = null;
  if (withAi) {
    try {
      focus = await claudeComplete({
        maxTokens: 600,
        messages: [{
          role: "user",
          content: `You are the project advisor for a clinic opening on ${project.targetOpeningDate} (${daysToOpen} days away, currently at tender stage). Here is this week's position as JSON:\n${JSON.stringify(brief)}\n\nWrite a "focus for the week" for the owners: 3-5 plain-English sentences. Direct, specific to the data, no headers, no bullets, no flattery. If something is slipping, say so.`,
        }],
      });
    } catch {
      focus = null;
    }
  }

  return res.json({ ...brief, focus });
});

export default router;
