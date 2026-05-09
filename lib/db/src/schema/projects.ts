import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { ScoringWeights } from "./properties";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetLocation: text("target_location"),
  startDate: text("start_date"),
  targetOpeningDate: text("target_opening_date"),
  status: text("status").notNull().default("planning"),
  launchReadinessPercent: integer("launch_readiness_percent").notNull().default(0),
  scoringWeights: jsonb("scoring_weights").$type<ScoringWeights>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
