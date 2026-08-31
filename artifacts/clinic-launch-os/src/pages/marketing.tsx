import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Megaphone, Wrench, Instagram, Mail, Facebook, Search as SearchIcon,
  CheckCircle2, Circle, CircleDashed, ChevronDown, ChevronUp, RotateCcw, Tag, Copy, Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_ID = 1;
const API_BASE = "/api";
const OPEN_DATE_FALLBACK = "2026-11-02";
const FOUNDING_LEADS = 443;
const META_CPL = "£3.08";

type Status = "not_started" | "in_progress" | "done" | "na";
interface Item {
  id: number; category: string; title: string; detail: string;
  channel: string; owner: string; weekStart: string; dayDate: string;
  status: Status; notes: string; sortOrder: number;
}

const PHASES: Record<string, { label: string; sub: string }> = {
  p0: { label: "Foundations", sub: "Build the engine this week" },
  p1: { label: "September", sub: "Warm & convert at Bedhampton" },
  p2: { label: "October", sub: "Convert the offer + build the launch runway" },
  p3: { label: "Launch week", sub: "Winchester opens 2 November" },
  p4: { label: "November", sub: "Fill the diary" },
  p5: { label: "December", sub: "Christmas retail + retain" },
};
const PHASE_ORDER = ["p0", "p1", "p2", "p3", "p4", "p5"];

const CHANNELS: Record<string, { label: string; icon: React.ElementType; where: string; cls: string }> = {
  found:  { label: "SETUP",  icon: Wrench,     where: "one-off task",        cls: "text-slate-600 dark:text-slate-300 bg-slate-500/12 border-slate-400/40" },
  social: { label: "POST",   icon: Instagram,  where: "Instagram + Facebook", cls: "text-violet-700 dark:text-violet-300 bg-violet-500/12 border-violet-400/40" },
  email:  { label: "EMAIL",  icon: Mail,       where: "email + SMS (GHL)",    cls: "text-blue-700 dark:text-blue-300 bg-blue-500/12 border-blue-400/40" },
  meta:   { label: "META",   icon: Facebook,   where: "Facebook / IG ads",    cls: "text-indigo-700 dark:text-indigo-300 bg-indigo-500/12 border-indigo-400/40" },
  google: { label: "GOOGLE", icon: SearchIcon, where: "Search ads",           cls: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 border-emerald-400/40" },
};
const OWNERS: Record<string, { label: string; cls: string }> = {
  abi:   { label: "Abi",   cls: "bg-rose-500 text-white" },
  david: { label: "David", cls: "bg-sky-600 text-white" },
  both:  { label: "Both",  cls: "bg-muted-foreground/70 text-white" },
};
const STATUS_CYCLE: Record<Status, Status> = { not_started: "in_progress", in_progress: "done", done: "not_started", na: "not_started" };
const MILESTONES: Record<string, "ms" | "big"> = {
  "2026-10-05": "ms", "2026-10-13": "ms", "2026-10-30": "ms", "2026-10-31": "ms", "2026-11-02": "big", "2026-12-01": "ms",
};

const DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parseISO(iso: string) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function addDaysISO(iso: string, n: number) { const dt = parseISO(iso); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
function dayName(iso: string) { return DAYNAMES[parseISO(iso).getUTCDay()]; }
function dayNum(iso: string) { return parseISO(iso).getUTCDate(); }
function monShort(iso: string) { return MONTHS[parseISO(iso).getUTCMonth()]; }
function weekRange(sun: string) { const sat = addDaysISO(sun, 6); return `${dayNum(sun)} ${monShort(sun)} to ${dayNum(sat)} ${monShort(sat)}`; }

const COPY: { title: string; sub: string; text: string }[] = [
  { title: "Nurture the 443 · SMS 1 (day 0)", sub: "The moment a lead lands, or as the relaunch to the whole list.",
    text: "Hi {name}, it's Abi from Abi Peters Aesthetics. Thanks for registering your interest! I'd love to give you a complimentary skin analysis at my Bedhampton clinic, and you'll get 15% off any treatment you book afterwards. It's only on until 31 Oct. Want me to find you a time? Just reply YES and I'll sort it x" },
  { title: "Nurture · Email 1 (day 0)", sub: "Subject: Your complimentary skin analysis is waiting, {name}",
    text: "Hi {name},\n\nThanks for registering your interest in Abi Peters Aesthetics.\n\nI'd love to invite you in for a complimentary skin analysis at my Bedhampton clinic. It's a relaxed 20 minutes: I look properly at your skin, talk through what's going on and what would genuinely help, and answer anything you've been wondering about. No pressure, no hard sell.\n\nAnd because you're on my list, you'll get 15% off any treatment you decide to book after your analysis.\n\nOne thing to know: this is only running until 31 October, so it's worth grabbing a slot now.\n\n[ Book my complimentary analysis ]\n\nSee you soon,\nAbi" },
  { title: "Nurture · SMS 2 (day 3, no reply)", sub: "Gentle nudge for the quiet ones.",
    text: "Hi {name}, Abi here - just checking you saw this. Your complimentary skin analysis + 15% off is still open at my Bedhampton clinic (until 31 Oct). Shall I book you in? Reply YES x" },
  { title: "Nurture · Email 2 (day 6)", sub: "Subject: Why I start every client with a skin analysis",
    text: "Hi {name},\n\nMost skin \"problems\" aren't what people think they are. Dryness that's actually a damaged barrier. \"Ageing\" that's mostly sun. Breakouts that a good routine would calm in weeks.\n\nThat's why I never recommend a treatment before I've properly looked at your skin. As a nurse, I want the honest answer, not the biggest sale.\n\nThat's all a complimentary skin analysis is: 20 minutes, a real look, and a plan that fits you. And 15% off if you decide to book something afterwards.\n\nIt's only on until 31 October.\n\n[ Book my complimentary analysis ]\n\nAbi x" },
  { title: "Nurture · SMS 3 (day 12, last nudge)", sub: "Final urgency before the window closes.",
    text: "Last nudge {name} - the complimentary skin analysis + 15% off ends 31 Oct and my Bedhampton diary is filling up fast. Grab a slot here: {link} x" },
  { title: "October · Winchester Founding invite (email)", sub: "Subject: You're invited to be a Winchester Founding Client",
    text: "Hi {name},\n\nWinchester opens on 2 November, and I'm inviting a small group to be Founding Clients before we open to everyone.\n\nFounding Clients get:\n- First pick of the opening diary\n- A complimentary skincare product or add-on with your first treatment\n- Founding pricing - you keep launch prices even as they go up later\n\nThere are only 40 spots, and they'll go to the people on this list first.\n\n[ Reserve my Founding spot ]\n\nCan't wait to see you in Winchester,\nAbi x" },
  { title: "2 November · Launch email + SMS", sub: "Subject: We're open, {name}. Winchester is here.",
    text: "Hi {name},\n\nIt's official - Abi Peters Aesthetics is now open at 9A Jewry Street, Winchester.\n\nIf you've been waiting, this is your moment. Founding Client spots are open now: priority booking, a complimentary add-on with your first treatment, and founding pricing locked in for good. First 40 only.\n\n[ Book me in ]\n\nThank you for being here from the start. It means everything.\n\nAbi x\n\n(SMS: We're OPEN in Winchester, {name}! Founding Client spots (first 40) are live - priority booking + founding pricing locked in. Book: {link} x)" },
  { title: "Captions 1-3 (week one)", sub: "Mon authority · Wed human · Fri offer.",
    text: "MON - AUTHORITY\nBefore any treatment, I do this one thing - and it changes everything.\n\nA skin analysis. 20 minutes where I actually look at your skin under proper light and tell you what's really going on. Not what an ad wants to sell you. What your skin actually needs.\n\nIt's how you stop wasting money on the wrong products and treatments.\n\nFree at my Bedhampton clinic until 31 Oct (and 15% off anything you book after). Comment ANALYSIS or tap the link.\n#WinchesterAesthetics #HampshireAesthetics #NurseLedAesthetics #SkinHealth\n\n- - - - -\n\nWED - HUMAN\nHi, I'm Abi. I'm a nurse, and I've spent years learning skin properly - which is exactly why I'll tell you when you DON'T need a treatment.\n\nThis autumn I'm opening my own clinic on Winchester high street. Before that, I'm seeing people at my Bedhampton clinic for complimentary skin analyses - my favourite thing to do.\n\nFollow along, the Winchester journey starts here.\n#AbiPetersAesthetics #WinchesterAesthetics #NurseLed #HampshireBeauty\n\n- - - - -\n\nFRI - OFFER\nYour skin, properly looked at. On me.\n\nComplimentary skin analysis at my Bedhampton clinic - a relaxed 20 minutes, an honest plan, zero pressure. Book a treatment after and it's 15% off.\n\nOnly until 31 October, then I'm all-in on opening Winchester.\n\nTap the link or DM me the word SKIN.\n#Bedhampton #HampshireAesthetics #WinchesterAesthetics #SkinAnalysis" },
  { title: "Captions 4-6 (week two)", sub: "Mon authority · Wed human · Fri proof.",
    text: "MON - AUTHORITY\n\"Skin boosters\" - what actually are they?\n\nNot filler. They don't change your shape. Think of them as a deep drink of water for your skin: hydration that helps it look fresher and healthier from within.\n\nThey're not for everyone, and that's the point - the right treatment depends on your skin, which is why I start everyone with an analysis.\n\nCurious if they'd suit you? Link in bio.\n#SkinBoosters #HampshireAesthetics #WinchesterAesthetics #NurseLedAesthetics\n\n- - - - -\n\nWED - HUMAN\nA little behind the scenes. The Winchester clinic is coming together and I honestly can't quite believe it. Every detail, chosen to make you feel calm the second you walk in.\n\nOpening 2 November on Jewry Street. Founding Client spots open soon - save this post.\n#WinchesterAesthetics #ComingSoon #Winchester #AbiPetersAesthetics\n\n- - - - -\n\nFRI - PROOF\nThis is why I do it.\n\n\"[client's own words - a short, honest line about how they felt, shared with their written permission]\"\n\nNo filters, no promises - just someone leaving feeling more like themselves. That's the whole job.\n\nWant your turn? Free skin analysis at Bedhampton until 31 Oct, 15% off after. Link in bio.\n#ClientLove #HampshireAesthetics #WinchesterAesthetics #NurseLed" },
];

function StatusToggle({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const next = () => onChange(STATUS_CYCLE[status]);
  if (status === "done") return <button onClick={next} title="Done. Tap to reset." className="shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></button>;
  if (status === "in_progress") return <button onClick={next} title="Started. Tap when finished." className="shrink-0"><CircleDashed className="w-5 h-5 text-amber-500" /></button>;
  return <button onClick={next} title="Not started. Tap to start." className="shrink-0"><Circle className="w-5 h-5 text-muted-foreground/40 hover:text-muted-foreground" /></button>;
}

function CopyBlock({ c }: { c: { title: string; sub: string; text: string } }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    const finish = () => { setDone(true); setTimeout(() => setDone(false), 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(c.text).then(finish).catch(finish);
    else finish();
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-[13px] font-bold">{c.title}</h4>
        <button onClick={copy} className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold border rounded-lg px-2 py-1 transition-colors ${done ? "text-emerald-600 border-emerald-400" : "text-muted-foreground border-border hover:text-foreground"}`}>
          {done ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{c.sub}</p>
      <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-muted/40 border rounded-lg p-3 font-sans">{c.text}</pre>
    </div>
  );
}

export default function MarketingPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openingDate, setOpeningDate] = useState<string>(OPEN_DATE_FALLBACK);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showCopy, setShowCopy] = useState(false);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const load = () => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setItems((data.items ?? []) as Item[]); setLoaded(true); });
  };
  useEffect(() => {
    load();
    fetch(`${API_BASE}/projects/${PROJECT_ID}`).then(r => r.ok ? r.json() : null)
      .then(p => { if (p?.targetOpeningDate) setOpeningDate(p.targetOpeningDate); }).catch(() => {});
  }, []);

  const persist = (item: Item) => {
    setSaveState("saving");
    fetch(`${API_BASE}/marketing/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status, notes: item.notes }) })
      .then(() => setSaveState("saved")).catch(() => setSaveState("idle"));
  };
  const scheduleSave = (item: Item, delay: number) => {
    const t = timers.current.get(item.id); if (t) clearTimeout(t);
    timers.current.set(item.id, setTimeout(() => persist(item), delay));
  };
  const setStatus = (id: number, status: Status) => setItems(prev => { const n = prev.map(i => i.id === id ? { ...i, status } : i); scheduleSave(n.find(i => i.id === id)!, 300); return n; });
  const setNotes = (id: number, notes: string) => setItems(prev => { const n = prev.map(i => i.id === id ? { ...i, notes } : i); scheduleSave(n.find(i => i.id === id)!, 700); return n; });

  const reseed = async () => {
    if (!confirm("Rebuild the plan from the template? This resets all your ticks and notes.")) return;
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing/reseed`, { method: "POST" }); load();
  };

  const daysToOpen = useMemo(() => Math.ceil((parseISO(openingDate).getTime() - Date.now()) / 86400000), [openingDate]);
  const tasks = items.filter(i => i.channel !== "rest");
  const doneCount = tasks.filter(i => i.status === "done").length;
  const overall = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const matchOwner = (i: Item) => ownerFilter === "all" || i.owner === ownerFilter || i.owner === "both";
  const matchChannel = (i: Item) => channelFilter === "all" || i.channel === channelFilter || i.channel === "rest";

  // group: phase -> week(sun) -> items
  const grouped = useMemo(() => {
    const byPhase: Record<string, Record<string, Item[]>> = {};
    for (const it of items) {
      (byPhase[it.category] ??= {});
      (byPhase[it.category][it.weekStart] ??= []).push(it);
    }
    return byPhase;
  }, [items]);

  const toggleExpand = (id: number) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!loaded) return <div className="p-6 flex items-center justify-center min-h-40"><p className="text-sm text-muted-foreground animate-pulse">Loading marketing plan…</p></div>;

  const channelTabs = [{ k: "all", label: "All" }, ...Object.keys(CHANNELS).map(k => ({ k, label: CHANNELS[k].label }))];

  return (
    <div className={`p-4 sm:p-6 max-w-6xl mx-auto space-y-5 ${ownerFilter === "abi" ? "f-abi" : ownerFilter === "david" ? "f-david" : ""}`}>
      <style>{`.f-abi .task:not(.o-abi):not(.o-both),.f-david .task:not(.o-david):not(.o-both){opacity:.16;filter:grayscale(.6)}`}</style>

      {/* Header */}
      <div className="rounded-2xl border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><Megaphone className="w-5 h-5 text-primary" /></div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Marketing Command Centre</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Your day-by-day plan. Do today's boxes, tick them off, done. Every message and caption is in the Copy Bank at the bottom.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-medium ${saveState === "saved" ? "text-emerald-600 dark:text-emerald-400" : saveState === "saving" ? "text-muted-foreground animate-pulse" : "text-transparent"}`}>{saveState === "saved" ? "✓ Saved" : saveState === "saving" ? "Saving…" : "•"}</span>
            <button onClick={reseed} title="Rebuild plan from template" className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1"><RotateCcw className="w-3 h-3" /> Rebuild</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Winchester opens in</p><p className="text-xl font-bold">{daysToOpen > 0 ? daysToOpen : 0}<span className="text-xs font-normal text-muted-foreground ml-0.5">days</span></p><p className="text-[10px] text-muted-foreground">{dayNum(openingDate)} {monShort(openingDate)} 2026</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Founding leads ready</p><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{FOUNDING_LEADS}</p><p className="text-[10px] text-muted-foreground">Meta, {META_CPL}/lead</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plan progress</p><p className={`text-xl font-bold ${overall >= 70 ? "text-emerald-600 dark:text-emerald-400" : overall >= 35 ? "text-primary" : "text-amber-500"}`}>{overall}%</p><p className="text-[10px] text-muted-foreground">{doneCount}/{tasks.length} tasks done</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cadence</p><p className="text-xl font-bold">3<span className="text-xs font-normal text-muted-foreground ml-0.5">posts/wk</span></p><p className="text-[10px] text-muted-foreground">Mon · Wed · Fri</p></div>
        </div>
      </div>

      {/* Offer banner */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 shrink-0"><Tag className="w-4 h-4 text-rose-600 dark:text-rose-400" /></div>
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Sep/Oct engine, Bedhampton only</p>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed"><strong>Complimentary skin analysis</strong> at Bedhampton, then <strong>15% off any treatment</strong> taken after it. Runs <strong>1 Sep to 31 Oct</strong>, then everything pivots to the Winchester launch. Switch the two Bedhampton ads (cold + warm) back on and point them here.</p>
            <p className="text-xs text-foreground/70 mt-2 leading-relaxed"><strong>November in Winchester:</strong> no straight discount (it cheapens a premium clinic). Give a capped <strong>Founding Client</strong> bundle instead: priority booking, a complimentary add-on, and founding pricing locked in. First 40 only.</p>
          </div>
        </div>
      </div>

      {/* Filters + legend */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1 flex-wrap">
          {channelTabs.map(t => (
            <button key={t.k} onClick={() => setChannelFilter(t.k)} className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${channelFilter === t.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-1 items-center sm:ml-auto">
          <span className="text-[11px] text-muted-foreground font-semibold mr-1">Show:</span>
          {[{ k: "all", label: "Everyone" }, { k: "abi", label: "Just Abi" }, { k: "david", label: "Just David" }].map(t => (
            <button key={t.k} onClick={() => setOwnerFilter(t.k)} className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${ownerFilter === t.k ? (t.k === "abi" ? "bg-rose-500 text-white border-rose-500" : t.k === "david" ? "bg-sky-600 text-white border-sky-600" : "bg-foreground text-background border-foreground") : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="space-y-6">
        {PHASE_ORDER.filter(p => grouped[p]).map(phaseId => {
          const weeks = Object.keys(grouped[phaseId]).sort();
          return (
            <div key={phaseId}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-primary/10 text-primary shrink-0">{PHASES[phaseId]?.label}</span>
                <span className="text-xs text-muted-foreground">{PHASES[phaseId]?.sub}</span>
                <span className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-3">
                {weeks.map(sun => {
                  const weekItems = grouped[phaseId][sun];
                  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(sun, i));
                  return (
                    <div key={sun} className="rounded-xl border bg-card overflow-hidden">
                      <div className="px-4 py-2 border-b bg-muted/40 flex items-center justify-between">
                        <span className="text-[12px] font-bold tabular-nums">{weekRange(sun)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7">
                        {days.map(iso => {
                          const dayItems = weekItems.filter(i => i.dayDate === iso).sort((a, b) => a.sortOrder - b.sortOrder);
                          const rest = dayItems.find(i => i.channel === "rest");
                          const acts = dayItems.filter(i => i.channel !== "rest");
                          const ms = MILESTONES[iso];
                          return (
                            <div key={iso} className={`border-b xl:border-r xl:last:border-r-0 px-2.5 py-2.5 min-h-[92px] flex flex-col gap-1.5 ${ms === "big" ? "bg-amber-100/50 dark:bg-amber-950/25" : ms === "ms" ? "bg-amber-50/50 dark:bg-amber-950/12" : ""}`}>
                              <div className="flex items-baseline justify-between">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${ms ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{dayName(iso)}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{dayNum(iso)} {monShort(iso)}</span>
                              </div>
                              {acts.filter(matchChannel).filter(matchOwner).map(it => {
                                const ch = CHANNELS[it.channel] ?? CHANNELS.found;
                                const ow = OWNERS[it.owner] ?? OWNERS.both;
                                const isExp = expanded.has(it.id);
                                const done = it.status === "done";
                                return (
                                  <div key={it.id} className={`task o-${it.owner} text-[11.5px] leading-snug`}>
                                    <div className="flex items-start gap-1.5">
                                      <StatusToggle status={it.status} onChange={s => setStatus(it.id, s)} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                          <span className={`text-[8.5px] font-bold px-1.5 py-px rounded-full ${ow.cls}`}>{ow.label}</span>
                                          <span className={`text-[8.5px] font-bold px-1.5 py-px rounded border ${ch.cls}`}>{ch.label}</span>
                                        </div>
                                        <button className={`text-left ${done ? "line-through text-muted-foreground" : ""}`} onClick={() => toggleExpand(it.id)}>{it.title}</button>
                                        {it.detail && !isExp && <p className="text-[10px] text-muted-foreground/80 mt-0.5">Tap for how</p>}
                                        {isExp && (
                                          <div className="mt-1.5 space-y-1.5">
                                            {it.detail && <p className="text-[10.5px] text-foreground/75 bg-muted/50 rounded-md p-2 leading-relaxed">{it.detail}</p>}
                                            <Textarea placeholder="Notes…" value={it.notes} onChange={e => setNotes(it.id, e.target.value)} className="text-[11px] min-h-[40px] resize-none" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {rest && acts.length === 0 && <p className="text-[10.5px] text-muted-foreground italic mt-auto">{rest.title}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rhythm cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4"><h4 className="text-[13px] font-bold mb-2">The 3-posts-a-week template</h4><ul className="text-xs text-muted-foreground space-y-1.5"><li><b className="text-foreground">Mon</b> · Authority. Teach something (a treatment, a skin tip, a myth).</li><li><b className="text-foreground">Wed</b> · Human. Meet Abi, behind the scenes, the clinic taking shape.</li><li><b className="text-foreground">Fri</b> · Proof/offer. A review, a result (with consent), the offer + booking link.</li></ul><p className="text-[10.5px] text-muted-foreground/80 mt-2">Abi films 6 Reels in one sitting every fortnight; David schedules them. That's the whole engine.</p></div>
        <div className="rounded-xl border bg-card p-4"><h4 className="text-[13px] font-bold mb-2">Who owns what</h4><ul className="text-xs text-muted-foreground space-y-1.5"><li><b className="text-rose-600 dark:text-rose-400">Abi</b> · on-camera content, delivering treatments, replying to DMs, asking for reviews in clinic.</li><li><b className="text-sky-600 dark:text-sky-400">David</b> · ads, GHL nurture &amp; automations, scheduling posts, GBP, booking, numbers.</li><li><b className="text-foreground">Both</b> · a 15-minute weekly check-in; sign off content &amp; offers.</li></ul></div>
        <div className="rounded-xl border bg-card p-4"><h4 className="text-[13px] font-bold mb-2">Three rules that keep you safe</h4><ul className="text-xs text-muted-foreground space-y-1.5"><li>No before/after client photos without separate written consent.</li><li>No "guaranteed results" wording (ASA/CAP).</li><li>Never name Botox or prescription treatments in ads.</li></ul></div>
      </div>

      {/* Copy bank */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <button onClick={() => setShowCopy(s => !s)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors">
          <div className="text-left"><h2 className="text-base font-bold">Copy Bank</h2><p className="text-xs text-muted-foreground">Every message and caption, written for you. Tap Copy, paste into GHL, swap {"{name}"}, done.</p></div>
          {showCopy ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showCopy && <div className="p-4 pt-0 grid md:grid-cols-2 gap-3">{COPY.map((c, i) => <CopyBlock key={i} c={c} />)}</div>}
      </div>

    </div>
  );
}
