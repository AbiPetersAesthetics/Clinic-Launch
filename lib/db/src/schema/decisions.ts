import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decisionsTable = pgTable("decisions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  reasoning: text("reasoning").notNull(),
  expectedImpact: text("expected_impact"),
  financialImpactGbp: real("financial_impact_gbp").notNull().default(0),
  category: text("category").notNull().default("general"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type Decision = typeof decisionsTable.$inferSelect;
