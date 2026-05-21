import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  useGetFinancialModel,
  getGetFinancialModelQueryKey,
  useUpsertFinancialModel,
  useCalculateFinancials,
  getGetOptimisationAnalysisQueryKey,
  getGetProjectDashboardQueryKey,
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
  RefreshCw, Loader2, Wand2, Lock, Sliders, Calendar,
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
type TabKey = "overview" | "model" | "owner" | "domestics" | "risks" | "custom";

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
  vatLiability: number; isVatRegistered: boolean;
  actualDrawings: number; targetDrawings: number; drawingsShortfall: number; drawingsActive: boolean;
  monthlyCashflow: number; cashBalance: number;
  occupancyPercent: number;
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
    queryClient.invalidateQueries({ queryKey: ["fixed-cost-items", PROJECT_ID] });
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

  // ── Properties — loaded first so activeProp is available for all scoped queries ──
  const { data: propertiesData = [] } = useListProperties(PROJECT_ID);
  const activeProp = (propertiesData as any[]).find((p: any) => p.isActiveForProject);
  const activePropId = activeProp?.id ?? null;

  // ── Fixed cost items — scoped per-property so each property keeps its own list ──
  const fixedCostQK = ["fixed-cost-items", PROJECT_ID, activePropId];
  const { data: fixedCostItems = [] } = useQuery<any[]>({
    queryKey: fixedCostQK,
    queryFn: () => fetch(
      `/api/projects/${PROJECT_ID}/fixed-cost-items${activePropId ? `?propertyId=${activePropId}` : ""}`
    ).then(r => r.json()),
    enabled: true,
  });
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
      data: { name: newCostName.trim(), amountGbp: Number(newCostAmount), costType: newCostType, sortOrder: fixedCostItems.length, ...(activePropId ? { propertyId: activePropId } : {}) } as any,
    });
    queryClient.invalidateQueries({ queryKey: fixedCostQK });
    setNewCostName("");
    setNewCostAmount("");
    setNewCostType("unique");
  };

  const handleUpdateCostItem = async (id: number, field: string, value: string | number) => {
    await updateFixedCostItem.mutateAsync({ id, data: { [field]: value } });
    queryClient.invalidateQueries({ queryKey: fixedCostQK });
    // Recalculate after cost change
    if (model) runCalculation();
  };

  const handleDeleteCostItem = async (id: number) => {
    await deleteFixedCostItem.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: fixedCostQK });
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
      data: { name: cost.name, amountGbp: cost.estimatedMonthly, costType: cost.costType as "unique" | "dual", sortOrder: fixedCostItems.length, ...(activePropId ? { propertyId: activePropId } : {}) } as any,
    });
    queryClient.invalidateQueries({ queryKey: fixedCostQK });
  };
  const [tab, setTab] = useState<TabKey>("overview");
  const [calcResults, setCalcResults] = useState<ExtendedCalcResult | null>(null);

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

  // Project data — needed for targetOpeningDate (Key Dates card)
  const { data: projectData } = useQuery<any>({
    queryKey: ["project", PROJECT_ID],
    queryFn: () => fetch(`/api/projects/${PROJECT_ID}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Key Dates state — synced from model / project when data loads
  const [leaseSignDate, setLeaseSignDate] = useState("");
  const [keyHandoverDate, setKeyHandoverDate] = useState("");
  const [openDate, setOpenDate] = useState("");
  const [datesSaving, setDatesSaving] = useState(false);

  useEffect(() => {
    if (model) {
      setLeaseSignDate((model as any).leaseSignDate ?? "");
      setKeyHandoverDate((model as any).keyHandoverDate ?? "");
    }
  }, [model]);

  useEffect(() => {
    if (projectData?.targetOpeningDate) {
      setOpenDate(projectData.targetOpeningDate);
    }
  }, [projectData]);

  const saveDates = async () => {
    setDatesSaving(true);
    try {
      await Promise.all([
        fetch(`/api/projects/${PROJECT_ID}/financial`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaseSignDate: leaseSignDate || null, keyHandoverDate: keyHandoverDate || null }),
        }),
        openDate
          ? fetch(`/api/projects/${PROJECT_ID}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetOpeningDate: openDate }),
            })
          : Promise.resolve(),
      ]);
      queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
      queryClient.invalidateQueries({ queryKey: ["project", PROJECT_ID] });
      queryClient.invalidateQueries({ queryKey: ["cashflow", PROJECT_ID] });
      queryClient.invalidateQueries({ queryKey: ["cashflow36", PROJECT_ID] });
      toast({ title: "Key dates saved", description: "The financial model has been updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not save key dates.", variant: "destructive" });
    } finally {
      setDatesSaving(false);
    }
  };

  // Helper: months between two YYYY-MM-DD dates (positive = d2 after d1)
  const monthsBetween = (d1: string, d2: string) => {
    if (!d1 || !d2) return null;
    const a = new Date(d1), b = new Date(d2);
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  };

  // ── Property financial comparison ──────────────────────────────────────────
  const [compareProperty, setCompareProperty] = useState<{ id: number; address: string } | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("financialCompareProperty");
    if (stored) { try { setCompareProperty(JSON.parse(stored)); } catch {} }
    const handler = (e: StorageEvent) => {
      if (e.key !== "financialCompareProperty") return;
      if (e.newValue) { try { setCompareProperty(JSON.parse(e.newValue)); } catch {} }
      else setCompareProperty(null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const clearCompare = () => {
    localStorage.removeItem("financialCompareProperty");
    setCompareProperty(null);
  };
  const compareQKBase = ["cashflow-compare", PROJECT_ID, scenario, rampTier, activeVat.rate, compareProperty?.id] as const;
  const { data: compareCashflow } = useQuery<CashflowMonth[]>({
    queryKey: compareQKBase,
    queryFn: () =>
      fetch(`/api/projects/${PROJECT_ID}/cashflow?scenario=${scenario}&rampTier=${rampTier}&vatRate=${activeVat.rate}&overridePropertyId=${compareProperty!.id}`)
        .then((r) => r.json()),
    enabled: compareProperty != null,
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const { data: compareCashflow36 } = useQuery<CashflowMonth[]>({
    queryKey: [...compareQKBase, "36"],
    queryFn: () =>
      fetch(`/api/projects/${PROJECT_ID}/cashflow?scenario=${scenario}&rampTier=${rampTier}&vatRate=${activeVat.rate}&months=36&overridePropertyId=${compareProperty!.id}`)
        .then((r) => r.json()),
    enabled: compareProperty != null,
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const comparePnlData = pnlMonths === 36 ? compareCashflow36 : compareCashflow;
  const mergedCashflow = useMemo(() => {
    if (!cashflow) return cashflow;
    if (!compareCashflow) return cashflow;
    const map = new Map(compareCashflow.map(m => [m.calendarLabel, m]));
    return cashflow.map(m => ({ ...m, compareBalance: map.get(m.calendarLabel)?.cashBalance ?? null }));
  }, [cashflow, compareCashflow]);

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
      ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0, vatCurrentTurnoverGbp: 0,
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
    const { vatOnRent: vatOnRentVal, ...rest } = values;
    return {
      ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Number(v) || 0])),
      vatOnRent: Boolean(vatOnRentVal),
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
        ownerDrawingsGbp: m.ownerDrawingsGbp ?? 0, runwaySavingsGbp: m.runwaySavingsGbp ?? 0,
        vatCurrentTurnoverGbp: m.vatCurrentTurnoverGbp ?? 0,
        personalSalaryNeedsGbp: m.personalSalaryNeedsGbp ?? 0,
        preOpeningPropertyMonths: m.preOpeningPropertyMonths ?? 2,
        freeRentMonths: m.freeRentMonths ?? 0,
        nursingIncomeGbp: m.nursingIncomeGbp ?? 4500,
        targetDrawingsGbp: m.targetDrawingsGbp ?? 4000,
        schoolFeesGbp: (m as any).schoolFeesGbp ?? 0,
        travelGbp: (m as any).travelGbp ?? 0,
        otherHouseholdGbp: (m as any).otherHouseholdGbp ?? 0,
      });
      // Restore the previously selected scenario
      if (m.selectedScenario) setScenario(m.selectedScenario as ScenarioKey);
      // Load treatment mix from plannedPricingJson
      try {
        const pj = m.plannedPricingJson;
        if (pj) { const parsed = JSON.parse(pj); if (Array.isArray(parsed)) setTreatmentMix(parsed); }
      } catch {}
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
      queryClient.invalidateQueries({ queryKey: ["fixed-cost-items", PROJECT_ID] });
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
  const cp_comm   = Number(watchAll.commissionsPercent) || 0;
  const cp_mkt    = Number(watchAll.marketingGbp) || 0;
  const cp_staff  = Number(watchAll.staffingGbp) || 0;
  const cp_cons   = Number(watchAll.consumablesGbp) || 0;
  const cp_memb   = Number(watchAll.membershipRevenueGbp) || 0;
  const cp_slots  = cp_rooms * cp_hpd * cp_dpm;
  const cp_booked = cp_slots * (customOcc / 100);
  const cp_rev    = cp_booked * cp_acv + cp_memb;
  const cp_varRatio = (cp_stock + cp_comm) / 100;
  const cp_varCost  = cp_rev * cp_varRatio + cp_mkt + cp_staff + cp_cons;
  const cp_fixCost  = totalDynamicFixedCosts;
  const cp_net      = cp_rev - cp_varCost - cp_fixCost;
  const cp_margin   = cp_rev > 0 ? ((cp_rev - cp_varCost) / cp_rev) * 100 : 0;
  const cp_denom    = cp_acv * cp_slots * (1 - cp_varRatio);
  const cp_beOcc    = cp_denom > 0 ? Math.min(Math.round(((cp_fixCost + cp_mkt + cp_staff + cp_cons) / cp_denom) * 100), 999) : 0;
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`rounded-xl border p-4 cursor-default ${cr?.combined.selfFundingMonth ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bedhampton Closes</span>
                  <Target className="w-4 h-4 text-emerald-500" />
                </div>
                <div className={`text-xl font-bold ${cr?.combined.selfFundingMonth ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {cr ? (cr.combined.selfFundingMonth ? `Month ${cr.combined.selfFundingMonth}` : "> 12 months") : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cr?.combined.selfFundingMonth
                    ? `Abi full-time at ${clinicLabel} from Month ${cr.combined.selfFundingMonth}`
                    : `${clinicLabel} doesn't hit ${cr?.winc.selfFundingBufferPercent ?? 20}% margin within 12mo`}
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
                  </div>
                </div>
                <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  Margin threshold: {cr.winc.selfFundingBufferPercent}% net-to-revenue. Once hit, Bedhampton days reduce and {clinicLabel} runs independently.
                </div>
              </TooltipContent>
            )}
          </Tooltip>

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

        </div>
      </TooltipProvider>

      {/* ─── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto scrollbar-none">
        {(["overview", "model", "owner", "domestics", "risks", "custom"] as TabKey[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "overview" ? "Overview" : t === "model" ? "Assumptions" : t === "owner" ? "Owner" : t === "domestics" ? "Domestics" : t === "risks" ? "Risks" : "Custom Model"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">

          {/* ── Key Milestone Dates ───────────────────────────────────────────── */}
          <Card className="shadow-sm border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/60 to-transparent dark:from-violet-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-sm text-violet-700 dark:text-violet-300">Key Milestone Dates</CardTitle>
              </div>
              <CardDescription className="text-xs">
                The <strong>Open Date</strong> drives the entire financial model — all revenue, costs, and cashflow are calculated from it. Set Lease Sign to automatically derive how many months of pre-opening property costs to apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Lease Sign */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Lease Sign</label>
                  <input
                    type="date"
                    value={leaseSignDate}
                    onChange={(e) => setLeaseSignDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  {leaseSignDate && openDate && (() => {
                    const m = monthsBetween(leaseSignDate, openDate);
                    return m !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {m > 0 ? `${m} month${m !== 1 ? "s" : ""} before opening` : m === 0 ? "Same month as opening" : `${Math.abs(m)} month${Math.abs(m) !== 1 ? "s" : ""} after opening`}
                        {m > 0 && <span className="ml-1 text-violet-600 dark:text-violet-400">→ model uses {m}mo pre-opening property costs</span>}
                      </p>
                    ) : null;
                  })()}
                  {!leaseSignDate && (
                    <p className="text-xs text-muted-foreground">Not set — uses Assumptions value</p>
                  )}
                </div>

                {/* Key Handover */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Handover</label>
                  <input
                    type="date"
                    value={keyHandoverDate}
                    onChange={(e) => setKeyHandoverDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  {keyHandoverDate && openDate && (() => {
                    const m = monthsBetween(keyHandoverDate, openDate);
                    return m !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {m > 0 ? `${m} month${m !== 1 ? "s" : ""} before opening` : m === 0 ? "Same month as opening" : `${Math.abs(m)} month${Math.abs(m) !== 1 ? "s" : ""} after opening`}
                      </p>
                    ) : null;
                  })()}
                  {keyHandoverDate && leaseSignDate && (() => {
                    const m = monthsBetween(leaseSignDate, keyHandoverDate);
                    return m !== null && m > 0 ? (
                      <p className="text-xs text-muted-foreground">{m} month{m !== 1 ? "s" : ""} after lease sign</p>
                    ) : null;
                  })()}
                </div>

                {/* Open Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide flex items-center gap-1">
                    Clinic Opens
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700">Model Driver</span>
                  </label>
                  <input
                    type="date"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="w-full rounded-md border border-violet-300 dark:border-violet-700 bg-background px-3 py-1.5 text-sm shadow-sm ring-1 ring-violet-200 dark:ring-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                  />
                  {openDate && (
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                      {new Date(openDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>

              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Changes take effect across all charts and projections on save.</p>
                <Button size="sm" onClick={saveDates} disabled={datesSaving} className="bg-violet-600 hover:bg-violet-700 text-white">
                  {datesSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save dates
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Property Comparison Banner ───────────────────────────────────── */}
          {compareProperty && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Comparing financials: </span>
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate">{compareProperty.address}</span>
                  <span className="ml-2 text-[10px] text-amber-600/70 dark:text-amber-500/70">
                    Orange lines / values = this property · Green = active property
                  </span>
                </div>
              </div>
              <button
                onClick={clearCompare}
                className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 shrink-0 flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          )}

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
                  const chartData = mergedCashflow ?? cashflow;
                  const openingMonth = cashflow.find(m => m.isOpeningMonth);
                  const closeMonth = cashflow.find(m => m.isSelfFundingMonth);
                  const preOpenEnd = cashflow.find(m => m.isOpeningMonth);
                  const startingCapital = cashflow[0].cashBalance - cashflow[0].monthlyCashflow;
                  const allVals = [
                    ...cashflow.map(m => m.cashBalance),
                    ...cashflow.map(m => m.monthlyCashflow),
                    ...(compareCashflow ? compareCashflow.map(m => m.cashBalance) : []),
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
                      <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
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
                                  {d.wincRevenue > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">{clinicLabel} revenue</span><span>{formatGBP(d.wincRevenue)}</span></div>}
                                  {d.vatLiability > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">VAT liability (20%)</span><span className="text-amber-600">−{formatGBP(d.vatLiability)}</span></div>}
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
                                    <p className="text-muted-foreground text-[10px]">No drawings yet — waiting for self-funding threshold</p>
                                  )}
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
                            v === "cashBalance" ? "Business capital — active property"
                            : v === "monthlyCashflow" ? "Monthly net → business capital (after drawings)"
                            : v === "compareBalance" ? `Business capital — ${compareProperty?.address ?? "compare"}`
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

                        {/* Comparison property capital line */}
                        {compareProperty && (
                          <Line
                            type="monotone"
                            dataKey="compareBalance"
                            name="compareBalance"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls
                          />
                        )}
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
                          <span title="All fixed cost items from Assumptions (rent, rates, insurance, dual costs — counted once)">Fixed (Winc)</span>
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
                        <th className="text-right px-2 py-2 font-semibold text-orange-600 dark:text-orange-400 min-w-[80px]">
                          <span title="Project plan task costs charged this month (from Project Plan cost tiers). Undated tasks are spread across pre-opening months, weighted toward opening.">Proj costs</span>
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-orange-600 dark:text-orange-400 min-w-[80px]">
                          <span title="Owner's drawings taken from the business this month. Only active once Winchester is self-funding. Capped so at least £3,000/month is retained in the business.">Drawings</span>
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">Net Profit</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pnlData ?? cashflow ?? []).map((m) => {
                        const isOpen = m.isOpeningMonth;
                        const isClose = m.isSelfFundingMonth;
                        const netProfitRow = m.wincNet + m.bedhNet;

                        // ── Bedhampton cost breakdown ──────────────────────
                        const _bedhStockPct  = (model as any)?.bedhStockPercent ?? 35;
                        const _bedhStock     = Math.round(m.bedhRevenue * _bedhStockPct / 100);
                        const _bedhRent      = (model as any)?.bedhRentGbp ?? 0;
                        const _bedhMarketing = (model as any)?.bedhMarketingGbp ?? 0;
                        const _bedhOther     = (model as any)?.bedhamptonCostsGbp ?? 0;
                        const _bedhVat       = Math.round(m.bedhRevenue - m.bedhCosts - m.bedhNet);

                        // ── Winchester variable cost breakdown ─────────────
                        const _wincStockPct  = (model as any)?.stockPercent ?? 0;
                        const _wincCommPct   = (model as any)?.commissionsPercent ?? 0;
                        const _wincStock     = Math.round(m.wincRevenue * _wincStockPct / 100);
                        const _wincComm      = Math.round(m.wincRevenue * _wincCommPct / 100);
                        const _wincMarketing = (model as any)?.marketingGbp ?? 0;
                        const _wincStaffing  = (model as any)?.staffingGbp ?? 0;
                        const _wincConsumables = (model as any)?.consumablesGbp ?? 0;
                        const rowBg = isClose
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : isOpen
                          ? "bg-primary/5"
                          : m.isVatRegistered
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
                                : <span className={`font-medium ${m.occupancyPercent >= 60 ? "text-emerald-600 dark:text-emerald-400" : m.occupancyPercent >= 35 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{m.occupancyPercent}%</span>
                              }
                            </td>

                            {/* Winchester Revenue */}
                            <td className="text-right px-2 py-1.5 tabular-nums">
                              {m.wincRevenue > 0 ? formatGBP(m.wincRevenue) : <span className="text-muted-foreground/40">—</span>}
                            </td>

                            {/* Winchester Variable (stock + commissions + mktg + staffing + consumables) */}
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {m.wincVariableCosts > 0
                                ? <span className="text-red-500/70">({formatGBP(m.wincVariableCosts)})</span>
                                : <span className="text-muted-foreground/30">—</span>}
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
                                  <span className="text-red-500/70">({formatGBP(m.wincFixedCosts + (m.preOpenPropertyCost ?? 0))})</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                              {compareProperty && (() => {
                                const cmp = comparePnlData?.find(c => c.calendarLabel === m.calendarLabel);
                                if (!cmp) return null;
                                const cmpFixed = cmp.wincFixedCosts + (cmp.preOpenPropertyCost ?? 0);
                                const primFixed = m.wincFixedCosts + (m.preOpenPropertyCost ?? 0);
                                const diff = cmpFixed - primFixed;
                                return (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
                                    {cmpFixed > 0 ? `(${formatGBP(cmpFixed)})` : "—"}
                                    {diff !== 0 && <span className={`ml-1 font-semibold ${diff < 0 ? "text-emerald-500" : "text-red-400"}`}>({diff > 0 ? "+" : ""}{formatGBP(diff)})</span>}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Winchester VAT only (Bedhampton VAT already in Bedh Net) */}
                            <td className={`text-right px-2 py-1.5 tabular-nums ${m.wincVat > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/40"}`}>
                              {m.wincVat > 0 ? <span>({formatGBP(m.wincVat)})</span> : "—"}
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
                                      {_wincMarketing > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Marketing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincMarketing)})</span>
                                        </div>
                                      )}
                                      {_wincStaffing > 0 && (
                                        <div className="flex justify-between items-center pl-1">
                                          <span className="text-gray-500">Staffing</span>
                                          <span className="tabular-nums text-red-600">({formatGBP(_wincStaffing)})</span>
                                        </div>
                                      )}
                                      {_wincConsumables > 0 && (
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

                            {/* Owner's Drawings */}
                            <td className="text-right px-3 py-1.5 tabular-nums">
                              {m.drawingsActive && m.actualDrawings > 0 ? (
                                <span className="text-orange-500 font-medium">({formatGBP(m.actualDrawings)})</span>
                              ) : m.drawingsActive ? (
                                <span className="text-muted-foreground/50 text-[10px]">ramping</span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>

                            {/* Combined Net Profit */}
                            <td className={`text-right px-3 py-1.5 tabular-nums font-semibold ${netProfitRow > 0 ? "text-emerald-600 dark:text-emerald-400" : netProfitRow < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatGBP(netProfitRow)}
                              {compareProperty && (() => {
                                const cmp = comparePnlData?.find(c => c.calendarLabel === m.calendarLabel);
                                if (!cmp) return null;
                                const cmpNet = cmp.wincNet + cmp.bedhNet;
                                const diff = cmpNet - netProfitRow;
                                return (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal mt-0.5 leading-tight">
                                    {formatGBP(cmpNet)}
                                    {diff !== 0 && <span className={`ml-1 font-semibold ${diff > 0 ? "text-emerald-500" : "text-red-400"}`}>({diff > 0 ? "+" : ""}{formatGBP(diff)})</span>}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Running cash balance */}
                            <td className={`text-right px-3 py-1.5 tabular-nums font-medium ${m.cashBalance >= 0 ? "" : "text-destructive"}`}>
                              {formatGBP(m.cashBalance)}
                              {compareProperty && (() => {
                                const cmp = comparePnlData?.find(c => c.calendarLabel === m.calendarLabel);
                                if (!cmp) return null;
                                const diff = cmp.cashBalance - m.cashBalance;
                                return (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
                                    {formatGBP(cmp.cashBalance)}
                                    {diff !== 0 && <span className={`ml-1 font-semibold ${diff > 0 ? "text-emerald-500" : "text-red-400"}`}>({diff > 0 ? "+" : ""}{formatGBP(diff)})</span>}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground space-y-0.5">
                  <p><strong>Variable</strong> = Winchester stock %, commissions %, marketing, staffing, consumables. <strong>Fixed (Winc)</strong> = all items from your fixed cost list including dual costs (counted once, not double-charged to Bedhampton).</p>
                  <p><strong>Bedh Net</strong> = Bedhampton gross revenue minus stock, running costs, and Bedhampton's share of VAT. <strong>Winc VAT</strong> = Winchester VAT only. Net Profit = Winc Rev − Variable − Fixed − Winc VAT + Bedh Net.</p>
                  <p><strong>Proj costs</strong> = Project Plan task costs (mid-tier by default) charged this month. Hover to see which tasks. Tasks without due dates are spread across pre-opening months, weighted toward opening. Total across all months = £{Math.round((pnlData ?? cashflow ?? []).reduce((s, m) => s + (m.projectCostBurn ?? 0), 0)).toLocaleString()}.</p>
                  <p><strong>Drawings</strong> = Owner's drawings taken from the business once Winchester is self-funding. Capped so at least £3,000/month is always retained in the business. Set your target in Assumptions → Personal &amp; Runway.</p>
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
                      <CardTitle className="text-sm">{clinicLabel} — Variable Costs</CardTitle>
                      {bLive && bLive.summary.avgGrossMarginPct > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Live Bedhampton margin: <strong>{bLive.summary.avgGrossMarginPct}%</strong>
                            {" "}→ {(100 - bLive.summary.avgGrossMarginPct).toFixed(1)}% variable cost
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const variablePct = Math.round((100 - bLive.summary.avgGrossMarginPct) * 10) / 10;
                              form.setValue("stockPercent", variablePct);
                              form.setValue("commissionsPercent", 0);
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
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["stockPercent","Stock (% of rev)"],["commissionsPercent","Commissions (% of rev)"],
                        ["marketingGbp","Marketing (£/mo)"],["staffingGbp","Staffing (£/mo)"],["consumablesGbp","Consumables (£/mo)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{clinicLabel} — Revenue & Self-Funding</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["wincAcvGbp","Avg Client Value (£)"],
                        ["treatmentRoomsCount","Treatment Rooms"],
                        ["membershipRevenueGbp","Membership Rev (£/mo)"],
                        ["conservativeOccupancyPercent","Conservative Occ %"],["realisticOccupancyPercent","Realistic Occ %"],
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

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Personal & Runway</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["targetDrawingsGbp","Desired Income (£/mo)"],
                        ["runwaySavingsGbp","Business Capital (£)"],
                        ["personalSalaryNeedsGbp","Min Household Need (£/mo)"],
                        ["preOpeningPropertyMonths","Lease signed (months before opening)"],
                        ["freeRentMonths","Rent-free months (agreed with landlord)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Lease signed months before opening: rent + rates are charged against business capital from that point, even before Winchester opens. Rent-free months: only business rates apply during this period — rent is £0.</p>
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
                  </CardContent>
                </Card>

                {/* VAT warning — shown in Assumptions tab so it's seen before lease decisions */}
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">VAT registration required within 1–2 months of Winchester opening</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 leading-relaxed">
                      Based on current rolling Bedhampton turnover, Winchester revenue will push the business above the £90k VAT threshold very quickly after opening. Accountant consultation is required <strong>before lease signing</strong> — not after. Confirm VAT strategy (standard, cash accounting, or flat rate) before committing to lease terms.
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
                    subtitle: `${clinicLabel} self-funding (≥${cr.winc.selfFundingBufferPercent}% margin). Solo clinic.`,
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
                    subtitle: `${clinicLabel} alone covers desired income. Full financial independence.`,
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
      {tab === "domestics" && (
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
                      ["treatmentRoomsCount",     "Treatment Rooms",   "",  ""],
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
                    <CardTitle className="text-sm">Cost Structure</CardTitle>
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
                            form.setValue("commissionsPercent", 0);
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
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["stockPercent",       "Stock (% of rev)",     "", "%"],
                      ["commissionsPercent", "Commission (% of rev)", "", "%"],
                      ["marketingGbp",       "Marketing",            "£", "/mo"],
                      ["staffingGbp",        "Staffing",             "£", "/mo"],
                      ["consumablesGbp",     "Consumables",          "£", "/mo"],
                    ] as [string, string, string, string][]).map(([key, label, pre, post]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-medium text-foreground/80">{label}</label>
                        <div className="relative">
                          {pre && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{pre}</span>}
                          <input
                            type="number"
                            value={Number((watchAll as any)[key]) || 0}
                            onChange={(e) => form.setValue(key as any, Number(e.target.value))}
                            className={`h-8 w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary ${pre ? "pl-5" : "pl-3"} ${post ? "pr-10" : "pr-3"}`}
                          />
                          {post && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{post}</span>}
                        </div>
                      </div>
                    ))}
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

    </div>
  );
}
