import { Router } from "express";
import { db } from "@workspace/db";
import { complianceItemsTable, cqcMilestonesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/compliance/items", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const rows = await db.select().from(complianceItemsTable)
    .where(eq(complianceItemsTable.projectId, projectId))
    .orderBy(asc(complianceItemsTable.section), asc(complianceItemsTable.sortOrder));
  return res.json(rows);
});

router.post("/projects/:projectId/compliance/items", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { section, title, description, status, policyStatus, requiredByDate, notes, attachmentUrl, sortOrder } = req.body;
  if (!section || !title) return res.status(400).json({ error: "section and title are required" });
  const [row] = await db.insert(complianceItemsTable).values({
    projectId,
    section,
    title,
    description: description ?? null,
    status: status ?? "not_started",
    policyStatus: policyStatus ?? null,
    requiredByDate: requiredByDate ?? null,
    notes: notes ?? null,
    attachmentUrl: attachmentUrl ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  return res.status(201).json(row);
});

router.put("/compliance/items/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { section, title, description, status, policyStatus, requiredByDate, notes, attachmentUrl, sortOrder } = req.body;
  const [row] = await db.update(complianceItemsTable)
    .set({ section, title, description, status, policyStatus, requiredByDate, notes, attachmentUrl, sortOrder, updatedAt: new Date() })
    .where(eq(complianceItemsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.delete("/compliance/items/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(complianceItemsTable).where(eq(complianceItemsTable.id, id));
  return res.status(204).send();
});

router.get("/projects/:projectId/compliance/summary", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const items = await db.select().from(complianceItemsTable)
    .where(eq(complianceItemsTable.projectId, projectId));

  const sections = [...new Set(items.map(i => i.section))];
  const sectionSummaries = sections.map(section => {
    const sectionItems = items.filter(i => i.section === section);
    const applicable = sectionItems.filter(i => i.status !== "not_applicable");
    const complete = applicable.filter(i => i.status === "complete" || i.policyStatus === "signed_off");
    const pct = applicable.length > 0 ? Math.round((complete.length / applicable.length) * 100) : 0;
    return { section, total: sectionItems.length, applicable: applicable.length, complete: complete.length, percentComplete: pct };
  });

  const applicable = items.filter(i => i.status !== "not_applicable");
  const complete = applicable.filter(i => i.status === "complete" || i.policyStatus === "signed_off");
  const overallScore = applicable.length > 0 ? Math.round((complete.length / applicable.length) * 100) : 0;

  const milestones = await db.select().from(cqcMilestonesTable)
    .where(eq(cqcMilestonesTable.projectId, projectId))
    .orderBy(asc(cqcMilestonesTable.step));

  const cqcStarted = milestones.some(m => m.status !== "not_started");
  const cqcComplete = milestones.length > 0 && milestones.every(m => m.status === "complete");
  const cqcNotStarted = !cqcStarted;

  return res.json({ projectId, overallScore, sectionSummaries, cqcNotStarted, cqcComplete, totalItems: items.length });
});

router.get("/projects/:projectId/compliance/milestones", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const rows = await db.select().from(cqcMilestonesTable)
    .where(eq(cqcMilestonesTable.projectId, projectId))
    .orderBy(asc(cqcMilestonesTable.step));
  return res.json(rows);
});

router.post("/projects/:projectId/compliance/milestones", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { step, title, description, leadTimeWeeks, status, dueDate, notes, sortOrder } = req.body;
  if (!title || step === undefined || leadTimeWeeks === undefined) {
    return res.status(400).json({ error: "step, title, and leadTimeWeeks are required" });
  }
  const [row] = await db.insert(cqcMilestonesTable).values({
    projectId,
    step: parseInt(step),
    title,
    description: description ?? null,
    leadTimeWeeks: parseInt(leadTimeWeeks),
    status: status ?? "not_started",
    dueDate: dueDate ?? null,
    notes: notes ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  return res.status(201).json(row);
});

router.put("/compliance/milestones/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { status, dueDate, notes } = req.body;
  const [row] = await db.update(cqcMilestonesTable)
    .set({ status, dueDate, notes, updatedAt: new Date() })
    .where(eq(cqcMilestonesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.delete("/compliance/milestones/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(cqcMilestonesTable).where(eq(cqcMilestonesTable.id, id));
  return res.status(204).send();
});

export default router;
