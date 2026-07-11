import { pgTable, serial, integer, text, boolean, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const SUPPLIER_CATEGORIES = [
  "Fit-Out & Construction",
  "Medical Equipment",
  "IT & Software",
  "Legal & Professional",
  "Insurance",
  "Marketing & Branding",
  "Consumables & Products",
  "Furniture & Interiors",
  "Utilities & Services",
  "Other",
] as const;

export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export const SUPPLIER_STATUSES = ["Researching", "Contacted", "Quoted", "Tender", "Contracted", "Rejected"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const QUOTE_STATUSES = ["Requested", "Received", "Shortlisted", "Accepted", "Rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),

  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  contactName: text("contact_name").default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  website: text("website").default(""),
  notes: text("notes").default(""),
  status: text("status").notNull().default("Researching"),
  isFavourited: boolean("is_favourited").notNull().default(false),
  linkedTaskId: integer("linked_task_id"),

  // Tender tracking — the enquiry → visit lifecycle
  responded: boolean("responded").notNull().default(false),
  tenderAccepted: boolean("tender_accepted").notNull().default(false),
  visitBooked: boolean("visit_booked").notNull().default(false),
  visited: boolean("visited").notNull().default(false),
  visitDate: date("visit_date"), // planned or actual site/showroom visit

  // AI credentials review — generated once and kept (never auto-regenerated)
  credentialsReview: text("credentials_review"),
  credentialsScore: integer("credentials_score"), // 0–100 strength
  credentialsReviewedAt: timestamp("credentials_reviewed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supplierQuotesTable = pgTable("supplier_quotes", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  projectId: integer("project_id").notNull(),
  taskId: integer("task_id"),

  description: text("description").notNull(),
  amountGbp: numeric("amount_gbp", { precision: 10, scale: 2 }),
  vatIncluded: boolean("vat_included").notNull().default(false),
  validUntil: date("valid_until"),
  status: text("status").notNull().default("Received"),
  notes: text("notes").default(""),
  attachmentUrl: text("attachment_url").default(""),
  receivedAt: date("received_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;

export const insertSupplierQuoteSchema = createInsertSchema(supplierQuotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplierQuote = z.infer<typeof insertSupplierQuoteSchema>;
export type SupplierQuote = typeof supplierQuotesTable.$inferSelect;
