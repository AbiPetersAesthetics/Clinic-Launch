import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Credit cards: the owner's register of the cards the build goes on, and what is on
 * each one. Only the last four digits of a card are ever kept: never the full number,
 * the expiry date or the security code.
 */
export const creditCardsTable = pgTable("credit_cards", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  /** What the owner calls it, e.g. "Barclaycard Business". */
  name: text("name").notNull(),
  /** Whose name the card is in: David, Abi or the company. */
  holder: text("holder"),
  /** business or personal. Build costs on a personal card are owed back by the company. */
  account: text("account").notNull().default("business"),
  /** The last four digits only. */
  last4: text("last4"),
  creditLimitGbp: real("credit_limit_gbp").notNull().default(0),
  /** The rate once the offers end, as the statement gives it. */
  aprPct: real("apr_pct"),
  /** JSON array of { kind: purchases | balance transfers | money transfers, ratePct, start, end, feePct }. */
  offersJson: text("offers_json").notNull().default("[]"),
  /** The minimum payment rule: this percentage of the balance, but at least the floor. */
  minPaymentPct: real("min_payment_pct"),
  minPaymentFloorGbp: real("min_payment_floor_gbp"),
  /** Days of the month, 1 to 31. */
  statementDay: integer("statement_day"),
  dueDay: integer("due_day"),
  /** none, minimum, fixed or full; directDebitGbp is the amount when fixed. */
  directDebit: text("direct_debit").notNull().default("none"),
  directDebitGbp: real("direct_debit_gbp"),
  notes: text("notes"),
  /** open or closed. A closed card keeps its history. */
  status: text("status").notNull().default("open"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cardEntriesTable = pgTable("card_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  cardId: integer("card_id").notNull(),
  /** yyyy-mm-dd */
  date: text("date").notNull(),
  /** opening, purchase, transfer, fee, interest (add to the balance); payment, refund (take off). */
  kind: text("kind").notNull().default("purchase"),
  description: text("description").notNull(),
  /** Always a positive figure; the kind says which way it goes. */
  amountGbp: real("amount_gbp").notNull().default(0),
  /** The plan line it pays for, when there is one. */
  taskId: integer("task_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCreditCardSchema = createInsertSchema(creditCardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCardEntrySchema = createInsertSchema(cardEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditCard = z.infer<typeof insertCreditCardSchema>;
export type InsertCardEntry = z.infer<typeof insertCardEntrySchema>;
export type CreditCard = typeof creditCardsTable.$inferSelect;
export type CardEntry = typeof cardEntriesTable.$inferSelect;
