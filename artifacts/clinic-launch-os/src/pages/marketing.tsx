import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Megaphone, Wrench, Instagram, Mail, Facebook, Search as SearchIcon,
  CheckCircle2, Circle, CircleDashed, ChevronDown, ChevronUp, RotateCcw, Tag, Copy, Check, X,
  Sparkles, ArrowRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_ID = 1;
const API_BASE = "/api";
const OPEN_DATE_FALLBACK = "2026-11-02";
const FOUNDING_LEADS = 448;
const FOUNDING_CAP = 40;
const META_CPL = "£3.16 to £5.64";

type Status = "not_started" | "in_progress" | "done" | "na";
interface Item {
  id: number; category: string; title: string; detail: string; deep: string;
  channel: string; owner: string; weekStart: string; dayDate: string;
  status: Status; notes: string; sortOrder: number;
}
type Block = { h: string; b: string };
function parseDeep(s: string): Block[] { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

const PHASES: Record<string, { label: string; sub: string }> = {
  top:        { label: "Read this first", sub: "What is actually live, and the one thing that changes the plan" },
  nurture:    { label: "The 40 from 448", sub: "The selection sequence: sort the list, select the 40, launch fortnight (3 Sep to 16 Nov)" },
  retarget:   { label: "Retargeting", sub: "A small, correctly sized Meta retarget under the conversations (12 Oct to 1 Nov)" },
  creative:   { label: "Creative refresh", sub: "Three concepts and a media plan that spends less than half (15 Sep to 2 Nov)" },
  bedhampton: { label: "Bedhampton harvest", sub: "Reactivate the earning clinic, local only, offer ends 30 Oct (10 Sep to 30 Oct)" },
  tail:       { label: "Decisions, dates and rules", sub: "The owner decisions, the compliance locks, and what must not change" },
};
const PHASE_ORDER = ["top", "nurture", "retarget", "creative", "bedhampton", "tail"];

const CHANNELS: Record<string, { label: string; icon: React.ElementType; where: string; bar: string; dot: string; text: string }> = {
  found:  { label: "Setup",  icon: Wrench,     where: "one-off task",         bar: "border-l-slate-400",  dot: "bg-slate-400",  text: "text-slate-600 dark:text-slate-300" },
  social: { label: "Post",   icon: Instagram,  where: "Instagram + Facebook", bar: "border-l-violet-400", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-300" },
  email:  { label: "Message",icon: Mail,       where: "email, SMS, WhatsApp (GHL)", bar: "border-l-blue-400",   dot: "bg-blue-500",   text: "text-blue-600 dark:text-blue-300" },
  meta:   { label: "Meta ad",icon: Facebook,   where: "Facebook / IG ads",    bar: "border-l-indigo-400", dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-300" },
  google: { label: "Google", icon: SearchIcon, where: "Search ads",           bar: "border-l-emerald-400",dot: "bg-emerald-500",text: "text-emerald-600 dark:text-emerald-300" },
};
const OWNERS: Record<string, { label: string; badge: string; text: string }> = {
  abi:   { label: "Abi",   badge: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  david: { label: "David", badge: "bg-sky-600",  text: "text-sky-600 dark:text-sky-400" },
  both:  { label: "Both",  badge: "bg-slate-400", text: "text-muted-foreground" },
};
const STATUS_CYCLE: Record<Status, Status> = { not_started: "in_progress", in_progress: "done", done: "not_started", na: "not_started" };
const MILESTONES: Record<string, string> = {
  "2026-09-03": "Nurture begins", "2026-09-10": "Bedhampton ads live", "2026-09-15": "Creative live",
  "2026-10-12": "Retargeting live", "2026-10-19": "Founding: pick a week", "2026-10-26": "Founding booking opens",
  "2026-10-30": "Bedhampton offer closes", "2026-11-02": "Winchester opens", "2026-11-16": "Founding review",
};

const DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parseISO(iso: string) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function addDaysISO(iso: string, n: number) { const dt = parseISO(iso); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
function dayName(iso: string) { return DAYNAMES[parseISO(iso).getUTCDay()]; }
function dayNum(iso: string) { return parseISO(iso).getUTCDate(); }
function monShort(iso: string) { return MONTHS[parseISO(iso).getUTCMonth()]; }
function weekRange(sun: string) { const sat = addDaysISO(sun, 6); return `${dayNum(sun)} ${monShort(sun)} to ${dayNum(sat)} ${monShort(sat)}`; }
function fullDayLabel(iso: string) { const d = parseISO(iso); return `${DAYNAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
function todayISO() { const n = new Date(); const p = (x: number) => String(x).padStart(2, "0"); return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`; }

const COPY: { title: string; sub: string; text: string }[] = [
  { title: "Bedhampton nurture (they can come in now)", sub: "For Bedhampton locals and existing clients. 5 messages over ~2 weeks.",
    text: "SMS 1 (day 0): Hi {name}, it's Abi from Abi Peters Skin Clinic. I'd love to see you at my Bedhampton clinic for a complimentary skin analysis, plus 15% off any treatment you book after. It's on until 31 Oct. Want me to find you a time? Reply YES x\n\nEMAIL 1 (day 0) Subject: Your complimentary skin analysis, {name}\nHi {name}, thanks for your interest in Abi Peters Skin Clinic. I'd love to invite you to my Bedhampton clinic for a complimentary skin analysis: a relaxed 20 minutes where I look properly at your skin and give you an honest plan, no pressure. Book a treatment after and it's 15% off. It's only on until 31 October.\n[ Book my complimentary analysis ]\nSee you soon, Abi\n\nSMS 2 (day 3, no reply): Hi {name}, Abi here, just checking you saw this. Your complimentary skin analysis and 15% off is still open at my Bedhampton clinic (until 31 Oct). Shall I book you in? Reply YES x\n\nEMAIL 2 (day 6) Subject: Why I start every client with a skin analysis\nHi {name}, most skin problems aren't what people think. As a nurse I want the honest answer, not the biggest sale, so I never recommend a treatment before I've properly looked at your skin. That's all a complimentary analysis is: 20 minutes, a real look, a plan that fits you. And 15% off if you book after. On until 31 October at my Bedhampton clinic.\n[ Book ]\nAbi x\n\nSMS 3 (day 12, last nudge): Last nudge {name}, the complimentary skin analysis and 15% off ends 31 Oct and my Bedhampton diary is filling up. Grab a slot: {link} x" },
  { title: "Winchester nurture (the 443 founding leads)", sub: "Their clinic opens 2 Nov. Founding spot, with Bedhampton as an early taster.",
    text: "SMS 1 (day 0): Hi {name}, it's Abi from Abi Peters Skin Clinic. Big news: your Winchester clinic opens on 2 November! I'd love to save you a Founding Client spot (priority booking plus perks). And if you can't wait, you're welcome at my Bedhampton clinic now for a complimentary skin analysis and 15% off. Which sounds good? Just reply x\n\nEMAIL 1 (day 0) Subject: Winchester news, {name} (and a spot with your name on it)\nHi {name}, a little while ago you registered your interest in skin care in Winchester, and I have news: I'm opening Abi Peters Skin Clinic on Jewry Street this November. You're on my founding list, which means first pick of the opening diary, a complimentary add-on with your first treatment, and founding pricing locked in for good. Want me to hold you a Founding spot?\n[ Reserve my Founding spot ]\nCan't wait until November? Pop to my Bedhampton clinic now for a complimentary skin analysis, 15% off after, well worth the short drive. Abi\n\nEMAIL 2 (day 6) Subject: Why I'm a nurse before anything else\nHi {name}, I trained as a registered nurse before I ever touched skin, and it shapes everything about the Winchester clinic: safety first, honesty always, natural results over overdone. That is what your Founding spot is a part of. Shall I reserve yours?\n[ Reserve my Founding spot ]\nAbi x\n\nSMS 3 (October): {name}, Founding Client spots for Winchester are filling up and we open 2 Nov. Want me to hold yours? Priority booking and founding pricing locked in. Reply YES x" },
  { title: "October: Winchester Founding invite (email)", sub: "Subject: You're invited to be a Winchester Founding Client",
    text: "Hi {name},\n\nWinchester opens on 2 November, and I'm inviting a small group to be Founding Clients before we open to everyone.\n\nFounding Clients get:\n- First pick of the opening diary\n- A complimentary skincare product or add-on with your first treatment\n- Founding pricing, you keep launch prices even as they go up later\n\nThere are only 40 spots, and they'll go to the people on this list first.\n\n[ Reserve my Founding spot ]\n\nCan't wait to see you in Winchester,\nAbi x" },
  { title: "2 November: Launch email + SMS", sub: "Subject: We're open, {name}. Winchester is here.",
    text: "Hi {name},\n\nIt's official, Abi Peters Skin Clinic is now open at 9A Jewry Street, Winchester.\n\nIf you've been waiting, this is your moment. Founding Client spots are open now: priority booking, a complimentary add-on with your first treatment, and founding pricing locked in for good. First 40 only.\n\n[ Book me in ]\n\nThank you for being here from the start. It means everything.\n\nAbi x\n\n(SMS: We're OPEN in Winchester, {name}! Founding Client spots (first 40) are live, priority booking and founding pricing locked in. Book: {link} x)" },
  { title: "Captions 1 to 3 (week one)", sub: "Mon authority, Wed human, Fri offer.",
    text: "MON, AUTHORITY\nBefore any treatment, I do this one thing and it changes everything.\n\nA skin analysis. 20 minutes where I actually look at your skin under proper light and tell you what's really going on. Not what an ad wants to sell you. What your skin actually needs.\n\nFree at my Bedhampton clinic until 31 Oct (and 15% off anything you book after). Comment ANALYSIS or tap the link.\n#WinchesterAesthetics #HampshireAesthetics #NurseLedAesthetics #SkinHealth\n\n- - - - -\n\nWED, HUMAN\nHi, I'm Abi. I'm a nurse, and I've spent years learning skin properly, which is exactly why I'll tell you when you DON'T need a treatment.\n\nThis autumn I'm opening my own clinic on Winchester high street. Before that, I'm seeing people at my Bedhampton clinic for complimentary skin analyses, my favourite thing to do.\n\nFollow along, the Winchester journey starts here.\n#AbiPetersSkinClinic #WinchesterAesthetics #NurseLed #HampshireBeauty\n\n- - - - -\n\nFRI, OFFER\nYour skin, properly looked at. On me.\n\nComplimentary skin analysis at my Bedhampton clinic, a relaxed 20 minutes, an honest plan, zero pressure. Book a treatment after and it's 15% off.\n\nOnly until 31 October, then I'm all-in on opening Winchester.\n\nTap the link or DM me the word SKIN.\n#Bedhampton #HampshireAesthetics #WinchesterAesthetics #SkinAnalysis" },
  { title: "Captions 4 to 6 (week two)", sub: "Mon authority, Wed human, Fri proof.",
    text: "MON, AUTHORITY\n\"Skin boosters\", what actually are they?\n\nNot filler. They don't change your shape. Think of them as a deep drink of water for your skin: hydration that helps it look fresher and healthier from within.\n\nThey're not for everyone, and that's the point, the right treatment depends on your skin, which is why I start everyone with an analysis.\n\nCurious if they'd suit you? Link in bio.\n#SkinBoosters #HampshireAesthetics #WinchesterAesthetics #NurseLedAesthetics\n\n- - - - -\n\nWED, HUMAN\nA little behind the scenes. The Winchester clinic is coming together and I honestly can't quite believe it. Every detail, chosen to make you feel calm the second you walk in.\n\nOpening 2 November on Jewry Street. Founding Client spots open soon, save this post.\n#WinchesterAesthetics #ComingSoon #Winchester #AbiPetersSkinClinic\n\n- - - - -\n\nFRI, PROOF\nThis is why I do it.\n\n\"[client's own words, a short honest line about how they felt, shared with their written permission]\"\n\nNo filters, no promises, just someone leaving feeling more like themselves. That's the whole job.\n\nWant your turn? Free skin analysis at Bedhampton until 31 Oct, 15% off after. Link in bio.\n#ClientLove #HampshireAesthetics #WinchesterAesthetics #NurseLed" },
];

function StatusToggle({ status, onChange, big }: { status: Status; onChange: (s: Status) => void; big?: boolean }) {
  const sz = big ? "w-5 h-5" : "w-[18px] h-[18px]";
  const next = () => onChange(STATUS_CYCLE[status]);
  if (status === "done") return <button onClick={next} title="Done. Tap to reset." className="shrink-0"><CheckCircle2 className={`${sz} text-emerald-500`} /></button>;
  if (status === "in_progress") return <button onClick={next} title="Started. Tap when finished." className="shrink-0"><CircleDashed className={`${sz} text-amber-500`} /></button>;
  return <button onClick={next} title="Not started. Tap to start." className="shrink-0"><Circle className={`${sz} text-muted-foreground/35 hover:text-muted-foreground`} /></button>;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 15, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-primary" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 20 20)" />
      <text x="20" y="24" textAnchor="middle" className="fill-foreground text-[11px] font-bold">{pct}</text>
    </svg>
  );
}

function BlockRow({ blk }: { blk: Block }) {
  const [done, setDone] = useState(false);
  const canCopy = /copy|caption|script|subject|message|template|primary|sms|whatsapp|email|url/i.test(blk.h);
  const copy = () => { const fin = () => { setDone(true); setTimeout(() => setDone(false), 1500); }; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(blk.b).then(fin).catch(fin); else fin(); };
  return (
    <div className="rounded-xl border bg-muted/25 p-3.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-primary">{blk.h}</span>
        {canCopy && <button onClick={copy} className={`text-[10.5px] font-semibold flex items-center gap-1 rounded-md px-1.5 py-0.5 ${done ? "text-emerald-600" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{done ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}</button>}
      </div>
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">{blk.b}</p>
    </div>
  );
}

function CopyBlock({ c }: { c: { title: string; sub: string; text: string } }) {
  const [done, setDone] = useState(false);
  const copy = () => { const fin = () => { setDone(true); setTimeout(() => setDone(false), 1600); }; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(c.text).then(fin).catch(fin); else fin(); };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-[13px] font-bold leading-tight">{c.title}</h4>
        <button onClick={copy} className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold border rounded-lg px-2 py-1 transition-colors ${done ? "text-emerald-600 border-emerald-400" : "text-muted-foreground border-border hover:text-foreground"}`}>{done ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}</button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2.5">{c.sub}</p>
      <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-muted/30 border rounded-lg p-3 font-sans max-h-52 overflow-y-auto">{c.text}</pre>
    </div>
  );
}

// A single task, rendered as a channel-coded card
function TaskCard({ it, onOpen, onStatus, big }: { it: Item; onOpen: () => void; onStatus: (s: Status) => void; big?: boolean }) {
  const ch = CHANNELS[it.channel] ?? CHANNELS.found;
  const ow = OWNERS[it.owner] ?? OWNERS.both;
  const done = it.status === "done";
  return (
    <div className={`task o-${it.owner} group flex items-start gap-2 rounded-lg border border-l-[3px] ${ch.bar} bg-card hover:bg-muted/40 transition-colors ${big ? "px-3 py-2.5" : "px-2.5 py-2"}`}>
      <div className="pt-px"><StatusToggle status={it.status} onChange={onStatus} big={big} /></div>
      <button onClick={onOpen} className="text-left min-w-0 flex-1">
        <p className={`${big ? "text-[13.5px]" : "text-[12px]"} leading-snug font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{it.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[9px] font-bold uppercase tracking-wide ${ch.text}`}>{ch.label}</span>
          <span className="text-muted-foreground/30">/</span>
          <span className={`text-[9px] font-semibold ${ow.text}`}>{ow.label}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors ml-auto" />
        </div>
      </button>
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
  const [openPhases, setOpenPhases] = useState<Set<string> | null>(null);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const TODAY = todayISO();

  const load = () => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing`).then(r => r.ok ? r.json() : null)
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
  const scheduleSave = (item: Item, delay: number) => { const t = timers.current.get(item.id); if (t) clearTimeout(t); timers.current.set(item.id, setTimeout(() => persist(item), delay)); };
  const setStatus = (id: number, status: Status) => setItems(prev => { const n = prev.map(i => i.id === id ? { ...i, status } : i); scheduleSave(n.find(i => i.id === id)!, 300); return n; });
  const setNotes = (id: number, notes: string) => setItems(prev => { const n = prev.map(i => i.id === id ? { ...i, notes } : i); scheduleSave(n.find(i => i.id === id)!, 700); return n; });

  const reseed = async () => {
    if (!confirm("Rebuild the plan from the template? This resets all your ticks and notes.")) return;
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing/reseed`, { method: "POST" }); load();
  };

  const daysToOpen = useMemo(() => Math.max(0, Math.ceil((parseISO(openingDate).getTime() - Date.now()) / 86400000)), [openingDate]);
  const tasks = items.filter(i => i.channel !== "rest");
  const doneCount = tasks.filter(i => i.status === "done").length;
  const overall = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const matchOwner = (i: Item) => ownerFilter === "all" || i.owner === ownerFilter || i.owner === "both";
  const matchChannel = (i: Item) => channelFilter === "all" || i.channel === channelFilter;

  const grouped = useMemo(() => {
    const byPhase: Record<string, Record<string, Item[]>> = {};
    for (const it of items) { (byPhase[it.category] ??= {}); (byPhase[it.category][it.weekStart] ??= []).push(it); }
    return byPhase;
  }, [items]);

  const dayItemsFor = (iso: string) => items.filter(i => i.dayDate === iso).sort((a, b) => a.sortOrder - b.sortOrder);
  const currentWeekSun = addDaysISO(TODAY, -parseISO(TODAY).getUTCDay());
  const currentPhase = items.find(i => i.weekStart === currentWeekSun)?.category ?? "top";
  const isPhaseOpen = (p: string) => (openPhases ? openPhases.has(p) : p === currentPhase);
  const togglePhase = (p: string) => setOpenPhases(prev => { const n = new Set(prev ?? [currentPhase]); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const todayTasks = dayItemsFor(TODAY).filter(i => i.channel !== "rest");
  const todayRest = dayItemsFor(TODAY).find(i => i.channel === "rest");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(currentWeekSun, i));

  if (!loaded) return <div className="p-6 flex items-center justify-center min-h-40"><p className="text-sm text-muted-foreground animate-pulse">Loading marketing plan...</p></div>;

  const channelTabs = [{ k: "all", label: "All" }, ...Object.keys(CHANNELS).map(k => ({ k, label: CHANNELS[k].label }))];

  return (
    <div className={`p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 ${ownerFilter === "abi" ? "f-abi" : ownerFilter === "david" ? "f-david" : ""}`}>
      <style>{`.f-abi .task:not(.o-abi):not(.o-both),.f-david .task:not(.o-david):not(.o-both){opacity:.2;filter:grayscale(.5)}`}</style>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1.5"><Megaphone className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-widest">Marketing command centre</span></div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your launch, one day at a time</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">Corrected against what is actually live on 1 September. Do today's tasks, tick them off. Tap any day for the full spec, ad copy and messages.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${saveState === "saved" ? "text-emerald-600 dark:text-emerald-400" : saveState === "saving" ? "text-muted-foreground animate-pulse" : "text-transparent"}`}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : "."}</span>
          <button onClick={reseed} title="Rebuild plan from template" className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5"><RotateCcw className="w-3 h-3" />Rebuild</button>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Winchester opens in</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{daysToOpen}<span className="text-sm font-normal text-muted-foreground ml-1">days</span></p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{dayNum(openingDate)} {monShort(openingDate)} 2026</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads vs founding cap</p>
          <p className="text-2xl font-bold mt-1 tabular-nums"><span className="text-emerald-600 dark:text-emerald-400">{FOUNDING_LEADS}</span><span className="text-muted-foreground text-lg"> / </span><span className="text-rose-600 dark:text-rose-400">{FOUNDING_CAP}</span></p>
          <p className="text-[10px] text-muted-foreground mt-0.5">leads in hand, 40 founding places</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          <ProgressRing pct={overall} />
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plan progress</p><p className="text-sm font-semibold mt-0.5 tabular-nums">{doneCount} of {tasks.length}</p><p className="text-[10px] text-muted-foreground">tasks done</p></div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost per lead now</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-amber-600 dark:text-amber-400">£5.64</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">up from £3.16, pool saturating</p>
        </div>
      </div>

      {/* ── Today spotlight ─────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><h2 className="text-base font-bold">Today, {fullDayLabel(TODAY)}</h2></div>
          <span className="text-[11px] text-muted-foreground">This week: {weekRange(currentWeekSun)}</span>
        </div>
        {todayTasks.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {todayTasks.map(it => <TaskCard key={it.id} it={it} big onOpen={() => setSelectedDay(TODAY)} onStatus={s => setStatus(it.id, s)} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{todayRest ? todayRest.title : "Nothing scheduled today. Enjoy the breather."}</p>
        )}
        {/* week strip */}
        <div className="grid grid-cols-7 gap-1.5 mt-4">
          {weekDays.map(iso => {
            const n = dayItemsFor(iso).filter(i => i.channel !== "rest").length;
            const isToday = iso === TODAY;
            return (
              <button key={iso} onClick={() => n > 0 && setSelectedDay(iso)} disabled={n === 0}
                className={`rounded-xl border px-1 py-2 text-center transition-colors ${isToday ? "border-primary bg-primary/10" : n > 0 ? "bg-card hover:bg-muted/50" : "bg-muted/20 border-transparent"}`}>
                <p className={`text-[9px] font-bold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>{dayName(iso)}</p>
                <p className={`text-sm font-semibold tabular-nums ${isToday ? "text-primary" : ""}`}>{dayNum(iso)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 h-3">{n > 0 ? `${n} task${n > 1 ? "s" : ""}` : ""}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Executive summary ─────────────────────────────────── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b bg-muted/[0.15]">
          <div className="flex items-center gap-2 text-primary mb-2"><Sparkles className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-widest">Executive summary</span></div>
          <p className="text-sm leading-relaxed text-foreground/85 max-w-3xl">
            Open Winchester on <strong>2 November</strong> as a premium, nurse-led skin clinic that earns on treatments and skincare, using the one free thing worth talking about, the <strong>AI Skin Analysis</strong>, as the way in. The demand is already proven and cheap: <strong>448 warm leads at about £3 each</strong>. So the launch is not an acquisition problem, it is a <strong>selection, conversion and capacity</strong> problem. Every channel below is sized to that: convert the people we already have, protect one nurse's diary, and build the physical and organic presence that a shop front and a second, skin-focused clinician will compound over the first year. This is also a <strong>move, not just an opening</strong>: Bedhampton is winding down, and its warm client base, the people who already know Abi, are the best founding clients we have. We invite the <strong>Bedhampton warm and cold leads</strong> to come with Abi to Winchester, honestly (it is about 25 minutes), with loyal clients offered a founding place first, while the free analysis still runs at Bedhampton until 30 October. No discounts, ever. Value comes from the free analysis, priority and founding status, and honest advice.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-px bg-border">
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 mb-1.5"><Facebook className="w-4 h-4 text-indigo-500" /><span className="text-[13px] font-bold">Meta</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 rounded-full px-2 py-0.5">Dial down</span></div>
            <p className="text-[12px] font-semibold text-foreground/90 mb-1">The paid engine, now turned down.</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">Prospecting is already live and has done its job (395 leads at £3.16, now drifting to £5.64 as the 12 mile pool saturates). Cut cold spend to about £8 a day and move it into a small retargeting campaign against the 448, plus a creative refresh led by Abi and the free scan. From here Meta warms and reminds the people we already have, it does not buy more.</p>
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 mb-1.5"><SearchIcon className="w-4 h-4 text-emerald-500" /><span className="text-[13px] font-bold">Google</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 rounded-full px-2 py-0.5">Build first</span></div>
            <p className="text-[12px] font-semibold text-foreground/90 mb-1">The gap, and the highest return fix.</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">Nothing runs today, and there is no Winchester Business Profile, so the map pack belongs to rivals with 130 to 150 reviews while we would open with none. Priority one is creating and verifying the Winchester profile with a 2 November open date, the longest lead time of anything. Paid Google is brand defence Search first, then tight local non brand once advertiser verification clears. Never name a prescription treatment.</p>
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 mb-1.5"><Mail className="w-4 h-4 text-blue-500" /><span className="text-[13px] font-bold">Newsletter</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300 bg-blue-500/10 rounded-full px-2 py-0.5">Where it is won</span></div>
            <p className="text-[12px] font-semibold text-foreground/90 mb-1">The 40 are won here, not on Meta.</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">The launch turns on converting 40 founding clients from 448 warm, opted in leads, a 9 per cent ask on a list with WhatsApp connected. The GHL nurture does it in three gentle questions, autumn or next year, which week, a held time, so nobody is ever rejected and the diary fills itself. It also carries a <strong>Bedhampton track</strong>: existing clients invited to follow Abi to Winchester with first refusal on founding, and local leads offered Bedhampton now or Winchester in November. Email, SMS and WhatsApp, every message written and ready. Highest value, almost no cost.</p>
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 mb-1.5"><Tag className="w-4 h-4 text-rose-500" /><span className="text-[13px] font-bold">Retail</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-300 bg-rose-500/10 rounded-full px-2 py-0.5">Compounds later</span></div>
            <p className="text-[12px] font-semibold text-foreground/90 mb-1">The margin the shop front unlocks.</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">Retail is not a launch day channel, it is the compounding one. The only street level unit in the city, plus a skin focused second clinician, turn the free analysis into a prescribed skincare regime sold from a real shop front rather than a treatment room. Target a 30 to 35 per cent retail attach on treatment visits, a profit line that does not use a clinical slot. December, with gift vouchers and sets, is the first real retail moment, and it grows from there.</p>
          </div>
        </div>
      </div>

      {/* ── Strategy strip ──────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4">
          <div className="flex items-center gap-2 mb-1.5"><Tag className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /><p className="text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">The one thing</p></div>
          <p className="text-xs text-foreground/80 leading-relaxed">The list is <strong>already full</strong>. 448 warm leads against 40 founding places, one nurse at 30 to 35 a week. Acquisition is not the constraint. <strong>Selection, conversion and capacity</strong> are.</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary mb-1.5">Cut the cold spend</p>
          <p className="text-xs text-foreground/80 leading-relaxed">Prospecting is buying leads for places that no longer exist, at a rising <strong>£5.64</strong>. Cut it to £8 a day and fund the <strong>conversation</strong> with the 448 instead. That frees about £422.</p>
        </div>
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5">The one number</p>
          <p className="text-xs text-foreground/80 leading-relaxed">Cost per <strong>booked-and-attended analysis</strong>, counted by hand each week, never cost per lead. Founding is <strong>priority and status, never a discount</strong>. 40 is <strong>wave one</strong> (already over half booked), because 40 is what one nurse can look after; the waitlist becomes <strong>wave two</strong> when the second clinician starts.</p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2 -mx-1 px-1 rounded-xl">
        <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-muted/60 border">
          {channelTabs.map(t => (
            <button key={t.k} onClick={() => setChannelFilter(t.k)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${channelFilter === t.k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
          ))}
        </div>
        <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-muted/60 border sm:ml-auto">
          {[{ k: "all", label: "Everyone" }, { k: "abi", label: "Abi" }, { k: "david", label: "David" }].map(t => (
            <button key={t.k} onClick={() => setOwnerFilter(t.k)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${ownerFilter === t.k ? (t.k === "abi" ? "bg-rose-500 text-white" : t.k === "david" ? "bg-sky-600 text-white" : "bg-card shadow-sm text-foreground") : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── The full plan (collapsible phases) ──────────────── */}
      <div className="space-y-3">
        {PHASE_ORDER.filter(p => grouped[p]).map(phaseId => {
          const open = isPhaseOpen(phaseId);
          const weeks = Object.keys(grouped[phaseId]).sort();
          const pItems = Object.values(grouped[phaseId]).flat().filter(i => i.channel !== "rest");
          const pDone = pItems.filter(i => i.status === "done").length;
          const isCurrent = phaseId === currentPhase;
          return (
            <div key={phaseId} className={`rounded-2xl border overflow-hidden ${isCurrent ? "border-primary/40" : ""}`}>
              <button onClick={() => togglePhase(phaseId)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-muted/30 transition-colors text-left">
                <div className="flex items-baseline gap-2.5 min-w-0 flex-1">
                  <span className="text-base font-bold">{PHASES[phaseId]?.label}</span>
                  {isCurrent && <span className="text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2 py-0.5">Now</span>}
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">{PHASES[phaseId]?.sub}</span>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">{pDone}/{pItems.length}</span>
                <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden shrink-0 hidden sm:block"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pItems.length ? (pDone / pItems.length) * 100 : 0}%` }} /></div>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {open && (
                <div className="px-3 sm:px-4 pb-4 pt-1 space-y-3 border-t bg-muted/[0.15]">
                  {weeks.map(sun => {
                    const weekItems = grouped[phaseId][sun];
                    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(sun, i));
                    return (
                      <div key={sun} className="rounded-xl border bg-card overflow-hidden">
                        <div className="px-4 py-2 border-b bg-muted/30"><span className="text-[12px] font-bold tabular-nums">{weekRange(sun)}</span></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 divide-y sm:divide-y-0">
                          {days.map(iso => {
                            const dayItems = weekItems.filter(i => i.dayDate === iso).sort((a, b) => a.sortOrder - b.sortOrder);
                            const rest = dayItems.find(i => i.channel === "rest");
                            const acts = dayItems.filter(i => i.channel !== "rest");
                            const visible = acts.filter(matchChannel).filter(matchOwner);
                            const ms = MILESTONES[iso];
                            const isToday = iso === TODAY;
                            const hasDetail = acts.length > 0;
                            return (
                              <div key={iso} className={`xl:border-r last:border-r-0 p-2.5 min-h-[92px] flex flex-col gap-1.5 ${isToday ? "bg-primary/[0.06]" : ms ? "bg-amber-50/40 dark:bg-amber-950/15" : ""}`}>
                                <button onClick={() => hasDetail && setSelectedDay(iso)} disabled={!hasDetail} className="flex items-center justify-between text-left w-full">
                                  <span className="flex items-baseline gap-1.5">
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? "text-primary" : ms ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{dayName(iso)}</span>
                                    <span className={`text-[13px] font-bold tabular-nums ${isToday ? "text-primary" : ""}`}>{dayNum(iso)}</span>
                                  </span>
                                  {isToday && <span className="text-[8px] font-bold uppercase text-primary bg-primary/15 rounded px-1 py-0.5">Today</span>}
                                </button>
                                {ms && <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 -mt-0.5">{ms}</p>}
                                {visible.map(it => <TaskCard key={it.id} it={it} onOpen={() => setSelectedDay(iso)} onStatus={s => setStatus(it.id, s)} />)}
                                {rest && acts.length === 0 && <p className="text-[10.5px] text-muted-foreground italic mt-auto pt-1">{rest.title}</p>}
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
      </div>

      {/* ── Day detail modal ────────────────────────────────── */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{fullDayLabel(selectedDay)}</h3>
                  {MILESTONES[selectedDay] && <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 rounded-full px-2 py-0.5">{MILESTONES[selectedDay]}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Everything on this day, in full. Tick tasks off as you go.</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {dayItemsFor(selectedDay).map(it => {
                if (it.channel === "rest") return <p key={it.id} className="text-sm text-muted-foreground italic px-1">{it.title}</p>;
                const ch = CHANNELS[it.channel] ?? CHANNELS.found;
                const ow = OWNERS[it.owner] ?? OWNERS.both;
                const blocks = parseDeep(it.deep);
                return (
                  <div key={it.id} className={`rounded-xl border border-l-[3px] ${ch.bar} p-4`}>
                    <div className="flex items-start gap-2.5">
                      <div className="pt-0.5"><StatusToggle status={it.status} onChange={s => setStatus(it.id, s)} big /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wide ${ch.text}`}>{ch.label}</span>
                          <span className="text-muted-foreground/30">/</span>
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase`}><span className={`w-1.5 h-1.5 rounded-full ${ow.badge}`} /><span className={ow.text}>{ow.label}</span></span>
                          <span className="text-[10px] text-muted-foreground ml-1">{ch.where}</span>
                        </div>
                        <p className={`text-[15px] font-semibold leading-snug ${it.status === "done" ? "line-through text-muted-foreground" : ""}`}>{it.title}</p>
                        {it.detail && <p className="text-[12.5px] text-muted-foreground mt-1">{it.detail}</p>}
                      </div>
                    </div>
                    {blocks.length > 0 ? (
                      <div className="mt-3 space-y-2">{blocks.map((b, i) => <BlockRow key={i} blk={b} />)}</div>
                    ) : (
                      <p className="mt-3 text-[12px] text-muted-foreground italic">Full detail for this task is being written.</p>
                    )}
                    <Textarea placeholder="Your notes..." value={it.notes} onChange={e => setNotes(it.id, e.target.value)} className="mt-3 text-[12.5px] min-h-[44px] resize-none" />
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
