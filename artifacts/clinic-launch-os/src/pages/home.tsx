// Today: the brief ALFRED opens on (UX plan 2.1 and wireframes 5.1 and 5.2). One verdict, the few
// things that need David, four vital signs and the runs of the last 24 hours. Composed by the
// server from what the agents wrote (GET /brief); every figure carries its source and age.
import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Copy } from "lucide-react";
import { useBrief, type BriefItem } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { ProposalCard } from "@/components/proposal-card";
import { BankInput } from "@/components/bank-input";
import { Fresh } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const AREA: Record<string, string> = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth" };

export function BriefItemCard({ item }: { item: BriefItem }) {
  if (item.kind === "proposal") return <ProposalCard p={item.proposal} compact />;
  if (item.kind === "bank") {
    return (
      <article className="rounded-xl border border-card-border bg-card p-4 sm:p-5 grid gap-3">
        <span className="eyebrow">Money</span>
        <h3 className="font-display text-[1.15rem] leading-snug text-ink">{item.title}</h3>
        <p className="text-[0.9rem] text-ink-muted leading-relaxed">{item.detail}</p>
        <div className="flex flex-wrap gap-1.5">{item.sources.map((c) => <Fresh key={c.source} chip={c} />)}</div>
        <BankInput bank={item.bank} fundingOptions={item.fundingOptions} />
      </article>
    );
  }
  const a = item.kind === "alert" ? item.alert : null;
  const s = item.kind === "stale" ? item : null;
  const title = a?.title ?? s?.title ?? "";
  const detail = a?.detail ?? s?.detail ?? "";
  const href = a?.href ?? s?.href;
  const sources = a?.sources ?? s?.sources ?? [];
  const area = a?.area ?? s?.area ?? "";
  const level = a ? a.level : "stale";
  return (
    <article className={`rounded-xl border p-4 sm:p-5 grid gap-2.5 ${level === "act" ? "border-act/40 bg-act-bg" : "border-card-border bg-card"}`}>
      <div className="flex items-center gap-2">
        <span className="eyebrow">{AREA[area] ?? area}</span>
        <span className={`text-[0.7rem] rounded-full px-2 py-0.5 ${level === "act" ? "bg-act text-white" : level === "stale" ? "border border-ink-muted text-ink-muted" : "bg-watch-bg text-watch"}`}>{level === "act" ? "Act" : level === "stale" ? "Stale" : "Watch"}</span>
      </div>
      <h3 className="font-display text-[1.15rem] leading-snug text-ink">{title}</h3>
      {detail && <p className="text-[0.9rem] text-ink leading-relaxed">{detail}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {sources.map((c) => <Fresh key={c.source} chip={c} />)}
        {href && <Link href={href} className="ml-auto inline-flex items-center min-h-[44px] px-4 rounded-full border border-ink text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:bg-wash">Open<ChevronRight className="w-4 h-4 ml-1" /></Link>}
      </div>
    </article>
  );
}

export default function HomePage() {
  const { data, isLoading, error, refetch } = useBrief();
  const [showAll, setShowAll] = useState(false);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="space-y-4 max-w-2xl">
        <span className="eyebrow">{date}</span>
        <h1 className="font-display text-[1.9rem]">Today's brief could not be built</h1>
        <p className="text-ink-muted">The server said: {msg}. The boards still open from the menu.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => refetch()} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Try again</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`ALFRED Today failed: ${msg}`)} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.78rem] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2"><Copy className="w-4 h-4" />Copy for Claude</button>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  return (
    <div className="space-y-8 sm:space-y-10 max-w-5xl">
      <header className="space-y-3">
        <span className="eyebrow">{date}</span>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">{greeting()}, David.</h1>
        {isLoading || !data ? <Skeleton className="h-7 w-full max-w-xl rounded-xl" /> : <Verdict state={data.state} text={data.verdict} />}
      </header>

      <section className="space-y-3" aria-labelledby="needs">
        <h2 id="needs" className="eyebrow">Needs you</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl hidden md:block" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-sage-whisper p-5"><p className="font-display text-[1.15rem] text-ink">Nothing needs you.</p><p className="text-ink-muted text-[0.9rem] mt-1">{data?.runs.line}</p></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 items-start">
              {/* On a phone the first two items show; the rest are one tap away. */}
              {items.map((it, i) => <div key={it.id} className={!showAll && i >= 2 ? "hidden md:block" : ""}><BriefItemCard item={it} /></div>)}
            </div>
            {!showAll && items.length > 2 && (
              <button type="button" onClick={() => setShowAll(true)} className="md:hidden min-h-[44px] text-slate underline text-[0.95rem]">{items.length - 2} more</button>
            )}
            {(data?.more ?? 0) > 0 && <Link href="/inbox" className="inline-flex min-h-[44px] items-center text-slate underline text-[0.95rem]">{data!.more} more in the inbox</Link>}
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="vitals">
        <h2 id="vitals" className="eyebrow">Vital signs</h2>
        {isLoading || !data ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div> : <KpiGrid kpis={data.vitals} max={4} />}
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label="Areas">
          {[["Money", "/money"], ["Growth", "/growth"], ["Clinic", "/clinic"]].map(([l, h]) => (
            <Link key={h} href={h} className="inline-flex items-center min-h-[44px] text-ink font-semibold hover:text-slate">{l}<ChevronRight className="w-4 h-4" /></Link>
          ))}
        </nav>
      </section>

      {data && (
        <Link href="/activity" className="flex items-center gap-1 min-h-[44px] text-[0.9rem] text-ink-muted hover:text-ink">
          {data.runs.line}<ChevronRight className="w-4 h-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}
