// A figure, set like a printed briefing: a small label above, the numeral large in the sans face
// with tabular figures, one comparison line, and the source and age as quiet small print beneath.
// No box: a hairline rule above groups it. "Not measured yet" is a value, with its reason and date.
import { Fresh } from "@/components/fresh";
import type { Kpi } from "@/lib/alfred";

const TONE: Record<string, string> = { good: "text-good", watch: "text-watch", act: "text-act" };

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const label = kpi.value != null ? `${kpi.label}, ${kpi.value}${kpi.source ? `, ${kpi.source.text}` : ""}` : `${kpi.label}, not measured yet`;
  const stale = kpi.source?.state === "stale";
  return (
    <div role="group" aria-label={label} className="border-t border-line-strong pt-2.5 pb-1 grid gap-0.5 content-start min-w-0 h-full">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted leading-tight">{kpi.label}</span>
      {kpi.value != null ? (
        <b className={`font-sans tabular text-[1.6rem] sm:text-[2rem] leading-[1.1] font-medium tracking-[-0.01em] ${stale ? "text-ink-muted" : TONE[kpi.tone ?? ""] ?? "text-ink"}`}>{kpi.value}</b>
      ) : (
        <b className="font-sans text-[1rem] leading-snug font-medium text-ink-muted pt-1">Not measured yet</b>
      )}
      {kpi.value != null && kpi.compare && <span className="text-[0.78rem] text-ink-muted leading-snug">{kpi.compare}</span>}
      {kpi.value == null && kpi.notMeasured && <span className="text-[0.78rem] text-ink-muted leading-snug">{kpi.notMeasured.reason}{kpi.notMeasured.from ? `; from ${kpi.notMeasured.from}` : ""}</span>}
      {kpi.source && <span><Fresh chip={kpi.source} /></span>}
    </div>
  );
}

export function KpiGrid({ kpis, max = 4 }: { kpis: Kpi[]; max?: number }) {
  const shown = kpis.slice(0, max);
  return (
    <div className={`grid gap-x-5 gap-y-4 grid-cols-2 ${shown.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {shown.map((k) => <KpiTile key={k.label} kpi={k} />)}
    </div>
  );
}
