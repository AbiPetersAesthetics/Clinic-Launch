import { pgTable, serial, integer, text, timestamp, boolean, date } from "drizzle-orm/pg-core";

// Principal-contractor tender packs (Invitation to Tender) and the
// responses received back from bidding contractors.

export const tenderPacksTable = pgTable("tender_packs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  reference: text("reference"),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | issued | evaluated
  deadline: text("deadline"),
  // [{key,label,included,questions:[{q,answer}]}]
  sectionsJson: text("sections_json").notNull().default("[]"),
  // {invitationLetter, instructionsToTenderers, formOfTender, preliminaries,
  //  scopeOfWorks, pricingSchedule, preConstructionInfo, programmeRequirements,
  //  insurancesAndWarranties, drawingsRegister}
  documentsJson: text("documents_json"),
  evaluationJson: text("evaluation_json"),
  // Reference documents uploaded to ground the pack:
  // [{name,label,url,mimetype,sizeBytes}]
  filesJson: text("files_json").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenderResponsesTable = pgTable("tender_responses", {
  id: serial("id").primaryKey(),
  tenderPackId: integer("tender_pack_id").notNull(),
  projectId: integer("project_id").notNull(),
  contractorName: text("contractor_name").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  notes: text("notes").default(""),
  // Tender progress tracking
  // Withdrawn: bidder pulled out — kept on the list for the audit trail, but
  // excluded from evaluation/comparison.
  withdrawn: boolean("withdrawn").notNull().default(false),
  withdrawnReason: text("withdrawn_reason").default(""),
  siteVisitBooked: boolean("site_visit_booked").notNull().default(false),
  siteVisitDate: date("site_visit_date"),   // planned or actual site visit
  siteVisited: boolean("site_visited").notNull().default(false),
  // Running log of qualitative signals logged over time — even before a
  // priced bid arrives: [{id,category,note,loggedAt}]
  notesLogJson: text("notes_log_json").notNull().default("[]"),
  extractedJson: text("extracted_json"),
  scoreJson: text("score_json"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TenderPack = typeof tenderPacksTable.$inferSelect;
export type TenderResponse = typeof tenderResponsesTable.$inferSelect;
