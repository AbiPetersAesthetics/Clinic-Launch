// A board built by the API (the Build Cash Board, the Money Plan), framed in a Launch OS tab.
// "Full screen" expands it over the whole window inside the app, and asks the browser for
// real full screen on top where it allows it, so it works where a new tab is blocked (pop-up
// blockers, an installed app window, a tablet). Escape or Close puts it back.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExternalLink, Maximize2, X } from "lucide-react";

export function BoardFrame({ src, title, heading, subtitle, footnote }: { src: string; title: string; heading: string; subtitle: string; footnote: ReactNode }) {
  const [height, setHeight] = useState(900);
  const [expanded, setExpanded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => setHeight(Math.max(700, window.innerHeight - 190));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [expanded]);
  const open = () => {
    setExpanded(true);
    try { void box.current?.requestFullscreen?.().catch(() => {}); } catch { /* the overlay is enough */ }
  };
  const close = () => {
    setExpanded(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  return (
    <div className="space-y-4">
      <PageHeader title={heading} subtitle={subtitle}
        action={<div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={open}><Maximize2 className="w-4 h-4 mr-1.5" />Full screen</Button>
          <a href={src} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" />New tab</a>
        </div>} />
      <div ref={box} className={expanded ? "fixed inset-0 z-[100] bg-background flex flex-col" : "rounded-md border overflow-hidden bg-background"}>
        {expanded && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b bg-background">
            <span className="text-sm font-medium truncate">{title}</span>
            <Button type="button" variant="outline" size="sm" onClick={close}><X className="w-4 h-4 mr-1.5" />Close</Button>
          </div>
        )}
        <iframe src={src} title={title} allowFullScreen style={{ width: "100%", height: expanded ? undefined : height, flex: expanded ? 1 : undefined, border: 0, display: "block" }} loading="eager" />
      </div>
      <p className="text-xs text-muted-foreground">{footnote}</p>
    </div>
  );
}
