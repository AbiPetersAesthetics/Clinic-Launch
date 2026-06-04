import { pgTable, serial, integer, real, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialsTable = pgTable("financial_models", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  // Fixed costs (monthly) — Winchester
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
  // Variable costs — Winchester
  stockPercent: real("stock_percent").notNull().default(8),
  marketingGbp: real("marketing_gbp").notNull().default(0),
  staffingGbp: real("staffing_gbp").notNull().default(0),
  commissionsPercent: real("commissions_percent").notNull().default(0),
  consumablesGbp: real("consumables_gbp").notNull().default(0),
  // Revenue inputs — Winchester
  averageClientValueGbp: real("average_client_value_gbp").notNull().default(120),
  wincAcvGbp: real("winc_acv_gbp").notNull().default(155),
  treatmentRoomsCount: integer("treatment_rooms_count").notNull().default(2),
  practitionerHoursPerDay: real("practitioner_hours_per_day").notNull().default(7),
  workingDaysPerMonth: integer("working_days_per_month").notNull().default(17),
  conservativeOccupancyPercent: real("conservative_occupancy_percent").notNull().default(40),
  realisticOccupancyPercent: real("realistic_occupancy_percent").notNull().default(65),
  aggressiveOccupancyPercent: real("aggressive_occupancy_percent").notNull().default(85),
  repeatBookingRatePercent: real("repeat_booking_rate_percent").notNull().default(60),
  membershipRevenueGbp: real("membership_revenue_gbp").notNull().default(0),
  bedhMembershipRevenueGbp: real("bedh_membership_revenue_gbp").notNull().default(0),
  // Winchester self-funding target — kept for backward compat but no longer user-editable;
  // the active trigger is selfFundingBufferPercent (revenue % margin target)
  wincSelfFundingTargetGbp: real("winc_self_funding_target_gbp").notNull().default(12000),
  // Self-funding buffer: Bedhampton closes when Winchester net profit ≥ this % of gross revenue
  selfFundingBufferPercent: real("self_funding_buffer_percent").notNull().default(20),
  // Bedhampton — temporary support clinic (separate patient base, will close)
  existingClinicRevenueGbp: real("existing_clinic_revenue_gbp").notNull().default(0),
  bedhStockPercent: real("bedh_stock_percent").notNull().default(35),
  // Bedhampton individual cost lines (mirrors Winchester fixed cost structure)
  bedhRentGbp: real("bedh_rent_gbp").notNull().default(0),
  bedhSoftwareGbp: real("bedh_software_gbp").notNull().default(0),
  bedhStaffingGbp: real("bedh_staffing_gbp").notNull().default(0),
  bedhInsuranceGbp: real("bedh_insurance_gbp").notNull().default(0),
  bedhMarketingGbp: real("bedh_marketing_gbp").notNull().default(0),
  bedhamptonCostsGbp: real("bedhampton_costs_gbp").notNull().default(0), // "Other" catch-all
  // cannibal_percent kept in DB for backward compat but no longer used (set to 0)
  cannibalPercent: real("cannibal_percent").notNull().default(0),
  // Owner / personal planning
  ownerDrawingsGbp: real("owner_drawings_gbp").notNull().default(0),
  runwaySavingsGbp: real("runway_savings_gbp").notNull().default(0),
  personalSalaryNeedsGbp: real("personal_salary_needs_gbp").notNull().default(0),
  nursingIncomeGbp: real("nursing_income_gbp").notNull().default(4500),
  targetDrawingsGbp: real("target_drawings_gbp").notNull().default(4000),
  // Domestic / personal life costs (monthly)
  schoolFeesGbp: real("school_fees_gbp").notNull().default(0),
  travelGbp: real("travel_gbp").notNull().default(0),
  otherHouseholdGbp: real("other_household_gbp").notNull().default(0),
  // VAT planning — current rolling 12-month business turnover (all clinics combined)
  // Used to calculate exactly when the £90k threshold will be crossed
  vatCurrentTurnoverGbp: real("vat_current_turnover_gbp").notNull().default(75000),
  // Optional hard override: if set, VAT kicks in from this calendar month regardless of threshold
  // Format: YYYY-MM (e.g. "2026-11"). When blank, automatic threshold crossing is used instead.
  vatRegistrationDate: text("vat_registration_date"),
  // What fraction of total monthly operating costs are VAT-bearing (can reclaim input VAT).
  // Default 60%: stock, software, marketing, consumables YES; rates, insurance, wages, loan NO.
  vatInputCostRatioPercent: integer("vat_input_cost_ratio_percent").notNull().default(60),
  // VAT on rent — synced from active property; whether landlord charges VAT on rent
  vatOnRent: boolean("vat_on_rent").notNull().default(false),
  // Pre-opening property costs: months before opening where rent + rates apply (lease signed early)
  preOpeningPropertyMonths: integer("pre_opening_property_months").notNull().default(2),
  // Rent-free months: landlord-agreed free rent from lease start (only rates apply during this period)
  freeRentMonths: integer("free_rent_months").notNull().default(0),
  // Bedhampton capacity ceiling: joint revenue (Bedh + Winc) at which Bedhampton slots are exhausted
  bedhCapacityCeilGbp: real("bedh_capacity_ceil_gbp").notNull().default(16000),
  // Planned per-treatment pricing (JSON map of treatment key → planned price £)
  // Used to derive wincAcvGbp from the Competition → Pricing tab
  plannedPricingJson: text("planned_pricing_json").notNull().default("{}"),
  // Scenario selection — persisted so the banner always reflects the user's chosen model
  selectedScenario: text("selected_scenario").notNull().default("realistic"),
  // Additional clinicians with independent start dates and revenue ramps (JSON array)
  additionalCliniciansJson: text("additional_clinicians_json").default("[]"),
  // Project controls: David's approved spend cap (default £60k)
  davidApprovedCapGbp: real("david_approved_cap_gbp").notNull().default(60000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialSchema = createInsertSchema(financialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancial = z.infer<typeof insertFinancialSchema>;
export type FinancialModel = typeof financialsTable.$inferSelect;
