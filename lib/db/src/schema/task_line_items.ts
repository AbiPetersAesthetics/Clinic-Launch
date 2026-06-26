import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const taskLineItemsTable = pgTable("task_line_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  taskId: integer("task_id").notNull(),
  propertyId: integer("property_id"),
  name: text("name").notNull(),
  url: text("url"),
  costGbp: real("cost_gbp").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
