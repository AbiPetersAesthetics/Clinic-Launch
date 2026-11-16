// How the numbers are built (owner, 16 Nov 2026: "which model we are using for growth, our fixed
// and variable costs over time... in detail where it is all coming from"). The old Launch OS page
// did this as two tables; this one draws it: the growth model in use beside the others, the patient
// figures behind it, cost of sales and gross margin, the overheads and where each comes from, and any
// one month walked line by line with the reason for every figure. Read only.
import { useState } from "react";
import { Link } from "wouter";
import { usePage, useSummary, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, gbp0 } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";
import { AmendPanel, type Settings } from "@/components/amend-panel";
import { ModelReview } from "@/components/model-review";
import { StockEditor } from "@/components/stock-editor";
import { MultiLine, StackN, Waterfall, SplitBar, Stat, MarginColumns, Pill, HBars, Hover, TipHead, V } from "@/components/viz";

const back = { href: "/money", label: "Money" };
const monthName = (ym: string) => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function WorkingsPage() {
  const { data } = usePage("workings");
  const { data: gs } = useSummary("growth");
  const rows: any[] = data?.rows ?? [];
  const firstTrading = Math.max(0, rows.findIndex((r) => r.winc > 0));
  const [sel, setSel] = useState<number | null>(null);
  const [preset, setPreset] = useState<{ draft: any; label: string } | null>(null);
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
  const settings: Settings | null = data && C ? {
    rentAnnual: C.rent.annual, ratesMonthly: C.rates.monthly, utilitiesMonthly: C.utilities.monthly, runningMonthly: C.running.monthly, marketingMonthly: C.marketing.monthly, useAdsPlan: !!C.marketing.useAdsPlan,
    bedhKept: data.keep.bedhampton, extraPct: data.settings?.extraPct ?? 0, productScale: data.settings?.productScale ?? 1, scenario: data.chosen, profile: data.settings?.profile ?? null, listPrice: data.settings?.listPrice ?? 1.48, founderPrice: data.settings?.founderPrice ?? 1.184, foundingPatients: data.settings?.foundingPatients ?? 60, foundingTakings: data.settings?.foundingTakings ?? 4400,
    buildGeneral: items.length ? groupSum("General running") : null, scenarios: data.scenarios.map((x: any) => ({ key: x.key, label: x.label })), centralProfile: data.settings?.centralProfile ?? null,
  } : null;
  const growthDetail = (k: number) => {
    const x = rows[k]; if (!x) return null;
    const np = P?.newPatients?.[k], npPrev = k > 0 ? P?.newPatients?.[k - 1] : null;
    const dropped = chosen && k > 0 && chosen.winc[k] < chosen.winc[k - 1];
    return (
      <>
        {np != null && <span>{chosen?.label}: {np} new paying patients this month{x.month === "2026-12" ? " (the opening cohort as booked)" : ""}.</span>}
        {x.transferIn > 0 && <span>Every line includes {gbp0(x.transferIn)} from Bedhampton patients who move with Abi's second day.</span>}
        <span>{x.month <= "2027-01" ? "Introductory prices." : "Winchester list prices."}</span>
        {dropped && npPrev != null && np != null && npPrev > np && <span>Down on last month: new patients fall from {npPrev} to {np}{x.month === "2027-03" ? ", as the launch months and introductory prices end" : ""}.</span>}
      </>
    );
  };
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
            <MultiLine labels={data.labels} detail={growthDetail} series={data.scenarios.map((s: any) => ({ label: s.label, values: s.winc, chosen: s.chosen }))}
              ariaLabel={`Winchester takings under each growth model. ${data.scenarios.map((s: any) => `${s.label}: ${gbp0(s.winc[s.winc.length - 1])} by ${data.labels[data.labels.length - 1]}`).join("; ")}`} />
            <ul className="grid gap-3 border-t border-border pt-3">
              {data.scenarios.map((s: any) => (
                <li key={s.key} className="grid gap-0.5">
                  <span className="flex flex-wrap items-center gap-2"><b className="text-ink text-[1rem]">{s.label}</b>{s.chosen ? <Pill tone="good">in use</Pill> : null}<span className="text-[0.8rem] text-ink-muted">lowest bank {gbp0(s.lowest)}{s.lowestMonth ? `, ${s.lowestMonth}` : ""}</span></span>
                  <span className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">{s.note}</span>
                </li>
              ))}
            </ul>
            <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[70ch]">Point at the chart for any month's figures. Each line includes the Bedhampton patients the model moves across once Bedhampton is on one day a week. To change the model in use, use Amend the position below.</p>
          </Section>

          {(() => {
            const rec = data.scenarios.find((x: any) => x.chosen), dav = data.scenarios.find((x: any) => x.key === "base"), S = data.sensitivity;
            if (!rec || !dav || !S || rec.key === dav.key) return null;
            const in27 = (arr: number[]) => arr.reduce((t: number, v: number, k: number) => t + (rows[k]?.month.startsWith("2027") ? v : 0), 0);
            const rec27 = in27(rec.winc), dav27 = in27(dav.winc), gap27 = dav27 - rec27;
            const flats = S.flats as { patients: number; winc2027: number; bankEnd2027: number }[];
            const patientsFor = (v: number) => { for (let k = 1; k < flats.length; k++) if (v <= flats[k].winc2027) { const a = flats[k - 1], b = flats[k]; return a.patients + ((v - a.winc2027) * (b.patients - a.patients)) / (b.winc2027 - a.winc2027); } return flats[flats.length - 1].patients; };
            const pRec = patientsFor(rec27), pDav = patientsFor(dav27);
            const perPatient = (flats[flats.length - 1].winc2027 - flats[0].winc2027) / (flats[flats.length - 1].patients - flats[0].patients);
            const priceGain = S.priceUp.winc2027 - S.plan2027;
            const ix = (m: string) => rows.findIndex((x) => x.month === m);
            const npMar = P?.newPatients?.[ix("2027-03")], npDec = P?.newPatients?.[ix("2027-12")];
            const running = (gs?.extra?.viz?.days14 ?? []).filter((d: any) => d.running).length;
            const leads = gs?.extra?.leads ?? 0, booked = gs?.extra?.booked ?? 0;
            const consults = running ? (booked / running) * 30 : 0;
            const share = consults ? Math.round((100 * pDav) / consults) : null;
            const near = (n: number, t: number) => Math.abs(n - t) < 2;
            return (
              <Section title={`2. Why "${rec.label}" and your forecast differ by ${gbp0(gap27)} in 2027`} id="w-why">
                <p className="text-[1.1rem] sm:text-[1.25rem] font-bold text-ink leading-snug max-w-[60ch]">{rec.label} has Winchester taking {gbp0(rec27)} in 2027; your forecast has {gbp0(dav27)}. Almost all of the difference is how many new paying patients arrive each month: about {Math.round(pRec)} against about {Math.round(pDav)}. Price is not the gap.</p>
                <MarginColumns rows={rows.map((x, k) => ({ label: x.label, value: dav.winc[k] - rec.winc[k] }))} lineLabel="your forecast higher above this line"
                  ariaLabel={`How much higher your forecast is than ${rec.label} each month. ${rows.map((x, k) => `${x.label}: ${gbp0(dav.winc[k] - rec.winc[k])}`).join("; ")}`}
                  detail={(k) => <><span>{rec.label}: {gbp0(rec.winc[k])}</span><span>Your forecast: {gbp0(dav.winc[k])}</span>{P?.newPatients && <span>{rec.label} assumes {P.newPatients[k]} new paying patients this month; yours works out at about {Math.round(pDav)}.</span>}</>} />
                <p className="text-[0.82rem] text-ink-muted -mt-1">Below the line in December to February: {rec.label} has the launch months stronger (22 new patients a month and the opening cohort); your forecast climbs in a straight line instead.</p>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="grid gap-2 content-start">
                    <b className="text-ink text-[1rem]">Winchester's 2027 takings at each number of new paying patients a month</b>
                    <HBars labelWidth="7.5rem" ariaLabel="Winchester's 2027 takings at each number of new paying patients a month"
                      rows={flats.map((f) => ({ label: `${f.patients} a month`, note: near(f.patients, pRec) ? `about ${rec.label}` : near(f.patients, pDav) ? "about your forecast" : undefined, value: f.winc2027, display: gbp0(f.winc2027), color: near(f.patients, pRec) ? V.ink : near(f.patients, pDav) ? V.sageDeep : V.base,
                        tip: <span>From March 2027; January and February stay at 22. Bank at the end of 2027: {gbp0(f.bankEnd2027)}.</span> }))} />
                    <p className="text-[0.86rem] text-ink-2 leading-relaxed">Each extra new paying patient a month adds about <b className="text-ink">{gbp0(perPatient)}</b> to Winchester's 2027 takings. Lifting the price list from 1.48 to 1.60 times Bedhampton's adds only about <b className="text-ink">{gbp0(priceGain)}</b>.</p>
                  </div>
                  <ul className="grid gap-3 content-start text-[0.92rem] text-ink-2 leading-relaxed">
                    <li><b className="text-ink">The assumption.</b> {rec.label} has 22 new paying patients a month in January and February (the launch, introductory prices and the warm list), then {npMar ?? 16} from March rising to {npDec ?? 18} by December 2027. Your forecast is a straight line in pounds; on the patient model it needs about {Math.round(pDav)} a month all year.</li>
                    <li><b className="text-ink">Against Bedhampton.</b> Bedhampton averaged {P?.bedhAvg2026} new patients a month in 2026{S.bedhBest ? `; its best month was ${S.bedhBest.patients}, in ${monthName(S.bedhBest.month)}` : ""}. Your forecast asks Winchester to beat Bedhampton's average in its first year, in a town where it has no Google reviews of its own yet.</li>
                    {running > 0 && consults > 0 && <li><b className="text-ink">Against the ads so far.</b> {leads} leads and {booked} booked consultations in {running} days: about {Math.round(consults)} consultations a month from the ads alone. If half go on to pay that is about {Math.round(consults / 2)} new patients a month, close to {rec.label}. {share != null && share <= 100 ? `Your forecast needs about ${share} in every 100 to pay, or more patients from the warm list, walk-ins and referrals.` : "Your forecast needs more patients than the ads alone are booking, from the warm list, walk-ins and referrals."}</li>}
                    <li><b className="text-ink">What settles it.</b> Model-day takings on 4 December, how many December consultations go on to pay (by about 19 December), and January's new patients. If January and February each bring {Math.round(pDav)} or more new paying patients, your forecast is the better plan: switch it under Amend the position below.</li>
                  </ul>
                </div>
              </Section>
            );
          })()}

          {P && (
            <Section title="3. Where the takings come from" id="w-patients" note="Bedhampton's own records, at Winchester prices">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat tip={<span>{gbp0(P.firstMonth)} is what a new Bedhampton patient spent on average in their first month (ANS, March to September 2026), times {P.listVsBedhampton} for Winchester's list prices.</span>} label="A new patient's first month" value={gbp0(P.firstMonth * P.listVsBedhampton)} sub={`${gbp0(P.firstMonth)} at Bedhampton prices; ${gbp0(P.firstMonth * P.foundersVsBedhampton)} at introductory prices`} />
                <Stat tip={<span>What a returning Bedhampton patient spent a visit on average, {gbp0(P.returnVisit)}, times {P.listVsBedhampton} for Winchester's list.</span>} label="Each return visit" value={gbp0(P.returnVisit * P.listVsBedhampton)} sub={`${gbp0(P.returnVisit)} at Bedhampton prices`} />
                <Stat tip={<span>How often a new patient comes back, month by month after their first visit, from Bedhampton's records. This curve drives most of Winchester's growth after each patient's first month.</span>} label="Return visits, first year" value={P.returns12.toFixed(1)} sub={`${P.returns36.toFixed(1)} over three years, per new patient`} />
                <Stat tip={<span>First appointments in ANS, May 2024 to September 2026.{data.sensitivity?.bedhBest ? ` Best month: ${data.sensitivity.bedhBest.patients}, in ${monthName(data.sensitivity.bedhBest.month)}.` : ""}</span>} label="Bedhampton's new patients" value={`${P.bedhAvg2026} a month`} sub={`2026 so far; ${P.bedhAvg2025} a month in 2025`} />
              </div>
              {P.newPatients && (
                <>
                  <p className="text-[1rem] font-bold text-ink pt-1">New patients a month the model assumes at Winchester</p>
                  <MarginColumns rows={data.labels.map((l: string, k: number) => ({ label: l, value: P.newPatients[k], title: `${l}: ${P.newPatients[k]} new patients` }))} ariaLabel={`New patients a month assumed at Winchester. ${data.labels.map((l: string, k: number) => `${l}: ${P.newPatients[k]}`).join("; ")}`} money={false} detail={(k) => <><span>Winchester takings this month ({chosen?.label}): {gbp0(chosen?.winc?.[k] ?? 0)}</span><span>Each new patient is worth about {gbp0(P.firstMonth * P.listVsBedhampton)} in their first month, then about {P.returns12.toFixed(1)} return visits in the year.</span></>} />
                </>
              )}
              <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">How a month's takings are worked out: every earlier month's new patients come back at the rate Bedhampton's patients actually did, and each visit is priced at what Bedhampton patients spent, lifted to Winchester's price list ({P.listVsBedhampton} times Bedhampton's, or {P.foundersVsBedhampton.toFixed(2)} times at introductory prices to {monthName(P.founderUntil)}). December starts from the {P.founding.patients} people and {gbp0(P.founding.firstMonthTotal)} already booked when the model was built. Source: the ANS export of 30 September 2026, totals only.</p>
            </Section>
          )}

          <Section title="4. Cost of sales and gross margin" id="w-variable" note="tap a month">
            <StackN selected={i} onSelect={setSel} detail={(k) => { const x = rows[k]; const t = x.winc + x.bedh, net = t - x.vat; return <><span>Sales including VAT: {gbp0(t)} ({gbp0(x.winc)} Winchester, {gbp0(x.bedh)} Bedhampton)</span><span>Sales before VAT: {gbp0(net)}</span><span>Gross margin {net ? Math.round((100 * x.kept) / net) : 0}% of sales before VAT.</span></>; }} parts={[{ label: "Gross profit", color: V.good }, { label: "Cost of sales (product)", color: V.slate }, { label: "VAT", color: V.base }]} rows={rows.map((x) => ({ label: x.label, values: [x.kept, x.product, x.vat] }))}
              ariaLabel={`Sales each month split into VAT, cost of sales and gross profit. ${rows.map((x) => `${x.label}: gross profit ${gbp0(x.kept)} on sales of ${gbp0(x.winc + x.bedh)} including VAT`).join("; ")}`} />
            <div className="grid gap-6 md:grid-cols-2">
              {r.winc > 0 && <div className="grid gap-2"><b className="text-ink">Winchester, {r.label}</b><SplitBar ariaLabel={`Winchester ${r.label}: gross profit, cost of sales and VAT`} total={{ label: "Sales including VAT", value: gbp0(r.winc) }} stack parts={[{ label: "Gross profit", value: r.wincKept, color: V.good, note: `gross margin ${Math.round((100 * r.wincKept) / Math.max(1, r.winc - r.wincVat))}% of sales before VAT` }, { label: "Cost of sales (product)", value: r.wincProduct, color: V.slate }, { label: "VAT", value: r.wincVat, color: V.base }]} /></div>}
              {r.bedh > 0 && <div className="grid gap-2"><b className="text-ink">Bedhampton, {r.label}</b><SplitBar ariaLabel={`Bedhampton ${r.label}: gross profit, cost of sales and VAT`} total={{ label: "Sales including VAT", value: gbp0(r.bedh) }} stack parts={[{ label: "Gross profit", value: r.bedhKept, color: V.good, note: `gross margin ${Math.round((100 * r.bedhKept) / Math.max(1, r.bedh - r.bedhVat))}% of sales before VAT` }, { label: "Cost of sales (product)", value: r.bedhProduct, color: V.slate }, { label: "VAT", value: r.bedhVat, color: V.base }]} /></div>}
            </div>
            <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[70ch]">Sales are shown including VAT, as the clinic takes them; VAT is one sixth of that. Cost of sales is the product used, {Math.round(P.productShare * 1000) / 10}% of Bedhampton's sales including VAT, so Bedhampton's gross margin is {Math.round((10 * data.keep.bedhampton) / (5 / 6)) / 10}% of sales before VAT. The same products cost the same at Winchester's higher prices, so its gross margin is about {Math.round((10 * data.keep.winchester) / (5 / 6)) / 10}% over three years, a little lower while introductory prices run. {r.why?.contribution ? `${r.label}: ${r.why.contribution}.` : ""}</p>
            {(() => {
              return (
                <div className="grid gap-2.5 border-t border-border pt-4" id="w-stock">
                  <b className="text-ink text-[1.02rem]">Stock: what each treatment costs in product</b>
                  <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[72ch]">The model takes <b className="text-ink">{Math.round(P.productShare * 1000) / 10}p of every pound Bedhampton takes</b> as stock. That figure was worked out once, from the estimated product cost of each treatment on the price list, applied to 427 treatments paid between March and September 2026. <b className="text-ink">It has never been checked against money actually spent</b>: stock is bought on the Capital on Tap card and no itemised statement is on file, so the bank only shows repayments to the card.</p>
                  <StockEditor />
                  <p className="text-[0.86rem] text-ink-2 leading-relaxed max-w-[72ch]"><b className="text-ink">Why it matters.</b> The team puts the true stock figure somewhere between 26p and 34p in the pound; each penny is about £120 a month at £12,000 of Winchester takings.</p>
                  <p className="text-[0.86rem] text-ink leading-relaxed max-w-[72ch]"><b>To make it real:</b> export twelve months of Capital on Tap transactions and send them over. ALFRED will total the supplier lines, set stock from what was actually spent, and show it here against takings month by month.</p>
                </div>
              );
            })()}
          </Section>

          <Section title="5. Overheads, month by month" id="w-fixed" note="tap a month">
            <StackN selected={i} onSelect={setSel} detail={(k) => { const x = rows[k]; return <><span>Gross profit: {gbp0(x.kept)}</span><span>Operating profit: {gbp0(x.operatingProfit)}</span>{x.rent === 0 && <span>Rent free this month.</span>}{x.oneOff > 0 && <span>Includes a one-off cost of {gbp0(x.oneOff)}.</span>}</>; }} parts={[{ label: "Rent", color: V.ink }, { label: "Rates", color: V.slate }, { label: "Advertising", color: V.sageDeep }, { label: "General running", color: V.base }, { label: "Utilities", color: V.sage }, { label: "One-offs", color: V.watch }]}
              rows={rows.map((x) => ({ label: x.label, values: [x.rent, x.rates, x.marketing, x.general, x.utilities, x.oneOff] }))}
              ariaLabel={`Overheads each month. ${rows.map((x) => `${x.label}: ${gbp0(fixedOf(x))}`).join("; ")}`} />
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
                  <tr className="border-b border-line-strong bg-wash/70"><td className="py-2 pr-3 font-extrabold text-ink">Overheads</td><td className="py-2 pr-3 text-right tabular font-extrabold">{gbp0(fixedOf(r))}</td><td className="py-2 text-ink-2">The same whatever is taken that month.</td></tr>
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
                    <HBars ariaLabel={`${g}, line by line`} max={Math.max(...on.map((x) => x.amount))} labelWidth="13rem" rows={lines.map((x) => ({ label: x.name, note: x.type === "dual" ? "shared across both clinics, counted once" : "Winchester only", value: x.amount, display: gbp0(x.amount), color: x.type === "dual" ? V.sageDeep : V.ink, tip: <span>{Math.round((100 * x.amount) / buildTotal)}% of the {gbp0(buildTotal)} build; {gbp0(x.amount * 12)} a year. Last changed in Launch OS {new Date(x.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</span> }))} />
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

          <ModelReview review={data.review} planWinchester={chosen ? { months: rows.map((x) => x.month), values: chosen.winc } : undefined} onLoad={(p) => setPreset({ ...p })} />

          {settings && <AmendPanel s={settings} log={data.log} preset={preset} />}

          <Section title={`6. ${monthName(r.month)}, line by line`} id="w-month" note="pick any month">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {rows.map((x, k) => <button key={x.month} type="button" onClick={() => setSel(k)} aria-pressed={k === i} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-[0.82rem] font-semibold ${k === i ? "bg-ink text-white border-ink" : "bg-card text-ink border-line-strong hover:bg-wash"}`}>{x.label}</button>)}
            </div>
            <Waterfall base={r.winc + r.bedh - r.vat} ariaLabel={`${r.label} from sales to retained profit`} rows={[
              ...(r.winc > 0 ? [{ label: "Winchester sales", value: r.winc, kind: "in" as const, note: [r.why?.winc, r.why?.occupancy].filter(Boolean).join(". ") }] : []),
              ...(r.bedh > 0 ? [{ label: "Bedhampton sales", value: r.bedh, kind: "in" as const, note: r.why?.bedh }] : []),
              { label: "Sales including VAT", value: r.winc + r.bedh, kind: "total" as const },
              { label: "VAT to HMRC", value: r.vat, kind: "out" as const, note: r.why?.vat },
              { label: "Cost of sales (product)", value: r.product, kind: "out" as const, note: r.why?.contribution },
              { label: "Gross profit", value: r.kept, kind: "total" as const },
              { label: "Rent", value: r.rent, kind: "out" as const, note: r.rent ? "one twelfth of the year's rent" : "rent free this month" },
              { label: "Business rates", value: r.rates, kind: "out" as const },
              { label: "Advertising", value: r.marketing, kind: "out" as const },
              { label: "General running", value: r.general, kind: "out" as const },
              { label: "Utilities", value: r.utilities, kind: "out" as const },
              ...(r.oneOff ? [{ label: "One-offs", value: r.oneOff, kind: "out" as const }] : []),
              { label: "Operating profit", value: r.operatingProfit, kind: "total" as const, note: r.why?.operatingProfit },
              ...(r.loanInterest ? [{ label: "Interest on James's loan", value: r.loanInterest, kind: "out" as const }] : []),
              { label: "Abi's pay, with employer's NI", value: r.payCost, kind: "out" as const, note: r.why?.pay },
              { label: "Retained profit", value: r.retained, kind: "total" as const },
            ]} />
            <p className="text-[0.88rem] text-ink-2 leading-relaxed max-w-[70ch]">This is the month's profit and loss, not its bank movement. The bank also sees the build, VAT refunds, funding, card and loan repayments, and rent and rates on the days they are actually paid. Bank at the end of {r.label}: <b className="text-ink">{gbp0(r.bank)}</b>. {r.why?.moneyOutBank ? `Out of the bank: ${r.why.moneyOutBank}.` : ""}</p>
          </Section>

          <details>
            <summary className="cursor-pointer text-[0.9rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">Every month as a table</summary>
            <div className="overflow-x-auto rounded-2xl bg-card border border-border p-3">
              <table className="w-full min-w-[860px] text-[0.82rem] tabular">
                <thead><tr className="text-right text-[0.66rem] uppercase tracking-[0.1em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-2 text-left">Month</th><th className="pr-2">Winchester sales</th><th className="pr-2">Bedhampton sales</th><th className="pr-2">VAT</th><th className="pr-2">Cost of sales</th><th className="pr-2">Gross profit</th><th className="pr-2">Overheads</th><th className="pr-2">Operating profit</th><th className="pr-2">Abi's pay</th><th className="pr-2">Retained</th><th>Bank</th></tr></thead>
                <tbody>{rows.map((x, k) => <tr key={x.month} onClick={() => setSel(k)} className={`text-right border-b border-border cursor-pointer hover:bg-wash/60 ${k === i ? "bg-wash font-semibold" : ""}`}><td className="py-1.5 pr-2 text-left">{x.label}</td><td className="pr-2">{gbp0(x.winc)}</td><td className="pr-2">{gbp0(x.bedh)}</td><td className="pr-2">{gbp0(x.vat)}</td><td className="pr-2">{gbp0(x.product)}</td><td className="pr-2">{gbp0(x.kept)}</td><td className="pr-2">{gbp0(fixedOf(x))}</td><td className="pr-2">{gbp0(x.operatingProfit)}</td><td className="pr-2">{gbp0(x.payCost)}</td><td className="pr-2">{gbp0(x.retained)}</td><td>{gbp0(x.bank)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Page>
  );
}
