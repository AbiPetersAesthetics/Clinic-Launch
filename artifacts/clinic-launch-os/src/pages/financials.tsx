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
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;
const VAT_THRESHOLD = 90000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = "conservative" | "realistic" | "aggressive" | "delayed_ramp" | "economic_downturn" | "abi_leaves_nursing" | "stress_test";
type TabKey = "overview" | "model" | "owner" | "risks";

type WincMetrics = {
  grossRevenue: number; fixedCosts: number; variableCosts: number; totalCosts: number;
  netProfit: number; grossMarginPercent: number; occupancyUsed: number;
  breakEvenRevenue: number; breakEvenOccupancy: number; treatmentsPerWeekToBreakeven: number;
  selfFundingOccupancy: number; slotsPerMonth: number; warnings: string[];
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
  month: number; monthLabel: string; revenue: number; fixedCosts: number;
  variableCosts: number; netCashflow: number; cumulativeCashflow: number;
  isBreakevenMonth: boolean; occupancyPercent: number;
  wincRevenue: number; wincCosts: number; wincNet: number;
  bedhRevenue: number; bedhCosts: number; bedhNet: number; bedhSupport: number;
  combinedNet: number; combinedCumulative: number;
  isSelfFundingMonth: boolean; bedhClosed: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioKey, { label: string; description: string; color: string; badgeClass: string }> = {
  conservative: { label: "Conservative", description: "40% occ, 8-mo ramp", color: "text-blue-600", badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  realistic: { label: "Realistic", description: "65% occ, 6-mo ramp", color: "text-primary", badgeClass: "bg-primary/10 text-primary" },
  aggressive: { label: "Strong Launch", description: "85% occ, 4-mo ramp", color: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  delayed_ramp: { label: "Delayed Ramp", description: "65% occ, 12-mo ramp", color: "text-amber-600", badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  economic_downturn: { label: "Downturn", description: "−20% occ, −15% spend", color: "text-orange-600", badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  abi_leaves_nursing: { label: "No Nursing Income", description: "Clinics must cover all income", color: "text-purple-600", badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
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
      existingClinicRevenueGbp: 0, bedhamptonCostsGbp: 3200,
      ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0,
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
        existingClinicRevenueGbp: m.existingClinicRevenueGbp || 0, bedhamptonCostsGbp: m.bedhamptonCostsGbp || 3200,
        ownerDrawingsGbp: m.ownerDrawingsGbp || 0, runwaySavingsGbp: m.runwaySavingsGbp || 0,
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

  const rampData = useMemo(() => cashflow?.map((m) => ({ monthLabel: m.monthLabel, occupancy: m.occupancyPercent })) ?? [], [cashflow]);
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

          {/* Combined cashflow chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">12-Month Cashflow — Winchester Ramp + Bedhampton Support</CardTitle>
              <CardDescription>
                Winchester net must reach {cr?.winc.selfFundingBufferPercent ?? 20}% of gross revenue (~{formatGBP(cr?.winc.sfNetProfitTarget ?? 0)}/mo net at current costs) before Bedhampton closes.
                {selfFundingPoint && <strong className="text-emerald-600 dark:text-emerald-400"> Bedhampton closes Month {selfFundingPoint.month}.</strong>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {cashflow && cashflow.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashflow} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                      <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                      {selfFundingPoint && (
                        <ReferenceLine
                          x={selfFundingPoint.monthLabel}
                          stroke="#10b981"
                          strokeDasharray="5 3"
                          label={{ value: "Bedh closes", position: "insideTopRight", fontSize: 10, fill: "#10b981" }}
                        />
                      )}
                      {cr?.winc.sfNetProfitTarget != null && cr.winc.sfNetProfitTarget > 0 && (
                        <ReferenceLine
                          y={cr.winc.sfNetProfitTarget}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                          label={{ value: `£${(cr.winc.sfNetProfitTarget / 1000).toFixed(0)}k (${cr.winc.selfFundingBufferPercent}% margin)`, position: "insideTopLeft", fontSize: 9, fill: "#10b981" }}
                        />
                      )}
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          formatGBP(v),
                          name === "wincNet" ? "Winchester Net" : name === "bedhSupport" ? "Bedhampton Support" : "Combined Net"
                        ]}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      />
                      <Legend
                        formatter={(v) => v === "wincNet" ? "Winchester Net" : v === "bedhSupport" ? "Bedhampton Support (closes at target)" : "Combined"}
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      />
                      <Line type="monotone" dataKey="wincNet" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="bedhSupport" stroke="#60a5fa" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="combinedNet" stroke="#10b981" strokeWidth={2} dot={false} strokeOpacity={0.7} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Save assumptions first.</div>
                )}
              </div>
            </CardContent>
          </Card>

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
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Winchester — Fixed Monthly Costs</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["rentGbp","Rent (£)"],["ratesGbp","Business Rates (£)"],["utilitiesGbp","Utilities (£)"],
                        ["internetGbp","Internet (£)"],["insuranceGbp","Insurance (£)"],["accountantGbp","Accountant (£)"],
                        ["softwareGbp","Software (£)"],["wasteContractGbp","Waste Contract (£)"],["cleanerGbp","Cleaner (£)"],
                        ["subscriptionsGbp","Subscriptions (£)"],["financeRepaymentsGbp","Finance (£)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-semibold">Total fixed</span>
                      <span className="font-bold">{formatGBP(totalFixedCosts)}</span>
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
                    <CardTitle className="text-sm">Bedhampton — Temporary Support Clinic</CardTitle>
                    <CardDescription className="text-xs">
                      Separate patient base. Revenue supports the household during the Winchester ramp. Closes when Winchester hits the self-funding target.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["existingClinicRevenueGbp","Monthly Revenue (£)"],["bedhamptonCostsGbp","Monthly Costs (£)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Personal & Runway</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["nursingIncomeGbp","Nursing Income (£/mo)"],["targetDrawingsGbp","Desired Income (£/mo)"],
                        ["runwaySavingsGbp","Savings / Buffer (£)"],["personalSalaryNeedsGbp","Min Household Need (£/mo)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
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
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[
                        ["Gross Revenue", formatGBP(cr.winc.grossRevenue)],
                        ["Variable Costs", formatGBP(cr.winc.variableCosts)],
                        ["Gross Margin", `${cr.winc.grossMarginPercent}%`],
                        ["Fixed Costs", formatGBP(cr.winc.fixedCosts)],
                        ["Total Costs", formatGBP(cr.winc.totalCosts)],
                        ["Annual Net", formatGBP(cr.combined.annualNetProfit)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                          <div className="font-semibold text-sm">{value}</div>
                        </div>
                      ))}
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
                    subtitle: "Nursing + Bedhampton profit + Winchester net (growing)",
                    income: cr.owner.phase1Income,
                    shortfall: cr.owner.phase1Shortfall,
                    safe: cr.owner.phase1IsSafe,
                    breakdown: [
                      ["Nursing income", cr.owner.nursingIncome],
                      ["Bedhampton net", cr.bedh.netProfit],
                      ["Winchester net", cr.winc.netProfit],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 2",
                    title: "After Bedhampton closes",
                    subtitle: `Nursing + Winchester net (≥${cr.winc.selfFundingBufferPercent}% margin). Bedhampton closed.`,
                    income: cr.owner.phase2Income,
                    shortfall: cr.owner.phase2Shortfall,
                    safe: cr.owner.phase2IsSafe,
                    breakdown: [
                      ["Nursing income", cr.owner.nursingIncome],
                      ["Winchester net", cr.winc.netProfit],
                      ["Bedhampton", 0],
                    ] as [string, number][],
                  },
                  {
                    phase: "Phase 3",
                    title: "After leaving nursing",
                    subtitle: "Winchester alone covers everything. Full independence.",
                    income: cr.owner.phase3Income,
                    shortfall: Math.max(cr.owner.targetDrawings - cr.owner.phase3Income, 0),
                    safe: cr.owner.phase3IsSafe,
                    breakdown: [
                      ["Winchester net", cr.winc.netProfit],
                      ["Nursing", 0],
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
                      ["abi_leaves_nursing", "No Nursing Income — can clinics alone cover target?"],
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
