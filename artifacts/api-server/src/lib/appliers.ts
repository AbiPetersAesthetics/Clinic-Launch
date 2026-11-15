// Applying a card that only changes ALFRED's own records (owner, 15 Nov 2026: "the entire point is
// that I don't have to remember"). Facts, dates, balances, register entries and model inputs apply
// the moment David approves or answers: each applier records what was there before, so Undo and the
// revert link in Activity can put it back. Anything outside ALFRED (ad budgets, posts, messages to
// patients, ANS, the Google profile, the website) is never applied here; the 08:15 run does those.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { rowsOf } from "./agent-tables";

export type ApplySpec =
  | { type: "bank"; balanceGbp: number; asAt: string; inBalance: number[]; accounts?: { name: string; balanceGbp: number | null; source: string; asAt: string; arriving?: boolean }[] }
  | { type: "funding-dates"; changes: { id: number; depositDate: string | null }[] }
  | { type: "card-entries"; entries: { cardId: number; date: string; kind: "refund" | "purchase" | "payment"; description: string; amountGbp: number; note?: string }[] }
  | { type: "opening-date"; date: string }
  | { type: "model-input"; path: string; value: unknown; label: string }
  | { type: "plan-payments"; reference: string; paymentDate: string; payments: { taskId: number; addGbp: number; label: string }[] }
  | { type: "note"; text: string };

export interface Applied { summary: string; before: unknown; after: unknown }

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const one = <T = any>(r: unknown): T | undefined => rowsOf<T>(r)[0];

async function storedModel(projectId: number): Promise<Record<string, any>> {
  const m = one<{ cash_model_json: string }>(await db.execute(sql`SELECT cash_model_json FROM financial_models WHERE project_id = ${projectId} LIMIT 1`));
  try { return JSON.parse(m?.cash_model_json || "{}") || {}; } catch { return {}; }
}
async function saveModel(projectId: number, stored: Record<string, any>) {
  await db.execute(sql`UPDATE financial_models SET cash_model_json = ${JSON.stringify(stored)} WHERE project_id = ${projectId}`);
}
function setPath(o: Record<string, any>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = o;
  for (const k of keys.slice(0, -1)) cur = cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {};
  if (value === undefined) delete cur[keys[keys.length - 1]]; else cur[keys[keys.length - 1]] = value;
}
function getPath(o: Record<string, any>, path: string) { return path.split(".").reduce((c: any, k) => (c == null ? undefined : c[k]), o); }

export async function applySpec(projectId: number, spec: ApplySpec): Promise<Applied> {
  switch (spec.type) {
    case "bank": {
      const stored = await storedModel(projectId);
      const before = stored.bank ?? null;
      stored.bank = { balanceGbp: Math.round(spec.balanceGbp * 100) / 100, asAt: spec.asAt, inBalance: spec.inBalance ?? [], ...(spec.accounts ? { accounts: spec.accounts } : {}), savedAt: new Date().toISOString() };
      await saveModel(projectId, stored);
      return { summary: `Bank set to ${gbp(spec.balanceGbp)} at ${spec.asAt}${before ? ` (was ${gbp(before.balanceGbp)} at ${before.asAt})` : ""}.`, before, after: stored.bank };
    }
    case "funding-dates": {
      const before: { id: number; depositDate: string | null; name: string }[] = [];
      for (const c of spec.changes) {
        const row = one<{ deposit_date: string | null; name: string }>(await db.execute(sql`SELECT deposit_date, name FROM investments WHERE project_id = ${projectId} AND id = ${c.id}`));
        if (!row) throw new Error(`No funding row ${c.id}`);
        before.push({ id: c.id, depositDate: row.deposit_date, name: row.name });
        await db.execute(sql`UPDATE investments SET deposit_date = ${c.depositDate}, updated_at = NOW() WHERE project_id = ${projectId} AND id = ${c.id}`);
      }
      return { summary: spec.changes.map((c) => { const b = before.find((x) => x.id === c.id)!; return `${b.name}: ${b.depositDate ?? "no date"} to ${c.depositDate ?? "no date"}`; }).join("; ") + ".", before, after: spec.changes };
    }
    case "card-entries": {
      const ids: number[] = [];
      for (const e of spec.entries) {
        const r = one<{ id: number }>(await db.execute(sql`INSERT INTO card_entries (project_id, card_id, date, kind, description, amount_gbp, note) VALUES (${projectId}, ${e.cardId}, ${e.date}, ${e.kind}, ${e.description}, ${e.amountGbp}, ${e.note ?? null}) RETURNING id`));
        if (r) ids.push(r.id);
      }
      return { summary: spec.entries.map((e) => `${e.kind} of ${gbp(e.amountGbp)}, ${e.description}, ${e.date}`).join("; ") + ".", before: null, after: { ids } };
    }
    case "opening-date": {
      const row = one<{ target_opening_date: string | null }>(await db.execute(sql`SELECT target_opening_date FROM projects WHERE id = ${projectId}`));
      await db.execute(sql`UPDATE projects SET target_opening_date = ${spec.date} WHERE id = ${projectId}`);
      return { summary: `Opening date set to ${spec.date} (was ${row?.target_opening_date ?? "none"}).`, before: row?.target_opening_date ?? null, after: spec.date };
    }
    case "model-input": {
      const stored = await storedModel(projectId);
      const before = getPath(stored, spec.path);
      setPath(stored, spec.path, spec.value);
      await saveModel(projectId, stored);
      return { summary: `${spec.label}: set to ${JSON.stringify(spec.value)}${before !== undefined ? ` (was ${JSON.stringify(before)})` : ""}.`, before: { path: spec.path, value: before }, after: { path: spec.path, value: spec.value } };
    }
    case "plan-payments": {
      // A payment against plan lines, entered the way earlier payments were: the gross paid added to
      // each line's amount paid, the line marked part-paid, and the date set only where it had none.
      const before: any[] = [];
      for (const p of spec.payments) {
        const t = one<any>(await db.execute(sql`SELECT t.id, t.amount_paid_gbp, t.paid_status, t.payment_date, o.id AS oid, o.paid_status AS o_paid, o.payment_date AS o_date FROM launch_tasks t LEFT JOIN property_task_overrides o ON o.task_id = t.id AND o.property_id = (SELECT id FROM clinic_properties WHERE project_id = ${projectId} AND is_active_for_project = TRUE LIMIT 1) WHERE t.id = ${p.taskId}`));
        if (!t) throw new Error(`No plan line ${p.taskId}`);
        before.push(t);
        const amt = Math.round((Number(t.amount_paid_gbp ?? 0) + p.addGbp) * 100) / 100;
        await db.execute(sql`UPDATE launch_tasks SET amount_paid_gbp = ${amt}, paid_status = CASE WHEN coalesce(paid_status, '') = 'paid' THEN paid_status ELSE 'part-paid' END, payment_date = coalesce(payment_date, ${spec.paymentDate}) WHERE id = ${p.taskId}`);
        if (t.oid && t.o_paid != null) await db.execute(sql`UPDATE property_task_overrides SET paid_status = CASE WHEN paid_status = 'paid' THEN paid_status ELSE 'part-paid' END, payment_date = coalesce(payment_date, ${spec.paymentDate}) WHERE id = ${t.oid}`);
      }
      const total = spec.payments.reduce((s, p) => s + p.addGbp, 0);
      return { summary: `${spec.reference}: ${gbp(total)} entered against ${spec.payments.length} plan lines (${spec.payments.map((p) => `${p.label} ${gbp(p.addGbp)}`).join(", ")}).`, before, after: spec.payments };
    }
    case "note":
      return { summary: spec.text, before: null, after: null };
  }
}

export async function revertSpec(projectId: number, spec: ApplySpec, applied: Applied): Promise<string> {
  switch (spec.type) {
    case "bank": {
      const stored = await storedModel(projectId);
      if (applied.before) stored.bank = applied.before; else delete stored.bank;
      await saveModel(projectId, stored);
      return "Bank put back as it was.";
    }
    case "funding-dates":
      for (const b of applied.before as { id: number; depositDate: string | null }[]) await db.execute(sql`UPDATE investments SET deposit_date = ${b.depositDate}, updated_at = NOW() WHERE project_id = ${projectId} AND id = ${b.id}`);
      return "Funding dates put back.";
    case "card-entries":
      for (const id of ((applied.after as any)?.ids ?? []) as number[]) await db.execute(sql`DELETE FROM card_entries WHERE project_id = ${projectId} AND id = ${id}`);
      return "The added entries were taken off again.";
    case "opening-date":
      await db.execute(sql`UPDATE projects SET target_opening_date = ${applied.before as string | null} WHERE id = ${projectId}`);
      return "Opening date put back.";
    case "model-input": {
      const stored = await storedModel(projectId);
      const b = applied.before as { path: string; value: unknown };
      setPath(stored, b.path, b.value);
      await saveModel(projectId, stored);
      return "Model input put back.";
    }
    case "plan-payments":
      for (const t of applied.before as any[]) {
        await db.execute(sql`UPDATE launch_tasks SET amount_paid_gbp = ${t.amount_paid_gbp}, paid_status = ${t.paid_status}, payment_date = ${t.payment_date} WHERE id = ${t.id}`);
        if (t.oid && t.o_paid != null) await db.execute(sql`UPDATE property_task_overrides SET paid_status = ${t.o_paid}, payment_date = ${t.o_date} WHERE id = ${t.oid}`);
      }
      return "The payment was taken off the plan lines again.";
    case "note":
      return "Nothing to put back.";
  }
}
