import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const competitorsTable = pgTable("competitors", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  propertyId: integer("property_id"),

  // Identity
  name: text("name").notNull().default(""),
  address: text("address").default(""),
  lat: text("lat").default(""),
  lng: text("lng").default(""),
  distanceMiles: text("distance_miles").default(""),
  website: text("website").default(""),
  bookingLink: text("booking_link").default(""),
  phone: text("phone").default(""),
  instagram: text("instagram").default(""),
  facebook: text("facebook").default(""),

  // Ratings
  googleRating: text("google_rating").default(""),
  googleReviewCount: integer("google_review_count").default(0),

  // Classification
  premisesType: text("premises_type").default("unknown"),
  clinicType: text("clinic_type").default("unknown"),
  practitionerType: text("practitioner_type").default(""),
  positioningCategory: text("positioning_category").default(""),
  targetAudience: text("target_audience").default(""),

  // Credentials
  saveFace: boolean("save_face").default(false),
  jccp: boolean("jccp").default(false),
  independentPrescriber: boolean("independent_prescriber").default(false),
  nhsBackground: boolean("nhs_background").default(false),
  yearsExperience: integer("years_experience").default(0),
  credentialsNotes: text("credentials_notes").default(""),

  // Computed-helper scores (0–100, user-set)
  clinicalAuthorityScore: integer("clinical_authority_score").default(50),
  trustScore: integer("trust_score").default(50),
  brandStrengthScore: integer("brand_strength_score").default(50),
  premisesStrengthScore: integer("premises_strength_score").default(50),

  // Social
  instagramFollowers: integer("instagram_followers").default(0),
  postingFrequency: text("posting_frequency").default("unknown"),
  contentQualityScore: integer("content_quality_score").default(3),
  beforeAfterUse: boolean("before_after_use").default(false),

  // Pricing & treatments (JSON)
  pricingJson: text("pricing_json").default("{}"),
  treatmentsJson: text("treatments_json").default("[]"),
  heroTreatments: text("hero_treatments").default(""),

  // Analysis
  strengthsJson: text("strengths_json").default("[]"),
  weaknessesJson: text("weaknesses_json").default("[]"),
  reviewSentimentSummary: text("review_sentiment_summary").default(""),
  commonPraiseJson: text("common_praise_json").default("[]"),
  commonComplaintsJson: text("common_complaints_json").default("[]"),

  // SEO / Google visibility
  googleKeywordsJson: text("google_keywords_json").default("[]"),

  // Data quality
  manuallyVerified: boolean("manually_verified").default(false),
  confidenceLevel: text("confidence_level").default("Unclear"),
  sourceLinks: text("source_links").default(""),
  lastChecked: text("last_checked").default(""),
  onWatchlist: boolean("on_watchlist").default(false),
  watchlistChangesJson: text("watchlist_changes_json").default("[]"),
  notes: text("notes").default(""),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("competitors_project_id_idx").on(t.projectId),
]);
