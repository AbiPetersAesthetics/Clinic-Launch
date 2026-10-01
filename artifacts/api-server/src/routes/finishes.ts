import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { finishSurfacesTable, finishOptionsTable, kitItemsTable } from "@workspace/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { publicHttpUrl, linkPreview } from "../lib/link-preview";

// Colours and finishes on Abi's Rooms & Kit page: the paint and flooring shortlist
// per surface, and which option each surface has chosen. Links are previewed the
// same way as kit items.
const router = Router();

const ZONES = ["inside", "outside", "floor"] as const;
const STATUSES = ["idea", "sample"] as const;

// A colour as #RRGGBB, or null when the text is not one.
function hexColour(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toUpperCase()}` : null;
}

// Short free text, trimmed; empty becomes null.
function text(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

const projectOf = (req: Request) => parseInt(req.params.projectId as string);

// ─── GET /projects/:id/finishes ──────────────────────────────────────────────
// Every surface and every option; the page groups and sorts them.
router.get("/projects/:projectId/finishes", async (req, res) => {
  const projectId = projectOf(req);
  const [surfaces, options] = await Promise.all([
    db.select().from(finishSurfacesTable).where(eq(finishSurfacesTable.projectId, projectId)).orderBy(asc(finishSurfacesTable.sortOrder), asc(finishSurfacesTable.id)),
    db.select().from(finishOptionsTable).where(eq(finishOptionsTable.projectId, projectId)).orderBy(asc(finishOptionsTable.sortOrder), asc(finishOptionsTable.id)),
  ]);
  res.json({ surfaces, options });
});

// ─── POST /projects/:id/finishes/surfaces ────────────────────────────────────
// A surface of Abi's own: list-only, not drawn on the schematics.
router.post("/projects/:projectId/finishes/surfaces", async (req, res) => {
  const projectId = projectOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const zone = typeof body.zone === "string" && (ZONES as readonly string[]).includes(body.zone) ? body.zone : null;
  const name = text(body.name, 120);
  if (!zone) { res.status(400).json({ error: "Say whether the surface is inside, outside or a floor" }); return; }
  if (!name) { res.status(400).json({ error: "Give the surface a name" }); return; }
  const siblings = await db.select({ sortOrder: finishSurfacesTable.sortOrder }).from(finishSurfacesTable).where(and(eq(finishSurfacesTable.projectId, projectId), eq(finishSurfacesTable.zone, zone)));
  const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), 0) + 1;
  const [row] = await db.insert(finishSurfacesTable).values({ projectId, zone, role: null, name, brief: text(body.brief, 600), sortOrder }).returning();
  res.status(201).json(row);
});

// ─── PATCH /projects/:id/finishes/surfaces/:surfaceId ────────────────────────
// Name, brief, or the chosen option (null to un-choose). The option must be on
// this surface's shortlist.
router.patch("/projects/:projectId/finishes/surfaces/:surfaceId", async (req, res) => {
  const projectId = projectOf(req);
  const surfaceId = parseInt(req.params.surfaceId as string);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) { const n = text(body.name, 120); if (!n) { res.status(400).json({ error: "The surface needs a name" }); return; } patch.name = n; }
  if (body.brief !== undefined) patch.brief = text(body.brief, 600);
  if (body.chosenOptionId !== undefined) {
    if (body.chosenOptionId === null) patch.chosenOptionId = null;
    else {
      const id = Number(body.chosenOptionId);
      const [opt] = await db.select().from(finishOptionsTable).where(and(eq(finishOptionsTable.id, id), eq(finishOptionsTable.surfaceId, surfaceId), eq(finishOptionsTable.projectId, projectId)));
      if (!opt) { res.status(400).json({ error: "That option is not on this surface's shortlist" }); return; }
      patch.chosenOptionId = id;
    }
  }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [row] = await db.update(finishSurfacesTable).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(finishSurfacesTable.projectId, projectId), eq(finishSurfacesTable.id, surfaceId))).returning();
  if (!row) { res.status(404).json({ error: "Surface not found" }); return; }
  res.json(row);
});

// ─── DELETE /projects/:id/finishes/surfaces/:surfaceId ───────────────────────
// The surface and its shortlist together.
router.delete("/projects/:projectId/finishes/surfaces/:surfaceId", async (req, res) => {
  const projectId = projectOf(req);
  const surfaceId = parseInt(req.params.surfaceId as string);
  const [row] = await db.delete(finishSurfacesTable).where(and(eq(finishSurfacesTable.projectId, projectId), eq(finishSurfacesTable.id, surfaceId))).returning();
  if (!row) { res.status(404).json({ error: "Surface not found" }); return; }
  const gone = await db.delete(finishOptionsTable).where(and(eq(finishOptionsTable.projectId, projectId), eq(finishOptionsTable.surfaceId, surfaceId))).returning({ id: finishOptionsTable.id });
  if (gone.length) await db.update(kitItemsTable).set({ finishOptionId: null, updatedAt: new Date() }).where(and(eq(kitItemsTable.projectId, projectId), inArray(kitItemsTable.finishOptionId, gone.map(o => o.id))));
  res.json({ ok: true });
});

// The fields an option carries, validated. A changed link is fetched for its
// picture and title; an emptied one clears them.
async function optionPatch(body: Record<string, unknown>, currentUrl: string | null | undefined): Promise<{ patch: Record<string, unknown>; error?: string }> {
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) { const n = text(body.name, 160); if (!n) return { patch, error: "Give the option a name" }; patch.name = n; }
  for (const k of ["brand", "code", "finish"] as const) if (body[k] !== undefined) patch[k] = text(body[k], 120);
  if (body.note !== undefined) patch.note = text(body.note, 600);
  if (body.hex !== undefined) {
    if (body.hex === null || body.hex === "") patch.hex = null;
    else { const h = hexColour(body.hex); if (!h) return { patch, error: "The colour needs to be a six digit hex code, like #1F2A44" }; patch.hex = h; }
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !(STATUSES as readonly string[]).includes(body.status)) return { patch, error: "Status is idea or sample" };
    patch.status = body.status;
  }
  if (body.url !== undefined) {
    if (body.url === null || (typeof body.url === "string" && !body.url.trim())) { patch.url = null; patch.imageUrl = null; patch.linkTitle = null; }
    else {
      const u = publicHttpUrl(body.url);
      if (!u) return { patch, error: "The link needs to be a full web address, starting http or https" };
      patch.url = u.toString();
      if (u.toString() !== currentUrl) { const p = await linkPreview(u); patch.imageUrl = p.imageUrl; patch.linkTitle = p.title; }
    }
  }
  return { patch };
}

// ─── POST /projects/:id/finishes/options ─────────────────────────────────────
// A shortlist entry for a surface.
router.post("/projects/:projectId/finishes/options", async (req, res) => {
  const projectId = projectOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const surfaceId = Number(body.surfaceId);
  const [surface] = Number.isFinite(surfaceId) ? await db.select().from(finishSurfacesTable).where(and(eq(finishSurfacesTable.projectId, projectId), eq(finishSurfacesTable.id, surfaceId))) : [];
  if (!surface) { res.status(400).json({ error: "That surface is not on the page" }); return; }
  const { patch, error } = await optionPatch({ status: "idea", ...body }, null);
  if (error) { res.status(400).json({ error }); return; }
  if (!patch.name) { res.status(400).json({ error: "Give the option a name" }); return; }
  const siblings = await db.select({ sortOrder: finishOptionsTable.sortOrder }).from(finishOptionsTable).where(eq(finishOptionsTable.surfaceId, surfaceId));
  const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), 0) + 1;
  const [row] = await db.insert(finishOptionsTable).values({ projectId, surfaceId, name: patch.name as string, brand: (patch.brand as string | null) ?? null, code: (patch.code as string | null) ?? null, finish: (patch.finish as string | null) ?? null, hex: (patch.hex as string | null) ?? null, url: (patch.url as string | null) ?? null, imageUrl: (patch.imageUrl as string | null) ?? null, linkTitle: (patch.linkTitle as string | null) ?? null, status: patch.status as string, note: (patch.note as string | null) ?? null, sortOrder }).returning();
  res.status(201).json(row);
});

// ─── PATCH /projects/:id/finishes/options/:optionId ──────────────────────────
router.patch("/projects/:projectId/finishes/options/:optionId", async (req, res) => {
  const projectId = projectOf(req);
  const optionId = parseInt(req.params.optionId as string);
  const [current] = await db.select().from(finishOptionsTable).where(and(eq(finishOptionsTable.projectId, projectId), eq(finishOptionsTable.id, optionId)));
  if (!current) { res.status(404).json({ error: "Option not found" }); return; }
  const { patch, error } = await optionPatch((req.body ?? {}) as Record<string, unknown>, current.url);
  if (error) { res.status(400).json({ error }); return; }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [row] = await db.update(finishOptionsTable).set({ ...patch, updatedAt: new Date() }).where(eq(finishOptionsTable.id, optionId)).returning();
  res.json(row);
});

// ─── DELETE /projects/:id/finishes/options/:optionId ─────────────────────────
// A surface that had chosen it is left with nothing chosen.
router.delete("/projects/:projectId/finishes/options/:optionId", async (req, res) => {
  const projectId = projectOf(req);
  const optionId = parseInt(req.params.optionId as string);
  const [row] = await db.delete(finishOptionsTable).where(and(eq(finishOptionsTable.projectId, projectId), eq(finishOptionsTable.id, optionId))).returning();
  if (!row) { res.status(404).json({ error: "Option not found" }); return; }
  await db.update(finishSurfacesTable).set({ chosenOptionId: null, updatedAt: new Date() }).where(and(eq(finishSurfacesTable.projectId, projectId), eq(finishSurfacesTable.chosenOptionId, optionId)));
  await db.update(kitItemsTable).set({ finishOptionId: null, updatedAt: new Date() }).where(and(eq(kitItemsTable.projectId, projectId), eq(kitItemsTable.finishOptionId, optionId)));
  res.json({ ok: true });
});

export default router;
