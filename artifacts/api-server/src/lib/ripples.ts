// The ripple map (owner, 15 Nov 2026: "you must be ahead of me on this"). For each kind of fact,
// everything that depends on it. Inside ALFRED, dependants follow on their own because every money,
// ads and clinic figure is computed at request time from one set of records (the cash model plus the
// summaries), so nothing holds its own copy. Outside ALFRED, ALFRED raises one grouped card listing
// each thing that now needs changing, with the exact change, so the owner never has to think of them.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ensureAgentTables, rowsOf } from "./agent-tables";

export type FactKind =
  | "money" | "ad-spend" | "opening" | "bedhampton-day" | "abi-days" | "price" | "skin-analysis"
  | "second-clinician" | "video" | "lead-status";

export interface Ripple { inside: string[]; outside: { what: string; change: string }[] }

// What follows each kind of fact. Inside items update themselves on the next load; outside items
// become the grouped card. Extend this as new dependants are found; the monthly audit checks it.
export const RIPPLES: Record<FactKind, Ripple> = {
  money: {
    inside: ["Today's Money line", "Money command screen", "Build Cash Board", "Cash Line", "Money Plan", "Takings", "Obligations", "Stands Alone month", "Abi's first pay month", "the lowest balance ahead", "the brief email", "the exported model (key model)", "open cards that quote money"],
    outside: [],
  },
  "ad-spend": {
    inside: ["the money model's marketing line", "Growth command screen", "the simulator's budget", "the capacity rule's cap", "the monthly plan"],
    outside: [{ what: "Studio filming dates for affected campaigns", change: "move the film-by dates to at least seven days before each campaign's new start" }],
  },
  opening: {
    inside: ["the opening date constant", "the countdowns", "the ad calendar's opening switch", "the money model's first takings month"],
    outside: [
      { what: "The 4 Dec and 8 Dec scheduled tasks", change: "re-date their steps to the new opening" },
      { what: "Website hours and opening copy", change: "change every opening date and the published hours" },
      { what: "Both Google profiles", change: "set the opening date and hours" },
      { what: "ANS diary hours", change: "open the diary from the new date" },
    ],
  },
  "bedhampton-day": {
    inside: ["model capacity and Bedhampton takings", "the Clinic diary view", "the capacity rule"],
    outside: [
      { what: "Website opening hours for Bedhampton", change: "show one day a week from December: Saturday 5 Dec, closed the week of 7 Dec, then the agreed day" },
      { what: "Bedhampton's Google profile hours", change: "replace the four days shown (Tue evening, Thu, Fri, Sat) with the one Bedhampton day; two of them clash with Winchester from 8 Dec" },
      { what: "ANS availability at Bedhampton", change: "close the other days from 8 Dec, keeping the agreed day" },
      { what: "A notice to Bedhampton patients", change: "tell booked and regular patients which day Bedhampton opens from December" },
    ],
  },
  "abi-days": {
    inside: ["model capacity", "the capacity rule", "Team and capacity"],
    outside: [{ what: "ANS availability", change: "no Monday availability for Abi at either clinic" }],
  },
  price: {
    inside: ["the treatments table", "the model's price factor", "Black Friday and New Year offer cards", "video scripts that quote it"],
    outside: [
      { what: "The website price list", change: "set the confirmed price" },
      { what: "ANS prices", change: "set the confirmed price in Settings > Treatments" },
      { what: "Live ad copy", change: "update any ad that quotes the price" },
    ],
  },
  "skin-analysis": {
    inside: ["the offer wording ALFRED uses"],
    outside: [
      { what: "Skin analysis wording on the website", change: "free until the end of February 2027, then £50 off a treatment from 1 March, in the five places the audit lists (skin-analysis.md, book-consultation, the Winchester skin analysis landing page, faqs.json, bedhampton.njk) and site.json's offer note" },
      { what: "The 4 Dec and 8 Dec scheduled tasks", change: "replace \"£50, redeemable, from 8 Dec\" with the new terms" },
      { what: "Live ad copy", change: "remove \"normally £50\" at the 6 Dec swap" },
    ],
  },
  "second-clinician": {
    inside: ["the budget cap", "the introduction campaign", "Team and capacity", "the model's pay and takings"],
    outside: [{ what: "Recruitment", change: "start the hiring steps for the agreed date" }],
  },
  video: {
    inside: ["Studio status", "the campaign's creative list"],
    outside: [{ what: "The warm video audience in Ads Manager", change: "add the new video to the warm audience" }],
  },
  "lead-status": {
    inside: ["Growth and Patients figures", "return on ad spend", "the capacity read", "review requests"],
    outside: [],
  },
};

// Which kinds of fact an applied card changed.
export function kindsFor(spec: { type?: string; path?: string } | null | undefined, title = ""): FactKind[] {
  const t = title.toLowerCase();
  const out = new Set<FactKind>();
  if (spec?.type && ["bank", "funding-dates", "card-entries", "plan-payments"].includes(spec.type)) out.add("money");
  if (spec?.type === "opening-date") out.add("opening");
  if (spec?.type === "model-input") { out.add("money"); if (spec.path?.includes("bedh")) out.add("bedhampton-day"); if (spec.path?.includes("marketing")) out.add("ad-spend"); }
  if (/vat/.test(t)) out.add("money");
  if (/bedhampton.*day|regular day/.test(t)) out.add("bedhampton-day");
  if (/skin analysis/.test(t)) out.add("skin-analysis");
  if (/price/.test(t)) out.add("price");
  if (/second clinician/.test(t)) out.add("second-clinician");
  return [...out];
}

// After a change: log what followed by itself, and raise one grouped card for the outside items not
// already waiting. Returns the card id, if one was raised.
export async function runRipples(projectId: number, kinds: FactKind[], cause: string): Promise<number | null> {
  if (!kinds.length) return null;
  await ensureAgentTables();
  const inside = [...new Set(kinds.flatMap((k) => RIPPLES[k].inside))];
  const outside = kinds.flatMap((k) => RIPPLES[k].outside);
  await db.execute(sql`INSERT INTO activity (project_id, agent, status, summary, started_at, finished_at) VALUES (${projectId}, 'ALFRED', 'ok', ${`After "${cause}", these follow on their own: ${inside.join(", ")}.`}, NOW(), NOW())`);
  if (!outside.length) return null;
  const open = rowsOf<{ evidence: any }>(await db.execute(sql`SELECT evidence FROM proposals WHERE project_id = ${projectId} AND agent = 'Ripples' AND status IN ('proposed', 'approved')`));
  const already = new Set(open.flatMap((o) => ((o.evidence?.items ?? []) as { what: string }[]).map((i) => i.what)));
  const fresh = outside.filter((o) => !already.has(o.what));
  if (!fresh.length) return null;
  const why = fresh.map((o) => `${o.what}: ${o.change}.`).join(" ");
  const r = rowsOf<{ id: number }>(await db.execute(sql`INSERT INTO proposals (project_id, area, kind, agent, title, why, on_approval, evidence, card_type, action_class)
    VALUES (${projectId}, 'clinic', 'outside', 'Ripples', ${`${fresh.length} ${fresh.length === 1 ? "thing" : "things"} outside ALFRED now need changing`}, ${why},
    ${"Approve and each is done at 08:15, checked first and read back. Website and Google profile changes are listed for you to check before they go live."},
    ${JSON.stringify({ cause, items: fresh })}::jsonb, 'approve', 'outside') RETURNING id`));
  return r[0]?.id ?? null;
}
