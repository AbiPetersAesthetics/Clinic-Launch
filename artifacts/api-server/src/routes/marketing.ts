import { Router } from "express";
import { db } from "@workspace/db";
import { marketingItemsTable, projectsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { PLAN_ITEMS } from "./marketing-plan";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// The marketing plan is authored externally (the refined Aug-Dec 2026 launch plan)
// and parsed into PLAN_ITEMS: one row per task with owner, channel, dayDate and
// the full detail as {h,b} blocks. To load a revised plan, replace marketing-plan.ts
// and POST /projects/:id/marketing/reseed.
// ─────────────────────────────────────────────────────────────────────────────

async function reseed(projectId: number) {
  await db.delete(marketingItemsTable).where(eq(marketingItemsTable.projectId, projectId));
  const seeded = await db.insert(marketingItemsTable).values(
    PLAN_ITEMS.map(s => ({
      projectId,
      category: s.category,
      title: s.title,
      detail: s.detail ?? "",
      deep: JSON.stringify(s.deep ?? []),
      channel: s.channel,
      owner: s.owner,
      weekStart: s.weekStart,
      dayDate: s.dayDate,
      status: "not_started",
      dueWeeksBeforeOpen: null,
      notes: "",
      sortOrder: s.sortOrder,
    }))
  ).returning();
  return seeded.sort((a, b) => a.sortOrder - b.sortOrder);
}

// GET all items + waitlist count (auto-seeds only when empty)
router.get("/projects/:projectId/marketing", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  let items = await db.select().from(marketingItemsTable)
    .where(eq(marketingItemsTable.projectId, projectId))
    .orderBy(asc(marketingItemsTable.sortOrder));
  if (items.length === 0) items = await reseed(projectId);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const waitlistCount = (project as any)?.waitlistCount ?? 0;
  return res.json({ items, waitlistCount });
});

// POST force reseed (rebuild the plan from the template, wiping statuses/notes)
router.post("/projects/:projectId/marketing/reseed", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const items = await reseed(projectId);
  return res.json({ items, reseeded: items.length });
});

// PUT update a single item (status / notes)
router.put("/marketing/:id", async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { status, notes } = req.body;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  const [row] = await db.update(marketingItemsTable).set(patch).where(eq(marketingItemsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

// PATCH waitlist count
router.patch("/projects/:projectId/marketing/waitlist", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const count = Math.max(0, parseInt(req.body.count) || 0);
  await db.execute(`UPDATE projects SET waitlist_count = ${count}, updated_at = NOW() WHERE id = ${projectId}`);
  return res.json({ waitlistCount: count });
});

export default router;
