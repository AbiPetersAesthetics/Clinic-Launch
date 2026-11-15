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
      <p className={`font-display text-ink leading-[1.35] ${size === "lg" ? "text-[1.3rem] sm:text-[1.55rem]" : "text-[1.15rem] sm:text-[1.3rem]"} max-w-[38ch] sm:max-w-[52ch]`}>{sentence}</p>
      {sources && <Sources chips={sources} />}
    </div>
  );
}
