// Ready for Winchester (owner, 16 Nov 2026): Abi's countdown to the first patients on 2 December.
// Each item carries a first draft written for her (patient flow, room layout, cupboard, SOP
// outlines) that she edits rather than starting from a blank page, plus a status, an owner, a due
// date and her own notes. The seed only ever inserts items whose key is missing, so her edits,
// ticks and notes are never overwritten by a later deploy.
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { rowsOf, ensureAgentTables } from "../lib/agent-tables";
import { READY_SECTIONS, READY_ITEMS, FIRST_PATIENTS, OPENING } from "../lib/readiness-seed";

const router = Router();

const DDL = `CREATE TABLE IF NOT EXISTS readiness_items (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, key TEXT NOT NULL,
  section TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL,
  draft TEXT, edited BOOLEAN NOT NULL DEFAULT FALSE, due DATE, owner TEXT NOT NULL DEFAULT 'Abi',
  status TEXT NOT NULL DEFAULT 'todo', note TEXT, done_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, key))`;

let ready: Promise<void> | null = null;
const ensure = (projectId: number) => (ready ??= (async () => {
  try {
    await db.execute(sql.raw(DDL));
    for (const it of READY_ITEMS) {
      await db.execute(sql`INSERT INTO readiness_items (project_id, key, section, sort_order, title, draft, due, owner)
        VALUES (${projectId}, ${it.key}, ${it.section}, ${it.order}, ${it.title}, ${it.draft ?? null}, ${it.due ?? null}, ${it.owner})
        ON CONFLICT (project_id, key) DO NOTHING`);
    }
  } catch (e: any) { if ((e?.cause?.code ?? e?.code) !== "23505") { ready = null; throw e; } }
})());

const STATUSES = ["todo", "doing", "done", "na"] as const;
const OWNERS = ["Abi", "David", "Both"] as const;
// House rule: no em or en dashes anywhere. Typed ones become a comma rather than an error.
const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s*[–—]\s*/g, ", ").slice(0, max);
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const ymd = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);

export async function readinessList(projectId: number) {
  await ensure(projectId);
  const rows = rowsOf<any>(await db.execute(sql`SELECT * FROM readiness_items WHERE project_id = ${projectId} ORDER BY sort_order, id`));
  const today = londonToday();
  const items = rows.map((r) => ({
    id: r.id, key: r.key, section: r.section, order: r.sort_order, title: r.title, draft: r.draft, edited: r.edited,
    due: ymd(r.due), owner: r.owner, status: r.status, note: r.note, doneAt: r.done_at ? new Date(r.done_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
  const open = items.filter((i) => i.status === "todo" || i.status === "doing");
  const counted = items.filter((i) => i.status !== "na");
  const week = open.filter((i) => i.due && daysBetween(today, i.due) <= 7).sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : a.order - b.order));
  return {
    asOf: new Date().toISOString(), today, firstPatients: FIRST_PATIENTS, opening: OPENING,
    daysToFirstPatients: daysBetween(today, FIRST_PATIENTS), daysToOpening: daysBetween(today, OPENING),
    sections: READY_SECTIONS.map((s) => {
      const mine = counted.filter((i) => i.section === s.key);
      return { ...s, total: mine.length, done: mine.filter((i) => i.status === "done").length };
    }),
    items,
    counts: { total: counted.length, done: counted.filter((i) => i.status === "done").length, overdue: open.filter((i) => i.due && i.due < today).length, thisWeek: week.length },
    thisWeek: week.map((i) => i.id),
  };
}

const handle = (fn: (projectId: number, req: any) => Promise<unknown>) => async (req: any, res: any) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json(await fn(parseInt(req.params.projectId), req)); }
  catch (err) { console.error(`[readiness ${req.path}]`, err); res.status(400).json({ error: err instanceof Error ? err.message : "Could not save that" }); }
};

async function logActivity(projectId: number, summary: string) {
  try {
    await ensureAgentTables();
    await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'Ready for Winchester', 'ok', ${summary.slice(0, 900)}, NOW(), NOW())`);
  } catch (e) { console.error("[readiness activity]", e); }
}

router.get("/projects/:projectId/readiness", handle(async (projectId) => readinessList(projectId)));

router.patch("/projects/:projectId/readiness/:id", handle(async (projectId, req) => {
  await ensure(projectId);
  const id = parseInt(req.params.id);
  const b = req.body ?? {};
  const cur = rowsOf<any>(await db.execute(sql`SELECT * FROM readiness_items WHERE project_id = ${projectId} AND id = ${id}`))[0];
  if (!cur) throw new Error("That item no longer exists");
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw new Error("Unknown status");
    await db.execute(sql`UPDATE readiness_items SET status = ${b.status}, done_at = ${b.status === "done" ? sql`NOW()` : null}, updated_at = NOW() WHERE id = ${id}`);
    if (b.status !== cur.status && (b.status === "done" || cur.status === "done")) await logActivity(projectId, `${b.status === "done" ? "Done" : "Reopened"}: ${cur.title}`);
  }
  if (b.note !== undefined) await db.execute(sql`UPDATE readiness_items SET note = ${clean(b.note, 4000) || null}, updated_at = NOW() WHERE id = ${id}`);
  if (b.draft !== undefined) await db.execute(sql`UPDATE readiness_items SET draft = ${clean(b.draft, 12000) || null}, edited = TRUE, updated_at = NOW() WHERE id = ${id}`);
  if (b.title !== undefined) { const t = clean(b.title, 160).trim(); if (!t) throw new Error("Give it a name"); await db.execute(sql`UPDATE readiness_items SET title = ${t}, updated_at = NOW() WHERE id = ${id}`); }
  if (b.owner !== undefined) { if (!OWNERS.includes(b.owner)) throw new Error("Owner is Abi, David or Both"); await db.execute(sql`UPDATE readiness_items SET owner = ${b.owner}, updated_at = NOW() WHERE id = ${id}`); }
  if (b.due !== undefined) { const d = b.due ? String(b.due).slice(0, 10) : null; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Use a date"); await db.execute(sql`UPDATE readiness_items SET due = ${d}, updated_at = NOW() WHERE id = ${id}`); }
  return readinessList(projectId);
}));

router.post("/projects/:projectId/readiness", handle(async (projectId, req) => {
  await ensure(projectId);
  const b = req.body ?? {};
  const title = clean(b.title, 160).trim();
  if (!title) throw new Error("Give it a name");
  const section = READY_SECTIONS.some((s) => s.key === b.section) ? b.section : READY_SECTIONS[0].key;
  const owner = OWNERS.includes(b.owner) ? b.owner : "Abi";
  const due = b.due && /^\d{4}-\d{2}-\d{2}$/.test(String(b.due)) ? String(b.due) : null;
  await db.execute(sql`INSERT INTO readiness_items (project_id, key, section, sort_order, title, owner, due)
    VALUES (${projectId}, ${"own-" + Date.now()}, ${section}, 9000, ${title}, ${owner}, ${due})`);
  return readinessList(projectId);
}));

export default router;
