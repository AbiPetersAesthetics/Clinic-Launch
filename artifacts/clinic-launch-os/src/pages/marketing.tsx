import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Megaphone, Wrench, Instagram, Mail, Facebook, Search as SearchIcon,
  CheckCircle2, Circle, CircleDashed, ChevronDown, ChevronUp, RotateCcw, Tag, Copy, Check, X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_ID = 1;
const API_BASE = "/api";
const OPEN_DATE_FALLBACK = "2026-11-02";
const FOUNDING_LEADS = 443;
const META_CPL = "£3.08";

type Status = "not_started" | "in_progress" | "done" | "na";
interface Item {
  id: number; category: string; title: string; detail: string; deep: string;
  channel: string; owner: string; weekStart: string; dayDate: string;
  status: Status; notes: string; sortOrder: number;
}
type Block = { h: string; b: string };
function parseDeep(s: string): Block[] { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function fullDayLabel(iso: string) { const d = parseISO(iso); return `${DAYNAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }

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
  { title: "Bedhampton nurture (they can come in now)", sub: "For Bedhampton locals + existing clients. 5 messages over ~2 weeks.",
    text: "SMS 1 (day 0): Hi {name}, it's Abi from Abi Peters Skin Clinic. I'd love to see you at my Bedhampton clinic for a complimentary skin analysis, plus 15% off any treatment you book after. It's on until 31 Oct. Want me to find you a time? Reply YES x\n\nEMAIL 1 (day 0) Subject: Your complimentary skin analysis, {name}\nHi {name}, thanks for your interest in Abi Peters Skin Clinic. I'd love to invite you to my Bedhampton clinic for a complimentary skin analysis: a relaxed 20 minutes where I look properly at your skin and give you an honest plan, no pressure. Book a treatment after and it's 15% off. It's only on until 31 October.\n[ Book my complimentary analysis ]\nSee you soon, Abi\n\nSMS 2 (day 3, no reply): Hi {name}, Abi here, just checking you saw this. Your complimentary skin analysis and 15% off is still open at my Bedhampton clinic (until 31 Oct). Shall I book you in? Reply YES x\n\nEMAIL 2 (day 6) Subject: Why I start every client with a skin analysis\nHi {name}, most skin problems aren't what people think. As a nurse I want the honest answer, not the biggest sale, so I never recommend a treatment before I've properly looked at your skin. That's all a complimentary analysis is: 20 minutes, a real look, a plan that fits you. And 15% off if you book after. On until 31 October at my Bedhampton clinic.\n[ Book ]\nAbi x\n\nSMS 3 (day 12, last nudge): Last nudge {name}, the complimentary skin analysis and 15% off ends 31 Oct and my Bedhampton diary is filling up. Grab a slot: {link} x" },
  { title: "Winchester nurture (the 443 founding leads)", sub: "Their clinic opens 2 Nov. Founding spot, with Bedhampton as an early taster.",
    text: "SMS 1 (day 0): Hi {name}, it's Abi from Abi Peters Skin Clinic. Big news: your Winchester clinic opens on 2 November! I'd love to save you a Founding Client spot (priority booking plus perks). And if you can't wait, you're welcome at my Bedhampton clinic now for a complimentary skin analysis and 15% off. Which sounds good? Just reply x\n\nEMAIL 1 (day 0) Subject: Winchester news, {name} (and a spot with your name on it)\nHi {name}, a little while ago you registered your interest in skin care in Winchester, and I have news: I'm opening Abi Peters Skin Clinic on Jewry Street this November. You're on my founding list, which means first pick of the opening diary, a complimentary add-on with your first treatment, and founding pricing locked in for good. Want me to hold you a Founding spot?\n[ Reserve my Founding spot ]\nCan't wait until November? Pop to my Bedhampton clinic now for a complimentary skin analysis, 15% off after, well worth the short drive. Abi\n\nEMAIL 2 (day 6) Subject: Why I'm a nurse before anything else\nHi {name}, I trained as a registered nurse before I ever touched skin, and it shapes everything about the Winchester clinic: safety first, honesty always, natural results over overdone. That is what your Founding spot is a part of. Shall I reserve yours?\n[ Reserve my Founding spot ]\nAbi x\n\nSMS 3 (October): {name}, Founding Client spots for Winchester are filling up and we open 2 Nov. Want me to hold yours? Priority booking and founding pricing locked in. Reply YES x" },
  { title: "October · Winchester Founding invite (email)", sub: "Subject: You're invited to be a Winchester Founding Client",
    text: "Hi {name},\n\nWinchester opens on 2 November, and I'm inviting a small group to be Founding Clients before we open to everyone.\n\nFounding Clients get:\n- First pick of the opening diary\n- A complimentary skincare product or add-on with your first treatment\n- Founding pricing - you keep launch prices even as they go up later\n\nThere are only 40 spots, and they'll go to the people on this list first.\n\n[ Reserve my Founding spot ]\n\nCan't wait to see you in Winchester,\nAbi x" },
  { title: "2 November · Launch email + SMS", sub: "Subject: We're open, {name}. Winchester is here.",
    text: "Hi {name},\n\nIt's official - Abi Peters Skin Clinic is now open at 9A Jewry Street, Winchester.\n\nIf you've been waiting, this is your moment. Founding Client spots are open now: priority booking, a complimentary add-on with your first treatment, and founding pricing locked in for good. First 40 only.\n\n[ Book me in ]\n\nThank you for being here from the start. It means everything.\n\nAbi x\n\n(SMS: We're OPEN in Winchester, {name}! Founding Client spots (first 40) are live - priority booking + founding pricing locked in. Book: {link} x)" },
  { title: "Captions 1-3 (week one)", sub: "Mon authority · Wed human · Fri offer.",
    text: "MON - AUTHORITY\nBefore any treatment, I do this one thing - and it changes everything.\n\nA skin analysis. 20 minutes where I actually look at your skin under proper light and tell you what's really going on. Not what an ad wants to sell you. What your skin actually needs.\n\nIt's how you stop wasting money on the wrong products and treatments.\n\nFree at my Bedhampton clinic until 31 Oct (and 15% off anything you book after). Comment ANALYSIS or tap the link.\n#WinchesterAesthetics #HampshireAesthetics #NurseLedAesthetics #SkinHealth\n\n- - - - -\n\nWED - HUMAN\nHi, I'm Abi. I'm a nurse, and I've spent years learning skin properly - which is exactly why I'll tell you when you DON'T need a treatment.\n\nThis autumn I'm opening my own clinic on Winchester high street. Before that, I'm seeing people at my Bedhampton clinic for complimentary skin analyses - my favourite thing to do.\n\nFollow along, the Winchester journey starts here.\n#AbiPetersSkinClinic #WinchesterAesthetics #NurseLed #HampshireBeauty\n\n- - - - -\n\nFRI - OFFER\nYour skin, properly looked at. On me.\n\nComplimentary skin analysis at my Bedhampton clinic - a relaxed 20 minutes, an honest plan, zero pressure. Book a treatment after and it's 15% off.\n\nOnly until 31 October, then I'm all-in on opening Winchester.\n\nTap the link or DM me the word SKIN.\n#Bedhampton #HampshireAesthetics #WinchesterAesthetics #SkinAnalysis" },
  { title: "Captions 4-6 (week two)", sub: "Mon authority · Wed human · Fri proof.",
    text: "MON - AUTHORITY\n\"Skin boosters\" - what actually are they?\n\nNot filler. They don't change your shape. Think of them as a deep drink of water for your skin: hydration that helps it look fresher and healthier from within.\n\nThey're not for everyone, and that's the point - the right treatment depends on your skin, which is why I start everyone with an analysis.\n\nCurious if they'd suit you? Link in bio.\n#SkinBoosters #HampshireAesthetics #WinchesterAesthetics #NurseLedAesthetics\n\n- - - - -\n\nWED - HUMAN\nA little behind the scenes. The Winchester clinic is coming together and I honestly can't quite believe it. Every detail, chosen to make you feel calm the second you walk in.\n\nOpening 2 November on Jewry Street. Founding Client spots open soon - save this post.\n#WinchesterAesthetics #ComingSoon #Winchester #AbiPetersSkinClinic\n\n- - - - -\n\nFRI - PROOF\nThis is why I do it.\n\n\"[client's own words - a short, honest line about how they felt, shared with their written permission]\"\n\nNo filters, no promises - just someone leaving feeling more like themselves. That's the whole job.\n\nWant your turn? Free skin analysis at Bedhampton until 31 Oct, 15% off after. Link in bio.\n#ClientLove #HampshireAesthetics #WinchesterAesthetics #NurseLed" },
];

function BlockRow({ blk }: { blk: Block }) {
  const [done, setDone] = useState(false);
  const canCopy = /copy|caption|script|subject/i.test(blk.h);
  const copy = () => { const fin = () => { setDone(true); setTimeout(() => setDone(false), 1500); }; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(blk.b).then(fin).catch(fin); else fin(); };
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{blk.h}</span>
        {canCopy && <button onClick={copy} className={`text-[10px] font-semibold flex items-center gap-1 ${done ? "text-emerald-600" : "text-muted-foreground hover:text-foreground"}`}>{done ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}</button>}
      </div>
      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-foreground/85">{blk.b}</p>
    </div>
  );
}

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
  useEffect(() => {
    if (!selectedDay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay]);

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

  const dayItemsFor = (iso: string) => items.filter(i => i.dayDate === iso).sort((a, b) => a.sortOrder - b.sortOrder);

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
                          const visibleActs = acts.filter(matchChannel).filter(matchOwner);
                          const ms = MILESTONES[iso];
                          const hasDetail = acts.length > 0;
                          return (
                            <div key={iso} className={`border-b xl:border-r xl:last:border-r-0 px-2.5 py-2.5 min-h-[96px] flex flex-col gap-1.5 ${ms === "big" ? "bg-amber-100/50 dark:bg-amber-950/25" : ms === "ms" ? "bg-amber-50/50 dark:bg-amber-950/12" : ""}`}>
                              <button onClick={() => hasDetail && setSelectedDay(iso)} disabled={!hasDetail} className={`flex items-baseline justify-between text-left ${hasDetail ? "hover:opacity-70" : "cursor-default"}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${ms ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{dayName(iso)}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{dayNum(iso)} {monShort(iso)}</span>
                              </button>
                              {visibleActs.map(it => {
                                const ch = CHANNELS[it.channel] ?? CHANNELS.found;
                                const ow = OWNERS[it.owner] ?? OWNERS.both;
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
                                        <button className={`text-left hover:underline ${done ? "line-through text-muted-foreground" : ""}`} onClick={() => setSelectedDay(iso)}>{it.title}</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {hasDetail && <button onClick={() => setSelectedDay(iso)} className="mt-auto text-[9.5px] font-semibold text-primary/80 hover:text-primary text-left">Open day →</button>}
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

      {/* Day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="bg-card border rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
              <div>
                <h3 className="text-base font-bold">{fullDayLabel(selectedDay)}</h3>
                <p className="text-[11px] text-muted-foreground">Everything on this day, in full. Tick tasks off as you go.</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground rounded-lg p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {dayItemsFor(selectedDay).map(it => {
                if (it.channel === "rest") return <p key={it.id} className="text-sm text-muted-foreground italic px-1">{it.title}</p>;
                const ch = CHANNELS[it.channel] ?? CHANNELS.found;
                const ow = OWNERS[it.owner] ?? OWNERS.both;
                const blocks = parseDeep(it.deep);
                return (
                  <div key={it.id} className="rounded-xl border p-4">
                    <div className="flex items-start gap-2.5">
                      <StatusToggle status={it.status} onChange={s => setStatus(it.id, s)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ow.cls}`}>{ow.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ch.cls}`}>{ch.label}</span>
                          <span className="text-[10px] text-muted-foreground">{ch.where}</span>
                        </div>
                        <p className={`text-sm font-semibold ${it.status === "done" ? "line-through text-muted-foreground" : ""}`}>{it.title}</p>
                        {it.detail && <p className="text-[12px] text-muted-foreground mt-0.5">{it.detail}</p>}
                      </div>
                    </div>
                    {blocks.length > 0 ? (
                      <div className="mt-3 space-y-2">{blocks.map((b, i) => <BlockRow key={i} blk={b} />)}</div>
                    ) : (
                      <p className="mt-3 text-[12px] text-muted-foreground italic">Full detail for this task is being written.</p>
                    )}
                    <Textarea placeholder="Your notes…" value={it.notes} onChange={e => setNotes(it.id, e.target.value)} className="mt-3 text-[12px] min-h-[44px] resize-none" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
