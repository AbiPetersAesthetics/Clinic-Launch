import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Colours and finishes: the paint and flooring choices for the clinic, on Abi's
 * Rooms & Kit page.
 *
 * A surface is one thing to decide (the shopfront's white, the feature wall's
 * blue, the treatment room floor). Its options are the shortlist, and the surface
 * points at the one chosen. Surfaces with a role are drawn on the page's
 * schematics; the ones Abi adds herself have none and are list-only.
 */
export const finishSurfacesTable = pgTable("finish_surfaces", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  /** inside, outside or floor: how the page groups the surfaces. */
  zone: text("zone").notNull(),
  /** shop_main, shop_trim, feature, walls, walls_clinical, woodwork, floor_clinical, floor_front; null for Abi's own. */
  role: text("role"),
  name: text("name").notNull(),
  /** What the surface is and what constrains it, in a sentence or two. */
  brief: text("brief"),
  chosenOptionId: integer("chosen_option_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const finishOptionsTable = pgTable("finish_options", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  surfaceId: integer("surface_id").notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  code: text("code"),
  /** Matt, eggshell, safety vinyl, herringbone LVT: whatever the product calls it. */
  finish: text("finish"),
  /** #RRGGBB, the swatch drawn on the page. Approximate: a screen is not a sample pot. */
  hex: text("hex"),
  /** A product page. The server fetches its picture and title once. */
  url: text("url"),
  imageUrl: text("image_url"),
  linkTitle: text("link_title"),
  /** idea, or sample when a sample pot or swatch is in hand. */
  status: text("status").notNull().default("idea"),
  note: text("note"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinishSurfaceSchema = createInsertSchema(finishSurfacesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinishOptionSchema = createInsertSchema(finishOptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinishSurface = z.infer<typeof insertFinishSurfaceSchema>;
export type InsertFinishOption = z.infer<typeof insertFinishOptionSchema>;
export type FinishSurface = typeof finishSurfacesTable.$inferSelect;
export type FinishOption = typeof finishOptionsTable.$inferSelect;
