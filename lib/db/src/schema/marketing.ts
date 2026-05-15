import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const marketingItemsTable = pgTable("marketing_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull().default("brand"),
  title: text("title").notNull(),
  status: text("status").notNull().default("not_started"),
  dueWeeksBeforeOpen: integer("due_weeks_before_open"),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MarketingItem = typeof marketingItemsTable.$inferSelect;
