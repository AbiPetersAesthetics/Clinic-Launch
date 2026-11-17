// Abi's screen (/abi): one phone screen for the nurse prescriber. Today and tomorrow in the diary
// (counts and times only; patient detail stays in ANS), decisions she and David make together, what
// to film this week with the script, reviews to ask for, and stock to tick. No money, no ads.
import { usePage, useProposals, type Chip } from "@/lib/alfred";
import { ProposalCard } from "@/components/proposal-card";
import { Page, PageHead, Section, Rows, NotYet, Fold, longDay } from "@/components/page";
import { Sources } from "@/components/fresh";
import { StockList } from "@/pages/clinic/pages";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptView } from "@/components/script-view";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PROJECT_ID } from "@/lib/alfred";

// The way into Ready for Winchester: days to go, done so far, and the next three things due.
function ReadyCard() {
  const { data } = useQuery({ queryKey: ["alfred", "readiness"], queryFn: async () => { const r = await fetch(`/api/projects/${PROJECT_ID}/readiness`, { cache: "no-store" }); if (!r.ok) throw new Error("Could not load"); return r.json(); } });
  if (!data || data.daysToOpening < 0) return null;
  const next = (data.thisWeek as number[]).map((id) => data.items.find((i: any) => i.id === id)).filter((i: any) => i && i.owner !== "David").slice(0, 3);
  const pct = data.counts.total ? Math.round((100 * data.counts.done) / data.counts.total) : 0;
  return (
    <Link href="/abi/ready" className="block rounded-xl border border-ink p-4 grid gap-3 no-underline">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Ready for Winchester</span>
      <b className="font-sans text-[1.25rem] leading-snug font-medium text-ink">{data.daysToFirstPatients > 0 ? `${data.daysToFirstPatients} days to the first patients` : `${data.daysToOpening} days to opening`}, {data.counts.done} of {data.counts.total} done</b>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-ink rounded-full" style={{ width: `${pct}%` }} /></div>
      {next.length > 0 && <ul className="grid gap-1 text-[0.9rem] text-ink list-disc pl-5">{next.map((i: any) => <li key={i.id}>{i.title}</li>)}</ul>}
      <span className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink">Open the list ›</span>
    </Link>
  );
}

function Day({ label, d }: { label: string; d: any }) {
  return (
    <div className="border-t border-line-strong pt-2.5 grid gap-0.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      <b className="font-sans tabular text-[1.6rem] leading-[1.1] font-medium text-ink">{d.blocked ? "Blocked out" : d.appts ? `${d.appts} ${d.appts === 1 ? "appointment" : "appointments"}` : "No clinic"}</b>
      <span className="text-[0.8rem] text-ink-muted">{d.appts && !d.blocked ? `${d.clinic}, ${d.first} to ${d.last}${d.consults ? `; ${d.consults} consultation${d.consults === 1 ? "" : "s"}` : ""}` : d.clinic ?? ""}</span>
    </div>
  );
}

export default function AbiPage() {
  const { data } = usePage("abi");
  const { data: props } = useProposals();
  const joint = (props?.open ?? []).filter((p) => (p.decide_with ?? "").includes("Abi"));
  const greet = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date())) < 12 ? "Good morning" : "Hello";
  return (
    <Page>
      <PageHead eyebrow="For Abi" title={`${greet}, Abi.`}>
        {data && <p className="font-sans font-semibold text-[1.3rem] leading-snug text-ink max-w-[46ch]">{[data.film.length ? `${data.film.length} ${data.film.length === 1 ? "clip" : "clips"} to film this week` : null, joint.length ? `${joint.length} ${joint.length === 1 ? "decision" : "decisions"} to make with David` : null, data.stock.length ? `${data.stock.length} stock ${data.stock.length === 1 ? "item" : "items"} low` : null].filter(Boolean).join(", ") || "Nothing to do here today"}.</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <ReadyCard />
          <div className="grid grid-cols-2 gap-x-5 mt-6"><Day label="Today" d={data.today} /><Day label="Tomorrow" d={data.tomorrow} /></div>
          <Section title="Film this week">
            {data.film.length ? <><Rows>{data.film.slice(0, 3).map((v: any) => (
              <li key={v.id} className="py-3 border-b border-border grid gap-1">
                <div className="flex justify-between gap-3"><span className="font-semibold text-ink">{v.title}</span><span className="text-[0.8rem] text-ink-muted">by {longDay(v.filmBy)}</span></div>
                <p className="text-[0.9rem] text-ink">"{v.hook}"</p>
                <ScriptView script={v.script} scriptRef={v.scriptRef} />
              </li>
            ))}</Rows>
            {data.film.length > 3 && <Fold label={`Show the other ${data.film.length - 3}`}><Rows>{data.film.slice(3).map((v: any) => (
              <li key={v.id} className="py-3 border-b border-border grid gap-1">
                <div className="flex justify-between gap-3"><span className="font-semibold text-ink">{v.title}</span><span className="text-[0.8rem] text-ink-muted">by {longDay(v.filmBy)}</span></div>
                <p className="text-[0.9rem] text-ink">"{v.hook}"</p>
                <ScriptView script={v.script} scriptRef={v.scriptRef} />
              </li>
            ))}</Rows></Fold>}</> : <p className="text-[0.9rem] text-ink-muted">Nothing to film this week.</p>}
          </Section>
          {joint.length > 0 && <Section title="To decide with David"><div className="grid gap-3">{joint.map((p) => <ProposalCard key={p.id} p={p} compact />)}</div></Section>}
          <Section title="Reviews to ask for"><NotYet what={data.reviewsNote} /></Section>
          <Section title="Stock that is low"><StockList compact /></Section>
        </>
      )}
    </Page>
  );
}
