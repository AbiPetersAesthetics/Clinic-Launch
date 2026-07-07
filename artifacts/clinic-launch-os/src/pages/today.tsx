import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
  useListProperties,
  getListPropertiesQueryKey,
  useGetProjectTimeline,
  getGetProjectTimelineQueryKey,
  useGetSuppliersSummary,
  getGetSuppliersSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  Flag,
  CircleDollarSign,
} from "lucide-react";
import { formatGBP } from "@/lib/format";

const PROJECT_ID = 1;

type AnyTask = {
  id: number;
  title: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  isNonNegotiable?: boolean;
  isCriticalRisk?: boolean;
  riskLevel?: string;
  selectedCost?: number;
};

type AnyPhase = {
  id: number;
  name: string;
  sortOrder: number;
  tasks?: AnyTask[];
};

function fmtDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", opts);
}

export default function TodayPage() {
  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: { queryKey: getGetProjectDashboardQueryKey(PROJECT_ID), refetchInterval: 30_000 },
  });
  // Task statuses are stored per-property (9a) as overrides — fetch the merged
  // view for the active property, exactly as the Plan page does.
  const { data: properties } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID) },
  });
  const activePropertyId = properties?.find(p => p.isActiveForProject)?.id ?? null;
  const phasesUrl = activePropertyId
    ? `/api/projects/${PROJECT_ID}/phases-with-tasks?propertyId=${activePropertyId}`
    : `/api/projects/${PROJECT_ID}/phases-with-tasks`;
  const { data: phasesRaw } = useQuery<unknown>({
    queryKey: [phasesUrl],
    queryFn: async () => {
      const r = await fetch(phasesUrl);
      if (!r.ok) throw new Error("phases fetch failed");
      return r.json();
    },
  });
  const { data: timeline } = useGetProjectTimeline(PROJECT_ID, {
    query: { queryKey: getGetProjectTimelineQueryKey(PROJECT_ID) },
  });
  const { data: suppliers } = useGetSuppliersSummary(PROJECT_ID, {
    query: { queryKey: getGetSuppliersSummaryQueryKey(PROJECT_ID) },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const phases: AnyPhase[] = ((phasesRaw as unknown as AnyPhase[]) ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allTasks: (AnyTask & { phaseName: string })[] = phases.flatMap(p =>
    (p.tasks ?? []).map(t => ({ ...t, phaseName: p.name })),
  );

  // Current phase = earliest phase that still has open tasks
  const currentPhase = phases.find(p => (p.tasks ?? []).some(t => t.status !== "complete" && t.status !== "deferred"));

  // Overdue = has a due date in the past and isn't finished
  const overdue = allTasks
    .filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== "complete" && t.status !== "deferred")
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const inProgress = allTasks.filter(t => t.status === "in_progress" && !overdue.some(o => o.id === t.id));

  // Up next = non-negotiable, unstarted tasks of the current phase
  const upNext = (currentPhase?.tasks ?? [])
    .filter(t => t.status === "not_started" && t.isNonNegotiable)
    .slice(0, 5)
    .map(t => ({ ...t, phaseName: currentPhase!.name }));

  const attention = [...overdue.map(t => ({ ...t, kind: "overdue" as const })),
                     ...inProgress.map(t => ({ ...t, kind: "in_progress" as const })),
                     ...upNext.map(t => ({ ...t, kind: "up_next" as const }))].slice(0, 8);

  // Timeline: next milestone = end of current phase (phases are date-scheduled back from opening)
  const tlPhases = (timeline as any)?.phases ?? [];
  const tlCurrent = tlPhases.find((p: any) => p.endDate && new Date(p.endDate) >= today);

  const daysToOpen = dashboard?.daysToOpening ?? null;
  const readinessPct = dashboard?.launchReadinessPercent ?? 0;
  const doneCount = dashboard?.completedTaskCount ?? 0;
  const totalCount = dashboard?.totalTaskCount ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Today</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}Winchester launch
          </p>
        </div>
        <Link href="/digest" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 mt-2">
          Weekly brief <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Hero strip: countdown + phase + readiness ── */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 md:divide-x md:divide-border">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Opening in</p>
              <p className="font-serif text-5xl mt-2 text-foreground">
                {daysToOpen ?? "—"}<span className="text-xl text-muted-foreground ml-2">days</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Target {fmtDate(dashboard?.targetOpeningDate, { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="md:pl-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Phase now</p>
              <p className="font-serif text-2xl mt-2 text-foreground leading-snug">{currentPhase?.name ?? "—"}</p>
              {tlCurrent && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Phase window closes {fmtDate(tlCurrent.endDate)}
                </p>
              )}
            </div>
            <div className="md:pl-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Readiness</p>
              <p className="font-serif text-2xl mt-2 text-foreground">{doneCount} <span className="text-muted-foreground text-lg">of {totalCount} tasks done</span></p>
              <Progress value={readinessPct} className="mt-3 h-1.5" />
              <p className="text-xs text-muted-foreground mt-1.5">{readinessPct}% complete</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Needs attention ── */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-foreground">Needs attention</h2>
              <Link href="/project" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Full plan <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing urgent — nothing overdue or in progress.</p>
            ) : (
              <ul className="divide-y divide-border">
                {attention.map(t => (
                  <li key={`${t.kind}-${t.id}`} className="py-2.5 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {t.kind === "overdue" ? (
                        <Badge variant="destructive" className="text-[9px] uppercase tracking-wider">Overdue</Badge>
                      ) : t.kind === "in_progress" ? (
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">In progress</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">Up next</Badge>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/project?taskId=${t.id}`} className="text-sm font-medium text-foreground hover:underline block truncate">
                        {t.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {t.phaseName}
                        {t.owner ? ` · ${t.owner}` : ""}
                        {t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ""}
                      </p>
                    </div>
                    {t.isCriticalRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-1" />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Tenders & quotes */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" /> Tenders
                </h2>
                <Link href="/suppliers" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suppliers engaged</span>
                  <span className="font-semibold">{suppliers?.totalSuppliers ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contracted</span>
                  <span className="font-semibold">{suppliers?.contractedCount ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Committed</span>
                  <span className="font-semibold">{suppliers ? formatGBP(suppliers.totalCommittedGbp) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quoted pipeline</span>
                  <span className="font-semibold">{suppliers ? formatGBP(suppliers.totalPipelineGbp) : "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Money snapshot */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
                  <CircleDollarSign className="w-4 h-4 text-muted-foreground" /> Money
                </h2>
                <Link href="/financials" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned project cost</span>
                  <span className="font-semibold">{(dashboard as any)?.currentSelectedCost != null ? formatGBP((dashboard as any).currentSelectedCost) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Break-even</span>
                  <span className="font-semibold">{dashboard?.breakEvenRevenue != null ? `${formatGBP(dashboard.breakEvenRevenue)}/mo` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT horizon</span>
                  <span className="font-semibold">{(dashboard as any)?.vatHeadroomGbp <= 0 ? "Threshold reached" : `~${(dashboard as any)?.vatMonthsToThreshold ?? "—"}mo`}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Phase progress */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-serif text-xl text-foreground flex items-center gap-2 mb-3">
                <Flag className="w-4 h-4 text-muted-foreground" /> Phases
              </h2>
              <ul className="space-y-2.5">
                {phases.map(p => {
                  const ts = p.tasks ?? [];
                  const done = ts.filter(t => t.status === "complete").length;
                  const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
                  const isCurrent = p.id === currentPhase?.id;
                  return (
                    <li key={p.id}>
                      <div className="flex justify-between items-baseline gap-2">
                        <span className={`text-xs truncate ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{p.name}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{done}/{ts.length}</span>
                      </div>
                      <Progress value={pct} className="h-1 mt-1" />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
