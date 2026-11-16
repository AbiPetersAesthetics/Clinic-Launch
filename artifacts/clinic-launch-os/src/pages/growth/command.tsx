// Growth, the command screen (a reference screen in docs/ALFRED-DESIGN.md). Are we getting patients,
// and what is it costing? One idea per section: the verdict, the "so what" against outside
// benchmarks, leads and bookings day by day (hover or tap a day for who and when), the journey from
// lead to paying patient, what needs a decision, and the campaigns this month.
import { Link } from "wouter";
import { useSummary, usePage } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { NeedsYou } from "@/components/board-shell";
import { Page, PageHead, Section, LinkList } from "@/components/page";
import { Funnel, Timeline } from "@/components/charts";
import { LeadDays, Flow, Bench, type LeadDay } from "@/components/viz";
import { AREAS } from "@/components/shell/nav";
import { Skeleton } from "@/components/ui/skeleton";

const gbp = (n: number, dp = 0) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

// Outside benchmarks, looked up on 16 Nov 2026. They are rough guides from other advertisers, not
// targets: none is specific to UK nurse-led aesthetics, and each is named with its source on screen.
const BENCH = {
  cpl: { value: 40, text: "about £40 a lead", source: "WordStream 2025, beauty and personal care lead campaigns on Facebook ($51.42, US); Whito UK research puts a healthcare clinic at about £40" },
  bookRate: { value: 50, text: "at least 50 in 100", source: "MedEsthetics Magazine: a practice should turn at least half of qualified enquiries into consultations" },
  ownCpl: { low: 9, high: 14, text: "£9 to £14 a lead", source: "our own cold ad sets, May 2025 to April 2026, Ads Manager lifetime figures read 12 Nov 2026" },
};

export default function GrowthCommand() {
  const { data: s, isLoading, error } = useSummary("growth");
  const { data: path } = usePage("pathway");
  const v = s?.extra?.viz;
  const x = s?.extra;
  const pages = AREAS.find((a) => a.key === "growth")!.pages;
  const src = s?.sources?.[0]?.text ?? "";
  const days: any[] = v?.days14 ?? [];
  const running = days.filter((d) => d.running);
  const leads14 = running.reduce((t, d) => t + d.leads, 0);
  const firstRun = days.findIndex((d) => d.running);
  const people: any[] = path?.leads ?? [];
  const shown: LeadDay[] = (running.length >= 7 ? days : running).map((d) => ({
    label: d.label, leads: d.leads, booked: d.booked, paid: null, spend: d.spend,
    people: people.filter((l) => String(l.formSent ?? "").startsWith(d.label + " ")).map((l) => ({ name: l.name, time: String(l.formSent).slice(d.label.length + 1), ad: l.ad, status: l.status, appt: l.appt })),
  }));
  const rate = x?.leads ? Math.round((100 * x.booked) / x.leads) : null;
  const spendDay = running.length ? running.reduce((t, d) => t + d.spend, 0) / running.length : 0;
  const perMonth = v?.cpb ? Math.round((spendDay * 30) / v.cpb) : null;
  const good = v?.cpb != null && v.cpb <= v.cpbTarget && v.cpl != null && v.cpl < BENCH.cpl.value;
  const early = running.length < 14;
  return (
    <Page>
      <PageHead eyebrow="Growth" title="Growth">
        {error ? <p className="text-act">The summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-20 w-full max-w-xl rounded-xl" />
          : <div className="rounded-2xl bg-ink px-5 py-5 sm:px-7 sm:py-6"><Verdict state={s.state} text={s.verdict} dark /></div>}
        {s && <div className="flex flex-wrap gap-x-4">{s.sources.map((c) => <span key={c.source} className="text-[0.8rem] text-ink-muted">{c.text}</span>)}</div>}
      </PageHead>

      {v?.cpb != null && v?.cpl != null && (
        <Section title="So what" id="sowhat" note={early ? `${running.length} days of figures: early` : undefined}>
          <p className="text-[1.2rem] sm:text-[1.4rem] leading-snug font-bold text-ink max-w-[52ch]">
            {good ? "Good news so far. " : "Mixed so far. "}
            A lead is costing {gbp(v.cpl, 2)} where beauty advertisers typically pay {BENCH.cpl.text}, and {rate} in 100 leads have booked a consultation.
          </p>
          <p className="text-[1rem] text-ink-2 leading-relaxed max-w-[62ch]">
            {perMonth != null && <>If this rate held, the current spend of about {gbp(spendDay)} a day would book about {perMonth} consultations a month. </>}
            What is not known yet is whether they turn up and pay: the first consultation is on {x?.firstAppt}, and paying patients are counted from about {x?.firstClose}.{early ? ` ${running.length} days is a small sample, so expect these figures to move.` : ""}
          </p>
          <div className="grid gap-5 md:grid-cols-3 pt-1">
            <Bench label="Cost per lead" value={v.cpl} display={gbp(v.cpl, 2)} mark={BENCH.cpl.value} markLabel={`industry, about ${gbp(BENCH.cpl.value)}`} note={`Our own earlier cold ad sets ran at ${BENCH.ownCpl.text}.`} />
            <Bench label="Leads that book" value={rate ?? 0} display={`${rate} in 100`} mark={BENCH.bookRate.value} max={100} lowerIsBetter={false} markLabel={`guide, ${BENCH.bookRate.text}`} note={`${x?.booked} of ${x?.leads}; some leads are only hours old.`} />
            <Bench label="Cost per booked consultation" value={v.cpb} display={gbp(v.cpb, 2)} mark={v.cpbTarget} markLabel={`our limit, ${gbp(v.cpbTarget)}`} note="Our own limit; there is no reliable outside figure for this." />
          </div>
          <details>
            <summary className="cursor-pointer text-[0.8rem] text-ink-muted underline underline-offset-2 min-h-[32px] inline-flex items-center">Where the benchmarks come from</summary>
            <ul className="grid gap-1 text-[0.8rem] text-ink-muted leading-relaxed pt-1 max-w-[70ch]">
              <li>Cost per lead: {BENCH.cpl.source}. Neither is specific to UK aesthetics.</li>
              <li>Leads that book: {BENCH.bookRate.source}.</li>
              <li>Our own history: {BENCH.ownCpl.source}.</li>
              <li>Looked up on 16 Nov 2026. Rough guides, not targets.</li>
            </ul>
          </details>
        </Section>
      )}

      {v && shown.length > 0 && (
        <Section title="Leads and bookings, day by day" id="days-h" note={<Link href="/growth/ads/last-14-days" className="underline">detail</Link>}>
          <p className="text-[1.1rem] sm:text-[1.25rem] leading-snug font-bold text-ink max-w-[52ch]">
            {x?.hadPrev ? `${x?.leadsW ?? 0} leads came in over the last seven days, against ${x.leadsP} the week before.` : `${leads14} ${leads14 === 1 ? "lead has" : "leads have"} come in over the ${running.length} days since the ads began on ${days[firstRun]?.label ?? "12 Nov"}.`}
          </p>
          <LeadDays days={shown} paidFrom={x?.firstClose ? `from about ${x.firstClose}` : undefined} ariaLabel={`Leads and booked consultations per day. ${shown.map((d) => `${d.label}: ${d.leads} leads, ${d.booked} booked`).join("; ")}`} />
          <p className="text-[0.78rem] text-ink-muted">{x?.hadPrev ? `Last week: ${x.leadsP} leads, ${x.bookedP} booked. ` : "No earlier week to compare yet. "}{src}. Names are first name and initial only.</p>
        </Section>
      )}

      {x?.pathway?.length > 0 && (
        <Section title="From the ad to a paying patient" id="flow-h" note={<Link href="/patients/pathway" className="underline">every lead</Link>}>
          <Flow steps={x.pathway} ariaLabel="From ad spend to leads, booked consultations, seen and paying" />
          <Funnel stages={[{ label: "Leads", value: x?.leads ?? 0 }, { label: "Booked", value: x?.booked ?? 0 }, { label: "Seen", value: null, note: `from ${x?.firstAppt}` }, { label: "Paying", value: null, note: `from about ${x?.firstClose}` }]} ariaLabel="From leads to booked consultations to paying patients" />
          <p className="text-[0.78rem] text-ink-muted">Booked within minutes of the form for most; paying is counted 30 days after each consultation.</p>
        </Section>
      )}

      <NeedsYou board="growth" summary={s} max={3} />

      {v?.timeline?.rows?.length > 0 && (
        <Section title="Campaigns, the next six months">
          <Timeline months={v.timeline.months} rows={v.timeline.rows} todayIndex={0} ariaLabel="Campaign timeline for the next six months" />
          {x?.thisMonth && <p className="text-[0.95rem] text-ink-2 leading-relaxed">{x.thisMonth}</p>}
        </Section>
      )}

      <Section title="In Growth"><LinkList links={pages.map((p) => ({ href: p.href, label: p.label, note: p.note }))} /></Section>
      {s && <p className="text-[0.8rem] text-ink-2">{s.keeper}. <Link href="/sources" className="underline">Sources</Link></p>}
    </Page>
  );
}
