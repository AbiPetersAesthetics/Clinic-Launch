import { useState, useEffect, useCallback } from "react";
import {
  useGetProjectDashboard,
  useGetFinancialModel,
  useGetProjectCashflow,
  useListFixedCostItems,
  useGetPhasesWithTasks,
  useGetOptimisationAnalysis,
  useListDecisions,
  useListComplianceItems,
  useGetComplianceSummary,
  useListCqcMilestones,
  useListProperties,
} from "@workspace/api-client-react";
import { Printer, Loader2, AlertTriangle } from "lucide-react";

const PROJECT_ID = 1;
const API_BASE = "/api";
const fmt = (n?: number | null, digits = 0) =>
  n == null ? "—" : `£${n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n?: number | null, digits = 0) =>
  n == null ? "—" : `${Number(n).toFixed(digits)}%`;
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="print-section-title mb-4 mt-8 first:mt-0">
      <div className="flex items-baseline gap-3 border-b-2 border-[#2d5016] pb-1.5">
        <h2 className="text-lg font-bold tracking-tight text-[#2d5016] uppercase">{label}</h2>
        {sub && <span className="text-xs text-gray-500 font-normal">{sub}</span>}
      </div>
    </div>
  );
}

function SubTitle({ label }: { label: string }) {
  return (
    <h3 className="text-sm font-bold text-gray-800 mt-5 mb-2 border-b border-gray-200 pb-1">{label}</h3>
  );
}

function KpiGrid({ items }: { items: { label: string; value: string; sub?: string; alert?: boolean }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {items.map(({ label, value, sub, alert }) => (
        <div key={label} className={`rounded border p-3 ${alert ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">{label}</div>
          <div className={`text-base font-bold ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</div>
          {sub && <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value: string | number | React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <div className="w-48 shrink-0 text-gray-500 text-xs">{label}</div>
      <div className={`flex-1 text-gray-900 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function TagBadge({ label, color }: { label: string; color: string }) {
  const cls: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    red: "bg-red-100 text-red-800 border-red-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls[color] ?? cls.gray}`}>
      {label}
    </span>
  );
}

function Assumption({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex gap-2 py-1 border-b border-gray-100 last:border-0 text-xs">
      <div className="w-52 shrink-0 text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900 flex-1">{value}</div>
      {note && <div className="text-gray-400 text-[10px] shrink-0">{note}</div>}
    </div>
  );
}

// ── Status label helpers ───────────────────────────────────────────────────────
const TASK_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress",
  complete: "Complete", blocked: "Blocked", deferred: "Deferred",
};
const TASK_STATUS_COLOR: Record<string, string> = {
  not_started: "gray", in_progress: "blue", complete: "green", blocked: "red", deferred: "amber",
};
const RISK_COLOR: Record<string, string> = {
  low: "green", medium: "amber", high: "red", critical: "red",
};
const COMPLIANCE_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", complete: "Complete",
  not_applicable: "N/A", needs_review: "Needs Review",
};
const COMPLIANCE_STATUS_COLOR: Record<string, string> = {
  not_started: "gray", in_progress: "blue", complete: "green",
  not_applicable: "gray", needs_review: "amber",
};

// ── Main Export Page ──────────────────────────────────────────────────────────

export default function ExportPage() {
  const [marketing, setMarketing] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lifestyle, setLifestyle] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawFetchDone, setRawFetchDone] = useState(false);
  const [goNoGo, setGoNoGo] = useState<any>(null);
  const [leaseStrategy, setLeaseStrategy] = useState<any>(null);
  const [bLiveData, setBLiveData] = useState<any>(null);

  // ── API hooks ────────────────────────────────────────────────────────────────
  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID);
  const { data: financialModel } = useGetFinancialModel(PROJECT_ID);
  const { data: cashflow } = useGetProjectCashflow(PROJECT_ID, { scenario: "realistic" } as any);
  const { data: fixedCosts } = useListFixedCostItems(PROJECT_ID);
  const { data: phasesWithTasks } = useGetPhasesWithTasks(PROJECT_ID);
  const { data: optimisation } = useGetOptimisationAnalysis(PROJECT_ID);
  const { data: decisions } = useListDecisions(PROJECT_ID);
  const { data: complianceItems } = useListComplianceItems(PROJECT_ID);
  const { data: complianceSummary } = useGetComplianceSummary(PROJECT_ID);
  const { data: cqcMilestones } = useListCqcMilestones(PROJECT_ID);
  const { data: properties } = useListProperties(PROJECT_ID);

  // ── Raw fetches ───────────────────────────────────────────────────────────────
  const fetchRaw = useCallback(async () => {
    try {
      const [mktRes, compRes, lifeRes, bLiveRes] = await Promise.all([
        fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing`),
        fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors`),
        fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`),
        fetch(`${API_BASE}/bedhampton/summary`),
      ]);
      if (mktRes.ok) {
        const mktData = await mktRes.json();
        setMarketing(Array.isArray(mktData) ? mktData : (mktData?.items ?? []));
      }
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompetitors(Array.isArray(compData) ? compData : (compData?.competitors ?? compData?.items ?? []));
      }
      if (lifeRes.ok) setLifestyle(await lifeRes.json());
      if (bLiveRes.ok) setBLiveData(await bLiveRes.json());
    } catch (e) {
      setFetchError("Some data could not be loaded.");
    } finally {
      setRawFetchDone(true);
    }
  }, []);

  useEffect(() => { fetchRaw(); }, [fetchRaw]);

  // ── AI analysis from cache ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const gng = localStorage.getItem("goNoGoResult_v2");
      if (gng) setGoNoGo(JSON.parse(gng));
      const ls = localStorage.getItem("leaseStrategyResult_v1");
      if (ls) setLeaseStrategy(JSON.parse(ls));
    } catch {}
  }, []);

  // ── Loading state ─────────────────────────────────────────────────────────────
  const isLoading = !dashboard || !financialModel || !rawFetchDone;

  // ── Derived data ──────────────────────────────────────────────────────────────
  const totalFixedCosts = (fixedCosts ?? []).reduce((s, i) => s + i.amountGbp, 0);
  const activeProperty = (properties ?? []).find(p => p.isActiveForProject) ?? null;
  const otherProperties = (properties ?? []).filter(p => !p.isActiveForProject);

  // Lifestyle extras (JSON fields)
  const lifestyleExtras = (() => { try { return JSON.parse(lifestyle?.extrasJson ?? "{}"); } catch { return {}; } })();
  const lifestyleNonNegotiables: string[] = Array.isArray(lifestyleExtras.nonNegotiablesList) ? lifestyleExtras.nonNegotiablesList : [];
  const lifestyleSuccessVision = lifestyleExtras.successVision12m ?? lifestyle?.successVision ?? "";
  const lifestyleFamilySchedule = (() => { try { return JSON.parse(lifestyle?.familyScheduleJson ?? "{}"); } catch { return {}; } })();

  // Data completeness
  const completeness = [
    { label: "AI Recommendation", full: !!goNoGo },
    { label: "Financial Model", full: !!financialModel },
    { label: "Fixed Costs", full: !!(fixedCosts && fixedCosts.length > 0) },
    { label: "Cashflow", full: !!(cashflow && (cashflow as any[]).length > 0) },
    { label: "Project Plan", full: !!(phasesWithTasks && phasesWithTasks.length > 0) },
    { label: "Optimisation", full: !!optimisation },
    { label: "Properties", full: !!(properties && properties.length > 0) },
    { label: "Competitors", full: competitors.length > 0 },
    { label: "Compliance", full: !!(complianceItems && complianceItems.length > 0) },
    { label: "Decisions", full: !!(decisions && decisions.length > 0) },
    { label: "Marketing", full: marketing.length > 0 },
    { label: "Life Design", full: !!lifestyle },
    { label: "Bedhampton Live", full: !!bLiveData },
  ];
  const fullCount = completeness.filter(c => c.full).length;
  const emptyCount = completeness.filter(c => !c.full).length;

  const complianceBySection: Record<string, any[]> = {};
  (complianceItems ?? []).forEach(item => {
    if (!complianceBySection[item.section]) complianceBySection[item.section] = [];
    complianceBySection[item.section].push(item);
  });

  const marketingByCategory: Record<string, any[]> = {};
  marketing.forEach(item => {
    if (!marketingByCategory[item.category]) marketingByCategory[item.category] = [];
    marketingByCategory[item.category].push(item);
  });

  const totalProjectCostSelected = (phasesWithTasks ?? []).reduce((s, ph) => s + (ph.selectedCostTotal ?? 0), 0);

  const decisionNetImpact = (decisions ?? []).reduce((s, d) => s + (d.financialImpactGbp ?? 0), 0);

  return (
    <>
      {/* ── Print/screen global styles ────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 18mm 14mm; size: A4; }
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; }
          .max-w-6xl { max-width: 100% !important; }
          .print-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
          body { font-size: 11px !important; color: #111 !important; background: white !important; }
          .print-cover { min-height: 90vh; }
        }
        @media screen {
          .print-cover { min-height: 60vh; }
        }
      `}</style>

      {/* ── Sticky print button (hidden when printing) ───────────────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="text-sm font-semibold text-gray-800">Full Report Export</div>
          <div className="text-xs text-gray-500">Abi Peters Aesthetics Ltd · Clinic Launch OS · {today}</div>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading data…
            </div>
          )}
          {fetchError && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> {fetchError}
            </div>
          )}
          <button
            onClick={() => window.print()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2d5016] text-white text-sm font-semibold hover:bg-[#3a6a1e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Printer className="w-4 h-4" />
            {isLoading ? "Loading…" : "Print / Save as PDF"}
          </button>
        </div>
      </div>

      {/* ── Data completeness bar (screen only) ────────────────────────────── */}
      <div className="no-print max-w-4xl mx-auto px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-xs font-semibold text-gray-600">Export Completeness</div>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#2d5016] transition-all" style={{ width: `${Math.round((fullCount / completeness.length) * 100)}%` }} />
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {fullCount}/{completeness.length} sections populated
            {emptyCount > 0 && <span className="text-amber-600 ml-1">· {emptyCount} empty</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {completeness.map(c => (
            <span key={c.label} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide border ${c.full ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4 print:px-0 print:py-0 space-y-2 text-gray-900">

        {/* ════════════════════════════════════════════════════════════════════
            COVER PAGE
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-cover flex flex-col justify-between py-12 print-avoid-break">
          <div>
            <div className="mb-8">
              <div className="text-4xl font-light tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                Abi Peters Aesthetics
              </div>
              <div className="text-xs tracking-[0.35em] uppercase text-gray-400 mt-1">Clinic Launch OS</div>
            </div>

            <div className="border-l-4 border-[#2d5016] pl-6 py-2 mb-10">
              <div className="text-2xl font-bold text-gray-900">Full Project Export</div>
              <div className="text-sm text-gray-500 mt-1">{today}</div>
              <div className="text-sm text-gray-500">Generated from live project data — all figures as at time of export</div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-10">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">Project Details</div>
                <div className="space-y-1.5 text-sm">
                  {[
                    ["Clinic Name", "Abi Peters Aesthetics"],
                    ["Target Location", "9A Jewry Street, Winchester SO23 8RZ"],
                    ["Target Opening", "1 November 2026"],
                    ["Revenue Target", "£25,000/month (steady state)"],
                    ["Legal Entity", "Abi Peters Aesthetics Ltd"],
                  ].map(([l, v]) => (
                    <div key={l} className="flex gap-2">
                      <span className="text-gray-400 w-36 shrink-0">{l}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">At a Glance</div>
                <div className="space-y-1.5 text-sm">
                  {[
                    ["Days to Opening", dashboard?.daysToOpening != null ? `${dashboard.daysToOpening} days` : "TBD"],
                    ["Launch Readiness", dashboard ? pct(dashboard.launchReadinessPercent) : "—"],
                    ["Confidence Score", dashboard ? `${dashboard.projectConfidenceScore}/100` : "—"],
                    ["Break-Even Revenue", fmt(dashboard?.breakEvenRevenue) + "/mo"],
                    ["Compliance Score", dashboard?.complianceReadinessPercent != null ? pct(dashboard.complianceReadinessPercent) : "—"],
                    ["Active Property", dashboard?.activePropertyAddress ?? "None selected"],
                  ].map(([l, v]) => (
                    <div key={l} className="flex gap-2">
                      <span className="text-gray-400 w-36 shrink-0">{l}</span>
                      <span className="font-medium">{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
              <div className="font-bold mb-1 uppercase tracking-wide text-amber-700">Important — Objective Stance</div>
              This report is generated from data you have entered and AI analysis applied to that data. All figures are modelled projections, not guarantees.
              Financial scenarios assume occupancy targets are met. AI analysis is advisory only — seek professional advice for legal, financial, and clinical decisions.
              This platform takes an objective consultant stance and does not skew data in APA's favour.
            </div>
          </div>

          <div className="mt-10 text-[10px] text-gray-300 text-center">
            Clinic Launch OS · Confidential · {today}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            1. AI LAUNCH RECOMMENDATION
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="1. AI Launch Recommendation" sub="Dashboard" />

          {!goNoGo ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 italic">
              No AI analysis cached. Run the Go/No-Go analysis from the Dashboard to populate this section.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verdict */}
              <div className={`rounded-lg border p-4 ${goNoGo.verdict === "proceed" ? "border-emerald-300 bg-emerald-50" : goNoGo.verdict === "delay" ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`text-2xl font-bold uppercase tracking-wide ${goNoGo.verdict === "proceed" ? "text-emerald-700" : goNoGo.verdict === "delay" ? "text-amber-700" : "text-red-700"}`}>
                    {goNoGo.verdict ?? "—"}
                  </div>
                  {goNoGo.confidence != null && (
                    <div className="text-sm text-gray-600">Confidence: {goNoGo.confidence}/100</div>
                  )}
                </div>
                {goNoGo.rationale && (
                  <p className="text-sm text-gray-800 leading-relaxed">{goNoGo.rationale}</p>
                )}
              </div>

              {/* Risk scores */}
              {goNoGo.riskScores && (
                <>
                  <SubTitle label="Risk Scores" />
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(goNoGo.riskScores as Record<string, number>).map(([k, v]) => (
                      <div key={k} className={`rounded border p-2 text-center ${v >= 70 ? "border-red-200 bg-red-50" : v >= 40 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">{k.replace(/([A-Z])/g, " $1").trim()}</div>
                        <div className={`text-lg font-bold ${v >= 70 ? "text-red-700" : v >= 40 ? "text-amber-700" : "text-emerald-700"}`}>{v}</div>
                        <div className="text-[9px] text-gray-400">/100</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Monthly forecast */}
              {goNoGo.monthlyForecast && goNoGo.monthlyForecast.length > 0 && (
                <>
                  <SubTitle label="Revenue & Profit Forecast (Months 1–12)" />
                  <div className="rounded border border-gray-200 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Month", "Revenue", "Occupancy", "Net Profit", "Status"].map(h => (
                            <th key={h} className="px-2.5 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {goNoGo.monthlyForecast.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium">{row.monthLabel ?? `Mo ${row.month}`}</td>
                            <td className="px-2.5 py-1.5">{fmt(row.revenueGbp)}</td>
                            <td className="px-2.5 py-1.5">{pct(row.occupancyPercent)}</td>
                            <td className={`px-2.5 py-1.5 font-semibold ${(row.netProfitGbp ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {row.netProfitGbp != null ? (row.netProfitGbp >= 0 ? "+" : "") + fmt(row.netProfitGbp) : "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-[9px] text-gray-500">{row.viabilityVerdict ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Immediate actions */}
              {goNoGo.immediateActions && goNoGo.immediateActions.length > 0 && (
                <>
                  <SubTitle label="Immediate Actions" />
                  <ul className="space-y-1">
                    {goNoGo.immediateActions.map((a: any, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 font-bold text-[#2d5016]">{i + 1}.</span>
                        <span>{typeof a === "string" ? a : a.action ?? JSON.stringify(a)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* 30-day plan */}
              {goNoGo.thirtyDayPlan && goNoGo.thirtyDayPlan.length > 0 && (
                <>
                  <SubTitle label="30-Day Plan" />
                  <ul className="space-y-1">
                    {goNoGo.thirtyDayPlan.map((a: any, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#2d5016]/10 text-[#2d5016] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span>{typeof a === "string" ? a : a.task ?? JSON.stringify(a)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Negotiation points */}
              {goNoGo.negotiationPoints && goNoGo.negotiationPoints.length > 0 && (
                <>
                  <SubTitle label="Key Negotiation Points" />
                  <ul className="space-y-1">
                    {goNoGo.negotiationPoints.map((pt: string, i: number) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-[#2d5016] shrink-0">→</span>{pt}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            1b. LEASE & OFFER STRATEGY
        ════════════════════════════════════════════════════════════════════ */}
        {leaseStrategy && (
          <div className="print-avoid-break">
            <SectionTitle label="1b. Lease & Offer Strategy" sub="AI-generated — run separately" />
            <div className="space-y-4">

              {leaseStrategy.offerStrategy && (
                <>
                  <SubTitle label="Offer Strategy" />
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Opening Offer", value: fmt(leaseStrategy.offerStrategy.openingOfferRent) + "/mo", note: "Start here" },
                      { label: "Target Settlement", value: fmt(leaseStrategy.offerStrategy.targetRent) + "/mo", note: "Aim for this" },
                      { label: "Walk-Away Rent", value: fmt(leaseStrategy.offerStrategy.walkAwayRent) + "/mo", note: "Do not exceed" },
                    ].map(({ label, value, note }) => (
                      <div key={label} className="rounded border border-gray-200 p-3 text-center bg-gray-50">
                        <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
                        <div className="text-sm font-bold">{value}</div>
                        <div className="text-[9px] text-blue-600 mt-0.5">{note}</div>
                      </div>
                    ))}
                  </div>
                  {[
                    { label: "Key Ask", value: leaseStrategy.offerStrategy.keyAsk },
                    { label: "Positioning", value: leaseStrategy.offerStrategy.tenantPositioning },
                    { label: "Sequencing", value: leaseStrategy.offerStrategy.sequencing },
                    { label: "Agent Dynamics", value: leaseStrategy.offerStrategy.agentDynamics },
                    { label: "If They Counter…", value: leaseStrategy.offerStrategy.counterOfferGuidance },
                  ].filter(x => x.value).map(({ label, value }) => (
                    <Assumption key={label} label={label} value={value} />
                  ))}
                </>
              )}

              {leaseStrategy.leaseNegotiationStrategy && (() => {
                const lns = leaseStrategy.leaseNegotiationStrategy;
                return (
                  <>
                    <SubTitle label="Lease Negotiation Strategy" />
                    {lns.rentFreePeriod && (
                      <div className="flex gap-4 mb-2 text-sm">
                        <span className="text-gray-500">Rent-Free Period:</span>
                        <span className="font-semibold">Target {lns.rentFreePeriod.targetMonths}mo, minimum {lns.rentFreePeriod.minimumAcceptable}mo</span>
                        <span className="text-gray-500 text-xs">{lns.rentFreePeriod.rationale}</span>
                      </div>
                    )}
                    {lns.breakClause && (
                      <div className="flex gap-4 mb-2 text-sm">
                        <span className="text-gray-500">Break Clause:</span>
                        <span className="font-semibold">Year {lns.breakClause.atYear}, {lns.breakClause.noticeMonths}mo notice</span>
                        <span className="text-gray-500 text-xs">{lns.breakClause.rationale}</span>
                      </div>
                    )}
                    {[
                      { label: "Service Charge Cap", value: lns.serviceChargeCap },
                      { label: "Repairing Obligations", value: lns.repairingObligations },
                      { label: "Use Class", value: lns.useClass },
                      { label: "Rent Deposit", value: lns.depositNegotiation },
                      { label: "Alienation Rights", value: lns.alienation },
                    ].filter(x => x.value).map(({ label, value }) => (
                      <Assumption key={label} label={label} value={value} />
                    ))}
                    {lns.redLines && lns.redLines.length > 0 && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 p-3">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-red-700 mb-1">Deal-Breakers — Walk Away If…</div>
                        <ul className="space-y-0.5">
                          {lns.redLines.map((r: string, i: number) => (
                            <li key={i} className="text-xs text-red-900 flex gap-1.5"><span className="font-bold shrink-0">✕</span>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}

              {leaseStrategy.headsOfTermsChecklist && leaseStrategy.headsOfTermsChecklist.length > 0 && (
                <>
                  <SubTitle label="Heads of Terms Checklist" />
                  <div className="rounded border border-gray-200 overflow-x-auto text-xs">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Clause", "Status", "Your Position", "Landlord Typical", "Priority"].map(h => (
                            <th key={h} className="text-left px-2.5 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leaseStrategy.headsOfTermsChecklist.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{item.clause}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <TagBadge
                                label={item.status ?? ""}
                                color={item.status === "confirmed" ? "green" : item.status === "red-flag" ? "red" : item.status === "must-confirm" ? "blue" : "amber"}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 max-w-[160px]">{item.yourPosition}</td>
                            <td className="px-2.5 py-1.5 text-gray-500 max-w-[160px]">{item.landlordPosition}</td>
                            <td className={`px-2.5 py-1.5 capitalize font-semibold ${item.importance === "critical" ? "text-red-700" : item.importance === "high" ? "text-amber-700" : "text-gray-500"}`}>{item.importance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            2. FINANCIAL ASSUMPTIONS
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="2. Financial Assumptions" sub="Financials → The Model (Winchester)" />
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-xs text-amber-800">
            <span className="font-bold">Assumptions note:</span> All figures below are the inputs used to model the Winchester clinic. These drive all break-even, cashflow, and scenario calculations throughout this report. Bedhampton revenue is a support figure only — Winchester must be self-funding at the targets below.
          </div>

          {!financialModel ? (
            <p className="text-sm text-gray-400 italic">Financial model not yet configured.</p>
          ) : (
            <>
              <SubTitle label="Winchester — Revenue Model Inputs" />
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  {[
                    { label: "Treatment Rooms", value: `${financialModel.treatmentRoomsCount ?? "—"}` },
                    { label: "Working Days / Month", value: `${financialModel.workingDaysPerMonth ?? "—"} days` },
                    { label: "Practitioner Hours / Day", value: `${financialModel.practitionerHoursPerDay ?? "—"} hrs` },
                    { label: "Average Client Value (ACV)", value: fmt(financialModel.wincAcvGbp ?? financialModel.averageClientValueGbp) },
                    { label: "Repeat Booking Rate", value: pct(financialModel.repeatBookingRatePercent) },
                    { label: "Membership Revenue", value: fmt(financialModel.membershipRevenueGbp) + "/mo" },
                  ].map(a => <Assumption key={a.label} {...a} />)}
                </div>
                <div>
                  {[
                    { label: "Conservative Occupancy", value: pct(financialModel.conservativeOccupancyPercent), note: "Low-end scenario" },
                    { label: "Realistic Occupancy", value: pct(financialModel.realisticOccupancyPercent), note: "Base case" },
                    { label: "Aggressive Occupancy", value: pct(financialModel.aggressiveOccupancyPercent), note: "Optimistic case" },
                  ].map(a => <Assumption key={a.label} {...a} />)}
                </div>
              </div>

              <SubTitle label="Fixed Costs Register — Authoritative Cost List" />
              <div className="text-xs text-gray-500 mb-2 italic">Source: Fixed Costs tab. These are the itemised costs used in all break-even and cashflow calculations.</div>
              {fixedCosts && fixedCosts.length > 0 ? (
                <>
                  <div className="rounded border border-gray-200 overflow-hidden mb-2">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Cost Item</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Monthly</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Annual</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedCosts.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-1 font-medium">{item.name}</td>
                            <td className="px-3 py-1">{fmt(item.amountGbp)}</td>
                            <td className="px-3 py-1 text-gray-500">{fmt(item.amountGbp * 12)}</td>
                            <td className="px-3 py-1"><TagBadge label={item.costType === "dual" ? "Dual-site" : "Winchester"} color={item.costType === "dual" ? "blue" : "gray"} /></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td className="px-3 py-1.5 font-bold">Total</td>
                          <td className="px-3 py-1.5 font-bold">{fmt(totalFixedCosts)}/mo</td>
                          <td className="px-3 py-1.5 font-bold text-gray-600">{fmt(totalFixedCosts * 12)}/yr</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 italic mb-2">No fixed costs entered. Add items in the Fixed Costs tab.</p>
              )}

              <SubTitle label="Variable Cost Assumptions" />
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  {[
                    { label: "Stock (% of revenue)", value: pct(financialModel.stockPercent), note: "Applied per treatment" },
                    { label: "Consumables", value: fmt(financialModel.consumablesGbp) + "/mo" },
                    { label: "Commissions (% of rev.)", value: pct(financialModel.commissionsPercent) },
                  ].map(a => <Assumption key={a.label} {...a} />)}
                </div>
              </div>

              <SubTitle label="Bedhampton Support Assumptions" />
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  {[
                    { label: "Bedhampton Revenue", value: fmt(financialModel.existingClinicRevenueGbp) + "/mo" },
                    { label: "Bedhampton Rent", value: fmt(financialModel.bedhRentGbp) + "/mo" },
                    { label: "Bedhampton Marketing", value: fmt(financialModel.bedhMarketingGbp) + "/mo" },
                    { label: "Bedhampton All Costs", value: fmt(financialModel.bedhamptonCostsGbp) + "/mo" },
                  ].map(a => <Assumption key={a.label} {...a} />)}
                </div>
              </div>

              <SubTitle label="Owner / Life Design Assumptions" />
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  {[
                    { label: "Owner Drawings Target", value: fmt(financialModel.ownerDrawingsGbp) + "/mo" },
                    { label: "Personal Salary Need", value: fmt(financialModel.personalSalaryNeedsGbp) + "/mo" },
                    { label: "Cash Reserve / Runway Savings", value: fmt(financialModel.runwaySavingsGbp) },
                    { label: "School Fees", value: fmt(financialModel.schoolFeesGbp) + "/mo" },
                    { label: "Travel", value: fmt(financialModel.travelGbp) + "/mo" },
                    { label: "Other Household", value: fmt(financialModel.otherHouseholdGbp) + "/mo" },
                  ].map(a => <Assumption key={a.label} {...a} />)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            2b. LIVE BEDHAMPTON CLINIC PERFORMANCE
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-avoid-break">
          <SectionTitle label="2b. Live Clinic Performance — Bedhampton" sub="Live data at time of export" />

          {!bLiveData ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 italic">
              Live Bedhampton data could not be loaded at export time. Try refreshing the page or check connectivity to the clinic data source.
            </div>
          ) : (
            <div className="space-y-4">
              <KpiGrid items={[
                { label: "Last Month Revenue", value: fmt(bLiveData.summary?.lastMonthRevenue), sub: "most recent completed month" },
                { label: "Projected This Month", value: fmt(bLiveData.summary?.projectedMonthRevenue), sub: "current month estimate" },
                { label: "3-Month Average", value: (() => {
                  const last3 = (bLiveData.recentMonths ?? []).slice(-3);
                  return last3.length > 0 ? fmt(Math.round(last3.reduce((s: number, m: any) => s + m.revenue, 0) / last3.length)) : "—";
                })(), sub: "rolling 3-month average" },
                { label: "Avg Gross Margin", value: pct(bLiveData.summary?.avgGrossMarginPct, 1), sub: "revenue minus stock/products" },
                { label: "Avg Client Value", value: fmt(bLiveData.summary?.avgClientValueGbp), sub: "ACV across all visits" },
                { label: "Repeat Rate", value: pct(bLiveData.summary?.repeatRatePercent, 1), sub: "returning clients" },
              ]} />

              {bLiveData.recentMonths && bLiveData.recentMonths.length > 0 && (
                <>
                  <SubTitle label="Monthly Revenue History" />
                  <div className="rounded border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Month", "Revenue", "Gross Margin %", "Visits", "Avg Booking Value", "New vs Returning"].map(h => (
                            <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bLiveData.recentMonths.map((m: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium">{m.monthLabel ?? m.month}</td>
                            <td className="px-2.5 py-1.5 font-semibold">{fmt(m.revenue)}</td>
                            <td className="px-2.5 py-1.5">{m.grossMarginPct != null ? pct(m.grossMarginPct, 1) : "—"}</td>
                            <td className="px-2.5 py-1.5">{m.visitCount ?? "—"}</td>
                            <td className="px-2.5 py-1.5">{m.avgBookingValue != null ? fmt(m.avgBookingValue) : "—"}</td>
                            <td className="px-2.5 py-1.5 text-gray-500">
                              {m.newClients != null && m.returningClients != null ? `${m.newClients} new / ${m.returningClients} ret.` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {bLiveData.summary?.atRiskClients != null && (
                <div className={`rounded border p-3 text-xs ${bLiveData.summary.atRiskClients > 5 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                  <span className="font-bold">At-Risk Clients:</span> {bLiveData.summary.atRiskClients} clients not booked in 90+ days.
                  {bLiveData.summary.atRiskClients > 5 && " Consider a re-engagement campaign before Winchester opening to protect Bedhampton revenue during the transition."}
                </div>
              )}

              <div className="text-[9px] text-gray-400 italic">
                Data fetched from Bedhampton clinic system at time of export: {bLiveData.fetchedAt ? new Date(bLiveData.fetchedAt).toLocaleString("en-GB") : "unknown"}
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            3. FIXED COSTS
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-avoid-break">
          <SectionTitle label="3. Fixed Costs Register" sub="Financials → Fixed Costs" />
          <div className="text-xs text-gray-500 mb-3 italic">These are the itemised fixed costs entered in the Fixed Costs tab. They override the model assumptions above and feed directly into break-even calculations.</div>

          {(!fixedCosts || fixedCosts.length === 0) ? (
            <p className="text-sm text-gray-400 italic">No fixed cost items entered yet.</p>
          ) : (
            <>
              <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Cost Item</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Monthly £</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Annual £</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedCosts.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-1.5 font-medium">{item.name}</td>
                        <td className="px-3 py-1.5">{fmt(item.amountGbp)}</td>
                        <td className="px-3 py-1.5 text-gray-600">{fmt(item.amountGbp * 12)}</td>
                        <td className="px-3 py-1.5">
                          <TagBadge label={item.costType === "dual" ? "Dual-site" : "Winchester only"} color={item.costType === "dual" ? "blue" : "gray"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-3 py-2 font-bold text-sm">Total Fixed Costs</td>
                      <td className="px-3 py-2 font-bold text-sm">{fmt(totalFixedCosts)}/mo</td>
                      <td className="px-3 py-2 font-bold text-sm text-gray-600">{fmt(totalFixedCosts * 12)}/yr</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 p-3 rounded border border-blue-100 bg-blue-50 text-xs text-blue-800">
                <span className="font-bold">Break-Even Implication:</span> With {fmt(totalFixedCosts)}/mo in fixed costs, Winchester needs to generate revenue above this before covering variable costs and contributing to owner drawings. Combined with variable costs and VAT obligations, refer to the Dashboard break-even figure ({fmt(dashboard?.breakEvenRevenue)}/mo) for the full picture.
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            4. CASHFLOW — MONTH BY MONTH
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-avoid-break">
          <SectionTitle label="4. 12-Month Cashflow Projection" sub="Financials → Overview (Realistic scenario)" />
          <div className="text-xs text-gray-500 mb-3 italic">Realistic scenario projections. Includes ramp-up curve. Cumulative cashflow shows when the business crosses into positive territory.</div>

          {(!cashflow || (cashflow as any[]).length === 0) ? (
            <p className="text-sm text-gray-400 italic">Cashflow data not available. Ensure financial model is saved.</p>
          ) : (
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Month", "Winc Rev", "Bedh Support", "Fixed Costs", "Variable", "Occ %", "Net CF", "Balance", ""].map(h => (
                      <th key={h} className="text-left px-2.5 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cashflow as any[]).map((row: any, i: number) => (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${row.isSelfFundingMonth ? "bg-emerald-50" : row.isPreOpening ? "bg-gray-50/60" : ""}`}>
                      <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">
                        {row.calendarLabel ?? row.monthLabel ?? `Mo ${row.month}`}
                        {row.isPreOpening && <span className="ml-1 text-[9px] text-gray-400">(pre)</span>}
                      </td>
                      <td className="px-2.5 py-1.5">{row.isPreOpening ? "—" : fmt(row.wincRevenue)}</td>
                      <td className="px-2.5 py-1.5 text-blue-700">{(row.bedhRevenue ?? 0) > 0 ? fmt(row.bedhRevenue) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-gray-600">{fmt(row.wincFixedCosts ?? row.fixedCosts)}</td>
                      <td className="px-2.5 py-1.5 text-gray-600">{fmt(row.wincVariableCosts ?? row.variableCosts)}</td>
                      <td className="px-2.5 py-1.5 text-gray-500">{row.occupancyPercent != null ? `${row.occupancyPercent}%` : "—"}</td>
                      <td className={`px-2.5 py-1.5 font-semibold ${(row.monthlyCashflow ?? row.netCashflow ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {(row.monthlyCashflow ?? row.netCashflow) != null
                          ? ((row.monthlyCashflow ?? row.netCashflow) >= 0 ? "+" : "") + fmt(row.monthlyCashflow ?? row.netCashflow)
                          : "—"}
                      </td>
                      <td className={`px-2.5 py-1.5 font-semibold ${(row.cashBalance ?? row.cumulativeCashflow ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {(row.cashBalance ?? row.cumulativeCashflow) != null
                          ? ((row.cashBalance ?? row.cumulativeCashflow) >= 0 ? "+" : "") + fmt(row.cashBalance ?? row.cumulativeCashflow)
                          : "—"}
                      </td>
                      <td className="px-2.5 py-1.5">
                        {row.isSelfFundingMonth && <TagBadge label="Self-funding" color="green" />}
                        {row.isBedhamptonCloseMonth && <TagBadge label="Bedh closes" color="blue" />}
                        {row.isOpeningMonth && <TagBadge label="Opens" color="purple" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            5. PROJECT PLAN
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break">
          <SectionTitle label="5. Project Plan — All Phases & Tasks" sub="Project Plan page" />
          <div className="mb-3 flex gap-6 text-sm">
            <div><span className="text-gray-500">Total Selected Cost:</span> <span className="font-bold">{fmt(totalProjectCostSelected)}</span></div>
            <div><span className="text-gray-500">Low Estimate:</span> <span className="font-bold">{fmt(dashboard?.totalProjectCostLow)}</span></div>
            <div><span className="text-gray-500">Mid Estimate:</span> <span className="font-bold">{fmt(dashboard?.totalProjectCostMid)}</span></div>
            <div><span className="text-gray-500">High Estimate:</span> <span className="font-bold">{fmt(dashboard?.totalProjectCostHigh)}</span></div>
          </div>

          {(!phasesWithTasks || phasesWithTasks.length === 0) ? (
            <p className="text-sm text-gray-400 italic">No project phases defined yet.</p>
          ) : (
            <div className="space-y-5">
              {phasesWithTasks.map(phase => (
                <div key={phase.id} className="print-avoid-break">
                  <div className="flex items-center gap-3 mb-2 bg-gray-100 rounded px-3 py-2">
                    <div className="flex-1">
                      <div className="font-bold text-sm">{phase.name}</div>
                      {phase.description && <div className="text-xs text-gray-500">{phase.description}</div>}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span>{phase.completedTaskCount}/{phase.taskCount} tasks done</span>
                      <span>Selected: {fmt(phase.selectedCostTotal)}</span>
                      <TagBadge
                        label={phase.status.replace("_", " ")}
                        color={phase.status === "complete" ? "green" : phase.status === "in_progress" ? "blue" : phase.status === "blocked" ? "red" : "gray"}
                      />
                    </div>
                  </div>

                  {phase.tasks && phase.tasks.length > 0 ? (
                    <div className="rounded border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            {["Task", "Status", "Risk", "Cost (Selected)", "Cost Range", "Due", "Notes"].map(h => (
                              <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {phase.tasks.map(task => (
                            <tr key={task.id} className={`border-b border-gray-100 last:border-0 ${task.isCriticalRisk ? "bg-red-50" : task.isNonNegotiable ? "bg-amber-50" : ""}`}>
                              <td className="px-2.5 py-1.5 font-medium max-w-[160px]">
                                {task.title}
                                {task.isCriticalRisk && <span className="ml-1 text-red-600 font-bold text-[9px]">★</span>}
                                {task.isNonNegotiable && <span className="ml-1 text-amber-600 font-bold text-[9px]">!</span>}
                              </td>
                              <td className="px-2.5 py-1.5 whitespace-nowrap">
                                <TagBadge label={TASK_STATUS_LABEL[task.status] ?? task.status} color={TASK_STATUS_COLOR[task.status] ?? "gray"} />
                              </td>
                              <td className="px-2.5 py-1.5 whitespace-nowrap">
                                <TagBadge label={task.riskLevel} color={RISK_COLOR[task.riskLevel] ?? "gray"} />
                              </td>
                              <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{fmt(task.selectedCost)}</td>
                              <td className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap">{fmt(task.costLow)}–{fmt(task.costHigh)}</td>
                              <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-500">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-GB") : "—"}</td>
                              <td className="px-2.5 py-1.5 text-gray-500 max-w-[140px] truncate">{task.notes ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic pl-2">No tasks in this phase.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            6. COST OPTIMISATION
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="6. Cost Optimisation Analysis" sub="Optimisation page" />

          {!optimisation ? (
            <p className="text-sm text-gray-400 italic">No optimisation analysis data available.</p>
          ) : (
            <div className="space-y-4">
              <KpiGrid items={[
                { label: "Current Cash Requirement", value: fmt(optimisation.currentCashRequirement), sub: "at current selections" },
                { label: "Potential Saving", value: fmt(optimisation.totalPotentialSaving), sub: "if optimised selections made" },
                { label: "Optimised Requirement", value: fmt(optimisation.cashRequirementWithSavings), sub: "after savings" },
                { label: "Operational Risk Score", value: `${optimisation.operationalRiskScore}/100`, alert: optimisation.operationalRiskScore >= 70, sub: optimisation.operationalRiskScore >= 70 ? "High risk" : optimisation.operationalRiskScore >= 40 ? "Moderate" : "Healthy" },
                { label: "Cash Runway", value: optimisation.runwayMonths != null ? `${optimisation.runwayMonths} months` : "—", sub: "at current burn rate" },
                { label: "Optimised Runway", value: optimisation.runwayMonthsWithSavings != null ? `${optimisation.runwayMonthsWithSavings} months` : "—", sub: "after savings applied" },
              ]} />

              {optimisation.smartRiskFlags && optimisation.smartRiskFlags.length > 0 && (
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-red-700 mb-2">Smart Risk Flags</div>
                  <div className="space-y-1.5">
                    {optimisation.smartRiskFlags.map((flag, i) => (
                      <div key={i} className="flex gap-2 text-xs text-red-900">
                        <TagBadge label={flag.level} color={flag.level === "critical" ? "red" : "amber"} />
                        <span>{flag.taskTitle && <strong>{flag.taskTitle}: </strong>}{flag.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.entries({
                "Dangerous to Cut": optimisation.categorised?.dangerous_to_cut ?? [],
                "Non-Negotiable": optimisation.categorised?.non_negotiable ?? [],
                "Operationally Critical": optimisation.categorised?.operationally_critical ?? [],
                "Safe to Reduce": optimisation.categorised?.safe_to_reduce ?? [],
                "Delayable": optimisation.categorised?.delayable ?? [],
                "Luxury Items": optimisation.categorised?.luxury_item ?? [],
              }).filter(([, items]) => items.length > 0).map(([catLabel, items]) => (
                <div key={catLabel}>
                  <SubTitle label={`${catLabel} (${items.length})`} />
                  <div className="rounded border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Task", "Phase", "Cost Tier", "Selected Cost", "Potential Saving", "Rationale"].map(h => (
                            <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium max-w-[120px]">{item.taskTitle}</td>
                            <td className="px-2.5 py-1.5 text-gray-500">{item.phaseName}</td>
                            <td className="px-2.5 py-1.5"><TagBadge label={item.costTier?.toUpperCase() ?? "—"} color={item.costTier === "low" ? "amber" : item.costTier === "high" ? "green" : "gray"} /></td>
                            <td className="px-2.5 py-1.5 font-semibold">{fmt(item.selectedCost)}</td>
                            <td className="px-2.5 py-1.5 text-emerald-700 font-semibold">{item.potentialSavingGbp > 0 ? fmt(item.potentialSavingGbp) : "—"}</td>
                            <td className="px-2.5 py-1.5 text-gray-600 max-w-[160px]">{item.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            7. PROPERTIES
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break">
          <SectionTitle label="7. Property Pipeline" sub="Properties page" />

          {(!properties || properties.length === 0) ? (
            <p className="text-sm text-gray-400 italic">No properties in pipeline.</p>
          ) : (
            <div className="space-y-5">
              {activeProperty && (
                <div className="print-avoid-break">
                  <div className="flex items-center gap-2 mb-2">
                    <SubTitle label="Active Property (Selected Site)" />
                    <TagBadge label="Active" color="green" />
                  </div>
                  <div className="rounded border-2 border-[#2d5016]/30 bg-emerald-50/30 p-4 space-y-1">
                    <div className="text-base font-bold">{activeProperty.address}</div>
                    {activeProperty.postcode && <div className="text-sm text-gray-600">{activeProperty.postcode}</div>}
                    <div className="grid grid-cols-2 gap-x-8 mt-3">
                      <div>
                        {[
                          { label: "Monthly Rent", value: fmt(activeProperty.monthlyRentGbp) + "/mo" },
                          { label: "Annual Rent", value: fmt(activeProperty.annualRentGbp) + "/yr" },
                          { label: "Sq Footage", value: activeProperty.sqFootage ? `${activeProperty.sqFootage} sq ft` : "—" },
                          { label: "Lease Length", value: activeProperty.leaseLength ?? "—" },
                          { label: "Use Class", value: activeProperty.useClass ?? "—" },
                          { label: "VAT on Rent", value: activeProperty.vatOnRent ? "Yes" : "No" },
                        ].map(a => <Assumption key={a.label} {...a} />)}
                      </div>
                      <div>
                        {[
                          { label: "Business Rates", value: fmt(activeProperty.businessRatesGbp) + "/mo" },
                          { label: "Service Charge", value: fmt(activeProperty.serviceChargeGbp) + "/mo" },
                          { label: "Parking Spaces", value: activeProperty.parkingSpaces != null ? `${activeProperty.parkingSpaces}` : "—" },
                          { label: "Frontage", value: activeProperty.frontageMeters ? `${activeProperty.frontageMeters}m` : "—" },
                          { label: "Available From", value: activeProperty.availabilityDate ? new Date(activeProperty.availabilityDate).toLocaleDateString("en-GB") : "—" },
                          { label: "Agent", value: [activeProperty.agentName, activeProperty.agentPhone].filter(Boolean).join(" · ") || "—" },
                        ].map(a => <Assumption key={a.label} {...a} />)}
                      </div>
                    </div>
                    {activeProperty.viewingNotes && (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Viewing Notes</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{activeProperty.viewingNotes}</p>
                      </div>
                    )}
                    {activeProperty.negotiationNotes && (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Negotiation Notes</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{activeProperty.negotiationNotes}</p>
                      </div>
                    )}
                    {activeProperty.landlordConcessions && (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Landlord Concessions Secured</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{activeProperty.landlordConcessions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {otherProperties.length > 0 && (
                <div>
                  <SubTitle label="Other Pipeline Properties" />
                  <div className="rounded border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Address", "Stage", "Rent/mo", "Sq ft", "Lease", "Notes"].map(h => (
                            <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {otherProperties.map(p => (
                          <tr key={p.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium max-w-[180px]">{p.address ?? "—"} {p.postcode && <span className="text-gray-400">{p.postcode}</span>}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <TagBadge
                                label={p.pipelineStatus.replace(/_/g, " ")}
                                color={p.pipelineStatus === "selected" ? "green" : p.pipelineStatus === "rejected" ? "red" : p.pipelineStatus === "negotiating" || p.pipelineStatus === "heads_of_terms" ? "amber" : "blue"}
                              />
                            </td>
                            <td className="px-2.5 py-1.5">{fmt(p.monthlyRentGbp)}</td>
                            <td className="px-2.5 py-1.5">{p.sqFootage ?? "—"}</td>
                            <td className="px-2.5 py-1.5">{p.leaseLength ?? "—"}</td>
                            <td className="px-2.5 py-1.5 text-gray-500 max-w-[140px] truncate">{p.notes ?? p.viewingNotes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            8. COMPETITOR INTELLIGENCE
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="8. Competitor Intelligence" sub="Competition Intel page" />

          {competitors.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No competitors mapped yet.</p>
          ) : (
            <>
              <div className="mb-3 flex gap-6 text-sm">
                <span><span className="text-gray-500">Competitors Mapped:</span> <strong>{competitors.length}</strong></span>
                <span><span className="text-gray-500">Avg Google Rating:</span> <strong>{(competitors.reduce((s: number, c: any) => s + (parseFloat(c.googleRating) || 0), 0) / competitors.filter((c: any) => c.googleRating).length || 0).toFixed(1)}★</strong></span>
                <span><span className="text-gray-500">Avg Review Count:</span> <strong>{Math.round(competitors.reduce((s: number, c: any) => s + (c.googleReviewCount || 0), 0) / competitors.length)}</strong></span>
              </div>
              <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Competitor", "Type", "Distance", "Google Rating", "Reviews", "Nurse-Led", "Save Face", "Key Treatments", "Pricing Context"].map(h => (
                        <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c: any, i: number) => {
                      const treatments = (() => { try { return JSON.parse(c.treatmentsJson ?? "[]"); } catch { return []; } })();
                      return (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-2.5 py-1.5 font-medium max-w-[120px]">{c.name}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-500">{c.clinicType ?? "—"}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{c.distanceMiles ? `${parseFloat(c.distanceMiles).toFixed(1)}mi` : "—"}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{c.googleRating ? `${c.googleRating}★` : "—"}</td>
                          <td className="px-2.5 py-1.5">{c.googleReviewCount ?? "—"}</td>
                          <td className="px-2.5 py-1.5">{c.nurseLed ? "Yes" : c.nurseLed === false ? "No" : "—"}</td>
                          <td className="px-2.5 py-1.5">{c.saveFace ? "Yes" : "—"}</td>
                          <td className="px-2.5 py-1.5 text-gray-600 max-w-[120px]">{Array.isArray(treatments) ? treatments.slice(0, 4).join(", ") : "—"}</td>
                          <td className="px-2.5 py-1.5 text-gray-500 max-w-[100px]">{c.pricingContext ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            9. COMPLIANCE
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break">
          <SectionTitle label="9. CQC & Compliance" sub="Compliance page" />

          {complianceSummary && (
            <KpiGrid items={[
              { label: "Overall Compliance", value: pct(complianceSummary.overallPercent), alert: (complianceSummary.overallPercent ?? 100) < 20 },
              { label: "Complete Items", value: `${complianceSummary.completeCount ?? 0}`, sub: `of ${complianceSummary.totalCount ?? 0} total` },
              { label: "In Progress", value: `${complianceSummary.inProgressCount ?? 0}` },
              { label: "Not Started", value: `${complianceSummary.notStartedCount ?? 0}`, alert: (complianceSummary.notStartedCount ?? 0) > 10 },
            ]} />
          )}

          {/* CQC Milestones */}
          {cqcMilestones && cqcMilestones.length > 0 && (
            <div className="print-avoid-break mb-4">
              <SubTitle label="CQC Registration Timeline" />
              <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["#", "Milestone", "Status", "Target Date", "Lead Time", "Notes"].map(h => (
                        <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cqcMilestones.map((m: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-2.5 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-2.5 py-1.5 font-medium">{m.title}</td>
                        <td className="px-2.5 py-1.5">
                          <TagBadge label={COMPLIANCE_STATUS_LABEL[m.status] ?? m.status} color={COMPLIANCE_STATUS_COLOR[m.status] ?? "gray"} />
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{m.targetDate ? new Date(m.targetDate).toLocaleDateString("en-GB") : "—"}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{m.leadTimeWeeks ? `${m.leadTimeWeeks}w` : "—"}</td>
                        <td className="px-2.5 py-1.5 text-gray-500 max-w-[160px]">{m.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Compliance items by section */}
          {Object.keys(complianceBySection).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No compliance items entered yet.</p>
          ) : (
            Object.entries(complianceBySection).map(([section, items]) => (
              <div key={section} className="print-avoid-break mb-4">
                <SubTitle label={section} />
                <div className="rounded border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Item", "Status", "Policy", "Notes"].map(h => (
                          <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-2.5 py-1.5 font-medium max-w-[200px]">{item.title}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <TagBadge label={COMPLIANCE_STATUS_LABEL[item.status] ?? item.status} color={COMPLIANCE_STATUS_COLOR[item.status] ?? "gray"} />
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-500">{item.policyStatus ?? "—"}</td>
                          <td className="px-2.5 py-1.5 text-gray-500 max-w-[200px]">{item.notes ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            10. DECISION LOG
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="10. Decision Log" sub="Decisions page" />

          <div className="rounded border border-blue-100 bg-blue-50 p-3 mb-4 text-xs text-blue-800 print-avoid-break">
            <span className="font-bold">Tip:</span> Log every significant decision in the Decisions tab — property choices, financial commitments, clinical scope changes, supplier selections. A complete log is essential for investor conversations, CQC inspections, and retrospective analysis. The decision below was pre-populated from your AI Launch Recommendation.
          </div>

          {(!decisions || decisions.length === 0) ? (
            <p className="text-sm text-gray-400 italic">No decisions logged yet. Visit the Decisions tab to record key project decisions.</p>
          ) : (
            <>
              <KpiGrid items={[
                { label: "Total Decisions", value: `${decisions.length}` },
                { label: "Net Financial Impact", value: fmt(decisionNetImpact) + " total", alert: decisionNetImpact < -10000 },
                { label: "Positive Impact", value: `${decisions.filter(d => d.financialImpactGbp > 0).length} decisions` },
                { label: "Negative Impact", value: `${decisions.filter(d => d.financialImpactGbp < 0).length} decisions`, alert: decisions.filter(d => d.financialImpactGbp < 0).length > 0 },
              ]} />
              <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Date", "Decision", "Category", "Financial Impact", "Reasoning", "Expected Outcome"].map(h => (
                        <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...decisions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((d, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-500">{new Date(d.createdAt).toLocaleDateString("en-GB")}</td>
                        <td className="px-2.5 py-1.5 font-medium max-w-[140px]">{d.title}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          <TagBadge
                            label={d.category}
                            color={d.category === "property" ? "blue" : d.category === "financial" ? "green" : d.category === "clinical" ? "purple" : "gray"}
                          />
                        </td>
                        <td className={`px-2.5 py-1.5 font-semibold whitespace-nowrap ${d.financialImpactGbp > 0 ? "text-emerald-700" : d.financialImpactGbp < 0 ? "text-red-700" : "text-gray-500"}`}>
                          {d.financialImpactGbp !== 0 ? (d.financialImpactGbp > 0 ? "+" : "") + fmt(d.financialImpactGbp) : "—"}
                        </td>
                        <td className="px-2.5 py-1.5 text-gray-600 max-w-[160px]">{d.reasoning}</td>
                        <td className="px-2.5 py-1.5 text-gray-500 max-w-[140px]">{d.expectedImpact ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            11. MARKETING
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break">
          <SectionTitle label="11. Marketing & Launch Plan" sub="Marketing page" />

          {marketing.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No marketing items loaded.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(marketingByCategory).map(([cat, items]) => (
                <div key={cat} className="print-avoid-break">
                  <SubTitle label={`${cat.replace(/_/g, " ")} (${items.length} items)`} />
                  <div className="rounded border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["Item", "Status", "Priority", "Due", "Notes"].map(h => (
                            <th key={h} className="text-left px-2.5 py-1.5 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2.5 py-1.5 font-medium max-w-[180px]">{item.title}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <TagBadge
                                label={item.status?.replace(/_/g, " ") ?? "pending"}
                                color={item.status === "complete" || item.status === "done" ? "green" : item.status === "in_progress" ? "blue" : "gray"}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              {item.priority && <TagBadge label={item.priority} color={item.priority === "high" || item.priority === "critical" ? "red" : item.priority === "medium" ? "amber" : "gray"} />}
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-500">{item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-GB") : item.weekLabel ?? "—"}</td>
                            <td className="px-2.5 py-1.5 text-gray-500 max-w-[180px]">{item.notes ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            12. LIFE DESIGN
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break print-avoid-break">
          <SectionTitle label="12. Life Design" sub="Life Design page" />

          {!lifestyle ? (
            <p className="text-sm text-gray-400 italic">No life design data saved yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Clinic Schedule */}
              {lifestyle.clinicDays && (
                <>
                  <SubTitle label="Clinic Schedule" />
                  <div className="grid grid-cols-2 gap-x-8">
                    <div>
                      {[
                        { label: "Clinic Open Time", value: lifestyle.clinicOpenTime ?? "—" },
                        { label: "Clinic Close Time", value: lifestyle.clinicCloseTime ?? "—" },
                        { label: "Working Days", value: Array.isArray(lifestyle.clinicDays) ? lifestyle.clinicDays.join(", ") : lifestyle.clinicDays ?? "—" },
                      ].map(a => <Assumption key={a.label} {...a} />)}
                    </div>
                  </div>
                  {lifestyle.scheduleNotes && (
                    <p className="text-xs text-gray-600 italic">{lifestyle.scheduleNotes}</p>
                  )}
                </>
              )}

              {/* Nursing Transition */}
              {(lifestyle.nursingStatus || lifestyle.nursingNoticeWeeks || lifestyle.targetExitDate) && (
                <>
                  <SubTitle label="Nursing Transition" />
                  <div className="grid grid-cols-2 gap-x-8">
                    {[
                      { label: "Current Status", value: lifestyle.nursingStatus
                          ? lifestyle.nursingStatus.charAt(0).toUpperCase() + lifestyle.nursingStatus.slice(1)
                          : "—" },
                      { label: "Notice Period", value: lifestyle.nursingNoticeWeeks ? `${lifestyle.nursingNoticeWeeks} weeks` : "—" },
                      { label: "Target Exit Date", value: lifestyle.targetExitDate ?? "—" },
                      { label: "Exit Notes", value: lifestyle.nursingExitNotes || "—" },
                    ].map(a => <Assumption key={a.label} {...a} />)}
                  </div>
                </>
              )}

              {/* Non-negotiables */}
              {lifestyleNonNegotiables.length > 0 && (
                <>
                  <SubTitle label="Non-Negotiables" />
                  <ul className="space-y-1">
                    {lifestyleNonNegotiables.map((n: string, i: number) => (
                      <li key={i} className="text-sm flex gap-2"><span className="text-[#2d5016] font-bold shrink-0">✓</span>{n}</li>
                    ))}
                  </ul>
                </>
              )}

              {/* Success vision */}
              {lifestyleSuccessVision && (
                <>
                  <SubTitle label="Success Vision (12 Months)" />
                  <p className="text-sm text-gray-700 leading-relaxed italic border-l-2 border-[#2d5016]/30 pl-3">{lifestyleSuccessVision}</p>
                </>
              )}

              {/* Family schedule summary */}
              {lifestyle.davidAvailabilityDays != null && (
                <>
                  <SubTitle label="Family & Logistics Overview" />
                  <div className="grid grid-cols-2 gap-x-8">
                    {[
                      { label: "David Availability", value: lifestyle.davidAvailabilityDays != null ? `${lifestyle.davidAvailabilityDays} days/week` : "—" },
                      { label: "David Role Notes", value: lifestyle.davidRoleNotes || "—" },
                      { label: "Drop-Off Covered By", value: lifestyle.dropCoveredBy || "—" },
                      { label: "Pick-Up Covered By", value: lifestyle.pickupCoveredBy || "—" },
                      { label: "Sick Cover Plan", value: lifestyle.sickCoverPlan || "—" },
                      { label: "Holiday Plan", value: lifestyle.holidayPlan || "—" },
                    ].map(a => <Assumption key={a.label} {...a} />)}
                  </div>
                  {lifestyle.schoolContingencyPlan && (
                    <div className="mt-2">
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Contingency Plan</div>
                      <p className="text-xs text-gray-700">{lifestyle.schoolContingencyPlan}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════════════════════════════════ */}
        <div className="print-break mt-12 py-8 border-t-2 border-gray-200 text-center">
          <div className="text-[10px] text-gray-400 space-y-1">
            <div className="font-semibold text-gray-600">Abi Peters Aesthetics Ltd — Clinic Launch OS</div>
            <div>Full Project Export · {today}</div>
            <div>Confidential — not for distribution</div>
            <div className="mt-3 text-gray-300">This document was auto-generated from live project data. All figures are modelled projections. Seek professional advice before making financial, legal, or clinical decisions.</div>
          </div>
        </div>

      </div>
    </>
  );
}
