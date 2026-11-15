// How fresh a figure is, decided in one place so no page invents its own rule (UX plan 2.5).
// Sources refreshed by a scheduled run go stale when a run that should have happened has not:
// the pathway check runs at 08:00, 12:00 and 16:00, so its figures are stale once a run is two
// hours overdue, not after a fixed number of hours (a fixed 9 hours would mark every morning
// before 08:00 as stale). Typed sources go stale after a fixed number of days.

export type SourceKey = "meta" | "ghl" | "ans" | "clarity" | "ansTakings" | "bank" | "cards" | "gsc" | "semrush" | "videos";
export type FreshState = "fresh" | "ageing" | "stale" | "failed" | "unknown";

export interface Chip {
  source: SourceKey;
  label: string;
  asOf: string | null;
  state: FreshState;
  text: string;
  by: string;
}

interface Rule {
  label: string;
  by: string;
  /** London wall-clock times (hours, fractional for minutes) a run is due. */
  slots?: number[];
  /** Hours after a slot before a missing run counts as stale. */
  graceH?: number;
  /** Stale beyond this age whatever the schedule. */
  maxH?: number;
  typed?: boolean;
  never?: boolean;
}

export const RULES: Record<SourceKey, Rule> = {
  meta: { label: "Meta", by: "Pathway check, 08:00, 12:00 and 16:00", slots: [8, 12, 16], graceH: 2, maxH: 26 },
  ghl: { label: "GHL", by: "Pathway check, 08:00, 12:00 and 16:00", slots: [8, 12, 16], graceH: 2, maxH: 26 },
  ans: { label: "ANS", by: "Pathway check, 08:00, 12:00 and 16:00", slots: [8, 12, 16], graceH: 2, maxH: 26 },
  clarity: { label: "Clarity", by: "Pathway check, 08:00, 12:00 and 16:00", slots: [8, 12, 16], graceH: 2, maxH: 26 },
  ansTakings: { label: "ANS takings", by: "Clinic refresh, daily at about 07:40", slots: [7 + 40 / 60], graceH: 2, maxH: 26 },
  bank: { label: "Bank", by: "Typed by David", typed: true, maxH: 7 * 24 },
  cards: { label: "Cards", by: "Typed or imported into Credit Cards", typed: true, maxH: 31 * 24 },
  gsc: { label: "Search Console", by: "GitHub Action, daily 03:17 UTC", maxH: 72 },
  semrush: { label: "Semrush", by: "Read once on 19 September 2026; never refreshes", never: true },
  videos: { label: "Filming queue", by: "Pushed from ads/meta/videos.json", maxH: 14 * 24 },
};

// Minutes London is ahead of UTC at a given instant (0 in winter, 60 in summer).
function londonOffsetMin(d: Date): number {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = s.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 0;
}

function londonYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Every scheduled slot in the last two days up to now, newest first, as instants.
export function slotsBefore(now: Date, slots: number[], days = 3, weekdays?: number[]): Date[] {
  const out: Date[] = [];
  for (let back = 0; back < days; back++) {
    const day = londonYmd(new Date(now.getTime() - back * 86400000));
    if (weekdays && !weekdays.includes(new Date(day + "T12:00:00Z").getUTCDay())) continue;
    for (const h of slots) {
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      const guess = new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
      const at = new Date(guess.getTime() - londonOffsetMin(guess) * 60000);
      if (at <= now) out.push(at);
    }
  }
  return out.sort((a, b) => b.getTime() - a.getTime());
}

export const dayMonth = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function freshness(source: SourceKey, asOfIso: string | null | undefined, opts: { now?: Date; failed?: boolean } = {}): Chip {
  const rule = RULES[source];
  const now = opts.now ?? new Date();
  const base = { source, label: rule.label, by: rule.by };
  if (!asOfIso || Number.isNaN(Date.parse(asOfIso.length === 10 ? asOfIso + "T12:00:00Z" : asOfIso))) {
    return { ...base, asOf: null, state: "unknown", text: `${rule.label}: no data yet` };
  }
  const t = Date.parse(asOfIso.length === 10 ? asOfIso + "T12:00:00Z" : asOfIso);
  const ageH = (now.getTime() - t) / 3600000;
  if (rule.never) return { ...base, asOf: asOfIso, state: "fresh", text: `${rule.label}, ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })}` };

  let state: FreshState = "fresh";
  if (rule.slots) {
    const passed = slotsBefore(now, rule.slots);
    const overdue = passed.find((s) => s.getTime() + (rule.graceH ?? 2) * 3600000 <= now.getTime());
    const due = passed[0];
    // A run may stamp its figures up to an hour before the slot it belongs to.
    if (overdue && t < overdue.getTime() - 3600000) state = "stale";
    else if (due && t < due.getTime() - 3600000) state = "ageing";
  } else if (rule.maxH) {
    if (ageH > rule.maxH) state = "stale";
    else if (ageH > rule.maxH * 0.75) state = "ageing";
  }
  if (rule.maxH && ageH > rule.maxH) state = "stale";
  if (opts.failed) state = "failed";

  let when: string;
  if (rule.typed) when = `typed ${dayMonth(asOfIso)}`;
  else if (ageH < 1) when = "under an hour ago";
  else if (ageH < 20) when = `${Math.round(ageH)} h ago`;
  else when = `${dayMonth(asOfIso)} ${asOfIso.length === 10 ? "" : hm(asOfIso)}`.trim();
  const tail = state === "stale" ? ", stale" : state === "failed" ? ", last run failed" : "";
  return { ...base, asOf: asOfIso, state, text: `${rule.label}, ${when}${tail}` };
}

export const ageHours = (iso: string | null | undefined, now = new Date()) => (iso ? (now.getTime() - Date.parse(iso.length === 10 ? iso + "T12:00:00Z" : iso)) / 3600000 : null);
