// The approval inbox (UX plan 2.6 and wireframe 5.4): open proposals grouped by kind, Approve all
// for a group, what is queued for the next live session (with a way to take it back), snoozed
// items and the decided history. Keyboard: J and K move, A approves, X rejects, Q asks.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProposals, decide, dayTime, type Proposal } from "@/lib/alfred";
import { ProposalCard } from "@/components/proposal-card";
import { Skeleton } from "@/components/ui/skeleton";

const AREA: Record<string, string> = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth", content: "Content" };
const STATUS: Record<string, string> = { rejected: "Rejected", expired: "Expired", done: "Done", cancelled: "Cancelled at re-check", withdrawn: "Withdrawn" };

export default function InboxPage() {
  const { data, isLoading } = useProposals();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "decided" | "snoozed">("open");
  const [focus, setFocus] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    for (const p of data?.open ?? []) m.set(p.area, [...(m.get(p.area) ?? []), p]);
    return [...m.entries()];
  }, [data]);
  const flat = groups.flatMap(([, ps]) => ps);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (tab !== "open" || e.ctrlKey || e.metaKey || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "j") setFocus((f) => Math.min(flat.length - 1, f + 1));
      else if (k === "k") setFocus((f) => Math.max(0, f - 1));
      else if ((k === "a" || k === "x") && flat[focus]) {
        try { await decide(flat[focus].id, k === "a" ? "approve" : "reject"); setMsg(`${k === "a" ? "Approved, queued" : "Rejected"}: ${flat[focus].title}`); qc.invalidateQueries({ queryKey: ["alfred"] }); } catch (err) { setMsg(err instanceof Error ? err.message : "Could not record that"); }
      } else if (k === "q") document.querySelectorAll<HTMLElement>("[data-proposal]")[focus]?.querySelectorAll("button")[2]?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, flat, focus, qc]);

  const approveAll = async (ps: Proposal[]) => {
    if (!window.confirm(`Approve all ${ps.length}?\n\n${ps.map((p) => `- ${p.title}`).join("\n")}\n\nThey wait for the next live session and one "go" in chat.`)) return;
    for (const p of ps) { try { await decide(p.id, "approve"); } catch { /* shown on the card after refresh */ } }
    setMsg(`${ps.length} approved, queued for the next live session.`);
    qc.invalidateQueries({ queryKey: ["alfred"] });
  };
  const unqueue = async (p: Proposal) => { try { await decide(p.id, "unqueue"); qc.invalidateQueries({ queryKey: ["alfred"] }); } catch (e) { setMsg(e instanceof Error ? e.message : "Could not take it back"); } };

  const tabBtn = (id: typeof tab, label: string, n?: number) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-[40px] px-4 rounded-full text-[0.85rem] font-semibold ${tab === id ? "bg-ink text-white" : "bg-wash text-ink"}`}>{label}{n != null ? ` ${n}` : ""}</button>
  );
  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-3">
        <span className="eyebrow">Inbox</span>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">What the agents propose</h1>
        <p className="text-ink-muted text-[0.95rem]">A tap records your decision; nothing is changed here. Approved items wait for the next live Claude session, which lists them for one "go", re-checks each guard and then acts.</p>
        <div role="tablist" className="flex flex-wrap gap-2">{tabBtn("open", "Open", data?.open.length)}{tabBtn("decided", "Decided")}{tabBtn("snoozed", "Snoozed", data?.snoozed.length)}</div>
      </header>
      {msg && <p role="status" aria-live="polite" className="text-[0.9rem] text-good">{msg}</p>}
      {isLoading && <Skeleton className="h-48 rounded-xl" />}
      {tab === "open" && data && (
        <>
          {groups.length === 0 && <div className="rounded-xl bg-sage-whisper p-5"><p className="font-display text-[1.15rem]">Nothing waiting for a decision.</p></div>}
          {groups.map(([area, ps]) => (
            <section key={area} className="space-y-3">
              <div className="flex items-center justify-between gap-2"><h2 className="eyebrow">{AREA[area] ?? area} ({ps.length})</h2>
                {ps.length > 1 && <button type="button" onClick={() => approveAll(ps)} className="min-h-[40px] px-4 rounded-full border border-ink text-[0.75rem] font-semibold uppercase tracking-[0.14em]">Approve all</button>}</div>
              {ps.map((p) => <div key={p.id} data-proposal className={flat[focus]?.id === p.id ? "ring-2 ring-sage-deep ring-offset-2 rounded-xl" : ""}><ProposalCard p={p} /></div>)}
            </section>
          ))}
          {data.queued.length > 0 && (
            <section className="space-y-2">
              <h2 className="eyebrow">Queued for the next live session ({data.queued.length})</h2>
              <ul className="divide-y divide-border rounded-xl border border-card-border">
                {data.queued.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-2 min-h-[52px]"><span className="flex-1 min-w-0 text-[0.9rem]">{p.title} <span className="text-ink-muted">(approved {p.decided_at ? dayTime(p.decided_at) : ""})</span></span><button type="button" onClick={() => unqueue(p)} className="min-h-[40px] px-4 rounded-full border border-ink text-[0.72rem] font-semibold uppercase tracking-[0.14em]">Take back</button></li>)}
              </ul>
            </section>
          )}
          <p className="hidden md:block text-[0.8rem] text-ink-muted">Keyboard: J and K move, A approves, X rejects, Q asks.</p>
        </>
      )}
      {tab === "snoozed" && data && (data.snoozed.length ? data.snoozed.map((p) => <div key={p.id} className="rounded-xl border border-card-border p-4"><p className="font-semibold">{p.title}</p><p className="text-[0.85rem] text-ink-muted">Back {p.snooze_until ? dayTime(p.snooze_until) : "soon"}</p></div>) : <p className="text-ink-muted">Nothing snoozed.</p>)}
      {tab === "decided" && data && (data.decided.length ? (
        <ul className="divide-y divide-border rounded-xl border border-card-border">
          {data.decided.map((p) => <li key={p.id} className="px-4 py-3 grid gap-0.5"><span className="font-semibold text-[0.95rem]">{p.title}</span><span className="text-[0.82rem] text-ink-muted">{STATUS[p.status] ?? p.status}, {dayTime(p.updated_at)}{p.reason ? `: ${p.reason}` : ""}{p.result ? `: ${p.result}` : ""}</span></li>)}
        </ul>
      ) : <p className="text-ink-muted">No decisions in the last 30 days.</p>)}
    </div>
  );
}
