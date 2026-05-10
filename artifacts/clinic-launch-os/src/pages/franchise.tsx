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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Network, CheckCircle2, AlertTriangle, Building2, TrendingUp,
  MapPin, Package2, BarChart3, BookOpen, Shield, Sparkles,
  Plus, Trash2, Lock, Users, PoundSterling, Star,
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

interface ChecklistItem { id: string; text: string; done: boolean }
interface ChecklistSection { id: string; title: string; items: ChecklistItem[] }

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
  { id: "winch", name: "Winchester", type: "City", population: "45,000", status: "mother_clinic", note: "Mother clinic — Abi Peters Aesthetics Ltd" },
  { id: "soton", name: "Southampton", type: "City", population: "250,000", status: "available", note: "" },
  { id: "bsng", name: "Basingstoke", type: "Town", population: "110,000", status: "available", note: "" },
  { id: "fare", name: "Fareham & Gosport", type: "Town", population: "120,000", status: "available", note: "" },
  { id: "chich", name: "Chichester", type: "City", population: "30,000", status: "available", note: "" },
];

const DEFAULT_PACKAGE: { id: string; category: string; item: string; included: boolean }[] = [
  { id: "p1", category: "Brand", item: "Name licence — Abi Peters Aesthetics", included: true },
  { id: "p2", category: "Brand", item: "Brand guidelines & logo pack", included: true },
  { id: "p3", category: "Brand", item: "Treatment room design specification", included: true },
  { id: "p4", category: "Brand", item: "Uniform & signage templates", included: true },
  { id: "p5", category: "Training", item: "5-day initial onboarding programme", included: true },
  { id: "p6", category: "Training", item: "Clinical protocols & SOPs handbook", included: true },
  { id: "p7", category: "Training", item: "CQC compliance training module", included: true },
  { id: "p8", category: "Training", item: "Staff induction materials", included: true },
  { id: "p9", category: "Systems", item: "Clinic management software setup", included: true },
  { id: "p10", category: "Systems", item: "Booking system configuration", included: true },
  { id: "p11", category: "Systems", item: "Finance & reporting templates", included: false },
  { id: "p12", category: "Systems", item: "Social media content library", included: true },
  { id: "p13", category: "Operations", item: "Full operations manual", included: true },
  { id: "p14", category: "Operations", item: "Supplier contacts & preferred pricing", included: true },
  { id: "p15", category: "Operations", item: "Quality audit framework", included: false },
  { id: "p16", category: "Marketing", item: "Local area marketing plan template", included: true },
  { id: "p17", category: "Marketing", item: "Google Business profile setup guide", included: true },
  { id: "p18", category: "Marketing", item: "Launch campaign materials", included: true },
  { id: "p19", category: "Support", item: "Monthly business review call", included: true },
  { id: "p20", category: "Support", item: "Annual clinic audit visit", included: false },
  { id: "p21", category: "Support", item: "Central marketing coordination", included: false },
  { id: "p22", category: "Support", item: "Treatment protocol update programme", included: true },
];

const DEFAULT_OPS_MANUAL: ChecklistSection[] = [
  { id: "brand", title: "1. Brand & Identity", items: [
    { id: "o1", text: "Logo usage rules and brand colour specification", done: false },
    { id: "o2", text: "Tone of voice guidelines for all communications", done: false },
    { id: "o3", text: "Treatment menu naming and pricing framework", done: false },
    { id: "o4", text: "Photography standards for clinic and social media", done: false },
  ]},
  { id: "setup", title: "2. Clinic Setup", items: [
    { id: "o5", text: "Minimum floor plan specification and room layout", done: false },
    { id: "o6", text: "Approved equipment list with suppliers", done: false },
    { id: "o7", text: "Signage requirements and approved suppliers", done: false },
    { id: "o8", text: "Pre-opening inspection checklist", done: false },
  ]},
  { id: "clinical", title: "3. Clinical Operations", items: [
    { id: "o9", text: "Treatment protocols for every approved treatment", done: false },
    { id: "o10", text: "Consent form templates (GDPR-compliant)", done: false },
    { id: "o11", text: "Aftercare guidance per treatment", done: false },
    { id: "o12", text: "Complication management protocols", done: false },
    { id: "o13", text: "Prescribing and safe storage policy", done: false },
  ]},
  { id: "booking", title: "4. Booking & Reception", items: [
    { id: "o14", text: "Booking software configuration guide", done: false },
    { id: "o15", text: "Phone and online enquiry scripts", done: false },
    { id: "o16", text: "Pricing menu and discount policy", done: false },
    { id: "o17", text: "Refund and complaints procedure", done: false },
  ]},
  { id: "hr", title: "5. Staff & HR", items: [
    { id: "o18", text: "Job descriptions for all clinic roles", done: false },
    { id: "o19", text: "Interview and recruitment guide", done: false },
    { id: "o20", text: "Induction and onboarding plan", done: false },
    { id: "o21", text: "Performance review framework", done: false },
  ]},
  { id: "cqc", title: "6. CQC & Compliance", items: [
    { id: "o22", text: "CQC registration step-by-step guide", done: false },
    { id: "o23", text: "Annual compliance audit schedule", done: false },
    { id: "o24", text: "Incident reporting procedure", done: false },
    { id: "o25", text: "Data protection and GDPR policy", done: false },
  ]},
  { id: "finance", title: "7. Finance & Reporting", items: [
    { id: "o26", text: "Monthly P&L reporting format", done: false },
    { id: "o27", text: "Cash management and bank reconciliation guide", done: false },
    { id: "o28", text: "VAT registration trigger and process", done: false },
    { id: "o29", text: "Royalty reporting schedule and method", done: false },
  ]},
  { id: "marketing", title: "8. Marketing & Growth", items: [
    { id: "o30", text: "Local area marketing 90-day launch plan", done: false },
    { id: "o31", text: "Google review acquisition strategy", done: false },
    { id: "o32", text: "Social media posting schedule and approval flow", done: false },
    { id: "o33", text: "Membership and loyalty programme guide", done: false },
  ]},
];

const DEFAULT_LEGAL: ChecklistSection[] = [
  { id: "foundations", title: "Foundations", items: [
    { id: "l1", text: "Mother clinic operating profitably for minimum 12 months", done: false },
    { id: "l2", text: "Business name and logo registered with UKIPO (trademark)", done: false },
    { id: "l3", text: "Operations manual fully drafted and reviewed", done: false },
    { id: "l4", text: "Accountants briefed on franchise income structure", done: false },
  ]},
  { id: "legal-docs", title: "Legal Documents", items: [
    { id: "l5", text: "Franchise agreement drafted by specialist franchise solicitor", done: false },
    { id: "l6", text: "Franchise disclosure document (FDD) prepared", done: false },
    { id: "l7", text: "Territory protection clauses defined and documented", done: false },
    { id: "l8", text: "Termination, renewal and exit clauses agreed", done: false },
    { id: "l9", text: "Training obligations legally binding in agreement", done: false },
    { id: "l10", text: "Supplier preferred list included in legal framework", done: false },
  ]},
  { id: "recruitment", title: "Franchisee Recruitment", items: [
    { id: "l11", text: "Franchise prospectus / information memorandum created", done: false },
    { id: "l12", text: "Franchisee selection criteria documented", done: false },
    { id: "l13", text: "Financial due diligence process for applicants defined", done: false },
    { id: "l14", text: "Discovery day process designed", done: false },
  ]},
  { id: "ongoing", title: "Ongoing Compliance", items: [
    { id: "l15", text: "Royalty reporting and audit rights clause included", done: false },
    { id: "l16", text: "Franchisee code of conduct and brand standards", done: false },
    { id: "l17", text: "Consider British Franchise Association (bfa) membership", done: false },
    { id: "l18", text: "Annual franchise conference / network meetings planned", done: false },
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

  // ─── Computed monthly revenue from model ─────────────────────────────────
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

  // ─── Ops manual completion ────────────────────────────────────────────────
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

  // ─── Readiness dimensions ─────────────────────────────────────────────────
  const readinessDims = useMemo(() => [
    {
      label: "Clinic Validated",
      desc: `${completedTasks} of ${totalTasks} tasks complete`,
      score: Math.round((completedTasks / Math.max(totalTasks, 1)) * 100),
      weight: 20,
      tip: "Complete more project tasks to validate the clinic model",
      icon: CheckCircle2,
    },
    {
      label: "Financial Model",
      desc: "Key assumptions populated",
      score: m && (m.rentGbp > 0 || m.wincAcvGbp > 100) ? Math.min(60 + launchReadiness / 3, 90) : 5,
      weight: 20,
      tip: "Populate your financial model in the Financials tab",
      icon: PoundSterling,
    },
    {
      label: "Property Secured",
      desc: activeProperty ? activeProperty.address ?? "Active property selected" : "No property selected",
      score: activeProperty ? 100 : 0,
      weight: 15,
      tip: "Select an active property in the Properties tab",
      icon: Building2,
    },
    {
      label: "CQC Compliance",
      desc: `${complianceScore}% complete`,
      score: complianceScore,
      weight: 15,
      tip: "Work through compliance requirements in the Compliance tab",
      icon: Shield,
    },
    {
      label: "Operations Documented",
      desc: `Operations manual ${opsCompletion}% complete`,
      score: opsCompletion,
      weight: 15,
      tip: "Complete the Operations Manual checklist below",
      icon: BookOpen,
    },
    {
      label: "Risk & Decisions",
      desc: `${decisionsCount} decision${decisionsCount !== 1 ? "s" : ""} logged`,
      score: Math.min(decisionsCount * 15, 100),
      weight: 10,
      tip: "Log key decisions and risks in the Decision Log",
      icon: AlertTriangle,
    },
    {
      label: "Brand & Marketing",
      desc: m?.marketingGbp > 0 ? `£${m.marketingGbp}/mo budget set` : "No marketing budget set",
      score: (m?.marketingGbp ?? 0) > 0 ? 80 : 5,
      weight: 5,
      tip: "Add a marketing budget in your financial model assumptions",
      icon: Star,
    },
  ], [completedTasks, totalTasks, launchReadiness, m, activeProperty, complianceScore, opsCompletion, decisionsCount]);

  const overallReadiness = useMemo(() => {
    const totalWeight = readinessDims.reduce((s, d) => s + d.weight, 0);
    const weighted = readinessDims.reduce((s, d) => s + (d.score * d.weight / 100), 0);
    return Math.round((weighted / totalWeight) * 100);
  }, [readinessDims]);

  const readinessLabel =
    overallReadiness >= 85 ? { text: "Ready to Scale", color: "text-primary", bg: "bg-primary/10" } :
    overallReadiness >= 70 ? { text: "Ready to Pilot", color: "text-emerald-600", bg: "bg-emerald-50" } :
    overallReadiness >= 40 ? { text: "Model Proving", color: "text-amber-600", bg: "bg-amber-50" } :
    { text: "Foundation Building", color: "text-destructive", bg: "bg-destructive/5" };

  // ─── Setup cost breakdown ─────────────────────────────────────────────────
  const setupCostLines = useMemo(() => [
    { label: "Fit-out & equipment (est.)", value: fitOutCost, note: "Based on Winchester project cost" },
    { label: "Property deposit (3 months)", value: (m?.rentGbp ?? 2700) * 3, note: "At current rent level" },
    { label: "Franchise fee", value: assumptions.franchiseFeeGbp, note: "Payable to franchisor" },
    { label: "Initial training", value: assumptions.trainingCostGbp, note: "5-day onboarding programme" },
    { label: "Legal & setup costs", value: assumptions.legalSetupGbp, note: "Franchisee's solicitor" },
    { label: "Working capital", value: monthlyFixedCosts * assumptions.workingCapitalMonths, note: `${assumptions.workingCapitalMonths} months fixed costs` },
    { label: "Contingency (10%)", value: Math.round(fitOutCost * 0.10), note: "Recommended buffer" },
  ], [fitOutCost, m, assumptions, monthlyFixedCosts]);

  const totalSetupCost = setupCostLines.reduce((s, l) => s + l.value, 0);

  // ─── Monthly franchisor income per unit ───────────────────────────────────
  const monthlyRoyalty = Math.round(monthlyRevenue * (assumptions.royaltyPercent / 100));
  const monthlyLevy = Math.round(monthlyRevenue * (assumptions.marketingLevyPercent / 100));
  const monthlyPerUnit = monthlyRoyalty + monthlyLevy + assumptions.techSupportMonthlyGbp;
  const annualPerUnit = monthlyPerUnit * 12;

  // ─── Toggle helpers ───────────────────────────────────────────────────────
  function toggleOpsItem(sectionId: string, itemId: string) {
    setOpsManual(prev => prev.map(s =>
      s.id !== sectionId ? s : {
        ...s, items: s.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)
      }
    ));
  }
  function toggleLegalItem(sectionId: string, itemId: string) {
    setLegalChecklist(prev => prev.map(s =>
      s.id !== sectionId ? s : {
        ...s, items: s.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)
      }
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
    { key: "readiness", label: "Readiness", icon: Sparkles },
    { key: "setup", label: "Setup Costs", icon: PoundSterling },
    { key: "income", label: "Income Model", icon: TrendingUp },
    { key: "territory", label: "Territories", icon: MapPin },
    { key: "package", label: "Package", icon: Package2 },
    { key: "operations", label: "Operations", icon: BookOpen },
    { key: "legal", label: "Legal", icon: Shield },
  ];

  const canConvert = overallReadiness >= 70;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Franchise Model"
        subtitle="Assess whether the Winchester clinic model is ready to be replicated — and project what that looks like financially."
        action={
          <Button
            size="sm"
            className="gap-2"
            disabled={!canConvert}
            onClick={() => canConvert
              ? toast({ title: "Coming soon", description: "This will package the Winchester clinic as a reusable franchise launch template. Available once the model is fully validated." })
              : undefined
            }
          >
            {canConvert ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {canConvert ? "Convert to Franchise Template" : `Locked (${overallReadiness}% ready)`}
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-0 -mb-0">
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

      {/* ─── READINESS ────────────────────────────────────────────────────── */}
      {tab === "readiness" && (
        <div className="space-y-6">
          {/* Score hero */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm border-border/60 flex flex-col items-center justify-center py-8 col-span-1">
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
                  : `Reach 70 to unlock the franchise template conversion.`
                }
              </p>
            </Card>

            <Card className="shadow-sm border-border/60 col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Readiness Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {readinessDims.map(dim => (
                  <div key={dim.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <dim.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{dim.label}</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">— {dim.desc}</span>
                      </div>
                      <span className={`text-xs font-semibold ${dim.score >= 70 ? "text-primary" : dim.score >= 40 ? "text-amber-600" : "text-destructive"}`}>
                        {dim.score}%
                      </span>
                    </div>
                    <Progress value={dim.score} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* What's needed */}
          {readinessDims.filter(d => d.score < 70).length > 0 && (
            <Card className="shadow-sm border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  What to address to reach 70%
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

          {/* Context note */}
          <Card className="shadow-sm border-border/60 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Network className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">The Clinic Launch OS validates the model. This module projects replication.</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A franchise is only as strong as its mother clinic. The Winchester clinic's operational data — costs, revenue, compliance, systems — forms the foundation of any franchise package. Build the mother clinic first, then scale.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── SETUP COSTS ──────────────────────────────────────────────────── */}
      {tab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assumptions */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Franchise Assumptions</CardTitle>
              <p className="text-xs text-muted-foreground">Adjust these to model different fee structures</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: "franchiseFeeGbp", label: "Initial Franchise Fee (£)", min: 0, step: 1000 },
                { key: "trainingCostGbp", label: "Training Cost (£)", min: 0, step: 500 },
                { key: "legalSetupGbp", label: "Franchisee Legal Setup (£)", min: 0, step: 500 },
                { key: "workingCapitalMonths", label: "Working Capital (months)", min: 1, step: 1 },
              ] as { key: keyof FranchiseAssumptions; label: string; min: number; step: number }[]).map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    min={f.min}
                    step={f.step}
                    value={assumptions[f.key]}
                    onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Breakdown */}
          <Card className="shadow-sm border-border/60 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Franchisee Total Investment Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">Estimated total capital required to open one franchised clinic</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {setupCostLines.map(line => (
                  <div key={line.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{line.label}</p>
                      <p className="text-xs text-muted-foreground">{line.note}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatGBP(line.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Total Investment Required</p>
                  <p className="text-xs text-muted-foreground">Per franchised clinic</p>
                </div>
                <span className="text-2xl font-bold text-primary">{formatGBP(totalSetupCost)}</span>
              </div>
              <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Note:</strong> Fit-out cost is estimated from the Winchester project cost ({formatGBP(fitOutCost)}). Actual franchisee fit-out may vary by property size, condition, and location. A surveyor's report and competitive tender should be obtained for each territory.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── INCOME MODEL ─────────────────────────────────────────────────── */}
      {tab === "income" && (
        <div className="space-y-6">
          {/* Per-unit income */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Franchisor Income Settings</CardTitle>
                <p className="text-xs text-muted-foreground">Income streams per active franchisee</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: "royaltyPercent", label: "Royalty Rate (%)", min: 0, max: 20, step: 0.5 },
                  { key: "marketingLevyPercent", label: "Marketing Levy (%)", min: 0, max: 10, step: 0.5 },
                  { key: "techSupportMonthlyGbp", label: "Tech & Support (£/mo)", min: 0, step: 50 },
                ] as { key: keyof FranchiseAssumptions; label: string; min: number; max?: number; step: number }[]).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      className="mt-1 h-8 text-sm"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={assumptions[f.key]}
                      onChange={e => setAssumptions(a => ({ ...a, [f.key]: Number(e.target.value) || 0 }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Per-Unit Monthly Income</CardTitle>
                <p className="text-xs text-muted-foreground">Based on {formatGBP(monthlyRevenue)}/mo clinic revenue at realistic occupancy</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: `Royalty (${assumptions.royaltyPercent}% of revenue)`, value: monthlyRoyalty },
                  { label: `Marketing levy (${assumptions.marketingLevyPercent}% of revenue)`, value: monthlyLevy },
                  { label: "Tech & support subscription", value: assumptions.techSupportMonthlyGbp },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm">{row.label}</span>
                    <span className="text-sm font-semibold">{formatGBP(row.value)}</span>
                  </div>
                ))}
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold">Total per unit/month</span>
                  <span className="text-lg font-bold text-primary">{formatGBP(monthlyPerUnit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Annualised per unit</span>
                  <span className="text-sm font-semibold">{formatGBP(annualPerUnit)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Multi-unit scenario table */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Scale Projections</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Franchisor total income across different network sizes</p>
                </div>
                <div className="flex gap-1">
                  {([1, 3, 5, 10] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setUnitCount(n)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        unitCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {n} unit{n !== 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {([1, 3, 5, 10] as const).map(n => {
                  const fees = n * assumptions.franchiseFeeGbp;
                  const annual = n * annualPerUnit;
                  const y1 = fees + annual;
                  const selected = n === unitCount;
                  return (
                    <div
                      key={n}
                      onClick={() => setUnitCount(n)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${
                        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{n} Franchisee{n !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Franchise fees</p>
                      <p className="text-sm font-semibold">{formatGBP(fees)}</p>
                      <p className="text-xs text-muted-foreground mt-2">Annual royalties</p>
                      <p className="text-sm font-semibold">{formatGBP(annual)}</p>
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Year 1 Total</p>
                        <p className={`text-base font-bold ${selected ? "text-primary" : ""}`}>{formatGBP(y1)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Year 1-3 breakdown for selected count */}
              <div className="rounded-lg bg-muted/40 border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{unitCount} Unit{unitCount !== 1 ? "s" : ""} — 3-Year Projection</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { year: "Year 1", income: unitCount * assumptions.franchiseFeeGbp + unitCount * annualPerUnit, note: "Fees + royalties" },
                    { year: "Year 2", income: unitCount * annualPerUnit, note: "Ongoing royalties" },
                    { year: "Year 3", income: unitCount * annualPerUnit * 1.1, note: "+10% revenue growth" },
                  ].map(y => (
                    <div key={y.year} className="text-center">
                      <p className="text-xs text-muted-foreground">{y.year}</p>
                      <p className="text-lg font-bold text-primary">{formatGBP(y.income)}</p>
                      <p className="text-[10px] text-muted-foreground">{y.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TERRITORY ────────────────────────────────────────────────────── */}
      {tab === "territory" && (
        <div className="space-y-4">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Territory Planner
              </CardTitle>
              <p className="text-xs text-muted-foreground">Plan geographic territories for future franchise expansion. Click a territory's status to cycle it.</p>
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
                      {t.population !== "—" && (
                        <span className="text-[10px] text-muted-foreground">Pop. {t.population}</span>
                      )}
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
                    {t.status === "mother_clinic" ? "Mother Clinic" : t.status === "sold" ? "Sold" : t.status === "reserved" ? "Reserved" : "Available"}
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
                  placeholder="Add territory (e.g. Portsmouth)"
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

          <Card className="shadow-sm border-border/60 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Territory sizing guidance:</strong> For an aesthetics clinic, a realistic exclusive territory covers a population of 30,000–100,000 within a 5-mile radius. Cities like Southampton would typically support 2–3 franchised clinics. Territories should be defined in the franchise agreement with postcode boundaries.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── PACKAGE ──────────────────────────────────────────────────────── */}
      {tab === "package" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {packageItems.filter(p => p.included).length} of {packageItems.length} items included. Toggle to customise the franchise package.
            </p>
          </div>
          {["Brand", "Training", "Systems", "Operations", "Marketing", "Support"].map(category => {
            const items = packageItems.filter(p => p.category === category);
            return (
              <Card key={category} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map(item => (
                    <div key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        item.included ? "bg-primary/5" : "bg-muted/40 opacity-60"
                      }`}
                      onClick={() => togglePackage(item.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.included ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {item.included && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm">{item.item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── OPERATIONS MANUAL ────────────────────────────────────────────── */}
      {tab === "operations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Operations manual completion: <strong className="text-foreground">{opsCompletion}%</strong></p>
            </div>
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
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => toggleOpsItem(section.id, item.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                      }`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── LEGAL ────────────────────────────────────────────────────────── */}
      {tab === "legal" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Legal readiness: <strong className="text-foreground">{legalCompletion}%</strong></p>
            <Progress value={legalCompletion} className="w-32 h-2" />
          </div>

          <Card className="shadow-sm border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>Always use a specialist franchise solicitor.</strong> Franchise law is a specialist area. The British Franchise Association (bfa) maintains a list of accredited solicitors. Do not adapt a standard commercial agreement — franchise agreements have specific disclosure, territory, and IP clauses that require specialist drafting.
                </p>
              </div>
            </CardContent>
          </Card>

          {legalChecklist.map(section => {
            const done = section.items.filter(i => i.done).length;
            return (
              <Card key={section.id} className="shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <span className="text-[10px] text-muted-foreground">{done}/{section.items.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => toggleLegalItem(section.id, item.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                      }`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          <Card className="shadow-sm border-border/60 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Recommended next step:</strong> Once the mother clinic has been trading profitably for 12 months, engage a franchise solicitor for an initial consultation. The bfa ({" "}
                <a href="https://www.thebfa.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">thebfa.org</a>
                {" "}) offers franchise health checks and a list of accredited advisers. Budget approximately £5,000–£15,000 for initial legal documentation.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
