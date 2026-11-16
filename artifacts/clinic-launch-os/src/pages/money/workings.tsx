// How the numbers are built (owner, 16 Nov 2026: "which model we are using for growth, our fixed
// and variable costs over time... in detail where it is all coming from"). The old Launch OS page
// did this as two tables; this one draws it: the growth model in use beside the others, the patient
// figures behind it, what is kept from takings, the fixed costs and where each comes from, and any
// one month walked line by line with the reason for every figure. Read only.
import { useState } from "react";
import { Link } from "wouter";
import { usePage, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, gbp0 } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiLine, StackN, Waterfall, SplitBar, Stat, MarginColumns, Pill, HBars, V } from "@/components/viz";

const back = { href: "/money", label: "Money" };
const monthName = (ym: string) => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function WorkingsPage() {
  const { data } = usePage("workings");
  const rows: any[] = data?.rows ?? [];
  const firstTrading = Math.max(0, rows.findIndex((r) => r.winc > 0));
  const [sel, setSel] = useState<number | null>(null);
  const i = sel ?? Math.min(rows.length - 1, firstTrading + 2);
  const r = rows[i];
  const chosen = (data?.scenarios ?? []).find((s: any) => s.chosen);
  const P = data?.patient;
  const C = data?.costs;
  // The fixed cost build, grouped the way the model carries it.
  const items: any[] = data?.fixedItems ?? [];
  const groupOf = (n: string) => (/^rent/i.test(n) ? "Rent" : /rates/i.test(n) ? "Business rates" : /^utilities/i.test(n) ? "Utilities" : /^marketing/i.test(n) ? "Advertising" : "General running");
  const on = items.filter((x) => x.active), off = items.filter((x) => !x.active);
  const groupSum = (g: string) => on.filter((x) => groupOf(x.name) === g).reduce((s2, x) => s2 + x.amount, 0);
  const buildTotal = on.reduce((s2, x) => s2 + x.amount, 0);
  const fixedOf = (x: any) => x.rent + x.rates + x.utilities + x.general + x.marketing + x.oneOff;
  return (
    <Page>
      <PageHead eyebrow="Money" title="How the numbers are built" back={back}>
        {data && chosen && <p className="font-sans font-bold text-[1.3rem] sm:text-[1.5rem] leading-snug text-ink max-w-[54ch]">The forecast runs on the "{chosen.label}" growth model. Winchester goes from {gbp0(rows[firstTrading]?.winc ?? 0)} in {rows[firstTrading]?.label} to {gbp0(rows[rows.length - 1].winc)} a month by {rows[rows.length - 1].label}.</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data || !r ? <Skeleton className="h-60 rounded-xl" /> : (
        <>
          <Section title="1. The growth model in use" id="w-model" note="Winchester takings a month, with VAT">
            <MultiLine labels={data.labels} series={data.scenarios.map((s: any) => ({ label: s.label, values: s.winc, chosen: s.chosen }))}
              ariaLabel={`Winchester takings under each growth model. ${data.scenarios.map((s: any) => `${s.label}: ${gbp0(s.winc[s.winc.length - 1])} by ${data.labels[data.labels.length - 1]}`).join("; ")}`} />
            <ul className="grid gap-3 border-t border-border pt-3">
              {data.scenarios.map((s: any) => (
                <li key={s.key} className="grid gap-0.5">
                  <span className="flex flex-wrap items-center gap-2"><b className="text-ink text-[1rem]">{s.label}</b>{s.chosen ? <Pill tone="good">in use</Pill> : null}<span className="text-[0.8rem] text-ink-muted">lowest bank {gbp0(s.lowest)}{s.lowestMonth ? `, ${s.lowestMonth}` : ""}</span></span>
                  <span className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">{s.note}</span>
                </li>
              ))}
            </ul>
            <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[70ch]">Each line includes the Bedhampton patients the model moves across once Bedhampton is on one day a week. To change the model in use, tell ALFRED: it is one finance change, shown before and after.</p>
          </Section>

          {P && (
            <Section title="2. Where the takings come from" id="w-patients" note="Bedhampton's own records, at Winchester prices">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="A new patient's first month" value={gbp0(P.firstMonth * P.listVsBedhampton)} sub={`${gbp0(P.firstMonth)} at Bedhampton prices; ${gbp0(P.firstMonth * P.foundersVsBedhampton)} at introductory prices`} />
                <Stat label="Each return visit" value={gbp0(P.returnVisit * P.listVsBedhampton)} sub={`${gbp0(P.returnVisit)} at Bedhampton prices`} />
                <Stat label="Return visits, first year" value={P.returns12.toFixed(1)} sub={`${P.returns36.toFixed(1)} over three years, per new patient`} />
                <Stat label="Bedhampton's new patients" value={`${P.bedhAvg2026} a month`} sub={`2026 so far; ${P.bedhAvg2025} a month in 2025`} />
              </div>
              {P.newPatients && (
                <>
                  <p className="text-[1rem] font-bold text-ink pt-1">New patients a month the model assumes at Winchester</p>
                  <MarginColumns rows={data.labels.map((l: string, k: number) => ({ label: l, value: P.newPatients[k], title: `${l}: ${P.newPatients[k]} new patients` }))} ariaLabel={`New patients a month assumed at Winchester. ${data.labels.map((l: string, k: number) => `${l}: ${P.newPatients[k]}`).join("; ")}`} money={false} />
                </>
              )}
              <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">How a month's takings are worked out: every earlier month's new patients come back at the rate Bedhampton's patients actually did, and each visit is priced at what Bedhampton patients spent, lifted to Winchester's price list ({P.listVsBedhampton} times Bedhampton's, or {P.foundersVsBedhampton.toFixed(2)} times at introductory prices to {monthName(P.founderUntil)}). December starts from the {P.founding.patients} people and {gbp0(P.founding.firstMonthTotal)} already booked when the model was built. Source: the ANS export of 30 September 2026, totals only.</p>
            </Section>
          )}

          <Section title="3. Variable costs: what is kept from takings" id="w-variable" note="tap a month">
            <StackN selected={i} onSelect={setSel} parts={[{ label: "Kept", color: V.good }, { label: "Products", color: V.slate }, { label: "VAT", color: V.base }]} rows={rows.map((x) => ({ label: x.label, values: [x.kept, x.product, x.vat] }))}
              ariaLabel={`Takings each month split into VAT, products and what is kept. ${rows.map((x) => `${x.label}: kept ${gbp0(x.kept)} of ${gbp0(x.winc + x.bedh)}`).join("; ")}`} />
            <div className="grid gap-6 md:grid-cols-2">
              {r.winc > 0 && <div className="grid gap-2"><b className="text-ink">Winchester, {r.label}</b><SplitBar ariaLabel={`Winchester ${r.label}: what is kept`} total={{ label: "Taken", value: gbp0(r.winc) }} stack parts={[{ label: "Kept", value: r.wincKept, color: V.good }, { label: "Products", value: r.wincProduct, color: V.slate }, { label: "VAT", value: r.wincVat, color: V.base }]} /></div>}
              {r.bedh > 0 && <div className="grid gap-2"><b className="text-ink">Bedhampton, {r.label}</b><SplitBar ariaLabel={`Bedhampton ${r.label}: what is kept`} total={{ label: "Taken", value: gbp0(r.bedh) }} stack parts={[{ label: "Kept", value: r.bedhKept, color: V.good }, { label: "Products", value: r.bedhProduct, color: V.slate }, { label: "VAT", value: r.bedhVat, color: V.base }]} /></div>}
            </div>
            <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">VAT is one sixth of everything taken. Products cost {Math.round(P.productShare * 1000) / 10}p in the pound at Bedhampton's prices, so Bedhampton keeps {data.keep.bedhampton}p in the pound. The same products go further at Winchester's prices, so Winchester keeps about {data.keep.winchester}p over three years, a little less while introductory prices run. {r.why?.contribution ? `${r.label}: ${r.why.contribution}.` : ""}</p>
          </Section>

          <Section title="4. Fixed costs, month by month" id="w-fixed" note="tap a month">
            <StackN selected={i} onSelect={setSel} parts={[{ label: "Rent", color: V.ink }, { label: "Rates", color: V.slate }, { label: "Advertising", color: V.sageDeep }, { label: "General running", color: V.base }, { label: "Utilities", color: V.sage }, { label: "One-offs", color: V.watch }]}
              rows={rows.map((x) => ({ label: x.label, values: [x.rent, x.rates, x.marketing, x.general, x.utilities, x.oneOff] }))}
              ariaLabel={`Fixed costs each month. ${rows.map((x) => `${x.label}: ${gbp0(fixedOf(x))}`).join("; ")}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-[0.86rem] sm:text-[0.9rem]">
                <thead><tr className="text-left text-[0.7rem] uppercase tracking-[0.12em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-3">Cost</th><th className="py-2 pr-3 text-right">{r.label}</th><th className="py-2">Where the figure comes from</th></tr></thead>
                <tbody className="align-top">
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">Rent</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.rent)}</td><td className="py-2 text-ink-2">{gbp0(C.rent.annual)} a year from the lease, counted evenly from {dayName(C.rent.rentStart)} when the rent-free period ends ({gbp0(C.rent.annual / 12)} a month). It is paid quarterly, so the bank sees it in lumps: see the Cash Line.</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">Business rates</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.rates)}</td><td className="py-2 text-ink-2">{gbp0(C.rates.monthly)} a month, an estimate. {C.rates.note}</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">Advertising</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.marketing)}</td><td className="py-2 text-ink-2">{C.marketing.useAdsPlan ? <>Month by month from the ads plan (<Link href="/growth/plan" className="underline">Growth, Plan</Link>); {gbp0(C.marketing.monthly)} a month where the plan has no figure.</> : `${gbp0(C.marketing.monthly)} a month.`}</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">General running</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.general)}</td><td className="py-2 text-ink-2">{gbp0(C.running.monthly)} a month in the model. The build below itemises {gbp0(groupSum("General running"))} of it: software, the accountant, registrations, clinical waste, banking and the card terminal.</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">Utilities</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.utilities)}</td><td className="py-2 text-ink-2">{gbp0(C.utilities.monthly)} a month before VAT: electricity about £184 (about 7,500 kWh a year), water and sewerage about £20, and broadband £32.</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">One-offs</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.oneOff)}</td><td className="py-2 text-ink-2">{C.oneOffs.length ? C.oneOffs.map((o: any) => `${o.label}, ${gbp0(o.amount)} in ${monthName(o.month)}`).join("; ") : "None in the plan"}.</td></tr>
                  <tr className="border-b border-line-strong bg-wash/70"><td className="py-2 pr-3 font-extrabold text-ink">Fixed costs</td><td className="py-2 pr-3 text-right tabular font-extrabold">{gbp0(fixedOf(r))}</td><td className="py-2 text-ink-2">The same whatever is taken that month.</td></tr>
                  <tr className="border-b border-border"><td className="py-2 pr-3 font-semibold text-ink">James's loan</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.loanRepayment)}</td><td className="py-2 text-ink-2">{C.loans.length ? C.loans.map((l: any) => `${gbp0(l.principal)} at ${l.annualRatePct}%, drawn ${monthName(l.drawMonth)}, ${l.repayments} repayments after a ${l.holidayMonths} month holiday`).join("; ") : "No loan in the plan"}. Paid after profit, so it is not in the columns above. Interest this month: {gbp0(r.loanInterest)}.</td></tr>
                  <tr><td className="py-2 pr-3 font-semibold text-ink">Abi's pay</td><td className="py-2 pr-3 text-right tabular">{gbp0(r.payCost)}</td><td className="py-2 text-ink-2">{r.why?.pay}. The rule is on <Link href="/money/stands-alone" className="underline">Stands Alone</Link>.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {items.length > 0 && (
            <Section title="The fixed cost build, line by line" id="w-build" note={`${on.length} lines on, ${gbp0(buildTotal)} a month`}>
              <p className="text-[0.92rem] text-ink-2 leading-relaxed max-w-[70ch]">This is the build from Launch OS, kept as it was. Each line is marked as you set it there: <b className="text-ink">Winchester only</b>, or <b className="text-ink">shared</b> across both clinics and counted once. The lines can still be edited on the old <Link href="/financials" className="underline">Launch OS money page</Link>.</p>
              {["Rent", "Business rates", "Utilities", "General running", "Advertising"].filter((g) => on.some((x) => groupOf(x.name) === g)).map((g) => {
                const lines = on.filter((x) => groupOf(x.name) === g);
                const modelFig = g === "Rent" ? C.rent.annual / 12 : g === "Business rates" ? C.rates.monthly : g === "Utilities" ? C.utilities.monthly : g === "Advertising" ? C.marketing.monthly : C.running.monthly;
                const gap = Math.round(modelFig - groupSum(g));
                return (
                  <div key={g} className="grid gap-2 border-t border-border pt-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-4"><b className="text-ink text-[1rem]">{g}</b><span className="text-[0.88rem] text-ink-2 tabular">build {gbp0(groupSum(g))}; the model uses {gbp0(modelFig)}{Math.abs(gap) >= 2 ? <b className="text-watch">, {gbp0(Math.abs(gap))} {gap > 0 ? "more" : "less"} than the build</b> : ", the same"}</span></p>
                    <HBars ariaLabel={`${g}, line by line`} max={Math.max(...on.map((x) => x.amount))} labelWidth="13rem" rows={lines.map((x) => ({ label: x.name, note: x.type === "dual" ? "shared across both clinics, counted once" : "Winchester only", value: x.amount, display: gbp0(x.amount), color: x.type === "dual" ? V.sageDeep : V.ink }))} />
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-ink border-t border-border pt-3">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.ink }} />Winchester only: <b className="tabular">{gbp0(on.filter((x) => x.type !== "dual").reduce((s2, x) => s2 + x.amount, 0))}</b></span>
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: V.sageDeep }} />Shared across both clinics: <b className="tabular">{gbp0(on.filter((x) => x.type === "dual").reduce((s2, x) => s2 + x.amount, 0))}</b></span>
              </div>
              {off.length > 0 && <p className="text-[0.85rem] text-ink-muted leading-relaxed max-w-[70ch]">Switched off in the build, so not counted: {off.map((x) => `${x.name} (${gbp0(x.amount)})`).join("; ")}.</p>}
            </Section>
          )}

          <Section title={`5. ${monthName(r.month)}, line by line`} id="w-month" note="pick any month">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {rows.map((x, k) => <button key={x.month} type="button" onClick={() => setSel(k)} aria-pressed={k === i} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-[0.82rem] font-semibold ${k === i ? "bg-ink text-white border-ink" : "bg-card text-ink border-line-strong hover:bg-wash"}`}>{x.label}</button>)}
            </div>
            <Waterfall ariaLabel={`${r.label} from takings to what is kept in the business`} rows={[
              ...(r.winc > 0 ? [{ label: "Winchester takings", value: r.winc, kind: "in" as const, note: [r.why?.winc, r.why?.occupancy].filter(Boolean).join(". ") }] : []),
              ...(r.bedh > 0 ? [{ label: "Bedhampton takings", value: r.bedh, kind: "in" as const, note: r.why?.bedh }] : []),
              { label: "Taken, with VAT", value: r.winc + r.bedh, kind: "total" as const },
              { label: "VAT to HMRC", value: r.vat, kind: "out" as const, note: r.why?.vat },
              { label: "Products used", value: r.product, kind: "out" as const, note: r.why?.contribution },
              { label: "Kept from takings", value: r.kept, kind: "total" as const },
              { label: "Rent", value: r.rent, kind: "out" as const, note: r.rent ? "one twelfth of the year's rent" : "rent free this month" },
              { label: "Business rates", value: r.rates, kind: "out" as const },
              { label: "Advertising", value: r.marketing, kind: "out" as const },
              { label: "General running", value: r.general, kind: "out" as const },
              { label: "Utilities", value: r.utilities, kind: "out" as const },
              ...(r.oneOff ? [{ label: "One-offs", value: r.oneOff, kind: "out" as const }] : []),
              { label: "Profit before pay", value: r.operatingProfit, kind: "total" as const, note: r.why?.operatingProfit },
              ...(r.loanInterest ? [{ label: "Interest on James's loan", value: r.loanInterest, kind: "out" as const }] : []),
              { label: "Abi's pay, with employer's NI", value: r.payCost, kind: "out" as const, note: r.why?.pay },
              { label: "Left in the business", value: r.retained, kind: "total" as const },
            ]} />
            <p className="text-[0.88rem] text-ink-2 leading-relaxed max-w-[70ch]">This is the month's profit, not its bank movement. The bank also sees the build, VAT refunds, funding, card and loan repayments, and rent and rates on the days they are actually paid. Bank at the end of {r.label}: <b className="text-ink">{gbp0(r.bank)}</b>. {r.why?.moneyOutBank ? `Out of the bank: ${r.why.moneyOutBank}.` : ""}</p>
          </Section>

          <details>
            <summary className="cursor-pointer text-[0.9rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">Every month as a table</summary>
            <div className="overflow-x-auto rounded-2xl bg-card border border-border p-3">
              <table className="w-full min-w-[860px] text-[0.82rem] tabular">
                <thead><tr className="text-right text-[0.66rem] uppercase tracking-[0.1em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-2 text-left">Month</th><th className="pr-2">Winchester</th><th className="pr-2">Bedhampton</th><th className="pr-2">VAT</th><th className="pr-2">Products</th><th className="pr-2">Kept</th><th className="pr-2">Fixed costs</th><th className="pr-2">Profit</th><th className="pr-2">Abi's pay</th><th className="pr-2">Left</th><th>Bank</th></tr></thead>
                <tbody>{rows.map((x, k) => <tr key={x.month} onClick={() => setSel(k)} className={`text-right border-b border-border cursor-pointer ${k === i ? "bg-wash font-semibold" : ""}`}><td className="py-1.5 pr-2 text-left">{x.label}</td><td className="pr-2">{gbp0(x.winc)}</td><td className="pr-2">{gbp0(x.bedh)}</td><td className="pr-2">{gbp0(x.vat)}</td><td className="pr-2">{gbp0(x.product)}</td><td className="pr-2">{gbp0(x.kept)}</td><td className="pr-2">{gbp0(fixedOf(x))}</td><td className="pr-2">{gbp0(x.operatingProfit)}</td><td className="pr-2">{gbp0(x.payCost)}</td><td className="pr-2">{gbp0(x.retained)}</td><td>{gbp0(x.bank)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Page>
  );
}
