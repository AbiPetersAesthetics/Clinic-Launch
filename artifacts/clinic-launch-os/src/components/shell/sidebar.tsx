// The desktop and tablet sidebar (UX plan 2.3): search at the top, then Today, Money, Growth, Clinic
// and Inbox, a divider, Activity and More. Only the current area opens to its pages, so the sidebar
// never runs to more than about a dozen lines.
import { Link } from "wouter";
import { Search } from "lucide-react";
import { AREAS, EXTRA, areaOf } from "./nav";
import { showPalette } from "./command-palette";

export function Logo() {
  return (
    <div className="select-none">
      <img src={`${import.meta.env.BASE_URL}brand/abi-peters-logo.png`} alt="Abi Peters Skin Clinic" width={150} height={48} className="block h-auto w-[150px]" />
      <div className="text-ink-muted tracking-[0.22em] uppercase mt-2" style={{ fontSize: "0.6rem", fontWeight: 600 }}>A.L.F.R.E.D.</div>
    </div>
  );
}

const item = (active: boolean) => `flex items-center gap-3 px-3 min-h-[40px] rounded-full text-[0.92rem] transition-colors ${active ? "bg-wash text-ink font-semibold" : "text-ink/75 hover:bg-wash hover:text-ink font-medium"}`;

export function Sidebar({ location, counts }: { location: string; counts: { today: number; inbox: number } }) {
  const area = areaOf(location);
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-background sticky top-0 h-screen">
      <div className="p-5 pb-4"><Link href="/" aria-label="Today"><Logo /></Link></div>
      <div className="px-4">
        <button type="button" onClick={showPalette} className="w-full flex items-center gap-2 min-h-[40px] px-3 rounded-full border border-input text-[0.85rem] text-ink-muted hover:border-slate">
          <Search className="w-4 h-4" /><span className="flex-1 text-left">Search or jump to</span><kbd className="text-[0.7rem] border border-border rounded px-1.5">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" aria-label="Main">
        {AREAS.map((a) => {
          const active = area === a.key;
          return (
            <div key={a.key}>
              <Link href={a.href} className={item(active && (location === a.href || a.pages.length === 0))} aria-current={location === a.href ? "page" : undefined}>
                <a.icon className="w-4 h-4 shrink-0" /><span className="flex-1">{a.label}</span>
                {a.key === "today" && counts.today > 0 && <span className="text-[0.7rem] font-semibold rounded-full bg-ink text-white px-2 py-0.5" aria-label={`${counts.today} need you`}>{counts.today}</span>}
              </Link>
              {active && a.pages.length > 0 && (
                <div className="ml-5 pl-3 border-l border-border my-1 space-y-0.5">
                  {a.pages.filter((p) => p.href !== a.href).map((p) => p.wip ? (
                    <div key={p.href} aria-disabled="true" title="Work in progress" className="flex items-center gap-2 px-3 min-h-[34px] text-[0.85rem] text-ink-muted/50 cursor-not-allowed">
                      <span className="flex-1">{p.label}</span><span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] px-1.5 rounded-full border border-border">WIP</span>
                    </div>
                  ) : (
                    <Link key={p.href} href={p.href} aria-current={location === p.href ? "page" : undefined} className={`flex items-center px-3 min-h-[34px] rounded-full text-[0.85rem] ${location === p.href ? "bg-wash text-ink font-semibold" : "text-ink/70 hover:bg-wash hover:text-ink"}`}>{p.label}</Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <Link href="/inbox" className={item(area === "inbox")}>
          {(() => { const I = EXTRA[0].icon; return <I className="w-4 h-4 shrink-0" />; })()}<span className="flex-1">Inbox</span>
          {counts.inbox > 0 && <span className="text-[0.7rem] font-semibold rounded-full bg-wash-2 text-ink px-2 py-0.5">{counts.inbox}</span>}
        </Link>
        <div className="my-3 border-t border-border" />
        {EXTRA.slice(1).map((e) => (
          <Link key={e.key} href={e.href} className={item(area === e.key)}><e.icon className="w-4 h-4 shrink-0" /><span className="flex-1">{e.label}</span></Link>
        ))}
      </nav>
      <p className="px-6 pb-4 text-ink-muted/60 text-[0.6rem] tracking-[0.15em] uppercase">Winchester · 9A Jewry Street</p>
    </aside>
  );
}
