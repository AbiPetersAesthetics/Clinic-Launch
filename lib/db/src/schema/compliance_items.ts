import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const complianceItemsTable = pgTable("compliance_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"),
  policyStatus: text("policy_status"),
  requiredByDate: text("required_by_date"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertComplianceItemSchema = createInsertSchema(complianceItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplianceItem = z.infer<typeof insertComplianceItemSchema>;
export type ComplianceItem = typeof complianceItemsTable.$inferSelect;
