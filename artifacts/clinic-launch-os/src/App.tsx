import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/auth";
import LoginScreen from "@/components/login-screen";

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

const queryClient = new QueryClient();

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
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AuthGate() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginScreen />;
  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
