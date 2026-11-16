// Patients: Pathway, Due back and Reviews. Patients appear as first name and initial at most;
// everything clinical stays in ANS. Who has not booked yet is listed on Pathway; when a follow-up is
// worth sending, the pathway check raises one approval card and the messages go through GHL in a
// live session after a yes. Nothing is ever sent unattended.
import { usePage, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, NotYet, Next } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Funnel } from "@/components/charts";
import { Ring, HBars, Pill, V } from "@/components/viz";
import { Skeleton } from "@/components/ui/skeleton";

const back = { href: "/patients", label: "Patients" };
const STATUS: Record<string, string> = { booked: "Booked", open: "Not booked", existing: "Existing patient" };

export function PathwayPage() {
  const { data } = usePage("pathway");
  const leads: any[] = data?.leads ?? [];
  const waiting: any[] = data?.waiting ?? [];
  const booked = leads.filter((l) => l.status === "booked").length;
  const first = leads.map((l) => l.apptIso).filter(Boolean).sort()[0];
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Pathway" back={back}>
        {data && <p className="font-sans font-semibold text-[1.3rem] sm:text-[1.5rem] leading-snug text-ink max-w-[34ch] sm:max-w-[46ch]">{booked} of {leads.length} people who asked since {data.windowFrom} have booked a consultation.{waiting.length ? ` ${waiting.length} have not booked yet.` : ""}</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <Section title="From asking to paying">
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
              {leads.length > 0 && <Ring value={booked / leads.length} label="Leads that booked" sub={`${booked} of ${leads.length} since ${data.windowFrom}`} tone="good" />}
              <Funnel stages={[{ label: "Leads", value: leads.length }, { label: "Booked", value: booked }, { label: "Seen", value: null, note: first ? `from ${new Date(first).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "from the first consultation" }, { label: "Paying", value: null, note: "30 days after each consultation" }]} ariaLabel="From leads to booked consultations to paying patients" />
            </div>
          </Section>

          <Section title={`Not booked yet (${waiting.length})`}>
            {waiting.length ? (
              <HBars ariaLabel="How long each person has been waiting" max={Math.max(3, ...waiting.map((w) => w.days))} labelWidth="10.5rem"
                rows={waiting.map((w) => ({ label: w.name, note: `${w.kind === "lead" ? "sent the form" : "had a consultation"}, ${w.ad} ad`, value: Math.max(0.15, w.days), display: w.days < 1 ? "today" : `${w.days} ${w.days === 1 ? "day" : "days"}`, color: w.days >= 3 ? V.act : w.days >= 2 ? V.watch : V.slate }))} />
            ) : <p className="text-ink-2">Everyone who asked has booked.</p>}
            <p className="text-[0.88rem] text-ink-2 max-w-[60ch]">When a follow-up is worth sending, the pathway check raises one card on Today with the message shown. On your yes it is sent from the clinic number through GHL in the next live session.</p>
          </Section>

          <Section title="Every lead" note="newest first">
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[520px] text-[0.92rem]">
                <thead><tr className="text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-2 border-b border-line-strong">
                  <th className="py-2 pr-3 sticky left-0 bg-card">Lead</th><th className="py-2 pr-3">Ad</th><th className="py-2 pr-3">Form</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Consultation</th><th className="py-2">Matched on</th>
                </tr></thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-2.5 pr-3 font-semibold text-ink sticky left-0 bg-card">{l.name}</td>
                      <td className="py-2.5 pr-3 text-ink-2">{l.ad}</td>
                      <td className="py-2.5 pr-3 text-ink-2 tabular whitespace-nowrap">{l.formSent}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap"><Pill tone={l.status === "booked" ? "good" : l.status === "existing" ? "muted" : "watch"}>{STATUS[l.status] ?? l.status}</Pill></td>
                      <td className="py-2.5 pr-3 text-ink-2 whitespace-nowrap">{l.appt ?? ""}</td>
                      <td className="py-2.5 text-ink-2">{l.match ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {data.other.length > 0 && <Section title="Booked outside the lead forms, not counted"><ul className="space-y-2">{data.other.map((o: string, i: number) => <li key={i} className="text-[0.95rem] text-ink-2 leading-relaxed">{o}</li>)}</ul></Section>}
          {data.checks && <Section title="Accuracy checks"><ul className="space-y-1.5 text-[0.95rem] text-ink leading-relaxed">{[data.checks.metaLeadsVsGhl, data.checks.bookingsTriple, data.checks.openLeads].filter(Boolean).map((c: string, i: number) => <li key={i}>{c}</li>)}{(data.checks.uncertain ?? []).map((u: string, i: number) => <li key={`u${i}`} className="text-watch">Needs checking: {u}</li>)}</ul></Section>}
        </>
      )}
    </Page>
  );
}

export function DueBackPage() {
  return (
    <Page>
      <PageHead eyebrow="Patients" title="Due back" back={back} />
      <NotYet what="Patients whose course or review is due, as counts and first name with initial, read from ANS. When some are due, ALFRED raises one card to send them a reminder through GHL after your yes." when="8 December, when Winchester starts seeing patients" by="the clinic refresh, daily at about 07:40" />
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
        <Section title="Our Google profiles"><HBars ariaLabel="Reviews on each of our Google profiles" labelWidth="11rem" rows={mine.map((p: any) => ({ label: p.name, value: p.reviews, display: `${p.reviews} reviews, ${p.rating} stars` }))} /></Section>
      ) : <NotYet what="Reviews received on both Google profiles, with the count and rating against named competitors." by="the Search and reviews run, Tuesdays 08:30" />}
      <Section title="Asking for reviews">
        <NotYet what="From opening, patients who have had a treatment and not yet been asked. When some are due, ALFRED raises one card to send the review request through GHL after your yes." when="8 December" by="the clinic refresh" />
      </Section>
      <Next>Review replies are drafted by the Search and reviews run and posted only after your yes.</Next>
    </Page>
  );
}
