// Ads, the command board (owner, 15 Nov 2026: "make it useful and push the rest out"). One phone
// screen and one scroll: the verdict, four figures for the last 7 days against the 7 before, the
// pathway in one line, at most three things that need David, this month, then the detail pages.
import { Link } from "wouter";
import { useSummary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { NeedsYou } from "@/components/board-shell";
import { Page, PageHead, Section, LinkList, Next } from "@/components/page";
import { Flow } from "@/components/viz";
import { Sources } from "@/components/fresh";
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
          : <><div className="rounded-2xl bg-ink px-5 py-5 sm:px-7 sm:py-6"><Verdict state={s.state} text={s.verdict} dark /></div><Sources chips={s.sources} /></>}
      </PageHead>
      {s && <KpiGrid kpis={s.kpis} max={4} />}
      {steps.length > 0 && (
        <Section title="The pathway since the ads began">
          <Flow steps={steps} ariaLabel={`The pathway: ${steps.map((st) => `${st.label} ${st.value}`).join(", ")}`} />
        </Section>
      )}
      <NeedsYou board="ads" summary={s} max={3} />
      {s?.extra?.thisMonth && <Next>{s.extra.thisMonth}</Next>}
      <Section title="Detail"><LinkList links={ADS_PAGES} /></Section>
      {s && <p className="text-[0.78rem] text-ink-muted">{s.keeper}. <Link href="/sources" className="underline">Sources</Link></p>}
    </Page>
  );
}
