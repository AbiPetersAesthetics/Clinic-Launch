import { pgTable, serial, integer, text, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface RiskScoreEntry {
  date: string;
  score: number;
  likelihood: number;
  impact: number;
  note?: string;
}

export const risksTable = pgTable("risks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  riskId: text("risk_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Operational"),
  likelihood: integer("likelihood").notNull().default(3),
  impact: integer("impact").notNull().default(3),
  residualLikelihood: integer("residual_likelihood"),
  residualImpact: integer("residual_impact"),
  treatment: text("treatment"),
  treatmentAction: text("treatment_action"),
  owner: text("owner"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("Not Started"),
  pipelineStage: text("pipeline_stage").default("Pre-Lease"),
  linkedModelSection: text("linked_model_section"),
  linkedRiskIds: jsonb("linked_risk_ids").$type<string[]>().default([]),
  isWatchList: boolean("is_watch_list").notNull().default(false),
  scoreHistory: jsonb("score_history").$type<RiskScoreEntry[]>().default([]),
  lastReviewedAt: timestamp("last_reviewed_at"),
  source: text("source").notNull().default("Seed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRiskSchema = createInsertSchema(risksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risksTable.$inferSelect;
