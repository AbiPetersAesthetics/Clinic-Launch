// More (opened from the logo): Inbox, Activity, Sources, Abi's screen, Settings, and the archive of
// every retired page. Nothing has been deleted.
import { Search } from "lucide-react";
import { ARCHIVE, MORE } from "@/components/shell/nav";
import { showPalette } from "@/components/shell/command-palette";
import { useProposals } from "@/lib/alfred";
import { LinkList } from "@/components/area-overview";
import { BuildLine } from "@/pages/build";

export default function MorePage() {
  const { data } = useProposals();
  const n = data?.open.length ?? 0;
  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-3"><span className="eyebrow">ALFRED</span><h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">More</h1><BuildLine /></header>
      <button type="button" onClick={showPalette} className="w-full flex items-center gap-2 min-h-[48px] px-4 rounded-full border border-input text-ink-muted"><Search className="w-4 h-4" />Search or jump to</button>
      <LinkList links={MORE.map((p) => ({ href: p.href, label: p.href === "/inbox" && n ? `Inbox (${n} open)` : p.label, note: p.note ?? "" }))} />
      <section className="space-y-3">
        <h2 className="eyebrow">Archive: {ARCHIVE.length} retired pages, kept for reference</h2>
        <LinkList links={ARCHIVE.map((p) => ({ href: p.href, label: p.label, note: "" }))} />
      </section>
    </div>
  );
}
