// The desktop and tablet sidebar: the logo (it opens More), search, the five areas (only the
// current one opens to its pages), then Inbox, Activity and More.
import { Link } from "wouter";
import { Search, Inbox, Activity, MoreHorizontal } from "lucide-react";
import { AREAS, areaOf } from "./nav";
import { showPalette } from "./command-palette";

export function Logo({ width = 150 }: { width?: number }) {
  return (
    <div className="select-none">
      <img src={`${import.meta.env.BASE_URL}brand/abi-peters-logo.png`} alt="Abi Peters Skin Clinic" width={width} height={Math.round(width * 0.32)} className="block h-auto" style={{ width }} />
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
      <div className="p-5 pb-4"><Link href="/more" aria-label="More: inbox, activity, sources, settings and the archive"><Logo /></Link></div>
      <div className="px-4">
        <button type="button" onClick={showPalette} className="w-full flex items-center gap-2 min-h-[40px] px-3 rounded-full border border-input text-[0.85rem] text-ink-muted hover:border-slate">
          <Search className="w-4 h-4" /><span className="flex-1 text-left">Search or jump to</span><kbd className="text-[0.7rem] border border-border rounded px-1.5">{isMac ? "Cmd" : "Ctrl"} K</kbd>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" aria-label="Main">
        {AREAS.map((a) => {
          const active = area === a.key;
          return (
            <div key={a.key}>
              <Link href={a.href} className={item(active && location === a.href)} aria-current={location === a.href ? "page" : undefined}>
                <a.icon className="w-4 h-4 shrink-0" /><span className="flex-1">{a.label}</span>
                {a.key === "today" && counts.today > 0 && <span className="text-[0.7rem] font-semibold rounded-full bg-ink text-white px-2 py-0.5" aria-label={`${counts.today} need you`}>{counts.today}</span>}
              </Link>
              {active && a.pages.length > 0 && (
                <div className="ml-5 pl-3 border-l border-border my-1 space-y-0.5">
                  {a.pages.map((p) => {
                    const on = location === p.href || location.startsWith(p.href + "/");
                    return <Link key={p.href} href={p.href} aria-current={on ? "page" : undefined} className={`flex items-center px-3 min-h-[34px] rounded-full text-[0.85rem] ${on ? "bg-wash text-ink font-semibold" : "text-ink/70 hover:bg-wash hover:text-ink"}`}>{p.label}</Link>;
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="my-3 border-t border-border" />
        <Link href="/inbox" className={item(location === "/inbox")}><Inbox className="w-4 h-4 shrink-0" /><span className="flex-1">Inbox</span>{counts.inbox > 0 && <span className="text-[0.7rem] font-semibold rounded-full bg-wash-2 text-ink px-2 py-0.5">{counts.inbox}</span>}</Link>
        <Link href="/activity" className={item(location === "/activity")}><Activity className="w-4 h-4 shrink-0" /><span className="flex-1">Activity</span></Link>
        <Link href="/more" className={item(location === "/more")}><MoreHorizontal className="w-4 h-4 shrink-0" /><span className="flex-1">More</span></Link>
      </nav>
      <p className="px-6 pb-4 text-ink-muted/60 text-[0.6rem] tracking-[0.15em] uppercase">Winchester · Bedhampton</p>
    </aside>
  );
}
