import { Switch, Route, Router as WouterRouter } from "wouter";
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
import CompetitionPage from "@/pages/competition";
import LeaseStrategyPage from "@/pages/lease-strategy";
import ExportPage from "@/pages/export";
import RiskRegisterPage from "@/pages/risk-register";
import SuppliersPage from "@/pages/suppliers";
import RiskIntelligencePage from "@/pages/risk-intelligence";
import TendersPage from "@/pages/tenders";
import DigestPage from "@/pages/digest";
import PeoplePage from "@/pages/people";

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
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1.5">Skin Clinic · Launch OS</p>
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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={TodayPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/project" component={ProjectPage} />
        <Route path="/financials" component={FinancialsPage} />
        <Route path="/properties" component={PropertiesPage} />
        <Route path="/decisions" component={DecisionsPage} />
        <Route path="/optimisation" component={OptimisationPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/franchise" component={FranchisePage} />
        <Route path="/lifestyle" component={LifestylePage} />
        <Route path="/marketing" component={MarketingPage} />
        <Route path="/operational-model" component={OperationalModelPage} />
        <Route path="/competition" component={CompetitionPage} />
        <Route path="/lease-strategy" component={LeaseStrategyPage} />
        <Route path="/export" component={ExportPage} />
        <Route path="/risk-register" component={RiskRegisterPage} />
        <Route path="/suppliers" component={SuppliersPage} />
        <Route path="/tenders" component={TendersPage} />
        <Route path="/digest" component={DigestPage} />
        <Route path="/people" component={PeoplePage} />
        <Route path="/risk-intelligence" component={RiskIntelligencePage} />
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
