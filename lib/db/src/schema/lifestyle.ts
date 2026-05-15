import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const lifestylePlanTable = pgTable("lifestyle_plan", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),

  // Clinic schedule
  clinicDays: text("clinic_days").default('["Mon","Tue","Wed","Thu"]'),
  clinicOpenTime: text("clinic_open_time").default("09:00"),
  clinicCloseTime: text("clinic_close_time").default("18:00"),
  scheduleNotes: text("schedule_notes").default(""),

  // School run — Eli & Elsy
  schoolStartTime: text("school_start_time").default("09:00"),
  schoolFinishTime: text("school_finish_time").default("15:30"),
  dropCoveredBy: text("drop_covered_by").default(""),
  pickupCoveredBy: text("pickup_covered_by").default(""),
  schoolContingencyPlan: text("school_contingency_plan").default(""),

  // David's role
  davidAvailabilityDays: integer("david_availability_days").default(5),
  davidRoleNotes: text("david_role_notes").default(""),

  // Nursing exit
  nursingStatus: text("nursing_status").default("still_working"),
  nursingNoticeWeeks: integer("nursing_notice_weeks").default(12),
  targetExitDate: text("target_exit_date").default(""),
  nursingExitNotes: text("nursing_exit_notes").default(""),

  // Wellbeing
  maxClinicDaysPerWeek: integer("max_clinic_days_per_week").default(4),
  sickCoverPlan: text("sick_cover_plan").default(""),
  holidayPlan: text("holiday_plan").default(""),
  nonNegotiables: text("non_negotiables").default(""),

  // Identity & bigger picture
  mostExcitedAbout: text("most_excited_about").default(""),
  biggestConcerns: text("biggest_concerns").default(""),
  supportNetwork: text("support_network").default(""),

  // Checklists — JSON arrays of ticked item keys
  scheduleChecks: text("schedule_checks").default("[]"),
  familyChecks: text("family_checks").default("[]"),
  nursingChecks: text("nursing_checks").default("[]"),
  wellbeingChecks: text("wellbeing_checks").default("[]"),
  identityChecks: text("identity_checks").default("[]"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type LifestylePlan = typeof lifestylePlanTable.$inferSelect;
