// The verdict: a real sentence in the serif face, set large and calm, introduced by a small dot and
// a word for the state (never colour alone). The sources follow as quiet small print.
import type { Chip, Tone } from "@/lib/alfred";
import { toneWord } from "@/lib/alfred";
import { Sources } from "@/components/fresh";

const DOT: Record<Tone, string> = { good: "bg-sage border-sage-deep", watch: "bg-watch-bg border-watch", act: "bg-act border-act", stale: "bg-transparent border-ink-muted" };
const WORD: Record<Tone, string> = { good: "text-good", watch: "text-watch", act: "text-act", stale: "text-ink-muted" };

export function StateWord({ state }: { state: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${WORD[state]}`}>
      <span aria-hidden className={`inline-block w-[9px] h-[9px] rounded-full border-2 ${DOT[state]}`} />{toneWord[state]}
    </span>
  );
}

export function Verdict({ state, text, sources, size = "lg" }: { state: Tone; text: string; sources?: Chip[]; size?: "lg" | "md" }) {
  const sentence = text.replace(/^(On track|Watch|Act|Stale)[.:]\s*/, "");
  return (
    <div className="grid gap-2">
      <StateWord state={state} />
      <p className={`font-sans font-semibold text-ink leading-snug tracking-[-0.01em] ${size === "lg" ? "text-[1.4rem] sm:text-[1.7rem]" : "text-[1.2rem] sm:text-[1.4rem]"} max-w-[30ch] sm:max-w-[44ch]`}>{sentence}</p>
      {sources && <Sources chips={sources} />}
    </div>
  );
}
