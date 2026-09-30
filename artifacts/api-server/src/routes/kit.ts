import { Router } from "express";
import { db } from "@workspace/db";
import { kitAreasTable, kitLinesTable, kitItemsTable, tasksTable, phasesTable, propertiesTable, propertyTaskOverridesTable } from "@workspace/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

const router = Router();

const STATUSES = ["planned", "ordered", "paid"] as const;

// A pound amount from the body: a number at or above zero, whole pounds.
function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[£,\s]/g, "")) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// How the plan states a line's VAT, in words for the page.
function vatBasis(invoice: string | null, cost: string | null): string {
  const inv = (invoice ?? "").toLowerCase();
  if (inv === "inc") return "inc VAT";
  if (inv === "exc") return "ex VAT";
  if (inv === "exempt") return "no VAT";
  const c = (cost ?? "").toLowerCase();
  if (/exempt|vat_na|n\/a|no vat|not applicable/.test(c)) return "no VAT";
  if (/ex_vat|ex vat|exc/.test(c)) return "ex VAT";
  return "inc VAT";
}

export type KitLineView = {
  id: number; taskId: number; areaKey: string; sortOrder: number;
  title: string; phase: string;
  /** The figure Abi plans against: actual if paid, else committed, else selected. */
  budgetGbp: number; basis: string;
  planStatus: "paid" | "part-paid" | "committed" | "planned"; amountPaidGbp: number;
  savingBaseline: number | null; savingApplied: boolean;
  missing: boolean;
};

// The plan lines with their live figures, merged with the active property's overrides
// the same way the Plan page does.
async function loadLines(projectId: number): Promise<KitLineView[]> {
  const lines = await db.select().from(kitLinesTable).where(eq(kitLinesTable.projectId, projectId)).orderBy(asc(kitLinesTable.sortOrder), asc(kitLinesTable.id));
  if (!lines.length) return [];
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const phaseName = new Map(phases.map(p => [p.id, p.name]));
  const tasks = await db.select().from(tasksTable).where(inArray(tasksTable.id, lines.map(l => l.taskId)));
  const [prop] = await db.select().from(propertiesTable).where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
  const ovr = new Map<number, any>();
  if (prop) for (const o of await db.select().from(propertyTaskOverridesTable).where(eq(propertyTaskOverridesTable.propertyId, prop.id))) ovr.set(o.taskId, o);
  return lines.map(l => {
    const t = tasks.find(x => x.id === l.taskId);
    if (!t || t.archived) return { id: l.id, taskId: l.taskId, areaKey: l.areaKey, sortOrder: l.sortOrder, title: "Plan line no longer in the plan", phase: "", budgetGbp: 0, basis: "", planStatus: "planned" as const, amountPaidGbp: 0, savingBaseline: null, savingApplied: false, missing: true };
    const o = ovr.get(t.id) ?? {};
    const pick = (k: string) => (o[k] != null ? o[k] : (t as any)[k]);
    const selected = Number(pick("selectedCost") ?? 0), committed = Number(pick("committedCost") ?? 0), actual = Number(pick("actualCost") ?? 0);
    const paid = String(pick("paidStatus") ?? "");
    const budget = paid === "paid" && actual > 0 ? actual : committed > 0 ? committed : selected;
    const planStatus = paid === "paid" ? "paid" : paid === "part-paid" ? "part-paid" : committed > 0 ? "committed" : "planned";
    return {
      id: l.id, taskId: t.id, areaKey: l.areaKey, sortOrder: l.sortOrder, title: t.title, phase: phaseName.get(t.phaseId) ?? "",
      budgetGbp: Math.round(budget), basis: vatBasis(pick("invoiceVatStatus"), pick("costVatStatus")),
      planStatus, amountPaidGbp: Math.round(Number(pick("amountPaidGbp") ?? 0) || (paid === "paid" ? budget : 0)),
      savingBaseline: t.savingBaseline != null ? Math.round(Number(t.savingBaseline)) : null, savingApplied: !!t.savingApplied,
      missing: false,
    };
  });
}

// ─── GET /projects/:id/kit ───────────────────────────────────────────────────
// Areas in display order, the plan lines with today's figures, and every item.
router.get("/projects/:projectId/kit", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [areas, lines, items] = await Promise.all([
    db.select().from(kitAreasTable).where(eq(kitAreasTable.projectId, projectId)).orderBy(asc(kitAreasTable.sortOrder), asc(kitAreasTable.id)),
    loadLines(projectId),
    db.select().from(kitItemsTable).where(eq(kitItemsTable.projectId, projectId)).orderBy(asc(kitItemsTable.createdAt), asc(kitItemsTable.id)),
  ]);
  res.json({ areas, lines, items });
});

// ─── PATCH /projects/:id/kit/areas/:areaId ───────────────────────────────────
// The name or the "what the builder covers" text of an area. Budgets come from the plan.
router.patch("/projects/:projectId/kit/areas/:areaId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const areaId = parseInt(req.params.areaId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.covers === "string") patch.covers = body.covers;
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [updated] = await db.update(kitAreasTable).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(kitAreasTable.projectId, projectId), eq(kitAreasTable.id, areaId))).returning();
  if (!updated) { res.status(404).json({ error: "Area not found" }); return; }
  res.json(updated);
});

async function lineFor(projectId: number, taskId: number) {
  const [line] = await db.select().from(kitLinesTable).where(and(eq(kitLinesTable.projectId, projectId), eq(kitLinesTable.taskId, taskId)));
  return line ?? null;
}

// ─── POST /projects/:id/kit/items ────────────────────────────────────────────
router.post("/projects/:projectId/kit/items", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const taskId = Number(body.taskId);
  const amount = money(body.amountGbp ?? 0);
  const status = STATUSES.includes(body.status as any) ? (body.status as string) : "planned";
  if (!name) { res.status(400).json({ error: "Give the item a name" }); return; }
  if (amount === null) { res.status(400).json({ error: "Price must be a number at or above zero" }); return; }
  if (!Number.isFinite(taskId)) { res.status(400).json({ error: "Which plan line is it for?" }); return; }
  const line = await lineFor(projectId, taskId);
  if (!line) { res.status(400).json({ error: "That plan line is not on the rooms and kit page" }); return; }
  const [created] = await db.insert(kitItemsTable).values({ projectId, areaKey: line.areaKey, taskId, name, amountGbp: amount, status, note: typeof body.note === "string" ? body.note : null }).returning();
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
  if ("taskId" in body) {
    const line = await lineFor(projectId, Number(body.taskId));
    if (!line) { res.status(400).json({ error: "That plan line is not on the rooms and kit page" }); return; }
    patch.taskId = line.taskId; patch.areaKey = line.areaKey;
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
