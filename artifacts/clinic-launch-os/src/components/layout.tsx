import { Link, useLocation } from "wouter";
import { 
  useGetProjectDashboard, 
  getGetProjectDashboardQueryKey 
} from "@workspace/api-client-react";
import { LayoutDashboard, ListTodo, Calculator, Building2, AlertTriangle } from "lucide-react";
import { formatGBP, formatPercent } from "@/lib/format";

const PROJECT_ID = 1;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: {
      enabled: true,
      queryKey: getGetProjectDashboardQueryKey(PROJECT_ID)
    }
  });

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/project", label: "Project Plan", icon: ListTodo },
    { href: "/financials", label: "Financials", icon: Calculator },
    { href: "/properties", label: "Properties", icon: Building2 },
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
                <item.icon className="w-4 h-4" />
                {item.label}
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
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Days to Launch</p>
                  <p className="text-sm font-semibold mt-0.5">{dashboard.daysToOpening ?? "TBD"}</p>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Readiness</p>
                  <p className="text-sm font-semibold mt-0.5 text-primary">{formatPercent(dashboard.launchReadinessPercent)}</p>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${dashboard.projectConfidenceScore > 75 ? 'bg-primary' : dashboard.projectConfidenceScore > 50 ? 'bg-yellow-500' : 'bg-destructive'}`} />
                    <p className="text-sm font-semibold">{dashboard.projectConfidenceScore}/100</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Selected Cost</p>
                  <p className="text-sm font-semibold mt-0.5">{formatGBP(dashboard.currentSelectedCost)}</p>
                </div>
              </div>
              {dashboard.criticalRiskFlagCount > 0 && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {dashboard.criticalRiskFlagCount} Critical Risks
                </div>
              )}
            </div>
          ) : (
            <div className="animate-pulse flex gap-8">
              <div className="w-24 h-8 bg-muted rounded"></div>
              <div className="w-24 h-8 bg-muted rounded"></div>
              <div className="w-24 h-8 bg-muted rounded"></div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
