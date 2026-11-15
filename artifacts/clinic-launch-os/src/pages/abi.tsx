// Abi's screen (/abi): one phone screen for the nurse prescriber. Today and tomorrow in the diary
// (counts and times only; patient detail stays in ANS), what to film this week with the script,
// messages drafted for her to send herself, reviews to ask for, and stock to tick. No money, no ads.
import { useState } from "react";
import { usePage, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, Rows, NotYet, longDay } from "@/components/page";
import { Sources } from "@/components/fresh";
import { StockList } from "@/pages/clinic/pages";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [copied, setCopied] = useState<number | null>(null);
  const greet = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date())) < 12 ? "Good morning" : "Hello";
  return (
    <Page>
      <PageHead eyebrow="For Abi" title={`${greet}, Abi.`}>
        {data && <p className="font-display text-[1.3rem] leading-[1.35] text-ink max-w-[46ch]">{[data.film.length ? `${data.film.length} ${data.film.length === 1 ? "clip" : "clips"} to film this week` : null, data.messages.length ? `${data.messages.length} ${data.messages.length === 1 ? "message" : "messages"} to send` : null, data.stock.length ? `${data.stock.length} stock ${data.stock.length === 1 ? "item" : "items"} low` : null].filter(Boolean).join(", ") || "Nothing to do here today"}.</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-2 gap-x-5"><Day label="Today" d={data.today} /><Day label="Tomorrow" d={data.tomorrow} /></div>
          <Section title="Film this week">
            {data.film.length ? <Rows>{data.film.map((v: any) => (
              <li key={v.id} className="py-3 border-b border-border grid gap-1">
                <div className="flex justify-between gap-3"><span className="font-semibold text-ink">{v.title}</span><span className="text-[0.8rem] text-ink-muted">by {longDay(v.filmBy)}</span></div>
                <p className="text-[0.9rem] text-ink">"{v.hook}"</p>
                {v.scriptRef && <a href={v.scriptRef} target="_blank" rel="noreferrer" className="text-[0.85rem] text-slate underline min-h-[32px] inline-flex items-center">Open the script</a>}
              </li>
            ))}</Rows> : <p className="text-[0.9rem] text-ink-muted">Nothing to film this week.</p>}
          </Section>
          <Section title="Messages to send">
            {data.messages.length ? <Rows>{data.messages.map((m: any, i: number) => (
              <li key={i} className="py-3 border-b border-border grid gap-2">
                <span className="font-semibold text-ink">{m.name}</span>
                <p className="text-[0.88rem] text-ink bg-wash rounded-xl p-3 leading-relaxed">{m.draft}</p>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.draft); setCopied(i); }} className="justify-self-start min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em]">{copied === i ? "Copied" : "Copy message"}</button>
              </li>
            ))}</Rows> : <p className="text-[0.9rem] text-ink-muted">No one to message.</p>}
          </Section>
          <Section title="Reviews to ask for"><NotYet what={data.reviewsNote} /></Section>
          <Section title="Stock that is low"><StockList compact /></Section>
        </>
      )}
    </Page>
  );
}
