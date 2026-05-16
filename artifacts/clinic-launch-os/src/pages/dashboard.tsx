import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
  useGetProjectCashflow,
  getGetProjectCashflowQueryKey,
  useGetRiskFlags,
  getGetRiskFlagsQueryKey,
  useGetProjectBurndown,
  getGetProjectBurndownQueryKey,
  useListProperties,
  getListPropertiesQueryKey,
  useGetPhasesWithTasks,
  getGetPhasesWithTasksQueryKey,
  useGetComplianceSummary,
  getGetComplianceSummaryQueryKey,
} from "@workspace/api-client-react";
import { formatGBP, formatPercent } from "@/lib/format";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  AlertCircle,
  MapPin,
  Building,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Pause,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ResetPageButton } from "@/components/reset-page-button";
import { Tooltip as Tip, TooltipTrigger as TipTrigger, TooltipContent as TipContent } from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";

const PROJECT_ID = 1;

type ScenarioKey = "conservative" | "realistic" | "aggressive" | "stress_test";
type RAGStatus = "green" | "amber" | "red";

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  conservative: "Conservative",
  realistic: "Realistic",
  aggressive: "Aggressive",
  stress_test: "Stress Test",
};

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  found: "Found",
  interesting: "Interesting",
  brochure_requested: "Brochure Requested",
  viewing_booked: "Viewing Booked",
  viewed: "Viewed",
  under_review: "Under Review",
  due_diligence: "Due Diligence",
  heads_of_terms: "Heads of Terms",
  negotiating: "Negotiating",
  rejected: "Rejected",
  selected: "Selected",
};

const GO_NO_GO_GATES = [
  { id: "assess", label: "Find & Assess", description: "Identify property and conduct pre-lease assessment", requiredPhase1Pct: 0 },
  { id: "offer", label: "Make Offer", description: "Submit offer on Heads of Terms once due diligence basics confirmed", requiredPhase1Pct: 20 },
  { id: "solicit", label: "Instruct Solicitor", description: "Engage solicitor to review lease, schedule of condition and FRI", requiredPhase1Pct: 50 },
  { id: "lease", label: "Sign Lease", description: "Exchange lease only once all Phase 1 and 2 tasks are substantially complete", requiredPhase1Pct: 90 },
  { id: "works", label: "Start Fit-out", description: "Begin physical works once Licence for Alterations is signed", requiredPhase1Pct: 100 },
  { id: "open", label: "Open Clinic", description: "First patient only once Phases 3, 4 and 5 are fully complete", requiredPhase1Pct: 100 },
];

function ragColors(status: RAGStatus) {
  if (status === "green") return { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (status === "amber") return { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
  return { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" };
}

type GoNoGoVerdict = "PROCEED" | "PROCEED_WITH_CONDITIONS" | "DELAY" | "DO_NOT_PROCEED";
type GoNoGoAction = { action: string; priority: "critical" | "high" | "medium"; deadline: string; rationale: string };
type GoNoGoWeek = { week: string; focus: string; actions: string[] };
type MonthlyForecastRow = {
  month: string; monthIndex: number; projectedRevenue: number; occupancyPct: number;
  newClientsProjected: number; netProfitLoss: number; cumulativePL: number;
  confidencePct: number; driverNote: string; isBreakEven: boolean;
};
type RevenueForecast = {
  breakEvenMonth: number | null; firstProfitableMonth: string;
  totalYear1Revenue: number; totalYear1NetPL: number;
  peakMonth: string; peakMonthRevenue: number;
  year1Narrative: string;
  revenueViabilityVerdict: "strong" | "viable" | "marginal" | "unlikely";
  keyRampRisks: string[]; keyRampCatalysts: string[];
};
type GoNoGoResult = {
  verdict: GoNoGoVerdict;
  verdictLabel: string;
  confidenceScore: number;
  executiveSummary: string;
  detailedAssessment: { financial?: string; property?: string; market?: string; competitorAnalysis?: string; demographics?: string; strategic?: string; personal?: string; lifeDesign?: string };
  riskScores: { financial: number; property: number; market: number; strategic: number; lifeDesign?: number; overall: number };
  riskRationale: { financial?: string; property?: string; market?: string; strategic?: string; lifeDesign?: string };
  strengths: string[];
  concerns: string[];
  conditions: string[];
  immediateActions: GoNoGoAction[];
  thirtyDayPlan: GoNoGoWeek[];
  negotiationPoints: string[];
  monthlyRevenueForecast?: MonthlyForecastRow[];
  revenueForecast?: RevenueForecast;
  reviewTrigger: string;
  nextReviewDate: string;
  _computed: {
    breakEvenRevenue: number; rentToRevenuePct: number; cashRunwayMonths: number;
    vatRisk: boolean; vatRiskDetail: string; bedhCoverageMonths: number;
    daysToOpening: number;
  };
  generatedAt: string;
};

const VERDICT_CONFIG: Record<GoNoGoVerdict, { label: string; icon: React.ReactNode; bg: string; border: string; text: string; badge: string }> = {
  PROCEED: {
    label: "Proceed",
    icon: <ThumbsUp className="w-5 h-5" />,
    bg: "from-emerald-50/80 to-transparent dark:from-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  },
  PROCEED_WITH_CONDITIONS: {
    label: "Proceed — with conditions",
    icon: <TrendingUp className="w-5 h-5" />,
    bg: "from-amber-50/80 to-transparent dark:from-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  },
  DELAY: {
    label: "Delay",
    icon: <Pause className="w-5 h-5" />,
    bg: "from-orange-50/80 to-transparent dark:from-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
  },
  DO_NOT_PROCEED: {
    label: "Do not proceed",
    icon: <ThumbsDown className="w-5 h-5" />,
    bg: "from-red-50/80 to-transparent dark:from-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
  },
};

export default function DashboardPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("realistic");

  // ── Go/No-Go recommendation ───────────────────────────────────────────────
  const CACHE_KEY = "goNoGoResult_v1";
  const CACHE_AT_KEY = "goNoGoResultAt_v1";
  const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

  const [goNoGo, setGoNoGo] = useState<GoNoGoResult | null>(null);
  const [goNoGoLoading, setGoNoGoLoading] = useState(false);
  const [goNoGoError, setGoNoGoError] = useState<string | null>(null);
  const [goNoGoStale, setGoNoGoStale] = useState(false);
  const [goNoGoCachedAt, setGoNoGoCachedAt] = useState<string | null>(null);

  function formatCachedAge(isoString: string | null): string {
    if (!isoString) return "";
    const ms = Date.now() - new Date(isoString).getTime();
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor(ms / (1000 * 60));
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return "just now";
  }

  const runGoNoGo = useCallback(() => {
    setGoNoGoLoading(true);
    setGoNoGoError(null);
    fetch("/api/projects/1/go-no-go", { method: "POST", headers: { "Content-Type": "application/json" } })
      .then((r) => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Request failed")))
      .then((d: GoNoGoResult) => {
        setGoNoGo(d);
        setGoNoGoLoading(false);
        setGoNoGoStale(false);
        const now = new Date().toISOString();
        setGoNoGoCachedAt(now);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(d));
          localStorage.setItem(CACHE_AT_KEY, now);
        } catch {}
      })
      .catch((e: string) => { setGoNoGoError(typeof e === "string" ? e : "Analysis failed"); setGoNoGoLoading(false); });
  }, []);

  function clearDashboardCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    try { localStorage.removeItem(CACHE_AT_KEY); } catch {}
    setGoNoGo(null);
    setGoNoGoCachedAt(null);
    setGoNoGoStale(false);
  }

  // On mount: restore from cache if available; only auto-run if no cache exists
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedAt = localStorage.getItem(CACHE_AT_KEY);
      if (cached && cachedAt) {
        const parsed = JSON.parse(cached) as GoNoGoResult;
        setGoNoGo(parsed);
        setGoNoGoCachedAt(cachedAt);
        setGoNoGoStale(Date.now() - new Date(cachedAt).getTime() > STALE_MS);
        return; // Don't auto-run — user can hit Refresh
      }
    } catch {}
    // No cache — fetch fresh
    runGoNoGo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) },
  });

  const { data: cashflow } = useGetProjectCashflow(PROJECT_ID, { scenario }, {
    query: { enabled: true, queryKey: getGetProjectCashflowQueryKey(PROJECT_ID, { scenario }) },
  });

  const { data: risks } = useGetRiskFlags(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetRiskFlagsQueryKey(PROJECT_ID) },
  });

  const { data: burndown } = useGetProjectBurndown(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetProjectBurndownQueryKey(PROJECT_ID) },
  });

  const { data: properties } = useListProperties(PROJECT_ID, {
    query: { enabled: true, queryKey: getListPropertiesQueryKey(PROJECT_ID) },
  });

  const { data: phases } = useGetPhasesWithTasks(PROJECT_ID, null, {
    query: { enabled: true, queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID) },
  });

  const { data: complianceSummary } = useGetComplianceSummary(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) },
  });

  const activeProperty = properties?.find((p) => p.isActiveForProject);

  const allTasks = useMemo(() => {
    if (!phases) return [];
    return phases.flatMap((ph) =>
      (ph.tasks ?? []).map((t) => ({ ...t, phaseName: ph.name }))
    );
  }, [phases]);

  const topPriorities = useMemo(() => {
    const incomplete = allTasks.filter((t) => t.status !== "complete");
    const critical = incomplete.filter((t) => t.isCriticalRisk);
    const nonNeg = incomplete.filter((t) => !t.isCriticalRisk && t.isNonNegotiable && t.riskLevel === "high");
    const highRisk = incomplete.filter((t) => !t.isCriticalRisk && !t.isNonNegotiable && t.riskLevel === "high");
    return [...critical, ...nonNeg, ...highRisk].slice(0, 5);
  }, [allTasks]);

  const phase1Progress = dashboard?.phaseProgress?.find((p) => p.phaseName.includes("Phase 1"));
  const phase1Pct = phase1Progress?.percentComplete ?? 0;

  const currentGateIdx = (() => {
    let idx = 0;
    GO_NO_GO_GATES.forEach((g, i) => { if (phase1Pct >= g.requiredPhase1Pct) idx = i; });
    return idx;
  })();

  const phaseOpeningCash = useMemo(() => {
    if (!phases) return [];
    return phases.map((ph) => ({
      label: ph.name.replace(/Phase \d+ — /, ""),
      selected: ph.selectedCostTotal ?? 0,
    }));
  }, [phases]);

  const paceInsight = useMemo(() => {
    if (!burndown || burndown.length < 2) return null;
    const last = burndown[burndown.length - 1];
    const gap = (last.remainingTasks ?? 0) - (last.idealRemaining ?? 0);
    if (gap > 10) return { status: "red" as RAGStatus, message: `Behind by ~${Math.round(gap)} tasks — launch timeline at risk.` };
    if (gap > 0) return { status: "amber" as RAGStatus, message: `Slightly behind ideal trajectory by ${Math.round(gap)} tasks.` };
    return { status: "green" as RAGStatus, message: "On or ahead of schedule." };
  }, [burndown]);

  const unrealisticRunway = (dashboard?.cashRunwayMonths ?? 0) >= 48;

  const readinessStatus: RAGStatus =
    (dashboard?.launchReadinessPercent ?? 0) >= 30 ? "green" :
    (dashboard?.launchReadinessPercent ?? 0) >= 5 ? "amber" : "red";

  const financialStatus: RAGStatus =
    (dashboard?.cashRunwayMonths ?? 0) >= 12 ? "green" :
    (dashboard?.cashRunwayMonths ?? 0) >= 6 ? "amber" : "red";

  const riskStatus: RAGStatus =
    (dashboard?.criticalRiskFlagCount ?? 0) === 0 ? "green" :
    (dashboard?.criticalRiskFlagCount ?? 0) <= 3 ? "amber" : "red";

  if (!dashboard) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-muted rounded w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Command Centre"
        subtitle="Real-time health, priorities, and decisions for your new clinic launch."
        action={
          <ResetPageButton
            pageLabel="Command Centre"
            description="This clears the cached AI Launch Recommendation only. Your project plan, properties, financial model, and all other data are completely untouched. You can regenerate the recommendation at any time by clicking Refresh."
            onReset={async () => clearDashboardCache()}
          />
        }
      />

      {/* 0. Go/No-Go Recommendation */}
      {(() => {
        const cfg = goNoGo ? VERDICT_CONFIG[goNoGo.verdict] : null;
        const c = goNoGo?._computed;

        const riskColor = (score: number) => {
          if (score <= 3) return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
          if (score <= 6) return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
          if (score <= 8) return "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800";
          return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
        };

        const riskLabel = (score: number) => {
          if (score <= 3) return "Low";
          if (score <= 6) return "Medium";
          if (score <= 8) return "High";
          return "Critical";
        };

        const priorityBadge = (p: string) => {
          if (p === "critical") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
          if (p === "high") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
          return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
        };

        const assessmentDimensions = [
          { key: "financial" as const, label: "Financial" },
          { key: "property" as const, label: "Property" },
          { key: "market" as const, label: "Market" },
          { key: "competitorAnalysis" as const, label: "Competitor Analysis" },
          { key: "demographics" as const, label: "Demographics & Catchment" },
          { key: "strategic" as const, label: "Strategic" },
          { key: "personal" as const, label: "Personal Finance" },
          { key: "lifeDesign" as const, label: "Life Design" },
        ];

        return (
          <Card className={`shadow-sm border ${cfg ? `bg-gradient-to-br ${cfg.bg} ${cfg.border}` : "border-border/60"}`}>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-primary/70 shrink-0" />
                  <CardTitle className="text-base">AI Launch Recommendation</CardTitle>
                  {goNoGo && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg!.badge}`}>
                      {cfg!.icon}
                      {goNoGo.verdictLabel}
                    </span>
                  )}
                  {goNoGoStale && !goNoGoLoading && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                      Stale · {formatCachedAge(goNoGoCachedAt)}
                    </span>
                  )}
                  {!goNoGoStale && goNoGoCachedAt && !goNoGoLoading && (
                    <span className="text-[10px] text-muted-foreground">
                      · {formatCachedAge(goNoGoCachedAt)}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={runGoNoGo} disabled={goNoGoLoading} className={`h-7 px-2 text-xs gap-1 shrink-0 ${goNoGoStale ? "text-amber-600 hover:text-amber-700" : ""}`}>
                  <RefreshCw className={`w-3 h-3 ${goNoGoLoading ? "animate-spin" : ""}`} />
                  {goNoGoLoading ? "Analysing…" : "Refresh"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Financial viability, property terms, and market analysis for the heads of terms decision — not a launch readiness check.
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* ── Loading skeleton ──────────────────────────────────────── */}
              {goNoGoLoading && (
                <div className="space-y-4 animate-pulse">
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg" />)}
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-3 bg-muted rounded" />)}</div>
                    <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-3 bg-muted rounded" />)}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>
                </div>
              )}

              {/* ── Error ─────────────────────────────────────────────────── */}
              {goNoGoError && !goNoGoLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  {goNoGoError}
                  <button onClick={runGoNoGo} className="underline text-primary ml-1">Try again</button>
                </div>
              )}

              {goNoGo && !goNoGoLoading && (
                <>
                  {/* ── Confidence + Computed Metrics row ─────────────────── */}
                  {c && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Launch Confidence */}
                      <Tip>
                        <TipTrigger asChild>
                          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-center cursor-help">
                            <div className="text-2xl font-bold text-foreground">{goNoGo.confidenceScore}%</div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Launch Confidence</div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goNoGo.confidenceScore}%` }} />
                            </div>
                          </div>
                        </TipTrigger>
                        <TipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
                          <p className="font-semibold mb-1">Launch Confidence Score</p>
                          <p>AI's overall confidence (0–100%) that this clinic will be financially viable if Abi signs heads of terms at this property and rent.</p>
                          <p className="mt-1 text-muted-foreground">Factors in: financial model, property terms, competitor landscape, Winchester demographics, and personal runway.</p>
                        </TipContent>
                      </Tip>

                      {/* Break-even */}
                      <Tip>
                        <TipTrigger asChild>
                          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-center cursor-help">
                            <div className="text-xl font-bold text-foreground">
                              {c.breakEvenRevenue > 0 ? `£${Math.round(c.breakEvenRevenue / 1000)}k` : "—"}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Break-even / mo</div>
                            {c.rentToRevenuePct > 0 && (
                              <div className={`text-[10px] mt-0.5 ${c.rentToRevenuePct > 20 ? "text-red-500" : c.rentToRevenuePct > 15 ? "text-amber-500" : "text-emerald-600"}`}>
                                Rent = {c.rentToRevenuePct}% of revenue
                              </div>
                            )}
                          </div>
                        </TipTrigger>
                        <TipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
                          <p className="font-semibold mb-1">Monthly Break-even Revenue</p>
                          <p>The Winchester revenue Abi needs each month to cover all fixed costs and variable expenses. Below this figure the clinic is running at a loss.</p>
                          {c.rentToRevenuePct > 0 && (
                            <p className="mt-1">
                              <span className="font-medium">Rent ratio {c.rentToRevenuePct}%</span> — industry benchmark: under 15% healthy, 15–20% caution, over 20% high risk.
                            </p>
                          )}
                        </TipContent>
                      </Tip>

                      {/* Cash Runway */}
                      <Tip>
                        <TipTrigger asChild>
                          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-center cursor-help">
                            <div className={`text-xl font-bold ${c.cashRunwayMonths >= 99 ? "text-emerald-600" : c.cashRunwayMonths >= 6 ? "text-amber-600" : "text-red-600"}`}>
                              {c.cashRunwayMonths >= 99 ? "Secure" : `${c.cashRunwayMonths}mo`}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Cash Runway</div>
                            {c.bedhCoverageMonths > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">Bedh = {c.bedhCoverageMonths}× monthly fixed</div>
                            )}
                          </div>
                        </TipTrigger>
                        <TipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
                          <p className="font-semibold mb-1">Cash Runway</p>
                          <p>Estimated months Abi can sustain Winchester fixed costs from savings and Bedhampton income, before Winchester needs to be self-funding.</p>
                          {c.bedhCoverageMonths > 0 && (
                            <p className="mt-1">Bedhampton's monthly net profit alone covers <span className="font-medium">{c.bedhCoverageMonths} months</span> of Winchester fixed costs — this is the safety buffer.</p>
                          )}
                        </TipContent>
                      </Tip>

                      {/* VAT */}
                      <Tip>
                        <TipTrigger asChild>
                          <div className={`rounded-lg border p-3 text-center cursor-help ${c.vatRisk ? "border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20" : "border-border/60 bg-background/60"}`}>
                            <div className={`text-xl font-bold ${c.vatRisk ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {c.vatRisk ? "At risk" : "Clear"}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">VAT Threshold</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{c.vatRisk ? "May breach £90k" : "Below £90k limit"}</div>
                          </div>
                        </TipTrigger>
                        <TipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
                          <p className="font-semibold mb-1">VAT Registration Threshold</p>
                          <p>Once combined Winchester + Bedhampton annual turnover exceeds £90k, VAT registration becomes mandatory.</p>
                          <p className="mt-1">This means charging 20% VAT on all services — which either squeezes margin or makes prices less competitive vs non-VAT-registered competitors.</p>
                          {c.vatRiskDetail && <p className="mt-1 font-medium">{c.vatRiskDetail}</p>}
                        </TipContent>
                      </Tip>
                    </div>
                  )}

                  {/* ── Risk Matrix ────────────────────────────────────────── */}
                  {goNoGo.riskScores && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risk Assessment — Property Decision</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {([
                          { dim: "financial" as const, label: "Financial", desc: "Financial model viability — break-even occupancy, cash runway, fixed cost burden, and scenario range." },
                          { dim: "property" as const, label: "Property", desc: "Property terms risk — rent level, lease length, repairing obligations, and how the heads of terms hold up commercially." },
                          { dim: "market" as const, label: "Market", desc: "Winchester market risk — demand for premium aesthetics, competitor density, footfall at this location, and client acquisition difficulty." },
                          { dim: "strategic" as const, label: "Strategic", desc: "Strategic risk — whether this move makes sense for the business at this stage, and how Bedhampton's trajectory affects it." },
                          { dim: "lifeDesign" as const, label: "Life Design", desc: "Personal risk — impact on Abi's working hours, income security, stress, and life design goals during the ramp-up period." },
                        ]).map(({ dim, label, desc }) => {
                          const score = goNoGo.riskScores[dim] ?? 5;
                          const rationale = goNoGo.riskRationale?.[dim];
                          return (
                            <Tip key={dim}>
                              <TipTrigger asChild>
                                <div className={`rounded-lg border p-3 cursor-help ${riskColor(score)}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider">{label}</div>
                                    <div className="text-base font-bold">{score}/10</div>
                                  </div>
                                  <div className="text-[10px] font-semibold">{riskLabel(score)} risk</div>
                                  {rationale && <div className="text-[10px] opacity-80 mt-1 leading-tight">{rationale}</div>}
                                </div>
                              </TipTrigger>
                              <TipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">
                                <p className="font-semibold mb-1">{label} Risk — {score}/10</p>
                                <p>{desc}</p>
                                <p className="mt-1 text-muted-foreground">1–3 = Low · 4–6 = Moderate · 7–10 = High</p>
                                {rationale && <p className="mt-1 font-medium border-t pt-1">{rationale}</p>}
                              </TipContent>
                            </Tip>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Executive Summary ─────────────────────────────────── */}
                  {goNoGo.executiveSummary && (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{goNoGo.executiveSummary}</p>
                    </div>
                  )}

                  {/* ── Detailed Assessment ────────────────────────────────── */}
                  {goNoGo.detailedAssessment && Object.values(goNoGo.detailedAssessment).some(Boolean) && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detailed Assessment</div>
                      <div className="space-y-2">
                        {assessmentDimensions.map(({ key, label }) => {
                          const text = goNoGo.detailedAssessment[key];
                          if (!text) return null;
                          return (
                            <div key={key} className="rounded-lg border border-border/40 bg-background/50 p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1">{label}</div>
                              <p className="text-xs text-foreground/80 leading-relaxed">{text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Strengths + Concerns ───────────────────────────────── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {goNoGo.strengths.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">Strengths</div>
                        <ul className="space-y-2">
                          {goNoGo.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {goNoGo.concerns.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Concerns</div>
                        <ul className="space-y-2">
                          {goNoGo.concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* ── Conditions ─────────────────────────────────────────── */}
                  {goNoGo.conditions.length > 0 && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">Non-negotiable conditions</div>
                      <ul className="space-y-1.5">
                        {goNoGo.conditions.map((cond, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                            <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />{cond}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Immediate Actions ──────────────────────────────────── */}
                  {goNoGo.immediateActions.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Priority Actions</div>
                      <div className="space-y-2">
                        {goNoGo.immediateActions.map((a, i) => {
                          const action = typeof a === "string" ? { action: a, priority: "high" as const, deadline: "", rationale: "" } : a;
                          return (
                            <div key={i} className="rounded-lg border border-border/50 bg-background/60 p-3 flex gap-3 items-start">
                              <span className="text-primary font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className="text-xs font-medium text-foreground">{action.action}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${priorityBadge(action.priority)}`}>
                                    {action.priority}
                                  </span>
                                  {action.deadline && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />{action.deadline}
                                    </span>
                                  )}
                                </div>
                                {action.rationale && <p className="text-[11px] text-muted-foreground leading-snug">{action.rationale}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Negotiation Points ────────────────────────────────── */}
                  {goNoGo.negotiationPoints?.length > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Heads of Terms — Points to Negotiate</div>
                      <ul className="space-y-1.5">
                        {goNoGo.negotiationPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground/85">
                            <ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-primary/60" />{pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── 30-Day Plan ─────────────────────────────────────────── */}
                  {goNoGo.thirtyDayPlan?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">30-Day Plan</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {goNoGo.thirtyDayPlan.map((week, i) => (
                          <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{week.week}</span>
                              {week.focus && <span className="text-[10px] text-muted-foreground">— {week.focus}</span>}
                            </div>
                            <ul className="space-y-1">
                              {week.actions.map((act, j) => (
                                <li key={j} className="flex items-start gap-1 text-[11px] text-foreground/80">
                                  <span className="text-muted-foreground shrink-0 mt-px">·</span>{act}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 12-Month Revenue Forecast ─────────────────────────── */}
                  {goNoGo.monthlyRevenueForecast && goNoGo.monthlyRevenueForecast.length > 0 && goNoGo.revenueForecast && (() => {
                    const fc = goNoGo.revenueForecast!;
                    const rows = goNoGo.monthlyRevenueForecast!;
                    const beMonthIndex = fc.breakEvenMonth;
                    const breakEvenRevenue = goNoGo._computed?.breakEvenRevenue ?? 0;
                    const verdictColor: Record<string, string> = {
                      strong: "text-emerald-600 dark:text-emerald-400",
                      viable: "text-blue-600 dark:text-blue-400",
                      marginal: "text-amber-600 dark:text-amber-400",
                      unlikely: "text-red-600 dark:text-red-400",
                    };
                    const chartData = rows.map(r => ({
                      month: r.month.replace(" 20", " '"),
                      revenue: r.projectedRevenue,
                      netPL: r.netProfitLoss,
                      cumPL: r.cumulativePL,
                      occ: r.occupancyPct,
                      breakEven: breakEvenRevenue,
                      isBreakEven: r.isBreakEven,
                    }));
                    return (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">12-Month Revenue Forecast</div>

                        {/* Summary strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                          {[
                            { label: "Year 1 Revenue", value: `£${(fc.totalYear1Revenue / 1000).toFixed(0)}k` },
                            { label: "Year 1 Net P&L", value: `${fc.totalYear1NetPL >= 0 ? "+" : ""}£${(fc.totalYear1NetPL / 1000).toFixed(0)}k`, red: fc.totalYear1NetPL < 0 },
                            { label: "Break-even", value: beMonthIndex ? fc.firstProfitableMonth : "Not in Yr 1" },
                            { label: "Peak Month", value: fc.peakMonth },
                          ].map(({ label, value, red }) => (
                            <div key={label} className="rounded-lg border border-border/50 bg-muted/30 p-2.5 text-center">
                              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                              <div className={`text-sm font-bold ${red ? "text-red-500 dark:text-red-400" : "text-foreground"}`}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Viability verdict */}
                        <div className={`text-[11px] font-semibold mb-3 ${verdictColor[fc.revenueViabilityVerdict] ?? "text-foreground"}`}>
                          Revenue viability: <span className="capitalize">{fc.revenueViabilityVerdict}</span>
                          {fc.year1Narrative && <span className="font-normal text-muted-foreground ml-2">{fc.year1Narrative}</span>}
                        </div>

                        {/* Bar chart */}
                        <div className="h-44 w-full mb-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barCategoryGap="20%">
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                              <YAxis tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                              <Tooltip
                                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11, color: "#1a1a1a" }}
                                formatter={(val: number, name: string) => {
                                  if (name === "revenue") return [`£${val.toLocaleString()}`, "Revenue"];
                                  if (name === "netPL") return [`${val >= 0 ? "+" : ""}£${val.toLocaleString()}`, "Net P&L"];
                                  return [val, name];
                                }}
                              />
                              <ReferenceLine y={breakEvenRevenue} stroke="hsl(var(--destructive))" strokeDasharray="4 2" label={{ value: "Break-even", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--destructive))" }} />
                              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={index} fill={entry.isBreakEven ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} opacity={0.85} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Monthly detail table */}
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="border-b border-border/40">
                                {["Month", "Revenue", "Occ %", "Net P&L", "Cum. P&L", "Conf.", "Driver"].map(h => (
                                  <th key={h} className="text-left py-1 pr-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, i) => (
                                <tr key={i} className={`border-b border-border/20 ${r.isBreakEven ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
                                  <td className="py-1 pr-3 font-medium whitespace-nowrap">{r.month}{r.isBreakEven && <span className="ml-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">★</span>}</td>
                                  <td className="py-1 pr-3 whitespace-nowrap">£{r.projectedRevenue.toLocaleString()}</td>
                                  <td className="py-1 pr-3 whitespace-nowrap">{r.occupancyPct}%</td>
                                  <td className={`py-1 pr-3 whitespace-nowrap font-medium ${r.netProfitLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                    {r.netProfitLoss >= 0 ? "+" : ""}£{r.netProfitLoss.toLocaleString()}
                                  </td>
                                  <td className={`py-1 pr-3 whitespace-nowrap ${r.cumulativePL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                    {r.cumulativePL >= 0 ? "+" : ""}£{r.cumulativePL.toLocaleString()}
                                  </td>
                                  <td className="py-1 pr-3 whitespace-nowrap text-muted-foreground">{r.confidencePct}%</td>
                                  <td className="py-1 text-muted-foreground">{r.driverNote}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Risks & Catalysts */}
                        {(fc.keyRampRisks?.length > 0 || fc.keyRampCatalysts?.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {fc.keyRampRisks?.length > 0 && (
                              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-2.5">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5">Ramp Risks</div>
                                <ul className="space-y-1">
                                  {fc.keyRampRisks.map((r, i) => (
                                    <li key={i} className="flex items-start gap-1 text-[10px] text-foreground/80">
                                      <span className="text-red-400 shrink-0 mt-px">▾</span>{r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {fc.keyRampCatalysts?.length > 0 && (
                              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">Ramp Catalysts</div>
                                <ul className="space-y-1">
                                  {fc.keyRampCatalysts.map((c, i) => (
                                    <li key={i} className="flex items-start gap-1 text-[10px] text-foreground/80">
                                      <span className="text-emerald-500 shrink-0 mt-px">▴</span>{c}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Footer ────────────────────────────────────────────── */}
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-[10px] text-muted-foreground border-t border-border/40 pt-3">
                    <span>Re-run when: {goNoGo.reviewTrigger}</span>
                    <div className="flex gap-3">
                      {goNoGo.nextReviewDate && (
                        <span>Next review: <strong>{new Date(goNoGo.nextReviewDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong></span>
                      )}
                      <span>Generated {new Date(goNoGo.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 1. Executive Health Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Launch Readiness */}
        {(() => {
          const r = ragColors(readinessStatus);
          return (
            <div className={`rounded-xl border p-4 ${r.bg} ${r.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Launch Readiness</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
              </div>
              <div className={`text-2xl font-bold mb-1 ${r.text}`}>{dashboard.launchReadinessPercent}%</div>
              <p className="text-xs text-muted-foreground leading-snug">
                {dashboard.completedTaskCount} of {dashboard.totalTaskCount} tasks done
              </p>
              <a href="/project" className={`mt-3 text-xs font-medium flex items-center gap-1 ${r.text} hover:underline`}>
                View plan <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          );
        })()}

        {/* Financial Safety */}
        {(() => {
          const r = ragColors(financialStatus);
          return (
            <div className={`rounded-xl border p-4 ${r.bg} ${r.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financial Safety</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
              </div>
              <div className={`text-2xl font-bold mb-1 ${r.text}`}>
                {unrealisticRunway ? "99+ mo" : `${dashboard.cashRunwayMonths ?? "—"} mo`}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {unrealisticRunway
                  ? "Review financial assumptions — runway may be overstated."
                  : "Cash runway with Bedhampton income offset."}
              </p>
              <a href="/financials" className={`mt-3 text-xs font-medium flex items-center gap-1 ${r.text} hover:underline`}>
                Review <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          );
        })()}

        {/* Risk Exposure */}
        {(() => {
          const r = ragColors(riskStatus);
          return (
            <div className={`rounded-xl border p-4 ${r.bg} ${r.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Exposure</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
              </div>
              <div className={`text-2xl font-bold mb-1 ${r.text}`}>{dashboard.criticalRiskFlagCount} critical</div>
              <p className="text-xs text-muted-foreground leading-snug">
                {dashboard.highRiskTaskCount} high-risk pending. {dashboard.blockedTaskCount} blocked.
              </p>
              <span className={`mt-3 text-xs font-medium flex items-center gap-1 ${r.text}`}>
                {dashboard.criticalRiskFlagCount === 0 ? "No critical blockers" : "Action required"}
              </span>
            </div>
          );
        })()}

        {/* Next Decision */}
        {(() => {
          const r = ragColors("amber");
          const nextTask = topPriorities[0];
          return (
            <div className={`rounded-xl border p-4 ${r.bg} ${r.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next Decision</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
              </div>
              <div className={`text-sm font-bold mb-1 ${r.text} leading-tight`}>
                {nextTask ? nextTask.title.substring(0, 42) + (nextTask.title.length > 42 ? "…" : "") : "All clear"}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {topPriorities.length} priority tasks need attention.
              </p>
              <a href="/decisions" className={`mt-3 text-xs font-medium flex items-center gap-1 ${r.text} hover:underline`}>
                Log decision <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          );
        })()}
      </div>

      {/* 2. CQC Risk Banner — shown when registration not started and opening date within 20 weeks */}
      {(() => {
        if (!dashboard.cqcNotStarted) return null;
        const openingDate = dashboard.targetOpeningDate;
        if (!openingDate) return null;
        const weeksToOpen = (new Date(openingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7);
        if (weeksToOpen >= 20) return null;
        return (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-700 dark:text-red-400 text-sm">CQC Registration not started — opening at risk</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">
                Your target opening date is {Math.round(weeksToOpen)} weeks away but CQC registration requires a minimum of 19 weeks. Start the registration process immediately to avoid delaying opening.
              </p>
              <a href="/compliance" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:underline flex items-center gap-1">
                Open compliance tracker <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      })()}

      {/* 3. Active Property Banner */}
      {activeProperty && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Clinic Location</p>
              <Badge className="text-xs bg-primary/15 text-primary border-primary/30 border">
                {PIPELINE_STAGE_LABELS[activeProperty.pipelineStatus ?? "selected"] ?? "Selected"}
              </Badge>
            </div>
            <p className="font-semibold truncate">{activeProperty.address ?? "Address not set"}</p>
            <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
              {activeProperty.postcode && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{activeProperty.postcode}</span>
              )}
              {activeProperty.monthlyRentGbp != null && (
                <span>Rent: <strong className="text-foreground">{formatGBP(activeProperty.monthlyRentGbp)}/mo</strong></span>
              )}
              {activeProperty.businessRatesGbp != null && (
                <span>Annual rates: <strong className="text-foreground">{formatGBP(activeProperty.businessRatesGbp)}</strong></span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/properties"} className="shrink-0 hidden sm:flex">
            Properties <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* 3. This Week's Priorities */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                This Week's Priorities
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Ranked by compliance impact: critical risk first, then non-negotiable high-risk</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/project"}>
              Full plan <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topPriorities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              All critical and high-risk tasks complete.
            </div>
          ) : (
            <div className="space-y-2">
              {topPriorities.map((task, i) => (
                <div key={task.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm leading-snug">{task.title}</span>
                      {task.isCriticalRisk && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0 shrink-0">Critical</Badge>
                      )}
                      {task.isNonNegotiable && !task.isCriticalRisk && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0 shrink-0">Required</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground/70">{(task as any).phaseName?.replace(/Phase \d+ — /, "")}</span>
                      {task.owner && <span>Owner: {task.owner}</span>}
                      {(task.selectedCost ?? 0) > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{formatGBP(task.selectedCost)}</span>}
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    task.status === "in_progress" ? "bg-amber-400" :
                    task.status === "blocked" ? "bg-red-500" : "bg-muted-foreground/30"
                  }`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Go / No-Go Gate */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Go / No-Go Gate
          </CardTitle>
          <p className="text-sm text-muted-foreground">Current project gate based on Phase 1 completion ({phase1Pct}%)</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {GO_NO_GO_GATES.map((gate, i) => {
              const isCompleted = i < currentGateIdx;
              const isCurrent = i === currentGateIdx;
              return (
                <div key={gate.id} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    isCurrent ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" :
                    isCompleted ? "bg-emerald-50 dark:bg-emerald-950/30" : "opacity-40"
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isCompleted ? "bg-emerald-500" : isCurrent ? "bg-amber-500" : "bg-muted"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : isCurrent ? (
                        <Clock className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-bold">{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold text-center leading-tight whitespace-nowrap ${
                      isCurrent ? "text-amber-700 dark:text-amber-400" :
                      isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                    }`}>{gate.label}</span>
                  </div>
                  {i < GO_NO_GO_GATES.length - 1 && (
                    <div className={`w-5 h-px mx-1 ${i < currentGateIdx ? "bg-emerald-400" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {(() => {
            const gate = GO_NO_GO_GATES[currentGateIdx];
            const nextGate = GO_NO_GO_GATES[currentGateIdx + 1];
            return gate ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Current gate: {gate.label}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{gate.description}</p>
                    {nextGate && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        Next gate ({nextGate.label}) requires Phase 1 at {nextGate.requiredPhase1Pct}% — currently {phase1Pct}%.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null;
          })()}
        </CardContent>
      </Card>

      {/* 5. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Cost Exposure */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Cost Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm text-muted-foreground">Selected</span>
                <span className="text-2xl font-bold">{formatGBP(dashboard.currentSelectedCost)}</span>
              </div>
              <div className="h-px w-full bg-border" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">Low</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatGBP(dashboard.totalProjectCostLow)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Mid</span>
                  <span className="font-medium">{formatGBP(dashboard.totalProjectCostMid)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">High</span>
                  <span className="font-medium text-destructive">{formatGBP(dashboard.totalProjectCostHigh)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Health */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cash Runway</span>
                <span className="text-xl font-bold">
                  {unrealisticRunway ? "99+ mo" : `${dashboard.cashRunwayMonths ?? "—"} mo`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monthly Burn</span>
                <span className="text-lg font-medium text-destructive">{formatGBP(dashboard.monthlyBurnRate ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Est. Yr 1 Profit</span>
                <span className={`text-lg font-medium ${(dashboard.projectedFirstYearProfit ?? 0) > 0 ? "text-primary" : "text-destructive"}`}>
                  {formatGBP(dashboard.projectedFirstYearProfit ?? 0)}
                </span>
              </div>
              <div className="border-t border-border/50 pt-2">
                <p className="text-[10px] text-muted-foreground">
                  Assumes Bedhampton revenue offset, realistic occupancy ramp, selected cost tier.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Execution */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Overall progress</span>
                  <span className="font-medium">{dashboard.completedTaskCount} / {dashboard.totalTaskCount}</span>
                </div>
                <Progress value={(dashboard.completedTaskCount / Math.max(dashboard.totalTaskCount, 1)) * 100} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-destructive/5 rounded p-2.5 border border-destructive/10">
                  <div className="flex items-center gap-1 text-destructive mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Blocked</span>
                  </div>
                  <span className="text-xl font-bold text-destructive">{dashboard.blockedTaskCount}</span>
                </div>
                <div className="bg-orange-500/5 rounded p-2.5 border border-orange-500/10">
                  <div className="flex items-center gap-1 text-orange-600 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">High Risk</span>
                  </div>
                  <span className="text-xl font-bold text-orange-600">{dashboard.highRiskTaskCount}</span>
                </div>
              </div>
              {paceInsight && (
                <div className={`text-xs rounded p-2 border ${
                  paceInsight.status === "green" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400" :
                  paceInsight.status === "amber" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-400" :
                  "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700 dark:text-red-400"
                }`}>
                  {paceInsight.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compliance Readiness */}
        <Card className="shadow-sm border-border/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = "/compliance"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              CQC & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const score = complianceSummary?.overallScore ?? 0;
                const total = complianceSummary?.totalItems ?? 0;
                const complete = complianceSummary?.sectionSummaries.reduce((s, x) => s + x.complete, 0) ?? 0;
                const cqcNotStarted = complianceSummary?.cqcNotStarted ?? true;
                const color = score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                const barColor = score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-400";
                return (
                  <>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-muted-foreground">Readiness</span>
                      <span className={`text-2xl font-bold ${color}`}>{score}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{complete} / {total} items</span>
                      {cqcNotStarted && (
                        <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> CQC not started
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Click to open compliance tracker →</p>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Cash Required Before Opening */}
      {phaseOpeningCash.length > 0 && dashboard.currentSelectedCost > 0 && (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Cash Required Before Opening</CardTitle>
            <p className="text-sm text-muted-foreground">Selected cost budget by phase — total committed spend before first patient</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {phaseOpeningCash.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{p.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/65 rounded transition-all duration-700"
                      style={{ width: p.selected > 0 ? `${Math.min((p.selected / dashboard.currentSelectedCost) * 100, 100)}%` : "0%" }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-20 text-right shrink-0">
                    {p.selected > 0 ? formatGBP(p.selected) : <span className="text-muted-foreground font-normal">—</span>}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-border pt-2.5 mt-1">
                <span className="text-xs font-bold w-40 shrink-0">Total before opening</span>
                <div className="flex-1" />
                <span className="text-lg font-bold w-20 text-right shrink-0">{formatGBP(dashboard.currentSelectedCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7. Cashflow Chart */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-lg">Projected Cashflow</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">12-month net cashflow with occupancy ramp from opening</p>
          </div>
          <div className="flex bg-muted p-1 rounded-lg flex-wrap gap-1 shrink-0">
            {(["conservative", "realistic", "aggressive", "stress_test"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scenario === s
                    ? s === "stress_test"
                      ? "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 shadow-sm"
                      : "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {SCENARIO_LABELS[s]}
              </button>
            ))}
          </div>
        </CardHeader>
        {scenario === "stress_test" && (
          <div className="px-6 pb-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <strong>Stress test:</strong> 5% opening occupancy, slow 10-month ramp to below-conservative level. Shows worst-case cashflow exposure — the minimum operating buffer you need to survive.
            </div>
          </div>
        )}
        <CardContent>
          <div className="h-[280px] w-full mt-2">
            {cashflow && cashflow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={scenario === "stress_test" ? "#ef4444" : "hsl(var(--primary))"} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={scenario === "stress_test" ? "#ef4444" : "hsl(var(--primary))"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                  <YAxis tickFormatter={(val) => `£${(val / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => [formatGBP(value), "Net Cashflow"]}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                    contentStyle={{ background: "#fff", color: "#1a1a1a", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 6px 0 rgb(0 0 0 / 0.1)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netCashflow"
                    stroke={scenario === "stress_test" ? "#ef4444" : "hsl(var(--primary))"}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorNet)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No financial data available. Set up a financial model first.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 8. Burndown */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Task Burndown</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">16-week ideal trajectory vs actual remaining tasks</p>
            </div>
            {paceInsight && (
              <Badge className={`text-xs shrink-0 ${
                paceInsight.status === "green" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" :
                paceInsight.status === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
                "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              } border-0`}>
                {paceInsight.status === "green" ? "On track" : paceInsight.status === "amber" ? "Slightly behind" : "Behind schedule"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full mt-2">
            {burndown && burndown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="weekLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={8} interval={3} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name === "idealRemaining" ? "Ideal" : "Actual"]}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                    contentStyle={{ background: "#fff", color: "#1a1a1a", borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend formatter={(v) => v === "idealRemaining" ? "Ideal" : "Actual"} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="idealRemaining" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" dataKey="remainingTasks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No task data available.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 9. Phase Execution + Active Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Phase Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.phaseProgress.map((phase) => (
                <div key={phase.phaseId}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{phase.phaseName}</span>
                    <span className="text-muted-foreground text-xs">
                      {phase.completedTasks} / {phase.totalTasks} ({formatPercent(phase.percentComplete)})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${phase.percentComplete === 100 ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${phase.percentComplete}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              Active Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {risks && risks.length > 0 ? (
                risks.map((risk, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border flex gap-2.5 ${
                      risk.level === "critical"
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-orange-500/5 border-orange-500/15"
                    }`}
                  >
                    {risk.level === "critical" ? (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className={`text-xs font-semibold uppercase tracking-wide ${risk.level === "critical" ? "text-destructive" : "text-orange-700 dark:text-orange-400"}`}>
                        {risk.category}
                      </h4>
                      <p className="text-xs text-foreground mt-0.5 leading-snug">{risk.message}</p>
                      {risk.taskTitle && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">→ {risk.taskTitle}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  No active risk flags.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
