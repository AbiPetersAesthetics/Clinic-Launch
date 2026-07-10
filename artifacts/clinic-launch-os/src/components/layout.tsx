import { useState, useEffect } from "react";
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
  Network,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  MapPin,
  TrendingUp,
  Leaf,
  Gauge,
  Megaphone,
  Target,
  FileDown,
  Scale,
  ShoppingBag,
  Brain,
  Users,
} from "lucide-react";
import { formatGBP, formatPercent } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PROJECT_ID = 1;

function AbiPetersLogo() {
  return (
    <div className="select-none">
      <div
        className="text-sidebar-foreground leading-none tracking-tight"
        style={{ fontFamily: "var(--app-font-serif)", fontSize: "1.35rem", fontWeight: 500 }}
      >
        Abi Peters
      </div>
      <div className="text-sidebar-foreground/60 tracking-[0.22em] uppercase mt-0.5" style={{ fontSize: "0.6rem", fontWeight: 500 }}>
        Skin Clinic
      </div>
      <div className="text-sidebar-foreground/35 tracking-[0.18em] uppercase mt-0.5" style={{ fontSize: "0.55rem", fontWeight: 400 }}>
        Launch OS
      </div>
    </div>
  );
}

function SidebarNav({
  navItems,
  location,
  onNavigate,
}: {
  navItems: { href: string; label: string; icon: React.ElementType; badge?: string; badgeAlert?: boolean }[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="px-4 space-y-0.5">
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-primary/20 text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                item.badgeAlert
                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : "bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30"
              }`}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: {
      enabled: true,
      queryKey: getGetProjectDashboardQueryKey(PROJECT_ID),
      refetchInterval: 15_000,
      staleTime: 0,
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
  const canDismiss = criticalFlags.length === 0;
  const showBanner = smartRiskFlags.length > 0 && !(bannerDismissed && canDismiss);

  const complianceScore = dashboard?.complianceReadinessPercent ?? null;

  // Execution — what running the project to opening day actually needs
  const executionItems = [
    { href: "/", label: "Today", icon: LayoutDashboard },
    { href: "/project", label: "Plan & Timeline", icon: ListTodo },
    { href: "/financials", label: "Money", icon: Calculator },
    { href: "/people", label: "People & Capacity", icon: Users },
    { href: "/suppliers", label: "Suppliers & Tenders", icon: ShoppingBag },
    { href: "/compliance", label: "Compliance & CQC", icon: ShieldCheck, badge: complianceScore !== null ? `${complianceScore}%` : undefined, badgeAlert: complianceScore !== null && complianceScore < 20 },
    { href: "/risk-register", label: "Risks", icon: AlertTriangle },
    { href: "/marketing", label: "Marketing", icon: Megaphone },
  ];

  // Planning Archive — the go/no-go era tools, kept for reference
  const archiveItems = [
    { href: "/dashboard", label: "Go/No-Go Dashboard", icon: Gauge },
    { href: "/properties", label: "Properties", icon: Building2 },
    { href: "/lease-strategy", label: "Lease Strategy", icon: Scale },
    { href: "/competition", label: "Competition Intel", icon: Target },
    { href: "/risk-intelligence", label: "Risk Intelligence", icon: Brain },
    { href: "/operational-model", label: "Operational Model", icon: Gauge },
    { href: "/optimisation", label: "Optimisation", icon: Zap },
    { href: "/decisions", label: "Decisions", icon: BookOpen },
    { href: "/lifestyle", label: "Life Design", icon: Leaf },
    { href: "/franchise", label: "Franchise Model", icon: Network },
  ];

  const locationInArchive = archiveItems.some(i => i.href === location);
  const [archiveOpen, setArchiveOpen] = useState(locationInArchive);
  // Keep the archive open when navigating into one of its pages
  useEffect(() => {
    if (locationInArchive) setArchiveOpen(true);
  }, [locationInArchive]);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* ── Mobile overlay backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: always visible | mobile: slide-in drawer) ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar border-r border-sidebar-border
          transform transition-transform duration-300 ease-in-out
          md:static md:w-64 md:translate-x-0 md:z-auto md:shrink-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-sidebar-border flex items-start justify-between">
          <AbiPetersLogo />
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 -mr-1 -mt-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <SidebarNav
            navItems={executionItems}
            location={location}
            onNavigate={() => setMobileMenuOpen(false)}
          />

          <div>
            <button
              className="w-full flex items-center justify-between px-7 py-1.5 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
              onClick={() => setArchiveOpen(o => !o)}
              aria-expanded={archiveOpen}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em]">Planning Archive</span>
              {archiveOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {archiveOpen && (
              <SidebarNav
                navItems={archiveItems}
                location={location}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Bottom: export + location */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          <Link
            href="/export"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
              location === "/export"
                ? "bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground border-sidebar-border/60"
            }`}
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            Export Full Report PDF
          </Link>
          <p className="text-sidebar-foreground/30 text-[10px] tracking-[0.15em] uppercase">
            Winchester · 9A Jewry Street
          </p>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Sticky top bar ── */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border h-14 md:h-16 flex items-center px-4 md:px-6 shrink-0 gap-3">

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden text-foreground p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* KPI metrics */}
          {dashboard ? (
            <TooltipProvider delayDuration={350}>
            <div className="flex items-center justify-between w-full min-w-0">
              <div className="flex items-center gap-3 md:gap-5 overflow-x-auto scrollbar-none flex-1 min-w-0">

                {/* ── Active property ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 flex items-center gap-1.5 cursor-default">
                      <MapPin className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Property</p>
                        <p className="text-xs md:text-sm font-semibold mt-0.5 text-primary whitespace-nowrap">
                          {dashboard.activePropertyShortName ?? "None selected"}
                          {dashboard.activePropertyPostcode && (
                            <span className="text-muted-foreground font-normal ml-1 text-[10px] md:text-xs">{dashboard.activePropertyPostcode}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold">{dashboard.activePropertyAddress ?? dashboard.activePropertyShortName ?? "No property selected"}</p>
                    <p className="opacity-80 mt-0.5">Active property for this launch plan.</p>
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-7 bg-border shrink-0" />

                {/* ── Break-even revenue ── */}
                {dashboard.breakEvenRevenue != null && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="shrink-0 cursor-default">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Break-even</p>
                          <p className="text-xs md:text-sm font-semibold mt-0.5 whitespace-nowrap">
                            {formatGBP(dashboard.breakEvenRevenue)}<span className="text-muted-foreground font-normal text-[10px]">/mo</span>
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px]">
                        <p className="font-semibold">Break-even revenue</p>
                        <p className="opacity-80 mt-0.5">Monthly revenue needed to cover all fixed costs. Your realistic model projects {formatGBP((dashboard as any).realisticRevenue ?? 0)}/mo — {(dashboard as any).realisticRevenue >= dashboard.breakEvenRevenue ? "above" : "below"} break-even.</p>
                        {(dashboard as any).cashRunwayMonths != null && (
                          <p className="opacity-80 mt-1">Cash runway: {(dashboard as any).cashRunwayMonths >= 99 ? "Positive cashflow" : `~${(dashboard as any).cashRunwayMonths} months`}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <div className="w-px h-7 bg-border shrink-0" />
                  </>
                )}

                {/* ── Net profit at selected scenario ── */}
                {(dashboard as any).selectedNetProfit != null && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="shrink-0 cursor-default">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap capitalize">
                            Net ({(dashboard as any).selectedScenario ?? "Realistic"})
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TrendingUp className={`w-3 h-3 shrink-0 ${(dashboard as any).selectedNetProfit >= 0 ? "text-emerald-600" : "text-destructive"}`} />
                            <p className={`text-xs md:text-sm font-semibold whitespace-nowrap ${(dashboard as any).selectedNetProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {(dashboard as any).selectedNetProfit >= 0 ? "+" : ""}{formatGBP((dashboard as any).selectedNetProfit)}<span className="text-muted-foreground font-normal text-[10px]">/mo</span>
                            </p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px]">
                        <p className="font-semibold">Monthly net profit — {(dashboard as any).selectedScenario ?? "realistic"} scenario</p>
                        <p className="opacity-80 mt-0.5">After all fixed costs, variable costs, and stock at opening-day occupancy.</p>
                        {(dashboard as any).conservativeNetProfit != null && <p className="opacity-80 mt-1">Conservative: {formatGBP((dashboard as any).conservativeNetProfit)}/mo</p>}
                        {(dashboard as any).realisticNetProfit != null && <p className="opacity-80">Realistic: {formatGBP((dashboard as any).realisticNetProfit)}/mo</p>}
                        {(dashboard as any).aggressiveNetProfit != null && <p className="opacity-80">Aggressive: {formatGBP((dashboard as any).aggressiveNetProfit)}/mo</p>}
                      </TooltipContent>
                    </Tooltip>
                    <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />
                  </>
                )}

                {/* ── VAT horizon ── */}
                {(dashboard as any).vatMonthsToThreshold != null && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="shrink-0 hidden sm:block cursor-default">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">VAT Horizon</p>
                          <p className={`text-xs md:text-sm font-semibold mt-0.5 whitespace-nowrap ${(dashboard as any).vatHeadroomGbp <= 5000 ? "text-amber-600" : "text-foreground"}`}>
                            {(dashboard as any).vatHeadroomGbp <= 0
                              ? "Threshold reached"
                              : `~${(dashboard as any).vatMonthsToThreshold}mo`}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[230px]">
                        <p className="font-semibold">VAT registration horizon</p>
                        {(dashboard as any).vatHeadroomGbp <= 0
                          ? <p className="opacity-80 mt-0.5">Your combined Bedhampton + Winchester turnover is projected to exceed the £90,000 VAT threshold once Winchester opens. VAT registration will be required.</p>
                          : <p className="opacity-80 mt-0.5">~{(dashboard as any).vatMonthsToThreshold} months until you reach the £90,000 VAT threshold. £{Math.round((dashboard as any).vatHeadroomGbp).toLocaleString()} headroom remaining.</p>
                        }
                      </TooltipContent>
                    </Tooltip>
                    <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />
                  </>
                )}

                {/* ── Days to launch ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 hidden sm:block cursor-default">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Days to Launch</p>
                      <p className="text-xs md:text-sm font-semibold mt-0.5">{dashboard.daysToOpening ?? "TBD"}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold">Days to target opening</p>
                    <p className="opacity-80 mt-0.5">Target: {dashboard.targetOpeningDate ? new Date(dashboard.targetOpeningDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not set"}.</p>
                    {dashboard.daysToOpening != null && <p className="opacity-80">{dashboard.daysToOpening} days · ~{Math.round(dashboard.daysToOpening / 7)} weeks remaining.</p>}
                  </TooltipContent>
                </Tooltip>
                <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />

                {/* ── Readiness ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 hidden sm:block cursor-default">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Readiness</p>
                      <p className="text-xs md:text-sm font-semibold mt-0.5 text-primary">{formatPercent(dashboard.launchReadinessPercent)}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[210px]">
                    <p className="font-semibold">Launch readiness</p>
                    <p className="opacity-80 mt-0.5">{dashboard.completedTaskCount ?? 0} of {dashboard.totalTaskCount ?? 0} tasks marked complete across all active phases.</p>
                    {(dashboard as any).marketingReadinessPct != null && (
                      <p className="opacity-80 mt-1">Marketing: {(dashboard as any).marketingReadinessPct}% ready</p>
                    )}
                  </TooltipContent>
                </Tooltip>
                <div className="w-px h-7 bg-border shrink-0 hidden md:block" />

                {/* ── Confidence ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 hidden md:block cursor-default">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${dashboard.projectConfidenceScore > 75 ? "bg-primary" : dashboard.projectConfidenceScore > 50 ? "bg-yellow-500" : "bg-destructive"}`} />
                        <p className="text-xs md:text-sm font-semibold">{dashboard.projectConfidenceScore}/100</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="!bg-popover !text-popover-foreground border border-border shadow-lg p-3 w-[260px]">
                    {(() => {
                      const bd = (dashboard as any).confidenceBreakdown;
                      const pillars = bd ? [
                        { label: "Progress",          ...bd.progress },
                        { label: "Budget health",     ...bd.budget },
                        { label: "Financial viability",...bd.financial },
                        { label: "Risk posture",      ...bd.risk },
                        { label: "Compliance",        ...bd.compliance },
                      ] : [];
                      return (
                        <div className="text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">Launch Confidence</span>
                            <span className={`font-bold text-sm ${dashboard.projectConfidenceScore > 75 ? "text-primary" : dashboard.projectConfidenceScore > 50 ? "text-yellow-600" : "text-destructive"}`}>{dashboard.projectConfidenceScore}/100</span>
                          </div>
                          {pillars.map(p => (
                            <div key={p.label} className="mb-1.5">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-muted-foreground">{p.label}</span>
                                <span className="font-semibold tabular-nums shrink-0">{p.score}/{p.max}</span>
                              </div>
                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(p.score / p.max) * 100}%` }} />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{p.detail}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </TooltipContent>
                </Tooltip>
                <div className="w-px h-7 bg-border shrink-0 hidden lg:block" />

                {/* ── CQC & Compliance ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 hidden lg:block cursor-default">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">CQC &amp; Compliance</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${(dashboard.complianceReadinessPercent ?? 0) >= 80 ? "bg-primary" : (dashboard.complianceReadinessPercent ?? 0) >= 40 ? "bg-yellow-500" : "bg-destructive"}`} />
                        <p className="text-xs md:text-sm font-semibold">{dashboard.complianceReadinessPercent ?? 0}%</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p className="font-semibold">CQC &amp; Compliance readiness</p>
                    <p className="opacity-80 mt-0.5">{dashboard.complianceReadinessPercent ?? 0}% of applicable compliance items complete.</p>
                    {(dashboard as any).cqcNotStarted && <p className="opacity-80 mt-1">⚠ CQC registration not yet started.</p>}
                    <p className="opacity-70 mt-1 text-[10px]">Open Compliance in the menu to review all items.</p>
                  </TooltipContent>
                </Tooltip>

              </div>

              {/* ── Critical Risks badge ── */}
              {criticalFlags.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-2.5 py-1.5 rounded-full text-[10px] md:text-xs font-medium shrink-0 ml-3 cursor-default">
                      <AlertTriangle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      <span className="hidden sm:inline">{criticalFlags.length} Critical Risk{criticalFlags.length !== 1 ? "s" : ""}</span>
                      <span className="sm:hidden">{criticalFlags.length}!</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p className="font-semibold">{criticalFlags.length} open critical risk{criticalFlags.length !== 1 ? "s" : ""}</p>
                    <p className="opacity-80 mt-0.5">{criticalFlags[0]?.message}</p>
                    {criticalFlags.length > 1 && <p className="opacity-60 mt-0.5 text-[10px]">+{criticalFlags.length - 1} more — open Risk Register to review all.</p>}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            </TooltipProvider>
          ) : (
            <div className="animate-pulse flex gap-6">
              <div className="w-20 h-8 bg-muted rounded" />
              <div className="w-20 h-8 bg-muted rounded" />
              <div className="w-20 h-8 bg-muted rounded" />
            </div>
          )}
        </header>

        {/* ── Smart Risk Banner ── */}
        {showBanner && (
          <div className={`border-b ${criticalFlags.length > 0 ? "bg-destructive/5 border-destructive/30" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800/30"}`}>
            <div className="px-4 md:px-6 py-2.5">
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

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
