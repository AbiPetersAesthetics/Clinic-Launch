// Writes one activity row for a scheduled run, even when nothing changed (silence is a failure):
// ALFRED's Today line and Activity page read these rows, and the heartbeat marks an agent missed
// when a due run has not logged one.
// Usage (from the Clinic-Launch folder):
//   node --env-file=.env scripts/log-run.mjs --agent "Pathway check" --status ok
//     --summary "2 new leads, 1 booking matched by phone"
//     --read "meta=2026-11-16T08:12:00Z,ghl=2026-11-16T08:10:00Z,ans=2026-11-16T08:05:00Z"
//     --wrote "Ads snapshot 14" --proposed 0 --alerts 0 --started 2026-11-16T08:02:00Z
// (all on one line). --status is ok, partial (a source was skipped: say which in --summary) or
// failed. Agent names in use: "Pathway check", "Clinic refresh", "Meta review", "Capacity review",
// "Money watch", "Content planner", "Morning brief".
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "lib", "db", "package.json"));
const { Client } = require("pg");

const DDL = `CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1,
  agent TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ok', summary TEXT,
  sources JSONB NOT NULL DEFAULT '[]', wrote JSONB NOT NULL DEFAULT '[]',
  proposed INTEGER NOT NULL DEFAULT 0, alerts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

const a = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
if (!a.agent) { console.error("Give --agent"); process.exit(1); }
const status = a.status ?? "ok";
if (!["ok", "partial", "failed"].includes(status)) { console.error("--status must be ok, partial or failed"); process.exit(1); }
if (/[–—]/.test(a.summary ?? "")) { console.error("Refused: the summary contains an em or en dash"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing: run with --env-file=.env"); process.exit(1); }
const sources = (a.read ?? "").split(",").filter(Boolean).map((p) => { const [source, to] = p.split("="); return { source: source.trim(), to: to?.trim() }; });
const wrote = (a.wrote ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(DDL);
const r = await client.query(
  `INSERT INTO activity (project_id, agent, status, summary, sources, wrote, proposed, alerts, started_at, finished_at)
   VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, NOW())) RETURNING id, finished_at`,
  [a.agent, status, a.summary ?? null, JSON.stringify(sources), JSON.stringify(wrote), Number(a.proposed ?? 0), Number(a.alerts ?? 0), a.started ?? null, a.finished ?? null]);
await client.end();
console.log(`ALFRED activity ${r.rows[0].id}: ${a.agent} ${status} at ${r.rows[0].finished_at.toISOString()}`);
