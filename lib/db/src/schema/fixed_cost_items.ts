import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Fixed Monthly Cost Items ─────────────────────────────────────────────────
// Dynamic running costs for the clinic — replaces the hardcoded fixed cost fields
// on the financial model. Each cost is tagged as:
//   "unique" — Winchester only (e.g. rent, rates, waste contract)
//   "dual"   — Shared across both clinics during the ramp; counts ONCE in the
//              combined P&L (no double-counting). Transfers to Winchester on
//              Bedhampton closure (e.g. ANS software, insurance, card terminal).

export const fixedCostItemsTable = pgTable("fixed_cost_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  amountGbp: real("amount_gbp").notNull().default(0),
  // "unique" = Winchester only | "dual" = shared, counts once across both clinics
  costType: text("cost_type").notNull().default("unique"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFixedCostItemSchema = createInsertSchema(fixedCostItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFixedCostItem = z.infer<typeof insertFixedCostItemSchema>;
export type FixedCostItem = typeof fixedCostItemsTable.$inferSelect;
