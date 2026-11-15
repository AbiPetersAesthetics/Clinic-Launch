// ALFRED's charts (docs/ALFRED-DESIGN.md). Each answers one question the sentence above it raises.
// Colour means one thing: on target (green), watch (amber), problem (red); everything else is ink
// and grey, so every chart still reads in greyscale. Labels sit on the chart; no legends, no
// gridline clutter. Built as plain SVG and HTML so they stay sharp and fast on a phone.
import type { ReactNode } from "react";
import { Link } from "wouter";

export const C = {
  ink: "#1F2A44", ink2: "#4A5368", muted: "#7A8191", track: "#E7E9EE", grid: "#E7E9EE", base: "#C5CAD3",
  good: "#1E8449", watch: "#B5800C", bad: "#C0392B", surface: "#FFFFFF",
};
export type Status = "good" | "watch" | "bad" | "neutral";
const fill = (s: Status) => (s === "good" ? C.good : s === "watch" ? C.watch : s === "bad" ? C.bad : C.ink);
const gbp = (n: number, dp = 0) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

// One figure against its limit or target: a grey track, the measured bar, and the limit marked and
// named on the chart. Reads "how close are we to the line".
export function Bullet({ value, target, max, status, valueLabel, targetLabel, ariaLabel }: { value: number; target?: number | null; max?: number; status: Status; valueLabel: string; targetLabel?: string; ariaLabel: string }) {
  const top = max ?? (Math.max(value, target ?? 0) * 1.25 || 1);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (100 * n) / top))}%`;
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <div className="relative h-7">
        <div className="absolute inset-y-2 left-0 right-0 rounded-full" style={{ background: C.track }} />
        <div className="absolute inset-y-2 left-0 rounded-full" style={{ width: pct(value), background: fill(status) }} />
        {target != null && <div className="absolute inset-y-0 w-[2px]" style={{ left: pct(target), background: C.ink }} />}
      </div>
      <div className="relative h-5 text-[0.8rem] leading-5">
        <span className="absolute font-semibold whitespace-nowrap" style={{ left: 0, color: C.ink }}>{valueLabel}</span>
        {target != null && targetLabel && <span className="absolute whitespace-nowrap -translate-x-full pr-0.5" style={{ left: `calc(${pct(target)} + 2px)`, color: C.ink2 }}>{targetLabel}</span>}
      </div>
    </div>
  );
}

// A funnel with proportional widths: each stage a bar as wide as its share of the first, the count
// on the bar and the stage named beside it. Stages not yet measurable are drawn as an outline with
// the date they start.
export interface Stage { label: string; value: number | null; note?: string }
export function Funnel({ stages, ariaLabel }: { stages: Stage[]; ariaLabel: string }) {
  const first = Math.max(1, stages[0]?.value ?? 1);
  return (
    <ol role="img" aria-label={ariaLabel} className="grid gap-1.5">
      {stages.map((s, i) => {
        const w = s.value == null ? 100 : Math.max(6, (100 * s.value) / first);
        return (
          <li key={s.label} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
            <span className="text-[0.85rem] text-ink-2 leading-tight">{s.label}</span>
            <span className="relative h-8 flex items-center">
              {s.value == null ? (
                <span className="h-8 w-full rounded-md border border-dashed flex items-center px-2.5 text-[0.8rem]" style={{ borderColor: C.base, color: C.muted }}>{s.note ?? "not measured yet"}</span>
              ) : (
                <>
                  <span className="h-8 rounded-md" style={{ width: `${w}%`, background: i === 0 ? C.ink2 : C.ink, opacity: i === 0 ? 0.55 : 1 }} />
                  <span className="ml-2 text-[0.9rem] font-semibold text-ink whitespace-nowrap">{s.value}{s.note ? <span className="font-normal text-ink-2"> {s.note}</span> : null}</span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Columns for a short run of days (leads per day, for example). The latest value is labelled; the
// rest are in the hover title. Single series, so no legend: the sentence above names it.
export function DayColumns({ days, ariaLabel, highlightFrom }: { days: { label: string; value: number; title?: string }[]; ariaLabel: string; highlightFrom?: number }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-1">
      <div className="flex items-end gap-[3px] h-20">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end h-full" title={d.title ?? `${d.label}: ${d.value}`}>
            {i === days.length - 1 && <span className="text-[0.75rem] font-semibold text-center text-ink">{d.value}</span>}
            <div className="rounded-t-[3px]" style={{ height: `${Math.max(d.value ? 4 : 1, (100 * d.value) / max)}%`, background: highlightFrom != null && i < highlightFrom ? C.base : C.ink }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[0.72rem] text-muted-ink" style={{ color: C.muted }}><span>{days[0]?.label}</span><span>{days[days.length - 1]?.label}</span></div>
    </div>
  );
}

// The bank, month by month, with the £10,000 floor drawn and named on the chart. Months under the
// floor are marked in the problem colour; the lowest month is labelled.
export function BalanceLine({ points, floor, ariaLabel, height = 130, compare }: { points: { label: string; value: number }[]; floor: number; ariaLabel: string; height?: number; compare?: { points: { label: string; value: number }[]; label: string } | null }) {
  if (points.length < 2) return null;
  const W = 340, H = height, padL = 6, padR = 6, padT = 22, padB = 20;
  const vals = points.map((p) => p.value);
  const cv = compare?.points?.map((p) => p.value) ?? [];
  const lo = Math.min(floor, ...vals, ...cv), hi = Math.max(floor, ...vals, ...cv);
  const span = hi - lo || 1;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const minI = vals.indexOf(Math.min(...vals));
  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={0} x2={W} y1={y(floor)} y2={y(floor)} stroke={C.base} strokeWidth={1} />
      <text x={W - 2} y={y(floor) - 4} textAnchor="end" fontSize="10" fill={C.muted}>£{floor.toLocaleString("en-GB")} reference</text>
      {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={C.bad} strokeWidth={1} />}
      {compare && compare.points.length > 1 && (() => { const cp = compare.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "); const last = compare.points[compare.points.length - 1]; return <g><path d={cp} fill="none" stroke={C.base} strokeWidth={2} strokeLinejoin="round" /><text x={W - 2} y={y(last.value) - 6} textAnchor="end" fontSize="10" fill={C.ink2}>{compare.label}</text></g>; })()}
      <path d={path} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={p.value < 0 ? 3.5 : 2.2} fill={p.value < 0 ? C.bad : C.ink} stroke={C.surface} strokeWidth={1.5}><title>{`${p.label}: ${gbp(p.value)}`}</title></circle>)}
      <text x={Math.min(W - 60, Math.max(50, x(minI)))} y={Math.max(11, y(vals[minI]) - 8)} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.ink}>lowest {gbp(vals[minI])}</text>
      <text x={2} y={H - 3} fontSize="10" fill={C.muted}>{points[0].label}</text>
      <text x={W - 2} y={H - 3} textAnchor="end" fontSize="10" fill={C.muted}>{points[points.length - 1].label}</text>
    </svg>
  );
}

// The diary: one filled bar per clinic day, booked time against the open time. Blocked days show as
// blocked; the day is named on the left and the share on the right.
export function DiaryBars({ days, ariaLabel }: { days: { label: string; booked: number; open: number; blocked?: boolean; note?: string }[]; ariaLabel: string }) {
  return (
    <ul role="img" aria-label={ariaLabel} className="grid gap-1">
      {days.map((d, i) => {
        const pct = d.open ? Math.round((100 * d.booked) / d.open) : 0;
        return (
          <li key={i} className="grid grid-cols-[4.75rem_1fr_3rem] items-center gap-2.5 text-[0.82rem]">
            <span className="text-ink-2">{d.label}</span>
            <span className="relative h-3.5 rounded-full" style={{ background: C.track }}>
              {!d.blocked && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: C.ink }} />}
            </span>
            <span className="text-right tabular text-ink">{d.blocked ? "blocked" : `${pct}%`}</span>
          </li>
        );
      })}
    </ul>
  );
}

// A campaign timeline: months across the top, each campaign a bar over its dates, today marked.
export function Timeline({ months, rows, todayIndex, ariaLabel }: { months: string[]; rows: { label: string; from: number; to: number; live?: boolean }[]; todayIndex: number; ariaLabel: string }) {
  const n = months.length;
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-1.5">
      <div className="relative grid text-[0.7rem]" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, color: C.muted }}>{months.map((m) => <span key={m}>{m}</span>)}</div>
      <div className="relative grid gap-2.5">
        <div className="absolute inset-y-0 w-px" style={{ left: `${(100 * (todayIndex + 0.5)) / n}%`, background: C.ink }} aria-hidden />
        {rows.map((r, i) => (
          <div key={i} className="grid gap-1">
            <span className="text-[0.85rem] leading-tight" style={{ color: r.live ? C.ink : C.ink2, fontWeight: r.live ? 600 : 400 }}>{r.label}{r.live ? " · live" : ""}</span>
            <div className="relative h-2.5"><div className="absolute inset-y-0 rounded-full" style={{ left: `${(100 * r.from) / n}%`, width: `${(100 * (r.to - r.from + 1)) / n}%`, background: r.live ? C.ink : C.base }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// One idea per section: a plain sentence a non-analyst understands, the picture that proves it,
// and a single line of source and age.
export function Insight({ sentence, children, foot, href }: { sentence: ReactNode; children?: ReactNode; foot?: ReactNode; href?: string }) {
  return (
    <section className="grid gap-3 py-5 border-t border-border first:border-t-0 first:pt-0">
      <p className="text-[1.15rem] sm:text-[1.25rem] leading-snug font-semibold text-ink max-w-[34ch] sm:max-w-[48ch]">{sentence}</p>
      {children}
      {(foot || href) && <div className="flex items-center justify-between gap-3 text-[0.78rem]" style={{ color: C.muted }}><span>{foot}</span>{href && <Link href={href} className="underline text-ink-2 shrink-0 min-h-[32px] inline-flex items-center">Detail</Link>}</div>}
    </section>
  );
}
