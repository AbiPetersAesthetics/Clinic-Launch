// ─────────────────────────────────────────────────────────────────────────────
// Market module seed data, transcribed from the verified competitor capture of
// 31 August to 1 September 2026 and the owner-final price list effective
// 1 November 2026. All prices VAT inclusive (VRN 523 3501 30).
// Compliance: botulinum toxin lines are flagged is_pom and worded as
// "anti-wrinkle treatment"; exosomes are applied topically post-microneedling.
// ─────────────────────────────────────────────────────────────────────────────

export const CAPTURED_W = "2026-08-31";
export const CAPTURED_B = "2026-09-01";

// ── Our treatments (Appendix B) ──────────────────────────────────────────────
export type TreatmentSeed = {
  key: string; displayName: string; category: string; isPom: boolean;
  durationMinutes: number; priceWinchester: number | null; priceBedhampton: number | null;
  courseSize?: number; coursePriceWinchester?: number; coursePriceBedhampton?: number;
  isNew?: boolean; description?: string; varianceReasonWinchester?: string; varianceReasonBedhampton?: string;
};

export const TREATMENTS: TreatmentSeed[] = [
  { key: "consultation", displayName: "Consultation and skin analysis", category: "consultation", isPom: false, durationMinutes: 30, priceWinchester: 0, priceBedhampton: 0, description: "Complimentary consultation with device skin analysis." },
  { key: "review2week", displayName: "Two-week review", category: "consultation", isPom: false, durationMinutes: 15, priceWinchester: 0, priceBedhampton: 0 },
  { key: "aw1", displayName: "Anti-wrinkle treatment, 1 area", category: "anti_wrinkle", isPom: true, durationMinutes: 15, priceWinchester: 190, priceBedhampton: 165 },
  { key: "aw2", displayName: "Anti-wrinkle treatment, 2 areas", category: "anti_wrinkle", isPom: true, durationMinutes: 20, priceWinchester: 255, priceBedhampton: 200 },
  { key: "aw3", displayName: "Anti-wrinkle treatment, 3 areas", category: "anti_wrinkle", isPom: true, durationMinutes: 25, priceWinchester: 305, priceBedhampton: 235 },
  { key: "awSmallArea", displayName: "Additional small area", category: "anti_wrinkle", isPom: true, durationMinutes: 5, priceWinchester: 55, priceBedhampton: 45 },
  { key: "lipFlip", displayName: "Lip flip", category: "anti_wrinkle", isPom: true, durationMinutes: 10, priceWinchester: 95, priceBedhampton: 90 },
  { key: "gummySmile", displayName: "Gummy smile", category: "anti_wrinkle", isPom: true, durationMinutes: 15, priceWinchester: 170, priceBedhampton: 110 },
  { key: "masseter", displayName: "Masseter", category: "anti_wrinkle", isPom: true, durationMinutes: 20, priceWinchester: 335, priceBedhampton: 220 },
  { key: "platysmal", displayName: "Platysmal bands", category: "anti_wrinkle", isPom: true, durationMinutes: 30, priceWinchester: 305, priceBedhampton: 275 },
  { key: "hyperhidrosis", displayName: "Hyperhidrosis, underarm", category: "anti_wrinkle", isPom: true, durationMinutes: 40, priceWinchester: 385, priceBedhampton: 330 },
  { key: "filler05", displayName: "Dermal filler 0.5ml", category: "filler", isPom: false, durationMinutes: 30, priceWinchester: 180, priceBedhampton: 155 },
  { key: "filler1", displayName: "Dermal filler 1ml", category: "filler", isPom: false, durationMinutes: 45, priceWinchester: 300, priceBedhampton: 200 },
  { key: "filler2", displayName: "Dermal filler 2ml", category: "filler", isPom: false, durationMinutes: 60, priceWinchester: 495, priceBedhampton: 340, varianceReasonWinchester: "Cost-based, priced from product cost plus time. The catchment median is distorted by a single premium outlier so it is deliberately not median-derived.", varianceReasonBedhampton: "Cost-based, priced from product cost plus time." },
  { key: "tearTrough", displayName: "Tear trough", category: "filler", isPom: false, durationMinutes: 45, priceWinchester: 430, priceBedhampton: 375, isNew: true },
  { key: "temple", displayName: "Temple", category: "filler", isPom: false, durationMinutes: 45, priceWinchester: 430, priceBedhampton: 375, isNew: true },
  { key: "dissolving", displayName: "Filler dissolving", category: "filler", isPom: false, durationMinutes: 30, priceWinchester: 250, priceBedhampton: 200, description: "Free for our own filler within 12 months." },
  { key: "sculptraVial", displayName: "Sculptra, per vial", category: "regenerative", isPom: false, durationMinutes: 45, priceWinchester: 430, priceBedhampton: 365, isNew: true, courseSize: 3, coursePriceWinchester: 1150, coursePriceBedhampton: 1300, description: "Two vials 800 Winchester, 900 Bedhampton. Three vials 1150 Winchester, 1300 Bedhampton." },
  { key: "profhiloFace", displayName: "Profhilo, face", category: "regenerative", isPom: false, durationMinutes: 30, priceWinchester: 300, priceBedhampton: 280, courseSize: 2, coursePriceWinchester: 550, coursePriceBedhampton: 500, varianceReasonWinchester: "Fixed national price. Held at 300 Winchester because the market has a fixed national price for Profhilo." },
  { key: "profhiloFaceNeck", displayName: "Profhilo, face and neck", category: "regenerative", isPom: false, durationMinutes: 60, priceWinchester: 625, priceBedhampton: 515, courseSize: 2, coursePriceWinchester: 1000, coursePriceBedhampton: 1000 },
  { key: "skinvive", displayName: "Skinvive", category: "regenerative", isPom: false, durationMinutes: 40, priceWinchester: 275, priceBedhampton: 250 },
  { key: "polyFace", displayName: "Polynucleotides, face", category: "regenerative", isPom: false, durationMinutes: 45, priceWinchester: 280, priceBedhampton: 225, courseSize: 3, coursePriceWinchester: 750, coursePriceBedhampton: 600 },
  { key: "polyEye", displayName: "Polynucleotides, under eye, neck or decolletage", category: "regenerative", isPom: false, durationMinutes: 45, priceWinchester: 280, priceBedhampton: 175, courseSize: 3, coursePriceWinchester: 600, coursePriceBedhampton: 525 },
  { key: "exoFace", displayName: "Exosomes with microneedling, face", category: "regenerative", isPom: false, durationMinutes: 45, priceWinchester: 275, priceBedhampton: 235, isNew: true, courseSize: 3, coursePriceWinchester: 750, coursePriceBedhampton: 640, description: "Exosomes are applied topically after microneedling." },
  { key: "exoHair", displayName: "Exosomes with microneedling, hair", category: "regenerative", isPom: false, durationMinutes: 45, priceWinchester: 300, priceBedhampton: 255, isNew: true, courseSize: 3, coursePriceWinchester: 795, coursePriceBedhampton: 875, description: "Exosomes are applied topically after microneedling of the scalp." },
  { key: "mnFace", displayName: "Microneedling, face", category: "skin", isPom: false, durationMinutes: 30, priceWinchester: 215, priceBedhampton: 140, courseSize: 3, coursePriceWinchester: 580, coursePriceBedhampton: 380 },
  { key: "mnFaceNeck", displayName: "Microneedling, face and neck", category: "skin", isPom: false, durationMinutes: 40, priceWinchester: 255, priceBedhampton: 205, courseSize: 3, coursePriceWinchester: 600, coursePriceBedhampton: 525 },
  { key: "mnFaceNeckDec", displayName: "Microneedling, face, neck and decolletage", category: "skin", isPom: false, durationMinutes: 45, priceWinchester: 300, priceBedhampton: 235, courseSize: 3, coursePriceWinchester: 700, coursePriceBedhampton: 635 },
  { key: "obagiBlueRadiance", displayName: "Obagi Blue Radiance peel", category: "skin", isPom: false, durationMinutes: 30, priceWinchester: 90, priceBedhampton: 85, courseSize: 3, coursePriceWinchester: 245, coursePriceBedhampton: 230 },
  { key: "fillmedBright", displayName: "Fillmed Bright peel", category: "skin", isPom: false, durationMinutes: 30, priceWinchester: 75, priceBedhampton: 50 },
  { key: "apaFacial", displayName: "APA medical facial", category: "skin", isPom: false, durationMinutes: 45, priceWinchester: 95, priceBedhampton: 75, isNew: true, courseSize: 3, coursePriceWinchester: 255, coursePriceBedhampton: 200 },
  { key: "led", displayName: "LED session", category: "skin", isPom: false, durationMinutes: 20, priceWinchester: 55, priceBedhampton: 45, isNew: true, description: "25 Winchester, 20 Bedhampton as an add-on to another treatment." },
  { key: "b12", displayName: "B12 injection", category: "skin", isPom: false, durationMinutes: 10, priceWinchester: 40, priceBedhampton: 25 },
];

// ── Competitors (Appendix A). Matched to existing rows by name fragment. ─────
export type CompetitorSeed = {
  match: string;                       // lowercase fragment to find an existing row; else insert
  name: string; tradingName?: string; address?: string; town?: string; postcode?: string;
  leadClinician?: string; credential?: string;
  cqcRegistered?: boolean; cqcNumber?: string; saveFace?: boolean; bacn?: boolean;
  googleReviewCount?: number; googleRating?: string;
  publishesPrices?: string; bookingPlatform?: string; skincareBrands?: string[]; devices?: string[];
  websiteUrl?: string; pricePageUrl?: string;
  distanceKmWinchester?: number | null; distanceKmBedhampton?: number | null;
  threatLevel?: string; notes?: string;
};

export const COMPETITOR_SEEDS: CompetitorSeed[] = [
  // Winchester, within 1km
  { match: "victoria", name: "Dr Victoria Cosmetic Dermatology", address: "34 St Thomas Street", town: "Winchester", leadClinician: "Dr Victoria Gauba, MBBS MSc Derm", credential: "doctor_specialist", cqcRegistered: true, googleReviewCount: 131, googleRating: "4.8", publishesPrices: "full", distanceKmWinchester: 0.06, distanceKmBedhampton: null, threatLevel: "high", websiteUrl: "https://drvictoriag.co.uk/" },
  { match: "winchester medical aesthetics", name: "Winchester Medical Aesthetics", address: "81 High Street", town: "Winchester", leadClinician: "Nurse INP, Level 7", credential: "nurse_prescriber", publishesPrices: "partial", distanceKmWinchester: 0.2, distanceKmBedhampton: null, threatLevel: "high", websiteUrl: "https://wmedicalaesthetics.co.uk/", notes: "Membership-only pricing published. Founder Skin Club pre-selling before an October 2026 opening." },
  { match: "simply skin", name: "Simply Skin Clinic", address: "Middle Brook Street", town: "Winchester", leadClinician: "Dr Emma Higgin and Nurse Ruth Riddle", credential: "doctor_gp", googleReviewCount: 111, googleRating: "5", publishesPrices: "full", distanceKmWinchester: 0.37, distanceKmBedhampton: null, threatLevel: "medium_high", websiteUrl: "https://www.simplyskinclinic.co.uk/" },
  { match: "hampshire medical", name: "Hampshire Medical", address: "33 Southgate Street", town: "Winchester", leadClinician: "Dr Maryam Balaie, GP", credential: "doctor_gp", googleReviewCount: 27, googleRating: "5", publishesPrices: "full", distanceKmWinchester: 0.25, distanceKmBedhampton: null, threatLevel: "medium", websiteUrl: "https://hampshiremedical.co.uk/" },
  { match: "medical aesthetic clinic", name: "The Medical Aesthetic Clinic", address: "37-39 Southgate Street", town: "Winchester", leadClinician: "Cathy Wallwork, RGN INP, 20+ years", credential: "nurse_prescriber", googleReviewCount: 15, googleRating: "5", publishesPrices: "none", distanceKmWinchester: 0.25, distanceKmBedhampton: null, threatLevel: "medium", websiteUrl: "https://www.themedicalaesthetic.clinic/" },
  { match: "wessex", name: "Wessex Skin Clinic", address: "Norman Road", town: "Winchester", leadClinician: "Dr Catherine Fairris, MRCP MSc", credential: "doctor_specialist", cqcRegistered: true, googleReviewCount: 69, googleRating: "5", publishesPrices: "partial", distanceKmWinchester: 1.0, distanceKmBedhampton: null, threatLevel: "medium", websiteUrl: "https://www.wessexskin.com/", notes: "From-prices only. BCAM president." },
  { match: "shideh", name: "Shideh Facial Aesthetics", address: "6B Parchment Street", town: "Winchester", leadClinician: "Dr Shideh Gilmore-Parvazi, dentist, GDC", credential: "dentist", googleReviewCount: 6, googleRating: "5", publishesPrices: "partial", distanceKmWinchester: 0.15, distanceKmBedhampton: null, threatLevel: "low", websiteUrl: "https://www.shidehfacialaesthetics.com/", notes: "Price list PDF dated September 2024." },
  { match: "parchment street dental", name: "Parchment Street Dental", address: "22-23 Parchment Street", town: "Winchester", leadClinician: "Dr Yasmin Patel and Dr Savan Shah, dentists", credential: "dentist", cqcRegistered: true, googleReviewCount: 24, googleRating: "5", publishesPrices: "none", distanceKmWinchester: 0.25, distanceKmBedhampton: null, threatLevel: "low" },
  { match: "sugar", name: "Sugar Aesthetics", address: "Sussex Street", town: "Winchester", credential: "", publishesPrices: "none", googleReviewCount: 1, distanceKmWinchester: 0.1, distanceKmBedhampton: null, threatLevel: "low", notes: "Website domain lapsed August 2026. Likely dormant." },
  { match: "w:a skin", name: "W:A Skin Clinic", address: "Staple Gardens", town: "Winchester", credential: "", publishesPrices: "none", distanceKmWinchester: 0.33, distanceKmBedhampton: null, threatLevel: "low" },
  // Winchester, 1 to 20km
  { match: "aesthetics bae", name: "The Aesthetics Bae", address: "9 Walton Place", town: "Winchester", credential: "beauty_therapist", googleReviewCount: 151, googleRating: "5", publishesPrices: "full", bookingPlatform: "Fresha", distanceKmWinchester: 1.5, distanceKmBedhampton: null, threatLevel: "medium", notes: "Beyond the 1km band. Moving into laser. Watch. Heavy promotional pricing on Fresha." },
  { match: "winchester aesthetics (st lawrence", name: "Winchester Aesthetics", address: "St Lawrence House", town: "Winchester", credential: "", publishesPrices: "none", distanceKmWinchester: 1.4, distanceKmBedhampton: null, threatLevel: "low" },
  { match: "winchester aesthetic clinic", name: "Winchester Aesthetic Clinic", address: "Buriton Road, Harestock", town: "Winchester", credential: "", publishesPrices: "full", distanceKmWinchester: 2.0, distanceKmBedhampton: null, threatLevel: "low", notes: "Publishes 220, 270, 320 anti-wrinkle. Credential not stated, so excluded from medical medians." },
  { match: "secret garden", name: "The Secret Garden Skin Clinic", address: "Alresford Road", town: "Winchester", credential: "nurse_prescriber", publishesPrices: "partial", distanceKmWinchester: 3.0, distanceKmBedhampton: null, threatLevel: "medium" },
  { match: "reverse time", name: "Reverse Time", address: "Twyford", town: "Winchester", credential: "", publishesPrices: "none", distanceKmWinchester: 4.0, distanceKmBedhampton: null, threatLevel: "low" },
  { match: "cja", name: "CJA Aesthetics", town: "Southampton, Winchester, Portsmouth", credential: "doctor_gp", cqcRegistered: true, publishesPrices: "partial", distanceKmWinchester: 19, distanceKmBedhampton: 18, threatLevel: "medium", notes: "Doctor-led, CQC, operates Southampton, Winchester and Portsmouth." },
  { match: "rejuvenate", name: "Rejuvenate Clinics", address: "Swaythling", town: "Southampton", credential: "nurse_prescriber", cqcRegistered: true, googleReviewCount: 245, publishesPrices: "partial", distanceKmWinchester: 17, distanceKmBedhampton: null, threatLevel: "medium", notes: "245 reviews. High review velocity worth watching." },
  { match: "nuyu", name: "Nuyu Aesthetics", address: "Woolston", town: "Southampton", credential: "", publishesPrices: "none", distanceKmWinchester: 20, distanceKmBedhampton: null, threatLevel: "low" },
  { match: "cornish", name: "Dr Rachael Cornish", address: "Chandler's Ford", town: "Eastleigh", credential: "doctor_gp", publishesPrices: "none", distanceKmWinchester: 12, distanceKmBedhampton: null, threatLevel: "low" },
  // Bedhampton catchment
  { match: "skin vanity", name: "Skin Vanity Aesthetics", address: "Park Lane, Bedhampton", town: "Havant", credential: "", googleReviewCount: 55, publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: 1.3, threatLevel: "medium" },
  { match: "pallant", name: "Pallant Aesthetics", town: "Havant", leadClinician: "Nurse and prescriber with MSc", credential: "nurse_prescriber", googleReviewCount: 19, publishesPrices: "full", distanceKmWinchester: null, distanceKmBedhampton: 1.5, threatLevel: "medium" },
  { match: "sero", name: "Sero Aesthetics", town: "Havant", leadClinician: "Nurse, ILS", credential: "nurse", googleReviewCount: 41, publishesPrices: "full", distanceKmWinchester: null, distanceKmBedhampton: 1.5, threatLevel: "medium" },
  { match: "reverie", name: "Reverie Clinic", tradingName: "Nurse Sam", address: "Drayton", town: "Portsmouth", leadClinician: "Nurse INP, menopause practitioner", credential: "nurse_prescriber", googleReviewCount: 90, publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: 2.5, threatLevel: "medium", notes: "States prices can change depending on the offer being run. Compressing the local market." },
  { match: "anna", name: "Anna's Aesthetics", address: "Albert Road, Southsea", town: "Portsmouth", leadClinician: "Two nurses, 35 years combined", credential: "nurse", googleReviewCount: 104, publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: 8, threatLevel: "medium", notes: "Heavy last-minute discounting on social media and a year-round Blue Light Card 10 percent. Filler flash offers seen at 130." },
  { match: "hartfree", name: "Sarah Hartfree, SH Medical", address: "Southwick", town: "Fareham", postcode: "PO17 6DZ", leadClinician: "Sarah Hartfree", credential: "nurse_prescriber", cqcRegistered: true, cqcNumber: "1-13632074845", bacn: true, publishesPrices: "partial", bookingPlatform: "ANS", skincareBrands: ["Obagi", "SH Skin"], devices: ["Observ skin analysis", "Cryotherapy", "IPL"], distanceKmWinchester: null, distanceKmBedhampton: 8, threatLevel: "high", notes: "Most significant Bedhampton competitor. Uses ANS (our booking platform) and stocks Obagi (our flagship brand). Exosome hair, menopause BHRT, weight management, men's hormones, blood testing. Runs an Ambassador Programme. Memberships only, no single prices." },
  { match: "perfect skin", name: "Perfect Skin Solutions", address: "121 Winter Road, Southsea", town: "Portsmouth", postcode: "PO4 8DS", leadClinician: "Dr Dev Patel", credential: "doctor_gp", cqcRegistered: true, saveFace: true, publishesPrices: "none", skincareBrands: ["CellDerma"], devices: ["Morpheus8", "Sofwave", "Endolift", "NeoGen", "UltraClear", "IPL", "Plexr", "Erchonia", "Dermalux", "InMode"], distanceKmWinchester: null, distanceKmBedhampton: 10, threatLevel: "low", notes: "The ceiling of the Portsmouth market, not a direct competitor. Founded 2011, 20-strong team, Aesthetic Clinic of the Year South East 2025. Owns CellDerma. Do not attempt to compete on devices." },
  { match: "andrea jones", name: "Andrea Jones Cosmetic Clinic", address: "Horndean", town: "Waterlooville", credential: "nurse_prescriber", googleReviewCount: 38, publishesPrices: "none", distanceKmWinchester: null, distanceKmBedhampton: 6, threatLevel: "low" },
  // Membership comparators (out of catchment, benchmark only)
  { match: "al aesthetics", name: "AL Aesthetics", town: "Hampshire", credential: "doctor_gp", publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: null, threatLevel: "low", notes: "Membership benchmark comparator." },
  { match: "bulbeck", name: "Jane Bulbeck", town: "Chichester", credential: "beauty_therapist", publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: null, threatLevel: "low", notes: "Membership benchmark comparator." },
  { match: "esthetic skin", name: "Esthetic Skin", town: "UK", credential: "nurse_prescriber", publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: null, threatLevel: "low", notes: "UK membership benchmark comparator." },
  { match: "skingenius", name: "SkinGenius", town: "UK", credential: "nurse_prescriber", publishesPrices: "none", distanceKmWinchester: null, distanceKmBedhampton: null, threatLevel: "low", notes: "UK membership benchmark comparator. Gated pricing, 300 join fee." },
  { match: "solihull", name: "Solihull Aesthetics", town: "UK", credential: "doctor_gp", publishesPrices: "partial", distanceKmWinchester: null, distanceKmBedhampton: null, threatLevel: "low", notes: "UK membership benchmark comparator. POMs explicitly excluded from memberships, the compliance model." },
];

// ── Competitor prices. p: [match, treatmentKey, price|null, qualifier, courseSize?, coursePrice?] ──
type P = [string, string, number | null, "exact" | "from" | "poa", number?, number?];
export const WINCHESTER_PRICES: P[] = [
  // Dr Victoria
  ["victoria", "aw1", 190, "exact"], ["victoria", "aw2", 290, "exact"], ["victoria", "aw3", 330, "exact"],
  ["victoria", "lipFlip", 120, "exact"], ["victoria", "gummySmile", 100, "exact"], ["victoria", "masseter", 400, "exact"],
  ["victoria", "platysmal", 350, "exact"], ["victoria", "hyperhidrosis", 400, "exact"],
  ["victoria", "filler05", 200, "exact"], ["victoria", "filler1", 400, "exact"], ["victoria", "filler2", 750, "exact"],
  ["victoria", "tearTrough", 550, "exact"], ["victoria", "dissolving", 250, "exact"], ["victoria", "sculptraVial", 450, "exact"],
  ["victoria", "profhiloFace", 300, "exact"], ["victoria", "profhiloFaceNeck", 650, "exact"],
  ["victoria", "polyFace", 280, "exact"], ["victoria", "exoFace", 300, "exact"],
  ["victoria", "mnFace", 180, "exact"], ["victoria", "mnFaceNeck", 210, "exact"],
  ["victoria", "fillmedBright", 80, "exact"], ["victoria", "review2week", 50, "exact"],
  // Hampshire Medical
  ["hampshire medical", "aw1", 200, "exact"], ["hampshire medical", "aw2", 260, "exact"], ["hampshire medical", "aw3", 320, "exact"],
  ["hampshire medical", "gummySmile", 180, "from"], ["hampshire medical", "platysmal", 180, "from"], ["hampshire medical", "hyperhidrosis", 450, "exact"],
  ["hampshire medical", "profhiloFace", 300, "exact"], ["hampshire medical", "polyFace", 300, "exact"],
  ["hampshire medical", "mnFace", 250, "exact"], ["hampshire medical", "mnFaceNeck", 320, "exact"],
  ["hampshire medical", "obagiBlueRadiance", 100, "exact"], ["hampshire medical", "fillmedBright", 80, "from"],
  // Simply Skin
  ["simply skin", "aw1", 200, "exact"], ["simply skin", "aw2", 270, "exact"], ["simply skin", "aw3", 330, "exact"],
  ["simply skin", "lipFlip", 80, "exact"], ["simply skin", "gummySmile", 180, "exact"], ["simply skin", "masseter", 350, "exact"],
  ["simply skin", "platysmal", 350, "exact"], ["simply skin", "hyperhidrosis", 450, "exact"],
  ["simply skin", "filler1", 300, "exact"], ["simply skin", "filler2", 550, "exact"], ["simply skin", "tearTrough", 450, "exact"],
  ["simply skin", "dissolving", 275, "exact"], ["simply skin", "profhiloFace", 300, "exact"], ["simply skin", "polyFace", 250, "exact"],
  ["simply skin", "mnFace", 250, "exact"], ["simply skin", "obagiBlueRadiance", 95, "exact"], ["simply skin", "b12", 45, "exact"],
  // Shideh
  ["shideh", "aw1", 140, "from"], ["shideh", "aw3", 320, "from"], ["shideh", "gummySmile", 190, "from"],
  ["shideh", "platysmal", 320, "from"], ["shideh", "hyperhidrosis", 199, "exact"], ["shideh", "filler1", 200, "exact"],
  ["shideh", "profhiloFace", 300, "exact"], ["shideh", "polyFace", 300, "exact"], ["shideh", "mnFace", 200, "exact"],
  // Wessex
  ["wessex", "aw1", 210, "from"], ["wessex", "aw2", null, "poa"], ["wessex", "aw3", null, "poa"],
  ["wessex", "lipFlip", null, "poa"], ["wessex", "gummySmile", null, "poa"], ["wessex", "masseter", null, "poa"],
  ["wessex", "platysmal", null, "poa"], ["wessex", "hyperhidrosis", null, "poa"],
  ["wessex", "filler05", null, "poa"], ["wessex", "filler1", 350, "from"], ["wessex", "filler2", null, "poa"],
  ["wessex", "tearTrough", null, "poa"], ["wessex", "dissolving", null, "poa"], ["wessex", "sculptraVial", 450, "exact"],
  ["wessex", "profhiloFace", 300, "from"], ["wessex", "profhiloFaceNeck", null, "poa"],
  ["wessex", "polyFace", 300, "from"], ["wessex", "exoFace", 275, "from"],
  ["wessex", "mnFace", 260, "from"], ["wessex", "mnFaceNeck", null, "poa"],
  ["wessex", "obagiBlueRadiance", 85, "from"], ["wessex", "fillmedBright", 85, "from"],
  // Winchester Aesthetic Clinic (2km, publishes anti-wrinkle)
  ["winchester aesthetic clinic", "aw1", 220, "exact"], ["winchester aesthetic clinic", "aw2", 270, "exact"], ["winchester aesthetic clinic", "aw3", 320, "exact"],
];

export const BEDHAMPTON_PRICES: P[] = [
  // Pallant
  ["pallant", "aw1", 170, "exact"], ["pallant", "aw2", 200, "exact"], ["pallant", "aw3", 250, "exact"],
  ["pallant", "lipFlip", 60, "exact"], ["pallant", "gummySmile", 70, "exact"],
  ["pallant", "filler05", 160, "exact"], ["pallant", "filler1", 190, "exact"], ["pallant", "filler2", 310, "exact"],
  ["pallant", "tearTrough", 260, "from"], ["pallant", "profhiloFace", 230, "exact", 2, 410],
  ["pallant", "polyFace", 230, "exact"], ["pallant", "polyEye", 150, "exact"], ["pallant", "fillmedBright", 70, "from"],
  // Sero
  ["sero", "aw1", null, "poa"], ["sero", "filler1", 200, "exact"], ["sero", "filler2", 360, "exact"],
  ["sero", "tearTrough", 375, "exact"], ["sero", "dissolving", 250, "exact"],
  ["sero", "profhiloFace", 250, "exact", 2, 400], ["sero", "polyFace", 150, "exact"],
  ["sero", "mnFace", 80, "exact"], ["sero", "b12", 30, "exact"],
  // Skin Vanity
  ["skin vanity", "aw1", 150, "from"], ["skin vanity", "filler1", 200, "from"], ["skin vanity", "profhiloFace", 220, "exact"],
  // Reverie
  ["reverie", "aw1", 80, "from"], ["reverie", "aw3", 320, "from"], ["reverie", "filler1", 210, "from"],
  ["reverie", "polyFace", 150, "from"], ["reverie", "mnFace", 180, "from"], ["reverie", "fillmedBright", 50, "from"],
  ["reverie", "apaFacial", 65, "from"],
  // Anna's
  ["anna", "aw1", 170, "from"], ["anna", "filler1", 220, "from"],
];

// ── Competitor membership programmes (Hampshire and West Sussex) ─────────────
export type CompMembershipSeed = {
  match: string; programmeName: string; model: string;
  priceMonthlyGbp?: number | null; priceHighGbp?: number | null; founderPriceGbp?: number | null; annualPriceGbp?: number | null;
  minCommitmentMonths?: number | null; includesPom: boolean; statedSavingGbp?: number;
  deliveredBy?: string; includedTreatments?: string[]; discountRetailPct?: number; discountTreatmentsPct?: number;
  notes?: string;
};

export const COMP_MEMBERSHIPS: CompMembershipSeed[] = [
  { match: "cja", programmeName: "CJA Membership Club", model: "discount_only", priceMonthlyGbp: 12.5, includesPom: false, notes: "Four LED sessions a year. No stated minimum term." },
  { match: "hartfree", programmeName: "Well-being", model: "treatment_included", priceMonthlyGbp: 50, annualPriceGbp: 600, minCommitmentMonths: 12, includesPom: false, deliveredBy: "prescriber" },
  { match: "al aesthetics", programmeName: "Club AL", model: "credit_wallet", priceMonthlyGbp: 62, includesPom: true, notes: "Credit wallet, from 62 per month. Credit spendable on POM treatment: public POM inclusion." },
  { match: "hartfree", programmeName: "Skinvestment", model: "treatment_included", priceMonthlyGbp: 75, minCommitmentMonths: 12, includesPom: false, statedSavingGbp: 260, deliveredBy: "prescriber", discountRetailPct: 10, includedTreatments: ["4 microneedling", "3 Coolifting facials", "2 Obagi Blue Radiance peels", "1 WOW facial", "1 BlueLift facial"], notes: "Eleven treatments over 12 months plus 10 percent off SH Skin products. Zero injectables in any of her three programmes. The local best-practice compliance benchmark." },
  { match: "hartfree", programmeName: "Well-being+", model: "treatment_included", priceMonthlyGbp: 75, annualPriceGbp: 900, minCommitmentMonths: 12, includesPom: false, deliveredBy: "prescriber" },
  { match: "reverie", programmeName: "Three tiers", model: "credit_wallet", priceMonthlyGbp: 75, priceHighGbp: 105, includesPom: true, notes: "Anti-wrinkle treatment included four times a year in a public tier: public POM inclusion." },
  { match: "winchester medical aesthetics", programmeName: "Founder Skin Club", model: "treatment_included", priceMonthlyGbp: 199, priceHighGbp: 199, founderPriceGbp: 149, minCommitmentMonths: 4, includesPom: true, notes: "Founder rate 149 held for life, standard 199. Four-month repeating cycles. No billing until 1 October 2026. Month-two benefit stated publicly as 20 percent off anti-wrinkle treatment, a CAP Code and MHRA breach we must not replicate." },
  { match: "bulbeck", programmeName: "Skin Lab Membership", model: "treatment_included", priceMonthlyGbp: 160, includesPom: false, notes: "Beauty tier." },
  { match: "esthetic skin", programmeName: "Memberships", model: "credit_wallet", priceMonthlyGbp: 199, includesPom: true, notes: "Credit spendable on anti-wrinkle treatment and filler: public POM inclusion." },
  { match: "skingenius", programmeName: "Skin Club", model: "credit_wallet", priceMonthlyGbp: null, minCommitmentMonths: 9, includesPom: true, notes: "Gated pricing, 9 months, 300 join fee." },
  { match: "solihull", programmeName: "Skin Club / Ultimate", model: "treatment_included", priceMonthlyGbp: null, minCommitmentMonths: 12, includesPom: false, notes: "Tiered. POMs explicitly excluded, the compliance model." },
];

// ── Our membership ladder (Appendix C) ───────────────────────────────────────
export type OurMembershipSeed = {
  name: string; tierRank: number; site: string; priceMonthlyGbp: number | null;
  founderPriceGbp?: number; founderPlaces?: number;
  minCommitmentMonths: number; noticePeriodDays: number;
  inclusions: object[]; isPublic: boolean; liveFromDate: string; deliveredBy: string;
  includedMinutesPerMonth: number; features: Record<string, boolean | number>; notes?: string;
};

export const OUR_MEMBERSHIPS: OurMembershipSeed[] = [
  {
    name: "Skin Circle", tierRank: 1, site: "both", priceMonthlyGbp: 19,
    minCommitmentMonths: 0, noticePeriodDays: 0, isPublic: true, liveFromDate: "2026-11-01", deliveredBy: "therapist",
    includedMinutesPerMonth: 20,
    inclusions: [
      { treatmentKey: "led", qtyPerMonth: 1, label: "One 20 minute LED session monthly" },
      { label: "10 percent off retail" },
      { label: "Priority booking" },
    ],
    features: { includedTreatment: 1, retailDiscount: 10, priorityBooking: 1, cancelAnyTime: 1 },
    notes: "Cancel any time. Directly targets CJA's 12.50 tier, which gives four LED sessions a year against our twelve.",
  },
  {
    name: "The Skin Plan", tierRank: 2, site: "winchester", priceMonthlyGbp: 115,
    founderPriceGbp: 95, founderPlaces: 30,
    minCommitmentMonths: 3, noticePeriodDays: 30, isPublic: true, liveFromDate: "2027-01-01", deliveredBy: "associate",
    includedMinutesPerMonth: 50,
    inclusions: [
      { choiceOf: ["obagiBlueRadiance", "fillmedBright", "apaFacial", "led"], qtyPerMonth: 1, label: "One 30 minute skin treatment monthly" },
      { addOnKey: "led", addOnPriceW: 25, addOnPriceB: 20, label: "LED included with every peel or facial" },
      { label: "Device skin rescan with written progress notes every fourth month" },
      { label: "15 percent off retail" },
      { label: "10 percent off courses" },
    ],
    features: { includedTreatment: 1, skinAnalysis: 1, writtenProgressNotes: 1, retailDiscount: 15, courseDiscount: 10, priorityBooking: 1, rollover: 1, pause: 1 },
    notes: "Founder rate 95, 30 places, held for the life of the membership. One rollover month, one pause per twelve months, 30 days notice.",
  },
  {
    name: "The Skin Plan", tierRank: 2, site: "bedhampton", priceMonthlyGbp: 85,
    minCommitmentMonths: 3, noticePeriodDays: 30, isPublic: true, liveFromDate: "2027-01-01", deliveredBy: "associate",
    includedMinutesPerMonth: 50,
    inclusions: [
      { choiceOf: ["obagiBlueRadiance", "fillmedBright", "apaFacial", "led"], qtyPerMonth: 1, label: "One 30 minute skin treatment monthly" },
      { addOnKey: "led", addOnPriceW: 25, addOnPriceB: 20, label: "LED included with every peel or facial" },
      { label: "Device skin rescan with written progress notes every fourth month" },
      { label: "15 percent off retail" },
      { label: "10 percent off courses" },
    ],
    features: { includedTreatment: 1, skinAnalysis: 1, writtenProgressNotes: 1, retailDiscount: 15, courseDiscount: 10, priorityBooking: 1, rollover: 1, pause: 1 },
    notes: "Priced at 85 because Sarah Hartfree is 8km away at 75 for eleven treatments a year. 85 gives twelve treatments at 85 each against her 82, level on value but on a three-month term against her twelve.",
  },
  {
    name: "Skin Plan Advanced", tierRank: 3, site: "winchester", priceMonthlyGbp: 185,
    minCommitmentMonths: 6, noticePeriodDays: 30, isPublic: true, liveFromDate: "2027-04-01", deliveredBy: "associate",
    includedMinutesPerMonth: 65,
    inclusions: [
      { choiceOf: ["obagiBlueRadiance", "fillmedBright", "apaFacial", "led"], qtyPerMonth: 1, label: "One 30 minute skin treatment monthly" },
      { addOnKey: "led", addOnPriceW: 25, addOnPriceB: 20, label: "LED included with every peel or facial" },
      { choiceOf: ["mnFace", "exoFace"], qtyPerYear: 4, label: "One microneedling or exosome session each quarter" },
      { label: "Two full rescans a year with a written plan from Abi" },
      { label: "20 percent off retail" },
      { label: "15 percent off courses" },
    ],
    features: { includedTreatment: 1, skinAnalysis: 1, writtenProgressNotes: 1, retailDiscount: 20, courseDiscount: 15, priorityBooking: 1, rollover: 1, pause: 1 },
    notes: "By invitation after 4 months on The Skin Plan.",
  },
  {
    name: "Frown Free Club / APA Treatment Plan", tierRank: 9, site: "both", priceMonthlyGbp: null,
    minCommitmentMonths: 0, noticePeriodDays: 0, isPublic: false, liveFromDate: "existing", deliveredBy: "prescriber",
    includedMinutesPerMonth: 0,
    inclusions: [
      { label: "Fixed monthly payment against a prescribed schedule of three treatments a year" },
      { label: "Two-week review" },
      { label: "Priority rebooking" },
      { label: "Birthday month credit" },
    ],
    features: { priorityBooking: 1 },
    notes: "PRIVATE. Enrolled in clinic after consultation and the prescribing decision only. Never on the website, in ads, in the founders funnel, or in any GHL sequence reaching a non-patient.",
  },
];

// ── Founders offer (Appendix D) and referral scheme (Appendix E) ─────────────
export const FOUNDERS_OFFER = {
  closes: "At 100 places or 31 January 2027, whichever comes first. Quantity-limited, not countdown-driven, to stay clear of ASA pressure-selling rules on cosmetic procedures.",
  items: [
    "Complimentary skin analysis consultation with Abi",
    "Founder Skin Start: medical facial plus LED, 65 against 120 list",
    "50 pounds credit on a second treatment booked within eight weeks of the first",
    "Skin Plan founder rate 95, or Skin Circle at 15, held for the life of the membership",
  ],
  rules: "Nothing on anti-wrinkle treatment. Nothing on filler. No percentages in any public copy.",
};

export const REFERRAL_SCHEME = {
  creditReferrerGbp: 25,
  creditRefereeGbp: 25,
  rules: [
    "Applied to treatment, never cash, never against a first consultation",
    "Released after the referee's first paid treatment is attended, not booked",
    "Generic clinic credit, never framed against a prescription treatment",
    "Unique code per patient from the GHL contact ID",
  ],
  benchmarks: "Benchmark cost per acquisition against Meta CPL. Cross-reference the engaged_reply GHL tag, our strongest conversion predictor.",
};
