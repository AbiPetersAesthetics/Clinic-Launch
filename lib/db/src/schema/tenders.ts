import { pgTable, serial, integer, text, real, timestamp, boolean, date } from "drizzle-orm/pg-core";

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

// Awarding a tender: the owner picks the winning response and pushes the AGREED
// contract sum (a negotiated figure, not the raw bid) into the project plan as a
// committed build line, archiving the estimate lines it covers. This row captures
// everything needed to show the awarded state and to fully reverse it (un-award).
export const tenderAwardsTable = pgTable("tender_awards", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  tenderPackId: integer("tender_pack_id").notNull(),
  tenderResponseId: integer("tender_response_id").notNull(),
  contractorName: text("contractor_name"),
  contractSumGbp: real("contract_sum_gbp"),
  vatTreatment: text("vat_treatment"), // 'inc' | 'exc' | 'exempt'
  programmeWeeks: integer("programme_weeks"),
  // The new committed build line created for the contract.
  awardedTaskId: integer("awarded_task_id"),
  // JSON array of the task ids that were archived, for reversal.
  archivedTaskIdsJson: text("archived_task_ids_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TenderPack = typeof tenderPacksTable.$inferSelect;
export type TenderResponse = typeof tenderResponsesTable.$inferSelect;
export type TenderAward = typeof tenderAwardsTable.$inferSelect;
