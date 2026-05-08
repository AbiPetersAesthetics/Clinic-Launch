import { pgTable, serial, integer, text, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type ManualCompetitor = {
  name: string;
  type: string;
  notes?: string | null;
};

export type MediaFile = {
  id: string;
  name: string;
  type: "pdf" | "image" | "document" | "floorplan";
  url: string;
  uploadedAt: string;
  sizeBytes?: number | null;
};

export type ScoringWeights = {
  affordability: number;
  size: number;
  parking: number;
  frontage: number;
  location: number;
  competition: number;
  fitoutComplexity: number;
  demographics: number;
};

export const PIPELINE_STATUSES = [
  "found",
  "interesting",
  "brochure_requested",
  "viewing_booked",
  "viewed",
  "under_review",
  "due_diligence",
  "heads_of_terms",
  "negotiating",
  "rejected",
  "selected",
] as const;

export type PipelineStatus = typeof PIPELINE_STATUSES[number];

export const propertiesTable = pgTable("clinic_properties", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  address: text("address"),
  postcode: text("postcode"),
  sqFootage: real("sq_footage"),
  annualRentGbp: real("annual_rent_gbp"),
  monthlyRentGbp: real("monthly_rent_gbp"),
  vatOnRent: boolean("vat_on_rent"),
  businessRatesGbp: real("business_rates_gbp"),
  serviceChargeGbp: real("service_charge_gbp"),
  leaseLength: text("lease_length"),
  useClass: text("use_class"),
  availabilityDate: text("availability_date"),
  parkingSpaces: integer("parking_spaces"),
  frontageMeters: real("frontage_meters"),
  agentName: text("agent_name"),
  agentPhone: text("agent_phone"),
  agentEmail: text("agent_email"),
  status: text("status").notNull().default("viewing"),
  pipelineStatus: text("pipeline_status").notNull().default("found"),
  viewingNotes: text("viewing_notes"),
  negotiationNotes: text("negotiation_notes"),
  landlordConcessions: text("landlord_concessions"),
  isActiveForProject: boolean("is_active_for_project").notNull().default(false),
  isFavourited: boolean("is_favourited").notNull().default(false),
  manualRankOverride: integer("manual_rank_override"),
  notes: text("notes"),
  manualCompetitors: jsonb("manual_competitors").$type<ManualCompetitor[]>().default([]),
  mediaFiles: jsonb("media_files").$type<MediaFile[]>().default([]),
  scoringWeights: jsonb("scoring_weights").$type<ScoringWeights>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type ClinicProperty = typeof propertiesTable.$inferSelect;
