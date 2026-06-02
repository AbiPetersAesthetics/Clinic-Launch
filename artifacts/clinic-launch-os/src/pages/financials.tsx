import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  useGetFinancialModel,
  getGetFinancialModelQueryKey,
  useUpsertFinancialModel,
  useCalculateFinancials,
  getGetOptimisationAnalysisQueryKey,
  getGetProjectDashboardQueryKey,
  useListFixedCostItems,
  getListFixedCostItemsQueryKey,
  useCreateFixedCostItem,
  useUpdateFixedCostItem,
  useDeleteFixedCostItem,
  useListProperties,
} from "@workspace/api-client-react";
import { formatGBP, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Save, AlertTriangle, Info, CheckCircle2, XCircle,
  Shield, ChevronRight, BarChart3, Building2, Target,
  Plus, Trash2, Sparkles, TrendingUp, TrendingDown, Activity,
  RefreshCw, Loader2, Wand2, Lock, Sliders,
  Banknote, Users, PieChart, Edit2, X, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ResetPageButton } from "@/components/reset-page-button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine,
  ComposedChart, Bar, ReferenceArea,
} from "recharts";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;
const VAT_THRESHOLD = 90000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = "conservative" | "realistic" | "aggressive" | "delayed_ramp" | "economic_downturn" | "stress_test";
type RampTier = "slow" | "average" | "fast";
type TreatmentEntry = { treatmentName: string; durationMins: number; revenueGbp: number; mixPercent: number; };
const RAMP_TIER_OPTIONS: { key: RampTier; label: string; desc: string }[] = [
  { key: "slow",    label: "Below Average", desc: "Word-of-mouth only, no waiting list — very gradual fill" },
  { key: "average", label: "Average",        desc: "Typical UK aesthetics launch with pre-opening marketing" },
  { key: "fast",    label: "Above Average",  desc: "Strong social presence, existing clients, waiting list" },
];
type VatPresetKey = "none" | "minimal" | "partial" | "significant" | "maximum";
const VAT_PRESETS: { key: VatPresetKey; label: string; rate: number; pct: string; note: string; starred?: boolean; worst?: boolean }[] = [
  { key: "none",        label: "No Offset",   rate: 0.20,  pct: "20.0%", note: "Current assumption — worst case", worst: true },
  { key: "minimal",     label: "Minimal",     rate: 0.175, pct: "17.5%", note: "Basic input tax recovery on stock and consumables only. Achievable without specialist advice." },
  { key: "partial",     label: "Partial",     rate: 0.15,  pct: "15.0%", note: "★ Typical for ANP-led clinics — most likely outcome with specialist advice.", starred: true },
  { key: "significant", label: "Significant", rate: 0.12,  pct: "12.0%", note: "Majority of arguable treatments claimed as exempt, full input recovery on remainder. Requires robust documentation." },
  { key: "maximum",     label: "Maximum",     rate: 0.09,  pct: "9.0%",  note: "Specialist adviser engaged, maximum legitimate recovery applied. Upper end — achievable where high proportion of treatments have clear medical indication." },
];
type TabKey = "overview" | "model" | "owner" | "risks" | "custom" | "investment";

type WincMetrics = {
  grossRevenue: number; fixedCosts: number; variableCosts: number;
  vatLiability: number; vatApplied: boolean;
  totalCosts: number; netProfit: number; grossMarginPercent: number; occupancyUsed: number;
  breakEvenRevenue: number; breakEvenOccupancy: number; treatmentsPerWeekToBreakeven: number;
  selfFundingOccupancy: number; sfNetProfitTarget: number; sfRevenueTarget: number;
  selfFundingBufferPercent: number; slotsPerMonth: number; warnings: string[];
};
type BedhMetrics = {
  grossRevenue: number; costs: number; netProfit: number;
};
type CombinedMetrics = {
  selfFundingTargetGbp: number; selfFundingMonth: number | null;
  preSelfFundingMonthlyNet: number; postSelfFundingMonthlyNet: number;
  bedhamptonMonthlySupport: number; totalBedhamptonSupport: number | null;
  monthlyRevenue: number; monthlyCosts: number; monthlyNetProfit: number;
  annualRevenue: number; annualNetProfit: number; vatThreshold: number;
  monthsUntilVatRegistration: number; vatRegistrationWarning: boolean; ebitda: number;
  // Combined turnover for VAT tracker: existing Bedhampton annual + Winchester annual
  combinedAnnualRevenue: number;
  vatCurrentTurnover: number;
};
type OwnerMetrics = {
  nursingIncome: number;
  phase1Income: number; phase1Shortfall: number; phase1IsSafe: boolean;
  phase2Income: number; phase2Shortfall: number; phase2IsSafe: boolean;
  phase3Income: number; phase3IsSafe: boolean;
  targetDrawings: number; cashRunwayMonths: number;
  minimumCashRequired: number; recommendedCash: number; runwaySavings: number;
  clinicExtractable: number; totalAvailableIncome: number; monthlyShortfall: number;
  isSafeToLeaveNursing: boolean;
};
type ExtendedCalcResult = {
  scenario: string; scenarioNote: string;
  winc: WincMetrics; bedh: BedhMetrics; combined: CombinedMetrics; owner: OwnerMetrics;
  monthlyRevenue: number; annualRevenue: number; monthlyFixedCosts: number;
  monthlyVariableCosts: number; monthlyTotalCosts: number; monthlyNetProfit: number;
  annualNetProfit: number; ebitda: number; cashRunwayMonths: number;
  breakEvenRevenueGbp: number; breakEvenOccupancyPercent: number;
  minimumViableRevenueGbp: number; safeOperatingThresholdGbp: number;
  occupancyUsedPercent: number; monthsUntilProfitable: number | null;
};
type CashflowMonth = {
  month: number; calendarLabel: string; monthLabel: string;
  isPreOpening: boolean; isOpeningMonth: boolean; isBedhamptonCloseMonth: boolean;
  wincRevenue: number; wincVariableCosts: number; wincFixedCosts: number; wincVat: number;
  wincCosts: number; wincNet: number;
  bedhRevenue: number; bedhCosts: number; bedhNet: number; bedhDualCosts: number;
  projectCostBurn: number; preOpenPropertyCost: number; taskLabels: string[];
  vatLiability: number; vatInputReclaim: number; netVatPosition: number; isVatRegistered: boolean;
  actualDrawings: number; targetDrawings: number; drawingsShortfall: number; drawingsActive: boolean;
  monthlyCashflow: number; cashBalance: number;
  occupancyPercent: number;
  additionalClinicianRevenue: number; additionalClinicianSalary: number;
  isSelfFundingMonth: boolean; bedhClosed: boolean;
  bedhSupport: number; combinedNet: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioKey, { label: string; description: string; color: string; badgeClass: string; planningNote?: string; planningNoteColor?: string }> = {
  conservative: {
    label: "Conservative", description: "40% occ, 8-mo ramp", color: "text-blue-600", badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    planningNote: "Use for monthly cash monitoring only — not for lease or planning decisions.",
    planningNoteColor: "border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300",
  },
  realistic: { label: "Realistic", description: "65% occ, 6-mo ramp", color: "text-primary", badgeClass: "bg-primary/10 text-primary" },
  aggressive: {
    label: "Strong Launch", description: "85% occ, 4-mo ramp", color: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    planningNote: "Ceiling scenario — do not use for planning. This represents the best case, not a base case.",
    planningNoteColor: "border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-300",
  },
  delayed_ramp: {
    label: "Delayed Ramp", description: "65% occ, 12-mo ramp", color: "text-amber-600", badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    planningNote: "Recommended base case for lease and financial planning decisions.",
    planningNoteColor: "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300",
  },
  economic_downturn: { label: "Economic Downturn", description: "−20% occ, −15% spend", color: "text-orange-600", badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  stress_test: { label: "Stress Test", description: "5% start, worst-case ramp", color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive" },
};

function makeRisks(c: string) {
  return [
    { threat: `${c} ramp too slow — Bedhampton never closes`, likelihood: "High", impact: "Critical", mitigation: `Pre-launch waitlist, soft-open to existing Bedhampton regulars who travel. Set a firm review gate at Month 6: if ${c} net < £8k, activate contingency plan.` },
    { threat: `Cash reserve depleted before ${c} is self-funding`, likelihood: "Medium", impact: "Critical", mitigation: "Maintain £20k operating buffer. Do not spend on non-essential capex until Month 3 revenue is confirmed. Bedhampton support covers this gap." },
    { threat: "Abi burnout running both clinics simultaneously", likelihood: "High", impact: "Very High", mitigation: `This is the biggest personal risk. Pre-agree with David: if ${c} hits £8k net, immediately reduce Bedhampton days. Do not wait for the self-funding margin target to be hit.` },
    { threat: `VAT registration pressure on ${c}`, likelihood: "Medium", impact: "High", mitigation: `Monitor ${c} rolling 12-month revenue. Appoint accountant before hitting 75% of £90k annual threshold.` },
    { threat: `${c} fit-out overruns delay opening`, likelihood: "Medium", impact: "High", mitigation: "Phase-gate spend. Keep £5k contingency unallocated. Dad's labour eliminates the biggest variable. Open date tied to Bedhampton income model." },
    { threat: "Marketing underperformance — slow first 3 months", likelihood: "High", impact: "Medium", mitigation: "Prioritise Google reviews and organic social. Avoid paid ads until organic baseline is established. Bedhampton income absorbs the shortfall." },
    { threat: "Bedhampton revenue weakens during dual-clinic phase", likelihood: "Low", impact: "High", mitigation: `Reduced Abi hours at Bedhampton may affect revenue. Model shows Bedhampton income is the safety net — any reduction lengthens the ${c} ramp period.` },
    { threat: `${c} never hits the self-funding margin — Bedhampton never closes`, likelihood: "Low", impact: "High", mitigation: `Set a formal review at Month 9. If ${c} net margin is below the buffer %, consider reducing the target % or accepting a longer Bedhampton exit timeline.` },
  ];
}

const LIKELI_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};
const IMPACT_COLOR: Record<string, string> = {
  Critical: "text-destructive font-bold",
  "Very High": "text-orange-600 font-semibold",
  High: "text-amber-600 font-medium",
  Medium: "text-foreground",
};

const PhaseChip = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {label}
  </span>
);

interface Clinician {
  id: string;
  name: string;
  isPrimary?: boolean;
  startDate: string | null;
  annualGrossSalaryGbp?: number;
  salaryGbp?: number; // backward compat
}

function calcPayeBreakdown(annualGross: number) {
  const g = Math.max(0, annualGross);
  const employeeNI = g > 12570
    ? (Math.min(g, 50270) - 12570) * 0.12 + (g > 50270 ? (g - 50270) * 0.02 : 0)
    : 0;
  const employerNI = g > 9100 ? (g - 9100) * 0.138 : 0;
  const employerPension = Math.max(0, Math.min(g, 50270) - 6240) * 0.03;
  const totalCostAnnual = g + employerNI + employerPension;
  const incomeTax = g > 12570
    ? (Math.min(g, 50270) - 12570) * 0.20 + (g > 50270 ? (Math.min(g, 125140) - 50270) * 0.40 : 0)
    : 0;
  return {
    annualGross: Math.round(g),
    employeeNI: Math.round(employeeNI),
    employerNI: Math.round(employerNI),
    employerPension: Math.round(employerPension),
    totalCostAnnual: Math.round(totalCostAnnual),
    totalCostMonthly: Math.round(totalCostAnnual / 12),
    incomeTax: Math.round(incomeTax),
    netMonthlyTakeHome: Math.round((g - employeeNI - incomeTax) / 12),
  };
}

const ABI_DEFAULT: Clinician = { id: "abi", name: "Abi Peters", isPrimary: true, startDate: null, annualGrossSalaryGbp: 0 };

export default function FinancialsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [scenario, setScenario] = useState<ScenarioKey>("realistic");
  const [rampTier, setRampTier] = useState<RampTier>("average");
  const [vatPreset, setVatPreset] = useState<VatPresetKey>("none");
  const activeVat = VAT_PRESETS.find(p => p.key === vatPreset) ?? VAT_PRESETS[0];

  const saveScenario = (key: ScenarioKey) => {
    setScenario(key);
    fetch(`/api/projects/${PROJECT_ID}/financial/scenario`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: key }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", PROJECT_ID] });
    }).catch(() => { /* non-fatal */ });
  };
  const [customOcc, setCustomOcc] = useState(65);
  const [aiQA, setAiQA] = useState({ q1: "", q2: "", q3: "", q4: "", q5: "" });

  // ── Treatment mix ─────────────────────────────────────────────────────────
  const [treatmentMix, setTreatmentMix] = useState<TreatmentEntry[]>([]);
  const treatmentMixSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced save of treatment mix to plannedPricingJson
  useEffect(() => {
    if (!model) return;
    clearTimeout(treatmentMixSaveTimer.current);
    treatmentMixSaveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${PROJECT_ID}/financial`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedPricingJson: JSON.stringify(treatmentMix) }),
      }).then(() => runCalculation()).catch(() => {});
    }, 800);
  }, [treatmentMix]);

  async function resetFinancials() {
    await fetch(`/api/projects/1/reset/financials`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
    queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
  }

  // ── Lifestyle plan — drives locked financial model fields ─────────────────
  const [lifestylePlan, setLifestylePlan] = useState<{
    clinicDays: string | string[];
    clinicOpenTime: string;
    clinicCloseTime: string;
    familyScheduleJson?: string;
    extrasJson?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${PROJECT_ID}/lifestyle`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLifestylePlan(data); })
      .catch(() => {});
  }, []);

  const derivedSchedule = useMemo(() => {
    if (!lifestylePlan) return null;
    const clinicDays: string[] = (() => {
      const v = lifestylePlan.clinicDays;
      if (Array.isArray(v)) return v;
      try { return JSON.parse(v ?? "[]"); } catch { return []; }
    })();
    const globalOpen  = lifestylePlan.clinicOpenTime  ?? "09:00";
    const globalClose = lifestylePlan.clinicCloseTime ?? "18:00";

    // Parse family schedule + per-day overrides so we can compute real hours
    const fs: Record<string, any> = (() => {
      try { return lifestylePlan.familyScheduleJson ? JSON.parse(lifestylePlan.familyScheduleJson) : {}; } catch { return {}; }
    })();
    const overrides: Record<string, { open: string; close: string }> = (() => {
      try {
        const ex = lifestylePlan.extrasJson ? JSON.parse(lifestylePlan.extrasJson) : {};
        return ex.dayTimeOverrides ?? {};
      } catch { return {}; }
    })();

    const t2m = (t: string) => { const [h, m] = (t ?? "00:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    const pw = fs.parkAndWalkMins ?? 5;

    // For each clinic day compute real available window after school-run constraints
    const dayHours = clinicDays.map(day => {
      const dayOpen  = overrides[day]?.open  ?? globalOpen;
      const dayClose = overrides[day]?.close ?? globalClose;
      let latestArr   = t2m(dayOpen);
      let earliestDep = t2m(dayClose);

      const isSat = day === "Sat";
      const ds: Record<string, any> = fs.daySchedules?.[day] ?? {};
      const loc = ds.clinicLocation ?? "winchester";
      const isBedh = loc === "bedhampton";

      if (!isSat) {
        // Drop constraints — Abi drops → arrives clinic after school drop + travel
        if (ds.elsy?.dropBy === "Abi") {
          const st = t2m(ds.elsy?.dropTime ?? fs.elsySchoolStart ?? "09:00");
          const tc = isBedh ? (fs.travelElsyToBedhamptonMins ?? 15) : (fs.travelElsyToClinicMins ?? 30);
          latestArr = Math.max(latestArr, st + tc + pw);
        }
        if (ds.eli?.dropBy === "Abi") {
          const st = t2m(ds.eli?.dropTime ?? fs.eliSchoolStart ?? "09:00");
          const tc = isBedh ? (fs.travelEliToBedhamptonMins ?? 15) : (fs.travelEliToClinicMins ?? 40);
          latestArr = Math.max(latestArr, st + tc + pw);
        }
        // Pickup constraints — Abi picks up → must leave clinic before school finish + travel
        if (ds.elsy?.pickupBy === "Abi") {
          const pt = t2m(ds.elsy?.pickupTime ?? fs.elsySchoolFinish ?? "15:30");
          const fc = isBedh ? (fs.travelBedhamptonToElsyMins ?? 10) : (fs.travelClinicToElsyMins ?? 35);
          earliestDep = Math.min(earliestDep, pt - fc - pw);
        }
        if (ds.eli?.pickupBy === "Abi") {
          const pt = t2m(ds.eli?.pickupTime ?? fs.eliSchoolFinish ?? "15:30");
          const fc = isBedh ? (fs.travelBedhamptonToEliMins ?? 10) : (fs.travelClinicToEliMins ?? 40);
          earliestDep = Math.min(earliestDep, pt - fc - pw);
        }
      }
      return Math.max(0, (earliestDep - latestArr) / 60);
    });

    const avgHoursPerDay = dayHours.length > 0
      ? Math.round((dayHours.reduce((s, h) => s + h, 0) / dayHours.length) * 4) / 4
      : 0;

    return {
      daysPerMonth:    Math.round(clinicDays.length * (365 / 12 / 7) * 2) / 2,
      hoursPerDay:     avgHoursPerDay,
      clinicDaysCount: clinicDays.length,
    };
  }, [lifestylePlan]);

  // ── Fixed cost items (dynamic, replaces hardcoded fixed cost fields) ──────
  const { data: fixedCostItems = [] } = useListFixedCostItems(PROJECT_ID, {
    query: { queryKey: getListFixedCostItemsQueryKey(PROJECT_ID), enabled: true },
  });
  const { data: propertiesData = [] } = useListProperties(PROJECT_ID);
  const activeProp = (propertiesData as any[]).find((p: any) => p.isActiveForProject);
  const clinicLabel = activeProp
    ? (() => {
        const parts = (activeProp.address || "").split(",");
        if (parts.length >= 2) return parts[1].trim();
        if (activeProp.postcode) return activeProp.postcode.split(" ")[0];
        return parts[0].trim() || "new clinic";
      })()
    : "new clinic";
  const risks = makeRisks(clinicLabel);

  const createFixedCostItem = useCreateFixedCostItem();
  const updateFixedCostItem = useUpdateFixedCostItem();
  const deleteFixedCostItem = useDeleteFixedCostItem();

  const [newCostName, setNewCostName] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");
  const [newCostType, setNewCostType] = useState<"unique" | "dual">("unique");

  const totalDynamicFixedCosts = fixedCostItems.reduce((s, i) => s + (i.amountGbp || 0), 0);

  const handleAddCostItem = async () => {
    if (!newCostName.trim() || !newCostAmount) return;
    await createFixedCostItem.mutateAsync({
      projectId: PROJECT_ID,
      data: { name: newCostName.trim(), amountGbp: Number(newCostAmount), costType: newCostType, sortOrder: fixedCostItems.length },
    });
    queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
    setNewCostName("");
    setNewCostAmount("");
    setNewCostType("unique");
  };

  const handleUpdateCostItem = async (id: number, field: string, value: string | number) => {
    await updateFixedCostItem.mutateAsync({ id, data: { [field]: value } });
    queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
    // Recalculate after cost change
    if (model) runCalculation();
  };

  const handleDeleteCostItem = async (id: number) => {
    await deleteFixedCostItem.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
    if (model) runCalculation();
  };

  // ── AI cost assessment ─────────────────────────────────────────────────────
  const [aiAssessing, setAiAssessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    estimates: { name: string; estimatedMonthly: number; reasoning: string }[];
    additionalCosts: { name: string; estimatedMonthly: number; costType: string; reasoning: string }[];
    flags: string[];
  } | null>(null);

  const handleAiAssess = async () => {
    setAiAssessing(true);
    setAiSuggestions(null);
    try {
      const res = await fetch("/api/ai/assess-property-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: PROJECT_ID }),
      });
      const data = await res.json();
      setAiSuggestions(data);
    } catch (e) {
      toast({ title: "AI assessment failed", variant: "destructive" });
    } finally {
      setAiAssessing(false);
    }
  };

  const applyAiEstimate = async (name: string, amount: number) => {
    const existing = fixedCostItems.find(i => i.name === name);
    if (existing) {
      await handleUpdateCostItem(existing.id, "amountGbp", amount);
    }
  };

  const applyAiAdditionalCost = async (cost: { name: string; estimatedMonthly: number; costType: string }) => {
    await createFixedCostItem.mutateAsync({
      projectId: PROJECT_ID,
      data: { name: cost.name, amountGbp: cost.estimatedMonthly, costType: cost.costType as "unique" | "dual", sortOrder: fixedCostItems.length },
    });
    queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
  };
  const search = useSearch();
  const [tab, setTab] = useState<TabKey>(() => {
    const p = new URLSearchParams(search);
    const t = p.get("tab") as TabKey | null;
    const VALID: TabKey[] = ["overview", "model", "owner", "risks", "custom", "investment"];
    return (t && VALID.includes(t)) ? t : "overview";
  });
  useEffect(() => {
    const params = new URLSearchParams(search);
    const t = params.get("tab") as TabKey | null;
    const VALID: TabKey[] = ["overview", "model", "owner", "risks", "custom", "investment"];
    if (t && VALID.includes(t)) setTab(t);
  }, [search]);
  const [calcResults, setCalcResults] = useState<ExtendedCalcResult | null>(null);

  // ── Investment & Ownership state ──────────────────────────────────────────
  const [investments, setInvestments] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [investmentSummary, setInvestmentSummary] = useState<any>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [additionalClinicians, setAdditionalClinicians] = useState<Clinician[]>([ABI_DEFAULT]);
  const [addingInvType, setAddingInvType] = useState<"loan" | "equity" | null>(null);
  const [addingShareholder, setAddingShareholder] = useState(false);
  const [valuationMultiple, setValuationMultiple] = useState<5 | 7 | 10>(7);
  const [selectedInvTier, setSelectedInvTier] = useState<"low" | "medium" | "high" | null>(null);
  const [editingInv, setEditingInv] = useState<any | null>(null);
  const [editingSh, setEditingSh] = useState<any | null>(null);
  const [newInv, setNewInv] = useState({ name: "", amountGbp: "", equityPercent: "", interestRatePercent: "", repaymentTermMonths: "", depositDate: "", agreementStartDate: "", firstPaymentDate: "", notes: "" });
  const [newSh, setNewSh] = useState({ name: "", role: "", equityPercent: "", notes: "" });

  // ── AI Funding Adviser state ───────────────────────────────────────────────
  const [fundingAnalysis, setFundingAnalysis] = useState<any>(null);
  const [fundingAnalysisLoading, setFundingAnalysisLoading] = useState(false);
  const [fundingAnalysisError, setFundingAnalysisError] = useState<string | null>(null);
  const [fundingContextNote, setFundingContextNote] = useState("");

  const loadInvestmentData = useCallback(async (scenarioKey = "realistic", rampTierKey = "average") => {
    setInvLoading(true);
    try {
      const nc = { cache: "no-store" } as RequestInit;
      const [invRes, shRes, sumRes, faRes] = await Promise.all([
        fetch(`/api/projects/${PROJECT_ID}/investments`, nc),
        fetch(`/api/projects/${PROJECT_ID}/shareholders`, nc),
        fetch(`/api/projects/${PROJECT_ID}/investment-summary?scenario=${scenarioKey}&rampTier=${rampTierKey}`, nc),
        fetch(`/api/projects/${PROJECT_ID}/funding-analysis`, nc),
      ]);
      if (invRes.ok) setInvestments(await invRes.json());
      if (shRes.ok) setShareholders(await shRes.json());
      if (sumRes.ok) setInvestmentSummary(await sumRes.json());
      if (faRes.ok) {
        const fa = await faRes.json();
        if (fa) setFundingAnalysis(fa);
      }
    } finally {
      setInvLoading(false);
    }
  }, []);

  const runFundingAnalysis = useCallback(async () => {
    setFundingAnalysisLoading(true);
    setFundingAnalysisError(null);
    try {
      const r = await fetch(`/api/projects/${PROJECT_ID}/funding-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextNote: fundingContextNote }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Analysis failed");
      }
      const data = await r.json();
      setFundingAnalysis(data);
    } catch (e: any) {
      setFundingAnalysisError(e.message ?? "Analysis failed — please try again.");
    } finally {
      setFundingAnalysisLoading(false);
    }
  }, [fundingContextNote]);

  useEffect(() => {
    if (tab === "investment") loadInvestmentData(scenario, rampTier);
  }, [tab, scenario, rampTier, loadInvestmentData]);

  const invalidateCashflow = () =>
    queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("cashflow") });

  const addInvestment = async () => {
    const type = addingInvType ?? "loan";
    const payload = { name: newInv.name, type, amountGbp: parseFloat(newInv.amountGbp) || 0, equityPercent: parseFloat(newInv.equityPercent) || 0, interestRatePercent: parseFloat(newInv.interestRatePercent) || 0, repaymentTermMonths: parseInt(newInv.repaymentTermMonths) || 0, depositDate: newInv.depositDate || null, agreementStartDate: newInv.agreementStartDate || null, firstPaymentDate: newInv.firstPaymentDate || null, notes: newInv.notes };
    await fetch(`/api/projects/${PROJECT_ID}/investments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setNewInv({ name: "", amountGbp: "", equityPercent: "", interestRatePercent: "", repaymentTermMonths: "", depositDate: "", agreementStartDate: "", firstPaymentDate: "", notes: "" });
    setAddingInvType(null);
    await loadInvestmentData();
    invalidateCashflow();
  };
  const deleteInvestment = async (id: number) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    await loadInvestmentData();
    invalidateCashflow();
  };
  const saveEditInv = async () => {
    if (!editingInv) return;
    await fetch(`/api/investments/${editingInv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingInv) });
    setEditingInv(null);
    await loadInvestmentData();
    invalidateCashflow();
  };

  const addShareholder = async () => {
    await fetch(`/api/projects/${PROJECT_ID}/shareholders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSh.name, role: newSh.role, equityPercent: parseFloat(newSh.equityPercent) || 0, notes: newSh.notes }) });
    setNewSh({ name: "", role: "", equityPercent: "", notes: "" });
    setAddingShareholder(false);
    await loadInvestmentData();
  };
  const deleteShareholder = async (id: number) => {
    await fetch(`/api/shareholders/${id}`, { method: "DELETE" });
    await loadInvestmentData();
  };
  const saveEditSh = async () => {
    if (!editingSh) return;
    await fetch(`/api/shareholders/${editingSh.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingSh) });
    setEditingSh(null);
    await loadInvestmentData();
  };

  // ── Live Bedhampton data ──────────────────────────────────────────────────
  type BLiveSummary = {
    revenueThisMonth: number; projectedMonthRevenue: number; lastMonthRevenue: number;
    avgClientSpend: number; appointmentsThisMonth: number; repeatClientPct: number;
    revenueGrowthPct: number; topTreatment: string; totalRevenue: number;
    revenueMtd: number; revenueMtdNet: number; projectedMonthRevenueNet: number;
    avgGrossMarginPct: number;
  };
  type BLiveMonth = { month: string; revenue: number; appointmentCount: number; };
  type BLiveData = {
    summary: BLiveSummary;
    recentMonths: BLiveMonth[]; fetchedAt: string;
  };
  const [bLive, setBLive] = useState<BLiveData | null>(null);
  const [bLiveLoading, setBLiveLoading] = useState(true);
  const [bLiveError, setBLiveError] = useState(false);
  const [bLiveSyncing, setBLiveSyncing] = useState(false);
  const [bLiveSyncResult, setBLiveSyncResult] = useState<{ avg3m: number; rollingTotal: number; impliedVariablePct: number } | null>(null);

  const loadBedhamptonLive = () => {
    setBLiveLoading(true);
    setBLiveError(false);
    fetch("/api/bedhampton/summary")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: BLiveData) => { setBLive(d); setBLiveLoading(false); })
      .catch(() => { setBLiveError(true); setBLiveLoading(false); });
  };

  const syncBedhamptonFromLive = async () => {
    setBLiveSyncing(true);
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/financial/sync-bedhampton`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      setBLiveSyncResult({ avg3m: data.avg3m, rollingTotal: data.rollingTotal, impliedVariablePct: data.impliedVariablePct });
      // Reload the financial model to reflect updated values
      queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
      queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("cashflow") });
      toast({ title: "Bedhampton data synced", description: `Revenue set to £${data.avg3m.toLocaleString()}/mo (3-month average from live data)` });
    } catch {
      toast({ title: "Sync failed", description: "Could not reach Bedhampton data — try again.", variant: "destructive" });
    } finally {
      setBLiveSyncing(false);
    }
  };

  useEffect(() => { loadBedhamptonLive(); }, []);

  const { data: model, isLoading: isModelLoading } = useGetFinancialModel(PROJECT_ID, {
    query: {
      queryKey: getGetFinancialModelQueryKey(PROJECT_ID),
      enabled: true,
      // Disable focus/reconnect refetches — those are the ones that reset the
      // form mid-edit. Mount-time refetch is kept so coming back to the page
      // always loads the latest saved DB values.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const { data: cashflow } = useQuery<CashflowMonth[]>({
    queryKey: ["cashflow", PROJECT_ID, scenario, rampTier, activeVat.rate],
    queryFn: () =>
      fetch(`/api/projects/${PROJECT_ID}/cashflow?scenario=${scenario}&rampTier=${rampTier}&vatRate=${activeVat.rate}`)
        .then((r) => r.json()),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const [pnlMonths, setPnlMonths] = useState<12 | 36>(12);
  const { data: cashflow36 } = useQuery<CashflowMonth[]>({
    queryKey: ["cashflow36", PROJECT_ID, scenario, rampTier, activeVat.rate],
    queryFn: () =>
      fetch(`/api/projects/${PROJECT_ID}/cashflow?scenario=${scenario}&rampTier=${rampTier}&months=36&vatRate=${activeVat.rate}`)
        .then((r) => r.json()),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const pnlData = pnlMonths === 36 ? cashflow36 : cashflow;

  const upsertModel = useUpsertFinancialModel();
  const calculateFinancials = useCalculateFinancials();

  const runCalculation = () => {
    calculateFinancials.mutate(
      { projectId: PROJECT_ID, data: { scenario, rampTier, vatRate: activeVat.rate } as any },
      { onSuccess: (data) => setCalcResults(data as unknown as ExtendedCalcResult) }
    );
  };

  const form = useForm({
    defaultValues: {
      rentGbp: 0, ratesGbp: 0, vatOnRent: false,
      utilitiesGbp: 0, internetGbp: 0, insuranceGbp: 0,
      accountantGbp: 0, softwareGbp: 0, wasteContractGbp: 0, cleanerGbp: 0,
      subscriptionsGbp: 0, financeRepaymentsGbp: 0,
      stockPercent: 0, marketingGbp: 0, staffingGbp: 0, commissionsPercent: 0, consumablesGbp: 0,
      wincAcvGbp: 0, selfFundingBufferPercent: 20,
      treatmentRoomsCount: 1, practitionerHoursPerDay: 7,
      workingDaysPerMonth: 17, conservativeOccupancyPercent: 0, realisticOccupancyPercent: 0,
      aggressiveOccupancyPercent: 0, repeatBookingRatePercent: 60, membershipRevenueGbp: 0,
      existingClinicRevenueGbp: 0, bedhStockPercent: 35, bedhCapacityCeilGbp: 16000,
      bedhRentGbp: 0, bedhSoftwareGbp: 0, bedhStaffingGbp: 0, bedhInsuranceGbp: 0, bedhMarketingGbp: 0, bedhamptonCostsGbp: 0,
      ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0, vatCurrentTurnoverGbp: 0, vatRegistrationDate: "", bedhMembershipRevenueGbp: 0,
      preOpeningPropertyMonths: 2,
      freeRentMonths: 0,
      nursingIncomeGbp: 4500, targetDrawingsGbp: 4000,
      schoolFeesGbp: 0, travelGbp: 0, otherHouseholdGbp: 0,
    }
  });

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSilentReset = useRef(false);
  // Tracks the latest unsaved values so we can flush them on unmount
  const pendingValuesRef = useRef<Record<string, any> | null>(null);

  const processValues = (values: Record<string, any>) => {
    const { vatOnRent: vatOnRentVal, additionalCliniciansJson: cliniciansRaw, vatRegistrationDate: vatRegDate, ...rest } = values;
    return {
      ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Number(v) || 0])),
      vatOnRent: Boolean(vatOnRentVal),
      // Preserve as-is — must not be coerced to a number
      additionalCliniciansJson: typeof cliniciansRaw === "string" ? cliniciansRaw : JSON.stringify(cliniciansRaw ?? []),
      vatRegistrationDate: vatRegDate ?? "",
      // These map to integer DB columns — must be whole numbers
      workingDaysPerMonth: Math.round(Number(values.workingDaysPerMonth) || 17),
      practitionerHoursPerDay: Math.round(Number(values.practitionerHoursPerDay) || 7),
    };
  };

  const doSave = useCallback((values: Record<string, any>) => {
    const processed = processValues(values);
    setSaveStatus("saving");
    upsertModel.mutate({ projectId: PROJECT_ID, data: processed }, {
      onSuccess: () => {
        // Do NOT invalidate the financial model query — that triggers form.reset()
        // which overwrites anything the user has typed since the last save started.
        // The form values already ARE the saved state; no refetch needed.
        queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
        // Invalidate cashflow so chart + P&L table reflect new capital/assumptions immediately
        queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("cashflow") });
        runCalculation();
        setSaveStatus("saved");
        pendingValuesRef.current = null;
      },
      onError: () => setSaveStatus("unsaved"),
    });
  }, []);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (isSilentReset.current) return;
      pendingValuesRef.current = values as Record<string, any>;
      setSaveStatus("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        doSave(values as Record<string, any>);
      }, 800);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Flush any pending save immediately on unmount.
      // Use raw fetch — React Query mutation may already be cleaned up.
      if (pendingValuesRef.current) {
        const processed = processValues(pendingValuesRef.current);
        pendingValuesRef.current = null;
        fetch(`/api/projects/${PROJECT_ID}/financial`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(processed),
        }).catch(() => {});
      }
    };
  }, [form, doSave]);

  useEffect(() => {
    if (model) {
      const m = model as any;
      isSilentReset.current = true;
      form.reset({
        rentGbp: m.rentGbp ?? 0, ratesGbp: m.ratesGbp ?? 0, vatOnRent: m.vatOnRent ?? false,
        utilitiesGbp: m.utilitiesGbp ?? 0, internetGbp: m.internetGbp ?? 0,
        insuranceGbp: m.insuranceGbp ?? 0, accountantGbp: m.accountantGbp ?? 0,
        softwareGbp: m.softwareGbp ?? 0, wasteContractGbp: m.wasteContractGbp ?? 0,
        cleanerGbp: m.cleanerGbp ?? 0, subscriptionsGbp: m.subscriptionsGbp ?? 0,
        financeRepaymentsGbp: m.financeRepaymentsGbp ?? 0,
        stockPercent: m.stockPercent ?? 0, marketingGbp: m.marketingGbp ?? 0,
        staffingGbp: m.staffingGbp ?? 0, commissionsPercent: m.commissionsPercent ?? 0,
        consumablesGbp: m.consumablesGbp ?? 0,
        wincAcvGbp: m.wincAcvGbp ?? 0, selfFundingBufferPercent: m.selfFundingBufferPercent ?? 20,
        treatmentRoomsCount: m.treatmentRoomsCount ?? 1,
        practitionerHoursPerDay: derivedSchedule?.hoursPerDay ?? m.practitionerHoursPerDay ?? 7,
        workingDaysPerMonth: derivedSchedule?.daysPerMonth ?? m.workingDaysPerMonth ?? 17,
        conservativeOccupancyPercent: m.conservativeOccupancyPercent ?? 0,
        realisticOccupancyPercent: m.realisticOccupancyPercent ?? 0,
        aggressiveOccupancyPercent: m.aggressiveOccupancyPercent ?? 0,
        repeatBookingRatePercent: m.repeatBookingRatePercent ?? 60,
        membershipRevenueGbp: m.membershipRevenueGbp ?? 0,
        existingClinicRevenueGbp: m.existingClinicRevenueGbp ?? 0, bedhStockPercent: m.bedhStockPercent ?? 35,
        bedhCapacityCeilGbp: m.bedhCapacityCeilGbp ?? 16000,
        bedhRentGbp: m.bedhRentGbp ?? 0, bedhSoftwareGbp: m.bedhSoftwareGbp ?? 0,
        bedhStaffingGbp: m.bedhStaffingGbp ?? 0, bedhInsuranceGbp: m.bedhInsuranceGbp ?? 0,
        bedhMarketingGbp: m.bedhMarketingGbp ?? 0, bedhamptonCostsGbp: m.bedhamptonCostsGbp ?? 0,
        ownerDrawingsGbp: m.ownerDrawingsGbp ?? 0, runwaySavingsGbp: m.runwaySavingsGbp ?? 0, bedhMembershipRevenueGbp: (m as any).bedhMembershipRevenueGbp ?? 0,
        vatCurrentTurnoverGbp: m.vatCurrentTurnoverGbp ?? 0,
        vatRegistrationDate: (m as any).vatRegistrationDate ?? "",
        personalSalaryNeedsGbp: m.personalSalaryNeedsGbp ?? 0,
        preOpeningPropertyMonths: m.preOpeningPropertyMonths ?? 2,
        freeRentMonths: m.freeRentMonths ?? 0,
        nursingIncomeGbp: m.nursingIncomeGbp ?? 4500,
        targetDrawingsGbp: m.targetDrawingsGbp ?? 4000,
        schoolFeesGbp: (m as any).schoolFeesGbp ?? 0,
        travelGbp: (m as any).travelGbp ?? 0,
        otherHouseholdGbp: (m as any).otherHouseholdGbp ?? 0,
        additionalCliniciansJson: (m as any).additionalCliniciansJson ?? "[]",
      });
      // Restore the previously selected scenario
      if (m.selectedScenario) setScenario(m.selectedScenario as ScenarioKey);
      // Load treatment mix from plannedPricingJson
      try {
        const pj = m.plannedPricingJson;
        if (pj) { const parsed = JSON.parse(pj); if (Array.isArray(parsed)) setTreatmentMix(parsed); }
      } catch {}
      // Parse clinicians — ensure Abi is always the first (primary) entry
      try {
        const raw = (m as any).additionalCliniciansJson;
        const parsed: Clinician[] = raw ? JSON.parse(raw) : [];
        const hasAbi = Array.isArray(parsed) && parsed.some((c: Clinician) => c.isPrimary === true);
        if (!hasAbi) parsed.unshift({ ...ABI_DEFAULT });
        setAdditionalClinicians(Array.isArray(parsed) ? parsed : [{ ...ABI_DEFAULT }]);
      } catch { setAdditionalClinicians([{ ...ABI_DEFAULT }]); }
      // Allow watch subscription to fire again after reset settles
      setTimeout(() => { isSilentReset.current = false; }, 50);
      setSaveStatus("saved");
      runCalculation();
    }
  }, [model]);

  useEffect(() => { if (model) runCalculation(); }, [scenario]);
  useEffect(() => { if (model) runCalculation(); }, [rampTier]);
  useEffect(() => { if (model) runCalculation(); }, [vatPreset]);

  // ── Sync derived schedule values into form whenever lifestyle plan updates ─
  useEffect(() => {
    if (!derivedSchedule) return;
    // Use isSilentReset so this doesn't trigger "unsaved" or a debounced save.
    // The values will be included in the next real user-triggered save anyway.
    isSilentReset.current = true;
    form.setValue("workingDaysPerMonth" as any, derivedSchedule.daysPerMonth);
    form.setValue("practitionerHoursPerDay" as any, derivedSchedule.hoursPerDay);
    setTimeout(() => { isSilentReset.current = false; }, 50);
  }, [derivedSchedule]);

  // ── AI Proposal state ──────────────────────────────────────────────────────
  type AiFixedCost = {
    name: string; category: string; amountGbp: number; reasoning: string;
    confidence: "high" | "medium" | "low"; isEssential: boolean;
    matchesExisting: boolean; existingItemId: number | null;
    costType?: string;
  };
  type AiProposal = {
    fixedCosts: AiFixedCost[];
    variableCosts: Record<string, any>;
    revenue: Record<string, any>;
    flags: string[];
    generatedAt: string;
  };

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiChecked, setAiChecked] = useState<Record<string, boolean>>({});
  const [aiApplying, setAiApplying] = useState(false);
  const [applyVarRev, setApplyVarRev] = useState(true);

  const handleGenerateAssumptions = async () => {
    setAiGenerating(true);
    setAiProposal(null);
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/financial/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setAiProposal(data);
      // Pre-check all essential items by default
      const checked: Record<string, boolean> = {};
      (data.fixedCosts ?? []).forEach((fc: AiFixedCost) => {
        checked[fc.name] = fc.isEssential !== false;
      });
      setAiChecked(checked);
      setTab("model");
    } catch {
      toast({ title: "AI generation failed", description: "You can still enter assumptions manually.", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyProposal = async () => {
    if (!aiProposal) return;
    setAiApplying(true);
    try {
      const selectedCosts = aiProposal.fixedCosts.filter(fc => aiChecked[fc.name]);
      const body: any = { fixedCosts: selectedCosts };
      if (applyVarRev) {
        body.variableCosts = aiProposal.variableCosts;
        body.revenue = aiProposal.revenue;
      }
      const res = await fetch(`/api/projects/${PROJECT_ID}/financial/apply-proposal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Apply failed");
      queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
      queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
      setAiProposal(null);
      toast({ title: `${selectedCosts.length} assumptions applied`, description: "Review the form below and save when ready." });
    } catch {
      toast({ title: "Failed to apply assumptions", variant: "destructive" });
    } finally {
      setAiApplying(false);
    }
  };

  // Auto-trigger AI generation if navigated here with ?generate=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("generate") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("model");
      handleGenerateAssumptions();
    }
  }, []);

  const onSubmit = (values: Record<string, any>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    doSave(values);
    toast({ title: "Saved", description: "Assumptions updated." });
  };

  const watchAll = form.watch();

  // Dynamic scenario descriptions — show actual % from assumptions inputs
  const getScenarioDesc = (key: ScenarioKey): string => {
    const conservOcc = Number(watchAll.conservativeOccupancyPercent) || 0;
    const realistOcc = Number(watchAll.realisticOccupancyPercent) || 0;
    const aggressOcc = Number(watchAll.aggressiveOccupancyPercent) || 0;
    switch (key) {
      case "conservative":     return conservOcc ? `${conservOcc}% occ, 8-mo ramp` : SCENARIOS.conservative.description;
      case "realistic":        return realistOcc ? `${realistOcc}% occ, 6-mo ramp` : SCENARIOS.realistic.description;
      case "aggressive":       return aggressOcc ? `${aggressOcc}% occ, 4-mo ramp` : SCENARIOS.aggressive.description;
      case "delayed_ramp":     return realistOcc ? `${realistOcc}% occ, 12-mo ramp` : SCENARIOS.delayed_ramp.description;
      case "economic_downturn": {
        const downturnOcc = conservOcc ? Math.round(conservOcc * 0.8) : 0;
        return downturnOcc ? `${downturnOcc}% occ, −15% spend` : "−20% on conservative, −15% spend";
      }
      case "stress_test": {
        const stressOcc = conservOcc ? Math.max(Math.round(conservOcc * 0.65), 12) : 0;
        return stressOcc ? `${stressOcc}% occ, worst-case` : SCENARIOS.stress_test.description;
      }
      default: return SCENARIOS[key as ScenarioKey].description;
    }
  };

  // Custom model tab — live P&L (client-side, no server call needed)
  const cp_acv    = Number(watchAll.wincAcvGbp) || 0;
  const cp_rooms  = Number(watchAll.treatmentRoomsCount) || 1;
  const cp_hpd    = Number(watchAll.practitionerHoursPerDay) || 7;
  const cp_dpm    = Number(watchAll.workingDaysPerMonth) || 17;
  const cp_stock  = Number(watchAll.stockPercent) || 0;
  const cp_memb   = Number(watchAll.membershipRevenueGbp) || 0;
  const cp_slots  = cp_rooms * cp_hpd * cp_dpm;
  const cp_booked = cp_slots * (customOcc / 100);
  const cp_rev    = cp_booked * cp_acv + cp_memb;
  const cp_varRatio = cp_stock / 100;
  const cp_varCost  = cp_rev * cp_varRatio;
  const cp_fixCost  = totalDynamicFixedCosts;
  const cp_net      = cp_rev - cp_varCost - cp_fixCost;
  const cp_margin   = cp_rev > 0 ? ((cp_rev - cp_varCost) / cp_rev) * 100 : 0;
  const cp_denom    = cp_acv * cp_slots * (1 - cp_varRatio);
  const cp_beOcc    = cp_denom > 0 ? Math.min(Math.round((cp_fixCost / cp_denom) * 100), 999) : 0;
  const customPnl = {
    slotsPerMonth: cp_slots, bookedSlots: cp_booked, grossRevenue: cp_rev,
    variableCosts: cp_varCost, fixedCosts: cp_fixCost, netProfit: cp_net,
    grossMargin: cp_margin, breakEvenOcc: cp_beOcc,
  };

  const totalFixedCosts = ['rentGbp','ratesGbp','utilitiesGbp','internetGbp','insuranceGbp','accountantGbp','softwareGbp','wasteContractGbp','cleanerGbp','subscriptionsGbp','financeRepaymentsGbp']
    .reduce((s, k) => s + (Number(watchAll[k as keyof typeof watchAll]) || 0), 0);

  const rampData = useMemo(() => cashflow?.filter(m => !m.isPreOpening).map((m) => ({ monthLabel: m.calendarLabel, occupancy: m.occupancyPercent })) ?? [], [cashflow]);
  const selfFundingPoint = useMemo(() => cashflow?.find(m => m.isSelfFundingMonth), [cashflow]);


  // Bedhampton data health check: compare the manual model figure against the live
  // 3-month average. recentMonths is already sorted ascending by the API (YYYY-MM sort).
  // Warn if divergence exceeds 20% — a sign the model assumptions are stale.
  const bedhHealthCheck = useMemo(() => {
    if (!bLive || !model) return null;
    const modelledRevenue = (model as any).existingClinicRevenueGbp ?? 0;
    if (modelledRevenue <= 0) return null;
    const last3 = bLive.recentMonths.slice(-3);
    if (last3.length === 0) return null;
    const liveAvg3m = last3.reduce((s, m) => s + m.revenue, 0) / last3.length;
    if (liveAvg3m <= 0) return null;
    const divergencePct = Math.round(Math.abs(modelledRevenue - liveAvg3m) / liveAvg3m * 100);
    if (divergencePct <= 20) return null;
    const direction = modelledRevenue > liveAvg3m ? "overstated" : "understated";
    return { divergencePct, direction, modelledRevenue, liveAvg3m };
  }, [bLive, model]);

  const cr = calcResults;
  const sc = SCENARIOS[scenario];

  const healthScore = useMemo(() => {
    if (!cr) return null;
    const financial = cr.owner.cashRunwayMonths >= 12 ? 90 : cr.owner.cashRunwayMonths >= 6 ? 60 : 30;
    const growth = Math.min((cr.winc.occupancyUsed / 85) * 100, 100);
    const selfFunding = cr.combined.selfFundingMonth !== null
      ? Math.max(100 - cr.combined.selfFundingMonth * 6, 20)
      : 15;
    const owner = cr.owner.phase2IsSafe ? 85 : Math.max(50 - cr.owner.phase2Shortfall / 100, 10);
    const cash = Math.min((cr.owner.runwaySavings / Math.max(cr.owner.minimumCashRequired, 1)) * 100, 100);
    return { financial, growth, selfFunding, owner, cash };
  }, [cr]);

  if (isModelLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-24 bg-muted rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted rounded" /><div className="h-80 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Expansion Modelling"
          subtitle={`${clinicLabel} ramps to self-sufficiency, supported by Bedhampton income. Bedhampton closes when ${clinicLabel} hits the target.`}
          action={
            <ResetPageButton
              pageLabel="Financial Model"
              description="Resets all financial assumptions back to their starting defaults and removes any custom fixed cost items you have added. Your property data, project plan, and all other pages are completely untouched."
              onReset={resetFinancials}
            />
          }
        />
        {cr?.scenarioNote && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong className={sc.color}>{sc.label}:</strong> {cr.scenarioNote}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS[ScenarioKey]][]).map(([key, s]) => (
            <button key={key} onClick={() => saveScenario(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                scenario === key ? `${s.badgeClass} border-current` : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}>
              {s.label}
              {key === "delayed_ramp" && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide opacity-80">★ Base</span>}
              <span className="ml-1.5 opacity-60 hidden sm:inline">{getScenarioDesc(key)}</span>
            </button>
          ))}
        </div>
        {sc.planningNote && (
          <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${sc.planningNoteColor}`}>
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Planning note:</strong> {sc.planningNote}</span>
          </div>
        )}

        {/* ── Ramp Growth Tier ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Growth rate:</span>
          </div>
          <div className="flex gap-1.5">
            {RAMP_TIER_OPTIONS.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setRampTier(key)}
                title={desc}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                  rampTier === key
                    ? key === "slow"
                      ? "bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                      : key === "fast"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700"
                      : "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {rampTier !== "average" && (
            <span className="text-[10px] text-muted-foreground italic">
              {rampTier === "slow"
                ? "Opening occupancy ~30% of baseline — realistic for a brand-new location with no waiting list"
                : "Opening occupancy ~45% higher than baseline — assumes strong pre-launch demand"}
            </span>
          )}
        </div>
      </div>

      {/* ── VAT Offset Selector ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">VAT offset:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VAT_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setVatPreset(p.key)}
                title={p.note}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                  vatPreset === p.key
                    ? p.worst
                      ? "bg-red-50 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700"
                      : p.starred
                      ? "bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700"
                      : "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {p.label} — {p.pct}
                {p.worst && vatPreset === p.key && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide opacity-80">current</span>}
                {p.starred && vatPreset === p.key && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide opacity-80">★ Typical</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {/* Preset description */}
          <p className={activeVat.starred ? "text-emerald-700 dark:text-emerald-400 font-medium" : activeVat.worst ? "text-red-600 dark:text-red-400 font-medium" : ""}>{activeVat.note}</p>

          {/* Monthly saving / opportunity line — derived from live cashflow, not the async calc mutation */}
          {(() => {
            // Average VAT-registered month revenue (Winchester + Bedhampton combined) from cashflow
            const vatMonths = (cashflow ?? []).filter(m => m.isVatRegistered);
            if (vatMonths.length === 0) return null;
            const avgRev = vatMonths.reduce((s, m) => s + m.wincRevenue + m.bedhRevenue, 0) / vatMonths.length;
            if (activeVat.key === "none") {
              const partialSaving = Math.round(avgRev * (0.20 - 0.15));
              const maxSaving = Math.round(avgRev * (0.20 - 0.09));
              return (
                <p>At this scenario's revenue, switching to <strong className="text-foreground">Partial (★ typical)</strong> could save approximately <strong className="text-foreground">£{partialSaving.toLocaleString()}/month</strong>; Maximum could save <strong className="text-foreground">£{maxSaving.toLocaleString()}/month</strong>. These savings flow directly to net profit.</p>
              );
            } else {
              const saving = Math.round(avgRev * (0.20 - activeVat.rate));
              return (
                <p>Moving from No Offset to <strong className="text-foreground">{activeVat.label}</strong> is worth approximately <strong className="text-foreground">£{saving.toLocaleString()}/month</strong> at this scenario's revenue level — flowing directly to net profit with no change to clinical operations.</p>
              );
            }
          })()}

          {/* Specialist disclaimer — always visible */}
          <p className="text-muted-foreground/70 italic">UK aesthetics VAT is complex — HMRC distinguishes between medical treatments (potentially exempt) and cosmetic treatments (standard-rated). Confirm your actual position with a healthcare VAT specialist before selecting below Partial.</p>
        </div>
      </div>

      {/* ─── Warnings ────────────────────────────────────────────────────────── */}
      {cr?.winc.warnings && cr.winc.warnings.length > 0 && (
        <div className="space-y-1.5">
          {cr.winc.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span>Warning: {w}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Executive Summary Cards ─────────────────────────────────────────── */}
      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Card 1: Winchester Net */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`rounded-xl border p-4 cursor-default ${(cr?.winc.netProfit ?? 0) > 0 ? "border-border/60 bg-card" : "border-destructive/20 bg-destructive/5"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{clinicLabel} Net</span>
                  <BarChart3 className="w-4 h-4 text-primary/50" />
                </div>
                <div className={`text-xl font-bold ${(cr?.winc.netProfit ?? 0) > 0 ? "text-foreground" : "text-destructive"}`}>{cr ? formatGBP(cr.winc.netProfit) : "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cr ? `${cr.winc.occupancyUsed}% occ · ${cr.winc.slotsPerMonth} slots/mo` : ""}
                </div>
              </div>
            </TooltipTrigger>
            {cr && (
              <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-56 font-normal">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{clinicLabel} monthly P&L</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross revenue</span>
                      <span className="font-medium">{formatGBP(cr.winc.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/70">
                      <span>Fixed costs</span>
                      <span>−{formatGBP(cr.winc.fixedCosts)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/70">
                      <span>Variable costs</span>
                      <span>−{formatGBP(cr.winc.variableCosts)}</span>
                    </div>
                    {cr.winc.vatApplied && (
                      <div className="flex justify-between text-destructive/70">
                        <span>VAT liability</span>
                        <span>−{formatGBP(cr.winc.vatLiability)}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                      <span>Net profit</span>
                      <span className={(cr.winc.netProfit ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{formatGBP(cr.winc.netProfit)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gross margin</span>
                      <span>{cr.winc.grossMarginPercent.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  Break-even: {cr.winc.breakEvenOccupancy.toFixed(0)}% occ · {cr.winc.treatmentsPerWeekToBreakeven.toFixed(1)} treatments/wk
                </div>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Card 2: Bedhampton Support */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bedhampton Support</span>
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold">{cr ? formatGBP(cr.bedh.netProfit) : "—"}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Closes at {cr?.winc.selfFundingBufferPercent ?? 20}% margin · ~{formatGBP(cr?.winc.sfNetProfitTarget ?? 0)}/mo net
                </div>
              </div>
            </TooltipTrigger>
            {cr && (
              <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-56 font-normal">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Bedhampton monthly</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross revenue</span>
                      <span className="font-medium">{formatGBP(cr.bedh.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/70">
                      <span>Costs (stock + wages)</span>
                      <span>−{formatGBP(cr.bedh.costs)}</span>
                    </div>
                    <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                      <span>Net to {clinicLabel}</span>
                      <span className="text-blue-600 dark:text-blue-400">{formatGBP(cr.bedh.netProfit)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  Closes when {clinicLabel} net ≥ {cr.winc.selfFundingBufferPercent}% of its own revenue ({formatGBP(cr.winc.sfNetProfitTarget)}/mo)
                </div>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Card 3: Bedhampton Closes */}
          {(() => {
            const sfMonth = cashflow36?.find(m => m.isSelfFundingMonth);
            const found = !!sfMonth;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`rounded-xl border p-4 cursor-default ${found ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bedhampton Closes</span>
                      <Target className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className={`text-xl font-bold ${found ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                      {cashflow36 ? (found ? sfMonth!.calendarLabel : "> 36 mo") : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {found
                        ? `Abi full-time at ${clinicLabel} from ${sfMonth!.calendarLabel}`
                        : `${clinicLabel} doesn't hit ${cr?.winc.selfFundingBufferPercent ?? 20}% margin within 36mo`}
                    </div>
                  </div>
                </TooltipTrigger>
                {cr && (
                  <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-60 font-normal">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Self-funding milestone</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required net/mo</span>
                          <span className="font-medium">{formatGBP(cr.winc.sfNetProfitTarget)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required revenue/mo</span>
                          <span className="font-medium">{formatGBP(cr.winc.sfRevenueTarget)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required occupancy</span>
                          <span className="font-medium">{cr.winc.selfFundingOccupancy.toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current scenario occ.</span>
                          <span className={`font-medium ${cr.winc.occupancyUsed >= cr.winc.selfFundingOccupancy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>{cr.winc.occupancyUsed}%</span>
                        </div>
                        {found && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Winchester revenue then</span>
                            <span className="font-medium">{formatGBP(sfMonth!.wincRevenue)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                      Margin threshold: {cr.winc.selfFundingBufferPercent}% net-to-revenue. Once hit, Bedhampton days reduce and {clinicLabel} runs independently.
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })()}

          {/* Bedhampton dependency warning — shown when Bedhampton closes before Month 4 */}
          {cr?.combined.selfFundingMonth !== null && (cr?.combined.selfFundingMonth ?? 99) < 4 && (
            <div className="col-span-full flex items-start gap-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2.5 text-xs text-orange-800 dark:text-orange-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
              <span><strong>Warning —</strong> Winchester has not yet proven it can sustain fixed costs independently. Closing Bedhampton at Month {cr.combined.selfFundingMonth} removes the financial bridge before Winchester is established. Review the self-funding buffer % in Assumptions.</span>
            </div>
          )}

          {/* Rent-free period banner — only shown when freeRentMonths > 0 */}
          {(cr as any)?.freeRentMonths > 0 && (cr as any)?.wincFreeRent && (
            <div className="col-span-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Rent-Free Period Active</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">Pre-opening · {(cr as any).freeRentMonths} month{(cr as any).freeRentMonths > 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Pre-opening lease cost</div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatGBP((cr as any).wincFreeRent.fixedCosts)}/mo</div>
                  <div className="text-[10px] text-muted-foreground">rates only — rent waived</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Winchester break-even</div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">{(cr as any).wincFreeRent.breakEvenOccupancy.toFixed(0)}% occ</div>
                  <div className="text-[10px] text-muted-foreground">once rent starts: {cr.winc.breakEvenOccupancy.toFixed(0)}% occ</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total rent saved</div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatGBP((cr as any).rentLineAmount * (cr as any).freeRentMonths)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatGBP((cr as any).rentLineAmount)}/mo × {(cr as any).freeRentMonths} month{(cr as any).freeRentMonths > 1 ? "s" : ""} pre-opening</div>
                </div>
              </div>
            </div>
          )}

          {/* Card 4: Post-Opening Safety (not pre-opening capital runway) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`rounded-xl border p-4 cursor-default ${(cr?.owner.cashRunwayMonths ?? 0) >= 12 ? "border-border/60 bg-card" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Post-Opening Safety</span>
                  <Shield className="w-4 h-4 text-primary/50" />
                </div>
                <div className="text-xl font-bold">{cr ? (cr.owner.cashRunwayMonths >= 99 ? "Secure" : `${cr.owner.cashRunwayMonths} months`) : "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{cr ? `Winchester net vs £${(cr.owner.salaryTarget ?? 4000).toLocaleString()}/mo target` : ""}</div>
              </div>
            </TooltipTrigger>
            {cr && (
              <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-64 font-normal">
                <div className="px-3 pt-3 pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Post-opening operational safety</p>
                  <p className="text-[10px] text-muted-foreground mb-2.5">Does Winchester's net profit cover personal salary needs? This is NOT the pre-opening capital runway — see dashboard for that figure (currently 3 months).</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Salary target (assumed)</span>
                      <span className="font-medium">{formatGBP(cr.owner.salaryTarget ?? 4000)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Winchester net (at target occ)</span>
                      <span className="font-medium">{formatGBP(cr.winc?.netProfit ?? 0)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Savings buffer</span>
                      <span className="font-medium">{formatGBP(cr.owner.runwaySavings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min. operating cash</span>
                      <span className="font-medium">{formatGBP(cr.owner.minimumCashRequired)}</span>
                    </div>
                    <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                      <span>Status</span>
                      <span className={(cr.owner.cashRunwayMonths >= 12) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>
                        {cr.owner.cashRunwayMonths >= 99 ? "Secure — income exceeds target" : `${cr.owner.cashRunwayMonths} months`}
                      </span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Card 5: Month Abi takes full drawings */}
          {(() => {
            const fullDrawingsMonth = cashflow36?.find(
              m => m.drawingsActive && (m.drawingsShortfall ?? 1) === 0 && (m.actualDrawings ?? 0) > 0
            );
            const found = !!fullDrawingsMonth;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`rounded-xl border p-4 cursor-default ${found ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Full Drawings</span>
                      <TrendingUp className={`w-4 h-4 ${found ? "text-emerald-500" : "text-amber-500"}`} />
                    </div>
                    <div className={`text-xl font-bold ${found ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                      {cashflow36 ? (found ? fullDrawingsMonth!.calendarLabel : "> 36 mo") : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {found
                        ? `Full ${formatGBP(fullDrawingsMonth!.actualDrawings)}/mo from ${fullDrawingsMonth!.calendarLabel}`
                        : "Target drawings not met within 36 months"}
                    </div>
                  </div>
                </TooltipTrigger>
                {cr && (
                  <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-60 font-normal">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Owner drawings milestone</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Target drawings</span>
                          <span className="font-medium">{formatGBP(cr.owner.salaryTarget ?? 0)}/mo</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">First full month</span>
                          <span className="font-medium">{found ? fullDrawingsMonth!.calendarLabel : "Not within 36 mo"}</span>
                        </div>
                        {found && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Winchester revenue then</span>
                            <span className="font-medium">{formatGBP(fullDrawingsMonth!.wincRevenue)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                      Drawings are capped at the surplus above a £3,000/mo minimum business retention. Full drawings = no shortfall vs your target.
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })()}

          {/* Card 6: Break-even revenue */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-xl border border-border/60 bg-card p-4 cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Break-even</span>
                  <Activity className="w-4 h-4 text-primary/50" />
                </div>
                <div className="text-xl font-bold text-foreground">
                  {cr ? formatGBP(cr.winc.breakEvenRevenue) : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cr ? `${cr.winc.breakEvenOccupancy.toFixed(0)}% occupancy · ${cr.winc.treatmentsPerWeekToBreakeven.toFixed(1)} appts/wk` : ""}
                </div>
              </div>
            </TooltipTrigger>
            {cr && (
              <TooltipContent side="bottom" sideOffset={6} className="bg-background text-foreground border border-border shadow-xl p-0 rounded-xl w-60 font-normal">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Winchester break-even</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue needed</span>
                      <span className="font-medium">{formatGBP(cr.winc.breakEvenRevenue)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupancy needed</span>
                      <span className="font-medium">{cr.winc.breakEvenOccupancy.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Appointments/week</span>
                      <span className="font-medium">{cr.winc.treatmentsPerWeekToBreakeven.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total fixed costs</span>
                      <span className="font-medium">{formatGBP(cr.winc.fixedCosts)}/mo</span>
                    </div>
                    <div className="border-t border-border pt-1.5 flex justify-between">
                      <span className="text-muted-foreground">Current scenario rev</span>
                      <span className={`font-medium ${cr.winc.grossRevenue >= cr.winc.breakEvenRevenue ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {formatGBP(cr.winc.grossRevenue)}/mo
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  Revenue at which Winchester covers all fixed and variable costs. Assumes {cr.winc.occupancyUsed}% occupancy scenario.
                </div>
              </TooltipContent>
            )}
          </Tooltip>

        </div>
      </TooltipProvider>

      {/* ─── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto scrollbar-none">
        {(["overview", "model", "owner", "risks", "custom", "investment"] as TabKey[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "overview" ? "Overview" : t === "model" ? "Assumptions" : t === "owner" ? "Owner" : t === "risks" ? "Risks" : t === "investment" ? "Investment" : "Custom Model"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">

          {/* ── Live Bedhampton Performance ───────────────────────────────────── */}
          <Card className="shadow-sm border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/60 to-transparent dark:from-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm text-blue-700 dark:text-blue-300">Live Bedhampton Performance</CardTitle>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <button onClick={loadBedhamptonLive} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 ${bLiveLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <CardDescription className="text-xs">Real-time data from your Bedhampton clinic — the financial foundation for the {clinicLabel} launch.</CardDescription>
            </CardHeader>
            <CardContent>
              {bLiveLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted" />)}
                </div>
              )}
              {bLiveError && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Live data temporarily unavailable — check your analytics app.
                  <button onClick={loadBedhamptonLive} className="underline text-blue-500 ml-1">Retry</button>
                </div>
              )}
              {bLive && !bLiveLoading && (
                <div className="space-y-4">
                  {/* KPI row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-white/60 dark:bg-blue-950/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">This Month</div>
                      <div className="text-lg font-bold text-foreground">{formatGBP(bLive.summary.projectedMonthRevenue)}</div>
                      <div className={`flex items-center gap-1 text-xs mt-0.5 ${bLive.summary.revenueGrowthPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {bLive.summary.revenueGrowthPct >= 0
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />}
                        {bLive.summary.revenueGrowthPct > 0 ? "+" : ""}{bLive.summary.revenueGrowthPct}% vs last month
                      </div>
                    </div>
                    <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-white/60 dark:bg-blue-950/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Avg Client Spend</div>
                      <div className="text-lg font-bold text-foreground">{formatGBP(bLive.summary.avgClientSpend)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{bLive.summary.appointmentsThisMonth} appts this month</div>
                    </div>
                    <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-white/60 dark:bg-blue-950/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Repeat Rate</div>
                      <div className="text-lg font-bold text-foreground">{bLive.summary.repeatClientPct}%</div>
                      <div className="text-xs text-muted-foreground mt-0.5">client retention</div>
                    </div>
                    {bLive.summary.avgGrossMarginPct > 0 && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                          Gross Margin
                          <span className="inline-flex items-center gap-0.5 px-1 py-0 text-[9px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />LIVE
                          </span>
                        </div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{bLive.summary.avgGrossMarginPct}%</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatGBP(bLive.summary.projectedMonthRevenueNet)} net this month</div>
                      </div>
                    )}
                  </div>

                  {/* Sparkline */}
                  {bLive.recentMonths.length > 1 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Revenue trend (last {bLive.recentMonths.length} months)</div>
                      <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={bLive.recentMonths} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="bedLiveGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "currentColor" }} tickFormatter={(v: string) => { const [y, m] = v.split("-"); return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-GB", { month: "short" }); }} axisLine={false} tickLine={false} />
                            <RechartTooltip formatter={(v: number) => [formatGBP(v), "Revenue"]} contentStyle={{ background: "#fff", color: "#1a1a1a", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11 }} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#bedLiveGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground border-t border-blue-100 dark:border-blue-900 pt-2 flex justify-between">
                    <span>Top treatment: <strong>{bLive.summary.topTreatment}</strong></span>
                    <span>Total revenue to date: <strong>{formatGBP(bLive.summary.totalRevenue)}</strong></span>
                  </div>
                  {bedhHealthCheck && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        <strong>Model mismatch ({bedhHealthCheck.divergencePct}%):</strong> Your financial model uses {formatGBP(bedhHealthCheck.modelledRevenue)}/mo for Bedhampton, but the live 3-month average is {formatGBP(Math.round(bedhHealthCheck.liveAvg3m))}/mo — your model is {bedhHealthCheck.direction} by {bedhHealthCheck.divergencePct}%. Update <em>Bedhampton Monthly Revenue</em> in the Assumptions tab to reflect actual performance.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 12-Month Cash Position Chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">12-Month Cash Position</CardTitle>
              <CardDescription className="text-sm">
                Business capital burns through project setup costs, partially offset by Bedhampton net income. {clinicLabel} opens Nov '26 and starts recovering the position.
                {selfFundingPoint && (
                  <strong className="text-emerald-600 dark:text-emerald-400"> Bedhampton closes {selfFundingPoint.calendarLabel} once {clinicLabel} is self-funding.</strong>
                )}
                {" "}Set your <strong>Business Capital</strong> in the Assumptions → Personal &amp; Runway section to see the burndown from your actual starting point.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
                {cashflow && cashflow.length > 0 ? (() => {
                  const openingMonth = cashflow.find(m => m.isOpeningMonth);
                  const closeMonth = cashflow.find(m => m.isSelfFundingMonth);
                  const preOpenEnd = cashflow.find(m => m.isOpeningMonth);
                  const startingCapital = cashflow[0].cashBalance - cashflow[0].monthlyCashflow;
                  const allVals = [
                    ...cashflow.map(m => m.cashBalance),
                    ...cashflow.map(m => m.monthlyCashflow),
                    0,
                  ];
                  const rawMin = Math.min(...allVals);
                  const rawMax = Math.max(...allVals);
                  const pad = (rawMax - rawMin) * 0.08;
                  const yDomain: [number, number] = [
                    Math.floor((rawMin - pad) / 5000) * 5000,
                    Math.ceil((rawMax + pad) / 5000) * 5000,
                  ];
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={cashflow} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="calendarLabel"
                          axisLine={false} tickLine={false}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          dy={8} interval={1}
                        />
                        <YAxis
                          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                          axisLine={false} tickLine={false}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          domain={yDomain}
                          width={48}
                        />

                        {/* Pre-opening shaded region */}
                        {preOpenEnd && (
                          <ReferenceArea
                            x1={cashflow[0].calendarLabel}
                            x2={preOpenEnd.calendarLabel}
                            fill="hsl(var(--muted))"
                            fillOpacity={0.45}
                            label={{ value: "Pre-opening", position: "insideTopLeft", fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          />
                        )}

                        {/* Zero line */}
                        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />

                        {/* Starting capital reference */}
                        {startingCapital > 0 && (
                          <ReferenceLine
                            y={startingCapital}
                            stroke="#94a3b8"
                            strokeDasharray="5 3"
                            strokeWidth={1}
                            label={{ value: `Business capital £${(startingCapital / 1000).toFixed(0)}k`, position: "insideTopLeft", fontSize: 9, fill: "#94a3b8", dy: -10 }}
                          />
                        )}

                        {/* Winchester opening */}
                        {openingMonth && (
                          <ReferenceLine
                            x={openingMonth.calendarLabel}
                            stroke="hsl(var(--primary))"
                            strokeWidth={1.5}
                            strokeDasharray="6 3"
                            label={{ value: `${clinicLabel} opens`, position: "insideTopLeft", fontSize: 9, fill: "hsl(var(--primary))" }}
                          />
                        )}

                        {/* Bedhampton closes */}
                        {closeMonth && (
                          <ReferenceLine
                            x={closeMonth.calendarLabel}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="6 3"
                            label={{ value: "Bedhampton closes", position: "insideTopRight", fontSize: 9, fill: "#10b981" }}
                          />
                        )}

                        <RechartTooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload as CashflowMonth;
                            if (!d) return null;
                            return (
                              <div className="rounded-lg border shadow-md p-3 text-xs max-w-[280px]" style={{ background: "#fff", color: "#1a1a1a", borderColor: "#e2e8f0" }}>
                                <p className="font-semibold text-sm mb-2" style={{ color: "#1a1a1a" }}>{label}</p>
                                <div className="space-y-1">
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Business capital</span><span className="font-bold">{formatGBP(d.cashBalance)}</span></div>
                                  {d.bedhNet !== 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Bedhampton net</span><span className={d.bedhNet >= 0 ? "text-blue-600" : "text-destructive"}>{formatGBP(d.bedhNet)}</span></div>}
                                  {d.wincRevenue > 0 && (
                                    <div>
                                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">{clinicLabel} revenue</span><span>{formatGBP(d.wincRevenue)}</span></div>
                                      {(d.additionalClinicianRevenue ?? 0) > 0 && (
                                        <div className="flex justify-between gap-4 pl-2"><span className="text-muted-foreground text-[10px]">↳ Abi</span><span className="text-[10px]">{formatGBP(d.wincRevenue - (d.additionalClinicianRevenue ?? 0))}</span></div>
                                      )}
                                      {(d.additionalClinicianRevenue ?? 0) > 0 && (
                                        <div className="flex justify-between gap-4 pl-2"><span style={{color:"#a78bfa"}} className="text-[10px]">↳ Clinician</span><span className="text-[10px]" style={{color:"#a78bfa"}}>{formatGBP(d.additionalClinicianRevenue ?? 0)}</span></div>
                                      )}
                                      {(d.additionalClinicianSalary ?? 0) > 0 && (
                                        <div className="flex justify-between gap-4 pl-2"><span className="text-muted-foreground text-[10px]">↳ Salary cost</span><span className="text-red-500 text-[10px]">−{formatGBP(d.additionalClinicianSalary ?? 0)}</span></div>
                                      )}
                                    </div>
                                  )}
                                  {(d.wincVat ?? 0) > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Winc VAT ({activeVat.pct})</span><span className="text-amber-600">−{formatGBP(d.wincVat)}</span></div>}
                                  {d.wincNet !== 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">{clinicLabel} net</span><span className={d.wincNet >= 0 ? "text-emerald-600" : "text-destructive"}>{formatGBP(d.wincNet)}</span></div>}
                                  {d.projectCostBurn > 0 && (
                                    <div>
                                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Project spend</span><span className="text-red-500">−{formatGBP(d.projectCostBurn)}</span></div>
                                      {d.taskLabels?.length > 0 && (
                                        <ul className="mt-1 pl-2 space-y-0.5 text-muted-foreground">
                                          {d.taskLabels.slice(0, 5).map((t, idx) => <li key={idx} className="truncate">· {t}</li>)}
                                          {d.taskLabels.length > 5 && <li>· +{d.taskLabels.length - 5} more</li>}
                                        </ul>
                                      )}
                                    </div>
                                  )}
                                  {d.drawingsActive && (
                                    <div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Your drawings</span>
                                        <span className="text-orange-500">−{formatGBP(d.actualDrawings)}</span>
                                      </div>
                                      {d.drawingsShortfall > 0 && (
                                        <p className="text-amber-600 text-[10px] pl-2 mt-0.5">
                                          {formatGBP(d.drawingsShortfall)} short of target — clinic still ramping
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {!d.drawingsActive && !d.isPreOpening && (
                                    <p className="text-muted-foreground text-[10px]">No drawings yet — combined net below £3,000/mo floor</p>
                                  )}
                                  {(d.loanInflow ?? 0) > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Loan received</span><span className="text-emerald-600">+{formatGBP(d.loanInflow)}</span></div>}
                                  {(d.loanRepayments ?? 0) > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Loan repayment</span><span className="text-rose-500">−{formatGBP(d.loanRepayments)}</span></div>}
                                  <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                                    <span className="font-medium">{d.actualDrawings > 0 ? "To business capital" : "Monthly net"}</span>
                                    <span className={d.monthlyCashflow >= 0 ? "text-emerald-600 font-bold" : "text-destructive font-bold"}>{formatGBP(d.monthlyCashflow)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend
                          formatter={(v) =>
                            v === "cashBalance" ? "Business capital (running balance)"
                            : v === "monthlyCashflow" ? "Monthly net → business capital (after drawings)"
                            : v === "additionalClinicianRevenue" ? "Additional clinician revenue"
                            : v
                          }
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />

                        {/* Monthly net bars — context: shows monthly surplus/deficit driving the balance */}
                        <Bar
                          dataKey="monthlyCashflow"
                          name="monthlyCashflow"
                          fill="#93c5fd"
                          fillOpacity={0.7}
                          radius={[2, 2, 0, 0]}
                        />

                        {/* Additional clinician revenue — distinct bar, only visible after their start date */}
                        <Bar
                          dataKey="additionalClinicianRevenue"
                          name="additionalClinicianRevenue"
                          fill="#a78bfa"
                          fillOpacity={0.8}
                          radius={[2, 2, 0, 0]}
                        />

                        {/* Business capital area — the primary story */}
                        <Area
                          type="monotone"
                          dataKey="cashBalance"
                          name="cashBalance"
                          fill="url(#cashGradient)"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })() : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Save assumptions first, then set Business Capital in Assumptions → Personal &amp; Runway.</div>
                )}
              </div>

              {/* Key callouts */}
              {cashflow && cashflow.length > 0 && (() => {
                const minBalance = Math.min(...cashflow.map(m => m.cashBalance));
                const endBalance = cashflow[cashflow.length - 1].cashBalance;
                const startBalance = cashflow[0].cashBalance - cashflow[0].monthlyCashflow;
                const openMonth = cashflow.find(m => m.isOpeningMonth);
                return (
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Starting capital</div>
                      <div className="text-sm font-bold">{formatGBP(startBalance)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Lowest cash point</div>
                      <div className={`text-sm font-bold ${minBalance < 0 ? "text-destructive" : "text-amber-600"}`}>{formatGBP(minBalance)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Cash at month 12</div>
                      <div className={`text-sm font-bold ${endBalance >= startBalance ? "text-emerald-600" : "text-amber-600"}`}>{formatGBP(endBalance)}</div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Month-by-month breakdown table */}
          {cashflow && cashflow.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Monthly P&L Breakdown</CardTitle>
                  <div className="flex items-center border rounded-md overflow-hidden text-xs shrink-0">
                    <button
                      onClick={() => setPnlMonths(12)}
                      className={`px-3 py-1 transition-colors ${pnlMonths === 12 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >12 mo</button>
                    <button
                      onClick={() => setPnlMonths(36)}
                      className={`px-3 py-1 transition-colors ${pnlMonths === 36 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >36 mo</button>
                  </div>
                </div>
                <CardDescription className="text-sm">
                  Revenue, costs and VAT month by month. VAT turns on once rolling 12-month turnover crosses £90k.
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px]">
                    <span className="inline-block w-2 h-2 rounded-sm bg-primary/20 border border-primary/40" /> {clinicLabel} opens
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-200 dark:bg-emerald-800 border border-emerald-400 ml-1" /> Bedhampton closes
                    <span className="inline-block w-2 h-2 rounded-sm bg-amber-200 dark:bg-amber-800 border border-amber-400 ml-1" /> VAT registered
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground sticky left-0 bg-muted/40 min-w-[80px]">Month</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[52px]">
                          <span title="Clinic occupancy % for this month — shows how full the appointment book is">Occ %</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Winc Rev</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">
                          <span title="Stock %, commissions, marketing, staffing, consumables">Variable</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">
                          <span title="Gross profit = Winchester Revenue minus all variable costs (stock %, commissions, marketing, staffing, consumables). Before fixed overheads are deducted.">Gross</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">
                          <span title="All fixed cost items from Assumptions (rent, rates, insurance, dual costs — counted once)">Fixed (Winc)</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-purple-600 dark:text-purple-400 min-w-[80px]">
                          <span title="Abi's salary drawn from the business this month. Only paid when the combined monthly surplus (Winchester + Bedhampton) exceeds the £3,000/mo floor. Hover a month with drawings to see the estimated take-home after tax.">Salary</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-amber-600 dark:text-amber-400 min-w-[72px]">
                          <span title="Winchester VAT liability only. Bedhampton VAT is already deducted from Bedh Net.">Winc VAT ({activeVat.pct})</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">
                          <span title="Winchester only: Revenue − Variable − Fixed − VAT. Positive = Winchester covers its own costs without Bedhampton.">Winc ±</span>
                        </th>
                        <th className="text-right px-2 py-2 font-semibold text-blue-600 dark:text-blue-400 min-w-[80px]">
                          <span title="Bedhampton net profit after stock, running costs and VAT">Bedh Net</span>
                        </th>
                        {(pnlData ?? cashflow ?? []).some((m: any) => (m.loanRepayments ?? 0) > 0 || (m.loanInflow ?? 0) > 0) && (
                          <th className="text-right px-2 py-2 font-semibold text-rose-600 dark:text-rose-400 min-w-[80px]">
                            <span title="Monthly loan repayments deducted from net profit. Reduces the amount available for Abi's salary and business retention.">Loan Repay</span>
                          </th>
                        )}
                        <th className="text-right px-2 py-2 font-semibold text-orange-600 dark:text-orange-400 min-w-[80px]">
                          <span title="Project plan task costs charged this month (from Project Plan cost tiers). Undated tasks are spread across pre-opening months, weighted toward opening.">Proj costs</span>
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">
                          <span title="Combined net profit after Abi's salary has been taken. This is what accumulates in the business each month.">Net after Salary</span>
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pnlData ?? cashflow ?? []).map((m) => {
                        const isOpen = m.isOpeningMonth;
                        const isClose = m.isSelfFundingMonth;
                        const loanRepRow = m.loanRepayments ?? 0;
                        const loanInflowRow = m.loanInflow ?? 0;
                        const netProfitRow = m.wincNet + m.bedhNet - (m.actualDrawings ?? 0) - loanRepRow;
                        const grossProfitRow = m.wincRevenue - m.wincVariableCosts;

                        // ── Bedhampton cost breakdown ──────────────────────
                        const _bedhStockPct  = (model as any)?.bedhStockPercent ?? 35;
                        const _bedhStock     = Math.round(m.bedhRevenue * _bedhStockPct / 100);
                        const _bedhRent      = (model as any)?.bedhRentGbp ?? 0;
                        const _bedhMarketing = (model as any)?.bedhMarketingGbp ?? 0;
                        const _bedhOther     = (model as any)?.bedhamptonCostsGbp ?? 0;
                        const _bedhVat       = m.bedhVat ?? 0;

                        // ── Winchester variable cost breakdown ─────────────
                        const _wincStockPct  = (model as any)?.stockPercent ?? 0;
                        const _wincCommPct   = (model as any)?.commissionsPercent ?? 0;
                        const _wincStock     = Math.round(m.wincRevenue * _wincStockPct / 100);
                        const _wincComm      = Math.round(m.wincRevenue * _wincCommPct / 100);
                        const _wincMarketing = (model as any)?.marketingGbp ?? 0;
                        const _wincStaffing  = (model as any)?.staffingGbp ?? 0;
                        const _wincConsumables = (model as any)?.consumablesGbp ?? 0;
                        const _acv = (model as any)?.wincAcvGbp || 155;
                        const _totalSlots = Math.round(
                          ((model as any)?.treatmentRoomsCount || 1) *
                          ((model as any)?.practitionerHoursPerDay || 8) *
                          ((model as any)?.workingDaysPerMonth || 18)
                        );
                        const _appts = !m.isPreOpening && m.wincRevenue > 0 ? Math.round(m.wincRevenue / (_acv || 155)) : 0;
                        const _bookedSlots = Math.round(_totalSlots * (m.occupancyPercent || 0) / 100);
                        const rowBg = isClose
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : isOpen
                          ? "bg-primary/5"
                          : (m.wincVat ?? 0) > 0
                          ? "bg-amber-50/40 dark:bg-amber-950/10"
                          : "";
                        return (
                          <tr key={m.month} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${rowBg}`}>
                            <td className={`px-3 py-1.5 font-medium sticky left-0 ${rowBg || "bg-card"}`}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {m.calendarLabel}
                                {isOpen && <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">OPEN</span>}
                                {isClose && <span className="text-[9px] bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1 rounded font-bold">BEDH CLOSES</span>}
                                {m.isVatRegistered && !isClose && !isOpen && <span className="text-[9px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1 rounded">VAT</span>}
                                {m.calendarLabel === "Oct '26" && <span className="text-[9px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-1 rounded font-bold">HIGH RISK</span>}
                              </div>
                              {m.isPreOpening && <div className="text-[9px] text-muted-foreground">pre-open</div>}
                              {m.calendarLabel === "Oct '26" && (
                                <div className="text-[9px] text-red-600 dark:text-red-400 font-medium leading-tight mt-0.5">Highest risk month — pre-opening costs peak, zero Winchester revenue. Monitor cash closely.</div>
                              )}
                            </td>

                            {/* Occupancy % */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {m.isPreOpening
                                ? <span className="text-muted-foreground/30">—</span>
                                : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`font-medium cursor-help underline decoration-dotted underline-offset-2 ${m.occupancyPercent >= 60 ? "text-emerald-600 dark:text-emerald-400 decoration-emerald-400/60" : m.occupancyPercent >= 35 ? "text-amber-600 dark:text-amber-400 decoration-amber-400/60" : "text-muted-foreground decoration-muted-foreground/40"}`}>
                                        {m.occupancyPercent}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-56">
                                      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                        <p className="text-[11px] font-bold text-gray-900">Occupancy — {m.calendarLabel}</p>
                                        <p className="text-[10px] text-gray-500">{m.occupancyPercent}% of available appointment slots filled</p>
                                      </div>
                                      <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Appointments booked</span>
                                          <span className="tabular-nums font-semibold text-gray-900">{_bookedSlots}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Total slots available</span>
                                          <span className="tabular-nums text-gray-600">{_totalSlots}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-gray-100 pt-1.5 mt-0.5">
                                          <span className="text-gray-600">Revenue at £{_acv} ACV</span>
                                          <span className="tabular-nums font-semibold text-gray-900">{formatGBP(m.wincRevenue)}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-400 pt-0.5">{m.occupancyPercent < 35 ? "Below 35% — ramp phase, costs exceed revenue." : m.occupancyPercent < 60 ? "Growing — approaching break-even territory." : "Strong occupancy — above 60% target."}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              }
                            </td>

                            {/* Winchester Revenue */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {m.wincRevenue > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help underline decoration-dotted decoration-gray-400/50 underline-offset-2 font-medium">
                                      {formatGBP(m.wincRevenue)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-56">
                                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                      <p className="text-[11px] font-bold text-gray-900">Winchester revenue — {m.calendarLabel}</p>
                                    </div>
                                    <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Appointments</span>
                                        <span className="tabular-nums font-semibold text-gray-900">{_appts}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Avg. client value</span>
                                        <span className="tabular-nums text-gray-600">{formatGBP(_acv)}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-gray-100 pt-1.5 mt-0.5">
                                        <span className="font-bold text-gray-900">Total revenue</span>
                                        <span className="tabular-nums font-bold text-gray-900">{formatGBP(m.wincRevenue)}</span>
                                      </div>
                                      <p className="text-[9px] text-gray-400 pt-0.5">Based on {m.occupancyPercent}% occupancy at {_totalSlots} slots/mo. Update ACV in Assumptions.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>

                            {/* Winchester Variable (stock + commissions + mktg + staffing + consumables) */}
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {m.wincVariableCosts > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-red-500/70 cursor-help underline decoration-dotted decoration-red-400/50 underline-offset-2">
                                      ({formatGBP(m.wincVariableCosts)})
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-60">
                                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                      <p className="text-[11px] font-bold text-gray-900">Variable costs — {m.calendarLabel}</p>
                                      <p className="text-[10px] text-gray-500">Costs that scale with revenue</p>
                                    </div>
                                    <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                      {_wincStock > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Stock / products ({_wincStockPct}%)</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincStock)})</span>
                                        </div>
                                      )}
                                      {_wincComm > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Commissions ({_wincCommPct}%)</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincComm)})</span>
                                        </div>
                                      )}
                                      {_wincMarketing > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Marketing budget</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincMarketing)})</span>
                                        </div>
                                      )}
                                      {_wincStaffing > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Staffing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincStaffing)})</span>
                                        </div>
                                      )}
                                      {_wincConsumables > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Consumables</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincConsumables)})</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1">
                                        <span className="font-bold text-gray-900">Total variable</span>
                                        <span className="tabular-nums font-bold text-red-600">({formatGBP(m.wincVariableCosts)})</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground/30">—</span>}
                            </td>

                            {/* Gross Profit = Revenue − Variable */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {m.wincRevenue > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`font-medium cursor-help underline decoration-dotted underline-offset-2 ${grossProfitRow >= 0 ? "text-emerald-600 dark:text-emerald-400 decoration-emerald-400/60" : "text-destructive decoration-destructive/50"}`}>
                                      {grossProfitRow >= 0 ? "+" : ""}{formatGBP(grossProfitRow)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-56">
                                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                      <p className="text-[11px] font-bold text-gray-900">Gross profit — {m.calendarLabel}</p>
                                      <p className="text-[10px] text-gray-500">Revenue minus variable costs only</p>
                                    </div>
                                    <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Revenue</span>
                                        <span className="tabular-nums text-gray-900">{formatGBP(m.wincRevenue)}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Variable costs</span>
                                        <span className="tabular-nums text-red-600">({formatGBP(m.wincVariableCosts)})</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-0.5">
                                        <span className="font-bold text-gray-900">Gross profit</span>
                                        <span className={`tabular-nums font-bold ${grossProfitRow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                          {grossProfitRow >= 0 ? "+" : ""}{formatGBP(grossProfitRow)}
                                        </span>
                                      </div>
                                      <p className="text-[9px] text-gray-400 pt-0.5">Before fixed costs, VAT, and salary. Fixed costs are deducted in the Winchester ± column.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground/30">—</span>}
                            </td>

                            {/* Winchester Fixed — pre-opening shows lease property cost (rent+rates or rates-only if free-rent).
                                Post-opening always shows full fixed costs — free rent is a pre-opening benefit only. */}
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {(m.wincFixedCosts > 0 || (m.preOpenPropertyCost ?? 0) > 0) ? (
                                m.isPreOpening && (m.preOpenPropertyCost ?? 0) > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-red-500/70 cursor-help underline decoration-dotted underline-offset-2">
                                        ({formatGBP((m.preOpenPropertyCost ?? 0) + m.wincFixedCosts)})
                                        {(m as any).preOpenRentWaived > 0 && <span className="ml-1 text-[9px] text-emerald-600 font-bold">FREE RENT</span>}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-[220px]" style={{ background: "#fff", color: "#1a1a1a", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                      <p className="font-semibold mb-1">Pre-opening property</p>
                                      {(m as any).preOpenRentWaived > 0 ? (
                                        <>
                                          <p className="text-emerald-700 font-medium mb-0.5">Rent-free month — rates only</p>
                                          <p className="text-gray-600">Rates: {formatGBP(m.preOpenPropertyCost ?? 0)}</p>
                                          <p className="text-emerald-600">Rent waived: {formatGBP((m as any).preOpenRentWaived)}</p>
                                        </>
                                      ) : (
                                        <p className="text-gray-600">Rent + rates from lease signing: {formatGBP(m.preOpenPropertyCost ?? 0)}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-red-500/70 cursor-help underline decoration-dotted decoration-red-400/50 underline-offset-2">
                                        ({formatGBP(m.wincFixedCosts + (m.preOpenPropertyCost ?? 0))})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                        <p className="text-[11px] font-bold text-gray-900">Fixed costs — {m.calendarLabel}</p>
                                        <p className="text-[10px] text-gray-500">Monthly fixed overheads for Winchester</p>
                                      </div>
                                      <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                        {fixedCostItems.length > 0
                                          ? fixedCostItems.map((item) => (
                                              <div key={item.id} className="flex justify-between items-center">
                                                <span className="text-gray-600 truncate max-w-[55%]">
                                                  {item.name}
                                                  {item.costType === "dual" && <span className="ml-1 text-[9px] text-blue-500">(shared)</span>}
                                                </span>
                                                <span className="tabular-nums text-red-600">({formatGBP(item.amountGbp || 0)})</span>
                                              </div>
                                            ))
                                          : (
                                            <div className="flex justify-between items-center">
                                              <span className="text-gray-600">Total fixed</span>
                                              <span className="tabular-nums text-red-600">({formatGBP(m.wincFixedCosts)})</span>
                                            </div>
                                          )
                                        }
                                        {(m.additionalClinicianSalary ?? 0) > 0 && (
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Clinician salary</span>
                                            <span className="tabular-nums text-red-600">({formatGBP(m.additionalClinicianSalary ?? 0)})</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1">
                                          <span className="font-bold text-gray-900">Total</span>
                                          <span className="tabular-nums font-bold text-red-600">({formatGBP(m.wincFixedCosts)})</span>
                                        </div>
                                        <p className="text-[9px] text-gray-400 pt-0.5">Shared (dual) costs counted once here — not double-charged to Bedhampton.</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>

                            {/* Abi's Salary — positioned right after Fixed (Winc) */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {m.isPreOpening ? (
                                <span className="text-muted-foreground/30">—</span>
                              ) : m.drawingsActive && (m.actualDrawings ?? 0) > 0 ? (() => {
                                const gross = m.actualDrawings ?? 0;
                                const salaryPart = Math.min(gross, 1047);
                                const dividendPart = Math.max(0, gross - 1047);
                                const taxableDivs = Math.max(0, dividendPart - 42);
                                const estTax = Math.round(taxableDivs * 0.0875);
                                const estTakeHome = gross - estTax;
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-purple-600 dark:text-purple-400 font-medium cursor-help underline decoration-dotted decoration-purple-400/60 underline-offset-2">
                                        ({formatGBP(gross)})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                        <p className="text-[11px] font-bold text-gray-900">Abi's salary — {m.calendarLabel}</p>
                                        <p className="text-[10px] text-gray-500">Gross drawn from business</p>
                                      </div>
                                      <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Business pays out</span>
                                          <span className="tabular-nums font-semibold text-gray-900">{formatGBP(gross)}</span>
                                        </div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">Estimated tax split</div>
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Salary (within allowance)</span>
                                          <span className="tabular-nums text-gray-700">{formatGBP(salaryPart)}</span>
                                        </div>
                                        {dividendPart > 0 && (
                                          <div className="flex justify-between items-center pl-1">
                                            <span className="text-gray-500">Dividends at 8.75%</span>
                                            <span className="tabular-nums text-amber-600">−{formatGBP(estTax)} tax</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1.5">
                                          <span className="font-bold text-gray-900">Est. take-home</span>
                                          <span className="tabular-nums font-bold text-purple-700">{formatGBP(estTakeHome)}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-400 pt-0.5">Estimate only — assumes salary up to personal allowance (£12,570/yr), balance as dividends. Confirm split with your accountant.</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })() : m.drawingsActive ? (
                                <span className="text-muted-foreground/50 text-[10px]">ramping</span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>

                            {/* VAT cost: Winchester revenue × selected VAT rate, from registration date. Zero pre-opening (no Winc revenue). */}
                            <td className={`text-right px-2 py-1.5 tabular-nums ${(m.wincVat ?? 0) === 0 ? "text-muted-foreground/30" : "text-amber-600 dark:text-amber-400 font-medium"}`}>
                              {(m.wincVat ?? 0) === 0 ? "—" : `(${formatGBP(m.wincVat)})`}
                            </td>

                            {/* Winchester ± — rich hover showing full Winchester P&L */}
                            <td className={`text-right px-2 py-1.5 tabular-nums font-medium ${m.wincRevenue === 0 ? "text-muted-foreground/30" : m.wincNet > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                              {m.wincRevenue === 0 ? "—" : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help underline decoration-dotted decoration-emerald-400/60 underline-offset-2">
                                      {m.wincNet >= 0 ? "+" : ""}{formatGBP(m.wincNet)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                      <p className="text-[11px] font-bold text-gray-900">Winchester breakdown</p>
                                      <p className="text-[10px] text-gray-500">{m.calendarLabel}</p>
                                    </div>
                                    <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Revenue</span>
                                        <span className="tabular-nums font-semibold text-gray-900">{formatGBP(m.wincRevenue)}</span>
                                      </div>
                                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">Variable costs</div>
                                      {_wincStock > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Stock ({_wincStockPct}%)</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincStock)})</span>
                                        </div>
                                      )}
                                      {_wincComm > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Commissions ({_wincCommPct}%)</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincComm)})</span>
                                        </div>
                                      )}
                                      {fixedCostItems.length === 0 && _wincMarketing > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Marketing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincMarketing)})</span>
                                        </div>
                                      )}
                                      {fixedCostItems.length === 0 && _wincStaffing > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Staffing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincStaffing)})</span>
                                        </div>
                                      )}
                                      {fixedCostItems.length === 0 && _wincConsumables > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Consumables</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincConsumables)})</span>
                                        </div>
                                      )}
                                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">Fixed costs</div>
                                      {fixedCostItems.length > 0
                                        ? fixedCostItems.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center pl-1">
                                              <span className="text-gray-500 truncate max-w-[55%]">{item.name}</span>
                                              <span className="tabular-nums text-red-600">({formatGBP(item.amountGbp || 0)})</span>
                                            </div>
                                          ))
                                        : (
                                            <div className="flex justify-between items-center pl-1">
                                              <span className="text-gray-500">Total fixed</span>
                                              <span className="tabular-nums text-red-600">({formatGBP(m.wincFixedCosts)})</span>
                                            </div>
                                          )
                                      }
                                      {(m.additionalClinicianSalary ?? 0) > 0 && (
                                        <>
                                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">Clinician salary</div>
                                          <div className="flex justify-between items-center pl-1">
                                            <span className="text-gray-500">Monthly salary</span>
                                            <span className="tabular-nums text-red-600">({formatGBP(m.additionalClinicianSalary ?? 0)})</span>
                                          </div>
                                        </>
                                      )}
                                      {m.wincVat > 0 && (
                                        <>
                                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">VAT</div>
                                          <div className="flex justify-between items-center pl-1">
                                            <span className="text-gray-500">VAT liability (20%)</span>
                                            <span className="tabular-nums text-amber-600">({formatGBP(m.wincVat)})</span>
                                          </div>
                                        </>
                                      )}
                                      <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1.5">
                                        <span className="font-bold text-gray-900">Winchester net</span>
                                        <span className={`tabular-nums font-bold ${m.wincNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>{m.wincNet >= 0 ? "+" : ""}{formatGBP(m.wincNet)}</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>

                            {/* Bedhampton Net — rich hover breakdown */}
                            <td className={`text-right px-2 py-1.5 tabular-nums font-medium ${m.bedhClosed ? "text-muted-foreground/30 line-through" : m.bedhNet > 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>
                              {m.bedhClosed ? (
                                "closed"
                              ) : m.bedhRevenue === 0 ? (
                                <span className="text-muted-foreground/30">—</span>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help underline decoration-dotted decoration-blue-400/60 underline-offset-2">
                                      {formatGBP(m.bedhNet)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                      <p className="text-[11px] font-bold text-gray-900">Bedhampton breakdown</p>
                                      <p className="text-[10px] text-gray-500">{m.calendarLabel}</p>
                                    </div>
                                    <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Gross revenue</span>
                                        <span className="tabular-nums font-semibold text-gray-900">{formatGBP(m.bedhRevenue)}</span>
                                      </div>
                                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">Costs</div>
                                      {_bedhStock > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Stock / products ({_bedhStockPct}%)</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_bedhStock)})</span>
                                        </div>
                                      )}
                                      {_bedhRent > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Rent / premises</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_bedhRent)})</span>
                                        </div>
                                      )}
                                      {_bedhMarketing > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Marketing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_bedhMarketing)})</span>
                                        </div>
                                      )}
                                      {_bedhOther > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Other running</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_bedhOther)})</span>
                                        </div>
                                      )}
                                      {(m.bedhDualCosts ?? 0) > 0 ? (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Shared (dual) costs</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(m.bedhDualCosts)})</span>
                                        </div>
                                      ) : m.isPreOpening && fixedCostItems.every(i => i.costType !== "dual") ? (
                                        <div className="pl-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1 mt-0.5">
                                          ⚠ No shared costs tagged — go to Assumptions → Fixed Monthly Costs and mark accountant, insurance etc. as Dual.
                                        </div>
                                      ) : null}
                                      {_bedhVat > 0 && (
                                        <>
                                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pt-1">VAT</div>
                                          <div className="flex justify-between items-center pl-1">
                                            <span className="text-gray-500">VAT liability (20%)</span>
                                            <span className="tabular-nums text-amber-600">({formatGBP(_bedhVat)})</span>
                                          </div>
                                        </>
                                      )}
                                      <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1.5">
                                        <span className="font-bold text-gray-900">Net</span>
                                        <span className={`tabular-nums font-bold ${m.bedhNet >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatGBP(m.bedhNet)}</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>

                            {/* Loan Repayments — only rendered when any month has loan activity */}
                            {(pnlData ?? cashflow ?? []).some((m: any) => (m.loanRepayments ?? 0) > 0 || (m.loanInflow ?? 0) > 0) && (
                              <td className="text-right px-2 py-1.5 tabular-nums">
                                {loanInflowRow > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted decoration-emerald-400/60 underline-offset-2 text-emerald-600 dark:text-emerald-400 font-medium">
                                        +{formatGBP(loanInflowRow)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-[220px]">
                                      <p className="font-semibold">Loan deposit received</p>
                                      <p className="text-muted-foreground">{formatGBP(loanInflowRow)} capital inflow this month</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : loanRepRow > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted decoration-rose-400/60 underline-offset-2 text-rose-600 dark:text-rose-400">
                                        ({formatGBP(loanRepRow)})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-[220px]">
                                      <p className="font-semibold">Loan repayment</p>
                                      <p className="text-muted-foreground">{formatGBP(loanRepRow)}/mo deducted before salary calculation</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            )}

                            {/* Project task cost burn this month */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {(m.projectCostBurn ?? 0) > 0 ? (
                                m.taskLabels && m.taskLabels.length > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-orange-600 dark:text-orange-400 cursor-help underline decoration-dotted decoration-orange-400/60 underline-offset-2">
                                        ({formatGBP(m.projectCostBurn)})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-[240px] p-0" style={{ background: "#fff", color: "#1a1a1a", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                        <p className="font-semibold text-[11px]">Project plan tasks this month</p>
                                      </div>
                                      <ul className="px-3 py-2 space-y-0.5 text-[11px]">
                                        {m.taskLabels.map((label, i) => (
                                          <li key={i} className="text-gray-700 truncate max-w-[210px]">• {label}</li>
                                        ))}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-orange-600 dark:text-orange-400">({formatGBP(m.projectCostBurn)})</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>

                            {/* Combined Net Profit */}
                            <td className={`text-right px-3 py-1.5 tabular-nums font-semibold ${netProfitRow > 0 ? "text-emerald-600 dark:text-emerald-400" : netProfitRow < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-gray-400/50">
                                    {formatGBP(netProfitRow)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                    <p className="text-[11px] font-bold text-gray-900">Net after Salary — {m.calendarLabel}</p>
                                    <p className="text-[10px] text-gray-500">What stays in the business after all costs and Abi's salary</p>
                                  </div>
                                  <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Winchester net</span>
                                      <span className={`tabular-nums ${m.wincNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>{m.wincNet >= 0 ? "+" : ""}{formatGBP(m.wincNet)}</span>
                                    </div>
                                    {!m.bedhClosed && m.bedhNet !== 0 && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Bedhampton net</span>
                                        <span className={`tabular-nums ${m.bedhNet >= 0 ? "text-blue-600" : "text-red-600"}`}>{m.bedhNet >= 0 ? "+" : ""}{formatGBP(m.bedhNet)}</span>
                                      </div>
                                    )}
                                    {(m.actualDrawings ?? 0) > 0 && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Abi's salary</span>
                                        <span className="tabular-nums text-purple-600">({formatGBP(m.actualDrawings ?? 0)})</span>
                                      </div>
                                    )}
                                    {loanRepRow > 0 && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Loan repayment</span>
                                        <span className="tabular-nums text-rose-600">({formatGBP(loanRepRow)})</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-0.5">
                                      <span className="font-bold text-gray-900">Retained in business</span>
                                      <span className={`tabular-nums font-bold ${netProfitRow > 0 ? "text-emerald-600" : "text-red-600"}`}>{netProfitRow >= 0 ? "+" : ""}{formatGBP(netProfitRow)}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-400 pt-0.5">This accumulates each month and is reflected in the Capital column.</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* Running cash balance */}
                            <td className={`text-right px-3 py-1.5 tabular-nums font-medium ${m.cashBalance >= 0 ? "" : "text-destructive"}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-gray-400/50">
                                    {formatGBP(m.cashBalance)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="!bg-white !text-gray-900 border border-gray-200 shadow-xl p-0 w-64">
                                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
                                    <p className="text-[11px] font-bold text-gray-900">Capital balance — {m.calendarLabel}</p>
                                    <p className="text-[10px] text-gray-500">Running cash balance across both clinics</p>
                                  </div>
                                  <div className="px-3 py-2.5 space-y-1 text-[11px]">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Net this month</span>
                                      <span className={`tabular-nums ${netProfitRow >= 0 ? "text-emerald-600" : "text-red-600"}`}>{netProfitRow >= 0 ? "+" : ""}{formatGBP(netProfitRow)}</span>
                                    </div>
                                    {(m.projectCostBurn ?? 0) > 0 && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Project costs</span>
                                        <span className="tabular-nums text-orange-600">({formatGBP(m.projectCostBurn ?? 0)})</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-0.5">
                                      <span className="font-bold text-gray-900">Closing balance</span>
                                      <span className={`tabular-nums font-bold ${m.cashBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>{formatGBP(m.cashBalance)}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-400 pt-0.5">Starts from your runway savings and investment. Goes negative if cumulative losses exceed your starting capital — set runway savings in Assumptions.</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground space-y-0.5">
                  <p><strong>Variable</strong> = Winchester stock %, commissions %, marketing, staffing, consumables. <strong>Fixed (Winc)</strong> = all items from your fixed cost list including dual costs (counted once, not double-charged to Bedhampton).</p>
                  <p><strong>Bedh Net</strong> = Bedhampton gross revenue minus stock, running costs, dual costs, and VAT. <strong>Winc VAT</strong> = Winchester VAT only. <strong>Net after Salary</strong> = Winc Net + Bedh Net − Abi's Salary — what stays in the business each month.</p>
                  <p><strong>Proj costs</strong> = Project Plan task costs (mid-tier by default) charged this month. Hover to see which tasks. Tasks without due dates are spread across pre-opening months, weighted toward opening. Total across all months = £{Math.round((pnlData ?? cashflow ?? []).reduce((s, m) => s + (m.projectCostBurn ?? 0), 0)).toLocaleString()}.</p>
                  <p><strong>Salary</strong> = Abi's salary drawn from the business once the combined monthly surplus (Winchester net + Bedhampton net) exceeds £3,000. The business retains at least £3,000/mo first — Abi draws from whatever is left above that floor, up to her target. Hover any salary figure to see estimated take-home after tax (salary up to personal allowance + balance as dividends at 8.75%). Set your target in Assumptions → Personal &amp; Runway.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy ramp */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{clinicLabel} Occupancy Ramp</CardTitle>
                <CardDescription className="text-xs">How quickly the new clinic fills under this scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  {rampData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rampData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rampGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={6} />
                        <YAxis tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                        <RechartTooltip formatter={(v: number) => [`${v}%`, "Occupancy"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rampGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Save assumptions first.</div>}
                </div>
              </CardContent>
            </Card>

            {/* Winchester journey to self-funding */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{clinicLabel} Journey to Self-Funding</CardTitle>
                <CardDescription className="text-xs">Three milestones {clinicLabel} must pass before Bedhampton closes</CardDescription>
              </CardHeader>
              <CardContent>
                {cr ? (
                  <div className="space-y-4 pt-1">
                    {[
                      {
                        label: "Break-even (costs covered)",
                        value: cr.winc.breakEvenRevenue,
                        sub: `${cr.winc.breakEvenOccupancy}% occupancy · ${cr.winc.treatmentsPerWeekToBreakeven} appts/week`,
                        achieved: cr.winc.netProfit >= 0,
                        color: "bg-amber-400",
                        pct: Math.min((cr.winc.grossRevenue / cr.winc.breakEvenRevenue) * 60, 60),
                      },
                      {
                        label: `Self-funding (${cr.winc.selfFundingBufferPercent}% margin · ~${formatGBP(cr.winc.sfNetProfitTarget)}/mo net)`,
                        value: cr.winc.grossRevenue,
                        sub: cr.combined.selfFundingMonth
                          ? `Projected Month ${cr.combined.selfFundingMonth} · ${cr.winc.selfFundingOccupancy}% occupancy required`
                          : `Requires ${cr.winc.selfFundingOccupancy}% occupancy — not reached in 12mo on this scenario`,
                        achieved: cr.winc.sfNetProfitTarget > 0 ? cr.winc.netProfit >= cr.winc.sfNetProfitTarget : false,
                        color: "bg-emerald-500",
                        pct: cr.winc.sfNetProfitTarget > 0 ? Math.min((cr.winc.netProfit / cr.winc.sfNetProfitTarget) * 80, 100) : 0,
                      },
                      {
                        label: "Target occupancy projection",
                        value: cr.winc.grossRevenue,
                        sub: `${formatGBP(cr.winc.netProfit)}/mo net at ${cr.winc.occupancyUsed}% · ${cr.winc.grossMarginPercent}% gross margin`,
                        achieved: true,
                        color: "bg-primary",
                        pct: Math.min((cr.winc.occupancyUsed / 85) * 100, 100),
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex items-start justify-between text-xs mb-1 gap-2">
                          <span className={`font-medium ${row.achieved ? "text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
                          <PhaseChip ok={row.achieved} label={row.achieved ? "✓" : "Not yet"} />
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${row.color} rounded-full transition-all duration-700`} style={{ width: `${Math.max(row.pct, 2)}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</p>
                      </div>
                    ))}
                    {cr.combined.totalBedhamptonSupport !== null && (
                      <div className="pt-1 border-t border-border text-xs flex justify-between">
                        <span className="text-muted-foreground">Total Bedhampton support during ramp</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{formatGBP(cr.combined.totalBedhamptonSupport)}</span>
                      </div>
                    )}
                  </div>
                ) : <div className="py-10 text-center text-muted-foreground text-sm">Save assumptions first.</div>}
              </CardContent>
            </Card>
          </div>

          {/* Break-even + VAT + Health score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{clinicLabel} Break-Even</CardTitle></CardHeader>
              <CardContent>
                {cr ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold">{formatGBP(cr.winc.breakEvenRevenue)}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-xs text-muted-foreground mt-0.5">at {cr.winc.breakEvenOccupancy}% occupancy</div>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Treatments/week needed</span><span className="font-medium">{cr.winc.treatmentsPerWeekToBreakeven}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gross margin</span><span className="font-medium">{cr.winc.grossMarginPercent}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Fixed costs/mo</span><span className="font-medium">{formatGBP(cr.winc.fixedCosts)}</span></div>
                    </div>
                  </div>
                ) : <div className="py-6 text-center text-muted-foreground text-sm">—</div>}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">VAT Threshold Tracker</CardTitle></CardHeader>
              <CardContent>
                {cr ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {cr.combined.monthsUntilVatRegistration === 0
                          ? <span className="text-destructive">Now</span>
                          : cr.combined.monthsUntilVatRegistration >= 99 ? "Not imminent"
                          : `~${cr.combined.monthsUntilVatRegistration} months`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">until business crosses £90k VAT threshold (all clinics combined)</div>
                    </div>
                    {/* Progress shows combined all-clinic turnover vs £90k.
                        vatCurrentTurnover = existing rolling 12-month Bedhampton revenue.
                        combinedAnnualRevenue = that + Winchester steady-state annual.
                        This gives the true picture of how close the business is to mandatory VAT registration. */}
                    <Progress value={Math.min((cr.combined.combinedAnnualRevenue / VAT_THRESHOLD) * 100, 100)}
                      className={`h-2 ${cr.combined.vatRegistrationWarning ? "[&>div]:bg-amber-500" : ""}`} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatGBP(cr.combined.combinedAnnualRevenue)} combined (all clinics)</span>
                      <span>£90k limit</span>
                    </div>
                    {cr.combined.vatCurrentTurnover > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Existing turnover: {formatGBP(cr.combined.vatCurrentTurnover)} · {clinicLabel} adds: {formatGBP(cr.combined.annualRevenue)}
                      </div>
                    )}
                    {cr.combined.vatRegistrationWarning && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Appoint accountant to plan VAT registration now.
                      </div>
                    )}
                  </div>
                ) : <div className="py-6 text-center text-muted-foreground text-sm">—</div>}
              </CardContent>
            </Card>

            {/* VAT urgent alert — always shown; timing is critical relative to lease signing */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">VAT registration required within 1–2 months of Winchester opening</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 leading-relaxed">
                  Based on current rolling Bedhampton turnover, adding Winchester revenue will cross the £90k VAT threshold very quickly after opening. Accountant consultation is required <strong>before lease signing</strong> — not after. Confirm VAT strategy (standard, cash accounting, or flat rate) before committing to lease terms.
                </p>
                <a href="/financials#assumptions" className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">Review VAT assumptions →</a>
              </div>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Clinic Health Score</CardTitle></CardHeader>
              <CardContent>
                {healthScore ? (
                  <div className="space-y-2">
                    {[
                      { label: "Financial Safety", value: healthScore.financial },
                      { label: "Growth Strength", value: healthScore.growth },
                      { label: "Self-Funding Speed", value: healthScore.selfFunding },
                      { label: "Owner Independence", value: healthScore.owner },
                      { label: "Cash Position", value: healthScore.cash },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-medium">{Math.round(s.value)}/100</span>
                        </div>
                        <Progress value={s.value} className={`h-1.5 ${s.value >= 70 ? "[&>div]:bg-emerald-500" : s.value >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"}`} />
                      </div>
                    ))}
                  </div>
                ) : <div className="py-6 text-center text-muted-foreground text-sm">—</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: MODEL ══════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            {/* AI generating spinner */}
            {aiGenerating && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">Generating detailed assumptions…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Analysing property, location and UK market rates — takes 20–40 seconds.</p>
                </div>
              </div>
            )}

            {/* ── AI Proposal Review Panel ─────────────────────────────────── */}
            {aiProposal && !aiGenerating && (() => {
              const categories = [...new Set(aiProposal.fixedCosts.map(fc => fc.category))];
              const checkedCount = Object.values(aiChecked).filter(Boolean).length;
              const confBadge = (c: string) =>
                c === "high" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
                c === "medium" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";

              return (
                <div className="rounded-xl border-2 border-primary/20 bg-card shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/10">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">AI Cost Proposal</span>
                      <span className="text-xs text-muted-foreground">— {aiProposal.fixedCosts.length} line items · review before applying</span>
                    </div>
                    <button onClick={() => setAiProposal(null)} className="text-muted-foreground hover:text-foreground text-xs underline">Dismiss</button>
                  </div>

                  {/* Flags */}
                  {aiProposal.flags.length > 0 && (
                    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 space-y-1">
                      {aiProposal.flags.map((f, i) => (
                        <div key={i} className="flex gap-2 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Select all / deselect all */}
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs">
                    <div className="flex gap-3">
                      <button className="underline text-primary" onClick={() => {
                        const all: Record<string, boolean> = {};
                        aiProposal.fixedCosts.forEach(fc => { all[fc.name] = true; });
                        setAiChecked(all);
                      }}>Select all</button>
                      <button className="underline text-muted-foreground" onClick={() => setAiChecked({})}>Deselect all</button>
                      <button className="underline text-muted-foreground" onClick={() => {
                        const ess: Record<string, boolean> = {};
                        aiProposal.fixedCosts.forEach(fc => { ess[fc.name] = fc.isEssential; });
                        setAiChecked(ess);
                      }}>Essential only</button>
                    </div>
                    <span className="text-muted-foreground">{checkedCount} of {aiProposal.fixedCosts.length} selected</span>
                  </div>

                  {/* Cost rows by category */}
                  <div className="divide-y max-h-[520px] overflow-y-auto">
                    {categories.map(cat => (
                      <div key={cat}>
                        <div className="px-4 py-1.5 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</div>
                        {aiProposal.fixedCosts.filter(fc => fc.category === cat).map((fc) => (
                          <label key={fc.name} className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors ${aiChecked[fc.name] ? "" : "opacity-50"}`}>
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0 accent-primary"
                              checked={!!aiChecked[fc.name]}
                              onChange={e => setAiChecked(p => ({ ...p, [fc.name]: e.target.checked }))}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{fc.name}</span>
                                {fc.existingItemId ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold">UPDATE</span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">NEW</span>
                                )}
                                {fc.isEssential && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">ESSENTIAL</span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${confBadge(fc.confidence)}`}>{fc.confidence} confidence</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{fc.reasoning}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-sm font-bold">£{fc.amountGbp.toLocaleString()}</span>
                              <span className="text-[10px] text-muted-foreground block">/mo</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Variable costs & revenue summary */}
                  {(aiProposal.variableCosts || aiProposal.revenue) && (
                    <div className="border-t px-4 py-3 bg-muted/20">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" className="mt-0.5 accent-primary" checked={applyVarRev} onChange={e => setApplyVarRev(e.target.checked)} />
                        <div className="text-xs">
                          <p className="font-semibold mb-1">Also apply variable costs & revenue assumptions</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                            {aiProposal.variableCosts.stockPercent != null && <span>Stock/COGS: {aiProposal.variableCosts.stockPercent}%</span>}
                            {aiProposal.variableCosts.consumablesGbp != null && <span>Consumables: £{aiProposal.variableCosts.consumablesGbp}/mo</span>}
                            {aiProposal.revenue.wincAcvGbp != null && <span>Avg visit value: £{aiProposal.revenue.wincAcvGbp}</span>}
                            {aiProposal.revenue.conservativeOccupancyPercent != null && <span>Conservative occ: {aiProposal.revenue.conservativeOccupancyPercent}%</span>}
                            {aiProposal.revenue.realisticOccupancyPercent != null && <span>Realistic occ: {aiProposal.revenue.realisticOccupancyPercent}%</span>}
                            {aiProposal.revenue.aggressiveOccupancyPercent != null && <span>Aggressive occ: {aiProposal.revenue.aggressiveOccupancyPercent}%</span>}
                          </div>
                          {aiProposal.variableCosts.stockPercentReasoning && (
                            <p className="mt-1 text-muted-foreground italic">{aiProposal.variableCosts.stockPercentReasoning}</p>
                          )}
                          {aiProposal.variableCosts.consumablesReasoning && (
                            <p className="mt-0.5 text-muted-foreground italic">{aiProposal.variableCosts.consumablesReasoning}</p>
                          )}
                          {aiProposal.revenue.wincAcvReasoning && (
                            <p className="mt-0.5 text-muted-foreground italic">{aiProposal.revenue.wincAcvReasoning}</p>
                          )}
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Apply footer */}
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 gap-3">
                    <span className="text-xs text-muted-foreground">
                      {checkedCount} cost{checkedCount !== 1 ? "s" : ""} selected · £{
                        aiProposal.fixedCosts.filter(fc => aiChecked[fc.name]).reduce((s, fc) => s + fc.amountGbp, 0).toLocaleString()
                      }/mo total
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setAiProposal(null)}>Dismiss</Button>
                      <Button size="sm" onClick={handleApplyProposal} disabled={aiApplying || checkedCount === 0}>
                        {aiApplying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                        Apply {checkedCount} selected
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="flex items-center justify-between sticky top-16 z-30 bg-background/95 py-3 border-b gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Assumptions</h3>
                    {saveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />Saving…
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />Saved
                      </span>
                    )}
                    {saveStatus === "unsaved" && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateAssumptions} disabled={aiGenerating}>
                      {aiGenerating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                      Generate with AI
                    </Button>
                    <Button type="submit" disabled={saveStatus === "saving"} size="sm" variant={saveStatus === "unsaved" ? "default" : "outline"}>
                      <Save className="w-4 h-4 mr-1.5" />
                      Save now
                    </Button>
                  </div>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fixed Monthly Costs</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tag each cost as <strong>Unique</strong> ({clinicLabel} only) or <strong>Dual</strong> (shared across both clinics — counts once, never double-charged).
                    </p>
                    {fixedCostItems.length > 0 && fixedCostItems.every(i => i.costType !== "dual") && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
                        <strong>Bedhampton costs understated.</strong> No costs are marked as Dual. Costs like your accountant, indemnity insurance, and practice software are currently paid from Bedhampton — tag them as <strong>Dual</strong> below so they are deducted from Bedhampton's P&amp;L now and transfer to Winchester on opening day.
                      </div>
                    )}
                    {fixedCostItems.some(i => i.costType === "dual") && (
                      <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                        <strong>{fixedCostItems.filter(i => i.costType === "dual").length} dual cost{fixedCostItems.filter(i => i.costType === "dual").length !== 1 ? "s" : ""}</strong> (£{fixedCostItems.filter(i => i.costType === "dual").reduce((s, i) => s + (i.amountGbp || 0), 0).toLocaleString()}/mo) deducted from Bedhampton pre-opening, then transferred to Winchester on day one.
                      </div>
                    )}
                    {/* VAT on rent toggle — synced from property */}
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <div>
                        <p className="text-xs font-medium">VAT on Rent</p>
                        <p className="text-[10px] text-muted-foreground">Landlord charges 20% VAT on top of rent</p>
                      </div>
                      <FormField control={form.control} name={"vatOnRent" as any} render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <span className={`text-xs font-medium ${field.value ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {field.value ? "Yes — VAT applies" : "No"}
                          </span>
                        </FormItem>
                      )} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Existing cost rows */}
                    {fixedCostItems.length > 0 && (
                      <div className="space-y-2">
                        {fixedCostItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <input
                              className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                              defaultValue={item.name}
                              onBlur={(e) => {
                                if (e.target.value !== item.name) handleUpdateCostItem(item.id, "name", e.target.value);
                              }}
                            />
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">£</span>
                              <input
                                type="number"
                                className="w-24 h-8 pl-6 pr-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                defaultValue={item.amountGbp}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val !== item.amountGbp) handleUpdateCostItem(item.id, "amountGbp", val);
                                }}
                              />
                            </div>
                            <button
                              onClick={() => handleUpdateCostItem(item.id, "costType", item.costType === "unique" ? "dual" : "unique")}
                              className={`shrink-0 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                                item.costType === "dual"
                                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                  : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                              }`}
                              title={item.costType === "dual" ? "Dual — shared across both clinics, counts once" : `Unique — ${clinicLabel} only`}
                            >
                              {item.costType === "dual" ? "Dual" : "Unique"}
                            </button>
                            <button
                              onClick={() => handleDeleteCostItem(item.id)}
                              className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new row */}
                    <div className="flex items-center gap-2 pt-1 border-t border-dashed border-border">
                      <input
                        className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="e.g. ANS software, card terminal..."
                        value={newCostName}
                        onChange={(e) => setNewCostName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddCostItem(); }}
                      />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">£</span>
                        <input
                          type="number"
                          className="w-24 h-8 pl-6 pr-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="0"
                          value={newCostAmount}
                          onChange={(e) => setNewCostAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddCostItem(); }}
                        />
                      </div>
                      <button
                        onClick={() => setNewCostType(t => t === "unique" ? "dual" : "unique")}
                        className={`shrink-0 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                          newCostType === "dual"
                            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        {newCostType === "dual" ? "Dual" : "Unique"}
                      </button>
                      <button
                        onClick={handleAddCostItem}
                        disabled={!newCostName.trim() || !newCostAmount}
                        className="shrink-0 p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-muted border border-border" />Unique = {clinicLabel} only</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800" />Dual = shared, counted once</span>
                    </div>

                    {/* AI Suggestions panel (only shown when old per-item assess was used) */}
                    {aiSuggestions && (
                      <div className="border-t pt-3 space-y-3">
                        <div className="space-y-3 bg-muted/40 rounded-lg p-3 text-xs">
                          {aiSuggestions.estimates?.filter(e => {
                            const item = fixedCostItems.find(i => i.name === e.name);
                            return item && item.amountGbp === 0;
                          }).length > 0 && (
                            <div>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-2">Suggested amounts for empty items</p>
                              <div className="space-y-1.5">
                                {aiSuggestions.estimates
                                  .filter(e => {
                                    const item = fixedCostItems.find(i => i.name === e.name);
                                    return item && item.amountGbp === 0;
                                  })
                                  .map((e, i) => (
                                    <div key={i} className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <span className="font-medium">{e.name}</span>
                                        <span className="text-muted-foreground ml-1">— {e.reasoning}</span>
                                      </div>
                                      <button
                                        onClick={() => applyAiEstimate(e.name, e.estimatedMonthly)}
                                        className="shrink-0 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90"
                                      >
                                        Apply £{e.estimatedMonthly}
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          {aiSuggestions.additionalCosts?.length > 0 && (
                            <div>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-2">Suggested additional costs</p>
                              <div className="space-y-1.5">
                                {aiSuggestions.additionalCosts.map((c, i) => (
                                  <div key={i} className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <span className="font-medium">{c.name}</span>
                                      <span className={`ml-1.5 px-1 py-0.5 rounded text-[9px] font-semibold ${c.costType === "dual" ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>{c.costType}</span>
                                      <span className="text-muted-foreground ml-1">— {c.reasoning}</span>
                                    </div>
                                    <button
                                      onClick={() => applyAiAdditionalCost(c)}
                                      className="shrink-0 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90"
                                    >
                                      Add £{c.estimatedMonthly}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {aiSuggestions.flags?.length > 0 && (
                            <div className="border-t pt-2 space-y-1">
                              {aiSuggestions.flags.map((f, i) => (
                                <div key={i} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
                                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-semibold">Total fixed</span>
                      <span className="font-bold">{formatGBP(totalDynamicFixedCosts)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{clinicLabel} — Stock Cost</CardTitle>
                      {bLive && bLive.summary.avgGrossMarginPct > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Live Bedhampton margin: <strong>{bLive.summary.avgGrossMarginPct}%</strong>
                            {" "}→ {(100 - bLive.summary.avgGrossMarginPct).toFixed(1)}% stock
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const variablePct = Math.round((100 - bLive.summary.avgGrossMarginPct) * 10) / 10;
                              form.setValue("stockPercent", variablePct);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors font-semibold"
                          >
                            Apply live margin
                          </button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="stockPercent" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Stock (% of revenue)</FormLabel>
                        <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{clinicLabel} — Revenue & Self-Funding</CardTitle></CardHeader>
                  <CardContent>
                    {/* Avg Client Value */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name={"wincAcvGbp" as any} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Avg Client Value (£)</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                      )} />
                    </div>

                    {/* ── Clinic Staff Schedule ──────────────────────────── */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground/80">Clinic Staff Schedule</p>
                        {additionalClinicians.length < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newClin: Clinician = { id: crypto.randomUUID(), name: "", isPrimary: false, startDate: "", annualGrossSalaryGbp: 0 };
                              const updated = [...additionalClinicians, newClin];
                              setAdditionalClinicians(updated);
                              form.setValue("additionalCliniciansJson" as any, JSON.stringify(updated));
                            }}
                            className="h-6 px-2 rounded text-[10px] border border-dashed border-input text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center gap-1"
                          >
                            <span className="text-sm leading-none">+</span> Add clinician
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Costs shown as total employer cost to business (gross + employer NI 13.8% above £9,100 + pension 3% on qualifying earnings). Max 4 clinicians.</p>

                      {additionalClinicians.map((clin, idx) => {
                        const isPrimary = clin.isPrimary === true;
                        const annualSalary = clin.annualGrossSalaryGbp ?? 0;
                        const paye = annualSalary > 0 ? calcPayeBreakdown(annualSalary) : null;
                        const updateClin = (patch: Partial<Clinician>) => {
                          const updated = additionalClinicians.map((c, i) => i === idx ? { ...c, ...patch } : c);
                          setAdditionalClinicians(updated);
                          form.setValue("additionalCliniciansJson" as any, JSON.stringify(updated));
                        };
                        return (
                          <div key={clin.id} className={`p-2.5 rounded-md border space-y-2 ${isPrimary ? "border-primary/30 bg-primary/5" : "border-border/60 bg-muted/20"}`}>
                            {/* Identity row */}
                            <div className="flex items-center gap-2">
                              {isPrimary ? (
                                <>
                                  <span className="flex-1 text-xs font-semibold">{clin.name || "Abi Peters"}</span>
                                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">Primary</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">Opens with clinic</span>
                                </>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={clin.name}
                                    onChange={(e) => updateClin({ name: e.target.value })}
                                    placeholder="Clinician name"
                                    className="flex-1 h-7 rounded-md border border-input bg-background text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateClin({ isPrimary: !clin.isPrimary })}
                                    className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold border transition-colors ${clin.isPrimary ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border hover:border-primary hover:text-primary"}`}
                                  >
                                    {clin.isPrimary ? "Primary" : "Secondary"}
                                  </button>
                                  {!clin.isPrimary && (
                                    <input
                                      type="month"
                                      value={clin.startDate ? clin.startDate.slice(0, 7) : ""}
                                      onChange={(e) => updateClin({ startDate: e.target.value ? e.target.value + "-01" : "" })}
                                      className="h-7 w-32 rounded-md border border-input bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = additionalClinicians.filter((_, i) => i !== idx);
                                      setAdditionalClinicians(updated);
                                      form.setValue("additionalCliniciansJson" as any, JSON.stringify(updated));
                                    }}
                                    className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-base leading-none"
                                  >×</button>
                                </>
                              )}
                            </div>
                            {/* Annual salary */}
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] text-muted-foreground w-28 shrink-0">Annual gross salary</label>
                              <div className="relative flex-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">£</span>
                                <input
                                  type="number"
                                  value={annualSalary || ""}
                                  onChange={(e) => updateClin({ annualGrossSalaryGbp: e.target.value ? Number(e.target.value) : 0 })}
                                  placeholder="0"
                                  className="h-7 w-full rounded-md border border-input bg-background text-xs pl-5 pr-3 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">/yr</span>
                            </div>
                            {/* PAYE breakdown */}
                            {paye && (
                              <div className="rounded-md bg-muted/50 px-2.5 py-2 text-[10px] space-y-0.5">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Employee NI (12% to £50,270 / 2% above)</span>
                                  <span className="font-medium text-foreground/70">£{paye.employeeNI.toLocaleString()} /yr</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Employer NI (13.8% above £9,100)</span>
                                  <span className="font-medium text-foreground/70">£{paye.employerNI.toLocaleString()} /yr</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Employer pension (3% qualifying earnings)</span>
                                  <span className="font-medium text-foreground/70">£{paye.employerPension.toLocaleString()} /yr</span>
                                </div>
                                <div className="flex justify-between font-semibold text-foreground/80 border-t border-border/40 pt-1 mt-0.5">
                                  <span>Total cost to business</span>
                                  <span>£{paye.totalCostAnnual.toLocaleString()} /yr · £{paye.totalCostMonthly.toLocaleString()} /mo</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                  <span>Employee net take-home (est.)</span>
                                  <span>£{paye.netMonthlyTakeHome.toLocaleString()} /mo</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {additionalClinicians.some(c => (c.annualGrossSalaryGbp ?? 0) > 0) && (
                        <div className="flex items-center justify-between text-xs font-semibold border-t border-border/60 pt-2 mt-1">
                          <span className="text-muted-foreground">Total monthly clinician cost to business</span>
                          <span className="text-foreground">
                            £{additionalClinicians.reduce((sum, c) => sum + ((c.annualGrossSalaryGbp ?? 0) > 0 ? calcPayeBreakdown(c.annualGrossSalaryGbp!).totalCostMonthly : 0), 0).toLocaleString()}/mo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Occupancy & revenue drivers */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {[
                        ["membershipRevenueGbp","Winchester Membership (£/mo)"],
                        ["conservativeOccupancyPercent","Conservative Occ %"],
                        ["realisticOccupancyPercent","Realistic Occ %"],
                        ["aggressiveOccupancyPercent","Aggressive Occ %"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}

                      {/* Hours/Day — locked from Life Design */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground/80">Hours/Day/Room</p>
                        <div className="h-8 flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3">
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold text-primary">
                            {derivedSchedule?.hoursPerDay ?? form.watch("practitionerHoursPerDay" as any) ?? "—"}
                          </span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold ml-auto">Life Design</span>
                        </div>
                      </div>

                      {/* Working days/month — locked from Life Design */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground/80">Working Days/Mo</p>
                        <div className="h-8 flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3">
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold text-primary">
                            {derivedSchedule?.daysPerMonth ?? form.watch("workingDaysPerMonth" as any) ?? "—"}
                          </span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold ml-auto">Life Design</span>
                        </div>
                      </div>
                    </div>
                    {!derivedSchedule && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Set clinic days on Life Design to auto-populate Hours/Day and Working Days/Mo
                      </p>
                    )}
                    <div className="mt-3">
                      <FormField control={form.control} name={"selfFundingBufferPercent" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Self-Funding Buffer (%)</FormLabel>
                          <FormControl>
                            <Input type="number" min={5} max={50} step={1} {...field} className="h-8 text-sm w-32" />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Bedhampton closes when {clinicLabel}'s net profit is at least this % of its gross revenue — a self-sufficiency margin. Default: 20%. The effective £ threshold is computed automatically from your cost structure.
                    </p>
                  </CardContent>
                </Card>

                {/* ── Treatment Mix Revenue Engine ──────────────────────── */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Treatment Mix — Revenue Engine
                      </span>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => setTreatmentMix(prev => [...prev, { treatmentName: "", durationMins: 30, revenueGbp: 0, mixPercent: 0 }])}>
                        <Plus className="w-3 h-3" /> Add Treatment
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Optional. Enter your treatment mix to calculate revenue per productive minute and throughput ceiling.
                      Mix % should total 100. If left empty, the model uses the Avg Client Value above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {treatmentMix.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">No treatments added — using Avg Client Value fallback.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-[1fr_60px_70px_60px_28px] gap-1.5 text-[10px] font-medium text-muted-foreground px-1">
                          <span>Treatment</span><span className="text-center">Mins</span><span className="text-center">Price £</span><span className="text-center">Mix %</span><span />
                        </div>
                        {treatmentMix.map((entry, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_60px_70px_60px_28px] gap-1.5 items-center">
                            <Input value={entry.treatmentName} placeholder="e.g. Anti-wrinkle" className="h-7 text-xs" onChange={e => setTreatmentMix(prev => prev.map((r, i) => i === idx ? { ...r, treatmentName: e.target.value } : r))} />
                            <Input type="number" value={entry.durationMins || ""} min={1} placeholder="30" className="h-7 text-xs text-center" onChange={e => setTreatmentMix(prev => prev.map((r, i) => i === idx ? { ...r, durationMins: Number(e.target.value) } : r))} />
                            <Input type="number" value={entry.revenueGbp || ""} min={0} placeholder="0" className="h-7 text-xs text-center" onChange={e => setTreatmentMix(prev => prev.map((r, i) => i === idx ? { ...r, revenueGbp: Number(e.target.value) } : r))} />
                            <Input type="number" value={entry.mixPercent || ""} min={0} max={100} placeholder="0" className="h-7 text-xs text-center" onChange={e => setTreatmentMix(prev => prev.map((r, i) => i === idx ? { ...r, mixPercent: Number(e.target.value) } : r))} />
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setTreatmentMix(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        ))}
                        {(() => {
                          const totalPct = treatmentMix.reduce((s, e) => s + (e.mixPercent || 0), 0);
                          const isValid = Math.abs(totalPct - 100) < 0.5 && treatmentMix.every(e => e.durationMins > 0 && e.revenueGbp > 0);
                          const rpm = isValid ? treatmentMix.reduce((s, e) => s + (e.revenueGbp / e.durationMins) * (e.mixPercent / 100), 0) : 0;
                          return (
                            <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
                              <span className={`font-medium ${Math.abs(totalPct - 100) < 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                Mix total: {totalPct.toFixed(0)}% {Math.abs(totalPct - 100) < 0.5 ? "✓" : "(should be 100%)"}
                              </span>
                              {isValid && <span className="text-muted-foreground">Rev/min: <strong className="text-foreground">£{rpm.toFixed(2)}</strong></span>}
                              {isValid && <span className="text-muted-foreground">Rev/hr: <strong className="text-foreground">£{(rpm * 60).toFixed(0)}</strong></span>}
                              {isValid && calcResults?.treatmentMix && (
                                <span className="text-muted-foreground">Throughput ceiling: <strong className="text-foreground">{formatGBP(calcResults.treatmentMix.throughputCeiling)}/mo</strong></span>
                              )}
                              {isValid && calcResults?.treatmentMix && (
                                <span className="text-muted-foreground">Appts @ target occ: <strong className="text-foreground">{calcResults.treatmentMix.impliedAppointmentsPerMonth}</strong></span>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* ── Capital & Runway ──────────────────────────────────── */}
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Capital & Runway</CardTitle>
                    <CardDescription className="text-xs">
                      Your complete opening cash position. Secured Investment and Project Costs update automatically from the Investment tab and Project Plan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name={"runwaySavingsGbp" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Business Capital (£)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Current business bank balance</p>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={"preOpeningPropertyMonths" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Lease signed (months before opening)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={"freeRentMonths" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Rent-free months (landlord agreed)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Lease signed months before opening: rent + rates charged against business capital from that point. Rent-free months: only business rates apply — rent is £0 during this period.</p>
                    {/* Live capital summary */}
                    {(() => {
                      const businessCap = Number(form.watch("runwaySavingsGbp" as any)) || 0;
                      const securedInv = investmentSummary?.totalCapitalGbp ?? null;
                      const preOpenBedh = investmentSummary?.preOpenBedhNetGbp ?? null;
                      const projectCosts = investmentSummary?.capitalSelectedGbp ?? null;
                      const canCalc = securedInv !== null && preOpenBedh !== null && projectCosts !== null;
                      const totalAvail = canCalc ? businessCap + (securedInv ?? 0) + (preOpenBedh ?? 0) : null;
                      const runway = canCalc ? (totalAvail ?? 0) - (projectCosts ?? 0) : null;
                      const runwayColor = runway === null ? "" : runway >= 10000 ? "text-emerald-600 dark:text-emerald-400" : runway >= 0 ? "text-amber-600 dark:text-amber-400" : "text-destructive";
                      return (
                        <div className="rounded-md bg-muted/30 border border-border/60 p-3 space-y-1.5">
                          {[
                            { label: "Business Capital", value: businessCap, auto: false },
                            { label: "Secured Investment", value: securedInv, auto: true, note: "Investment tab" },
                            { label: "Projected Bedhampton Net Income to Opening", value: preOpenBedh, auto: true, note: "months remaining × Bedh net" },
                          ].map((r, i) => (
                            <div key={r.label} className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                {r.label}
                                {r.auto && <span className="text-[9px] bg-muted px-1 rounded text-muted-foreground/50">auto</span>}
                              </span>
                              <span className="font-medium tabular-nums">
                                {r.value !== null ? formatGBP(r.value) : <span className="text-muted-foreground/40 text-[10px]">visit Investment tab</span>}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center text-xs border-t border-border/60 pt-1.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                              Project Costs
                              <span className="text-[9px] bg-muted px-1 rounded text-muted-foreground/50">auto</span>
                            </span>
                            <span className="font-medium tabular-nums text-destructive/70">
                              {projectCosts !== null ? `(${formatGBP(projectCosts)})` : <span className="text-muted-foreground/40 text-[10px]">visit Investment tab</span>}
                            </span>
                          </div>
                          {canCalc && (
                            <>
                              <div className="flex justify-between items-center text-sm font-semibold border-t-2 border-border pt-1.5 mt-0.5">
                                <span>Total Money Available at Opening</span>
                                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{formatGBP(totalAvail!)}</span>
                              </div>
                              <div className={`flex justify-between items-center text-sm font-bold rounded-md px-2 py-1.5 ${runway! >= 10000 ? "bg-emerald-50 dark:bg-emerald-950/30" : runway! >= 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                                <span className={runwayColor}>Target Runway at Opening</span>
                                <span className={`tabular-nums ${runwayColor}`}>{runway! >= 0 ? "+" : ""}{formatGBP(runway!)}</span>
                              </div>
                            </>
                          )}
                          {!investmentSummary && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Visit the Investment tab once to auto-load Secured Investment and Project Costs.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Bedhampton — Revenue</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        disabled={bLiveSyncing}
                        onClick={syncBedhamptonFromLive}
                      >
                        {bLiveSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Sync from live data
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Separate patient base. Supports the business during the {clinicLabel} ramp. Closes when {clinicLabel} hits the self-funding target.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Warning when Bedhampton revenue is not set */}
                    {(Number(form.watch("existingClinicRevenueGbp")) || 0) === 0 && bLive && (
                      <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Bedhampton monthly revenue is not set — all Bedhampton figures will show £0.
                          Live data shows <strong>£{Math.round(bLive.recentMonths.slice(-3).reduce((s, m) => s + m.revenue, 0) / Math.max(bLive.recentMonths.slice(-3).length, 1)).toLocaleString()}/mo</strong> (3-month average).
                          Click <em>Sync from live data</em> to auto-fill.
                        </span>
                      </div>
                    )}
                    {/* Live data reference */}
                    {bLive && (Number(form.watch("existingClinicRevenueGbp")) || 0) > 0 && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-muted/40 rounded p-2">
                        <span>Live — Last month: <strong>£{Math.round(bLive.summary.lastMonthRevenue).toLocaleString()}</strong></span>
                        <span>·</span>
                        <span>Projected this month: <strong>£{Math.round(bLive.summary.projectedMonthRevenue).toLocaleString()}</strong></span>
                        <span>·</span>
                        <span>3-mo avg: <strong>£{Math.round(bLive.recentMonths.slice(-3).reduce((s, m) => s + m.revenue, 0) / Math.max(bLive.recentMonths.slice(-3).length, 1)).toLocaleString()}</strong></span>
                        <span>·</span>
                        <span>Gross margin: <strong>{bLive.summary.avgGrossMarginPct}%</strong></span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["existingClinicRevenueGbp","Gross Monthly Revenue (£)"],
                        ["bedhMembershipRevenueGbp","Membership Revenue (£/mo)"],
                        ["bedhStockPercent","Product / Stock Cost (%)"],
                        ["bedhCapacityCeilGbp","Joint capacity ceiling (£/mo)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Joint capacity ceiling: total revenue (Bedhampton + Winchester) Abi can generate. As Winchester grows, Bedhampton slots reduce proportionally.</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bedhampton — Monthly Running Costs</CardTitle>
                    <CardDescription className="text-xs">
                      Location-specific costs only. Shared costs (software, insurance, staffing) should be added as <strong>Dual</strong> items in Fixed Monthly Costs above — they count once across both clinics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["bedhRentGbp","Rent / Premises (£)"],
                        ["bedhMarketingGbp","Marketing (£)"],
                        ["bedhamptonCostsGbp","Other (£)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-semibold">Total running costs</span>
                      <span className="font-bold">{formatGBP(
                        (Number(form.watch("bedhRentGbp")) || 0) +
                        (Number(form.watch("bedhMarketingGbp")) || 0) +
                        (Number(form.watch("bedhamptonCostsGbp")) || 0)
                      )}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Product costs ({form.watch("bedhStockPercent") ?? 35}% of rev)</span>
                      <span>{formatGBP(((Number(form.watch("existingClinicRevenueGbp")) || 0) * (Number(form.watch("bedhStockPercent")) || 35)) / 100)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Est. monthly net</span>
                      <span className={`font-bold ${
                        (Number(form.watch("existingClinicRevenueGbp")) || 0) -
                        ((Number(form.watch("existingClinicRevenueGbp")) || 0) * (Number(form.watch("bedhStockPercent")) || 35) / 100) -
                        (Number(form.watch("bedhRentGbp")) || 0) -
                        (Number(form.watch("bedhMarketingGbp")) || 0) -
                        (Number(form.watch("bedhamptonCostsGbp")) || 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                      }`}>{formatGBP(
                        (Number(form.watch("existingClinicRevenueGbp")) || 0) -
                        ((Number(form.watch("existingClinicRevenueGbp")) || 0) * (Number(form.watch("bedhStockPercent")) || 35) / 100) -
                        (Number(form.watch("bedhRentGbp")) || 0) -
                        (Number(form.watch("bedhMarketingGbp")) || 0) -
                        (Number(form.watch("bedhamptonCostsGbp")) || 0)
                      )}</span>
                    </div>
                  </CardContent>
                </Card>


                <Card className="shadow-sm border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      VAT Planning
                      <span className="text-[10px] font-normal bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">£90k threshold</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField control={form.control} name={"vatCurrentTurnoverGbp" as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Current rolling 12-month turnover (all clinics, £)</FormLabel>
                        <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          £{Math.max(0, 90000 - (Number(form.watch("vatCurrentTurnoverGbp")) || 0)).toLocaleString()} remaining before VAT registration required
                        </p>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={"vatRegistrationDate" as any} render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel className="text-xs">VAT registered from <span className="text-muted-foreground font-normal">(optional override)</span></FormLabel>
                        <FormControl>
                          <Input type="month" {...field} value={field.value ?? ""} className="h-8 text-sm" />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {field.value
                            ? `VAT will apply from ${new Date(field.value + "-01").toLocaleString("en-GB", { month: "long", year: "numeric" })} regardless of turnover. Clear this to use automatic threshold detection.`
                            : "Leave blank to let the model calculate when your combined turnover crosses £90k. Set a date once you know your registration month."}
                        </p>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {/* VAT warning — shown in Assumptions tab so it's seen before lease decisions */}
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">Set your VAT registration date in Assumptions</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 leading-relaxed">
                      Use the "VAT registered from" field above to set the month VAT applies. Once set, the P&amp;L will show VAT at the rate you selected (e.g. 20%) from that month onwards. Confirm your registration date and VAT strategy (standard, cash accounting, or flat rate) with your accountant <strong>before lease signing</strong>.
                    </p>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Right: Live results */}
          <div className="lg:col-span-7 space-y-5 sticky top-6">
            {cr ? (
              <>
                <Card className="shadow-md border-primary/20">
                  <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex justify-between items-center">
                    <div>
                      <h3 className={`font-semibold capitalize ${sc.color}`}>{sc.label} — {clinicLabel} at Target</h3>
                      <p className="text-xs text-muted-foreground">{cr.winc.occupancyUsed}% occupancy · {formatGBP(cr.winc.fixedCosts)}/mo fixed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{clinicLabel} Monthly Net</p>
                      <p className={`text-2xl font-bold ${cr.winc.netProfit > 0 ? "text-primary" : "text-destructive"}`}>{formatGBP(cr.winc.netProfit)}</p>
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    {/* Ledger-style P&L breakdown */}
                    <div className="rounded-lg border border-border overflow-hidden text-sm">
                      <div className="flex justify-between items-center px-3 py-2 bg-muted/30">
                        <span className="text-muted-foreground font-medium">Gross Revenue</span>
                        <span className="font-bold">{formatGBP(cr.winc.grossRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50">
                        <span className="text-muted-foreground pl-3">− Variable Costs</span>
                        <span className="text-destructive/80">({formatGBP(cr.winc.variableCosts)})</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50">
                        <span className="text-muted-foreground pl-3">− Fixed Costs</span>
                        <span className="text-destructive/80">({formatGBP(cr.winc.fixedCosts)})</span>
                      </div>
                      {cr.winc.vatApplied && cr.winc.vatLiability > 0 && (
                        <div className="flex justify-between items-center px-3 py-1.5 border-t border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                          <span className="text-amber-700 dark:text-amber-400 pl-3 flex items-center gap-1">
                            − VAT Liability (20% of revenue)
                            <span className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1 rounded">VAT registered</span>
                          </span>
                          <span className="text-amber-700 dark:text-amber-400 font-medium">({formatGBP(cr.winc.vatLiability)})</span>
                        </div>
                      )}
                      {!cr.winc.vatApplied && (
                        <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50 bg-muted/10">
                          <span className="text-muted-foreground/60 pl-3 text-xs">VAT — not yet registered</span>
                          <span className="text-muted-foreground/60 text-xs">£0</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50 bg-muted/20">
                        <span className="font-semibold text-muted-foreground">= Total Costs</span>
                        <span className="font-bold text-destructive">({formatGBP(cr.winc.totalCosts)})</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5 border-t-2 border-border">
                        <span className="font-bold">Monthly Net Profit</span>
                        <span className={`font-bold text-base ${cr.winc.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                          {formatGBP(cr.winc.netProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50 bg-muted/10">
                        <span className="text-muted-foreground text-xs">Annual net · Gross margin {cr.winc.grossMarginPercent}%</span>
                        <span className="font-semibold text-xs">{formatGBP(cr.combined.annualNetProfit)}</span>
                      </div>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Break-Even Rev</div>
                        <div className="font-bold">{formatGBP(cr.winc.breakEvenRevenue)}</div>
                        <div className="text-[10px] text-muted-foreground">/month</div>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Self-Funding Occ</div>
                        <div className="font-bold">{cr.winc.selfFundingOccupancy}%</div>
                        <div className="text-[10px] text-muted-foreground">{cr.winc.selfFundingBufferPercent}% margin (~{formatGBP(cr.winc.sfNetProfitTarget)})</div>
                      </div>
                      <div className={`rounded-lg border p-3 text-center ${cr.combined.selfFundingMonth ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-200 bg-amber-50 dark:bg-amber-950/30"}`}>
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Bedh Closes</div>
                        <div className="font-bold">{cr.combined.selfFundingMonth ? `Month ${cr.combined.selfFundingMonth}` : "> 12mo"}</div>
                        <div className="text-[10px] text-muted-foreground">Abi full-time</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Bedhampton — Support Contribution</CardTitle>
                      <Badge className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">Temporary</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      {[
                        ["Monthly Revenue", formatGBP(cr.bedh.grossRevenue)],
                        ["Monthly Costs", formatGBP(cr.bedh.costs)],
                        ["Monthly Net", formatGBP(cr.bedh.netProfit)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                          <div className="font-semibold text-sm">{value}</div>
                        </div>
                      ))}
                    </div>
                    {cr.combined.totalBedhamptonSupport !== null && (
                      <div className="mt-3 pt-3 border-t text-sm flex justify-between">
                        <span className="text-muted-foreground">Total support until {clinicLabel} self-funding</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{formatGBP(cr.combined.totalBedhamptonSupport)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground">
                {calculateFinancials.isPending ? "Calculating…" : "Save assumptions to see projections."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: OWNER ══════════════════════════════════════════════════════ */}
      {tab === "owner" && (
        <div className="space-y-6">
          {cr ? (
            <>
              {/* Three phases */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    phase: "Phase 1",
                    title: "During Bedhampton support",
                    subtitle: `Bedhampton profit + ${clinicLabel} net (growing). Both clinics running.`,
                    income: cr.owner.phase1Income,
                    shortfall: cr.owner.phase1Shortfall,
                    safe: cr.owner.phase1IsSafe,
                    breakdown: [
                      ["Bedhampton net", cr.bedh.netProfit],
                      [`${clinicLabel} net`, cr.winc.netProfit],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 2",
                    title: "After Bedhampton closes",
                    subtitle: `${clinicLabel} running solo at scenario occupancy. Bedhampton income removed.`,
                    income: cr.owner.phase2Income,
                    shortfall: cr.owner.phase2Shortfall,
                    safe: cr.owner.phase2IsSafe,
                    breakdown: [
                      [`${clinicLabel} net`, cr.winc.netProfit],
                      ["Bedhampton", 0],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 3",
                    title: `${clinicLabel} at full target`,
                    subtitle: `${clinicLabel} alone at scenario occupancy. Does Winchester cover your full drawings target?`,
                    income: cr.owner.phase3Income,
                    shortfall: Math.max(cr.owner.targetDrawings - cr.owner.phase3Income, 0),
                    safe: cr.owner.phase3IsSafe,
                    breakdown: [
                      [`${clinicLabel} net`, cr.winc.netProfit],
                      ["Bedhampton", 0],
                    ] as [string, number][],
                  },
                ].map((phase) => (
                  <Card key={phase.phase} className={`shadow-sm ${phase.safe ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge className={`text-[10px] border-0 ${phase.safe ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                          {phase.phase}
                        </Badge>
                        {phase.safe ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      </div>
                      <CardTitle className="text-sm mt-1">{phase.title}</CardTitle>
                      <CardDescription className="text-xs">{phase.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {phase.breakdown.map(([label, value]) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-medium ${value === 0 ? "text-muted-foreground/50" : ""}`}>{formatGBP(value)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                        <span>Total income</span>
                        <span className={phase.safe ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{formatGBP(phase.income)}</span>
                      </div>
                      {!phase.safe && (
                        <div className="text-xs text-destructive">Monthly shortfall: {formatGBP(phase.shortfall)}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cash Required Before Opening</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "3-month Winchester fixed cost buffer", value: cr.owner.minimumCashRequired - 20000, note: "3× monthly fixed costs to cover the ramp period" },
                      { label: "Operating cashflow reserve", value: 20000, note: "Minimum £20k buffer (per gap analysis)" },
                      { label: "Recommended additional headroom", value: cr.owner.recommendedCash - cr.owner.minimumCashRequired, note: "1× extra month + contingency" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold">{formatGBP(row.value)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{row.note}</p>
                      </div>
                    ))}
                    <div className="border-t pt-2 space-y-1 text-sm">
                      <div className="flex justify-between font-semibold"><span>Minimum safe cash to open</span><span>{formatGBP(cr.owner.minimumCashRequired)}</span></div>
                      <div className="flex justify-between font-bold text-primary"><span>Recommended cash to open</span><span>{formatGBP(cr.owner.recommendedCash)}</span></div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Current savings</span>
                        <span className={`font-medium ${cr.owner.runwaySavings >= cr.owner.minimumCashRequired ? "text-emerald-600" : "text-destructive"}`}>{formatGBP(cr.owner.runwaySavings)}</span>
                      </div>
                    </div>
                    <div className="text-xs flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Cash runway if Phase 1 shortfall</span>
                      <span className="font-semibold">{cr.owner.cashRunwayMonths >= 99 ? "Secure" : `${cr.owner.cashRunwayMonths} months`}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Scenario Quick-Tests</CardTitle>
                    <CardDescription className="text-xs">Run the critical scenarios to stress-test owner survivability</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      ["stress_test", "Stress Test — worst-case ramp, is Phase 1 still survivable?"],
                      ["delayed_ramp", "Delayed Ramp — how long is the dual-clinic burden?"],
                      ["economic_downturn", "Economic Downturn — reduced spend, lower occupancy"],
                    ].map(([key, desc]) => (
                      <Button key={key} variant="outline" size="sm" className="w-full justify-between text-xs h-auto py-2" onClick={() => { saveScenario(key as ScenarioKey); setTab("owner"); }}>
                        <span className={SCENARIOS[key as ScenarioKey].color}>{SCENARIOS[key as ScenarioKey].label}</span>
                        <span className="text-muted-foreground text-[10px] ml-2 text-right hidden sm:block">{desc}</span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-muted-foreground">Save assumptions to see owner analysis.</div>
          )}
        </div>
      )}

      {/* ═══ TAB: DOMESTICS ══════════════════════════════════════════════════ */}
      {(false as boolean) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: input form */}
            <div className="space-y-5">
              <Form {...form}>
                <form className="space-y-4">
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Personal Salary</CardTitle>
                      <CardDescription className="text-xs">The income you need to draw from the business each month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField control={form.control} name={"targetDrawingsGbp" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Target monthly drawings (£)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                          <p className="text-[10px] text-muted-foreground mt-1">The amount you want to take home each month once the clinic is running</p>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">School & Childcare</CardTitle>
                      <CardDescription className="text-xs">Monthly school fees, wrap care, or childcare costs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField control={form.control} name={"schoolFeesGbp" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">School / childcare (£/mo)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                          <p className="text-[10px] text-muted-foreground mt-1">School fees, breakfast/after-school clubs, holiday clubs, childminder</p>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Travel</CardTitle>
                      <CardDescription className="text-xs">Monthly cost of getting around — commuting, school run, personal travel</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField control={form.control} name={"travelGbp" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Travel costs (£/mo)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                          <p className="text-[10px] text-muted-foreground mt-1">Fuel, train/bus passes, school drop-off travel, car costs</p>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Other Household</CardTitle>
                      <CardDescription className="text-xs">Any other regular personal or household commitments</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField control={form.control} name={"otherHouseholdGbp" as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Other household costs (£/mo)</FormLabel>
                          <FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl>
                          <p className="text-[10px] text-muted-foreground mt-1">Mortgage/rent contribution, groceries, gym, subscriptions, etc.</p>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </form>
              </Form>
              <p className="text-[11px] text-muted-foreground">Changes save automatically and instantly update your Owner phase analysis and the AI on the dashboard.</p>
            </div>

            {/* Right: live summary */}
            <div className="space-y-5">
              {(() => {
                const salary = Number(form.watch("targetDrawingsGbp" as any)) || 0;
                const school = Number(form.watch("schoolFeesGbp" as any)) || 0;
                const travel = Number(form.watch("travelGbp" as any)) || 0;
                const other = Number(form.watch("otherHouseholdGbp" as any)) || 0;
                const total = salary + school + travel + other;
                const phase1Income = cr?.owner.phase1Income ?? 0;
                const phase2Income = cr?.owner.phase2Income ?? 0;
                const phase3Income = cr?.owner.phase3Income ?? 0;
                const surplus1 = phase1Income - total;
                const surplus2 = phase2Income - total;
                const surplus3 = phase3Income - total;
                const rows = [
                  { label: "Salary (drawings)", value: salary, color: "text-foreground" },
                  { label: "School / childcare", value: school, color: "text-foreground" },
                  { label: "Travel", value: travel, color: "text-foreground" },
                  { label: "Other household", value: other, color: "text-foreground" },
                ];
                return (
                  <>
                    <Card className="shadow-md border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Monthly Household Need</CardTitle>
                        <CardDescription className="text-xs">Everything you need the business to cover each month</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <div className="rounded-lg border border-border overflow-hidden text-sm">
                          {rows.map((r, i) => (
                            <div key={r.label} className={`flex justify-between items-center px-3 py-2 ${i > 0 ? "border-t border-border/50" : ""} ${r.value === 0 ? "opacity-40" : ""}`}>
                              <span className="text-muted-foreground">{r.label}</span>
                              <span className={`font-medium ${r.color}`}>{formatGBP(r.value)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-3 py-2.5 border-t-2 border-border bg-muted/30">
                            <span className="font-semibold text-sm">Total need</span>
                            <span className="text-xl font-bold text-primary">{formatGBP(total)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`shadow-sm ${cr ? "" : "opacity-60"}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Can the Business Cover It?</CardTitle>
                        <CardDescription className="text-xs">How your household need compares across the three launch phases ({SCENARIOS[scenario].label} scenario)</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {cr ? (
                          <>
                            {[
                              { phase: "Phase 1", label: "Bedhampton + Winchester running", income: phase1Income, surplus: surplus1 },
                              { phase: "Phase 2", label: "Winchester only (Bedhampton closed)", income: phase2Income, surplus: surplus2 },
                              { phase: "Phase 3", label: "Winchester at full target", income: phase3Income, surplus: surplus3 },
                            ].map(({ phase, label, income, surplus }) => {
                              const ok = surplus >= 0;
                              return (
                                <div key={phase} className={`rounded-lg border p-3 ${ok ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20"}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold">{phase}</span>
                                    {ok
                                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                      : <XCircle className="w-4 h-4 text-destructive" />}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mb-2">{label}</p>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Business income</span>
                                    <span className="font-medium">{formatGBP(income)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs mt-0.5">
                                    <span className="text-muted-foreground">Household need</span>
                                    <span className="font-medium">{formatGBP(total)}</span>
                                  </div>
                                  <div className={`flex justify-between text-sm font-semibold mt-1.5 pt-1.5 border-t ${ok ? "border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400" : "border-red-200 dark:border-red-700 text-destructive"}`}>
                                    <span>{ok ? "Surplus" : "Shortfall"}</span>
                                    <span>{ok ? "+" : ""}{formatGBP(surplus)}</span>
                                  </div>
                                </div>
                              );
                            })}
                            <p className="text-[10px] text-muted-foreground pt-1">These figures update your Owner tab and feed into the AI analysis on the dashboard.</p>
                          </>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground text-sm">Save assumptions to see phase comparison.</div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: RISKS ══════════════════════════════════════════════════════ */}
      {tab === "risks" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />What Could Kill This Project?
              </CardTitle>
              <CardDescription>Ranked by real operational risk. Each one ties directly to the expansion model above.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {risks.map((r, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{r.threat}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${LIKELI_COLOR[r.likelihood]}`}>{r.likelihood} likelihood</Badge>
                        <span className={`text-xs ${IMPACT_COLOR[r.impact]}`}>{r.impact} impact</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.mitigation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Stress Test Each Risk</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS[ScenarioKey]][]).map(([key, s]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => { saveScenario(key); setTab("overview"); }}>
                    <span className={s.color}>{s.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-50" />
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Select a scenario and check Overview to see the financial impact on the Winchester ramp and Bedhampton exit month.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ TAB: CUSTOM MODEL ════════════════════════════════════════════════ */}
      {tab === "custom" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Standalone calculator only.</span> This Custom Model tab is a private what-if tool — it does not affect the preset scenarios (Conservative, Realistic, Delayed Ramp, etc.) shown at the top of the page. Changing the slider here will never alter those models. To change a preset, edit your assumptions in the Assumptions tab.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ── LEFT: Inputs ───────────────────────────────────────────────── */}
            <div className="lg:col-span-5 space-y-5">

              {/* Occupancy slider */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Target Occupancy
                  </CardTitle>
                  <CardDescription className="text-xs">Drag to model any scenario — results update instantly.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={5} max={100} step={5} value={customOcc}
                      onChange={(e) => setCustomOcc(Number(e.target.value))}
                      className="flex-1 accent-primary h-2 cursor-pointer"
                    />
                    <div className="w-20 text-center shrink-0">
                      <span className="text-3xl font-bold text-primary">{customOcc}</span>
                      <span className="text-lg text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                    <button onClick={() => setCustomOcc(Number(watchAll.conservativeOccupancyPercent) || 40)}
                      className="hover:text-blue-600 transition-colors">
                      Conservative: {Number(watchAll.conservativeOccupancyPercent) || 40}%
                    </button>
                    <button onClick={() => setCustomOcc(Number(watchAll.realisticOccupancyPercent) || 65)}
                      className="hover:text-primary transition-colors">
                      Realistic: {Number(watchAll.realisticOccupancyPercent) || 65}%
                    </button>
                    <button onClick={() => setCustomOcc(Number(watchAll.aggressiveOccupancyPercent) || 85)}
                      className="hover:text-emerald-600 transition-colors">
                      Strong: {Number(watchAll.aggressiveOccupancyPercent) || 85}%
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue drivers */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Revenue Drivers</CardTitle>
                  <CardDescription className="text-xs">Changes save automatically to your assumptions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["wincAcvGbp",             "Avg Client Value",  "£", ""],
                      ["practitionerHoursPerDay", "Hours / Day",       "",  "hr"],
                      ["workingDaysPerMonth",      "Working Days / Mo", "",  "d"],
                      ["membershipRevenueGbp",     "Membership Rev",    "£", "/mo"],
                    ] as [string, string, string, string][]).map(([key, label, pre, post]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-medium text-foreground/80">{label}</label>
                        <div className="relative">
                          {pre && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{pre}</span>}
                          <input
                            type="number"
                            value={Number((watchAll as any)[key]) || 0}
                            onChange={(e) => form.setValue(key as any, Number(e.target.value))}
                            className={`h-8 w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary ${pre ? "pl-5" : "pl-3"} ${post ? "pr-8" : "pr-3"}`}
                          />
                          {post && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{post}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cost structure */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Stock Cost</CardTitle>
                    {bLive && bLive.summary.avgGrossMarginPct > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Live margin: <strong>{bLive.summary.avgGrossMarginPct}%</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const variablePct = Math.round((100 - bLive.summary.avgGrossMarginPct) * 10) / 10;
                            form.setValue("stockPercent", variablePct);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors font-semibold"
                        >
                          Apply live margin
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground/80">Stock (% of rev)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={Number(watchAll.stockPercent) || 0}
                        onChange={(e) => form.setValue("stockPercent", Number(e.target.value))}
                        className="h-8 w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary pl-3 pr-10"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center border-t pt-2">
                    <span className="text-xs text-muted-foreground">Fixed costs total (from Assumptions)</span>
                    <span className="text-sm font-semibold">{formatGBP(totalDynamicFixedCosts)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── RIGHT: Live P&L + AI Setup ─────────────────────────────────── */}
            <div className="lg:col-span-7 space-y-5 sticky top-6">

              {/* Live P&L card */}
              <Card className="shadow-md border-primary/20">
                <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-sm">Live P&L — Custom Scenario</h3>
                    <p className="text-xs text-muted-foreground">
                      {customOcc}% occupancy · {customPnl.bookedSlots.toFixed(0)} of {customPnl.slotsPerMonth.toFixed(0)} slots/mo booked
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Monthly Net</p>
                    <p className={`text-2xl font-bold ${customPnl.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatGBP(customPnl.netProfit)}
                    </p>
                  </div>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="rounded-lg border border-border overflow-hidden text-sm">
                    <div className="flex justify-between items-center px-3 py-2 bg-muted/30">
                      <span className="text-muted-foreground font-medium">Gross Revenue</span>
                      <span className="font-bold">{formatGBP(customPnl.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50">
                      <span className="text-muted-foreground pl-3">− Variable Costs</span>
                      <span className="text-destructive/80">({formatGBP(customPnl.variableCosts)})</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50">
                      <span className="text-muted-foreground pl-3">− Fixed Costs</span>
                      <span className="text-destructive/80">({formatGBP(customPnl.fixedCosts)})</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2.5 border-t-2 border-border">
                      <span className="font-bold">Monthly Net Profit</span>
                      <span className={`font-bold text-base ${customPnl.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {formatGBP(customPnl.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-1.5 border-t border-border/50 bg-muted/10">
                      <span className="text-muted-foreground text-xs">Annual net · Gross margin {customPnl.grossMargin.toFixed(0)}%</span>
                      <span className="font-semibold text-xs">{formatGBP(customPnl.netProfit * 12)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase mb-1">Slot Capacity</div>
                      <div className="font-bold">{customPnl.slotsPerMonth.toFixed(0)}</div>
                      <div className="text-[10px] text-muted-foreground">slots / mo</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase mb-1">Break-Even</div>
                      <div className="font-bold">{customPnl.breakEvenOcc}%</div>
                      <div className="text-[10px] text-muted-foreground">occupancy</div>
                    </div>
                    <div className={`rounded-lg border p-3 text-center ${customPnl.netProfit >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30" : "border-destructive/20 bg-destructive/5"}`}>
                      <div className="text-[10px] text-muted-foreground uppercase mb-1">Status</div>
                      <div className={`font-bold text-xs ${customPnl.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {customPnl.netProfit >= 0 ? "Profitable" : "Loss-making"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">at {customOcc}%</div>
                    </div>
                  </div>

                  {/* Break-even vs target occupancy bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Break-even ({customPnl.breakEvenOcc}%)</span>
                      <span>Target ({customOcc}%)</span>
                      <span>Full (100%)</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-destructive/30 rounded-full"
                        style={{ width: `${Math.min(customPnl.breakEvenOcc, 100)}%` }}
                      />
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-200 ${customPnl.netProfit >= 0 ? "bg-primary" : "bg-amber-500"}`}
                        style={{ width: `${customOcc}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {customOcc > customPnl.breakEvenOcc
                        ? `${customOcc - customPnl.breakEvenOcc}% above break-even — in profit territory`
                        : customOcc === customPnl.breakEvenOcc
                          ? "Exactly at break-even"
                          : `${customPnl.breakEvenOcc - customOcc}% below break-even — needs more bookings to cover costs`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* AI Smart Setup */}
              <Card className="shadow-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    AI Smart Setup
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Answer these questions about your vision — then let AI generate a full, market-calibrated cost breakdown in ~30 seconds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {([
                    ["q1", "What treatments will you offer? (e.g. injectables, laser, facials)"],
                    ["q2", "What's your target monthly income from the clinic?"],
                    ["q3", "How many days per week will the clinic operate?"],
                    ["q4", "Any specific cost concerns or constraints?"],
                    ["q5", "Anything else AI should factor in (goals, timeline, team size)?"],
                  ] as [keyof typeof aiQA, string][]).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
                      <input
                        type="text"
                        value={aiQA[key]}
                        onChange={(e) => setAiQA(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Type your answer…"
                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                      />
                    </div>
                  ))}
                  <div className="pt-2 space-y-2">
                    <Button
                      className="w-full gap-2"
                      onClick={() => { setTab("model"); handleGenerateAssumptions(); }}
                      disabled={aiGenerating}
                    >
                      {aiGenerating
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Generating full model…</>
                        : <><Wand2 className="w-4 h-4" />Generate Full Model with AI</>}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Analyses your property, location and UK market rates. Opens Assumptions tab — review all items before applying.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: INVESTMENT & OWNERSHIP ════════════════════════════════════ */}
      {tab === "investment" && (
        <div className="space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Investment & Ownership</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Model your capital structure, loan repayments, and 12-month shareholder payout at the point of investment.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadInvestmentData(scenario, rampTier)} disabled={invLoading} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${invLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {invLoading && !investmentSummary && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading investment data…
            </div>
          )}

          {/* ── Business Valuation ──────────────────────────────────────────── */}
          {(() => {
            const r12   = investmentSummary?.rolling12m;
            const y2    = investmentSummary?.annualSummary?.y2;
            const r12d  = r12?.indicativeDividendCapacity ?? r12?.distributable ?? 0;
            const y2d   = y2?.indicativeDividendCapacity ?? y2?.distributable ?? 0;
            const y2r   = y2?.revenue ?? 0;
            const blendD = Math.round((5 * r12d + y2d) / 6);
            const ready = !!r12;
            const preMoney  = ready ? Math.round(blendD * valuationMultiple) : 0;
            const preMoney12 = ready ? Math.round(r12d * valuationMultiple) : 0;
            const preMoney2 = ready && y2 ? Math.round(y2d * valuationMultiple) : 0;
            const multiples: { val: 5 | 7 | 10; label: string; desc: string }[] = [
              { val: 5,  label: "5×", desc: "Conservative" },
              { val: 7,  label: "7×", desc: "Base case" },
              { val: 10, label: "10×", desc: "Growth" },
            ];
            return (
              <Card className="shadow-sm border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary/70 shrink-0" />
                    <CardTitle className="text-base">Business Valuation</CardTitle>
                    <span className="ml-auto text-[10px] text-muted-foreground">Pre-money estimate</span>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Blended pre-money valuation weighted 5:1 toward Year 1. Year 1 ({r12?.label ?? "Nov '26 – Oct '27"}) carries most of the weight — reflecting reality at the point of investment. Year 2 ({y2?.fyLabel ?? "FY27/28"}) anchors the stable trajectory.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Earnings multiple:</span>
                    <div className="flex gap-1.5">
                      {multiples.map(m => (
                        <button
                          key={m.val}
                          onClick={() => setValuationMultiple(m.val)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            valuationMultiple === m.val
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {m.label} <span className="font-normal opacity-70">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {ready ? (
                    <div className="space-y-2">
                      {/* Blended primary figure */}
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pre-money — blended valuation</div>
                        <div className="text-3xl font-bold text-primary tabular-nums">{formatGBP(preMoney)}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">{formatGBP(blendD)} blended distributable (5:1 Y1 weighted) × {valuationMultiple}×</div>
                      </div>
                      {/* Two components side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Year 1 — {r12?.label ?? "Nov '26 – Oct '27"}</div>
                          <div className="text-base font-bold text-foreground tabular-nums">{formatGBP(preMoney12)}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatGBP(r12d)} distributable × {valuationMultiple}× (ramp-up)</div>
                        </div>
                        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Year 2 — {y2?.fyLabel ?? "FY27/28"} (stable)</div>
                          <div className="text-base font-bold text-foreground tabular-nums">{formatGBP(preMoney2)}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatGBP(y2d)} distributable × {valuationMultiple}× (full FY)</div>
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex justify-between">
                        <span>Revenue cross-check (Year 2 stable, {y2?.fyLabel ?? "FY27/28"})</span>
                        <span className="font-semibold text-foreground">{y2r ? formatGBP(y2r) : "—"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                      {invLoading
                        ? <><RefreshCw className="w-4 h-4 text-muted-foreground animate-spin shrink-0" /><span className="text-xs text-muted-foreground">Loading financial model…</span></>
                        : <>
                            <span className="text-xs text-muted-foreground">Valuation data not loaded yet.</span>
                            <button
                              onClick={() => loadInvestmentData(scenario, rampTier)}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" /> Load now
                            </button>
                          </>
                      }
                    </div>
                  )}
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Methodology:</span> 5:1 weighted blend of two distributable profit figures: Year 1 ({r12?.label ?? "Nov '26 – Oct '27"}, first 12 months from opening) receives 5 parts weight; Year 2 ({y2?.fyLabel ?? "FY27/28"}, first full stable FY) receives 1 part. This heavy Year 1 bias reflects the reality that at the point of investment the business is unproven — Year 2 anchors the upside trajectory without inflating the headline figure. Formula: (5 × Y1 + Y2) ÷ 6. Conservative (5×) suits an unproven clinic; base case (7×) reflects UK aesthetics practice comparables; growth (10×) prices in expansion potential. Any external fundraise should be supported by a formal valuation.
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Investment Need ──────────────────────────────────────────────── */}
          {(() => {
            const fa  = fundingAnalysis;
            const ig  = fa?.investmentGap;
            const is  = investmentSummary;
            const minCashEntry = cashflow?.reduce<CashflowMonth | null>(
              (a, b) => a === null || b.cashBalance < a.cashBalance ? b : a, null
            );
            const minCashBalance  = minCashEntry?.cashBalance ?? 0;
            const minCashLabel    = minCashEntry?.calendarLabel ?? "—";
            const deficitToZero   = Math.max(0, -minCashBalance);
            const y1             = (is as any)?.annualSummary?.y1;
            const fixedMonthly   = cr?.winc?.fixedCosts
              ?? (y1 ? Math.round(y1.fixedCosts / (y1.tradingMonths || 12)) : 0);
            const workingCapital  = fixedMonthly * 2;
            const minimumToLaunch = deficitToZero + workingCapital;
            const lowBase  = minimumToLaunch;
            const medBase  = Math.round(minimumToLaunch * 1.25);
            const highBase = Math.round(medBase * 1.30);
            const committed = ig?._totalCommitted ?? is?.totalCapitalGbp ?? 0;
            const tiers = [
              {
                key: "low", label: "Low", amount: lowBase,
                sublabel: "Deficit + 2 months working capital",
                detail: "The minimum viable raise — covers the pre-opening cash deficit and two months of fixed overheads. No margin for error; assumes Bedhampton income and project timelines land exactly as modelled.",
                color: { border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50/40 dark:bg-amber-950/20", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-400" },
              },
              {
                key: "medium", label: "Medium", amount: medBase,
                sublabel: "Low + 25% contingency",
                detail: "Adds a 25% contingency buffer above the minimum — covers minor fit-out overruns, permit delays, or a slower ramp without running dry. The recommended raise for a first-time clinic launch.",
                color: { border: "border-primary/30 dark:border-primary/40", bg: "bg-primary/5 dark:bg-primary/10", badge: "bg-primary/10 text-primary dark:bg-primary/20", dot: "bg-primary" },
                recommended: true,
              },
              {
                key: "high", label: "High", amount: highBase,
                sublabel: "Medium + 30% safety margin",
                detail: "Full resilience against significant overruns, regulatory delays, or a prolonged trading ramp. Appropriate if you want to avoid any further fundraising rounds before self-sufficiency.",
                color: { border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50/40 dark:bg-blue-950/20", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-500" },
              },
            ];
            return (
              <Card className="shadow-sm border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary/70 shrink-0" />
                    <CardTitle className="text-base">Investment Need</CardTitle>
                    {committed > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{formatGBP(committed)} committed</span>}
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Launch cash state and what it takes to open safely.
                    {ig?.gapNarrative && <span className="block mt-1 text-foreground/70">{ig.gapNarrative}</span>}
                  </CardDescription>
                </CardHeader>
                {cashflow && cashflow.length > 0 && (() => {
                  const bizCap      = is?.businessCapitalGbp ?? 0;
                  const projectCost = is?.capitalSelectedGbp ?? 0;
                  const bedhIncome  = is?.preOpenBedhNetGbp  ?? 0;
                  const bedhMonths  = is?.preOpenMonths      ?? 0;
                  return (
                    <div className="mx-6 mb-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3 space-y-1.5 text-xs">
                      {bizCap > 0 && <div className="flex justify-between text-muted-foreground"><span>Business capital (available at start)</span><span className="tabular-nums text-emerald-600">+{formatGBP(bizCap)}</span></div>}
                      {projectCost > 0 && <div className="flex justify-between text-muted-foreground"><span>Project costs (base plan fit-out)</span><span className="tabular-nums text-red-600">−{formatGBP(projectCost)}</span></div>}
                      {bedhIncome > 0 && <div className="flex justify-between text-muted-foreground"><span>Bedhampton net income{bedhMonths > 0 ? ` (${bedhMonths} mo pre-opening)` : ""}</span><span className="tabular-nums text-emerald-600">+{formatGBP(bedhIncome)}</span></div>}
                      <div className={`flex justify-between font-semibold border-t border-border/40 pt-1.5 mt-1 ${minCashBalance < 0 ? "text-red-700" : "text-emerald-700"}`}>
                        <span>Working capital at open ({minCashLabel})</span>
                        <span className="tabular-nums">{minCashBalance < 0 ? `−${formatGBP(-minCashBalance)}` : `+${formatGBP(minCashBalance)}`}</span>
                      </div>
                      {fixedMonthly > 0 && <div className="flex justify-between text-muted-foreground pt-2 mt-1 border-t border-border/30"><span>Monthly fixed overheads</span><span className="tabular-nums">{formatGBP(fixedMonthly)}</span></div>}
                      {fixedMonthly > 0 && <div className="flex justify-between text-muted-foreground"><span>Working capital buffer (2 months)</span><span className="tabular-nums text-amber-600">+{formatGBP(workingCapital)}</span></div>}
                      <div className="flex justify-between font-semibold border-t border-border/40 pt-1.5 mt-1 text-primary"><span>Minimum to launch safely</span><span className="tabular-nums">{formatGBP(minimumToLaunch)}</span></div>
                    </div>
                  );
                })()}
                <CardContent className="space-y-3">
                  {!fa && <p className="text-xs text-muted-foreground italic">Run the AI Funding Analysis below to generate tailored gap scenarios with full narrative.</p>}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {tiers.map(tier => {
                      const isSelected = selectedInvTier === tier.key;
                      return (
                        <div
                          key={tier.key}
                          onClick={() => setSelectedInvTier(isSelected ? null : tier.key as any)}
                          className={`relative rounded-lg border p-4 space-y-2 cursor-pointer transition-all ${tier.color.border} ${tier.color.bg} ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:shadow-md"}`}
                        >
                          {(tier as any).recommended && (
                            <span className={`absolute -top-2 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier.color.badge}`}>★ Recommended</span>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${tier.color.dot}`} />
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tier.label}</span>
                            </div>
                            {isSelected && <span className="text-[10px] text-primary font-semibold">▼ Equity calc</span>}
                          </div>
                          <div className="text-2xl font-bold tabular-nums">{formatGBP(tier.amount)}</div>
                          <div className="text-[11px] font-medium text-foreground/80">{tier.sublabel}</div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{tier.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                  {selectedInvTier && (() => {
                    const tier = tiers.find(t => t.key === selectedInvTier)!;
                    const y1d = (is as any)?.annualSummary?.y1?.indicativeDividendCapacity ?? (is as any)?.annualSummary?.y1?.distributable ?? 0;
                    const preMoney = Math.round(y1d * valuationMultiple);
                    const postMoney = preMoney + tier.amount;
                    const equityPct = preMoney > 0 ? (tier.amount / postMoney) * 100 : 0;
                    const founderRetains = 100 - equityPct;
                    return (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-primary uppercase tracking-wide">Equity calculator — {tier.label} raise ({formatGBP(tier.amount)})</div>
                          <button onClick={() => setSelectedInvTier(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: "Investment", value: formatGBP(tier.amount), sub: `${tier.label} tier raise` },
                            { label: "Pre-money valuation", value: formatGBP(preMoney), sub: `Y1 distributable × ${valuationMultiple}×` },
                            { label: "Post-money valuation", value: formatGBP(postMoney), sub: "pre-money + raise" },
                            { label: "Equity given up", value: `${equityPct.toFixed(1)}%`, sub: `Founder retains ${founderRetains.toFixed(1)}%`, highlight: true },
                          ].map(k => (
                            <div key={k.label} className={`rounded-md p-3 ${(k as any).highlight ? "bg-primary text-primary-foreground" : "bg-background border border-border/60"}`}>
                              <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${(k as any).highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{k.label}</div>
                              <div className="text-lg font-bold tabular-nums">{k.value}</div>
                              <div className={`text-[10px] mt-0.5 ${(k as any).highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{k.sub}</div>
                            </div>
                          ))}
                        </div>
                        {preMoney > 0 ? (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Raising {formatGBP(tier.amount)} at a pre-money valuation of {formatGBP(preMoney)} ({valuationMultiple}× Y1 earnings) implies a post-money of {formatGBP(postMoney)}.
                            An investor at this tier would receive <strong className="text-foreground">{equityPct.toFixed(1)}% equity</strong> — you retain <strong className="text-foreground">{founderRetains.toFixed(1)}%</strong>.
                            {equityPct < 15 ? " This is a relatively low dilution for a seed-stage raise, making it attractive for both sides." : equityPct < 25 ? " This is within typical seed-stage dilution range for a UK small business." : " This is meaningful dilution — consider whether the valuation multiple should be increased, or whether the raise can be structured with a loan component to reduce equity given up."}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">Set your financial assumptions to generate a valuation and equity calculation.</p>
                        )}
                      </div>
                    );
                  })()}
                  {committed > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border/30 pt-3">
                      <span className="font-semibold text-emerald-700">{formatGBP(committed)}</span>
                      <span>already committed via investment instruments</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* ── 3-Year Performance Outlook ──────────────────────────────────── */}
          {investmentSummary?.annualSummary && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">3-Year Performance Outlook</CardTitle>
                </div>
                <CardDescription className="text-xs mt-1">
                  Combined company P&L (Winchester + Bedhampton) aligned to your August–July financial year. FY1 pre-opening months include Bedhampton net. Each clinician ramps independently from their start date. £3,000/mo floor retained before dividends.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground min-w-[200px]">Line</th>
                        {(["y1", "y2", "y3"] as const).map((k) => {
                          const yr = investmentSummary.annualSummary[k];
                          return (
                            <th key={k} className="text-right px-4 py-2 font-semibold text-muted-foreground min-w-[130px]">
                              <div>{yr.fyLabel}</div>
                              <div className="text-[10px] font-normal text-muted-foreground/70">{yr.fyDesc} · {yr.tradingMonths}mo trading</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        { label: "Winchester Revenue", key: "revenue" },
                        { label: "Variable Costs", key: "variableCosts", isDeduction: true, color: "text-muted-foreground" },
                        { label: "Gross Profit", key: "grossProfit", pctKey: "grossMarginPct", isBold: true, divider: true },
                        { label: "Fixed Costs", key: "fixedCosts", isDeduction: true, color: "text-muted-foreground" },
                        { label: "Winchester Operating Profit", key: "operatingProfit", isBold: true, divider: true },
                        { label: "VAT Liability", key: "wincVat", isDeduction: true, color: "text-muted-foreground" },
                        { label: "Bedhampton Net Profit", key: "bedhNet", color: "text-violet-600 dark:text-violet-400" },
                        { label: "Combined Net (post-VAT)", key: "combinedOperating", isBold: true, divider: true },
                        { label: "Loan Repayments", key: "loanRepayments", isDeduction: true, color: "text-blue-600 dark:text-blue-400" },
                        { label: "Director Salary", key: "directorSalary", isDeduction: true, color: "text-orange-600 dark:text-orange-400" },
                        { label: "Indicative Max Dividend Capacity", key: "indicativeDividendCapacity", isBold: true, isHighlight: true, divider: true },
                      ] as { label: string; key: string; isDeduction?: boolean; color?: string; isBold?: boolean; pctKey?: string; divider?: boolean; isHighlight?: boolean }[]).map((row) => {
                        const years = [investmentSummary.annualSummary.y1, investmentSummary.annualSummary.y2, investmentSummary.annualSummary.y3];
                        return (
                          <tr key={row.label} className={`border-b border-border/40 ${row.isHighlight ? "bg-emerald-50/60 dark:bg-emerald-950/20" : row.divider ? "bg-muted/20" : ""}`}>
                            <td className={`px-4 py-2 ${row.isBold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</td>
                            {years.map((yr, i) => {
                              const val: number = (yr as any)[row.key] ?? 0;
                              const pct: number | null = row.pctKey ? (yr as any)[row.pctKey] : null;
                              const display = row.isDeduction
                                ? val > 0 ? `(${formatGBP(val)})` : "—"
                                : val > 0 ? `+${formatGBP(val)}` : val < 0 ? formatGBP(val) : "—";
                              return (
                                <td key={i} className={`text-right px-4 py-2 tabular-nums ${row.isBold ? "font-semibold" : ""} ${row.isHighlight ? "text-emerald-700 font-bold text-sm" : row.color ?? ""}`}>
                                  {display}
                                  {pct !== null && val !== 0 && <span className="ml-1 text-[10px] text-muted-foreground">{pct}%</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 text-[10px] text-muted-foreground italic border-t border-border/30 bg-muted/10">
                  <span className="font-semibold not-italic text-foreground">Indicative Max Dividend Capacity</span> is calculated from the Monthly P&amp;L "Net after Salary" line and represents the maximum theoretical amount available before corporation tax, retained earnings checks, working capital decisions, and board/accountant approval. Actual lawful dividends must be confirmed from statutory accounts and available distributable reserves. Combined Operating Profit shown is pre-VAT operating result; VAT is deducted separately as a cash liability.
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Capital Summary KPIs ─────────────────────────────────────────── */}
          {investmentSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Capital Raised", value: formatGBP(investmentSummary.totalCapitalGbp), icon: <Banknote className="w-4 h-4 text-emerald-600" />, sub: `${investments.length} instrument${investments.length !== 1 ? "s" : ""}`, color: "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" },
                { label: "Equity Given Up", value: `${investmentSummary.totalEquityGivenUpPercent.toFixed(1)}%`, icon: <PieChart className="w-4 h-4 text-amber-600" />, sub: `Founder retains ${investmentSummary.founderEquityPercent.toFixed(1)}%`, color: investmentSummary.totalEquityGivenUpPercent > 49 ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" },
                { label: "Loan Repayments — Year 1", value: formatGBP(investmentSummary.totalLoanRepaymentsYear1), icon: <TrendingDown className="w-4 h-4 text-blue-600" />, sub: "Total across all loans", color: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" },
                { label: "Indicative Dividend Cap. — 12m", value: formatGBP(investmentSummary.distributableProfit12m), icon: <TrendingUp className="w-4 h-4 text-primary" />, sub: investmentSummary.distributableProfit12m >= 0 ? "Net after salary · pre-corp tax" : "Business in loss at 12m", color: investmentSummary.distributableProfit12m >= 0 ? "border-primary/30 bg-primary/5" : "border-red-200 bg-red-50/50 dark:bg-red-950/20" },
              ].map(k => (
                <div key={k.label} className={`rounded-lg border p-3 ${k.color}`}>
                  <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</span></div>
                  <div className="text-xl font-bold">{k.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Investment Instruments ───────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Investment Instruments</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setAddingInvType("loan"); setAddingShareholder(false); }}>
                    <Plus className="w-3.5 h-3.5" /> Add Loan
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setAddingInvType("equity"); setAddingShareholder(false); }}>
                    <Plus className="w-3.5 h-3.5" /> Add Equity Investment
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs mt-1">
                <span className="font-semibold">Loan</span> — borrowed capital with scheduled repayments; optionally gives up equity. &nbsp;
                <span className="font-semibold">Equity investment</span> — lump-sum capital in exchange for a share of the business.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Add investment form */}
              {addingInvType && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold capitalize flex items-center gap-2">
                      {addingInvType === "loan" ? <Banknote className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      New {addingInvType === "loan" ? "Loan" : "Equity Investment"}
                    </div>
                    <button onClick={() => setAddingInvType(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-3">
                      <label className="text-xs text-muted-foreground">Name / Description *</label>
                      <Input className="h-8 mt-1 text-sm" placeholder={addingInvType === "loan" ? "e.g. NatWest Business Loan" : "e.g. Angel Investor — J. Smith"} value={newInv.name} onChange={e => setNewInv(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Amount (£) *</label>
                      <Input className="h-8 mt-1 text-sm" type="number" placeholder="50000" value={newInv.amountGbp} onChange={e => setNewInv(p => ({ ...p, amountGbp: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Equity Given Up (%)</label>
                      <Input className="h-8 mt-1 text-sm" type="number" placeholder="0" value={newInv.equityPercent} onChange={e => setNewInv(p => ({ ...p, equityPercent: e.target.value }))} />
                    </div>
                    {addingInvType === "loan" && (<>
                      <div>
                        <label className="text-xs text-muted-foreground">Annual Interest Rate (%)</label>
                        <Input className="h-8 mt-1 text-sm" type="number" placeholder="6.5" value={newInv.interestRatePercent} onChange={e => setNewInv(p => ({ ...p, interestRatePercent: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Repayment Term (months)</label>
                        <Input className="h-8 mt-1 text-sm" type="number" placeholder="60" value={newInv.repaymentTermMonths} onChange={e => setNewInv(p => ({ ...p, repaymentTermMonths: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Agreement signed</label>
                        <p className="text-[10px] text-muted-foreground mb-1">Date the loan agreement was signed</p>
                        <Input className="h-8 text-sm" type="date" value={newInv.agreementStartDate} onChange={e => setNewInv(p => ({ ...p, agreementStartDate: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Money received</label>
                        <p className="text-[10px] text-muted-foreground mb-1">When the funds land in your account — shown as a cash inflow in the P&L</p>
                        <Input className="h-8 text-sm" type="date" value={newInv.depositDate} onChange={e => setNewInv(p => ({ ...p, depositDate: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">First repayment</label>
                        <p className="text-[10px] text-muted-foreground mb-1">Date of your first monthly repayment — deducted from net profit each month</p>
                        <Input className="h-8 text-sm" type="date" value={newInv.firstPaymentDate} onChange={e => setNewInv(p => ({ ...p, firstPaymentDate: e.target.value }))} />
                      </div>
                    </>)}
                    <div className="col-span-2 sm:col-span-3">
                      <label className="text-xs text-muted-foreground">Notes</label>
                      <Input className="h-8 mt-1 text-sm" placeholder="Optional notes about this instrument…" value={newInv.notes} onChange={e => setNewInv(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5 text-xs" onClick={addInvestment} disabled={!newInv.name || !newInv.amountGbp}>
                      <Plus className="w-3.5 h-3.5" /> Add {addingInvType === "loan" ? "Loan" : "Investment"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddingInvType(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Investment list */}
              {investments.length === 0 && !addingInvType ? (
                <p className="text-sm text-muted-foreground italic py-2">No investment instruments added yet. Use the buttons above to add a loan or equity investment.</p>
              ) : investments.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {["Instrument", "Type", "Amount", "Equity %", "Monthly Repayment", "Rate", "Term", "Notes", ""].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((inv: any) => {
                        const isEditing = editingInv?.id === inv.id;
                        const monthlyPmt = inv.type === "loan" && inv.interestRatePercent > 0 && inv.repaymentTermMonths > 0
                          ? inv.amountGbp * ((inv.interestRatePercent / 100 / 12) * Math.pow(1 + inv.interestRatePercent / 100 / 12, inv.repaymentTermMonths)) / (Math.pow(1 + inv.interestRatePercent / 100 / 12, inv.repaymentTermMonths) - 1)
                          : inv.type === "loan" && inv.repaymentTermMonths > 0 ? inv.amountGbp / inv.repaymentTermMonths : 0;
                        return (
                          <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            {isEditing ? (
                              <>
                                <td className="px-2 py-1.5" colSpan={8}>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-muted-foreground leading-none">Name</span>
                                      <Input className="h-7 text-xs" value={editingInv.name} onChange={e => setEditingInv((p: any) => ({ ...p, name: e.target.value }))} placeholder="Name" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-muted-foreground leading-none">Amount £</span>
                                      <Input className="h-7 text-xs" type="number" value={editingInv.amountGbp} onChange={e => setEditingInv((p: any) => ({ ...p, amountGbp: parseFloat(e.target.value) || 0 }))} placeholder="Amount £" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-muted-foreground leading-none">Equity %</span>
                                      <Input className="h-7 text-xs" type="number" value={editingInv.equityPercent} onChange={e => setEditingInv((p: any) => ({ ...p, equityPercent: parseFloat(e.target.value) || 0 }))} placeholder="Equity %" />
                                    </div>
                                    {inv.type === "loan" && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-muted-foreground leading-none">Interest rate %</span>
                                        <Input className="h-7 text-xs" type="number" value={editingInv.interestRatePercent} onChange={e => setEditingInv((p: any) => ({ ...p, interestRatePercent: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 6.5" />
                                      </div>
                                    )}
                                    {inv.type === "loan" && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-muted-foreground leading-none">Term (months)</span>
                                        <Input className="h-7 text-xs" type="number" value={editingInv.repaymentTermMonths} onChange={e => setEditingInv((p: any) => ({ ...p, repaymentTermMonths: parseInt(e.target.value) || 0 }))} placeholder="e.g. 36" />
                                      </div>
                                    )}
                                    {inv.type === "loan" && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-muted-foreground leading-none">Agreement signed</span>
                                        <Input className="h-7 text-xs" type="date" value={editingInv.agreementStartDate ?? ""} onChange={e => setEditingInv((p: any) => ({ ...p, agreementStartDate: e.target.value || null }))} />
                                      </div>
                                    )}
                                    {inv.type === "loan" && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-muted-foreground leading-none">Money received</span>
                                        <Input className="h-7 text-xs" type="date" value={editingInv.depositDate ?? ""} onChange={e => setEditingInv((p: any) => ({ ...p, depositDate: e.target.value || null }))} />
                                      </div>
                                    )}
                                    {inv.type === "loan" && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-muted-foreground leading-none">First repayment</span>
                                        <Input className="h-7 text-xs" type="date" value={editingInv.firstPaymentDate ?? ""} onChange={e => setEditingInv((p: any) => ({ ...p, firstPaymentDate: e.target.value || null }))} />
                                      </div>
                                    )}
                                    <div className="flex flex-col gap-0.5 col-span-2">
                                      <span className="text-[10px] text-muted-foreground leading-none">Notes</span>
                                      <Input className="h-7 text-xs" value={editingInv.notes} onChange={e => setEditingInv((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Button size="sm" className="h-6 text-xs" onClick={saveEditInv}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingInv(null)}>Cancel</Button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 font-medium">{inv.name}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className={`text-[10px] font-semibold ${inv.type === "loan" ? "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30" : "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"}`}>
                                    {inv.type === "loan" ? "Loan" : "Equity"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 font-semibold">{formatGBP(inv.amountGbp)}</td>
                                <td className="px-3 py-2">{inv.equityPercent > 0 ? `${inv.equityPercent}%` : "—"}</td>
                                <td className="px-3 py-2">{inv.type === "loan" && monthlyPmt > 0 ? <span className="text-blue-700 font-semibold">{formatGBP(Math.round(monthlyPmt))}/mo</span> : "—"}</td>
                                <td className="px-3 py-2">{inv.type === "loan" && inv.interestRatePercent > 0 ? `${inv.interestRatePercent}%` : "—"}</td>
                                <td className="px-3 py-2">{inv.type === "loan" && inv.repaymentTermMonths > 0 ? `${inv.repaymentTermMonths}mo` : "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{inv.notes || "—"}</td>
                                <td className="px-3 py-2">
                                  <div className="flex gap-1">
                                    <button onClick={() => setEditingInv({ ...inv })} className="text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => deleteInvestment(inv.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t-2">
                      <tr>
                        <td className="px-3 py-2 font-bold text-xs" colSpan={2}>Total</td>
                        <td className="px-3 py-2 font-bold text-xs">{formatGBP(investments.reduce((s: number, i: any) => s + i.amountGbp, 0))}</td>
                        <td className="px-3 py-2 font-bold text-xs">{investments.reduce((s: number, i: any) => s + i.equityPercent, 0).toFixed(1)}%</td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Ownership Register ───────────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Ownership Register</CardTitle>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddingShareholder(p => !p)}>
                  <Plus className="w-3.5 h-3.5" /> Add Shareholder
                </Button>
              </div>
              <CardDescription className="text-xs mt-1">
                List all shareholders and their equity %. Include the founder, any investors who received equity, and any other equity holders. Equity percentages should sum to 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Add shareholder form */}
              {addingShareholder && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> New Shareholder</div>
                    <button onClick={() => setAddingShareholder(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Name *</label>
                      <Input className="h-8 mt-1 text-sm" placeholder="e.g. Abi Peters" value={newSh.name} onChange={e => setNewSh(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Role</label>
                      <Input className="h-8 mt-1 text-sm" placeholder="e.g. Founder, Investor" value={newSh.role} onChange={e => setNewSh(p => ({ ...p, role: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Equity % *</label>
                      <Input className="h-8 mt-1 text-sm" type="number" placeholder="100" value={newSh.equityPercent} onChange={e => setNewSh(p => ({ ...p, equityPercent: e.target.value }))} />
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      <label className="text-xs text-muted-foreground">Notes</label>
                      <Input className="h-8 mt-1 text-sm" placeholder="Optional notes…" value={newSh.notes} onChange={e => setNewSh(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5 text-xs" onClick={addShareholder} disabled={!newSh.name || !newSh.equityPercent}>
                      <Plus className="w-3.5 h-3.5" /> Add Shareholder
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddingShareholder(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {shareholders.length === 0 && !addingShareholder ? (
                <p className="text-sm text-muted-foreground italic py-2">No shareholders listed yet. Add the founder first, then any investors who received equity.</p>
              ) : shareholders.length > 0 ? (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          {["Name", "Role", "Equity %", "Notes", ""].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shareholders.map((sh: any) => {
                          const isEditing = editingSh?.id === sh.id;
                          return (
                            <tr key={sh.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                              {isEditing ? (
                                <td className="px-2 py-1.5" colSpan={5}>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Input className="h-7 text-xs" value={editingSh.name} onChange={e => setEditingSh((p: any) => ({ ...p, name: e.target.value }))} placeholder="Name" />
                                    <Input className="h-7 text-xs" value={editingSh.role} onChange={e => setEditingSh((p: any) => ({ ...p, role: e.target.value }))} placeholder="Role" />
                                    <Input className="h-7 text-xs" type="number" value={editingSh.equityPercent} onChange={e => setEditingSh((p: any) => ({ ...p, equityPercent: parseFloat(e.target.value) || 0 }))} placeholder="Equity %" />
                                    <Input className="h-7 text-xs" value={editingSh.notes} onChange={e => setEditingSh((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Button size="sm" className="h-6 text-xs" onClick={saveEditSh}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingSh(null)}>Cancel</Button>
                                  </div>
                                </td>
                              ) : (
                                <>
                                  <td className="px-3 py-2 font-medium">{sh.name}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{sh.role || "—"}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[40px]">
                                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, sh.equityPercent)}%` }} />
                                      </div>
                                      <span className="font-semibold text-foreground w-10 text-right">{sh.equityPercent}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{sh.notes || "—"}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                      <button onClick={() => setEditingSh({ ...sh })} className="text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => deleteShareholder(sh.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/50 border-t-2">
                        <tr>
                          <td className="px-3 py-2 font-bold text-xs" colSpan={2}>Total</td>
                          <td className="px-3 py-2" colSpan={3}>
                            {(() => {
                              const total = shareholders.reduce((s: number, sh: any) => s + sh.equityPercent, 0);
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-xs ${Math.abs(total - 100) < 0.1 ? "text-emerald-600" : "text-amber-600"}`}>{total.toFixed(1)}%</span>
                                  {Math.abs(total - 100) > 0.1 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">{total < 100 ? `${(100 - total).toFixed(1)}% unallocated` : `${(total - 100).toFixed(1)}% over 100%`}</Badge>}
                                  {Math.abs(total - 100) < 0.1 && <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">✓ Fully allocated</Badge>}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Payout Analysis ──────────────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Payout Analysis</CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Full P&amp;L waterfall for each financial year — revenue to distributable profit, plus per-shareholder payout. FY26/27 includes only the trading months after Winchester opens. FY27/28 and FY28/29 are full 12-month years.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">


              {investmentSummary && (
                <>
                  {/* Loan repayment schedule */}
                  {investmentSummary.loanInstruments?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Loan Repayment Summary — Year 1</div>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              {["Loan", "Amount", "Rate", "Monthly Repayment", "Payments in Year 1", "Total Repaid Year 1"].map(h => (
                                <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {investmentSummary.loanInstruments.map((l: any) => (
                              <tr key={l.id} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-2 font-medium">{l.name}</td>
                                <td className="px-3 py-2">{formatGBP(l.amountGbp)}</td>
                                <td className="px-3 py-2">{l.interestRatePercent > 0 ? `${l.interestRatePercent}% p.a.` : "0%"}</td>
                                <td className="px-3 py-2 text-blue-700 font-semibold">{formatGBP(l.monthlyPayment)}/mo</td>
                                <td className="px-3 py-2">{l.paymentsInYear1} months</td>
                                <td className="px-3 py-2 font-semibold text-red-700">{formatGBP(l.totalRepaidYear1)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted/50 border-t-2">
                            <tr>
                              <td className="px-3 py-2 font-bold text-xs" colSpan={5}>Total loan repayments — Year 1</td>
                              <td className="px-3 py-2 font-bold text-xs text-red-700">{formatGBP(investmentSummary.totalLoanRepaymentsYear1)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── 3 FY P&L Waterfall Breakdowns ──────────────────────── */}
                  {investmentSummary.annualSummary && (() => {
                    const { y1, y2, y3 } = investmentSummary.annualSummary;
                    const fyNotes: Record<string, string> = {
                      [y1.fyLabel]: `${y1.tradingMonths} trading months — Winchester opens November 2026`,
                      [y2.fyLabel]: "First full financial year — 12 trading months",
                      [y3.fyLabel]: "Second full year — second clinician joins from November 2027",
                    };
                    return (
                      <div className="space-y-5">
                        {[y1, y2, y3].map((yr: any) => {
                          const positive = (yr.indicativeDividendCapacity ?? yr.distributable) >= 0;
                          const idc = yr.indicativeDividendCapacity ?? yr.distributable;
                          const waterfallRows: { label: string; value: number; suffix?: string; isBold?: boolean; isHighlight?: boolean; indent?: boolean; color?: string }[] = [
                            { label: `Gross revenue (${yr.tradingMonths} trading months)`, value: yr.revenue },
                            { label: "Less: variable costs", value: -yr.variableCosts, suffix: `gross margin ${yr.grossMarginPct}%`, indent: true, color: "text-muted-foreground" },
                            { label: "Gross profit", value: yr.grossProfit, isBold: true },
                            { label: "Less: fixed costs (rent, overheads, employer NI/pension)", value: -yr.fixedCosts, indent: true, color: "text-muted-foreground" },
                            { label: "Winchester operating profit (pre-VAT)", value: yr.operatingProfit, isBold: true },
                            { label: "Less: VAT liability", value: -(yr.wincVat ?? 0), indent: true, color: "text-muted-foreground" },
                            { label: "Plus: Bedhampton net profit", value: yr.bedhNet, indent: true, color: "text-violet-600 dark:text-violet-400" },
                            { label: "Combined net (post-VAT)", value: yr.combinedOperating, isBold: true },
                            { label: "Less: loan repayments", value: -yr.loanRepayments, indent: true, color: "text-blue-600 dark:text-blue-400" },
                            { label: "Less: director salary (drawn when net > £3k/mo floor)", value: -yr.directorSalary, indent: true, color: "text-orange-600 dark:text-orange-400" },
                            { label: "Indicative Max Dividend Capacity", value: idc, isBold: true, isHighlight: true, suffix: "pre-corp tax · sum of positive months" },
                          ];
                          return (
                            <div key={yr.fyLabel} className={`rounded-lg border ${positive ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}`}>
                              {/* FY header */}
                              <div className={`flex items-center justify-between px-4 pt-3 pb-2 border-b ${positive ? "border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-red-100 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10"}`}>
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-wide">{yr.fyLabel}</div>
                                  <div className="text-[10px] text-muted-foreground">{yr.fyDesc}</div>
                                  <div className="text-[10px] text-muted-foreground/70 italic">{fyNotes[yr.fyLabel]}</div>
                                </div>
                                <div className={`text-2xl font-bold tabular-nums ${positive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                  {positive ? "+" : ""}{formatGBP(idc)}
                                </div>
                              </div>
                              {/* P&L waterfall */}
                              <div className="p-3 space-y-2">
                                <div className="rounded-md border overflow-hidden">
                                  {waterfallRows.map((row, i) => (
                                    <div key={i} className={`flex justify-between items-center text-xs border-b border-border/30 last:border-0 px-3 py-1.5
                                      ${row.isHighlight ? (positive ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/30") : i % 2 === 0 ? "bg-muted/10" : ""}
                                      ${row.indent ? "pl-6" : ""}`}>
                                      <span className={`${row.isBold ? "font-semibold" : "text-muted-foreground"} ${row.color ?? ""}`}>{row.label}</span>
                                      <span className={`tabular-nums ${row.isHighlight ? (positive ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-red-700 dark:text-red-400 font-bold") : row.isBold ? "font-semibold" : "text-muted-foreground"}`}>
                                        {row.value > 0 ? `+${formatGBP(row.value)}` : row.value < 0 ? `(${formatGBP(Math.abs(row.value))})` : "—"}
                                        {row.suffix && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{row.suffix}</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* Per-shareholder payouts for this FY */}
                                {yr.payouts?.length > 0 ? (
                                  <div>
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Per-Shareholder Payout — {yr.fyLabel}</div>
                                    <div className="rounded-md border overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/50 border-b">
                                          <tr>
                                            {["Shareholder", "Role", "Equity %", "Payout"].map(h => (
                                              <th key={h} className="text-left px-3 py-1.5 font-semibold text-muted-foreground text-[10px]">{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {yr.payouts.map((p: any) => (
                                            <tr key={p.id} className="border-b border-border/50 last:border-0">
                                              <td className="px-3 py-1.5 font-medium">{p.name}</td>
                                              <td className="px-3 py-1.5 text-muted-foreground">{p.role || "—"}</td>
                                              <td className="px-3 py-1.5">{p.payoutPercent}%</td>
                                              <td className={`px-3 py-1.5 font-bold ${p.payoutGbp >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                                {p.payoutGbp >= 0 ? "+" : ""}{formatGBP(p.payoutGbp)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-2 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Add shareholders to the Ownership Register to see per-shareholder payout figures.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {/* ── Salary & Dividend Distribution Timeline ────────────────── */}
                  {(() => {
                    const fys = [
                      { label: investmentSummary.annualSummary.y1.fyLabel, months: investmentSummary.annualSummary.y1.monthlyBreakdown },
                      { label: investmentSummary.annualSummary.y2.fyLabel, months: investmentSummary.annualSummary.y2.monthlyBreakdown },
                      { label: investmentSummary.annualSummary.y3.fyLabel, months: investmentSummary.annualSummary.y3.monthlyBreakdown },
                    ].filter(fy => fy.months?.length > 0);
                    if (!fys.length) return null;
                    return (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Salary &amp; Dividend Distribution Timeline</div>
                        <div className="text-[10px] text-muted-foreground mb-2">
                          Month-by-month: Abi's salary is only drawn when monthly net (after loan repayments) exceeds £3,000/mo.
                          The business retains at least £3,000 first — salary comes from the surplus above that floor.
                        </div>
                        <div className="rounded-md border overflow-hidden">
                          <div className="overflow-x-auto">
                            {fys.map(fy => (
                              <div key={fy.label} className="border-b last:border-0">
                                <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{fy.label}</div>
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="border-b border-border/30">
                                      <td className="px-3 py-1 text-muted-foreground font-semibold w-28 shrink-0">Month</td>
                                      {(fy.months as any[]).map((m: any) => (
                                        <td key={m.tradingMonthIdx} className="px-2 py-1 text-center text-muted-foreground font-medium whitespace-nowrap min-w-[60px]">{m.monthLabel}</td>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="border-b border-border/20 bg-orange-50/30 dark:bg-orange-950/10">
                                      <td className="px-3 py-1.5 text-muted-foreground">Abi salary drawn</td>
                                      {(fy.months as any[]).map((m: any) => (
                                        <td key={m.tradingMonthIdx} className={`px-2 py-1.5 text-center tabular-nums whitespace-nowrap ${m.canDraw ? "text-orange-700 dark:text-orange-400 font-semibold" : "text-muted-foreground/40"}`}>
                                          {m.canDraw ? `+${formatGBP(m.directorDrawing)}` : "—"}
                                        </td>
                                      ))}
                                    </tr>
                                    <tr className="bg-emerald-50/20 dark:bg-emerald-950/10">
                                      <td className="px-3 py-1.5 text-muted-foreground">Div. Capacity</td>
                                      {(fy.months as any[]).map((m: any) => (
                                        <td key={m.tradingMonthIdx} className={`px-2 py-1.5 text-center tabular-nums whitespace-nowrap ${m.distributable > 0 ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground/40"}`}>
                                          {m.distributable > 0 ? `+${formatGBP(m.distributable)}` : "—"}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {investmentSummary.cashflowNote && (
                    <div className="text-[10px] text-muted-foreground italic border border-border/30 rounded p-2">{investmentSummary.cashflowNote}</div>
                  )}

                  {/* Return on investment summary */}
                  {investmentSummary.equityInvestments?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Return on Investment — Equity Investors (Year 1)</div>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              {["Investor", "Capital In", "Equity %", "Year 1 Return", "Year 1 ROI %"].map(h => (
                                <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {investmentSummary.equityInvestments.map((inv: any) => {
                              const return1y = investmentSummary.distributableProfit12m * (inv.equityPercent / 100);
                              const roi = inv.amountGbp > 0 ? (return1y / inv.amountGbp) * 100 : 0;
                              return (
                                <tr key={inv.id} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-2 font-medium">{inv.name}</td>
                                  <td className="px-3 py-2">{formatGBP(inv.amountGbp)}</td>
                                  <td className="px-3 py-2">{inv.equityPercent}%</td>
                                  <td className={`px-3 py-2 font-semibold ${return1y >= 0 ? "text-emerald-700" : "text-red-700"}`}>{return1y >= 0 ? "+" : ""}{formatGBP(Math.round(return1y))}</td>
                                  <td className={`px-3 py-2 font-semibold ${roi >= 0 ? "text-emerald-700" : "text-red-700"}`}>{roi.toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 italic">Note: Year 1 ROI reflects dividend income only, not equity appreciation. A full return includes the value of the equity stake at exit.</p>
                    </div>
                  )}
                </>
              )}

              {!investmentSummary && !invLoading && (
                <p className="text-sm text-muted-foreground italic">Summary not available. Add investments and shareholders, then refresh.</p>
              )}
            </CardContent>
          </Card>

          {/* ── AI Funding Adviser ──────────────────────────────────────────── */}
          {(() => {
            const fa = fundingAnalysis;
            const VERDICT_STYLES: Record<string, { badge: string; border: string; bg: string; icon: string }> = {
              LOAN_RECOMMENDED:  { badge: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",     border: "border-blue-200 dark:border-blue-800",     bg: "bg-blue-50/40 dark:bg-blue-950/20",     icon: "💳" },
              EQUITY_RECOMMENDED:{ badge: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700", border: "border-violet-200 dark:border-violet-800", bg: "bg-violet-50/40 dark:bg-violet-950/20", icon: "🤝" },
              HYBRID:            { badge: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",    border: "border-amber-200 dark:border-amber-800",    bg: "bg-amber-50/40 dark:bg-amber-950/20",    icon: "⚖️" },
              SELF_FUND:         { badge: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700", border: "border-emerald-200 dark:border-emerald-800", bg: "bg-emerald-50/40 dark:bg-emerald-950/20", icon: "✅" },
              INSUFFICIENT_DATA: { badge: "bg-muted text-muted-foreground border border-border", border: "border-border", bg: "", icon: "❓" },
            };
            const style = fa ? (VERDICT_STYLES[fa.verdict] ?? VERDICT_STYLES.INSUFFICIENT_DATA) : null;

            const ScoreBar = ({ score, label }: { score: number; label: string }) => {
              const pct = Math.round((score / 10) * 100);
              const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-400";
              return (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-right text-muted-foreground shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-5 text-right font-semibold text-foreground">{score}</span>
                </div>
              );
            };

            return (
              <Card className={`shadow-sm ${style ? `border ${style.border} ${style.bg}` : "border-border/60"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="w-4 h-4 text-primary/70 shrink-0" />
                      <CardTitle className="text-base">AI Funding Adviser</CardTitle>
                      {fa && style && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
                          <span>{style.icon}</span>
                          {fa.verdictLabel}
                        </span>
                      )}
                      {fa?._savedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          · {(() => {
                            const ms = Date.now() - new Date(fa._savedAt).getTime();
                            const h = Math.floor(ms / 3600000);
                            const m = Math.floor(ms / 60000);
                            if (h > 0) return `${h}h ago`;
                            if (m > 0) return `${m}m ago`;
                            return "just now";
                          })()}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={runFundingAnalysis} disabled={fundingAnalysisLoading} className="h-7 px-2 text-xs gap-1 shrink-0">
                      <RefreshCw className={`w-3 h-3 ${fundingAnalysisLoading ? "animate-spin" : ""}`} />
                      {fundingAnalysisLoading ? "Analysing…" : fa ? "Re-run" : "Run Analysis"}
                    </Button>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    AI assessment of loan vs equity vs self-funding for the Winchester clinic fit-out, based on your 3-year projections and capital requirement.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Context input — shown when no result yet */}
                  {!fa && !fundingAnalysisLoading && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Additional context (optional)</label>
                        <textarea
                          className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                          rows={3}
                          placeholder="e.g. I've received a loan offer from HSBC at 8.5% over 5 years for £40k. My parents can invest £20k for no equity. I'd prefer to avoid diluting ownership…"
                          value={fundingContextNote}
                          onChange={e => setFundingContextNote(e.target.value)}
                        />
                      </div>
                      <Button size="sm" onClick={runFundingAnalysis} className="gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />
                        Run Funding Analysis
                      </Button>
                    </div>
                  )}

                  {/* Loading skeleton */}
                  {fundingAnalysisLoading && (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-full" />
                      <div className="grid grid-cols-3 gap-3">
                        {[0,1,2].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}
                      </div>
                      <div className="space-y-2">
                        {[0,1,2].map(i => <div key={i} className="h-3 bg-muted rounded w-5/6" />)}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {fundingAnalysisError && !fundingAnalysisLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      {fundingAnalysisError}
                      <button onClick={runFundingAnalysis} className="underline text-primary ml-1">Try again</button>
                    </div>
                  )}

                  {/* Results */}
                  {fa && !fundingAnalysisLoading && (
                    <>
                      {/* Verdict summary */}
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                        <p className="text-xs leading-relaxed text-foreground">{fa.verdictSummary}</p>
                        {fa.recommendation && (
                          <p className="text-xs leading-relaxed text-muted-foreground mt-2">{fa.recommendation}</p>
                        )}
                      </div>

                      {/* Suitability scores */}
                      {(fa.loanCase?.suitabilityScore != null || fa.equityCase?.suitabilityScore != null || fa.selfFundCase?.suitabilityScore != null) && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suitability Scores (1–10)</div>
                          {fa.loanCase?.suitabilityScore != null && <ScoreBar score={fa.loanCase.suitabilityScore} label="Loan" />}
                          {fa.equityCase?.suitabilityScore != null && <ScoreBar score={fa.equityCase.suitabilityScore} label="Equity" />}
                          {fa.selfFundCase?.suitabilityScore != null && <ScoreBar score={fa.selfFundCase.suitabilityScore} label="Self-fund" />}
                        </div>
                      )}

                      {/* Three-column comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {fa.loanCase && (
                          <div className="rounded-lg border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">💳 Loan Finance</div>
                              {fa.loanCase.suggestedAmount && (
                                <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">{formatGBP(fa.loanCase.suggestedAmount)}</span>
                              )}
                            </div>
                            {fa.loanCase.estimatedMonthlyRepayment && (
                              <div className="text-xs text-muted-foreground">~{formatGBP(Math.round(fa.loanCase.estimatedMonthlyRepayment))}/mo · {fa.loanCase.suggestedTermMonths ?? "?"}mo term</div>
                            )}
                            {fa.loanCase.pros?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.loanCase.pros.slice(0, 3).map((p: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />{p}</li>
                                ))}
                              </ul>
                            )}
                            {fa.loanCase.cons?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.loanCase.cons.slice(0, 2).map((c: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-red-600 dark:text-red-400"><XCircle className="w-3 h-3 shrink-0 mt-0.5" />{c}</li>
                                ))}
                              </ul>
                            )}
                            {fa.loanCase.affordabilityNote && (
                              <p className="text-[10px] text-muted-foreground italic">{fa.loanCase.affordabilityNote}</p>
                            )}
                          </div>
                        )}

                        {fa.equityCase && (
                          <div className="rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/20 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">🤝 Equity Investment</div>
                              {fa.equityCase.dilutionRisk && (
                                <span className={`text-[10px] font-semibold ${fa.equityCase.dilutionRisk === "High" ? "text-red-600" : fa.equityCase.dilutionRisk === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>
                                  {fa.equityCase.dilutionRisk} dilution risk
                                </span>
                              )}
                            </div>
                            {fa.equityCase.pros?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.equityCase.pros.slice(0, 3).map((p: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />{p}</li>
                                ))}
                              </ul>
                            )}
                            {fa.equityCase.cons?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.equityCase.cons.slice(0, 2).map((c: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-red-600 dark:text-red-400"><XCircle className="w-3 h-3 shrink-0 mt-0.5" />{c}</li>
                                ))}
                              </ul>
                            )}
                            {fa.equityCase.dilutionNote && (
                              <p className="text-[10px] text-muted-foreground italic">{fa.equityCase.dilutionNote}</p>
                            )}
                          </div>
                        )}

                        {fa.selfFundCase && (
                          <div className={`rounded-lg border p-3 space-y-2 ${fa.selfFundCase.feasible ? "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-border/40 bg-muted/20"}`}>
                            <div className="flex items-center justify-between">
                              <div className={`text-[10px] font-semibold uppercase tracking-wider ${fa.selfFundCase.feasible ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>✅ Self-Fund</div>
                              <span className={`text-[10px] font-semibold ${fa.selfFundCase.feasible ? "text-emerald-600" : "text-muted-foreground"}`}>{fa.selfFundCase.feasible ? "Feasible" : "Challenging"}</span>
                            </div>
                            {fa.selfFundCase.pros?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.selfFundCase.pros.slice(0, 3).map((p: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />{p}</li>
                                ))}
                              </ul>
                            )}
                            {fa.selfFundCase.cons?.length > 0 && (
                              <ul className="space-y-0.5">
                                {fa.selfFundCase.cons.slice(0, 2).map((c: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-[10px] text-red-600 dark:text-red-400"><XCircle className="w-3 h-3 shrink-0 mt-0.5" />{c}</li>
                                ))}
                              </ul>
                            )}
                            {fa.selfFundCase.note && (
                              <p className="text-[10px] text-muted-foreground italic">{fa.selfFundCase.note}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Repayment capacity */}
                      {fa.repaymentCapacity && (
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Debt Repayment Capacity</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {fa.repaymentCapacity.maxAffordableMonthlyGbp != null && (
                              <div className="text-center">
                                <div className="text-sm font-bold text-foreground">{formatGBP(Math.round(fa.repaymentCapacity.maxAffordableMonthlyGbp))}/mo</div>
                                <div className="text-[9px] text-muted-foreground">Max Affordable Repayment</div>
                              </div>
                            )}
                            {fa.repaymentCapacity.debtServiceCoverRatio != null && (
                              <div className="text-center">
                                <div className={`text-sm font-bold ${fa.repaymentCapacity.debtServiceCoverRatio >= 1.5 ? "text-emerald-700" : fa.repaymentCapacity.debtServiceCoverRatio >= 1 ? "text-amber-600" : "text-red-600"}`}>
                                  {fa.repaymentCapacity.debtServiceCoverRatio.toFixed(2)}×
                                </div>
                                <div className="text-[9px] text-muted-foreground">Debt Service Cover</div>
                              </div>
                            )}
                            {fa.repaymentCapacity.breakEvenNote && (
                              <div className="text-center col-span-2 sm:col-span-1">
                                <div className="text-xs font-medium text-foreground">{fa.repaymentCapacity.breakEvenNote}</div>
                                <div className="text-[9px] text-muted-foreground">Break-even note</div>
                              </div>
                            )}
                          </div>
                          {fa.repaymentCapacity.capacityNote && (
                            <p className="text-[10px] text-muted-foreground italic">{fa.repaymentCapacity.capacityNote}</p>
                          )}
                        </div>
                      )}

                      {/* Key risks */}
                      {fa.keyRisks?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Risks</div>
                          <ul className="space-y-1">
                            {(fa.keyRisks as string[]).map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action items */}
                      {fa.actionItems?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recommended Next Steps</div>
                          <ol className="space-y-1 list-none">
                            {(fa.actionItems as string[]).map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                                <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                                {a}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Re-run with updated context */}
                      <div className="pt-1 border-t border-border/40">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">Update context &amp; re-run</div>
                        <div className="flex gap-2">
                          <textarea
                            className="flex-1 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                            rows={2}
                            placeholder="e.g. I've received a £40k loan offer at 7.9%…"
                            value={fundingContextNote}
                            onChange={e => setFundingContextNote(e.target.value)}
                          />
                          <Button size="sm" variant="outline" onClick={runFundingAnalysis} disabled={fundingAnalysisLoading} className="self-end gap-1.5 text-xs">
                            <Wand2 className="w-3.5 h-3.5" />
                            Re-run
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        </div>
      )}

    </div>
  );
}
