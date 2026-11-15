// The Ads Board as a command board (owner, 15 Nov 2026: "make it useful and push the rest into
// Patients and Growth"). One phone screen and one scroll at most: the verdict, four KPIs for the
// last 7 days against the 7 before, the pathway in one row, at most three things that need David,
// one line on this month, then one tap into each detail page. Same snapshot, same figures.
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useSummary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { NeedsYou } from "@/components/board-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const ADS_PAGES = [
  { href: "/growth/ads/every-ad", label: "Every ad and audience", note: "Each ad, best first; audience fatigue; all-time KPIs" },
  { href: "/growth/ads/leads", label: "Leads", note: "Every lead traced from form to diary, with the accuracy checks" },
  { href: "/growth/plan", label: "Plan", note: "The 12 month calendar and month by month" },
  { href: "/growth/last-14-days", label: "Last 14 days", note: "Daily bars and week on week" },
  { href: "/growth/simulator", label: "Simulator", note: "If we scale: what a budget buys" },
  { href: "/growth/ideas", label: "Ideas", note: "Ways to lift the return, with the evidence" },
  { href: "/growth/how-it-works", label: "How it works", note: "The scheduled runs and how the data is collected" },
];

export default function AdsCommandPage() {
  const { data: s, isLoading, error } = useSummary("ads");
  const steps: { label: string; value: string; sub: string; pending?: boolean }[] = s?.extra?.pathway ?? [];
  return (
    <div className="space-y-5 sm:space-y-7 max-w-6xl">
      <header className="space-y-2.5">
        <span className="eyebrow">Growth · Winchester</span>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">Ads</h1>
        {error ? <p className="text-act">The Ads summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-7 w-full max-w-xl rounded-xl" />
          : <Verdict state={s.state} text={s.verdict} sources={s.sources} size="md" />}
      </header>

      {s && <KpiGrid kpis={s.kpis} max={4} />}

      {steps.length > 0 && (
        <section aria-label="The pathway since the ads began" className="rounded-xl border border-card-border p-3 sm:p-4">
          <ol className="grid grid-cols-5 gap-1 sm:gap-3">
            {steps.map((st, i) => (
              <li key={st.label} className="min-w-0 grid gap-0.5 text-center relative">
                <span className="text-[0.62rem] sm:text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-muted truncate">{st.label}</span>
                <b className={`font-display tabular text-[1.15rem] sm:text-[1.5rem] leading-tight font-medium ${st.pending ? "text-ink-muted" : "text-ink"}`}>{st.value}</b>
                <span className="text-[0.62rem] sm:text-[0.75rem] text-ink-muted leading-tight">{st.sub}</span>
                {i < steps.length - 1 && <ChevronRight aria-hidden className="hidden sm:block absolute -right-3 top-5 w-4 h-4 text-line-strong" />}
              </li>
            ))}
          </ol>
        </section>
      )}

      <NeedsYou board="ads" summary={s} max={3} />

      {s?.extra?.thisMonth && <p className="text-[0.95rem] text-ink leading-relaxed"><span className="eyebrow plain mr-2">This month</span>{s.extra.thisMonth}</p>}

      <nav aria-label="Ads detail" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ADS_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="flex items-center justify-between gap-1 min-h-[48px] px-3 rounded-xl bg-wash hover:bg-wash-2 text-[0.88rem] font-semibold text-ink">
            <span className="min-w-0">{p.label}</span><ChevronRight className="w-4 h-4 shrink-0 text-ink-muted" />
          </Link>
        ))}
      </nav>

      {s && <p className="text-[0.8rem] text-ink-muted">{s.keeper}. <Link href="/activity" className="underline">Activity</Link></p>}
    </div>
  );
}
