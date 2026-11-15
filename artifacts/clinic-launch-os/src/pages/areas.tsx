// The four area command pages (ALFRED-PLAN.md section 2): Money, Growth, Patients and Clinic. Each
// opens with its verdict, four figures, what needs David and one line on what is next, then lists
// every page of the area as ruled rows. One phone screen, one scroll.
import { useState, type ReactNode } from "react";
import { BoardShell } from "@/components/board-shell";
import { BankInput } from "@/components/bank-input";
import { AREAS } from "@/components/shell/nav";
import { LinkList, Section } from "@/components/page";
import { useSummary } from "@/lib/alfred";

function AreaPage({ area, board, next, children }: { area: string; board: string; next?: ReactNode; children?: ReactNode }) {
  const a = AREAS.find((x) => x.key === area)!;
  return (
    <BoardShell board={board} eyebrow={a.label} title={a.label} next={next}
      after={<Section title={`In ${a.label}`}><LinkList links={a.pages.map((p) => ({ href: p.href, label: p.label, note: p.note }))} /></Section>}>
      {children}
    </BoardShell>
  );
}

export function MoneyArea() {
  const { data } = useSummary("money");
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("bank"));
  return (
    <AreaPage area="money" board="money" next={<>After paying anything from the bank, type the new balance here; anything bought on a card is added to the card's register.</>}>
      <Section title="Bank balance" id="bank-h">
        {open && data ? <BankInput bank={data.extra?.bank ?? null} fundingOptions={data.extra?.fundingOptions ?? []} autoFocus />
          : <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Update bank balance</button>}
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
