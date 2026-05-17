import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Building2, TrendingDown, Shield, ListOrdered, AlertTriangle, ArrowLeftRight, FileText, ChevronRight, CheckCircle2, Clock, AlertCircle, BadgeCheck, Star } from "lucide-react";
import { Link } from "wouter";

const API_BASE = "/api";
const PROJECT_ID = 1;
const CACHE_KEY = "leaseStrategyV2_v1";
const CACHE_AT_KEY = "leaseStrategyV2At_v1";
const STALE_MS = 24 * 60 * 60 * 1000;

type OpeningPosition = {
  openingOfferRent: number;
  targetSettlement: number;
  walkAwayRent?: number;         // legacy — single value
  walkAwayRentMax?: number;      // max acceptable rent (all 3 critical concessions secured = asking rent)
  walkAwayRentMin?: number;      // min acceptable rent (no concessions = opening offer)
  walkAwayExplanation?: string;  // plain-English conditional explanation
  discountJustification: string[];
  walkAwayJustification: string;
  negotiationApproach: string;
};
type CovenantStrength = {
  rating: "strong" | "moderate" | "developing";
  headline: string;
  strengths: { title: string; detail: string; level: "high" | "medium" | "low" }[];
};
type Concession = {
  rank: number;
  name: string;
  category: string;
  ask: string;
  minimum: string;
  financialImpactGbp: number;
  impactBasis: string;
  tenantPosition: string;
  priority: "critical" | "high" | "medium";
};
type SequenceStage = {
  stage: number;
  title: string;
  objective: string;
  actions: string[];
  status: "ready" | "in-progress" | "pending";
};
type CounterOfferFramework = {
  holdFirm: { item: string; reason: string; exposureGbp: number }[];
  canConcede: { item: string; condition: string; financialImpactGbp: number }[];
  walkAwayTriggers: { condition: string; financialExposure: string; modelBasis: string }[];
};
type DealBreaker = { condition: string; threshold: string; modelBasis: string; exposureGbp: number };
type HoTClauseV2 = {
  clause: string;
  status: "confirmed" | "negotiate" | "red-flag" | "must-confirm";
  yourPosition: string;
  landlordPosition: string;
  financialImpact: string;
  importance: "critical" | "high" | "medium";
};
type LeaseStrategyV2 = {
  openingPosition: OpeningPosition;
  covenantStrength: CovenantStrength;
  concessions: Concession[];
  sequencing: SequenceStage[];
  counterOfferFramework: CounterOfferFramework;
  dealBreakers: DealBreaker[];
  headsOfTerms: HoTClauseV2[];
  generatedAt: string;
};

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString()}`;
}
function fmtAge(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

const PRIORITY_CFG = {
  critical: { label: "Critical", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700" },
  high:     { label: "High",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700" },
  medium:   { label: "Medium",   cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700" },
};
const STATUS_CFG = {
  "confirmed":    { label: "Confirmed",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  "negotiate":    { label: "Negotiate",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  "red-flag":     { label: "Red Flag",     cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  "must-confirm": { label: "Must Confirm", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};
const IMP_CFG: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400 font-bold",
  high:     "text-amber-600 dark:text-amber-400 font-semibold",
  medium:   "text-muted-foreground",
};
const SEQ_STATUS = {
  ready:       { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, cls: "border-emerald-300 dark:border-emerald-700", bar: "bg-emerald-500" },
  "in-progress": { icon: <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />, cls: "border-amber-300 dark:border-amber-700", bar: "bg-amber-500" },
  pending:     { icon: <Clock className="w-4 h-4 text-muted-foreground/50" />, cls: "border-border/50", bar: "bg-muted/30" },
};

export default function LeaseStrategyPage() {
  const [strategy, setStrategy] = useState<LeaseStrategyV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const run = useCallback((force = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 95_000);
    fetch(`${API_BASE}/projects/${PROJECT_ID}/go-no-go/lease-strategy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Failed")))
      .then((d: LeaseStrategyV2) => {
        clearTimeout(timer);
        setStrategy(d);
        setCachedAt(d.generatedAt);
        setLoading(false);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); localStorage.setItem(CACHE_AT_KEY, d.generatedAt); } catch {}
      })
      .catch((e: unknown) => {
        clearTimeout(timer);
        const msg = e instanceof Error && e.name === "AbortError"
          ? "Request timed out — try again."
          : typeof e === "string" ? e : "Failed to generate strategy. Please try again.";
        setError(msg);
        setLoading(false);
      });
    void force;
  }, [loading]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const at = localStorage.getItem(CACHE_AT_KEY);
      if (cached && at) {
        setStrategy(JSON.parse(cached) as LeaseStrategyV2);
        setCachedAt(at);
        if (Date.now() - new Date(at).getTime() > STALE_MS) run();
        return;
      }
    } catch {}
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const op = strategy?.openingPosition;
  const cs = strategy?.covenantStrength;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Building2 className="w-4 h-4 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Lease & Offer Strategy</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            9A Jewry Street, Winchester — live negotiation tool, drawn from your financial model
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {cachedAt && !loading && (
            <span className="text-[10px] text-muted-foreground/60">Generated {fmtAge(cachedAt)}</span>
          )}
          <button
            onClick={() => run(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Generating…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && !strategy && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3 animate-pulse">
              <div className="h-3 bg-muted/60 rounded w-40" />
              <div className="h-3 bg-muted/40 rounded w-full" />
              <div className="h-3 bg-muted/40 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-px" />
          <div>
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            <button onClick={() => run(true)} className="text-xs text-red-500 underline mt-1">Try again</button>
          </div>
        </div>
      )}

      {strategy && (
        <>
          {/* ── 1. Opening Position ───────────────────────────────────────── */}
          {op && (
            <section className="rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/60 dark:from-blue-950/20 to-transparent overflow-hidden">
              <div className="px-4 py-2.5 border-b border-blue-200/60 dark:border-blue-800/60 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Opening Position</span>
              </div>
              <div className="p-4 space-y-4">
                {/* Opening + Target grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Opening Offer", value: op.openingOfferRent, note: "Lead with this", cls: "border-blue-300 dark:border-blue-700 bg-blue-100/40 dark:bg-blue-900/20" },
                    { label: "Target Settlement", value: op.targetSettlement, note: "Aim to land here", cls: "border-border/50 bg-card" },
                  ].map(({ label, value, note, cls }) => (
                    <div key={label} className={`rounded-lg border p-3 text-center ${cls}`}>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                      <div className="text-xl font-bold text-foreground">{fmt(value)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-[9px] text-muted-foreground/70 mt-0.5">{note}</div>
                    </div>
                  ))}
                </div>

                {/* Walk-Away Range — conditional ceiling */}
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/15 p-3 space-y-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Walk-Away Rent — Conditional Range</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-red-200/70 dark:border-red-700/50 bg-white/70 dark:bg-red-950/30 p-2.5 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Maximum — all concessions secured</div>
                      <div className="text-xl font-bold text-red-700 dark:text-red-300">{fmt(op.walkAwayRentMax ?? op.walkAwayRent ?? 0)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">= asking rent — hard ceiling</div>
                    </div>
                    <div className="rounded border border-red-300/70 dark:border-red-700/50 bg-red-100/40 dark:bg-red-950/40 p-2.5 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Minimum — no concessions</div>
                      <div className="text-xl font-bold text-red-900 dark:text-red-200">{fmt(op.walkAwayRentMin ?? op.openingOfferRent)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">= opening offer — walk away</div>
                    </div>
                  </div>
                  {op.walkAwayExplanation ? (
                    <p className="text-[11px] text-foreground/85 leading-relaxed italic border-l-2 border-red-300 dark:border-red-700 pl-2.5">{op.walkAwayExplanation}</p>
                  ) : op.walkAwayJustification ? (
                    <div className="text-[11px] text-foreground/80 leading-relaxed border-l-2 border-red-300 dark:border-red-700 pl-2.5">
                      <span className="font-semibold text-red-600 dark:text-red-400">Walk-away basis: </span>{op.walkAwayJustification}
                    </div>
                  ) : null}
                </div>

                {/* Transparent discount maths */}
                {op.openingOfferRent > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                    <span className="font-medium text-foreground">Maths:</span>
                    <span>Asking rent</span>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">−12% (−{fmt(op.walkAwayRentMax ? op.walkAwayRentMax - op.openingOfferRent : 0)})</span>
                    <span className="text-muted-foreground/50">=</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-300">{fmt(op.openingOfferRent)}/mo opening offer</span>
                  </div>
                )}

                {/* Why 12% justified */}
                {op.discountJustification?.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Why 12% Is Justified</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {op.discountJustification.map((j: any, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/75 bg-muted/30 rounded px-2 py-1.5">
                          <ChevronRight className="w-3 h-3 shrink-0 mt-px text-blue-500" />
                          {typeof j === "string" ? j : j.text ?? j.justification ?? j.reason ?? JSON.stringify(j)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approach narrative */}
                {op.negotiationApproach && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Strategic Approach</div>
                    <p className="text-xs text-foreground/85 leading-relaxed">{op.negotiationApproach}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── 2. Covenant Strength ──────────────────────────────────────── */}
          {cs && (
            <section className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-gradient-to-b from-emerald-50/40 dark:from-emerald-950/10 to-transparent overflow-hidden">
              <div className="px-4 py-2.5 border-b border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Covenant Strength — Lead With This</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${cs.rating === "strong" ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700" : cs.rating === "moderate" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-muted text-muted-foreground border-border"}`}>
                  {cs.rating}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {cs.headline && (
                  <div className="rounded-md bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Opening statement to landlord</div>
                    <p className="text-xs italic text-foreground/85 leading-relaxed">"{cs.headline}"</p>
                  </div>
                )}
                {cs.strengths?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cs.strengths.map((s, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${s.level === "high" ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20" : s.level === "medium" ? "border-border/60 bg-muted/20" : "border-border/30 bg-muted/10"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BadgeCheck className={`w-3.5 h-3.5 shrink-0 ${s.level === "high" ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                          <span className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">{s.title}</span>
                        </div>
                        <p className="text-[11px] text-foreground/75 leading-snug">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── 3. Concession Priority Order ──────────────────────────────── */}
          {strategy.concessions?.length > 0 && (
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 bg-muted/20">
                <ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Concession Priority — Ranked by Financial Impact</span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">Win these before rent is settled</span>
              </div>
              <div className="divide-y divide-border/50">
                {strategy.concessions.map((c) => {
                  const pc = PRIORITY_CFG[c.priority] ?? PRIORITY_CFG.medium;
                  return (
                    <div key={c.rank} className="p-4 flex gap-4 items-start">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">#{c.rank}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-foreground">{c.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${pc.cls}`}>{pc.label}</span>
                          {c.financialImpactGbp > 0 && (
                            <span className="text-xs font-bold text-foreground bg-muted/50 border border-border/50 rounded px-2 py-0.5">
                              {fmt(c.financialImpactGbp)} impact
                            </span>
                          )}
                        </div>
                        {c.impactBasis && (
                          <div className="text-[10px] text-muted-foreground mb-1.5">Impact basis: {c.impactBasis}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-1.5">
                          <div><span className="text-muted-foreground mr-1">Ask:</span><span className="text-foreground/85 font-medium">{c.ask}</span></div>
                          <div><span className="text-muted-foreground mr-1">Minimum:</span><span className="text-foreground/85">{c.minimum}</span></div>
                        </div>
                        {c.tenantPosition && (
                          <p className="text-[11px] text-foreground/70 leading-snug italic">"{c.tenantPosition}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 4. Sequencing ─────────────────────────────────────────────── */}
          {strategy.sequencing?.length > 0 && (
            <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-gradient-to-b from-amber-50/30 dark:from-amber-950/10 to-transparent overflow-hidden">
              <div className="px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-800/60 flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Negotiation Sequencing — What Happens in What Order</span>
              </div>
              <div className="p-4">
                <div className="relative space-y-3">
                  {strategy.sequencing.map((stage, idx) => {
                    const sc = SEQ_STATUS[stage.status] ?? SEQ_STATUS.pending;
                    return (
                      <div key={stage.stage} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`rounded-full border-2 w-8 h-8 flex items-center justify-center bg-background ${sc.cls}`}>
                            {sc.icon}
                          </div>
                          {idx < strategy.sequencing.length - 1 && (
                            <div className={`w-0.5 flex-1 mt-1 min-h-4 ${sc.bar}`} />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">Stage {stage.stage}: {stage.title}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${stage.status === "ready" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : stage.status === "in-progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>{stage.status.replace("-", " ")}</span>
                          </div>
                          {stage.objective && (
                            <p className="text-[11px] text-muted-foreground leading-snug mb-1.5">{stage.objective}</p>
                          )}
                          {stage.actions?.length > 0 && (
                            <ul className="space-y-0.5">
                              {stage.actions.map((a: any, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                                  <span className="text-amber-500 shrink-0 font-bold mt-px">→</span>
                                  {typeof a === "string" ? a : a.text ?? a.action ?? a.task ?? JSON.stringify(a)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── 5. Heads of Terms Checklist ───────────────────────────────── */}
          {strategy.headsOfTerms?.length > 0 && (
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 bg-muted/20">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Heads of Terms Checklist — Your Position on Every Clause</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      {["Clause", "Status", "Your Position", "Typical Landlord", "£ Impact", "Priority"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.headsOfTerms.map((item, i) => {
                      const sc = STATUS_CFG[item.status] ?? STATUS_CFG.negotiate;
                      return (
                        <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10">
                          <td className="px-3 py-2.5 font-medium text-foreground/90 whitespace-nowrap">{item.clause}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${sc.cls}`}>{sc.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-foreground/80 max-w-[160px] leading-snug">{item.yourPosition}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] leading-snug">{item.landlordPosition}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] leading-snug text-[10px]">{item.financialImpact}</td>
                          <td className={`px-3 py-2.5 whitespace-nowrap capitalize text-[10px] ${IMP_CFG[item.importance] ?? ""}`}>{item.importance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── 6. Counter-Offer Framework ────────────────────────────────── */}
          {strategy.counterOfferFramework && (
            <section className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-gradient-to-b from-indigo-50/30 dark:from-indigo-950/10 to-transparent overflow-hidden">
              <div className="px-4 py-2.5 border-b border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">If They Counter — What to Hold, Concede, or Walk</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Hold Firm */}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2">Hold Firm</div>
                  <div className="space-y-2">
                    {strategy.counterOfferFramework.holdFirm?.map((h, i) => (
                      <div key={i} className="rounded-lg border border-red-200/60 dark:border-red-800/60 bg-red-50/40 dark:bg-red-950/20 p-2.5">
                        <div className="text-[11px] font-semibold text-foreground mb-0.5">{h.item}</div>
                        <p className="text-[10px] text-foreground/70 leading-snug">{h.reason}</p>
                        {h.exposureGbp > 0 && (
                          <div className="text-[9px] text-red-600 dark:text-red-400 font-medium mt-1">{fmt(h.exposureGbp)} exposure if lost</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Can Concede */}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Can Concede</div>
                  <div className="space-y-2">
                    {strategy.counterOfferFramework.canConcede?.map((c, i) => (
                      <div key={i} className="rounded-lg border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 p-2.5">
                        <div className="text-[11px] font-semibold text-foreground mb-0.5">{c.item}</div>
                        <p className="text-[10px] text-foreground/70 leading-snug">{c.condition}</p>
                        {c.financialImpactGbp > 0 && (
                          <div className="text-[9px] text-amber-600 dark:text-amber-400 mt-1">{fmt(c.financialImpactGbp)} cost of concession</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Walk Away */}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Walk If Combined</div>
                  <div className="space-y-2">
                    {strategy.counterOfferFramework.walkAwayTriggers?.map((w, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                        <div className="text-[11px] font-semibold text-foreground mb-0.5">{w.condition}</div>
                        <p className="text-[10px] text-muted-foreground leading-snug">{w.financialExposure}</p>
                        <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5 italic">{w.modelBasis}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── 7. Deal-Breakers ──────────────────────────────────────────── */}
          {strategy.dealBreakers?.length > 0 && (
            <section className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-red-200/60 dark:border-red-800/60 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Deal-Breakers — Model-Derived Walk-Away Conditions</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {strategy.dealBreakers.map((d, i) => (
                  <div key={i} className="rounded-lg border border-red-200 dark:border-red-700 bg-white/60 dark:bg-red-950/30 p-3">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-red-500 font-bold text-base leading-none mt-0.5">✕</span>
                      <span className="text-sm font-semibold text-red-900 dark:text-red-200 leading-snug">{d.condition}</span>
                    </div>
                    {d.threshold && (
                      <div className="text-[10px] text-red-700 dark:text-red-300 font-medium mb-1">Threshold: {d.threshold}</div>
                    )}
                    {d.modelBasis && (
                      <p className="text-[10px] text-foreground/70 leading-snug mb-1">{d.modelBasis}</p>
                    )}
                    {d.exposureGbp > 0 && (
                      <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                        {fmt(d.exposureGbp)} financial exposure
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Footer note ───────────────────────────────────────────────── */}
          <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
            Strategy auto-derives numbers from your financial model — refresh after changing rent, ACV, occupancy, capital, or Bedhampton inputs.
          </p>
        </>
      )}
    </div>
  );
}
