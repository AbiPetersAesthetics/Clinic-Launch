import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PoundSterling, Users, Gift, ListChecks, AlertTriangle, RefreshCw, Lock, Clock } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";

// ── shared fetch helpers ─────────────────────────────────────────────────────
const jget = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); };

type MedianBand = { n: number; median: number | null; q1: number | null; q3: number | null; min: number | null; max: number | null; lowConfidence: boolean };
type PricingRow = {
  key: string; displayName: string; category: string; isPom: boolean; isNew: boolean;
  durationMinutes: number; priceWinchester: number | null; priceBedhampton: number | null;
  ourPrice: number | null; revenuePerHour: number | null; courseSize: number | null; coursePrice: number | null;
  bands: Record<string, MedianBand>; varianceFlag: "below" | "above" | null; varianceReason: string; varianceNeedsReason: boolean;
  stale: boolean; notOnOurMenu: boolean;
  competitors: { name: string; priceGbp: number | null; qualifier: string; medical: boolean; distanceKm: number | null; courseSize: number | null; coursePriceGbp: number | null }[];
};

const CAT_LABEL: Record<string, string> = { anti_wrinkle: "Anti-wrinkle (POM)", filler: "Dermal filler", regenerative: "Regenerative", skin: "Skin", consultation: "Consultation" };
const fmt = (v: number | null | undefined) => v == null ? "—" : v === 0 ? "Free" : `£${v}`;

// ── Positioning bar: min..max range with median tick and our price dot ───────
function PositionBar({ row, band }: { row: PricingRow; band: MedianBand | undefined }) {
  if (!band || band.n === 0 || band.min == null || band.max == null) return <span className="text-[10px] text-muted-foreground italic">no market data</span>;
  const lo = Math.min(band.min, row.ourPrice ?? band.min) * 0.9;
  const hi = Math.max(band.max, row.ourPrice ?? band.max) * 1.05;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  return (
    <div className="relative h-6 w-full min-w-[140px]">
      <div className="absolute top-2.5 h-1 rounded bg-muted-foreground/20" style={{ left: `${pct(band.min)}%`, width: `${Math.max(2, pct(band.max) - pct(band.min))}%` }} />
      {band.median != null && <div className="absolute top-1 h-4 w-0.5 bg-foreground/60" style={{ left: `${pct(band.median)}%` }} title={`Median £${band.median} (n=${band.n})`} />}
      {row.ourPrice != null && row.ourPrice > 0 && (
        <div className="absolute top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-background shadow" style={{ left: `calc(${pct(row.ourPrice)}% - 6px)` }} title={`Our price £${row.ourPrice}`} />
      )}
    </div>
  );
}

// ── Tab 1: Pricing ───────────────────────────────────────────────────────────
function PricingTab() {
  const [catchment, setCatchment] = useState<"winchester" | "bedhampton">("winchester");
  const { data, isLoading } = useQuery({
    queryKey: [`market-pricing-${catchment}`],
    queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/pricing?catchment=${catchment}`),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  if (isLoading || !data) return <p className="text-sm text-muted-foreground animate-pulse p-6">Computing medians…</p>;
  const widest = data.bands[data.bands.length - 1];
  const rows: PricingRow[] = data.rows;
  const cats = [...new Set(rows.map(r => r.category))];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-muted/60 border">
          {(["winchester", "bedhampton"] as const).map(c => (
            <button key={c} onClick={() => setCatchment(c)} className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize transition-colors ${catchment === c ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Medians from medically led clinics only, bands {data.bands.join(" / ")}. Captured {catchment === "winchester" ? data.capturedDates.winchester : data.capturedDates.bedhampton}. n shown per figure; n under 4 is low confidence.</p>
      </div>

      {/* Credential segmentation */}
      <div className="grid grid-cols-3 gap-3">
        {data.segmentation.map((s: any) => (
          <div key={s.group} className="rounded-xl border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold capitalize">{s.group}-led ({s.clinics})</p>
            <p className="text-lg font-bold tabular-nums">{s.avgVsMarketPct == null ? "—" : `${s.avgVsMarketPct > 0 ? "+" : ""}${s.avgVsMarketPct}%`}</p>
            <p className="text-[10px] text-muted-foreground">vs market median, {s.sampledTreatments} treatments</p>
          </div>
        ))}
      </div>

      {cats.map(cat => (
        <div key={cat} className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 text-[12px] font-bold">{CAT_LABEL[cat] ?? cat}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-2 px-4">Treatment</th>
                <th className="text-right py-2 px-2 text-blue-600">Winchester</th>
                <th className="text-right py-2 px-2 text-orange-600">Bedhampton</th>
                <th className="text-left py-2 px-3 w-52">Market position ({widest})</th>
                <th className="text-right py-2 px-2">Median (n)</th>
                <th className="text-right py-2 px-2">£/hr</th>
                <th className="text-right py-2 px-4">Flags</th>
              </tr></thead>
              <tbody className="divide-y divide-border/60">
                {rows.filter(r => r.category === cat).map(r => {
                  const band = r.bands[widest];
                  const open = expanded === r.key;
                  return (
                    <>
                      <tr key={r.key} className={`hover:bg-muted/30 cursor-pointer ${r.notOnOurMenu ? "border-l-2 border-l-red-400" : ""}`} onClick={() => setExpanded(open ? null : r.key)}>
                        <td className="py-2 px-4">
                          <span className="font-medium">{r.displayName}</span>
                          {r.isNew && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 rounded px-1">NEW</span>}
                          {r.isPom && <span className="ml-1.5 text-[9px] font-bold text-rose-600 bg-rose-500/10 rounded px-1" title="Prescription-only medicine. Never in public offers.">POM</span>}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-400">{fmt(r.priceWinchester)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-orange-700 dark:text-orange-400">{fmt(r.priceBedhampton)}</td>
                        <td className="py-1 px-3"><PositionBar row={r} band={band} /></td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {band?.median != null ? <span className={band.lowConfidence ? "text-amber-600 italic" : ""}>£{band.median} <span className="text-[10px] text-muted-foreground">(n={band.n})</span></span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.revenuePerHour ? `£${r.revenuePerHour}` : "—"}</td>
                        <td className="py-2 px-4 text-right">
                          {r.varianceFlag === "below" && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5" title={r.varianceReason || "More than 15 percent below the catchment median. Margin left on the table. Reason needed."}>{r.varianceNeedsReason ? "▼15% reason?" : "▼15% ok"}</span>}
                          {r.varianceFlag === "above" && <span className="text-[9px] font-bold text-rose-600 bg-rose-500/10 rounded px-1.5 py-0.5" title={r.varianceReason || "More than 15 percent above the catchment median. Conversion risk. Reason needed."}>{r.varianceNeedsReason ? "▲15% reason?" : "▲15% ok"}</span>}
                          {r.stale && <span className="ml-1 text-[9px] text-muted-foreground" title="Some competitor prices captured more than 90 days ago. Refresh.">stale</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr key={r.key + "-detail"}><td colSpan={7} className="px-4 py-3 bg-muted/20">
                          <div className="grid md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="font-semibold mb-1">Competitor prices in this catchment</p>
                              {r.competitors.length === 0 && <p className="text-muted-foreground italic">None captured</p>}
                              {r.competitors.map((c, i) => (
                                <p key={i} className="flex justify-between gap-2 py-0.5">
                                  <span className={c.medical ? "" : "text-muted-foreground"}>{c.name}{!c.medical && " (non-medical, excluded from medians)"}{c.distanceKm != null && <span className="text-muted-foreground"> · {c.distanceKm}km</span>}</span>
                                  <span className="tabular-nums font-medium">{c.qualifier === "poa" ? "POA" : `${c.qualifier === "from" ? "from " : ""}£${c.priceGbp}`}{c.courseSize ? ` (${c.courseSize} for £${c.coursePriceGbp})` : ""}</span>
                                </p>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              {r.courseSize && <p><span className="font-semibold">Our course:</span> {r.courseSize} for {fmt(r.coursePrice)}</p>}
                              {r.varianceReason && <p><span className="font-semibold">Variance reason:</span> <span className="text-muted-foreground">{r.varianceReason}</span></p>}
                              {band && band.n > 0 && <p><span className="font-semibold">Range:</span> £{band.min} to £{band.max}, IQR £{band.q1} to £{band.q3}</p>}
                              <p className="text-muted-foreground">Slot {r.durationMinutes} min · revenue per clinical hour {r.revenuePerHour ? `£${r.revenuePerHour}` : "n/a"}</p>
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab 2: Memberships ───────────────────────────────────────────────────────
function MembershipsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["market-memberships"], queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/memberships`) });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground animate-pulse p-6">Loading membership landscape…</p>;
  const MODEL_CLR: Record<string, string> = { discount_only: "bg-slate-400", treatment_included: "bg-emerald-500", credit_wallet: "bg-violet-500", hybrid: "bg-blue-500" };
  const priced = data.ladder.filter((p: any) => p.priceMonthlyGbp != null);
  const maxPrice = Math.max(...priced.map((p: any) => Math.max(p.priceMonthlyGbp ?? 0, p.priceHighGbp ?? 0)), 199) * 1.1;
  return (
    <div className="space-y-5">
      {/* Price ladder */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-bold mb-1">The membership price ladder</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Every programme on one monthly-price axis. Colour is the model. Gaps recomputed from the data, never hardcoded.</p>
        <div className="relative h-8 rounded bg-muted/40 mb-2">
          {data.gaps.map((g: any, i: number) => (
            <div key={i} className="absolute top-0 h-full bg-emerald-500/15 border-x border-emerald-500/40" style={{ left: `${(g.from / maxPrice) * 100}%`, width: `${((g.to - g.from) / maxPrice) * 100}%` }} title={`Open band £${g.from} to £${g.to}`}>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-700 dark:text-emerald-400">£{Math.round(g.from)} to £{Math.round(g.to)} open</span>
            </div>
          ))}
          {priced.map((p: any) => (
            <div key={p.id} className={`absolute top-1.5 w-2.5 h-5 rounded-sm ${MODEL_CLR[p.model] ?? "bg-slate-400"} ${p.includesPom ? "ring-2 ring-rose-500" : ""}`} style={{ left: `${((p.priceMonthlyGbp ?? 0) / maxPrice) * 100}%` }} title={`${p.clinic}: ${p.programmeName} £${p.priceMonthlyGbp}${p.includesPom ? " (includes POM)" : ""}`} />
          ))}
          {data.ourTiers.filter((t: any) => t.isPublic && t.priceMonthlyGbp).map((t: any) => (
            <div key={t.id} className="absolute -top-1 w-3 h-10 rounded-sm bg-blue-600 border-2 border-background shadow z-10" style={{ left: `${(t.priceMonthlyGbp / maxPrice) * 100}%` }} title={`APA ${t.name} (${t.site}) £${t.priceMonthlyGbp}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-600 mr-1" />Us</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />Treatment included</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-violet-500 mr-1" />Credit wallet</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />Discount only</span>
          <span><span className="inline-block w-2 h-2 rounded-sm ring-2 ring-rose-500 mr-1" />Red ring = includes a POM</span>
        </div>
      </div>

      {/* Compliance scoreboard + commitment */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-rose-600" /><h3 className="text-sm font-bold">POM compliance scoreboard</h3></div>
          <p className="text-xs text-foreground/80 mb-2"><strong>{data.pomProgrammes.count}</strong> of {data.ladder.length} benchmarked programmes publicly include or discount a prescription-only medicine. That is a CAP Code and MHRA breach, a sector risk, and our differentiator: zero POMs in any APA public tier.</p>
          <p className="text-[11px] text-muted-foreground">In breach: {data.pomProgrammes.list.join("; ")}</p>
          <p className="text-[11px] text-muted-foreground mt-1.5">Deliberately clean: {data.cleanProgrammes.slice(0, 6).join("; ")}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-primary" /><h3 className="text-sm font-bold">Minimum commitment, months</h3></div>
          <div className="space-y-1">
            {data.commitment.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`w-52 truncate ${c.us ? "font-bold text-blue-700 dark:text-blue-400" : "text-muted-foreground"}`}>{c.name}</span>
                <div className="flex-1 h-2 rounded bg-muted"><div className={`h-full rounded ${c.us ? "bg-blue-600" : "bg-muted-foreground/40"}`} style={{ width: `${Math.max(3, (c.months / 12) * 100)}%` }} /></div>
                <span className="tabular-nums w-8 text-right">{c.months}m</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Shortest medical-membership commitment in either county is the core differentiator.</p>
        </div>
      </div>

      {/* Our tiers */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {data.ourTiers.map((t: any) => (
          <div key={t.id} className={`rounded-2xl border p-4 ${t.isPublic ? "bg-card" : "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20"}`}>
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold leading-tight">{t.name}</h4>
              {!t.isPublic && <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-400 shrink-0"><Lock className="w-3 h-3" />PRIVATE</span>}
            </div>
            <p className="text-[10px] text-muted-foreground capitalize">{t.site} · from {t.liveFromDate}</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{t.priceMonthlyGbp ? `£${t.priceMonthlyGbp}` : "Variable"}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            {t.founderPriceGbp && <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Founder £{t.founderPriceGbp}, {t.founderPlaces} places, held for life</p>}
            <p className="text-[11px] text-muted-foreground mt-1">Face value {Object.entries(t.faceValueGbp).map(([s, v]) => `£${v} ${s.slice(0, 1).toUpperCase()}`).join(" · ")} <span className="text-[9px]">(computed)</span></p>
            {t.revenuePerHour && <p className="text-[11px] text-muted-foreground">£{t.revenuePerHour}/clinical hr</p>}
            <ul className="mt-2 space-y-0.5">
              {t.inclusions.map((inc: any, i: number) => <li key={i} className="text-[11px] text-foreground/80">· {inc.label ?? inc.treatmentKey}</li>)}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2">{t.minCommitmentMonths > 0 ? `${t.minCommitmentMonths} month minimum` : "No minimum"} · {t.noticePeriodDays > 0 ? `${t.noticePeriodDays} days notice` : "cancel any time"}</p>
          </div>
        ))}
      </div>

      {/* Feature matrix */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30 text-[12px] font-bold">Feature matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-2 px-3">Feature</th>
              {data.matrix.us.map((u: any) => <th key={u.name} className="text-center py-2 px-2 text-blue-700 dark:text-blue-400 font-bold whitespace-nowrap">{u.name.replace("APA: ", "")}</th>)}
              {data.matrix.competitors.map((c: any) => <th key={c.name} className="text-center py-2 px-2 font-medium whitespace-nowrap max-w-[8rem] truncate" title={c.name}>{c.name.split(":")[0]}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border/50">
              {data.matrix.features.map((f: string) => (
                <tr key={f}>
                  <td className="py-1.5 px-3 font-medium capitalize">{f.replace(/([A-Z])/g, " $1").toLowerCase()}</td>
                  {data.matrix.us.map((u: any) => <td key={u.name} className="text-center">{u.values[f] ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-muted-foreground/40">·</span>}</td>)}
                  {data.matrix.competitors.map((c: any) => <td key={c.name} className="text-center">{c.values[f] === true ? <span className="text-foreground/70">✓</span> : c.values[f] === false ? <span className="text-muted-foreground/40">·</span> : <span className="text-muted-foreground/30" title="unknown">?</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Our packages ──────────────────────────────────────────────────────
function PackagesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["market-packages"], queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/packages`) });
  const { data: config } = useQuery({ queryKey: ["market-config"], queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/config`) });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground animate-pulse p-6">Loading price list…</p>;
  const cats = [...new Set(data.rows.map((r: any) => r.category))] as string[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{data.vatNote}</p>
        <a className="text-xs font-semibold text-primary hover:underline" href={`${API}/projects/${PROJECT_ID}/market/packages/export?audience=public`} target="_blank" rel="noreferrer">Public export (website / ANS) →</a>
      </div>
      {cats.map(cat => (
        <div key={cat} className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 text-[12px] font-bold">{CAT_LABEL[cat] ?? cat}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-2 px-4">Treatment</th>
                <th className="text-right py-2 px-2">Slot</th>
                <th className="text-right py-2 px-2 text-blue-600">Winchester</th>
                <th className="text-right py-2 px-2 text-orange-600">Bedhampton</th>
                <th className="text-right py-2 px-2">Course</th>
                <th className="text-right py-2 px-2">£/clinical hr (W)</th>
                <th className="text-right py-2 px-4">VAT element (W)</th>
              </tr></thead>
              <tbody className="divide-y divide-border/60">
                {data.rows.filter((r: any) => r.category === cat).map((r: any) => (
                  <tr key={r.key} className="hover:bg-muted/30">
                    <td className="py-2 px-4"><span className="font-medium">{r.displayName}</span>
                      {r.isNew && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 rounded px-1">NEW</span>}
                      {r.isPom && <span className="ml-1.5 text-[9px] font-bold text-rose-600 bg-rose-500/10 rounded px-1">POM</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.durationMinutes}m</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmt(r.priceWinchester)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmt(r.priceBedhampton)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.courseSize ? `${r.courseSize} for £${r.coursePriceWinchester}/£${r.coursePriceBedhampton}` : "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{r.revenuePerHourWinchester ? `£${r.revenuePerHourWinchester}` : "—"}</td>
                    <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{r.vatElementWinchester != null ? `£${r.vatElementWinchester}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {config && (
        <div className="rounded-2xl border border-emerald-300/50 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15 p-4">
          <h3 className="text-sm font-bold mb-1">Founders offer, Winchester</h3>
          <p className="text-[11px] text-muted-foreground mb-2">{config.foundersOffer.closes}</p>
          <ul className="space-y-0.5">{config.foundersOffer.items.map((i: string, k: number) => <li key={k} className="text-xs">· {i}</li>)}</ul>
          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 mt-2">{config.foundersOffer.rules}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Referrals ─────────────────────────────────────────────────────────
function ReferralsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["market-referrals"], queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/referrals/report`) });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground animate-pulse p-6">Loading referral report…</p>;
  const stages = ["sent", "registered", "booked", "attended", "credited"];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-bold mb-1">The scheme</h3>
        <p className="text-lg font-bold">£{data.scheme.creditReferrerGbp} to the referrer, £{data.scheme.creditRefereeGbp} to the referee</p>
        <ul className="mt-2 space-y-0.5">{data.scheme.rules.map((r: string, i: number) => <li key={i} className="text-xs text-muted-foreground">· {r}</li>)}</ul>
        <p className="text-[11px] text-muted-foreground mt-2">{data.scheme.benchmarks}</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {stages.map((s, i) => (
          <div key={s} className="rounded-xl border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{i + 1}. {s}</p>
            <p className="text-2xl font-bold tabular-nums">{data.funnel[s] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost per acquisition</p><p className="text-xl font-bold">{data.costPerAcquisitionGbp ? `£${data.costPerAcquisitionGbp}` : "—"}</p><p className="text-[10px] text-muted-foreground">£50 credit per attended referral, vs Meta CPL</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg days to attendance</p><p className="text-xl font-bold">{data.avgDaysToAttendance ?? "—"}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">From engaged_reply contacts</p><p className="text-xl font-bold">{data.engagedReplyReferrals}</p><p className="text-[10px] text-muted-foreground">our strongest conversion predictor</p></div>
      </div>
      <p className="text-[11px] text-muted-foreground">{data.note}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const [tab, setTab] = useState<"pricing" | "memberships" | "packages" | "referrals">("pricing");
  const [reseeding, setReseeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const { data: insights } = useQuery({ queryKey: ["market-insights"], queryFn: () => jget(`${API}/projects/${PROJECT_ID}/market/insights`) });

  const reseed = async () => {
    if (!confirm("Reload the market dataset from the verified 31 August capture? Overwrites treatments, competitor prices and membership data.")) return;
    setReseeding(true);
    try { const r = await fetch(`${API}/projects/${PROJECT_ID}/market/reseed`, { method: "POST" }); const j = await r.json(); setSeedMsg(r.ok ? `Seeded: ${j.treatments} treatments, ${j.prices} prices, ${j.competitorMemberships} programmes` : j.error); }
    catch { setSeedMsg("Reseed failed"); }
    finally { setReseeding(false); window.location.reload(); }
  };

  const TABS = [
    { k: "pricing" as const, label: "Pricing vs market", icon: PoundSterling },
    { k: "memberships" as const, label: "Memberships", icon: Users },
    { k: "packages" as const, label: "Our packages", icon: ListChecks },
    { k: "referrals" as const, label: "Referrals", icon: Gift },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Market and pricing</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Competitor, pricing, membership and referral intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Two catchments, computed medians with sample sizes, the membership landscape, our packages and the referral engine. All prices VAT inclusive.</p>
        </div>
        <button onClick={reseed} disabled={reseeding} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground border rounded-lg px-2.5 py-1.5 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${reseeding ? "animate-spin" : ""}`} />Reload verified data</button>
      </div>
      {seedMsg && <p className="text-xs text-muted-foreground">{seedMsg}</p>}

      {/* Insight strip (Part 7 surfacing) */}
      {insights && (insights.leakage?.length > 0 || insights.weLack?.length > 0) && (
        <div className="rounded-2xl border border-amber-300/60 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/15 p-4 text-xs space-y-1">
          {insights.leakage?.length > 0 && <p><span className="font-bold">Site leakage risk:</span> {insights.leakage.slice(0, 4).map((l: any) => `${l.displayName} (${l.gapPct}% cheaper in Bedhampton)`).join("; ")}.</p>}
          {insights.weLack?.length > 0 && <p><span className="font-bold">Offered by 3+ local medical clinics, not on our menu:</span> {insights.weLack.map((w: any) => w.treatmentKey).join(", ")}.</p>}
          {insights.uniqueToUs?.length > 0 && <p><span className="font-bold">Only we price locally (under-marketed):</span> {insights.uniqueToUs.map((u: any) => u.displayName).join(", ")}.</p>}
        </div>
      )}

      <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-muted/60 border">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${tab === t.k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "pricing" && <PricingTab />}
      {tab === "memberships" && <MembershipsTab />}
      {tab === "packages" && <PackagesTab />}
      {tab === "referrals" && <ReferralsTab />}
    </div>
  );
}
