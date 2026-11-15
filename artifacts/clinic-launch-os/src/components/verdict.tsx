// The verdict line (UX plan 2.4): a dot and a word for the state, never colour alone, then one
// sentence. Stale replaces the verdict with a hollow dot.
import type { Chip, Tone } from "@/lib/alfred";
import { toneWord } from "@/lib/alfred";
import { Fresh } from "@/components/fresh";

const DOT: Record<Tone, string> = { good: "bg-sage border-sage-deep", watch: "bg-watch-bg border-watch", act: "bg-act border-act", stale: "bg-transparent border-ink-muted" };
const WORD: Record<Tone, string> = { good: "text-good", watch: "text-watch", act: "text-act", stale: "text-ink-muted" };

export function Verdict({ state, text, sources, size = "lg" }: { state: Tone; text: string; sources?: Chip[]; size?: "lg" | "md" }) {
  const sentence = text.replace(/^(On track|Watch|Act|Stale)[.:]\s*/, "");
  return (
    <div className="grid gap-2">
      <p className={`font-display text-ink leading-snug ${size === "lg" ? "text-[1.25rem] sm:text-[1.4rem]" : "text-[1.1rem]"}`}>
        <span className={`inline-flex items-center gap-2 mr-2 align-[0.1em] text-[0.72rem] font-sans font-semibold uppercase tracking-[0.16em] ${WORD[state]}`}>
          <span aria-hidden className={`inline-block w-3 h-3 rounded-full border-2 ${DOT[state]}`} />{toneWord[state]}
        </span>
        {sentence}
      </p>
      {sources && sources.length > 0 && <div className="flex flex-wrap gap-1.5">{sources.map((c) => <Fresh key={c.source} chip={c} />)}</div>}
    </div>
  );
}
