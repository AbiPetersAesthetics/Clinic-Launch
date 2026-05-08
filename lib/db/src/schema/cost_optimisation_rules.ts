import { pgTable, serial, integer, real, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const costOptimisationRulesTable = pgTable("cost_optimisation_rules", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  keyword: text("keyword").notNull(),
  itemTag: text("item_tag"),
  forceCategory: text("force_category"),
  safeThreshold: real("safe_threshold"),
  dangerThreshold: real("danger_threshold"),
  notes: text("notes"),
  isAbsenceCheck: boolean("is_absence_check").notNull().default(false),
  severityIfAbsent: text("severity_if_absent").notNull().default("critical"),
  rationale: text("rationale").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCostOptimisationRuleSchema = createInsertSchema(costOptimisationRulesTable).omit({ id: true, createdAt: true });
export type InsertCostOptimisationRule = z.infer<typeof insertCostOptimisationRuleSchema>;
export type CostOptimisationRule = typeof costOptimisationRulesTable.$inferSelect;
