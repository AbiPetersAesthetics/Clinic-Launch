// The phone top bar: the clinic's mark at the left opens More, search beside it where a left
// thumb reaches it, then the page title. Nothing in the top right corner.
import { Link } from "wouter";
import { Search } from "lucide-react";
import { showPalette } from "./command-palette";
import { titleOf } from "./nav";

export function TopBar({ location }: { location: string }) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center gap-1 px-2" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <Link href="/more" aria-label="More: inbox, activity, sources, settings and the archive" className="h-11 px-2 flex items-center rounded-full hover:bg-wash">
        <img src={`${import.meta.env.BASE_URL}brand/abi-peters-logo.png`} alt="" width={64} height={20} className="block h-auto w-[64px]" />
      </Link>
      <button type="button" onClick={showPalette} aria-label="Search or jump to" className="w-11 h-11 rounded-full flex items-center justify-center text-ink hover:bg-wash"><Search className="w-5 h-5" /></button>
      <span className="font-display text-[1.1rem] text-ink truncate">{titleOf(location)}</span>
    </header>
  );
}
