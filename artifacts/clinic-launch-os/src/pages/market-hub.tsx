// Market: pricing, memberships and referrals (Market & Pricing) together with competitor intelligence
// (Competition Intel), merged into one page with two tabs on 15 Nov 2026. The tab is kept in the
// address (#pricing or #competitors) so a link opens on the right one.
import { useEffect, useState } from "react";
import MarketPage from "@/pages/market";
import CompetitionPage from "@/pages/competition";
import { PageHead } from "@/components/page";

const TABS = [
  { id: "pricing", label: "Pricing and offers" },
  { id: "competitors", label: "Competitors" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const fromHash = (): Tab => (window.location.hash === "#competitors" ? "competitors" : "pricing");

export default function MarketHubPage() {
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const choose = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Growth" title="Market" back={{ href: "/growth", label: "Growth" }}>
        <p className="font-sans font-semibold text-[1.2rem] sm:text-[1.4rem] leading-snug text-ink max-w-[52ch]">Competitor prices, offers and memberships from the verified capture of 31 August 2026, all with VAT.</p>
        <p className="text-[0.95rem] text-ink-2 max-w-[62ch]">They are not refreshed automatically, so a rival's price may have moved since. Check one on its own website before acting on it.</p>
      </PageHead>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Market sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}
            className={`min-h-[44px] px-5 rounded-full text-[0.85rem] font-semibold border transition-colors ${tab === t.id ? "bg-ink text-white border-ink" : "bg-card text-ink border-line-strong hover:border-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "pricing" ? <MarketPage /> : <CompetitionPage />}
    </div>
  );
}
