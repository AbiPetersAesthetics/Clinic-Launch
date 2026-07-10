import { pgTable, serial, integer, text, boolean, real, timestamp } from "drizzle-orm/pg-core";

// Workforce & capacity planning — the "People" module.
// Models who works where over time, when each hire must be triggered, and the
// cost, so the system can show capacity vs demand per site and alert on hiring.

export const staffRolesTable = pgTable("staff_roles", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  // clinician | reception | management | support
  roleType: text("role_type").notNull().default("clinician"),
  // planned | recruiting | onboarding | active | departed
  status: text("status").notNull().default("planned"),
  // Planned or actual start (YYYY-MM or YYYY-MM-DD)
  startDate: text("start_date"),
  // Recruitment + notice + onboarding lead time, so recruit-by = start - lead
  leadTimeWeeks: integer("lead_time_weeks").notNull().default(12),
  // {type:"before_open"|"date"|"winchester_occupancy"|"team_size", ...} — the
  // condition that should prompt starting recruitment.
  triggerJson: text("trigger_json").notNull().default("{}"),
  // Site-allocation segments over time (latest fromMonth <= m applies):
  // [{fromMonth:"2026-11", bedhamptonDays:2, winchesterDays:3, chichesterDays:0}]
  allocationsJson: text("allocations_json").notNull().default("[]"),
  // Fully-loaded annual cost (salary + on-costs). 0 for the owner (drawings).
  annualCostGbp: real("annual_cost_gbp").notNull().default(0),
  isOwner: boolean("is_owner").notNull().default(false),
  // Compensation model for the offer builder:
  // employed | day_rate | revenue_share | hybrid
  payModel: text("pay_model").notNull().default("employed"),
  // Model params: {salaryFteGbp, oncostPct, dayRateGbp, revSharePct, baseRetainerMonthlyGbp, revPerDayGbp?}
  payJson: text("pay_json").notNull().default("{}"),
  // Onboarding intake for a new practitioner:
  // {registration, isPrescriber, scope:[...], readyBy, currentTraining, notes}
  intakeJson: text("intake_json").notNull().default("{}"),
  // AI-generated readiness & onboarding plan (plain text)
  readinessPlan: text("readiness_plan"),
  // AI-curated pay/package recommendation (plain text)
  packagePlan: text("package_plan"),
  notes: text("notes").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Single-row per project: the levers the capacity model reads.
export const workforceSettingsTable = pgTable("workforce_settings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // Month Bedhampton relocates to Chichester (YYYY-MM), or null if not planned
  chichesterMoveMonth: text("chichester_move_month"),
  winchesterRooms: integer("winchester_rooms").notNull().default(2),
  // Clinician days/week a running site needs at full utilisation
  bedhamptonDaysNeeded: real("bedhampton_days_needed").notNull().default(5),
  fullSiteDaysPerWeek: real("full_site_days_per_week").notNull().default(5),
  planNarrative: text("plan_narrative"),
  // AI market pay benchmark for the whole team (JSON string)
  payBenchmark: text("pay_benchmark"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type StaffRole = typeof staffRolesTable.$inferSelect;
export type WorkforceSettings = typeof workforceSettingsTable.$inferSelect;
