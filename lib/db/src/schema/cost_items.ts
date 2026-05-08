import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const costItemsTable = pgTable("cost_items", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  label: text("label").notNull(),
  category: text("category"),
  costLow: real("cost_low").notNull().default(0),
  costMid: real("cost_mid").notNull().default(0),
  costHigh: real("cost_high").notNull().default(0),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCostItemSchema = createInsertSchema(costItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCostItem = z.infer<typeof insertCostItemSchema>;
export type CostItem = typeof costItemsTable.$inferSelect;
