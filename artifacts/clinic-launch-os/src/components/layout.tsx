// ALFRED's shell (UX plan 2.3): a slim sidebar on desktop and tablet; on a phone, a top bar with
// search at the left and a bottom tab bar in left-thumb order. No hamburger. Ctrl+K opens the
// command palette anywhere; G then T, M, R (gRowth) or C jumps to an area.
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { TopBar } from "@/components/shell/top-bar";
import { CommandPalette } from "@/components/shell/command-palette";
import { useBrief, useProposals } from "@/lib/alfred";
import { SectionsProvider, SectionsFrame } from "@/lib/sections";

function useAreaKeys(go: (to: string) => void) {
  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      const k = e.key.toLowerCase();
      if (k === "g") { armed = Date.now(); return; }
      if (Date.now() - armed < 1200) {
        const to = ({ t: "/", m: "/money", r: "/growth", c: "/clinic", i: "/inbox", a: "/activity" } as Record<string, string>)[k];
        if (to) { e.preventDefault(); go(to); }
        armed = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, go] = useLocation();
  const { data: brief } = useBrief();
  const { data: props } = useProposals();
  useAreaKeys(go);
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  const counts = { today: brief?.total ?? 0, inbox: props?.open.length ?? 0 };
  return (
    <div className="min-h-screen bg-background md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:rounded-full">Skip to content</a>
      <Sidebar location={location} counts={counts} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar location={location} />
        {/* overflow-x-hidden: anything wider than the screen scrolls inside its own wrapper, never the page. */}
        <main id="main" className="flex-1 overflow-x-hidden px-4 pt-5 md:px-8 md:pt-8 pb-tabbar" style={{ overscrollBehaviorX: "none" }}>
          <div className="max-w-6xl mx-auto min-w-0"><SectionsProvider><SectionsFrame>{children}</SectionsFrame></SectionsProvider></div>
        </main>
      </div>
      <BottomTabs location={location} count={counts.today} />
      <CommandPalette />
    </div>
  );
}
