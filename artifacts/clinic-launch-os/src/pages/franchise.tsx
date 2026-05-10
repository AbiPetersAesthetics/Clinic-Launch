import { useState, useMemo } from "react";
import {
  useGetProjectDashboard, getGetProjectDashboardQueryKey,
  useGetFinancialModel, getGetFinancialModelQueryKey,
  useListProperties, getListPropertiesQueryKey,
  useGetComplianceSummary, getGetComplianceSummaryQueryKey,
  useListDecisions, getListDecisionsQueryKey,
} from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Network, CheckCircle2, AlertTriangle, Building2, TrendingUp,
  MapPin, BookOpen, Shield, Sparkles, Plus, Trash2, Lock,
  Users, PoundSterling, Star, ChevronDown, ChevronUp, HelpCircle,
  Lightbulb, Circle, ExternalLink,
} from "lucide-react";

const PROJECT_ID = 1;

// ─── Types ───────────────────────────────────────────────────────────────────
type TabKey = "strategy" | "readiness" | "investment" | "income" | "treatments" | "territory" | "operations" | "legal";
type ScenarioKey = "low" | "base" | "high";
type SupportCostKey = "low" | "base" | "high";
type InvestmentTypeKey = "light" | "medium" | "full";

interface FranchiseAssumptions {
  franchiseFeeGbp: number;
  royaltyPercent: number;
  marketingLevyPercent: number;
  techSupportMonthlyGbp: number;
  trainingCostGbp: number;
  legalSetupGbp: number;
  workingCapitalMonths: number;
}

interface Territory { id: string; name: string; type: string; population: string; status: "mother_clinic" | "available" | "reserved" | "sold"; note: string }
interface ChecklistItem { id: string; text: string; plain: string; done: boolean }
interface ChecklistSection { id: string; title: string; why: string; items: ChecklistItem[] }
interface ManualReadinessItem { id: string; label: string; desc: string; done: boolean }

// ─── Static data ─────────────────────────────────────────────────────────────
const DEFAULT_ASSUMPTIONS: FranchiseAssumptions = {
  franchiseFeeGbp: 20000,
  royaltyPercent: 6,
  marketingLevyPercent: 2,
  techSupportMonthlyGbp: 250,
  trainingCostGbp: 5000,
  legalSetupGbp: 3000,
  workingCapitalMonths: 3,
};

const INVESTMENT_TYPES: Record<InvestmentTypeKey, { label: string; desc: string; low: number; mid: number; high: number }> = {
  light:  { label: "Light skin & laser studio",           desc: "Facials, skin, peels, laser/IPL, retail — no or minimal injectables",           low: 150000, mid: 225000, high: 300000 },
  medium: { label: "Laser/skin + limited injectables",    desc: "Mixed model — skin and laser with some injectable treatments",                   low: 250000, mid: 375000, high: 500000 },
  full:   { label: "Full medical aesthetics clinic",      desc: "Full injectables menu, devices, prescriptions, medical governance throughout",   low: 450000, mid: 675000, high: 900000 },
};

const SUPPORT_COSTS: Record<SupportCostKey, { label: string; value: number }> = {
  low:  { label: "Low (lean franchisor team)",    value: 500 },
  base: { label: "Base (realistic support model)", value: 1250 },
  high: { label: "High (full compliance oversight)", value: 2500 },
};

const SCALE_ROUTES = [
  {
    id: "company", title: "Company-owned expansion", badge: "Safest — do this first",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: Building2, highlight: true,
    pros: ["Maximum control over clinical quality", "You keep 100% of the profit", "Safest for brand and patient outcomes", "Simplest governance — your staff, your rules"],
    cons: ["Requires your own capital or finance", "Slower to grow", "Your personal risk on each site"],
    bestFor: "Winchester first. Then one more company-owned proof site before any external model.",
  },
  {
    id: "jv", title: "Joint venture / 50:50 partnership", badge: "Recommended next step",
    badgeColor: "bg-primary/15 text-primary",
    icon: Users, highlight: true,
    pros: ["Shared capital — partner funds their half", "Highly motivated operator", "More control than a classic franchise", "Easier to step in if it goes wrong"],
    cons: ["More complex legal agreement than employment", "Shared profit rather than royalty income", "Partner relationships can become difficult"],
    bestFor: "First external location once Winchester is proven and documented.",
  },
  {
    id: "franchise", title: "Classic franchise", badge: "Later stage only",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Network, highlight: false,
    pros: ["Faster rollout with less capital", "Recurring royalty income at scale", "Franchisee is highly motivated — it's their business"],
    cons: ["Hard to enforce clinical standards at a distance", "UK aesthetics regulation is still tightening", "Brand and patient risk if a franchisee behaves badly", "Requires extensive governance infrastructure"],
    bestFor: "Only after 2+ proven sites, a complete operating system, and specialist legal advice.",
  },
  {
    id: "clinicsurge", title: "ClinicSurge OS licensing", badge: "Potentially earlier",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    icon: Sparkles, highlight: true,
    pros: ["Lower clinical risk — licensing systems, not a clinic", "Scalable to many clinics quickly", "Recurring subscription income", "Builds a B2B product business running in parallel"],
    cons: ["Less brand visibility than a physical franchise", "Less direct control over clinical standards", "Requires a robust CRM and tech stack first"],
    bestFor: "Earlier B2B monetisation while physical franchising is still being planned.",
  },
];

const MARKET_EXAMPLES = [
  {
    name: "Laser Clinics UK / Australia",
    model: "Franchise/Partnership hybrid",
    description: "Often operates as a 50:50 partnership rather than a traditional franchise — the franchisor and franchisee share costs, revenue, and decisions. This tighter model gives more clinical control than a standard royalty arrangement.",
    lesson: "Their success comes from genuine partnership and central systems — not hands-off royalty collection.",
  },
  {
    name: "FACE FOUNDRIÉ",
    model: "Facial bar franchise (USA)",
    description: "A membership-led facial bar franchise in the US. Deliberately simplified the clinical offer — facials, peels, and skin treatments only, with no injectables. Lower clinical risk makes replication much simpler.",
    lesson: "Reducing clinical complexity dramatically reduces franchise risk.",
  },
  {
    name: "GLO30",
    model: "Skincare membership/franchise (USA)",
    description: "Monthly skincare subscription model with a franchise structure. Members pay a flat monthly fee for regular treatments. Memberships drive predictable recurring revenue, which is what makes the unit economics work.",
    lesson: "Membership models create the financial predictability that makes franchising viable.",
  },
  {
    name: "dermani MEDSPA",
    model: "Medspa franchise (USA)",
    description: "A US medspa franchise that includes injectables and medical treatments. Requires strict medical supervision and oversight infrastructure. Significantly more complex governance than skin/laser-only models.",
    lesson: "Injectable and medical services can be franchised — but the governance overhead is substantial.",
  },
  {
    name: "BodyBrite",
    model: "Laser & beauty franchise",
    description: "A lower-cost laser and beauty franchise model. Positioned at a more accessible price point with a focused treatment menu. Lower setup costs make it easier to attract franchisees.",
    lesson: "Simpler, lower-cost models recruit franchisees more easily — but margin per unit is also lower.",
  },
  {
    name: "Thérapie Clinic",
    model: "Company-owned multi-site",
    description: "Not a franchise — Thérapie operates all its clinics directly. This gives them tight clinical control and consistent patient experience across every location. Slower to scale but avoids brand risk entirely.",
    lesson: "Company-owned multi-site may be the right model for a nurse-led aesthetics brand where clinical quality is the core value proposition.",
  },
];

const GREEN_TREATMENTS = [
  { text: "Facials and facial treatments", plain: "Low clinical risk, no prescription involvement" },
  { text: "Skin consultations", plain: "Consultation-only, no procedural risk" },
  { text: "Chemical peels (superficial)", plain: "Well-documented protocols, manageable risk" },
  { text: "Microneedling", plain: "Clear protocols, not prescription-linked" },
  { text: "Retail skincare", plain: "No clinical risk" },
  { text: "Membership and package sales", plain: "Business model, no treatment risk" },
  { text: "Laser / IPL (where locally compliant)", plain: "Rules vary by nation — always check local regulation first" },
];

const AMBER_TREATMENTS = [
  { text: "Anti-wrinkle / botulinum toxin", plain: "Prescription-only medicine — requires registered prescriber and face-to-face consultation" },
  { text: "Dermal fillers", plain: "Significant complication risk — needs full prescriber governance from June 2025" },
  { text: "Skin boosters (e.g. Profhilo)", plain: "Injectable — prescriber governance required" },
  { text: "Polynucleotides", plain: "Newer injectable — evolving evidence base" },
  { text: "Advanced device treatments", plain: "Risk varies by device — check if CQC-registerable" },
  { text: "Prescription skin treatments", plain: "Tretinoin, prescription acids — remote prescribing no longer permissible from June 2025" },
];

const RED_TREATMENTS = [
  { text: "Anything requiring founder-level clinical judgement", plain: "If you have to be there to do it safely, it cannot yet be franchised" },
  { text: "Treatments without written protocols", plain: "Cannot be taught to others if the steps are not written down" },
  { text: "High-risk procedures without complication pathways", plain: "Vascular occlusion, serious adverse events — protocols must be documented before these are offered in any external site" },
  { text: "Treatments where compliance status is uncertain", plain: "If you're not sure whether it requires CQC registration in a given nation — do not include it yet" },
  { text: "Procedures only Abi is trained for", plain: "Any treatment that cannot currently be delivered by another qualified person in the team" },
];

const DEFAULT_MANUAL_READINESS: ManualReadinessItem[] = [
  { id: "r_clinicgov", label: "Clinical governance documented", desc: "Prescriber approval process, treatment authority matrix, complication pathways, incident reporting", done: false },
  { id: "r_supplier", label: "Supplier & product controls documented", desc: "Approved supplier list, batch/lot traceability, storage policy, audit rights", done: false },
  { id: "r_founder", label: "Founder dependency being reduced", desc: "A second practitioner can deliver treatments to the same standard without Abi present", done: false },
  { id: "r_marketing", label: "Marketing engine is repeatable", desc: "Google, social, CRM, referrals — someone other than Abi can run these", done: false },
  { id: "r_clinicsurge", label: "ClinicSurge OS documented and transferable", desc: "GHL/CRM setup, automations, lead handling, reporting — written down and teachable", done: false },
];

const DEFAULT_DECISION_GATE: ManualReadinessItem[] = [
  { id: "dg1", label: "Winchester trading profitably for 12+ months", desc: "Consistent net income after all costs — not just covering costs", done: false },
  { id: "dg2", label: "Second site or controlled pilot proven", desc: "A second location (company-owned or JV) is running and generating consistent revenue", done: false },
  { id: "dg3", label: "Founder not needed day-to-day at Winchester", desc: "Abi can be absent for a week without revenue impact", done: false },
  { id: "dg4", label: "Treatment outcomes audited across sites", desc: "Formal outcome and complication audit completed — results documented", done: false },
  { id: "dg5", label: "Full compliance file complete and current", desc: "CQC, prescribing compliance, GDPR, insurance, clinical governance — all current", done: false },
  { id: "dg6", label: "Repeatable lead generation proven", desc: "Google, social, and referral channels working without paid ads or founder-level hustle", done: false },
  { id: "dg7", label: "CRM and automations transferable to another site", desc: "ClinicSurge OS can be set up for a new location by someone other than Abi", done: false },
  { id: "dg8", label: "Team training system created", desc: "New practitioners can be onboarded to standard within 4 weeks", done: false },
  { id: "dg9", label: "Unit economics work after royalty and support costs", desc: "A franchisee's P&L is viable after paying royalty, levy, and support fees — not just break-even", done: false },
  { id: "dg10", label: "Franchise agreement drafted by specialist solicitor", desc: "Not adapted from a template — written by a bfa-accredited franchise solicitor", done: false },
  { id: "dg11", label: "Clinical governance reviewed by specialist adviser", desc: "A healthcare regulatory adviser (not just a franchise solicitor) has reviewed the clinical governance model", done: false },
];

const DEFAULT_TERRITORIES: Territory[] = [
  { id: "winch", name: "Winchester", type: "City", population: "45,000", status: "mother_clinic", note: "Original clinic — the proof of concept" },
  { id: "soton", name: "Southampton", type: "City", population: "250,000", status: "available", note: "" },
  { id: "bsng", name: "Basingstoke", type: "Town", population: "110,000", status: "available", note: "" },
  { id: "fare", name: "Fareham & Gosport", type: "Town", population: "120,000", status: "available", note: "" },
  { id: "chich", name: "Chichester", type: "City", population: "30,000", status: "available", note: "" },
];

const DEFAULT_OPS_MANUAL: ChecklistSection[] = [
  { id: "brand", title: "1. Brand & Identity", why: "Every clinic must look and feel identical to Winchester.", items: [
    { id: "o1", text: "Logo usage, brand colours, and typography rules", plain: "Exact brand standards so every clinic looks the same", done: false },
    { id: "o2", text: "Tone of voice guidelines for all communications", plain: "What sounds like Abi Peters Aesthetics and what doesn't", done: false },
    { id: "o3", text: "Treatment menu naming and pricing framework", plain: "What every treatment is called and how prices are set across the network", done: false },
    { id: "o4", text: "Photography and social media standards", plain: "What photos should look like — style, lighting, what not to post", done: false },
  ]},
  { id: "clinical", title: "2. Clinical Operations & Governance", why: "The most important section — patient safety and brand reputation depend on this.", items: [
    { id: "o5", text: "Treatment protocols for every approved treatment", plain: "Step-by-step instructions so every practitioner does it the same way", done: false },
    { id: "o6", text: "Consent form templates (GDPR-compliant)", plain: "Forms clients sign before treatment — legally required and written correctly", done: false },
    { id: "o7", text: "Aftercare guidance per treatment", plain: "What to tell clients after each treatment — do's and don'ts", done: false },
    { id: "o8", text: "Complication management protocols", plain: "What to do if something goes wrong — critical for safety", done: false },
    { id: "o9", text: "Prescribing and safe storage policy", plain: "How to handle prescription-only products legally (botulinum toxin, fillers)", done: false },
    { id: "o10", text: "Prescriber approval and treatment authority matrix", plain: "Who is authorised to do what — and the process for approving a new prescriber", done: false },
    { id: "o11", text: "Incident reporting and complication pathway", plain: "How to record and escalate anything that goes wrong", done: false },
  ]},
  { id: "compliance", title: "3. Regulatory Compliance", why: "Each UK nation has different rules. Every site in the network must be independently compliant.", items: [
    { id: "o12", text: "CQC registration guide (England)", plain: "How to register with the CQC before opening — applicable where regulated activities are carried out", done: false },
    { id: "o13", text: "Nation-specific compliance notes (Scotland, Wales, NI)", plain: "Laser/IPL and non-surgical cosmetics rules differ by nation — must be checked per location", done: false },
    { id: "o14", text: "Licensing regime update tracker", plain: "England is moving toward a licensing regime for non-surgical cosmetics — this must stay current", done: false },
    { id: "o15", text: "Marketing compliance guide — prescribing rules", plain: "Prescription-only medicines cannot be advertised directly to the public. Use 'anti-wrinkle consultations', not 'Botox'.", done: false },
    { id: "o16", text: "Data protection and GDPR policy", plain: "How to handle client data — legally required for all locations", done: false },
  ]},
  { id: "booking", title: "4. Booking, Reception & Client Experience", why: "How clients are handled shapes their experience — it must be consistent across every location.", items: [
    { id: "o17", text: "Booking software configuration guide", plain: "How to set up the booking system correctly", done: false },
    { id: "o18", text: "Phone and online enquiry scripts", plain: "What to say when someone calls or messages", done: false },
    { id: "o19", text: "Pricing policy and discount rules", plain: "What's on the price list and when discounts are allowed", done: false },
    { id: "o20", text: "Refund and complaints procedure", plain: "What to do if a client is unhappy — handled the same way everywhere", done: false },
  ]},
  { id: "hr", title: "5. Staff, Hiring & Training", why: "Franchisees hire their own staff — your standards must be hireable.", items: [
    { id: "o21", text: "Job descriptions and qualification minimums", plain: "What qualifications and experience each role requires", done: false },
    { id: "o22", text: "Induction and mandatory training checklist", plain: "Everything a new team member must complete before treating clients", done: false },
    { id: "o23", text: "Mandatory re-certification schedule", plain: "How often practitioners must be re-certified and by whom", done: false },
    { id: "o24", text: "Insurance requirements per role", plain: "Minimum indemnity insurance levels for practitioners and the clinic", done: false },
  ]},
  { id: "finance", title: "6. Finance, Reporting & Royalties", why: "You need accurate revenue data from every franchisee to collect royalties and spot problems early.", items: [
    { id: "o25", text: "Monthly revenue reporting format and deadline", plain: "A simple monthly report showing their income — sent to you", done: false },
    { id: "o26", text: "Royalty calculation and payment process", plain: "Exactly how and when they report revenue and pay your percentage", done: false },
    { id: "o27", text: "Approved supplier purchasing policy", plain: "They must buy products from your approved list — protecting quality and your negotiated pricing", done: false },
    { id: "o28", text: "Batch/lot traceability records", plain: "Required for injectables — which product, which batch, which client", done: false },
  ]},
  { id: "marketing", title: "7. Marketing & Growth", why: "Franchise marketing must stay on-brand and legally compliant — especially around prescribable treatments.", items: [
    { id: "o29", text: "90-day local launch marketing plan", plain: "Step-by-step marketing plan for their first 3 months", done: false },
    { id: "o30", text: "Google review strategy", plain: "How to ask clients for reviews — the most important growth lever", done: false },
    { id: "o31", text: "Social media approval process", plain: "Whether franchisees need your sign-off before posting about treatments", done: false },
    { id: "o32", text: "Prescribing marketing rules", plain: "Prescription-only medicines cannot be advertised to the public. Use service-led language at all times.", done: false },
  ]},
];

const DEFAULT_LEGAL: ChecklistSection[] = [
  { id: "foundations", title: "Prerequisites — before any legal work begins", why: "Legal documents are only useful if the business they describe is proven and documented.", items: [
    { id: "l1", text: "Winchester trading profitably for 12+ months", plain: "You must prove the model works before selling it to others", done: false },
    { id: "l2", text: "Business name and logo registered as a UK trademark (UKIPO)", plain: "Protect 'Abi Peters Aesthetics' so no one else can legally copy it", done: false },
    { id: "l3", text: "Full operations manual drafted and reviewed", plain: "The rulebook must exist before you can legally describe what a franchisee receives", done: false },
    { id: "l4", text: "Clinical governance manual drafted separately from ops manual", plain: "Clinical standards and prescribing governance need their own standalone document", done: false },
    { id: "l5", text: "Accountants briefed on franchise income structure", plain: "Franchise fees and royalties are taxed differently from clinic income", done: false },
  ]},
  { id: "core-docs", title: "Core legal documents (franchise solicitor required)", why: "Do not adapt a standard business contract. These are specialist documents — use a bfa-accredited franchise solicitor.", items: [
    { id: "l6", text: "Franchise agreement", plain: "The main contract covering everything a franchisee can and cannot do", done: false },
    { id: "l7", text: "Franchise disclosure document (FDD)", plain: "A document you give prospects before they sign — legally required to be accurate and fair", done: false },
    { id: "l8", text: "Territory protection clauses", plain: "Written into the contract — this franchisee owns this postcode area, no other Abi Peters clinic can open nearby", done: false },
    { id: "l9", text: "Termination, step-in, and suspension rights", plain: "Your right to step in, suspend, or terminate if a franchisee breaches standards — critical for clinical safety", done: false },
    { id: "l10", text: "Exit and debranding process", plain: "What happens when a franchisee leaves — how they rebrand and hand back systems", done: false },
    { id: "l11", text: "Audit rights clause", plain: "Your right to inspect their books and clinic at any time — essential for royalty accuracy and quality control", done: false },
  ]},
  { id: "clinical-legal", title: "Clinical & compliance documents", why: "These are additional to the main franchise agreement — aesthetics franchising needs a separate clinical layer.", items: [
    { id: "l12", text: "Clinical governance manual approved by a specialist adviser", plain: "A healthcare regulatory specialist (not just a franchise solicitor) should review this", done: false },
    { id: "l13", text: "Marketing compliance manual", plain: "Written rules on how franchisees market prescribable treatments — prevents illegal advertising", done: false },
    { id: "l14", text: "Approved prescriber and supplier process", plain: "How new prescribers are approved, how suppliers are added to the approved list", done: false },
    { id: "l15", text: "Insurance minimums per franchisee", plain: "Minimum indemnity and public liability insurance levels written into the agreement", done: false },
    { id: "l16", text: "Data protection / DPIA completed", plain: "Data Protection Impact Assessment — required when sharing patient data across network", done: false },
    { id: "l17", text: "Complaint and incident process", plain: "How complaints and clinical incidents are reported to you as franchisor — and your response obligations", done: false },
  ]},
  { id: "recruitment-ongoing", title: "Recruitment & ongoing network management", why: "Choosing the right franchisees and managing them well is as important as the legal documents.", items: [
    { id: "l18", text: "Franchise prospectus / information memorandum", plain: "A document you give to serious applicants explaining what they get and what it costs", done: false },
    { id: "l19", text: "Franchisee selection criteria documented", plain: "Clinical background, business experience, financial capacity — what makes an ideal Abi Peters franchisee", done: false },
    { id: "l20", text: "Discovery day process designed", plain: "A visit to Winchester for serious applicants to see the real clinic before deciding", done: false },
    { id: "l21", text: "Franchisee code of conduct and brand standards", plain: "Written behavioural expectations — what they can and cannot do as an Abi Peters franchisee", done: false },
    { id: "l22", text: "Consider bfa membership", plain: "The British Franchise Association adds credibility and helps attract higher quality franchisees", done: false },
  ]},
];

// ─── Components ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? "#3a7a6a" : score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

function PlainEnglish({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 dark:bg-amber-950/20 dark:border-amber-800">
      <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{children}</p>
    </div>
  );
}

function TabIntro({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-sm font-semibold text-primary mb-0.5">{heading}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function ManualCheckRow({ item, onToggle }: { item: ManualReadinessItem; onToggle: () => void }) {
  return (
    <div className="flex items-start gap-3 cursor-pointer group py-1" onClick={onToggle}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
      }`}>
        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <div>
        <p className={`text-sm font-medium leading-snug ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FranchisePage() {
  const [tab, setTab] = useState<TabKey>("strategy");
  const [assumptions, setAssumptions] = useState<FranchiseAssumptions>(DEFAULT_ASSUMPTIONS);
  const [investmentType, setInvestmentType] = useState<InvestmentTypeKey>("full");
  const [revenueScenario, setRevenueScenario] = useState<ScenarioKey>("base");
  const [supportCostKey, setSupportCostKey] = useState<SupportCostKey>("base");
  const [unitCount, setUnitCount] = useState<1 | 3 | 5 | 10>(3);
  const [territories, setTerritories] = useState<Territory[]>(DEFAULT_TERRITORIES);
  const [opsManual, setOpsManual] = useState<ChecklistSection[]>(DEFAULT_OPS_MANUAL);
  const [legalChecklist, setLegalChecklist] = useState<ChecklistSection[]>(DEFAULT_LEGAL);
  const [manualReadiness, setManualReadiness] = useState<ManualReadinessItem[]>(DEFAULT_MANUAL_READINESS);
  const [decisionGate, setDecisionGate] = useState<ManualReadinessItem[]>(DEFAULT_DECISION_GATE);
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [introOpen, setIntroOpen] = useState(false);

  // ─── API data ────────────────────────────────────────────────────────────
  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, { query: { queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) } });
  const { data: model }     = useGetFinancialModel(PROJECT_ID,     { query: { queryKey: getGetFinancialModelQueryKey(PROJECT_ID) } });
  const { data: properties } = useListProperties(PROJECT_ID,       { query: { queryKey: getListPropertiesQueryKey(PROJECT_ID) } });
  const { data: compliance } = useGetComplianceSummary(PROJECT_ID,  { query: { queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) } });
  const { data: decisions }  = useListDecisions(PROJECT_ID, {},     { query: { queryKey: getListDecisionsQueryKey(PROJECT_ID, {}) } });

  const activeProperty   = properties?.find(p => p.isActiveForProject);
  const m                = model as any;
  const complianceScore  = compliance?.overallScore ?? 0;
  const totalTasks       = dashboard?.totalTaskCount ?? 0;
  const completedTasks   = dashboard?.completedTaskCount ?? 0;
  const decisionsCount   = decisions?.length ?? 0;
  const launchReadiness  = dashboard?.launchReadinessPercent ?? 0;

  // ─── Revenue scenarios ────────────────────────────────────────────────────
  const revenueByScenario = useMemo(() => {
    if (!m) return { low: 0, base: 0, high: 0 };
    const rooms = m.treatmentRoomsCount || 2;
    const hours = m.practitionerHoursPerDay || 7;
    const days  = m.workingDaysPerMonth || 22;
    const acv   = m.wincAcvGbp || 155;
    const slots = rooms * hours * days * 1.4;
    return {
      low:  Math.round(slots * 0.40 * acv),
      base: Math.round(slots * 0.65 * acv),
      high: Math.round(slots * 0.85 * acv),
    };
  }, [m]);

  const monthlyRevenue = revenueByScenario[revenueScenario];

  const monthlyFixedCosts = useMemo(() => {
    if (!m) return 2500;
    return ['rentGbp','ratesGbp','utilitiesGbp','internetGbp','insuranceGbp',
      'accountantGbp','softwareGbp','wasteContractGbp','cleanerGbp',
      'subscriptionsGbp','financeRepaymentsGbp']
      .reduce((s: number, k: string) => s + (Number(m[k]) || 0), 0);
  }, [m]);

  // ─── Ops/legal completion ─────────────────────────────────────────────────
  const opsCompletion = useMemo(() => {
    const all = opsManual.flatMap(s => s.items);
    return all.length ? Math.round(all.filter(i => i.done).length / all.length * 100) : 0;
  }, [opsManual]);

  const legalCompletion = useMemo(() => {
    const all = legalChecklist.flatMap(s => s.items);
    return all.length ? Math.round(all.filter(i => i.done).length / all.length * 100) : 0;
  }, [legalChecklist]);

  const decisionGateDone = decisionGate.filter(i => i.done).length;

  // ─── Readiness score (11 dimensions) ────────────────────────────────────
  const readinessDims = useMemo(() => {
    const taskPct     = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);
    const finModel    = m && (m.rentGbp > 0 || m.wincAcvGbp > 100) ? Math.min(60 + launchReadiness / 3, 90) : 5;
    const propScore   = activeProperty ? 100 : 0;
    const cqcScore    = complianceScore;
    const mktgScore   = (m?.marketingGbp ?? 0) > 0 ? 75 : 5;
    const decisScore  = Math.min(decisionsCount * 12, 100);
    return [
      { id: "tasks",      label: "Winchester clinic proven",            desc: `${completedTasks}/${totalTasks} launch tasks done`,              score: taskPct,    weight: 15, live: true,  icon: CheckCircle2 },
      { id: "finance",    label: "Financial model proven",              desc: "Costs, revenue, and targets populated",                           score: finModel,   weight: 15, live: true,  icon: PoundSterling },
      { id: "property",   label: "Location secured",                    desc: activeProperty ? (activeProperty.address ?? "Property selected") : "No property selected", score: propScore, weight: 10, live: true, icon: Building2 },
      { id: "cqc",        label: "Compliance completed",                desc: `CQC & regulatory compliance ${cqcScore}%`,                        score: cqcScore,   weight: 10, live: true,  icon: Shield },
      { id: "ops",        label: "Operations manual complete",          desc: `Rulebook ${opsCompletion}% done`,                                  score: opsCompletion, weight: 10, live: true, icon: BookOpen },
      { id: "clinicgov",  label: "Clinical governance documented",      desc: manualReadiness.find(r => r.id === "r_clinicgov")?.done ? "Documented" : "Not yet documented",  score: manualReadiness.find(r => r.id === "r_clinicgov")?.done ? 100 : 0,  weight: 10, live: false, icon: Shield },
      { id: "supplier",   label: "Supplier & product controls",         desc: manualReadiness.find(r => r.id === "r_supplier")?.done ? "Documented" : "Not yet documented",    score: manualReadiness.find(r => r.id === "r_supplier")?.done ? 100 : 0,   weight: 8,  live: false, icon: Star },
      { id: "marketing",  label: "Marketing engine repeatable",         desc: mktgScore >= 70 ? "Marketing budget set" : "Not yet automated",      score: Math.max(mktgScore, manualReadiness.find(r => r.id === "r_marketing")?.done ? 80 : 5), weight: 7, live: false, icon: TrendingUp },
      { id: "founder",    label: "Founder dependency being reduced",    desc: manualReadiness.find(r => r.id === "r_founder")?.done ? "In progress" : "Not yet addressed",     score: manualReadiness.find(r => r.id === "r_founder")?.done ? 60 : 0,    weight: 10, live: false, icon: Users },
      { id: "decisions",  label: "Decisions & risks logged",            desc: `${decisionsCount} decision${decisionsCount !== 1 ? "s" : ""} on record`, score: decisScore, weight: 5, live: true, icon: AlertTriangle },
      { id: "clinicsurge",label: "ClinicSurge OS transferable",         desc: manualReadiness.find(r => r.id === "r_clinicsurge")?.done ? "Documented" : "Not yet documented", score: manualReadiness.find(r => r.id === "r_clinicsurge")?.done ? 100 : 0, weight: 10, live: false, icon: Sparkles },
    ];
  }, [completedTasks, totalTasks, launchReadiness, m, activeProperty, complianceScore, opsCompletion, decisionsCount, manualReadiness]);

  const overallReadiness = useMemo(() => {
    const totalWeight = readinessDims.reduce((s, d) => s + d.weight, 0);
    const weighted    = readinessDims.reduce((s, d) => s + (d.score * d.weight / 100), 0);
    return Math.round((weighted / totalWeight) * 100);
  }, [readinessDims]);

  const readinessLabel = overallReadiness >= 85
    ? { text: "Franchise evaluation ready",  color: "text-primary",      bg: "bg-primary/10" }
    : overallReadiness >= 70
    ? { text: "Pilot / JV ready",            color: "text-emerald-700",  bg: "bg-emerald-50 dark:bg-emerald-950/30" }
    : overallReadiness >= 40
    ? { text: "Operating system stage",      color: "text-amber-700",    bg: "bg-amber-50 dark:bg-amber-950/30" }
    : { text: "Foundation stage",            color: "text-destructive",  bg: "bg-destructive/5" };

  // ─── Income calculations ──────────────────────────────────────────────────
  const monthlyRoyalty     = Math.round(monthlyRevenue * (assumptions.royaltyPercent / 100));
  const monthlyLevy        = Math.round(monthlyRevenue * (assumptions.marketingLevyPercent / 100));
  const monthlyGrossPerUnit = monthlyRoyalty + monthlyLevy + assumptions.techSupportMonthlyGbp;
  const supportCostPerUnit  = SUPPORT_COSTS[supportCostKey].value;
  const monthlyNetPerUnit   = monthlyGrossPerUnit - supportCostPerUnit;
  const annualNetPerUnit    = monthlyNetPerUnit * 12;

  // ─── Toggle helpers ───────────────────────────────────────────────────────
  function toggleOps(sId: string, iId: string) {
    setOpsManual(p => p.map(s => s.id !== sId ? s : { ...s, items: s.items.map(i => i.id === iId ? { ...i, done: !i.done } : i) }));
  }
  function toggleLegal(sId: string, iId: string) {
    setLegalChecklist(p => p.map(s => s.id !== sId ? s : { ...s, items: s.items.map(i => i.id === iId ? { ...i, done: !i.done } : i) }));
  }
  function toggleManualReadiness(id: string) {
    setManualReadiness(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }
  function toggleDecisionGate(id: string) {
    setDecisionGate(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }
  function addTerritory() {
    if (!newTerritoryName.trim()) return;
    setTerritories(p => [...p, { id: Date.now().toString(), name: newTerritoryName.trim(), type: "Town", population: "—", status: "available", note: "" }]);
    setNewTerritoryName("");
  }
  function cycleTerritoryStatus(id: string) {
    const cycle: Territory["status"][] = ["available", "reserved", "sold"];
    setTerritories(p => p.map(t => {
      if (t.status === "mother_clinic") return t;
      const idx = cycle.indexOf(t.status);
      return { ...t, status: cycle[(idx + 1) % cycle.length] };
    }).map(t => t.id === id && t.status !== "mother_clinic" ? t : t));
    setTerritories(p => p.map(t => {
      if (t.id !== id || t.status === "mother_clinic") return t;
      const cycle: Territory["status"][] = ["available", "reserved", "sold"];
      const idx = cycle.indexOf(t.status);
      return { ...t, status: cycle[(idx + 1) % cycle.length] };
    }));
  }

  const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "strategy",    label: "Strategy First",   icon: Sparkles },
    { key: "readiness",   label: "Are We Ready?",    icon: CheckCircle2 },
    { key: "investment",  label: "Investment",        icon: PoundSterling },
    { key: "income",      label: "What You Earn",    icon: TrendingUp },
    { key: "treatments",  label: "Treatments",        icon: Shield },
    { key: "territory",   label: "Territories",       icon: MapPin },
    { key: "operations",  label: "Rulebook",          icon: BookOpen },
    { key: "legal",       label: "Legal Steps",       icon: Shield },
  ];

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-500">
      <PageHeader
        title="Franchise Model"
        subtitle="A strategic planning tool for the future — not a plan to act on today."
      />

      {/* ─── Main recommendation card ────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-1">Current recommendation</p>
            <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
              Do not sell franchises yet. Build Winchester first, document the operating system, prove the numbers, then choose the safest scaling model. Franchising is a possible future route — not the current plan.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-2 leading-relaxed">
              Winchester must first become a profitable, repeatable clinic that works without founder dependency. That comes before any conversation about franchising.
            </p>
          </div>
        </div>
      </div>

      {/* ─── What is a franchise? collapsible ───────────────────────────── */}
      <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setIntroOpen(o => !o)}>
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">What is a franchise? — Start here if this is new to you</span>
          </div>
          {introOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {introOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-border/50 pt-4">
            <p className="text-sm text-muted-foreground leading-relaxed">A franchise is when you let someone else open a copy of your business using your name, brand, and systems — in exchange for an upfront fee and a monthly percentage of their revenue. Think McDonald's, Anytime Fitness, or Toni&Guy. The original owner didn't open every location — they licensed others to do it.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { term: "Franchisor", def: "You — the brand owner who sells the right to copy your clinic" },
                { term: "Franchisee", def: "The person who pays to open their own version of your clinic" },
                { term: "Franchise fee", def: "The upfront joining fee paid to you — typically £15,000–£35,000" },
                { term: "Royalty", def: "Your monthly cut — a % of what each franchisee earns, e.g. 6% of their revenue" },
                { term: "Territory", def: "The geographic area one franchisee owns exclusively" },
                { term: "JV / Joint venture", def: "A 50:50 partnership — you both own the second clinic together" },
              ].map(({ term, def }) => (
                <div key={term} className="flex gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                  <span className="font-semibold text-foreground shrink-0">{term}:</span>
                  <span className="text-muted-foreground">{def}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ STRATEGY FIRST ══════════════ */}
      {tab === "strategy" && (
        <div className="space-y-6">
          <TabIntro
            heading="The honest strategy question: what is the best way to scale?"
            body="Franchising is one option. It is not the only option, and may not be the best one for a nurse-led aesthetics clinic. Here is an honest comparison of the four realistic routes."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCALE_ROUTES.map(route => (
              <Card key={route.id} className={`shadow-sm border ${route.highlight ? "border-primary/30" : "border-border/60"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <route.icon className="w-4 h-4 text-primary shrink-0" />
                      <CardTitle className="text-sm">{route.title}</CardTitle>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${route.badgeColor}`}>{route.badge}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Advantages</p>
                    <ul className="space-y-1">
                      {route.pros.map(p => <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Watch-outs</p>
                    <ul className="space-y-1">
                      {route.cons.map(c => <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{c}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Best for</p>
                    <p className="text-xs text-foreground">{route.bestFor}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Suggested sequence */}
          <Card className="shadow-sm border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-primary">Recommended sequence for Abi Peters Aesthetics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { n: "1", text: "Prove Winchester", detail: "Get it profitable, compliant, and running without founder dependency" },
                  { n: "2", text: "Open a second company-owned or JV site", detail: "Prove the model can be replicated with someone other than Abi running it" },
                  { n: "3", text: "Build ClinicSurge OS as a B2B product", detail: "Systemise the marketing, CRM, and launch tools while the clinics prove the model" },
                  { n: "4", text: "Pilot a JV/partnership unit", detail: "First external operator — closely managed, shared ownership, tight oversight" },
                  { n: "5", text: "Evaluate classic franchise rollout", detail: "Only once there are 2+ proven sites, a full operating system, and specialist legal advice" },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
                    <div>
                      <p className="text-sm font-semibold">{step.text}</p>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market examples */}
          <div>
            <h3 className="text-sm font-semibold mb-1">How others have scaled aesthetics businesses</h3>
            <p className="text-xs text-muted-foreground mb-3">These are not direct templates to copy — they show the range of models that exist and what each one requires.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MARKET_EXAMPLES.map(ex => (
                <Card key={ex.name} className="shadow-sm border-border/60">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div>
                      <p className="text-sm font-semibold">{ex.name}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ex.model}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ex.description}</p>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-2">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">Key lesson</p>
                      <p className="text-xs text-foreground">{ex.lesson}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <PlainEnglish>
              Scalable aesthetics models almost always do one of three things: <strong>simplify the clinical offer</strong> (fewer high-risk treatments), <strong>centralise the systems tightly</strong> (tech, governance, marketing), or <strong>retain stronger ownership control</strong> (JV/partnership rather than light-touch franchise). The more clinical the offer, the more control you need.
            </PlainEnglish>
          </div>

          {/* Strategic conclusion */}
          <Card className="shadow-sm border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-800 dark:text-purple-300">
                <Sparkles className="w-4 h-4" />
                The bigger picture: ClinicSurge OS may be the higher-value asset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-800 dark:text-purple-300 leading-relaxed mb-3">
                The real asset being built here may not be a franchise network. It may be the operating system itself — the marketing engine, lead handling, CRM, patient journey, reporting, pricing, retention, and launch management built around Abi Peters Aesthetics.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {["GHL/CRM setup and automations", "Lead handling and patient conversion", "Reporting and analytics", "Marketing systems and content", "Launch planning and territory setup", "Retention workflows and memberships"].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-400">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />{item}
                  </div>
                ))}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-400 leading-relaxed">
                <strong>Winchester should be used to prove the clinic model.</strong> ClinicSurge OS could then become the scalable B2B product — licensed to other aesthetics clinics across the UK — while physical franchising remains a later-stage option with a stronger evidence base behind it.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════ READINESS ══════════════ */}
      {tab === "readiness" && (
        <div className="space-y-6">
          <TabIntro
            heading="How ready is the Winchester model to be replicated?"
            body="This score tracks eleven things that must be true before any external expansion makes sense. Live data is pulled from the rest of the app — manual items you tick off yourself."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm border-border/60 flex flex-col items-center justify-center py-8">
              <div className="relative">
                <ScoreRing score={overallReadiness} size={140} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{overallReadiness}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100</span>
                </div>
              </div>
              <div className={`mt-4 px-3 py-1 rounded-full text-xs font-semibold ${readinessLabel.bg} ${readinessLabel.color}`}>{readinessLabel.text}</div>
              <div className="mt-4 space-y-1 text-center px-4">
                {[
                  { threshold: "0–39", label: "Foundation stage", active: overallReadiness < 40 },
                  { threshold: "40–69", label: "Operating system stage", active: overallReadiness >= 40 && overallReadiness < 70 },
                  { threshold: "70–84", label: "Pilot / JV ready", active: overallReadiness >= 70 && overallReadiness < 85 },
                  { threshold: "85+", label: "Franchise evaluation ready", active: overallReadiness >= 85 },
                ].map(s => (
                  <div key={s.threshold} className={`text-[10px] px-2 py-0.5 rounded ${s.active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                    {s.threshold} — {s.label}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="shadow-sm border-border/60 col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">The eleven dimensions</CardTitle>
                <p className="text-xs text-muted-foreground">Live items update automatically. Manual items — tick when you've completed them.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {readinessDims.map(dim => (
                  <div key={dim.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <dim.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{dim.label}</span>
                        {!dim.live && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">manual</span>}
                      </div>
                      <span className={`text-xs font-semibold ${dim.score >= 70 ? "text-primary" : dim.score >= 40 ? "text-amber-600" : "text-destructive"}`}>{dim.score}%</span>
                    </div>
                    <Progress value={dim.score} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{dim.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Manual readiness items */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Manual items — tick these off as you complete them</CardTitle>
              <p className="text-xs text-muted-foreground">These can't be computed automatically — you need to mark them done yourself</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {manualReadiness.map(item => (
                <ManualCheckRow key={item.id} item={item} onToggle={() => toggleManualReadiness(item.id)} />
              ))}
            </CardContent>
          </Card>

          {/* Decision gate */}
          <Card className="shadow-sm border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  When would we actually consider franchising?
                </CardTitle>
                <span className="text-xs text-amber-700 dark:text-amber-500 font-medium">{decisionGateDone}/{decisionGate.length} ready</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-500">All eleven of these should be true before any franchise conversation begins.</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {decisionGate.map(item => (
                <ManualCheckRow key={item.id} item={item} onToggle={() => toggleDecisionGate(item.id)} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════ INVESTMENT ══════════════ */}
      {tab === "investment" && (
        <div className="space-y-6">
          <TabIntro
            heading="What does it cost a franchisee to open?"
            body="This is the total capital they need to find — from savings, a bank loan, or investors. The honest answer is: it depends heavily on what kind of clinic they're opening."
          />
          <PlainEnglish>
            The investment required is <strong>not a single number</strong>. A skin and laser studio with no injectables costs fundamentally less to set up and govern than a full medical aesthetics clinic. Be honest about which type your franchise would be — and price accordingly.
          </PlainEnglish>

          {/* Clinic type selector */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">What type of clinic would franchisees open?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(INVESTMENT_TYPES) as [InvestmentTypeKey, typeof INVESTMENT_TYPES[InvestmentTypeKey]][]).map(([key, type]) => (
                <div key={key} onClick={() => setInvestmentType(key)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${investmentType === key ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${investmentType === key ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Range</p>
                    <p className="text-sm font-bold text-primary">{formatGBP(type.low)}–{formatGBP(type.high)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Assumptions + breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Your fee assumptions</CardTitle>
                <p className="text-xs text-muted-foreground">Adjust these — they affect what a franchisee pays you directly</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: "franchiseFeeGbp",     label: "Franchise fee (£)",              hint: "Upfront joining fee. Typical range: £15,000–£35,000",     min: 0, step: 1000 },
                  { key: "trainingCostGbp",      label: "Training fee (£)",              hint: "Your charge for the initial onboarding programme",          min: 0, step: 500 },
                  { key: "legalSetupGbp",        label: "Franchisee legal estimate (£)", hint: "Their own solicitor's cost to review your agreement",       min: 0, step: 500 },
                  { key: "workingCapitalMonths", label: "Cash buffer (months)",           hint: "Months of running costs they must hold in reserve",        min: 1, step: 1 },
                ] as { key: keyof FranchiseAssumptions; label: string; hint: string; min: number; step: number }[]).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input type="number" className="mt-1 h-8 text-sm" min={f.min} step={f.step}
                      value={assumptions[f.key]}
                      onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Estimated total investment — {INVESTMENT_TYPES[investmentType].label}</CardTitle>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Illustrative only</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="col-start-2 text-center">Low</span>
                  <span className="text-center">High</span>
                </div>
                {[
                  { label: "Fit-out & equipment", low: INVESTMENT_TYPES[investmentType].low, high: INVESTMENT_TYPES[investmentType].high, plain: "Building the rooms and buying all equipment" },
                  { label: "Property deposit (3 months)", low: (m?.rentGbp ?? 2700) * 3, high: (m?.rentGbp ?? 2700) * 3, plain: "Most landlords require this upfront" },
                  { label: "Franchise fee — paid to you", low: assumptions.franchiseFeeGbp, high: assumptions.franchiseFeeGbp, plain: "Paid to you on signing" },
                  { label: "Training — paid to you", low: assumptions.trainingCostGbp, high: assumptions.trainingCostGbp, plain: "Covers your time training them" },
                  { label: "Franchisee legal costs", low: assumptions.legalSetupGbp, high: assumptions.legalSetupGbp + 2000, plain: "Their own solicitor's review" },
                  { label: "Working capital", low: monthlyFixedCosts * assumptions.workingCapitalMonths, high: monthlyFixedCosts * assumptions.workingCapitalMonths * 1.3, plain: `${assumptions.workingCapitalMonths} months of running costs in reserve` },
                  { label: "Contingency", low: Math.round(INVESTMENT_TYPES[investmentType].low * 0.10), high: Math.round(INVESTMENT_TYPES[investmentType].high * 0.10), plain: "Things always cost more than planned" },
                ].map(line => (
                  <div key={line.label} className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 last:border-0 items-start">
                    <div>
                      <p className="text-sm font-medium">{line.label}</p>
                      <p className="text-[10px] text-muted-foreground">{line.plain}</p>
                    </div>
                    <span className="text-sm font-semibold text-center tabular-nums">{formatGBP(line.low)}</span>
                    <span className="text-sm font-semibold text-center tabular-nums">{formatGBP(line.high)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm font-bold">Total range</p>
                    <p className="text-xs text-muted-foreground">Per franchised clinic</p>
                  </div>
                  <span className="text-lg font-bold text-primary text-center tabular-nums">
                    {formatGBP(INVESTMENT_TYPES[investmentType].low + (m?.rentGbp ?? 2700) * 3 + assumptions.franchiseFeeGbp + assumptions.trainingCostGbp + assumptions.legalSetupGbp + monthlyFixedCosts * assumptions.workingCapitalMonths + Math.round(INVESTMENT_TYPES[investmentType].low * 0.1))}
                  </span>
                  <span className="text-lg font-bold text-primary text-center tabular-nums">
                    {formatGBP(INVESTMENT_TYPES[investmentType].high + (m?.rentGbp ?? 2700) * 3 + assumptions.franchiseFeeGbp + assumptions.trainingCostGbp + assumptions.legalSetupGbp + 2000 + Math.round(monthlyFixedCosts * assumptions.workingCapitalMonths * 1.3) + Math.round(INVESTMENT_TYPES[investmentType].high * 0.1))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════ INCOME ══════════════ */}
      {tab === "income" && (
        <div className="space-y-6">
          <TabIntro
            heading="What would you earn from each franchisee?"
            body="Royalty income is not pure profit. You must also fund the support, compliance, legal, audit, and management overhead of running a franchise network. This tab shows gross income and estimated net contribution."
          />

          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Important: royalty is not your profit</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">From every pound of royalty income you must pay for: franchisee support calls, training refreshes, compliance audits, legal disputes, central marketing management, software and tools, and unexpected operational issues. The net contribution per franchisee is significantly lower than the headline royalty figure.</p>
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Revenue scenario & your rates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Revenue scenario</Label>
                  <div className="flex gap-1 mt-1">
                    {(["low", "base", "high"] as ScenarioKey[]).map(s => (
                      <button key={s} onClick={() => setRevenueScenario(s)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${revenueScenario === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                        {s === "low" ? "Low (40% occ)" : s === "base" ? "Base (65%)" : "High (85%)"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Franchisee clinic revenue: <strong>{formatGBP(monthlyRevenue)}/mo</strong></p>
                </div>
                {([
                  { key: "royaltyPercent",        label: "Royalty rate (%)",              hint: "Typical range: 5–8%",                  min: 0, max: 20, step: 0.5 },
                  { key: "marketingLevyPercent",   label: "Marketing levy (%)",            hint: "Typical range: 1–3%",                  min: 0, max: 10, step: 0.5 },
                  { key: "techSupportMonthlyGbp",  label: "Tech & support fee (£/mo)",     hint: "Flat monthly fee per franchisee",       min: 0, step: 50 },
                ] as { key: keyof FranchiseAssumptions; label: string; hint: string; min: number; max?: number; step: number }[]).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input type="number" className="mt-1 h-8 text-sm" min={f.min} max={f.max} step={f.step}
                      value={assumptions[f.key]}
                      onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Per-clinic monthly income — gross vs net</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Gross income from franchisee</p>
                  {[
                    { label: `Royalty (${assumptions.royaltyPercent}% of ${formatGBP(monthlyRevenue)})`, value: monthlyRoyalty },
                    { label: `Marketing levy (${assumptions.marketingLevyPercent}%)`,                     value: monthlyLevy },
                    { label: "Tech & support subscription",                                               value: assumptions.techSupportMonthlyGbp },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm">{row.label}</span>
                      <span className="text-sm font-semibold">{formatGBP(row.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-semibold">Gross income per clinic/month</span>
                    <span className="text-base font-bold">{formatGBP(monthlyGrossPerUnit)}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Estimated franchisor support cost</p>
                  <div className="flex gap-1 mb-2">
                    {(["low", "base", "high"] as SupportCostKey[]).map(k => (
                      <button key={k} onClick={() => setSupportCostKey(k)}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${supportCostKey === k ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                        {SUPPORT_COSTS[k].label.split(" ")[0]}<br/>{formatGBP(SUPPORT_COSTS[k].value)}/mo
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Covers: support calls, audits, compliance, legal, marketing management, training refreshes</p>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="text-sm">Less: franchisor support cost</span>
                    <span className="text-sm font-semibold text-destructive">-{formatGBP(supportCostPerUnit)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-semibold">Estimated net contribution/month</span>
                    <span className={`text-base font-bold ${monthlyNetPerUnit >= 0 ? "text-primary" : "text-destructive"}`}>{formatGBP(monthlyNetPerUnit)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">That's ~{formatGBP(annualNetPerUnit)}/year net per active franchisee</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scale table */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm">Scale projections — illustrative only</CardTitle>
                  <p className="text-xs text-muted-foreground">These are estimates to inform planning — not guaranteed income figures</p>
                </div>
                <div className="flex gap-1">
                  {([1, 3, 5, 10] as const).map(n => (
                    <button key={n} onClick={() => setUnitCount(n)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${unitCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {n} clinic{n !== 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {([1, 3, 5, 10] as const).map(n => {
                  const fees  = n * assumptions.franchiseFeeGbp;
                  const gross = n * monthlyGrossPerUnit * 12;
                  const costs = n * supportCostPerUnit * 12;
                  const net   = gross - costs;
                  const selected = n === unitCount;
                  return (
                    <div key={n} onClick={() => setUnitCount(n)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">{n} clinic{n !== 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-muted-foreground">One-off joining fees</p>
                      <p className="text-xs font-semibold mb-1">{formatGBP(fees)}</p>
                      <p className="text-[10px] text-muted-foreground">Gross recurring/yr</p>
                      <p className="text-xs font-semibold mb-1">{formatGBP(gross)}</p>
                      <p className="text-[10px] text-muted-foreground">Less support cost</p>
                      <p className="text-xs font-semibold text-destructive mb-2">-{formatGBP(costs)}</p>
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] text-muted-foreground">Est. net/yr</p>
                        <p className={`text-sm font-bold ${selected ? "text-primary" : ""}`}>{formatGBP(net)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PlainEnglish>
                With <strong>{unitCount} active clinic{unitCount !== 1 ? "s" : ""}</strong> at {revenueScenario} revenue and {SUPPORT_COSTS[supportCostKey].label.toLowerCase()}: joining fees of <strong>{formatGBP(unitCount * assumptions.franchiseFeeGbp)}</strong> plus an estimated net recurring income of <strong>{formatGBP(unitCount * annualNetPerUnit)}/year</strong> after support costs. These are illustrative — actual support costs vary significantly as the network grows.
              </PlainEnglish>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════ TREATMENTS ══════════════ */}
      {tab === "treatments" && (
        <div className="space-y-6">
          <TabIntro
            heading="Which treatments are safe to include in a franchise?"
            body="Not all treatments are equally franchisable. The more clinical complexity, the more governance infrastructure required. This is not about risk-avoidance — it's about honest staging."
          />
          <PlainEnglish>
            The most successful aesthetics franchise models tend to start with lower-complexity treatments (green column) and add amber treatments only once central governance is properly established. Red treatments should not be included until the franchise network has robust prescribing oversight, complication protocols, and audit systems in place.
          </PlainEnglish>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Green */}
            <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-t-xl">
                <CardTitle className="text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  Easier to replicate
                </CardTitle>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Lower clinical risk — good starting point for a franchise</p>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {GREEN_TREATMENTS.map(t => (
                  <div key={t.text} className="py-1.5 border-b border-emerald-100 dark:border-emerald-900 last:border-0">
                    <p className="text-sm font-medium">{t.text}</p>
                    <p className="text-xs text-muted-foreground">{t.plain}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Amber */}
            <Card className="shadow-sm border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2 bg-amber-50/60 dark:bg-amber-950/20 rounded-t-xl">
                <CardTitle className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  Only with central governance
                </CardTitle>
                <p className="text-xs text-amber-700 dark:text-amber-400">Higher clinical risk — require prescriber oversight and robust protocols</p>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {AMBER_TREATMENTS.map(t => (
                  <div key={t.text} className="py-1.5 border-b border-amber-100 dark:border-amber-900 last:border-0">
                    <p className="text-sm font-medium">{t.text}</p>
                    <p className="text-xs text-muted-foreground">{t.plain}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Red */}
            <Card className="shadow-sm border-destructive/30 dark:border-destructive/40">
              <CardHeader className="pb-2 bg-destructive/5 rounded-t-xl">
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive shrink-0" />
                  Do not franchise yet
                </CardTitle>
                <p className="text-xs text-destructive/80">These cannot be included until the governance infrastructure exists</p>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {RED_TREATMENTS.map(t => (
                  <div key={t.text} className="py-1.5 border-b border-destructive/10 last:border-0">
                    <p className="text-sm font-medium">{t.text}</p>
                    <p className="text-xs text-muted-foreground">{t.plain}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-border/60 bg-muted/30">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">UK regulation — what you need to know</p>
              <ul className="space-y-1.5">
                {[
                  "England is moving toward a licensing regime for non-surgical cosmetic procedures. The rules are changing — any franchise model must track this actively.",
                  "Scotland, Wales, and Northern Ireland have different rules, especially around laser/IPL and non-surgical cosmetics. Every franchise location needs a nation-specific compliance check.",
                  "Prescription-only medicines (botulinum toxin, prescription fillers) cannot be advertised directly to the public. Use 'anti-wrinkle consultation' or 'lines and wrinkles treatment options' — never 'Botox' in advertising.",
                  "From June 2025, nurse and midwife prescribers must consult face-to-face before prescribing elective non-surgical cosmetic medicines. A franchise model must not rely on remote prescribing shortcuts.",
                  "CQC registration applies where regulated activities are carried out (surgical procedures, treatment of disease, disorder or injury). Purely cosmetic treatments may not currently require CQC registration in England — but that does not mean they are low risk.",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════ TERRITORY ══════════════ */}
      {tab === "territory" && (
        <div className="space-y-4">
          <TabIntro
            heading="Where could other Abi Peters clinics open?"
            body="A territory gives one franchisee the exclusive right to operate in a defined area — no other Abi Peters clinic can open nearby. Winchester is your original. These are areas to consider in the future."
          />
          <PlainEnglish>
            Territories should be defined by postcode boundary, not just a radius — this makes disputes easier to resolve. For an aesthetics clinic, a viable territory typically covers 30,000–100,000 people within a short drive. Larger cities like Southampton may support 2–3 separate territories with enough population for each to be viable.
          </PlainEnglish>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Territory map</CardTitle>
              <p className="text-xs text-muted-foreground">Click a status badge to update it. Add new areas below.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {territories.map(t => (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.status === "mother_clinic" ? "bg-primary/5 border-primary/30" : "bg-card border-border/60"}`}>
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-[10px] text-muted-foreground">{t.type}</span>
                      {t.population !== "—" && <span className="text-[10px] text-muted-foreground">· {t.population} people</span>}
                    </div>
                    {t.note && <p className="text-xs text-muted-foreground mt-0.5">{t.note}</p>}
                  </div>
                  <button onClick={() => cycleTerritoryStatus(t.id)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 transition-colors ${
                      t.status === "mother_clinic" ? "bg-primary/15 text-primary cursor-default" :
                      t.status === "sold"          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-pointer" :
                      t.status === "reserved"      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 cursor-pointer" :
                      "bg-muted text-muted-foreground cursor-pointer"}`}>
                    {t.status === "mother_clinic" ? "Original clinic" : t.status === "sold" ? "Sold" : t.status === "reserved" ? "Reserved" : "Available"}
                  </button>
                  {t.status !== "mother_clinic" && (
                    <button onClick={() => setTerritories(p => p.filter(x => x.id !== t.id))} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Add a town or city you're considering" value={newTerritoryName}
                  onChange={e => setNewTerritoryName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTerritory()} className="h-9 text-sm" />
                <Button size="sm" variant="outline" onClick={addTerritory} className="gap-1.5 shrink-0"><Plus className="w-4 h-4" /> Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════ RULEBOOK ══════════════ */}
      {tab === "operations" && (
        <div className="space-y-4">
          <TabIntro
            heading="The operations manual — writing down how you do everything"
            body="This is the most important document in any franchise. It tells franchisees exactly how to run their clinic the Abi Peters way. Without it, every clinic would do things differently. Start by writing down how Winchester works — then improve it."
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Completion: <strong className="text-foreground">{opsCompletion}%</strong></p>
            <Progress value={opsCompletion} className="w-32 h-2" />
          </div>
          {opsManual.map(section => {
            const done = section.items.filter(i => i.done).length;
            return (
              <Card key={section.id} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <span className="text-[10px] text-muted-foreground">{done}/{section.items.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{section.why}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleOps(section.id, item.id)}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"}`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.plain}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════════════ LEGAL ══════════════ */}
      {tab === "legal" && (
        <div className="space-y-4">
          <TabIntro
            heading="What legal work is needed before franchising?"
            body="Aesthetics franchising requires more legal infrastructure than most other types of franchise because of the clinical and prescribing layer on top of standard franchise law. A specialist franchise solicitor is essential — not optional."
          />
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Always use a bfa-accredited franchise solicitor</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Franchise contracts are a specialist area of law — different from standard commercial contracts. For a nurse-led aesthetics clinic, you also need a healthcare regulatory adviser to review the clinical governance framework. These are two separate specialisms. Budget approximately £8,000–£20,000 for the combined legal setup.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Legal readiness: <strong className="text-foreground">{legalCompletion}%</strong></p>
            <Progress value={legalCompletion} className="w-32 h-2" />
          </div>
          {legalChecklist.map(section => {
            const done = section.items.filter(i => i.done).length;
            return (
              <Card key={section.id} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <span className="text-[10px] text-muted-foreground">{done}/{section.items.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{section.why}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleLegal(section.id, item.id)}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"}`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.plain}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
          <Card className="shadow-sm border-border/60 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">When to start:</strong> Once Winchester has been trading profitably for 12 months and you're seriously considering franchising, have an initial consultation with a franchise solicitor. The British Franchise Association (
                <a href="https://www.thebfa.org" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">thebfa.org <ExternalLink className="w-2.5 h-2.5" /></a>
                ) has a directory of accredited advisers and offers initial guidance.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
