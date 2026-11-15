// Every board opens the same way (UX plan 2.4): the title once, the verdict, at most four KPIs with
// their sources, "Needs you" (at most three cards), one line on what is next; then the detail. A
// server board below it is framed with ?embed=1: it hides its own title and reports its height, so
// the frame grows to fit and the page has one scroll, not two. Full screen stays for the big boards.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft, ExternalLink, Maximize2, X } from "lucide-react";
import { useProposals, useSummary, type Summary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { ProposalCard } from "@/components/proposal-card";
import { BriefItemCard } from "@/pages/home";
import { Skeleton } from "@/components/ui/skeleton";

const AREA_OF: Record<string, string[]> = { money: ["money"], ads: ["ads", "growth", "content"], clinic: ["clinic"] };

export function EmbeddedBoard({ src, title, minHeight = 600, fullScreen = true }: { src: string; title: string; minHeight?: number; fullScreen?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [expanded, setExpanded] = useState(false);
  const url = `${src}${src.includes("?") ? "&" : "?"}embed=1`;
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "alfred-board-height" && typeof e.data.height === "number") setHeight(Math.max(200, Math.ceil(e.data.height)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [expanded]);
  const open = () => { setExpanded(true); try { void box.current?.requestFullscreen?.().catch(() => {}); } catch { /* the overlay is enough */ } };
  const close = () => { setExpanded(false); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  return (
    <div className="space-y-2">
      {fullScreen && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={open} className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-ink text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:bg-wash"><Maximize2 className="w-4 h-4" />Full screen</button>
          <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8rem] text-ink-muted underline min-h-[44px]"><ExternalLink className="w-3.5 h-3.5" />New tab</a>
        </div>
      )}
      <div ref={box} className={expanded ? "fixed inset-0 z-[100] bg-background flex flex-col" : "-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-card-border overflow-hidden bg-background"}>
        {expanded && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b bg-background">
            <span className="text-sm font-medium truncate">{title}</span>
            <button type="button" onClick={close} className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-ink text-[0.75rem] font-semibold uppercase tracking-[0.14em]"><X className="w-4 h-4" />Close</button>
          </div>
        )}
        <iframe ref={frame} src={expanded ? src : url} title={title} allowFullScreen scrolling={expanded ? "auto" : "no"}
          style={{ width: "100%", height: expanded ? undefined : height, flex: expanded ? 1 : undefined, border: 0, display: "block" }} />
      </div>
    </div>
  );
}

export function NeedsYou({ board, summary, max = 3 }: { board: string; summary?: Summary; max?: number }) {
  const { data: props } = useProposals();
  const mine = (props?.open ?? []).filter((p) => (AREA_OF[board] ?? [board]).includes(p.area));
  const alerts = summary && summary.state !== "stale" ? summary.alerts : [];
  const cards = [
    ...mine.map((p) => ({ id: `p${p.id}`, el: <ProposalCard key={`p${p.id}`} p={p} compact /> })),
    ...alerts.map((a) => ({ id: a.id, el: <BriefItemCard key={a.id} item={{ kind: "alert", id: a.id, alert: a }} /> })),
  ];
  if (!cards.length) return null;
  return (
    <section className="space-y-3" aria-labelledby={`needs-${board}`}>
      <h2 id={`needs-${board}`} className="eyebrow">Needs you</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">{cards.slice(0, max).map((c) => <div key={c.id}>{c.el}</div>)}</div>
      {cards.length > max && <Link href="/inbox" className="inline-flex min-h-[44px] items-center text-slate underline text-[0.9rem]">{cards.length - max} more in the inbox</Link>}
    </section>
  );
}

export function BoardShell({ board, eyebrow, title, next, back, children, src, frameTitle, master = false }: {
  board?: string; eyebrow: string; title: string; next?: ReactNode; back?: { href: string; label: string }; children?: ReactNode; src?: string; frameTitle?: string; master?: boolean;
}) {
  const { data, isLoading, error } = useSummary(board ?? "none");
  const s = board ? data : undefined;
  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl">
      <header className="space-y-3">
        {back && <Link href={back.href} className="inline-flex items-center gap-1 min-h-[36px] text-[0.85rem] text-slate"><ChevronLeft className="w-4 h-4" />{back.label}</Link>}
        <div><span className="eyebrow">{eyebrow}</span></div>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">{title}</h1>
        {board && (error ? <p className="text-act">The summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-7 w-full max-w-xl rounded-xl" />
          : <Verdict state={s.state} text={s.verdict} sources={s.sources} />)}
      </header>
      {s && s.kpis.length > 0 && <KpiGrid kpis={s.kpis} max={4} />}
      {board && <NeedsYou board={board} summary={s} />}
      {next && <p className="text-[0.95rem] text-ink leading-relaxed"><span className="eyebrow plain mr-2">Next</span>{next}</p>}
      {children}
      {src && <EmbeddedBoard src={src} title={frameTitle ?? title} minHeight={master ? 900 : 600} />}
      {s && <p className="text-[0.8rem] text-ink-muted">{s.keeper}. <Link href="/activity" className="underline">Activity</Link></p>}
    </div>
  );
}
