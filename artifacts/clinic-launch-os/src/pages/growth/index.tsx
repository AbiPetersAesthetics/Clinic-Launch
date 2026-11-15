// Growth overview: are we getting patients, and what is it costing? The Ads verdict and KPIs lead;
// Social and SEO join here as their boards come in. Everything deeper is one tap away.
import { BoardShell } from "@/components/board-shell";
import { LinkList } from "@/components/area-overview";
import { AREAS } from "@/components/shell/nav";
import { useSummary } from "@/lib/alfred";

export default function GrowthOverviewPage() {
  const pages = AREAS.find((a) => a.key === "growth")!.pages.filter((p) => p.href !== "/growth");
  const { data } = useSummary("ads");
  return (
    <BoardShell board="ads" eyebrow="Growth" title="Growth" next={data?.extra?.thisMonth}>
      <section className="space-y-3">
        <h2 className="eyebrow">Everything in Growth</h2>
        <LinkList links={pages.map((p) => ({ href: p.href, label: p.label, note: p.note ?? "", wip: p.wip }))} />
      </section>
    </BoardShell>
  );
}
