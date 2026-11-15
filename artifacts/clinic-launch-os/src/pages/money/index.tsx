// Money: the command layer above the Build Cash Board (owner, 15 Nov 2026). The verdict, the bank,
// the plan's lowest month-end and the cards with their sources, what needs David, the bank balance
// input; then the Build Cash Board itself, unchanged, as the master record.
import { useState } from "react";
import { BoardShell } from "@/components/board-shell";
import { BankInput } from "@/components/bank-input";
import { AREAS } from "@/components/shell/nav";
import { Link } from "wouter";
import { useSummary, PROJECT_ID } from "@/lib/alfred";

export default function MoneyOverviewPage() {
  const { data } = useSummary("money");
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("bank"));
  const pages = AREAS.find((a) => a.key === "money")!.pages.filter((p) => p.href !== "/money");
  return (
    <BoardShell board="money" eyebrow="Money" title="Money" master src={`/api/projects/${PROJECT_ID}/boards/build-cash`} frameTitle="Winchester Build Cash Board"
      next={<>After paying anything from the bank, update the balance here; anything on a card goes in <Link href="/money/cards" className="underline">Credit Cards</Link>.</>}>
      <section className="rounded-xl border border-card-border p-4 grid gap-3" aria-labelledby="bank-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bank-h" className="eyebrow">Bank balance</h2>
          {!open && <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Update bank balance</button>}
        </div>
        {open && data && <BankInput bank={data.extra?.bank ?? null} fundingOptions={data.extra?.fundingOptions ?? []} autoFocus />}
        {!open && <p className="text-[0.85rem] text-ink-muted">Typed from Tide, never live; stale after 7 days. Every board starts from it.</p>}
      </section>
      <nav aria-label="Money pages" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pages.map((p) => <Link key={p.href} href={p.href} className="flex items-center min-h-[44px] px-3 rounded-xl bg-wash hover:bg-wash-2 text-[0.85rem] font-semibold text-ink">{p.label}</Link>)}
      </nav>
      <h2 className="eyebrow">Build Cash Board, the master record</h2>
    </BoardShell>
  );
}
