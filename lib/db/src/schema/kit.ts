import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Rooms and kit: the furniture, equipment and finishes budget by area, and the
 * items Abi plans to buy against it. Amounts are ex VAT. The building work
 * itself (CBS's contract) is not here; each area's `covers` text says what the
 * builder already provides.
 */
export const kitAreasTable = pgTable("kit_areas", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  /** Stable key used by items: treatment, reception, consult, front, finish. */
  areaKey: text("area_key").notNull(),
  name: text("name").notNull(),
  budgetGbp: real("budget_gbp").notNull().default(0),
  covers: text("covers"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kitItemsTable = pgTable("kit_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  areaKey: text("area_key").notNull(),
  name: text("name").notNull(),
  amountGbp: real("amount_gbp").notNull().default(0),
  /** planned (an idea with a price), ordered (committed, not yet paid), paid. */
  status: text("status").notNull().default("planned"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKitAreaSchema = createInsertSchema(kitAreasTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKitItemSchema = createInsertSchema(kitItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKitArea = z.infer<typeof insertKitAreaSchema>;
export type InsertKitItem = z.infer<typeof insertKitItemSchema>;
export type KitArea = typeof kitAreasTable.$inferSelect;
export type KitItem = typeof kitItemsTable.$inferSelect;
