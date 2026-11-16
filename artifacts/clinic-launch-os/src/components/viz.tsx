// ALFRED's second chart kit (owner, 16 Nov 2026: "information / data is beautiful"). Every list of
// figures that used to be a row of text gets a picture that proves it: a split bar, columns, a ring,
// a rail of dates, a rank strip. Display only: each chart draws figures the page already holds and
// changes none of them. Brand colours only (ink, slate, sage and the three state colours); every
// chart carries its values as text as well, so nothing depends on colour alone.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";

export const V = {
  ink: "#1F2A44", slate: "#445B72", sage: "#A7C0B6", sageDeep: "#7FA49A", good: "#3F7A68", watch: "#B5800C", act: "#A33A3A",
  track: "#E3EAF3", grid: "#DDE2EA", muted: "#4A5568", base: "#8E99AB", surface: "#FFFFFF", wash: "#EFF3F8",
};
export const SERIES = [V.ink, V.sageDeep, V.slate, V.sage, V.base];
const gbp = (n: number) => `${n < 0 ? "minus " : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const kGbp = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? "-" : ""}£${(Math.abs(v) / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : `${v < 0 ? "-" : ""}£${Math.abs(Math.round(v))}`);

function useWidth(min = 280): [React.RefObject<HTMLDivElement | null>, number] {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setW(Math.max(min, Math.round(el.clientWidth)));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [box, W];
}
function niceStep(span: number, target = 4) {
  const raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))), n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

// A whole split into its parts: one bar, each part as wide as its share, then the parts named with
// their figures. "Where is the money", "who is owed what".
export interface Part { label: string; value: number | null; note?: string; color?: string }
export function SplitBar({ parts, ariaLabel, total, format = gbp, stack = false }: { parts: Part[]; ariaLabel: string; total?: { label: string; value: string }; format?: (n: number) => string; stack?: boolean }) {
  const known = parts.filter((p) => p.value != null && p.value > 0);
  const sum = known.reduce((s, p) => s + (p.value ?? 0), 0) || 1;
  const colorOf = (p: Part) => p.color ?? SERIES[known.indexOf(p) % SERIES.length];
  return (
    <div className="grid gap-3" role="img" aria-label={ariaLabel}>
      {total && <p className="flex items-baseline justify-between gap-3"><span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">{total.label}</span><b className="font-sans tabular text-[1.9rem] sm:text-[2.3rem] leading-none font-extrabold tracking-[-0.02em] text-ink">{total.value}</b></p>}
      <div className="flex h-10 w-full gap-[3px] rounded-lg overflow-hidden">
        {known.map((p) => <span key={p.label} title={`${p.label}: ${format(p.value ?? 0)}`} style={{ width: `${(100 * (p.value ?? 0)) / sum}%`, background: colorOf(p), minWidth: 6 }} />)}
      </div>
      <ul className={`grid gap-x-6 gap-y-2 ${stack ? "" : "sm:grid-cols-2"}`}>
        {parts.map((p) => (
          <li key={p.label} className="flex items-start gap-2.5 min-w-0">
            <span aria-hidden className="mt-1.5 w-3 h-3 rounded-[3px] shrink-0" style={p.value != null && p.value > 0 ? { background: colorOf(p) } : { border: `1.5px dashed ${V.base}` }} />
            <span className="min-w-0 flex-1"><span className="block text-[0.95rem] text-ink leading-snug">{p.label}</span>{p.note && <span className="block text-[0.78rem] text-ink-muted leading-snug">{p.note}</span>}</span>
            <span className="text-right shrink-0"><span className="block tabular font-bold text-ink">{p.value == null ? "not known" : format(p.value)}</span>{p.value != null && p.value > 0 && <span className="block text-[0.75rem] text-ink-muted tabular">{Math.round((100 * p.value) / sum)}%</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Progress against a line: what is in (solid), what is promised (lighter), and the target marked and
// named. "Are we going to make the month."
export function TargetBar({ segments, target, targetLabel, ariaLabel, format = gbp }: { segments: { label: string; value: number; color?: string }[]; target?: number | null; targetLabel?: string; ariaLabel: string; format?: (n: number) => string }) {
  const sum = segments.reduce((s, x) => s + x.value, 0);
  const top = Math.max(sum, target ?? 0) * 1.06 || 1;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (100 * n) / top))}%`;
  const gap = target != null ? target - sum : null;
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-2">
      <div className="relative pt-6">
        {target != null && <span className="absolute top-0 text-[0.75rem] font-semibold text-ink whitespace-nowrap -translate-x-full pr-1.5" style={{ left: pct(target) }}>{targetLabel ?? `target ${format(target)}`}</span>}
        <div className="relative h-9 rounded-lg overflow-hidden" style={{ background: V.track }}>
          <div className="absolute inset-y-0 left-0 flex" style={{ width: pct(sum) }}>
            {segments.map((s, i) => <span key={s.label} title={`${s.label}: ${format(s.value)}`} style={{ width: `${sum ? (100 * s.value) / sum : 0}%`, background: s.color ?? SERIES[i % SERIES.length] }} />)}
          </div>
        </div>
        {target != null && <span aria-hidden className="absolute bottom-[-4px] top-5 w-[2.5px] rounded-full" style={{ left: pct(target), background: V.ink }} />}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.85rem]">
        {segments.map((s, i) => <span key={s.label} className="inline-flex items-center gap-1.5 text-ink"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: s.color ?? SERIES[i % SERIES.length] }} />{s.label} <b className="tabular">{format(s.value)}</b></span>)}
        {gap != null && <span className={`ml-auto font-semibold tabular ${gap <= 0 ? "text-good" : "text-ink-2"}`}>{gap <= 0 ? `${format(-gap)} over the line` : `${format(gap)} still to find`}</span>}
      </div>
    </div>
  );
}

// Money in above the line, money out below it, month by month. The biggest month each way is
// labelled; every column carries its figure on hover and in the table beneath for screen readers.
export function InOutColumns({ rows, ariaLabel, inLabel = "In", outLabel = "Out" }: { rows: { label: string; in: number; out: number; title?: string }[]; ariaLabel: string; inLabel?: string; outLabel?: string }) {
  const [box, W] = useWidth();
  if (!rows.length) return null;
  const H = W < 480 ? 230 : 280, padL = 46, padR = 8, padT = 22, padB = 30;
  const hi = Math.max(1, ...rows.map((r) => r.in)), lo = Math.max(1, ...rows.map((r) => r.out));
  const step = niceStep(hi + lo, 5);
  const top = Math.ceil(hi / step) * step, bottom = Math.ceil(lo / step) * step;
  const y = (v: number) => padT + ((top - v) / (top + bottom)) * (H - padT - padB);
  const slot = (W - padL - padR) / rows.length, bw = Math.max(6, Math.min(34, slot * 0.62));
  const ticks: number[] = []; for (let t = -bottom; t <= top + 1e-6; t += step) ticks.push(t);
  const every = slot >= 34 ? 1 : 2;
  const labelAll = slot >= 52;
  const maxIn = rows.findIndex((r) => r.in === hi), maxOut = rows.findIndex((r) => r.out === lo);
  return (
    <div ref={box} className="w-full grid gap-2">
      <div className="flex flex-wrap gap-x-5 text-[0.82rem] text-ink"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.good }} />{inLabel}</span><span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.slate }} />{outLabel}</span></div>
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? V.ink : V.grid} strokeWidth={t === 0 ? 1.5 : 1} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={V.muted}>{kGbp(Math.abs(t))}</text></g>)}
        {rows.map((r, i) => {
          const cx = padL + slot * (i + 0.5);
          return (
            <g key={r.label}>
              <title>{r.title ?? `${r.label}: in ${gbp(r.in)}, out ${gbp(r.out)}`}</title>
              <rect x={cx - bw / 2} y={y(r.in)} width={bw} height={Math.max(0, y(0) - y(r.in))} rx={3} fill={V.good} />
              <rect x={cx - bw / 2} y={y(0)} width={bw} height={Math.max(0, y(-r.out) - y(0))} rx={3} fill={V.slate} />
              {(labelAll || i === maxIn) && r.in > 0 && <text x={cx} y={y(r.in) - 5} textAnchor="middle" fontSize="11.5" fontWeight={i === maxIn ? 700 : 500} fill={V.ink}>{kGbp(r.in)}</text>}
              {(labelAll || i === maxOut) && r.out > 0 && <text x={cx} y={y(-r.out) + 14} textAnchor="middle" fontSize="11.5" fontWeight={i === maxOut ? 700 : 500} fill={V.ink}>{kGbp(r.out)}</text>}
              {(i % every === 0) && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11.5" fill={V.muted}>{r.label.split(" ")[0]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Stacked columns for two series over months (Bedhampton and Winchester takings in the plan).
export function StackColumns({ rows, aLabel, bLabel, ariaLabel, mark }: { rows: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string; ariaLabel: string; mark?: { index: number; label: string } | null }) {
  const [box, W] = useWidth();
  if (!rows.length) return null;
  const H = W < 480 ? 220 : 260, padL = 46, padR = 8, padT = 26, padB = 30;
  const hi = Math.max(1, ...rows.map((r) => r.a + r.b));
  const step = niceStep(hi, 4), top = Math.ceil(hi / step) * step;
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const slot = (W - padL - padR) / rows.length, bw = Math.max(6, Math.min(36, slot * 0.64));
  const ticks: number[] = []; for (let t = 0; t <= top + 1e-6; t += step) ticks.push(t);
  const every = slot >= 34 ? 1 : 2, labelAll = slot >= 52;
  return (
    <div ref={box} className="w-full grid gap-2">
      <div className="flex flex-wrap gap-x-5 text-[0.82rem] text-ink"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.ink }} />{bLabel}</span><span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.sageDeep }} />{aLabel}</span></div>
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? V.base : V.grid} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={V.muted}>{kGbp(t)}</text></g>)}
        {mark && mark.index >= 0 && mark.index < rows.length && (() => { const mx = padL + slot * mark.index; return <g><line x1={mx} x2={mx} y1={padT - 12} y2={H - padB} stroke={V.ink} strokeDasharray="3 4" /><text x={mx + 5} y={padT - 12 + 4} fontSize="11.5" fontWeight={600} fill={V.ink}>{mark.label}</text></g>; })()}
        {rows.map((r, i) => {
          const cx = padL + slot * (i + 0.5);
          return (
            <g key={r.label}>
              <title>{`${r.label}: ${aLabel} ${gbp(r.a)}, ${bLabel} ${gbp(r.b)}, together ${gbp(r.a + r.b)}`}</title>
              <rect x={cx - bw / 2} y={y(r.a)} width={bw} height={Math.max(0, y(0) - y(r.a))} fill={V.sageDeep} rx={r.b > 0 ? 0 : 3} />
              <rect x={cx - bw / 2} y={y(r.a + r.b)} width={bw} height={Math.max(0, y(r.a) - y(r.a + r.b))} fill={V.ink} rx={3} />
              {(labelAll || i === 0 || i === rows.length - 1) && <text x={cx} y={y(r.a + r.b) - 5} textAnchor="middle" fontSize="11.5" fontWeight={600} fill={V.ink}>{kGbp(r.a + r.b)}</text>}
              {(i % every === 0) && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11.5" fill={V.muted}>{r.label.split(" ")[0]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Columns either side of a line that must be crossed (Winchester's margin over standing alone).
export function MarginColumns({ rows, ariaLabel, marks = [], lineLabel, money = true }: { rows: { label: string; value: number; title?: string }[]; ariaLabel: string; marks?: { index: number; label: string }[]; lineLabel?: string; money?: boolean }) {
  const fmt = money ? kGbp : (n: number) => String(Math.round(n * 10) / 10);
  const [box, W] = useWidth();
  if (!rows.length) return null;
  const H = W < 480 ? 240 : 300, padL = 50, padR = 8, padT = 30, padB = 30;
  const hi = Math.max(0, ...rows.map((r) => r.value)), lo = Math.min(0, ...rows.map((r) => r.value));
  const step = niceStep(hi - lo || 1, 5);
  const top = Math.max(step, Math.ceil(hi / step) * step), bottom = Math.floor(lo / step) * step;
  const y = (v: number) => padT + ((top - v) / (top - bottom || 1)) * (H - padT - padB);
  const slot = (W - padL - padR) / rows.length, bw = Math.max(5, Math.min(30, slot * 0.66));
  const ticks: number[] = []; for (let t = bottom; t <= top + 1e-6; t += step) ticks.push(t);
  const every = slot >= 34 ? 1 : slot >= 18 ? 2 : 3;
  const firstOver = rows.findIndex((r) => r.value >= 0);
  const minI = rows.reduce((m, r, i) => (r.value < rows[m].value ? i : m), 0);
  return (
    <div ref={box} className="w-full">
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? V.ink : V.grid} strokeWidth={t === 0 ? 2 : 1} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={V.muted}>{fmt(t)}</text></g>)}
        {lineLabel && <text x={padL + 6} y={y(0) - 7} textAnchor="start" fontSize="11.5" fontWeight={600} fill={V.ink} stroke={V.surface} strokeWidth={3} paintOrder="stroke">{lineLabel}</text>}
        {marks.filter((m) => m.index >= 0 && m.index < rows.length).map((m, k) => { const mx = padL + slot * (m.index + 0.5); return <g key={m.label}><line x1={mx} x2={mx} y1={padT - 14 + k * 13} y2={H - padB} stroke={V.slate} strokeDasharray="3 4" /><text x={mx + (mx > W - 150 ? -5 : 5)} y={padT - 16 + k * 13 + 4} textAnchor={mx > W - 150 ? "end" : "start"} fontSize="11.5" fontWeight={600} fill={V.slate}>{m.label}</text></g>; })}
        {rows.map((r, i) => {
          const cx = padL + slot * (i + 0.5), up = r.value >= 0;
          return (
            <g key={r.label}>
              <title>{r.title ?? `${r.label}: ${gbp(r.value)}`}</title>
              <rect x={cx - bw / 2} y={up ? y(r.value) : y(0)} width={bw} height={Math.max(1, Math.abs(y(r.value) - y(0)))} rx={3} fill={up ? V.good : V.base} />
              {(i === 0 || i === rows.length - 1 || i === firstOver || i === minI) && <text x={cx} y={up ? y(r.value) - 5 : y(r.value) + 14} textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"} fontSize="11.5" fontWeight={700} fill={V.ink} stroke={V.surface} strokeWidth={3} paintOrder="stroke">{fmt(r.value)}</text>}
              {(i % every === 0) && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={V.muted}>{r.label.split(" ")[0]}{r.label.startsWith("Jan") ? ` ${r.label.split(" ")[1] ?? ""}` : ""}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// A share of a whole as a ring, the figure in the middle and what it is beneath.
export function Ring({ value, label, sub, center, tone = "ink", size = 132 }: { value: number; label: string; sub?: string; center?: string; tone?: "ink" | "good" | "watch" | "act" | "sage"; size?: number }) {
  const v = Math.max(0, Math.min(1, value)), r = size / 2 - 11, c = 2 * Math.PI * r;
  const col = tone === "good" ? V.good : tone === "watch" ? V.watch : tone === "act" ? V.act : tone === "sage" ? V.sageDeep : V.ink;
  return (
    <div className="grid justify-items-center gap-1.5 text-center min-w-0" role="img" aria-label={`${label}: ${center ?? `${Math.round(v * 100)}%`}${sub ? `, ${sub}` : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V.track} strokeWidth={13} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.24} fontWeight={800} fill={V.ink} style={{ letterSpacing: "-0.02em" }}>{center ?? `${Math.round(v * 100)}%`}</text>
      </svg>
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted leading-tight">{label}</span>
      {sub && <span className="text-[0.8rem] text-ink-2 leading-snug max-w-[22ch]">{sub}</span>}
    </div>
  );
}

// How much of a limit is used: the bar, the share, and what is left.
export function UsageBar({ label, note, used, limit, right }: { label: string; note?: string; used: number; limit: number; right?: ReactNode }) {
  const pct = limit > 0 ? Math.round((100 * used) / limit) : 0;
  const col = pct >= 90 ? V.act : pct >= 70 ? V.watch : V.ink;
  return (
    <div className="grid gap-1.5 py-3 border-b border-border last:border-b-0" role="img" aria-label={`${label}: ${gbp(used)} of ${gbp(limit)} used, ${pct} per cent`}>
      <div className="flex items-baseline justify-between gap-3"><span className="font-semibold text-ink">{label}</span><span className="tabular font-bold text-ink">{gbp(used)} <span className="font-normal text-ink-muted">of {gbp(limit)}</span></span></div>
      <div className="relative h-3.5 rounded-full overflow-hidden" style={{ background: V.track }}><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: col }} /></div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[0.8rem] text-ink-muted"><span><b style={{ color: col }}>{pct}% used</b>, {gbp(Math.max(0, limit - used))} left{note ? `; ${note}` : ""}</span>{right}</div>
    </div>
  );
}

// Plain horizontal bars for a short ranked list: the name, the bar, the figure.
export function HBars({ rows, ariaLabel, max, color = V.ink, labelWidth = "8.5rem" }: { rows: { label: string; value: number; display: string; note?: string; color?: string; ghost?: boolean }[]; ariaLabel: string; max?: number; color?: string; labelWidth?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul role="img" aria-label={ariaLabel} className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid items-center gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
          <span className="text-[0.9rem] text-ink leading-tight">{r.label}{r.note && <span className="block text-[0.76rem] text-ink-muted">{r.note}</span>}</span>
          <span className="flex items-center gap-2 min-w-0">
            <span className="h-7 rounded-md" style={{ width: `${Math.max(1.5, (100 * r.value) / top)}%`, background: r.ghost ? "transparent" : r.color ?? color, border: r.ghost ? `1.5px dashed ${V.base}` : undefined, maxWidth: "calc(100% - 5.5rem)" }} />
            <span className="tabular font-bold text-ink text-[0.92rem] whitespace-nowrap">{r.display}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// A rail of dated things: the date as a small calendar tile, how far off it is, what it is.
export function DateRail({ items, todayIso }: { items: { date: string; title: string; note?: string; amount?: string | null; href?: string }[]; todayIso?: string }) {
  const today = new Date((todayIso ?? new Date().toISOString().slice(0, 10)) + "T12:00:00Z").getTime();
  return (
    <ol className="relative grid gap-0">
      <span aria-hidden className="absolute left-[1.55rem] top-3 bottom-3 w-[2px]" style={{ background: V.grid }} />
      {items.map((d, i) => {
        const dt = new Date(d.date + "T12:00:00Z"), days = Math.round((dt.getTime() - today) / 86400000);
        const soon = days <= 14, col = days < 0 ? V.act : soon ? V.watch : V.ink;
        const away = days < 0 ? `${-days} days ago` : days === 0 ? "today" : days < 60 ? `in ${days} days` : days < 700 ? `in ${Math.round(days / 30.4)} months` : `in ${(days / 365).toFixed(1)} years`;
        const body = (
          <>
            <span className="relative z-[1] w-[3.1rem] shrink-0 rounded-lg overflow-hidden border text-center bg-card" style={{ borderColor: col }}>
              <span className="block text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white py-[1px]" style={{ background: col }}>{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}{dt.getUTCFullYear() !== new Date(today).getUTCFullYear() ? ` ${String(dt.getUTCFullYear()).slice(2)}` : ""}</span>
              <span className="block text-[1.15rem] font-extrabold leading-[1.5] text-ink tabular">{dt.getUTCDate()}</span>
            </span>
            <span className="min-w-0 flex-1 pt-0.5"><span className="block text-[0.98rem] font-semibold text-ink leading-snug">{d.title}</span>{d.note && <span className="block text-[0.82rem] text-ink-muted leading-snug">{d.note}</span>}</span>
            <span className="text-right shrink-0 pt-0.5">{d.amount && <span className="block tabular font-bold text-ink">{d.amount}</span>}<span className="block text-[0.78rem] font-semibold whitespace-nowrap" style={{ color: col }}>{away}</span></span>
          </>
        );
        return <li key={i}>{d.href ? <Link href={d.href} className="flex items-start gap-3 py-2.5 hover:bg-wash/60 rounded-lg">{body}</Link> : <div className="flex items-start gap-3 py-2.5">{body}</div>}</li>;
      })}
    </ol>
  );
}

// Where a search query ranks: a strip from position 1 to 40 with page one shaded, the last window as
// a hollow dot and this window as a solid one, joined so the direction of travel shows.
export function RankStrip({ position, prior, cap = 40 }: { position: number; prior?: number | null; cap?: number }) {
  const x = (p: number) => `${(100 * (Math.min(cap, Math.max(1, p)) - 1)) / (cap - 1)}%`;
  const better = prior != null && position < prior - 0.5, worse = prior != null && position > prior + 0.5;
  const col = better ? V.good : worse ? V.act : V.ink;
  return (
    <span className="relative block h-5 w-full" aria-hidden>
      <span className="absolute inset-y-[7px] left-0 right-0 rounded-full" style={{ background: V.track }} />
      <span className="absolute inset-y-[5px] left-0 rounded-full" style={{ width: x(10), background: V.sage, opacity: 0.55 }} />
      {prior != null && <span className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: x(Math.min(position, prior)), width: `calc(${x(Math.max(position, prior))} - ${x(Math.min(position, prior))})`, background: col }} />}
      {prior != null && <span className="absolute top-1/2 w-[11px] h-[11px] rounded-full -translate-x-1/2 -translate-y-1/2 bg-card" style={{ left: x(prior), border: `2px solid ${col}` }} />}
      <span className="absolute top-1/2 w-[14px] h-[14px] rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white" style={{ left: x(position), background: col }} />
    </span>
  );
}

// A journey as joined steps, each narrower than the last where it is measured.
export function Flow({ steps, ariaLabel }: { steps: { label: string; value: string; sub?: string; pending?: boolean }[]; ariaLabel: string }) {
  const shades = [V.ink, "#2C3A5A", V.slate, "#5E748A", "#7B8EA1"];
  return (
    <ol role="img" aria-label={ariaLabel} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={s.label} className="min-w-0 grid gap-1">
          <span className="relative block rounded-lg px-2 sm:px-3 py-3 sm:py-4 text-center" style={s.pending ? { border: `1.5px dashed ${V.base}`, background: V.wash } : { background: shades[i % shades.length] }}>
            <b className={`block font-sans tabular text-[1.2rem] sm:text-[1.7rem] leading-none font-extrabold tracking-[-0.02em] ${s.pending ? "text-ink-muted" : "text-white"}`}>{s.value}</b>
            <span className={`block mt-1 text-[0.6rem] sm:text-[0.7rem] font-bold uppercase tracking-[0.1em] truncate ${s.pending ? "text-ink-muted" : "text-white/85"}`}>{s.label}</span>
            {i < steps.length - 1 && <span aria-hidden className="absolute top-1/2 -right-[7px] z-[1] w-3 h-3 rotate-45 -translate-y-1/2" style={{ background: s.pending ? V.wash : shades[i % shades.length], borderTop: s.pending ? `1.5px dashed ${V.base}` : undefined, borderRight: s.pending ? `1.5px dashed ${V.base}` : undefined }} />}
          </span>
          {s.sub && <span className="text-[0.66rem] sm:text-[0.78rem] text-ink-muted leading-tight text-center">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
}

// The diary as columns: each clinic day as tall as its open time, filled to what is booked.
export function DiaryColumns({ days, ariaLabel }: { days: { label: string; booked: number; open: number; blocked?: boolean; clinic?: string }[]; ariaLabel: string }) {
  const top = Math.max(1, ...days.map((d) => d.open));
  return (
    <ol role="img" aria-label={ariaLabel} className="grid gap-1.5 sm:gap-2.5 items-end" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((d, i) => {
        const pct = d.open ? Math.round((100 * d.booked) / d.open) : 0;
        const col = pct >= 80 ? V.good : pct >= 40 ? V.ink : V.slate;
        return (
          <li key={i} className="grid gap-1 justify-items-stretch text-center min-w-0" title={d.blocked ? `${d.label}: blocked` : `${d.label}: ${(d.booked / 60).toFixed(1)} h booked of ${(d.open / 60).toFixed(1)} h open`}>
            <span className="text-[0.78rem] sm:text-[0.9rem] font-bold tabular text-ink">{d.blocked ? "" : `${pct}%`}</span>
            <span className="relative block w-full rounded-md overflow-hidden" style={{ height: d.blocked ? 44 : Math.max(44, (150 * d.open) / top), background: d.blocked ? `repeating-linear-gradient(135deg, ${V.track} 0 6px, ${V.surface} 6px 12px)` : V.track, border: d.blocked ? `1px solid ${V.grid}` : undefined }}>
              {!d.blocked && <span className="absolute inset-x-0 bottom-0" style={{ height: `${Math.min(100, pct)}%`, background: col }} />}
            </span>
            <span className="text-[0.66rem] sm:text-[0.78rem] text-ink-muted leading-tight">{d.label.split(" ")[0]}<br /><b className="text-ink font-semibold">{d.label.split(" ")[1] ?? ""}</b></span>
          </li>
        );
      })}
    </ol>
  );
}

export function Pill({ tone = "ink", children }: { tone?: "good" | "watch" | "act" | "ink" | "muted"; children: ReactNode }) {
  const cls = tone === "good" ? "bg-sage-whisper text-good border-good/30" : tone === "watch" ? "bg-watch-bg text-watch border-watch/30" : tone === "act" ? "bg-act-bg text-act border-act/30" : tone === "muted" ? "bg-wash text-ink-muted border-border" : "bg-wash text-ink border-border";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[0.75rem] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

// A figure tile in the panel style, for pages that set their own figures.
export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "good" | "watch" | "act" }) {
  const edge = tone === "good" ? "border-t-good" : tone === "watch" ? "border-t-watch" : tone === "act" ? "border-t-act" : "border-t-ink";
  return (
    <div className={`rounded-xl bg-card border border-border border-t-4 ${edge} shadow-[0_1px_3px_rgba(31,42,68,0.07)] px-3.5 pt-3 pb-3 grid gap-0.5 content-start min-w-0 h-full`}>
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted leading-tight">{label}</span>
      <b className="font-sans tabular text-[1.7rem] sm:text-[2.1rem] leading-[1.1] font-extrabold tracking-[-0.02em] text-ink">{value}</b>
      {sub && <span className="text-[0.78rem] text-ink-muted leading-snug">{sub}</span>}
    </div>
  );
}

// Leads, booked consultations and (once known) paying patients for each day, side by side. Hover,
// tap or tab to a day and the panel beneath names who asked, when, from which ad and where they
// have got to, with the day's spend. First name and initial only.
export interface LeadDay { label: string; leads: number; booked: number; paid: number | null; spend?: number; people: { name: string; time: string; ad?: string; status?: string; appt?: string | null }[] }
export function LeadDays({ days, ariaLabel, paidFrom }: { days: LeadDay[]; ariaLabel: string; paidFrom?: string }) {
  const lastWith = days.reduce((m, d, i) => (d.leads > 0 || d.booked > 0 ? i : m), days.length - 1);
  const [sel, setSel] = useState(lastWith);
  const top = Math.max(1, ...days.map((d) => Math.max(d.leads, d.booked, d.paid ?? 0)));
  const d = days[Math.min(sel, days.length - 1)];
  const anyPaid = days.some((x) => x.paid != null);
  const col = (n: number | null, color: string, name: string) => (
    <span className="flex-1 flex flex-col justify-end items-center h-full min-w-0" title={`${name}: ${n ?? "not known yet"}`}>
      <span className="text-[0.78rem] sm:text-[0.9rem] font-bold tabular text-ink leading-none pb-1">{n == null ? "" : n}</span>
      <span className="w-full rounded-t-[4px]" style={n == null ? { height: "18%", border: `1.5px dashed ${V.base}`, borderBottom: 0 } : { height: `${n ? Math.max(5, (100 * n) / top) : 0}%`, minHeight: n ? 4 : 2, background: n ? color : V.grid }} />
    </span>
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-ink">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.ink }} />Leads</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.good }} />Booked a consultation</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={anyPaid ? { background: V.sageDeep } : { border: `1.5px dashed ${V.base}` }} />Paid{!anyPaid && paidFrom ? `, ${paidFrom}` : ""}</span>
      </div>
      <div role="group" aria-label={ariaLabel} className="grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((x, i) => (
          <button key={x.label} type="button" onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onClick={() => setSel(i)} aria-pressed={i === sel}
            aria-label={`${x.label}: ${x.leads} leads, ${x.booked} booked${x.paid != null ? `, ${x.paid} paid` : ""}`}
            className={`grid gap-1.5 rounded-lg px-1 sm:px-2 pt-2 pb-1.5 text-center border ${i === sel ? "bg-wash border-ink" : "border-transparent hover:bg-wash/60"}`}>
            <span className="flex items-end gap-[3px] sm:gap-1.5 h-36 border-b" style={{ borderColor: V.base }}>
              {col(x.leads, V.ink, "Leads")}{col(x.booked, V.good, "Booked")}{col(x.paid, V.sageDeep, "Paid")}
            </span>
            <span className={`text-[0.7rem] sm:text-[0.82rem] leading-tight ${i === sel ? "font-bold text-ink" : "text-ink-muted"}`}>{x.label}</span>
          </button>
        ))}
      </div>
      {d && (
        <div className="rounded-xl border border-ink/25 bg-wash p-3.5 sm:p-4 grid gap-2.5" aria-live="polite">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <b className="text-[1.05rem] text-ink">{d.label}</b>
            <span className="text-[0.88rem] text-ink-2 tabular">{d.leads} {d.leads === 1 ? "lead" : "leads"}, {d.booked} booked{d.spend != null ? `, £${d.spend.toFixed(2)} spent` : ""}{d.spend != null && d.leads > 0 ? `, £${(d.spend / d.leads).toFixed(2)} a lead` : ""}</span>
          </p>
          {d.people.length ? (
            <ul className="grid gap-0 border-t border-line-strong/50">
              {d.people.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 border-b border-line-strong/40 last:border-b-0">
                  <span className="tabular text-[0.88rem] text-ink-2 w-[3.2rem] shrink-0">{p.time}</span>
                  <b className="text-ink text-[0.98rem] min-w-[6rem]">{p.name}</b>
                  <span className="text-[0.85rem] text-ink-2 flex-1 min-w-[8rem]">{p.ad ? `${p.ad} ad` : ""}</span>
                  <Pill tone={p.status === "booked" ? "good" : p.status === "existing" ? "muted" : "watch"}>{p.status === "booked" ? `Booked${p.appt ? `, ${p.appt}` : ""}` : p.status === "existing" ? "Existing patient" : "Not booked yet"}</Pill>
                </li>
              ))}
            </ul>
          ) : <p className="text-[0.9rem] text-ink-2">{d.leads ? "The names for this day are not in the pathway record." : "No leads this day."}</p>}
          {d.booked > 0 && d.people.filter((p) => p.status === "booked").length !== d.booked && <p className="text-[0.78rem] text-ink-muted">Booked is counted on the day the booking was made, so it can include someone who sent the form on another day.</p>}
        </div>
      )}
    </div>
  );
}

// One of our figures against a line (a limit, a guide, an outside benchmark): the figure large and
// coloured by how it sits, the bar with the line marked, and the line named beneath.
export function Bench({ label, value, display, mark, markLabel, max, lowerIsBetter = true, note }: { label: string; value: number; display: string; mark: number; markLabel: string; max?: number; lowerIsBetter?: boolean; note?: ReactNode }) {
  const top = max ?? Math.max(value, mark) * 1.2;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (100 * n) / top))}%`;
  const ok = lowerIsBetter ? value <= mark : value >= mark;
  const near = lowerIsBetter ? value <= mark * 1.5 : value >= mark * 0.7;
  const col = ok ? V.good : near ? V.watch : V.act;
  const word = ok ? (lowerIsBetter ? "better than the line" : "over the line") : near ? "just short of the line" : "well short of the line";
  return (
    <div className="grid gap-1.5 content-start" role="img" aria-label={`${label}: ${display}, against ${markLabel}; ${word}`}>
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      <b className="font-sans tabular text-[1.9rem] leading-none font-extrabold tracking-[-0.02em]" style={{ color: col }}>{display}</b>
      <div className="relative h-7">
        <div className="absolute inset-y-2 left-0 right-0 rounded-full" style={{ background: V.track }} />
        <div className="absolute inset-y-2 left-0 rounded-full" style={{ width: pct(value), background: col }} />
        <div className="absolute inset-y-0 w-[2.5px] rounded-full" style={{ left: pct(mark), background: V.ink }} />
      </div>
      <span className="text-[0.85rem] text-ink"><span aria-hidden className="inline-block w-[2.5px] h-3 align-[-1px] mr-1.5 rounded-full" style={{ background: V.ink }} />{markLabel}</span>
      {note && <span className="text-[0.82rem] text-ink-2 leading-snug">{note}</span>}
    </div>
  );
}

// Several lines over the same months (the growth models side by side): the one in use drawn heavy
// in ink, the others lighter, each named at its end with its last value.
export function MultiLine({ labels, series, ariaLabel }: { labels: string[]; series: { label: string; values: number[]; chosen?: boolean }[]; ariaLabel: string }) {
  const [box, W] = useWidth();
  if (labels.length < 2) return null;
  const H = W < 480 ? 250 : 300, padL = 46, padR = W < 480 ? 96 : 150, padT = 14, padB = 30;
  const hi = Math.max(1, ...series.flatMap((s) => s.values));
  const step = niceStep(hi, 4), top = Math.ceil(hi / step) * step;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (labels.length - 1);
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const ticks: number[] = []; for (let t = 0; t <= top + 1e-6; t += step) ticks.push(t);
  const every = (W - padL - padR) / labels.length >= 34 ? 1 : (W - padL - padR) / labels.length >= 17 ? 2 : 3;
  const tones = [V.sageDeep, V.base, V.slate, V.sage];
  let k = 0;
  const drawn = series.map((s) => ({ ...s, color: s.chosen ? V.ink : tones[k++ % tones.length] }));
  const last = labels.length - 1;
  let prev = -Infinity;
  const ends = [...drawn].sort((a, b) => b.values[last] - a.values[last]).map((s) => { let yy = y(s.values[last]); if (yy - prev < 30) yy = prev + 30; prev = yy; return { ...s, yy }; });
  return (
    <div ref={box} className="w-full">
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? V.base : V.grid} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={V.muted}>{kGbp(t)}</text></g>)}
        {[...drawn].sort((a, b) => Number(!!a.chosen) - Number(!!b.chosen)).map((s) => (
          <g key={s.label}>
            <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.chosen ? 3.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={s.chosen ? 3 : 6} fill={s.chosen ? s.color : "transparent"}><title>{`${s.label}, ${labels[i]}: ${gbp(v)}`}</title></circle>)}
          </g>
        ))}
        {ends.map((s) => <text key={s.label} x={W - padR + 8} y={s.yy - 2} fontSize="12" fill={s.chosen ? V.ink : V.muted}><tspan x={W - padR + 8} fontWeight={700}>{kGbp(s.values[last])}</tspan><tspan x={W - padR + 8} dy={14} fontWeight={s.chosen ? 700 : 500}>{s.label}</tspan></text>)}
        {labels.map((l, i) => (i % every === 0) && <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={V.muted}>{l.split(" ")[0]}{l.startsWith("Jan") ? ` ${l.split(" ")[1] ?? ""}` : ""}</text>)}
      </svg>
    </div>
  );
}

// Stacked columns for any number of parts (what each month's costs are made of). Tap or hover a
// column to pick that month; the caller shows its detail.
export function StackN({ rows, parts, ariaLabel, selected, onSelect }: { rows: { label: string; values: number[] }[]; parts: { label: string; color: string }[]; ariaLabel: string; selected?: number; onSelect?: (i: number) => void }) {
  const [box, W] = useWidth();
  if (!rows.length) return null;
  const H = W < 480 ? 230 : 280, padL = 46, padR = 8, padT = 22, padB = 30;
  const sums = rows.map((r) => r.values.reduce((a, b) => a + b, 0));
  const hi = Math.max(1, ...sums), step = niceStep(hi, 4), top = Math.ceil(hi / step) * step;
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const slot = (W - padL - padR) / rows.length, bw = Math.max(5, Math.min(34, slot * 0.68));
  const ticks: number[] = []; for (let t = 0; t <= top + 1e-6; t += step) ticks.push(t);
  const every = slot >= 34 ? 1 : slot >= 17 ? 2 : 3, labelAll = slot >= 52;
  return (
    <div ref={box} className="w-full grid gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem] text-ink">{parts.map((p) => <span key={p.label} className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: p.color }} />{p.label}</span>)}</div>
      <svg role="img" aria-label={ariaLabel} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? V.base : V.grid} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={V.muted}>{kGbp(t)}</text></g>)}
        {rows.map((r, i) => {
          const cx = padL + slot * (i + 0.5); let acc = 0;
          return (
            <g key={r.label} onClick={onSelect ? () => onSelect(i) : undefined} onMouseEnter={onSelect ? () => onSelect(i) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
              <title>{`${r.label}: ${parts.map((p, j) => `${p.label} ${gbp(r.values[j])}`).join(", ")}; together ${gbp(sums[i])}`}</title>
              {selected === i && <rect x={cx - slot / 2 + 1} y={padT - 16} width={slot - 2} height={H - padT - padB + 18} rx={5} fill={V.wash} stroke={V.ink} strokeWidth={1} />}
              <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {r.values.map((v, j) => { const y0 = y(acc), y1 = y(acc + v); acc += v; return v > 0 ? <rect key={j} x={cx - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1)} fill={parts[j].color} /> : null; })}
              {(labelAll || selected === i || (selected == null && (i === 0 || i === rows.length - 1))) && <text x={cx} y={y(sums[i]) - 5} textAnchor="middle" fontSize="11.5" fontWeight={700} fill={V.ink}>{kGbp(sums[i])}</text>}
              {(i % every === 0) && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={V.muted}>{r.label.split(" ")[0]}{r.label.startsWith("Jan") ? ` ${r.label.split(" ")[1] ?? ""}` : ""}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// One month walked from takings down to what is left: each line a bar placed where the running
// total stands, money in green, money out slate, the subtotals in ink, with the reason beneath.
export function Waterfall({ rows, ariaLabel }: { rows: { label: string; value: number; kind: "in" | "out" | "total"; note?: string }[]; ariaLabel: string }) {
  const top = Math.max(1, ...rows.filter((r) => r.kind === "total").map((r) => r.value), rows.filter((r) => r.kind === "in").reduce((s, r) => s + r.value, 0));
  let run = 0;
  const placed = rows.map((r) => { let from = 0, to = 0; if (r.kind === "in") { from = run; to = run + r.value; run = to; } else if (r.kind === "out") { from = run - r.value; to = run; run = from; } else { from = Math.min(0, r.value); to = Math.max(0, r.value); run = r.value; } return { ...r, from, to }; });
  const lo = Math.min(0, ...placed.map((p) => p.from));
  const pct = (v: number) => `${(100 * (v - lo)) / (top - lo)}%`;
  const money = (n: number) => `${n < 0 ? "−" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
  return (
    <ol role="img" aria-label={ariaLabel} className="grid">
      {placed.map((r, i) => (
        <li key={i} className={`grid grid-cols-[minmax(0,11rem)_1fr_5.2rem] sm:grid-cols-[minmax(0,15rem)_1fr_6rem] items-center gap-x-3 py-2 ${r.kind === "total" ? "border-y border-line-strong bg-wash/70 -mx-2 px-2 rounded-md" : "border-b border-border"}`}>
          <span className="min-w-0"><span className={`block leading-snug ${r.kind === "total" ? "font-extrabold text-ink text-[0.98rem]" : "text-ink text-[0.92rem]"}`}>{r.label}</span>{r.note && <span className="block text-[0.76rem] text-ink-muted leading-snug">{r.note}</span>}</span>
          <span className="relative h-6"><span className="absolute inset-y-[11px] left-0 right-0" style={{ background: V.grid }} /><span className="absolute inset-y-0.5 rounded-[4px]" style={{ left: pct(r.from), width: `max(3px, calc(${pct(r.to)} - ${pct(r.from)}))`, background: r.kind === "in" ? V.good : r.kind === "out" ? V.slate : r.value < 0 ? V.act : V.ink }} /></span>
          <span className={`text-right tabular ${r.kind === "total" ? "font-extrabold text-[1rem]" : "font-semibold text-[0.92rem]"} ${r.kind === "total" && r.value < 0 ? "text-act" : "text-ink"}`}>{money(r.kind === "out" ? -r.value : r.value)}</span>
        </li>
      ))}
    </ol>
  );
}
