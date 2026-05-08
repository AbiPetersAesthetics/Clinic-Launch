import { 
  useGetProjectDashboard, 
  getGetProjectDashboardQueryKey,
  useGetProjectCashflow,
  getGetProjectCashflowQueryKey,
  useGetRiskFlags,
  getGetRiskFlagsQueryKey
} from "@workspace/api-client-react";
import { formatGBP, formatPercent } from "@/lib/format";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const PROJECT_ID = 1;

export default function DashboardPage() {
  const [scenario, setScenario] = useState<"conservative" | "realistic" | "aggressive">("realistic");

  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) }
  });

  const { data: cashflow } = useGetProjectCashflow(PROJECT_ID, {
    query: { 
      enabled: true, 
      queryKey: getGetProjectCashflowQueryKey(PROJECT_ID, { scenario }) 
    }
  });

  const { data: risks } = useGetRiskFlags(PROJECT_ID, {
    query: { enabled: true, queryKey: getGetRiskFlagsQueryKey(PROJECT_ID) }
  });

  if (!dashboard) {
    return <div className="animate-pulse space-y-6">
      <div className="h-32 bg-card rounded-lg"></div>
      <div className="h-64 bg-card rounded-lg"></div>
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Command Centre</h2>
          <p className="text-muted-foreground mt-1">High-level overview of project health and financials.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Cost Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm text-muted-foreground">Current Selected</span>
                <span className="text-2xl font-bold">{formatGBP(dashboard.currentSelectedCost)}</span>
              </div>
              <div className="h-px w-full bg-border" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">Low</span>
                  <span className="font-medium">{formatGBP(dashboard.totalProjectCostLow)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Mid</span>
                  <span className="font-medium">{formatGBP(dashboard.totalProjectCostMid)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">High</span>
                  <span className="font-medium text-destructive">{formatGBP(dashboard.totalProjectCostHigh)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Runway Remaining</span>
                <span className="text-xl font-bold">{dashboard.cashRunwayMonths ? `${dashboard.cashRunwayMonths} months` : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monthly Burn Rate</span>
                <span className="text-lg font-medium text-destructive">{formatGBP(dashboard.monthlyBurnRate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Est. 1st Year Profit</span>
                <span className="text-lg font-medium text-primary">{formatGBP(dashboard.projectedFirstYearProfit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Overall Completion</span>
                  <span className="font-medium">{dashboard.completedTaskCount} / {dashboard.totalTaskCount}</span>
                </div>
                <Progress value={(dashboard.completedTaskCount / dashboard.totalTaskCount) * 100} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-destructive/5 rounded p-3 border border-destructive/10">
                  <div className="flex items-center gap-1.5 text-destructive mb-1">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Blocked</span>
                  </div>
                  <span className="text-xl font-bold text-destructive">{dashboard.blockedTaskCount}</span>
                </div>
                <div className="bg-orange-500/5 rounded p-3 border border-orange-500/10">
                  <div className="flex items-center gap-1.5 text-orange-600 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">High Risk</span>
                  </div>
                  <span className="text-xl font-bold text-orange-600">{dashboard.highRiskTaskCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Chart */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Projected Cashflow</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">12-month net cashflow projection</p>
          </div>
          <div className="flex bg-muted p-1 rounded-lg">
            {(["conservative", "realistic", "aggressive"] as const).map(s => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${scenario === s ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            {cashflow && cashflow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    formatter={(value: number) => [formatGBP(value), 'Net Cashflow']}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                  />
                  <Area type="monotone" dataKey="netCashflow" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No financial data available to project.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phase Progress */}
        <Card className="lg:col-span-2 shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Phase Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {dashboard.phaseProgress.map(phase => (
                <div key={phase.phaseId}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-foreground">{phase.phaseName}</span>
                    <span className="text-muted-foreground">{phase.completedTasks} / {phase.totalTasks} ({formatPercent(phase.percentComplete)})</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${phase.percentComplete === 100 ? 'bg-primary' : 'bg-primary/70'}`} 
                      style={{ width: `${phase.percentComplete}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Flags */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Active Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {risks && risks.length > 0 ? (
                risks.map((risk, i) => (
                  <div key={i} className={`p-3 rounded-lg border flex gap-3 ${
                    risk.level === 'critical' ? 'bg-destructive/5 border-destructive/20' : 'bg-orange-500/5 border-orange-500/20'
                  }`}>
                    {risk.level === 'critical' ? (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className={`text-sm font-semibold ${risk.level === 'critical' ? 'text-destructive' : 'text-orange-700'}`}>
                        {risk.category}
                      </h4>
                      <p className="text-sm text-foreground mt-0.5">{risk.message}</p>
                      {risk.taskTitle && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Task: {risk.taskTitle}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                  No active risk flags detected.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
