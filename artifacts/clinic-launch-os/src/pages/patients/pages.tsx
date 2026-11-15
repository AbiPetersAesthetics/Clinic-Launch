// Patients: Pathway, Follow up, Due back and Reviews. Patients appear as first name and initial at
// most; everything clinical stays in ANS. ALFRED never messages anyone: it drafts, Abi sends.
import { useState } from "react";
import { usePage, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, Rows, NotYet, Next } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";

const back = { href: "/patients", label: "Patients" };
const STATUS: Record<string, string> = { booked: "Booked", open: "Open", existing: "Existing patient" };

export function PathwayPage() {
  const { data } = usePage("pathway");
  const leads: any[] = data?.leads ?? [];
  const booked = leads.filter((l) => l.status === "booked").length;
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Pathway" back={back}>
        {data && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{leads.length} leads since {data.windowFrom}; {booked} booked a consultation. Each is followed to the diary, then to attended, paying and returning.</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <Section title="Every lead" note="newest first">
            <Rows>
              {leads.map((l, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 border-b border-border">
                  <span className="min-w-0"><span className="block font-semibold text-ink">{l.name}</span><span className="block text-[0.8rem] text-ink-muted">{l.ad}, form {l.formSent}{l.match ? `; matched on ${l.match}` : ""}</span></span>
                  <span className="text-right"><span className={`block text-[0.88rem] ${l.status === "booked" ? "text-good" : "text-ink"}`}>{STATUS[l.status] ?? l.status}</span><span className="block text-[0.78rem] text-ink-muted">{l.appt ? `consultation ${l.appt}` : l.statusText ?? ""}{l.treated === true ? ", paying" : ""}</span></span>
                </li>
              ))}
            </Rows>
          </Section>
          {data.other.length > 0 && <Section title="Booked outside the lead forms, not counted"><ul className="space-y-2">{data.other.map((o: string, i: number) => <li key={i} className="text-[0.88rem] text-ink-muted leading-relaxed">{o}</li>)}</ul></Section>}
          {data.checks && <Section title="Accuracy checks"><ul className="space-y-1.5 text-[0.88rem] text-ink leading-relaxed">{[data.checks.metaLeadsVsGhl, data.checks.bookingsTriple, data.checks.openLeads].filter(Boolean).map((c: string, i: number) => <li key={i}>{c}</li>)}{(data.checks.uncertain ?? []).map((u: string, i: number) => <li key={`u${i}`} className="text-watch">Needs checking: {u}</li>)}</ul></Section>}
        </>
      )}
    </Page>
  );
}

function Draft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <p className="text-[0.9rem] text-ink leading-relaxed bg-wash rounded-xl p-3">{text}</p>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="justify-self-start min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink">{copied ? "Copied" : "Copy message"}</button>
    </div>
  );
}

export function FollowUpPage() {
  const { data } = usePage("follow-up");
  const items: any[] = data?.items ?? [];
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Follow up" back={back}>
        {data && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{items.length ? `${items.length} ${items.length === 1 ? "person has" : "people have"} not booked yet. A personal message is drafted for each; Abi sends it herself, from her own phone.` : "Everyone who sent a form has booked. Nobody to follow up."}</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <Rows>
          {items.map((it, i) => (
            <li key={i} className="py-4 border-b border-border grid gap-2">
              <div className="flex items-baseline justify-between gap-3"><span className="font-semibold text-ink">{it.name}</span><span className="text-[0.8rem] text-ink-muted">{it.days} {it.days === 1 ? "day" : "days"}</span></div>
              <p className="text-[0.85rem] text-ink-muted">{it.why} From the {it.ad} ad.</p>
              <Draft text={it.draft} />
            </li>
          ))}
        </Rows>
      )}
      <Next>ALFRED never sends these. Consultations that do not become treatments join this list from the first Winchester consultations.</Next>
    </Page>
  );
}

export function DueBackPage() {
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Due back" back={back} />
      <NotYet what="Patients whose course or review is due, as counts and first name with initial, read from ANS. This is the biggest lever on return visits." when="8 December, when Winchester starts seeing patients" by="the clinic refresh, daily at about 07:40" />
    </Page>
  );
}

export function ReviewsPage() {
  const { data } = usePage("search");
  const mine = (data?.reviews?.profiles ?? []).filter((p: any) => p.ours);
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Reviews" back={back}>{data?.reviews && <Sources chips={data.sources as Chip[]} />}</PageHead>
      {mine.length ? (
        <Section title="Our Google profiles"><Rows>{mine.map((p: any) => <li key={p.name} className="flex justify-between py-3 border-b border-border"><span>{p.name}</span><span className="tabular">{p.reviews} reviews, {p.rating} stars</span></li>)}</Rows></Section>
      ) : <NotYet what="Reviews received on both Google profiles, with the count and rating against named competitors." by="the Search and reviews run, Tuesdays 08:30" />}
      <Section title="Asked against received">
        <NotYet what="Who was asked for a review after a treatment, who left one, and the next patients to ask, as first name and initial." when="8 December" by="the clinic refresh" />
      </Section>
      <p className="text-[0.82rem] text-ink-muted">Review replies are drafted by the Search and reviews run and posted only after your yes.</p>
    </Page>
  );
}
