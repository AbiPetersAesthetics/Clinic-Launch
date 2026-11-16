// Ready for Winchester (/abi/ready): Abi's countdown to the first patients on 2 December 2026.
// One phone screen: days to go, what is due this week, then each area as a short list. Every item
// opens to a first draft she can edit, a status and her notes; ticks save to the database so David
// sees the same list. Built for the phone first (44px targets, one column).
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Page, PageHead, longDay } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ID } from "@/lib/alfred";

type Status = "todo" | "doing" | "done" | "na";
interface Item { id: number; key: string; section: string; order: number; title: string; draft: string | null; edited: boolean; due: string | null; owner: "Abi" | "David" | "Both"; status: Status; note: string | null }
interface SectionInfo { key: string; title: string; blurb: string; total: number; done: number }
interface Ready { today: string; firstPatients: string; opening: string; daysToFirstPatients: number; daysToOpening: number; sections: SectionInfo[]; items: Item[]; counts: { total: number; done: number; overdue: number; thisWeek: number }; thisWeek: number[] }

const URL = `/api/projects/${PROJECT_ID}/readiness`;
const KEY = ["alfred", "readiness"];
const STATUS: { v: Status; label: string }[] = [{ v: "todo", label: "To do" }, { v: "doing", label: "Doing" }, { v: "done", label: "Done" }, { v: "na", label: "Not needed" }];
type Who = "all" | "Abi" | "David";

function useSave() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const call = async (method: string, url: string, body: unknown) => {
    setErr(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Could not save. Try again."); return false; }
    qc.setQueryData(KEY, j);
    return true;
  };
  return { call, err };
}

// The drafts use a tiny markup: "- " bullets, "## " headings, blank lines between paragraphs.
function Draft({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="grid gap-2.5 text-[0.95rem] leading-relaxed text-ink">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const out: ReactNode[] = [];
        let bullets: string[] = [];
        const flush = () => { if (bullets.length) { out.push(<ul key={`u${out.length}`} className="list-disc pl-5 grid gap-1">{bullets.map((x, k) => <li key={k}>{x}</li>)}</ul>); bullets = []; } };
        for (const l of lines) {
          if (l.startsWith("- ")) bullets.push(l.slice(2));
          else if (l.startsWith("## ")) { flush(); out.push(<h4 key={`h${out.length}`} className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-muted pt-1">{l.slice(3)}</h4>); }
          else { flush(); out.push(<p key={`p${out.length}`}>{l}</p>); }
        }
        flush();
        return <div key={i} className="grid gap-1.5">{out}</div>;
      })}
    </div>
  );
}

function Tick({ item, onToggle }: { item: Item; onToggle: () => void }) {
  const done = item.status === "done", na = item.status === "na";
  return (
    <button type="button" onClick={onToggle} aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
      className={`shrink-0 w-11 h-11 -ml-1.5 grid place-items-center rounded-full`}>
      <span className={`w-6 h-6 rounded-full border-2 grid place-items-center ${done ? "bg-ink border-ink text-white" : na ? "border-ink-muted/40" : item.status === "doing" ? "border-ink border-dashed" : "border-ink"}`}>
        {done && <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
    </button>
  );
}

function dueText(due: string | null, today: string) {
  if (!due) return null;
  const d = Math.round((Date.parse(due + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
  if (d < 0) return { text: `Overdue, was ${longDay(due)}`, tone: "text-act" };
  if (d === 0) return { text: "Today", tone: "text-act" };
  if (d === 1) return { text: "Tomorrow", tone: "text-watch" };
  return { text: longDay(due), tone: d <= 3 ? "text-watch" : "text-ink-muted" };
}

function ItemRow({ item, today, save }: { item: Item; today: string; save: ReturnType<typeof useSave> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.draft ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const due = dueText(item.status === "done" || item.status === "na" ? null : item.due, today);
  const patch = (body: Record<string, unknown>) => save.call("PATCH", `${URL}/${item.id}`, body);
  const finished = item.status === "done" || item.status === "na";
  return (
    <li className="border-b border-border">
      <div className="flex items-start gap-2 py-1.5">
        <Tick item={item} onToggle={() => void patch({ status: item.status === "done" ? "todo" : "done" })} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex-1 min-w-0 text-left py-2">
          <span className={`block text-[0.98rem] leading-snug ${finished ? "text-ink-muted line-through decoration-1" : "text-ink"}`}>{item.title}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.78rem] mt-0.5">
            {due && <span className={due.tone}>{due.text}</span>}
            {item.owner !== "Abi" && <span className="text-ink-muted">{item.owner === "David" ? "David's" : "Together"}</span>}
            {item.status === "doing" && <span className="text-ink-muted">In progress</span>}
            {item.status === "na" && <span className="text-ink-muted">Not needed</span>}
            {item.note && <span className="text-ink-muted">Has a note</span>}
          </span>
        </button>
        <span aria-hidden="true" className={`pt-3.5 pr-1 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </div>
      {open && (
        <div className="pb-5 pl-9 grid gap-4 min-w-0">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
            {STATUS.map((s) => (
              <button key={s.v} type="button" onClick={() => void patch({ status: s.v })} aria-pressed={item.status === s.v}
                className={`min-h-[40px] px-3.5 rounded-full border text-[0.8rem] ${item.status === s.v ? "bg-ink text-white border-ink" : "border-line-strong text-ink"}`}>{s.label}</button>
            ))}
          </div>
          {editing ? (
            <div className="grid gap-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="w-full rounded-xl border border-input p-3 text-[0.95rem] leading-relaxed text-ink" />
              <p className="text-[0.75rem] text-ink-muted">Start a line with "- " for a bullet. Leave a blank line between paragraphs.</p>
              <div className="flex gap-2">
                <button type="button" onClick={async () => { if (await patch({ draft })) setEditing(false); }} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Save</button>
                <button type="button" onClick={() => { setDraft(item.draft ?? ""); setEditing(false); }} className="min-h-[44px] px-5 rounded-full border border-line-strong text-ink text-[0.78rem] font-semibold uppercase tracking-[0.16em]">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 min-w-0">
              {item.draft ? <Draft text={item.draft} /> : <p className="text-[0.9rem] text-ink-muted">No draft yet. Write how you want this to work.</p>}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditing(true)} className="min-h-[44px] px-5 rounded-full border border-ink text-ink text-[0.78rem] font-semibold uppercase tracking-[0.16em]">{item.draft ? "Edit this" : "Write it"}</button>
                {item.edited && <span className="text-[0.75rem] text-ink-muted">Edited by you</span>}
              </div>
            </div>
          )}
          <label className="grid gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Notes
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (item.note ?? "")) void patch({ note }); }} rows={3}
              placeholder="Questions, what is missing, who to ask" className="w-full rounded-xl border border-input p-3 text-[0.95rem] font-normal normal-case tracking-normal text-ink" />
          </label>
        </div>
      )}
    </li>
  );
}

function AddItem({ section, save }: { section: string; save: ReturnType<typeof useSave> }) {
  const [title, setTitle] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (title.trim() && await save.call("POST", URL, { section, title })) setTitle(""); }} className="flex gap-2 pt-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add something to this list" aria-label="Add something to this list"
        className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-input px-3 text-[1rem] text-ink" />
      <button type="submit" disabled={!title.trim()} className="min-h-[44px] px-5 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em] disabled:opacity-40">Add</button>
    </form>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-ink rounded-full" style={{ width: `${pct}%` }} /></div>;
}

export default function ReadyPage() {
  const { data } = useQuery({ queryKey: KEY, queryFn: async () => { const r = await fetch(URL, { cache: "no-store" }); if (!r.ok) throw new Error("Could not load"); return r.json() as Promise<Ready>; } });
  const save = useSave();
  const [who, setWho] = useState<Who>("all");
  const [hideDone, setHideDone] = useState(false);
  const [openSec, setOpenSec] = useState<string | null>(null);
  const items = useMemo(() => (data?.items ?? []).filter((i) => (who === "all" || i.owner === who || i.owner === "Both") && (!hideDone || (i.status !== "done" && i.status !== "na"))), [data, who, hideDone]);
  const week = useMemo(() => (data?.thisWeek ?? []).map((id) => items.find((i) => i.id === id)).filter(Boolean) as Item[], [data, items]);

  return (
    <Page>
      <PageHead eyebrow="For Abi" title="Ready for Winchester" back={{ href: "/abi", label: "Abi" }}>
        {data && (
          <div className="grid gap-3 max-w-[46ch]">
            <p className="font-sans font-semibold text-[1.3rem] leading-snug text-ink">
              {data.daysToFirstPatients > 0 ? `${data.daysToFirstPatients} days to the first patients on ${longDay(data.firstPatients)}.` : data.daysToOpening > 0 ? `Model days are here. ${data.daysToOpening} days to opening.` : "Open."}
              {" "}{data.counts.done} of {data.counts.total} done.
            </p>
            <Bar done={data.counts.done} total={data.counts.total} />
            {data.counts.overdue > 0 && <p className="text-[0.9rem] text-act">{data.counts.overdue} {data.counts.overdue === 1 ? "item is" : "items are"} past the date set. Move the date if it is wrong; that is fine.</p>}
          </div>
        )}
      </PageHead>
      {!data ? <Skeleton className="h-60 rounded-xl" /> : (
        <div className="grid gap-8">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {(["all", "Abi", "David"] as Who[]).map((w) => (
              <button key={w} type="button" onClick={() => setWho(w)} aria-pressed={who === w} className={`min-h-[40px] px-4 rounded-full border text-[0.82rem] ${who === w ? "bg-ink text-white border-ink" : "border-line-strong text-ink"}`}>{w === "all" ? "Everything" : w === "Abi" ? "Mine" : "David's"}</button>
            ))}
            <button type="button" onClick={() => setHideDone(!hideDone)} aria-pressed={hideDone} className={`min-h-[40px] px-4 rounded-full border text-[0.82rem] ${hideDone ? "bg-ink text-white border-ink" : "border-line-strong text-ink"}`}>Hide done</button>
          </div>

          <section className="grid gap-2">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">This week</h2>
            {week.length ? <ul>{week.map((i) => <ItemRow key={`w${i.id}`} item={i} today={data.today} save={save} />)}</ul>
              : <p className="text-[0.95rem] text-ink-muted">Nothing due in the next seven days{who !== "all" ? " for this view" : ""}.</p>}
          </section>

          <section className="grid gap-2">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Everything, by area</h2>
            <div className="grid">
              {data.sections.map((s) => {
                const mine = items.filter((i) => i.section === s.key);
                const isOpen = openSec === s.key;
                return (
                  <div key={s.key} className="border-t border-line-strong">
                    <button type="button" onClick={() => setOpenSec(isOpen ? null : s.key)} aria-expanded={isOpen} className="w-full text-left py-4 grid gap-2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-sans text-[1.15rem] font-medium text-ink">{s.title}</span>
                        <span className="tabular text-[0.85rem] text-ink-muted shrink-0">{s.done} of {s.total}</span>
                      </span>
                      <Bar done={s.done} total={s.total} />
                    </button>
                    {isOpen && (
                      <div className="pb-6 min-w-0">
                        <p className="text-[0.9rem] text-ink-muted max-w-[60ch] pb-2">{s.blurb}</p>
                        {mine.length ? <ul>{mine.map((i) => <ItemRow key={i.id} item={i} today={data.today} save={save} />)}</ul> : <p className="text-[0.9rem] text-ink-muted py-2">Nothing showing with these filters.</p>}
                        <AddItem section={s.key} save={save} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          {save.err && <p role="alert" className="fixed bottom-4 left-4 right-4 rounded-xl bg-act text-white p-3 text-[0.9rem] text-center">{save.err}</p>}
          <p className="text-[0.8rem] text-ink-muted max-w-[60ch]">The clinical drafts are starting points written for you to correct against your own training, current guidance and your insurer's terms. Nothing here is public; the rules on naming medicines apply to the website and ads, not to your own notes.</p>
        </div>
      )}
    </Page>
  );
}
