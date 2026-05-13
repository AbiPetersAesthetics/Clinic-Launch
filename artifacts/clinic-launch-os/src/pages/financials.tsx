import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  useGetFinancialModel,
  getGetFinancialModelQueryKey,
  useUpsertFinancialModel,
  useCalculateFinancials,
  useGetProjectCashflow,
  getGetProjectCashflowQueryKey,
  getGetOptimisationAnalysisQueryKey,
  useListFixedCostItems,
  getListFixedCostItemsQueryKey,
  useCreateFixedCostItem,
  useUpdateFixedCostItem,
  useDeleteFixedCostItem,
} from "@workspace/api-client-react";
import { formatGBP, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Save, AlertTriangle, Info, CheckCircle2, XCircle,
  Shield, ChevronRight, BarChart3, Building2, Target,
  Plus, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine,
  ComposedChart, Bar, ReferenceArea,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;
const VAT_THRESHOLD = 90000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = "conservative" | "realistic" | "aggressive" | "delayed_ramp" | "economic_downturn" | "stress_test";
type TabKey = "overview" | "model" | "owner" | "risks";

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
  bedhRevenue: number; bedhCosts: number; bedhNet: number;
  projectCostBurn: number; taskLabels: string[];
  vatLiability: number; isVatRegistered: boolean;
  actualDrawings: number; targetDrawings: number; drawingsShortfall: number; drawingsActive: boolean;
  monthlyCashflow: number; cashBalance: number;
  occupancyPercent: number;
  isSelfFundingMonth: boolean; bedhClosed: boolean;
  bedhSupport: number; combinedNet: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioKey, { label: string; description: string; color: string; badgeClass: string }> = {
  conservative: { label: "Conservative", description: "40% occ, 8-mo ramp", color: "text-blue-600", badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  realistic: { label: "Realistic", description: "65% occ, 6-mo ramp", color: "text-primary", badgeClass: "bg-primary/10 text-primary" },
  aggressive: { label: "Strong Launch", description: "85% occ, 4-mo ramp", color: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  delayed_ramp: { label: "Delayed Ramp", description: "65% occ, 12-mo ramp", color: "text-amber-600", badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  economic_downturn: { label: "Downturn", description: "−20% occ, −15% spend", color: "text-orange-600", badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  stress_test: { label: "Stress Test", description: "5% start, worst-case ramp", color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive" },
};

const RISKS = [
  { threat: "Winchester ramp too slow — Bedhampton never closes", likelihood: "High", impact: "Critical", mitigation: "Pre-launch waitlist, soft-open to existing Bedhampton regulars who travel. Set a firm review gate at Month 6: if Winchester net < £8k, activate contingency plan." },
  { threat: "Cash reserve depleted before Winchester is self-funding", likelihood: "Medium", impact: "Critical", mitigation: "Maintain £20k operating buffer. Do not spend on non-essential capex until Winchester Month 3 revenue is confirmed. Bedhampton support covers this gap." },
  { threat: "Abi burnout running both clinics simultaneously", likelihood: "High", impact: "Very High", mitigation: "This is the biggest personal risk. Pre-agree with David: if Winchester hits £8k net, immediately reduce Bedhampton days. Do not wait for the self-funding margin target to be hit." },
  { threat: "VAT registration pressure on Winchester", likelihood: "Medium", impact: "High", mitigation: "Monitor Winchester rolling 12-month revenue. Appoint accountant before hitting 75% of £90k annual threshold." },
  { threat: "Winchester fit-out overruns delay opening", likelihood: "Medium", impact: "High", mitigation: "Phase-gate spend. Keep £5k contingency unallocated. Dad's labour eliminates the biggest variable. Open date tied to Bedhampton income model." },
  { threat: "Marketing underperformance — slow first 3 months", likelihood: "High", impact: "Medium", mitigation: "Prioritise Google reviews and organic social. Avoid paid ads until organic baseline is established. Bedhampton income absorbs the shortfall." },
  { threat: "Bedhampton revenue weakens during dual-clinic phase", likelihood: "Low", impact: "High", mitigation: "Reduced Abi hours at Bedhampton may affect revenue. Model shows Bedhampton income is the safety net — any reduction lengthens the Winchester ramp period." },
  { threat: "Winchester never hits the self-funding margin — Bedhampton never closes", likelihood: "Low", impact: "High", mitigation: "Set a formal review at Month 9. If Winchester net margin is below the buffer %, consider reducing the target % or accepting a longer Bedhampton exit timeline." },
];

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

  // ── Fixed cost items (dynamic, replaces hardcoded fixed cost fields) ──────
  const { data: fixedCostItems = [] } = useListFixedCostItems(PROJECT_ID, {
    query: { queryKey: getListFixedCostItemsQueryKey(PROJECT_ID), enabled: true },
  });
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
  const [tab, setTab] = useState<TabKey>("overview");
  const [calcResults, setCalcResults] = useState<ExtendedCalcResult | null>(null);

  const { data: model, isLoading: isModelLoading } = useGetFinancialModel(PROJECT_ID, {
    query: { queryKey: getGetFinancialModelQueryKey(PROJECT_ID), enabled: true },
  });

  const { data: rawCashflow } = useGetProjectCashflow(PROJECT_ID, { scenario }, {
    query: { queryKey: getGetProjectCashflowQueryKey(PROJECT_ID, { scenario }), enabled: true },
  });
  const cashflow = rawCashflow as unknown as CashflowMonth[] | undefined;

  const upsertModel = useUpsertFinancialModel();
  const calculateFinancials = useCalculateFinancials();

  const runCalculation = () => {
    calculateFinancials.mutate(
      { projectId: PROJECT_ID, data: { scenario } },
      { onSuccess: (data) => setCalcResults(data as unknown as ExtendedCalcResult) }
    );
  };

  const form = useForm({
    defaultValues: {
      rentGbp: 0, ratesGbp: 0, utilitiesGbp: 0, internetGbp: 0, insuranceGbp: 0,
      accountantGbp: 0, softwareGbp: 0, wasteContractGbp: 0, cleanerGbp: 0,
      subscriptionsGbp: 0, financeRepaymentsGbp: 0,
      stockPercent: 8, marketingGbp: 0, staffingGbp: 0, commissionsPercent: 0, consumablesGbp: 0,
      wincAcvGbp: 155, selfFundingBufferPercent: 20,
      treatmentRoomsCount: 2, practitionerHoursPerDay: 7,
      workingDaysPerMonth: 22, conservativeOccupancyPercent: 40, realisticOccupancyPercent: 65,
      aggressiveOccupancyPercent: 85, repeatBookingRatePercent: 60, membershipRevenueGbp: 0,
      existingClinicRevenueGbp: 0, bedhStockPercent: 35,
      bedhRentGbp: 0, bedhSoftwareGbp: 0, bedhStaffingGbp: 0, bedhInsuranceGbp: 0, bedhMarketingGbp: 0, bedhamptonCostsGbp: 0,
      ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0, vatCurrentTurnoverGbp: 75000,
      nursingIncomeGbp: 4500, targetDrawingsGbp: 4000,
    }
  });

  useEffect(() => {
    if (model) {
      const m = model as any;
      form.reset({
        rentGbp: m.rentGbp || 0, ratesGbp: m.ratesGbp || 0, utilitiesGbp: m.utilitiesGbp || 0,
        internetGbp: m.internetGbp || 0, insuranceGbp: m.insuranceGbp || 0, accountantGbp: m.accountantGbp || 0,
        softwareGbp: m.softwareGbp || 0, wasteContractGbp: m.wasteContractGbp || 0, cleanerGbp: m.cleanerGbp || 0,
        subscriptionsGbp: m.subscriptionsGbp || 0, financeRepaymentsGbp: m.financeRepaymentsGbp || 0,
        stockPercent: m.stockPercent || 8, marketingGbp: m.marketingGbp || 0, staffingGbp: m.staffingGbp || 0,
        commissionsPercent: m.commissionsPercent || 0, consumablesGbp: m.consumablesGbp || 0,
        wincAcvGbp: m.wincAcvGbp || 155, selfFundingBufferPercent: m.selfFundingBufferPercent ?? 20,
        treatmentRoomsCount: m.treatmentRoomsCount || 2, practitionerHoursPerDay: m.practitionerHoursPerDay || 7,
        workingDaysPerMonth: m.workingDaysPerMonth || 22, conservativeOccupancyPercent: m.conservativeOccupancyPercent || 40,
        realisticOccupancyPercent: m.realisticOccupancyPercent || 65, aggressiveOccupancyPercent: m.aggressiveOccupancyPercent || 85,
        repeatBookingRatePercent: m.repeatBookingRatePercent || 60, membershipRevenueGbp: m.membershipRevenueGbp || 0,
        existingClinicRevenueGbp: m.existingClinicRevenueGbp ?? 0, bedhStockPercent: m.bedhStockPercent ?? 35,
        bedhRentGbp: m.bedhRentGbp || 0, bedhSoftwareGbp: m.bedhSoftwareGbp || 0, bedhStaffingGbp: m.bedhStaffingGbp || 0,
        bedhInsuranceGbp: m.bedhInsuranceGbp || 0, bedhMarketingGbp: m.bedhMarketingGbp || 0, bedhamptonCostsGbp: m.bedhamptonCostsGbp || 0,
        ownerDrawingsGbp: m.ownerDrawingsGbp || 0, runwaySavingsGbp: m.runwaySavingsGbp || 0, vatCurrentTurnoverGbp: (m as any).vatCurrentTurnoverGbp ?? 75000,
        personalSalaryNeedsGbp: m.personalSalaryNeedsGbp || 0, nursingIncomeGbp: m.nursingIncomeGbp || 4500,
        targetDrawingsGbp: m.targetDrawingsGbp || 4000,
      });
      runCalculation();
    }
  }, [model]);

  useEffect(() => { if (model) runCalculation(); }, [scenario]);

  const onSubmit = (values: Record<string, number>) => {
    const processed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0]));
    upsertModel.mutate({ projectId: PROJECT_ID, data: processed }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
        runCalculation();
        toast({ title: "Model Saved", description: "Assumptions updated and projections recalculated." });
      },
    });
  };

  const watchAll = form.watch();
  const totalFixedCosts = ['rentGbp','ratesGbp','utilitiesGbp','internetGbp','insuranceGbp','accountantGbp','softwareGbp','wasteContractGbp','cleanerGbp','subscriptionsGbp','financeRepaymentsGbp']
    .reduce((s, k) => s + (Number(watchAll[k as keyof typeof watchAll]) || 0), 0);

  const rampData = useMemo(() => cashflow?.filter(m => !m.isPreOpening).map((m) => ({ monthLabel: m.calendarLabel, occupancy: m.occupancyPercent })) ?? [], [cashflow]);
  const selfFundingPoint = useMemo(() => cashflow?.find(m => m.isSelfFundingMonth), [cashflow]);

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
          subtitle="Winchester ramps to self-sufficiency, supported by Bedhampton income. Bedhampton closes when Winchester hits the target."
        />
        {cr?.scenarioNote && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong className={sc.color}>{sc.label}:</strong> {cr.scenarioNote}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS[ScenarioKey]][]).map(([key, s]) => (
            <button key={key} onClick={() => setScenario(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                scenario === key ? `${s.badgeClass} border-current` : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}>
              {s.label}
              <span className="ml-1.5 opacity-60 hidden sm:inline">{s.description}</span>
            </button>
          ))}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 ${(cr?.winc.netProfit ?? 0) > 0 ? "border-border/60 bg-card" : "border-destructive/20 bg-destructive/5"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Winchester Net</span>
            <BarChart3 className="w-4 h-4 text-primary/50" />
          </div>
          <div className={`text-xl font-bold ${(cr?.winc.netProfit ?? 0) > 0 ? "text-foreground" : "text-destructive"}`}>{cr ? formatGBP(cr.winc.netProfit) : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{cr ? `at ${cr.winc.occupancyUsed}% occupancy` : ""}</div>
        </div>

        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bedhampton Support</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold">{cr ? formatGBP(cr.bedh.netProfit) : "—"}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
          <div className="text-xs text-muted-foreground mt-0.5">Closes when Winchester net margin ≥ {cr?.winc.selfFundingBufferPercent ?? 20}% of revenue (~{formatGBP(cr?.winc.sfNetProfitTarget ?? 0)}/mo net)</div>
        </div>

        <div className={`rounded-xl border p-4 ${cr?.combined.selfFundingMonth ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bedhampton Closes</span>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-xl font-bold ${cr?.combined.selfFundingMonth ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {cr ? (cr.combined.selfFundingMonth ? `Month ${cr.combined.selfFundingMonth}` : "> 12 months") : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {cr?.combined.selfFundingMonth
              ? `Abi full-time Winchester from Month ${cr.combined.selfFundingMonth}`
              : "Winchester doesn't hit target within 12mo"}
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${(cr?.owner.cashRunwayMonths ?? 0) >= 12 ? "border-border/60 bg-card" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cash Runway</span>
            <Shield className="w-4 h-4 text-primary/50" />
          </div>
          <div className="text-xl font-bold">{cr ? (cr.owner.cashRunwayMonths >= 99 ? "Secure" : `${cr.owner.cashRunwayMonths} months`) : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{cr ? `${formatGBP(cr.owner.runwaySavings)} savings buffer` : ""}</div>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["overview", "model", "owner", "risks"] as TabKey[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "overview" ? "Overview" : t === "model" ? "Assumptions" : t === "owner" ? "Owner" : "Risks"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">

          {/* 18-Month Cash Position Chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">18-Month Cash Position</CardTitle>
              <CardDescription className="text-sm">
                Business capital burns through project setup costs, partially offset by Bedhampton net income. Winchester opens Nov '26 and starts recovering the position.
                {selfFundingPoint && (
                  <strong className="text-emerald-600 dark:text-emerald-400"> Bedhampton closes {selfFundingPoint.calendarLabel} once Winchester is self-funding.</strong>
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
                            label={{ value: "Winchester opens", position: "insideTopLeft", fontSize: 9, fill: "hsl(var(--primary))" }}
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

                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload as CashflowMonth;
                            if (!d) return null;
                            return (
                              <div className="rounded-lg border bg-background shadow-md p-3 text-xs max-w-[280px]">
                                <p className="font-semibold text-sm mb-2">{label}</p>
                                <div className="space-y-1">
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Business capital</span><span className="font-bold">{formatGBP(d.cashBalance)}</span></div>
                                  {d.bedhNet !== 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Bedhampton net</span><span className={d.bedhNet >= 0 ? "text-blue-600" : "text-destructive"}>{formatGBP(d.bedhNet)}</span></div>}
                                  {d.wincRevenue > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Winchester revenue</span><span>{formatGBP(d.wincRevenue)}</span></div>}
                                  {d.vatLiability > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">VAT liability (20%)</span><span className="text-amber-600">−{formatGBP(d.vatLiability)}</span></div>}
                                  {d.wincNet !== 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Winchester net</span><span className={d.wincNet >= 0 ? "text-emerald-600" : "text-destructive"}>{formatGBP(d.wincNet)}</span></div>}
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
                            v === "cashBalance" ? "Business capital (running balance)"
                            : v === "monthlyCashflow" ? "Monthly net → business capital (after drawings)"
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
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Starting capital</div>
                      <div className="text-sm font-bold">{formatGBP(startBalance)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Lowest cash point</div>
                      <div className={`text-sm font-bold ${minBalance < 0 ? "text-destructive" : "text-amber-600"}`}>{formatGBP(minBalance)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Cash at month 18</div>
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
                <CardTitle className="text-base">Monthly P&L Breakdown</CardTitle>
                <CardDescription className="text-sm">
                  Revenue, costs and VAT month by month. VAT turns on once rolling 12-month turnover crosses £90k.
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px]">
                    <span className="inline-block w-2 h-2 rounded-sm bg-primary/20 border border-primary/40" /> Winchester opens
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
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground sticky left-0 bg-muted/40 min-w-[72px]">Month</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Winc Rev</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Bedh Rev</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Variable</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Fixed</th>
                        <th className="text-right px-2 py-2 font-semibold text-amber-600 dark:text-amber-400 min-w-[72px]">VAT</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[80px]">Total Costs</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">Net Profit</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground min-w-[80px]">Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflow.map((m) => {
                        const isOpen = m.isOpeningMonth;
                        const isClose = m.isSelfFundingMonth;
                        const totalRev = m.wincRevenue + m.bedhRevenue;
                        const totalVarCosts = m.wincVariableCosts;
                        const totalFixCosts = m.wincFixedCosts + m.bedhCosts;
                        const totalCostRow = m.wincCosts + m.bedhCosts;
                        const netProfitRow = m.wincNet + m.bedhNet;
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
                              </div>
                              {m.isPreOpening && <div className="text-[9px] text-muted-foreground">pre-open</div>}
                            </td>
                            <td className="text-right px-2 py-1.5 tabular-nums">{m.wincRevenue > 0 ? formatGBP(m.wincRevenue) : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className={`text-right px-2 py-1.5 tabular-nums ${m.bedhClosed ? "text-muted-foreground/40 line-through" : ""}`}>
                              {m.bedhRevenue > 0 ? formatGBP(m.bedhRevenue) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {totalVarCosts > 0 ? <span className="text-red-500/70">({formatGBP(totalVarCosts)})</span> : <span className="text-muted-foreground/30">—</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {totalFixCosts > 0 ? <span className="text-red-500/70">({formatGBP(totalFixCosts)})</span> : <span className="text-muted-foreground/30">—</span>}
                            </td>
                            <td className={`text-right px-2 py-1.5 tabular-nums ${m.vatLiability > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/40"}`}>
                              {m.vatLiability > 0 ? <span>({formatGBP(m.vatLiability)})</span> : "—"}
                            </td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">
                              {totalCostRow > 0 ? <span className="text-red-500/70">({formatGBP(totalCostRow)})</span> : <span className="text-muted-foreground/30">—</span>}
                            </td>
                            <td className={`text-right px-3 py-1.5 tabular-nums font-semibold ${netProfitRow > 0 ? "text-emerald-600 dark:text-emerald-400" : netProfitRow < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatGBP(netProfitRow)}
                            </td>
                            <td className={`text-right px-3 py-1.5 tabular-nums font-medium ${m.cashBalance >= 0 ? "" : "text-destructive"}`}>
                              {formatGBP(m.cashBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
                  Variable costs shown net of VAT. Fixed costs include Winchester running costs. Bedhampton costs shown in Fixed column until closure. Net Profit = combined Winchester + Bedhampton.
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy ramp */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Winchester Occupancy Ramp</CardTitle>
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
                        <Tooltip formatter={(v: number) => [`${v}%`, "Occupancy"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
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
                <CardTitle className="text-sm">Winchester Journey to Self-Funding</CardTitle>
                <CardDescription className="text-xs">Three milestones Winchester must pass before Bedhampton closes</CardDescription>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Winchester Break-Even</CardTitle></CardHeader>
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
                      <div className="text-xs text-muted-foreground mt-0.5">until Winchester annual £90k VAT threshold</div>
                    </div>
                    <Progress value={Math.min((cr.combined.annualRevenue / VAT_THRESHOLD) * 100, 100)}
                      className={`h-2 ${cr.combined.vatRegistrationWarning ? "[&>div]:bg-amber-500" : ""}`} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatGBP(cr.combined.annualRevenue)} projected</span>
                      <span>£90k limit</span>
                    </div>
                    {cr.combined.vatRegistrationWarning && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Appoint accountant to plan VAT registration now.
                      </div>
                    )}
                  </div>
                ) : <div className="py-6 text-center text-muted-foreground text-sm">—</div>}
              </CardContent>
            </Card>

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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="flex items-center justify-between sticky top-16 z-30 bg-background/95 py-3 border-b">
                  <h3 className="font-semibold">Assumptions</h3>
                  <Button type="submit" disabled={upsertModel.isPending} size="sm">
                    <Save className="w-4 h-4 mr-1.5" />
                    {upsertModel.isPending ? "Saving…" : "Save & Recalculate"}
                  </Button>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fixed Monthly Costs</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tag each cost as <strong>Unique</strong> (Winchester only) or <strong>Dual</strong> (shared across both clinics — counts once, never double-charged).
                    </p>
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
                              title={item.costType === "dual" ? "Dual — shared across both clinics, counts once" : "Unique — Winchester only"}
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
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-muted border border-border" />Unique = Winchester only</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800" />Dual = shared, counted once</span>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-semibold">Total fixed</span>
                      <span className="font-bold">{formatGBP(totalDynamicFixedCosts)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Winchester — Variable Costs</CardTitle></CardHeader>
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Winchester — Revenue & Self-Funding</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["wincAcvGbp","Avg Client Value (£)"],
                        ["treatmentRoomsCount","Treatment Rooms"],["practitionerHoursPerDay","Hours/Day/Room"],
                        ["workingDaysPerMonth","Working Days/Mo"],["membershipRevenueGbp","Membership Rev (£/mo)"],
                        ["conservativeOccupancyPercent","Conservative Occ %"],["realisticOccupancyPercent","Realistic Occ %"],
                        ["aggressiveOccupancyPercent","Aggressive Occ %"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
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
                      Bedhampton closes when Winchester's net profit is at least this % of its gross revenue — a self-sufficiency margin. Default: 20%. The effective £ threshold is computed automatically from your cost structure.
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bedhampton — Revenue</CardTitle>
                    <CardDescription className="text-xs">
                      Separate patient base. Supports the business during the Winchester ramp. Closes when Winchester hits the self-funding target.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["existingClinicRevenueGbp","Gross Monthly Revenue (£)"],
                        ["bedhStockPercent","Product / Stock Cost (%)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
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
                        ["runwaySavingsGbp","Business Capital (£)"],["personalSalaryNeedsGbp","Min Household Need (£/mo)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
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
                  </CardContent>
                </Card>
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
                      <h3 className={`font-semibold capitalize ${sc.color}`}>{sc.label} — Winchester at Target</h3>
                      <p className="text-xs text-muted-foreground">{cr.winc.occupancyUsed}% occupancy · {formatGBP(cr.winc.fixedCosts)}/mo fixed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Winchester Monthly Net</p>
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
                    <div className="grid grid-cols-3 gap-3 text-sm">
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
                    <div className="grid grid-cols-3 gap-3 text-sm">
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
                        <span className="text-muted-foreground">Total support until Winchester self-funding</span>
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
                    subtitle: "Bedhampton profit + Winchester net (growing). Both clinics running.",
                    income: cr.owner.phase1Income,
                    shortfall: cr.owner.phase1Shortfall,
                    safe: cr.owner.phase1IsSafe,
                    breakdown: [
                      ["Bedhampton net", cr.bedh.netProfit],
                      ["Winchester net", cr.winc.netProfit],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 2",
                    title: "After Bedhampton closes",
                    subtitle: `Winchester self-funding (≥${cr.winc.selfFundingBufferPercent}% margin). Solo clinic.`,
                    income: cr.owner.phase2Income,
                    shortfall: cr.owner.phase2Shortfall,
                    safe: cr.owner.phase2IsSafe,
                    breakdown: [
                      ["Winchester net", cr.winc.netProfit],
                      ["Bedhampton", 0],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 3",
                    title: "Winchester at full target",
                    subtitle: "Winchester alone covers desired income. Full financial independence.",
                    income: cr.owner.phase3Income,
                    shortfall: Math.max(cr.owner.targetDrawings - cr.owner.phase3Income, 0),
                    safe: cr.owner.phase3IsSafe,
                    breakdown: [
                      ["Winchester net", cr.winc.netProfit],
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
                      ["economic_downturn", "Downturn — reduced spend, lower occupancy"],
                    ].map(([key, desc]) => (
                      <Button key={key} variant="outline" size="sm" className="w-full justify-between text-xs h-auto py-2" onClick={() => { setScenario(key as ScenarioKey); setTab("owner"); }}>
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
                {RISKS.map((r, i) => (
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
                  <Button key={key} variant="outline" size="sm" onClick={() => { setScenario(key); setTab("overview"); }}>
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
    </div>
  );
}
