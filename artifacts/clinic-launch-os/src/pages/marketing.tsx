import React, { useState, useEffect, useMemo, useRef } from "react";
import { Megaphone, Palette, Globe, CalendarDays, Rocket, ChevronDown, ChevronUp, Users, Plus, Minus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ResetPageButton } from "@/components/reset-page-button";

const PROJECT_ID = 1;
const API_BASE = "/api";
const WAITLIST_TARGET = 30;

type Status = "not_started" | "in_progress" | "done" | "na";
type Category = "brand" | "platform" | "content" | "launch";

interface MarketingItem {
  id: number;
  projectId: number;
  category: Category;
  title: string;
  status: Status;
  dueWeeksBeforeOpen: number | null;
  notes: string;
  sortOrder: number;
}

const STATUS_META: Record<Status, { label: string; color: string; next: Status }> = {
  not_started: {
    label: "Not started",
    color: "bg-muted text-muted-foreground border-border hover:border-primary/40",
    next: "in_progress",
  },
  in_progress: {
    label: "In progress",
    color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700",
    next: "done",
  },
  done: {
    label: "✓ Done",
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700",
    next: "na",
  },
  na: {
    label: "N/A",
    color: "bg-muted/50 text-muted-foreground/50 border-border/30",
    next: "not_started",
  },
};

// ─── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({
  item,
  expanded,
  onToggleExpand,
  onCycleStatus,
  onNotesChange,
  weekLabel,
}: {
  item: MarketingItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onCycleStatus: () => void;
  onNotesChange: (n: string) => void;
  weekLabel: string | null;
}) {
  const sm = STATUS_META[item.status];
  const isCompliance = item.title.startsWith("⚠");
  return (
    <div className={`rounded-xl border transition-all ${
      isCompliance
        ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
        : item.status === "done"
        ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/20 dark:bg-emerald-950/5"
        : item.status === "na"
        ? "border-border/30 bg-muted/5 opacity-55"
        : "border-border/60 bg-card"
    }`}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        {!isCompliance && (
          <button
            onClick={onCycleStatus}
            title="Click to cycle status"
            className={`text-[9px] font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-all hover:scale-105 ${sm.color}`}
          >
            {sm.label}
          </button>
        )}
        <div className="flex-1 min-w-0">
          {weekLabel && (
            <span className="inline-block text-[9px] font-semibold text-primary/80 bg-primary/8 px-1.5 py-0.5 rounded mr-1.5 align-middle">
              {weekLabel}
            </span>
          )}
          <span className={`text-sm leading-snug ${item.status === "na" ? "line-through text-muted-foreground" : isCompliance ? "text-amber-700 dark:text-amber-400 font-medium" : ""}`}>
            {item.title}
          </span>
          {item.notes && !expanded && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.notes}</p>
          )}
        </div>
        {!isCompliance && (
          <button
            onClick={onToggleExpand}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 p-0.5"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {expanded && !isCompliance && (
        <div className="px-3.5 pb-3.5">
          <Textarea
            placeholder="Notes, links, contacts, decisions…"
            value={item.notes}
            onChange={e => onNotesChange(e.target.value)}
            className="text-xs min-h-[64px] resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Summary Generator ─────────────────────────────────────────────────────────
function getSummary(
  tab: Category,
  byCategory: Record<Category, MarketingItem[]>,
  readiness: Record<Category, number>,
  openingDate: string | null,
  waitlist: number,
  activePlatforms: number,
): string {
  switch (tab) {
    case "brand": {
      const items = byCategory.brand;
      const done = items.filter(i => i.status === "done").length;
      const todo = items.filter(i => i.status === "not_started");
      if (done === 0)
        return "Brand identity is the foundation everything else builds on — logo, colours, fonts, photography. None of it is locked in yet. Start here before setting up any platforms.";
      if (done === items.length)
        return "Brand setup is complete. Every identity asset is confirmed and ready to use across all platforms.";
      return `${done}/${items.length} brand elements complete (${readiness.brand}%).${todo.length > 0 ? ` Still to do: ${todo.slice(0, 2).map(i => i.title.split("—")[0].trim()).join(", ")}${todo.length > 2 ? ` and ${todo.length - 2} more` : ""}.` : ""}`;
    }
    case "platform": {
      const total = byCategory.platform.length;
      const inProg = byCategory.platform.filter(i => i.status === "in_progress").length;
      if (activePlatforms === 0 && inProg === 0)
        return "No platforms are live yet. Google Business Profile and Instagram are the two highest-impact starting points for a new aesthetics clinic — both are free.";
      if (activePlatforms === total)
        return "Every platform is live and fully set up. You're ready to run a coordinated multi-channel launch campaign from day one.";
      return `${activePlatforms}/${total} platforms live${inProg > 0 ? `, ${inProg} in progress` : ""}. ${byCategory.platform.filter(i => i.status === "not_started").length} still to set up.`;
    }
    case "content": {
      const contentItems = byCategory.content.filter(i => !i.title.startsWith("⚠"));
      const done = contentItems.filter(i => i.status === "done").length;
      const daysToOpen = openingDate
        ? Math.ceil((new Date(openingDate + "T12:00:00").getTime() - Date.now()) / 86400000)
        : null;
      const weeksToOpen = daysToOpen !== null ? Math.floor(daysToOpen / 7) : null;
      if (done === 0)
        return `Content marketing should start 12 weeks before opening${weeksToOpen !== null ? ` — that's around week ${weeksToOpen < 12 ? `−${weeksToOpen}` : "−12"} from now` : ""}. Start with brand reveal and practitioner introduction content to build recognition before you open.`;
      return `${done}/${contentItems.length} content phases complete.${weeksToOpen !== null ? ` ${weeksToOpen} weeks until opening.` : ""}${done < contentItems.length ? " Mark each phase done as you publish the content." : " All content phases published — ready for launch."}`;
    }
    case "launch": {
      const launchItems = byCategory.launch;
      const done = launchItems.filter(i => i.status === "done").length;
      const total = launchItems.length;
      if (done === 0)
        return "Launch week planning not started yet. Aim to have all logistics confirmed 4 weeks before opening — photographer, influencers, and the opening offer take the longest to arrange.";
      if (done === total)
        return `Launch week is fully planned and ready to go.${waitlist > 0 ? ` ${waitlist} people on your waitlist ready to book.` : ""}`;
      return `${done}/${total} launch items confirmed.${waitlist > 0 ? ` ${waitlist} on the waitlist${waitlist >= WAITLIST_TARGET ? " — target hit! 🎉" : ` (target: ${WAITLIST_TARGET})`}.` : " No waitlist yet — start capturing pre-opening interest now."}`;
    }
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [items, setItems] = useState<MarketingItem[]>([]);
  const [waitlist, setWaitlist] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Category>("brand");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [openingDate, setOpeningDate] = useState<string | null>(null);
  const itemTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setItems((data.items ?? []) as MarketingItem[]);
          setWaitlist(data.waitlistCount ?? 0);
        }
        setLoaded(true);
        setSaveStatus("idle");
      });
    fetch(`${API_BASE}/projects/${PROJECT_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p?.targetOpeningDate) setOpeningDate(p.targetOpeningDate); })
      .catch(() => {});
  }, []);

  const persistItem = (item: MarketingItem) => {
    setSaveStatus("saving");
    fetch(`${API_BASE}/marketing/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status, notes: item.notes }),
    })
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("unsaved"));
  };

  const scheduleItemSave = (item: MarketingItem, delay = 600) => {
    const t = itemTimers.current.get(item.id);
    if (t) clearTimeout(t);
    itemTimers.current.set(item.id, setTimeout(() => persistItem(item), delay));
  };

  const cycleStatus = (id: number) => {
    setItems(prev => {
      const next = prev.map(i =>
        i.id === id ? { ...i, status: STATUS_META[i.status].next } : i
      );
      const changed = next.find(i => i.id === id)!;
      scheduleItemSave(changed, 400);
      setSaveStatus("unsaved");
      return next;
    });
  };

  const updateNotes = (id: number, notes: string) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, notes } : i);
      const changed = next.find(i => i.id === id)!;
      scheduleItemSave(changed, 800);
      setSaveStatus("unsaved");
      return next;
    });
  };

  const updateWaitlist = (n: number) => {
    const next = Math.max(0, n);
    setWaitlist(next);
    fetch(`${API_BASE}/projects/${PROJECT_ID}/marketing/waitlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: next }),
    }).catch(() => {});
  };

  const resetMarketing = async () => {
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/reset/marketing`, { method: "POST" });
    setItems(prev => prev.map(i => ({ ...i, status: "not_started" as Status, notes: "" })));
    setWaitlist(0);
    setSaveStatus("idle");
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const byCategory = useMemo(() => ({
    brand: items.filter(i => i.category === "brand").sort((a, b) => a.sortOrder - b.sortOrder),
    platform: items.filter(i => i.category === "platform").sort((a, b) => a.sortOrder - b.sortOrder),
    content: items.filter(i => i.category === "content").sort((a, b) => a.sortOrder - b.sortOrder),
    launch: items.filter(i => i.category === "launch").sort((a, b) => a.sortOrder - b.sortOrder),
  }), [items]);

  const readiness = useMemo(() => {
    const calc = (these: MarketingItem[]) => {
      const applicable = these.filter(i => i.status !== "na" && !i.title.startsWith("⚠"));
      if (!applicable.length) return 0;
      const score = applicable.reduce(
        (acc, i) => acc + (i.status === "done" ? 1 : i.status === "in_progress" ? 0.5 : 0),
        0,
      );
      return Math.round((score / applicable.length) * 100);
    };
    return {
      brand: calc(byCategory.brand),
      platform: calc(byCategory.platform),
      content: calc(byCategory.content),
      launch: calc(byCategory.launch),
    };
  }, [byCategory]);

  const overall = Math.round(Object.values(readiness).reduce((a, b) => a + b, 0) / 4);

  const daysToOpen = useMemo(() => {
    if (!openingDate) return null;
    return Math.ceil((new Date(openingDate + "T12:00:00").getTime() - Date.now()) / 86400000);
  }, [openingDate]);

  const activePlatforms = byCategory.platform.filter(i => i.status === "done").length;

  // Opening date → week label for content calendar items
  const weekLabel = (weeksBeforeOpen: number | null): string | null => {
    if (weeksBeforeOpen === null) return null;
    if (!openingDate) return weeksBeforeOpen === 0 ? "Launch week" : `Week ${weeksBeforeOpen}`;
    const open = new Date(openingDate + "T12:00:00");
    const d = new Date(open.getTime() + weeksBeforeOpen * 7 * 86400000);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs: { key: Category; label: string; icon: React.ElementType }[] = [
    { key: "brand",    label: "Brand Setup",   icon: Palette },
    { key: "platform", label: "Platforms",     icon: Globe },
    { key: "content",  label: "Content",       icon: CalendarDays },
    { key: "launch",   label: "Launch Week",   icon: Rocket },
  ];

  if (!loaded) {
    return (
      <div className="p-6 flex items-center justify-center min-h-40">
        <p className="text-sm text-muted-foreground animate-pulse">Loading marketing plan…</p>
      </div>
    );
  }

  const tabItems = byCategory[tab];
  const tabDone = tabItems.filter(i => i.status === "done").length;
  const tabApplicable = tabItems.filter(i => i.status !== "na" && !i.title.startsWith("⚠")).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Marketing & Launch</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Pre-launch sequence • Brand setup • Waitlist building</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              saveStatus === "saved"   ? "text-emerald-600 dark:text-emerald-400"
              : saveStatus === "saving"  ? "text-muted-foreground animate-pulse"
              : saveStatus === "unsaved" ? "text-amber-600 dark:text-amber-400"
              : ""
            }`}>
              {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : ""}
            </span>
            <ResetPageButton
              pageLabel="Marketing"
              description="Resets all marketing item statuses and notes to blank. Your project plan, financials, and all other pages are untouched."
              onReset={resetMarketing}
            />
          </div>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Readiness</p>
            <p className={`text-xl font-bold ${
              overall >= 70 ? "text-emerald-600 dark:text-emerald-400"
              : overall >= 40 ? "text-primary"
              : "text-amber-500"
            }`}>{overall}%</p>
            <p className="text-[10px] text-muted-foreground">
              {overall >= 70 ? "On track for launch" : overall >= 40 ? "Good progress" : "Early stage"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waitlist</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                onClick={() => updateWaitlist(waitlist - 1)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60"
              >
                <Minus className="w-3 h-3" />
              </button>
              <p className={`text-xl font-bold min-w-[2ch] text-center ${waitlist >= WAITLIST_TARGET ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                {waitlist}
              </p>
              <button
                onClick={() => updateWaitlist(waitlist + 1)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${waitlist >= WAITLIST_TARGET ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, Math.round((waitlist / WAITLIST_TARGET) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">/{WAITLIST_TARGET}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Opens in</p>
            <p className="text-xl font-bold">
              {daysToOpen !== null ? daysToOpen : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">{daysToOpen !== null ? "d" : ""}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {openingDate
                ? new Date(openingDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "Set in Financials"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live platforms</p>
            <p className="text-xl font-bold">
              {activePlatforms}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">/{byCategory.platform.length}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">channels active</p>
          </div>
        </div>

        {/* ── 4-domain mini scorecard ──────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/40">
          {tabs.map(({ key, label, icon: Icon }) => {
            const pct = readiness[key];
            const color = pct >= 70 ? "emerald" : pct >= 40 ? "primary" : "amber";
            const textCls = color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : color === "primary" ? "text-primary" : "text-amber-600 dark:text-amber-400";
            const barCls  = color === "emerald" ? "bg-emerald-500" : color === "primary" ? "bg-primary" : "bg-amber-500";
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/3 transition-all text-center"
              >
                <Icon className={`w-3.5 h-3.5 ${textCls} group-hover:scale-110 transition-transform`} />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight hidden sm:block">{label}</span>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-[10px] font-bold ${textCls}`}>{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {tabs.map(({ key, label, icon: Icon }) => {
          const these = byCategory[key];
          const done = these.filter(i => i.status === "done").length;
          const applicable = these.filter(i => i.status !== "na" && !i.title.startsWith("⚠")).length;
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
              {done > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                  done === applicable
                    ? (isActive ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")
                    : (isActive ? "bg-white/20 text-white" : "bg-primary/15 text-primary")
                }`}>
                  {done}/{applicable}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* Summary */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            {React.createElement(tabs.find(t => t.key === tab)!.icon, { className: "w-3 h-3" })}
            {tabs.find(t => t.key === tab)!.label} — overview
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {getSummary(tab, byCategory, readiness, openingDate, waitlist, activePlatforms)}
          </p>
        </div>

        {/* Progress line */}
        {tabApplicable > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  readiness[tab] >= 70 ? "bg-emerald-500" : readiness[tab] >= 40 ? "bg-primary" : "bg-amber-500"
                }`}
                style={{ width: `${readiness[tab]}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
              {tabDone}/{tabApplicable} done
            </span>
          </div>
        )}

        {/* Items */}
        {tabItems.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            expanded={expanded.has(item.id)}
            onToggleExpand={() => toggleExpand(item.id)}
            onCycleStatus={() => cycleStatus(item.id)}
            onNotesChange={n => updateNotes(item.id, n)}
            weekLabel={
              item.category === "content" && item.dueWeeksBeforeOpen !== null
                ? weekLabel(item.dueWeeksBeforeOpen)
                : null
            }
          />
        ))}

        {/* Bottom encouragement for each tab */}
        {tab === "brand" && readiness.brand === 100 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Brand locked ✓</p>
            <p className="text-xs text-muted-foreground mt-0.5">Every identity asset is confirmed. Now set up your platforms.</p>
          </div>
        )}
        {tab === "launch" && readiness.launch === 100 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Ready for opening day ✓</p>
            <p className="text-xs text-muted-foreground mt-0.5">Every launch element is confirmed. Go build something great.</p>
          </div>
        )}
        {tab === "content" && waitlist >= WAITLIST_TARGET && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Waitlist target hit — {waitlist} sign-ups</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your content is converting. Keep the momentum going into launch week.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
