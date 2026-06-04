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
  costVatStatus: text("cost_vat_status"),
  supplyScope: text("supply_scope"),
  procurementStatus: text("procurement_status"),
  // ── Project controls: actuals tracking ─────────────────────────────────────
  actualCost: real("actual_cost"),
  committedCost: real("committed_cost"),
  paidStatus: text("paid_status"),
  paymentDate: text("payment_date"),
  invoiceRef: text("invoice_ref"),
  invoiceDate: text("invoice_date"),
  varianceNote: text("variance_note"),
  invoiceVatStatus: text("invoice_vat_status"), // 'inc' | 'exc' | 'exempt'
  invoiceFileUrl: text("invoice_file_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PropertyTaskOverride = typeof propertyTaskOverridesTable.$inferSelect;
