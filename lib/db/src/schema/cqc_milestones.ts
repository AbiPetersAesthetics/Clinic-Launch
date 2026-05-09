import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cqcMilestonesTable = pgTable("cqc_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  step: integer("step").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  leadTimeWeeks: integer("lead_time_weeks").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  dueDate: text("due_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCqcMilestoneSchema = createInsertSchema(cqcMilestonesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCqcMilestone = z.infer<typeof insertCqcMilestoneSchema>;
export type CqcMilestone = typeof cqcMilestonesTable.$inferSelect;
