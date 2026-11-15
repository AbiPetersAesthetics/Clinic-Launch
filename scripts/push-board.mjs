// Pushes a board's data file into ALFRED as the latest snapshot for that board.
// Usage (from the Clinic-Launch folder):
//   node --env-file=.env scripts/push-board.mjs <key> <path to json>
// Keys in use: clinic (abi-peters-skin-clinic/ops/clinic/clinic.json), videos (ads/meta/videos.json,
// the filming queue for the Social Board), seo (seo/targets.json, the SEO Board).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "lib", "db", "package.json"));
const { Client } = require("pg");

const [key, file] = process.argv.slice(2);
if (!key || !file) { console.error("Give a board key and the path to its JSON"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing: run with --env-file=.env"); process.exit(1); }
const data = JSON.parse(readFileSync(file, "utf8"));
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS board_snapshots (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, key TEXT NOT NULL, data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
const r = await client.query("INSERT INTO board_snapshots (project_id, key, data) VALUES (1, $1, $2) RETURNING id, created_at", [key, data]);
await client.end();
console.log(`ALFRED ${key} snapshot ${r.rows[0].id} saved at ${r.rows[0].created_at.toISOString()}`);
