// Ads Pathway: the Meta ads journey from ad to booked consultation, refreshed twice a day by
// the scheduled pathway check in the skin-clinic repo (ads/meta/pathway). That check pushes
// each snapshot straight into ads_pathway_snapshots with scripts/push-ads-pathway.mjs; this
// route only reads the latest one. Snapshots are kept so the history can be charted later.
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ads_pathway_snapshots (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL DEFAULT 1,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  ensured = true;
}

router.get("/projects/:id/ads-pathway", async (req, res) => {
  try {
    await ensureTable();
    const projectId = Number(req.params.id) || 1;
    const r = await db.execute(sql`
      SELECT data, created_at FROM ads_pathway_snapshots
      WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 1`);
    const row = (r as unknown as { rows: Array<{ data: unknown; created_at: string }> }).rows[0];
    if (!row) { res.json({ data: null, createdAt: null }); return; }
    res.json({ data: row.data, createdAt: row.created_at });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
