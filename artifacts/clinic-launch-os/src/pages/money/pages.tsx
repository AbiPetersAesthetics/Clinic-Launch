// Money's detail pages: the Build Cash Board (the master record, unchanged), Stands Alone, Takings
// and Obligations. Figures come from the cash model, the clinic refresh and the card register.
import { Link } from "wouter";
import { usePage, useProposals, useSummary, useCashModel, PROJECT_ID, type Chip } from "@/lib/alfred";
import { Stat, TargetBar, SplitBar, StackColumns, MarginColumns, HBars, DateRail, UsageBar, V } from "@/components/viz";
import { ProposalCard } from "@/components/proposal-card";
import { BoardShell, EmbeddedBoard } from "@/components/board-shell";
import { Page, PageHead, Section, Rows, RowItem, NotYet, Next, gbp0, longDay } from "@/components/page";
import { Sources } from "@/components/fresh";
import { BalanceLine } from "@/components/charts";
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

// Stands Alone as a ladder (owner, 16 Nov 2026): four plain steps instead of one pass or fail line.
export function StandsAlonePage() {
  const { data } = usePage("stands-alone");
  const ladder: any[] = data?.ladder ?? [];
  const rows: any[] = data?.ladderRows ?? [];
  const ix = (label: string | null) => (label ? rows.findIndex((r) => r.label === label) : -1);
  return (
    <Page>
      <PageHead eyebrow="Money" title="Stands Alone" back={back}>
        {data && (() => { const at = (k: string) => ladder.find((l) => l.key === k)?.met as string | null | undefined; const bills = at("bills"), pay1 = at("pay1"), alone = at("alone");
          return <p className="font-sans font-bold text-[1.3rem] sm:text-[1.5rem] leading-snug text-ink max-w-[52ch]">{bills ? `Winchester pays its own bills from ${bills}` : "Winchester does not yet pay its own bills on the plan"}{pay1 ? `, and Abi is paid from ${pay1}` : ""}. {alone ? `It carries its bills and Abi with no help from Bedhampton from ${alone}.` : `It does not carry Abi's pay on its own by ${data.horizon}.`}</p>; })()}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Loading /> : (
        <>
          <Section title="The steps" note="from the plan; real months replace it from December">
            <ol className="relative grid gap-0">
              <span aria-hidden className="absolute left-[1.05rem] top-4 bottom-4 w-[2px]" style={{ background: V.grid }} />
              {ladder.map((l, i) => (
                <li key={l.key} className="relative flex items-start gap-3.5 py-3">
                  <span className="relative z-[1] w-9 h-9 shrink-0 rounded-full grid place-items-center text-[0.95rem] font-extrabold" style={l.met ? { background: V.good, color: "#fff" } : { background: "#fff", color: V.ink, border: `2px dashed ${V.base}` }}>{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[1.05rem] font-bold text-ink leading-snug">{l.title}</span><span className="block text-[0.88rem] text-ink-2 leading-relaxed max-w-[60ch]">{l.detail}</span></span>
                  <span className="shrink-0 text-right"><b className={`block tabular text-[1.05rem] ${l.met ? "text-good" : "text-ink-muted"}`}>{l.met ?? "not yet"}</b><span className="block text-[0.75rem] text-ink-muted">{l.met ? "on the plan" : `not by ${data.horizon}`}</span></span>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="This month">
            <NotYet what={data.thisMonth.reason} />
          </Section>
          <Section title="Winchester on its own, after its bills and Abi's pay" note="the plan">
            <MarginColumns lineLabel="stands alone above this line" rows={rows.map((r) => ({ label: r.label, value: r.alone, title: `${r.label}: ${gbp0(r.bills)} left after its bills; ${gbp0(r.alone)} after Abi's settled pay as well` }))}
              marks={ladder.filter((l) => l.met && (l.key === "bills" || l.key === "pay1")).map((l) => ({ index: ix(l.met), label: l.key === "bills" ? "pays its bills" : "Abi's pay starts" }))}
              ariaLabel={`What Winchester has left each month after its own bills and Abi's settled pay. ${rows.map((r) => `${r.label}: ${gbp0(r.alone)}`).join("; ")}`} />
            <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[64ch]">Below the line, Bedhampton's profit is making up the difference. The forecast is the Money Plan's recommended growth, which is cautious; actual months replace it from December.</p>
          </Section>
          <Section title="Abi's pay, month by month" note="salary before tax">
            <MarginColumns rows={rows.map((r) => ({ label: r.label, value: r.pay, title: `${r.label}: ${gbp0(r.pay)} salary` }))} ariaLabel={`Abi's salary each month on the plan. ${rows.map((r) => `${r.label}: ${gbp0(r.pay)}`).join("; ")}`} />
          </Section>
          <Section title="The bank while she is paid" note="month-end">
            <BalanceLine points={rows.map((r) => ({ label: r.label, value: r.bank }))} floor={10000} ariaLabel={`The bank at each month-end on the plan. ${rows.map((r) => `${r.label}: ${gbp0(r.bank)}`).join("; ")}`} />
          </Section>
          <details>
            <summary className="cursor-pointer text-[0.88rem] font-semibold text-ink underline underline-offset-2 min-h-[44px] inline-flex items-center">Every month as figures</summary>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-[0.88rem] tabular">
              <thead><tr className="text-left text-[0.7rem] uppercase tracking-[0.12em] text-ink-muted border-b border-line-strong"><th className="py-2 pr-3">Month</th><th className="py-2 pr-3 text-right">After its bills</th><th className="py-2 pr-3 text-right">After Abi too</th><th className="py-2 pr-3 text-right">Abi's salary</th><th className="py-2 text-right">Bank</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.label} className="border-b border-border"><td className="py-1.5 pr-3">{r.label}</td><td className="py-1.5 pr-3 text-right">{gbp0(r.bills)}</td><td className="py-1.5 pr-3 text-right">{gbp0(r.alone)}</td><td className="py-1.5 pr-3 text-right">{gbp0(r.pay)}</td><td className="py-1.5 text-right">{gbp0(r.bank)}</td></tr>)}</tbody>
            </table></div>
          </details>
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
