import { Router } from "express";
import { db } from "@workspace/db";
import { kitAreasTable, kitItemsTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

const STATUSES = ["planned", "ordered", "paid"] as const;

// A pound amount from the body: a number at or above zero, whole pounds.
function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[£,\s]/g, "")) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// ─── GET /projects/:id/kit ───────────────────────────────────────────────────
// Areas in display order and every item, for the page to group.
router.get("/projects/:projectId/kit", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [areas, items] = await Promise.all([
    db.select().from(kitAreasTable).where(eq(kitAreasTable.projectId, projectId)).orderBy(asc(kitAreasTable.sortOrder), asc(kitAreasTable.id)),
    db.select().from(kitItemsTable).where(eq(kitItemsTable.projectId, projectId)).orderBy(asc(kitItemsTable.createdAt), asc(kitItemsTable.id)),
  ]);
  res.json({ areas, items });
});

// ─── PATCH /projects/:id/kit/areas/:areaId ───────────────────────────────────
// The budget (and name or covers text) of one area.
router.patch("/projects/:projectId/kit/areas/:areaId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const areaId = parseInt(req.params.areaId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("budgetGbp" in body) { const m = money(body.budgetGbp); if (m === null) { res.status(400).json({ error: "Budget must be a number at or above zero" }); return; } patch.budgetGbp = m; }
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.covers === "string") patch.covers = body.covers;
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [updated] = await db.update(kitAreasTable).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(kitAreasTable.projectId, projectId), eq(kitAreasTable.id, areaId))).returning();
  if (!updated) { res.status(404).json({ error: "Area not found" }); return; }
  res.json(updated);
});

// ─── POST /projects/:id/kit/items ────────────────────────────────────────────
router.post("/projects/:projectId/kit/items", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const areaKey = typeof body.areaKey === "string" ? body.areaKey : "";
  const amount = money(body.amountGbp ?? 0);
  const status = STATUSES.includes(body.status as any) ? (body.status as string) : "planned";
  if (!name) { res.status(400).json({ error: "Give the item a name" }); return; }
  if (amount === null) { res.status(400).json({ error: "Price must be a number at or above zero" }); return; }
  const [area] = await db.select().from(kitAreasTable).where(and(eq(kitAreasTable.projectId, projectId), eq(kitAreasTable.areaKey, areaKey)));
  if (!area) { res.status(400).json({ error: "Unknown area" }); return; }
  const [created] = await db.insert(kitItemsTable).values({ projectId, areaKey, name, amountGbp: amount, status, note: typeof body.note === "string" ? body.note : null }).returning();
  res.status(201).json(created);
});

// ─── PATCH /projects/:id/kit/items/:itemId ───────────────────────────────────
router.patch("/projects/:projectId/kit/items/:itemId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const itemId = parseInt(req.params.itemId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") { const n = body.name.trim(); if (!n) { res.status(400).json({ error: "Give the item a name" }); return; } patch.name = n; }
  if ("amountGbp" in body) { const m = money(body.amountGbp); if (m === null) { res.status(400).json({ error: "Price must be a number at or above zero" }); return; } patch.amountGbp = m; }
  if (typeof body.status === "string") { if (!STATUSES.includes(body.status as any)) { res.status(400).json({ error: "Status must be planned, ordered or paid" }); return; } patch.status = body.status; }
  if (typeof body.note === "string") patch.note = body.note;
  if (typeof body.areaKey === "string") {
    const [area] = await db.select().from(kitAreasTable).where(and(eq(kitAreasTable.projectId, projectId), eq(kitAreasTable.areaKey, body.areaKey)));
    if (!area) { res.status(400).json({ error: "Unknown area" }); return; }
    patch.areaKey = body.areaKey;
  }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [updated] = await db.update(kitItemsTable).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(kitItemsTable.projectId, projectId), eq(kitItemsTable.id, itemId))).returning();
  if (!updated) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(updated);
});

// ─── DELETE /projects/:id/kit/items/:itemId ──────────────────────────────────
router.delete("/projects/:projectId/kit/items/:itemId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const itemId = parseInt(req.params.itemId);
  const [deleted] = await db.delete(kitItemsTable)
    .where(and(eq(kitItemsTable.projectId, projectId), eq(kitItemsTable.id, itemId))).returning();
  if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
  res.json({ ok: true });
});

export default router;
