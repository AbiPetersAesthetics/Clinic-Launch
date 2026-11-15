// An area overview (Money, Growth, Clinic): the verdict, the KPIs with their sources, the area's
// alerts and open proposals, then links into every page of the area. The shared board pattern
// (UX plan 2.4): verdict, KPIs, then detail.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useProposals, useSummary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { ProposalCard } from "@/components/proposal-card";
import { BriefItemCard } from "@/pages/home";
import { Skeleton } from "@/components/ui/skeleton";

export interface AreaLink { href: string; label: string; note: string; wip?: boolean }

const AREA_OF: Record<string, string[]> = { money: ["money"], ads: ["ads", "growth", "content"], clinic: ["clinic"] };

export function LinkList({ links }: { links: AreaLink[] }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-card-border overflow-hidden">
      {links.map((l) => (
        <li key={l.href}>
          {l.wip ? (
            <div aria-disabled="true" className="flex items-center gap-3 px-4 min-h-[56px] py-2 text-ink-muted/60 cursor-not-allowed">
              <span className="flex-1 min-w-0"><span className="block font-semibold">{l.label}</span><span className="block text-[0.8rem]">{l.note}</span></span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border border-border">Work in progress</span>
            </div>
          ) : (
            <Link href={l.href} className="flex items-center gap-3 px-4 min-h-[56px] py-2 hover:bg-wash">
              <span className="flex-1 min-w-0"><span className="block font-semibold text-ink">{l.label}</span><span className="block text-[0.8rem] text-ink-muted">{l.note}</span></span>
              <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AreaOverview({ board, eyebrow, title, links, children }: { board: string; eyebrow: string; title: string; links: AreaLink[]; children?: ReactNode }) {
  const { data, isLoading, error } = useSummary(board);
  const { data: props } = useProposals();
  const mine = (props?.open ?? []).filter((p) => (AREA_OF[board] ?? [board]).includes(p.area));
  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-3">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">{title}</h1>
        {error ? <p className="text-act">The summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !data ? <Skeleton className="h-7 w-full max-w-xl rounded-xl" />
          : <Verdict state={data.state} text={data.verdict} sources={data.sources} />}
      </header>
      {data && data.kpis.length > 0 && <KpiGrid kpis={data.kpis} />}
      {(mine.length > 0 || (data?.alerts.length ?? 0) > 0) && (
        <section className="space-y-3">
          <h2 className="eyebrow">Needs you</h2>
          <div className="grid gap-4 md:grid-cols-2 items-start">
            {mine.map((p) => <ProposalCard key={p.id} p={p} compact />)}
            {data?.state !== "stale" && data?.alerts.map((a) => <BriefItemCard key={a.id} item={{ kind: "alert", id: a.id, alert: a }} />)}
          </div>
        </section>
      )}
      {children}
      <section className="space-y-3">
        <h2 className="eyebrow">Everything in {title}</h2>
        <LinkList links={links} />
      </section>
      {data && <p className="text-[0.8rem] text-ink-muted">{data.keeper}.</p>}
    </div>
  );
}
