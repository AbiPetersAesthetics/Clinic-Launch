// Money's detail pages: the Build Cash Board (the master record, unchanged), Stands Alone, Takings
// and Obligations. Figures come from the cash model, the clinic refresh and the card register.
import { Link } from "wouter";
import { usePage, useProposals, useSummary, useCashModel, PROJECT_ID, type Chip } from "@/lib/alfred";
import { Stat, TargetBar, SplitBar, StackColumns, MarginColumns, HBars, DateRail, UsageBar, V } from "@/components/viz";
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
          <Section title="Winchester against the line, month by month" note="the plan">
            <MarginColumns lineLabel="stands alone above this line" rows={rows.map((r) => ({ label: r.label, value: r.margin, title: `${r.label}: ${r.why}` }))}
              marks={[{ index: rows.findIndex((r) => r.label === data.firstPay), label: "Abi's pay starts" }]}
              ariaLabel={`Winchester's margin over standing alone each month. ${rows.map((r) => `${r.label}: ${gbp0(r.margin)}`).join("; ")}`} />
            <details className="group">
              <summary className="cursor-pointer text-[0.88rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">Every month as figures</summary>
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
            </details>
            <p className="text-[0.78rem] text-ink-muted">Above the line: Winchester covers everything and keeps the £3,000. Forecast from the Money Plan's recommended growth; actual months replace it from December.</p>
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
  const { data: cm } = useCashModel();
  const plan: any[] = (cm?.rows ?? []).slice(0, 12);
  const opens = plan.findIndex((r) => r.winc?.gross > 0);
  return (
    <Page>
      <PageHead eyebrow="Money" title="Takings" back={back}>
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {rows.slice(0, 4).map((r) => <Stat key={r.period} label={r.period} value={gbp0(r.total)} sub={`${gbp0(r.treatments)} treatments, ${gbp0(r.retail)} skincare${r.booked ? `; plus ${gbp0(r.booked)} booked to ${r.bookedTo}` : ""}`} />)}
          </div>
          {data.planThisMonth && month && (
            <Section title={`Against the Money Plan for ${data.planThisMonth.label}`}>
              <TargetBar segments={[{ label: "Taken so far", value: month.total, color: V.ink }, ...(month.booked ? [{ label: `Booked to ${month.bookedTo}`, value: month.booked, color: V.sageDeep }] : [])]} target={data.planThisMonth.total} targetLabel={`the plan ${gbp0(data.planThisMonth.total)}`}
                ariaLabel={`Taken so far ${gbp0(month.total)}${month.booked ? `, booked ${gbp0(month.booked)}` : ""}, against the plan's ${gbp0(data.planThisMonth.total)}`} />
              <p className="text-[0.88rem] text-ink-2 leading-relaxed max-w-[62ch]">The plan's {gbp0(data.planThisMonth.total)} for the month is {gbp0(data.planThisMonth.bedhampton)} Bedhampton and {gbp0(data.planThisMonth.winchester)} Winchester, all with VAT.</p>
            </Section>
          )}
          {month && (month.treatments > 0 || month.retail > 0) && (
            <Section title="Where this month's takings came from">
              <SplitBar ariaLabel="Takings this month, treatments against skincare" parts={[{ label: "Treatments", value: month.treatments, color: V.ink }, { label: "Skincare", value: month.retail, color: V.sageDeep }]} />
            </Section>
          )}
          {data.winchester ? (
            <Section title={`Winchester, ${data.winchester.label}: booked before it opens`} note={`${data.winchester.bookedCount} appointments`}>
              <TargetBar segments={[{ label: "Booked with a price", value: data.winchester.booked, color: V.ink }]} target={data.winchester.planNeeds} targetLabel={`the plan needs ${gbp0(data.winchester.planNeeds)}`}
                ariaLabel={`Winchester ${data.winchester.label}: ${gbp0(data.winchester.booked)} booked against the ${gbp0(data.winchester.planNeeds)} the plan needs`} />
              {(data.winchester.byWeek ?? []).length > 0 && <HBars ariaLabel="Winchester bookings by week" labelWidth="9.5rem" rows={data.winchester.byWeek.map((w: any) => ({ label: w.week, note: `${w.count} ${w.count === 1 ? "appointment" : "appointments"}`, value: w.booked, display: gbp0(w.booked) }))} />}
              <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[62ch]">Booked, not yet taken; free consultations are not counted. Read from ANS on {data.winchester.asOf}.</p>
            </Section>
          ) : null}
          {plan.length > 1 && (
            <Section title="What the plan expects, month by month" note="with VAT">
              <StackColumns rows={plan.map((r) => ({ label: r.label, a: r.bedh.gross, b: r.winc.gross }))} aLabel="Bedhampton" bLabel="Winchester" mark={opens > 0 ? { index: opens, label: "Winchester opens" } : null}
                ariaLabel={`Planned takings each month. ${plan.map((r) => `${r.label}: Bedhampton ${gbp0(r.bedh.gross)}, Winchester ${gbp0(r.winc.gross)}`).join("; ")}`} />
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
                {(money?.extra?.expected ?? []).map((e: any) => <li key={e.label} className="flex justify-between gap-3 py-2.5 border-b border-border"><span><span className="block text-ink">{e.label}</span><span className="block text-[0.82rem] text-ink-2">expected, not yet in the bank; counted in the forecast from {new Date(e.month + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span></span><span className="tabular font-medium">{gbp0(e.amount)}</span></li>)}
                {(money?.extra?.availableLoans ?? []).map((l: any) => <li key={l.label} className="flex justify-between gap-3 py-2.5 border-b border-border"><span><span className="block text-ink">{l.label}</span><span className="block text-[0.82rem] text-ink-2">available to draw when you choose; not in the forecast</span></span><span className="tabular font-medium">{gbp0(l.principal)}</span></li>)}
              </ul>
            </Section>
          )}
          <Section title="In date order">
            {data.dated.length ? <DateRail items={data.dated.map((d: any) => ({ date: d.date, title: d.what, note: d.note, amount: d.amount != null ? gbp0(d.amount) : null, href: d.href }))} /> : <p className="text-ink-muted">Nothing dated ahead.</p>}
          </Section>
          <Section title="Cards" note={<Link href="/archive/cards" className="underline">register</Link>}>
            <div>{data.cards.filter((c: any) => c.limit > 0).map((c: any) => (
              <UsageBar key={c.name} label={c.name} used={c.balance} limit={c.limit} note={c.offers.length ? c.offers.map((o: any) => `${o.ratePct}% ${o.kind} to ${longDay(o.end)}`).join(", ") : undefined} />
            ))}</div>
            {data.cards.some((c: any) => !c.limit && c.balance) && (
              <Rows>{data.cards.filter((c: any) => !c.limit && c.balance).map((c: any) => (
                <RowItem key={c.name}><span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{c.name}</span><span className="block text-[0.8rem] text-ink-muted">no credit limit: a personal account</span></span><span className="tabular font-bold">{gbp0(c.balance)}</span></RowItem>
              ))}</Rows>
            )}
          </Section>
          <Section title="Directors' loan" note={<Link href="/archive/owed" className="underline">detail</Link>}>
            {data.directorsLoan.length ? <SplitBar ariaLabel="What the company owes each director" total={{ label: "Owed to the directors", value: gbp0(data.directorsLoan.reduce((s: number, d: any) => s + d.owed, 0)) }} parts={data.directorsLoan.map((d: any) => ({ label: d.holder, value: d.owed, note: `${d.entries} items not yet paid back` }))} /> : <p className="text-ink-muted">Nothing owed to the directors.</p>}
          </Section>
          <Section title="Loans">
            {data.loans.length ? <Rows>{data.loans.map((l: any) => <RowItem key={l.label}><span className="flex-1"><span className="block text-ink">{l.label}</span><span className="block text-[0.8rem] text-ink-muted">{gbp0(l.principal)} at {l.ratePct}%, {l.repayments} repayments{l.holidayMonths ? ` after ${l.holidayMonths} months' holiday` : ""}{l.nextMonth ? `; next ${gbp0(l.nextAmount)} in ${l.nextMonth}` : ""}</span></span></RowItem>)}</Rows> : <p className="text-ink-muted">No loans in the plan.</p>}
          </Section>
          <Section title="VAT returns, monthly" note={data.vatConfirmed ? `dates confirmed by you, ${data.vatConfirmed.on}` : "dates assumed"}>
            <div className="grid gap-5">
              {data.vat.map((v: any) => (
                <div key={v.month} className="grid gap-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3"><b className="text-ink">{v.period}</b><span className="text-[0.85rem] text-ink-2">return due {longDay(v.due)}{v.refundNextMonth ? `; refund of ${gbp0(v.refundNextMonth)} the month after` : ""}</span></p>
                  <HBars ariaLabel={`VAT for ${v.period}`} max={Math.max(1, ...data.vat.flatMap((x: any) => [x.vatOnSales, x.vatOnBuild]))} labelWidth="9.5rem"
                    rows={[{ label: "VAT on sales", value: v.vatOnSales, display: gbp0(v.vatOnSales), color: V.slate }, { label: "Build VAT reclaimed", value: v.vatOnBuild, display: v.vatOnBuild ? gbp0(v.vatOnBuild) : "nil", color: V.good }]} />
                </div>
              ))}
              <p className="text-[0.8rem] text-ink-muted">The amounts are the plan's estimates, not the return.</p>
            </div>
          </Section>
          <Next>The money watch (daily 07:50) turns anything due in the next 14 days into a card on Today.</Next>
        </>
      )}
    </Page>
  );
}

export { BoardShell };
