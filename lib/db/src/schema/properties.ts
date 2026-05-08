import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type ClinicProperty = typeof propertiesTable.$inferSelect;
