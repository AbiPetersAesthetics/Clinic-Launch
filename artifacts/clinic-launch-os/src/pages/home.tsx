// Today: the brief ALFRED opens on (ALFRED-PLAN.md section 2). One verdict sentence; what needs
// David (at most five, the rest in the inbox); one line from each area; the dates this week merged
// from every area; and what ALFRED did. Composed by the server from what the agents wrote.
import { useState } from "react";
import { Link } from "wouter";
import { Copy } from "lucide-react";
import { useBrief, useActivity, dayTime, type BriefItem } from "@/lib/alfred";
import { Verdict, StateWord } from "@/components/verdict";
import { ProposalCard } from "@/components/proposal-card";
import { BankInput } from "@/components/bank-input";
import { Sources } from "@/components/fresh";
import { Page, PageHead, Section, Rows, RowItem, AlertCard } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function BriefItemCard({ item }: { item: BriefItem }) {
  if (item.kind === "proposal") return <ProposalCard p={item.proposal} compact />;
  if (item.kind === "bank") {
    return (
      <article className="rounded-xl border border-card-border bg-card p-4 sm:p-5 grid gap-2.5 min-w-0">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate">Money</span>
        <h3 className="font-display text-[1.12rem] sm:text-[1.2rem] leading-snug text-ink font-medium">{item.title}</h3>
        <p className="text-[0.88rem] text-ink-muted leading-relaxed">{item.detail}</p>
        <Sources chips={item.sources} />
        <BankInput bank={item.bank} fundingOptions={item.fundingOptions} />
      </article>
    );
  }
  if (item.kind === "stale") return <AlertCard area={item.area} level="stale" title={item.title} detail={item.detail} sources={item.sources} href={item.href} />;
  const a = item.alert;
  return <AlertCard area={a.area} level={a.level} title={a.title} detail={a.detail} sources={a.sources} href={a.href} />;
}

const RUNWORD: Record<string, string> = { ok: "ran", partial: "ran in part", failed: "failed", missed: "did not run" };

export default function HomePage() {
  const { data, isLoading, error, refetch } = useBrief();
  const { data: act } = useActivity();
  const [showAll, setShowAll] = useState(false);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <Page>
        <PageHead eyebrow={date} title="Today's brief could not be built" />
        <p className="text-ink-muted">The server said: {msg}. Every area still opens from the tabs.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => refetch()} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Try again</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`ALFRED Today failed: ${msg}`)} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.78rem] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2"><Copy className="w-4 h-4" />Copy for Claude</button>
        </div>
      </Page>
    );
  }

  const items = data?.items ?? [];
  const runs = (act?.runs ?? []).slice(0, 3);
  return (
    <Page>
      <PageHead eyebrow={date} title={`${greeting()}, David.`}>
        {isLoading || !data ? <Skeleton className="h-16 w-full max-w-xl rounded-xl" /> : <Verdict state={data.state} text={data.verdict} />}
      </PageHead>

      <Section title="Needs you" id="needs" note={data && data.total > items.length ? <Link href="/inbox" className="underline">all {data.total}</Link> : undefined}>
        {isLoading ? <Skeleton className="h-44 rounded-xl" />
          : items.length === 0 ? <p className="font-display text-[1.15rem] text-ink">Nothing needs you. {data?.runs.line}</p>
          : (
            <>
              <div className="grid gap-3 md:grid-cols-2 items-start">
                {items.map((it, i) => <div key={it.id} className={`min-w-0 ${!showAll && i >= 2 ? "hidden md:block" : ""}`}><BriefItemCard item={it} /></div>)}
              </div>
              {!showAll && items.length > 2 && <button type="button" onClick={() => setShowAll(true)} className="md:hidden min-h-[44px] text-slate underline text-[0.95rem]">{items.length - 2} more</button>}
            </>
          )}
      </Section>

      {data && (
        <Section title="Each area" id="areas">
          <Rows>
            {data.areas.map((a) => (
              <RowItem key={a.key} href={a.href}>
                <span className="min-w-0 grid gap-1">
                  <span className="flex items-center gap-3"><span className="font-semibold text-ink">{a.title}</span><StateWord state={a.state} /></span>
                  <span className="text-[0.9rem] text-ink leading-relaxed line-clamp-2 sm:line-clamp-none">{a.verdict.replace(/^(On track|Watch|Act|Stale)[.:]\s*/, "")}</span>
                </span>
              </RowItem>
            ))}
          </Rows>
        </Section>
      )}

      {data && (
        <Section title="Dates this week" id="dates" note={data.dates.length > 5 ? `and ${data.dates.length - 5} more` : undefined}>
          {data.dates.length === 0 ? <p className="text-[0.9rem] text-ink-muted">Nothing dated in the next seven days across ads, filming, money, compliance or the opening.</p> : (
            <Rows>
              {data.dates.slice(0, 5).map((d, i) => (
                <RowItem key={i} href={d.href}>
                  <span className="w-[6.5rem] shrink-0 text-[0.85rem] text-ink-muted tabular pt-0.5">{d.label}</span>
                  <span className="min-w-0 text-[0.92rem] text-ink">{d.what}</span>
                </RowItem>
              ))}
            </Rows>
          )}
        </Section>
      )}

      {data && (
        <Section title="What ALFRED did" id="did" note={<Link href="/activity" className="underline">Activity</Link>}>
          <p className="text-[0.92rem] text-ink">{data.runs.line}</p>
          {runs.length > 0 && (
            <ul className="space-y-1.5">
              {runs.map((r) => <li key={r.id} className="text-[0.88rem] text-ink-muted leading-relaxed"><span className="text-ink">{r.agent}</span> {RUNWORD[r.status] ?? r.status} {dayTime(r.started_at ?? r.finished_at)}{r.summary ? `: ${r.summary}` : "."}</li>)}
            </ul>
          )}
        </Section>
      )}
    </Page>
  );
}
