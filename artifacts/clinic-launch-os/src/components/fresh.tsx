// Where a figure came from and how old it is, as quiet small print (UX plan 2.5): a small dot and
// words, never a badge. Fresh is a sage dot, ageing amber, stale a hollow dot and the word "stale",
// failed red. Tapping it shows the source, the run that keeps it and the exact time.
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
  return <span aria-hidden className={`inline-block w-[7px] h-[7px] rounded-full border-[1.5px] shrink-0 ${DOT[state] ?? DOT.unknown} ${className}`} />;
}

export function Fresh({ chip }: { chip: Chip; small?: boolean }) {
  const iso = chip.asOf;
  const exact = iso ? new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleString("en-GB", iso.length === 10 ? { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" } : { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "never";
  const bad = chip.state === "stale" || chip.state === "failed";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1.5 min-h-[28px] text-[0.72rem] leading-none whitespace-nowrap underline-offset-2 hover:underline ${bad ? "text-act" : "text-ink-muted"}`} aria-label={`${chip.text}. Where this comes from`}>
          <StateDot state={chip.state} />{chip.text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl text-sm space-y-1.5 shadow-none border-card-border">
        <p className="font-semibold text-ink">{chip.label}</p>
        <p className="text-ink-muted">Figures as at {exact}.</p>
        <p className="text-ink-muted">Kept current by: {chip.by}.</p>
        {chip.state === "stale" && <p className="text-act">Stale: past its freshness limit, so it is left out of every verdict.</p>}
        {chip.state === "ageing" && <p className="text-watch">A run is due and has not saved newer figures yet.</p>}
        <Link href="/sources" className="text-slate underline text-xs">All sources</Link>
      </PopoverContent>
    </Popover>
  );
}

export function Sources({ chips }: { chips: Chip[] }) {
  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-x-4 gap-y-0">{chips.map((c, i) => <Fresh key={c.source + i} chip={c} />)}</div>;
}
