// A proposal (UX plan 2.6): area and agent, the action as a verb phrase, why, the risk, what happens
// on approval, the expiry, then Approve, Reject and Ask. Approve is the widest button and sits at
// bottom left for the left thumb (mirrored for a right hand in Settings). A tap only records the
// decision: approved items wait for the next live session and one "go" in chat.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decide, dayTime, useHand, type Proposal } from "@/lib/alfred";
import { Fresh } from "@/components/fresh";

const AREA: Record<string, string> = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth", content: "Content" };

export function ProposalCard({ p, compact = false }: { p: Proposal; compact?: boolean }) {
  const qc = useQueryClient();
  const hand = useHand();
  const [mode, setMode] = useState<"idle" | "reject" | "ask">("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { action: string; until: number }>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(!compact);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!done) return;
    timer.current = window.setInterval(() => setNow(Date.now()), 250);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [done]);
  const left = done ? Math.max(0, Math.ceil((done.until - now) / 1000)) : 0;
  useEffect(() => {
    if (done && left === 0) { qc.invalidateQueries({ queryKey: ["alfred"] }); }
  }, [done, left, qc]);

  const act = async (action: "approve" | "reject" | "ask" | "snooze") => {
    setBusy(true); setError(null);
    try {
      await decide(p.id, action, action === "reject" ? { reason: text } : action === "ask" ? { question: text } : {});
      setDone({ action, until: Date.now() + 10_000 }); setMode("idle"); setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record that"); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    setBusy(true); setError(null);
    try { await decide(p.id, "undo"); setDone(null); qc.invalidateQueries({ queryKey: ["alfred"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not undo"); }
    finally { setBusy(false); }
  };

  const expires = p.expires_at ? `Expires ${dayTime(p.expires_at)}` : null;
  const chips = p.chips ?? [];
  const row = `flex gap-2 ${hand === "right" ? "flex-row-reverse" : ""}`;

  if (done && left > 0) {
    const word = done.action === "approve" ? "Approved, queued for the next live session." : done.action === "reject" ? "Rejected; the reason is kept with the card." : done.action === "ask" ? "Asked; the next run of this agent answers here." : "Snoozed for a day.";
    return (
      <div className="rounded-xl border border-card-border bg-sage-whisper p-4 grid gap-3" aria-live="polite">
        <p className="text-sm text-ink"><b className="font-semibold">{p.title}</b></p>
        <div className={`${row} items-center justify-between`}>
          <p className="text-sm text-ink">{word}</p>
          <button type="button" disabled={busy} onClick={undo} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-ink hover:bg-wash shrink-0">Undo {left}</button>
        </div>
        {error && <p className="text-sm text-act">{error}</p>}
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-card-border bg-card p-4 sm:p-5 grid gap-3 min-w-0" aria-label={`Proposal: ${p.title}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="eyebrow">{AREA[p.area] ?? p.area}</span>
        <span className="text-[0.75rem] text-ink-muted">{p.agent}, {dayTime(p.created_at)}</span>
        {p.status === "asked" && <span className="text-[0.7rem] rounded-full bg-watch-bg text-watch px-2 py-0.5">Asked</span>}
      </div>
      <h3 className="font-display text-[1.15rem] sm:text-[1.2rem] leading-snug text-ink">{p.title}</h3>
      {open ? (
        <div className="grid gap-1.5 text-[0.9rem] text-ink leading-relaxed">
          {p.why && <p><span className="font-semibold">Why: </span>{p.why}</p>}
          {p.risk && <p><span className="font-semibold">Risk: </span>{p.risk}</p>}
          {p.on_approval && <p><span className="font-semibold">If approved: </span>{p.on_approval}</p>}
          {p.guard && <p className="text-ink-muted"><span className="font-semibold">Guard: </span>{p.guard}</p>}
          {p.question && <p className="text-ink-muted"><span className="font-semibold">You asked: </span>{p.question}</p>}
          {p.answer && <p className="rounded-lg bg-wash p-2.5"><span className="font-semibold">Answer: </span>{p.answer}</p>}
        </div>
      ) : (
        p.why && <p className="text-[0.9rem] text-ink leading-relaxed line-clamp-2">{p.why}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => <Fresh key={c.source} chip={c} />)}
        {expires && <span className="text-[0.75rem] text-ink-muted">{expires}</span>}
        {compact && <button type="button" onClick={() => setOpen((o) => !o)} className="text-[0.75rem] text-slate underline ml-auto min-h-[28px]">{open ? "Less" : "Show evidence"}</button>}
      </div>

      {mode !== "idle" && (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void act(mode); }}>
          <label className="text-sm text-ink-muted" htmlFor={`t${p.id}`}>{mode === "reject" ? "Why not? (optional, the agent reads it before proposing again)" : "What would you like to know?"}</label>
          <input id={`t${p.id}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] bg-background" placeholder={mode === "reject" ? "For example: hold spend until after the model days" : "For example: what would make you confident?"} />
          <div className={row}>
            <button type="submit" disabled={busy || (mode === "ask" && !text.trim())} className="min-h-[44px] flex-1 sm:flex-none px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em] disabled:opacity-50">{mode === "reject" ? "Reject" : "Send"}</button>
            <button type="button" onClick={() => { setMode("idle"); setText(""); }} className="min-h-[44px] px-4 rounded-full text-[0.85rem] text-ink-muted">Cancel</button>
          </div>
        </form>
      )}

      {mode === "idle" && (
        <div className={row}>
          <button type="button" disabled={busy} onClick={() => act("approve")} className="min-h-[44px] flex-[2] px-3 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em] hover:bg-slate disabled:opacity-50">Approve</button>
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className="min-h-[44px] flex-1 px-3 rounded-full border border-ink text-ink text-[0.78rem] font-semibold uppercase tracking-[0.14em] hover:bg-wash">Reject</button>
          <button type="button" disabled={busy} onClick={() => setMode("ask")} className="min-h-[44px] flex-1 px-2 rounded-full text-ink text-[0.78rem] font-semibold uppercase tracking-[0.14em] hover:bg-wash">Ask</button>
        </div>
      )}
      {error && <p className="text-sm text-act" role="alert">{error}</p>}
    </article>
  );
}
