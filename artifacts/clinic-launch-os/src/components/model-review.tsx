// The team's challenge to the operating model (owner, 16 Nov 2026: "a proper team of agents...
// challenge everything, justify it all"). Six parallel audits (growth, fixed costs, variable costs,
// lease and location, the whole business, the engine itself) saved as one snapshot. This draws it:
// each verdict, the position the evidence supports, every assumption with what it is now, what the
// evidence says it should be, how sure that is, the strongest argument against it and what would
// settle it. Nothing here changes the plan; "Load into the what-if" only fills the amend panel.
import type { ReactNode } from "react";
import { Section, gbp0 } from "@/components/page";
import { MultiLine, HBars, Pill, V } from "@/components/viz";

const show = (v: any): string => {
  if (v == null) return "not in the model";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-GB") : String(Math.round(v * 100) / 100);
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.map(show).join(", ");
  return Object.entries(v).map(([k, x]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${show(x)}`).join("; ");
};
const tone = (c?: string) => (c === "high" ? "good" : c === "medium" ? "ink" : "watch") as "good" | "ink" | "watch";
const sure = (c?: string) => (c === "high" ? "well evidenced" : c === "medium" ? "partly evidenced" : "thin evidence");
const monthLabel = (ym: string) => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

function Item({ name, current, recommended, unit, confidence, challenge, evidence, decideBy, extra }: { name: string; current: any; recommended: any; unit?: string; confidence?: string; challenge?: string; evidence?: string[]; decideBy?: any; extra?: ReactNode }) {
  const same = show(current) === show(recommended);
  return (
    <li className="py-3 border-b border-border grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><b className="text-ink text-[0.98rem]">{name}</b><Pill tone={tone(confidence)}>{sure(confidence)}</Pill></div>
      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2 text-[0.9rem]">
        <p className="text-ink-2"><span className="block text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">In the model now</span>{show(current)}{unit && typeof current === "number" ? ` ${unit}` : ""}</p>
        <p className={same ? "text-ink-2" : "text-ink font-semibold"}><span className="block text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">{same ? "The evidence agrees" : "The evidence says"}</span>{show(recommended)}{unit && typeof recommended === "number" ? ` ${unit}` : ""}</p>
      </div>
      {challenge && <p className="text-[0.88rem] text-ink-2 leading-relaxed"><span className="font-semibold text-ink">Against it: </span>{challenge}</p>}
      {extra}
      {(evidence?.length || decideBy) ? (
        <details>
          <summary className="cursor-pointer text-[0.8rem] text-ink-muted underline underline-offset-2 min-h-[32px] inline-flex items-center">Evidence{decideBy ? " and what settles it" : ""}</summary>
          <ul className="grid gap-1 text-[0.82rem] text-ink-2 leading-relaxed list-disc pl-5 pt-1">{(evidence ?? []).map((e, i) => <li key={i}>{e}</li>)}{decideBy ? <li><b className="text-ink">Settled by: </b>{show(decideBy)}</li> : null}</ul>
        </details>
      ) : null}
    </li>
  );
}

function Area({ title, verdict, children, count }: { title: string; verdict?: string; children?: ReactNode; count?: number }) {
  return (
    <details className="rounded-xl border border-border bg-card group">
      <summary className="cursor-pointer list-none p-4 grid gap-1.5">
        <span className="flex items-baseline justify-between gap-3"><b className="text-[1.02rem] text-ink">{title}</b><span className="text-[0.78rem] text-ink-muted whitespace-nowrap">{count != null ? `${count} checked · ` : ""}<span className="underline">open</span></span></span>
        {verdict && <span className="text-[0.92rem] text-ink-2 leading-relaxed max-w-[75ch]">{verdict}</span>}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function ModelReview({ review, planWinchester, onLoad }: { review: any; planWinchester?: { months: string[]; values: number[] }; onLoad?: (p: { draft: any; label: string }) => void }) {
  if (!review) return null;
  const { growth: G, fixed: F, variable: Va, lease: L, business: B, engine: E, position: P } = review;
  const when = review.pushedIso ?? review.asOf;
  const gaps: string[] = [...(G?.gaps ?? []), ...(F?.gaps ?? []), ...(Va?.gaps ?? []), ...(L?.gaps ?? []), ...(B?.gaps ?? [])];
  const changed = (F?.lines ?? []).filter((l: any) => l.current == null || Math.abs((l.recommended ?? 0) - (l.current ?? 0)) >= 1);
  const kept = Va?.kept ? [["Bedhampton", Va.kept.bedhampton], ["Winchester, introductory prices", Va.kept.winchesterIntro], ["Winchester, list prices", Va.kept.winchesterList]] as [string, any][] : [];
  return (
    <Section title="Challenged by the team" id="w-review" note={when ? `reviewed ${new Date(when).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : undefined}>
      <p className="text-[0.92rem] text-ink-2 leading-relaxed max-w-[72ch]">{[G, F, Va, L, B, E].filter(Boolean).length} separate audits went through the model against the bank lines, the database, the lease record and published rates. Each was told to argue against the current figure. Nothing below changes the plan until you choose to.</p>

      {P && (
        <div className="grid gap-3 rounded-2xl border-2 border-ink p-4 sm:p-5">
          <b className="text-[1.1rem] text-ink">The position the evidence supports</b>
          <ul className="grid gap-2.5">
            {P.reasons.map((r: any, i: number) => (
              <li key={i} className="grid gap-0.5"><span className="flex flex-wrap items-baseline gap-2"><b className="text-ink text-[0.98rem]">{r.what}</b><Pill tone={tone(r.confidence)}>{sure(r.confidence)}</Pill></span><span className="text-[0.88rem] text-ink-2 leading-relaxed max-w-[72ch]">{r.why}</span></li>
            ))}
          </ul>
          {onLoad && <div><button type="button" onClick={() => { onLoad({ draft: P.draft, label: P.label }); document.getElementById("w-amend")?.scrollIntoView({ behavior: "smooth" }); }} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.85rem] font-semibold">Load this into the what-if</button></div>}
          {P.notInTheModelYet?.length > 0 && <div className="grid gap-1 border-t border-border pt-3"><b className="text-ink text-[0.92rem]">Found, but the model cannot carry it yet</b><ul className="grid gap-1 text-[0.88rem] text-ink-2 leading-relaxed list-disc pl-5">{P.notInTheModelYet.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      )}

      {G?.forecast && (
        <div className="grid gap-2">
          <b className="text-ink text-[1rem]">Winchester's own patients: the team's low, central and high against the plan</b>
          <MultiLine labels={G.forecast.months.map(monthLabel)} series={[
            ...(planWinchester ? [{ label: "The plan", values: G.forecast.months.map((m: string) => planWinchester.values[planWinchester.months.indexOf(m)] ?? 0), chosen: true }] : []),
            { label: "Team, high", values: G.forecast.high }, { label: "Team, central", values: G.forecast.central }, { label: "Team, low", values: G.forecast.low },
          ]} ariaLabel={`Winchester takings from its own patients: the team's cases. ${G.forecast.months.map((m: string, i: number) => `${monthLabel(m)}: low ${gbp0(G.forecast.low[i])}, central ${gbp0(G.forecast.central[i])}, high ${gbp0(G.forecast.high[i])}`).join("; ")}`} />
          <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[72ch]">The plan's line includes the Bedhampton patients it assumes will move to Winchester; the team's lines are Winchester's own patients only, which is most of the gap in the early months.</p>
        </div>
      )}

      {kept.length > 0 && (
        <div className="grid gap-2">
          <b className="text-ink text-[1rem]">Gross margin, % of sales before VAT: the model against the evidence</b>
          <ul className="grid gap-3">
            {kept.map(([name, k0]) => { const c = (n: number) => Math.round((n * 10) / (5 / 6)) / 10; const k = { model: c(k0.model), recommended: c(k0.recommended), low: c(k0.low), high: Math.min(100, c(k0.high)) }; return (
              <li key={name} className="grid gap-1" role="img" aria-label={`${name}: the model has a gross margin of ${k.model}%, the evidence supports ${k.recommended}%, range ${k.low} to ${k.high}%`}>
                <span className="flex items-baseline justify-between gap-3 text-[0.92rem]"><span className="text-ink">{name}</span><span className="tabular"><b className="text-ink">{k.recommended}%</b> <span className="text-ink-muted">against the model's {k.model}%</span></span></span>
                <span className="relative block h-5">
                  <span className="absolute inset-y-[8px] left-0 right-0 rounded-full" style={{ background: V.track }} />
                  <span className="absolute inset-y-[5px] rounded-full" style={{ left: `${k.low}%`, width: `${k.high - k.low}%`, background: V.sage }} />
                  <span className="absolute top-1/2 w-[14px] h-[14px] rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white" style={{ left: `${k.recommended}%`, background: V.ink }} />
                  <span className="absolute inset-y-0 w-[2.5px] -translate-x-1/2" style={{ left: `${k.model}%`, background: V.act }} />
                </span>
              </li>
            ); })}
          </ul>
          <p className="text-[0.8rem] text-ink-muted">The shaded band is the plausible range, the dot the figure to plan on, the red mark where the model sits now. The scale runs from 0% to 100%.</p>
        </div>
      )}

      {F?.rates && (
        <div className="grid gap-2">
          <b className="text-ink text-[1rem]">Business rates, a year</b>
          <HBars ariaLabel="Business rates a year: the model against the published rates" labelWidth="13rem" rows={[
            { label: "In the model now", note: "an older rate in the pound", value: 1333 * 12, display: gbp0(1333 * 12), color: V.act },
            { label: "2026/27 with no relief", note: `rateable value ${gbp0(F.rates.rateableValue)}`, value: F.rates.annualBeforeRelief, display: gbp0(F.rates.annualBeforeRelief), color: V.ink },
            ...(F.rates.reliefs ?? []).filter((x: any) => x.likely).map((x: any) => ({ label: "If the relief is granted", note: String(x.name).slice(0, 60), value: x.annualAfter, display: gbp0(x.annualAfter), color: V.good })),
          ]} />
          {F.rates.notes && <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[72ch]">{F.rates.notes}</p>}
        </div>
      )}

      <div className="grid gap-2.5">
        {G && <Area title="Growth" verdict={G.verdict} count={G.assumptions?.length}><ul>{(G.assumptions ?? []).map((a: any) => <Item key={a.id} {...a} />)}</ul>{G.earliestTests && <p className="text-[0.88rem] text-ink-2 pt-3"><b className="text-ink">The first real tests: </b>{show(G.earliestTests)}</p>}</Area>}
        {F && <Area title="Fixed costs" verdict={F.verdict} count={F.lines?.length}>
          <p className="text-[0.88rem] text-ink-2 pb-1">{changed.length} lines differ from the model or are missing from it; the rest were checked and stand. Totals: {gbp0(F.totals?.currentMonthly)} a month in the model, {gbp0(F.totals?.recommendedMonthly)} on the evidence.</p>
          <ul>{changed.map((l: any) => <Item key={l.id} name={`${l.name}${l.current == null ? " (missing)" : ""}`} current={l.current} recommended={l.recommended} unit="a month" confidence={l.confidence} challenge={l.challenge} evidence={l.evidence} decideBy={l.decideBy} extra={<p className="text-[0.8rem] text-ink-muted">Based on: {l.basis}{l.shared ? "; shared with Bedhampton" : ""}</p>} />)}</ul>
        </Area>}
        {Va && <Area title="Variable costs and margin" verdict={Va.verdict} count={Va.assumptions?.length}><ul>{(Va.assumptions ?? []).map((a: any) => <Item key={a.id} {...a} extra={a.sensitivity ? <p className="text-[0.82rem] text-ink-muted">What it is worth: {a.sensitivity}</p> : undefined} />)}</ul></Area>}
        {L && <Area title="Lease, location and positioning" verdict={L.verdict} count={(L.lease?.length ?? 0) + (L.assumptions?.length ?? 0)}>
          {L.committed && <p className="text-[0.92rem] text-ink pb-2"><b>Committed: </b>{gbp0(Number(L.committed.toBreak))} to the break, {gbp0(Number(L.committed.toEnd))} to the end. <span className="text-ink-2">{L.committed.notes}</span></p>}
          <div className="overflow-x-auto"><table className="w-full text-[0.86rem]"><thead><tr className="text-left text-[0.66rem] uppercase tracking-[0.12em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-3">Lease term</th><th className="py-2 pr-3">What the record says</th><th className="py-2">In the forecast</th></tr></thead>
            <tbody className="align-top">{(L.lease ?? []).map((t: any, i: number) => <tr key={i} className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">{t.term}</td><td className="py-2 pr-3 text-ink-2">{show(t.value)}{t.challenge ? <span className="block text-[0.8rem] text-ink-muted">{t.challenge}</span> : null}</td><td className="py-2">{t.inForecast ? <Pill tone="good">yes</Pill> : <Pill tone="watch">no</Pill>}</td></tr>)}</tbody></table></div>
          {L.capacity && <p className="text-[0.9rem] text-ink-2 pt-3"><b className="text-ink">Capacity: </b>{show(L.capacity.hoursPerWeek)} clinical hours a week; a ceiling of about {gbp0(Number(L.capacity.takingsCeilingMonthly))} a month. {L.capacity.notes}</p>}
          <ul className="pt-2">{(L.assumptions ?? []).map((a: any) => <Item key={a.id} {...a} />)}</ul>
        </Area>}
        {B && <Area title="The whole business: Bedhampton, people, tax, debt" verdict={B.verdict} count={B.assumptions?.length}>
          {B.breakEven && <p className="text-[0.92rem] text-ink pb-2"><b>Break-even: </b>both clinics together need {show(B.breakEven.bothClinicsMonthly)} a month (reached {show(B.breakEven.reachedBoth)}); Winchester alone needs {show(B.breakEven.winchesterAloneMonthly)} (reached {show(B.breakEven.reachedWinchester)}).</p>}
          {B.stress?.length > 0 && <div className="pb-2"><b className="text-ink text-[0.92rem]">What would break the plan</b><ul className="grid gap-1 text-[0.88rem] text-ink-2 list-disc pl-5 pt-1">{B.stress.map((x: any, i: number) => <li key={i}><b className="text-ink">{x.scenario}: </b>lowest bank {show(x.lowestBank)}{x.month ? ` in ${x.month}` : ""}. <span className="text-ink-muted">{x.workings}</span></li>)}</ul></div>}
          {B.obligations?.length > 0 && <div className="overflow-x-auto pb-2"><table className="w-full text-[0.86rem]"><thead><tr className="text-left text-[0.66rem] uppercase tracking-[0.12em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-3">Owed</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3 text-right">A month</th><th className="py-2 pr-3">When</th><th className="py-2">In the forecast</th></tr></thead>
            <tbody>{B.obligations.map((o: any, i: number) => <tr key={i} className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">{o.name}</td><td className="py-2 pr-3 text-right tabular">{show(o.owed)}</td><td className="py-2 pr-3 text-right tabular">{show(o.monthly)}</td><td className="py-2 pr-3 text-ink-2">{[o.from, o.to].filter(Boolean).join(" to ")}</td><td className="py-2">{o.inForecast ? <Pill tone="good">yes</Pill> : <Pill tone="watch">no</Pill>}</td></tr>)}</tbody></table></div>}
          <ul>{(B.assumptions ?? []).map((a: any) => <Item key={a.id} {...a} name={`${a.area ? `${a.area}: ` : ""}${a.name}`} />)}</ul>
          {B.lostFromLaunchOs?.length > 0 && <div className="pt-3"><b className="text-ink text-[0.92rem]">In the old Launch OS, not in the new model</b><ul className="grid gap-1 text-[0.88rem] text-ink-2 list-disc pl-5 pt-1">{B.lostFromLaunchOs.map((x: any, i: number) => <li key={i}>{show(x)}</li>)}</ul></div>}
        </Area>}
        {E && <Area title="The forecasting engine, checked for errors" verdict={E.verdict} count={E.findings?.length}>
          <ul>{(E.findings ?? []).map((f: any) => (
            <li key={f.id} className="py-3 border-b border-border grid gap-1">
              <span className="flex flex-wrap items-baseline gap-2"><Pill tone={f.severity === "error" ? "act" : f.severity === "risk" ? "watch" : "muted"}>{f.severity === "error" ? "error" : f.severity === "risk" ? "risk" : "note"}</Pill><b className="text-ink text-[0.96rem]">{f.title}</b>{f.moneyAtStake != null && <span className="text-[0.82rem] text-ink-muted tabular">{show(f.moneyAtStake)} at stake</span>}</span>
              <span className="text-[0.88rem] text-ink-2 leading-relaxed">{f.what}</span>
              <details><summary className="cursor-pointer text-[0.8rem] text-ink-muted underline underline-offset-2 min-h-[32px] inline-flex items-center">Evidence and fix</summary><p className="text-[0.82rem] text-ink-2 leading-relaxed pt-1">{show(f.evidence)}</p><p className="text-[0.82rem] text-ink-2 leading-relaxed pt-1"><b className="text-ink">Fix: </b>{f.fix}</p><p className="text-[0.76rem] text-ink-muted pt-1">{f.where}</p></details>
            </li>
          ))}</ul>
        </Area>}
      </div>

      {gaps.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[0.92rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">What would tighten the forecast ({gaps.length} things the team could not find)</summary>
          <ul className="grid gap-1 text-[0.88rem] text-ink-2 leading-relaxed list-disc pl-5">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </details>
      )}
    </Section>
  );
}
