import { useEffect, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Sparkles, Loader2, AlertTriangle, Plus, Trash2, Pencil, ArrowRight, PoundSterling,
  FileText, Copy, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatGBP } from "@/lib/format";

const PROJECT_ID = 1;

type Allocation = { fromMonth: string; bedhamptonDays: number; winchesterDays: number; chichesterDays: number };
type Trigger = { type?: string; note?: string; occupancyPct?: number };
type PayParams = { salaryFteGbp: number; oncostPct: number; dayRateGbp: number; revSharePct: number; baseRetainerMonthlyGbp: number; trainingMonths: number; trainingCostGbp: number; trainingStipendMonthlyGbp: number };
type CompPhase = {
  fromMonth: string; label: string; totalDays: number; site: string; training: boolean;
  monthlyRevenue: number; monthlyGrossPay: number; monthlyLoadedCost: number;
  monthlyStock: number; monthlyContribution: number; annualGrossPay: number;
};
type CompModel = { model: string; monthlyGrossPay: number; annualGrossPay: number; monthlyLoadedCost: number; monthlyContribution: number };
type Compensation = {
  payModel: string; params: PayParams; phases: CompPhase[]; comparison: CompModel[];
  trainingMonths: number; trainingCostGbp: number; investmentBeforeProductive: number;
  fullTime: { label: string; days: number; site: string; monthlyRevenue: number; monthlyGrossPay: number; monthlyLoadedCost: number; monthlyContribution: number } | null;
  paysForHerself: boolean | null;
};
type Role = {
  id: number; name: string; roleType: string; status: string; startDate: string | null;
  leadTimeWeeks: number; annualCostGbp: number; isOwner: boolean; notes: string | null;
  sortOrder: number; allocations: Allocation[]; trigger: Trigger;
  payModel: string; pay: Partial<PayParams>; compensation: Compensation;
  intake: Intake; readinessPlan: string | null; packagePlan: string | null;
};
type RampMilestone = { label: string; date: string; pct: number };
type KpiPackage = { baseGbp: number; treatmentCommPct: number; retailPctOfTreatments: number; retailCommPct: number; growthBonusPct: number; growthBaselineMonthlyGbp: number };
type CurrentJob = { fteSalaryGbp: number; daysPerWeek: number; annualGrowthPct: number };
type Intake = {
  registration?: string; isPrescriber?: boolean; scope?: string[];
  readyBy?: string; currentTraining?: string; notes?: string;
  packagePrefs?: { exclusivity?: string; whosePatients?: string; herPreference?: string; businessPriority?: string; clawback?: string };
  rampMilestones?: RampMilestone[];
  kpiPackage?: KpiPackage;
  currentJob?: CurrentJob;
};
const SCOPE_OPTIONS = [
  "Injectables — toxin & dermal filler",
  "Skin — microneedling, peels, boosters",
  "Independent prescribing (POMs)",
  "Full current menu (same as Abi)",
];
type SiteCell = { demand: number; capacity: number; gap: number };
type SeriesPoint = {
  month: string; label: string; occupancyPct: number;
  bedhampton: SiteCell; winchester: SiteCell; chichester: SiteCell;
};
type TriggerAlert = { roleId: number; name: string; message: string; rationale?: string; overdue: boolean };
type PayBenchmark = {
  roles: { roleId: number; name: string; salaryGbp: number; loadedCostGbp: number; marketLowGbp: number; marketHighGbp: number; basis: string }[];
  sarahStages?: { stage: string; figure: string; note: string }[];
  coherence?: string; watchOuts?: string[]; narrative?: string;
};
type Workforce = {
  series: SeriesPoint[];
  costSeries: { month: string; label: string; monthlyStaffCost: number }[];
  roles: Role[];
  settings: { chichesterMoveMonth: string | null; winchesterRooms: number; planNarrative: string | null; payBenchmark: string | null };
  triggers: TriggerAlert[];
  openMonth: string; scenario: string; targetOcc: number; rooms: number;
  roleTypes: string[]; roleStatuses: string[];
  fin: { bedRevPerDay: number; winMatureRevPerDay: number; targetOcc: number; stockPct: number };
};

async function api<T>(url: string, init?: RequestInit, timeoutMs = 300_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? "Request failed");
    return j as T;
  } finally { clearTimeout(timer); }
}

const ROLE_COLORS: Record<string, string> = {
  clinician: "bg-primary/15 text-primary", reception: "bg-blue-50 text-blue-700",
  management: "bg-purple-50 text-purple-700", support: "bg-slate-100 text-slate-600",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700", planned: "bg-amber-50 text-amber-700",
  recruiting: "bg-orange-50 text-orange-700", onboarding: "bg-blue-50 text-blue-700",
  departed: "bg-slate-100 text-slate-500",
};

function SiteChart({ title, colour, data, moveNote }: {
  title: string; colour: string;
  data: { label: string; demand: number; capacity: number }[];
  moveNote?: string;
}) {
  const hasAny = data.some(d => d.demand > 0 || d.capacity > 0);
  if (!hasAny) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {moveNote && <span className="text-[11px] text-muted-foreground">{moveNote}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">Clinician days/week — shaded is what you have, line is what demand needs.</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v: number, n: string) => [`${v} days/wk`, n === "capacity" ? "You have" : "Demand needs"]}
            />
            <Area type="monotone" dataKey="capacity" stroke={colour} fill={colour} fillOpacity={0.18} strokeWidth={2} />
            <Line type="monotone" dataKey="demand" stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CapacityReadout({ series, chichesterMove }: { series: Workforce["series"]; chichesterMove: string | null }) {
  const round1 = (n: number) => +n.toFixed(1);
  const sites: { key: "bedhampton" | "winchester" | "chichester"; name: string; note?: string }[] = [
    { key: "bedhampton", name: "Bedhampton", note: chichesterMove ? `relocates to Chichester ${chichesterMove}` : undefined },
    { key: "winchester", name: "Winchester" },
    { key: "chichester", name: "Chichester", note: "after the Bedhampton relocation" },
  ];
  const rows = sites.map(site => {
    const active = series.filter(s => s[site.key].demand > 0 || s[site.key].capacity > 0);
    if (active.length === 0) return null;
    const shorts = active.filter(s => s[site.key].demand - s[site.key].capacity > 0.05);
    const firstShort = shorts[0] ?? null;
    return { ...site, everShort: shorts.length > 0, firstShort };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const cell = r.firstShort ? r.firstShort[r.key] : null;
        const gap = cell ? round1(cell.demand - cell.capacity) : 0;
        return (
          <div key={r.key} className="flex items-start gap-3 border border-border rounded-md p-3">
            <span className={`mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${r.everShort ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {r.everShort ? "Goes short" : "Covered"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{r.name}{r.note && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{r.note}</span>}</p>
              {r.everShort && cell ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Short from <span className="font-medium text-foreground">{r.firstShort!.label}</span> — needs {round1(cell.demand)} clinician days/week, you'll have {round1(cell.capacity)}, so about <span className="font-medium text-foreground">{gap} day{gap === 1 ? "" : "s"}/week short</span>. Line up cover before then — see the hiring triggers above.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Covered throughout — your planned clinician days keep up with demand.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PeoplePage() {
  const [wf, setWf] = useState<Workforce | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [adding, setAdding] = useState(false);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [readyOpen, setReadyOpen] = useState<number | null>(null);
  const [benchOpen, setBenchOpen] = useState(false);

  const load = () => { setLoading(true); return api<Workforce>(`/api/projects/${PROJECT_ID}/workforce`).then(d => { setWf(d); setAiNarrative(d.settings.planNarrative); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const refreshWithAI = async () => {
    setAiBusy(true); setError(null);
    try {
      const { plan } = await api<{ plan: { narrative: string; roles: Role[]; chichesterMoveMonth: string | null } }>(
        `/api/projects/${PROJECT_ID}/workforce/ai-plan`, { method: "POST" },
      );
      await api(`/api/projects/${PROJECT_ID}/workforce/apply-plan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: plan.roles, chichesterMoveMonth: plan.chichesterMoveMonth, narrative: plan.narrative }),
      });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "AI planning failed"); }
    finally { setAiBusy(false); }
  };

  if (loading && !wf) return <Card><CardContent className="p-8 flex items-center gap-3 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading the workforce plan…</CardContent></Card>;
  if (!wf) return <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>;

  const peakCost = Math.max(...wf.costSeries.map(c => c.monthlyStaffCost));
  const fullTeamCost = wf.roles.filter(r => !r.isOwner).reduce((s, r) => s + r.annualCostGbp, 0);

  // Each step up in the cost line is one person starting — attribute it explicitly.
  const monthLabel = (ym: string | null) => {
    if (!ym) return "—";
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  };
  const costDrivers = (() => {
    const hires = wf.roles
      .filter(r => !r.isOwner && r.status !== "departed" && r.startDate)
      .map(r => ({ name: r.name, roleType: r.roleType, startDate: r.startDate as string, monthly: Math.round((r.annualCostGbp || 0) / 12) }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    let running = 0;
    return hires.map(h => { running += h.monthly; return { ...h, running }; });
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground flex items-center gap-2"><Users className="w-7 h-7 text-muted-foreground" />People & Capacity</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
            Who works where, over time · when to hire · Bedhampton → Chichester
          </p>
        </div>
        <Button onClick={refreshWithAI} disabled={aiBusy}>
          {aiBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Re-planning… (1–2 min)</> : <><Sparkles className="w-4 h-4 mr-2" />Re-plan with AI</>}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Trigger alerts */}
      {wf.triggers.length > 0 && (
        <Card className="border-amber-300">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />Act now — hiring triggers
            </p>
            <ul className="mt-2 space-y-2">
              {wf.triggers.map(t => (
                <li key={t.roleId} className="text-sm">
                  <span className={t.overdue ? "font-semibold text-destructive" : "font-semibold"}>{t.message}</span>
                  {t.rationale && <span className="text-muted-foreground"> {t.rationale}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* AI narrative */}
      {aiNarrative && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-serif text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-muted-foreground" />The phased plan</h3>
            <p className="text-sm leading-relaxed mt-2 whitespace-pre-line">{aiNarrative}</p>
          </CardContent>
        </Card>
      )}

      {/* Site cover */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-serif text-lg">Site cover — are we short anywhere?</h3>
            <span className="text-xs text-muted-foreground">Winchester {wf.rooms} rooms · opens {wf.series.find(s => s.month === wf.openMonth)?.label}</span>
          </div>
          <CapacityReadout series={wf.series} chichesterMove={wf.settings.chichesterMoveMonth} />
        </CardContent>
      </Card>

      {/* Cash impact */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-serif text-lg flex items-center gap-2"><PoundSterling className="w-4 h-4 text-muted-foreground" />Staffing cost</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Peak monthly cost</p><p className="font-serif text-2xl mt-1">{formatGBP(peakCost)}<span className="text-sm text-muted-foreground">/mo</span></p></div>
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Full team, annualised</p><p className="font-serif text-2xl mt-1">{formatGBP(fullTeamCost)}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Excludes</p><p className="text-sm mt-2 text-muted-foreground">Abi's drawings (owner)</p></div>
          </div>
          <div className="h-32 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={wf.costSeries} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [formatGBP(v), "Monthly staff cost"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="stepAfter" dataKey="monthlyStaffCost" stroke="#445B72" fill="#445B72" fillOpacity={0.15} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* What drives each step in the line above */}
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What's driving each step up</p>
            <div className="space-y-1">
              {costDrivers.map((d, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1 border-b border-border/40 last:border-0">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{monthLabel(d.startDate)}</span>
                  <span className="flex-1 min-w-0 truncate"><span className="font-medium">{d.name}</span> <span className="text-xs text-muted-foreground">({d.roleType}) starts</span></span>
                  <span className="text-primary font-semibold whitespace-nowrap">+{formatGBP(d.monthly)}/mo</span>
                  <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap w-32 text-right">team → {formatGBP(d.running)}/mo</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Uses each person's full loaded cost from their start month (matches the line). In reality Sarah's first months are lower — part-time and on a training salary until she's signed off.</p>
          </div>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg">The team</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setBenchOpen(o => !o)}><Sparkles className="w-3.5 h-3.5 mr-1.5" />Benchmark pay</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add role</Button>
            </div>
          </div>
          {benchOpen && <PayBenchmarkPanel settings={wf.settings} onApplied={load} />}
          <div className="space-y-2.5">
            {wf.roles.map(r => (
              <div key={r.id} className="border border-border rounded-md p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <Badge className={ROLE_COLORS[r.roleType] ?? ""} variant="secondary">{r.roleType}</Badge>
                  <Badge className={STATUS_COLORS[r.status] ?? ""} variant="secondary">{r.status}</Badge>
                  {r.isOwner && <Badge variant="outline">owner</Badge>}
                  {!r.isOwner && r.annualCostGbp > 0 && <span className="text-xs text-muted-foreground">{formatGBP(r.annualCostGbp)}/yr</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditRole(r)}><Pencil className="w-3.5 h-3.5" /></button>
                    {!r.isOwner && <button className="text-muted-foreground hover:text-destructive" onClick={() => { if (confirm(`Remove ${r.name}?`)) api(`/api/staff-roles/${r.id}`, { method: "DELETE" }).then(load); }}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                {r.startDate && !r.isOwner && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Target start {r.startDate} · ~{r.leadTimeWeeks}wk lead → recruit from {(() => { const [y, m] = r.startDate.split("-").map(Number); const d = new Date(y, m - 1 - Math.round(r.leadTimeWeeks / 4.345), 1); return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); })()}
                  </p>
                )}
                {r.trigger?.note && <p className="text-sm mt-1"><span className="text-muted-foreground">Trigger:</span> {r.trigger.note}</p>}
                {/* allocation strip */}
                {r.allocations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.allocations.map((a, i) => (
                      <span key={i} className="text-[11px] bg-muted rounded px-1.5 py-0.5 flex items-center gap-1">
                        <span className="text-muted-foreground">{a.fromMonth}</span>
                        {a.bedhamptonDays > 0 && <span>Bed {a.bedhamptonDays}</span>}
                        {a.winchesterDays > 0 && <span>Win {a.winchesterDays}</span>}
                        {a.chichesterDays > 0 && <span>Chi {a.chichesterDays}</span>}
                        {a.bedhamptonDays + a.winchesterDays + a.chichesterDays === 0 && <span className="text-muted-foreground">shadow/none</span>}
                      </span>
                    ))}
                  </div>
                )}
                {r.notes && <p className="text-xs text-muted-foreground mt-1.5">{r.notes}</p>}

                {!r.isOwner && (
                  <div className="mt-2.5 flex items-center gap-4">
                    {r.roleType === "clinician" && (
                      <button
                        className="text-xs font-medium text-primary flex items-center gap-1 hover:opacity-80"
                        onClick={() => { setReadyOpen(o => (o === r.id ? null : r.id)); setPayOpen(null); }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Onboarding & readiness
                        {readyOpen === r.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      className="text-xs font-medium text-primary flex items-center gap-1 hover:opacity-80"
                      onClick={() => { setPayOpen(o => (o === r.id ? null : r.id)); setReadyOpen(null); }}
                    >
                      <PoundSterling className="w-3.5 h-3.5" />
                      Pay & build the offer
                      {payOpen === r.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {readyOpen === r.id && <ReadinessPanel role={r} fin={wf.fin} onSaved={load} />}
                {payOpen === r.id && <CompensationPanel role={r} onSaved={load} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(editRole || adding) && (
        <RoleEditor
          role={editRole}
          roleTypes={wf.roleTypes}
          roleStatuses={wf.roleStatuses}
          onClose={() => { setEditRole(null); setAdding(false); }}
          onSaved={() => { setEditRole(null); setAdding(false); load(); }}
        />
      )}
    </div>
  );
}

function PayBenchmarkPanel({ settings, onApplied }: { settings: Workforce["settings"]; onApplied: () => void }) {
  const seed = (() => { try { return settings.payBenchmark ? (JSON.parse(settings.payBenchmark) as PayBenchmark) : null; } catch { return null; } })();
  const [bench, setBench] = useState<PayBenchmark | null>(seed);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true); setErr(null); setApplied(false);
    try {
      const d = await api<{ benchmark: PayBenchmark }>(`/api/projects/${PROJECT_ID}/workforce/benchmark-pay`, { method: "POST" });
      setBench(d.benchmark);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const apply = async () => {
    setApplying(true); setErr(null);
    try { await api(`/api/projects/${PROJECT_ID}/workforce/apply-benchmark`, { method: "POST" }); setApplied(true); onApplied(); }
    catch (e) { setErr((e as Error).message); } finally { setApplying(false); }
  };

  return (
    <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />Market pay benchmark</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">Replaces the placeholder salaries with figures grounded in the current South-East market and balanced against each other. Sarah is staged: training → solo → managing staff.</p>
        </div>
        <Button size="sm" onClick={generate} disabled={busy}>
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />{busy ? "Benchmarking…" : bench ? "Re-run" : "Benchmark & balance the team"}
        </Button>
      </div>
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}

      {bench && (
        <div className="mt-3 space-y-3">
          {bench.narrative && <p className="text-sm leading-relaxed">{bench.narrative}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground text-left border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">Role</th>
                  <th className="py-1.5 pr-3 font-medium">Market range (FTE)</th>
                  <th className="py-1.5 pr-3 font-medium">Recommended</th>
                  <th className="py-1.5 pr-3 font-medium">Loaded cost</th>
                  <th className="py-1.5 font-medium">Anchored to</th>
                </tr>
              </thead>
              <tbody>
                {bench.roles.map(b => (
                  <tr key={b.roleId} className="border-b border-border/60 align-top">
                    <td className="py-1.5 pr-3 font-medium">{b.name}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{formatGBP(b.marketLowGbp)}–{formatGBP(b.marketHighGbp)}</td>
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{formatGBP(b.salaryGbp)}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{formatGBP(b.loadedCostGbp)}</td>
                    <td className="py-1.5 text-muted-foreground">{b.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bench.sarahStages && bench.sarahStages.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold text-amber-900 mb-1.5">Sarah's pay as she grows into the role</p>
              <div className="space-y-1.5">
                {bench.sarahStages.map((s, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span className="font-semibold text-amber-900 shrink-0">{i + 1}. {s.stage}</span>
                    <span className="font-semibold shrink-0">{s.figure}</span>
                    <span className="text-amber-900/80">— {s.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bench.coherence && <p className="text-xs text-muted-foreground italic">{bench.coherence}</p>}
          {bench.watchOuts && bench.watchOuts.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {bench.watchOuts.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={apply} disabled={applying}>
              {applying ? "Applying…" : applied ? "Applied ✓" : "Apply these figures to the team"}
            </Button>
            {applied && <span className="text-xs text-muted-foreground">Salaries updated — cost chart now reflects these.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleEditor({ role, roleTypes, roleStatuses, onClose, onSaved }: {
  role: Role | null; roleTypes: string[]; roleStatuses: string[];
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [roleType, setRoleType] = useState(role?.roleType ?? "clinician");
  const [status, setStatus] = useState(role?.status ?? "planned");
  const [startDate, setStartDate] = useState(role?.startDate ?? "");
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(String(role?.leadTimeWeeks ?? 12));
  const [annualCostGbp, setAnnualCostGbp] = useState(String(role?.annualCostGbp ?? 0));
  const [triggerNote, setTriggerNote] = useState(role?.trigger?.note ?? "");
  const [notes, setNotes] = useState(role?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const body = {
      name, roleType, status, startDate: startDate || null,
      leadTimeWeeks: parseInt(leadTimeWeeks) || 0,
      annualCostGbp: parseFloat(annualCostGbp) || 0,
      trigger: { ...(role?.trigger ?? {}), note: triggerNote },
      notes,
      ...(role ? {} : { allocations: [] }),
    };
    try {
      if (role) await api(`/api/staff-roles/${role.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      else await api(`/api/projects/${PROJECT_ID}/staff-roles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{role ? `Edit ${role.name}` : "Add a role"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name / role title" value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={roleType} onValueChange={setRoleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roleStatuses.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-muted-foreground">Start (YYYY-MM)</label><Input placeholder="2026-11" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Lead (weeks)</label><Input type="number" value={leadTimeWeeks} onChange={e => setLeadTimeWeeks(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Cost £/yr</label><Input type="number" value={annualCostGbp} onChange={e => setAnnualCostGbp(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-muted-foreground">Trigger — when to hire</label><Textarea rows={2} value={triggerNote} onChange={e => setTriggerNote(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Notes</label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          {role && <p className="text-[11px] text-muted-foreground">Tip: site day-splits over time are set by the AI planner — hit "Re-plan with AI" to regenerate them.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !name.trim()} onClick={save}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Compensation & offer builder ─────────────────────────────────────────────

const PAY_MODEL_LABELS: Record<string, string> = {
  employed: "Employed (PAYE salary)",
  day_rate: "Self-employed day rate",
  revenue_share: "% of gross revenue",
  net_profit_share: "% of treatment profit",
  hybrid: "Hybrid (base + %)",
};

function LabeledNum({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input type="number" value={value} onChange={e => onChange(e.target.value)} className="h-8 text-sm mt-0.5" />
    </label>
  );
}

function CompensationPanel({ role, onSaved }: { role: Role; onSaved: () => void }) {
  const [model, setModel] = useState(role.payModel);
  const [params, setParams] = useState<PayParams>(role.compensation.params);
  const [saving, setSaving] = useState(false);
  const [offer, setOffer] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerErr, setOfferErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [pkg, setPkg] = useState<string | null>(role.packagePlan);
  const [pkgBusy, setPkgBusy] = useState(false);
  const [pkgErr, setPkgErr] = useState<string | null>(null);
  const [pkgCopied, setPkgCopied] = useState(false);

  const recommend = async () => {
    setPkgBusy(true); setPkgErr(null);
    try { const r = await api<{ plan: string }>(`/api/staff-roles/${role.id}/recommend-package`, { method: "POST" }); setPkg(r.plan); onSaved(); }
    catch (e) { setPkgErr(e instanceof Error ? e.message : "Failed"); }
    finally { setPkgBusy(false); }
  };
  const copyPkg = async () => { if (pkg) { await navigator.clipboard.writeText(pkg); setPkgCopied(true); setTimeout(() => setPkgCopied(false), 2000); } };

  const comp = role.compensation;
  const dirty = model !== role.payModel || JSON.stringify(params) !== JSON.stringify(role.compensation.params);
  const setP = (k: keyof PayParams, v: string) => setParams(p => ({ ...p, [k]: Number(v) || 0 }));

  const save = async () => {
    setSaving(true);
    try { await api(`/api/staff-roles/${role.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payModel: model, pay: params }) }); onSaved(); }
    finally { setSaving(false); }
  };

  const draftOffer = async () => {
    setOfferBusy(true); setOfferErr(null);
    try {
      const r = await api<{ offer: string }>(`/api/staff-roles/${role.id}/draft-offer`, { method: "POST" });
      setOffer(r.offer);
    } catch (e) { setOfferErr(e instanceof Error ? e.message : "Failed"); }
    finally { setOfferBusy(false); }
  };

  const copyOffer = async () => { if (offer) { await navigator.clipboard.writeText(offer); setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-4">
      {/* AI-curated recommendation — the default, lead with this */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">Recommended package</p>
          {pkg && <Button size="sm" variant="ghost" onClick={copyPkg}>{pkgCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}{pkgCopied ? "Copied" : "Copy"}</Button>}
        </div>
        {!pkg && (
          <p className="text-xs text-muted-foreground mb-2">Let the AI recommend the right pay structure from what you've told us — you don't have to pick a model or crunch the numbers.</p>
        )}
        <Button size="sm" disabled={pkgBusy} onClick={recommend}>
          {pkgBusy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Working it out… (1–2 min)</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{pkg ? "Re-recommend" : "Recommend the package"}</>}
        </Button>
        {pkgErr && <p className="text-xs text-destructive mt-1">{pkgErr}</p>}
        {pkg && <div className="mt-2 bg-accent/50 rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[460px] overflow-y-auto">{pkg}</div>}
      </div>

      {/* Manual controls — tucked away; the AI drives by default */}
      <button
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        onClick={() => setShowManual(s => !s)}
      >
        {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Adjust the numbers myself
      </button>

      {showManual && <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Pay model</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(PAY_MODEL_LABELS).map(m => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={`text-xs px-2.5 py-1 rounded-md border ${model === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {PAY_MODEL_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2.5">
          {model === "employed" && <>
            <LabeledNum label="FTE salary £/yr" value={params.salaryFteGbp} onChange={v => setP("salaryFteGbp", v)} />
            <LabeledNum label="Employer on-costs %" value={params.oncostPct} onChange={v => setP("oncostPct", v)} />
          </>}
          {model === "day_rate" && <LabeledNum label="Day rate £" value={params.dayRateGbp} onChange={v => setP("dayRateGbp", v)} />}
          {model === "revenue_share" && <LabeledNum label="Her % of gross" value={params.revSharePct} onChange={v => setP("revSharePct", v)} />}
          {model === "net_profit_share" && <LabeledNum label="Her % of net profit" value={params.revSharePct} onChange={v => setP("revSharePct", v)} />}
          {model === "hybrid" && <>
            <LabeledNum label="Base £/mo" value={params.baseRetainerMonthlyGbp} onChange={v => setP("baseRetainerMonthlyGbp", v)} />
            <LabeledNum label="Her share %" value={params.revSharePct} onChange={v => setP("revSharePct", v)} />
          </>}
        </div>
        {model === "net_profit_share" && (
          <p className="text-[11px] text-muted-foreground mt-1.5">Net profit = treatment takings minus the product/consumable/POM cost (the stock % from your financial model). She shares in the cost of goods — fairer to the business than a gross split.</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2.5 mb-1">Training ramp — paid but non-billable while she trains &amp; shadows</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <LabeledNum label="Training months (non-billable)" value={params.trainingMonths} onChange={v => setP("trainingMonths", v)} />
          <LabeledNum label="Training course budget £" value={params.trainingCostGbp} onChange={v => setP("trainingCostGbp", v)} />
          {(model === "revenue_share" || model === "net_profit_share") && (
            <LabeledNum label="Training stipend £/mo" value={params.trainingStipendMonthlyGbp} onChange={v => setP("trainingStipendMonthlyGbp", v)} />
          )}
        </div>
        {dirty && (
          <Button size="sm" className="mt-2.5" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Apply pay model
          </Button>
        )}
      </div>

      {comp.phases.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">The journey — month by month</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 pr-2">From</th>
                  <th className="py-1 pr-2">Site</th>
                  <th className="py-1 pr-2 text-right">Days/wk</th>
                  <th className="py-1 pr-2 text-right">She generates</th>
                  <th className="py-1 pr-2 text-right">She earns</th>
                  <th className="py-1 pr-2 text-right">Costs you</th>
                  <th className="py-1 text-right">Contributes</th>
                </tr>
              </thead>
              <tbody>
                {comp.phases.map((p, i) => (
                  <tr key={i} className={`border-b border-border/50 ${p.training ? "bg-amber-50/60" : ""}`}>
                    <td className="py-1 pr-2">{p.label}</td>
                    <td className="py-1 pr-2">{p.site}{p.training && <span className="ml-1 text-[9px] uppercase tracking-wide text-amber-700 font-semibold">training</span>}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.totalDays}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.training ? <span className="text-amber-700">£0 (learning)</span> : p.monthlyRevenue ? formatGBP(p.monthlyRevenue) : "—"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums font-medium">{formatGBP(p.monthlyGrossPay)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{formatGBP(p.monthlyLoadedCost)}</td>
                    <td className={`py-1 text-right tabular-nums font-medium ${p.monthlyContribution >= 0 ? "text-emerald-700" : "text-destructive"}`}>{formatGBP(p.monthlyContribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">"Contributes" = revenue she brings in, minus her cost and stock, before site rent/overheads. Monthly figures. Amber rows are the paid training/shadowing months (she costs but doesn't bill yet).</p>
          {comp.investmentBeforeProductive > 0 && (
            <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
              <span className="font-semibold">Cost to carry her before she bills a penny: {formatGBP(comp.investmentBeforeProductive)}</span>
              {" "}— {comp.trainingMonths} month{comp.trainingMonths === 1 ? "" : "s"} of pay while training/shadowing{comp.trainingCostGbp > 0 ? `, plus ${formatGBP(comp.trainingCostGbp)} course fees` : ""}. Bedhampton's income has to fund this while Abi is still there.
            </div>
          )}
        </div>
      )}

      {comp.comparison.length > 0 && comp.fullTime && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Compare the offer — at full time ({comp.fullTime.days}d, {comp.fullTime.site})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {comp.comparison.map(m => (
              <div key={m.model} className={`rounded-md border p-2.5 ${m.model === role.payModel ? "border-primary bg-accent/40" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{PAY_MODEL_LABELS[m.model]}</span>
                  {m.model === role.payModel && <Badge variant="secondary" className="text-[9px]">current</Badge>}
                </div>
                <div className="flex justify-between text-xs mt-1"><span className="text-muted-foreground">She earns</span><span className="tabular-nums font-medium">{formatGBP(m.annualGrossPay)}/yr</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">You keep (contribution)</span><span className={`tabular-nums font-medium ${m.monthlyContribution >= 0 ? "text-emerald-700" : "text-destructive"}`}>{formatGBP(m.monthlyContribution)}/mo</span></div>
              </div>
            ))}
          </div>
          {comp.paysForHerself != null && (
            <p className={`text-xs mt-2 font-medium ${comp.paysForHerself ? "text-emerald-700" : "text-amber-700"}`}>
              {comp.paysForHerself ? "On these figures she covers her own cost at full time." : "At full time she is borderline on covering her cost — check the assumptions."}
            </p>
          )}
        </div>
      )}
      </>}

      <div>
        {!offer && (
          <Button size="sm" variant="outline" disabled={offerBusy} onClick={draftOffer}>
            {offerBusy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Writing the offer… (~1 min)</> : <><FileText className="w-3.5 h-3.5 mr-1.5" />Draft the offer with AI</>}
          </Button>
        )}
        {offerErr && <p className="text-xs text-destructive mt-1">{offerErr}</p>}
        {offer && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">Draft offer for {role.name}</p>
              <Button size="sm" variant="ghost" onClick={copyOffer}>{copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}{copied ? "Copied" : "Copy"}</Button>
              <Button size="sm" variant="ghost" onClick={draftOffer} disabled={offerBusy}>{offerBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Regenerate"}</Button>
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto">{offer}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Includes a private "for Abi's eyes only" note at the end — delete that before sending. This is an outline, not a contract.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sarah's ramp: qualification dates → treatments vs pay vs cost ─────────────
function RampPlanner({ role, fin, onSaved }: { role: Role; fin: Workforce["fin"]; onSaved: () => void }) {
  const ym = (d: string) => (d || "").slice(0, 7);
  const addMonths = (start: string, n: number) => {
    const [y, m] = ym(start).split("-").map(Number);
    const dt = new Date(y, (m - 1) + n, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };
  const cmp = (a: string, b: string) => ym(a).localeCompare(ym(b));
  const label = (mk: string) => {
    const [y, m] = mk.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  };

  const p = role.compensation.params;
  const oncost = p.oncostPct || 15;
  const stockPct = fin.stockPct || 25;
  const money = (n: number) => n < 0 ? `-${formatGBP(Math.abs(n))}` : formatGBP(n);

  const startYm = role.startDate ? ym(role.startDate) : "2026-10";
  const defaultMilestones = (): RampMilestone[] => {
    const tm = p.trainingMonths || 3;
    return [
      { label: "Start — shadowing & training", date: startYm, pct: 0 },
      { label: "Signed off: toxin & basic filler", date: addMonths(startYm, tm), pct: 35 },
      { label: "Signed off: skin + more filler", date: addMonths(startYm, tm + 3), pct: 70 },
      { label: "Full menu — solo", date: addMonths(startYm, tm + 6), pct: 100 },
    ];
  };
  // Modest base + performance KPIs (the structure Abi wants: low fixed, upside from growth).
  const defaultKpi = (): KpiPackage => ({
    baseGbp: 30000,
    treatmentCommPct: 12,           // % of treatment revenue she personally generates
    retailPctOfTreatments: 12,      // retail/skincare sales assumed as % of her treatment revenue
    retailCommPct: 20,              // her commission on that retail
    growthBonusPct: 20,             // share of net profit ABOVE the site baseline
    growthBaselineMonthlyGbp: Math.round(fin.bedRevPerDay * 5 * 4.345 * (1 - stockPct / 100)),
  });
  // Her current NHS/GP paramedic package, for comparison as the dates roll on.
  const defaultJob = (): CurrentJob => ({ fteSalaryGbp: 46000, daysPerWeek: 4, annualGrowthPct: 3 });

  const [start, setStart] = useState(startYm);
  const [milestones, setMilestones] = useState<RampMilestone[]>(role.intake.rampMilestones?.length ? role.intake.rampMilestones : defaultMilestones());
  const [kpi, setKpi] = useState<KpiPackage>(role.intake.kpiPackage ?? defaultKpi());
  const [job, setJob] = useState<CurrentJob>(role.intake.currentJob ?? defaultJob());
  const [saving, setSaving] = useState(false);

  const baseMs = role.intake.rampMilestones ?? defaultMilestones();
  const baseKpi = role.intake.kpiPackage ?? defaultKpi();
  const baseJob = role.intake.currentJob ?? defaultJob();
  const dirty = start !== startYm
    || JSON.stringify(milestones) !== JSON.stringify(baseMs)
    || JSON.stringify(kpi) !== JSON.stringify(baseKpi)
    || JSON.stringify(job) !== JSON.stringify(baseJob);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/staff-roles/${role.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, intake: { ...role.intake, rampMilestones: milestones, kpiPackage: kpi, currentJob: job } }),
      });
      onSaved();
    } finally { setSaving(false); }
  };
  const setMs = (i: number, patch: Partial<RampMilestone>) => setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const setK = (patch: Partial<KpiPackage>) => setKpi(k => ({ ...k, ...patch }));
  const setJ = (patch: Partial<CurrentJob>) => setJob(j => ({ ...j, ...patch }));

  // Her mature (full-scope) monthly treatment capacity for a given month, from her site days.
  const matureRevFor = (mk: string) => {
    const applicable = role.allocations.filter(a => cmp(a.fromMonth, mk) <= 0).sort((a, b) => cmp(a.fromMonth, b.fromMonth));
    const a = applicable[applicable.length - 1] ?? role.allocations[0] ?? null;
    const bed = a?.bedhamptonDays ?? 5, win = a?.winchesterDays ?? 0, chi = a?.chichesterDays ?? 0;
    const rev = (bed * fin.bedRevPerDay + (win + chi) * fin.winMatureRevPerDay) * 4.345;
    return Math.round(rev || (5 * fin.bedRevPerDay * 4.345));
  };
  const pctAt = (mk: string) => {
    const passed = milestones.filter(m => cmp(m.date, mk) <= 0).sort((a, b) => cmp(a.date, b.date));
    return passed.length ? passed[passed.length - 1].pct : 0;
  };

  // Monthly ramp series — package = modest base + KPI earnings; compared to her current job.
  const HORIZON = 15;
  const trainingBaseMo = Math.round(kpi.baseGbp * 0.7 / 12); // reduced base while non-billable
  let cum = -(p.trainingCostGbp || 0); // course fees are a day-one investment
  const series = Array.from({ length: HORIZON }, (_, m) => {
    const mk = addMonths(start, m);
    const pct = pctAt(mk);
    const inTraining = pct === 0;
    const revenue = Math.round(pct / 100 * matureRevFor(mk));
    const netProfit = Math.round(revenue * (1 - stockPct / 100));
    const basePay = inTraining ? trainingBaseMo : Math.round(kpi.baseGbp / 12);
    const treatmentComm = inTraining ? 0 : Math.round(revenue * kpi.treatmentCommPct / 100);
    const retailSales = Math.round(revenue * kpi.retailPctOfTreatments / 100);
    const retailComm = inTraining ? 0 : Math.round(retailSales * kpi.retailCommPct / 100);
    const growthBonus = inTraining ? 0 : Math.round(Math.max(0, netProfit - kpi.growthBaselineMonthlyGbp) * kpi.growthBonusPct / 100);
    const pkg = basePay + treatmentComm + retailComm + growthBonus;
    const consum = Math.round(revenue * stockPct / 100);
    const cost = Math.round(pkg * (1 + oncost / 100)) + consum; // on-costs on all PAYE earnings + stock
    const net = revenue - cost;
    cum += net;
    // Her current job: 4 days = daysPerWeek/5 FTE, growing annually.
    const yrs = Math.floor(m / 12);
    const current = Math.round((job.fteSalaryGbp * (job.daysPerWeek / 5) * Math.pow(1 + job.annualGrowthPct / 100, yrs)) / 12);
    return { mk, label: label(mk), pct, inTraining, revenue, basePay, treatmentComm, retailComm, retailSales, growthBonus, pkg, cost, net, cum, current, annual: pkg * 12 };
  });
  const firstBilling = series.find(s => s.pct > 0);
  const beatsJob = series.find(s => s.pkg >= s.current && s.pct > 0);
  const payback = series.find(s => s.cum >= 0 && s.pct > 0);
  const matureRow = [...series].reverse().find(s => s.pct >= 100) ?? series[series.length - 1];

  return (
    <div className="space-y-3">
      {/* Milestone dates editor */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Her dates — when she can do what</p>
        <label className="flex items-center gap-2 text-sm mb-2">
          <span className="text-[11px] text-muted-foreground w-40 shrink-0">Start date</span>
          <Input type="month" className="h-8 text-sm w-40" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <div className="space-y-1.5">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="text-sm flex-1 min-w-[180px]">{m.label}</span>
              <Input type="month" className="h-8 text-sm w-36" value={ym(m.date)} onChange={e => setMs(i, { date: e.target.value })} />
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Input type="number" className="h-8 text-sm w-16 text-right" value={m.pct} onChange={e => setMs(i, { pct: Number(e.target.value) })} />
                % of full books
              </label>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">"% of full books" = how busy she can be at that stage vs a fully-signed-off clinician. £0 treatments until the first sign-off date.</p>
      </div>

      {/* Package: modest base + KPIs */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Her package — modest base, the rest earned on KPIs</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <LabeledNum label="Base salary £/yr (the floor)" value={kpi.baseGbp} onChange={v => setK({ baseGbp: Number(v) })} />
          <LabeledNum label="Treatment commission % of what she bills" value={kpi.treatmentCommPct} onChange={v => setK({ treatmentCommPct: Number(v) })} />
          <LabeledNum label="Retail: sales as % of treatments" value={kpi.retailPctOfTreatments} onChange={v => setK({ retailPctOfTreatments: Number(v) })} />
          <LabeledNum label="Retail commission % she keeps" value={kpi.retailCommPct} onChange={v => setK({ retailCommPct: Number(v) })} />
          <LabeledNum label="Growth bonus % of profit above baseline" value={kpi.growthBonusPct} onChange={v => setK({ growthBonusPct: Number(v) })} />
          <LabeledNum label="Growth baseline £/mo net profit" value={kpi.growthBaselineMonthlyGbp} onChange={v => setK({ growthBaselineMonthlyGbp: Number(v) })} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">KPIs all reward growth: she earns commission on the treatments she delivers and the retail she sells, plus a share of profit she grows the site beyond {formatGBP(kpi.growthBaselineMonthlyGbp)}/mo. During training she's on {formatGBP(trainingBaseMo)}/mo (70% of base), non-billable.</p>
      </div>

      {/* Current job comparison */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Compare vs her current job (paramedic)</p>
        <div className="grid grid-cols-3 gap-2">
          <LabeledNum label="Current full-time salary £/yr" value={job.fteSalaryGbp} onChange={v => setJ({ fteSalaryGbp: Number(v) })} />
          <LabeledNum label="Days/week she works there" value={job.daysPerWeek} onChange={v => setJ({ daysPerWeek: Number(v) })} />
          <LabeledNum label="Natural pay rise %/yr" value={job.annualGrowthPct} onChange={v => setJ({ annualGrowthPct: Number(v) })} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">Estimate: an HCPC paramedic with ~5 years plus a primary-care/GP-surgery role is around NHS Band 6–7 (~£46k full-time); at {job.daysPerWeek} days/week that's ~{formatGBP(Math.round(job.fteSalaryGbp * job.daysPerWeek / 5))}/yr today. Adjust to her real figure. It grows {job.annualGrowthPct}%/yr so you can see when our package overtakes it.</p>
      </div>

      {dirty && <Button size="sm" disabled={saving} onClick={save}>{saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Save package &amp; dates</Button>}

      {/* Headline verdicts */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs rounded-md border border-border px-2 py-1"><span className="text-muted-foreground">Bills from</span> <span className="font-semibold">{firstBilling ? firstBilling.label : "—"}</span></span>
        <span className="text-xs rounded-md border border-border px-2 py-1"><span className="text-muted-foreground">Her package beats her current job</span> <span className={`font-semibold ${beatsJob ? "text-emerald-700" : "text-amber-700"}`}>{beatsJob ? beatsJob.label : "not within 15 mo"}</span></span>
        <span className="text-xs rounded-md border border-border px-2 py-1"><span className="text-muted-foreground">At full books ≈</span> <span className="font-semibold">{formatGBP(matureRow.pkg)}/mo · {formatGBP(matureRow.annual)}/yr</span></span>
        <span className="text-xs rounded-md border border-border px-2 py-1"><span className="text-muted-foreground">Pays back the investment</span> <span className={`font-semibold ${payback ? "text-emerald-700" : "text-amber-700"}`}>{payback ? payback.label : "not within 15 mo"}</span></span>
      </div>

      {/* Chart: her package vs current job vs cost — hover shows the annual equivalent */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<RampTooltip />} />
            <Area type="monotone" name="Her package with us" dataKey="pkg" stroke="#587F72" fill="#587F72" fillOpacity={0.16} strokeWidth={2} />
            <Line type="monotone" name="Her current job" dataKey="current" stroke="#1F2A44" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" name="Cost to you" dataKey="cost" stroke="#b45309" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground -mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: "#587F72" }} />Her package with us (base + KPIs)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ background: "#1F2A44" }} />Her current paramedic job</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ background: "#b45309" }} />Cost to you</span>
        <span className="italic">Hover any month for the annual-equivalent.</span>
      </div>

      {/* Month-by-month table — the full breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1 pr-2">Month</th>
              <th className="py-1 pr-2">Stage</th>
              <th className="py-1 pr-2 text-right">Base</th>
              <th className="py-1 pr-2 text-right">Treatment</th>
              <th className="py-1 pr-2 text-right">Retail</th>
              <th className="py-1 pr-2 text-right">Growth</th>
              <th className="py-1 pr-2 text-right">Package/mo</th>
              <th className="py-1 pr-2 text-right">≈ /yr</th>
              <th className="py-1 pr-2 text-right">Current job</th>
              <th className="py-1 text-right">Cost to you</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s, i) => (
              <tr key={i} className={`border-b border-border/50 ${s.inTraining ? "bg-amber-50/60" : ""} ${beatsJob && s.mk === beatsJob.mk ? "ring-1 ring-emerald-300" : ""}`}>
                <td className="py-1 pr-2 whitespace-nowrap">{s.label}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{s.inTraining ? <span className="text-amber-700">training</span> : `${s.pct}%`}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatGBP(s.basePay)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{s.treatmentComm ? formatGBP(s.treatmentComm) : "—"}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{s.retailComm ? formatGBP(s.retailComm) : "—"}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{s.growthBonus ? formatGBP(s.growthBonus) : "—"}</td>
                <td className="py-1 pr-2 text-right tabular-nums font-semibold">{formatGBP(s.pkg)}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{formatGBP(s.annual)}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{formatGBP(s.current)}</td>
                <td className="py-1 text-right tabular-nums text-[#b45309]">{formatGBP(s.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Treatments assume she hits the "% of full books" for each stage on her site days ({formatGBP(fin.bedRevPerDay)}/clinician-day at Bedhampton). "Package/mo" = base + treatment commission + retail commission + growth bonus. "≈ /yr" is that month annualised (also on hover). "Cost to you" = her package + {oncost}% employer on-costs + {stockPct}% product/stock — always above her pay. Edit anything above and it recomputes.
      </p>
    </div>
  );
}

// Chart tooltip that shows each month's package with its annual equivalent.
function RampTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: { pkg: number; current: number; cost: number; pct: number; revenue: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-md p-2.5 text-xs shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      <p><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: "#587F72" }} />Her package: <b>{formatGBP(d.pkg)}/mo</b> · <b>≈ {formatGBP(d.pkg * 12)}/yr</b></p>
      <p className="text-muted-foreground"><span className="inline-block w-2 h-0.5 mr-1.5 align-middle" style={{ background: "#1F2A44" }} />Current job: {formatGBP(d.current)}/mo · ≈ {formatGBP(d.current * 12)}/yr</p>
      <p style={{ color: "#b45309" }}><span className="inline-block w-2 h-0.5 mr-1.5 align-middle" style={{ background: "#b45309" }} />Cost to you: {formatGBP(d.cost)}/mo</p>
      {d.pct > 0 && <p className="text-muted-foreground mt-0.5">{d.pct}% of full books · treatments {formatGBP(d.revenue)}/mo</p>}
    </div>
  );
}

// ── Practitioner onboarding & readiness ──────────────────────────────────────

function ReadinessPanel({ role, fin, onSaved }: { role: Role; fin: Workforce["fin"]; onSaved: () => void }) {
  const [intake, setIntake] = useState<Intake>({
    registration: role.intake.registration ?? "",
    isPrescriber: role.intake.isPrescriber ?? false,
    scope: role.intake.scope ?? [],
    readyBy: role.intake.readyBy ?? "",
    currentTraining: role.intake.currentTraining ?? "",
    notes: role.intake.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(role.readinessPlan);
  const [copied, setCopied] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const dirty = JSON.stringify(intake) !== JSON.stringify({
    registration: role.intake.registration ?? "", isPrescriber: role.intake.isPrescriber ?? false,
    scope: role.intake.scope ?? [], readyBy: role.intake.readyBy ?? "",
    currentTraining: role.intake.currentTraining ?? "", notes: role.intake.notes ?? "",
  });

  const toggleScope = (s: string) => setIntake(i => ({ ...i, scope: i.scope?.includes(s) ? i.scope.filter(x => x !== s) : [...(i.scope ?? []), s] }));

  const saveIntake = async () => {
    setSaving(true);
    try { await api(`/api/staff-roles/${role.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) }); onSaved(); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      if (dirty) await api(`/api/staff-roles/${role.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) });
      const r = await api<{ plan: string }>(`/api/staff-roles/${role.id}/readiness-plan`, { method: "POST" });
      setPlan(r.plan); onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const copyPlan = async () => { if (plan) { await navigator.clipboard.writeText(plan); setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About this practitioner</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Professional registration</span>
            <Input className="h-8 text-sm mt-0.5" placeholder="e.g. Registered Paramedic (HCPC)" value={intake.registration} onChange={e => setIntake(i => ({ ...i, registration: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Ready by (seeing clients solo)</span>
            <Input type="date" className="h-8 text-sm mt-0.5" value={intake.readyBy} onChange={e => setIntake(i => ({ ...i, readyBy: e.target.value }))} />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-2 text-sm">
          <input type="checkbox" checked={intake.isPrescriber} onChange={e => setIntake(i => ({ ...i, isPrescriber: e.target.checked }))} />
          Independent prescriber
        </label>
        <div className="mt-2">
          <span className="text-[11px] text-muted-foreground">What she'll deliver</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SCOPE_OPTIONS.map(s => (
              <button key={s} onClick={() => toggleScope(s)}
                className={`text-[11px] px-2 py-1 rounded-md border ${intake.scope?.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="block mt-2">
          <span className="text-[11px] text-muted-foreground">Training / experience she already has (optional — the AI will ask if blank)</span>
          <Textarea rows={2} className="text-sm mt-0.5" placeholder="e.g. Level 7 toxin & filler, 3 years experience, complications trained…" value={intake.currentTraining} onChange={e => setIntake(i => ({ ...i, currentTraining: e.target.value }))} />
        </label>
        {dirty && <Button size="sm" className="mt-2" disabled={saving} onClick={saveIntake}>{saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Save details</Button>}
      </div>

      {/* The ramp — dates → treatments vs pay vs cost (the useful bit) */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><PoundSterling className="w-3.5 h-3.5" />Ramp — treatments vs pay vs cost</p>
        <RampPlanner role={role} fin={fin} onSaved={onSaved} />
      </div>

      {/* Detailed AI training/compliance notes — collapsed by default */}
      <div className="border-t border-border pt-3">
        <button className="text-xs font-medium text-primary flex items-center gap-1 hover:opacity-80" onClick={() => setShowNotes(v => !v)}>
          <Sparkles className="w-3.5 h-3.5" />Detailed training & compliance notes {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showNotes && (
          <div className="mt-3 space-y-3">
            <div>
              <Button size="sm" variant="outline" disabled={busy} onClick={generate}>
                {busy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Building the notes… (1–2 min)</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{plan ? "Regenerate notes" : "Generate training & compliance notes"}</>}
              </Button>
              {err && <p className="text-xs text-destructive mt-1">{err}</p>}
            </div>
            {plan && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">What she needs — training, sign-off, insurance</p>
                  <Button size="sm" variant="ghost" onClick={copyPlan}>{copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}{copied ? "Copied" : "Copy"}</Button>
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[460px] overflow-y-auto">{plan}</div>
                <p className="text-[11px] text-muted-foreground mt-1">AI-generated for guidance — verify all regulatory points (marked "CONFIRM:") with her indemnifier, HCPC and your CQC lead.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
