import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const marketingItemsTable = pgTable("marketing_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull().default("brand"), // now holds the plan phase id (p0..p5)
  title: text("title").notNull(),
  status: text("status").notNull().default("not_started"),
  dueWeeksBeforeOpen: integer("due_weeks_before_open"),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  // ── Remodelled plan fields ──────────────────────────────────────────────
  channel: text("channel").notNull().default(""),      // found | social | email | meta | google | rest
  owner: text("owner").notNull().default(""),           // abi | david | both
  weekStart: text("week_start").notNull().default(""),  // ISO date of that week's Sunday (grouping)
  dayDate: text("day_date").notNull().default(""),      // ISO date of the specific day
  detail: text("detail").notNull().default(""),         // child-level explanation (plan copy, distinct from user notes)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MarketingItem = typeof marketingItemsTable.$inferSelect;
