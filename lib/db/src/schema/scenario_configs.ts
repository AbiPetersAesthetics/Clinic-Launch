import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scenarioConfigsTable = pgTable("scenario_configs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  occupancyPercent: real("occupancy_percent").notNull().default(65),
  revenueMultiplier: real("revenue_multiplier").notNull().default(1),
  notes: text("notes"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScenarioConfigSchema = createInsertSchema(scenarioConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScenarioConfig = z.infer<typeof insertScenarioConfigSchema>;
export type ScenarioConfig = typeof scenarioConfigsTable.$inferSelect;
