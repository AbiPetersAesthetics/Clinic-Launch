import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Target, Activity, Cpu,
  AlertTriangle, CheckCircle2, Sparkles, Clock, Building2,
  UserCheck, WifiOff, Receipt, BarChart3, RefreshCw,
  Zap, Heart, ChevronRight, Star, Eye, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { formatGBP } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemandConfig {
  metaLeads: number;
  googleLeads: number;
  organicEnquiries: number;
  referralEnquiries: number;
  bookingRatePct: number;
  showRatePct: number;
  costPerLead: number;
}

interface ConversionConfig {
  consultConversionPct: number;
  existingClientConversionPct: number;
  upsellAcceptancePct: number;
  membershipTakeupPct: number;
  financeOptionPct: number;
}

interface CapacityConfig {
  treatmentRooms: number;
  clinicianHoursPerWeek: number;
  openDaysPerWeek: number;
  avgAppointmentMins: number;
  bufferMins: number;
  lunchBreakMins: number;
  adminDailyMins: number;
  dnaPct: number;
}

interface RetentionConfig {
  repeatBookingRatePct: number;
  avgRepeatIntervalMonths: number;
  annualRevisitFrequency: number;
  membershipRetentionPct: number;
  dormantThresholdMonths: number;
}

interface TreatmentType {
  id: string;
  name: string;
  pct: number;
  avgValue: number;
  durationMins: number;
  marginPct: number;
  repeatMonths: number;
}

type StressKey =
  | "slow_ramp" | "low_leads" | "poor_conversion"
  | "abi_unavailable" | "weak_winter" | "ad_failure"
  | "increased_rent" | "early_vat";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DEMAND: DemandConfig = {
  metaLeads: 35, googleLeads: 20, organicEnquiries: 12,
  referralEnquiries: 8, bookingRatePct: 62, showRatePct: 78, costPerLead: 18,
};

const DEFAULT_CONVERSION: ConversionConfig = {
  consultConversionPct: 68, existingClientConversionPct: 85,
  upsellAcceptancePct: 32, membershipTakeupPct: 12, financeOptionPct: 18,
};

const DEFAULT_CAPACITY: CapacityConfig = {
  treatmentRooms: 2, clinicianHoursPerWeek: 38, openDaysPerWeek: 5,
  avgAppointmentMins: 45, bufferMins: 10, lunchBreakMins: 30,
  adminDailyMins: 60, dnaPct: 8,
};

const DEFAULT_RETENTION: RetentionConfig = {
  repeatBookingRatePct: 62, avgRepeatIntervalMonths: 4,
  annualRevisitFrequency: 3.2, membershipRetentionPct: 78, dormantThresholdMonths: 6,
};

const DEFAULT_TREATMENTS: TreatmentType[] = [
  { id: "aw", name: "Anti-Wrinkle",       pct: 35, avgValue: 280, durationMins: 30, marginPct: 74, repeatMonths: 4 },
  { id: "fi", name: "Filler",             pct: 22, avgValue: 490, durationMins: 45, marginPct: 68, repeatMonths: 9 },
  { id: "pn", name: "Polynucleotides",    pct: 12, avgValue: 380, durationMins: 45, marginPct: 65, repeatMonths: 3 },
  { id: "sb", name: "Skin Boosters",      pct: 10, avgValue: 320, durationMins: 30, marginPct: 70, repeatMonths: 3 },
  { id: "mn", name: "Microneedling",      pct:  8, avgValue: 250, durationMins: 60, marginPct: 76, repeatMonths: 6 },
  { id: "fs", name: "Facials / Skin",     pct:  9, avgValue: 145, durationMins: 60, marginPct: 79, repeatMonths: 2 },
  { id: "sr", name: "Skincare Retail",    pct:  4, avgValue:  88, durationMins:  5, marginPct: 38, repeatMonths: 2 },
];

const STRESS_SCENARIOS: { key: StressKey; label: string; desc: string; leadsMulti?: number; convMulti?: number; revenueMulti?: number; costAdd?: number }[] = [
  { key: "slow_ramp",        label: "Slower ramp",          desc: "Occupancy builds 40% slower — no waiting list on day one",   revenueMulti: 0.70 },
  { key: "low_leads",        label: "−20% leads",           desc: "All channels underperform; reduced paid ad performance",      leadsMulti: 0.80 },
  { key: "poor_conversion",  label: "Poor conversion",      desc: "Consultation conversion drops 15 percentage points",         convMulti: 0.78 },
  { key: "abi_unavailable",  label: "2 weeks off",          desc: "Clinician unavailable — illness, family, or holiday",        revenueMulti: 0.54 },
  { key: "weak_winter",      label: "Weak Q1",              desc: "January & February 30% below forecast — seasonal dip",       revenueMulti: 0.70 },
  { key: "ad_failure",       label: "Ad account failure",   desc: "Meta & Google ads suspended for 4 weeks",                    leadsMulti: 0.46 },
  { key: "increased_rent",   label: "+£500/mo rent",        desc: "Rent renegotiated upward at lease break clause",             costAdd: 500 },
  { key: "early_vat",        label: "Early VAT",            desc: "VAT threshold hit in month 4 — 20% revenue hit sooner",      revenueMulti: 0.833 },
];

const PIE_COLOURS = ["#6366f1","#22c55e","#f59e0b","#3b82f6","#ec4899","#14b8a6","#f97316"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, min = 0, max, step = 1, suffix = "",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-20 text-right text-xs tabular-nums"
        />
        {suffix && <span className="text-xs text-muted-foreground w-4">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-medium leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, status }: { label: string; value: string; sub?: string; status: "green" | "amber" | "red" | "neutral" }) {
  const colours = { green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", red: "text-destructive", neutral: "text-foreground" };
  const dotColours = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", neutral: "bg-muted-foreground" };
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5 min-w-[130px] border-r border-border/40 last:border-0">
      <div className="flex items-center gap-1.5">
        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColours[status])} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium whitespace-nowrap">{label}</span>
      </div>
      <span className={cn("text-lg font-bold tabular-nums leading-tight", colours[status])}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OperationalModelPage() {
  const [demand, setDemand]       = useState<DemandConfig>(DEFAULT_DEMAND);
  const [conversion, setConversion] = useState<ConversionConfig>(DEFAULT_CONVERSION);
  const [capacity, setCapacity]   = useState<CapacityConfig>(DEFAULT_CAPACITY);
  const [retention, setRetention] = useState<RetentionConfig>(DEFAULT_RETENTION);
  const [treatments, setTreatments] = useState<TreatmentType[]>(DEFAULT_TREATMENTS);
  const [activeStresses, setActiveStresses] = useState<Set<StressKey>>(new Set());

  function setD<K extends keyof DemandConfig>(k: K, v: DemandConfig[K]) { setDemand(p => ({ ...p, [k]: v })); }
  function setCv<K extends keyof ConversionConfig>(k: K, v: ConversionConfig[K]) { setConversion(p => ({ ...p, [k]: v })); }
  function setCp<K extends keyof CapacityConfig>(k: K, v: CapacityConfig[K]) { setCapacity(p => ({ ...p, [k]: v })); }
  function setR<K extends keyof RetentionConfig>(k: K, v: RetentionConfig[K]) { setRetention(p => ({ ...p, [k]: v })); }

  function toggleStress(key: StressKey) {
    setActiveStresses(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function updateTreatment(id: string, field: keyof TreatmentType, value: number) {
    setTreatments(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  // ── Core computations ──────────────────────────────────────────────────────

  const m = useMemo(() => {
    // Demand
    const totalLeads      = demand.metaLeads + demand.googleLeads + demand.organicEnquiries + demand.referralEnquiries;
    const consultBooked   = Math.round(totalLeads * demand.bookingRatePct / 100);
    const consultAttended = Math.round(consultBooked * demand.showRatePct / 100);
    const newClients      = Math.round(consultAttended * conversion.consultConversionPct / 100);
    const paidLeadSpend   = (demand.metaLeads + demand.googleLeads) * demand.costPerLead;
    const cac             = newClients > 0 ? Math.round(paidLeadSpend / newClients) : 0;

    // Treatment mix
    const totalPct         = treatments.reduce((s, t) => s + t.pct, 0) || 1;
    const weightedValue    = treatments.reduce((s, t) => s + (t.pct / totalPct) * t.avgValue, 0);
    const weightedMargin   = treatments.reduce((s, t) => s + (t.pct / totalPct) * t.marginPct, 0);
    const weightedDuration = treatments.reduce((s, t) => s + (t.pct / totalPct) * t.durationMins, 0);

    // Retention & returning
    const returningClients    = Math.round(newClients * retention.repeatBookingRatePct / 100);
    const totalMonthlyAppts   = newClients + returningClients;
    const monthlyNewRevenue   = Math.round(newClients * weightedValue);
    const monthlyTotalRevenue = Math.round(totalMonthlyAppts * weightedValue);
    const annualRevenue       = monthlyTotalRevenue * 12;

    // LTV (3-year)
    const ltv = Math.round(weightedValue * retention.annualRevisitFrequency * 3);

    // Capacity
    const hoursPerDay     = capacity.clinicianHoursPerWeek / capacity.openDaysPerWeek;
    const availMinsPerDay = hoursPerDay * 60 - capacity.lunchBreakMins - capacity.adminDailyMins;
    const slotMins        = capacity.avgAppointmentMins + capacity.bufferMins;
    const slotsPerDayPerRoom = Math.max(0, Math.floor(availMinsPerDay / slotMins));
    const rawMonthlySlots = Math.round(slotsPerDayPerRoom * capacity.openDaysPerWeek * 4.33 * capacity.treatmentRooms);
    const effectiveSlots  = Math.round(rawMonthlySlots * (1 - capacity.dnaPct / 100));
    const occupancyPct    = effectiveSlots > 0 ? Math.min((totalMonthlyAppts / effectiveSlots) * 100, 100) : 0;
    const unusedSlots     = Math.max(0, effectiveSlots - totalMonthlyAppts);
    const revenueCeiling  = Math.round(effectiveSlots * weightedValue);
    const revenueGap      = revenueCeiling - monthlyTotalRevenue;
    const daysToFullCapacity = occupancyPct > 0 && occupancyPct < 100
      ? Math.round((100 - occupancyPct) / (occupancyPct / 30))
      : occupancyPct >= 100 ? 0 : 999;

    // 12-month retention cohort simulation
    const cohortData: { month: string; new: number; returning: number; total: number }[] = [];
    let runningBase = 0;
    for (let i = 1; i <= 12; i++) {
      const rampMultiplier = Math.min(1, i / 3); // ramp over first 3 months
      const monthNew = Math.round(newClients * rampMultiplier);
      runningBase += monthNew;
      const monthReturning = Math.round(runningBase * (retention.repeatBookingRatePct / 100) * (1 / retention.avgRepeatIntervalMonths));
      cohortData.push({
        month: `M${i}`,
        new: monthNew,
        returning: Math.min(monthReturning, runningBase - monthNew),
        total: monthNew + Math.min(monthReturning, runningBase - monthNew),
      });
    }

    // Stress testing
    let stressedRevenue  = monthlyTotalRevenue;
    let stressedLeads    = totalLeads;
    let stressedConv     = conversion.consultConversionPct;
    let extraMonthlyCost = 0;

    activeStresses.forEach(key => {
      const sc = STRESS_SCENARIOS.find(s => s.key === key);
      if (!sc) return;
      if (sc.leadsMulti)   stressedLeads    = Math.round(stressedLeads * sc.leadsMulti);
      if (sc.convMulti)    stressedConv     = stressedConv * sc.convMulti;
      if (sc.revenueMulti) stressedRevenue  = Math.round(stressedRevenue * sc.revenueMulti);
      if (sc.costAdd)      extraMonthlyCost += sc.costAdd;
    });

    const stressedNewClients = Math.round(
      stressedLeads * demand.bookingRatePct / 100 * demand.showRatePct / 100 * stressedConv / 100
    );
    const stressedTotalAppts   = stressedNewClients + Math.round(stressedNewClients * retention.repeatBookingRatePct / 100);
    const stressedFinalRevenue = Math.round(Math.min(stressedRevenue, stressedTotalAppts * weightedValue));
    const stressRevenueLoss    = monthlyTotalRevenue - stressedFinalRevenue + extraMonthlyCost;
    const stressOccupancyPct   = effectiveSlots > 0 ? Math.min((stressedTotalAppts / effectiveSlots) * 100, 100) : 0;
    const stressRiskScore      = Math.min(100, Math.round((stressRevenueLoss / Math.max(monthlyTotalRevenue, 1)) * 100 + activeStresses.size * 4));

    // Stress impact chart data
    const stressImpactData = STRESS_SCENARIOS.map(sc => {
      let rev = monthlyTotalRevenue;
      if (sc.leadsMulti) { const sL = totalLeads * sc.leadsMulti; const sN = Math.round(sL * demand.bookingRatePct / 100 * demand.showRatePct / 100 * conversion.consultConversionPct / 100); rev = Math.round((sN + sN * retention.repeatBookingRatePct / 100) * weightedValue); }
      if (sc.revenueMulti) rev = Math.round(monthlyTotalRevenue * sc.revenueMulti);
      if (sc.convMulti) { const sN = Math.round(consultAttended * conversion.consultConversionPct * sc.convMulti / 100); rev = Math.round((sN + sN * retention.repeatBookingRatePct / 100) * weightedValue); }
      return { name: sc.label, baseline: monthlyTotalRevenue, stressed: rev, loss: monthlyTotalRevenue - rev - (sc.costAdd || 0) };
    });

    // Risk level
    const riskLevel: "green" | "amber" | "red" =
      occupancyPct < 20 || cac > weightedValue * 0.5 ? "red" :
      occupancyPct < 50 || conversion.consultConversionPct < 55 ? "amber" :
      "green";

    // Insights
    const insights: { level: "warning" | "info" | "success"; title: string; body: string }[] = [];
    if (occupancyPct > 75) insights.push({ level: "warning", title: "Approaching capacity ceiling", body: `At ${Math.round(occupancyPct)}% occupancy, a second clinician or extended hours will be needed within ${Math.max(1, Math.round((100 - occupancyPct) / 5))} months at current growth rate.` });
    if (cac > weightedValue * 0.4) insights.push({ level: "warning", title: "High customer acquisition cost", body: `CAC of ${formatGBP(cac)} is ${Math.round((cac / weightedValue) * 100)}% of average treatment value. Referral and retention programmes offer far better unit economics.` });
    if (treatments.find(t => t.id === "fs" || t.id === "mn")!.pct < 12) insights.push({ level: "info", title: "Skin treatments underrepresented", body: `Facials & Microneedling hold the highest margins (76–79%) but represent only ${treatments.filter(t => t.id === "fs" || t.id === "mn").reduce((s, t) => s + t.pct, 0)}% of your mix. Promoting these fills capacity profitably.` });
    if (conversion.consultConversionPct < 60) insights.push({ level: "warning", title: "Conversion below industry benchmark", body: `${conversion.consultConversionPct}% consultation conversion is below the 65–75% range for premium aesthetics. At this rate, ${formatGBP(Math.round((0.68 - conversion.consultConversionPct / 100) * consultAttended * weightedValue))} of monthly revenue is being left at consultation.` });
    if (retention.repeatBookingRatePct > 65) insights.push({ level: "success", title: "Strong repeat booking rate", body: `${retention.repeatBookingRatePct}% repeat rate is excellent. Structured rebooking at checkout and a loyalty tier could push this toward 75%, adding ${formatGBP(Math.round(newClients * 0.1 * weightedValue))} per month.` });
    if (unusedSlots > effectiveSlots * 0.35) insights.push({ level: "info", title: "Significant unused capacity", body: `${Math.round(unusedSlots)} treatment slots unused per month — ${formatGBP(Math.round(unusedSlots * weightedValue * weightedMargin / 100))} in potential margin. Consider introductory offers or targeted reactivation campaigns to fill these slots before adding overhead.` });
    if (ltv > 1200) insights.push({ level: "success", title: "Healthy client lifetime value", body: `3-year LTV of ${formatGBP(ltv)} per client justifies higher acquisition spend than your current CAC of ${formatGBP(cac)}. You have headroom to invest more in paid media to accelerate growth.` });
    if (totalLeads < 40) insights.push({ level: "warning", title: "Lead volume below growth threshold", body: `${totalLeads} monthly leads generates ${newClients} new clients — below the 10–15 threshold for reliable month-on-month growth. Increasing organic enquiries by 50% would add ${formatGBP(Math.round(totalLeads * 0.5 * demand.bookingRatePct / 100 * demand.showRatePct / 100 * conversion.consultConversionPct / 100 * weightedValue))} revenue.` });

    return {
      totalLeads, consultBooked, consultAttended, newClients, cac,
      weightedValue, weightedMargin, weightedDuration,
      returningClients, totalMonthlyAppts,
      monthlyNewRevenue, monthlyTotalRevenue, annualRevenue,
      ltv, effectiveSlots, occupancyPct, unusedSlots,
      revenueCeiling, revenueGap, daysToFullCapacity,
      cohortData, stressImpactData,
      stressedFinalRevenue, stressRevenueLoss, stressOccupancyPct, stressRiskScore,
      riskLevel, insights,
    };
  }, [demand, conversion, capacity, retention, treatments, activeStresses]);

  const occupancyStatus = m.occupancyPct < 30 ? "red" : m.occupancyPct < 60 ? "amber" : "green";
  const leadsStatus     = m.totalLeads < 30 ? "red" : m.totalLeads < 60 ? "amber" : "green";
  const convStatus      = conversion.consultConversionPct < 55 ? "red" : conversion.consultConversionPct < 65 ? "amber" : "green";
  const valueStatus     = m.weightedValue < 200 ? "red" : m.weightedValue < 300 ? "amber" : "green";
  const ltvStatus       = m.ltv < 500 ? "red" : m.ltv < 1000 ? "amber" : "green";

  const treatmentPieData = treatments.map(t => ({ name: t.name, value: t.pct }));
  const treatmentProfitData = [...treatments]
    .sort((a, b) => b.marginPct - a.marginPct)
    .map(t => ({ name: t.name.replace(" / Skin", ""), margin: t.marginPct, value: t.avgValue }));

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky KPI Strip ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border/60 shadow-sm">
        <div className="flex items-stretch overflow-x-auto scrollbar-hide">
          <KpiCard label="Monthly Leads"    value={String(m.totalLeads)}                  sub={`${m.consultBooked} consults booked`}       status={leadsStatus} />
          <KpiCard label="Consult Conv."    value={`${conversion.consultConversionPct}%`} sub={`${m.newClients} new clients/mo`}            status={convStatus} />
          <KpiCard label="Avg Client Value" value={formatGBP(Math.round(m.weightedValue))} sub={`${Math.round(m.weightedMargin)}% margin`} status={valueStatus} />
          <KpiCard label="Repeat Rate"      value={`${retention.repeatBookingRatePct}%`}  sub={`${m.returningClients} returning/mo`}        status={m.returningClients > m.newClients * 0.5 ? "green" : "amber"} />
          <KpiCard label="Occupancy"        value={`${Math.round(m.occupancyPct)}%`}      sub={`${m.totalMonthlyAppts} of ${m.effectiveSlots} slots`} status={occupancyStatus} />
          <KpiCard label="Monthly Revenue"  value={formatGBP(m.monthlyTotalRevenue)}      sub={`ceiling ${formatGBP(m.revenueCeiling)}`}   status={m.monthlyTotalRevenue > m.revenueCeiling * 0.6 ? "green" : m.monthlyTotalRevenue > m.revenueCeiling * 0.35 ? "amber" : "red"} />
          <KpiCard label="Client LTV (3y)"  value={formatGBP(m.ltv)}                      sub={`CAC ${formatGBP(m.cac)}`}                  status={ltvStatus} />
          <KpiCard label="Risk Level"       value={m.riskLevel === "green" ? "Low" : m.riskLevel === "amber" ? "Medium" : "High"} sub={`${m.insights.filter(i => i.level === "warning").length} alerts`} status={m.riskLevel} />
        </div>
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        <PageHeader
          title="Operational Model"
          subtitle="Simulation engine — model the demand, capacity, and retention that drives financial outcomes"
        />

        {/* ─── Section 1: Demand Engine ─────────────────────────────────── */}
        <section>
          <SectionHeader icon={Users} title="Demand Engine" desc="Lead sources, funnel stages, and acquisition costs" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Inputs */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Lead Sources</CardTitle>
                <CardDescription className="text-xs">Monthly volume per channel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0">
                <NumField label="Meta / Instagram leads"     value={demand.metaLeads}           onChange={v => setD("metaLeads", v)} />
                <NumField label="Google / Search leads"      value={demand.googleLeads}          onChange={v => setD("googleLeads", v)} />
                <NumField label="Organic enquiries"          value={demand.organicEnquiries}     onChange={v => setD("organicEnquiries", v)} />
                <NumField label="Referral enquiries"         value={demand.referralEnquiries}    onChange={v => setD("referralEnquiries", v)} />
                <NumField label="Cost per paid lead (£)"     value={demand.costPerLead}          onChange={v => setD("costPerLead", v)} step={0.5} />
                <NumField label="Booking rate %"             value={demand.bookingRatePct}       onChange={v => setD("bookingRatePct", v)} max={100} suffix="%" />
                <NumField label="Consultation show rate %"   value={demand.showRatePct}          onChange={v => setD("showRatePct", v)} max={100} suffix="%" />
              </CardContent>
            </Card>

            {/* Funnel output */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Acquisition Funnel</CardTitle>
                <CardDescription className="text-xs">Lead to client conversion pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {[
                  { label: "Total monthly leads",         value: m.totalLeads,        max: m.totalLeads, colour: "bg-primary" },
                  { label: "Consultations booked",        value: m.consultBooked,     max: m.totalLeads, colour: "bg-blue-500" },
                  { label: "Consultations attended",      value: m.consultAttended,   max: m.totalLeads, colour: "bg-indigo-500" },
                  { label: "New clients converted",       value: m.newClients,        max: m.totalLeads, colour: "bg-emerald-500" },
                ].map((stage) => (
                  <div key={stage.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{stage.label}</span>
                      <span className="font-semibold tabular-nums">{stage.value}</span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", stage.colour)}
                        style={{ width: `${(stage.value / stage.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <Separator className="my-3" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid spend</p>
                    <p className="text-base font-bold tabular-nums">{formatGBP((demand.metaLeads + demand.googleLeads) * demand.costPerLead)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CAC</p>
                    <p className={cn("text-base font-bold tabular-nums", m.cac > m.weightedValue * 0.4 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{formatGBP(m.cac)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">LTV:CAC</p>
                    <p className="text-base font-bold tabular-nums">{m.cac > 0 ? `${(m.ltv / m.cac).toFixed(1)}×` : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── Section 2: Conversion & Revenue ─────────────────────────── */}
        <section>
          <SectionHeader icon={Target} title="Conversion & Revenue" desc="Consultation conversion, upsells, memberships and monthly output" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversion Assumptions</CardTitle>
                <CardDescription className="text-xs">Rates applied to each consultation stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0">
                <NumField label="Consultation conversion %"        value={conversion.consultConversionPct}          onChange={v => setCv("consultConversionPct", v)} max={100} suffix="%" />
                <NumField label="Existing client conversion %"     value={conversion.existingClientConversionPct}   onChange={v => setCv("existingClientConversionPct", v)} max={100} suffix="%" />
                <NumField label="Upsell acceptance %"              value={conversion.upsellAcceptancePct}           onChange={v => setCv("upsellAcceptancePct", v)} max={100} suffix="%" />
                <NumField label="Membership take-up %"             value={conversion.membershipTakeupPct}           onChange={v => setCv("membershipTakeupPct", v)} max={100} suffix="%" />
                <NumField label="Finance option uptake %"          value={conversion.financeOptionPct}              onChange={v => setCv("financeOptionPct", v)} max={100} suffix="%" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly Revenue Output</CardTitle>
                <CardDescription className="text-xs">Derived from current assumptions</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "New clients",         value: String(m.newClients),                     sub: "this month" },
                    { label: "Returning clients",   value: String(m.returningClients),               sub: "repeat bookings" },
                    { label: "New client revenue",  value: formatGBP(m.monthlyNewRevenue),           sub: "from new only" },
                    { label: "Total monthly revenue", value: formatGBP(m.monthlyTotalRevenue),       sub: "new + returning" },
                    { label: "Members (est.)",      value: String(Math.round(m.newClients * conversion.membershipTakeupPct / 100)), sub: "at current take-up" },
                    { label: "Annual run rate",     value: formatGBP(m.annualRevenue),               sub: "12× monthly" },
                  ].map(item => (
                    <div key={item.label} className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className="text-base font-bold tabular-nums mt-0.5">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── Section 3: Treatment Mix Engine ─────────────────────────── */}
        <section>
          <SectionHeader icon={Layers} title="Treatment Mix Engine" desc="Revenue contribution, profitability and duration by treatment type" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Editable table */}
            <Card className="shadow-sm lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Treatment Types</CardTitle>
                <CardDescription className="text-xs">Edit mix %, average value, duration and margin for each treatment</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Treatment</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Mix %</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Avg Value</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Mins</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Margin %</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Repeat (mo)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treatments.map((t, idx) => (
                        <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLOURS[idx % PIE_COLOURS.length] }} />
                              <span className="font-medium">{t.name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={t.pct} min={0} max={100}
                              onChange={e => updateTreatment(t.id, "pct", Number(e.target.value))}
                              className="h-6 w-14 text-right text-xs tabular-nums ml-auto" />
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={t.avgValue} min={0}
                              onChange={e => updateTreatment(t.id, "avgValue", Number(e.target.value))}
                              className="h-6 w-16 text-right text-xs tabular-nums ml-auto" />
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={t.durationMins} min={5}
                              onChange={e => updateTreatment(t.id, "durationMins", Number(e.target.value))}
                              className="h-6 w-14 text-right text-xs tabular-nums ml-auto" />
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={t.marginPct} min={0} max={100}
                              onChange={e => updateTreatment(t.id, "marginPct", Number(e.target.value))}
                              className="h-6 w-14 text-right text-xs tabular-nums ml-auto" />
                          </td>
                          <td className="px-3 py-1">
                            <Input type="number" value={t.repeatMonths} min={1}
                              onChange={e => updateTreatment(t.id, "repeatMonths", Number(e.target.value))}
                              className="h-6 w-14 text-right text-xs tabular-nums ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td className="px-3 py-2 text-xs font-semibold">Weighted average</td>
                        <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">{treatments.reduce((s, t) => s + t.pct, 0)}%</td>
                        <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">{formatGBP(Math.round(m.weightedValue))}</td>
                        <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">{Math.round(m.weightedDuration)}</td>
                        <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">{Math.round(m.weightedMargin)}%</td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Pie chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue Mix</CardTitle>
                <CardDescription className="text-xs">Treatment contribution by % volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={treatmentPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                      {treatmentPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                      ))}
                    </Pie>
                    <RechartTooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {treatments.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLOURS[i % PIE_COLOURS.length] }} />
                        <span className="text-muted-foreground">{t.name}</span>
                      </div>
                      <span className="tabular-nums font-medium">{formatGBP(Math.round(t.pct / 100 * m.totalMonthlyAppts * t.avgValue))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profitability ranking */}
          <Card className="shadow-sm mt-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Treatment Profitability Ranking</CardTitle>
              <CardDescription className="text-xs">Gross margin % per treatment type — higher is better per appointment slot</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={treatmentProfitData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <RechartTooltip formatter={(v: number) => [`${v}%`, "Margin"]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                    {treatmentProfitData.map((entry, i) => (
                      <Cell key={i} fill={entry.margin > 70 ? "#22c55e" : entry.margin > 55 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* ─── Section 4: Capacity & Occupancy ─────────────────────────── */}
        <section>
          <SectionHeader icon={Clock} title="Capacity & Occupancy" desc="Treatment room throughput, clinician hours, and utilisation ceiling" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Capacity Assumptions</CardTitle>
                <CardDescription className="text-xs">Clinic configuration and availability</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0">
                <NumField label="Treatment rooms"              value={capacity.treatmentRooms}          onChange={v => setCp("treatmentRooms", v)} min={1} />
                <NumField label="Clinician hours per week"     value={capacity.clinicianHoursPerWeek}   onChange={v => setCp("clinicianHoursPerWeek", v)} />
                <NumField label="Open days per week"           value={capacity.openDaysPerWeek}         onChange={v => setCp("openDaysPerWeek", v)} min={1} max={7} />
                <NumField label="Avg appointment (mins)"       value={capacity.avgAppointmentMins}      onChange={v => setCp("avgAppointmentMins", v)} min={5} />
                <NumField label="Buffer between appts (mins)"  value={capacity.bufferMins}              onChange={v => setCp("bufferMins", v)} />
                <NumField label="Lunch break (mins/day)"       value={capacity.lunchBreakMins}          onChange={v => setCp("lunchBreakMins", v)} />
                <NumField label="Admin time (mins/day)"        value={capacity.adminDailyMins}          onChange={v => setCp("adminDailyMins", v)} />
                <NumField label="DNA / no-show rate %"         value={capacity.dnaPct}                  onChange={v => setCp("dnaPct", v)} max={100} suffix="%" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Utilisation & Revenue Ceiling</CardTitle>
                <CardDescription className="text-xs">Occupancy against available capacity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {/* Occupancy visual */}
                <div className="text-center space-y-2">
                  <div className={cn("text-5xl font-bold tabular-nums",
                    m.occupancyPct < 30 ? "text-destructive" : m.occupancyPct < 60 ? "text-amber-500" : "text-emerald-500")}>
                    {Math.round(m.occupancyPct)}%
                  </div>
                  <div className="text-xs text-muted-foreground">clinic occupancy</div>
                  <Progress value={m.occupancyPct} className="h-3" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Effective monthly slots", value: String(m.effectiveSlots), sub: "after DNA" },
                    { label: "Appointments booked",     value: String(m.totalMonthlyAppts), sub: "new + returning" },
                    { label: "Unused slots",            value: String(m.unusedSlots), sub: `${formatGBP(Math.round(m.unusedSlots * m.weightedValue))} missed` },
                    { label: "Revenue ceiling",         value: formatGBP(m.revenueCeiling), sub: "if 100% full" },
                    { label: "Revenue gap",             value: formatGBP(m.revenueGap), sub: "unfilled capacity" },
                    { label: "Days to full capacity",   value: m.daysToFullCapacity < 999 ? `~${m.daysToFullCapacity}d` : "N/A", sub: "at current rate" },
                  ].map(item => (
                    <div key={item.label} className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">{item.label}</p>
                      <p className="text-base font-bold tabular-nums mt-0.5">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                    </div>
                  ))}
                </div>
                {m.occupancyPct > 80 && (
                  <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-amber-800 dark:text-amber-200">Burnout risk: occupancy above 80% — consider capacity expansion before demand increases further.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── Section 5: Client Retention Engine ──────────────────────── */}
        <section>
          <SectionHeader icon={Heart} title="Client Retention Engine" desc="Repeat booking behaviour, LTV, and projected rolling client base" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Retention Assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <NumField label="Repeat booking rate %"          value={retention.repeatBookingRatePct}       onChange={v => setR("repeatBookingRatePct", v)} max={100} suffix="%" />
                <NumField label="Avg repeat interval (months)"   value={retention.avgRepeatIntervalMonths}    onChange={v => setR("avgRepeatIntervalMonths", v)} min={1} step={0.5} />
                <NumField label="Annual revisit frequency"       value={retention.annualRevisitFrequency}     onChange={v => setR("annualRevisitFrequency", v)} step={0.1} />
                <NumField label="Membership retention %"         value={retention.membershipRetentionPct}     onChange={v => setR("membershipRetentionPct", v)} max={100} suffix="%" />
                <NumField label="Dormant threshold (months)"     value={retention.dormantThresholdMonths}     onChange={v => setR("dormantThresholdMonths", v)} min={1} />
              </CardContent>
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg px-3 py-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">3-Year LTV</p>
                    <p className={cn("text-xl font-bold tabular-nums mt-0.5", ltvStatus === "green" ? "text-emerald-600 dark:text-emerald-400" : ltvStatus === "amber" ? "text-amber-500" : "text-destructive")}>{formatGBP(m.ltv)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg px-3 py-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">LTV : CAC</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5">{m.cac > 0 ? `${(m.ltv / m.cac).toFixed(1)}×` : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">12-Month Client Base Projection</CardTitle>
                <CardDescription className="text-xs">New vs returning appointments, ramping from opening</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={m.cohortData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartTooltip contentStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="returning" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} name="Returning" />
                    <Area type="monotone" dataKey="new" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.35} name="New clients" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── Section 6: Stress Testing ────────────────────────────────── */}
        <section>
          <SectionHeader icon={AlertTriangle} title="Cashflow Stress Testing" desc="Toggle adverse scenarios to model revenue impact and cash runway risk" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {STRESS_SCENARIOS.map(sc => {
              const isActive = activeStresses.has(sc.key);
              return (
                <button
                  key={sc.key}
                  onClick={() => toggleStress(sc.key)}
                  className={cn(
                    "text-left px-3 py-3 rounded-xl border transition-all text-xs",
                    isActive
                      ? "bg-destructive/10 border-destructive/50 shadow-sm"
                      : "bg-muted/20 border-border/50 hover:bg-muted/40"
                  )}
                >
                  <div className={cn("font-semibold mb-1", isActive ? "text-destructive" : "text-foreground")}>{sc.label}</div>
                  <div className="text-muted-foreground leading-snug">{sc.desc}</div>
                </button>
              );
            })}
          </div>

          {activeStresses.size > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="shadow-sm border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive">Stress Impact Summary</CardTitle>
                  <CardDescription className="text-xs">{activeStresses.size} scenario{activeStresses.size > 1 ? "s" : ""} active</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Normal revenue</p>
                      <p className="text-base font-bold tabular-nums">{formatGBP(m.monthlyTotalRevenue)}</p>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stressed revenue</p>
                      <p className="text-base font-bold tabular-nums text-destructive">{formatGBP(m.stressedFinalRevenue)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly loss</p>
                      <p className="text-base font-bold tabular-nums text-destructive">({formatGBP(m.stressRevenueLoss)})</p>
                    </div>
                    <div className={cn("rounded-lg px-3 py-2.5 border", m.stressRiskScore > 60 ? "bg-destructive/10 border-destructive/30" : m.stressRiskScore > 30 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted/30 border-border/30")}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Risk score</p>
                      <p className={cn("text-base font-bold tabular-nums", m.stressRiskScore > 60 ? "text-destructive" : m.stressRiskScore > 30 ? "text-amber-500" : "text-emerald-500")}>{m.stressRiskScore}/100</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Stressed occupancy</p>
                    <Progress value={m.stressOccupancyPct} className="h-2.5" />
                    <p className="text-xs text-muted-foreground">{Math.round(m.stressOccupancyPct)}% vs normal {Math.round(m.occupancyPct)}%</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Individual Scenario Impact</CardTitle>
                  <CardDescription className="text-xs">Monthly revenue loss per scenario in isolation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={m.stressImpactData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${Math.round(v / 1000)}k`} />
                      <RechartTooltip formatter={(v: number) => [formatGBP(v), "Revenue lost"]} contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="loss" fill="#ef4444" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border/50 rounded-xl">
              Toggle scenarios above to model their revenue impact
            </div>
          )}
        </section>

        {/* ─── Section 7: Strategic Insights ───────────────────────────── */}
        <section>
          <SectionHeader icon={Sparkles} title="Strategic Insights" desc="Derived from your current operational assumptions — updated live as you change inputs" />
          {m.insights.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border/50 rounded-xl">
              Adjust assumptions to generate contextual insights
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {m.insights.map((insight, i) => {
                const cfg = {
                  warning: { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", icon_colour: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" },
                  info:    { icon: Eye,           bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200 dark:border-blue-800",   icon_colour: "text-blue-600 dark:text-blue-400",   badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" },
                  success: { icon: CheckCircle2,  bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", icon_colour: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" },
                }[insight.level];
                const Icon = cfg.icon;
                return (
                  <div key={i} className={cn("rounded-xl border p-4 space-y-2", cfg.bg, cfg.border)}>
                    <div className="flex items-start gap-3">
                      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.icon_colour)} />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight">{insight.title}</p>
                          <Badge className={cn("text-[9px] px-1.5 py-0.5 shrink-0", cfg.badge)}>
                            {insight.level === "warning" ? "Action" : insight.level === "success" ? "Strength" : "Insight"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 px-4 py-2.5 bg-muted/30 rounded-lg border border-border/40 text-[10px] text-muted-foreground">
            Insights are derived from your operational assumptions in real time. Future releases will feed this model's outputs directly into the Financial Model page to replace static revenue assumptions.
          </div>
        </section>
      </div>
    </div>
  );
}
