// The heartbeat (UX plan 3.3): silence is a failure, not a success. Every scheduled agent writes an
// activity row each run; when a due run has not logged one within its grace, it is missed and shows
// on Today. Checked whenever the brief is read and, in the server, every 15 minutes, writing one
// "missed" activity row per missed slot so Activity keeps the record.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { slotsBefore } from "./freshness";
import { ensureAgentTables, rowsOf } from "./agent-tables";

export interface Schedule { agent: string; slots: number[]; weekdays?: number[]; graceH: number; label: string }

// London times, matching the scheduled tasks (their jitter is up to about 15 minutes).
export const SCHEDULES: Schedule[] = [
  { agent: "Pathway check", slots: [8, 12, 16], graceH: 2, label: "08:00, 12:00 and 16:00" },
  { agent: "Clinic refresh", slots: [7.5], graceH: 2, label: "daily at about 07:40" },
  { agent: "Meta review", slots: [9.5], weekdays: [1, 4], graceH: 3, label: "Mondays and Thursdays 09:30" },
  { agent: "Capacity review", slots: [12.5], weekdays: [1], graceH: 3, label: "Mondays 12:30" },
  { agent: "Money watch", slots: [7 + 50 / 60], graceH: 2, label: "daily 07:50" },
  { agent: "Search and reviews", slots: [8.5], weekdays: [2], graceH: 3, label: "Tuesdays 08:30" },
  { agent: "Brief", slots: [7 + 55 / 60], graceH: 2, label: "daily 07:55" },
];

const hm = (d: Date) => d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// An agent counts only once it has logged at least one run, so an agent whose run book has not yet
// adopted log-run is never reported as missing.
export async function missedRuns(projectId: number, now = new Date()) {
  await ensureAgentTables();
  const last = rowsOf<{ agent: string; first: string; latest: string }>(await db.execute(sql`
    SELECT agent, min(coalesce(started_at, finished_at)) AS first, max(coalesce(started_at, finished_at)) AS latest
    FROM activity WHERE project_id = ${projectId} AND status <> 'missed' GROUP BY agent`));
  const byAgent = new Map(last.map((r) => [r.agent, r]));
  const out: { agent: string; due: string; dueIso: string }[] = [];
  for (const s of SCHEDULES) {
    const seen = byAgent.get(s.agent);
    if (!seen) continue;
    const due = slotsBefore(now, s.slots, 8, s.weekdays).find((d) => d.getTime() + s.graceH * 3600000 <= now.getTime());
    if (!due || Date.parse(seen.first) > due.getTime()) continue;
    // A run may start up to 15 minutes before its slot is reached by the clock it runs on.
    if (Date.parse(seen.latest) < due.getTime() - 15 * 60000) out.push({ agent: s.agent, due: hm(due), dueIso: due.toISOString() });
  }
  return out;
}

export async function heartbeat(projectId = 1) {
  const missed = await missedRuns(projectId);
  for (const m of missed) {
    const already = rowsOf(await db.execute(sql`SELECT id FROM activity WHERE project_id = ${projectId} AND agent = ${m.agent} AND status = 'missed' AND started_at = ${m.dueIso} LIMIT 1`));
    if (!already.length) await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, ${m.agent}, 'missed', ${`Due ${m.due}; no run logged within its grace.`}, ${m.dueIso}, NOW())`);
  }
  return missed;
}

export function startHeartbeat() {
  const tick = () => {
    heartbeat().catch((err) => console.error("[heartbeat]", err));
    // Only the hosted app applies cards approved earlier, so a local copy never writes on its own.
    if (process.env.NODE_ENV === "production") import("../routes/proposals").then((m) => m.applyWaiting()).catch((err) => console.error("[apply waiting]", err));
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 15 * 60_000);
}
