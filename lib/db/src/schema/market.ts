import { pgTable, serial, integer, text, real, boolean, timestamp, index } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Market module: treatments (our menu), competitor prices, membership
// programmes (theirs and ours), referrals, membership enrolments (billing),
// and a lightweight sales journal for VAT-split export.
// All prices are VAT inclusive (VRN 523 3501 30, registered 1 Aug 2026).
// ─────────────────────────────────────────────────────────────────────────────

export const treatmentsTable = pgTable("treatments", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),                       // canonical key, e.g. aw1, filler1, profhiloFace
  displayName: text("display_name").notNull(),
  category: text("category").notNull().default("skin"), // consultation | anti_wrinkle | filler | regenerative | skin
  isPom: boolean("is_pom").notNull().default(false), // prescription-only medicine: NEVER in public offers
  durationMinutes: integer("duration_minutes").notNull().default(30),
  priceWinchester: real("price_winchester"),         // VAT inclusive; null = not offered at site
  priceBedhampton: real("price_bedhampton"),
  courseSize: integer("course_size"),
  coursePriceWinchester: real("course_price_winchester"),
  coursePriceBedhampton: real("course_price_bedhampton"),
  isNew: boolean("is_new").notNull().default(false),
  productCostEstimateGbp: real("product_cost_estimate_gbp"),
  description: text("description").default(""),      // exosomes are applied topically post-microneedling, never injected
  aftercareUrl: text("aftercare_url").default(""),
  varianceReasonWinchester: text("variance_reason_winchester").default(""), // recorded reason when >15% off catchment median
  varianceReasonBedhampton: text("variance_reason_bedhampton").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("treatments_key_idx").on(t.key)]);

export const competitorPricesTable = pgTable("competitor_prices", {
  id: serial("id").primaryKey(),
  competitorId: integer("competitor_id").notNull(),
  treatmentKey: text("treatment_key").notNull(),
  priceGbp: real("price_gbp"),                       // null when qualifier is poa
  priceQualifier: text("price_qualifier").notNull().default("exact"), // exact | from | poa
  courseSize: integer("course_size"),
  coursePriceGbp: real("course_price_gbp"),
  sourceUrl: text("source_url").default(""),
  capturedDate: text("captured_date").default(""),   // ISO date; >90 days old triggers a refresh prompt
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("competitor_prices_comp_idx").on(t.competitorId), index("competitor_prices_key_idx").on(t.treatmentKey)]);

export const competitorMembershipsTable = pgTable("competitor_memberships", {
  id: serial("id").primaryKey(),
  competitorId: integer("competitor_id").notNull(),
  programmeName: text("programme_name").notNull(),
  model: text("model").notNull().default("discount_only"), // discount_only | treatment_included | credit_wallet | hybrid
  priceMonthlyGbp: real("price_monthly_gbp"),
  founderPriceGbp: real("founder_price_gbp"),
  annualPriceGbp: real("annual_price_gbp"),
  minCommitmentMonths: integer("min_commitment_months"),
  noticePeriodDays: integer("notice_period_days"),
  includedTreatments: text("included_treatments").default("[]"), // JSON array
  discountRetailPct: real("discount_retail_pct"),
  discountTreatmentsPct: real("discount_treatments_pct"),
  rolloverAllowed: boolean("rollover_allowed"),
  pauseAllowed: boolean("pause_allowed"),
  includesPom: boolean("includes_pom").notNull().default(false), // compliance flag: public POM inclusion is a CAP/MHRA breach
  statedSavingGbp: real("stated_saving_gbp"),
  deliveredBy: text("delivered_by").default(""),      // prescriber | associate | therapist
  featuresJson: text("features_json").default("{}"),  // feature-matrix booleans (null-omitted = unknown)
  sourceUrl: text("source_url").default(""),
  capturedDate: text("captured_date").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("competitor_memberships_comp_idx").on(t.competitorId)]);

export const membershipsTable = pgTable("memberships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tierRank: integer("tier_rank").notNull().default(0),
  site: text("site").notNull().default("both"),       // winchester | bedhampton | both
  priceMonthlyGbp: real("price_monthly_gbp"),         // null for the variable private plan
  founderPriceGbp: real("founder_price_gbp"),
  founderPlaces: integer("founder_places"),
  minCommitmentMonths: integer("min_commitment_months").notNull().default(0),
  noticePeriodDays: integer("notice_period_days").notNull().default(30),
  inclusions: text("inclusions").notNull().default("[]"), // JSON: face value is COMPUTED from treatments, never typed
  isPublic: boolean("is_public").notNull().default(true), // false = private, post-consultation only (Frown Free Club)
  liveFromDate: text("live_from_date").default(""),
  deliveredBy: text("delivered_by").default(""),
  includedMinutesPerMonth: integer("included_minutes_per_month").notNull().default(0), // for revenue-per-clinical-hour
  featuresJson: text("features_json").default("{}"),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerContactId: text("referrer_contact_id").notNull(),
  refereeContactId: text("referee_contact_id"),
  referralCode: text("referral_code").notNull(),      // generated from the GHL contact ID
  status: text("status").notNull().default("sent"),   // sent | registered | booked | attended | credited
  creditReferrerGbp: real("credit_referrer_gbp").notNull().default(25), // generic clinic credit, never cash, never a POM offer
  creditRefereeGbp: real("credit_referee_gbp").notNull().default(25),
  ghlTag: text("ghl_tag").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  attendedAt: timestamp("attended_at"),
  creditedAt: timestamp("credited_at"),
});

export const membershipEnrolmentsTable = pgTable("membership_enrolments", {
  id: serial("id").primaryKey(),
  contactId: text("contact_id").notNull(),
  membershipId: integer("membership_id"),             // null for Frown Free Club rows
  planType: text("plan_type").notNull().default("tier"), // tier | ffc (APA Treatment Plan)
  site: text("site").notNull().default("winchester"),
  priceMonthlyGbp: real("price_monthly_gbp").notNull().default(0),
  nextBillingDate: text("next_billing_date").default(""),
  failedPaymentCount: integer("failed_payment_count").notNull().default(0),
  pauseStatus: boolean("pause_status").notNull().default(false),
  minTermMonthsRemaining: integer("min_term_months_remaining").notNull().default(0),
  // Frown Free Club / APA Treatment Plan fields (private, in-clinic enrolment after the prescribing decision)
  enrolmentDate: text("enrolment_date").default(""),
  prescriber: text("prescriber").default(""),
  scheduleJson: text("schedule_json").default("[]"),  // prescribed schedule, three treatments a year
  paymentsMadeGbp: real("payments_made_gbp").notNull().default(0),
  treatmentsTaken: integer("treatments_taken").notNull().default(0),
  balanceGbp: real("balance_gbp").notNull().default(0),
  ghlSubscriptionId: text("ghl_subscription_id").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesTransactionsTable = pgTable("sales_transactions", {
  id: serial("id").primaryKey(),
  site: text("site").notNull().default("winchester"),
  treatmentKey: text("treatment_key").notNull(),
  treatmentDate: text("treatment_date").notNull(),    // tax point is the treatment date (ANS, not Tide settlement)
  grossGbp: real("gross_gbp").notNull(),              // VAT inclusive
  vatGbp: real("vat_gbp").notNull(),                  // gross / 6, stored for the QuickBooks sales journal
  paymentMethod: text("payment_method").notNull().default("card"), // card | klarna | finance | credit
  contactId: text("contact_id").default(""),
  source: text("source").notNull().default("ans"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("sales_transactions_date_idx").on(t.treatmentDate)]);

export type Treatment = typeof treatmentsTable.$inferSelect;
export type CompetitorPrice = typeof competitorPricesTable.$inferSelect;
export type CompetitorMembership = typeof competitorMembershipsTable.$inferSelect;
export type Membership = typeof membershipsTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
