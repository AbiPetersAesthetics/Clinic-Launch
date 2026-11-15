// Writes a proposal into ALFRED: something an agent wants done, with its evidence, waiting for
// David's yes on Today. A tap there only records the decision; the action itself runs in the next
// live Claude session after one "go" in chat (abi-peters-skin-clinic/ops/run-approved.md).
// Usage (from the Clinic-Launch folder):
//   node --env-file=.env scripts/push-proposal.mjs <path to proposal json>
//   node --env-file=.env scripts/push-proposal.mjs --withdraw <id> ["reason"]
//   node --env-file=.env scripts/push-proposal.mjs --done <id> "what was done, read back from the source"
//   node --env-file=.env scripts/push-proposal.mjs --cancel <id> "the guard that tripped"
//   node --env-file=.env scripts/push-proposal.mjs --answer <id> "the answer to David's question"
//   node --env-file=.env scripts/push-proposal.mjs --questions ["Agent name"]   (open questions to answer)
//   node --env-file=.env scripts/push-proposal.mjs --queue     (approved items for a live session)
// Proposal fields: agent, title (a verb phrase), area (money, clinic, ads, growth), kind (budget,
// pause, publish, content, task, general), why, risk, onApproval, guard, expiresAt (ISO),
// sources [{source: "meta"|"ghl"|"ans"|"clarity"|"ansTakings"|"bank"|"cards"|"gsc", asOf: ISO}],
// evidence (any JSON), evidenceChanged (true to re-propose something rejected in the last 30 days),
// decideWith ("Abi and David" for anything touching Abi's working pattern or clinical time).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "lib", "db", "package.json"));
const { Client } = require("pg");

const DDL = `CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1,
  area TEXT NOT NULL DEFAULT 'ads', kind TEXT NOT NULL DEFAULT 'general', agent TEXT NOT NULL,
  title TEXT NOT NULL, why TEXT, risk TEXT, on_approval TEXT, guard TEXT,
  sources JSONB NOT NULL DEFAULT '[]', evidence JSONB,
  expires_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'proposed',
  previous_status TEXT, reason TEXT, question TEXT, answer TEXT, result TEXT,
  snooze_until TIMESTAMPTZ, decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

// The rules that are never broken, checked in code (UX plan 3.1 and 3.2, tier 3): no em or en
// dashes, no percentage discounts, no guarantee words, no prescription-only medicine named.
const POM = /\b(botox|botulinum|azzalure|bocouture|dysport|xeomin|letybo|relfydess|alluzience|vistabel|lidocaine|hyaluronidase|hyalase|tretinoin|isotretinoin|semaglutide|tirzepatide|ozempic|wegovy|mounjaro|saxenda)\b/i;
const PCT_OFF = /\b\d+\s?%\s?(off|discount|saving)\b|save\s+\d+\s?%/i;
const GUARANTEE = /\b(guarantee[ds]?|perfect|flawless|erase[sd]?|pain[- ]free|turn back time)\b/i;
function breaches(p) {
  const text = [p.title, p.why, p.risk, p.onApproval, p.guard, typeof p.evidence === "string" ? p.evidence : JSON.stringify(p.evidence ?? "")].join(" ");
  const out = [];
  if (/[\u2013\u2014]/.test(text)) out.push("an em or en dash");
  if (POM.test(text)) out.push("a prescription-only medicine name");
  if (PCT_OFF.test(text)) out.push("a percentage discount");
  if (GUARANTEE.test(text)) out.push("a guarantee word");
  return out;
}

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing: run with --env-file=.env"); process.exit(1); }
const args = process.argv.slice(2);
if (!args.length) { console.error("Give a proposal JSON file, or --withdraw, --done, --cancel or --answer with an id, or --queue, or --questions"); process.exit(1); }
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(DDL);
await client.query("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS decide_with TEXT, ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'approve', ADD COLUMN IF NOT EXISTS fields JSONB, ADD COLUMN IF NOT EXISTS options JSONB, ADD COLUMN IF NOT EXISTS reply JSONB, ADD COLUMN IF NOT EXISTS apply JSONB, ADD COLUMN IF NOT EXISTS action_class TEXT NOT NULL DEFAULT 'outside', ADD COLUMN IF NOT EXISTS applied JSONB");
const update = async (id, status, col, text, from) => {
  const r = await client.query(`UPDATE proposals SET status = $2, ${col} = $3, updated_at = NOW() WHERE id = $1 AND project_id = 1 AND status = ANY($4) RETURNING id, title, status`, [Number(id), status, text ?? null, from]);
  if (!r.rows.length) { console.error(`Proposal ${id} is not in a state that allows that (needs ${from.join(" or ")})`); process.exitCode = 1; }
  else console.log(`ALFRED proposal ${r.rows[0].id} "${r.rows[0].title}" is now ${r.rows[0].status}`);
};
try {
  if (args[0] === "--update") {
    // Rewrite an open card's face (title, why, card type, fields, options) from a JSON file.
    const p = JSON.parse(readFileSync(args[2], "utf8"));
    const bad = breaches(p);
    if (bad.length) throw new Error(`Refused: the update contains ${bad.join(", ")}.`);
    const r = await client.query(`UPDATE proposals SET title = coalesce($2, title), why = coalesce($3, why), card_type = coalesce($4, card_type), fields = coalesce($5, fields), options = coalesce($6, options), decide_with = coalesce($7, decide_with), on_approval = coalesce($8, on_approval), area = coalesce($9, area), apply = coalesce($10, apply), action_class = coalesce($11, action_class), status = coalesce($12, status), result = coalesce($13, result), reply = coalesce($14, reply), question = CASE WHEN $15::boolean THEN NULL ELSE question END, previous_status = CASE WHEN $12::text IS NULL THEN previous_status ELSE status END, decided_at = CASE WHEN $12::text IS NULL THEN decided_at ELSE NOW() END, updated_at = NOW() WHERE id = $1 AND project_id = 1 RETURNING id, title, card_type`,
      [Number(args[1]), p.title ?? null, p.why ?? null, p.cardType ?? null, p.fields ? JSON.stringify(p.fields) : null, p.options ? JSON.stringify(p.options) : null, p.decideWith ?? null, p.onApproval ?? null, p.area ?? null, p.apply ? JSON.stringify(p.apply) : null, p.actionClass ?? null, p.status ?? null, p.result ?? null, p.reply ? JSON.stringify(p.reply) : null, p.clearQuestion === true]);
    console.log(r.rows.length ? `ALFRED card ${r.rows[0].id} is now a ${r.rows[0].card_type} card: "${r.rows[0].title}"` : `No card ${args[1]}`);
  } else if (args[0] === "--replies") {
    // Answers and choices the owner has given, for the next live session to apply.
    const r = await client.query(`SELECT id, title, card_type, status, reply, question FROM proposals WHERE project_id = 1 AND status IN ('answered', 'chosen', 'asked') ORDER BY updated_at`);
    if (!r.rows.length) console.log("No answers or questions waiting.");
    for (const p of r.rows) console.log(`${p.id}  [${p.status}] ${p.title}: ${p.status === "asked" ? `question: ${p.question}` : JSON.stringify(p.reply)}`);
  } else if (args[0] === "--applied") {
    const r = await client.query(`UPDATE proposals SET status = 'done', result = $2, updated_at = NOW() WHERE id = $1 AND status IN ('answered', 'chosen') RETURNING id, title`, [Number(args[1]), args[2] ?? null]);
    console.log(r.rows.length ? `ALFRED card ${r.rows[0].id} applied: ${args[2] ?? ""}` : `Card ${args[1]} has no answer waiting`);
  } else if (args[0] === "--withdraw") await update(args[1], "withdrawn", "reason", args[2] ?? "Withdrawn by the agent", ["proposed", "asked", "snoozed", "approved"]);
  else if (args[0] === "--done") await update(args[1], "done", "result", args[2], ["approved"]);
  else if (args[0] === "--cancel") await update(args[1], "cancelled", "result", args[2], ["approved"]);
  else if (args[0] === "--answer") {
    if (/[\u2013\u2014]/.test(args[2] ?? "")) throw new Error("Refused: the answer contains an em or en dash");
    const r = await client.query(`UPDATE proposals SET answer = $2, status = 'proposed', updated_at = NOW() WHERE id = $1 AND status = 'asked' RETURNING id`, [Number(args[1]), args[2]]);
    console.log(r.rows.length ? `Answered proposal ${args[1]}; it is back on Today as unread` : `Proposal ${args[1]} has no open question`);
  } else if (args[0] === "--questions") {
    const r = await client.query(`SELECT id, agent, title, question FROM proposals WHERE project_id = 1 AND status = 'asked' AND ($1::text IS NULL OR agent = $1) ORDER BY decided_at`, [args[1] ?? null]);
    if (!r.rows.length) console.log("No open questions.");
    for (const p of r.rows) console.log(`${p.id}  ${p.title}  (to ${p.agent}): ${p.question}`);
  } else if (args[0] === "--queue") {
    const r = await client.query(`SELECT id, area, agent, title, guard, decided_at FROM proposals WHERE project_id = 1 AND status = 'approved' ORDER BY decided_at`);
    if (!r.rows.length) console.log("Nothing approved is waiting.");
    for (const p of r.rows) console.log(`${p.id}  [${p.area}] ${p.title}  (from ${p.agent}; approved ${p.decided_at.toISOString()}; guard: ${p.guard ?? "none"})`);
  } else {
    const p = JSON.parse(readFileSync(args[0], "utf8"));
    if (!p.agent || !p.title) throw new Error("A proposal needs at least agent and title");
    const bad = breaches(p);
    if (bad.length) throw new Error(`Refused: the proposal contains ${bad.join(", ")}. Reword it and push again.`);
    // Agents read the last 30 days of rejections before proposing the same thing again.
    const rej = await client.query(`SELECT id, reason, updated_at FROM proposals WHERE project_id = 1 AND status = 'rejected' AND lower(title) = lower($1) AND updated_at > NOW() - INTERVAL '30 days'`, [p.title]);
    if (rej.rows.length && !p.evidenceChanged) throw new Error(`Refused: "${p.title}" was rejected on ${rej.rows[0].updated_at.toISOString().slice(0, 10)} (${rej.rows[0].reason ?? "no reason given"}). Set "evidenceChanged": true only if the evidence has changed materially.`);
    const r = await client.query(
      `INSERT INTO proposals (project_id, area, kind, agent, title, why, risk, on_approval, guard, sources, evidence, expires_at, decide_with, card_type, fields, options, apply, action_class)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id, created_at`,
      [p.area ?? "ads", p.kind ?? "general", p.agent, p.title, p.why ?? null, p.risk ?? null, p.onApproval ?? null, p.guard ?? null,
        JSON.stringify(p.sources ?? []), p.evidence === undefined ? null : JSON.stringify(p.evidence), p.expiresAt ?? null, p.decideWith ?? null, p.cardType ?? "approve", p.fields ? JSON.stringify(p.fields) : null, p.options ? JSON.stringify(p.options) : null, p.apply ? JSON.stringify(p.apply) : null, p.actionClass ?? (p.apply ? "record" : "outside")]);
    console.log(`ALFRED proposal ${r.rows[0].id} saved at ${r.rows[0].created_at.toISOString()}: "${p.title}"`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
