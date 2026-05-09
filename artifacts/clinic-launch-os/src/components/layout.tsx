import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
  useGetOptimisationAnalysis,
  getGetOptimisationAnalysisQueryKey,
} from "@workspace/api-client-react";
import {
  LayoutDashboard,
  ListTodo,
  Calculator,
  Building2,
  AlertTriangle,
  BookOpen,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { formatGBP, formatPercent } from "@/lib/format";

const PROJECT_ID = 1;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: {
      enabled: true,
      queryKey: getGetProjectDashboardQueryKey(PROJECT_ID),
    },
  });

  const { data: analysis } = useGetOptimisationAnalysis(PROJECT_ID, {
    query: {
      enabled: true,
      queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID),
      refetchInterval: 60_000,
      staleTime: 0,
    },
  });

  const smartRiskFlags = analysis?.smartRiskFlags ?? [];
  const criticalFlags = smartRiskFlags.filter(f => f.level === "critical");
  const warningFlags = smartRiskFlags.filter(f => f.level === "warning");
  // Critical flags cannot be dismissed — warning-only banners can be dismissed
  const canDismiss = criticalFlags.length === 0;
  const showBanner = smartRiskFlags.length > 0 && !(bannerDismissed && canDismiss);

  const complianceScore = dashboard?.complianceReadinessPercent ?? null;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/project", label: "Project Plan", icon: ListTodo },
    { href: "/financials", label: "Financials", icon: Calculator },
    { href: "/properties", label: "Properties", icon: Building2 },
    { href: "/decisions", label: "Decisions", icon: BookOpen },
    { href: "/optimisation", label: "Optimisation", icon: Zap },
    { href: "/compliance", label: "Compliance", icon: ShieldCheck, badge: complianceScore !== null ? `${complianceScore}%` : undefined, badgeAlert: complianceScore !== null && complianceScore < 20 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border shrink-0 flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="font-semibold text-lg text-foreground tracking-tight">Clinic Launch OS</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wide uppercase">Command Centre</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const nav = item as typeof item & { badge?: string; badgeAlert?: boolean };
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {nav.badge !== undefined && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                    nav.badgeAlert
                      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
                  }`}>
                    {nav.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top KPI Bar */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border h-16 flex items-center px-6 shrink-0">
          {dashboard ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-6 overflow-x-auto">
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Days to Launch</p>
                  <p className="text-sm font-semibold mt-0.5">{dashboard.daysToOpening ?? "TBD"}</p>
                </div>
                <div className="w-px h-8 bg-border shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Readiness</p>
                  <p className="text-sm font-semibold mt-0.5 text-primary">{formatPercent(dashboard.launchReadinessPercent)}</p>
                </div>
                <div className="w-px h-8 bg-border shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${dashboard.projectConfidenceScore > 75 ? "bg-primary" : dashboard.projectConfidenceScore > 50 ? "bg-yellow-500" : "bg-destructive"}`} />
                    <p className="text-sm font-semibold">{dashboard.projectConfidenceScore}/100</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-border shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CQC &amp; Compliance</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${(dashboard.complianceReadinessPercent ?? 0) >= 80 ? "bg-primary" : (dashboard.complianceReadinessPercent ?? 0) >= 40 ? "bg-yellow-500" : "bg-destructive"}`} />
                    <p className="text-sm font-semibold">{dashboard.complianceReadinessPercent ?? 0}%</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-border shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selected Cost</p>
                  <p className="text-sm font-semibold mt-0.5">{formatGBP(dashboard.currentSelectedCost)}</p>
                </div>
              </div>
              {criticalFlags.length > 0 && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ml-4">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {criticalFlags.length} Critical Risk{criticalFlags.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-pulse flex gap-8">
              <div className="w-24 h-8 bg-muted rounded" />
              <div className="w-24 h-8 bg-muted rounded" />
              <div className="w-24 h-8 bg-muted rounded" />
            </div>
          )}
        </header>

        {/* Smart Risk Banner — sourced from optimisation analysis */}
        {showBanner && (
          <div className={`border-b ${criticalFlags.length > 0 ? "bg-destructive/5 border-destructive/30" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800/30"}`}>
            <div className="px-6 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex items-start gap-2.5 flex-1 text-left"
                  onClick={() => setBannerExpanded(e => !e)}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${criticalFlags.length > 0 ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {criticalFlags.length > 0 && (
                        <span className="text-xs font-semibold text-destructive">
                          {criticalFlags.length} Critical Risk{criticalFlags.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {warningFlags.length > 0 && (
                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                          {warningFlags.length} Warning{warningFlags.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {!bannerExpanded && (
                        <span className="text-xs text-muted-foreground truncate">
                          {smartRiskFlags[0]?.message}
                        </span>
                      )}
                    </div>
                  </div>
                  {bannerExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>
                {canDismiss && (
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label="Dismiss risk banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {bannerExpanded && (
                <div className="mt-2 space-y-1.5 pl-6">
                  {smartRiskFlags.map((flag, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className={`text-[10px] uppercase font-bold tracking-wider shrink-0 mt-0.5 px-1.5 py-0.5 rounded ${
                        flag.level === "critical"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}>
                        {flag.level}
                      </span>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {flag.taskTitle && (
                          <Link
                            href={`/project?taskId=${flag.taskId}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {flag.taskTitle}:{" "}
                          </Link>
                        )}
                        {flag.message}
                      </div>
                    </div>
                  ))}
                  <div className="pt-1">
                    <Link href="/optimisation" className="text-xs text-primary underline underline-offset-2 hover:opacity-80">
                      View full Optimisation Analysis →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
