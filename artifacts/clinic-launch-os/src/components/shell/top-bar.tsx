// The phone top bar (UX plan 2.3): the search button at the left, where a left thumb reaches it,
// then the page title. Nothing sits in the top right corner, the hardest reach for a left hand.
import { Search } from "lucide-react";
import { showPalette } from "./command-palette";
import { titleOf } from "./nav";

export function TopBar({ location }: { location: string }) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center gap-2 px-2" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <button type="button" onClick={showPalette} aria-label="Search or jump to" className="w-11 h-11 rounded-full flex items-center justify-center text-ink hover:bg-wash"><Search className="w-5 h-5" /></button>
      <span className="font-display text-[1.1rem] text-ink truncate">{titleOf(location)}</span>
    </header>
  );
}
