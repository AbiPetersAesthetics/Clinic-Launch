// The four area command pages (ALFRED-PLAN.md section 2): Money, Growth, Patients and Clinic. Each
// opens with its verdict, four figures, what needs David and one line on what is next, then lists
// every page of the area as ruled rows. One phone screen, one scroll.
import { useState, type ReactNode } from "react";
import { BoardShell } from "@/components/board-shell";
import { BankInput, AccountsView } from "@/components/bank-input";
import { AREAS } from "@/components/shell/nav";
import { LinkList, Section } from "@/components/page";
import { useSummary } from "@/lib/alfred";
import { OutlookChart } from "@/components/outlook-chart";

function AreaPage({ area, board, next, children, lead }: { area: string; board: string; next?: ReactNode; children?: ReactNode; lead?: ReactNode }) {
  const a = AREAS.find((x) => x.key === area)!;
  return (
    <BoardShell board={board} eyebrow={a.label} title={a.label} next={next} lead={lead}
      after={<Section title={`In ${a.label}`}><LinkList links={a.pages.map((p) => ({ href: p.href, label: p.label, note: p.note }))} /></Section>}>
      {children}
    </BoardShell>
  );
}

const MARK: Record<string, { word: string; cls: string }> = {
  better: { word: "Better than expected", cls: "bg-good" }, "on track": { word: "On track", cls: "bg-ink" }, worse: { word: "Worse than expected", cls: "bg-act" }, stale: { word: "No verdict: stale figures", cls: "bg-ink-muted" },
};

// The outlook: the plan against where we are heading over the next four month-ends, the reasons
// they differ (each with a pound figure), what the outlook relies on, and the rule in small print.
function Outlook({ o }: { o?: any }) {
  if (!o) return null;
  const m = MARK[o.state] ?? MARK.stale;
  return (
    <section className="grid gap-4 rounded-2xl bg-card border border-border shadow-[0_1px_3px_rgba(31,42,68,0.07)] p-4 sm:p-6" aria-labelledby="outlook-h">
      <h2 id="outlook-h" className="inline-flex items-center gap-2 text-[0.85rem] font-extrabold uppercase tracking-[0.12em] text-ink"><span aria-hidden className={`inline-block w-3 h-3 rounded-full ${m.cls}`} />The bank, next four months</h2>
      {o.points && <OutlookChart points={o.points} />}
      {o.reasons?.length > 0 && (
        <ul className="grid gap-2 border-t border-line-strong pt-3">
          {o.reasons.map((r: any, i: number) => <li key={i} className="flex gap-3 text-[1rem] text-ink leading-snug"><span className={`font-extrabold tabular shrink-0 w-[5.5rem] text-right ${r.amount >= 0 ? "text-good" : "text-act"}`}>{r.amount >= 0 ? "+" : "minus "}£{Math.abs(Math.round(r.amount)).toLocaleString("en-GB")}</span><span>{r.text}</span></li>)}
        </ul>
      )}
      {o.relies?.length > 0 && <p className="text-[0.95rem] text-ink-2 leading-relaxed"><span className="font-semibold text-ink">This relies on: </span>{o.relies.join("; ")}.</p>}
      <p className="text-[0.82rem] text-ink-muted leading-relaxed">{o.rule}</p>
    </section>
  );
}

export function MoneyArea() {
  const { data } = useSummary("money");
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("bank"));
  return (
    <AreaPage area="money" board="money" lead={<Outlook o={data?.extra?.outlook} />} next={<>After paying anything from the bank, type the new balance here; anything bought on a card is added to the card's register.</>}>
      <Section title="The bank" id="bank-h">
        {!open && data?.extra?.bank?.accounts?.length ? <AccountsView accounts={data.extra.bank.accounts} /> : null}
        {!open && data?.extra?.bank && !data.extra.bank.accounts?.length && <p className="text-[1rem] text-ink">£{Math.round(data.extra.bank.balanceGbp).toLocaleString("en-GB")} typed for {new Date(data.extra.bank.asAt + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, all accounts as one.</p>}
        {!open && (data?.extra?.expected ?? []).length > 0 && <p className="text-[0.95rem] text-ink-2">Expected, not yet in the bank: {data!.extra.expected.map((e: any) => `${e.label} £${Math.round(e.amount).toLocaleString("en-GB")}`).join("; ")}.</p>}
        {!open && (data?.extra?.availableLoans ?? []).length > 0 && <p className="text-[0.95rem] text-ink-2">Available to draw when you choose, not in the forecast: {data!.extra.availableLoans.map((l: any) => `${l.label} £${Math.round(l.principal).toLocaleString("en-GB")}`).join("; ")}.</p>}
        {open && data ? <BankInput bank={data.extra?.bank ?? null} fundingOptions={data.extra?.fundingOptions ?? []} autoFocus />
          : <button type="button" onClick={() => setOpen(true)} className="justify-self-start min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.85rem] font-semibold">Update the bank</button>}
      </Section>
    </AreaPage>
  );
}

export function GrowthArea() {
  const { data } = useSummary("growth");
  return <AreaPage area="growth" board="growth" next={data?.extra?.thisMonth} />;
}

export function PatientsArea() {
  return <AreaPage area="patients" board="patients" next="From opening on 8 December the clinic refresh reads new patients, attendance, conversion and who is due back from ANS each morning." />;
}

export function ClinicArea() {
  const { data } = useSummary("clinic");
  const toOpen: number | undefined = data?.extra?.toOpen;
  return <AreaPage area="clinic" board="clinic" next={toOpen != null && toOpen > 0 ? `Model days on 2 and 3 December, then Winchester opens on 8 December. The opening checklist archives itself after that.` : "Attendance, no-shows and return visits are read from ANS each morning."} />;
}
