// Market: pricing, memberships and referrals (Market & Pricing) together with competitor intelligence
// (Competition Intel), merged into one page with two tabs on 15 Nov 2026. The tab is kept in the
// address (#pricing or #competitors) so a link opens on the right one.
import { useEffect, useState } from "react";
import MarketPage from "@/pages/market";
import CompetitionPage from "@/pages/competition";

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
    <div>
      <div className="px-4 sm:px-6 pt-4 flex gap-2 flex-wrap" role="tablist" aria-label="Market sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}
            className={`px-3 py-1.5 text-sm font-semibold border rounded-sm transition-colors ${tab === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "pricing" ? <MarketPage /> : <CompetitionPage />}
    </div>
  );
}
