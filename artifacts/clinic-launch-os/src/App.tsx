import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

import TodayPage from "@/pages/today";
import DashboardPage from "@/pages/dashboard";
import ProjectPage from "@/pages/project";
import FinancialsPage from "@/pages/financials";
import PropertiesPage from "@/pages/properties";
import DecisionsPage from "@/pages/decisions";
import OptimisationPage from "@/pages/optimisation";
import CompliancePage from "@/pages/compliance";
import FranchisePage from "@/pages/franchise";
import LifestylePage from "@/pages/lifestyle";
import MarketingPage from "@/pages/marketing";
import OperationalModelPage from "@/pages/operational-model";
import MarketHubPage from "@/pages/market-hub";
import LeaseStrategyPage from "@/pages/lease-strategy";
import ExportPage from "@/pages/export";
import RiskRegisterPage from "@/pages/risk-register";
import SuppliersPage from "@/pages/suppliers";
import RiskIntelligencePage from "@/pages/risk-intelligence";
import TendersPage from "@/pages/tenders";
import DigestPage from "@/pages/digest";
import PeoplePage from "@/pages/people";
import BacklinksPage from "@/pages/backlinks";
import KitPage from "@/pages/kit";
import MoneyPlanPage from "@/pages/money-plan";
import CashLinePage from "@/pages/cash-line";
import CardsPage from "@/pages/cards";
import OwedPage from "@/pages/owed";
import AdsCommandPage from "@/pages/growth/ads";
import HomePage from "@/pages/home";
import { GrowthSection, PlanPage } from "@/pages/growth/section";
import { MoneyArea, GrowthArea, PatientsArea, ClinicArea } from "@/pages/areas";
import { BuildCashPage, StandsAlonePage, TakingsPage, ObligationsPage } from "@/pages/money/pages";
import { StudioPage, SearchPage } from "@/pages/growth/studio";
import { PathwayPage, FollowUpPage, DueBackPage, ReviewsPage } from "@/pages/patients/pages";
import { DiaryPage, StockPage } from "@/pages/clinic/pages";
import SourcesPage from "@/pages/sources";
import AbiPage from "@/pages/abi";
import BuildPage from "@/pages/build";
import ArchiveHomePage from "@/pages/archive-home";
import InboxPage from "@/pages/inbox";
import ActivityPage from "@/pages/activity";
import MorePage from "@/pages/more";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ color: "#dc2626" }}>Something went wrong</h2>
          <p style={{ color: "#6b7280" }}>An unexpected error occurred. Please refresh the page.</p>
          <pre style={{ background: "#f3f4f6", padding: "1rem", borderRadius: 8, fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {err.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#1d4ed8", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Login failed");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded-lg shadow-sm p-8">
        <p className="font-serif text-2xl text-foreground leading-none">Abi Peters</p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1.5">Skin Clinic · ALFRED</p>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-8">Password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then((j: { authenticated?: boolean }) => setState(j.authenticated ? "in" : "out"))
      .catch(() => setState("out"));
  }, []);

  if (state === "checking") {
    return <div className="min-h-screen bg-background" />;
  }
  if (state === "out") {
    return <LoginScreen onSuccess={() => setState("in")} />;
  }
  return <>{children}</>;
}

// An old address kept working: it moves to the new one, keeping any ?query and #hash.
function Moved({ to }: { to: string }) {
  const [, go] = useLocation();
  useEffect(() => {
    const [path, hash] = to.split("#");
    go(`${path}${window.location.search}${hash ? `#${hash}` : window.location.hash}`, { replace: true });
  }, [to, go]);
  return null;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={HomePage} />

        <Route path="/money" component={MoneyArea} />
        <Route path="/money/build-cash" component={BuildCashPage} />
        <Route path="/money/stands-alone" component={StandsAlonePage} />
        <Route path="/money/takings" component={TakingsPage} />
        <Route path="/money/obligations" component={ObligationsPage} />
        <Route path="/money/cash-line" component={CashLinePage} />
        <Route path="/money/plan" component={MoneyPlanPage} />

        <Route path="/growth" component={GrowthArea} />
        <Route path="/growth/ads" component={AdsCommandPage} />
        <Route path="/growth/ads/every-ad">{() => <GrowthSection id="every-ad" />}</Route>
        <Route path="/growth/ads/last-14-days">{() => <GrowthSection id="last-14-days" />}</Route>
        <Route path="/growth/ads/simulator">{() => <GrowthSection id="simulator" />}</Route>
        <Route path="/growth/ads/how-it-works">{() => <GrowthSection id="how-it-works" />}</Route>
        <Route path="/growth/plan" component={PlanPage} />
        <Route path="/growth/studio" component={StudioPage} />
        <Route path="/growth/search" component={SearchPage} />
        <Route path="/growth/market" component={MarketHubPage} />

        <Route path="/patients" component={PatientsArea} />
        <Route path="/patients/pathway" component={PathwayPage} />
        <Route path="/patients/follow-up" component={FollowUpPage} />
        <Route path="/patients/due-back" component={DueBackPage} />
        <Route path="/patients/reviews" component={ReviewsPage} />

        <Route path="/clinic" component={ClinicArea} />
        <Route path="/clinic/diary" component={DiaryPage} />
        <Route path="/clinic/team" component={PeoplePage} />
        <Route path="/clinic/compliance" component={CompliancePage} />
        <Route path="/clinic/stock" component={StockPage} />
        <Route path="/clinic/opening" component={ProjectPage} />

        <Route path="/more" component={MorePage} />
        <Route path="/inbox" component={InboxPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/sources" component={SourcesPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/abi" component={AbiPage} />
        <Route path="/build" component={BuildPage} />

        {/* The archive, under More: nothing deleted */}
        <Route path="/archive/home-tiles" component={ArchiveHomePage} />
        <Route path="/archive/ads-ideas">{() => <GrowthSection id="ideas" />}</Route>
        <Route path="/archive/launch-marketing" component={MarketingPage} />
        <Route path="/archive/cards" component={CardsPage} />
        <Route path="/archive/owed" component={OwedPage} />
        <Route path="/opening-board">{() => <GrowthSection id="opening" />}</Route>
        <Route path="/today" component={TodayPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/financials" component={FinancialsPage} />
        <Route path="/properties" component={PropertiesPage} />
        <Route path="/decisions" component={DecisionsPage} />
        <Route path="/optimisation" component={OptimisationPage} />
        <Route path="/franchise" component={FranchisePage} />
        <Route path="/lifestyle" component={LifestylePage} />
        <Route path="/operational-model" component={OperationalModelPage} />
        <Route path="/backlinks" component={BacklinksPage} />
        <Route path="/kit" component={KitPage} />
        <Route path="/lease-strategy" component={LeaseStrategyPage} />
        <Route path="/export" component={ExportPage} />
        <Route path="/risk-register" component={RiskRegisterPage} />
        <Route path="/suppliers" component={SuppliersPage} />
        <Route path="/tenders" component={TendersPage} />
        <Route path="/digest" component={DigestPage} />
        <Route path="/risk-intelligence" component={RiskIntelligencePage} />

        {/* Old addresses, kept working */}
        <Route path="/build-cash">{() => <Moved to="/money/build-cash" />}</Route>
        <Route path="/cash-line">{() => <Moved to="/money/cash-line" />}</Route>
        <Route path="/money-plan">{() => <Moved to="/money/plan" />}</Route>
        <Route path="/cards">{() => <Moved to="/money/obligations" />}</Route>
        <Route path="/money/cards">{() => <Moved to="/money/obligations" />}</Route>
        <Route path="/owed">{() => <Moved to="/money/obligations" />}</Route>
        <Route path="/money/owed">{() => <Moved to="/money/obligations" />}</Route>
        <Route path="/ads-board">{() => <Moved to="/growth/ads" />}</Route>
        <Route path="/ads-pathway">{() => <Moved to="/patients/pathway" />}</Route>
        <Route path="/growth/ads/leads">{() => <Moved to="/patients/pathway" />}</Route>
        <Route path="/ads-ideas">{() => <Moved to="/growth/plan#ideas" />}</Route>
        <Route path="/growth/ideas">{() => <Moved to="/growth/plan#ideas" />}</Route>
        <Route path="/growth/last-14-days">{() => <Moved to="/growth/ads/last-14-days" />}</Route>
        <Route path="/growth/simulator">{() => <Moved to="/growth/ads/simulator" />}</Route>
        <Route path="/growth/how-it-works">{() => <Moved to="/growth/ads/how-it-works" />}</Route>
        <Route path="/social-board">{() => <Moved to="/growth/studio" />}</Route>
        <Route path="/seo-board">{() => <Moved to="/growth/search" />}</Route>
        <Route path="/market">{() => <Moved to="/growth/market" />}</Route>
        <Route path="/competition">{() => <Moved to="/growth/market#competitors" />}</Route>
        <Route path="/marketing">{() => <Moved to="/archive/launch-marketing" />}</Route>
        <Route path="/growth/marketing">{() => <Moved to="/archive/launch-marketing" />}</Route>
        <Route path="/clinic-board">{() => <Moved to="/clinic/diary" />}</Route>
        <Route path="/clinic/board">{() => <Moved to="/clinic/diary" />}</Route>
        <Route path="/people">{() => <Moved to="/clinic/team" />}</Route>
        <Route path="/clinic/people">{() => <Moved to="/clinic/team" />}</Route>
        <Route path="/compliance">{() => <Moved to="/clinic/compliance" />}</Route>
        <Route path="/project">{() => <Moved to="/clinic/opening" />}</Route>
        <Route path="/clinic/plan">{() => <Moved to="/clinic/opening" />}</Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </WouterRouter>
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
