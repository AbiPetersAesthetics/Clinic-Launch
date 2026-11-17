// Every area and board opens the same way (ALFRED-PLAN.md section 1): the title once, the verdict
// sentence, at most four figures with their sources, "Needs you" (at most three cards) and one line
// on what is next; then the detail. A server board below is framed with ?embed=1: it hides its own
// title and reports its height, so the frame grows to fit and the page has one scroll.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, ExternalLink, Maximize2, X } from "lucide-react";
import { useProposals, useSummary, type Summary } from "@/lib/alfred";
import { Verdict } from "@/components/verdict";
import { KpiGrid } from "@/components/kpi";
import { Page, PageHead, Section, Next, alertCard } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";

const AREA_OF: Record<string, string[]> = { money: ["money"], ads: ["ads", "growth", "content"], growth: ["ads", "growth", "content"], patients: ["patients"], clinic: ["clinic"] };

export function EmbeddedBoard({ src, title, minHeight = 600, fullScreen = true }: { src: string; title: string; minHeight?: number; fullScreen?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);
  // ?full=1 (the command palette's "open full screen") opens the board over the whole window.
  const [expanded, setExpanded] = useState(() => fullScreen && new URLSearchParams(window.location.search).has("full"));
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
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={open} className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-wash"><Maximize2 className="w-4 h-4" />Full screen</button>
          <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8rem] text-ink-muted underline min-h-[44px]"><ExternalLink className="w-3.5 h-3.5" />New tab</a>
        </div>
      )}
      <div ref={box} className={expanded ? "fixed inset-0 z-[100] bg-background flex flex-col" : "-mx-4 sm:mx-0 overflow-hidden"}>
        {expanded && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b bg-background">
            <span className="text-sm font-medium truncate">{title}</span>
            <button type="button" onClick={close} className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em]"><X className="w-4 h-4" />Close</button>
          </div>
        )}
        <iframe ref={frame} src={expanded ? src : url} title={title} allowFullScreen scrolling={expanded ? "auto" : "no"}
          style={{ width: "100%", height: expanded ? undefined : height, flex: expanded ? 1 : undefined, border: 0, display: "block" }} />
      </div>
    </div>
  );
}

// Questions and approvals for this area as one line into the Inbox: how many, and the first.
export function AsksLine({ count, first }: { count: number; first: string }) {
  return (
    <Link href="/inbox" className="flex items-center gap-3 rounded-xl border-[1.5px] border-line-strong bg-card px-4 py-3 min-h-[56px] hover:bg-wash">
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink text-[1rem]">{count} {count === 1 ? "question waits" : "questions wait"} for a word from you</span>
        <span className="block text-[0.9rem] text-ink-2 truncate">First: {first}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-ink-muted shrink-0" />
    </Link>
  );
}

export function NeedsYou({ board, summary, max = 3 }: { board: string; summary?: Summary; max?: number }) {
  const { data: props } = useProposals();
  const mine = (props?.open ?? []).filter((p) => (AREA_OF[board] ?? [board]).includes(p.area));
  const alerts = summary && summary.state !== "stale" ? summary.alerts : [];
  // Owner, 16 Nov 2026: no wall of question cards. Warnings show as cards; questions and approvals
  // are one line into the Inbox, where they are opened one at a time.
  if (!alerts.length && !mine.length) return null;
  return (
    <>
      {alerts.length > 0 && (
        <Section title="Worth a look" id={`needs-${board}`}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">{alerts.slice(0, max).map((a) => <div key={a.id} className="min-w-0">{alertCard(a)}</div>)}</div>
        </Section>
      )}
      {mine.length > 0 && <AsksLine count={mine.length} first={mine[0].title} />}
    </>
  );
}

export function BoardShell({ board, eyebrow, title, next, back, children, after, lead, src, frameTitle, master = false }: {
  board?: string; eyebrow: string; title: string; next?: ReactNode; back?: { href: string; label: string }; children?: ReactNode; after?: ReactNode; lead?: ReactNode; src?: string; frameTitle?: string; master?: boolean;
}) {
  const { data, isLoading, error } = useSummary(board ?? "none");
  const s = board ? data : undefined;
  return (
    <Page>
      <PageHead eyebrow={eyebrow} title={title} back={back}>
        {board && (error ? <p className="text-act">The summary could not be built: {String((error as Error).message)}</p>
          : isLoading || !s ? <Skeleton className="h-16 w-full max-w-xl rounded-xl" />
          : <div className="rounded-2xl bg-ink px-5 py-5 sm:px-7 sm:py-6"><Verdict state={s.state} text={s.verdict} dark /></div>)}
      </PageHead>
      {lead}
      {s && s.kpis.length > 0 && <KpiGrid kpis={s.kpis} max={4} />}
      {board && <NeedsYou board={board} summary={s} />}
      {next && <Next>{next}</Next>}
      {children}
      {src && <EmbeddedBoard src={src} title={frameTitle ?? title} minHeight={master ? 900 : 600} />}
      {after}
      {s && <p className="text-[0.78rem] text-ink-muted">{s.keeper}. <Link href="/sources" className="underline">Sources</Link></p>}
    </Page>
  );
}
