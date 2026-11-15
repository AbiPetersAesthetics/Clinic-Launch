// The verdict: a real sentence in the serif face, set large and calm, introduced by a small dot and
// a word for the state (never colour alone). The sources follow as quiet small print.
import type { Chip, Tone } from "@/lib/alfred";
import { toneWord } from "@/lib/alfred";
import { Sources } from "@/components/fresh";

const DOT: Record<Tone, string> = { good: "bg-good border-good", watch: "bg-watch border-watch", act: "bg-act border-act", stale: "bg-transparent border-ink-muted" };
const WORD: Record<Tone, string> = { good: "text-good", watch: "text-watch", act: "text-act", stale: "text-ink-muted" };

export function StateWord({ state, dark = false }: { state: Tone; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] ${dark ? "text-white" : WORD[state]}`}>
      <span aria-hidden className={`inline-block w-[11px] h-[11px] rounded-full border-2 ${DOT[state]}`} />{toneWord[state]}
    </span>
  );
}

export function Verdict({ state, text, sources, size = "lg", dark = false }: { state: Tone; text: string; sources?: Chip[]; size?: "lg" | "md"; dark?: boolean }) {
  const sentence = text.replace(/^(On track|Watch|Act|Stale)[.:]\s*/, "");
  return (
    <div className="grid gap-2">
      <StateWord state={state} dark={dark} />
      <p className={`font-sans font-bold ${dark ? "text-white" : "text-ink"} leading-snug tracking-[-0.015em] ${size === "lg" ? "text-[1.5rem] sm:text-[1.85rem]" : "text-[1.25rem] sm:text-[1.5rem]"} max-w-[28ch] sm:max-w-[42ch]`}>{sentence}</p>
      {sources && <Sources chips={sources} />}
    </div>
  );
}
