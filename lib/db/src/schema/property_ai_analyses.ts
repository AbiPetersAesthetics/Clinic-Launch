import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertyAiAnalysesTable = pgTable("property_ai_analyses", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  version: integer("version").notNull().default(1),
  analysisJson: jsonb("analysis_json").notNull(),
  confidenceLevel: text("confidence_level").notNull().default("medium"),
  sourceDataSnapshot: jsonb("source_data_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPropertyAiAnalysisSchema = createInsertSchema(propertyAiAnalysesTable).omit({ id: true, createdAt: true });
export type InsertPropertyAiAnalysis = z.infer<typeof insertPropertyAiAnalysisSchema>;
export type PropertyAiAnalysis = typeof propertyAiAnalysesTable.$inferSelect;
