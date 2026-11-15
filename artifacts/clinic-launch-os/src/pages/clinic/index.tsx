// Clinic overview: takings, the diary ahead and, from opening, who comes back. The verdict, four
// KPIs with their sources, what needs David, then every clinic page one tap away.
import { BoardShell } from "@/components/board-shell";
import { LinkList } from "@/components/area-overview";
import { AREAS } from "@/components/shell/nav";
import { useSummary } from "@/lib/alfred";

export default function ClinicOverviewPage() {
  const pages = AREAS.find((a) => a.key === "clinic")!.pages.filter((p) => p.href !== "/clinic");
  const { data } = useSummary("clinic");
  const toOpen: number | undefined = data?.extra?.toOpen;
  const next = toOpen != null && toOpen > 0 ? `Winchester opens on 8 December, in ${toOpen} ${toOpen === 1 ? "day" : "days"}; attendance, no-shows and return visits are read from ANS from then.` : "Attendance, no-shows and return visits are read from ANS each morning.";
  return (
    <BoardShell board="clinic" eyebrow="Clinic" title="Clinic" next={next}>
      <section className="space-y-3">
        <h2 className="eyebrow">Everything in Clinic</h2>
        <LinkList links={pages.map((p) => ({ href: p.href, label: p.label, note: p.note ?? "" }))} />
      </section>
    </BoardShell>
  );
}
