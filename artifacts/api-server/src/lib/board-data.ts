// Loads the latest inputs for each board summary, the same rows the board renderers read.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildCashModel } from "../routes/cash-model";
import { adsSummary, clinicSummary, moneySummary, type CardLite, type Summary } from "../boards/summaries";

const first = (r: unknown) => (((r as any).rows ?? r) as any[])[0] ?? null;

export async function latestAds(projectId: number): Promise<any | null> {
  try { return first(await db.execute(sql`SELECT data FROM ads_pathway_snapshots WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 1`))?.data ?? null; } catch { return null; }
}

export async function latestBoard(projectId: number, key: string): Promise<any | null> {
  try { return first(await db.execute(sql`SELECT data FROM board_snapshots WHERE project_id = ${projectId} AND key = ${key} ORDER BY created_at DESC LIMIT 1`))?.data ?? null; } catch { return null; }
}

// The latest snapshot with the time it was pushed, for sources whose file carries no date of its own.
export async function latestBoardRow(projectId: number, key: string): Promise<any | null> {
  try {
    const r = first(await db.execute(sql`SELECT data, created_at FROM board_snapshots WHERE project_id = ${projectId} AND key = ${key} ORDER BY created_at DESC LIMIT 1`));
    return r ? { ...r.data, pushedIso: new Date(r.created_at).toISOString() } : null;
  } catch { return null; }
}

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Each open card's balance today: opening, purchases, transfers, fees and interest add; payments
// and refunds take off. Entries dated after today are not yet on the card.
export async function cardBalances(projectId: number): Promise<CardLite[]> {
  const today = londonToday();
  const cards = ((await db.execute(sql`SELECT id, name, credit_limit_gbp, status FROM credit_cards WHERE project_id = ${projectId}`)) as any).rows ?? [];
  const entries = ((await db.execute(sql`SELECT card_id, date, kind, amount_gbp FROM card_entries WHERE project_id = ${projectId}`)) as any).rows ?? [];
  return cards.filter((c: any) => c.status !== "closed").map((c: any) => {
    const mine = entries.filter((e: any) => Number(e.card_id) === Number(c.id) && String(e.date) <= today);
    const balance = mine.reduce((s: number, e: any) => s + (e.kind === "payment" || e.kind === "refund" ? -1 : 1) * Number(e.amount_gbp), 0);
    const last = mine.map((e: any) => String(e.date)).sort().pop() ?? null;
    return { name: c.name, limit: Number(c.credit_limit_gbp ?? 0), balance: Math.round(balance * 100) / 100, lastEntry: last };
  });
}

export async function summaryFor(projectId: number, key: "ads" | "clinic" | "money"): Promise<Summary> {
  if (key === "ads") return adsSummary(await latestAds(projectId), new Date(), await latestBoardRow(projectId, "videos"));
  if (key === "clinic") return clinicSummary(await latestBoard(projectId, "clinic"));
  let J: any = null;
  try { J = await buildCashModel(projectId, { months: 12 }); } catch (err) { console.error("[summary money]", err); }
  return moneySummary(J, await cardBalances(projectId));
}

// Which summary each board page shows above its detail.
export const BOARD_SUMMARY: Record<string, "ads" | "clinic" | "money"> = {
  ads: "ads", "ads-ideas": "ads", opening: "ads", clinic: "clinic",
  "build-cash": "money", "cash-line": "money", "money-plan": "money", money: "money",
};
