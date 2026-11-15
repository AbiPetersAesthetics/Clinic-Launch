// Proposals and activity (UX plan 2.6 and 3.4). A tap in ALFRED records David's decision; it never
// acts. Approved items wait, as "queued", for the next live Claude session, which lists them for one
// "go" in chat, re-checks each guard and then acts (ops/run-approved.md in the clinic repo).
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ensureAgentTables, rowsOf, type ProposalRow, type ActivityRow } from "../lib/agent-tables";
import { freshness, RULES, type SourceKey } from "../lib/freshness";
import { applySpec, revertSpec, type ApplySpec } from "../lib/appliers";
import { runRipples, kindsFor } from "../lib/ripples";

// A card that only changes ALFRED's own records is applied at once; the result, with what was there
// before, is kept on the card for Undo and the revert link, and logged in Activity.
async function applyNow(projectId: number, p: ProposalRow, newStatusIfPending: string) {
  if (p.action_class !== "record") return null;
  if (!p.apply) {
    await db.execute(sql`UPDATE proposals SET result = ${"The next scheduled run does this: it needs a document or ANS read first."} WHERE id = ${p.id}`);
    return null;
  }
  const applied = await applySpec(projectId, p.apply as ApplySpec);
  await db.execute(sql`UPDATE proposals SET status = 'done', result = ${applied.summary}, applied = ${JSON.stringify(applied)}::jsonb, updated_at = NOW() WHERE id = ${p.id}`);
  await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, wrote, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${`Done on your yes: ${p.title}. ${applied.summary}`}, ${JSON.stringify([`card ${p.id}`])}::jsonb, NOW(), NOW())`);
  void newStatusIfPending;
  // Everything that depends on this fact: inside follows on its own; outside becomes one card.
  try { await runRipples(projectId, kindsFor(p.apply as any, p.title), p.title); } catch (err) { console.error("[ripples]", err); }
  return applied;
}

// Approved or answered record cards not yet applied. Not called anywhere at present: the cards
// approved before the appliers existed are being applied by hand, and a second writer would double them.
export async function applyWaiting(projectId = 1) {
  await ensureAgentTables();
  const rows = rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND action_class = 'record' AND apply IS NOT NULL AND applied IS NULL AND status IN ('approved', 'answered')`));
  for (const p of rows) { try { await applyNow(projectId, p, p.status); } catch (err) { console.error(`[apply card ${p.id}]`, err); } }
  return rows.length;
}

// Each proposal's evidence carries its source chips, aged by the one freshness rule.
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
const withChips = (rows: ProposalRow[]) => rows.map((r) => ({ ...r, created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)!, decided_at: iso(r.decided_at), expires_at: iso(r.expires_at), snooze_until: iso(r.snooze_until), chips: (r.sources ?? []).filter((s) => s.source in RULES).map((s) => freshness(s.source as SourceKey, s.asOf)) }));

const router = Router();
const UNDO_SECONDS = 15; // ten seconds on screen, a little slack for the round trip

// Proposals whose expiry has passed are marked expired before anything reads them.
async function expireOld(projectId: number) {
  await db.execute(sql`UPDATE proposals SET status = 'expired', updated_at = NOW() WHERE project_id = ${projectId} AND status IN ('proposed', 'asked', 'snoozed') AND expires_at IS NOT NULL AND expires_at < NOW()`);
  await db.execute(sql`UPDATE proposals SET status = 'proposed', snooze_until = NULL, updated_at = NOW() WHERE project_id = ${projectId} AND status = 'snoozed' AND snooze_until < NOW()`);
}

export async function openProposals(projectId: number): Promise<ProposalRow[]> {
  await ensureAgentTables();
  await expireOld(projectId);
  return withChips(rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND status = 'proposed' ORDER BY CASE area WHEN 'money' THEN 0 WHEN 'clinic' THEN 1 ELSE 2 END, expires_at NULLS LAST, created_at ASC`)));
}

export async function recentActivity(projectId: number, sinceIso?: string, limit = 50): Promise<ActivityRow[]> {
  await ensureAgentTables();
  const rows = sinceIso
    ? rowsOf<ActivityRow>(await db.execute(sql`SELECT * FROM activity WHERE project_id = ${projectId} AND finished_at >= ${sinceIso} ORDER BY finished_at DESC LIMIT ${limit}`))
    : rowsOf<ActivityRow>(await db.execute(sql`SELECT * FROM activity WHERE project_id = ${projectId} ORDER BY finished_at DESC LIMIT ${limit}`));
  return rows.map((r) => ({ ...r, started_at: iso(r.started_at), finished_at: iso(r.finished_at)!, created_at: iso(r.created_at)! }));
}

router.get("/projects/:projectId/proposals", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const open = await openProposals(projectId);
    const queued = withChips(rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND status IN ('approved', 'answered', 'chosen', 'asked', 'awaiting') ORDER BY decided_at DESC`)));
    const snoozed = withChips(rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND status = 'snoozed' ORDER BY snooze_until`)));
    const decided = withChips(rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND status IN ('rejected', 'expired', 'done', 'cancelled', 'withdrawn', 'reverted') AND updated_at > NOW() - INTERVAL '30 days' ORDER BY updated_at DESC LIMIT 50`)));
    res.json({ open, queued, snoozed, decided });
  } catch (err) {
    console.error("[proposals]", err);
    res.status(500).json({ error: "Could not read the proposals" });
  }
});

router.post("/projects/:projectId/proposals/:id/decision", async (req, res) => {
  try {
    await ensureAgentTables();
    const projectId = parseInt(req.params.projectId);
    const id = parseInt(req.params.id);
    const body = (req.body ?? {}) as { action?: string; reason?: string; question?: string; until?: string };
    await expireOld(projectId);
    const [p] = rowsOf<ProposalRow>(await db.execute(sql`SELECT * FROM proposals WHERE project_id = ${projectId} AND id = ${id}`));
    if (!p) { res.status(404).json({ error: "That proposal is not there" }); return; }
    const text = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const live = ["proposed", "snoozed"].includes(p.status);
    let out: ProposalRow[];
    switch (body.action) {
      case "approve":
        if (!live) { res.status(409).json({ error: p.status === "expired" ? "This proposal has expired; the agent will propose again if it still applies." : `Already ${p.status}` }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'approved', previous_status = status, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        if (await applyNow(projectId, out[0], "approved")) out = rowsOf(await db.execute(sql`SELECT * FROM proposals WHERE id = ${id}`));
        break;
      case "reject":
        if (!live) { res.status(409).json({ error: `Already ${p.status}` }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'rejected', previous_status = status, reason = ${text(body.reason) || null}, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      case "answer": {
        // An answer to a question ALFRED asked: kept on the card and applied at the next run.
        const values = (body as any).values && typeof (body as any).values === "object" ? (body as any).values : null;
        const cleaned = values ? Object.fromEntries(Object.entries(values).map(([k, v]) => [String(k).slice(0, 60), text(v, 1000)]).filter(([, v]) => v)) : {};
        if (!Object.keys(cleaned).length) { res.status(400).json({ error: "Write the answer" }); return; }
        if (!live) { res.status(409).json({ error: `Already ${p.status}` }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'answered', previous_status = status, reply = ${JSON.stringify(cleaned)}::jsonb, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        if (await applyNow(projectId, out[0], "answered")) out = rowsOf(await db.execute(sql`SELECT * FROM proposals WHERE id = ${id}`));
        break;
      }
      case "choose": {
        const option = text((body as any).option, 200);
        if (!option) { res.status(400).json({ error: "Choose an option" }); return; }
        if (!live) { res.status(409).json({ error: `Already ${p.status}` }); return; }
        const reply = { option, note: text((body as any).note, 500) || null };
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'chosen', previous_status = status, reply = ${JSON.stringify(reply)}::jsonb, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      }
      case "ask": {
        const q = text(body.question, 1000);
        if (!q) { res.status(400).json({ error: "Write the question" }); return; }
        if (!live) { res.status(409).json({ error: `Already ${p.status}` }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'asked', previous_status = status, question = ${q}, answer = NULL, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      }
      case "snooze": {
        const until = body.until && !Number.isNaN(Date.parse(body.until)) ? new Date(body.until) : new Date(Date.now() + 24 * 3600000);
        if (!live) { res.status(409).json({ error: `Already ${p.status}` }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'snoozed', previous_status = status, snooze_until = ${until.toISOString()}, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      }
      case "undo": {
        const age = p.decided_at ? (Date.now() - Date.parse(p.decided_at)) / 1000 : Infinity;
        if (p.status === "done" && p.applied && p.apply && age <= UNDO_SECONDS) {
          const msg = await revertSpec(projectId, p.apply as ApplySpec, p.applied);
          out = rowsOf(await db.execute(sql`UPDATE proposals SET status = coalesce(previous_status, 'proposed'), previous_status = NULL, decided_at = NULL, applied = NULL, result = NULL, reply = NULL, updated_at = NOW() WHERE id = ${id} RETURNING *`));
          await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${`Undone: ${p.title}. ${msg}`}, NOW(), NOW())`);
          break;
        }
        if (!p.previous_status || age > UNDO_SECONDS || !["approved", "rejected", "asked", "snoozed", "answered", "chosen"].includes(p.status)) { res.status(409).json({ error: "Too late to undo here" }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = previous_status, previous_status = NULL, decided_at = NULL, snooze_until = NULL,
          reason = CASE WHEN status = 'rejected' THEN NULL ELSE reason END,
          question = CASE WHEN status = 'asked' THEN NULL ELSE question END, reply = CASE WHEN status IN ('answered', 'chosen') THEN NULL ELSE reply END, updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      }
      case "revert": {
        // The revert link in Activity: puts a record change back, whenever it was made.
        if (p.status !== "done" || !p.applied || !p.apply) { res.status(409).json({ error: "Only a change ALFRED made to its own records can be reverted here" }); return; }
        const msg = await revertSpec(projectId, p.apply as ApplySpec, p.applied);
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'reverted', result = ${msg}, updated_at = NOW() WHERE id = ${id} RETURNING *`));
        await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${`Reverted: ${p.title}. ${msg}`}, NOW(), NOW())`);
        break;
      }
      case "await": {
        // Approved, but waiting for something outside ALFRED (money to arrive): off David's list.
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'awaiting', previous_status = status, decided_at = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      }
      case "unqueue":
        // Taking an approved item back before it has been done.
        if (p.status !== "approved") { res.status(409).json({ error: "Only a queued item can be taken back" }); return; }
        out = rowsOf(await db.execute(sql`UPDATE proposals SET status = 'proposed', previous_status = NULL, decided_at = NULL, updated_at = NOW() WHERE id = ${id} RETURNING *`));
        break;
      default:
        res.status(400).json({ error: "Unknown action" }); return;
    }
    res.json({ proposal: withChips(out)[0] });
  } catch (err) {
    console.error("[proposal decision]", err);
    res.status(500).json({ error: "Could not record the decision" });
  }
});

router.get("/projects/:projectId/activity", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const since = typeof req.query.since === "string" && !Number.isNaN(Date.parse(req.query.since)) ? req.query.since : undefined;
    res.json({ runs: await recentActivity(projectId, since, 200) });
  } catch (err) {
    console.error("[activity]", err);
    res.status(500).json({ error: "Could not read the activity log" });
  }
});

export default router;
