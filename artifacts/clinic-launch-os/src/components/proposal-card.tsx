// A card in "Needs you". Three kinds, each with its own controls:
//   approve  ALFRED wants to do something: Approve or Reject (and a question to ALFRED if needed).
//   answer   ALFRED needs a fact: a plain question, an answer box per item, and Send.
//   decide   A decision made together (for example by Abi and David): who decides and the options.
// Changes to ALFRED's own records are done the moment David approves, with Undo; anything outside
// ALFRED (ads, posts, messages, ANS, the Google profile, the website) is done by the 08:15 run.
// The face is one question or action and a sentence or two of why; the rest is behind "Show evidence".
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decide, dayTime, useHand, type Proposal } from "@/lib/alfred";
import { Sources } from "@/components/fresh";

const AREA: Record<string, string> = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth", patients: "Patients", content: "Studio" };
const firstSentences = (s: string | null, n = 2) => (s ?? "").split(/(?<=[.?!])\s+/).slice(0, n).join(" ");
const btn = "min-h-[44px] px-5 rounded-full text-[0.88rem] font-semibold";

// When the 08:15 run will next do approved outside actions.
export function nextRun() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()).replace(":", "."));
  return h < 8.15 ? "at 08:15 this morning" : "at 08:15 tomorrow";
}

export function afterText(status: string, result?: string | null) {
  switch (status) {
    case "done": return `Done. ${result ?? ""}`.trim();
    case "approved": return result ?? `Approved. It will be done ${nextRun()}, checked first and read back.`;
    case "answered": case "chosen": return "Got it. ALFRED will apply this at the next run.";
    case "asked": return "Your question is with ALFRED. Answered at the next run, usually within a few hours.";
    case "rejected": return "Rejected. ALFRED will not suggest this again unless something changes.";
    case "awaiting": return "Approved, waiting for the money to arrive.";
    default: return "Recorded.";
  }
}

export function ProposalCard({ p, compact = false }: { p: Proposal; compact?: boolean }) {
  const qc = useQueryClient();
  const hand = useHand();
  const kind = p.card_type ?? "approve";
  const outside = p.action_class !== "record";
  const [mode, setMode] = useState<"idle" | "reject" | "ask" | "other">("idle");
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { status: string; result: string | null; until: number }>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    if (!done) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [done]);
  const left = done ? Math.max(0, Math.ceil((done.until - now) / 1000)) : 0;
  useEffect(() => { if (done && left === 0) qc.invalidateQueries({ queryKey: ["alfred"] }); }, [done, left, qc]);

  const send = async (action: "approve" | "reject" | "ask" | "answer" | "choose", extra: Record<string, unknown> = {}) => {
    setBusy(true); setError(null);
    try {
      const r = await decide(p.id, action, extra);
      setDone({ status: r.status, result: r.result, until: Date.now() + 10_000 }); setMode("idle"); setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record that"); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    setBusy(true); setError(null);
    try { await decide(p.id, "undo"); setDone(null); qc.invalidateQueries({ queryKey: ["alfred"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not undo"); }
    finally { setBusy(false); }
  };

  const row = `flex flex-wrap gap-2 ${hand === "right" ? "flex-row-reverse" : ""}`;
  const chips = p.chips ?? [];

  if (done) {
    return (
      <div className="rounded-xl border border-card-border bg-sage-whisper p-4 grid gap-2" aria-live="polite">
        <p className="text-[1rem] font-semibold text-ink">{p.title}</p>
        <p className="text-[0.95rem] text-ink">{afterText(done.status, done.result)}</p>
        {left > 0 && <button type="button" disabled={busy} onClick={undo} className={`${btn} justify-self-start border border-ink text-ink`}>Undo ({left})</button>}
        {error && <p className="text-sm text-act">{error}</p>}
      </div>
    );
  }

  const fields = p.fields ?? [];
  return (
    <article className="rounded-xl border-[1.5px] border-line-strong bg-card p-4 sm:p-5 grid gap-3 min-w-0" aria-label={p.title}>
      <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-ink">{AREA[p.area] ?? p.area}{kind === "answer" ? " · a question for you" : kind === "decide" ? " · to decide together" : ""}</span>
      <h3 className="font-sans font-bold text-[1.1rem] sm:text-[1.15rem] leading-snug text-ink">{p.title}</h3>
      {p.decide_with && <p className="text-[0.92rem] font-semibold text-slate">Decision for {p.decide_with}, together</p>}
      <p className="text-[0.98rem] text-ink-2 leading-relaxed">{open ? p.why : firstSentences(p.why, 1)}</p>
      {kind === "approve" && <p className="text-[0.88rem] text-ink">{outside ? `If you approve, it will be done ${nextRun()}.` : "If you approve, it is done straight away, with Undo."}</p>}
      {p.answer && <p className="text-[0.95rem] rounded-lg bg-wash p-3 text-ink"><span className="font-semibold">ALFRED's answer: </span>{p.answer}</p>}

      {open && (
        <div className="grid gap-1.5 text-[0.88rem] text-ink-2 leading-relaxed border-t border-border pt-2.5">
          {p.risk && <p><span className="font-semibold text-ink">Risk: </span>{p.risk}</p>}
          {p.on_approval && <p><span className="font-semibold text-ink">What happens: </span>{p.on_approval}</p>}
          {p.guard && <p><span className="font-semibold text-ink">Checked first: </span>{p.guard}</p>}
          <p>Raised by {p.agent}, {dayTime(p.created_at)}{p.expires_at ? `; open until ${dayTime(p.expires_at)}` : ""}.</p>
          {chips.length > 0 && <Sources chips={chips} />}
        </div>
      )}
      {compact && <button type="button" onClick={() => setOpen((o) => !o)} className="justify-self-start text-[0.85rem] text-slate underline min-h-[32px]">{open ? "Hide evidence" : "Show evidence"}</button>}

      {kind === "answer" && (
        <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); void send("answer", { values: fields.length ? values : { answer: text } }); }}>
          {fields.length ? fields.map((f) => (
            <label key={f.key} className="grid gap-1 text-[0.9rem] text-ink">{f.label}
              <input type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] bg-background" />
            </label>
          )) : (
            <textarea aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="rounded-xl border border-input px-3 py-2 text-[1rem] bg-background" placeholder="Type your answer" />
          )}
          <button type="submit" disabled={busy || (fields.length ? !Object.values(values).some(Boolean) : !text.trim())} className={`${btn} justify-self-start bg-ink text-white disabled:opacity-50`}>Send</button>
        </form>
      )}

      {kind === "decide" && mode !== "other" && (
        <div className={row}>
          {(p.options ?? []).filter((o) => o !== "Other").map((o) => <button key={o} type="button" disabled={busy} onClick={() => send("choose", { option: o })} className={`${btn} bg-ink text-white`}>{o}</button>)}
          {(p.options ?? []).includes("Other") && <button type="button" onClick={() => setMode("other")} className={`${btn} border border-ink text-ink`}>Other</button>}
        </div>
      )}
      {kind === "decide" && mode === "other" && (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void send("choose", { option: "Other", note: text }); }}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] bg-background" placeholder="Which day, and from when?" />
          <div className={row}><button type="submit" disabled={!text.trim() || busy} className={`${btn} bg-ink text-white disabled:opacity-50`}>Send</button><button type="button" onClick={() => setMode("idle")} className={`${btn} text-ink-2`}>Cancel</button></div>
        </form>
      )}

      {kind === "approve" && mode === "idle" && (
        <div className={row}>
          <button type="button" disabled={busy} onClick={() => send("approve")} className={`${btn} flex-[2] sm:flex-none sm:px-8 bg-ink text-white hover:bg-slate disabled:opacity-50`}>{p.decide_with ? "Agreed together" : "Approve"}</button>
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className={`${btn} flex-1 sm:flex-none border border-ink text-ink`}>Reject</button>
        </div>
      )}
      {kind === "approve" && mode === "reject" && (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void send("reject", { reason: text }); }}>
          <label className="text-[0.9rem] text-ink-2" htmlFor={`r${p.id}`}>Why not? (optional; ALFRED reads it before suggesting this again)</label>
          <input id={`r${p.id}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] bg-background" />
          <div className={row}><button type="submit" disabled={busy} className={`${btn} bg-ink text-white`}>Reject</button><button type="button" onClick={() => { setMode("idle"); setText(""); }} className={`${btn} text-ink-2`}>Cancel</button></div>
        </form>
      )}

      {mode === "ask" ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void send("ask", { question: text }); }}>
          <label className="text-[0.9rem] text-ink" htmlFor={`q${p.id}`}>Ask ALFRED a question</label>
          <input id={`q${p.id}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] bg-background" />
          <p className="text-[0.82rem] text-ink-2">Answered at the next run, usually within a few hours.</p>
          <div className={row}><button type="submit" disabled={busy || !text.trim()} className={`${btn} bg-ink text-white disabled:opacity-50`}>Send</button><button type="button" onClick={() => { setMode("idle"); setText(""); }} className={`${btn} text-ink-2`}>Cancel</button></div>
        </form>
      ) : mode === "idle" && kind !== "answer" && (
        <button type="button" onClick={() => setMode("ask")} className="justify-self-start text-[0.88rem] text-slate underline min-h-[36px]">Ask ALFRED a question</button>
      )}
      {error && <p className="text-sm text-act" role="alert">{error}</p>}
    </article>
  );
}
