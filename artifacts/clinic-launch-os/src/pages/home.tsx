// Today (docs/ALFRED-DESIGN.md is the reference for every screen). One sentence says how things
// stand; the cards say what needs a decision; then one idea per area, each a plain sentence with the
// picture that proves it; the dates this week; and what ALFRED did. Built from the server's brief.
import { useState } from "react";
import { Link } from "wouter";
import { Copy } from "lucide-react";
import { useBrief, useActivity, dayTime, type BriefItem } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { ProposalCard } from "@/components/proposal-card";
import { BankInput } from "@/components/bank-input";
import { Sources } from "@/components/fresh";
import { Page, Section, Rows, RowItem, AlertCard } from "@/components/page";
import { Insight, Bullet, Funnel, BalanceLine } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { BuildLine } from "@/pages/build";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const gbp = (n: number, dp = 0) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export function BriefItemCard({ item }: { item: BriefItem }) {
  if (item.kind === "proposal") return <ProposalCard p={item.proposal} compact />;
  if (item.kind === "bank") {
    return (
      <article className="rounded-xl border border-card-border bg-card p-4 sm:p-5 grid gap-2.5 min-w-0">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate">Money</span>
        <h3 className="font-sans font-semibold text-[1.06rem] leading-snug text-ink">{item.title}</h3>
        <p className="text-[0.95rem] text-ink-2 leading-relaxed">{item.detail}</p>
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

function AreaInsights({ areas }: { areas: any[] }) {
  const by = Object.fromEntries(areas.map((a) => [a.key, a]));
  const money = by.money, growth = by.growth, patients = by.patients, clinic = by.clinic;
  const src = (a: any) => (a?.sources?.[0]?.text ?? "");
  return (
    <div>
      {money?.extra?.viz?.points?.length > 1 && (() => {
        const v = money.extra.viz;
        const under = v.points.filter((p: any) => p.value < 0);
        const loan = money.extra.availableLoans?.[0];
        return (
          <Insight href="/money" foot={src(money)} sentence={under.length ? `The bank is forecast to go overdrawn in ${under.length} ${under.length === 1 ? "month" : "months"}, first in ${under[0].label}.` : `The bank stays in credit every month of the forecast. The lowest month-end is ${gbp(v.low?.bank ?? 0)}, in ${v.low?.month}.`}>
            <BalanceLine points={v.points} floor={v.floor} compare={v.withLoan && loan ? { points: v.withLoan, label: `if the ${gbp(loan.principal)} loan is drawn now` } : null} ariaLabel="Forecast month-end bank balance, with the £10,000 reference line" />
          </Insight>
        );
      })()}
      {growth?.extra?.viz && (() => {
        const v = growth.extra.viz;
        return v.cpb != null ? (
          <Insight href="/growth" foot={src(growth)} sentence={`Each booked consultation is costing ${gbp(v.cpb, 2)}. Our limit is ${gbp(v.cpbTarget)}.`}>
            <Bullet value={v.cpb} target={v.cpbTarget} status={v.cpb <= v.cpbTarget ? "good" : v.cpb <= v.cpbTarget * 1.5 ? "watch" : "bad"} valueLabel={gbp(v.cpb, 2)} targetLabel={`limit ${gbp(v.cpbTarget)}`} ariaLabel={`Cost per booked consultation ${gbp(v.cpb, 2)} against a limit of ${gbp(v.cpbTarget)}`} />
          </Insight>
        ) : <Insight href="/growth" foot={src(growth)} sentence="No consultations have been booked from the ads yet." />;
      })()}
      {patients?.extra?.viz && (
        <Insight href="/patients" foot={src(patients)} sentence={`${patients.extra.booked} of ${patients.extra.leads} people who asked have booked a consultation.${patients.extra.waiting ? ` ${patients.extra.waiting} have not booked yet.` : ""}`}>
          <Funnel stages={patients.extra.viz.funnel} ariaLabel="From leads to booked consultations to paying patients" />
        </Insight>
      )}
      {clinic?.extra && clinic.extra.fill14 != null && (
        <Insight href="/clinic" foot={src(clinic)} sentence={`The diary is ${Math.round(clinic.extra.fill14 * 100)}% booked over the next 14 days at ${clinic.extra.where}.${clinic.extra.toOpen > 0 ? ` Winchester opens in ${clinic.extra.toOpen} days.` : ""}`}>
          <Bullet value={clinic.extra.fill14 * 100} max={100} status="neutral" valueLabel={`${Math.round(clinic.extra.fill14 * 100)}% booked`} ariaLabel={`Diary ${Math.round(clinic.extra.fill14 * 100)} per cent booked over the next 14 days`} />
        </Insight>
      )}
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading, error, refetch } = useBrief();
  const { data: act } = useActivity();
  const [showAll, setShowAll] = useState(false);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <Page>
        <h1 className="font-sans font-semibold text-[1.75rem] text-ink">Today's brief could not be built</h1>
        <p className="text-ink-2">The server said: {msg}. Every area still opens from the tabs.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => refetch()} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.8rem] font-semibold">Try again</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`ALFRED Today failed: ${msg}`)} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.8rem] font-semibold inline-flex items-center gap-2"><Copy className="w-4 h-4" />Copy for Claude</button>
        </div>
      </Page>
    );
  }

  const items = data?.items ?? [];
  const last = act?.runs?.[0];
  return (
    <Page>
      <header className="grid gap-3">
        <p className="text-[1rem] font-semibold text-ink">{greeting()}, David. <span className="font-normal text-ink-2">{date}.</span></p>
        {isLoading || !data ? <Skeleton className="h-28 w-full rounded-2xl" /> : <div className="rounded-2xl bg-ink px-5 py-5 sm:px-7 sm:py-6"><Verdict state={data.state} text={data.verdict} dark /></div>}
      </header>

      {data?.waiting && (data.waiting.approved + data.waiting.answered + data.waiting.asked) > 0 && (
        <p className="text-[0.95rem] text-ink-2 -mt-3"><Link href="/inbox" className="underline">{[data.waiting.approved ? `${data.waiting.approved} approved ${data.waiting.approved === 1 ? "item" : "items"} waiting to be done at 08:15` : null, data.waiting.answered ? `${data.waiting.answered} ${data.waiting.answered === 1 ? "change" : "changes"} you approved or answered being applied` : null, data.waiting.asked ? `${data.waiting.asked} ${data.waiting.asked === 1 ? "question" : "questions"} ALFRED is working out` : null].filter(Boolean).join("; ")}</Link></p>
      )}

      <Section title={items.length ? `Needs you (${data?.total ?? items.length})` : "Needs you"} id="needs" note={data && data.total > items.length ? <Link href="/inbox" className="underline">see all</Link> : undefined}>
        {isLoading ? <Skeleton className="h-44 rounded-xl" />
          : items.length === 0 ? <p className="text-[1.05rem] text-ink">Nothing needs you.</p>
          : (
            <>
              <div className="grid gap-3 md:grid-cols-2 items-start">
                {items.map((it, i) => <div key={it.id} className={`min-w-0 ${!showAll && i >= 2 ? "hidden md:block" : ""}`}><BriefItemCard item={it} /></div>)}
              </div>
              {!showAll && items.length > 2 && <button type="button" onClick={() => setShowAll(true)} className="md:hidden min-h-[44px] text-slate underline text-[1rem]">{items.length - 2} more</button>}
            </>
          )}
      </Section>

      {data && <Section title="Where things stand" id="stand"><AreaInsights areas={data.areas} /></Section>}

      {data && data.dates.length > 0 && (
        <Section title="This week" id="dates" note={data.dates.length > 5 ? `and ${data.dates.length - 5} more` : undefined}>
          <Rows>
            {data.dates.slice(0, 5).map((d, i) => (
              <RowItem key={i} href={d.href}>
                <span className="w-[6.5rem] shrink-0 text-[0.92rem] text-ink-2">{d.label}</span>
                <span className="min-w-0 text-[1rem] text-ink">{d.what}</span>
              </RowItem>
            ))}
          </Rows>
        </Section>
      )}

      {data && (
        <p className="text-[0.85rem] text-ink-2 leading-relaxed">
          {data.runs.line}{last ? ` Last: ${last.agent} ${RUNWORD[last.status] ?? last.status} ${dayTime(last.started_at ?? last.finished_at)}.` : ""} <Link href="/activity" className="underline">Activity</Link>
          <br /><BuildLine />
        </p>
      )}
    </Page>
  );
}
