// Pushes one Ads Pathway snapshot into Launch OS.
// Usage (from the Clinic-Launch folder):
//   node --env-file=.env scripts/push-ads-pathway.mjs <path to pathway.json>
// Merges ads-plan.json from the same folder as data.plan, for the Ads Board.
// Called by the twice-daily pathway check (abi-peters-skin-clinic/ads/meta/pathway/README.md).
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "lib", "db", "package.json"));
const { Client } = require("pg");

const file = process.argv[2];
if (!file) { console.error("Give the path to pathway.json"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing: run with --env-file=.env"); process.exit(1); }
const data = JSON.parse(readFileSync(file, "utf8"));
// The Ads Board plan (calendar, schedule, simulator assumptions) sits beside pathway.json.
const planFile = path.join(path.dirname(file), "ads-plan.json");
if (existsSync(planFile)) data.plan = JSON.parse(readFileSync(planFile, "utf8"));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS ads_pathway_snapshots (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
const r = await client.query("INSERT INTO ads_pathway_snapshots (project_id, data) VALUES (1, $1) RETURNING id, created_at", [data]);
await client.end();
console.log(`Launch OS snapshot ${r.rows[0].id} saved at ${r.rows[0].created_at.toISOString()}`);
