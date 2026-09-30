import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Rooms and kit: Abi's view of the furniture, equipment and finishes.
 *
 * The budget lines ARE plan tasks (kit_lines points at launch_tasks), so the
 * figure Abi plans against is whatever the Plan & Timeline says today: actual
 * cost if paid, else committed, else the selected cost with savings applied.
 * Her items (kit_items) are what she actually plans to buy against each line.
 * Areas only group the lines for display.
 */
export const kitAreasTable = pgTable("kit_areas", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  /** Stable key: treatment, reception, consult, finish, opening. */
  areaKey: text("area_key").notNull(),
  name: text("name").notNull(),
  /** Kept for older installs; budgets now come from the plan lines. */
  budgetGbp: real("budget_gbp").notNull().default(0),
  covers: text("covers"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kitLinesTable = pgTable("kit_lines", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  /** The plan task this line is; its cost is read live from the plan. */
  taskId: integer("task_id").notNull(),
  areaKey: text("area_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kitItemsTable = pgTable("kit_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  areaKey: text("area_key").notNull(),
  /** The plan line the item counts against. Null on rows from before lines existed. */
  taskId: integer("task_id"),
  name: text("name").notNull(),
  /** As paid, so inc VAT where VAT is charged, matching the plan's own figures. */
  amountGbp: real("amount_gbp").notNull().default(0),
  /** planned (an idea with a price), ordered (committed, not yet paid), paid. */
  status: text("status").notNull().default("planned"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKitAreaSchema = createInsertSchema(kitAreasTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKitLineSchema = createInsertSchema(kitLinesTable).omit({ id: true, createdAt: true });
export const insertKitItemSchema = createInsertSchema(kitItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKitArea = z.infer<typeof insertKitAreaSchema>;
export type InsertKitLine = z.infer<typeof insertKitLineSchema>;
export type InsertKitItem = z.infer<typeof insertKitItemSchema>;
export type KitArea = typeof kitAreasTable.$inferSelect;
export type KitLine = typeof kitLinesTable.$inferSelect;
export type KitItem = typeof kitItemsTable.$inferSelect;
