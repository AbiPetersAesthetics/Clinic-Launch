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

type ExistingItem = {
  id: number; title: string; detail: string; deep: string; category: string;
  channel: string; owner: string; weekStart: string; dayDate: string; sortOrder: number;
};

// Reconcile an already-seeded project against the current template WITHOUT wiping
// statuses and notes: insert items whose title is new, and update the content of
// items whose copy has changed. Keyed by title. Only the content columns are ever
// touched, so a user's ticks and notes survive a revised plan. Does zero writes
// when nothing changed, so it is cheap to run on every load. (The "Rebuild" button
// still does a full destructive wipe when the owner wants a clean slate.)
async function syncTemplate(projectId: number, existing: ExistingItem[]) {
  const byTitle = new Map(existing.map(r => [r.title, r]));
  const inserts: any[] = [];
  const updates: { id: number; patch: Record<string, unknown> }[] = [];
  for (const s of PLAN_ITEMS) {
    const deep = JSON.stringify(s.deep ?? []);
    const cur = byTitle.get(s.title);
    if (!cur) {
      inserts.push({
        projectId, category: s.category, title: s.title, detail: s.detail ?? "",
        deep, channel: s.channel, owner: s.owner, weekStart: s.weekStart,
        dayDate: s.dayDate, status: "not_started" as const,
        dueWeeksBeforeOpen: null, notes: "", sortOrder: s.sortOrder,
      });
    } else if (
      cur.detail !== (s.detail ?? "") || cur.deep !== deep || cur.category !== s.category ||
      cur.channel !== s.channel || cur.owner !== s.owner || cur.weekStart !== s.weekStart ||
      cur.dayDate !== s.dayDate || cur.sortOrder !== s.sortOrder
    ) {
      updates.push({ id: cur.id, patch: {
        category: s.category, detail: s.detail ?? "", deep, channel: s.channel,
        owner: s.owner, weekStart: s.weekStart, dayDate: s.dayDate, sortOrder: s.sortOrder,
      } });
    }
  }
  if (inserts.length) await db.insert(marketingItemsTable).values(inserts);
  for (const u of updates) {
    await db.update(marketingItemsTable).set(u.patch).where(eq(marketingItemsTable.id, u.id));
  }
  return inserts.length + updates.length;
}

// GET all items + waitlist count (auto-seeds when empty, else syncs new/changed template copy)
router.get("/projects/:projectId/marketing", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  let items = await db.select().from(marketingItemsTable)
    .where(eq(marketingItemsTable.projectId, projectId))
    .orderBy(asc(marketingItemsTable.sortOrder));
  if (items.length === 0) items = await reseed(projectId);
  else if (await syncTemplate(projectId, items as unknown as ExistingItem[])) {
    items = await db.select().from(marketingItemsTable)
      .where(eq(marketingItemsTable.projectId, projectId))
      .orderBy(asc(marketingItemsTable.sortOrder));
  }
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
