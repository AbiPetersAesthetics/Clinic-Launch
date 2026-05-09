import { useState } from "react";
import { Link } from "wouter";
import {
  useGetOptimisationAnalysis,
  getGetOptimisationAnalysisQueryKey,
} from "@workspace/api-client-react";
import type { OptimisationItem } from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const CATEGORY_CONFIG: Record<
  CategoryKey,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    headerClass: string;
    savingsText: string;
  }
> = {
  dangerous_to_cut: {
    label: "Dangerous to Cut",
    description: "These tasks have dangerous cost configurations. Immediate attention required.",
    icon: ShieldOff,
    badgeClass: "bg-destructive/15 text-destructive",
    headerClass: "text-destructive",
    savingsText: "Action required",
  },
  safe_to_reduce: {
    label: "Safe to Reduce",
    description: "Currently on HIGH tier. Reducing to MID could free up budget without compromising operations.",
    icon: TrendingDown,
    badgeClass: "bg-primary/10 text-primary",
    headerClass: "text-primary",
    savingsText: "Potential saving",
  },
  luxury_item: {
    label: "Luxury Items",
    description: "Low-risk tasks on HIGH cost tier. These could be reduced or removed to save cash.",
    icon: Sparkles,
    badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    headerClass: "text-yellow-700 dark:text-yellow-400",
    savingsText: "Potential saving",
  },
  delayable: {
    label: "Delayable",
    description: "Not yet started and low risk. These could be deferred to preserve launch cash flow.",
    icon: Clock,
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    headerClass: "text-orange-700 dark:text-orange-400",
    savingsText: "Deferrable",
  },
  non_negotiable: {
    label: "Non-Negotiable",
    description: "These costs cannot be reduced. They are legally, clinically, or operationally mandated.",
    icon: ShieldCheck,
    badgeClass: "bg-muted text-muted-foreground",
    headerClass: "text-muted-foreground",
    savingsText: "Fixed",
  },
  operationally_critical: {
    label: "Operationally Critical",
    description: "Core costs required for launch. No safe reduction pathway identified.",
    icon: Cpu,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    headerClass: "text-blue-700 dark:text-blue-400",
    savingsText: "Required",
  },
};

const TIER_BADGE: Record<string, string> = {
  low: "bg-primary/10 text-primary",
  mid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-destructive/15 text-destructive",
};

function ItemTable({ items, showSaving }: { items: OptimisationItem[]; showSaving: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground py-3">No items in this category.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">Tier</TableHead>
          <TableHead className="text-right">Selected</TableHead>
          {showSaving && <TableHead className="text-right">Saving</TableHead>}
          <TableHead>Rationale</TableHead>
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
                <Button variant="ghost" size="icon" className="h-7 w-7" title="View task in Project Plan">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RiskScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? "bg-destructive" : score >= 30 ? "bg-yellow-500" : "bg-primary";
  const label = score >= 60 ? "High Risk" : score >= 30 ? "Moderate" : "Healthy";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Operational Risk Score</span>
        <span className={`font-semibold ${score >= 60 ? "text-destructive" : score >= 30 ? "text-yellow-600 dark:text-yellow-400" : "text-primary"}`}>
          {score}/100 — {label}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function OptimisationPage() {
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<string[]>(["dangerous_to_cut", "safe_to_reduce", "luxury_item"]);

  const { data: analysis, isLoading, isFetching } = useGetOptimisationAnalysis(PROJECT_ID, {
    query: {
      queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID),
      staleTime: 0,
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
  }

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
        subtitle="Automated analysis of cost variance — tap any task row to jump directly to it in the Project Plan."
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
          {/* Smart Risk Flags — derived from optimisation analysis */}
          {analysis.smartRiskFlags.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm font-semibold text-destructive">
                  {analysis.smartRiskFlags.length} Smart Risk {analysis.smartRiskFlags.length === 1 ? "Flag" : "Flags"} — Immediate Attention Required
                </p>
              </div>
              {analysis.smartRiskFlags.map((flag, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className={`shrink-0 mt-0.5 ${flag.level === "critical" ? "text-destructive" : "text-yellow-600"}`}>
                    {flag.level === "critical" ? "●" : "◐"}
                  </span>
                  <div>
                    {flag.taskTitle && flag.taskId ? (
                      <Link
                        href={`/project?taskId=${flag.taskId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {flag.taskTitle}:{" "}
                      </Link>
                    ) : flag.taskTitle ? (
                      <span className="font-medium text-foreground">{flag.taskTitle}: </span>
                    ) : null}
                    <span className="text-muted-foreground">{flag.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cash Requirement</p>
                <p className="text-xl font-semibold mt-1">{formatGBP(analysis.currentCashRequirement)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/40">
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">With All Savings</p>
                <p className="text-xl font-semibold mt-1 text-primary">{formatGBP(analysis.cashRequirementWithSavings)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Potential Saving</p>
                <p className="text-xl font-semibold mt-1 text-primary">+{formatGBP(analysis.totalPotentialSaving)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dangerous Selections</p>
                <p className={`text-xl font-semibold mt-1 ${analysis.categorised.dangerous_to_cut.length > 0 ? "text-destructive" : "text-primary"}`}>
                  {analysis.categorised.dangerous_to_cut.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Runway KPIs — only shown when financial model is populated */}
          {(analysis.runwayMonths !== null && analysis.runwayMonths !== undefined) && (
            <div className="grid grid-cols-2 gap-4">
              <Card className={analysis.runwayMonths < 3 ? "border-destructive/50" : analysis.runwayMonths < 6 ? "border-yellow-500/50" : "border-primary/40"}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Post-Launch Runway (Current Plan)</p>
                  <p className={`text-xl font-semibold mt-1 ${analysis.runwayMonths < 3 ? "text-destructive" : analysis.runwayMonths < 6 ? "text-yellow-600 dark:text-yellow-400" : "text-primary"}`}>
                    {analysis.runwayMonths < 0 ? "Underfunded" : `${analysis.runwayMonths} months`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">After launch spend at current cost tiers</p>
                </CardContent>
              </Card>
              <Card className={(analysis.runwayMonthsWithSavings ?? 0) < 3 ? "border-destructive/50" : (analysis.runwayMonthsWithSavings ?? 0) < 6 ? "border-yellow-500/50" : "border-primary/40"}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Post-Launch Runway (Optimised)</p>
                  <p className={`text-xl font-semibold mt-1 ${(analysis.runwayMonthsWithSavings ?? 0) < 3 ? "text-destructive" : (analysis.runwayMonthsWithSavings ?? 0) < 6 ? "text-yellow-600 dark:text-yellow-400" : "text-primary"}`}>
                    {(analysis.runwayMonthsWithSavings ?? 0) < 0 ? "Underfunded" : `${analysis.runwayMonthsWithSavings} months`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">After launch spend with all savings applied</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Risk Score */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <RiskScoreBar score={analysis.operationalRiskScore} />
            </CardContent>
          </Card>

          {/* Category Breakdown */}
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
                          <p className="text-xs text-muted-foreground font-normal">{config.description}</p>
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
                    <div className="overflow-x-auto">
                      <ItemTable items={items} showSaving={showSaving} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <p className="text-[11px] text-muted-foreground text-right">
            Analysis generated: {new Date(analysis.generatedAt).toLocaleString("en-GB")}
          </p>
        </>
      )}
    </div>
  );
}
