// ALFRED's page kit, set like a printed briefing rather than a dashboard: an eyebrow and a serif
// title, sections divided by whitespace and hairline rules, lists as ruled rows. Only the things you
// act on (the "needs you" cards) are boxed, so they stand out.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSections, MIN_SECTIONS } from "@/lib/sections";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Alert, Chip } from "@/lib/alfred";
import { Sources } from "@/components/fresh";

export function PageHead({ eyebrow, title, back, children }: { eyebrow: string; title: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="space-y-3">
      {back && <Link href={back.href} className="inline-flex items-center gap-1 min-h-[36px] -ml-1 text-[0.85rem] text-slate"><ChevronLeft className="w-4 h-4" />{back.label}</Link>}
      {/* An eyebrow that only repeats the title is dropped: the phone top bar names the page too. */}
      {eyebrow !== title && <div><span className="eyebrow">{eyebrow}</span></div>}
      <h1 className="font-sans text-[1.9rem] sm:text-[2.3rem] leading-[1.1] text-ink font-extrabold tracking-[-0.02em]">{title}</h1>
      {children}
    </header>
  );
}

// A section registers with the page's section menu (lib/sections.tsx). On a page with three or more
// it starts closed and opens from its title or the menu; with fewer it stays open as before.
export function Section({ title, children, note, id }: { title: string; children: ReactNode; note?: ReactNode; id?: string }) {
  const reg = useSections();
  const key = useId();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => reg?.register({
    key, title, open, setOpen, el: () => ref.current,
    go: () => { setOpen(true); requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })); },
  }), [title, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const folds = (reg?.localCount ?? 0) >= MIN_SECTIONS;
  const shut = folds && !open;
  const head = <h2 id={id} className="eyebrow">{title}</h2>;
  return (
    <section ref={ref} className="space-y-4 rounded-2xl bg-card border border-border shadow-[0_1px_3px_rgba(31,42,68,0.07)] p-4 sm:p-6 scroll-mt-20" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3">
        {folds
          ? <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 text-left min-h-[32px] -my-1">
              <ChevronRight aria-hidden className={`w-4 h-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`} />{head}
            </button>
          : head}
        {note && <span className="text-[0.88rem] text-ink-2 font-semibold">{note}</span>}
      </div>
      {!shut && children}
    </section>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-8 sm:space-y-10 max-w-5xl">{children}</div>;
}

// Ruled rows, the editorial way to list things.
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="border-t border-border">{children}</ul>;
}
export function RowItem({ children, href }: { children: ReactNode; href?: string }) {
  const cls = "flex items-start gap-3 py-2.5 min-h-[48px] border-b border-border";
  return <li>{href ? <Link href={href} className={`${cls} hover:bg-wash/60 -mx-2 px-2 rounded-lg`}>{children}<ChevronRight className="w-4 h-4 text-ink-muted shrink-0 mt-1 ml-auto" /></Link> : <div className={cls}>{children}</div>}</li>;
}

export interface AreaLink { href: string; label: string; note?: string }
export function LinkList({ links }: { links: AreaLink[] }) {
  return (
    <Rows>
      {links.map((l) => (
        <RowItem key={l.href} href={l.href}>
          <span className="min-w-0"><span className="block font-semibold text-ink">{l.label}</span>{l.note && <span className="block text-[0.82rem] text-ink-muted leading-snug">{l.note}</span>}</span>
        </RowItem>
      ))}
    </Rows>
  );
}

// The pages of an area as pills: every way in, without a page of rows under the brief. The note
// rides along as the title so the command palette's words still explain each one.
export function AreaLinks({ links }: { links: AreaLink[] }) {
  return (
    <nav aria-label="Pages in this area" className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href} title={l.note} className="inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-line-strong text-[0.92rem] font-semibold text-ink hover:bg-wash hover:border-ink">{l.label}</Link>
      ))}
    </nav>
  );
}

// Detail one tap away on a phone (ALFRED-PLAN.md promise 1): the sentence above always shows; the
// chart that proves it opens on a tap. From 640px wide it is simply open, with no button.
export function Fold({ label = "Show the chart", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches);
  return (
    <div className="grid gap-3 min-w-0">
      {open && children}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="sm:hidden justify-self-start inline-flex items-center min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-wash">{open ? "Hide" : label}</button>
    </div>
  );
}

// "Not measured yet" said plainly: what will appear, which run fills it, and when.
export function NotYet({ what, when, by }: { what: string; when?: string; by?: string }) {
  return (
    <div className="border-l-2 border-line-strong pl-4 py-1 space-y-1 max-w-[60ch]">
      <p className="text-ink font-medium">Not measured yet.</p>
      <p className="text-[0.9rem] text-ink-muted leading-relaxed">{what}{when ? ` From ${when}.` : ""}{by ? ` Filled by ${by}.` : ""}</p>
    </div>
  );
}

export function Next({ children }: { children: ReactNode }) {
  return <p className="text-[0.98rem] text-ink leading-relaxed max-w-[62ch]"><span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate mr-2">Next</span>{children}</p>;
}

const AREA: Record<string, string> = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth", patients: "Patients", content: "Studio" };
const LEVEL: Record<string, { dot: string; word: string; text: string }> = {
  act: { dot: "bg-act border-act", word: "Act", text: "text-act" },
  watch: { dot: "bg-watch border-watch", word: "Watch", text: "text-watch" },
  stale: { dot: "bg-transparent border-ink-muted", word: "Stale", text: "text-ink-muted" },
};

// A "needs you" card for an alert: the area and a dot with a word, a plain sentence, the detail,
// its sources, and one way in.
export function AlertCard({ area, level, title, detail, sources, href }: { area: string; level: "act" | "watch" | "stale"; title: string; detail?: string; sources?: Chip[]; href?: string }) {
  const L = LEVEL[level];
  return (
    <article className={`rounded-xl border-[1.5px] p-4 sm:p-5 grid gap-2 min-w-0 ${level === "act" ? "bg-act-bg border-act/40" : level === "watch" ? "bg-watch-bg border-watch/40" : "bg-card border-line-strong"}`}>
      <div className="flex items-center gap-3 text-[0.75rem] font-extrabold uppercase tracking-[0.12em]">
        <span className="text-ink">{AREA[area] ?? area}</span>
        <span className={`inline-flex items-center gap-1.5 ${L.text}`}><span aria-hidden className={`w-[10px] h-[10px] rounded-full border-2 ${L.dot}`} />{L.word}</span>
      </div>
      <h3 className="font-sans text-[1.1rem] sm:text-[1.15rem] leading-snug text-ink font-bold">{title}</h3>
      {detail && <p className="text-[0.98rem] text-ink-2 leading-relaxed line-clamp-2">{detail}</p>}
      <div className="flex flex-wrap items-center gap-x-4">
        {sources && <Sources chips={sources} />}
        {href && <Link href={href} className="ml-auto inline-flex items-center min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-wash">Open</Link>}
      </div>
    </article>
  );
}

export const alertCard = (a: Alert) => <AlertCard key={a.id} area={a.area} level={a.level} title={a.title} detail={a.detail} sources={a.sources} href={a.href} />;

export const gbp0 = (n: number) => `${n < 0 ? "minus " : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
// With the year, for dates that can be more than a year apart (card offers, loans).
export const longDate = (ymd: string) => new Date(ymd.length === 10 ? ymd + "T12:00:00Z" : ymd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
export const longDay = (ymd: string) => new Date(ymd.length === 10 ? ymd + "T12:00:00Z" : ymd).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
