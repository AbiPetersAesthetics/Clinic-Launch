import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetOptimisationAnalysis,
  getGetOptimisationAnalysisQueryKey,
} from "@workspace/api-client-react";
import type { OptimisationItem } from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ShieldOff,
  ShieldCheck,
  Sparkles,
  Cpu,
  TrendingDown,
  RefreshCw,
  Clock,
  ExternalLink,
  ArrowRight,
  Target,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useQueryClient } from "@tanstack/react-query";

const PROJECT_ID = 1;

type CategoryKey =
  | "dangerous_to_cut"
  | "safe_to_reduce"
  | "luxury_item"
  | "delayable"
  | "non_negotiable"
  | "operationally_critical";

type LeaderboardItem = OptimisationItem & {
  recommendedTier: string;
  riskOfCutting: "low" | "medium" | "high";
  potentialSavingGbp: number;
};

const CATEGORY_CONFIG: Record<
  CategoryKey,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    headerClass: string;
  }
> = {
  dangerous_to_cut: {
    label: "Dangerous to Cut",
    description: "These tasks have dangerous cost configurations. Immediate attention required.",
    icon: ShieldOff,
    badgeClass: "bg-destructive/15 text-destructive",
    headerClass: "text-destructive",
  },
  safe_to_reduce: {
    label: "Safe to Reduce",
    description: "Currently on HIGH tier. Reducing to MID could free up budget without compromising operations.",
    icon: TrendingDown,
    badgeClass: "bg-primary/10 text-primary",
    headerClass: "text-primary",
  },
  luxury_item: {
    label: "Luxury Items",
    description: "Low-risk tasks on HIGH cost tier. These could be reduced or removed to save cash.",
    icon: Sparkles,
    badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    headerClass: "text-yellow-700 dark:text-yellow-400",
  },
  delayable: {
    label: "Delayable",
    description: "Not yet started and low risk. These could be deferred to preserve launch cash flow.",
    icon: Clock,
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    headerClass: "text-orange-700 dark:text-orange-400",
  },
  non_negotiable: {
    label: "Non-Negotiable",
    description: "These costs cannot be reduced. They are legally, clinically, or operationally mandated.",
    icon: ShieldCheck,
    badgeClass: "bg-muted text-muted-foreground",
    headerClass: "text-muted-foreground",
  },
  operationally_critical: {
    label: "Operationally Critical",
    description: "Core costs required for launch. No safe reduction pathway identified.",
    icon: Cpu,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    headerClass: "text-blue-700 dark:text-blue-400",
  },
};

const TIER_BADGE: Record<string, string> = {
  low: "bg-primary/10 text-primary",
  mid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-destructive/15 text-destructive",
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-primary/10 text-primary",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-destructive/15 text-destructive",
};

function TierArrow({ from, to }: { from: string; to: string }) {
  if (to === "defer") {
    return (
      <span className="flex items-center gap-1 text-xs">
        <Badge className={`text-[10px] uppercase ${TIER_BADGE[from] ?? "bg-muted"}`}>{from}</Badge>
        <span className="text-muted-foreground text-[10px]">→ defer</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      <Badge className={`text-[10px] uppercase ${TIER_BADGE[from] ?? "bg-muted"}`}>{from}</Badge>
      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
      <Badge className={`text-[10px] uppercase ${TIER_BADGE[to] ?? "bg-muted"}`}>{to}</Badge>
    </span>
  );
}

function SavingsBar({ saving, max }: { saving: number; max: number }) {
  const pct = max > 0 ? Math.round((saving / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OverspendPlanner({
  leaderboard,
  totalSaving,
}: {
  leaderboard: LeaderboardItem[];
  totalSaving: number;
}) {
  const [targetRaw, setTargetRaw] = useState("");
  const target = parseInt(targetRaw.replace(/[^0-9]/g, "")) || 0;

  const plan = useMemo(() => {
    if (target <= 0 || leaderboard.length === 0) return [];
    // Priority: luxury (lowest risk) → delayable → safe_to_reduce (medium risk)
    // Sort within each group by saving desc
    const prioritised = [
      ...leaderboard.filter(i => i.riskOfCutting === "low").sort((a, b) => b.potentialSavingGbp - a.potentialSavingGbp),
      ...leaderboard.filter(i => i.riskOfCutting === "medium").sort((a, b) => b.potentialSavingGbp - a.potentialSavingGbp),
    ];
    let running = 0;
    const selected: (LeaderboardItem & { runningTotal: number; covers: boolean })[] = [];
    for (const item of prioritised) {
      if (running >= target) break;
      running += item.potentialSavingGbp;
      selected.push({ ...item, runningTotal: running, covers: running >= target });
    }
    return selected;
  }, [target, leaderboard]);

  const covered = plan.length > 0 ? plan[plan.length - 1].runningTotal : 0;
  const pct = target > 0 ? Math.min(100, Math.round((covered / target) * 100)) : 0;
  const gap = Math.max(0, target - covered);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Overspend Scenario Planner
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter the amount you need to recover. We'll show you the safest cuts in priority order.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0">I need to find</span>
          <div className="relative max-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
            <Input
              className="pl-7 text-sm"
              placeholder="e.g. 5000"
              value={targetRaw}
              onChange={e => setTargetRaw(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          {target > 0 && totalSaving > 0 && (
            <span className="text-xs text-muted-foreground">
              of {formatGBP(totalSaving)} available
            </span>
          )}
        </div>

        {target > 0 && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{pct}% of target covered by {plan.length} cut{plan.length !== 1 ? "s" : ""}</span>
                <span className={gap > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-primary font-medium"}>
                  {gap > 0 ? `Still need ${formatGBP(gap)}` : "Target met ✓"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-primary" : "bg-yellow-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {plan.length === 0 ? (
              <p className="text-xs text-muted-foreground">No safe cuts identified — all savings opportunities have been exhausted.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6">#</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="min-w-[90px]">Move</TableHead>
                      <TableHead className="text-right">Saving</TableHead>
                      <TableHead className="text-right">Running total</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.map((item, idx) => (
                      <TableRow key={item.taskId} className={item.covers && idx === plan.findIndex(i => i.covers) ? "bg-primary/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium max-w-[180px]">
                          <span className="truncate block">{item.taskTitle}</span>
                          <span className="text-xs text-muted-foreground font-normal">{item.phaseName}</span>
                        </TableCell>
                        <TableCell>
                          <TierArrow from={item.costTier} to={item.recommendedTier} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-primary">
                          +{formatGBP(item.potentialSavingGbp)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={item.runningTotal >= target ? "text-primary font-semibold" : ""}>
                            {formatGBP(item.runningTotal)}
                          </span>
                          {item.runningTotal >= target && idx === plan.findIndex(i => i.covers) && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary inline ml-1" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/project?taskId=${item.taskId}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {gap > 0 && covered > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-3">
                The remaining {formatGBP(gap)} cannot be recovered through safe cuts alone. Review the full task list or consider phasing the project.
              </p>
            )}
            {target > totalSaving && totalSaving > 0 && covered === 0 && (
              <p className="text-xs text-muted-foreground">
                No safe savings are available — the {formatGBP(totalSaving)} total saving is entirely from higher-risk reductions.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SavingsLeaderboard({ leaderboard }: { leaderboard: LeaderboardItem[] }) {
  const [showAll, setShowAll] = useState(false);
  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No savings opportunities identified at current cost tiers.
        </CardContent>
      </Card>
    );
  }
  const maxSaving = leaderboard[0]?.potentialSavingGbp ?? 1;
  const visible = showAll ? leaderboard : leaderboard.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            Savings Leaderboard — {leaderboard.length} opportunities found
          </CardTitle>
          <span className="text-xs text-muted-foreground">Ranked largest saving first</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-7 pl-4">#</TableHead>
                <TableHead className="min-w-[140px]">Task</TableHead>
                <TableHead className="min-w-[100px]">Move</TableHead>
                <TableHead className="min-w-[60px]">Risk</TableHead>
                <TableHead className="text-right min-w-[80px]">Saving</TableHead>
                <TableHead className="min-w-[80px] hidden sm:table-cell"></TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item, idx) => (
                <TableRow key={item.taskId}>
                  <TableCell className="text-xs text-muted-foreground pl-4">{idx + 1}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium truncate max-w-[180px]">{item.taskTitle}</p>
                    <p className="text-xs text-muted-foreground">{item.phaseName}</p>
                  </TableCell>
                  <TableCell>
                    <TierArrow from={item.costTier} to={item.recommendedTier} />
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] capitalize ${RISK_BADGE[item.riskOfCutting]}`}>
                      {item.riskOfCutting}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-primary">
                    +{formatGBP(item.potentialSavingGbp)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell pr-4">
                    <SavingsBar saving={item.potentialSavingGbp} max={maxSaving} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/project?taskId=${item.taskId}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View task">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {leaderboard.length > 8 && (
          <div className="px-4 pb-4 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground gap-1"
              onClick={() => setShowAll(v => !v)}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
              {showAll ? "Show less" : `Show ${leaderboard.length - 8} more`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemTable({ items, showSaving }: { items: OptimisationItem[]; showSaving: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground py-3">No items in this category.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Task</TableHead>
            <TableHead className="min-w-[100px]">Phase</TableHead>
            <TableHead className="text-right min-w-[60px]">Tier</TableHead>
            <TableHead className="text-right min-w-[80px]">Selected</TableHead>
            {showSaving && <TableHead className="text-right min-w-[70px]">Saving</TableHead>}
            <TableHead className="min-w-[180px]">Rationale</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.taskId}>
              <TableCell className="font-medium text-sm max-w-[180px] truncate">{item.taskTitle}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{item.phaseName}</TableCell>
              <TableCell className="text-right">
                <Badge className={`text-[10px] uppercase ${TIER_BADGE[item.costTier] ?? "bg-muted text-muted-foreground"}`}>
                  {item.costTier}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm">{formatGBP(item.selectedCost)}</TableCell>
              {showSaving && (
                <TableCell className={`text-right text-sm font-medium ${item.potentialSavingGbp > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {item.potentialSavingGbp > 0 ? `+${formatGBP(item.potentialSavingGbp)}` : "—"}
                </TableCell>
              )}
              <TableCell className="text-xs text-muted-foreground max-w-[260px]">{item.rationale}</TableCell>
              <TableCell>
                <Link href={`/project?taskId=${item.taskId}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function OptimisationPage() {
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [showAllFlags, setShowAllFlags] = useState(false);

  const { data: analysis, isLoading, isFetching } = useGetOptimisationAnalysis(PROJECT_ID, {
    query: {
      queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID),
      staleTime: 0,
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
  }

  const leaderboard = useMemo(() => {
    if (!analysis) return [];
    return ((analysis as any).savingsLeaderboard ?? []) as LeaderboardItem[];
  }, [analysis]);

  const ORDERED_CATEGORIES: CategoryKey[] = [
    "dangerous_to_cut",
    "safe_to_reduce",
    "luxury_item",
    "delayable",
    "non_negotiable",
    "operationally_critical",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Optimisation"
        subtitle="Identify where to make savings if the project starts to overspend."
        action={
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : !analysis ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No data available.</CardContent></Card>
      ) : (
        <>
          {/* Danger flags — always shown first if present */}
          {analysis.smartRiskFlags.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-sm font-semibold text-destructive">
                    {analysis.smartRiskFlags.length} item{analysis.smartRiskFlags.length !== 1 ? "s" : ""} need more budget — do not cut these
                  </p>
                </div>
                {analysis.smartRiskFlags.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive h-7 px-2 hover:bg-destructive/10"
                    onClick={() => setShowAllFlags(v => !v)}
                  >
                    {showAllFlags ? "Show less" : `Show all ${analysis.smartRiskFlags.length}`}
                  </Button>
                )}
              </div>
              {(showAllFlags ? analysis.smartRiskFlags : analysis.smartRiskFlags.slice(0, 4)).map((flag, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className={`shrink-0 mt-0.5 ${flag.level === "critical" ? "text-destructive" : "text-yellow-600"}`}>
                    {flag.level === "critical" ? "●" : "◐"}
                  </span>
                  <div>
                    {flag.taskTitle && flag.taskId ? (
                      <Link href={`/project?taskId=${flag.taskId}`} className="font-medium text-foreground hover:underline">
                        {flag.taskTitle}:{" "}
                      </Link>
                    ) : flag.taskTitle ? (
                      <span className="font-medium text-foreground">{flag.taskTitle}: </span>
                    ) : null}
                    <span className="text-muted-foreground">{flag.message}</span>
                  </div>
                </div>
              ))}
              {!showAllFlags && analysis.smartRiskFlags.length > 4 && (
                <p className="text-xs text-muted-foreground pt-1">
                  + {analysis.smartRiskFlags.length - 4} more — <button className="underline text-destructive" onClick={() => setShowAllFlags(true)}>show all</button>
                </p>
              )}
            </div>
          )}

          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current budget</p>
                <p className="text-xl font-semibold mt-1">{formatGBP(analysis.currentCashRequirement)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Remaining task cost</p>
              </CardContent>
            </Card>
            <Card className="border-primary/40">
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">If all cuts made</p>
                <p className="text-xl font-semibold mt-1 text-primary">{formatGBP(analysis.cashRequirementWithSavings)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">After all safe reductions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total available saving</p>
                <p className="text-xl font-semibold mt-1 text-primary">+{formatGBP(analysis.totalPotentialSaving)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Across {leaderboard.length} tasks</p>
              </CardContent>
            </Card>
            <Card className={analysis.categorised.dangerous_to_cut.length > 0 ? "border-destructive/40" : ""}>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Underfunded items</p>
                <p className={`text-xl font-semibold mt-1 ${analysis.categorised.dangerous_to_cut.length > 0 ? "text-destructive" : "text-primary"}`}>
                  {analysis.categorised.dangerous_to_cut.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Need budget increase</p>
              </CardContent>
            </Card>
          </div>

          {/* Overspend Planner — core new feature */}
          <OverspendPlanner
            leaderboard={leaderboard}
            totalSaving={analysis.totalPotentialSaving}
          />

          {/* Savings Leaderboard — ranked cuts */}
          <SavingsLeaderboard leaderboard={leaderboard} />

          {/* Full category breakdown — collapsed by default, available for detail */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Full breakdown by category</p>
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="space-y-2"
            >
              {ORDERED_CATEGORIES.map(key => {
                const config = CATEGORY_CONFIG[key];
                const items = analysis.categorised[key];
                const totalSaving = items.reduce((s, i) => s + i.potentialSavingGbp, 0);
                const showSaving = key === "safe_to_reduce" || key === "luxury_item" || key === "delayable";
                const Icon = config.icon;

                return (
                  <AccordionItem
                    key={key}
                    value={key}
                    className={`border rounded-lg overflow-hidden ${key === "dangerous_to_cut" && items.length > 0 ? "border-destructive/40" : ""}`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 [&[data-state=open]]:bg-muted/40">
                      <div className="flex items-center justify-between w-full mr-3">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${config.headerClass}`} />
                          <div className="text-left">
                            <p className={`text-sm font-medium ${config.headerClass}`}>{config.label}</p>
                            <p className="text-xs text-muted-foreground font-normal hidden sm:block">{config.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Badge className={`text-[10px] ${config.badgeClass}`}>
                            {items.length} {items.length === 1 ? "task" : "tasks"}
                          </Badge>
                          {showSaving && totalSaving > 0 && (
                            <Badge className="text-[10px] bg-primary/10 text-primary">
                              +{formatGBP(totalSaving)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <ItemTable items={items} showSaving={showSaving} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <p className="text-[11px] text-muted-foreground text-right">
            Analysis generated: {new Date(analysis.generatedAt).toLocaleString("en-GB")}
          </p>
        </>
      )}
    </div>
  );
}
