// ALFRED's charts (docs/ALFRED-DESIGN.md). Each answers one question the sentence above it raises.
// Colour means one thing: on target (green), watch (amber), problem (red); everything else is ink
// and grey, so every chart still reads in greyscale. Labels sit on the chart; no legends, no
// gridline clutter. Built as plain SVG and HTML so they stay sharp and fast on a phone.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";

export const C = {
  ink: "#1F2A44", ink2: "#3A4458", muted: "#4A5568", track: "#DDE2EA", grid: "#DDE2EA", base: "#8E99AB",
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
                  <span className="h-8 rounded-md" style={{ width: `${w}%`, background: i === 0 ? "#445B72" : C.ink }} />
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

// The bank, month by month. Drawn at the real pixel width of its container, so the type is the same
// size on a phone and a desktop: a money scale on the left, every month named along the bottom, the
// line with a soft fill, and three things labelled on the chart: where it starts, its lowest point
// and where it ends. The £10,000 line is a quiet dashed reference. An optional second line (the
// plan) is drawn in grey and named at its end.
function niceStep(span: number, target = 4) {
  const raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
const kGbp = (v: number) => (Math.abs(v) >= 1000 ? `£${(v / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : `£${Math.round(v)}`);

export function BalanceLine({ points, floor, ariaLabel, height = 250, compare }: { points: { label: string; value: number }[]; floor: number; ariaLabel: string; height?: number; compare?: { points: { label: string; value: number }[]; label: string } | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setW(Math.max(280, Math.round(el.clientWidth)));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return null;
  const H = W < 480 ? Math.min(height, 210) : height;
  const padL = 46, padR = 18, padT = 26, padB = 34;
  const vals = points.map((p) => p.value);
  const cv = compare?.points?.map((p) => p.value) ?? [];
  const rawLo = Math.min(floor, ...vals, ...cv), rawHi = Math.max(floor, ...vals, ...cv);
  const step = niceStep(rawHi - rawLo || 1);
  const lo = Math.floor(rawLo / step) * step, hi = Math.ceil(rawHi / step) * step;
  const ticks: number[] = []; for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`;
  const minI = vals.indexOf(Math.min(...vals)), lastI = points.length - 1;
  const every = (W - padL - padR) / points.length >= 34 ? 1 : 2;
  const month = (l: string) => l.split(" ")[0];
  const year = (l: string) => l.split(" ")[1] ?? "";
  // A value label with a white halo so it stays readable over the line; kept inside the plot.
  const tag = (i: number, text: string, strong = false) => {
    const px = x(i), py = y(vals[i]);
    const above = py - padT > 22;
    const anchor = px < padL + 50 ? "start" : px > W - padR - 60 ? "end" : "middle";
    return <text x={px} y={above ? py - 10 : py + 20} textAnchor={anchor} fontSize="13" fontWeight={strong ? 700 : 600} fill={C.ink} stroke={C.surface} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{text}</text>;
  };
  const labelled = new Set([0, minI, lastI]);
  return (
    <div ref={box} className="w-full">
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.base : C.grid} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill={C.muted}>{kGbp(t)}</text>
          </g>
        ))}
        {floor > lo && floor < hi && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(floor)} y2={y(floor)} stroke={C.base} strokeWidth={1.5} strokeDasharray="5 5" />
            <text x={W - padR} y={y(floor) + 15} textAnchor="end" fontSize="11.5" fill={C.muted} stroke={C.surface} strokeWidth={3} paintOrder="stroke">{gbp(floor)} reference</text>
          </g>
        )}
        <path d={area} fill={C.ink} opacity={0.07} />
        {compare && compare.points.length > 1 && (() => {
          const cp = compare.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
          const last = compare.points[compare.points.length - 1];
          return <g><path d={cp} fill="none" stroke={C.base} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" /><text x={W - padR} y={y(last.value) - 8} textAnchor="end" fontSize="12" fill={C.ink2} stroke={C.surface} strokeWidth={3} paintOrder="stroke">{compare.label}</text></g>;
        })()}
        <path d={line} fill="none" stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={labelled.has(i) ? 4.5 : 3} fill={p.value < 0 ? C.bad : labelled.has(i) ? C.ink : C.surface} stroke={p.value < 0 ? C.bad : C.ink} strokeWidth={2}><title>{`${p.label}: ${gbp(p.value)}`}</title></circle>
        ))}
        {tag(0, `Now ${gbp(vals[0])}`)}
        {minI !== 0 && minI !== lastI && tag(minI, `Lowest ${gbp(vals[minI])}`, true)}
        {tag(lastI, gbp(vals[lastI]))}
        {points.map((p, i) => (i % every === 0 || i === lastI) && (
          <g key={`m${i}`}>
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="12" fill={C.ink2}>{month(p.label)}</text>
            {(i === 0 || month(p.label) === "Jan") && <text x={x(i)} y={H - 3} textAnchor="middle" fontSize="10.5" fill={C.muted}>20{year(p.label)}</text>}
          </g>
        ))}
      </svg>
    </div>
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
    <section className="grid gap-3 py-6 border-t border-line-strong first:border-t-0 first:pt-1">
      <p className="text-[1.2rem] sm:text-[1.35rem] leading-snug font-bold text-ink max-w-[32ch] sm:max-w-[46ch]">{sentence}</p>
      {children}
      {(foot || href) && <div className="flex items-center justify-between gap-3 text-[0.78rem]" style={{ color: C.muted }}><span>{foot}</span>{href && <Link href={href} className="underline text-ink-2 shrink-0 min-h-[32px] inline-flex items-center">Detail</Link>}</div>}
    </section>
  );
}
