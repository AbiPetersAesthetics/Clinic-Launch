/**
 * Deterministic seed script for Clinic Launch OS.
 * Creates the default Winchester clinic launch project with all 9 phases,
 * 76 representative tasks with LOW/MID/HIGH cost bands, a baseline financial
 * model, and three default scenario configs.
 *
 * Idempotent: checks whether project id=1 already exists before inserting.
 *
 * Run with:  pnpm --filter @workspace/db run seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const PHASES = [
  { name: "Property & Negotiation", description: "Identify, evaluate and secure the clinic premises", sortOrder: 1 },
  { name: "Legal & Contracts", description: "Solicitors, leases, and corporate formation", sortOrder: 2 },
  { name: "Design & Planning", description: "Architectural drawings, planning applications, interior design", sortOrder: 3 },
  { name: "Build & Fit-Out", description: "Construction, partitioning, electrics, plumbing, decoration", sortOrder: 4 },
  { name: "Compliance & Clinical", description: "CQC registration, clinical governance, insurance", sortOrder: 5 },
  { name: "Systems & Software", description: "Practice management, booking system, payments, CCTV", sortOrder: 6 },
  { name: "Marketing & Brand", description: "Brand, website, social media, pre-launch campaign", sortOrder: 7 },
  { name: "Launch Preparation", description: "Staff recruitment, training, soft-launch logistics", sortOrder: 8 },
  { name: "Post-Launch & Optimisation", description: "Operations review, KPI tracking, growth planning", sortOrder: 9 },
];

const TASKS_BY_PHASE: Record<number, Array<{
  title: string; owner: string; status: string; riskLevel: string;
  costTier: string; costLow: number; costMid: number; costHigh: number;
  isNonNegotiable: boolean; isCriticalRisk: boolean; durationDays: number; notes?: string;
}>> = {
  1: [
    { title: "Shortlist 5 candidate properties", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14 },
    { title: "Commission chartered surveyor valuation", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 800, costMid: 1200, costHigh: 1800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Essential before any offer" },
    { title: "Negotiate heads of terms with landlord", owner: "Solicitor", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 14 },
    { title: "Confirm parking & disabled access compliance", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 200, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
    { title: "Check zoning for medical/aesthetics use class", owner: "Solicitor", status: "not_started", riskLevel: "high", costTier: "low", costLow: 200, costMid: 400, costHigh: 800, isNonNegotiable: true, isCriticalRisk: true, durationDays: 5 },
    { title: "Review service charge and dilapidations", owner: "Solicitor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 500, costMid: 800, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 5 },
    { title: "Instruct estate agent for comparable rentals", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Sign heads of terms and pay holding deposit", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 1000, costMid: 2500, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1 },
  ],
  2: [
    { title: "Instruct commercial property solicitor", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 2500, costMid: 4000, costHigh: 7000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "CQC registration requires lease in place" },
    { title: "Review and negotiate full lease agreement", owner: "Solicitor", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21 },
    { title: "Confirm break clauses and rent review terms", owner: "Solicitor", status: "not_started", riskLevel: "high", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7 },
    { title: "Establish limited company (if not already done)", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 12, costMid: 50, costHigh: 200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2 },
    { title: "Open business bank account", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5 },
    { title: "Confirm landlord consent for fit-out works", owner: "Solicitor", status: "not_started", riskLevel: "high", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7 },
    { title: "Complete lease exchange and pay deposit", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "high", costLow: 3000, costMid: 6000, costHigh: 12000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Typically 3 months rent deposit" },
    { title: "Arrange key handover and access dates", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
  ],
  3: [
    { title: "Appoint interior designer / architect", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 3000, costMid: 6000, costHigh: 12000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7 },
    { title: "Produce scaled floor plan with treatment room layout", owner: "Designer", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 800, costMid: 1500, costHigh: 3000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14 },
    { title: "Submit planning application (if change of use required)", owner: "Architect", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 500, costMid: 1200, costHigh: 3000, isNonNegotiable: false, isCriticalRisk: true, durationDays: 60, notes: "Can take 8+ weeks — start early" },
    { title: "Select clinic aesthetic, colour palette & materials", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 500, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7 },
    { title: "Obtain landlord sign-off on design scheme", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14 },
    { title: "Source & price clinical equipment (laser, couch, steriliser)", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 8000, costMid: 18000, costHigh: 45000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21 },
    { title: "Confirm signage design and planning consent", owner: "Designer", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 3000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14 },
  ],
  4: [
    { title: "Obtain at least 3 fit-out contractor quotes", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14 },
    { title: "Appoint main fit-out contractor", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 25000, costMid: 55000, costHigh: 95000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Largest single cost item — budget carefully" },
    { title: "First fix electrics (sockets, lighting, data)", owner: "Electrician", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 3000, costMid: 5500, costHigh: 9000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 10 },
    { title: "Plumbing for sinks, water heater, clinical areas", owner: "Plumber", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2500, costMid: 4500, costHigh: 8000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5 },
    { title: "Flooring throughout (clinical LVT + reception carpet)", owner: "Contractor", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 3500, costMid: 6000, costHigh: 10000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Decoration (walls, ceilings, feature wall)", owner: "Contractor", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 2000, costMid: 3500, costHigh: 6000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 5 },
    { title: "Install treatment room furniture and clinical storage", owner: "Contractor", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 5000, costMid: 9000, costHigh: 18000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 5 },
    { title: "Reception desk, waiting area seating, desk", owner: "Contractor", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 2000, costMid: 4500, costHigh: 9000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Deep clean on completion of fit-out", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 200, costMid: 400, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1 },
  ],
  5: [
    { title: "Submit CQC registration application", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 1000, costMid: 2500, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 90, notes: "CQC registration is mandatory — allow 8-12 weeks minimum" },
    { title: "Appoint Registered Manager for CQC purposes", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 30 },
    { title: "Write CQC Fundamental Standards policies", owner: "Compliance Lead", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 30 },
    { title: "Clinical waste contract (Environment Agency-licensed)", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 400, costMid: 700, costHigh: 1200, isNonNegotiable: true, isCriticalRisk: true, durationDays: 14, notes: "Legal requirement — do not cut corners" },
    { title: "Liability & indemnity insurance (£5m minimum)", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 800, costMid: 1500, costHigh: 3500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Clinic cannot open without valid insurance" },
    { title: "Fire risk assessment & fire safety compliance", owner: "Fire Assessor", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 300, costMid: 600, costHigh: 1200, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3 },
    { title: "COSHH assessment and chemical storage plan", owner: "Compliance Lead", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 300, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5 },
    { title: "Data protection registration (ICO)", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 40, costMid: 40, costHigh: 40, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
    { title: "Electrical installation condition report (EICR)", owner: "Electrician", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 200, costMid: 400, costHigh: 700, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1 },
    { title: "Order sharps bins and PPE stock", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 200, costMid: 400, costHigh: 700, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
  ],
  6: [
    { title: "Select and implement practice management system (e.g. Pabau)", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 800, costMid: 1800, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14 },
    { title: "Set up online booking system integrated with calendar", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 300, costMid: 800, costHigh: 2000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7 },
    { title: "Stripe/card terminal setup and payment processing", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 200, costMid: 500, costHigh: 1000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
    { title: "Install CCTV system (treatment rooms excluded)", owner: "IT Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 500, costMid: 1200, costHigh: 2500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
    { title: "Set up clinic email, G-Suite and shared drive", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 60, costMid: 120, costHigh: 240, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2 },
    { title: "Configure product stock management system", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 300, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "WiFi and broadband installation (business grade)", owner: "IT Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 200, costMid: 500, costHigh: 1000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7 },
    { title: "Set up accountancy software (Xero or similar)", owner: "Accountant", status: "not_started", riskLevel: "low", costTier: "low", costLow: 200, costMid: 400, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Telephone line and answering service", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 100, costMid: 300, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2 },
  ],
  7: [
    { title: "Finalise clinic name, logo and brand guidelines", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 7000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21 },
    { title: "Build and launch clinic website", owner: "Web Developer", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 12000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 30 },
    { title: "Set up Instagram, Facebook and Google Business pages", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Pre-launch waitlist / email campaign", owner: "Marketing", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 200, costMid: 800, costHigh: 2500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30 },
    { title: "Photography session — clinic interiors and team", owner: "Photographer", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 500, costMid: 1200, costHigh: 2500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
    { title: "Create treatment menu and pricing structure", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 500, costHigh: 1500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7 },
    { title: "Print menus, consent forms and branded collateral", owner: "Print Supplier", status: "not_started", riskLevel: "low", costTier: "low", costLow: 200, costMid: 600, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7 },
    { title: "Launch Google Ads / paid social pre-launch campaign", owner: "Marketing", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 8000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30 },
    { title: "Attend local networking events / referral partnerships", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 200, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30 },
  ],
  8: [
    { title: "Recruit and DBS-check clinic assistant / therapist", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 200, costMid: 800, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 28 },
    { title: "Induction and training for all staff", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 300, costMid: 800, costHigh: 2500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
    { title: "Soft-launch with friends, family and existing clients", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 200, costMid: 500, costHigh: 1200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3 },
    { title: "Open appointment slots and begin taking bookings", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1 },
    { title: "Launch day event (ribbon cut, local press, socials)", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 4000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
    { title: "Confirm clinical stock levels are adequate for launch", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 10000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7 },
    { title: "Walkthrough with CQC compliance checklist", owner: "Compliance Lead", status: "not_started", riskLevel: "high", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1 },
    { title: "Final check: signage, consumables, IT, access", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
  ],
  9: [
    { title: "Week 1-2 operations review meeting", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1 },
    { title: "Review booking conversion rate and implement fixes", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 500, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7 },
    { title: "Collect and publish first client reviews (Google, Trustpilot)", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30 },
    { title: "First monthly management accounts review", owner: "Accountant", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 200, costMid: 400, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3 },
    { title: "Review occupancy rates vs financial model", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2 },
    { title: "Adjust marketing spend based on acquisition cost data", owner: "Marketing", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 500, costMid: 2000, costHigh: 5000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14 },
    { title: "Plan treatment menu expansion for month 3+", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7 },
    { title: "Introduce membership / loyalty programme", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 200, costMid: 1000, costHigh: 3000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14 },
  ],
};

async function seed() {
  console.log("🌱 Starting seed...");

  // Check if project already exists
  const [existing] = await db.select().from(schema.projectsTable).where(eq(schema.projectsTable.id, 1));
  if (existing) {
    console.log(`✅ Project id=1 already exists (\"${existing.name}\") — skipping seed.`);
    await pool.end();
    return;
  }

  // Create project
  const [project] = await db.insert(schema.projectsTable).values({
    name: "Winchester Clinic Opening Plan",
    description: "Full launch plan for Abi Peters Aesthetics new Winchester location. Target: premium aesthetics clinic with 2 treatment rooms.",
    targetLocation: "Winchester, Hampshire",
    targetOpeningDate: "2025-09-01",
    status: "planning",
    launchReadinessPercent: 0,
  }).returning();
  console.log(`✅ Created project: ${project.name} (id=${project.id})`);

  // Create phases and tasks
  let phaseIndex = 0;
  for (const phaseData of PHASES) {
    phaseIndex++;
    const [phase] = await db.insert(schema.phasesTable).values({
      projectId: project.id,
      name: phaseData.name,
      description: phaseData.description,
      sortOrder: phaseData.sortOrder,
      status: "not_started",
    }).returning();

    const phaseTasks = TASKS_BY_PHASE[phaseIndex] ?? [];
    for (let i = 0; i < phaseTasks.length; i++) {
      const t = phaseTasks[i];
      const selectedCost = t.costTier === "low" ? t.costLow : t.costTier === "high" ? t.costHigh : t.costMid;
      await db.insert(schema.tasksTable).values({
        phaseId: phase.id,
        title: t.title,
        owner: t.owner,
        status: t.status,
        riskLevel: t.riskLevel,
        costTier: t.costTier,
        costLow: t.costLow,
        costMid: t.costMid,
        costHigh: t.costHigh,
        selectedCost,
        isNonNegotiable: t.isNonNegotiable,
        isCriticalRisk: t.isCriticalRisk,
        durationDays: t.durationDays,
        notes: t.notes ?? null,
        sortOrder: i,
      });
    }
    console.log(`  ✅ Phase ${phaseIndex}: ${phase.name} (${phaseTasks.length} tasks)`);
  }

  // Create financial model (based on realistic Winchester clinic numbers)
  await db.insert(schema.financialsTable).values({
    projectId: project.id,
    rentGbp: 3500,
    ratesGbp: 800,
    utilitiesGbp: 300,
    internetGbp: 80,
    insuranceGbp: 250,
    accountantGbp: 300,
    softwareGbp: 250,
    wasteContractGbp: 120,
    cleanerGbp: 400,
    subscriptionsGbp: 150,
    financeRepaymentsGbp: 600,
    stockPercent: 10,
    marketingGbp: 800,
    staffingGbp: 1800,
    commissionsPercent: 0,
    consumablesGbp: 300,
    averageClientValueGbp: 135,
    treatmentRoomsCount: 2,
    practitionerHoursPerDay: 7,
    workingDaysPerMonth: 22,
    conservativeOccupancyPercent: 40,
    realisticOccupancyPercent: 65,
    aggressiveOccupancyPercent: 85,
    repeatBookingRatePercent: 60,
    membershipRevenueGbp: 800,
    existingClinicRevenueGbp: 6000,
    ownerDrawingsGbp: 4500,
    runwaySavingsGbp: 80000,
    personalSalaryNeedsGbp: 3000,
  });
  console.log("  ✅ Financial model seeded");

  // Create 3 default scenario configs
  await db.insert(schema.scenarioConfigsTable).values([
    { projectId: project.id, name: "Conservative", description: "Cautious opening — 40% occupancy, slow ramp", occupancyPercent: 40, revenueMultiplier: 1, isDefault: false },
    { projectId: project.id, name: "Realistic", description: "Expected performance — 65% occupancy by month 6", occupancyPercent: 65, revenueMultiplier: 1, isDefault: true },
    { projectId: project.id, name: "Aggressive", description: "Strong opening — 85% occupancy with high marketing spend", occupancyPercent: 85, revenueMultiplier: 1, isDefault: false },
  ]);
  console.log("  ✅ Scenario configs seeded (3 scenarios)");

  const totalTasks = Object.values(TASKS_BY_PHASE).flat().length;
  console.log(`\n🎉 Seed complete: 1 project, 9 phases, ${totalTasks} tasks, 1 financial model, 3 scenario configs`);
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
