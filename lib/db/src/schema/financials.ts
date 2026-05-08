import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialsTable = pgTable("financial_models", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  // Fixed costs (monthly)
  rentGbp: real("rent_gbp").notNull().default(0),
  ratesGbp: real("rates_gbp").notNull().default(0),
  utilitiesGbp: real("utilities_gbp").notNull().default(0),
  internetGbp: real("internet_gbp").notNull().default(0),
  insuranceGbp: real("insurance_gbp").notNull().default(0),
  accountantGbp: real("accountant_gbp").notNull().default(0),
  softwareGbp: real("software_gbp").notNull().default(0),
  wasteContractGbp: real("waste_contract_gbp").notNull().default(0),
  cleanerGbp: real("cleaner_gbp").notNull().default(0),
  subscriptionsGbp: real("subscriptions_gbp").notNull().default(0),
  financeRepaymentsGbp: real("finance_repayments_gbp").notNull().default(0),
  // Variable costs
  stockPercent: real("stock_percent").notNull().default(8),
  marketingGbp: real("marketing_gbp").notNull().default(0),
  staffingGbp: real("staffing_gbp").notNull().default(0),
  commissionsPercent: real("commissions_percent").notNull().default(0),
  consumablesGbp: real("consumables_gbp").notNull().default(0),
  // Revenue inputs
  averageClientValueGbp: real("average_client_value_gbp").notNull().default(120),
  treatmentRoomsCount: integer("treatment_rooms_count").notNull().default(2),
  practitionerHoursPerDay: real("practitioner_hours_per_day").notNull().default(7),
  workingDaysPerMonth: integer("working_days_per_month").notNull().default(22),
  conservativeOccupancyPercent: real("conservative_occupancy_percent").notNull().default(40),
  realisticOccupancyPercent: real("realistic_occupancy_percent").notNull().default(65),
  aggressiveOccupancyPercent: real("aggressive_occupancy_percent").notNull().default(85),
  repeatBookingRatePercent: real("repeat_booking_rate_percent").notNull().default(60),
  membershipRevenueGbp: real("membership_revenue_gbp").notNull().default(0),
  // Ramp-up / existing clinic
  existingClinicRevenueGbp: real("existing_clinic_revenue_gbp").notNull().default(0),
  ownerDrawingsGbp: real("owner_drawings_gbp").notNull().default(0),
  runwaySavingsGbp: real("runway_savings_gbp").notNull().default(0),
  personalSalaryNeedsGbp: real("personal_salary_needs_gbp").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialSchema = createInsertSchema(financialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancial = z.infer<typeof insertFinancialSchema>;
export type FinancialModel = typeof financialsTable.$inferSelect;
