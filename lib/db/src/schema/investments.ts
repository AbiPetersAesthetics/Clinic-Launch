import { pgTable, serial, integer, real, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "loan" | "equity"
  amountGbp: real("amount_gbp").notNull().default(0),
  equityPercent: real("equity_percent").notNull().default(0),
  interestRatePercent: real("interest_rate_percent").notNull().default(0),
  repaymentTermMonths: integer("repayment_term_months").notNull().default(0),
  repaymentStartMonth: integer("repayment_start_month").notNull().default(1),
  depositDate: text("deposit_date"),
  agreementStartDate: text("agreement_start_date"),
  firstPaymentDate: text("first_payment_date"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const shareholdersTable = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  equityPercent: real("equity_percent").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShareholderSchema = createInsertSchema(shareholdersTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type InsertShareholder = z.infer<typeof insertShareholderSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
export type Shareholder = typeof shareholdersTable.$inferSelect;
