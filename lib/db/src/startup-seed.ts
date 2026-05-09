/**
 * Startup seed — runs automatically when the API server boots.
 * Uses the shared db pool (does NOT close it).
 * Always replaces phases + tasks with the exact V5 Winchester data.
 */

import { db } from "./index";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

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
      { title: "Accessibility / DDA review", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2, notes: "Potential hidden compliance risk — Equality Act 2010 applies to all service providers. Pre-lease: walk the unit and consider step access, corridor widths (minimum 900mm), door widths (850mm clear), toilet access. A minor DDA issue can become expensive if raised post-lease by a complaint or CQC inspection. Commission a brief access consultant review at £150 or use RIBA-registered architect. Discuss with solicitor." },
      { title: "Exit strategy and break clause review", owner: "David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "The safest operators plan exits before signing. Before exchanging: confirm break clause date and notice period (typically month 18 or 24, 6-12 months notice), assignment rights (can the lease be sold?), subletting rights (can space be sublet to a room-rental practitioner?), minimum viable survival date (revenue at which you can sustain without Bedhampton). Survival plan: if Winchester fails after 12 months, what is the exit cost? Insist solicitor summarises these in plain English." },
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
      { title: "Companies House — update registered office if needed", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Free. Update registered office to Winchester or keep accountant address. Must be updated within 14 days of any change." },
      { title: "Set up medical device inventory log — MHRA 2026 requirement", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Free — spreadsheet or ANS module. MHRA Medical Device Regulations 2026 will require device tracking. Log: device name, manufacturer, model, serial, purchase date, service history, location. Start now — easier than retrofitting." },
      { title: "Prescription record-keeping system — Human Medicines Regulations 2012", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Every prescription issued at Winchester must be: dated, patient name/address, medication, strength, dose, quantity, Abi's name/address/signature, NMC PIN. Records kept minimum 2 years. ANS has prescription pad module — configure on Day 1." },
      { title: "Legionella risk assessment", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 350, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Sensible for any clinic with sinks and a hot water system. L8 ACOP requires assessment where there is a risk of Legionella exposure. Two clinical basins plus kitchenette bring this into scope. Book a UKAS-accredited assessor — written risk assessment plus control scheme. Review annually." },
      { title: "Air conditioning inspection/service", owner: "David", riskLevel: "medium", costLow: 0, costMid: 250, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Important hidden-risk item under FRI lease. Under an FRI lease, Abi is responsible for maintaining any existing air conditioning units. Check whether units are present, obtain service history from landlord, and arrange F-Gas inspection and service before taking occupation. Neglected AC units can be expensive to repair or replace." },
      { title: "PAT testing setup", owner: "David", riskLevel: "low", costLow: 0, costMid: 80, costHigh: 200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Minimal equipment initially — defer PAT testing until clinic is operational and equipment is in place. Once treatment couches, lighting and equipment are installed, arrange PAT testing of all portable appliances. Low risk at outset but required before clinic opens to patients. £80-200 depending on number of items." },
      { title: "Alarm / CCTV / security setup", owner: "David", riskLevel: "high", costLow: 300, costMid: 1200, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5, notes: "Winchester town centre — missing from most clinic launches. Required: intruder alarm (NSI/SSAIB-certified, likely required by insurer), CCTV covering entrance and waiting area (ICO registration £40/year, must display signage under GDPR), smart lock or keyfob system for access control, fire alarm links if not landlord-provided. Check FRI lease: security may be your responsibility. Budget MID £1,200 for alarm + 2 cameras + installation. Get quotes before lease exchange." },
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
      { title: "STEP 14 — Deep clean to clinical standard before equipment arrives", owner: "Clinical cleaning company", riskLevel: "high", costLow: 0, costMid: 175, costHigh: 300, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Professional clinical clean after all construction dust settles and before any equipment is moved in. Surface sampling available if needed for CQC/Save Face inspection preparation." },
      { title: "STEP 15 — Professional photography of completed clinic", owner: "David", riskLevel: "low", costLow: 350, costMid: 575, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Book photographer for the morning after deep clean — before any equipment or stock is moved in for cleanest shots. Use for website, Google Business Profile, Instagram launch content. Budget £575 for 2-3 hours." },
      { title: "Building Regulations Completion Certificate — final inspection", owner: "Winchester Building Control", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "WBC inspect and issue Completion Certificate. Required before clinic opens — no legal occupation of altered space without it. Book inspection immediately after STEP 14 (deep clean). EIC from electrician must be submitted with inspection request." },
      { title: "Treatment couches × 2 — order early, deliver after flooring", owner: "Abi", riskLevel: "medium", costLow: 2438, costMid: 2900, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21, notes: "Order at Phase 2 — 3-6 week lead time. Delivery timed after vinyl flooring is complete. Beauty Express Diva at £1,219 each = £2,438. Electric preferred for Profhilo and skin treatments. Couch dimensions must be confirmed before Dad builds cabinetry." },
      { title: "Baseline photography protocol — standardised pre-treatment photos for every patient", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 30, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Standard lighting, distance, angles for every treatment area. Ring light + phone mount = £30. Consistent baseline photos are required by Save Face, JCCP and Hamilton Fraser. Protects Abi from complaints about pre-existing conditions." },
      { title: "Skip hire / waste removal", owner: "Dad + David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Very commonly forgotten fit-out cost. Strip-out rubble, plasterboard offcuts, old fitments and packaging all need removing. Order a skip before strip-out begins — 6-yard skip typically £250-400 in Winchester. Check with landlord that a skip can be placed outside. Budget MID £250." },
      { title: "Contingency for hidden building issues", owner: "David", riskLevel: "high", costLow: 0, costMid: 1000, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "You should absolutely carry a contingency buffer on an older commercial unit. Common hidden issues in period Jewry Street buildings: asbestos in ceiling tiles or floor adhesive (survey required if pre-2000 build), substandard previous electrics, inadequate drainage falls, damp behind existing linings. Budget MID £1,000 minimum — do not spend this unless needed." },
      { title: "Additional AC unit if required — HVAC contingency", owner: "David", riskLevel: "high", costLow: 0, costMid: 2500, costHigh: 6000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "One of the biggest hidden commercial-unit costs. The AC inspection (Phase 2) will determine if existing HVAC is adequate. If not: injectables rooms must stay below 20°C (toxins degrade faster in heat), Winchester clients expect premium comfort, FRI lease likely makes AC your responsibility. A multi-split system for a 2-room clinic: £2,500-4,500 supply and install. Do not commit to this budget until post-inspection. Budget LOW (£0) until inspection confirms gap." },
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
      { title: "Save Face corrective actions contingency", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 300, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "Occasionally Save Face requests minor clinic changes after the Zoom inspection before granting accreditation — e.g. additional signage, a missing policy document, a physical change to the clinic layout. Budget LOW (£0) initially but hold £300 in reserve. Most clinics pass first time; corrective actions are minor when they occur." },
      { title: "Policy printing/binding/compliance folders", owner: "David", riskLevel: "low", costLow: 50, costMid: 150, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Small but realistic operational cost often forgotten. IPC policy, adverse event protocol, COSHH assessments, sharps policy, fire risk assessment, complaints log and consent SOPs all need to be printed, bound and accessible in the clinic. Budget LOW £50 for basic folders and printing — upgrade to professional binding at £150 if Save Face inspection is imminent." },
      { title: "Fridge temperature monitoring system", owner: "David", riskLevel: "medium", costLow: 30, costMid: 120, costHigh: 350, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Worth doing properly for injectables compliance and insurer expectations. Botox, Azzalure and Profhilo must be stored at 2-8°C. A basic min/max thermometer at £30 meets the minimum requirement. A Bluetooth data logger with app alerts (e.g. Govee or Inkbird) at £60-120 is far better — provides continuous audit trail Hamilton Fraser and JCCP will expect to see. Do not rely on a domestic fridge without a verified thermometer." },
      { title: "Cold chain compliance SOP — backup thermometer and power failure procedure", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 50, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Temperature logging alone is not enough — you need a written SOP. Contents: daily fridge check log (min/max temp), backup digital thermometer (calibrated, in drawer), power outage procedure (if fridge loses power for >4 hours, quarantine stock and contact manufacturer), what to do with stock if temperature exceeds 8°C. Hamilton Fraser and Save Face both expect to see cold chain controls documented. Free to write, £30-50 for a calibrated backup thermometer." },
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
      { title: "Medical fridge with min/max logging", owner: "Abi", riskLevel: "high", costLow: 150, costMid: 350, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Worth doing properly for injectables and compliance. A dedicated medical-grade fridge (not domestic) is best practice — consistent 2-8°C, lockable, no freezer compartment. Lec or Shoreline medical fridges £350-600. Pair with the Bluetooth temperature data logger (Phase 4) for a complete audit trail. Do not store food or non-clinical items in the same fridge." },
      { title: "Sharps bins / clinical consumables startup", owner: "Abi", riskLevel: "high", costLow: 100, costMid: 250, costHigh: 600, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "Often forgotten operational startup cost. Yellow-lidded UN3291 sharps containers, orange clinical waste bags, clinical waste bin liners, sharps bin wall brackets. Order before first patient day — cannot operate without compliant sharps disposal. Initial stock for 3 months. Ties into clinical waste contract set up in this phase." },
      { title: "Initial PPE / cleaning consumables", owner: "Abi", riskLevel: "medium", costLow: 80, costMid: 180, costHigh: 450, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Realistic first-month consumables setup. Nitrile gloves (boxes), aprons, face shields, IPA wipes, chlorhexidine, surface disinfectant spray, clinical paper roll, hand sanitiser dispensers × 2, paper towels. Order 4-6 weeks before opening — some clinical suppliers have minimum order values. Budget MID £180 for first stock." },
      { title: "Staff/locum onboarding contingency", owner: "David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 1000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Only relevant if bringing in a second practitioner or locum nurse-prescriber early. Costs: DBS check £38, induction time, uniform if applicable, ANS/system access setup. If Abi is solo at launch (most likely), this is £0. Keep £250 in reserve in case a locum is needed to cover illness in the first 3 months." },
      { title: "Staffing and scaling model — second injector and room rental plan", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Document now even if deferred. Scaling options: (1) Self-employed nurse-prescriber room rental at £150-300/day — lowest risk, adds income without payroll; (2) Second employed injector — adds £30,000+ cost but allows growth; (3) Receptionist/clinic coordinator — add when revenue consistently exceeds £8,000/month. Model: at what monthly revenue does each hire become viable? Document locum nurse-prescriber contacts for illness cover. Review at 6 months post-launch." },
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
      { title: "Receipt printer / POS accessories", owner: "David", riskLevel: "low", costLow: 0, costMid: 120, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Not needed at launch if digital receipts are sufficient — most patients are happy with an emailed receipt from ANS or SumUp. If physical receipts are preferred: Star Micronics mPOP at £250 or basic thermal printer at £60-120. Defer until operational and patient feedback confirms it is needed." },
      { title: "iPad/tablet for clinic operations", owner: "David", riskLevel: "medium", costLow: 0, costMid: 450, costHigh: 1200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "A dedicated clinic iPad becomes very useful operationally — ANS booking system, consent forms, patient photos, temperature logging app, card payments. iPad 10th gen at £349-449 refurbished. Do not use a personal device for patient data — GDPR and Hamilton Fraser both require data to be stored securely on clinic-controlled equipment." },
      { title: "Backup internet / mobile hotspot", owner: "David", riskLevel: "low", costLow: 0, costMid: 60, costHigh: 250, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Can use phone hotspot at launch — sufficient for card payments and ANS if broadband drops. Dedicated 4G/5G router with SIM (e.g. Vodafone Business Connect at £20-30/month) is a cleaner solution once established. Budget LOW (£0) at launch; upgrade if broadband reliability proves to be an issue in the first month." },
      { title: "Cyber/data security contingency", owner: "David", riskLevel: "low", costLow: 0, costMid: 150, costHigh: 600, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Existing systems likely sufficient early-stage — ANS and GHL both have their own security. Key actions at zero cost: enable 2FA on all clinic accounts, use strong unique passwords (1Password free tier), ensure laptop has full-disk encryption. Budget LOW (£0) initially; upgrade to Cyber Essentials certification (£300-600) only when patient volume justifies it." },
      { title: "Operating cashflow reserve buffer", owner: "David", riskLevel: "high", costLow: 10000, costMid: 20000, costHigh: 40000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "This is the most important missing strategic line item. The REAL risk is not the fit-out budget — it is cashflow pressure after opening. Abi stops nursing income, rent and rates are fixed from day 1, Winchester ramp takes 3-6 months, seasonality (August and January are slow). Minimum survivable buffer: £10,000. Realistic: £20,000. Stress test: £40,000. This is not fit-out money — it is operating survivability. Without this buffer, the business is technically viable but personally unsustainable. Priority: fund before any discretionary marketing spend." },
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
      { title: "Google review generation campaign", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 600, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Far more valuable than Meta ads at this stage — a Winchester Google Business Profile with 20+ reviews within 3 months will drive consistent organic bookings. Tactics: post-appointment WhatsApp message with direct review link, QR code card at reception. Tools: NiceJob at £75/month or manual outreach (free). Budget MID £150 for QR cards, printed inserts, and 3 months of a review tool if used." },
      { title: "Launch videography / reels content day", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 500, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Can be self-produced initially using iPhone 15 — ring light, clean background, good audio. Reels content: treatment process clips, before/after reveal, clinic tour, meet Abi intro. A professional videographer at £500-800/day adds polish but is not necessary to start. Defer spend until brand is established and content ROI is proven. Budget LOW (£0) for launch." },
      { title: "Printed launch materials / signage", owner: "David", riskLevel: "low", costLow: 50, costMid: 250, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Minimal premium print collateral is sufficient initially. Essential: A5 double-sided appointment cards (Moo or Canva print), A4 treatment menu, window vinyl with logo. Nice to have: branded bags, tissue paper, stickers. Moo business cards 50-pack at £25, window vinyl at £80-150. Budget LOW (£50) for launch basics; upgrade signage once trading." },
      { title: "Local influencer / creator outreach", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 300, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Not necessary at launch — prioritise Google reviews and organic social first. When ready: target Hampshire-based lifestyle creators with 5k-50k followers (micro-influencers outperform on conversion). Offer complimentary treatment in exchange for an honest reel and 3 static posts. Cost = treatment materials only. Budget LOW (£0) initially." },
      { title: "PR / Hampshire lifestyle magazine outreach", owner: "David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Organic PR outreach can be done manually first — no agency needed at launch. Targets: Hampshire Life, Winchester Magazine, The Winchester Edit. Angles: new premium clinic opening in Jewry Street, Abi's clinical background, safe non-surgical aesthetics. Send press release + hi-res images to editorial email. Budget LOW (£0) — cost only if a PR agency is engaged later." },
      { title: "Winchester brand positioning decision", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "One of the biggest strategic decisions — must be made before marketing spend. Winchester supports a fundamentally different strategy to Waterlooville/Bedhampton. Winchester likely supports: higher spend per client (target £300-500 AOV vs £180-220 at Bedhampton), stronger skin treatment focus (Profhilo, skin boosters, polynucleotides), premium injectables only (no heavy discounting, no group deal platforms), luxury positioning (Harley Street feel, not high street aesthetics). Decision affects: fit-out investment level, branding, pricing, treatment menu, marketing channels, social media tone. Make this decision explicitly before committing to marketing budget." },
    ],
  },
];

async function seedCompliance(projectId: number): Promise<void> {
  await db.insert(schema.complianceItemsTable).values([
    { projectId, section: "CQC Registration", title: "Create CQC provider account on the CQC portal", description: "Register as a provider on the CQC online portal. Required before submitting any application.", status: "not_started", sortOrder: 1 },
    { projectId, section: "CQC Registration", title: "Submit CQC registration application", description: "Complete and submit the full provider registration application including all required declarations.", status: "not_started", sortOrder: 2 },
    { projectId, section: "CQC Registration", title: "Nominate Nominated Individual (NI)", description: "Identify and register a Nominated Individual — the person legally responsible for CQC registration compliance.", status: "not_started", sortOrder: 3 },
    { projectId, section: "CQC Registration", title: "Submit Statement of Purpose", description: "Detailed document describing the regulated activities, service user band, and aims of the service.", status: "not_started", sortOrder: 4 },
    { projectId, section: "CQC Registration", title: "Submit required policies to CQC", description: "All mandatory clinical governance policies must be in place before CQC registration is granted.", status: "not_started", sortOrder: 5 },
    { projectId, section: "CQC Registration", title: "CQC inspection booked and completed", description: "CQC will arrange an inspection of the premises before granting registration.", status: "not_started", sortOrder: 6 },
    { projectId, section: "CQC Registration", title: "CQC registration certificate received", description: "Final step — CQC issues certificate of registration. Clinic CANNOT open to patients without this.", status: "not_started", sortOrder: 7 },
    { projectId, section: "Clinical Governance", title: "Clinical governance framework documented", description: "Formal framework covering accountability, risk management, audit, and patient safety.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Clinical Governance", title: "Adverse incident reporting procedure in place", description: "Clear process for reporting, investigating, and learning from adverse clinical incidents.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Clinical Governance", title: "Patient complaints procedure documented and visible", description: "Written complaints procedure available to patients. Response timeline must meet CQC expectations.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Clinical Governance", title: "Clinical audit schedule established", description: "Plan for regular audits of clinical outcomes, record-keeping, and patient experience.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Clinical Governance", title: "Patient consent process and forms documented", description: "Informed consent process for all treatments, including specific consent for prescription procedures.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Clinical Governance", title: "Chaperone policy in place", description: "Policy covering the use of chaperones during clinical procedures, including patient communication.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Infection Control", title: "Infection Prevention & Control (IPC) policy signed off", description: "Comprehensive IPC policy covering hand hygiene, PPE, decontamination, waste disposal, and spillage procedures.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Infection Control", title: "Clinical waste contract in place (registered carrier)", description: "Signed contract with a registered clinical waste carrier for sharps, contaminated waste, and pharmaceutical waste.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Infection Control", title: "Decontamination/sterilisation procedure documented", description: "Written procedure for cleaning and decontaminating reusable equipment, including ultrasound probes.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Infection Control", title: "Hand hygiene audit completed", description: "Baseline hand hygiene compliance audit completed before opening.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Infection Control", title: "Sharps safety procedure in place (EPA/BBE policy)", description: "Needle-stick and sharps injury policy covering prevention, first aid response, and incident reporting.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Prescriber Arrangements", title: "Prescribing governance framework documented", description: "Framework covering how prescribing decisions are made, documented, and reviewed.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Prescriber Arrangements", title: "Independent prescriber or supervision arrangement confirmed", description: "Either Abi is a qualified IP or a written clinical supervision arrangement is in place with a named prescriber.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Prescriber Arrangements", title: "POM storage — locked, temperature-controlled cupboard", description: "Prescription-only medicines stored in a compliant locked cupboard with temperature monitoring.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Prescriber Arrangements", title: "Prescription record-keeping system operational", description: "Every prescription recorded per Human Medicines Regulations 2012. ANS or equivalent system configured.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Prescriber Arrangements", title: "Medicines management policy in place", description: "Policy covering procurement, storage, administration, disposal, and audit trail of all medicines.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Staff Training", title: "Basic Life Support (BLS) training current", description: "All clinical staff must hold current BLS certification. Minimum annual renewal.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Staff Training", title: "Anaphylaxis management training completed", description: "Adrenaline auto-injector use, recognition, and emergency response. Mandatory for all prescribing staff.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Staff Training", title: "Safeguarding Level 2 training completed", description: "Adults and children safeguarding training. Required by CQC and most professional registers.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Staff Training", title: "IPC training completed for all staff", description: "All clinical and non-clinical staff complete infection prevention and control training.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Staff Training", title: "Mental Capacity Act awareness training", description: "Understanding of capacity assessment in relation to consent for cosmetic procedures.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Staff Training", title: "GDPR / data protection training for all staff", description: "All staff handling patient data must receive GDPR training before clinic opens.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Insurance & Indemnity", title: "Professional indemnity insurance confirmed for Winchester", description: "Hamilton Fraser or equivalent — policy must include all treatments offered at Winchester and the new address.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Insurance & Indemnity", title: "Public liability insurance in place", description: "Minimum £2m public liability. Check FRI lease requirements — may need higher cover.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Insurance & Indemnity", title: "Employers liability insurance (if staff employed)", description: "Legal requirement if any staff are employed. £5m minimum statutory cover.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Insurance & Indemnity", title: "Treatment liability covers prescription procedures", description: "Confirm indemnity explicitly covers toxin, filler, PRP, IV drips and all other prescription treatments.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Opening Requirements", title: "BAFE SP205 fire risk assessment completed (post fit-out)", description: "Post-fit-out fire risk assessment by BAFE SP205 accredited assessor. Required by Hamilton Fraser.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Opening Requirements", title: "Building Regulations Completion Certificate received", description: "WCC Building Control must issue Completion Certificate before clinic opens to patients.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Opening Requirements", title: "Electrical Installation Certificate (EIC) obtained", description: "Issued by Part P qualified electrician on completion of all electrical works.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Opening Requirements", title: "Emergency equipment stocked and accessible", description: "Anaphylaxis kit (adrenaline 1:1000, antihistamine), oxygen if applicable, and basic resuscitation equipment.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Opening Requirements", title: "ICO data controller registration active", description: "ICO registration must be active before processing any patient data. £47/year.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Opening Requirements", title: "Save Face / JCCP accreditation application submitted", description: "Professional accreditation for aesthetics. Required for most insurer panels and patient trust.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Policy Library", title: "Infection Control Policy", description: "Comprehensive IPC policy covering hand hygiene, decontamination, PPE, waste and spillage.", status: "not_started", policyStatus: "draft", sortOrder: 1 },
    { projectId, section: "Policy Library", title: "Medicines Management Policy", description: "Covers procurement, storage, prescribing, administration, disposal and audit of all medicines.", status: "not_started", policyStatus: "draft", sortOrder: 2 },
    { projectId, section: "Policy Library", title: "Safeguarding Policy", description: "Safeguarding adults and children at risk — referral pathways, designated lead, training requirements.", status: "not_started", policyStatus: "draft", sortOrder: 3 },
    { projectId, section: "Policy Library", title: "Complaints Policy", description: "Patient complaints procedure, response timelines, investigation process and learning outcomes.", status: "not_started", policyStatus: "draft", sortOrder: 4 },
    { projectId, section: "Policy Library", title: "Consent Policy", description: "Informed consent procedure for all treatments. Covers capacity, documentation and withdrawal.", status: "not_started", policyStatus: "draft", sortOrder: 5 },
    { projectId, section: "Policy Library", title: "Chaperone Policy", description: "Use of chaperones during clinical procedures including patient communication and documentation.", status: "not_started", policyStatus: "draft", sortOrder: 6 },
    { projectId, section: "Policy Library", title: "Prescribing Governance Policy", description: "Prescribing decision framework, oversight, prescriber competency, and prescription audit.", status: "not_started", policyStatus: "draft", sortOrder: 7 },
    { projectId, section: "Policy Library", title: "Adverse Incidents Policy", description: "Reporting, investigation, root cause analysis and learning from adverse clinical incidents.", status: "not_started", policyStatus: "draft", sortOrder: 8 },
  ]);
  console.log("  ✅ Compliance items seeded (40 items across 7 sections + Policy Library)");
}

async function seedCqcMilestones(projectId: number): Promise<void> {
  await db.insert(schema.cqcMilestonesTable).values([
    { projectId, step: 1, title: "Register with CQC portal", description: "Create provider account and complete pre-registration on the CQC online portal.", leadTimeWeeks: 1, status: "not_started", sortOrder: 1 },
    { projectId, step: 2, title: "Submit application", description: "Complete and submit full provider registration application with all required information.", leadTimeWeeks: 2, status: "not_started", sortOrder: 2 },
    { projectId, step: 3, title: "Nominated Individual approved", description: "CQC confirms the Nominated Individual meets the fit and proper person requirements.", leadTimeWeeks: 4, status: "not_started", sortOrder: 3 },
    { projectId, step: 4, title: "Statement of Purpose accepted", description: "CQC reviews and accepts the Statement of Purpose describing regulated activities.", leadTimeWeeks: 2, status: "not_started", sortOrder: 4 },
    { projectId, step: 5, title: "Policies submitted and reviewed", description: "All required clinical governance policies submitted and reviewed by CQC.", leadTimeWeeks: 2, status: "not_started", sortOrder: 5 },
    { projectId, step: 6, title: "Inspection booked", description: "CQC books and conducts a premises inspection. Typically 4–8 weeks after application.", leadTimeWeeks: 6, status: "not_started", sortOrder: 6 },
    { projectId, step: 7, title: "Registration granted", description: "CQC issues certificate of registration. Clinic is legally permitted to operate as a regulated activity.", leadTimeWeeks: 2, status: "not_started", sortOrder: 7 },
  ]);
  console.log("  ✅ CQC milestones seeded (7 steps, ~19 weeks total)");
}

export async function runStartupSeed(): Promise<void> {
  console.log("🌱 Running startup seed check...");

  try {
    let projectId: number;

    const existing = await db.select().from(schema.projectsTable).where(eq(schema.projectsTable.id, 1));
    if (existing.length > 0) {
      projectId = existing[0].id;

      // Check if we have the correct V5 data (7 phases, 83 tasks)
      const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
      const totalPhases = phases.length;

      if (totalPhases === 7) {
        // Count tasks
        let totalTasks = 0;
        for (const phase of phases) {
          const tasks = await db.select().from(schema.tasksTable).where(eq(schema.tasksTable.phaseId, phase.id));
          totalTasks += tasks.length;
        }
        if (totalTasks === 113) {
          console.log("✅ V5 data already present (7 phases, 113 tasks) — skipping seed.");
          // Still seed compliance if missing
          const existingCompliance2 = await db.select().from(schema.complianceItemsTable).where(eq(schema.complianceItemsTable.projectId, projectId));
          if (existingCompliance2.length === 0) {
            await seedCompliance(projectId);
          }
          const existingMilestones2 = await db.select().from(schema.cqcMilestonesTable).where(eq(schema.cqcMilestonesTable.projectId, projectId));
          if (existingMilestones2.length === 0) {
            await seedCqcMilestones(projectId);
          }
          return;
        }
      }

      // Wrong data — clear and re-seed
      console.log(`ℹ️  Found ${totalPhases} phases — expected 7. Clearing and re-seeding V5 data...`);
      for (const phase of phases) {
        await db.delete(schema.tasksTable).where(eq(schema.tasksTable.phaseId, phase.id));
      }
      await db.delete(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
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
    }

    // Insert all 7 V5 phases and tasks
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

    // Seed financial model
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
      bedhamptonCostsGbp: 3200,
      cannibalPercent: 0,
      wincSelfFundingTargetGbp: 12000,
      ownerDrawingsGbp: 1047,
      runwaySavingsGbp: 80000,
      personalSalaryNeedsGbp: 1047,
      nursingIncomeGbp: 4500,
      targetDrawingsGbp: 4000,
      wincAcvGbp: 155,
    });

    // Ensure scenario configs exist
    const existingScenarios = await db.select().from(schema.scenarioConfigsTable).where(eq(schema.scenarioConfigsTable.projectId, projectId));
    if (existingScenarios.length === 0) {
      await db.insert(schema.scenarioConfigsTable).values([
        { projectId, name: "Conservative", description: "Cautious opening — 40% occupancy, slow ramp", occupancyPercent: 40, revenueMultiplier: 1, isDefault: false },
        { projectId, name: "Realistic", description: "Expected performance — 65% occupancy by month 6", occupancyPercent: 65, revenueMultiplier: 1, isDefault: true },
        { projectId, name: "Aggressive", description: "Strong opening — 85% occupancy with high marketing spend", occupancyPercent: 85, revenueMultiplier: 1, isDefault: false },
      ]);
    }

    // Ensure compliance items exist
    const existingCompliance = await db.select().from(schema.complianceItemsTable).where(eq(schema.complianceItemsTable.projectId, projectId));
    if (existingCompliance.length === 0) {
      await seedCompliance(projectId);
    }

    // Ensure CQC milestones exist
    const existingMilestones = await db.select().from(schema.cqcMilestonesTable).where(eq(schema.cqcMilestonesTable.projectId, projectId));
    if (existingMilestones.length === 0) {
      await seedCqcMilestones(projectId);
    }

    console.log(`🎉 Startup seed complete: 7 phases, ${totalTasks} tasks (Winchester V5)`);
  } catch (err) {
    console.error("❌ Startup seed failed:", err);
  }
}
