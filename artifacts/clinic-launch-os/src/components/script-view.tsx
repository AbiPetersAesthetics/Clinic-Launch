// A video script, laid out to read from like a teleprompter: large type, one line per paragraph,
// lines dropped from the short cut shown in grey, then the hook and end cards, the shots, the staging
// and what is needed on the day. Older clips without a script keep their "Open the script" link.
import { useState } from "react";

export interface Script {
  fullCut?: string[]; shortCutDrop?: (number | string)[]; hookCard?: string; endCard?: string; shots?: string[];
  staging?: string; caption?: string; headline?: string; button?: string; needs?: string[]; wordsFull?: number; wordsShort?: number; priceStatus?: string;
}

export function ScriptView({ script, scriptRef, open: startOpen = false }: { script?: Script | null; scriptRef?: string | null; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  if (!script) return scriptRef ? <a href={scriptRef} target="_blank" rel="noreferrer" className="text-[0.95rem] text-ink font-semibold underline min-h-[40px] inline-flex items-center">Open the script</a> : null;
  const lines = script.fullCut ?? [];
  const dropped = (i: number, line: string) => (script.shortCutDrop ?? []).some((d) => (typeof d === "number" ? d === i : String(d).trim() === line.trim()));
  return (
    <div className="grid gap-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="justify-self-start min-h-[44px] px-5 rounded-full border-[1.5px] border-ink text-[0.9rem] font-semibold text-ink">{open ? "Hide the script" : "Read the script"}</button>
      {open && (
        <div className="grid gap-5 rounded-xl border-[1.5px] border-line-strong p-4 sm:p-6">
          {script.hookCard && <p className="text-[0.85rem] font-extrabold uppercase tracking-[0.12em] text-ink">On screen first: {script.hookCard}</p>}
          <ol className="grid gap-4">
            {lines.map((l, i) => (
              <li key={i} className={`text-[1.35rem] sm:text-[1.6rem] leading-snug font-semibold ${dropped(i, l) ? "text-ink-muted/60" : "text-ink"}`}>
                {l}{dropped(i, l) && <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-ink-muted mt-1">full cut only</span>}
              </li>
            ))}
          </ol>
          <p className="text-[0.9rem] text-ink-2">{script.wordsFull ? `${script.wordsFull} words in the full cut` : ""}{script.wordsShort ? `, ${script.wordsShort} in the short cut` : ""}{script.endCard ? `. End card: ${script.endCard}` : ""}</p>
          {script.priceStatus && <p className="text-[0.95rem] font-semibold text-watch">{script.priceStatus}</p>}
          {script.shots?.length ? (
            <div className="grid gap-2"><h4 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink">Shots</h4>
              <ol className="grid gap-1.5 list-decimal pl-5 text-[1rem] text-ink leading-relaxed">{script.shots.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
          ) : null}
          {script.staging && <div className="grid gap-1"><h4 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink">How to film it</h4><p className="text-[1rem] text-ink leading-relaxed">{script.staging}</p></div>}
          {script.needs?.length ? (
            <div className="grid gap-2"><h4 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink">Needed on the day</h4>
              <ul className="grid gap-1.5 list-disc pl-5 text-[1rem] text-ink leading-relaxed">{script.needs.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          ) : null}
          {script.caption && <details className="text-[0.95rem] text-ink-2"><summary className="cursor-pointer font-semibold text-ink min-h-[36px]">Caption and ad text</summary><p className="whitespace-pre-line leading-relaxed mt-2">{script.caption}</p>{script.headline && <p className="mt-2">Headline: {script.headline}{script.button ? `; button: ${script.button}` : ""}</p>}</details>}
        </div>
      )}
    </div>
  );
}
