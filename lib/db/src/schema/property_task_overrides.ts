import { pgTable, serial, integer, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { TaskQuote } from "./tasks";

export const propertyTaskOverridesTable = pgTable("property_task_overrides", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  taskId: integer("task_id").notNull(),
  status: text("status"),
  notes: text("notes"),
  owner: text("owner"),
  contractor: text("contractor"),
  supplier: text("supplier"),
  costTier: text("cost_tier"),
  costLow: real("cost_low"),
  costMid: real("cost_mid"),
  costHigh: real("cost_high"),
  selectedCost: real("selected_cost"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  durationDays: integer("duration_days"),
  files: text("files"),
  quotes: jsonb("quotes").$type<TaskQuote[]>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PropertyTaskOverride = typeof propertyTaskOverridesTable.$inferSelect;
