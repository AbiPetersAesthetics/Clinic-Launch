import { pgTable, serial, integer, text, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type TaskQuote = {
  id: string;
  company: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  amount?: number | null;
  notes?: string | null;
  date?: string | null;
  status: "pending" | "accepted" | "rejected";
};

export const tasksTable = pgTable("launch_tasks", {
  id: serial("id").primaryKey(),
  phaseId: integer("phase_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  owner: text("owner"),
  contractor: text("contractor"),
  supplier: text("supplier"),
  status: text("status").notNull().default("not_started"),
  riskLevel: text("risk_level").notNull().default("low"),
  costTier: text("cost_tier").notNull().default("mid"),
  costLow: real("cost_low").notNull().default(0),
  costMid: real("cost_mid").notNull().default(0),
  costHigh: real("cost_high").notNull().default(0),
  selectedCost: real("selected_cost").notNull().default(0),
  dueDate: text("due_date"),
  durationDays: integer("duration_days"),
  dependencies: text("dependencies"), // JSON array of task IDs
  notes: text("notes"),
  files: text("files"), // JSON array of {name, url, type}
  quotes: jsonb("quotes").$type<TaskQuote[]>().default([]),
  isNonNegotiable: boolean("is_non_negotiable").notNull().default(false),
  isCriticalRisk: boolean("is_critical_risk").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type LaunchTask = typeof tasksTable.$inferSelect;
