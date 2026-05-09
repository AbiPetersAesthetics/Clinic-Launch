/**
 * Deterministic seed script for Clinic Launch OS.
 * Winchester Clinic Plan V5 — 7 phases, 83 tasks, exact V5 costs.
 * Dad's carpentry labour is free throughout Phase 3 (materials-only costs).
 *
 * Idempotent on the PROJECT row but always replaces phases + tasks so that
 * re-running (e.g. on a fresh production deploy) picks up the latest data.
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
  {
    name: "Phase 1 — Pre-lease due diligence",
    description: "Legal, planning, and financial checks before signing anything",
    sortOrder: 1,
    tasks: [
      { title: "Confirm Use Class E(e) — pre-app enquiry to Winchester City Council", owner: "David", riskLevel: "medium", costLow: 0, costMid: 100, costHigh: 250, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "E(e) covers medical/health services. Pre-app enquiry to WCC planning dept costs £100-250. If Use Class is wrong, lease is worthless. Ring WCC planning before any other action." },
      { title: "Search WCC Public Access — s.106, conditions, Article 4 Directions", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Free. Check for s.106 obligations, planning conditions on the building, any Article 4 Directions removing permitted development rights. WCC Public Access portal." },
      { title: "Check rateable value — gov.uk/find-business-rates (RV £31,250 confirmed)", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "RV £31,250 confirmed = rates bill £15,437/yr before any relief. Winchester small business rates relief does NOT apply above £15k RV. Rates cannot be negotiated — baked into business case." },
      { title: "Commercial property solicitor — lease negotiation and exchange", owner: "Solicitor", riskLevel: "high", costLow: 1200, costMid: 2200, costHigh: 3500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 28, notes: "Hampshire-based commercial property solicitor with healthcare/FRI lease experience. Goadsby are the agents — do NOT use their recommended solicitor. Get 3 quotes. Budget £2,200 mid." },
      { title: "RICS Schedule of Condition — must be annexed before signing (FRI lease)", owner: "RICS Surveyor", riskLevel: "high", costLow: 600, costMid: 950, costHigh: 1500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "FRI lease = Abi responsible for ALL repairs including pre-existing defects. Schedule of Condition annexe limits liability to condition at lease start. Without it, dilapidations bill at exit could be enormous." },
      { title: "Fit-out drawings for Licence for Alterations", owner: "David", riskLevel: "medium", costLow: 0, costMid: 200, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "Landlord needs drawings showing proposed partition, basin positions, drainage route, signage fixings before granting Licence for Alterations. David can draw in SketchUp — £0 if self-drawn, £200-800 if CAD technician needed." },
      { title: "Advertisement Consent — conservation area shopfront sign", owner: "David", riskLevel: "high", costLow: 174, costMid: 400, costHigh: 700, isNonNegotiable: true, isCriticalRisk: true, durationDays: 56, notes: "9A Jewry Street is in Winchester City Centre Conservation Area. Advertisement Consent required for most external signage. WCC fee £174 for most ad consent applications. 8-week determination period. Apply simultaneously with lease heads of terms." },
      { title: "Listed Building Consent check — 28a Jewry Street Grade II listed", owner: "David", riskLevel: "high", costLow: 0, costMid: 100, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "28a Jewry Street is Grade II listed. Confirm whether 9A shares any fabric with it. If yes, any works affecting the listed structure need Listed Building Consent — a separate application from planning and advertisement consent." },
      { title: "Book BAFE SP205 fire risk assessor", owner: "David", riskLevel: "medium", costLow: 350, costMid: 475, costHigh: 600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Book now — assessor needs to return post fit-out for the formal assessment. Getting on their books early avoids delay before opening. BAFE SP205 accredited only — required by Hamilton Fraser. Bundle Phase 1 booking + Phase 5 assessment for best price." },
      { title: "Negotiate Heads of Terms with Goadsby", owner: "Abi + David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 14, notes: "Key terms to nail: rent-free period (target 3-6 months for fit-out), break clause at year 3, cap on service charge, landlord contribution to fit-out, right to sublease/assign, Licence for Alterations pre-agreed. Do NOT sign heads of terms until solicitor has reviewed." },
      { title: "DBS check — enhanced disclosure for Abi", owner: "Abi", riskLevel: "low", costLow: 38, costMid: 38, costHigh: 38, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "£38 enhanced DBS. Required for JCCP, Save Face and Hamilton Fraser. Takes 1-3 weeks. Start immediately — do not let this hold up registration." },
      { title: "Check local authority licensing — Health and Care Act 2022", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Confirm Winchester City Council licensing requirements for non-surgical cosmetic procedures. DHSC national licensing scheme launches 2027 but some LAs have interim requirements. Call WCC licensing dept." },
      { title: "Measured building survey", owner: "Dad / RICS Surveyor", riskLevel: "low", costLow: 0, costMid: 350, costHigh: 900, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Dad can manually measure initially — free and sufficient for fit-out drawings and Licence for Alterations. Upgrade to RICS measured survey only if build complexity increases (e.g. structural changes, landlord requires certified drawings). RICS measured survey £350-900 depending on scope." },
    ],
  },
  {
    name: "Phase 2 — Lease signing & immediate actions",
    description: "Actions to complete on the day of or within 48 hours of lease exchange",
    sortOrder: 2,
    tasks: [
      { title: "Exchange and complete lease — Schedule of Condition annexed, VAT on rent confirmed nil", owner: "Solicitor + Abi", riskLevel: "high", costLow: 2708, costMid: 5854, costHigh: 9000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Cost = first month rent £2,708 + legal fees £2,200 + SDLT if applicable. CONFIRM VAT on rent is zero-rated or exempt BEFORE signing — if landlord charges VAT, adds £541/month. Deposit typically 3 months rent = £8,124 negotiable." },
      { title: "Submit Building Regulations Building Notice to Winchester Building Control", owner: "David", riskLevel: "high", costLow: 300, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "Required before any structural or drainage works begin. Building Notice route (not Full Plans) — faster, no drawings approval wait. Fee £300-500 depending on works value. Do NOT start fit-out before Building Notice is submitted." },
      { title: "Pay ICO data protection fee — register as Data Controller", owner: "David", riskLevel: "high", costLow: 47, costMid: 47, costHigh: 52, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "£47/year tier 1 (under 10 staff, under £632k turnover). Tier 2 = £97. Legal requirement on Day 1 of processing patient data. ICO can fine up to £17.5m for unregistered processing. ico.org.uk — 5 minutes online." },
      { title: "Open business bank account for Winchester", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 120, isNonNegotiable: false, isCriticalRisk: false, durationDays: 5, notes: "Separate account for Winchester revenue makes accounts and tax cleaner. Tide or Starling free. Lloyds/Barclays business = £6-10/month. Consider whether Bedhampton account can just track Winchester as a cost centre instead." },
      { title: "Notify utilities — electricity, water, broadband at 9A Jewry Street", owner: "David", riskLevel: "medium", costLow: 0, costMid: 100, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Take meter readings on key handover day. Notify electricity supplier of business occupancy. Check water supply capacity for two clinical basins. Business broadband: £40-70/month — order 2-3 weeks before fit-out completes." },
      { title: "Hamilton Fraser — update indemnity and add premises insurance", owner: "Abi", riskLevel: "high", costLow: 1500, costMid: 2000, costHigh: 2500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Call Hamilton Fraser on lease completion day. Add 9A Jewry Street as second premises. Update treatment list for Winchester. Hamilton Fraser is Hamilton Fraser — they understand aesthetics. £167/month ongoing (included in financial model)." },
      { title: "Instruct healthcare specialist accountant", owner: "David", riskLevel: "medium", costLow: 1800, costMid: 2400, costHigh: 3600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "Healthcare specialist — NOT a general high street accountant. Understands VAT exemption on medical vs cosmetic treatments, PAYE for Abi as director, MTD. Budget £150-200/month ongoing. Worth every penny at VAT registration threshold." },
      { title: "Apply for Licence for Alterations — partition, clinical basins, signage fixings", owner: "Solicitor + David", riskLevel: "high", costLow: 400, costMid: 600, costHigh: 800, isNonNegotiable: true, isCriticalRisk: true, durationDays: 42, notes: "Submit immediately — landlord approval can take 4-6 weeks and FIT-OUT CANNOT START until Licence for Alterations is granted. Include Dad's fit-out drawings. Solicitor drafts licence — £400-800 in fees." },
      { title: "Register for business rates — WCC move-in notification", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Notify WCC Revenues within 7 days of occupation — legal requirement. RV £31,250 = £15,437/year rates (£995/month after 2025 relief). No small business relief. Business rates are a Day 1 liability." },
      { title: "Companies House — update registered office if needed", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Free. Update registered office to Winchester or keep accountant address. Must be updated within 14 days of any change. directors@companieshouse.gov.uk" },
      { title: "Set up medical device inventory log — MHRA 2026 requirement", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Free — spreadsheet or ANS module. MHRA Medical Device Regulations 2026 will require device tracking. Log: device name, manufacturer, model, serial, purchase date, service history, location. Start now — easier than retrofitting." },
      { title: "Prescription record-keeping system — Human Medicines Regulations 2012", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Every prescription issued at Winchester must be: dated, patient name/address, medication, strength, dose, quantity, Abi's name/address/signature, NMC PIN. Records kept minimum 2 years. ANS has prescription pad module — configure on Day 1." },
      { title: "Legionella risk assessment", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 350, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Sensible for any clinic with sinks and a hot water system. L8 ACOP requires assessment where there is a risk of Legionella exposure. Two clinical basins plus kitchenette bring this into scope. Book a UKAS-accredited assessor — written risk assessment plus control scheme. Review annually." },
      { title: "Air conditioning inspection/service", owner: "David", riskLevel: "medium", costLow: 0, costMid: 250, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Important hidden-risk item under FRI lease. Under an FRI lease, Abi is responsible for maintaining any existing air conditioning units. Check whether units are present, obtain service history from landlord, and arrange F-Gas inspection and service before taking occupation. Neglected AC units can be expensive to repair or replace." },
      { title: "PAT testing setup", owner: "David", riskLevel: "low", costLow: 0, costMid: 80, costHigh: 200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Minimal equipment initially — defer PAT testing until clinic is operational and equipment is in place. Once treatment couches, lighting and equipment are installed, arrange PAT testing of all portable appliances. Low risk at outset but required before clinic opens to patients. £80-200 depending on number of items." },
    ],
  },
  {
    name: "Phase 3 — Fit-out works",
    description: "Dad does the labour — costs shown are materials only throughout",
    sortOrder: 3,
    tasks: [
      { title: "Day 1 site meeting — measure all dimensions, confirm soil pipe location", owner: "Dad + David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Measure every room. Locate existing soil pipe and drainage outlet — basin drainage runs to this. Identify electrical consumer unit, existing socket positions, floor condition under any existing coverings. Photograph everything before starting." },
      { title: "Pre-notify Southern Water — Water Fittings Regulations 1999", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Notify Southern Water at least 5 working days before any new water fitting installation. Free. Required by Water Fittings Regulations 1999 for any new connection. Southern Water will inspect on request." },
      { title: "Party Wall notices to neighbours if drilling into shared wall", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "If any fixings penetrate or affect a shared wall with neighbouring properties: Party Wall Act 1996 notice required. 14-day response period. If neighbours appoint a surveyor, costs escalate to £500-2000. Check during Day 1 site visit." },
      { title: "STEP 1 — Strip-out: clear treatment zone, mark cable runs and pipe routes", owner: "Dad", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Labour: Dad (free). Materials: nil. Clear existing fitments per Schedule of Condition. Mark positions of all proposed cable runs and pipe routes in permanent marker on walls before first-fix starts." },
      { title: "STEP 2 — Metal stud framing: partition walls and right-side corridor", owner: "Dad", riskLevel: "medium", costLow: 280, costMid: 415, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: steel studs, track, noggins, fixings. Both treatment room partitions + corridor wall. Allow for FD30 door frames in partition positions. Materials cost only." },
      { title: "STEP 3 — First-fix electrical: 20A circuits, emergency lighting, sockets", owner: "Qualified electrician", riskLevel: "high", costLow: 1100, costMid: 1550, costHigh: 2000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "MUST be Part P qualified — Dad cannot do notifiable electrical work. Separate 20A circuit each treatment room (couch, equipment). Emergency lighting circuits. Extra double sockets. EIC issued on completion." },
      { title: "STEP 4 — First-fix plumbing: supply runs to both clinical basins", owner: "Dad", riskLevel: "high", costLow: 450, costMid: 700, costHigh: 850, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Labour: Dad (free). Materials: copper/pushfit pipe, fittings, isolation valves. Hot and cold supply to both treatment room positions. Waste run to soil pipe. TMV3 thermostatic mixing valve required — clinical standard max 41°C." },
      { title: "STEP 5 — Plasterboard, tape, joint, skim coat", owner: "Dad", riskLevel: "low", costLow: 240, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: 12.5mm moisture-resistant plasterboard, joint tape, joint compound, finish plaster. Smooth finish required for clinical vinyl coving. Allow 48hrs drying before painting." },
      { title: "STEP 6 — FD30 fire doors and linings × 2 treatment rooms", owner: "Dad", riskLevel: "high", costLow: 600, costMid: 850, costHigh: 1000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Labour: Dad (free). Materials: 2 × FD30 fire door sets with frame, intumescent strips, smoke seals, closers, ironmongery. FD30 required under Building Regs for clinical rooms off escape corridor. MUST have cold smoke seals + intumescent strips fitted correctly." },
      { title: "STEP 7 — Second-fix electrical: accessories, commissioning, EIC", owner: "Qualified electrician", riskLevel: "high", costLow: 300, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Part P qualified. Install socket plates, switches, luminaires. Commission emergency lighting. Test and issue Electrical Installation Certificate. EIC must be given to WCC Building Control for Completion Certificate." },
      { title: "STEP 8 — Second-fix plumbing: basins, TMV3 commissioning, waste connections", owner: "Dad", riskLevel: "high", costLow: 200, costMid: 250, costHigh: 300, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Labour: Dad (free). Materials: 2 × clinical wash basins with shrouded pedestals, TMV3 thermostatic valves, lever taps, clinical soap dispensers, paper towel dispensers. TMV3 must be commissioned and flow-tested to confirm max 41°C." },
      { title: "STEP 9 — Clinical vinyl flooring: both treatment rooms (welded seams, 100mm coving)", owner: "Specialist vinyl fitter", riskLevel: "high", costLow: 1200, costMid: 1500, costHigh: 1800, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Tarkett iQ Granit or Polyflor Expona. Must be specialist fitter — welded seams and 100mm integral coving are not DIY. Coved skirting eliminates floor-wall junction where pathogens accumulate. IPC requirement. Cannot be laid until plasterboard is finished and dry." },
      { title: "STEP 10 — Bespoke reception desk (Dad builds)", owner: "Dad", riskLevel: "low", costLow: 500, costMid: 750, costHigh: 1000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: MDF carcass, hardwood edging, laminate top, drawer runners, fixings. Dad to build off-site and deliver as finished unit. Saves approx £1,500-3,000 vs commercial reception desk suppliers." },
      { title: "STEP 11 — Treatment room cabinetry × 2, lockable POM cupboard (Dad builds)", owner: "Dad", riskLevel: "low", costLow: 600, costMid: 1000, costHigh: 1200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 4, notes: "Labour: Dad (free). Materials: MDF, hinges, handles, laminate, lockable hasp for POM cupboard. POM (prescription-only medicines) storage must be lockable — regulatory requirement. Dad builds both treatment room wall units and POM cupboard." },
      { title: "STEP 12 — Antimicrobial paint: treatment rooms and corridor (Dad paints)", owner: "Dad", riskLevel: "low", costLow: 180, costMid: 300, costHigh: 400, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Labour: Dad (free). Materials: Dulux Sterishield or similar antimicrobial emulsion. Treatment rooms and corridor only. Antimicrobial paint required by IPC Policy. Standard emulsion in reception. 2 coats. Allow 4hrs between coats." },
      { title: "STEP 13 — External shopfront signage (ONLY after Advertisement Consent)", owner: "Sign company", riskLevel: "high", costLow: 600, costMid: 1350, costHigh: 2500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "DO NOT ORDER until Advertisement Consent is granted. Conservation area — consent required for most signs. Brief sign company simultaneously with ad consent application so they are ready to fabricate and fit the day consent lands. Budget mid £1,350." },
      { title: "STEP 14 — Deep clean to clinical standard before equipment arrives", owner: "Clinical cleaning company", riskLevel: "high", costLow: 0, costMid: 175, costHigh: 300, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Professional clinical clean after all construction dust settles and before any equipment is moved in. Use BS EN ISO 14644 clean room standards company. Surface sampling available if needed for CQC/Save Face inspection preparation." },
      { title: "STEP 15 — Professional photography of completed clinic", owner: "David", riskLevel: "low", costLow: 350, costMid: 575, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Book photographer for the morning after deep clean — before any equipment or stock is moved in for cleanest shots. Use for website, Google Business Profile, Instagram launch content. Budget £575 for 2-3 hours." },
      { title: "Building Regulations Completion Certificate — final inspection", owner: "Winchester Building Control", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "WBC inspect and issue Completion Certificate. Required before clinic opens — no legal occupation of altered space without it. Book inspection immediately after STEP 14 (deep clean). EIC from electrician must be submitted with inspection request." },
      { title: "Treatment couches × 2 — order early, deliver after flooring", owner: "Abi", riskLevel: "medium", costLow: 2438, costMid: 2900, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21, notes: "Order at Phase 2 — 3-6 week lead time. Delivery timed after vinyl flooring is complete. Beauty Express Diva at £1,219 each = £2,438. Electric preferred for Profhilo and skin treatments. Couch dimensions must be confirmed before Dad builds cabinetry." },
      { title: "Baseline photography protocol — standardised pre-treatment photos for every patient", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 30, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Standard lighting, distance, angles for every treatment area. Ring light + phone mount = £30. Consistent baseline photos are required by Save Face, JCCP and Hamilton Fraser. Protects Abi from complaints about pre-existing conditions." },
    ],
  },
  {
    name: "Phase 4 — Regulatory & professional registrations",
    description: "All professional registrations and compliance steps before opening",
    sortOrder: 4,
    tasks: [
      { title: "JCCP Practitioner Register — apply online", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "FREE since 2025 — fees abolished. Upload: NMC PIN, qualifications, indemnity, BLS certificate, premises declaration. 2-4 weeks. DHSC licensing will require JCCP from 2027." },
      { title: "Save Face registration — online application, Zoom clinic assessment", owner: "Abi", riskLevel: "medium", costLow: 500, costMid: 700, costHigh: 900, isNonNegotiable: true, isCriticalRisk: false, durationDays: 42, notes: "PSA-accredited, NHS-signposted. 45-min Zoom clinic assessment. 4-8 weeks end to end. 200+ policy templates included. Winchester clients search Save Face before booking." },
      { title: "Allergan Direct — register 9A Jewry Street delivery address", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Botox/Juvéderm cannot be delivered until Winchester address registered. 1-2 weeks credentialing. Notify Allergan Practitioner Pathway team at same time." },
      { title: "Galderma/Azzalure — register Jewry Street delivery address", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Same process as Allergan. 1-2 weeks. Bundle with Allergan admin — same week." },
      { title: "Derma Focus (Polynucleotides) — register Jewry Street", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Update delivery address from Bedhampton." },
      { title: "NMC face-to-face prescribing SOP — written procedure for Winchester", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "NMC rule from 1 June 2025: every prescribing episode must follow face-to-face at Winchester premises. Use Save Face SOP templates on registration." },
      { title: "Clinic management software — check ANS plan first then Pabau", owner: "David", riskLevel: "medium", costLow: 0, costMid: 660, costHigh: 1800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "CHECK ANS PLAN FIRST — many plans allow multiple locations free. Defer Pabau to Month 3 if ANS works. Pabau recommended if ANS cannot handle batch tracking." },
      { title: "ACE membership — confirm it covers Winchester location", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 200, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Call ACE before paying anything. Most professional body memberships cover practitioner at any premises." },
      { title: "Allergan Practitioner Pathway — notify of Winchester commercial premises", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Update records. Ask about BDM support and training for Winchester launch. Key differentiator — Abi was scouted." },
      { title: "VAT registration — when rolling 12-month taxable turnover approaches £85k", owner: "Accountant + David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Combined Bedhampton + Winchester approaches threshold months 6-9. No VAT on rent confirmed. Cosmetic treatments standard-rated 20% once registered." },
      { title: "CPD documentation log — set up and start immediately", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Required for DHSC licensing 2027. Log all training, Level 7 progress, BLS renewals. Insurers and JCCP will request." },
      { title: "Complaints and incident log — set up before opening", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Date, patient, treatment, what happened, action, outcome, learning. Review quarterly. Use Save Face template provided on registration." },
      { title: "Batch number and traceability log — every injectable", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Product, batch number, expiry, volume, site per treatment. Required for MHRA product recall tracing. Make batch number mandatory in ANS — 10 mins to configure." },
    ],
  },
  {
    name: "Phase 5 — Clinical governance & health and safety",
    description: "Written policies, emergency kit, and clinical safety systems",
    sortOrder: 5,
    tasks: [
      { title: "IPC Policy — written document for 9A Jewry Street", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "WHO 5 Moments hand hygiene, PPE, surface decontamination, single-use injectables, spillage, sharps, waste. Adapt Save Face template for two treatment rooms, kitchenette, no on-site sterilisation." },
      { title: "Adverse Event Protocol — VO, anaphylaxis, vasovagal — written before Day 1", owner: "Abi", riskLevel: "high", costLow: 80, costMid: 100, costHigh: 120, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "MUST be in writing before first patient. VO: hyalase, massage, A&E escalation. Anaphylaxis: adrenaline 0.5mg IM, 999. Hyalase × 2 + WFI. Cost = hyalase stock." },
      { title: "Emergency drugs and equipment kit", owner: "Abi", riskLevel: "high", costLow: 150, costMid: 200, costHigh: 250, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Basic kit: hyalase × 2, adrenaline × 2, chlorphenamine, hydrocortisone, saline × 2. Check expiry monthly and document. Required by Hamilton Fraser and JCCP." },
      { title: "COSHH risk assessments for all substances used", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Chlorhexidine, IPA, sodium hypochlorite, peels. Hazard, exposure, controls, PPE per product. Use HSE COSHH online tools. Get SDS from each supplier." },
      { title: "Sharps Safety Policy", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "No recapping. Immediate disposal at point of use. RIDDOR reporting if injury. Use HSE sharps policy template." },
      { title: "Fire Risk Assessment — full written document post fit-out", owner: "Fire assessor + Abi", riskLevel: "high", costLow: 350, costMid: 475, costHigh: 600, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "RRFSO 2005 + Building Safety Act 2022. Must reflect as-built layout. Bundle with Phase 1 booking for best price. Review annually." },
      { title: "Clinical waste contract — set up with licensed carrier", owner: "Abi + David", riskLevel: "high", costLow: 420, costMid: 570, costHigh: 720, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Initial Medical 0800 093 5892. Yellow: medicinal sharps. Orange: non-medicinal. Start monthly — upgrade when volume grows." },
      { title: "Consent forms and questionnaires — configured for Winchester", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Use existing ANS templates. Update address to 9A Jewry Street. Each treatment: medical history, informed consent, aftercare, SEPARATE photo consent." },
      { title: "Business Continuity Plan — income protection and locum plan", owner: "David", riskLevel: "medium", costLow: 480, costMid: 540, costHigh: 600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "If Abi cannot work: zero revenue plus £3,703/month in fixed costs. £40-45/month income protection. Document locum nurse-prescriber contact (commission-only)." },
      { title: "Opening injectable stock — Botox, Azzalure, fillers, Profhilo", owner: "Abi", riskLevel: "high", costLow: 3500, costMid: 4250, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Order once Winchester address credentialed. Fridge 2-8°C. Document temperature daily. Lean: 8-10 toxin vials, 15 filler syringes, 3 Profhilo boxes. Every Botox vial at £173 trade generates £215+ revenue." },
      { title: "Delegation and supervision policy", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Required even as solo practitioner. Include escalation pathway and cover-during-absence plan. Save Face template covers this." },
      { title: "BLS certification — confirm current within 12 months", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 80, costHigh: 150, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Check existing BLS cert first — if current: £0. Red Cross half-day at £80. Hamilton Fraser, Save Face and JCCP all require BLS current within 12 months." },
    ],
  },
  {
    name: "Phase 6 — Finance & business admin",
    description: "Accounting, payments, and business administration setup",
    sortOrder: 6,
    tasks: [
      { title: "Accounting software — Xero or QuickBooks", owner: "David", riskLevel: "medium", costLow: 180, costMid: 300, costHigh: 420, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Xero Starter £15/month × 12. MTD from 2026/27 requires digital records. Start on Starter at £15/month — upgrade only when VAT registration kicks in." },
      { title: "Card payment terminal for Winchester", owner: "David", riskLevel: "low", costLow: 29, costMid: 89, costHigh: 149, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "SumUp Air at £29 — 1.69% per transaction, no monthly fee. Separate terminal from Bedhampton. Configure for 20% VAT once registered." },
      { title: "Klarna — set up Winchester as additional location", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Already using at Bedhampton. Add Winchester location. Valuable for Profhilo courses (£515), filler courses, Skinvive." },
    ],
  },
  {
    name: "Phase 7 — Marketing & launch",
    description: "Pre-launch marketing, opening event, and ongoing digital presence",
    sortOrder: 7,
    tasks: [
      { title: "Google Business Profile — create Winchester location at 9A Jewry Street", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Most important local SEO action. Category: Medical Aesthetics Clinic. Verification postcard 1-2 weeks. Respond to every review within 24hrs. Do same day as taking occupation." },
      { title: "Instagram pre-launch campaign — 4-6 weeks teaser content", owner: "David + Abi", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 42, notes: "Week 1: announcement. Weeks 2-3: fit-out progress. Week 4: treatment menu. Week 5: opening date. ASA: no Botox brand name in paid ads. No before/after in paid ads." },
      { title: "Website — Winchester page, photos, updated privacy notice", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5, notes: "David can update himself — 2-3 hours. New clinic page, parking info (Tower Street multi-storey, 5 min walk), booking link, updated ICO number." },
      { title: "Google Tag Manager — conversion tracking for Winchester bookings", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2, notes: "Free. Already in progress. Set booking confirmation as conversion event. Link to GA4 and Google Ads." },
      { title: "Email campaign to 600 existing Bedhampton clients", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Existing GHL — no additional cost. Highest-ROI marketing action at zero marginal cost. Segment within 30 miles of Winchester. Priority booking first 2 weeks." },
      { title: "META ads — Winchester-targeted launch campaigns (3 months)", owner: "David", riskLevel: "medium", costLow: 1200, costMid: 2400, costHigh: 3000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 90, notes: "Defer to month 2 — no Winchester reviews in month 1 = low-quality leads. Start month 2 with 10+ Google reviews. No Botox brand name, no before/after in paid ads." },
      { title: "Google Ads — Winchester search campaigns (3 months)", owner: "David", riskLevel: "medium", costLow: 900, costMid: 1200, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 90, notes: "Also defer to month 2. Google Business Profile handles local search free from Day 1. Botox Winchester, lip filler Winchester, anti-wrinkle Winchester." },
      { title: "Soft launch event — top 50 Bedhampton clients + 20 Winchester contacts", owner: "David + Abi", riskLevel: "low", costLow: 400, costMid: 575, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Evening 6-9pm. Clinic tour, Abi for consultations, Instagram content. Self-cater at £400 — the clinic and Abi are the draw, not the food." },
      { title: "Winchester BID registration", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Call BID first — small businesses may be exempt from levy. winchesterbid.co.uk. Footfall data, local marketing networks, events programme." },
      { title: "Winchester SEO — treatment landing pages (build 3-6 months ahead)", owner: "David", riskLevel: "low", costLow: 0, costMid: 375, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30, notes: "David writes pages himself for launch. Most common clinic launch mistake: website not live early enough. Pages for: botox Winchester, lip filler Winchester, Profhilo Winchester." },
    ],
  },
];

async function seed() {
  console.log("🌱 Starting V5 seed...");

  let projectId: number;

  const [existing] = await db.select().from(schema.projectsTable).where(eq(schema.projectsTable.id, 1));
  if (existing) {
    console.log(`ℹ️  Project id=1 already exists ("${existing.name}") — clearing phases/tasks and re-seeding V5 data.`);
    projectId = existing.id;

    // Delete tasks first (FK), then phases
    const existingPhases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
    for (const phase of existingPhases) {
      await db.delete(schema.tasksTable).where(eq(schema.tasksTable.phaseId, phase.id));
    }
    await db.delete(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
    console.log("  ✅ Cleared old phases and tasks");
  } else {
    const [project] = await db.insert(schema.projectsTable).values({
      name: "Winchester Clinic Opening Plan",
      description: "Full launch plan for Abi Peters Aesthetics — 9A Jewry Street, Winchester. 2 treatment rooms, Dad doing the fit-out labour.",
      targetLocation: "9A Jewry Street, Winchester, Hampshire SO23 8QP",
      targetOpeningDate: "2025-09-01",
      status: "planning",
      launchReadinessPercent: 0,
    }).returning();
    projectId = project.id;
    console.log(`✅ Created project: ${project.name} (id=${project.id})`);
  }

  // Insert all 7 phases and their tasks
  let totalTasks = 0;
  for (const phaseData of PHASES) {
    const [phase] = await db.insert(schema.phasesTable).values({
      projectId,
      name: phaseData.name,
      description: phaseData.description,
      sortOrder: phaseData.sortOrder,
      status: "not_started",
    }).returning();

    for (let i = 0; i < phaseData.tasks.length; i++) {
      const t = phaseData.tasks[i];
      await db.insert(schema.tasksTable).values({
        phaseId: phase.id,
        title: t.title,
        owner: t.owner,
        status: "not_started",
        riskLevel: t.riskLevel,
        costTier: "mid",
        costLow: t.costLow,
        costMid: t.costMid,
        costHigh: t.costHigh,
        selectedCost: t.costMid,
        isNonNegotiable: t.isNonNegotiable,
        isCriticalRisk: t.isCriticalRisk,
        durationDays: t.durationDays,
        notes: t.notes ?? null,
        sortOrder: i,
      });
    }
    totalTasks += phaseData.tasks.length;
    console.log(`  ✅ Phase ${phaseData.sortOrder}: ${phaseData.name} (${phaseData.tasks.length} tasks)`);
  }

  // Update financial model to real Winchester V5 figures
  const existingFin = await db.select().from(schema.financialsTable).where(eq(schema.financialsTable.projectId, projectId));
  if (existingFin.length > 0) {
    await db.delete(schema.financialsTable).where(eq(schema.financialsTable.projectId, projectId));
  }
  await db.insert(schema.financialsTable).values({
    projectId,
    rentGbp: 2708,
    ratesGbp: 995,
    utilitiesGbp: 200,
    internetGbp: 50,
    insuranceGbp: 167,
    accountantGbp: 175,
    softwareGbp: 55,
    wasteContractGbp: 48,
    cleanerGbp: 0,
    subscriptionsGbp: 15,
    financeRepaymentsGbp: 0,
    stockPercent: 20,
    marketingGbp: 600,
    staffingGbp: 1047,
    commissionsPercent: 0,
    consumablesGbp: 0,
    averageClientValueGbp: 135,
    treatmentRoomsCount: 2,
    practitionerHoursPerDay: 7,
    workingDaysPerMonth: 22,
    conservativeOccupancyPercent: 40,
    realisticOccupancyPercent: 65,
    aggressiveOccupancyPercent: 85,
    repeatBookingRatePercent: 60,
    membershipRevenueGbp: 0,
    existingClinicRevenueGbp: 10000,
    ownerDrawingsGbp: 1047,
    runwaySavingsGbp: 80000,
    personalSalaryNeedsGbp: 1047,
  });
  console.log("  ✅ Financial model seeded (Winchester V5 figures)");

  // Ensure 3 scenario configs exist
  const existingScenarios = await db.select().from(schema.scenarioConfigsTable).where(eq(schema.scenarioConfigsTable.projectId, projectId));
  if (existingScenarios.length === 0) {
    await db.insert(schema.scenarioConfigsTable).values([
      { projectId, name: "Conservative", description: "Cautious opening — 40% occupancy, slow ramp", occupancyPercent: 40, revenueMultiplier: 1, isDefault: false },
      { projectId, name: "Realistic", description: "Expected performance — 65% occupancy by month 6", occupancyPercent: 65, revenueMultiplier: 1, isDefault: true },
      { projectId, name: "Aggressive", description: "Strong opening — 85% occupancy with high marketing spend", occupancyPercent: 85, revenueMultiplier: 1, isDefault: false },
    ]);
    console.log("  ✅ Scenario configs seeded (3 scenarios)");
  }

  console.log(`\n🎉 V5 Seed complete: 1 project, 7 phases, ${totalTasks} tasks, 1 financial model`);
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
