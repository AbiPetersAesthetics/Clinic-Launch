import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { creditCardsTable, cardEntriesTable, tasksTable, phasesTable, propertiesTable, propertyTaskOverridesTable } from "@workspace/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { exVatOf } from "../lib/vat-basis";

// Credit cards: the owner's register of the cards and what is on each, plus the plan
// lines whose payment plan puts them on a card. Only the last four digits of a card are
// kept, and any text that looks like a full card number is refused.
const router = Router();

const ACCOUNTS = ["business", "personal"] as const;
const DEBITS = ["none", "minimum", "fixed", "full"] as const;
const STATUSES = ["open", "closed"] as const;
const OFFER_KINDS = ["purchases", "balance transfers", "money transfers"] as const;
const ENTRY_KINDS = ["opening", "purchase", "transfer", "fee", "interest", "payment", "refund"] as const;

const projectOf = (req: Request) => parseInt(req.params.projectId as string);
class Bad extends Error {}

// Thirteen or more digits in a row, spaces or hyphens allowed between them: a card number.
const CARD_NUMBER = /(?:\d[ -]?){12,18}\d/;
function text(v: unknown, label: string, max = 300): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Bad(`${label} must be text`);
  const s = v.trim().slice(0, max);
  if (CARD_NUMBER.test(s)) throw new Bad(`${label} looks like it holds a full card number. Keep only the last four digits, in their own box.`);
  return s || null;
}
function pounds(v: unknown, label: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Bad(`${label} must be a number at or above zero`);
  return Math.round(n * 100) / 100;
}
function percent(v: unknown, label: string): number | null {
  const n = pounds(v, label);
  if (n !== null && n > 100) throw new Bad(`${label} must be a percentage, 100 or less`);
  return n;
}
function day(v: unknown, label: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new Bad(`${label} must be a day of the month, 1 to 31`);
  return n;
}
function date(v: unknown, label: string, required = false): string | null {
  if (v === null || v === undefined || v === "") { if (required) throw new Bad(`${label} is needed`); return null; }
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Bad(`${label} must be a date`);
  return s;
}
function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  if (typeof v !== "string" || !(list as readonly string[]).includes(v)) throw new Bad(`${label} must be one of: ${list.join(", ")}`);
  return v as T;
}
function last4(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\s/g, "");
  if (!/^\d{4}$/.test(s)) throw new Bad("Only the last four digits of the card go here, nothing more");
  return s;
}
type Offer = { kind: (typeof OFFER_KINDS)[number]; ratePct: number; start: string | null; end: string; feePct: number | null };
function offers(v: unknown): string {
  if (!Array.isArray(v)) throw new Bad("Offers must be a list");
  if (v.length > 4) throw new Bad("Four offers at most");
  const list: Offer[] = v.map((o: any, i) => {
    const n = i + 1;
    const start = date(o?.start, `Offer ${n} start`), end = date(o?.end, `Offer ${n} end`, true)!;
    if (start && start > end) throw new Bad(`Offer ${n} ends before it starts`);
    return { kind: oneOf(o?.kind, OFFER_KINDS, `Offer ${n} type`), ratePct: percent(o?.ratePct ?? 0, `Offer ${n} rate`) ?? 0, start, end, feePct: percent(o?.feePct, `Offer ${n} fee`) };
  });
  return JSON.stringify(list);
}

// The card fields a request may set, validated. Name is required on create.
function cardPatch(body: Record<string, unknown>, creating: boolean) {
  const p: Record<string, unknown> = {};
  if (creating || body.name !== undefined) { const n = text(body.name, "The card's name", 80); if (!n) throw new Bad("Give the card a name"); p.name = n; }
  if (body.holder !== undefined) p.holder = text(body.holder, "Whose card", 80);
  if (body.account !== undefined) p.account = oneOf(body.account, ACCOUNTS, "Business or personal");
  if (body.last4 !== undefined) p.last4 = last4(body.last4);
  if (body.creditLimitGbp !== undefined) p.creditLimitGbp = pounds(body.creditLimitGbp, "Credit limit") ?? 0;
  if (body.aprPct !== undefined) p.aprPct = percent(body.aprPct, "The rate after the offers");
  if (body.offers !== undefined) p.offersJson = offers(body.offers);
  if (body.minPaymentPct !== undefined) p.minPaymentPct = percent(body.minPaymentPct, "Minimum payment percentage");
  if (body.minPaymentFloorGbp !== undefined) p.minPaymentFloorGbp = pounds(body.minPaymentFloorGbp, "Minimum payment floor");
  if (body.statementDay !== undefined) p.statementDay = day(body.statementDay, "Statement date");
  if (body.dueDay !== undefined) p.dueDay = day(body.dueDay, "Payment due date");
  if (body.directDebit !== undefined) p.directDebit = oneOf(body.directDebit, DEBITS, "Direct debit");
  if (body.directDebitGbp !== undefined) p.directDebitGbp = pounds(body.directDebitGbp, "Direct debit amount");
  if (body.notes !== undefined) p.notes = text(body.notes, "Notes", 1000);
  if (body.status !== undefined) p.status = oneOf(body.status, STATUSES, "Status");
  return p;
}

async function planTask(projectId: number, v: unknown): Promise<number | null> {
  if (v === null || v === undefined || v === "") return null;
  const id = Number(v);
  if (!Number.isInteger(id)) throw new Bad("That plan line is not recognised");
  const phases = await db.select({ id: phasesTable.id }).from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const [t] = phases.length ? await db.select({ id: tasksTable.id }).from(tasksTable).where(and(eq(tasksTable.id, id), inArray(tasksTable.phaseId, phases.map(p => p.id)))) : [];
  if (!t) throw new Bad("That plan line is not in the plan");
  return t.id;
}

async function entryPatch(projectId: number, body: Record<string, unknown>, creating: boolean) {
  const p: Record<string, unknown> = {};
  if (creating || body.date !== undefined) p.date = date(body.date, "Date", true);
  if (creating || body.kind !== undefined) p.kind = oneOf(body.kind ?? "purchase", ENTRY_KINDS, "Type");
  if (creating || body.description !== undefined) { const d = text(body.description, "What it was", 160); if (!d) throw new Bad("Say what it was"); p.description = d; }
  if (creating || body.amountGbp !== undefined) { const a = pounds(body.amountGbp, "Amount"); if (a === null) throw new Bad("Give the amount"); p.amountGbp = a; }
  if (body.taskId !== undefined) p.taskId = await planTask(projectId, body.taskId);
  if (body.note !== undefined) p.note = text(body.note, "Note", 500);
  if (body.cardId !== undefined) {
    const [c] = await db.select({ id: creditCardsTable.id }).from(creditCardsTable).where(and(eq(creditCardsTable.projectId, projectId), eq(creditCardsTable.id, Number(body.cardId))));
    if (!c) throw new Bad("That card is not on the register");
    p.cardId = c.id;
  }
  return p;
}

// Run a handler, turning a validation failure into a 400 with its message.
const handle = (fn: (req: Request, res: any) => Promise<void>) => async (req: Request, res: any) => {
  try { await fn(req, res); } catch (e) { if (e instanceof Bad) { res.status(400).json({ error: e.message }); return; } throw e; }
};

export type PlannedCardLine = {
  taskId: number; title: string; phase: string; planStatus: "paid" | "part-paid" | "unpaid";
  /** The line's figure as it leaves the bank or the card: VAT included where it is charged. */
  grossGbp: number;
  parts: { month: string; amountGbp: number }[];
  cardGbp: number;
};

// Plan lines whose payment plan puts some or all of them on a card, merged with the
// active property's overrides the way the Plan and the Money pages read them.
async function plannedCardLines(projectId: number): Promise<PlannedCardLine[]> {
  const phases = await db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  if (!phases.length) return [];
  const phaseName = new Map(phases.map(p => [p.id, p.name]));
  const tasks = (await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phases.map(p => p.id)))).filter(t => !t.archived);
  const [prop] = await db.select().from(propertiesTable).where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));
  const ovr = new Map<number, any>();
  if (prop) for (const o of await db.select().from(propertyTaskOverridesTable).where(eq(propertyTaskOverridesTable.propertyId, prop.id))) ovr.set(o.taskId, o);
  const out: PlannedCardLine[] = [];
  for (const t of tasks) {
    let plan: { month: string; share: number; method: string }[] = [];
    try { const p = JSON.parse((t as any).paymentPlanJson || "[]"); if (Array.isArray(p)) plan = p; } catch { plan = []; }
    const onCard = plan.filter(p => p?.method === "card");
    if (!onCard.length) continue;
    const o = ovr.get(t.id) ?? {};
    const pick = (k: string) => (o[k] != null ? o[k] : (t as any)[k]);
    const selected = Number(pick("selectedCost") ?? 0), committed = Number(pick("committedCost") ?? 0), actual = Number(pick("actualCost") ?? 0);
    const paidStatus = String(pick("paidStatus") ?? "");
    const recorded = paidStatus === "paid" && actual > 0 ? actual : committed > 0 ? committed : selected;
    if (!recorded) continue;
    const vat = exVatOf(recorded, pick("invoiceVatStatus"), pick("costVatStatus"));
    const gross = vat.basis === "no VAT" ? recorded : vat.ex * 1.2;
    const parts = onCard.map(p => ({ month: String(p.month), amountGbp: Math.round(gross * (Number(p.share) || 0) * 100) / 100 }));
    out.push({
      taskId: t.id, title: t.title, phase: phaseName.get(t.phaseId) ?? "",
      planStatus: paidStatus === "paid" ? "paid" : paidStatus === "part-paid" ? "part-paid" : "unpaid",
      grossGbp: Math.round(gross * 100) / 100, parts, cardGbp: Math.round(parts.reduce((s, p) => s + p.amountGbp, 0) * 100) / 100,
    });
  }
  return out.sort((a, b) => (a.parts[0]?.month ?? "").localeCompare(b.parts[0]?.month ?? "") || a.title.localeCompare(b.title));
}

// ─── GET /projects/:id/cards ─────────────────────────────────────────────────
router.get("/projects/:projectId/cards", handle(async (req, res) => {
  const projectId = projectOf(req);
  const [cards, entries, planned] = await Promise.all([
    db.select().from(creditCardsTable).where(eq(creditCardsTable.projectId, projectId)).orderBy(asc(creditCardsTable.sortOrder), asc(creditCardsTable.id)),
    db.select().from(cardEntriesTable).where(eq(cardEntriesTable.projectId, projectId)).orderBy(asc(cardEntriesTable.date), asc(cardEntriesTable.id)),
    plannedCardLines(projectId),
  ]);
  res.json({ cards: cards.map(c => ({ ...c, offers: safeOffers(c.offersJson) })), entries, planned });
}));
function safeOffers(json: string): Offer[] { try { const v = JSON.parse(json || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }

// ─── POST /projects/:id/cards ────────────────────────────────────────────────
// A new card. A balance today, with its date, is recorded as the opening entry.
router.post("/projects/:projectId/cards", handle(async (req, res) => {
  const projectId = projectOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const p = cardPatch(body, true);
  const opening = pounds(body.openingBalanceGbp, "Balance today");
  const openingDate = opening ? date(body.openingDate, "The date of that balance", true) : null;
  const existing = await db.select({ sortOrder: creditCardsTable.sortOrder }).from(creditCardsTable).where(eq(creditCardsTable.projectId, projectId));
  const sortOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;
  const [card] = await db.insert(creditCardsTable).values({ ...(p as any), projectId, sortOrder }).returning();
  if (opening && openingDate) await db.insert(cardEntriesTable).values({ projectId, cardId: card.id, date: openingDate, kind: "opening", description: "Balance brought forward", amountGbp: opening });
  res.status(201).json({ ...card, offers: safeOffers(card.offersJson) });
}));

// ─── PATCH /projects/:id/cards/:cardId ───────────────────────────────────────
router.patch("/projects/:projectId/cards/:cardId", handle(async (req, res) => {
  const projectId = projectOf(req);
  const p = cardPatch((req.body ?? {}) as Record<string, unknown>, false);
  if (!Object.keys(p).length) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [card] = await db.update(creditCardsTable).set({ ...p, updatedAt: new Date() })
    .where(and(eq(creditCardsTable.projectId, projectId), eq(creditCardsTable.id, parseInt(req.params.cardId as string)))).returning();
  if (!card) { res.status(404).json({ error: "Card not found" }); return; }
  res.json({ ...card, offers: safeOffers(card.offersJson) });
}));

// ─── DELETE /projects/:id/cards/:cardId ──────────────────────────────────────
// Only a card with nothing recorded on it; otherwise close it and keep its history.
router.delete("/projects/:projectId/cards/:cardId", handle(async (req, res) => {
  const projectId = projectOf(req);
  const cardId = parseInt(req.params.cardId as string);
  const used = await db.select({ id: cardEntriesTable.id }).from(cardEntriesTable).where(and(eq(cardEntriesTable.projectId, projectId), eq(cardEntriesTable.cardId, cardId)));
  if (used.length) { res.status(409).json({ error: `This card has ${used.length} ${used.length === 1 ? "entry" : "entries"} on it. Close it instead, which keeps its history.` }); return; }
  const [gone] = await db.delete(creditCardsTable).where(and(eq(creditCardsTable.projectId, projectId), eq(creditCardsTable.id, cardId))).returning();
  if (!gone) { res.status(404).json({ error: "Card not found" }); return; }
  res.json({ ok: true });
}));

// ─── POST /projects/:id/cards/:cardId/entries ────────────────────────────────
router.post("/projects/:projectId/cards/:cardId/entries", handle(async (req, res) => {
  const projectId = projectOf(req);
  const cardId = parseInt(req.params.cardId as string);
  const [card] = await db.select({ id: creditCardsTable.id }).from(creditCardsTable).where(and(eq(creditCardsTable.projectId, projectId), eq(creditCardsTable.id, cardId)));
  if (!card) { res.status(404).json({ error: "Card not found" }); return; }
  const p = await entryPatch(projectId, (req.body ?? {}) as Record<string, unknown>, true);
  const [entry] = await db.insert(cardEntriesTable).values({ ...(p as any), projectId, cardId }).returning();
  res.status(201).json(entry);
}));

// ─── PATCH /projects/:id/card-entries/:entryId ───────────────────────────────
router.patch("/projects/:projectId/card-entries/:entryId", handle(async (req, res) => {
  const projectId = projectOf(req);
  const p = await entryPatch(projectId, (req.body ?? {}) as Record<string, unknown>, false);
  if (!Object.keys(p).length) { res.status(400).json({ error: "No editable fields supplied" }); return; }
  const [entry] = await db.update(cardEntriesTable).set({ ...p, updatedAt: new Date() })
    .where(and(eq(cardEntriesTable.projectId, projectId), eq(cardEntriesTable.id, parseInt(req.params.entryId as string)))).returning();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(entry);
}));

// ─── DELETE /projects/:id/card-entries/:entryId ──────────────────────────────
router.delete("/projects/:projectId/card-entries/:entryId", handle(async (req, res) => {
  const projectId = projectOf(req);
  const [gone] = await db.delete(cardEntriesTable).where(and(eq(cardEntriesTable.projectId, projectId), eq(cardEntriesTable.id, parseInt(req.params.entryId as string)))).returning();
  if (!gone) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json({ ok: true });
}));

export default router;
