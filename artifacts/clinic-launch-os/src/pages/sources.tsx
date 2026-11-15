// Sources: every data source ALFRED reads, when it was last read, what keeps it current and when it
// runs next, and whether it is healthy. A source past its limit is marked stale here and on every
// figure that uses it.
import { usePage, dayTime } from "@/lib/alfred";
import { StateDot } from "@/components/fresh";
import { Page, PageHead, Rows } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";

const WORD: Record<string, string> = { fresh: "Healthy", ageing: "A run is due", stale: "Stale", failed: "Last run failed", unknown: "No data yet" };

export default function SourcesPage() {
  const { data } = usePage("sources");
  const list: any[] = data?.sources ?? [];
  const bad = list.filter((s) => s.chip.state === "stale" || s.chip.state === "failed" || s.chip.state === "unknown");
  return (
    <Page>
      <PageHead eyebrow="More" title="Sources" back={{ href: "/more", label: "More" }}>
        {data && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{bad.length ? `${bad.length} of ${list.length} sources need attention: ${bad.map((s) => s.label).join(", ")}.` : `All ${list.length} sources are current.`}</p>}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <Rows>
          {list.map((s) => (
            <li key={s.key} className="py-3 border-b border-border grid gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{s.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${s.chip.state === "fresh" ? "text-good" : s.chip.state === "ageing" ? "text-watch" : "text-act"}`}><StateDot state={s.chip.state} />{WORD[s.chip.state] ?? s.chip.state}</span>
              </div>
              <p className="text-[0.85rem] text-ink-muted">{s.what}. {s.chip.text}.</p>
              <p className="text-[0.8rem] text-ink-muted">{s.agent ? `${s.agent}: ` : ""}{s.next ? `runs ${s.next}` : ""}{s.last ? `; last ${s.last.status} ${dayTime(s.last.started_at ?? s.last.finished_at)}` : s.agent ? "; no run logged yet" : ""}</p>
            </li>
          ))}
        </Rows>
      )}
    </Page>
  );
}
