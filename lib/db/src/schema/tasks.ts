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
  startDate: text("start_date"),
  dueDate: text("due_date"),
  durationDays: integer("duration_days"),
  dependencies: text("dependencies"), // JSON array of task IDs
  notes: text("notes"),
  files: text("files"), // JSON array of {name, url, type}
  quotes: jsonb("quotes").$type<TaskQuote[]>().default([]),
  isNonNegotiable: boolean("is_non_negotiable").notNull().default(false),
  isCriticalRisk: boolean("is_critical_risk").notNull().default(false),
  costVatStatus: text("cost_vat_status").notNull().default("vat_unknown"),
  supplyScope: text("supply_scope").notNull().default("to_confirm"),
  procurementStatus: text("procurement_status").notNull().default("to_specify"),
  priority: text("priority").notNull().default("medium"),
  budgetStatus: text("budget_status").notNull().default("not_set"),
  includeInLaunchBudget: boolean("include_in_launch_budget").notNull().default(false),
  includeInRiskView: boolean("include_in_risk_view").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // ── Project controls: actuals tracking ─────────────────────────────────────
  actualCost: real("actual_cost"),
  committedCost: real("committed_cost"),
  paidStatus: text("paid_status"), // 'unpaid' | 'committed' | 'paid'
  paymentDate: text("payment_date"),
  invoiceRef: text("invoice_ref"),
  invoiceDate: text("invoice_date"),
  varianceNote: text("variance_note"),
  invoiceVatStatus: text("invoice_vat_status"), // 'inc' | 'exc' | 'exempt'
  invoiceFileUrl: text("invoice_file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type LaunchTask = typeof tasksTable.$inferSelect;
