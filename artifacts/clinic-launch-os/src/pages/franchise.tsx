import { useState, useMemo } from "react";
import {
  useGetProjectDashboard, getGetProjectDashboardQueryKey,
  useGetFinancialModel, getGetFinancialModelQueryKey,
  useListProperties, getListPropertiesQueryKey,
  useGetComplianceSummary, getGetComplianceSummaryQueryKey,
  useGetPhasesWithTasks, getGetPhasesWithTasksQueryKey,
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
  MapPin, Package2, BookOpen, Shield, Sparkles,
  Plus, Trash2, Lock, Users, PoundSterling, Star,
  ChevronDown, ChevronUp, ArrowRight, HelpCircle, Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;

// ─── Types ────────────────────────────────────────────────────────────────────
type TabKey = "readiness" | "setup" | "income" | "territory" | "package" | "operations" | "legal";

interface FranchiseAssumptions {
  franchiseFeeGbp: number;
  royaltyPercent: number;
  marketingLevyPercent: number;
  techSupportMonthlyGbp: number;
  trainingCostGbp: number;
  legalSetupGbp: number;
  workingCapitalMonths: number;
}

interface Territory {
  id: string;
  name: string;
  type: string;
  population: string;
  status: "mother_clinic" | "available" | "reserved" | "sold";
  note: string;
}

interface ChecklistItem { id: string; text: string; plain: string; done: boolean }
interface ChecklistSection { id: string; title: string; why: string; items: ChecklistItem[] }

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_ASSUMPTIONS: FranchiseAssumptions = {
  franchiseFeeGbp: 25000,
  royaltyPercent: 8,
  marketingLevyPercent: 2,
  techSupportMonthlyGbp: 200,
  trainingCostGbp: 5000,
  legalSetupGbp: 3000,
  workingCapitalMonths: 3,
};

const DEFAULT_TERRITORIES: Territory[] = [
  { id: "winch", name: "Winchester", type: "City", population: "45,000", status: "mother_clinic", note: "Your original clinic — the blueprint for everything else" },
  { id: "soton", name: "Southampton", type: "City", population: "250,000", status: "available", note: "" },
  { id: "bsng", name: "Basingstoke", type: "Town", population: "110,000", status: "available", note: "" },
  { id: "fare", name: "Fareham & Gosport", type: "Town", population: "120,000", status: "available", note: "" },
  { id: "chich", name: "Chichester", type: "City", population: "30,000", status: "available", note: "" },
];

const DEFAULT_PACKAGE: { id: string; category: string; item: string; plain: string; included: boolean }[] = [
  { id: "p1", category: "Your Brand", item: "Name licence — Abi Peters Aesthetics", plain: "They can legally trade under your name", included: true },
  { id: "p2", category: "Your Brand", item: "Brand guidelines & logo pack", plain: "Exact colours, fonts, and logo files so every clinic looks the same", included: true },
  { id: "p3", category: "Your Brand", item: "Treatment room design specification", plain: "How the room should look — furniture, layout, lighting", included: true },
  { id: "p4", category: "Your Brand", item: "Uniform & signage templates", plain: "What staff wear and how the outside of the clinic looks", included: true },
  { id: "p5", category: "Training", item: "5-day initial onboarding programme", plain: "You (or your team) train them before they open", included: true },
  { id: "p6", category: "Training", item: "Clinical protocols & SOPs handbook", plain: "Exactly how to perform each treatment — step by step", included: true },
  { id: "p7", category: "Training", item: "CQC compliance training module", plain: "How to pass the regulatory inspection that lets them legally open", included: true },
  { id: "p8", category: "Training", item: "Staff induction materials", plain: "How they train their own staff when they hire people", included: true },
  { id: "p9", category: "Systems & Tech", item: "Clinic management software setup", plain: "The booking and client management system, already configured for them", included: true },
  { id: "p10", category: "Systems & Tech", item: "Booking system configuration", plain: "Online booking set up and ready to take appointments from day one", included: true },
  { id: "p11", category: "Systems & Tech", item: "Finance & reporting templates", plain: "Spreadsheets so they can track their money and report to you easily", included: false },
  { id: "p12", category: "Systems & Tech", item: "Social media content library", plain: "Ready-made posts and graphics they can use straight away", included: true },
  { id: "p13", category: "Operations", item: "Full operations manual", plain: "The complete rulebook for running the clinic your way", included: true },
  { id: "p14", category: "Operations", item: "Supplier contacts & preferred pricing", plain: "Who to buy products from and what to pay — using your negotiated rates", included: true },
  { id: "p15", category: "Operations", item: "Quality audit framework", plain: "A checklist you use to inspect their clinic and make sure standards are kept", included: false },
  { id: "p16", category: "Marketing", item: "Local area marketing plan template", plain: "A marketing plan they can adapt for their town", included: true },
  { id: "p17", category: "Marketing", item: "Google Business profile setup guide", plain: "Step-by-step guide to getting found on Google Maps", included: true },
  { id: "p18", category: "Marketing", item: "Launch campaign materials", plain: "Posters, social posts, and email templates for their opening", included: true },
  { id: "p19", category: "Ongoing Support", item: "Monthly business review call", plain: "A regular call with you to review their numbers and help them grow", included: true },
  { id: "p20", category: "Ongoing Support", item: "Annual clinic audit visit", plain: "You visit their clinic once a year to check everything is up to standard", included: false },
  { id: "p21", category: "Ongoing Support", item: "Central marketing coordination", plain: "You manage brand-wide campaigns that benefit all clinics", included: false },
  { id: "p22", category: "Ongoing Support", item: "Treatment protocol update programme", plain: "When you improve a treatment, you share the update with all franchisees", included: true },
];

const DEFAULT_OPS_MANUAL: ChecklistSection[] = [
  { id: "brand", title: "1. Your Brand Rules", why: "Every clinic must look and feel identical to Winchester — that's what customers are paying for.", items: [
    { id: "o1", text: "Logo usage rules and brand colour specification", plain: "Exactly which shade of green, which font, and where to put the logo", done: false },
    { id: "o2", text: "Tone of voice guidelines for all communications", plain: "How to write captions, emails, and messages — what sounds like you and what doesn't", done: false },
    { id: "o3", text: "Treatment menu naming and pricing framework", plain: "What every treatment is called and how pricing should be set", done: false },
    { id: "o4", text: "Photography standards for clinic and social media", plain: "What photos should look like — lighting, style, what not to post", done: false },
  ]},
  { id: "setup", title: "2. Setting Up the Clinic", why: "You need to make sure their clinic is built to your standard before they open.", items: [
    { id: "o5", text: "Minimum floor plan specification and room layout", plain: "The smallest size of clinic that meets your standard, and how rooms should be arranged", done: false },
    { id: "o6", text: "Approved equipment list with suppliers", plain: "Exactly which beds, machines, and tools to buy — and who to buy them from", done: false },
    { id: "o7", text: "Signage requirements and approved suppliers", plain: "What the outside and inside signage should look like", done: false },
    { id: "o8", text: "Pre-opening inspection checklist", plain: "A list you check before giving them the go-ahead to open", done: false },
  ]},
  { id: "clinical", title: "3. How Treatments Are Delivered", why: "This is the most important section — the reason clients choose Abi Peters is consistency and safety.", items: [
    { id: "o9", text: "Treatment protocols for every approved treatment", plain: "Step-by-step instructions for each treatment, written down so every practitioner does it the same way", done: false },
    { id: "o10", text: "Consent form templates (GDPR-compliant)", plain: "The forms clients sign before treatment — legally required and written correctly", done: false },
    { id: "o11", text: "Aftercare guidance per treatment", plain: "What to tell clients after each treatment — what to do, what to avoid", done: false },
    { id: "o12", text: "Complication management protocols", plain: "What to do if something goes wrong — this is critical for safety", done: false },
    { id: "o13", text: "Prescribing and safe storage policy", plain: "How to handle prescription-only products like anti-wrinkle treatments legally", done: false },
  ]},
  { id: "booking", title: "4. Taking Bookings & Running Reception", why: "How clients are handled before, during, and after their appointment shapes their experience.", items: [
    { id: "o14", text: "Booking software configuration guide", plain: "How to set up and use the online booking system", done: false },
    { id: "o15", text: "Phone and online enquiry scripts", plain: "What to say when someone calls or messages — so every clinic sounds the same", done: false },
    { id: "o16", text: "Pricing menu and discount policy", plain: "What's on the price list and rules about when discounts are allowed", done: false },
    { id: "o17", text: "Refund and complaints procedure", plain: "What to do if a client isn't happy — handled the same way across all clinics", done: false },
  ]},
  { id: "hr", title: "5. Hiring & Managing Staff", why: "Franchisees will hire their own staff — you need to make sure they hire and train people to your standard.", items: [
    { id: "o18", text: "Job descriptions for all clinic roles", plain: "What each role involves — practitioner, receptionist, clinic manager", done: false },
    { id: "o19", text: "Interview and recruitment guide", plain: "How to find and choose the right people for their clinic", done: false },
    { id: "o20", text: "Induction and onboarding plan", plain: "How new staff learn the job in their first few weeks", done: false },
    { id: "o21", text: "Performance review framework", plain: "How to check in with staff and deal with underperformance", done: false },
  ]},
  { id: "cqc", title: "6. Staying Legal (CQC & Compliance)", why: "Every clinic in the network must be fully registered and legal. One bad clinic damages your whole brand.", items: [
    { id: "o22", text: "CQC registration step-by-step guide", plain: "How to get registered with the Care Quality Commission before opening", done: false },
    { id: "o23", text: "Annual compliance audit schedule", plain: "When and how you check each clinic is still meeting all the legal rules", done: false },
    { id: "o24", text: "Incident reporting procedure", plain: "How to record and report anything that goes wrong", done: false },
    { id: "o25", text: "Data protection and GDPR policy", plain: "How to handle client data properly — legally required", done: false },
  ]},
  { id: "finance", title: "7. Money & Reporting", why: "You need to know each franchisee's revenue so you can collect your royalty accurately — and spot problems early.", items: [
    { id: "o26", text: "Monthly P&L reporting format", plain: "A simple monthly report showing their income and costs — sent to you", done: false },
    { id: "o27", text: "Cash management and bank reconciliation guide", plain: "How to make sure their bookkeeping is accurate", done: false },
    { id: "o28", text: "VAT registration trigger and process", plain: "What to do when their income reaches the level that requires VAT registration", done: false },
    { id: "o29", text: "Royalty reporting schedule and method", plain: "Exactly how and when they report their revenue and pay you your percentage", done: false },
  ]},
  { id: "marketing", title: "8. Getting Clients in the Door", why: "Marketing drives revenue. You need to make sure franchisees represent your brand correctly while growing their local client base.", items: [
    { id: "o30", text: "Local area marketing 90-day launch plan", plain: "A step-by-step marketing plan for their first 3 months", done: false },
    { id: "o31", text: "Google review acquisition strategy", plain: "How to ask clients for reviews — the most important thing they can do", done: false },
    { id: "o32", text: "Social media posting schedule and approval flow", plain: "How often to post and whether they need your sign-off before posting", done: false },
    { id: "o33", text: "Membership and loyalty programme guide", plain: "How to run a client membership or rewards scheme your way", done: false },
  ]},
];

const DEFAULT_LEGAL: ChecklistSection[] = [
  { id: "foundations", title: "Before You Do Anything Else", why: "These are the basics you need in place first. Don't skip them.", items: [
    { id: "l1", text: "Mother clinic operating profitably for minimum 12 months", plain: "You need to prove the model works before selling it to others — Winchester must be running well first", done: false },
    { id: "l2", text: "Business name and logo registered with UKIPO (trademark)", plain: "Register 'Abi Peters Aesthetics' as a trademark so no one else can copy your brand name legally", done: false },
    { id: "l3", text: "Operations manual fully drafted and reviewed", plain: "The rulebook for franchisees must be complete before you can sell a franchise", done: false },
    { id: "l4", text: "Accountants briefed on franchise income structure", plain: "Your accountant needs to know you'll be receiving franchise fees and royalties — it's taxed differently", done: false },
  ]},
  { id: "legal-docs", title: "The Legal Documents (A Solicitor Writes These)", why: "You can't do this yourself — you need a specialist franchise solicitor. Budget around £5,000–£15,000 for this.", items: [
    { id: "l5", text: "Franchise agreement drafted by specialist franchise solicitor", plain: "The main contract between you and each franchisee — covers everything they can and can't do", done: false },
    { id: "l6", text: "Franchise disclosure document (FDD) prepared", plain: "A document you give to prospective franchisees before they sign — legally required to be honest about the business", done: false },
    { id: "l7", text: "Territory protection clauses defined and documented", plain: "Written into the contract: this franchisee owns this area and no other Abi Peters clinic will open nearby", done: false },
    { id: "l8", text: "Termination, renewal and exit clauses agreed", plain: "What happens if things go wrong — how either side can leave the arrangement", done: false },
    { id: "l9", text: "Training obligations legally binding in agreement", plain: "They must complete your training before opening — this is written into the contract", done: false },
    { id: "l10", text: "Supplier preferred list included in legal framework", plain: "They agree to buy products from your approved suppliers — protecting quality across the network", done: false },
  ]},
  { id: "recruitment", title: "Finding Your First Franchisee", why: "Choosing the right first franchisee is critical. One bad one can damage your brand badly.", items: [
    { id: "l11", text: "Franchise prospectus / information memorandum created", plain: "A document you give to people interested in buying a franchise — explains what they get and what it costs", done: false },
    { id: "l12", text: "Franchisee selection criteria documented", plain: "Write down what makes an ideal franchisee for you — clinical background? Business experience? Local connections?", done: false },
    { id: "l13", text: "Financial due diligence process for applicants defined", plain: "How you check that a potential franchisee can actually afford to open and sustain the clinic", done: false },
    { id: "l14", text: "Discovery day process designed", plain: "An event where serious applicants come to Winchester to meet you and see how the clinic runs before deciding", done: false },
  ]},
  { id: "ongoing", title: "Running the Franchise Long-Term", why: "Once you have franchisees, you need systems to support and oversee them.", items: [
    { id: "l15", text: "Royalty reporting and audit rights clause included", plain: "You have the right to check their books to make sure they're reporting revenue accurately", done: false },
    { id: "l16", text: "Franchisee code of conduct and brand standards", plain: "A written agreement on behaviour and quality — what they can and can't do as an Abi Peters franchisee", done: false },
    { id: "l17", text: "Consider British Franchise Association (bfa) membership", plain: "The bfa is the UK's official franchise body. Being a member adds credibility and helps attract serious franchisees", done: false },
    { id: "l18", text: "Annual franchise conference / network meetings planned", plain: "Bring all your franchisees together once a year to share knowledge and keep everyone aligned", done: false },
  ]},
];

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#3a7a6a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// ─── Plain-English callout ────────────────────────────────────────────────────
function PlainEnglish({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 dark:bg-amber-950/20 dark:border-amber-800">
      <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Tab intro banner ─────────────────────────────────────────────────────────
function TabIntro({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-sm font-semibold text-primary mb-0.5">{heading}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FranchisePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("readiness");
  const [assumptions, setAssumptions] = useState<FranchiseAssumptions>(DEFAULT_ASSUMPTIONS);
  const [territories, setTerritories] = useState<Territory[]>(DEFAULT_TERRITORIES);
  const [packageItems, setPackageItems] = useState(DEFAULT_PACKAGE);
  const [opsManual, setOpsManual] = useState<ChecklistSection[]>(DEFAULT_OPS_MANUAL);
  const [legalChecklist, setLegalChecklist] = useState<ChecklistSection[]>(DEFAULT_LEGAL);
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [unitCount, setUnitCount] = useState<1 | 3 | 5 | 10>(3);
  const [introOpen, setIntroOpen] = useState(true);

  // ─── Data ──────────────────────────────────────────────────────────────────
  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: { queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) },
  });
  const { data: model } = useGetFinancialModel(PROJECT_ID, {
    query: { queryKey: getGetFinancialModelQueryKey(PROJECT_ID) },
  });
  const { data: properties } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID) },
  });
  const { data: compliance } = useGetComplianceSummary(PROJECT_ID, {
    query: { queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) },
  });
  const { data: phases } = useGetPhasesWithTasks(PROJECT_ID, {
    query: { queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID) },
  });
  const { data: decisions } = useListDecisions(PROJECT_ID, {}, {
    query: { queryKey: getListDecisionsQueryKey(PROJECT_ID, {}) },
  });

  const activeProperty = properties?.find(p => p.isActiveForProject);
  const m = model as any;
  const complianceScore = compliance?.overallScore ?? 0;
  const totalTasks = dashboard?.totalTaskCount ?? 0;
  const completedTasks = dashboard?.completedTaskCount ?? 0;
  const decisionsCount = decisions?.length ?? 0;
  const launchReadiness = dashboard?.launchReadinessPercent ?? 0;
  const fitOutCost = dashboard?.currentSelectedCost ?? 65000;

  const monthlyRevenue = useMemo(() => {
    if (!m) return 0;
    const rooms = m.treatmentRoomsCount || 2;
    const hours = m.practitionerHoursPerDay || 7;
    const days = m.workingDaysPerMonth || 22;
    const acv = m.wincAcvGbp || 155;
    const occ = (m.realisticOccupancyPercent || 65) / 100;
    return Math.round(rooms * hours * days * 1.4 * occ * acv);
  }, [m]);

  const monthlyFixedCosts = useMemo(() => {
    if (!m) return 2500;
    return ['rentGbp','ratesGbp','utilitiesGbp','internetGbp','insuranceGbp',
      'accountantGbp','softwareGbp','wasteContractGbp','cleanerGbp',
      'subscriptionsGbp','financeRepaymentsGbp']
      .reduce((s: number, k: string) => s + (Number(m[k]) || 0), 0);
  }, [m]);

  const opsCompletion = useMemo(() => {
    const total = opsManual.flatMap(s => s.items).length;
    const done = opsManual.flatMap(s => s.items).filter(i => i.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [opsManual]);

  const legalCompletion = useMemo(() => {
    const total = legalChecklist.flatMap(s => s.items).length;
    const done = legalChecklist.flatMap(s => s.items).filter(i => i.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [legalChecklist]);

  const readinessDims = useMemo(() => [
    {
      label: "Is the clinic proven?",
      desc: `${completedTasks} of ${totalTasks} launch tasks complete`,
      score: Math.round((completedTasks / Math.max(totalTasks, 1)) * 100),
      weight: 20,
      tip: "Finish the Winchester launch tasks in the Project Plan tab",
      icon: CheckCircle2,
    },
    {
      label: "Are the finances modelled?",
      desc: "Financial assumptions populated",
      score: m && (m.rentGbp > 0 || m.wincAcvGbp > 100) ? Math.min(60 + launchReadiness / 3, 90) : 5,
      weight: 20,
      tip: "Fill in your costs and income targets in the Financials tab",
      icon: PoundSterling,
    },
    {
      label: "Is the property secured?",
      desc: activeProperty ? (activeProperty.address ?? "Active property selected") : "No property chosen yet",
      score: activeProperty ? 100 : 0,
      weight: 15,
      tip: "Mark a property as active in the Properties tab",
      icon: Building2,
    },
    {
      label: "Is the clinic legally compliant?",
      desc: `CQC compliance ${complianceScore}% complete`,
      score: complianceScore,
      weight: 15,
      tip: "Work through the CQC checklist in the Compliance tab",
      icon: Shield,
    },
    {
      label: "Are the systems written down?",
      desc: `Operations manual ${opsCompletion}% complete`,
      score: opsCompletion,
      weight: 15,
      tip: `Go to the Rulebook tab and tick off what's documented`,
      icon: BookOpen,
    },
    {
      label: "Are decisions being logged?",
      desc: `${decisionsCount} decision${decisionsCount !== 1 ? "s" : ""} on record`,
      score: Math.min(decisionsCount * 15, 100),
      weight: 10,
      tip: "Use the Decision Log to record what you've decided and why",
      icon: AlertTriangle,
    },
    {
      label: "Is marketing budgeted?",
      desc: m?.marketingGbp > 0 ? `£${m.marketingGbp}/mo budget set` : "No marketing budget set yet",
      score: (m?.marketingGbp ?? 0) > 0 ? 80 : 5,
      weight: 5,
      tip: "Add a monthly marketing budget in the Financials assumptions",
      icon: Star,
    },
  ], [completedTasks, totalTasks, launchReadiness, m, activeProperty, complianceScore, opsCompletion, decisionsCount]);

  const overallReadiness = useMemo(() => {
    const totalWeight = readinessDims.reduce((s, d) => s + d.weight, 0);
    const weighted = readinessDims.reduce((s, d) => s + (d.score * d.weight / 100), 0);
    return Math.round((weighted / totalWeight) * 100);
  }, [readinessDims]);

  const readinessLabel =
    overallReadiness >= 85 ? { text: "Ready to scale", color: "text-primary", bg: "bg-primary/10" } :
    overallReadiness >= 70 ? { text: "Ready to pilot", color: "text-emerald-600", bg: "bg-emerald-50" } :
    overallReadiness >= 40 ? { text: "Getting there", color: "text-amber-600", bg: "bg-amber-50" } :
    { text: "Still building the foundation", color: "text-destructive", bg: "bg-destructive/5" };

  const setupCostLines = useMemo(() => [
    { label: "Fitting out and equipping the clinic", value: fitOutCost, plain: "Building the treatment rooms, buying beds and equipment — based on what Winchester cost" },
    { label: "Property deposit (3 months' rent)", value: (m?.rentGbp ?? 2700) * 3, plain: "Most landlords ask for this upfront before you can move in" },
    { label: "Franchise fee — paid to you", value: assumptions.franchiseFeeGbp, plain: "This is your one-off payment for joining the Abi Peters Aesthetics network" },
    { label: "Training — paid to you", value: assumptions.trainingCostGbp, plain: "Covers your time training them before they open" },
    { label: "Their own legal fees", value: assumptions.legalSetupGbp, plain: "Every franchisee should have their own solicitor review the contract you give them" },
    { label: "Cash buffer for the first few months", value: monthlyFixedCosts * assumptions.workingCapitalMonths, plain: `${assumptions.workingCapitalMonths} months of running costs to cover them while they build up clients` },
    { label: "Contingency (10% buffer)", value: Math.round(fitOutCost * 0.10), plain: "Things always cost slightly more than planned — this covers surprises" },
  ], [fitOutCost, m, assumptions, monthlyFixedCosts]);

  const totalSetupCost = setupCostLines.reduce((s, l) => s + l.value, 0);

  const monthlyRoyalty = Math.round(monthlyRevenue * (assumptions.royaltyPercent / 100));
  const monthlyLevy = Math.round(monthlyRevenue * (assumptions.marketingLevyPercent / 100));
  const monthlyPerUnit = monthlyRoyalty + monthlyLevy + assumptions.techSupportMonthlyGbp;
  const annualPerUnit = monthlyPerUnit * 12;

  function toggleOpsItem(sectionId: string, itemId: string) {
    setOpsManual(prev => prev.map(s =>
      s.id !== sectionId ? s : { ...s, items: s.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) }
    ));
  }
  function toggleLegalItem(sectionId: string, itemId: string) {
    setLegalChecklist(prev => prev.map(s =>
      s.id !== sectionId ? s : { ...s, items: s.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) }
    ));
  }
  function togglePackage(id: string) {
    setPackageItems(prev => prev.map(p => p.id === id ? { ...p, included: !p.included } : p));
  }
  function addTerritory() {
    if (!newTerritoryName.trim()) return;
    setTerritories(prev => [...prev, {
      id: Date.now().toString(), name: newTerritoryName.trim(),
      type: "Town", population: "—", status: "available", note: "",
    }]);
    setNewTerritoryName("");
  }
  function removeTerritory(id: string) {
    setTerritories(prev => prev.filter(t => t.id !== id));
  }
  function cycleTerritoryStatus(id: string) {
    const cycle: Territory["status"][] = ["available", "reserved", "sold"];
    setTerritories(prev => prev.map(t => {
      if (t.id === id || t.status === "mother_clinic") return t;
      const idx = cycle.indexOf(t.status);
      return { ...t, status: cycle[(idx + 1) % cycle.length] };
    }));
  }

  const TAB_LABELS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "readiness", label: "Are You Ready?", icon: Sparkles },
    { key: "setup", label: "What They Pay", icon: PoundSterling },
    { key: "income", label: "What You Earn", icon: TrendingUp },
    { key: "territory", label: "Where to Expand", icon: MapPin },
    { key: "package", label: "What They Get", icon: Package2 },
    { key: "operations", label: "The Rulebook", icon: BookOpen },
    { key: "legal", label: "Legal Steps", icon: Shield },
  ];

  const canConvert = overallReadiness >= 70;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Franchise Model"
        subtitle="Plan how the Winchester clinic could eventually become the blueprint for a national network of Abi Peters Aesthetics clinics."
        action={
          <Button
            size="sm"
            className="gap-2"
            disabled={!canConvert}
            onClick={() => toast({ title: "Coming soon", description: "This will package the Winchester clinic as a reusable franchise launch template. Available once the model is fully validated." })}
          >
            {canConvert ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {canConvert ? "Convert to Franchise Template" : `Locked — reach 70% first`}
          </Button>
        }
      />

      {/* ─── What is a franchise? collapsible explainer ──────────────────── */}
      <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          onClick={() => setIntroOpen(o => !o)}
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">What is a franchise? — Start here if this is new to you</span>
          </div>
          {introOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {introOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-border/50">
            <p className="text-sm text-muted-foreground leading-relaxed pt-4">
              A franchise is when you let someone else open a copy of your business using your name, your brand, and your systems — in exchange for money. Think McDonald's, Anytime Fitness, or Toni&Guy. The owner of the original business didn't open every single location — they licensed other people to do it for them.
            </p>

            {/* 3-step how it works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  step: "1",
                  heading: "You prove the model works",
                  body: "Winchester is your proof. Once it's running profitably and consistently, you have something worth selling.",
                  status: "Winchester — in progress",
                  color: "border-primary/30 bg-primary/5",
                },
                {
                  step: "2",
                  heading: "Someone pays you to copy it",
                  body: "A franchisee pays you an upfront fee (e.g. £25,000) to open their own Abi Peters clinic using your name, training, and systems.",
                  status: "Coming later",
                  color: "border-border/60 bg-muted/30",
                },
                {
                  step: "3",
                  heading: "They earn. You earn a cut.",
                  body: "They run their clinic, see their clients, and pay you a percentage of their revenue every month — for as long as they're open.",
                  status: "Coming later",
                  color: "border-border/60 bg-muted/30",
                },
              ].map((s, i) => (
                <div key={s.step} className={`rounded-xl border p-4 relative ${s.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                    <p className="text-sm font-semibold leading-tight">{s.heading}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
                  <p className={`text-[10px] font-semibold mt-2 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{s.status}</p>
                  {i < 2 && <ArrowRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />}
                </div>
              ))}
            </div>

            {/* Key terms */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key terms — plain English</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { term: "Franchisor", def: "You — the person who owns the original brand and sells the right to copy it" },
                  { term: "Franchisee", def: "The person who pays to open their own version of your clinic" },
                  { term: "Franchise fee", def: "The upfront amount a franchisee pays you to join — typically £15,000–£30,000" },
                  { term: "Royalty", def: "Your monthly cut — a percentage of what each franchisee earns, e.g. 8% of their revenue" },
                  { term: "Territory", def: "The geographic area one franchisee owns exclusively — no other Abi Peters clinic can open nearby" },
                  { term: "Operations manual", def: "The rulebook — a document that explains how to run the clinic your way, step by step" },
                ].map(({ term, def }) => (
                  <div key={term} className="flex gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-foreground shrink-0">{term}:</span>
                    <span className="text-muted-foreground">{def}</span>
                  </div>
                ))}
              </div>
            </div>

            <PlainEnglish>
              <strong>The golden rule of franchising:</strong> You cannot franchise a failing business. The Winchester clinic must be profitable, proven, and well-documented before you offer it to anyone else. That is exactly what the rest of the Clinic Launch OS is helping you build.
            </PlainEnglish>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto -mb-0">
        {TAB_LABELS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── ARE YOU READY? ───────────────────────────────────────────────── */}
      {tab === "readiness" && (
        <div className="space-y-6">
          <TabIntro
            heading="Are you ready to franchise?"
            body="Before you can offer your clinic as a franchise, you need to have proven it works. This score tracks how close the Winchester clinic is to being a model that other people could reliably copy."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm border-border/60 flex flex-col items-center justify-center py-8">
              <div className="relative">
                <ScoreRing score={overallReadiness} size={140} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{overallReadiness}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">/ 100</span>
                </div>
              </div>
              <div className={`mt-4 px-3 py-1 rounded-full text-xs font-semibold ${readinessLabel.bg} ${readinessLabel.color}`}>
                {readinessLabel.text}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center px-4">
                {overallReadiness >= 70
                  ? "The Winchester model is approaching franchise readiness."
                  : `Reach 70 to unlock the 'Convert to Template' button.`}
              </p>
            </Card>

            <Card className="shadow-sm border-border/60 col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">What's being measured</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {readinessDims.map(dim => (
                  <div key={dim.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <dim.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{dim.label}</span>
                      </div>
                      <span className={`text-xs font-semibold ${dim.score >= 70 ? "text-primary" : dim.score >= 40 ? "text-amber-600" : "text-destructive"}`}>
                        {dim.score}%
                      </span>
                    </div>
                    <Progress value={dim.score} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{dim.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {readinessDims.filter(d => d.score < 70).length > 0 && (
            <Card className="shadow-sm border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Things to work on
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {readinessDims.filter(d => d.score < 70).map(dim => (
                  <div key={dim.label} className="flex items-start gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dim.score < 40 ? "bg-destructive" : "bg-amber-500"}`} />
                    <div>
                      <span className="font-medium text-foreground">{dim.label}:</span>{" "}
                      <span className="text-muted-foreground">{dim.tip}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── WHAT THEY PAY ────────────────────────────────────────────────── */}
      {tab === "setup" && (
        <div className="space-y-6">
          <TabIntro
            heading="What does it cost a franchisee to open?"
            body="When someone wants to open their own Abi Peters Aesthetics clinic, they need to find this money themselves — from savings, a bank loan, or investors. This is their investment, not yours."
          />
          <PlainEnglish>
            Of this total, the franchise fee and training costs come directly to <strong>you</strong>. The rest goes to landlords, builders, and solicitors. So franchising isn't just a source of ongoing income — you earn money the moment someone joins.
          </PlainEnglish>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Adjust the numbers</CardTitle>
                <p className="text-xs text-muted-foreground">These are your decisions — change them to see how the total changes</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: "franchiseFeeGbp", label: "Your franchise fee (£)", hint: "What you charge them to join. Typical range: £15,000–£30,000", min: 0, step: 1000 },
                  { key: "trainingCostGbp", label: "Training cost (£)", hint: "What you charge for the initial training programme", min: 0, step: 500 },
                  { key: "legalSetupGbp", label: "Their legal fees (£)", hint: "Their own solicitor's cost to review your franchise agreement", min: 0, step: 500 },
                  { key: "workingCapitalMonths", label: "Cash buffer (months)", hint: "How many months of running costs they should have in reserve before opening", min: 1, step: 1 },
                ] as { key: keyof FranchiseAssumptions; label: string; hint: string; min: number; step: number }[]).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input
                      type="number" className="mt-1 h-8 text-sm" min={f.min} step={f.step}
                      value={assumptions[f.key]}
                      onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total investment breakdown — per franchisee</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {setupCostLines.map(line => (
                    <div key={line.label} className="py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{line.label}</p>
                        <span className="text-sm font-semibold tabular-nums">{formatGBP(line.value)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{line.plain}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Total they need to find</p>
                    <p className="text-xs text-muted-foreground">Per franchised clinic</p>
                  </div>
                  <span className="text-2xl font-bold text-primary">{formatGBP(totalSetupCost)}</span>
                </div>
                <div className="mt-4">
                  <PlainEnglish>
                    Of that total, <strong>{formatGBP(assumptions.franchiseFeeGbp + assumptions.trainingCostGbp)}</strong> comes directly to you (franchise fee + training). The rest they spend on their own clinic setup.
                  </PlainEnglish>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── WHAT YOU EARN ────────────────────────────────────────────────── */}
      {tab === "income" && (
        <div className="space-y-6">
          <TabIntro
            heading="What do you earn from each franchisee?"
            body="Once a franchisee opens, they pay you money every single month — for as long as they're operating. This is where the real long-term value of a franchise comes from."
          />
          <PlainEnglish>
            A <strong>royalty</strong> is a percentage of what your franchisee earns, paid to you each month. If their clinic brings in £20,000 and your royalty rate is 8%, you receive £1,600 — without doing a single treatment. Multiply that by 5 or 10 clinics and you can see why franchising can be transformative.
          </PlainEnglish>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Your income rates</CardTitle>
                <p className="text-xs text-muted-foreground">These are the percentages and fees you'd charge each franchisee</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: "royaltyPercent", label: "Royalty rate (%)", hint: "Your monthly cut of their revenue. Typical range: 6–10%. Higher = more income for you but harder to recruit franchisees.", min: 0, max: 20, step: 0.5 },
                  { key: "marketingLevyPercent", label: "Marketing contribution (%)", hint: "An additional % that goes into a shared pot for brand-wide marketing. Typical range: 1–3%.", min: 0, max: 10, step: 0.5 },
                  { key: "techSupportMonthlyGbp", label: "Monthly tech & support fee (£)", hint: "A flat fee per clinic per month covering software, tools, and your ongoing support.", min: 0, step: 50 },
                ] as { key: keyof FranchiseAssumptions; label: string; hint: string; min: number; max?: number; step: number }[]).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input
                      type="number" className="mt-1 h-8 text-sm" min={f.min} max={f.max} step={f.step}
                      value={assumptions[f.key]}
                      onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Per clinic, per month — your income</CardTitle>
                <p className="text-xs text-muted-foreground">Based on {formatGBP(monthlyRevenue)}/mo clinic revenue at realistic occupancy</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: `Royalty (${assumptions.royaltyPercent}% of their revenue)`, value: monthlyRoyalty, plain: `They earn ${formatGBP(monthlyRevenue)}, you get ${assumptions.royaltyPercent}% of that` },
                  { label: `Marketing contribution (${assumptions.marketingLevyPercent}%)`, value: monthlyLevy, plain: "Shared pot for brand-wide marketing" },
                  { label: "Tech & support subscription", value: assumptions.techSupportMonthlyGbp, plain: "Flat fee for systems and your ongoing support" },
                ].map(row => (
                  <div key={row.label} className="py-2 border-b border-border/50 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{row.label}</span>
                      <span className="text-sm font-semibold">{formatGBP(row.value)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{row.plain}</p>
                  </div>
                ))}
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold">Total per clinic per month</span>
                  <span className="text-lg font-bold text-primary">{formatGBP(monthlyPerUnit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">That's per year, per clinic</span>
                  <span className="text-sm font-semibold">{formatGBP(annualPerUnit)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scale comparison */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm">What if you had more than one franchisee?</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a number to see your projected income</p>
                </div>
                <div className="flex gap-1">
                  {([1, 3, 5, 10] as const).map(n => (
                    <button key={n} onClick={() => setUnitCount(n)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        unitCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {n} clinic{n !== 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([1, 3, 5, 10] as const).map(n => {
                  const fees = n * assumptions.franchiseFeeGbp;
                  const annual = n * annualPerUnit;
                  const y1 = fees + annual;
                  const selected = n === unitCount;
                  return (
                    <div key={n} onClick={() => setUnitCount(n)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${
                        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 hover:border-border"
                      }`}>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{n} clinic{n !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">One-off joining fees</p>
                      <p className="text-sm font-semibold">{formatGBP(fees)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">Ongoing per year</p>
                      <p className="text-sm font-semibold">{formatGBP(annual)}</p>
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Year 1 total to you</p>
                        <p className={`text-base font-bold ${selected ? "text-primary" : ""}`}>{formatGBP(y1)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PlainEnglish>
                In Year 1 with <strong>{unitCount} clinic{unitCount !== 1 ? "s" : ""}</strong>, you'd receive <strong>{formatGBP(unitCount * assumptions.franchiseFeeGbp)}</strong> in joining fees plus <strong>{formatGBP(unitCount * annualPerUnit)}</strong> in ongoing royalties — a total of <strong>{formatGBP(unitCount * assumptions.franchiseFeeGbp + unitCount * annualPerUnit)}</strong>. From Year 2 onwards (no new fees), you'd receive approximately <strong>{formatGBP(unitCount * annualPerUnit)}</strong>/year in royalties alone.
              </PlainEnglish>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── WHERE TO EXPAND ──────────────────────────────────────────────── */}
      {tab === "territory" && (
        <div className="space-y-4">
          <TabIntro
            heading="Where could other Abi Peters clinics open?"
            body="A territory is the area where one franchisee has exclusive rights. It means no other Abi Peters clinic can open in that same area, so they're not competing against each other. Winchester is your original — everything else is potential expansion."
          />
          <PlainEnglish>
            Territories are typically defined by postcode area or a radius from the clinic. For an aesthetics clinic, a realistic territory covers around 30,000–100,000 people within a short drive. Larger cities like Southampton might support 2–3 separate territories.
          </PlainEnglish>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Your territory map</CardTitle>
              <p className="text-xs text-muted-foreground">Click a territory's status badge to update it as you progress. Add new areas you're considering below.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {territories.map(t => (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  t.status === "mother_clinic" ? "bg-primary/5 border-primary/30" : "bg-card border-border/60"
                }`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-[10px] text-muted-foreground">{t.type}</span>
                      {t.population !== "—" && <span className="text-[10px] text-muted-foreground">· {t.population} people</span>}
                    </div>
                    {t.note && <p className="text-xs text-muted-foreground mt-0.5">{t.note}</p>}
                  </div>
                  <button
                    onClick={() => cycleTerritoryStatus(t.id)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 transition-colors ${
                      t.status === "mother_clinic" ? "bg-primary/15 text-primary cursor-default" :
                      t.status === "sold" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-pointer" :
                      t.status === "reserved" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 cursor-pointer" :
                      "bg-muted text-muted-foreground cursor-pointer"
                    }`}
                  >
                    {t.status === "mother_clinic" ? "Original clinic" : t.status === "sold" ? "Sold" : t.status === "reserved" ? "Reserved" : "Available"}
                  </button>
                  {t.status !== "mother_clinic" && (
                    <button onClick={() => removeTerritory(t.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Add an area you're considering (e.g. Portsmouth)"
                  value={newTerritoryName}
                  onChange={e => setNewTerritoryName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTerritory()}
                  className="h-9 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addTerritory} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── WHAT THEY GET ────────────────────────────────────────────────── */}
      {tab === "package" && (
        <div className="space-y-4">
          <TabIntro
            heading="What does a franchisee actually receive?"
            body="When someone pays to become a franchisee, they're buying access to everything you've built. This is your 'starter kit' — everything they need to open a clinic that looks and runs exactly like Winchester."
          />
          <PlainEnglish>
            Toggle items on and off to design your package. The more you include, the more attractive your franchise offer — but also the more you need to prepare before you can sell it.
          </PlainEnglish>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <span>{packageItems.filter(p => p.included).length} of {packageItems.length} items currently included</span>
          </div>

          {["Your Brand", "Training", "Systems & Tech", "Operations", "Marketing", "Ongoing Support"].map(category => {
            const items = packageItems.filter(p => p.category === category);
            return (
              <Card key={category} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {items.map(item => (
                    <div key={item.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        item.included ? "bg-primary/5" : "bg-muted/40 opacity-60"
                      }`}
                      onClick={() => togglePackage(item.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        item.included ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {item.included && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-snug">{item.item}</p>
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

      {/* ─── THE RULEBOOK ─────────────────────────────────────────────────── */}
      {tab === "operations" && (
        <div className="space-y-4">
          <TabIntro
            heading="The operations manual — your rulebook for franchisees"
            body="This is the most important document in your franchise. It tells franchisees exactly how to run their clinic the Abi Peters way. Without it, every clinic would do things differently — and your brand would quickly become inconsistent."
          />
          <PlainEnglish>
            Think of this as the instruction manual you'd give a new member of staff on their first day — except it covers everything, from how the logo should look to what to do if a treatment goes wrong. It doesn't need to be perfect to start with. Begin by writing down how you do things at Winchester.
          </PlainEnglish>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Overall completion: <strong className="text-foreground">{opsCompletion}%</strong></p>
            <Progress value={opsCompletion} className="w-32 h-2" />
          </div>

          {opsManual.map(section => {
            const done = section.items.filter(i => i.done).length;
            return (
              <Card key={section.id} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <span className="text-[10px] text-muted-foreground">{done}/{section.items.length} done</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{section.why}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.id} className="cursor-pointer group" onClick={() => toggleOpsItem(section.id, item.id)}>
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                        }`}>
                          {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.plain}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── LEGAL STEPS ──────────────────────────────────────────────────── */}
      {tab === "legal" && (
        <div className="space-y-4">
          <TabIntro
            heading="The legal side — what needs to happen"
            body="Franchising has legal requirements. Don't let this put you off — you don't need to understand all of this today, and you won't do it alone. A specialist franchise solicitor handles most of it. This checklist shows what needs to happen when the time comes."
          />

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Always use a specialist franchise solicitor</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Franchise contracts are very different from normal business contracts. A general solicitor won't know the specific clauses that protect you. The British Franchise Association (bfa) keeps a list of accredited franchise solicitors. Budget approximately £5,000–£15,000 for the legal setup — it's a one-off cost that protects your entire network.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Legal checklist completion: <strong className="text-foreground">{legalCompletion}%</strong></p>
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
                    <div key={item.id} className="cursor-pointer group" onClick={() => toggleLegalItem(section.id, item.id)}>
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                        }`}>
                          {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.plain}</p>
                        </div>
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
                <strong className="text-foreground">When should you start this process?</strong> Once Winchester has been running profitably for 12 months and you're seriously considering franchising — that's the time to have an initial conversation with a franchise solicitor. The bfa ({" "}
                <a href="https://www.thebfa.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">thebfa.org</a>
                {" "}) offers free initial guidance and a directory of accredited advisers.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
