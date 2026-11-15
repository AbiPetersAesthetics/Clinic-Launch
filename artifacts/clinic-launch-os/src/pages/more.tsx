// More (wireframe 5.5): search, the inbox, activity, settings, the archive of planning pages and
// the export, all out of the main navigation.
import { Link } from "wouter";
import { ChevronRight, Search } from "lucide-react";
import { ARCHIVE } from "@/components/shell/nav";
import { showPalette } from "@/components/shell/command-palette";
import { useProposals } from "@/lib/alfred";
import { LinkList } from "@/components/area-overview";

export default function MorePage() {
  const { data } = useProposals();
  const row = "flex items-center gap-3 px-4 min-h-[56px] hover:bg-wash";
  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-3"><span className="eyebrow">More</span><h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">More</h1></header>
      <button type="button" onClick={showPalette} className="w-full flex items-center gap-2 min-h-[48px] px-4 rounded-full border border-input text-ink-muted"><Search className="w-4 h-4" />Search or jump to</button>
      <ul className="divide-y divide-border rounded-xl border border-card-border overflow-hidden">
        <li><Link href="/inbox" className={row}><span className="flex-1 font-semibold">Inbox</span>{(data?.open.length ?? 0) > 0 && <span className="text-[0.75rem] rounded-full bg-wash-2 px-2">{data!.open.length}</span>}<ChevronRight className="w-4 h-4 text-ink-muted" /></Link></li>
        <li><Link href="/activity" className={row}><span className="flex-1 font-semibold">Activity</span><ChevronRight className="w-4 h-4 text-ink-muted" /></Link></li>
        <li><Link href="/settings" className={row}><span className="flex-1 font-semibold">Settings</span><span className="text-[0.8rem] text-ink-muted">hand, notifications</span><ChevronRight className="w-4 h-4 text-ink-muted" /></Link></li>
        <li><Link href="/export" className={row}><span className="flex-1 font-semibold">Export PDF</span><span className="text-[0.8rem] text-ink-muted">the planning-era report</span><ChevronRight className="w-4 h-4 text-ink-muted" /></Link></li>
      </ul>
      <section className="space-y-3">
        <h2 className="eyebrow">Archive: {ARCHIVE.length} planning pages, kept for reference</h2>
        <LinkList links={ARCHIVE.map((p) => ({ href: p.href, label: p.label, note: "" }))} />
      </section>
    </div>
  );
}
