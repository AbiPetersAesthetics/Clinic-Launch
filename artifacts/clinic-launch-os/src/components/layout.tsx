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
} from "lucide-react";
import { formatGBP, formatPercent } from "@/lib/format";

const PROJECT_ID = 1;

function AbiPetersLogo() {
  return (
    <div className="select-none">
      <div
        className="text-sidebar-foreground leading-none tracking-tight"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.35rem", fontWeight: 500 }}
      >
        Abi Peters
      </div>
      <div className="text-sidebar-foreground/60 tracking-[0.22em] uppercase mt-0.5" style={{ fontSize: "0.6rem", fontWeight: 500 }}>
        Aesthetics
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
    <nav className="flex-1 p-4 space-y-0.5">
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

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/lifestyle", label: "Life Design", icon: Leaf },
    { href: "/financials", label: "Financials", icon: Calculator },
    { href: "/project", label: "Project Plan", icon: ListTodo },
    { href: "/properties", label: "Properties", icon: Building2 },
    { href: "/lease-strategy", label: "Lease Strategy", icon: Scale },
    { href: "/suppliers", label: "Suppliers", icon: ShoppingBag },
    { href: "/compliance", label: "Compliance", icon: ShieldCheck, badge: complianceScore !== null ? `${complianceScore}%` : undefined, badgeAlert: complianceScore !== null && complianceScore < 20 },
    { href: "/risk-register", label: "Risk Register", icon: AlertTriangle },
    { href: "/competition", label: "Competition Intel", icon: Target },
    { href: "/marketing", label: "Marketing", icon: Megaphone },
    { href: "/operational-model", label: "Operational Model", icon: Gauge },
    { href: "/decisions", label: "Decisions", icon: BookOpen },
    { href: "/optimisation", label: "Optimisation", icon: Zap },
    { href: "/franchise", label: "Franchise Model", icon: Network },
  ];

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

        <SidebarNav
          navItems={navItems}
          location={location}
          onNavigate={() => setMobileMenuOpen(false)}
        />

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
            <div className="flex items-center justify-between w-full min-w-0">
              <div className="flex items-center gap-3 md:gap-5 overflow-x-auto scrollbar-none flex-1 min-w-0">

                {/* ── Active property — most prominent item ── */}
                <div className="shrink-0 flex items-center gap-1.5">
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

                <div className="w-px h-7 bg-border shrink-0" />

                {/* ── Break-even revenue ── */}
                {dashboard.breakEvenRevenue != null && (
                  <>
                    <div className="shrink-0">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Break-even</p>
                      <p className="text-xs md:text-sm font-semibold mt-0.5 whitespace-nowrap">
                        {formatGBP(dashboard.breakEvenRevenue)}<span className="text-muted-foreground font-normal text-[10px]">/mo</span>
                      </p>
                    </div>
                    <div className="w-px h-7 bg-border shrink-0" />
                  </>
                )}

                {/* ── Net profit at selected scenario ── */}
                {(dashboard as any).selectedNetProfit != null && (
                  <>
                    <div className="shrink-0">
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
                    <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />
                  </>
                )}

                {/* ── VAT horizon (awareness, not alarm) ── */}
                {(dashboard as any).vatMonthsToThreshold != null && (
                  <>
                    <div className="shrink-0 hidden sm:block">
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">VAT Horizon</p>
                      <p className={`text-xs md:text-sm font-semibold mt-0.5 whitespace-nowrap ${(dashboard as any).vatHeadroomGbp <= 5000 ? "text-amber-600" : "text-foreground"}`}>
                        {(dashboard as any).vatHeadroomGbp <= 0
                          ? "Threshold reached"
                          : `~${(dashboard as any).vatMonthsToThreshold}mo`}
                      </p>
                    </div>
                    <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />
                  </>
                )}

                {/* ── Days to launch ── */}
                <div className="shrink-0 hidden sm:block">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Days to Launch</p>
                  <p className="text-xs md:text-sm font-semibold mt-0.5">{dashboard.daysToOpening ?? "TBD"}</p>
                </div>
                <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />

                {/* ── Readiness ── */}
                <div className="shrink-0 hidden sm:block">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Readiness</p>
                  <p className="text-xs md:text-sm font-semibold mt-0.5 text-primary">{formatPercent(dashboard.launchReadinessPercent)}</p>
                </div>
                <div className="w-px h-7 bg-border shrink-0 hidden md:block" />

                {/* ── Confidence ── */}
                <div className="shrink-0 hidden md:block">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${dashboard.projectConfidenceScore > 75 ? "bg-primary" : dashboard.projectConfidenceScore > 50 ? "bg-yellow-500" : "bg-destructive"}`} />
                    <p className="text-xs md:text-sm font-semibold">{dashboard.projectConfidenceScore}/100</p>
                  </div>
                </div>
                <div className="w-px h-7 bg-border shrink-0 hidden lg:block" />

                {/* ── CQC & Compliance ── */}
                <div className="shrink-0 hidden lg:block">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">CQC &amp; Compliance</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${(dashboard.complianceReadinessPercent ?? 0) >= 80 ? "bg-primary" : (dashboard.complianceReadinessPercent ?? 0) >= 40 ? "bg-yellow-500" : "bg-destructive"}`} />
                    <p className="text-xs md:text-sm font-semibold">{dashboard.complianceReadinessPercent ?? 0}%</p>
                  </div>
                </div>

              </div>
              {criticalFlags.length > 0 && (
                <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-2.5 py-1.5 rounded-full text-[10px] md:text-xs font-medium shrink-0 ml-3">
                  <AlertTriangle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="hidden sm:inline">{criticalFlags.length} Critical Risk{criticalFlags.length !== 1 ? "s" : ""}</span>
                  <span className="sm:hidden">{criticalFlags.length}!</span>
                </div>
              )}
            </div>
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
