// The Money outlook (owner, 15 Nov 2026): better than expected, on track, or worse than expected,
// over the next four month-ends. Two lines, the plan and where we are heading, named on the chart,
// with the gap between them shaded; the forecast if the undated loan were drawn is a dashed line.
// Drawn at the container's real width with a money scale and every month named. Kept apart from the
// shared chart components, which are being redesigned separately.
import { useEffect, useRef, useState } from "react";

const INK = "#1F2A44", PLAN = "#8E99AB", GRID = "#DDE2EA", TEXT = "#3A4458", BAD = "#A33A3A";
const k = (v: number) => (Math.abs(v) >= 1000 ? `£${(v / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : `£${Math.round(v)}`);

export interface OutlookPoint { label: string; now: number; plan: number | null; withLoan: number | null }

export function OutlookChart({ points }: { points: OutlookPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setW(Math.max(280, Math.round(el.clientWidth)));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return null;
  const H = 240, padL = 48, padR = 92, padT = 18, padB = 30;
  const all = points.flatMap((p) => [p.now, p.plan, p.withLoan]).filter((v): v is number => v != null);
  const rawLo = Math.min(0, ...all), rawHi = Math.max(...all);
  const step = (() => { const raw = (rawHi - rawLo) / 4, mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))), n = raw / mag; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag; })();
  const lo = Math.floor(rawLo / step) * step, hi = Math.ceil(rawHi / step) * step;
  const ticks: number[] = []; for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const path = (vals: (number | null)[]) => vals.map((v, i) => (v == null ? "" : `${i && vals[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const nowVals = points.map((p) => p.now), planVals = points.map((p) => p.plan), loanVals = points.map((p) => p.withLoan);
  const hasPlan = planVals.every((v) => v != null);
  const gap = hasPlan ? `${path(nowVals)} ${[...points].reverse().map((p, j) => `L${x(points.length - 1 - j).toFixed(1)},${y(p.plan as number).toFixed(1)}`).join(" ")} Z` : "";
  const last = points.length - 1;
  const ends = [{ v: points[last].now, label: "heading", color: INK }, ...(hasPlan ? [{ v: points[last].plan as number, label: "the plan", color: TEXT }] : []), ...(loanVals[last] != null ? [{ v: loanVals[last] as number, label: "with the loan", color: TEXT }] : [])]
    .sort((a, b) => b.v - a.v);
  let prevY = -Infinity;
  const placed = ends.map((e) => { let yy = y(e.v); if (yy - prevY < 30) yy = prevY + 30; prevY = yy; return { ...e, yy }; });
  return (
    <div ref={box} className="w-full">
      <svg role="img" aria-label={`Bank at each month-end: where we are heading against the plan. ${points.map((p) => `${p.label}: ${k(p.now)}${p.plan != null ? ` against ${k(p.plan)}` : ""}`).join("; ")}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? BAD : GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill={TEXT}>{k(t)}</text>
          </g>
        ))}
        {hasPlan && <path d={gap} fill={INK} opacity={0.08} />}
        {hasPlan && <path d={path(planVals)} fill="none" stroke={PLAN} strokeWidth={2.5} strokeLinejoin="round" />}
        {loanVals.some((v) => v != null) && <path d={path(loanVals)} fill="none" stroke={TEXT} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={path(nowVals)} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.now)} r={4} fill={p.now < 0 ? BAD : INK} stroke="#fff" strokeWidth={2}><title>{`${p.label}: ${k(p.now)}${p.plan != null ? `, plan ${k(p.plan)}` : ""}`}</title></circle>)}
        {points.map((p, i) => <text key={`m${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill={TEXT}>{p.label}</text>)}
        {placed.map((e) => <text key={e.label} x={W - padR + 8} y={e.yy} fontSize="12" fill={e.color}><tspan x={W - padR + 8} fontWeight={700}>{k(e.v)}</tspan><tspan x={W - padR + 8} dy={14} fontWeight={e.color === INK ? 700 : 500}>{e.label}</tspan></text>)}
      </svg>
    </div>
  );
}
