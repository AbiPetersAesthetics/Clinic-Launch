import { Router } from "express";
import { db } from "@workspace/db";
import {
  backlinkOpportunitiesTable,
  backlinkListingPackTable,
  backlinkTemplatesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * The workbook columns are analysis and are not editable through the API.
 * Only the working state of a target can be changed, so a patch is filtered
 * to these keys rather than spread straight onto the row.
 */
const OPPORTUNITY_PATCHABLE = [
  "status",
  "owner",
  "targetDate",
  "notes",
  "dateContacted",
  "followUpDate",
  "liveUrl",
] as const;

const LISTING_PACK_PATCHABLE = ["value", "status"] as const;

const TEMPLATE_PATCHABLE = ["wording"] as const;

function pick<T extends string>(body: unknown, allowed: readonly T[]): Record<string, unknown> {
  const src = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in src) {
      // Empty date strings must clear the column, not fail the insert.
      const v = src[key];
      out[key] = v === "" ? null : v;
    }
  }
  return out;
}

// ─── GET /projects/:id/backlinks ─────────────────────────────────────────────
router.get("/projects/:projectId/backlinks", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db
    .select()
    .from(backlinkOpportunitiesTable)
    .where(eq(backlinkOpportunitiesTable.projectId, projectId))
    .orderBy(backlinkOpportunitiesTable.rank);
  res.json(rows);
});

// ─── PATCH /projects/:id/backlinks/:backlinkId ───────────────────────────────
router.patch("/projects/:projectId/backlinks/:backlinkId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const backlinkId = parseInt(req.params.backlinkId);

  const patch = pick(req.body, OPPORTUNITY_PATCHABLE);
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No editable fields supplied" });
    return;
  }

  const [updated] = await db
    .update(backlinkOpportunitiesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(backlinkOpportunitiesTable.projectId, projectId),
        eq(backlinkOpportunitiesTable.id, backlinkId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Backlink opportunity not found" });
    return;
  }
  res.json(updated);
});

// ─── GET /projects/:id/backlink-listing-pack ─────────────────────────────────
router.get("/projects/:projectId/backlink-listing-pack", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db
    .select()
    .from(backlinkListingPackTable)
    .where(eq(backlinkListingPackTable.projectId, projectId))
    .orderBy(backlinkListingPackTable.sortOrder);
  res.json(rows);
});

// ─── PATCH /projects/:id/backlink-listing-pack/:itemId ───────────────────────
router.patch("/projects/:projectId/backlink-listing-pack/:itemId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const itemId = parseInt(req.params.itemId);

  const patch = pick(req.body, LISTING_PACK_PATCHABLE);
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No editable fields supplied" });
    return;
  }

  const [updated] = await db
    .update(backlinkListingPackTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(backlinkListingPackTable.projectId, projectId),
        eq(backlinkListingPackTable.id, itemId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Listing pack item not found" });
    return;
  }
  res.json(updated);
});

// ─── GET /projects/:id/backlink-templates ────────────────────────────────────
router.get("/projects/:projectId/backlink-templates", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db
    .select()
    .from(backlinkTemplatesTable)
    .where(eq(backlinkTemplatesTable.projectId, projectId))
    .orderBy(backlinkTemplatesTable.templateId);
  res.json(rows);
});

// ─── PATCH /projects/:id/backlink-templates/:itemId ──────────────────────────
router.patch("/projects/:projectId/backlink-templates/:itemId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const itemId = parseInt(req.params.itemId);

  const patch = pick(req.body, TEMPLATE_PATCHABLE);
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No editable fields supplied" });
    return;
  }

  const [updated] = await db
    .update(backlinkTemplatesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(backlinkTemplatesTable.projectId, projectId),
        eq(backlinkTemplatesTable.id, itemId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(updated);
});

export default router;
