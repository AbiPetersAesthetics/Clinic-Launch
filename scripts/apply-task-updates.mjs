import { readFileSync } from "fs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PROPERTY_ID = 11;

function selectedCost(tier, low, mid, high) {
  if (tier === "low") return low;
  if (tier === "mid") return mid;
  if (tier === "high") return high;
  return mid;
}

async function main() {
  const raw = readFileSync(
    "attached_assets/Pasted--summary-Full-line-by-line-JSON-update-for-the-Abi-Pete_1779188277475.txt",
    "utf8"
  );
  const { task_updates } = JSON.parse(raw);

  // Fetch all tasks: id + title
  const { rows: dbTasks } = await pool.query("SELECT id, title FROM launch_tasks ORDER BY id");
  const titleToId = new Map(dbTasks.map((r) => [r.title.trim(), r.id]));

  let matched = 0;
  let skipped = [];

  for (const t of task_updates) {
    const taskId = titleToId.get(t.title.trim());
    if (!taskId) {
      skipped.push(t.title);
      continue;
    }

    // 1. Update risk_level in launch_tasks
    await pool.query(
      `UPDATE launch_tasks SET risk_level = $1, updated_at = NOW() WHERE id = $2`,
      [t.risk_level, taskId]
    );

    // 2. Upsert property_task_overrides
    const sc = selectedCost(t.cost_tier, t.cost_low, t.cost_mid, t.cost_high);
    await pool.query(
      `INSERT INTO property_task_overrides
         (property_id, task_id, status, notes, owner, cost_tier, cost_low, cost_mid, cost_high, selected_cost, start_date, due_date, duration_days, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (property_id, task_id) DO UPDATE SET
         status        = EXCLUDED.status,
         notes         = EXCLUDED.notes,
         owner         = EXCLUDED.owner,
         cost_tier     = EXCLUDED.cost_tier,
         cost_low      = EXCLUDED.cost_low,
         cost_mid      = EXCLUDED.cost_mid,
         cost_high     = EXCLUDED.cost_high,
         selected_cost = EXCLUDED.selected_cost,
         start_date    = EXCLUDED.start_date,
         due_date      = EXCLUDED.due_date,
         duration_days = EXCLUDED.duration_days,
         updated_at    = NOW()`,
      [
        PROPERTY_ID,
        taskId,
        t.status,
        t.notes,
        t.owner,
        t.cost_tier,
        t.cost_low,
        t.cost_mid,
        t.cost_high,
        sc,
        t.start_date,
        t.end_date,
        t.duration_days,
      ]
    );

    matched++;
  }

  console.log(`Done. Matched and updated: ${matched}`);
  if (skipped.length > 0) {
    console.log(`\nSkipped (no DB match for ${skipped.length} titles):`);
    skipped.forEach((s) => console.log("  -", s));
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
