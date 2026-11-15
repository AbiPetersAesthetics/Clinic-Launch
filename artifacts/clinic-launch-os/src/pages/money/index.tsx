// Money overview (UX plan 2.2 and wireframe 5.5): the verdict, the bank, the lowest point ahead and
// the cards, the bank balance input, then every money page one tap away.
import { useState } from "react";
import { AreaOverview } from "@/components/area-overview";
import { BankInput } from "@/components/bank-input";
import { useSummary } from "@/lib/alfred";

export default function MoneyOverviewPage() {
  const { data } = useSummary("money");
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("bank"));
  return (
    <AreaOverview board="money" eyebrow="Money" title="Money"
      links={[
        { href: "/money/build-cash", label: "Build Cash Board", note: "The master record: the bank, the build, the card and every line" },
        { href: "/money/cash-line", label: "Cash Line", note: "The Tide balance day by day to the end of December" },
        { href: "/money/plan", label: "Money Plan", note: "How Winchester pays for itself" },
        { href: "/money/cards", label: "Credit Cards", note: "Balances, limits and 0% dates" },
        { href: "/money/owed", label: "Owed to directors", note: "The director's loan" },
      ]}>
      <section className="rounded-xl border border-card-border p-4 sm:p-5 grid gap-3" aria-labelledby="bank-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bank-h" className="eyebrow">Bank balance</h2>
          {!open && <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Update bank balance</button>}
        </div>
        <p className="text-[0.9rem] text-ink-muted">Typed from Tide; it is never live. The boards, the Cash Line and the Money Plan all start from it, and it shows as stale after 7 days.</p>
        {open && data && <BankInput bank={data.extra?.bank ?? null} fundingOptions={data.extra?.fundingOptions ?? []} autoFocus />}
      </section>
    </AreaOverview>
  );
}
