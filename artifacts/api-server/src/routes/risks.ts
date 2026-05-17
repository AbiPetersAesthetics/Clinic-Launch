import { Router } from "express";
import { db } from "@workspace/db";
import { risksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── GET /projects/:id/risks ─────────────────────────────────────────────────
router.get("/projects/:projectId/risks", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const risks = await db
    .select()
    .from(risksTable)
    .where(eq(risksTable.projectId, projectId))
    .orderBy(risksTable.riskId);
  res.json(risks);
});

// ─── POST /projects/:id/risks ────────────────────────────────────────────────
router.post("/projects/:projectId/risks", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const body = req.body;

  // Auto-generate riskId if not provided
  if (!body.riskId) {
    const existing = await db.select().from(risksTable).where(eq(risksTable.projectId, projectId));
    const maxNum = existing.reduce((max, r) => {
      const n = parseInt(r.riskId.replace(/\D/g, "")) || 0;
      return Math.max(max, n);
    }, 0);
    body.riskId = `R${String(maxNum + 1).padStart(3, "0")}`;
  }

  const [risk] = await db
    .insert(risksTable)
    .values({ ...body, projectId, source: "Manual" })
    .returning();
  res.json(risk);
});

// ─── PATCH /projects/:id/risks/:riskId ───────────────────────────────────────
router.patch("/projects/:projectId/risks/:riskId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { riskId } = req.params;
  const body = { ...req.body };

  // Fetch current risk to detect score changes
  const [current] = await db
    .select()
    .from(risksTable)
    .where(and(eq(risksTable.projectId, projectId), eq(risksTable.riskId, riskId)));

  if (!current) return res.status(404).json({ error: "Risk not found" });

  // If likelihood or impact changed, record old score in history
  const newLikelihood = body.likelihood ?? current.likelihood;
  const newImpact = body.impact ?? current.impact;
  const oldScore = current.likelihood * current.impact;
  const newScore = newLikelihood * newImpact;

  let scoreHistory = (current.scoreHistory as any[]) || [];
  if (oldScore !== newScore) {
    scoreHistory = [
      ...scoreHistory,
      {
        date: new Date().toISOString(),
        score: oldScore,
        likelihood: current.likelihood,
        impact: current.impact,
        note: `Changed from ${oldScore} to ${newScore}`,
      },
    ];
    body.scoreHistory = scoreHistory;
  }

  body.updatedAt = new Date();
  body.lastReviewedAt = new Date();

  const [updated] = await db
    .update(risksTable)
    .set(body)
    .where(and(eq(risksTable.projectId, projectId), eq(risksTable.riskId, riskId)))
    .returning();

  res.json(updated);
});

// ─── DELETE /projects/:id/risks/:riskId ──────────────────────────────────────
router.delete("/projects/:projectId/risks/:riskId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { riskId } = req.params;

  await db
    .delete(risksTable)
    .where(and(eq(risksTable.projectId, projectId), eq(risksTable.riskId, riskId)));

  res.json({ ok: true });
});

// ─── POST /projects/:id/risks/:riskId/review ────────────────────────────────
router.post("/projects/:projectId/risks/:riskId/review", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { riskId } = req.params;

  const [updated] = await db
    .update(risksTable)
    .set({ lastReviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(risksTable.projectId, projectId), eq(risksTable.riskId, riskId)))
    .returning();

  res.json(updated);
});

export default router;
