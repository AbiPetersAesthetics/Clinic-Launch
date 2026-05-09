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
  Save, AlertTriangle, AlertCircle, TrendingUp, TrendingDown,
  Building2, Users, DollarSign, Info, CheckCircle2, XCircle,
  Shield, Zap, ChevronRight, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine, BarChart, Bar,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;
const VAT_THRESHOLD = 90000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = "conservative" | "realistic" | "aggressive" | "delayed_ramp" | "economic_downturn" | "abi_leaves_nursing" | "stress_test";
type TabKey = "overview" | "model" | "owner" | "risks";

type WincMetrics = {
  grossRevenue: number; migratedRevenue: number; newRevenue: number;
  fixedCosts: number; variableCosts: number; totalCosts: number; netProfit: number;
  grossMarginPercent: number; occupancyUsed: number; breakEvenRevenue: number;
  breakEvenOccupancy: number; treatmentsPerWeekToBreakeven: number; slotsPerMonth: number;
  warnings: string[];
};
type BedhMetrics = {
  grossRevenue: number; migratedRevenue: number; retainedRevenue: number;
  costs: number; grossNetProfit: number; retainedNetProfit: number; migratedPercent: number;
};
type CombinedMetrics = {
  monthlyRevenue: number; monthlyCosts: number; monthlyNetProfit: number;
  annualRevenue: number; annualNetProfit: number; vatThreshold: number;
  monthsUntilVatRegistration: number; vatRegistrationWarning: boolean; ebitda: number;
};
type OwnerMetrics = {
  nursingIncome: number; clinicExtractable: number; totalAvailableIncome: number;
  targetDrawings: number; monthlyShortfall: number; isSafeToLeaveNursing: boolean;
  cashRunwayMonths: number; minimumCashRequired: number; recommendedCash: number; runwaySavings: number;
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
  bedhRevenue: number; bedhCosts: number; bedhNet: number;
  combinedRevenue: number; combinedCosts: number; combinedNet: number;
  combinedCumulative: number; isCombinedBreakevenMonth: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioKey, { label: string; description: string; color: string; badgeClass: string }> = {
  conservative: { label: "Conservative", description: "40% occ, 8-mo ramp", color: "text-blue-600", badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  realistic: { label: "Realistic", description: "65% occ, 6-mo ramp", color: "text-primary", badgeClass: "bg-primary/10 text-primary" },
  aggressive: { label: "Strong Launch", description: "85% occ, 4-mo ramp", color: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  delayed_ramp: { label: "Delayed Ramp", description: "65% occ, 12-mo ramp", color: "text-amber-600", badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  economic_downturn: { label: "Downturn", description: "−20% occ, −15% spend", color: "text-orange-600", badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  abi_leaves_nursing: { label: "No Nursing Income", description: "Clinic must cover all income", color: "text-purple-600", badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  stress_test: { label: "Stress Test", description: "5% start, worst-case ramp", color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive" },
};

const RISKS = [
  { threat: "Slow occupancy ramp", likelihood: "High", impact: "Critical", mitigation: "Pre-launch waitlist, soft-launch offer for existing Bedhampton patients, Google review push from Month 1." },
  { threat: "Cash reserve depleted before breakeven", likelihood: "Medium", impact: "Critical", mitigation: "Maintain £20k operating buffer. Do not spend on non-essential marketing until Month 3+ revenue is confirmed." },
  { threat: "VAT registration pressure", likelihood: "Medium", impact: "High", mitigation: "Monitor combined rolling 12-month revenue. Appoint accountant before hitting 75% of £90k threshold." },
  { threat: "Fit-out overruns", likelihood: "Medium", impact: "High", mitigation: "Phase-gate fit-out spend. Keep £5k contingency unallocated. Dad's labour eliminates the biggest variable cost." },
  { threat: "Abi burnout (dual-clinic, nursing)", likelihood: "High", impact: "Very High", mitigation: "Schedule Bedhampton reduction at month 3 post-Winchester launch. Set explicit nursing exit target date." },
  { threat: "Marketing underperformance", likelihood: "High", impact: "Medium", mitigation: "Prioritise Google reviews and organic social. Avoid paid ads until organic baseline is established." },
  { threat: "Bedhampton patient base weakens", likelihood: "Low", impact: "High", mitigation: "Retain Bedhampton as flagship. Do not communicate Winchester as replacement clinic to existing patients." },
  { threat: "Legal/planning delays", likelihood: "Low", impact: "High", mitigation: "Use Class E pre-app enquiry submitted early. Solicitor instructed before lease exchange." },
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
      wincAcvGbp: 155, treatmentRoomsCount: 2, practitionerHoursPerDay: 7,
      workingDaysPerMonth: 22, conservativeOccupancyPercent: 40, realisticOccupancyPercent: 65,
      aggressiveOccupancyPercent: 85, repeatBookingRatePercent: 60, membershipRevenueGbp: 0,
      existingClinicRevenueGbp: 0, bedhamptonCostsGbp: 3500, cannibalPercent: 15,
      ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0,
      nursingIncomeGbp: 4500, targetDrawingsGbp: 4000,
    }
  });

  useEffect(() => {
    if (model) {
      form.reset({
        rentGbp: model.rentGbp || 0, ratesGbp: model.ratesGbp || 0, utilitiesGbp: model.utilitiesGbp || 0,
        internetGbp: model.internetGbp || 0, insuranceGbp: model.insuranceGbp || 0, accountantGbp: model.accountantGbp || 0,
        softwareGbp: model.softwareGbp || 0, wasteContractGbp: model.wasteContractGbp || 0, cleanerGbp: model.cleanerGbp || 0,
        subscriptionsGbp: model.subscriptionsGbp || 0, financeRepaymentsGbp: model.financeRepaymentsGbp || 0,
        stockPercent: model.stockPercent || 8, marketingGbp: model.marketingGbp || 0, staffingGbp: model.staffingGbp || 0,
        commissionsPercent: model.commissionsPercent || 0, consumablesGbp: model.consumablesGbp || 0,
        wincAcvGbp: (model as any).wincAcvGbp || 155, treatmentRoomsCount: model.treatmentRoomsCount || 2,
        practitionerHoursPerDay: model.practitionerHoursPerDay || 7, workingDaysPerMonth: model.workingDaysPerMonth || 22,
        conservativeOccupancyPercent: model.conservativeOccupancyPercent || 40, realisticOccupancyPercent: model.realisticOccupancyPercent || 65,
        aggressiveOccupancyPercent: model.aggressiveOccupancyPercent || 85, repeatBookingRatePercent: model.repeatBookingRatePercent || 60,
        membershipRevenueGbp: model.membershipRevenueGbp || 0, existingClinicRevenueGbp: model.existingClinicRevenueGbp || 0,
        bedhamptonCostsGbp: (model as any).bedhamptonCostsGbp || 3500, cannibalPercent: (model as any).cannibalPercent ?? 15,
        ownerDrawingsGbp: model.ownerDrawingsGbp || 0, runwaySavingsGbp: model.runwaySavingsGbp || 0,
        personalSalaryNeedsGbp: model.personalSalaryNeedsGbp || 0, nursingIncomeGbp: (model as any).nursingIncomeGbp || 4500,
        targetDrawingsGbp: (model as any).targetDrawingsGbp || 4000,
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

  // Occupancy ramp data for chart
  const rampData = useMemo(() => {
    if (!cashflow) return [];
    return cashflow.map((m) => ({
      monthLabel: m.monthLabel,
      occupancy: m.occupancyPercent,
    }));
  }, [cashflow]);

  const cr = calcResults;
  const sc = SCENARIOS[scenario];

  const healthScore = useMemo(() => {
    if (!cr) return null;
    const financial = cr.owner.cashRunwayMonths >= 12 ? 90 : cr.owner.cashRunwayMonths >= 6 ? 60 : 30;
    const growth = Math.min((cr.winc.occupancyUsed / 85) * 100, 100);
    const operational = Math.max(100 - (cr.winc.fixedCosts / Math.max(cr.winc.totalCosts, 1)) * 60, 20);
    const owner = cr.owner.isSafeToLeaveNursing ? 85 : Math.max(50 - cr.owner.monthlyShortfall / 100, 10);
    const cash = Math.min((cr.owner.runwaySavings / Math.max(cr.owner.minimumCashRequired, 1)) * 100, 100);
    return { financial, growth, operational, owner, cash };
  }, [cr]);

  if (isModelLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-24 bg-muted rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted rounded" />
          <div className="h-80 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ─── Header + Scenario Selector ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expansion Modelling</h2>
          <p className="text-muted-foreground mt-1">
            Winchester (new) + Bedhampton (existing) — real expansion economics, conservative by default.
          </p>
        </div>
        {cr?.scenarioNote && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong className={sc.color}>{sc.label}:</strong> {cr.scenarioNote}</span>
          </div>
        )}
        {/* 7-scenario grid */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS[ScenarioKey]][]).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                scenario === key
                  ? `${s.badgeClass} border-current`
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
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
        {[
          {
            label: "Combined Monthly Net",
            value: cr ? formatGBP(cr.combined.monthlyNetProfit) : "—",
            sub: cr ? `${formatGBP(cr.combined.annualNetProfit)}/yr` : "",
            positive: (cr?.combined.monthlyNetProfit ?? 0) > 0,
            icon: <BarChart3 className="w-4 h-4" />,
          },
          {
            label: "Winchester Net",
            value: cr ? formatGBP(cr.winc.netProfit) : "—",
            sub: cr ? `at ${cr.winc.occupancyUsed}% occupancy` : "",
            positive: (cr?.winc.netProfit ?? 0) > 0,
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            label: "Bedhampton Net (retained)",
            value: cr ? formatGBP(cr.bedh.retainedNetProfit) : "—",
            sub: cr ? `${cr.bedh.migratedPercent}% migrated to Winchester` : "",
            positive: (cr?.bedh.retainedNetProfit ?? 0) > 0,
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            label: "Cash Runway",
            value: cr ? (cr.owner.cashRunwayMonths >= 99 ? "Secure" : `${cr.owner.cashRunwayMonths} months`) : "—",
            sub: cr ? `${formatGBP(cr.owner.runwaySavings)} savings` : "",
            positive: (cr?.owner.cashRunwayMonths ?? 0) >= 12,
            icon: <Shield className="w-4 h-4" />,
          },
        ].map((card, i) => (
          <div key={i} className={`rounded-xl border p-4 ${card.positive ? "border-border/60 bg-card" : "border-destructive/20 bg-destructive/5"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</span>
              <span className={card.positive ? "text-primary/60" : "text-destructive/60"}>{card.icon}</span>
            </div>
            <div className={`text-xl font-bold ${card.positive ? "text-foreground" : "text-destructive"}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ─── Tab Navigation ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["overview", "model", "owner", "risks"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "overview" ? "Overview" : t === "model" ? "Assumptions" : t === "owner" ? "Owner" : "Risks"}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">

          {/* Combined cashflow chart — 3 lines */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">12-Month Cashflow — Winchester vs Bedhampton vs Combined</CardTitle>
              <CardDescription>Monthly net cashflow per operating unit, including occupancy ramp effect</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {cashflow && cashflow.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} />
                      <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                      <Tooltip
                        formatter={(v: number, name: string) => [formatGBP(v), name === "wincNet" ? "Winchester" : name === "bedhNet" ? "Bedhampton" : "Combined"]}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      />
                      <Legend formatter={(v) => v === "wincNet" ? "Winchester" : v === "bedhNet" ? "Bedhampton" : "Combined"} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Line type="monotone" dataKey="wincNet" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="bedhNet" stroke="#60a5fa" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="combinedNet" stroke="#10b981" strokeWidth={2.5} dot={(p) => p.payload.isCombinedBreakevenMonth ? <circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill="#10b981" /> : <g key={p.key} />} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No cashflow data. Save assumptions first.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy ramp */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Winchester Occupancy Ramp</CardTitle>
                <CardDescription className="text-xs">How quickly the new clinic fills up under this scenario</CardDescription>
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

            {/* Revenue breakdown — stacked */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue Breakdown at Target Occupancy</CardTitle>
                <CardDescription className="text-xs">New Winchester revenue vs migrated from Bedhampton</CardDescription>
              </CardHeader>
              <CardContent>
                {cr ? (
                  <div className="space-y-3 pt-2">
                    {[
                      { label: "Genuinely new Winchester revenue", value: cr.winc.newRevenue, color: "bg-primary", pct: cr.winc.grossRevenue > 0 ? (cr.winc.newRevenue / cr.winc.grossRevenue) * 100 : 0 },
                      { label: "Migrated from Bedhampton (cannibalised)", value: cr.winc.migratedRevenue, color: "bg-amber-400", pct: cr.winc.grossRevenue > 0 ? (cr.winc.migratedRevenue / cr.winc.grossRevenue) * 100 : 0 },
                      { label: "Bedhampton retained revenue", value: cr.bedh.retainedRevenue, color: "bg-blue-400", pct: 100 },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold">{formatGBP(row.value)}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border pt-3 flex justify-between text-sm font-semibold">
                      <span>Total combined monthly revenue</span>
                      <span>{formatGBP(cr.combined.monthlyRevenue)}</span>
                    </div>
                  </div>
                ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-10">Run a scenario first.</div>}
              </CardContent>
            </Card>
          </div>

          {/* Break-even + VAT row */}
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
                    <div className="text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Treatments/week needed</span><span className="font-medium">{cr.winc.treatmentsPerWeekToBreakeven}</span></div>
                      <div className="flex justify-between mt-1.5"><span className="text-muted-foreground">Gross margin</span><span className="font-medium">{cr.winc.grossMarginPercent}%</span></div>
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
                          : cr.combined.monthsUntilVatRegistration >= 99
                          ? "Not imminent"
                          : `~${cr.combined.monthsUntilVatRegistration} months`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">until combined £90k annual threshold</div>
                    </div>
                    <Progress
                      value={Math.min((cr.combined.annualRevenue / VAT_THRESHOLD) * 100, 100)}
                      className={`h-2 ${cr.combined.vatRegistrationWarning ? "[&>div]:bg-amber-500" : ""}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatGBP(cr.combined.annualRevenue)} projected annual</span>
                      <span>{formatGBP(VAT_THRESHOLD)} threshold</span>
                    </div>
                    {cr.combined.vatRegistrationWarning && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Approaching threshold — appoint accountant now.
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
                      { label: "Operational Risk", value: healthScore.operational },
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: MODEL (ASSUMPTIONS)                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left: Inputs */}
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

                {/* Winchester fixed costs */}
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
                    <div className="flex justify-between items-center border-t pt-2 mt-1">
                      <span className="text-sm font-semibold">Total fixed</span>
                      <span className="font-bold">{formatGBP(totalFixedCosts)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Variable costs */}
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

                {/* Winchester revenue */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Winchester — Revenue Drivers</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["wincAcvGbp","Avg Client Value (£)"],["treatmentRoomsCount","Treatment Rooms"],
                        ["practitionerHoursPerDay","Hours/Day/Room"],["workingDaysPerMonth","Working Days/Mo"],
                        ["conservativeOccupancyPercent","Conservative Occ %"],["realisticOccupancyPercent","Realistic Occ %"],
                        ["aggressiveOccupancyPercent","Aggressive Occ %"],["membershipRevenueGbp","Membership Rev (£/mo)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Avg client value defaults to Winchester premium rate (£155). Conservative/Realistic/Aggressive occupancy are used by the scenario engine above.
                    </p>
                  </CardContent>
                </Card>

                {/* Bedhampton */}
                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bedhampton (Existing Clinic)</CardTitle>
                    <CardDescription className="text-xs">Stable operating clinic — cannibalisation adjusts both clinics automatically</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["existingClinicRevenueGbp","Monthly Revenue (£)"],["bedhamptonCostsGbp","Monthly Costs (£)"],
                        ["cannibalPercent","Migration to Winchester (%)"],
                      ].map(([name, label]) => (
                        <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" {...field} className="h-8 text-sm" /></FormControl></FormItem>
                        )} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Migration % estimates what share of Winchester patients were previously Bedhampton patients. This reduces Bedhampton retained revenue accordingly. Typical range: 10–25%.
                    </p>
                  </CardContent>
                </Card>

                {/* Personal */}
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
                {/* Winchester KPIs */}
                <Card className="shadow-md border-primary/20">
                  <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex justify-between items-center">
                    <div>
                      <h3 className={`font-semibold capitalize ${sc.color}`}>{sc.label} — Winchester</h3>
                      <p className="text-xs text-muted-foreground">{cr.winc.occupancyUsed}% occupancy · {formatGBP(cr.winc.fixedCosts)}/mo fixed costs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Monthly Net</p>
                      <p className={`text-2xl font-bold ${cr.winc.netProfit > 0 ? "text-primary" : "text-destructive"}`}>{formatGBP(cr.winc.netProfit)}</p>
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[
                        ["Gross Revenue", formatGBP(cr.winc.grossRevenue)],
                        ["Variable Costs", formatGBP(cr.winc.variableCosts)],
                        ["Gross Margin", `${cr.winc.grossMarginPercent}%`],
                        ["New Revenue", formatGBP(cr.winc.newRevenue)],
                        ["Migrated Revenue", formatGBP(cr.winc.migratedRevenue)],
                        ["Total Costs", formatGBP(cr.winc.totalCosts)],
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
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Break-even Rev</div>
                        <div className="font-bold">{formatGBP(cr.winc.breakEvenRevenue)}</div>
                        <div className="text-[10px] text-muted-foreground">/month</div>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Break-even Occ</div>
                        <div className="font-bold">{cr.winc.breakEvenOccupancy}%</div>
                        <div className="text-[10px] text-muted-foreground">occupancy</div>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Appts/week</div>
                        <div className="font-bold">{cr.winc.treatmentsPerWeekToBreakeven}</div>
                        <div className="text-[10px] text-muted-foreground">to break even</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bedhampton KPIs */}
                <Card className="shadow-sm border-blue-200 dark:border-blue-900">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Bedhampton — Retained Position</CardTitle>
                      <Badge className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">{cr.bedh.migratedPercent}% migrated</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[
                        ["Full Revenue", formatGBP(cr.bedh.grossRevenue)],
                        ["Migrated Away", formatGBP(cr.bedh.migratedRevenue)],
                        ["Retained Revenue", formatGBP(cr.bedh.retainedRevenue)],
                        ["Costs", formatGBP(cr.bedh.costs)],
                        ["Full Net Profit", formatGBP(cr.bedh.grossNetProfit)],
                        ["Retained Net Profit", formatGBP(cr.bedh.retainedNetProfit)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                          <div className="font-semibold text-sm">{value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Combined */}
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-900">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">Combined Business</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        ["Monthly Revenue", formatGBP(cr.combined.monthlyRevenue)],
                        ["Monthly Net Profit", formatGBP(cr.combined.monthlyNetProfit)],
                        ["Annual Revenue", formatGBP(cr.combined.annualRevenue)],
                        ["Annual Net Profit", formatGBP(cr.combined.annualNetProfit)],
                        ["EBITDA", formatGBP(cr.combined.ebitda)],
                        ["VAT Registration", cr.combined.monthsUntilVatRegistration === 0 ? "Immediate" : cr.combined.monthsUntilVatRegistration >= 99 ? "Not imminent" : `~${cr.combined.monthsUntilVatRegistration} months`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: OWNER                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "owner" && (
        <div className="space-y-6">
          {cr ? (
            <>
              {/* Survivability banner */}
              <div className={`rounded-xl border p-5 ${cr.owner.isSafeToLeaveNursing ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800"}`}>
                <div className="flex items-start gap-4">
                  {cr.owner.isSafeToLeaveNursing
                    ? <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                    : <XCircle className="w-8 h-8 text-destructive shrink-0 mt-0.5" />}
                  <div>
                    <h3 className={`text-lg font-bold ${cr.owner.isSafeToLeaveNursing ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`}>
                      {cr.owner.isSafeToLeaveNursing ? "Safe to leave nursing under this scenario" : "Not yet safe to leave nursing"}
                    </h3>
                    <p className={`text-sm mt-0.5 ${cr.owner.isSafeToLeaveNursing ? "text-emerald-700 dark:text-emerald-400" : "text-destructive/80"}`}>
                      {cr.owner.isSafeToLeaveNursing
                        ? `Combined clinic income (${formatGBP(cr.owner.clinicExtractable)}/mo) exceeds your target of ${formatGBP(cr.owner.targetDrawings)}/mo.`
                        : `Monthly shortfall: ${formatGBP(cr.owner.monthlyShortfall)}. Clinics produce ${formatGBP(cr.owner.clinicExtractable)}/mo — target is ${formatGBP(cr.owner.targetDrawings)}/mo.`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This is the <strong>{sc.label}</strong> scenario. Run "No Nursing Income" scenario to see full dependency.
                    </p>
                  </div>
                </div>
              </div>

              {/* Income breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Owner Income Analysis</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "Nursing income (current)", value: cr.owner.nursingIncome, note: "Monthly net from NHS/private nursing work", color: "bg-blue-400" },
                      { label: "Clinic income (extractable)", value: cr.owner.clinicExtractable, note: "Combined clinic net profit available for drawings", color: "bg-primary" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold">{formatGBP(row.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${row.color} rounded-full`} style={{ width: `${Math.min((row.value / Math.max(cr.owner.targetDrawings, 1)) * 100, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{row.note}</p>
                      </div>
                    ))}
                    <div className="border-t pt-3 space-y-1.5 text-sm">
                      {[
                        ["Total available", formatGBP(cr.owner.totalAvailableIncome)],
                        ["Target monthly drawings", formatGBP(cr.owner.targetDrawings)],
                        ["Monthly surplus/shortfall", formatGBP(cr.owner.totalAvailableIncome - cr.owner.targetDrawings)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cash Required Before Opening</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2.5">
                      {[
                        { label: "3-month Winchester fixed cost buffer", value: cr.owner.minimumCashRequired - 20000, note: "3× monthly fixed costs while ramping" },
                        { label: "Operating cashflow reserve", value: 20000, note: "Minimum buffer (per cashflow reserve task)" },
                        { label: "Emergency contingency", value: cr.owner.recommendedCash - cr.owner.minimumCashRequired, note: "Additional 1-month buffer + extra headroom" },
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
                        <div className="flex justify-between font-semibold">
                          <span>Minimum safe cash to open</span>
                          <span>{formatGBP(cr.owner.minimumCashRequired)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-primary">
                          <span>Recommended cash to open</span>
                          <span>{formatGBP(cr.owner.recommendedCash)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Current savings</span>
                          <span className={`font-medium ${cr.owner.runwaySavings >= cr.owner.minimumCashRequired ? "text-emerald-600" : "text-destructive"}`}>{formatGBP(cr.owner.runwaySavings)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cash runway (post-opening)</span>
                      <span className="font-semibold">{cr.owner.cashRunwayMonths >= 99 ? "Secure" : `${cr.owner.cashRunwayMonths} months`}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Scenario comparison for owner */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scenario Impact on Owner Income</CardTitle>
                  <CardDescription className="text-xs">Run "No Nursing Income" to see full clinic dependency — this is the most important stress test for personal financial planning.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setScenario("abi_leaves_nursing"); setTab("owner"); }}>
                      Run: No Nursing Income <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setScenario("stress_test"); setTab("owner"); }}>
                      Run: Stress Test <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setScenario("delayed_ramp"); setTab("owner"); }}>
                      Run: Delayed Ramp <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="py-20 text-center text-muted-foreground">Save assumptions to see owner analysis.</div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RISKS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "risks" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                What Could Kill This Project?
              </CardTitle>
              <CardDescription>Ranked threats with likelihood, impact, and mitigation. Grounded in the V5 plan gap analysis.</CardDescription>
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

          {/* Sensitivity nudge */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sensitivity: Test Each Risk Scenario</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS[ScenarioKey]][]).map(([key, s]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => { setScenario(key); setTab("overview"); }}>
                    <span className={s.color}>{s.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-50" />
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Each scenario above models a real risk from the table. Select one and go to Overview to see its financial impact.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
