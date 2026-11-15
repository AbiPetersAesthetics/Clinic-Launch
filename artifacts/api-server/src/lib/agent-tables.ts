// The two tables every agent writes to besides its data snapshot (UX plan 3.1): proposals
// (something an agent wants done, awaiting David's yes) and activity (one row per run, even when
// nothing changed). Created if missing, the same way board_snapshots is made by
// scripts/push-board.mjs; scripts/push-proposal.mjs and scripts/log-run.mjs use the same SQL.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const PROPOSALS_DDL = `CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1,
  area TEXT NOT NULL DEFAULT 'ads', kind TEXT NOT NULL DEFAULT 'general', agent TEXT NOT NULL,
  title TEXT NOT NULL, why TEXT, risk TEXT, on_approval TEXT, guard TEXT,
  sources JSONB NOT NULL DEFAULT '[]', evidence JSONB,
  expires_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'proposed',
  previous_status TEXT, reason TEXT, question TEXT, answer TEXT, result TEXT,
  snooze_until TIMESTAMPTZ, decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

export const ACTIVITY_DDL = `CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1,
  agent TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ok', summary TEXT,
  sources JSONB NOT NULL DEFAULT '[]', wrote JSONB NOT NULL DEFAULT '[]',
  proposed INTEGER NOT NULL DEFAULT 0, alerts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

// One shared promise, so concurrent first requests do not race each other's CREATE TABLE.
let ensuring: Promise<void> | null = null;
export function ensureAgentTables(): Promise<void> {
  ensuring ??= (async () => {
    // decide_with: a decision for more than David alone, such as Abi's working pattern (owner, 15 Nov 2026).
    for (const ddl of [PROPOSALS_DDL, ACTIVITY_DDL, "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS decide_with TEXT, ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'approve', ADD COLUMN IF NOT EXISTS fields JSONB, ADD COLUMN IF NOT EXISTS options JSONB, ADD COLUMN IF NOT EXISTS reply JSONB, ADD COLUMN IF NOT EXISTS apply JSONB, ADD COLUMN IF NOT EXISTS action_class TEXT NOT NULL DEFAULT 'outside', ADD COLUMN IF NOT EXISTS applied JSONB"]) {
      try { await db.execute(sql.raw(ddl)); }
      catch (err: any) { if ((err?.cause?.code ?? err?.code) !== "23505") { ensuring = null; throw err; } }
    }
  })();
  return ensuring;
}

export const rowsOf = <T = any>(r: unknown): T[] => ((r as any).rows ?? r) as T[];

export interface ProposalRow {
  id: number; area: string; kind: string; agent: string; title: string; why: string | null; risk: string | null;
  on_approval: string | null; guard: string | null; decide_with?: string | null; card_type?: string; apply?: any; action_class?: string; applied?: any; fields?: { key: string; label: string; type?: string }[] | null; options?: string[] | null; reply?: any; sources: { source: string; asOf: string }[]; evidence: unknown;
  expires_at: string | null; status: string; previous_status: string | null; reason: string | null; question: string | null;
  answer: string | null; result: string | null; snooze_until: string | null; decided_at: string | null; created_at: string; updated_at: string;
}

export interface ActivityRow {
  id: number; agent: string; status: string; summary: string | null; sources: { source: string; to?: string }[];
  wrote: string[]; proposed: number; alerts: number; started_at: string | null; finished_at: string; created_at: string;
}
