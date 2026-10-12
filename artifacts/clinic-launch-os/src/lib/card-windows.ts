// The 0% buying windows on the cards. An offer's "buy by" date is the last day a new
// purchase gets its rate: on many cards that is 60 or 90 days after opening, long before
// the offer itself ends, and anything bought later is charged the standard rate at once.
// The Credit Cards page and Today both read the windows from here, so they always agree.

export type WindowOffer = { kind: string; ratePct: number; start: string | null; end: string; feePct: number | null; buyBy?: string | null };
export type WindowCard = { id: number; name: string; status: string; offers: WindowOffer[] };
export type WindowPlanned = { taskId: number; title: string; planStatus: string; parts: { month: string; amountGbp: number }[]; cardGbp: number };
export type WindowEntry = { taskId: number | null; kind: string; amountGbp: number };

const asDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export function daysUntil(s: string) { const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((asDate(s).getTime() - now.getTime()) / 86400000); }

/** Days before the buy by date when the window is flagged as closing. */
export const CLOSING_DAYS = 21;

export type PurchaseWindow = { cardId: number; card: string; offer: WindowOffer; buyBy: string; days: number };

/** The purchase windows on open cards, soonest first; closed windows have days below 0. */
export function purchaseWindows(cards: WindowCard[]): PurchaseWindow[] {
  return cards
    .filter(c => c.status === "open")
    .flatMap(c => c.offers.filter(o => o.kind === "purchases" && o.buyBy).map(o => ({ cardId: c.id, card: c.name, offer: o, buyBy: o.buyBy!, days: daysUntil(o.buyBy!) })))
    .sort((a, b) => a.buyBy.localeCompare(b.buyBy));
}

/** The last day any open card still gives 0% on new purchases, or null when no window is recorded. */
export function lastBuyBy(cards: WindowCard[]): string | null {
  const w = purchaseWindows(cards);
  return w.length ? w[w.length - 1].buyBy : null;
}

/**
 * Where a planned month falls against the buy by date: "before" is safe, "edge" is the
 * month the window closes in (0% only if charged by the date), "after" is the standard rate.
 */
export function timing(month: string, buyBy: string): "before" | "edge" | "after" {
  const m = buyBy.slice(0, 7);
  return month < m ? "before" : month === m ? "edge" : "after";
}

/**
 * The card spend in the plan still to be charged that falls after the last 0% buying
 * date, and in the month it closes. Lines already paid in the plan, or already recorded
 * on a card, have been charged and are left out.
 */
export function plannedAgainstWindow(planned: WindowPlanned[], entries: WindowEntry[], buyBy: string) {
  const recorded = new Map<number, number>();
  for (const e of entries) if (e.taskId != null && e.kind !== "payment" && e.kind !== "refund") recorded.set(e.taskId, (recorded.get(e.taskId) ?? 0) + e.amountGbp);
  let after = 0, edge = 0, afterLines = 0;
  for (const p of planned) {
    if (p.planStatus === "paid") continue;
    const left = p.cardGbp - (recorded.get(p.taskId) ?? 0);
    if (left <= 0.5) continue;
    const share = left / (p.cardGbp || 1);
    let lineAfter = false;
    for (const x of p.parts) {
      const t = timing(x.month, buyBy);
      if (t === "after") { after += x.amountGbp * share; lineAfter = true; }
      else if (t === "edge") edge += x.amountGbp * share;
    }
    if (lineAfter) afterLines++;
  }
  return { after: Math.round(after), edge: Math.round(edge), afterLines };
}
