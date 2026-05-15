import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, Clock, Sun, Heart, Users,
  Stethoscope, Leaf, AlertCircle, Star, ChevronRight,
  CalendarDays, ArrowRight, Shield, Sparkles,
} from "lucide-react";

const PROJECT_ID = 1;
const API_BASE = "/api";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type Day = typeof DAYS[number];
type TabKey = "schedule" | "family" | "nursing" | "wellbeing" | "identity";

interface Plan {
  clinicDays: string[]; clinicOpenTime: string; clinicCloseTime: string; scheduleNotes: string;
  schoolStartTime: string; schoolFinishTime: string; dropCoveredBy: string; pickupCoveredBy: string;
  schoolContingencyPlan: string; davidAvailabilityDays: number; davidRoleNotes: string;
  nursingStatus: string; nursingNoticeWeeks: number; targetExitDate: string; nursingExitNotes: string;
  maxClinicDaysPerWeek: number; sickCoverPlan: string; holidayPlan: string; nonNegotiables: string;
  mostExcitedAbout: string; biggestConcerns: string; supportNetwork: string;
  scheduleChecks: string[]; familyChecks: string[]; nursingChecks: string[];
  wellbeingChecks: string[]; identityChecks: string[];
}

const EMPTY: Plan = {
  clinicDays: ["Mon", "Tue", "Wed", "Thu"], clinicOpenTime: "09:00", clinicCloseTime: "18:00", scheduleNotes: "",
  schoolStartTime: "09:00", schoolFinishTime: "15:30", dropCoveredBy: "", pickupCoveredBy: "",
  schoolContingencyPlan: "", davidAvailabilityDays: 5, davidRoleNotes: "",
  nursingStatus: "still_working", nursingNoticeWeeks: 12, targetExitDate: "", nursingExitNotes: "",
  maxClinicDaysPerWeek: 4, sickCoverPlan: "", holidayPlan: "", nonNegotiables: "",
  mostExcitedAbout: "", biggestConcerns: "", supportNetwork: "",
  scheduleChecks: [], familyChecks: [], nursingChecks: [], wellbeingChecks: [], identityChecks: [],
};

function parseJson(s: unknown, fallback: string[]): string[] {
  if (Array.isArray(s)) return s;
  try { return s ? JSON.parse(s as string) : fallback; } catch { return fallback; }
}
function fromApi(raw: Record<string, unknown>): Plan {
  return { ...EMPTY, ...raw,
    clinicDays: parseJson(raw.clinicDays, EMPTY.clinicDays),
    scheduleChecks: parseJson(raw.scheduleChecks, []), familyChecks: parseJson(raw.familyChecks, []),
    nursingChecks: parseJson(raw.nursingChecks, []), wellbeingChecks: parseJson(raw.wellbeingChecks, []),
    identityChecks: parseJson(raw.identityChecks, []),
  } as Plan;
}
function toApi(p: Plan) {
  return { ...p,
    clinicDays: JSON.stringify(p.clinicDays), scheduleChecks: JSON.stringify(p.scheduleChecks),
    familyChecks: JSON.stringify(p.familyChecks), nursingChecks: JSON.stringify(p.nursingChecks),
    wellbeingChecks: JSON.stringify(p.wellbeingChecks), identityChecks: JSON.stringify(p.identityChecks),
  };
}

// ─── Checklist data ───────────────────────────────────────────────────────────
const SCHEDULE_CHECKS = [
  { key: "buffer_day", label: "At least one fully protected non-clinic day per week — in the diary, not optional" },
  { key: "school_time_ok", label: "Clinic open time doesn't clash with school drop on working days" },
  { key: "late_cutoff", label: "Decided the latest appointment you'll take — and held to it" },
  { key: "lunch_plan", label: "Planned what happens if a client overruns and it's school pickup time" },
  { key: "admin_day", label: "One day per week set aside for admin, emails, ordering — no clients" },
];
const FAMILY_CHECKS = [
  { key: "drop_agreed", label: "Drop-off agreed for every clinic day — name in the diary, not 'we'll sort it'" },
  { key: "pickup_agreed", label: "Pickup agreed for every clinic day" },
  { key: "inset_days", label: "Plan for INSET days, half terms, and school holidays" },
  { key: "sick_child", label: "Plan for when Eli or Elsy is too unwell for school" },
  { key: "school_events", label: "Sports day, assemblies, parents' evenings — who attends if clinic is booked?" },
  { key: "david_diary", label: "David's commitments are in a shared calendar, not just a conversation" },
  { key: "emergency_backup", label: "Emergency backup contact set up — school has someone to call if needed" },
  { key: "david_ok", label: "David genuinely wants to do this — not just said yes to be supportive" },
];
const NURSING_CHECKS = [
  { key: "notice_confirmed", label: "Read your employment contract — confirmed the exact notice period required" },
  { key: "handover_sketch", label: "Sketched a rough handover plan — ward won't be left in the lurch" },
  { key: "reference_ready", label: "Professional reference lined up who won't be surprised when asked" },
  { key: "nmc_checked", label: "Checked NMC registration — you can remain registered after leaving NHS employment" },
  { key: "david_on_board", label: "Told David the target exit date — not a plan, a date" },
  { key: "emotional_processed", label: "Had the emotional conversation — this is an identity shift, not just a job change" },
  { key: "slow_ramp_ok", label: "Plan in place if clinic ramp is slower than modelled — financially and personally" },
  { key: "ward_notified", label: "Ward will know in time to plan locum cover — not a last-minute surprise" },
];
const WELLBEING_CHECKS = [
  { key: "quiet_week_plan", label: "Have a plan for a week with very few bookings — financially and emotionally" },
  { key: "peer_found", label: "Identified a mentor, peer, or business friend to talk to at least monthly" },
  { key: "alarm_agreed", label: "Agreed with David what 'this isn't working' looks like — and the trigger date" },
  { key: "holiday_planned", label: "First holiday post-opening is planned — even if it's just 3 days" },
  { key: "passion_protected", label: "One thing outside clinic and kids that's yours — protected time, not optional" },
  { key: "evening_boundary", label: "Agreed with David: after a set time, no clinic talk — enforced from week 1" },
];
const IDENTITY_CHECKS = [
  { key: "said_it_aloud", label: "Practised saying 'I own an aesthetics clinic' without immediately qualifying it" },
  { key: "qualified_answer", label: "Ready answer for 'but are you really qualified?' — clear, confident, no apology" },
  { key: "community_identified", label: "Found an aesthetics practitioner community to belong to" },
  { key: "colleagues_told", label: "Told the nursing colleagues who matter — directly, not as a rumour" },
  { key: "success_vision", label: "Written down what success looks like in 12 months — not just financially" },
  { key: "failure_named", label: "Named what 'this isn't working' would look like — so it's not a secret fear" },
  { key: "grieved_nursing", label: "Given yourself permission to grieve leaving nursing, even if you're excited" },
];

// ─── Shared components ────────────────────────────────────────────────────────
function Checklist({ items, checked, onChange, accent = "emerald" }: {
  items: { key: string; label: string }[];
  checked: string[];
  onChange: (keys: string[]) => void;
  accent?: "emerald" | "primary" | "violet";
}) {
  const toggle = (key: string) =>
    onChange(checked.includes(key) ? checked.filter(k => k !== key) : [...checked, key]);
  const done = checked.filter(k => items.some(i => i.key === k)).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            accent === "emerald" ? "bg-emerald-500" : accent === "violet" ? "bg-violet-500" : "bg-primary"
          }`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground w-16 text-right">{done}/{items.length} done</span>
      </div>
      {items.map((item, i) => {
        const ticked = checked.includes(item.key);
        return (
          <button key={item.key} onClick={() => toggle(item.key)}
            className={`w-full flex items-start gap-3 text-left p-2.5 rounded-lg border transition-all ${
              ticked ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/60" : "border-transparent hover:bg-muted/40"
            }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              ticked ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/30"
            }`}>
              {ticked && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
            <span className={`text-sm leading-snug transition-all ${ticked ? "text-muted-foreground line-through decoration-emerald-400" : "text-foreground"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TabBadge({ checks, items }: { checks: string[]; items: { key: string }[] }) {
  const done = checks.filter(k => items.some(i => i.key === k)).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (done === 0) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      pct === 100 ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/20 text-primary"
    }`}>{done}/{total}</span>
  );
}

// ─── Visual Week Grid ─────────────────────────────────────────────────────────
function WeekGrid({ clinicDays, openTime, closeTime, schoolStart, schoolEnd }: {
  clinicDays: string[]; openTime: string; closeTime: string; schoolStart: string; schoolEnd: string;
}) {
  const DAY_RANGE_START = 7; // 7am
  const DAY_RANGE_END = 20;  // 8pm
  const totalMins = (DAY_RANGE_END - DAY_RANGE_START) * 60;

  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h - DAY_RANGE_START) * 60 + (m || 0);
  };

  const openMins = Math.max(0, toMins(openTime));
  const closeMins = Math.min(totalMins, toMins(closeTime));
  const dropMins = Math.max(0, toMins(schoolStart) - 20);
  const dropEndMins = Math.min(totalMins, toMins(schoolStart) + 10);
  const pickupMins = Math.max(0, toMins(schoolEnd) - 10);
  const pickupEndMins = Math.min(totalMins, toMins(schoolEnd) + 30);

  const pct = (m: number) => `${(m / totalMins) * 100}%`;

  const hours = Array.from({ length: DAY_RANGE_END - DAY_RANGE_START + 1 }, (_, i) => i + DAY_RANGE_START);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/40 inline-block" /> Clinic hours</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/60 inline-block" /> School drop window</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-400/50 inline-block" /> Pickup window</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted/60 border inline-block" /> Off</span>
      </div>
      <div className="flex gap-1 items-stretch">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-[9px] text-muted-foreground w-6 shrink-0 pt-5 pb-0.5">
          {hours.filter((_, i) => i % 2 === 0).map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {/* Day columns */}
        {DAYS.map(day => {
          const isClinic = clinicDays.includes(day);
          return (
            <div key={day} className="flex-1 min-w-0">
              <div className={`text-[10px] font-semibold text-center mb-1 ${isClinic ? "text-primary" : "text-muted-foreground/50"}`}>{day}</div>
              <div className="relative rounded-md overflow-hidden bg-muted/20 border border-border/30" style={{ height: 200 }}>
                {isClinic && (
                  <div className="absolute left-0 right-0 bg-primary/30 border-l-2 border-primary/60" style={{
                    top: pct(openMins), height: pct(closeMins - openMins),
                  }} />
                )}
                {/* School drop window */}
                <div className="absolute left-0 right-0 bg-amber-400/40" style={{
                  top: pct(dropMins), height: pct(dropEndMins - dropMins),
                }} />
                {/* School pickup window */}
                <div className="absolute left-0 right-0 bg-violet-400/35" style={{
                  top: pct(pickupMins), height: pct(pickupEndMins - pickupMins),
                }} />
                {/* Hour lines */}
                {hours.filter((_, i) => i % 2 === 0).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-border/20" style={{ top: `${(i / ((DAY_RANGE_END - DAY_RANGE_START) / 2)) * 100}%` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">Clinic: {openTime}–{closeTime} · School drop: ~{schoolStart} · Pickup: ~{schoolEnd}</p>
    </div>
  );
}

// ─── Nursing timeline ─────────────────────────────────────────────────────────
function NursingTimeline({ status, noticeWeeks, exitDate }: {
  status: string; noticeWeeks: number; exitDate: string;
}) {
  const today = new Date();
  const exitDateObj = exitDate ? new Date(exitDate + "-01") : null;
  const noticeDeadline = exitDateObj
    ? new Date(exitDateObj.getTime() - noticeWeeks * 7 * 24 * 60 * 60 * 1000)
    : null;
  const clinicOpen = new Date("2026-11-01");

  const fmtDate = (d: Date | null) => d
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Not set";

  const milestones = [
    {
      label: "Today",
      date: today,
      done: true,
      color: "bg-emerald-500",
      ring: "ring-emerald-400",
      note: status === "left" ? "Already left nursing" : status === "notice_given" ? "Notice given" : status === "exploring" ? "Planning your exit" : "Still working as normal",
    },
    {
      label: "Give Notice",
      date: noticeDeadline,
      done: noticeDeadline ? today >= noticeDeadline : false,
      color: noticeDeadline && today >= noticeDeadline ? "bg-emerald-500" : "bg-primary",
      ring: "ring-primary/40",
      note: noticeDeadline ? `Deadline: ${fmtDate(noticeDeadline)}` : "Set your exit date to calculate",
    },
    {
      label: "Last Day",
      date: exitDateObj,
      done: exitDateObj ? today >= exitDateObj : false,
      color: exitDateObj && today >= exitDateObj ? "bg-emerald-500" : "bg-amber-500",
      ring: "ring-amber-400/40",
      note: exitDateObj ? fmtDate(exitDateObj) : "Set your target exit date",
    },
    {
      label: "Clinic Opens",
      date: clinicOpen,
      done: today >= clinicOpen,
      color: today >= clinicOpen ? "bg-emerald-500" : "bg-violet-500",
      ring: "ring-violet-400/40",
      note: "Target: 1 Nov 2026",
    },
  ];

  return (
    <div className="relative py-6 px-2">
      {/* Connecting line */}
      <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border -translate-y-1/2 mt-3" />
      <div className="grid grid-cols-4 gap-2 relative z-10">
        {milestones.map((m, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-2">
            <div className={`w-9 h-9 rounded-full ${m.done ? "bg-emerald-500" : i === 1 ? "bg-primary" : i === 2 ? "bg-amber-400" : "bg-violet-500"} ring-4 ${m.ring} flex items-center justify-center shadow-md`}>
              {m.done ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <span className="text-white text-xs font-bold">{i + 1}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold">{m.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{m.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Protected week visualiser ────────────────────────────────────────────────
function ProtectedWeek({ clinicDays, maxDays }: { clinicDays: string[]; maxDays: number }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map(day => {
          const isClinic = clinicDays.includes(day);
          const isMax = !isClinic && clinicDays.length >= maxDays;
          return (
            <div key={day} className={`rounded-lg p-2 flex flex-col items-center gap-1 ${
              isClinic ? "bg-primary/20 border border-primary/40" : "bg-emerald-500/10 border border-emerald-500/30"
            }`}>
              <span className="text-[9px] font-semibold text-muted-foreground">{day.slice(0, 1)}</span>
              <div className={`w-2 h-2 rounded-full ${isClinic ? "bg-primary" : "bg-emerald-500"}`} />
              <span className={`text-[8px] font-medium ${isClinic ? "text-primary" : "text-emerald-600 dark:text-emerald-400"}`}>
                {isClinic ? "Clinic" : "Life"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> {clinicDays.length} clinic days</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {7 - clinicDays.length} protected</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifestylePage() {
  const [plan, setPlan] = useState<Plan>(EMPTY);
  const [tab, setTab] = useState<TabKey>("schedule");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlan(fromApi(data)); setLoaded(true); setSaveStatus("idle"); });
  }, []);

  const save = useCallback((p: Plan) => {
    setSaveStatus("saving");
    fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApi(p)),
    }).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("unsaved"));
  }, []);

  const update = useCallback((patch: Partial<Plan>) => {
    setPlan(prev => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), 700);
      setSaveStatus("unsaved");
      return next;
    });
  }, [save]);

  // Computed status signals
  const allChecks = [
    ...plan.scheduleChecks.filter(k => SCHEDULE_CHECKS.some(i => i.key === k)),
    ...plan.familyChecks.filter(k => FAMILY_CHECKS.some(i => i.key === k)),
    ...plan.nursingChecks.filter(k => NURSING_CHECKS.some(i => i.key === k)),
    ...plan.wellbeingChecks.filter(k => WELLBEING_CHECKS.some(i => i.key === k)),
    ...plan.identityChecks.filter(k => IDENTITY_CHECKS.some(i => i.key === k)),
  ];
  const totalChecks = SCHEDULE_CHECKS.length + FAMILY_CHECKS.length + NURSING_CHECKS.length + WELLBEING_CHECKS.length + IDENTITY_CHECKS.length;
  const lifeReadiness = Math.round((allChecks.length / totalChecks) * 100);

  const schoolDropConflict = plan.clinicDays.length > 0 && (() => {
    const openH = parseInt(plan.clinicOpenTime);
    const schoolH = parseInt(plan.schoolStartTime);
    return openH <= schoolH;
  })();

  const nursingStatusLabel: Record<string, { label: string; color: string }> = {
    still_working: { label: "Still nursing", color: "text-amber-600 dark:text-amber-400" },
    exploring: { label: "Planning exit", color: "text-blue-600 dark:text-blue-400" },
    notice_given: { label: "Notice given", color: "text-emerald-600 dark:text-emerald-400" },
    left: { label: "Left nursing", color: "text-emerald-600 dark:text-emerald-400" },
  };

  const schoolCovered = plan.dropCoveredBy.length > 0 && plan.pickupCoveredBy.length > 0;

  const tabs: { key: TabKey; label: string; icon: React.ElementType; checks: string[]; items: { key: string }[] }[] = [
    { key: "schedule", label: "Schedule", icon: CalendarDays, checks: plan.scheduleChecks, items: SCHEDULE_CHECKS },
    { key: "family", label: "Family", icon: Users, checks: plan.familyChecks, items: FAMILY_CHECKS },
    { key: "nursing", label: "Leaving Nursing", icon: Stethoscope, checks: plan.nursingChecks, items: NURSING_CHECKS },
    { key: "wellbeing", label: "Wellbeing", icon: Heart, checks: plan.wellbeingChecks, items: WELLBEING_CHECKS },
    { key: "identity", label: "Identity", icon: Sparkles, checks: plan.identityChecks, items: IDENTITY_CHECKS },
  ];

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading your life plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              Life Design
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-lg leading-relaxed">
              Opening a clinic is a life change, not just a business decision. Plan the parts that don't appear on a spreadsheet — because these are the things that will actually determine whether this works.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
              saveStatus === "saved" ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
              : saveStatus === "saving" ? "text-muted-foreground border-border animate-pulse"
              : saveStatus === "unsaved" ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20"
              : "text-muted-foreground border-transparent"
            }`}>
              {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : ""}
            </span>
          </div>
        </div>

        {/* Status metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-border/50">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clinic days</p>
            <p className="text-lg font-bold text-foreground">{plan.clinicDays.length}<span className="text-xs font-normal text-muted-foreground">/week</span></p>
            <p className="text-[10px] text-muted-foreground">{plan.clinicDays.join(", ") || "None set"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">School run</p>
            <p className={`text-lg font-bold ${schoolCovered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
              {schoolCovered ? "Covered" : "Not set"}
            </p>
            <p className="text-[10px] text-muted-foreground">{schoolCovered ? "Drop & pickup agreed" : "Needs a plan"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nursing</p>
            <p className={`text-sm font-bold ${nursingStatusLabel[plan.nursingStatus]?.color ?? "text-foreground"}`}>
              {nursingStatusLabel[plan.nursingStatus]?.label ?? "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {plan.targetExitDate ? `Target: ${new Date(plan.targetExitDate + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "No date set"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clinic hours</p>
            <p className="text-sm font-bold">{plan.clinicOpenTime}<span className="text-muted-foreground font-normal">–</span>{plan.clinicCloseTime}</p>
            <p className="text-[10px] text-muted-foreground">{plan.maxClinicDaysPerWeek} days max</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Life readiness</p>
            <div className="flex items-baseline gap-1">
              <p className={`text-lg font-bold ${lifeReadiness >= 70 ? "text-emerald-600 dark:text-emerald-400" : lifeReadiness >= 40 ? "text-primary" : "text-amber-500"}`}>{lifeReadiness}%</p>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${lifeReadiness >= 70 ? "bg-emerald-500" : lifeReadiness >= 40 ? "bg-primary" : "bg-amber-500"}`} style={{ width: `${lifeReadiness}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl overflow-x-auto scrollbar-none border border-border/40">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === t.key
                ? "bg-background shadow-sm text-foreground border border-border/40"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}>
            <t.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <TabBadge checks={t.checks} items={t.items} />
          </button>
        ))}
      </div>

      {/* ═══ SCHEDULE ═══════════════════════════════════════════════════════════ */}
      {tab === "schedule" && (
        <div className="space-y-6">
          {/* Conflict alert */}
          {schoolDropConflict && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">School run clash detected</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Clinic opens at {plan.clinicOpenTime} — school drop is at {plan.schoolStartTime}. On clinic days someone else needs to cover the drop. Sort this on the Family tab.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: inputs */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /> Clinic Days</CardTitle>
                  <CardDescription className="text-xs">Which days will you see clients?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {DAYS.map(day => {
                      const on = plan.clinicDays.includes(day);
                      return (
                        <button key={day}
                          onClick={() => update({ clinicDays: on ? plan.clinicDays.filter(d => d !== day) : [...plan.clinicDays, day] })}
                          className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                            on ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-xs ${plan.clinicDays.length > 4 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {plan.clinicDays.length} days/week
                    {plan.clinicDays.length > 4 && " — 5+ days is a lot alongside family life. Consider a max of 4."}
                    {plan.clinicDays.length === 0 && " — select at least one"}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Opening Hours</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">First appointment</Label>
                      <Input type="time" value={plan.clinicOpenTime} onChange={e => update({ clinicOpenTime: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Last appointment ends</Label>
                      <Input type="time" value={plan.clinicCloseTime} onChange={e => update({ clinicCloseTime: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    <span>Clinic length</span>
                    <span className="font-semibold text-foreground">{(() => {
                      const [oh, om] = plan.clinicOpenTime.split(":").map(Number);
                      const [ch, cm] = plan.clinicCloseTime.split(":").map(Number);
                      const diff = (ch * 60 + cm) - (oh * 60 + om);
                      return diff > 0 ? `${Math.floor(diff / 60)}h ${diff % 60 > 0 ? `${diff % 60}m` : ""}`.trim() : "—";
                    })()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">What does a great clinic day look like?</CardTitle>
                  <CardDescription className="text-xs">Vision and rhythm — the feel of it, not just the hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="e.g. Start at 9:30 after drop-off. Always a proper 30-min lunch with no phone. Finish by 5pm. Fridays are admin + prep only — no clients. Every week has one day that's entirely mine." value={plan.scheduleNotes} onChange={e => update({ scheduleNotes: e.target.value })} className="min-h-[100px] text-sm resize-none" />
                </CardContent>
              </Card>
            </div>

            {/* Right: visual week + checklist */}
            <div className="lg:col-span-3 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Week at a Glance</CardTitle>
                  <CardDescription className="text-xs">Clinic hours shown against school windows — see the conflicts before they happen</CardDescription>
                </CardHeader>
                <CardContent>
                  <WeekGrid
                    clinicDays={plan.clinicDays}
                    openTime={plan.clinicOpenTime}
                    closeTime={plan.clinicCloseTime}
                    schoolStart={plan.schoolStartTime}
                    schoolEnd={plan.schoolFinishTime}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Schedule Checklist</CardTitle>
                  <CardDescription className="text-xs">Tick each one once you've genuinely thought it through — not just skimmed it</CardDescription>
                </CardHeader>
                <CardContent>
                  <Checklist items={SCHEDULE_CHECKS} checked={plan.scheduleChecks} onChange={v => update({ scheduleChecks: v })} />
                </CardContent>
              </Card>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary mb-1.5">Worth sitting with</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"The schedule you plan today won't survive first contact with a busy January. Build the protected non-clinic day in from week one — not when you're already burnt out and resentful."</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAMILY ═════════════════════════════════════════════════════════════ */}
      {tab === "family" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> The School Run — Eli & Elsy</CardTitle>
                  <CardDescription className="text-xs">The most common thing people say they wished they'd sorted properly before opening</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">School starts</Label>
                      <Input type="time" value={plan.schoolStartTime} onChange={e => update({ schoolStartTime: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">School finishes</Label>
                      <Input type="time" value={plan.schoolFinishTime} onChange={e => update({ schoolFinishTime: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                  </div>

                  {/* Coverage matrix */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <span>Day</span>
                      <span>Drop-off ({plan.schoolStartTime})</span>
                      <span>Pick-up ({plan.schoolFinishTime})</span>
                    </div>
                    {DAYS.map((day, i) => {
                      const isClinic = plan.clinicDays.includes(day);
                      return (
                        <div key={day} className={`grid grid-cols-3 px-3 py-2.5 items-center ${i > 0 ? "border-t border-border/50" : ""} ${isClinic ? "" : "opacity-40"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isClinic ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            <span className={`text-xs font-medium ${isClinic ? "text-foreground" : "text-muted-foreground"}`}>{day}</span>
                            {isClinic && <span className="text-[9px] text-primary/70 font-medium">clinic</span>}
                          </div>
                          {isClinic ? (
                            <>
                              <div className="pr-3">
                                <Input placeholder="who covers?" value={plan.dropCoveredBy} onChange={e => update({ dropCoveredBy: e.target.value })} className="h-6 text-xs border-0 border-b border-border/60 rounded-none px-0 focus-visible:ring-0 bg-transparent" />
                              </div>
                              <div className="pr-2">
                                <Input placeholder="who covers?" value={plan.pickupCoveredBy} onChange={e => update({ pickupCoveredBy: e.target.value })} className="h-6 text-xs border-0 border-b border-border/60 rounded-none px-0 focus-visible:ring-0 bg-transparent" />
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground/50">Abi (not clinic)</span>
                              <span className="text-xs text-muted-foreground/50">Abi (not clinic)</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Contingency plan — illness, INSET days, school events</Label>
                    <Textarea placeholder="e.g. Mum covers if David unavailable. INSET days: David WFH. Sports day / assemblies: I attend unless I have back-to-back bookings I can't move. If child is sick: David's first call, then Mum, then I cancel last-resort." value={plan.schoolContingencyPlan} onChange={e => update({ schoolContingencyPlan: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">David's Role — The Specific Version</CardTitle>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Be concrete</span>
                  </div>
                  <CardDescription className="text-xs">"He'll help" is not a plan. "He does school run Mon–Thu and checks school email on clinic days" is.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Days available to support</Label>
                    <div className="flex-1 flex items-center gap-2">
                      <input type="range" min={1} max={7} value={plan.davidAvailabilityDays} onChange={e => update({ davidAvailabilityDays: parseInt(e.target.value) })} className="flex-1 accent-primary" />
                      <span className={`text-sm font-bold w-16 text-right ${plan.davidAvailabilityDays >= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                        {plan.davidAvailabilityDays} days
                      </span>
                    </div>
                  </div>
                  <Textarea placeholder="Write it down as if you were explaining it to someone else: 'David does X on Y days. He handles Z. He does NOT do W. After 7pm, clinic is not his problem.'" value={plan.davidRoleNotes} onChange={e => update({ davidRoleNotes: e.target.value })} className="min-h-[110px] text-sm resize-none" />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Family Logistics Checklist</CardTitle>
                  <CardDescription className="text-xs">The things that blindside people who haven't planned them</CardDescription>
                </CardHeader>
                <CardContent>
                  <Checklist items={FAMILY_CHECKS} checked={plan.familyChecks} onChange={v => update({ familyChecks: v })} />
                </CardContent>
              </Card>

              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">The honest version</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed italic">"'David will figure it out' is not a plan. Clinics fail because the practitioner discovered — in month two, during a full book — that there was no actual arrangement for who picks up the children. This is the most important logistics conversation you'll have."</p>
              </div>

              {plan.davidRoleNotes && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">David's agreed role</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">"{plan.davidRoleNotes}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ NURSING EXIT ════════════════════════════════════════════════════════ */}
      {tab === "nursing" && (
        <div className="space-y-6">
          {/* Timeline — full width */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Your Exit Roadmap</CardTitle>
              <CardDescription className="text-xs">From now to clinic opening — calculated from your notice period and target exit date</CardDescription>
            </CardHeader>
            <CardContent>
              <NursingTimeline status={plan.nursingStatus} noticeWeeks={plan.nursingNoticeWeeks} exitDate={plan.targetExitDate} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Where are you now?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { value: "still_working", icon: "🏥", label: "Still working as normal", sub: "Haven't taken any formal steps yet" },
                    { value: "exploring", icon: "💭", label: "Mentally starting to wind down", sub: "Planning the exit — no formal steps yet" },
                    { value: "notice_given", icon: "📝", label: "Notice given", sub: "Leaving date is confirmed" },
                    { value: "left", icon: "✅", label: "Already left nursing", sub: "Fully focused on the clinic" },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      plan.nursingStatus === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}>
                      <input type="radio" name="nursingStatus" value={opt.value} checked={plan.nursingStatus === opt.value} onChange={() => update({ nursingStatus: opt.value })} className="sr-only" />
                      <span className="text-xl">{opt.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                      </div>
                      {plan.nursingStatus === opt.value && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Dates & Notice Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notice period (weeks)</Label>
                      <Input type="number" min={1} max={52} value={plan.nursingNoticeWeeks} onChange={e => update({ nursingNoticeWeeks: parseInt(e.target.value) || 12 })} className="h-9 text-sm font-medium" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Target exit</Label>
                      <Input type="month" value={plan.targetExitDate} onChange={e => update({ targetExitDate: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                  </div>
                  {plan.targetExitDate && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Give notice by</p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                          {new Date(new Date(plan.targetExitDate + "-01").getTime() - plan.nursingNoticeWeeks * 7 * 24 * 60 * 60 * 1000)
                            .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                        <p className="text-[10px] text-primary font-medium uppercase tracking-wide">Last day</p>
                        <p className="text-sm font-bold text-primary mt-0.5">
                          {new Date(plan.targetExitDate + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes — anything specific to your situation</Label>
                    <Textarea placeholder="e.g. My ward is short-staffed and the manager may try to guilt me into staying. I need to be clear this is happening regardless. I plan to give 14 weeks to soften the blow but my contract says 12." value={plan.nursingExitNotes} onChange={e => update({ nursingExitNotes: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Exit Checklist</CardTitle>
                  <CardDescription className="text-xs">The things people wish they'd done earlier</CardDescription>
                </CardHeader>
                <CardContent>
                  <Checklist items={NURSING_CHECKS} checked={plan.nursingChecks} onChange={v => update({ nursingChecks: v })} accent="primary" />
                </CardContent>
              </Card>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary mb-1.5">On the emotional side</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"Leaving nursing isn't just a job change — it's stepping away from an identity you've held for years. 'I'm a nurse' has shaped how people see you and how you see yourself. That's worth acknowledging, not rushing past. Give yourself permission to find it hard, even if you're also incredibly excited."</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ WELLBEING ══════════════════════════════════════════════════════════ */}
      {tab === "wellbeing" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Your Protected Week
                  </CardTitle>
                  <CardDescription className="text-xs">Based on your clinic days — the balance between clinic and life</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ProtectedWeek clinicDays={plan.clinicDays} maxDays={plan.maxClinicDaysPerWeek} />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Maximum clinic days per week — your absolute limit, not your target</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 flex-1">
                        {[1,2,3,4,5,6].map(n => (
                          <button key={n} onClick={() => update({ maxClinicDaysPerWeek: n })}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                              plan.maxClinicDaysPerWeek === n
                                ? n <= 4 ? "bg-emerald-500 text-white border-emerald-500" : "bg-amber-500 text-white border-amber-500"
                                : "border-border text-muted-foreground hover:border-primary/30"
                            }`}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {plan.maxClinicDaysPerWeek <= 4 ? "Good — leaves real space for family and rest." : plan.maxClinicDaysPerWeek === 5 ? "5 days is possible but leaves very little margin. Consider 4." : "6 days a week is not sustainable. You will burn out."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "sickCoverPlan" as const, label: "If Abi is sick — what happens to bookings?", placeholder: "e.g. Cancel with 24h notice, offer reschedule within 1 week. Build diary buffer so rescheduling is easy. No locum in year 1 — I'll absorb it." },
                  { key: "holidayPlan" as const, label: "Holiday plan — how will you handle being away?", placeholder: "e.g. Minimum 3 weeks off/year. Close fully — communicate 6 weeks ahead. Summer: 2 weeks, not 6." },
                ].map(({ key, label, placeholder }) => (
                  <Card key={key} className="shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">{label}</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea placeholder={placeholder} value={plan[key]} onChange={e => update({ [key]: e.target.value })} className="min-h-[100px] text-sm resize-none" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Non-Negotiables</CardTitle>
                  <CardDescription className="text-xs">Things that don't move for the clinic. Ever. Write them down so you don't have to fight for them later.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="e.g. Eli's school play (always attend). Dentist/GP appointments (kept). Thursday evenings with David (sacred). First day of every school holiday off. Christmas week closed — no exceptions." value={plan.nonNegotiables} onChange={e => update({ nonNegotiables: e.target.value })} className="min-h-[100px] text-sm resize-none" />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sustainability Checklist</CardTitle>
                  <CardDescription className="text-xs">The things most clinic owners wish they'd sorted before opening</CardDescription>
                </CardHeader>
                <CardContent>
                  <Checklist items={WELLBEING_CHECKS} checked={plan.wellbeingChecks} onChange={v => update({ wellbeingChecks: v })} accent="emerald" />
                </CardContent>
              </Card>

              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-xs font-semibold text-destructive mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> The burnout pattern to avoid
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">Month 1–3: taking every booking available. Month 4: exhausted, snapping at home, dreading Mondays. Month 6: wondering if the whole thing was a mistake.</p>
                <p className="text-sm text-foreground/80 leading-relaxed mt-2 font-medium">The fix is simple but hard: protect the non-clinic days before you need to, not after.</p>
              </div>

              {plan.nonNegotiables && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">Your non-negotiables</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">"{plan.nonNegotiables}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ IDENTITY ════════════════════════════════════════════════════════════ */}
      {tab === "identity" && (
        <div className="space-y-6">
          {/* Why you're doing this — hero if filled */}
          {plan.mostExcitedAbout && (
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 via-background to-violet-500/5 p-6">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Why you're doing this
              </p>
              <p className="text-lg font-medium leading-relaxed text-foreground/90 italic">"{plan.mostExcitedAbout}"</p>
              <p className="text-xs text-muted-foreground mt-3">— Abi Peters, {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" /> In Your Own Words
                  </CardTitle>
                  <CardDescription className="text-xs">Not the business case — the personal one. These don't have to be polished.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">What are you most excited about?</Label>
                    <p className="text-xs text-muted-foreground">Not the projections — what actually lights you up when you think about this.</p>
                    <Textarea placeholder="e.g. Building something that's entirely mine. Seeing clients and genuinely changing how they feel about themselves. Not having a rota. Being there when Eli and Elsy get home from school." value={plan.mostExcitedAbout} onChange={e => update({ mostExcitedAbout: e.target.value })} className="min-h-[110px] text-sm resize-none border-primary/30 focus-visible:ring-primary/20" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">What worries you most — honestly?</Label>
                    <p className="text-xs text-muted-foreground">The fears you haven't said out loud yet. Naming them makes them smaller.</p>
                    <Textarea placeholder="e.g. What if the clients don't come? What if I'm not as good as I think? What if I've made a huge mistake and we can't afford it? What will people think when I tell them I've left nursing?" value={plan.biggestConcerns} onChange={e => update({ biggestConcerns: e.target.value })} className="min-h-[110px] text-sm resize-none border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400/20" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Who's in your corner?</Label>
                    <p className="text-xs text-muted-foreground">Practical support, emotional support, professional peer — ideally you have all three.</p>
                    <Textarea placeholder="e.g. David — practical and emotional. Mum — school backup. Sarah from old ward — she's doing something similar and we talk monthly. Missing: a business mentor or aesthetics peer group." value={plan.supportNetwork} onChange={e => update({ supportNetwork: e.target.value })} className="min-h-[90px] text-sm resize-none" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">The Identity Shift Checklist</CardTitle>
                  <CardDescription className="text-xs">From "I'm a nurse who does aesthetics on the side" to "I own an aesthetics clinic"</CardDescription>
                </CardHeader>
                <CardContent>
                  <Checklist items={IDENTITY_CHECKS} checked={plan.identityChecks} onChange={v => update({ identityChecks: v })} accent="violet" />
                </CardContent>
              </Card>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> The bigger picture
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"In 12 months, Eli and Elsy will know you as the person who built something. That's a story you'll tell them about what's possible — not in a big speech, just by how you are. The financial model matters. But this is actually what you're doing it for."</p>
              </div>

              {plan.biggestConcerns && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Your honest worries</p>
                  <p className="text-sm text-foreground/80 italic leading-relaxed">"{plan.biggestConcerns}"</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-3">Named. Known. Now make a plan for each one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
