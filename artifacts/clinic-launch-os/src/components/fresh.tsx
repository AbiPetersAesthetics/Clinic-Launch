// The source chip (UX plan 2.5): where a figure came from and how old it is. Fresh is a sage dot,
// ageing amber, stale a hollow dot and the word "stale", failed a red dot. Tapping it opens the
// detail: the source, the run that fetched it and the exact time.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";
import type { Chip } from "@/lib/alfred";

const DOT: Record<string, string> = {
  fresh: "bg-sage-deep border-sage-deep",
  ageing: "bg-watch-bg border-watch",
  stale: "bg-transparent border-ink-muted",
  failed: "bg-act border-act",
  unknown: "bg-transparent border-line-strong",
};

export function StateDot({ state, className = "" }: { state: string; className?: string }) {
  return <span aria-hidden className={`inline-block w-2 h-2 rounded-full border-[1.5px] shrink-0 ${DOT[state] ?? DOT.unknown} ${className}`} />;
}

export function Fresh({ chip, small = false }: { chip: Chip; small?: boolean }) {
  const exact = chip.asOf ? new Date(chip.asOf.length === 10 ? chip.asOf + "T12:00:00Z" : chip.asOf).toLocaleString("en-GB", chip.asOf.length === 10 ? { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" } : { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "never";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1.5 rounded-full leading-none whitespace-nowrap ${small ? "px-0 min-h-[24px] text-[0.7rem] border-0" : "border px-2.5 min-h-[28px] text-[0.72rem]"} ${chip.state === "stale" || chip.state === "failed" ? "border-act/40 text-act" : "border-card-border text-ink-muted"} hover:border-slate`} aria-label={`${chip.text}. Show where this comes from`}>
          <StateDot state={chip.state} />{chip.text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl text-sm space-y-1.5">
        <p className="font-semibold text-ink">{chip.label}</p>
        <p className="text-ink-muted">Figures as at {exact}.</p>
        <p className="text-ink-muted">Kept current by: {chip.by}.</p>
        {chip.state === "stale" && <p className="text-act">Stale: past its freshness limit, so it is left out of every verdict.</p>}
        {chip.state === "ageing" && <p className="text-watch">A run is due and has not saved newer figures yet.</p>}
        <Link href="/activity" className="text-slate underline text-xs">See the runs in Activity</Link>
      </PopoverContent>
    </Popover>
  );
}
