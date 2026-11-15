// Ads, the command board (owner, 15 Nov 2026: "make it useful and push the rest out"). One phone
// screen and one scroll: the verdict, four figures for the last 7 days against the 7 before, the
// pathway in one line, at most three things that need David, this month, then the detail pages.
import { Link } from "wouter";
import { useSummary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { NeedsYou } from "@/components/board-shell";
import { Page, PageHead, Section, LinkList, Next } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";

export const ADS_PAGES = [
  { href: "/growth/ads/every-ad", label: "Every ad and audience", note: "Each ad best first; audience fatigue; the all-time figures" },
  { href: "/growth/ads/last-14-days", label: "Last 14 days", note: "Day by day, and this week against last" },
  { href: "/growth/ads/simulator", label: "Simulator", note: "What a budget would buy" },
  { href: "/patients/pathway", label: "Pathway", note: "Every lead from form to diary, with the accuracy checks" },
  { href: "/growth/plan", label: "Plan", note: "The 12 month calendar, month by month, ideas" },
  { href: "/growth/ads/how-it-works", label: "How it works", note: "The scheduled runs and the data" },
];

export default function AdsCommandPage() {
  const { data: s, isLoading, error } = useSummary("ads");
  const steps: { label: string; value: string; sub: string; pending?: boolean }[] = s?.extra?.pathway ?? [];
  return (
    <Page>
      <PageHead eyebrow="Growth · Winchester" title="Ads" back={{ href: "/growth", label: "Growth" }}>
        {error ? <p className="text-act">The Ads summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-16 w-full max-w-xl rounded-xl" />
          : <Verdict state={s.state} text={s.verdict} sources={s.sources} size="md" />}
      </PageHead>
      {s && <KpiGrid kpis={s.kpis} max={4} />}
      {steps.length > 0 && (
        <Section title="The pathway since the ads began">
          <ol className="grid grid-cols-5 border-t border-line-strong">
            {steps.map((st) => (
              <li key={st.label} className="min-w-0 pt-2.5 pr-1 grid gap-0.5">
                <span className="text-[0.62rem] sm:text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-muted truncate">{st.label}</span>
                <b className={`font-sans tabular text-[1.15rem] sm:text-[1.5rem] leading-tight font-medium ${st.pending ? "text-ink-muted" : "text-ink"}`}>{st.value}</b>
                <span className="text-[0.64rem] sm:text-[0.76rem] text-ink-muted leading-tight">{st.sub}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
      <NeedsYou board="ads" summary={s} max={3} />
      {s?.extra?.thisMonth && <Next>{s.extra.thisMonth}</Next>}
      <Section title="Detail"><LinkList links={ADS_PAGES} /></Section>
      {s && <p className="text-[0.78rem] text-ink-muted">{s.keeper}. <Link href="/sources" className="underline">Sources</Link></p>}
    </Page>
  );
}
