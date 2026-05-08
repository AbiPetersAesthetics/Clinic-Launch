import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  useGetFinancialModel,
  getGetFinancialModelQueryKey,
  useUpsertFinancialModel,
  useCalculateFinancials,
  useGetProjectCashflow,
  getGetProjectCashflowQueryKey,
} from "@workspace/api-client-react";
import { formatGBP, formatPercent } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;

export default function FinancialsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [scenario, setScenario] = useState<"conservative" | "realistic" | "aggressive">("realistic");

  const { data: model, isLoading: isModelLoading } = useGetFinancialModel(PROJECT_ID, {
    query: { queryKey: getGetFinancialModelQueryKey(PROJECT_ID), enabled: true },
  });

  const { data: cashflow } = useGetProjectCashflow(PROJECT_ID, { scenario }, {
    query: { 
      queryKey: getGetProjectCashflowQueryKey(PROJECT_ID, { scenario }), 
      enabled: true 
    },
  });

  const upsertModel = useUpsertFinancialModel();
  const calculateFinancials = useCalculateFinancials();
  
  // To store calculation results
  const [calcResults, setCalcResults] = useState<import("@workspace/api-client-react").FinancialCalculation | null>(null);

  const form = useForm({
    defaultValues: {
      rentGbp: 0, ratesGbp: 0, utilitiesGbp: 0, internetGbp: 0, insuranceGbp: 0,
      accountantGbp: 0, softwareGbp: 0, wasteContractGbp: 0, cleanerGbp: 0,
      subscriptionsGbp: 0, financeRepaymentsGbp: 0,
      stockPercent: 0, marketingGbp: 0, staffingGbp: 0, commissionsPercent: 0, consumablesGbp: 0,
      averageClientValueGbp: 0, treatmentRoomsCount: 0, practitionerHoursPerDay: 0,
      workingDaysPerMonth: 0, conservativeOccupancyPercent: 0, realisticOccupancyPercent: 0,
      aggressiveOccupancyPercent: 0, repeatBookingRatePercent: 0, membershipRevenueGbp: 0,
      existingClinicRevenueGbp: 0, ownerDrawingsGbp: 0, runwaySavingsGbp: 0, personalSalaryNeedsGbp: 0,
    }
  });

  useEffect(() => {
    if (model) {
      form.reset({
        rentGbp: model.rentGbp || 0, ratesGbp: model.ratesGbp || 0, utilitiesGbp: model.utilitiesGbp || 0,
        internetGbp: model.internetGbp || 0, insuranceGbp: model.insuranceGbp || 0, accountantGbp: model.accountantGbp || 0,
        softwareGbp: model.softwareGbp || 0, wasteContractGbp: model.wasteContractGbp || 0, cleanerGbp: model.cleanerGbp || 0,
        subscriptionsGbp: model.subscriptionsGbp || 0, financeRepaymentsGbp: model.financeRepaymentsGbp || 0,
        stockPercent: model.stockPercent || 0, marketingGbp: model.marketingGbp || 0, staffingGbp: model.staffingGbp || 0,
        commissionsPercent: model.commissionsPercent || 0, consumablesGbp: model.consumablesGbp || 0,
        averageClientValueGbp: model.averageClientValueGbp || 0, treatmentRoomsCount: model.treatmentRoomsCount || 0,
        practitionerHoursPerDay: model.practitionerHoursPerDay || 0, workingDaysPerMonth: model.workingDaysPerMonth || 0,
        conservativeOccupancyPercent: model.conservativeOccupancyPercent || 0, realisticOccupancyPercent: model.realisticOccupancyPercent || 0,
        aggressiveOccupancyPercent: model.aggressiveOccupancyPercent || 0, repeatBookingRatePercent: model.repeatBookingRatePercent || 0,
        membershipRevenueGbp: model.membershipRevenueGbp || 0, existingClinicRevenueGbp: model.existingClinicRevenueGbp || 0,
        ownerDrawingsGbp: model.ownerDrawingsGbp || 0, runwaySavingsGbp: model.runwaySavingsGbp || 0, personalSalaryNeedsGbp: model.personalSalaryNeedsGbp || 0,
      });
      runCalculation();
    }
  }, [model]);

  // Re-run calculation when scenario changes
  useEffect(() => {
    if (model) runCalculation();
  }, [scenario]);

  const runCalculation = () => {
    calculateFinancials.mutate(
      { projectId: PROJECT_ID, data: { scenario } },
      {
        onSuccess: (data) => setCalcResults(data),
      }
    );
  };

  const onSubmit = (values: Record<string, number>) => {
    const processedValues = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, Number(v) || 0])
    );

    upsertModel.mutate(
      { projectId: PROJECT_ID, data: processedValues },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
          runCalculation();
          toast({ title: "Financial Model Saved", description: "Your assumptions have been updated." });
        },
      }
    );
  };

  const watchAllFields = form.watch();
  const totalFixedCosts = [
    'rentGbp', 'ratesGbp', 'utilitiesGbp', 'internetGbp', 'insuranceGbp', 
    'accountantGbp', 'softwareGbp', 'wasteContractGbp', 'cleanerGbp', 
    'subscriptionsGbp', 'financeRepaymentsGbp'
  ].reduce((sum, key) => sum + (Number(watchAllFields[key as keyof typeof watchAllFields]) || 0), 0);

  if (isModelLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-card rounded-lg w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-96 bg-card rounded-lg"></div>
          <div className="h-96 bg-card rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Modelling</h2>
          <p className="text-muted-foreground mt-1">Live forecasting based on dynamic assumptions.</p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg self-stretch md:self-auto">
          {(["conservative", "realistic", "aggressive"] as const).map(s => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`px-6 py-2 text-sm font-semibold rounded-md capitalize transition-all ${
                scenario === s 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="flex items-center justify-between sticky top-16 z-30 bg-background/95 py-4 border-b">
                <h3 className="font-semibold text-lg">Assumptions</h3>
                <Button type="submit" disabled={upsertModel.isPending} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  {upsertModel.isPending ? "Saving..." : "Save Model"}
                </Button>
              </div>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Fixed Monthly Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="rentGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Rent (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="ratesGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Business Rates (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="utilitiesGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Utilities (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="internetGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Internet (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="insuranceGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Insurance (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="accountantGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Accountant (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="softwareGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Software (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="wasteContractGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Waste (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cleanerGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Cleaner (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="subscriptionsGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Subscriptions (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="financeRepaymentsGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Finance Repayments (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="pt-4 border-t mt-4 flex justify-between items-center">
                    <span className="font-semibold text-sm">Total Fixed Costs</span>
                    <span className="font-bold">{formatGBP(totalFixedCosts)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Variable Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="stockPercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Stock (% of Rev)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="commissionsPercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Commissions (% of Rev)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="marketingGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Marketing (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="staffingGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Staffing (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="consumablesGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Consumables (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Revenue Drivers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="averageClientValueGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Avg Client Value (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="treatmentRoomsCount" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Treatment Rooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="practitionerHoursPerDay" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Hours/Day/Room</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="workingDaysPerMonth" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Working Days/Mo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="conservativeOccupancyPercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Conserv. Occ. %</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="realisticOccupancyPercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Realistic Occ. %</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="aggressiveOccupancyPercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Aggressive Occ. %</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="repeatBookingRatePercent" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Repeat Booking %</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="membershipRevenueGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Membership Rev (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ramp-Up / Existing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="existingClinicRevenueGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Existing Rev (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="ownerDrawingsGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Owner Drawings (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="runwaySavingsGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Runway Savings (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="personalSalaryNeedsGbp" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Personal Needs (£/mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

            </form>
          </Form>
        </div>

        {/* Right Column: Live Results */}
        <div className="lg:col-span-7 space-y-6 sticky top-6">
          <Card className="shadow-md border-primary/20 bg-card overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-primary capitalize">{scenario} Projection</h3>
                <p className="text-xs text-muted-foreground">Based on {calcResults?.occupancyUsedPercent}% occupancy</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Est. Monthly Profit</p>
                <p className={`text-3xl font-bold ${(calcResults?.monthlyNetProfit ?? 0) > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatGBP(calcResults?.monthlyNetProfit || 0)}
                </p>
              </div>
            </div>
            
            <CardContent className="p-6">
              {calcResults ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Rev</p>
                      <p className="text-xl font-semibold">{formatGBP(calcResults.monthlyRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Annual Rev</p>
                      <p className="text-xl font-semibold">{formatGBP(calcResults.annualRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Annual Profit</p>
                      <p className={`text-xl font-semibold ${calcResults.annualNetProfit > 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatGBP(calcResults.annualNetProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">EBITDA</p>
                      <p className="text-xl font-semibold">{formatGBP(calcResults.ebitda)}</p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border" />

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Fixed Costs</span>
                      <span className="font-medium">{formatGBP(calcResults.monthlyFixedCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Break-Even Revenue</span>
                      <span className="font-medium">{formatGBP(calcResults.breakEvenRevenueGbp)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Variable Costs</span>
                      <span className="font-medium">{formatGBP(calcResults.monthlyVariableCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Break-Even Occupancy</span>
                      <span className="font-medium">{formatPercent(calcResults.breakEvenOccupancyPercent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Monthly Costs</span>
                      <span className="font-medium">{formatGBP(calcResults.monthlyTotalCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash Runway</span>
                      <span className="font-medium">{calcResults.cashRunwayMonths} months</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex justify-center text-muted-foreground">
                  {calculateFinancials.isPending ? "Calculating..." : "Save assumptions to view projections."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">12-Month Cashflow Projection</CardTitle>
              <CardDescription>Visualising the journey to profitability.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-2">
                {cashflow && cashflow.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatGBP(value), name === 'revenue' ? 'Revenue' : name === 'fixedCosts' ? 'Fixed Costs' : name === 'variableCosts' ? 'Variable Costs' : 'Net Cashflow']}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                        contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                      />
                      <Area type="monotone" dataKey="revenue" stackId="2" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="fixedCosts" stackId="1" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#colorCost)" />
                      <Area type="monotone" dataKey="variableCosts" stackId="1" stroke="hsl(var(--orange-500))" strokeWidth={2} fill="url(#colorCost)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    No cashflow data available.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
