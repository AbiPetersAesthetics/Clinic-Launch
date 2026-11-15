// Growth, the command screen (a reference screen in docs/ALFRED-DESIGN.md). Are we getting patients,
// and what is it costing? One idea per section: the cost of a booked consultation against its limit,
// leads day by day, the journey from lead to paying patient, what needs a decision, and the campaigns
// this month. Everything else is one tap away.
import { Link } from "wouter";
import { useSummary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { NeedsYou } from "@/components/board-shell";
import { Page, PageHead, Section, LinkList } from "@/components/page";
import { Insight, Bullet, Funnel, DayColumns, Timeline } from "@/components/charts";
import { AREAS } from "@/components/shell/nav";
import { Skeleton } from "@/components/ui/skeleton";

const gbp = (n: number, dp = 0) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export default function GrowthCommand() {
  const { data: s, isLoading, error } = useSummary("growth");
  const v = s?.extra?.viz;
  const x = s?.extra;
  const pages = AREAS.find((a) => a.key === "growth")!.pages;
  const src = s?.sources?.[0]?.text ?? "";
  const days: any[] = v?.days14 ?? [];
  const running = days.filter((d) => d.running);
  const leads14 = running.reduce((t, d) => t + d.leads, 0);
  const firstRun = days.findIndex((d) => d.running);
  return (
    <Page>
      <PageHead eyebrow="Growth" title="Growth">
        {error ? <p className="text-act">The summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-20 w-full max-w-xl rounded-xl" />
          : <div className="rounded-2xl bg-ink px-5 py-5 sm:px-7 sm:py-6"><Verdict state={s.state} text={s.verdict} dark /></div>}
        {s && <div className="flex flex-wrap gap-x-4">{s.sources.map((c) => <span key={c.source} className="text-[0.8rem] text-ink-muted">{c.text}</span>)}</div>}
      </PageHead>

      {v?.cpb != null && (
        <div className="grid gap-1 -mt-3">
          <span className="text-[0.85rem] text-ink-2">Cost per booked consultation against our limit</span>
          <Bullet value={v.cpb} target={v.cpbTarget} status={v.cpb <= v.cpbTarget ? "good" : v.cpb <= v.cpbTarget * 1.5 ? "watch" : "bad"} valueLabel={gbp(v.cpb, 2)} targetLabel={`limit ${gbp(v.cpbTarget)}`} ariaLabel={`Cost per booked consultation ${gbp(v.cpb, 2)} against a limit of ${gbp(v.cpbTarget)}`} />
        </div>
      )}
      {v && (
        <div>

          <Insight foot={x?.hadPrev ? `Last week: ${x.leadsP} leads, ${x.bookedP} booked. ${src}` : `No earlier week to compare yet. ${src}`} href="/growth/ads/last-14-days"
            sentence={x?.hadPrev ? `${x?.leadsW ?? 0} leads came in over the last seven days, against ${x.leadsP} the week before.` : `${leads14} ${leads14 === 1 ? "lead has" : "leads have"} come in over the ${running.length} days since the ads began on ${days[firstRun]?.label ?? "12 Nov"}.`}>
            <DayColumns days={(running.length >= 7 ? days : running).map((d) => ({ label: d.label, value: d.leads, title: `${d.label}: ${d.leads} leads, ${d.booked} booked, ${gbp(d.spend, 2)} spent` }))} ariaLabel="Leads per day since the ads began" />
          </Insight>

          <Insight foot="Booked within minutes of the form for most; paying is counted 30 days after each consultation." href="/patients/pathway"
            sentence={`Of ${x?.leads ?? 0} leads, ${x?.booked ?? 0} booked a consultation. Who becomes a paying patient is known from about ${x?.firstClose}.`}>
            <Funnel stages={[{ label: "Leads", value: x?.leads ?? 0 }, { label: "Booked", value: x?.booked ?? 0 }, { label: "Seen", value: null, note: `from ${x?.firstAppt}` }, { label: "Paying", value: x?.cpp != null ? null : null, note: `from about ${x?.firstClose}` }]} ariaLabel="From leads to booked consultations to paying patients" />
          </Insight>
        </div>
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
