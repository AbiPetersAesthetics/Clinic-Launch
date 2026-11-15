// Money's detail pages: the Build Cash Board (the master record, unchanged), Stands Alone, Takings
// and Obligations. Figures come from the cash model, the clinic refresh and the card register.
import { Link } from "wouter";
import { usePage, useProposals, useSummary, PROJECT_ID, type Chip } from "@/lib/alfred";
import { ProposalCard } from "@/components/proposal-card";
import { BoardShell, EmbeddedBoard } from "@/components/board-shell";
import { Page, PageHead, Section, Rows, RowItem, NotYet, Next, gbp0, longDay } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";

const back = { href: "/money", label: "Money" };
const Loading = () => <Skeleton className="h-40 rounded-xl" />;
const Fig = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="border-t border-line-strong pt-2.5 grid gap-0.5 min-w-0">
    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</span>
    <b className="font-sans tabular text-[1.6rem] sm:text-[2rem] leading-[1.1] font-medium text-ink">{value}</b>
    {sub && <span className="text-[0.78rem] text-ink-muted leading-snug">{sub}</span>}
  </div>
);

export function BuildCashPage() {
  return (
    <Page>
      <PageHead eyebrow="Money" title="Build Cash Board" back={back}>
        <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">The master record: funding, the bank month by month, the card and every build line, built from the plan each time it opens.</p>
      </PageHead>
      <EmbeddedBoard src={`/api/projects/${PROJECT_ID}/boards/build-cash`} title="Winchester Build Cash Board" minHeight={900} />
    </Page>
  );
}

export function StandsAlonePage() {
  const { data } = usePage("stands-alone");
  const rows: any[] = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.margin)));
  return (
    <Page>
      <PageHead eyebrow="Money" title="Stands Alone" back={back}>
        {data && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{data.forecastMet ? `The plan has Winchester standing on its own from ${data.forecastMet}${data.bedhamptonCloses ? `; Bedhampton then closes after ${data.bedhamptonCloses}` : ""}${data.firstPay ? `, and Abi's pay starts in ${data.firstPay}` : ""}.` : "The plan does not yet show Winchester standing on its own within the months it covers."}</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Loading /> : (
        <>
          <p className="text-[0.95rem] text-ink leading-relaxed max-w-[62ch]"><b className="font-semibold">The test.</b> {data.line.definition} That is about {gbp0(data.line.takingsNeeded)} of Winchester takings a month at its share kept. It decides when Bedhampton closes and when Abi's pay starts.</p>
          <Section title="This month">
            <NotYet what={data.thisMonth.reason} />
          </Section>
          <Section title="The plan, month by month" note="Winchester's margin over the line">
            <Rows>
              {rows.map((r) => (
                <li key={r.month} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 py-2 border-b border-border">
                  <span className="text-[0.85rem] text-ink-muted tabular">{r.label}</span>
                  <span className="relative h-3" title={r.why}>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                    <span className={`absolute inset-y-0 ${r.margin >= 0 ? "left-1/2 bg-sage" : "right-1/2 bg-line-strong"}`} style={{ width: `${(50 * Math.abs(r.margin)) / max}%` }} />
                  </span>
                  <span className={`text-right tabular text-[0.88rem] ${r.margin >= 0 ? "text-good" : "text-ink-muted"}`}>{gbp0(r.margin)}</span>
                </li>
              ))}
            </Rows>
            <p className="text-[0.78rem] text-ink-muted">Right of the line: Winchester covers everything and keeps the £3,000. Forecast from the Money Plan's recommended growth; actual months replace it from December.</p>
          </Section>
        </>
      )}
    </Page>
  );
}

export function TakingsPage() {
  const { data } = usePage("takings");
  const rows: any[] = data?.rows ?? [];
  const month = rows.find((r) => /so far/i.test(r.period));
  return (
    <Page>
      <PageHead eyebrow="Money" title="Takings" back={back}>
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
            {rows.slice(0, 4).map((r) => <Fig key={r.period} label={r.period} value={gbp0(r.total)} sub={`${gbp0(r.treatments)} treatments, ${gbp0(r.retail)} skincare${r.booked ? `; plus ${gbp0(r.booked)} booked to ${r.bookedTo}` : ""}`} />)}
          </div>
          {data.planThisMonth && month && (
            <Section title={`Against the Money Plan for ${data.planThisMonth.label}`}>
              <p className="text-[0.95rem] text-ink leading-relaxed max-w-[62ch]">Taken so far {gbp0(month.total)}{month.booked ? `, with ${gbp0(month.booked)} booked for the rest of the month` : ""}, against the plan's {gbp0(data.planThisMonth.total)} for the month ({gbp0(data.planThisMonth.bedhampton)} Bedhampton, {gbp0(data.planThisMonth.winchester)} Winchester), all with VAT.</p>
            </Section>
          )}
          <Section title="By week">
            {data.weeks.length > 1 ? (
              <Rows>{data.weeks.map((w: any) => <RowItem key={w.period}><span className="flex-1 text-[0.9rem]">{w.period}</span><span className="tabular font-medium">{gbp0(w.total)}</span></RowItem>)}</Rows>
            ) : <NotYet what="A week by week record builds up from the daily clinic refresh; each week's final figure is kept as the next week starts." by="the clinic refresh, daily at about 07:40" />}
          </Section>
          <p className="text-[0.78rem] text-ink-muted max-w-[62ch]">{data.source} {data.note}</p>
        </>
      )}
    </Page>
  );
}

export function ObligationsPage() {
  const { data } = usePage("obligations");
  const { data: props } = useProposals();
  const { data: money } = useSummary("money");
  const waiting = (props?.open ?? []).filter((p) => p.area === "money");
  return (
    <Page>
      <PageHead eyebrow="Money" title="Obligations" back={back}>
        <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">Everything the business owes or must file, in date order: VAT, the cards and their 0% offers, the loans and the directors' loan.</p>
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Loading /> : (
        <>
          {waiting.length > 0 && (
            <Section title={`Waiting for your yes (${waiting.length})`}>
              <div className="grid gap-3 md:grid-cols-2">{waiting.map((p) => <ProposalCard key={p.id} p={p} compact />)}</div>
            </Section>
          )}
          {((money?.extra?.expected ?? []).length > 0 || (money?.extra?.availableLoans ?? []).length > 0) && (
            <Section title="Money expected in">
              <ul className="border-t border-border">
                {(money?.extra?.expected ?? []).map((e: any) => <li key={e.label} className="flex justify-between gap-3 py-2.5 border-b border-border"><span><span className="block text-ink">{e.label}</span><span className="block text-[0.82rem] text-ink-2">expected, not yet in the bank; counted in the forecast from {e.month}</span></span><span className="tabular font-medium">{gbp0(e.amount)}</span></li>)}
                {(money?.extra?.availableLoans ?? []).map((l: any) => <li key={l.label} className="flex justify-between gap-3 py-2.5 border-b border-border"><span><span className="block text-ink">{l.label}</span><span className="block text-[0.82rem] text-ink-2">available to draw when you choose; not in the forecast</span></span><span className="tabular font-medium">{gbp0(l.principal)}</span></li>)}
              </ul>
            </Section>
          )}
          <Section title="In date order">
            {data.dated.length ? <Rows>{data.dated.map((d: any, i: number) => (
              <RowItem key={i} href={d.href}><span className="w-[6.5rem] shrink-0 text-[0.85rem] text-ink-muted tabular pt-0.5">{longDay(d.date)}</span><span className="min-w-0"><span className="block text-[0.92rem] text-ink">{d.what}</span><span className="block text-[0.8rem] text-ink-muted">{d.note}</span></span></RowItem>
            ))}</Rows> : <p className="text-ink-muted">Nothing dated ahead.</p>}
          </Section>
          <Section title="Cards" note={<Link href="/archive/cards" className="underline">register</Link>}>
            <Rows>{data.cards.filter((c: any) => c.limit > 0 || c.balance).map((c: any) => (
              <RowItem key={c.name}><span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{c.name}</span><span className="block text-[0.8rem] text-ink-muted">{c.limit ? `${Math.round((100 * c.balance) / c.limit)} in every 100 of the ${gbp0(c.limit)} limit used` : "no credit limit: a personal account"}{c.offers.length ? `; ${c.offers.map((o: any) => `${o.ratePct}% ${o.kind} to ${longDay(o.end)}`).join(", ")}` : ""}</span></span><span className="tabular font-medium">{gbp0(c.balance)}</span></RowItem>
            ))}</Rows>
          </Section>
          <Section title="Directors' loan" note={<Link href="/archive/owed" className="underline">detail</Link>}>
            {data.directorsLoan.length ? <Rows>{data.directorsLoan.map((d: any) => <RowItem key={d.holder}><span className="flex-1"><span className="block text-ink">{d.holder}</span><span className="block text-[0.8rem] text-ink-muted">{d.entries} items not yet paid back</span></span><span className="tabular font-medium">{gbp0(d.owed)}</span></RowItem>)}</Rows> : <p className="text-ink-muted">Nothing owed to the directors.</p>}
          </Section>
          <Section title="Loans">
            {data.loans.length ? <Rows>{data.loans.map((l: any) => <RowItem key={l.label}><span className="flex-1"><span className="block text-ink">{l.label}</span><span className="block text-[0.8rem] text-ink-muted">{gbp0(l.principal)} at {l.ratePct}%, {l.repayments} repayments{l.holidayMonths ? ` after ${l.holidayMonths} months' holiday` : ""}{l.nextMonth ? `; next ${gbp0(l.nextAmount)} in ${l.nextMonth}` : ""}</span></span></RowItem>)}</Rows> : <p className="text-ink-muted">No loans in the plan.</p>}
          </Section>
          <Section title="VAT returns, monthly" note={data.vatConfirmed ? `dates confirmed by you, ${data.vatConfirmed.on}` : "dates assumed"}>
            <Rows>{data.vat.map((v: any) => <RowItem key={v.month}><span className="flex-1"><span className="block text-ink">{v.period}: due {longDay(v.due)}</span><span className="block text-[0.8rem] text-ink-muted">The plan: VAT on sales {gbp0(v.vatOnSales)}, build VAT reclaimed {gbp0(v.vatOnBuild)}{v.refundNextMonth ? `, refund of ${gbp0(v.refundNextMonth)} the month after` : ""}. The amounts are the plan's estimates, not the return.</span></span></RowItem>)}</Rows>
          </Section>
          <Next>The money watch (daily 07:50) turns anything due in the next 14 days into a card on Today.</Next>
        </>
      )}
    </Page>
  );
}

export { BoardShell };
