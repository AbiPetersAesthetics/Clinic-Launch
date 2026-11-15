// The KPI tile (UX plan 2.4): eyebrow label, the value in the serif face, one comparison line and
// a source chip. "Not measured yet" is a value, shown in muted ink with its reason and date.
import { Fresh } from "@/components/fresh";
import type { Kpi } from "@/lib/alfred";

const TONE: Record<string, string> = { good: "text-good", watch: "text-watch", act: "text-act" };

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const label = kpi.value != null ? `${kpi.label}, ${kpi.value}${kpi.source ? `, ${kpi.source.text}` : ""}` : `${kpi.label}, not measured yet`;
  const stale = kpi.source?.state === "stale";
  return (
    <div role="group" aria-label={label} className="rounded-xl bg-wash p-3.5 sm:p-4 grid gap-1 content-start min-w-0">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted leading-tight">{kpi.label}</span>
      {kpi.value != null ? (
        <b className={`font-display tabular text-[1.5rem] sm:text-[1.75rem] leading-tight font-medium ${stale ? "text-ink-muted" : TONE[kpi.tone ?? ""] ?? "text-ink"}`}>{kpi.value}</b>
      ) : (
        <b className="font-display text-[1.05rem] leading-snug font-medium text-ink-muted">Not measured yet</b>
      )}
      {kpi.value != null && kpi.compare && <span className="text-[0.8rem] text-ink-muted leading-snug">{kpi.compare}</span>}
      {kpi.value == null && kpi.notMeasured && <span className="text-[0.8rem] text-ink-muted leading-snug">{kpi.notMeasured.reason}{kpi.notMeasured.from ? `; from ${kpi.notMeasured.from}` : ""}</span>}
      {kpi.source && <span className="mt-1"><Fresh chip={kpi.source} /></span>}
    </div>
  );
}

export function KpiGrid({ kpis, max = 5 }: { kpis: Kpi[]; max?: number }) {
  const shown = kpis.slice(0, max);
  return (
    <div className={`grid gap-3 grid-cols-2 ${shown.length >= 5 ? "lg:grid-cols-5" : shown.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {shown.map((k, i) => (
        // On phones the KPIs are a 2 by 2 grid; a fifth goes below at full width.
        <div key={k.label} className={i === 4 ? "col-span-2 lg:col-span-1" : ""}><KpiTile kpi={k} /></div>
      ))}
    </div>
  );
}
