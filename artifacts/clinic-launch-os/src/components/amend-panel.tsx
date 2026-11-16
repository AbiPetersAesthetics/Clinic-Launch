// Amend the position (owner, 16 Nov 2026: fixed and variable costs "should be amendable to change the
// position"). Change any assumption and the forecast is re-run beside the plan, saving nothing. Only
// "Make this the plan" saves: the change is logged with its before and after and the plan baseline is
// rebased, so one deliberate press is the owner's yes and nothing moves by accident.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID } from "@/lib/alfred";
import { Section, gbp0 } from "@/components/page";
import { MultiLine, V } from "@/components/viz";

export interface Settings {
  rentAnnual: number; ratesMonthly: number; utilitiesMonthly: number; runningMonthly: number; marketingMonthly: number; useAdsPlan: boolean;
  bedhKept: number; extraPct: number; productScale: number; scenario: string; profile: { early: number; earlyUntil: string; start: number; growthPerMonth: number; cap: number } | null;
  listPrice: number; founderPrice: number; foundingPatients: number; foundingTakings: number;
  buildGeneral: number | null; scenarios: { key: string; label: string }[]; centralProfile: { early: number; earlyUntil: string; start: number; growthPerMonth: number; cap: number } | null;
}
type Draft = Partial<Pick<Settings, "rentAnnual" | "ratesMonthly" | "utilitiesMonthly" | "runningMonthly" | "marketingMonthly" | "useAdsPlan" | "bedhKept" | "extraPct" | "productScale" | "scenario" | "listPrice" | "founderPrice" | "foundingPatients" | "foundingTakings">> & { profile?: Settings["profile"] };

function toChanges(d: Draft) {
  const c: any = {};
  if (d.rentAnnual != null) c.rent = { annual: d.rentAnnual };
  if (d.ratesMonthly != null) c.rates = { monthly: d.ratesMonthly };
  if (d.utilitiesMonthly != null) c.utilities = { monthly: d.utilitiesMonthly };
  if (d.runningMonthly != null) c.running = { monthly: d.runningMonthly };
  if (d.marketingMonthly != null || d.useAdsPlan != null) c.marketing = { ...(d.marketingMonthly != null ? { monthly: d.marketingMonthly } : {}), ...(d.useAdsPlan != null ? { useAdsPlan: d.useAdsPlan } : {}) };
  if (d.bedhKept != null) c.bedh = { contributionPct: d.bedhKept };
  if (d.extraPct != null) c.variable = { extraPct: d.extraPct };
  if (d.productScale != null || d.scenario != null || d.profile !== undefined || d.listPrice != null || d.founderPrice != null || d.foundingPatients != null || d.foundingTakings != null) c.winc = { ...(d.foundingPatients != null ? { foundingPatients: d.foundingPatients } : {}), ...(d.foundingTakings != null ? { foundingTakings: d.foundingTakings } : {}), ...(d.listPrice != null ? { listPrice: d.listPrice } : {}), ...(d.founderPrice != null ? { founderPrice: d.founderPrice } : {}), ...(d.productScale != null ? { productScale: d.productScale } : {}), ...(d.scenario != null ? { scenario: d.scenario } : {}), ...(d.profile !== undefined ? { profile: d.profile } : {}) };
  return c;
}

function Num({ label, hint, value, was, onChange, step = 1, min = 0, max = 1e6, prefix = "£", suffix }: { label: string; hint?: ReactNode; value: number; was: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; prefix?: string; suffix?: string }) {
  const changed = Math.abs(value - was) > 1e-9;
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)));
  return (
    <label className={`grid gap-1 rounded-xl border p-3 ${changed ? "border-ink bg-wash" : "border-border bg-card"}`}>
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted leading-tight">{label}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" aria-label={`Lower ${label}`} onClick={() => set(value - step)} className="w-10 h-10 shrink-0 rounded-full border border-line-strong text-ink text-lg leading-none">−</button>
        <span className="flex-1 flex items-baseline justify-center gap-0.5 min-w-0">
          {prefix && <span className="text-ink-muted font-semibold">{prefix}</span>}
          <input inputMode="decimal" value={String(value)} onChange={(e) => { const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); if (Number.isFinite(n)) set(n); }} className="w-full min-w-0 bg-transparent text-center tabular text-[1.35rem] font-extrabold text-ink outline-none focus:underline" aria-label={label} />
          {suffix && <span className="text-ink-muted font-semibold text-[0.85rem] whitespace-nowrap">{suffix}</span>}
        </span>
        <button type="button" aria-label={`Raise ${label}`} onClick={() => set(value + step)} className="w-10 h-10 shrink-0 rounded-full border border-line-strong text-ink text-lg leading-none">+</button>
      </span>
      <span className="text-[0.76rem] text-ink-muted leading-snug min-h-[1.1rem]">{changed ? <b className="text-ink">was {prefix}{was.toLocaleString("en-GB")}{suffix ? ` ${suffix}` : ""}. </b> : null}{hint}</span>
    </label>
  );
}

const Row = ({ label, before, after, money = true, better }: { label: string; before: number | string | null; after: number | string | null; money?: boolean; better?: "up" | "down" }) => {
  const f = (v: number | string | null) => (v == null ? "not reached" : typeof v === "number" ? (money ? gbp0(v) : String(v)) : v);
  const diff = typeof before === "number" && typeof after === "number" ? after - before : null;
  const tone = diff == null || Math.abs(diff) < 1 || !better ? "text-ink-muted" : (diff > 0) === (better === "up") ? "text-good" : "text-act";
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-3 text-ink">{label}</td>
      <td className="py-2 pr-3 text-right tabular text-ink-2">{f(before)}</td>
      <td className="py-2 pr-3 text-right tabular font-bold text-ink">{f(after)}</td>
      <td className={`py-2 text-right tabular font-semibold ${tone}`}>{diff == null ? (before !== after ? "changed" : "") : Math.abs(diff) < 1 ? "no change" : `${diff > 0 ? "+" : "−"}${gbp0(Math.abs(diff)).replace("minus ", "")}`}</td>
    </tr>
  );
};

export function AmendPanel({ s, preset, log }: { s: Settings; preset?: { draft: Draft; label: string } | null; log?: any[] }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>({});
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const seq = useRef(0);
  useEffect(() => { if (preset) { setD((x) => ({ ...x, ...preset.draft })); setNote(preset.label); setConfirm(false); setMsg(null); } }, [preset]);
  const changes = useMemo(() => toChanges(d), [d]);
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => {
    if (!dirty) { setRes(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/projects/${PROJECT_ID}/cash-model/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
        const j = await r.json();
        if (mine === seq.current) setRes(r.ok ? j : null);
      } finally { if (mine === seq.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [changes, dirty]);
  const v = <K extends keyof Draft>(k: K, base: any) => (d[k] ?? base) as any;
  const put = (k: keyof Draft, base: any) => (n: any) => setD((x) => { const y: any = { ...x }; if (n === base || (typeof n === "number" && Math.abs(n - base) < 1e-9)) delete y[k]; else y[k] = n; return y; });
  const prof = d.profile !== undefined ? d.profile : s.profile;
  const setProf = (patch: Partial<NonNullable<Settings["profile"]>>) => setD((x) => ({ ...x, profile: { ...(prof ?? s.centralProfile ?? { early: 22, earlyUntil: "2027-02", start: 16, growthPerMonth: 0.25, cap: 24 }), ...patch } }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/projects/${PROJECT_ID}/cash-model/assumptions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes, note }) });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.error ?? "Could not save" }); return; }
      setMsg({ ok: true, text: `Saved. The plan now has its lowest bank at ${gbp0(j.after.lowest.bank)} in ${j.after.lowest.month}. Every Money screen follows.` });
      setD({}); setNote(""); setConfirm(false); setRes(null);
      await qc.invalidateQueries({ queryKey: ["alfred"] });
    } finally { setBusy(false); }
  };
  const B = res?.before, A = res?.after;
  return (
    <Section title="Amend the position" id="w-amend" note={dirty ? "a what-if: nothing is saved yet" : "change anything to see the forecast move"}>
      <p className="text-[0.92rem] text-ink-2 leading-relaxed max-w-[70ch]">Change any figure and the whole forecast is re-run beside the plan. Nothing is saved until you press <b className="text-ink">Make this the plan</b>; then it is logged with its before and after and every Money screen follows.</p>

      <h3 className="text-[0.95rem] font-extrabold text-ink pt-1">Overheads</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Num label="Rent, a year" value={v("rentAnnual", s.rentAnnual)} was={s.rentAnnual} onChange={put("rentAnnual", s.rentAnnual)} step={500} hint={`${gbp0(v("rentAnnual", s.rentAnnual) / 12)} a month`} />
        <Num label="Business rates, a month" value={v("ratesMonthly", s.ratesMonthly)} was={s.ratesMonthly} onChange={put("ratesMonthly", s.ratesMonthly)} step={50} hint="the estimate until the bill is in" />
        <Num label="Utilities, a month" value={v("utilitiesMonthly", s.utilitiesMonthly)} was={s.utilitiesMonthly} onChange={put("utilitiesMonthly", s.utilitiesMonthly)} step={5} />
        <Num label="General running, a month" value={v("runningMonthly", s.runningMonthly)} was={s.runningMonthly} onChange={put("runningMonthly", s.runningMonthly)} step={5}
          hint={s.buildGeneral != null && Math.round(s.buildGeneral) !== Math.round(v("runningMonthly", s.runningMonthly)) ? <button type="button" className="underline text-ink" onClick={(e) => { e.preventDefault(); put("runningMonthly", s.runningMonthly)(Math.round(s.buildGeneral!)); }}>use the build's {gbp0(s.buildGeneral)}</button> : "matches the build"} />
        <Num label="Advertising, a month" value={v("marketingMonthly", s.marketingMonthly)} was={s.marketingMonthly} onChange={put("marketingMonthly", s.marketingMonthly)} step={25}
          hint={<span>{v("useAdsPlan", s.useAdsPlan) ? "only used where the ads plan has no figure. " : "used every month. "}<button type="button" className="underline text-ink" onClick={(e) => { e.preventDefault(); put("useAdsPlan", s.useAdsPlan)(!v("useAdsPlan", s.useAdsPlan)); }}>{v("useAdsPlan", s.useAdsPlan) ? "ignore the ads plan" : "follow the ads plan"}</button></span>} />
      </div>

      <h3 className="text-[0.95rem] font-extrabold text-ink pt-2">Cost of sales</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Num label="Bedhampton gross margin" value={Math.round((10 * v("bedhKept", s.bedhKept)) / (5 / 6)) / 10} was={Math.round((10 * s.bedhKept) / (5 / 6)) / 10} onChange={(n) => { const g = (n * 5) / 6; put("bedhKept", s.bedhKept)(Math.abs(g - s.bedhKept) < 0.05 ? s.bedhKept : g); }} step={0.5} min={12} max={99} prefix="" suffix="% of sales" hint="before VAT, after product" />
        <Num label="Winchester product cost" value={Math.round(v("productScale", s.productScale) * 100)} was={Math.round(s.productScale * 100)} onChange={(n) => put("productScale", s.productScale)(n / 100)} step={5} min={30} max={300} prefix="" suffix="% of modelled" hint="100 is the model's own product cost" />
        <Num label="Other cost of sales" value={Math.round((100 * v("extraPct", s.extraPct)) / (5 / 6)) / 100} was={Math.round((100 * s.extraPct) / (5 / 6)) / 100} onChange={(n) => { const g = (n * 5) / 6; put("extraPct", s.extraPct)(Math.abs(g - s.extraPct) < 0.005 ? s.extraPct : g); }} step={0.25} min={0} max={36} prefix="" suffix="% of sales" hint="before VAT: card fees, consumables, wastage; both clinics" />
      </div>

      <h3 className="text-[0.95rem] font-extrabold text-ink pt-2">Growth</h3>
      <div className="flex flex-wrap gap-1.5">
        {s.scenarios.map((x) => { const on = !prof && v("scenario", s.scenario) === x.key; return <button key={x.key} type="button" aria-pressed={on} onClick={() => setD((y) => { const z: any = { ...y }; if (x.key === s.scenario) delete z.scenario; else z.scenario = x.key; if (s.profile) z.profile = null; else delete z.profile; return z; })} className={`min-h-[44px] px-4 rounded-full border text-[0.85rem] font-semibold ${on ? "bg-ink text-white border-ink" : "bg-card text-ink border-line-strong hover:bg-wash"}`}>{x.label}{x.key === s.scenario && !s.profile ? " (the plan)" : ""}</button>; })}
        <button type="button" aria-pressed={!!prof} onClick={() => (prof ? setD((y) => { const z: any = { ...y }; if (s.profile) z.profile = null; else delete z.profile; return z; }) : setProf({}))} className={`min-h-[44px] px-4 rounded-full border text-[0.85rem] font-semibold ${prof ? "bg-ink text-white border-ink" : "bg-card text-ink border-line-strong hover:bg-wash"}`}>Our own numbers{s.profile ? " (the plan)" : ""}</button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Num label="December's paying patients" value={v("foundingPatients", s.foundingPatients)} was={s.foundingPatients} onChange={put("foundingPatients", s.foundingPatients)} prefix="" hint="of the people booked for the opening; they drive the return visits that follow" />
        <Num label="December's takings from them" value={v("foundingTakings", s.foundingTakings)} was={s.foundingTakings} onChange={put("foundingTakings", s.foundingTakings)} step={100} hint="Winchester's own, before any Bedhampton patients who move" />
      </div>
      {prof && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="New patients a month, Jan and Feb" value={prof.early} was={(s.profile ?? s.centralProfile)?.early ?? prof.early} onChange={(n) => setProf({ early: n })} prefix="" hint="the launch months" />
          <Num label="New patients a month, from March" value={prof.start} was={(s.profile ?? s.centralProfile)?.start ?? prof.start} onChange={(n) => setProf({ start: n })} prefix="" />
          <Num label="Growing each month by" value={prof.growthPerMonth} was={(s.profile ?? s.centralProfile)?.growthPerMonth ?? prof.growthPerMonth} onChange={(n) => setProf({ growthPerMonth: n })} step={0.05} max={10} prefix="" hint="new patients a month, added monthly" />
          <Num label="Up to a ceiling of" value={prof.cap} was={(s.profile ?? s.centralProfile)?.cap ?? prof.cap} onChange={(n) => setProf({ cap: n })} prefix="" hint="new patients a month" />
        </div>
      )}

      <h3 className="text-[0.95rem] font-extrabold text-ink pt-2">Prices</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Num label="Winchester list against Bedhampton" value={v("listPrice", s.listPrice)} was={s.listPrice} onChange={put("listPrice", s.listPrice)} step={0.02} min={0.5} max={3} prefix="" suffix="times" hint="what the same treatments cost at Winchester's list" />
        <Num label="Introductory prices against Bedhampton" value={v("founderPrice", s.founderPrice)} was={s.founderPrice} onChange={put("founderPrice", s.founderPrice)} step={0.02} min={0.5} max={3} prefix="" suffix="times" hint="to January 2027" />
      </div>
      <p className="text-[0.78rem] text-ink-muted -mt-1">Price changes re-run the patient model, so they move the Recommended, Slow and Fast models and our own numbers, not the straight-line forecast.</p>

      {dirty && (
        <div className="grid gap-3 rounded-2xl border-2 border-ink bg-card p-4 sm:p-5 mt-1" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><b className="text-[1.05rem] text-ink">What it does to the forecast</b><span className="text-[0.8rem] text-ink-muted">{busy ? "working it out" : "the plan against your change"}</span></div>
          {B && A ? (
            <>
              <MultiLine labels={B.monthEnds.map((m: any) => m.label)} series={[{ label: "With the change", values: A.monthEnds.map((m: any) => m.bank), chosen: true }, { label: "The plan", values: B.monthEnds.map((m: any) => m.bank) }]} ariaLabel={`Bank at each month-end, the plan against the change. ${A.monthEnds.map((m: any, k: number) => `${m.label}: ${gbp0(B.monthEnds[k].bank)} then ${gbp0(m.bank)}`).join("; ")}`} />
              <div className="overflow-x-auto">
                <table className="w-full text-[0.9rem]">
                  <thead><tr className="text-right text-[0.68rem] uppercase tracking-[0.12em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-3 text-left">Measure</th><th className="py-2 pr-3">The plan</th><th className="py-2 pr-3">With the change</th><th className="py-2">Difference</th></tr></thead>
                  <tbody>
                    <Row label={`Lowest bank (${A.lowest.month})`} before={B.lowest.bank} after={A.lowest.bank} better="up" />
                    <Row label="Bank at the end of 2027" before={B.bankEnd2027} after={A.bankEnd2027} better="up" />
                    <Row label="Winchester takings, 2027" before={B.winchester.y2027} after={A.winchester.y2027} better="up" />
                    <Row label="Operating profit, 2027" before={B.profit.y2027} after={A.profit.y2027} better="up" />
                    <Row label="Operating profit, 2028" before={B.profit.y2028} after={A.profit.y2028} better="up" />
                    <Row label="Abi's pay, 2027" before={B.abiPay.y2027} after={A.abiPay.y2027} better="up" />
                    <Row label="Abi's pay, 2028" before={B.abiPay.y2028} after={A.abiPay.y2028} better="up" />
                    <Row label="Overheads a month (June 2027)" before={B.fixedMonthly} after={A.fixedMonthly} better="down" />
                    <Row label="Winchester pays its own bills from" before={B.paysBills} after={A.paysBills} money={false} />
                  </tbody>
                </table>
              </div>
              {A.lowest.bank < 10000 && <p className="text-act font-semibold text-[0.92rem]">With this change the bank falls under the £10,000 safety net in {A.lowest.month}.</p>}
            </>
          ) : <p className="text-ink-muted">Working it out.</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!confirm ? <button type="button" disabled={!B || busy} onClick={() => setConfirm(true)} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.85rem] font-semibold disabled:opacity-50">Make this the plan</button> : (
              <div className="grid gap-2 w-full">
                <label className="grid gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">Why (kept in the log)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="for example: the rates bill arrived" className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] font-normal normal-case tracking-normal text-ink" /></label>
                <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={save} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.85rem] font-semibold disabled:opacity-50">Yes, change the plan</button><button type="button" onClick={() => setConfirm(false)} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.85rem] font-semibold text-ink">Not yet</button></div>
              </div>
            )}
            {!confirm && <button type="button" onClick={() => { setD({}); setNote(""); setMsg(null); }} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.85rem] font-semibold text-ink">Put it back</button>}
          </div>
        </div>
      )}
      {msg && <p className={`text-[0.95rem] font-semibold ${msg.ok ? "text-good" : "text-act"}`}>{msg.text}</p>}
      {log && log.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[0.88rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">Changes made here ({log.length})</summary>
          <ul className="grid gap-1.5 text-[0.88rem] text-ink-2">{[...log].reverse().map((l, k) => <li key={k}><b className="text-ink">{new Date(l.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</b>: {l.note || "no reason given"} <span className="text-ink-muted">({JSON.stringify(l.changes).replace(/[{}"]/g, "").replace(/:/g, " ").replace(/,/g, ", ")})</span></li>)}</ul>
        </details>
      )}
      <span aria-hidden style={{ color: V.ink }} className="hidden" />
    </Section>
  );
}
