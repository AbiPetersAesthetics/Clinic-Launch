import { pgTable, serial, integer, text, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Backlink acquisition tracker.
 *
 * The workbook columns (rank through notes) are the analysis and stay as
 * seeded. The working columns (status, owner, dates, liveUrl) are what gets
 * updated as each target is actually chased.
 */
export const backlinkOpportunitiesTable = pgTable("backlink_opportunities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),

  // ── From the workbook ──
  rank: integer("rank").notNull(),
  priority: text("priority").notNull().default("P2 Next"),
  category: text("category").notNull(),
  website: text("website").notNull(),
  domain: text("domain").notNull(),
  why: text("why"),
  competitors: text("competitors"),
  groups: jsonb("groups").$type<string[]>().default([]),
  cost: text("cost"),
  applyUrl: text("apply_url"),
  infoNeeded: text("info_needed"),
  /** Either an outreach template id (T1 to T6) or a direct route such as "Direct setup". */
  template: text("template"),

  // ── Working state ──
  status: text("status").notNull().default("Not started"),
  owner: text("owner"),
  targetDate: date("target_date"),
  notes: text("notes"),
  dateContacted: date("date_contacted"),
  followUpDate: date("follow_up_date"),
  liveUrl: text("live_url"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** The reusable business details every directory and listing application asks for. */
export const backlinkListingPackTable = pgTable("backlink_listing_pack", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  section: text("section").notNull(),
  field: text("field").notNull(),
  value: text("value"),
  /** What still has to be decided or supplied before this field can be reused. */
  remaining: text("remaining"),
  status: text("status").notNull().default("Missing"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Outreach templates T1 to T6, editable so the wording can be tuned in place. */
export const backlinkTemplatesTable = pgTable("backlink_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  templateId: text("template_id").notNull(),
  use: text("use").notNull(),
  wording: text("wording").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBacklinkOpportunitySchema = createInsertSchema(backlinkOpportunitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBacklinkOpportunity = z.infer<typeof insertBacklinkOpportunitySchema>;
export type BacklinkOpportunity = typeof backlinkOpportunitiesTable.$inferSelect;

export const insertBacklinkListingPackSchema = createInsertSchema(backlinkListingPackTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBacklinkListingPackItem = z.infer<typeof insertBacklinkListingPackSchema>;
export type BacklinkListingPackItem = typeof backlinkListingPackTable.$inferSelect;

export const insertBacklinkTemplateSchema = createInsertSchema(backlinkTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBacklinkTemplate = z.infer<typeof insertBacklinkTemplateSchema>;
export type BacklinkTemplate = typeof backlinkTemplatesTable.$inferSelect;
