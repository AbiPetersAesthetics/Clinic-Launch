import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import { Component, type ErrorInfo, type ReactNode } from "react";

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
import ExportPage from "@/pages/export";
import RiskRegisterPage from "@/pages/risk-register";

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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
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
        <Route path="/export" component={ExportPage} />
        <Route path="/risk-register" component={RiskRegisterPage} />
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
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
