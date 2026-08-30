import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Megaphone, Wrench, Instagram, Mail, Facebook, Search as SearchIcon,
  CheckCircle2, Circle, CircleDashed, ChevronDown, ChevronUp, RotateCcw, Tag,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_ID = 1;
const API_BASE = "/api";
const OPEN_DATE_FALLBACK = "2026-11-02";

// Known live facts (from the Meta ad account + GHL, Aug 2026) shown as context.
const FOUNDING_LEADS = 443;
const META_CPL = "£3.08";

type Status = "not_started" | "in_progress" | "done" | "na";

interface Item {
  id: number;
  category: string;      // phase id p0..p5
  title: string;
  detail: string;
  channel: string;       // found | social | email | meta | google
  owner: string;         // abi | david | both
  weekStart: string;     // ISO Monday or ""
  status: Status;
  notes: string;
  sortOrder: number;
}

const PHASES: { id: string; label: string; sub: string }[] = [
  { id: "p0", label: "Foundations", sub: "Set up this week, the plan runs on these" },
  { id: "p1", label: "September", sub: "Warm & convert at Bedhampton" },
  { id: "p2", label: "October", sub: "Convert the offer + build the launch runway" },
  { id: "p3", label: "Launch week", sub: "Winchester opens 2 November" },
  { id: "p4", label: "November", sub: "Fill the diary" },
  { id: "p5", label: "December", sub: "Christmas retail + retain" },
];

const CHANNELS: Record<string, { label: string; icon: React.ElementType; cls: string; dot: string }> = {
  found:  { label: "Setup",      icon: Wrench,     cls: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700", dot: "bg-slate-400" },
  social: { label: "Social",     icon: Instagram,  cls: "text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800", dot: "bg-violet-500" },
  email:  { label: "Email",      icon: Mail,       cls: "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  meta:   { label: "Meta ads",   icon: Facebook,   cls: "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500" },
  google: { label: "Google ads", icon: SearchIcon, cls: "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
};

const OWNERS: Record<string, { label: string; cls: string }> = {
  abi:   { label: "Abi",   cls: "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800" },
  david: { label: "David", cls: "text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800" },
  both:  { label: "Both",  cls: "text-muted-foreground bg-muted border-border" },
};

const STATUS_CYCLE: Record<Status, Status> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
  na: "not_started",
};

function StatusToggle({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const next = () => onChange(STATUS_CYCLE[status]);
  if (status === "done")
    return <button onClick={next} title="Done, click to reset" className="shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></button>;
  if (status === "in_progress")
    return <button onClick={next} title="In progress, click to mark done" className="shrink-0"><CircleDashed className="w-5 h-5 text-amber-500" /></button>;
  return <button onClick={next} title="Not started, click to start" className="shrink-0"><Circle className="w-5 h-5 text-muted-foreground/40 hover:text-muted-foreground" /></button>;
}

function OwnerChip({ owner }: { owner: string }) {
  const o = OWNERS[owner] ?? OWNERS.both;
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${o.cls}`}>{o.label}</span>;
}

function ChannelChip({ channel }: { channel: string }) {
  const c = CHANNELS[channel] ?? CHANNELS.found;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${c.cls}`}>
      <Icon className="w-2.5 h-2.5" />{c.label}
    </span>
  );
}

function weekLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  const end = new Date(d.getTime() + 6 * 86400000);
  const fmt = (x: Date, opts: Intl.DateTimeFormatOptions) => x.toLocaleDateString("en-GB", opts);
  return `w/c ${fmt(d, { day: "numeric", month: "short" })}`;
}

export default function MarketingPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openingDate, setOpeningDate] = useState<string>(OPEN_DATE_FALLBACK);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const load = () => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setItems((data.items ?? []) as Item[]); setLoaded(true); });
  };

  useEffect(() => {
    load();
    fetch(`${API_BASE}/projects/${PROJECT_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p?.targetOpeningDate) setOpeningDate(p.targetOpeningDate); })
      .catch(() => {});
  }, []);

  const persist = (item: Item) => {
    setSaveState("saving");
    fetch(`${API_BASE}/marketing/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status, notes: item.notes }),
    }).then(() => setSaveState("saved")).catch(() => setSaveState("idle"));
  };
  const scheduleSave = (item: Item, delay: number) => {
    const t = timers.current.get(item.id);
    if (t) clearTimeout(t);
    timers.current.set(item.id, setTimeout(() => persist(item), delay));
  };

  const setStatus = (id: number, status: Status) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, status } : i);
      scheduleSave(next.find(i => i.id === id)!, 300);
      return next;
    });
  };
  const setNotes = (id: number, notes: string) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, notes } : i);
      scheduleSave(next.find(i => i.id === id)!, 700);
      return next;
    });
  };

  const reseed = async () => {
    if (!confirm("Rebuild the marketing plan from the template? This resets all statuses and notes.")) return;
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing/reseed`, { method: "POST" });
    load();
  };

  const daysToOpen = useMemo(() => {
    return Math.ceil((new Date(openingDate + "T12:00:00").getTime() - Date.now()) / 86400000);
  }, [openingDate]);

  const applicable = items.filter(i => i.status !== "na");
  const doneCount = applicable.filter(i => i.status === "done").length;
  const overall = applicable.length ? Math.round((doneCount / applicable.length) * 100) : 0;

  const visible = items.filter(i =>
    (channelFilter === "all" || i.channel === channelFilter) &&
    (ownerFilter === "all" || i.owner === ownerFilter || (ownerFilter !== "all" && i.owner === "both"))
  );

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePhase = (id: string) =>
    setCollapsedPhases(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!loaded) {
    return <div className="p-6 flex items-center justify-center min-h-40"><p className="text-sm text-muted-foreground animate-pulse">Loading marketing plan…</p></div>;
  }

  const channelTabs = [{ k: "all", label: "All" }, ...Object.keys(CHANNELS).map(k => ({ k, label: CHANNELS[k].label }))];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><Megaphone className="w-5 h-5 text-primary" /></div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Marketing Command Centre</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Social · Email · Paid, from 1 Sep to launch + 2 months. Low effort, high yield, 3 posts a week.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-medium ${saveState === "saved" ? "text-emerald-600 dark:text-emerald-400" : saveState === "saving" ? "text-muted-foreground animate-pulse" : "text-transparent"}`}>
              {saveState === "saved" ? "✓ Saved" : saveState === "saving" ? "Saving…" : "•"}
            </span>
            <button onClick={reseed} title="Rebuild plan from template" className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1">
              <RotateCcw className="w-3 h-3" /> Rebuild
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Winchester opens in</p>
            <p className="text-xl font-bold">{daysToOpen > 0 ? daysToOpen : 0}<span className="text-xs font-normal text-muted-foreground ml-0.5">days</span></p>
            <p className="text-[10px] text-muted-foreground">{new Date(openingDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Founding leads ready</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{FOUNDING_LEADS}</p>
            <p className="text-[10px] text-muted-foreground">Meta, {META_CPL}/lead, nurture these</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plan progress</p>
            <p className={`text-xl font-bold ${overall >= 70 ? "text-emerald-600 dark:text-emerald-400" : overall >= 35 ? "text-primary" : "text-amber-500"}`}>{overall}%</p>
            <p className="text-[10px] text-muted-foreground">{doneCount}/{applicable.length} actions done</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cadence</p>
            <p className="text-xl font-bold">3<span className="text-xs font-normal text-muted-foreground ml-0.5">posts/wk</span></p>
            <p className="text-[10px] text-muted-foreground">Mon · Wed · Fri</p>
          </div>
        </div>
      </div>

      {/* ── Bedhampton offer banner ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 shrink-0"><Tag className="w-4 h-4 text-rose-600 dark:text-rose-400" /></div>
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Sep/Oct engine, Bedhampton only</p>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
              <strong>Complimentary skin analysis</strong> at Bedhampton, then <strong>15% off any treatment</strong> taken after it. Runs <strong>1 Sep-31 Oct</strong>, then everything pivots to the Winchester launch. Switch the two Bedhampton ads (cold + warm) back on and point them here.
            </p>
          </div>
        </div>
      </div>

      {/* ── RACI ──────────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800">Abi</span><span className="text-xs font-semibold">the face & the clinician</span></div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>On-camera content, Reels, stories, treatment explainers, meet-Abi</li>
            <li>Deliver the complimentary skin analyses & treatments</li>
            <li>Reply to DMs/comments in her own voice</li>
            <li>Ask every client for a Google review in-clinic</li>
          </ul>
        </div>
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800">David</span><span className="text-xs font-semibold">systems, ads & scheduling</span></div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Meta + Google ads: setup, budget, monitoring</li>
            <li>GHL nurture, email/SMS, automations, pipelines</li>
            <li>Schedule the 3 posts/week; GBP reconnect + Winchester GBP</li>
            <li>Landing pages, booking, reviews automation, analytics</li>
          </ul>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {channelTabs.map(t => (
            <button key={t.k} onClick={() => setChannelFilter(t.k)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${channelFilter === t.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground/40 text-xs px-1">·</span>
        <div className="flex gap-1">
          {[{ k: "all", label: "Everyone" }, { k: "abi", label: "Abi" }, { k: "david", label: "David" }].map(t => (
            <button key={t.k} onClick={() => setOwnerFilter(t.k)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${ownerFilter === t.k ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Phased plan ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {PHASES.map(phase => {
          const phaseItems = visible.filter(i => i.category === phase.id);
          if (phaseItems.length === 0) return null;
          const collapsed = collapsedPhases.has(phase.id);
          const pApplicable = phaseItems.filter(i => i.status !== "na");
          const pDone = pApplicable.filter(i => i.status === "done").length;
          // group by week within the phase
          const weeks = Array.from(new Set(phaseItems.map(i => i.weekStart)));
          return (
            <div key={phase.id} className="rounded-2xl border bg-card overflow-hidden">
              <button onClick={() => togglePhase(phase.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/10 text-primary shrink-0">{phase.label}</span>
                  <span className="text-xs text-muted-foreground truncate">{phase.sub}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{pDone}/{pApplicable.length}</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pApplicable.length ? (pDone / pApplicable.length) * 100 : 0}%` }} />
                  </div>
                  {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {!collapsed && (
                <div className="border-t border-border/60">
                  {weeks.map(wk => {
                    const wkItems = phaseItems.filter(i => i.weekStart === wk);
                    return (
                      <div key={wk || "setup"}>
                        {wk && (
                          <div className="px-4 py-1.5 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{weekLabel(wk)}</div>
                        )}
                        <div className="divide-y divide-border/40">
                          {wkItems.map(item => {
                            const isExp = expanded.has(item.id);
                            const done = item.status === "done";
                            return (
                              <div key={item.id} className={`px-4 py-2.5 ${done ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
                                <div className="flex items-start gap-3">
                                  <div className="pt-0.5"><StatusToggle status={item.status} onChange={s => setStatus(item.id, s)} /></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                      <ChannelChip channel={item.channel} />
                                      <OwnerChip owner={item.owner} />
                                    </div>
                                    <p className={`text-sm leading-snug ${done ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
                                    {item.detail && !isExp && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.detail}</p>}
                                    {isExp && (
                                      <div className="mt-2 space-y-2">
                                        {item.detail && <p className="text-[11px] text-foreground/70 leading-relaxed bg-muted/40 rounded-lg p-2.5">{item.detail}</p>}
                                        <Textarea placeholder="Your notes, links, decisions…" value={item.notes} onChange={e => setNotes(item.id, e.target.value)} className="text-xs min-h-[52px] resize-none" />
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => toggleExpand(item.id)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0 p-0.5">
                                    {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No actions match this filter.</div>
        )}
      </div>

      {/* ── Weekly template reminder ──────────────────────────────────────── */}
      <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300 mb-2">The 3-posts-a-week template (repeat every week)</p>
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-card border border-border/60 p-2.5"><p className="font-semibold">Mon · Authority</p><p className="text-muted-foreground mt-0.5">Educate, a treatment, a skin tip, a myth. Builds trust, ASA-safe.</p></div>
          <div className="rounded-lg bg-card border border-border/60 p-2.5"><p className="font-semibold">Wed · Human</p><p className="text-muted-foreground mt-0.5">Behind-the-scenes, meet Abi, the clinic taking shape.</p></div>
          <div className="rounded-lg bg-card border border-border/60 p-2.5"><p className="font-semibold">Fri · Proof / offer</p><p className="text-muted-foreground mt-0.5">A review, a result (consent), the offer, a booking CTA.</p></div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Abi batch-records a fortnight of Reels in one sitting; David schedules them. That's the whole engine.</p>
      </div>
    </div>
  );
}
