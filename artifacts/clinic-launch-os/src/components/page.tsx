// ALFRED's page kit, set like a printed briefing rather than a dashboard: an eyebrow and a serif
// title, sections divided by whitespace and hairline rules, lists as ruled rows. Only the things you
// act on (the "needs you" cards) are boxed, so they stand out.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Alert, Chip } from "@/lib/alfred";
import { Sources } from "@/components/fresh";

export function PageHead({ eyebrow, title, back, children }: { eyebrow: string; title: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="space-y-3">
      {back && <Link href={back.href} className="inline-flex items-center gap-1 min-h-[36px] -ml-1 text-[0.85rem] text-slate"><ChevronLeft className="w-4 h-4" />{back.label}</Link>}
      <div><span className="eyebrow">{eyebrow}</span></div>
      <h1 className="font-sans text-[1.75rem] sm:text-[2.1rem] leading-[1.15] text-ink font-semibold tracking-[-0.015em]">{title}</h1>
      {children}
    </header>
  );
}

export function Section({ title, children, note, id }: { title: string; children: ReactNode; note?: ReactNode; id?: string }) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="eyebrow">{title}</h2>
        {note && <span className="text-[0.78rem] text-ink-muted">{note}</span>}
      </div>
      {children}
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
  watch: { dot: "bg-watch-bg border-watch", word: "Watch", text: "text-watch" },
  stale: { dot: "bg-transparent border-ink-muted", word: "Stale", text: "text-ink-muted" },
};

// A "needs you" card for an alert: the area and a dot with a word, a plain sentence, the detail,
// its sources, and one way in.
export function AlertCard({ area, level, title, detail, sources, href }: { area: string; level: "act" | "watch" | "stale"; title: string; detail?: string; sources?: Chip[]; href?: string }) {
  const L = LEVEL[level];
  return (
    <article className="rounded-xl border border-card-border bg-card p-4 sm:p-5 grid gap-2 min-w-0">
      <div className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
        <span className="text-slate">{AREA[area] ?? area}</span>
        <span className={`inline-flex items-center gap-1.5 ${L.text}`}><span aria-hidden className={`w-[8px] h-[8px] rounded-full border-2 ${L.dot}`} />{L.word}</span>
      </div>
      <h3 className="font-sans text-[1.06rem] sm:text-[1.1rem] leading-snug text-ink font-semibold">{title}</h3>
      {detail && <p className="text-[0.95rem] text-ink-2 leading-relaxed line-clamp-3 sm:line-clamp-none">{detail}</p>}
      <div className="flex flex-wrap items-center gap-x-4">
        {sources && <Sources chips={sources} />}
        {href && <Link href={href} className="ml-auto inline-flex items-center min-h-[44px] px-5 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-wash">Open</Link>}
      </div>
    </article>
  );
}

export const alertCard = (a: Alert) => <AlertCard key={a.id} area={a.area} level={a.level} title={a.title} detail={a.detail} sources={a.sources} href={a.href} />;

export const gbp0 = (n: number) => `${n < 0 ? "minus " : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
export const longDay = (ymd: string) => new Date(ymd.length === 10 ? ymd + "T12:00:00Z" : ymd).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
