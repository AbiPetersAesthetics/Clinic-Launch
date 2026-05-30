import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectAiAnalysesTable = pgTable("project_ai_analyses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  analysisType: text("analysis_type").notNull().default("funding"),
  contextNote: text("context_note").notNull().default(""),
  resultJson: jsonb("result_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectAiAnalysisSchema = createInsertSchema(projectAiAnalysesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectAiAnalysis = z.infer<typeof insertProjectAiAnalysisSchema>;
export type ProjectAiAnalysis = typeof projectAiAnalysesTable.$inferSelect;
