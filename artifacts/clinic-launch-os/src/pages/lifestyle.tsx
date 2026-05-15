import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, Clock, Sun, Heart, Users,
  Stethoscope, Leaf, AlertCircle, Star, ChevronRight,
  CalendarDays, ArrowRight, Shield, Sparkles, MapPin, Wand2, TrendingUp,
  Plus, Trash2, X, ChevronDown, ChevronUp, Target, Copy, Check,
  Rocket, BriefcaseMedical, GraduationCap, Flame, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PROJECT_ID = 1;
const API_BASE = "/api";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type Day = typeof DAYS[number];
type TabKey = "schedule" | "family" | "nursing" | "wellbeing" | "identity";

// ─── Family schedule types ────────────────────────────────────────────────────
type ClinicLocation = "winchester" | "bedhampton";
interface ChildSchedule {
  dropBy: string;
  pickupBy: string;
  dropTime?: string;
  pickupTime?: string;
}
type DaySchedules = Record<string, { elsy: ChildSchedule; eli: ChildSchedule; clinicLocation: ClinicLocation }>;

interface FamilySchedule {
  elsySchoolStart: string;
  elsySchoolFinish: string;
  eliSchoolStart: string;
  eliSchoolFinish: string;
  // Winchester travel times (Google Maps + 5 min buffer)
  travelHomeToElsyMins: number;
  travelElsyToClinicMins: number;
  travelClinicToElsyMins: number;
  travelHomeToEliMins: number;
  travelEliToClinicMins: number;
  travelClinicToEliMins: number;
  // Bedhampton travel times
  travelElsyToBedhamptonMins: number;
  travelBedhamptonToElsyMins: number;
  travelEliToBedhamptonMins: number;
  travelBedhamptonToEliMins: number;
  // Chain pickup — Horndean ↔ Clanfield (3.9 km, ~8–12 min + buffer)
  travelEliToElsyMins: number;
  travelElsyToEliMins: number;
  parkAndWalkMins: number;
  contingencyPlan: string;
  davidAvailabilityDays: number;
  davidRoleNotes: string;
  backupCarerName: string;
  fortnightEnabled: boolean;
  fortnightAnchorDate: string;
  weekBDaySchedules: DaySchedules;
  daySchedules: DaySchedules;
}

const DEFAULT_DAY_ENTRY = {
  elsy: { dropBy: "", pickupBy: "" },
  eli: { dropBy: "", pickupBy: "" },
  clinicLocation: "winchester" as ClinicLocation,
};

// Google Maps verified distances (May 2026) + 5 min buffer applied to each leg
// Horndean Tech (PO8 9PQ) → Winchester SO23: ~32 min → 37 stored
// Clanfield Junior (PO8 0RE) → Winchester SO23: ~38 min → 43 stored
// Home (PO9 3FQ) → schools: ~8–10 min → 13 stored
// Horndean ↔ Clanfield (3.9 km via B2149): ~9 min → 14 stored
const DEFAULT_FAMILY_SCHEDULE: FamilySchedule = {
  elsySchoolStart: "08:45",
  elsySchoolFinish: "15:15",
  eliSchoolStart: "08:30",
  eliSchoolFinish: "14:50",
  travelHomeToElsyMins: 13,
  travelElsyToClinicMins: 43,
  travelClinicToElsyMins: 43,
  travelHomeToEliMins: 13,
  travelEliToClinicMins: 37,
  travelClinicToEliMins: 37,
  travelElsyToBedhamptonMins: 10,
  travelBedhamptonToElsyMins: 10,
  travelEliToBedhamptonMins: 13,
  travelBedhamptonToEliMins: 13,
  travelEliToElsyMins: 14,
  travelElsyToEliMins: 14,
  parkAndWalkMins: 5,
  contingencyPlan: "",
  davidAvailabilityDays: 5,
  davidRoleNotes: "",
  backupCarerName: "",
  fortnightEnabled: false,
  fortnightAnchorDate: "2026-05-22",
  weekBDaySchedules: Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_DAY_ENTRY }])),
  daySchedules: Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_DAY_ENTRY }])),
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
function addMins(t: string, m: number): string {
  const [h, min] = t.split(":").map(Number);
  const total = h * 60 + min + m;
  const hours = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mins = ((total % 60) + 60) % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
function minsBetween(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return (th * 60 + tm) - (fh * 60 + fm);
}

// ─── Journey calculators ──────────────────────────────────────────────────────
function calcDropJourney(schoolStart: string, homeToSchool: number, schoolToClinic: number, clinicOpen: string) {
  const leaveHome = addMins(schoolStart, -(homeToSchool + 5));
  const leaveSchool = addMins(schoolStart, 5);
  const arriveClinic = addMins(leaveSchool, schoolToClinic);
  const lateMins = minsBetween(clinicOpen, arriveClinic);
  return { leaveHome, leaveSchool, arriveClinic, lateMins };
}
function calcPickupJourney(schoolFinish: string, clinicToSchool: number) {
  const mustLeaveClinic = addMins(schoolFinish, -(clinicToSchool + 5));
  const lastApptBy = addMins(mustLeaveClinic, -10);
  return { mustLeaveClinic, lastApptBy };
}

// ─── Plan extras (stored as extrasJson blob) ──────────────────────────────────
interface NonNegotiableItem { id: string; text: string; category: "family" | "health" | "time" | "personal" }
interface FearItem { id: string; fear: string; status: "unresolved" | "working" | "resolved" }
interface DayTimeOverride { open: string; close: string; }
interface PlanExtras {
  closureDates: string[];
  nonNegotiablesList: NonNegotiableItem[];
  thePitch: string;
  successVision12m: string;
  fearInventory: FearItem[];
  nursingMonthlyIncomeGbp: number;
  energyGivers: string;
  energyDrainers: string;
  dayTimeOverrides: Record<string, DayTimeOverride>;
}
const DEFAULT_EXTRAS: PlanExtras = {
  closureDates: [], nonNegotiablesList: [], thePitch: "", successVision12m: "",
  fearInventory: [], nursingMonthlyIncomeGbp: 0, energyGivers: "", energyDrainers: "",
  dayTimeOverrides: {},
};
function parseExtras(s: string): PlanExtras {
  try { return { ...DEFAULT_EXTRAS, ...JSON.parse(s || "{}") }; } catch { return DEFAULT_EXTRAS; }
}

// ─── Plan interface ───────────────────────────────────────────────────────────
interface Plan {
  clinicDays: string[]; clinicOpenTime: string; clinicCloseTime: string; scheduleNotes: string;
  schoolStartTime: string; schoolFinishTime: string; dropCoveredBy: string; pickupCoveredBy: string;
  schoolContingencyPlan: string; davidAvailabilityDays: number; davidRoleNotes: string;
  nursingStatus: string; nursingNoticeWeeks: number; targetExitDate: string; nursingExitNotes: string;
  maxClinicDaysPerWeek: number; sickCoverPlan: string; holidayPlan: string; nonNegotiables: string;
  mostExcitedAbout: string; biggestConcerns: string; supportNetwork: string;
  scheduleChecks: string[]; familyChecks: string[]; nursingChecks: string[];
  wellbeingChecks: string[]; identityChecks: string[];
  familyScheduleJson: string;
  extrasJson: string;
}

const EMPTY: Plan = {
  clinicDays: ["Mon", "Tue", "Wed", "Thu"], clinicOpenTime: "09:00", clinicCloseTime: "18:00", scheduleNotes: "",
  schoolStartTime: "09:00", schoolFinishTime: "15:30", dropCoveredBy: "", pickupCoveredBy: "",
  schoolContingencyPlan: "", davidAvailabilityDays: 5, davidRoleNotes: "",
  nursingStatus: "still_working", nursingNoticeWeeks: 12, targetExitDate: "", nursingExitNotes: "",
  maxClinicDaysPerWeek: 4, sickCoverPlan: "", holidayPlan: "", nonNegotiables: "",
  mostExcitedAbout: "", biggestConcerns: "", supportNetwork: "",
  scheduleChecks: [], familyChecks: [], nursingChecks: [], wellbeingChecks: [], identityChecks: [],
  familyScheduleJson: "{}", extrasJson: "{}",
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
    familyScheduleJson: typeof raw.familyScheduleJson === "string" ? raw.familyScheduleJson : "{}",
    extrasJson: typeof raw.extrasJson === "string" ? raw.extrasJson : "{}",
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
      {items.map((item) => {
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
  const DAY_RANGE_START = 7;
  const DAY_RANGE_END = 20;
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
        <div className="flex flex-col justify-between text-[9px] text-muted-foreground w-6 shrink-0 pt-5 pb-0.5">
          {hours.filter((_, i) => i % 2 === 0).map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>
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
                <div className="absolute left-0 right-0 bg-amber-400/40" style={{
                  top: pct(dropMins), height: pct(dropEndMins - dropMins),
                }} />
                <div className="absolute left-0 right-0 bg-violet-400/35" style={{
                  top: pct(pickupMins), height: pct(pickupEndMins - pickupMins),
                }} />
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
/** Handles both "YYYY-MM" (legacy month picker) and "YYYY-MM-DD" (new date picker) */
function parsePlanDate(d: string): Date | null {
  if (!d) return null;
  const s = d.length === 7 ? d + "-01" : d;
  const p = new Date(s);
  return isNaN(p.getTime()) ? null : p;
}

function NursingTimeline({ status, noticeWeeks, exitDate }: {
  status: string; noticeWeeks: number; exitDate: string;
}) {
  const today = new Date();
  const exitDateObj = parsePlanDate(exitDate);
  const noticeDeadline = exitDateObj
    ? new Date(exitDateObj.getTime() - noticeWeeks * 7 * 24 * 60 * 60 * 1000)
    : null;
  const clinicOpen = new Date("2026-11-01");

  const fmtDate = (d: Date | null) => d
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Not set";

  const milestones = [
    {
      label: "Today", date: today, done: true, color: "bg-emerald-500", ring: "ring-emerald-400",
      note: status === "left" ? "Already left nursing" : status === "notice_given" ? "Notice given" : status === "exploring" ? "Planning your exit" : "Still working as normal",
    },
    {
      label: "Give Notice", date: noticeDeadline, done: noticeDeadline ? today >= noticeDeadline : false,
      color: noticeDeadline && today >= noticeDeadline ? "bg-emerald-500" : "bg-primary", ring: "ring-primary/40",
      note: noticeDeadline ? `Deadline: ${fmtDate(noticeDeadline)}` : "Set your exit date to calculate",
    },
    {
      label: "Last Day", date: exitDateObj, done: exitDateObj ? today >= exitDateObj : false,
      color: exitDateObj && today >= exitDateObj ? "bg-emerald-500" : "bg-amber-500", ring: "ring-amber-400/40",
      note: exitDateObj ? fmtDate(exitDateObj) : "Set your target exit date",
    },
    {
      label: "Clinic Opens", date: clinicOpen, done: today >= clinicOpen,
      color: today >= clinicOpen ? "bg-emerald-500" : "bg-violet-500", ring: "ring-violet-400/40",
      note: "Target: 1 Nov 2026",
    },
  ];

  return (
    <div className="relative py-6 px-2">
      <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border -translate-y-1/2 mt-3" />
      <div className="grid grid-cols-4 gap-2 relative z-10">
        {milestones.map((m, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-2">
            <div className={`w-9 h-9 rounded-full ${m.done ? "bg-emerald-500" : i === 1 ? "bg-primary" : i === 2 ? "bg-amber-400" : "bg-violet-500"} ring-4 ${m.ring} flex items-center justify-center shadow-md`}>
              {m.done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span className="text-white text-xs font-bold">{i + 1}</span>}
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

// ─── Family tab sub-components ────────────────────────────────────────────────
function LocationNode({ icon, label, sub, color, childName }: {
  icon: string; label: string; sub: string; color: string; childName?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${color} shrink-0 min-w-0`}>
      <span className="text-lg shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-foreground leading-none">{label}</p>
          {childName && (
            <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0">{childName}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  );
}

function TravelBadge({ mins }: { mins: number }) {
  return (
    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
      <div className="h-px w-3 bg-border" />
      <span className="font-medium whitespace-nowrap">{mins}min</span>
      <ChevronRight className="w-3 h-3" />
    </div>
  );
}

function PersonSelect({ value, onChange, backupName, showDad }: {
  value: string; onChange: (v: string) => void; backupName?: string; showDad?: boolean;
}) {
  const backupLabel = backupName?.trim() || "Other / backup";
  const backupValue = backupName?.trim() || "Other / backup";
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full h-7 text-xs rounded-lg border px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer ${
        !value
          ? "border-destructive/50 text-muted-foreground"
          : value === "Abi"
          ? "border-primary/50 text-primary font-semibold"
          : value === "Dad"
          ? "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-semibold"
          : "border-border text-foreground"
      }`}
    >
      <option value="">— assign —</option>
      <option value="Abi">Abi</option>
      <option value="David">David</option>
      {showDad && <option value="Dad">Dad</option>}
      <option value={backupValue}>{backupLabel}</option>
    </select>
  );
}

function JourneyChip({ type, leaveHome, leaveSchool, arriveClinic, lateMins, mustLeaveClinic, lastApptBy, clinicOpenTime, clinicName }: {
  type: "drop" | "pickup";
  leaveHome?: string; leaveSchool?: string; arriveClinic?: string; lateMins?: number;
  mustLeaveClinic?: string; lastApptBy?: string;
  clinicOpenTime: string;
  clinicName?: string;
}) {
  const label = clinicName ?? "clinic";
  if (type === "drop") {
    const late = (lateMins ?? 0) > 0;
    return (
      <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-[10px] space-y-1 border ${
        late
          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
      }`}>
        <p className="font-medium text-foreground flex items-center gap-1 flex-wrap">
          <span>🏠 {leaveHome}</span>
          <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
          <span>🏫 drop</span>
          <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
          <span>🏥 {label} {arriveClinic}</span>
        </p>
        {late ? (
          <p className="text-red-600 dark:text-red-400 font-medium">
            ⚠ {lateMins}min after clinic opens ({clinicOpenTime})
          </p>
        ) : (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ {Math.abs(lateMins ?? 0)}min before clinic opens
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1.5 rounded-lg px-2.5 py-2 text-[10px] space-y-1 border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
      <p className="font-medium text-foreground">🏥 Leave {label} by {mustLeaveClinic}</p>
      <p className="text-blue-700 dark:text-blue-400">Last appt ends by {lastApptBy}</p>
    </div>
  );
}

function DayLocationStrip({ clinicDays, daySchedules, onChange }: {
  clinicDays: string[];
  daySchedules: DaySchedules;
  onChange: (day: string, loc: ClinicLocation) => void;
}) {
  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));
  if (clinicDayList.length === 0) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Clinic Location per Day
        </CardTitle>
        <CardDescription className="text-xs">
          Set each day independently — Bedhampton is local so journey times are much shorter, which changes the conflict calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {clinicDayList.map(day => {
            const loc = daySchedules[day]?.clinicLocation ?? "winchester";
            return (
              <div key={day} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-foreground text-center">{day}</p>
                <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
                  <button
                    onClick={() => onChange(day, "winchester")}
                    className={`px-3 py-1.5 transition-colors ${
                      loc === "winchester"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Winchester
                  </button>
                  <button
                    onClick={() => onChange(day, "bedhampton")}
                    className={`px-3 py-1.5 transition-colors border-l border-border ${
                      loc === "bedhampton"
                        ? "bg-teal-600 text-white"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Bedhampton
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Winchester = 9A Jewry St, SO23 · Bedhampton = local (PO9 area)
        </p>
      </CardContent>
    </Card>
  );
}

function ChildScheduleCard({
  childName, school, schoolStart, schoolFinish,
  travelHomeToSchool,
  travelSchoolToWinchesterMins, travelWinchesterToSchoolMins,
  travelSchoolToBedhamptonMins, travelBedhamptonToSchoolMins,
  clinicDays, clinicOpenTime, daySchedules, onDayChange, childKey, accentColor, backupCarerName,
  fortnightEnabled, weekBDaySchedules, onWeekBDayChange,
}: {
  childName: string; school: string;
  schoolStart: string; schoolFinish: string;
  travelHomeToSchool: number;
  travelSchoolToWinchesterMins: number; travelWinchesterToSchoolMins: number;
  travelSchoolToBedhamptonMins: number; travelBedhamptonToSchoolMins: number;
  clinicDays: string[]; clinicOpenTime: string;
  daySchedules: DaySchedules;
  onDayChange: (day: string, role: keyof ChildSchedule, value: string) => void;
  childKey: "elsy" | "eli";
  accentColor: "amber" | "violet";
  backupCarerName?: string;
  fortnightEnabled?: boolean;
  weekBDaySchedules?: DaySchedules;
  onWeekBDayChange?: (day: string, role: keyof ChildSchedule, value: string) => void;
}) {
  const [activeWeek, setActiveWeek] = useState<"A" | "B">("A");
  const isAmber = accentColor === "amber";
  const accent = isAmber
    ? { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-400" }
    : { bg: "bg-violet-50 dark:bg-violet-950/20", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-400" };

  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));
  const viewSchedules = (fortnightEnabled && activeWeek === "B" && weekBDaySchedules) ? weekBDaySchedules : daySchedules;
  const handleChange = (day: string, role: keyof ChildSchedule, value: string) => {
    if (fortnightEnabled && activeWeek === "B" && onWeekBDayChange) {
      onWeekBDayChange(day, role, value);
    } else {
      onDayChange(day, role, value);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent.dot}`} />
            <CardTitle className="text-sm">{childName}</CardTitle>
          </div>
          {fortnightEnabled && (
            <div className="flex gap-0.5 shrink-0">
              {(["A", "B"] as const).map(w => (
                <button key={w} onClick={() => setActiveWeek(w)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${activeWeek === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  Wk {w}
                </button>
              ))}
            </div>
          )}
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${accent.bg} ${accent.border} ${accent.text} font-semibold shrink-0`}>
            {school}
          </span>
        </div>
        <CardDescription className="text-xs pl-4">
          School hours: {schoolStart} – {schoolFinish}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {clinicDayList.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-3">
            No clinic days selected — set them on the Schedule tab
          </p>
        )}
        {clinicDayList.map(day => {
          const schedule = viewSchedules[day]?.[childKey] ?? { dropBy: "", pickupBy: "" };
          const noCover = !schedule.dropBy || !schedule.pickupBy;
          const loc = viewSchedules[day]?.clinicLocation ?? "winchester";
          const travelToClinic = loc === "winchester" ? travelSchoolToWinchesterMins : travelSchoolToBedhamptonMins;
          const travelFromClinic = loc === "winchester" ? travelWinchesterToSchoolMins : travelBedhamptonToSchoolMins;
          const clinicName = loc === "winchester" ? "Winchester" : "Bedhampton";

          const effectiveDropTime = schedule.dropTime ?? schoolStart;
          const effectivePickupTime = schedule.pickupTime ?? schoolFinish;
          const hasClubDrop = !!schedule.dropTime && schedule.dropTime !== schoolStart;
          const hasClubPickup = !!schedule.pickupTime && schedule.pickupTime !== schoolFinish;

          const dropJourney = schedule.dropBy === "Abi"
            ? calcDropJourney(effectiveDropTime, travelHomeToSchool, travelToClinic, clinicOpenTime)
            : null;
          const pickupJourney = schedule.pickupBy === "Abi"
            ? calcPickupJourney(effectivePickupTime, travelFromClinic)
            : null;

          return (
            <div
              key={day}
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                noCover ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground w-7 shrink-0">{day}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                  loc === "winchester"
                    ? "bg-primary/10 text-primary/80"
                    : "bg-teal-500/10 text-teal-700 dark:text-teal-400"
                }`}>
                  {clinicName}
                </span>
                {noCover && <AlertCircle className="w-3 h-3 text-destructive ml-auto" />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Label className="text-[10px] text-muted-foreground font-medium">Drop-off</Label>
                    <input
                      type="time"
                      value={effectiveDropTime}
                      onChange={e => handleChange(day, "dropTime", e.target.value)}
                      className="text-[10px] font-mono text-foreground/70 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary w-[52px]"
                    />
                    {hasClubDrop && (
                      <span className="text-[8px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1 rounded font-bold">CLUB</span>
                    )}
                  </div>
                  <PersonSelect value={schedule.dropBy} onChange={who => handleChange(day, "dropBy", who)} backupName={backupCarerName} showDad={fortnightEnabled} />
                  {dropJourney && (
                    <JourneyChip
                      type="drop"
                      leaveHome={dropJourney.leaveHome}
                      leaveSchool={dropJourney.leaveSchool}
                      arriveClinic={dropJourney.arriveClinic}
                      lateMins={dropJourney.lateMins}
                      clinicOpenTime={clinicOpenTime}
                      clinicName={clinicName}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Label className="text-[10px] text-muted-foreground font-medium">Pick-up</Label>
                    <input
                      type="time"
                      value={effectivePickupTime}
                      onChange={e => handleChange(day, "pickupTime", e.target.value)}
                      className="text-[10px] font-mono text-foreground/70 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary w-[52px]"
                    />
                    {hasClubPickup && (
                      <span className="text-[8px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1 rounded font-bold">CLUB</span>
                    )}
                  </div>
                  <PersonSelect value={schedule.pickupBy} onChange={who => handleChange(day, "pickupBy", who)} backupName={backupCarerName} showDad={fortnightEnabled} />
                  {pickupJourney && (
                    <JourneyChip
                      type="pickup"
                      mustLeaveClinic={pickupJourney.mustLeaveClinic}
                      lastApptBy={pickupJourney.lastApptBy}
                      clinicOpenTime={clinicOpenTime}
                      clinicName={clinicName}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TravelInput({ label, value, isTime, onChange }: {
  label: string; value: string | number; isTime?: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type={isTime ? "time" : "number"}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 text-xs"
        min={isTime ? undefined : 1}
        max={isTime ? undefined : 120}
      />
    </div>
  );
}

// ─── Abi's Week ───────────────────────────────────────────────────────────────
function t2m(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function m2t(m: number): string {
  const total = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function AbiWeek({
  clinicDays, clinicOpenTime, clinicCloseTime, familySchedule,
}: {
  clinicDays: string[];
  clinicOpenTime: string;
  clinicCloseTime: string;
  familySchedule: FamilySchedule;
}) {
  const [activeWeek, setActiveWeek] = useState<"A" | "B">("A");
  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));
  if (clinicDayList.length === 0) return null;
  const viewSchedules = (familySchedule.fortnightEnabled && activeWeek === "B") ? familySchedule.weekBDaySchedules : familySchedule.daySchedules;

  const dayTimelines = clinicDayList.map(day => {
    const ds = viewSchedules[day];
    const loc = ds?.clinicLocation ?? "winchester";
    const clinicName = loc === "winchester" ? "Winchester" : "Bedhampton";
    const pw = familySchedule.parkAndWalkMins;

    const elsyChild = ds?.elsy ?? { dropBy: "", pickupBy: "" };
    const eliChild  = ds?.eli  ?? { dropBy: "", pickupBy: "" };

    const elsyDropT   = elsyChild.dropTime   ?? familySchedule.elsySchoolStart;
    const elsyPickupT = elsyChild.pickupTime ?? familySchedule.elsySchoolFinish;
    const eliDropT    = eliChild.dropTime    ?? familySchedule.eliSchoolStart;
    const eliPickupT  = eliChild.pickupTime  ?? familySchedule.eliSchoolFinish;

    const elsyToClinic   = loc === "winchester" ? familySchedule.travelElsyToClinicMins   : familySchedule.travelElsyToBedhamptonMins;
    const elsyFromClinic = loc === "winchester" ? familySchedule.travelClinicToElsyMins   : familySchedule.travelBedhamptonToElsyMins;
    const eliToClinic    = loc === "winchester" ? familySchedule.travelEliToClinicMins    : familySchedule.travelEliToBedhamptonMins;
    const eliFromClinic  = loc === "winchester" ? familySchedule.travelClinicToEliMins    : familySchedule.travelBedhamptonToEliMins;

    type DropEntry = { child: string; dropAt: string; leaveHome: string; arriveReady: string; lateMins: number };
    type PickupEntry = { child: string; pickupAt: string; mustLeave: string; lastAppt: string };

    const drops: DropEntry[] = [];
    if (elsyChild.dropBy === "Abi") {
      const j = calcDropJourney(elsyDropT, familySchedule.travelHomeToElsyMins, elsyToClinic, clinicOpenTime);
      drops.push({ child: "Elsy", dropAt: elsyDropT, leaveHome: j.leaveHome, arriveReady: addMins(j.arriveClinic, pw), lateMins: minsBetween(clinicOpenTime, addMins(j.arriveClinic, pw)) });
    }
    if (eliChild.dropBy === "Abi") {
      const j = calcDropJourney(eliDropT, familySchedule.travelHomeToEliMins, eliToClinic, clinicOpenTime);
      drops.push({ child: "Eli", dropAt: eliDropT, leaveHome: j.leaveHome, arriveReady: addMins(j.arriveClinic, pw), lateMins: minsBetween(clinicOpenTime, addMins(j.arriveClinic, pw)) });
    }
    drops.sort((a, b) => t2m(a.dropAt) - t2m(b.dropAt));

    const pickups: PickupEntry[] = [];
    if (elsyChild.pickupBy === "Abi") {
      const j = calcPickupJourney(elsyPickupT, elsyFromClinic + pw);
      pickups.push({ child: "Elsy", pickupAt: elsyPickupT, mustLeave: j.mustLeaveClinic, lastAppt: j.lastApptBy });
    }
    if (eliChild.pickupBy === "Abi") {
      const j = calcPickupJourney(eliPickupT, eliFromClinic + pw);
      pickups.push({ child: "Eli", pickupAt: eliPickupT, mustLeave: j.mustLeaveClinic, lastAppt: j.lastApptBy });
    }
    pickups.sort((a, b) => t2m(a.mustLeave) - t2m(b.mustLeave));

    const latestArrivalMins = drops.length > 0
      ? Math.max(...drops.map(d => t2m(d.arriveReady)))
      : t2m(clinicOpenTime);
    const effectiveStart = m2t(Math.max(latestArrivalMins, t2m(clinicOpenTime)));

    const earliestDepartureMins = pickups.length > 0
      ? Math.min(...pickups.map(p => t2m(p.mustLeave)))
      : t2m(clinicCloseTime);
    const effectiveEnd = m2t(Math.min(earliestDepartureMins, t2m(clinicCloseTime)));

    const windowMins = Math.max(0, t2m(effectiveEnd) - t2m(effectiveStart));
    const windowHrs  = +(windowMins / 60).toFixed(1);

    const firstClientRaw = t2m(effectiveStart) + 5;
    const firstClient = m2t(Math.ceil(firstClientRaw / 15) * 15);

    return { day, clinicName, loc, drops, pickups, effectiveStart, effectiveEnd, windowMins, windowHrs, firstClient };
  });

  const avgHrs = +(dayTimelines.reduce((s, d) => s + d.windowHrs, 0) / Math.max(1, dayTimelines.length)).toFixed(1);
  const daysPerMonth = +(clinicDays.length * (365 / 12 / 7)).toFixed(1);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Abi's Working Week
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Auto-calculated from school run assignments, travel times and park &amp; walk
            </CardDescription>
          </div>
          {familySchedule.fortnightEnabled && (
            <div className="flex gap-0.5 shrink-0">
              {(["A", "B"] as const).map(w => (
                <button key={w} onClick={() => setActiveWeek(w)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${activeWeek === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  Wk {w}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 shrink-0 text-right">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Days/month</p>
              <p className="text-xl font-bold text-primary leading-none">{daysPerMonth}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg hrs/day</p>
              <p className="text-xl font-bold text-primary leading-none">{avgHrs}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 mt-2">
          <ArrowRight className="w-3 h-3 shrink-0" />
          These two figures feed directly into Financial Modelling — Working Days/Month and Hours/Day are locked there and drawn from this schedule.
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {dayTimelines.map(({ day, clinicName, loc, drops, pickups, effectiveStart, effectiveEnd, windowMins, windowHrs, firstClient }) => (
          <div key={day} className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-7 shrink-0">{day}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                  loc === "winchester" ? "bg-primary/10 text-primary/80" : "bg-teal-500/10 text-teal-700 dark:text-teal-400"
                }`}>{clinicName}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                windowMins > 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}>{windowMins > 0 ? `${windowHrs} hrs available` : "⚠ no window"}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Morning drops</p>
                {drops.length === 0
                  ? <p className="text-muted-foreground italic">Not Abi</p>
                  : drops.map((d, i) => (
                    <div key={i} className="space-y-0.5 leading-tight">
                      <p className="font-semibold text-foreground">🏠 {d.leaveHome}</p>
                      <p className="text-muted-foreground pl-2">→ 🏫 drop {d.child} {d.dropAt}</p>
                      <p className={`pl-2 font-medium ${d.lateMins > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        → 🏥 ready {d.arriveReady} {d.lateMins > 0 ? `(${d.lateMins}min late)` : `(${Math.abs(d.lateMins)}min early)`}
                      </p>
                    </div>
                  ))
                }
              </div>

              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Clinic window</p>
                <p className="font-medium text-foreground">⏰ Open {effectiveStart}</p>
                <p className="font-semibold text-primary">🏥 First client {firstClient}</p>
                {windowMins > 0
                  ? <p className="text-muted-foreground">⏱ {windowHrs}h treatment window</p>
                  : <p className="text-destructive font-medium">⚠ No window — check pickups</p>
                }
                <p className="text-muted-foreground">🚪 Must leave {effectiveEnd}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Afternoon pickups</p>
                {pickups.length === 0
                  ? <p className="text-muted-foreground italic">Not Abi</p>
                  : pickups.map((p, i) => (
                    <div key={i} className="space-y-0.5 leading-tight">
                      <p className="font-semibold text-foreground">🚪 Leave {p.mustLeave}</p>
                      <p className="text-muted-foreground pl-2">→ 🏫 {p.child} {p.pickupAt}</p>
                      <p className="text-blue-600 dark:text-blue-400 pl-2">Last appt {p.lastAppt}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Smart Schedule helpers ───────────────────────────────────────────────────
const FOOTFALL_DATA: Record<string, { score: number; note: string; bestTimes: string }> = {
  Mon: { score: 5,  note: "Lower demand — post-weekend fatigue, slow bookers",                    bestTimes: "10:00–17:00" },
  Tue: { score: 9,  note: "Peak midweek — strong demand, pre-weekend energy builds",             bestTimes: "09:30–18:30" },
  Wed: { score: 8,  note: "Consistently high — great for lunch slots and after-school",          bestTimes: "09:30–18:30" },
  Thu: { score: 10, note: "Strongest day in UK aesthetics — clients prepping for the weekend",   bestTimes: "09:30–19:00" },
  Fri: { score: 7,  note: "Afternoon peak (14:00–19:00) — pre-weekend confidence boost",         bestTimes: "10:00–19:00" },
  Sat: { score: 4,  note: "Busy but intense competition — all competitors also fully open",      bestTimes: "09:00–14:00" },
};

function computeDayWindow(
  day: string,
  familySchedule: FamilySchedule,
  baselineOpen: string,
  baselineClose: string,
): number {
  const ds = familySchedule.daySchedules[day];
  const pw = familySchedule.parkAndWalkMins;
  const loc = ds?.clinicLocation ?? "winchester";
  const elsyChild = ds?.elsy ?? { dropBy: "", pickupBy: "" };
  const eliChild  = ds?.eli  ?? { dropBy: "", pickupBy: "" };

  let latestArrival = t2m(baselineOpen);
  if (elsyChild.dropBy === "Abi") {
    const drop = elsyChild.dropTime ?? familySchedule.elsySchoolStart;
    const toCl = loc === "winchester" ? familySchedule.travelElsyToClinicMins : familySchedule.travelElsyToBedhamptonMins;
    const j = calcDropJourney(drop, familySchedule.travelHomeToElsyMins, toCl, baselineOpen);
    latestArrival = Math.max(latestArrival, t2m(j.arriveClinic) + pw);
  }
  if (eliChild.dropBy === "Abi") {
    const drop = eliChild.dropTime ?? familySchedule.eliSchoolStart;
    const toCl = loc === "winchester" ? familySchedule.travelEliToClinicMins : familySchedule.travelEliToBedhamptonMins;
    const j = calcDropJourney(drop, familySchedule.travelHomeToEliMins, toCl, baselineOpen);
    latestArrival = Math.max(latestArrival, t2m(j.arriveClinic) + pw);
  }

  let earliestDeparture = t2m(baselineClose);
  if (elsyChild.pickupBy === "Abi") {
    const pickup = elsyChild.pickupTime ?? familySchedule.elsySchoolFinish;
    const fromCl = loc === "winchester" ? familySchedule.travelClinicToElsyMins : familySchedule.travelBedhamptonToElsyMins;
    const j = calcPickupJourney(pickup, fromCl + pw);
    earliestDeparture = Math.min(earliestDeparture, t2m(j.mustLeaveClinic));
  }
  if (eliChild.pickupBy === "Abi") {
    const pickup = eliChild.pickupTime ?? familySchedule.eliSchoolFinish;
    const fromCl = loc === "winchester" ? familySchedule.travelClinicToEliMins : familySchedule.travelBedhamptonToEliMins;
    const j = calcPickupJourney(pickup, fromCl + pw);
    earliestDeparture = Math.min(earliestDeparture, t2m(j.mustLeaveClinic));
  }

  return Math.max(0, (earliestDeparture - latestArrival) / 60);
}

function SmartScheduleAdvisor({
  familySchedule, currentDays, currentOpenTime, currentCloseTime,
  dayTimeOverrides, onApply, onDayOverride,
}: {
  familySchedule: FamilySchedule;
  currentDays: string[];
  currentOpenTime: string;
  currentCloseTime: string;
  dayTimeOverrides: Record<string, DayTimeOverride>;
  onApply: (days: string[], openTime: string, closeTime: string) => void;
  onDayOverride: (day: string, override: DayTimeOverride | null) => void;
}) {
  const BASELINE_OPEN  = "09:00";
  const BASELINE_CLOSE = "19:00";

  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editOpen, setEditOpen]     = useState("");
  const [editClose, setEditClose]   = useState("");

  const openEdit = (day: string) => {
    const ov = dayTimeOverrides[day];
    setEditOpen(ov?.open ?? currentOpenTime);
    setEditClose(ov?.close ?? currentCloseTime);
    setEditingDay(day);
  };
  const saveEdit = (day: string) => {
    onDayOverride(day, { open: editOpen, close: editClose });
    setEditingDay(null);
  };
  const clearOverride = (day: string) => {
    onDayOverride(day, null);
    setEditingDay(null);
  };

  const dayAnalysis = DAYS.map(day => {
    const ff = FOOTFALL_DATA[day];
    const ov = dayTimeOverrides[day];
    const windowHrs = computeDayWindow(day, familySchedule, ov?.open ?? BASELINE_OPEN, ov?.close ?? BASELINE_CLOSE);
    const windowBonus = Math.min(2, Math.max(0, (windowHrs - 5) * 0.5));
    const score = ff.score + windowBonus;
    const ds = familySchedule.daySchedules[day];
    const elsyChild = ds?.elsy ?? { dropBy: "", pickupBy: "" };
    const eliChild  = ds?.eli  ?? { dropBy: "", pickupBy: "" };
    const abiDrops   = [elsyChild.dropBy,   eliChild.dropBy  ].filter(x => x === "Abi").length;
    const abiPickups = [elsyChild.pickupBy, eliChild.pickupBy].filter(x => x === "Abi").length;
    return { day, ff, windowHrs, score, abiDrops, abiPickups };
  });

  const sorted = [...dayAnalysis].sort((a, b) => b.score - a.score);
  const recommended = new Set(sorted.slice(0, 4).map(d => d.day));
  const recommendedOrdered = DAYS.filter(d => recommended.has(d));

  const toggleDay = (day: string) => {
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : DAYS.filter(d => [...currentDays, day].includes(d));
    onApply(newDays, currentOpenTime, currentCloseTime);
  };

  return (
    <Card className="shadow-sm border-emerald-200 dark:border-emerald-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Smart Schedule Advisor
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Click a day to toggle it on/off · click the clock to set custom hours
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 shrink-0"
            onClick={() => onApply(recommendedOrdered, "09:30", "18:30")}
          >
            <Wand2 className="w-3.5 h-3.5" /> Auto-schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {dayAnalysis.map(({ day, ff, windowHrs, abiDrops, abiPickups }) => {
            const isRec     = recommended.has(day);
            const isActive  = currentDays.includes(day);
            const hasOverride = !!dayTimeOverrides[day];
            const isEditing = editingDay === day;
            return (
              <div key={day} className={`rounded-lg border transition-all ${
                isActive
                  ? isRec
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700"
                    : "bg-primary/5 border-primary/30"
                  : "bg-muted/20 border-border/40 opacity-60"
              }`}>
                <button
                  type="button"
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
                  onClick={() => { if (!isEditing) toggleDay(day); }}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? isRec ? "bg-emerald-500 border-emerald-500" : "bg-primary border-primary"
                      : "border-muted-foreground/30"
                  }`}>
                    {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>

                  <span className="text-[11px] font-bold text-foreground w-7 shrink-0 pt-0.5">{day}</span>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${ff.score >= 9 ? "bg-emerald-500" : ff.score >= 7 ? "bg-primary" : ff.score >= 5 ? "bg-amber-400" : "bg-muted-foreground/30"}`}
                          style={{ width: `${ff.score * 10}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold shrink-0 ${ff.score >= 9 ? "text-emerald-600 dark:text-emerald-400" : ff.score >= 7 ? "text-primary" : "text-muted-foreground"}`}>
                        {ff.score}/10
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{ff.note}</p>
                    <p className="text-[9px] text-muted-foreground/70">Best: {ff.bestTimes}</p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <p className={`text-[10px] font-semibold ${windowHrs >= 6 ? "text-emerald-600 dark:text-emerald-400" : windowHrs >= 4 ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                      {windowHrs > 0 ? `${windowHrs.toFixed(1)}h` : "—"}
                    </p>
                    {(abiDrops > 0 || abiPickups > 0) && (
                      <p className="text-[9px] text-muted-foreground">
                        {abiDrops > 0 ? `↓${abiDrops}` : ""}
                        {abiDrops > 0 && abiPickups > 0 ? " " : ""}
                        {abiPickups > 0 ? `↑${abiPickups}` : ""}
                      </p>
                    )}
                    <div className="flex items-center gap-1 justify-end">
                      {isRec && <span className="text-[8px] bg-emerald-500 text-white px-1 py-0.5 rounded font-bold">REC</span>}
                      {hasOverride && <span className="text-[8px] bg-violet-500 text-white px-1 py-0.5 rounded font-bold">custom</span>}
                    </div>
                  </div>

                  {isActive && (
                    <button
                      type="button"
                      title="Set custom hours for this day"
                      onClick={e => { e.stopPropagation(); isEditing ? setEditingDay(null) : openEdit(day); }}
                      className={`ml-1 mt-0.5 shrink-0 p-1 rounded transition-colors ${
                        isEditing || hasOverride
                          ? "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40"
                          : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  )}
                </button>

                {isEditing && (
                  <div className="border-t border-border/60 px-3 py-3 bg-background/60 rounded-b-lg space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Override hours for {day}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Open</label>
                        <Input type="time" value={editOpen} onChange={e => setEditOpen(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Close</label>
                        <Input type="time" value={editClose} onChange={e => setEditClose(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => saveEdit(day)}>
                        <Check className="w-3 h-3 mr-1" /> Save
                      </Button>
                      {hasOverride && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => clearOverride(day)}>
                          Reset
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDay(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {hasOverride && (
                      <p className="text-[9px] text-muted-foreground">
                        Current override: {dayTimeOverrides[day].open}–{dayTimeOverrides[day].close} · Reset to use global hours
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Peak booking windows — UK aesthetics</p>
          <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[10px]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span>10:30–13:00 — lunch crowd</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span>17:00–19:00 — after-work peak</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /><span className="text-muted-foreground">08:00–09:30 — low (school run)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /><span className="text-muted-foreground">14:30–16:30 — low (school pickup)</span></div>
          </div>
        </div>

        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
          <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Recommended schedule</p>
          <div className="flex items-center gap-2 flex-wrap">
            {recommendedOrdered.map(day => (
              <span key={day} className="text-xs font-bold bg-emerald-500 text-white px-2 py-1 rounded-lg">{day}</span>
            ))}
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">09:30–18:30</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1.5">
            Highest foot-fall days + your available windows. Click <strong>Auto-schedule</strong> to apply, or toggle days above.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Schedule Analytics ───────────────────────────────────────────────────────
function ScheduleAnalytics({
  clinicDays, clinicOpenTime, clinicCloseTime, familySchedule, dayTimeOverrides,
}: {
  clinicDays: string[];
  clinicOpenTime: string;
  clinicCloseTime: string;
  familySchedule: FamilySchedule;
  dayTimeOverrides: Record<string, DayTimeOverride>;
}) {
  const [slot, setSlot] = useState<30 | 45 | 60 | 90>(45);

  if (clinicDays.length === 0) return null;

  const perDay = DAYS.filter(d => clinicDays.includes(d)).map(day => {
    const ov = dayTimeOverrides[day];
    const rawOpen  = ov?.open  ?? clinicOpenTime;
    const rawClose = ov?.close ?? clinicCloseTime;
    const raw = (() => {
      const [oh, om] = rawOpen.split(":").map(Number);
      const [ch, cm] = rawClose.split(":").map(Number);
      return Math.max(0, (ch * 60 + cm - (oh * 60 + om)) / 60);
    })();
    const real = computeDayWindow(day, familySchedule, rawOpen, rawClose);
    const lost = Math.max(0, raw - real);
    const firstAppt = (() => {
      const ds = familySchedule.daySchedules[day];
      if (!ds) return rawOpen;
      const pw = familySchedule.parkAndWalkMins;
      const loc = ds.clinicLocation ?? "winchester";
      let latestMins = t2m(rawOpen);
      const kids = [
        { child: ds.elsy, homeToSchool: familySchedule.travelHomeToElsyMins, schoolFinish: familySchedule.elsySchoolStart, toClinic: loc === "winchester" ? familySchedule.travelElsyToClinicMins : familySchedule.travelElsyToBedhamptonMins },
        { child: ds.eli,  homeToSchool: familySchedule.travelHomeToEliMins,  schoolFinish: familySchedule.eliSchoolStart,  toClinic: loc === "winchester" ? familySchedule.travelEliToClinicMins  : familySchedule.travelEliToBedhamptonMins  },
      ];
      kids.forEach(({ child, homeToSchool, schoolFinish, toClinic }) => {
        if (!child || child.dropBy !== "Abi") return;
        const j = calcDropJourney(child.dropTime ?? schoolFinish, homeToSchool, toClinic, rawOpen);
        latestMins = Math.max(latestMins, t2m(j.arriveClinic) + pw);
      });
      return m2t(latestMins);
    })();
    const lastAppt = (() => {
      const ds = familySchedule.daySchedules[day];
      if (!ds) return rawClose;
      const pw = familySchedule.parkAndWalkMins;
      const loc = ds.clinicLocation ?? "winchester";
      let earliestMins = t2m(rawClose);
      const kids = [
        { child: ds.elsy, schoolFinish: familySchedule.elsySchoolFinish, fromClinic: loc === "winchester" ? familySchedule.travelClinicToElsyMins : familySchedule.travelBedhamptonToElsyMins },
        { child: ds.eli,  schoolFinish: familySchedule.eliSchoolFinish,  fromClinic: loc === "winchester" ? familySchedule.travelClinicToEliMins  : familySchedule.travelBedhamptonToEliMins  },
      ];
      kids.forEach(({ child, schoolFinish, fromClinic }) => {
        if (!child || child.pickupBy !== "Abi") return;
        const j = calcPickupJourney(child.pickupTime ?? schoolFinish, fromClinic + pw);
        earliestMins = Math.min(earliestMins, t2m(j.mustLeaveClinic));
      });
      return m2t(earliestMins);
    })();
    const hasOverride = !!dayTimeOverrides[day];
    return { day, raw, real, lost, firstAppt, lastAppt, hasOverride };
  });

  const totalRawWeek    = perDay.reduce((s, d) => s + d.raw,  0);
  const totalRealWeek   = perDay.reduce((s, d) => s + d.real, 0);
  const daysPerMonth    = +(clinicDays.length * 4.333).toFixed(1);
  const avgHrsPerDay    = clinicDays.length > 0 ? totalRealWeek / clinicDays.length : 0;
  const hrsPerMonth     = +(totalRealWeek * 4.333).toFixed(1);
  const hrsPerYear      = +(totalRealWeek * 52).toFixed(0);
  const deadHrsPerWeek  = +(totalRawWeek - totalRealWeek).toFixed(1);
  const deadPct         = totalRawWeek > 0 ? Math.round((deadHrsPerWeek / totalRawWeek) * 100) : 0;
  const apptPerMonth    = Math.floor((hrsPerMonth * 60) / slot);
  const apptPerYear     = Math.floor((+hrsPerYear * 60) / slot);
  const maxBarHrs       = Math.max(...perDay.map(d => d.raw), 1);

  const statCells = [
    { label: "Days / week",   value: clinicDays.length,           sub: clinicDays.join(", "),          color: "text-primary" },
    { label: "Days / month",  value: daysPerMonth,                sub: "@ 4.33 wks/mo",                color: "text-primary" },
    { label: "Avg hrs / day", value: avgHrsPerDay.toFixed(1)+"h", sub: "real window",                  color: avgHrsPerDay >= 6 ? "text-emerald-600 dark:text-emerald-400" : avgHrsPerDay >= 4 ? "text-foreground" : "text-amber-600 dark:text-amber-400" },
    { label: "Hrs / week",    value: totalRealWeek.toFixed(1)+"h",sub: `${deadHrsPerWeek}h lost`,       color: totalRealWeek >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground" },
    { label: "Hrs / month",   value: hrsPerMonth+"h",             sub: "real available",               color: "text-foreground" },
    { label: "Hrs / year",    value: (+hrsPerYear).toLocaleString()+"h", sub: "50 working wks",         color: "text-foreground" },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Schedule Analytics
        </CardTitle>
        <CardDescription className="text-xs">Your real working time after school-run constraints</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        <div className="grid grid-cols-3 gap-2">
          {statCells.map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl bg-muted/30 border border-border/40 p-3 text-center">
              <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">{label}</p>
              <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-tight">{sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Real window per day</p>
          {perDay.map(({ day, raw, real, lost, firstAppt, lastAppt, hasOverride }) => (
            <div key={day} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-foreground w-7">{day}</span>
                  {hasOverride && <span className="text-[8px] bg-violet-500 text-white px-1 py-0.5 rounded font-bold">custom</span>}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{firstAppt}–{lastAppt}</span>
                  {lost > 0 && <span className="text-amber-600 dark:text-amber-400">−{lost.toFixed(1)}h runs</span>}
                  <span className={`font-semibold ${real >= 6 ? "text-emerald-600 dark:text-emerald-400" : real >= 4 ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}>{real.toFixed(1)}h</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-primary/70 rounded-l-full transition-all" style={{ width: `${(real / maxBarHrs) * 100}%` }} />
                {lost > 0 && <div className="h-full bg-amber-400/50" style={{ width: `${(lost / maxBarHrs) * 100}%` }} />}
              </div>
            </div>
          ))}
          {deadPct > 0 && (
            <p className="text-[9px] text-muted-foreground pt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400/50 mr-1 align-middle" />
              {deadPct}% of scheduled hours ({deadHrsPerWeek}h/wk) lost to school runs — shown in amber above
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Appointment capacity</p>
            <div className="flex gap-1">
              {([30, 45, 60, 90] as const).map(m => (
                <button key={m} onClick={() => setSlot(m)} className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${slot === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>{m}m</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: `Appts / week`, value: Math.floor((totalRealWeek * 60) / slot) },
              { label: `Appts / month`, value: apptPerMonth },
              { label: `Appts / year`, value: apptPerYear.toLocaleString() },
              { label: `Yr revenue @ £150 ATV`, value: `£${(apptPerYear * 150).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="text-sm font-bold text-foreground">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground">Ceiling figures — no admin or lunch buffers. Year-one fill rate is typically 40–60%.</p>
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Launch Countdown ─────────────────────────────────────────────────────────
function LaunchCountdown({ targetExitDate, noticeWeeks }: {
  targetExitDate: string; noticeWeeks: number;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const clinicOpen = new Date("2026-11-01");
  const exitDateObj = parsePlanDate(targetExitDate);
  const noticeDeadline = exitDateObj
    ? new Date(exitDateObj.getTime() - noticeWeeks * 7 * 24 * 60 * 60 * 1000)
    : null;
  const daysTo = (d: Date | null) => d ? Math.ceil((d.getTime() - today.getTime()) / 86400000) : null;
  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const milestones = [
    { label: "Give Notice", sub: "Deadline to hand in your notice", date: noticeDeadline, days: daysTo(noticeDeadline), bgClass: "bg-primary/5 border-primary/20", numClass: "text-primary", icon: BriefcaseMedical },
    { label: "Last Nursing Day", sub: "Your target exit from NHS", date: exitDateObj, days: daysTo(exitDateObj), bgClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800", numClass: "text-amber-600 dark:text-amber-400", icon: GraduationCap },
    { label: "Clinic Opens", sub: "Target: 1 November 2026", date: clinicOpen, days: daysTo(clinicOpen), bgClass: "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800", numClass: "text-violet-600 dark:text-violet-400", icon: Rocket },
  ];
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Rocket className="w-4 h-4 text-violet-500" /> Launch Countdown
        </CardTitle>
        <CardDescription className="text-xs">Set your nursing exit date on the Leaving Nursing tab to see all milestones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {milestones.map(({ label, sub, date, days, bgClass, numClass, icon: Icon }) => {
            const done = days !== null && days <= 0;
            return (
              <div key={label} className={`rounded-xl border p-3 text-center space-y-1.5 ${bgClass}`}>
                <Icon className={`w-5 h-5 mx-auto ${numClass}`} />
                {done ? (
                  <>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">✓</p>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Done</p>
                  </>
                ) : days !== null ? (
                  <>
                    <p className={`text-3xl font-black leading-none ${numClass}`}>{days}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">days</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground/30">—</p>
                    <p className="text-[10px] text-muted-foreground">not set</p>
                  </>
                )}
                <p className="text-[11px] font-semibold text-foreground leading-tight">{label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{date ? fmt(date) : sub}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Closure Planner ──────────────────────────────────────────────────────────
const UK_SCHOOL_HOLIDAYS_2026: { name: string; dates: string[] }[] = [
  { name: "Spring Half Term",  dates: ["2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20"] },
  { name: "Easter Break",      dates: ["2026-04-06","2026-04-07","2026-04-08","2026-04-09","2026-04-10","2026-04-14","2026-04-15","2026-04-16","2026-04-17"] },
  { name: "May Half Term",     dates: ["2026-05-25","2026-05-26","2026-05-27","2026-05-28","2026-05-29"] },
  { name: "Summer Holiday",    dates: (() => { const ds: string[] = []; const d = new Date("2026-07-23"); while (d <= new Date("2026-09-04")) { if (d.getDay() > 0 && d.getDay() < 6) ds.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); } return ds; })() },
  { name: "Autumn Half Term",  dates: ["2026-10-26","2026-10-27","2026-10-28","2026-10-29","2026-10-30"] },
  { name: "Christmas Break",   dates: ["2026-12-21","2026-12-22","2026-12-23","2026-12-24","2026-12-28","2026-12-29","2026-12-30","2026-12-31"] },
];

function ClosurePlanner({ closureDates, onChange }: {
  closureDates: string[]; onChange: (dates: string[]) => void;
}) {
  const [customDate, setCustomDate] = useState("");
  const set = new Set(closureDates);
  const toggleHoliday = (dates: string[]) => {
    const allIn = dates.every(d => set.has(d));
    const next = new Set(set);
    allIn ? dates.forEach(d => next.delete(d)) : dates.forEach(d => next.add(d));
    onChange(Array.from(next).sort());
  };
  const toggleDate = (d: string) => {
    const next = new Set(set);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange(Array.from(next).sort());
  };
  const addCustom = () => {
    if (!customDate) return;
    const next = new Set(set); next.add(customDate);
    onChange(Array.from(next).sort()); setCustomDate("");
  };
  const fmtD = (d: string) => { const p = new Date(d); return p.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Planned Closure Days
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Mark school holidays and personal time — design your year from the start</CardDescription>
          </div>
          {closureDates.length > 0 && (
            <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{closureDates.length} days</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Hampshire school holidays 2026</p>
          {UK_SCHOOL_HOLIDAYS_2026.map(hol => {
            const allIn = hol.dates.every(d => set.has(d));
            const someIn = hol.dates.some(d => set.has(d));
            const count = hol.dates.filter(d => set.has(d)).length;
            return (
              <button key={hol.name} onClick={() => toggleHoliday(hol.dates)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                  allIn ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700"
                  : someIn ? "bg-primary/5 border-primary/30"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                    allIn ? "bg-emerald-500 border-emerald-500" : someIn ? "bg-primary/30 border-primary/50" : "border-muted-foreground/30"
                  }`}>{(allIn || someIn) && <Check className="w-2 h-2 text-white" />}</div>
                  <span className="text-xs font-medium">{hol.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {allIn ? `${count} days ✓` : someIn ? `${count}/${hol.dates.length}` : `${hol.dates.length} days`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} className="h-8 text-xs flex-1" />
          <Button size="sm" onClick={addCustom} disabled={!customDate} className="h-8 px-3"><Plus className="w-3.5 h-3.5" /></Button>
        </div>
        {closureDates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Selected ({closureDates.length} days)</p>
            <div className="flex flex-wrap gap-1.5">
              {closureDates.slice(0, 24).map(d => (
                <button key={d} onClick={() => toggleDate(d)}
                  className="flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                  {fmtD(d)} <X className="w-2.5 h-2.5" />
                </button>
              ))}
              {closureDates.length > 24 && <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{closureDates.length - 24} more</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Coverage Matrix ──────────────────────────────────────────────────────────
function CoverageMatrix({ clinicDays, daySchedules, weekBDaySchedules, fortnightEnabled }: {
  clinicDays: string[]; daySchedules: DaySchedules;
  weekBDaySchedules?: DaySchedules; fortnightEnabled?: boolean;
}) {
  const [activeWeek, setActiveWeek] = useState<"A" | "B">("A");
  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));
  if (clinicDayList.length === 0) return null;
  const cols = [
    { key: "ed", label: "Elsy ↓", get: (ds: DaySchedules[string]) => ds?.elsy?.dropBy },
    { key: "ep", label: "Elsy ↑", get: (ds: DaySchedules[string]) => ds?.elsy?.pickupBy },
    { key: "ld", label: "Eli ↓",  get: (ds: DaySchedules[string]) => ds?.eli?.dropBy },
    { key: "lp", label: "Eli ↑",  get: (ds: DaySchedules[string]) => ds?.eli?.pickupBy },
  ];
  const viewSchedules = (fortnightEnabled && activeWeek === "B" && weekBDaySchedules) ? weekBDaySchedules : daySchedules;
  const totalCells = clinicDayList.length * cols.length;
  const coveredA = clinicDayList.reduce((s, day) => s + cols.filter(c => !!c.get(daySchedules[day])).length, 0);
  const coveredB = weekBDaySchedules ? clinicDayList.reduce((s, day) => s + cols.filter(c => !!c.get(weekBDaySchedules[day])).length, 0) : coveredA;
  const covered = fortnightEnabled && activeWeek === "B" ? coveredB : coveredA;
  const pct = Math.round((covered / totalCells) * 100);
  const personChip = (who: string) => (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
      who === "Abi" ? "bg-primary/10 text-primary"
      : who === "David" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : who === "Dad" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
      : "bg-muted text-muted-foreground"
    }`}>{who}</span>
  );
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> School Run Coverage
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Every clinic day needs all four cells filled — at a glance</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fortnightEnabled && (
              <div className="flex gap-0.5">
                {(["A", "B"] as const).map(w => (
                  <button key={w} onClick={() => setActiveWeek(w)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${activeWeek === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    Wk {w}
                  </button>
                ))}
              </div>
            )}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              pct === 100 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            }`}>{pct}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[280px]">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Day</th>
                {cols.map(c => <th key={c.key} className="pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {clinicDayList.map(day => {
                const ds = viewSchedules[day];
                const loc = ds?.clinicLocation ?? "winchester";
                return (
                  <tr key={day}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{day}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${loc === "winchester" ? "bg-primary/10 text-primary/70" : "bg-teal-500/10 text-teal-700 dark:text-teal-400"}`}>{loc === "winchester" ? "Win" : "Bed"}</span>
                        {fortnightEnabled && day === "Friday" && (
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Wk {activeWeek}</span>
                        )}
                      </div>
                    </td>
                    {cols.map(col => {
                      const who = col.get(ds);
                      return (
                        <td key={col.key} className="py-2 text-center">
                          {who ? personChip(who) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">!</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pct === 100 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> All clinic days fully covered
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Income Bridge ────────────────────────────────────────────────────────────
function IncomeBridge({ nursingMonthlyIncome, clinicDays, onChange }: {
  nursingMonthlyIncome: number; clinicDays: string[];
  onChange: (v: number) => void;
}) {
  const [clientsPerDay, setClientsPerDay] = useState(4);
  const [avgTV, setAvgTV] = useState(150);
  const daysPerMonth = +(clinicDays.length * 4.333).toFixed(1);
  const maxPerMonth = daysPerMonth * clientsPerDay;
  const ramp = [
    { mo: 1, pct: 15 }, { mo: 2, pct: 25 }, { mo: 3, pct: 40 },
    { mo: 4, pct: 55 }, { mo: 6, pct: 70 }, { mo: 9, pct: 85 }, { mo: 12, pct: 100 },
  ];
  const matchMonth = nursingMonthlyIncome > 0
    ? (ramp.find(r => (maxPerMonth * r.pct / 100 * avgTV) >= nursingMonthlyIncome)?.mo ?? null)
    : null;
  const fmt = (n: number) => `£${Math.round(n).toLocaleString()}`;
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Income Bridge
        </CardTitle>
        <CardDescription className="text-xs">When does clinic income match your nursing take-home pay?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Nursing net/month</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">£</span>
              <Input type="number" min={0} step={100} value={nursingMonthlyIncome || ""} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="h-8 text-xs pl-5" placeholder="e.g. 2800" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Clients/day</Label>
            <div className="flex items-center gap-1">
              <button onClick={() => setClientsPerDay(Math.max(1, clientsPerDay - 1))} className="w-7 h-8 rounded-lg border text-sm hover:bg-muted transition-colors shrink-0">−</button>
              <span className="flex-1 text-center text-sm font-bold">{clientsPerDay}</span>
              <button onClick={() => setClientsPerDay(Math.min(10, clientsPerDay + 1))} className="w-7 h-8 rounded-lg border text-sm hover:bg-muted transition-colors shrink-0">+</button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Avg treatment (£)</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">£</span>
              <Input type="number" min={50} step={10} value={avgTV} onChange={e => setAvgTV(parseInt(e.target.value) || 150)} className="h-8 text-xs pl-5" />
            </div>
          </div>
        </div>
        {nursingMonthlyIncome > 0 ? (
          <>
            <div className="space-y-1.5">
              {ramp.map(({ mo, pct }) => {
                const rev = maxPerMonth * pct / 100 * avgTV;
                const barPct = Math.min(100, Math.round((rev / nursingMonthlyIncome) * 100));
                const matched = rev >= nursingMonthlyIncome;
                const isMatchMonth = mo === matchMonth;
                return (
                  <div key={mo} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-10 shrink-0">Mo {mo}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${matched ? "bg-emerald-500" : "bg-primary/60"}`} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold w-14 text-right shrink-0 ${matched ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{fmt(rev)}</span>
                    {isMatchMonth && <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>
            {matchMonth !== null ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">You'll match nursing income around <strong>Month {matchMonth}</strong> at these assumptions.</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{daysPerMonth} days/mo · {clientsPerDay} clients/day · {fmt(avgTV)} avg</p>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
                <p className="text-xs text-amber-700 dark:text-amber-400">Nursing income not matched within 12 months at these figures. Try more days, more clients, or higher ATV.</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2 italic">Enter your monthly nursing net income to see the bridge calculation</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Notice Scripts ───────────────────────────────────────────────────────────
const NOTICE_SCRIPTS_DATA = [
  {
    title: "The ward manager conversation",
    icon: "🏥",
    context: "Keep it short, certain, and kind — but unmovable. Don't justify. Don't negotiate. Just be clear.",
    script: `"I wanted to speak to you directly before putting anything in writing. I'm resigning from my position to open my own aesthetics clinic. I've given this a lot of thought and it's the right decision for me. I'm giving [X] weeks' notice — more than my contract requires — because I want to ensure a proper handover. I'm proud of what we've achieved here and I want to leave on good terms."

If they try to persuade you to stay:
"I understand this creates pressure, and I'm sorry for that. But my leaving date is [DATE]. I'm committed to making the handover as smooth as possible within that time."`,
    borderClass: "border-primary/20 bg-primary/5",
  },
  {
    title: "Telling nursing colleagues",
    icon: "👩‍⚕️",
    context: "Tell the people who matter directly — before they hear it from someone else.",
    script: `"I wanted to tell you properly rather than you hearing second-hand. I'm leaving the ward to open my own aesthetics clinic. [DATE] will be my last day.

I'm excited but also sad to be leaving — I'll miss working with you. I'm not abandoning nursing; I'm using my clinical skills in a different context. And honestly? I'm terrified. But I'm doing it anyway."

You don't owe anyone an apology. You don't have to justify your decision. Direct and warm is enough.`,
    borderClass: "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20",
  },
  {
    title: "Telling family and friends",
    icon: "❤️",
    context: "Sometimes the people who love you most are the hardest to convince. Lead with facts, not apologies.",
    script: `"I'm opening my own aesthetics clinic. I know that might sound unexpected, but I've been planning this carefully for [X months]. The finances are modelled, the qualifications are in place, the premises are sorted.

Is there risk? Yes. But I've done the work to understand it and manage it. What I need from you isn't advice about the risks — I know them. What I need is your support while I build something I believe in."

If they push back on qualifications:
"I'm a nurse with [X] years of clinical experience and [relevant aesthetics qualifications]. I've done this properly, not impulsively."`,
    borderClass: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20",
  },
];

function NoticeScripts() {
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const copyScript = (i: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 2000); });
  };
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Notice Conversation Scripts
        </CardTitle>
        <CardDescription className="text-xs">The three conversations you need to have. Adapt them — starting points, not scripts to read aloud.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {NOTICE_SCRIPTS_DATA.map((s, i) => (
          <div key={i} className={`rounded-xl border overflow-hidden ${s.borderClass}`}>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <span className="text-lg shrink-0">{s.icon}</span>
              <span className="flex-1 text-sm font-semibold">{s.title}</span>
              {open === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
            {open === i && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground italic">{s.context}</p>
                <div className="rounded-lg bg-background/60 border border-border/40 p-3">
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{s.script}</pre>
                </div>
                <button onClick={() => copyScript(i, s.script)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {copied === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === i ? "Copied!" : "Copy to clipboard"}
                </button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Non-Negotiables List ─────────────────────────────────────────────────────
const NN_CATEGORIES: { key: NonNegotiableItem["category"]; label: string; icon: string; color: string }[] = [
  { key: "family",   label: "Family",   icon: "👨‍👩‍👧‍👦", color: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" },
  { key: "health",   label: "Health",   icon: "🌿",     color: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700" },
  { key: "time",     label: "Time",     icon: "⏰",     color: "bg-primary/5 text-primary border-primary/20" },
  { key: "personal", label: "Personal", icon: "✨",     color: "bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-700" },
];

function NonNegotiablesList({ items, onChange }: {
  items: NonNegotiableItem[]; onChange: (items: NonNegotiableItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState<NonNegotiableItem["category"]>("family");
  const add = () => { if (!text.trim()) return; onChange([...items, { id: `${Date.now()}`, text: text.trim(), category: cat }]); setText(""); };
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));
  const byCategory = NN_CATEGORIES.map(c => ({ ...c, items: items.filter(i => i.category === c.key) })).filter(c => c.items.length > 0);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="e.g. Eli's school play — always attend" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} className="h-9 text-sm flex-1" />
        <select value={cat} onChange={e => setCat(e.target.value as NonNegotiableItem["category"])}
          className="h-9 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary shrink-0">
          {NN_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
        </select>
        <Button size="sm" onClick={add} disabled={!text.trim()} className="h-9 px-3 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Things that don't move for the clinic. Ever. Add them so you don't have to fight for them later.</p>}
      {byCategory.map(({ key, label, icon, color, items: catItems }) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center gap-1.5"><span className="text-sm">{icon}</span><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span></div>
          {catItems.map(item => (
            <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${color}`}>
              <span className="flex-1 leading-snug">{item.text}</span>
              <button onClick={() => remove(item.id)} className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      ))}
      {items.length > 0 && <p className="text-[10px] text-muted-foreground italic text-center">{items.length} non-negotiable{items.length > 1 ? "s" : ""} protected from day one.</p>}
    </div>
  );
}

// ─── Capacity Calculator ──────────────────────────────────────────────────────
function CapacityCalculator({ clinicDays, clinicOpenTime, clinicCloseTime, familySchedule }: {
  clinicDays: string[]; clinicOpenTime: string; clinicCloseTime: string; familySchedule: FamilySchedule;
}) {
  const [treatmentMins, setTreatmentMins] = useState(45);
  const [targetATV, setTargetATV] = useState(150);
  const windowData = DAYS.filter(d => clinicDays.includes(d)).map(day => ({ day, hours: computeDayWindow(day, familySchedule, clinicOpenTime, clinicCloseTime) }));
  const totalWeeklyHours = windowData.reduce((s, d) => s + d.hours, 0);
  const hoursPerDay = clinicDays.length > 0 ? totalWeeklyHours / clinicDays.length : 0;
  const daysPerMonth = +(clinicDays.length * 4.333).toFixed(1);
  const maxClientsPerMonth = Math.floor((daysPerMonth * hoursPerDay * 60) / treatmentMins);
  const occupancies = [0.5, 0.65, 0.75, 0.85, 1.0];
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Capacity & Revenue Potential
        </CardTitle>
        <CardDescription className="text-xs">Based on your actual clinic window after school runs — your real ceiling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Treatment slot (mins)</Label>
            <div className="flex gap-1">
              {[30, 45, 60, 90].map(m => (
                <button key={m} onClick={() => setTreatmentMins(m)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${treatmentMins === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Average treatment value</Label>
            <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span><Input type="number" min={50} step={10} value={targetATV} onChange={e => setTargetATV(parseInt(e.target.value)||150)} className="h-8 text-sm pl-6" /></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { val: +(totalWeeklyHours).toFixed(1), label: "hrs/week" },
            { val: Math.floor((totalWeeklyHours * 60) / treatmentMins), label: "max clients/wk" },
            { val: maxClientsPerMonth, label: "max clients/mo" },
          ].map(({ val, label }) => (
            <div key={label} className="rounded-xl bg-muted/30 border border-border/40 p-3">
              <p className="text-xl font-black text-primary leading-none">{val}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Monthly revenue at occupancy</p>
          {occupancies.map(occ => {
            const rev = Math.round(maxClientsPerMonth * occ * targetATV);
            return (
              <div key={occ} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-10 shrink-0">{Math.round(occ * 100)}%</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${occ >= 0.75 ? "bg-emerald-500" : "bg-primary/60"}`} style={{ width: `${occ * 100}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-foreground w-16 text-right shrink-0">£{rev.toLocaleString()}/mo</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">These are ceiling figures — no lunch or admin time included. Year-one occupancy is typically 40–60%. The value is understanding your ceiling, not assuming you'll hit it.</p>
      </CardContent>
    </Card>
  );
}

// ─── The Pitch ────────────────────────────────────────────────────────────────
function ThePitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const quality = wordCount === 0 ? null : wordCount <= 15 ? "perfect" : wordCount <= 22 ? "good" : "too long";
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" /> Your One-Sentence Pitch
        </CardTitle>
        <CardDescription className="text-xs">What do you say when someone asks what you do? Under 20 words. No "just" or "only". Say it like you mean it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea placeholder={`"I run an aesthetics clinic in Winchester — I help people feel genuinely confident in their skin."`} value={value} onChange={e => onChange(e.target.value)} className="min-h-[80px] text-sm resize-none" />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">{wordCount > 0 ? `${wordCount} words` : "Start typing…"}</p>
          {quality && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${quality === "perfect" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : quality === "good" ? "bg-primary/10 text-primary" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"}`}>{quality}</span>}
        </div>
        {value && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">How it sounds</p>
            <p className="text-base font-medium leading-relaxed text-foreground">"{value}"</p>
            <p className="text-[10px] text-muted-foreground mt-2">— Abi Peters, Abi Peters Aesthetics</p>
          </div>
        )}
        <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">Formula that works</p>
          <p className="text-[11px] text-foreground/70">"I run [what] in [where] — I help [who] [feel/achieve something]."</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fear Inventory ───────────────────────────────────────────────────────────
const FEAR_STATUSES: { key: FearItem["status"]; label: string; color: string }[] = [
  { key: "unresolved", label: "Named",        color: "bg-muted text-muted-foreground border-border" },
  { key: "working",    label: "Working on it", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" },
  { key: "resolved",   label: "Resolved",     color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700" },
];

function FearInventory({ items, onChange }: { items: FearItem[]; onChange: (items: FearItem[]) => void }) {
  const [text, setText] = useState("");
  const add = () => { if (!text.trim()) return; onChange([...items, { id: `${Date.now()}`, fear: text.trim(), status: "unresolved" }]); setText(""); };
  const cycle = (id: string) => onChange(items.map(i => {
    if (i.id !== id) return i;
    const ss: FearItem["status"][] = ["unresolved", "working", "resolved"];
    return { ...i, status: ss[(ss.indexOf(i.status) + 1) % 3] };
  }));
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));
  const resolved = items.filter(i => i.status === "resolved").length;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Name a fear — naming it makes it smaller" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} className="h-9 text-sm flex-1" />
        <Button size="sm" onClick={add} disabled={!text.trim()} className="h-9 px-3 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((resolved / items.length) * 100)}%` }} />
          </div>
          <span>{resolved}/{items.length} resolved</span>
        </div>
      )}
      {items.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">The fears you haven't said out loud are the ones with the most power over you.</p>}
      <div className="space-y-2">
        {items.map(item => {
          const si = FEAR_STATUSES.find(s => s.key === item.status)!;
          return (
            <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${item.status === "resolved" ? "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-border/60 bg-muted/10"}`}>
              <p className={`flex-1 text-sm leading-snug ${item.status === "resolved" ? "line-through text-muted-foreground" : ""}`}>{item.fear}</p>
              <button onClick={() => cycle(item.id)} className={`text-[9px] font-bold px-2 py-1 rounded-full border shrink-0 transition-all ${si.color}`}>{si.label}</button>
              <button onClick={() => remove(item.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"><X className="w-3 h-3" /></button>
            </div>
          );
        })}
      </div>
      {resolved > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center font-medium">{resolved === items.length ? "Every fear named and resolved. That's real work." : `${resolved} resolved — that's progress.`}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifestylePage() {
  const [plan, setPlan] = useState<Plan>(EMPTY);
  const [tab, setTab] = useState<TabKey>("schedule");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [loaded, setLoaded] = useState(false);
  const [activeProperty, setActiveProperty] = useState<{ address: string; postcode: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlan(fromApi(data)); setLoaded(true); setSaveStatus("idle"); });

    fetch(`${API_BASE}/projects/${PROJECT_ID}/properties`)
      .then(r => r.ok ? r.json() : [])
      .then((props: Array<{ address?: string; postcode?: string; isActiveForProject?: boolean }>) => {
        const active = props.find(p => p.isActiveForProject) ?? props[0];
        if (active) setActiveProperty({ address: active.address ?? "", postcode: active.postcode ?? "" });
      })
      .catch(() => {});
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

  // ── Family schedule derived state ──────────────────────────────────────────
  const familySchedule = useMemo((): FamilySchedule => {
    try {
      const parsed = JSON.parse(plan.familyScheduleJson || "{}");
      return {
        ...DEFAULT_FAMILY_SCHEDULE,
        ...parsed,
        daySchedules: {
          ...DEFAULT_FAMILY_SCHEDULE.daySchedules,
          ...(parsed.daySchedules ?? {}),
        },
      };
    } catch {
      return DEFAULT_FAMILY_SCHEDULE;
    }
  }, [plan.familyScheduleJson]);

  const updateFS = useCallback((patch: Partial<FamilySchedule>) => {
    const next = { ...familySchedule, ...patch };
    update({ familyScheduleJson: JSON.stringify(next) });
  }, [familySchedule, update]);

  const extras = useMemo(() => parseExtras(plan.extrasJson), [plan.extrasJson]);
  const updateExtras = useCallback((patch: Partial<PlanExtras>) => {
    update({ extrasJson: JSON.stringify({ ...extras, ...patch }) });
  }, [extras, update]);

  // ── Computed signals ───────────────────────────────────────────────────────
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
    const schoolH = parseInt(familySchedule.elsySchoolStart);
    return openH <= schoolH;
  })();

  const schoolCovered = plan.clinicDays.length > 0 && plan.clinicDays.every(day => {
    const ds = familySchedule.daySchedules[day];
    return ds?.elsy?.dropBy && ds?.elsy?.pickupBy && ds?.eli?.dropBy && ds?.eli?.pickupBy;
  });

  const familyConflicts = useMemo(() => {
    const checkWeek = (sched: DaySchedules, label: string) => plan.clinicDays.flatMap(day => {
      const ds = sched[day];
      if (!ds) return [`${label}${day}: no schedule configured`];
      const issues: string[] = [];
      if (!ds.elsy?.dropBy) issues.push(`${label}${day}: Elsy's drop-off not assigned`);
      if (!ds.elsy?.pickupBy) issues.push(`${label}${day}: Elsy's pick-up not assigned`);
      if (!ds.eli?.dropBy) issues.push(`${label}${day}: Eli's drop-off not assigned`);
      if (!ds.eli?.pickupBy) issues.push(`${label}${day}: Eli's pick-up not assigned`);
      return issues;
    });
    const wkA = checkWeek(familySchedule.daySchedules, familySchedule.fortnightEnabled ? "Wk A — " : "");
    const wkB = familySchedule.fortnightEnabled ? checkWeek(familySchedule.weekBDaySchedules, "Wk B — ") : [];
    return [...wkA, ...wkB];
  }, [plan.clinicDays, familySchedule]);

  // ── Chain pickup detection ─────────────────────────────────────────────────
  const chainPickupWarnings = useMemo(() => {
    const checkChain = (sched: DaySchedules, weekLabel: string) => plan.clinicDays.flatMap(day => {
      const ds = sched[day];
      if (!ds) return [];
      const elsyPickup = ds.elsy?.pickupBy === "Abi";
      const eliPickup  = ds.eli?.pickupBy  === "Abi";
      if (!elsyPickup || !eliPickup) return [];

      const elsyFinish = t2m(ds.elsy?.pickupTime ?? familySchedule.elsySchoolFinish);
      const eliFinish  = t2m(ds.eli?.pickupTime  ?? familySchedule.eliSchoolFinish);
      const gap = Math.abs(elsyFinish - eliFinish);
      if (gap > 90) return []; // More than 90 min apart — not a chain pickup issue

      // Determine which child finishes first
      const firstIsEli = eliFinish <= elsyFinish;
      const firstChild = firstIsEli ? "Eli" : "Elsy";
      const secondChild = firstIsEli ? "Elsy" : "Eli";
      const firstFinish = firstIsEli ? eliFinish : elsyFinish;
      const secondFinish = firstIsEli ? elsyFinish : eliFinish;
      const driveToSecond = firstIsEli ? familySchedule.travelEliToElsyMins : familySchedule.travelElsyToEliMins;
      const arriveAtSecond = firstFinish + driveToSecond;
      const bufferMins = secondFinish - arriveAtSecond;
      const feasible = arriveAtSecond <= secondFinish;

      return [{
        day, weekLabel, firstChild, secondChild,
        firstFinish: m2t(firstFinish), secondFinish: m2t(secondFinish),
        driveToSecond, arriveAtSecond: m2t(arriveAtSecond),
        bufferMins: Math.round(bufferMins), feasible,
        gap,
      }];
    });
    const wkA = checkChain(familySchedule.daySchedules, familySchedule.fortnightEnabled ? "Wk A — " : "");
    const wkB = familySchedule.fortnightEnabled ? checkChain(familySchedule.weekBDaySchedules, "Wk B — ") : [];
    return [...wkA, ...wkB];
  }, [plan.clinicDays, familySchedule]);

  const nursingStatusLabel: Record<string, { label: string; color: string }> = {
    still_working: { label: "Still nursing", color: "text-amber-600 dark:text-amber-400" },
    exploring: { label: "Planning exit", color: "text-blue-600 dark:text-blue-400" },
    notice_given: { label: "Notice given", color: "text-emerald-600 dark:text-emerald-400" },
    left: { label: "Left nursing", color: "text-emerald-600 dark:text-emerald-400" },
  };

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
            <p className="text-[10px] text-muted-foreground">{schoolCovered ? "All clinic days covered" : "Needs a plan"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nursing</p>
            <p className={`text-sm font-bold ${nursingStatusLabel[plan.nursingStatus]?.color ?? "text-foreground"}`}>
              {nursingStatusLabel[plan.nursingStatus]?.label ?? "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {plan.targetExitDate ? `Target: ${parsePlanDate(plan.targetExitDate)?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—"}` : "No date set"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clinic hours</p>
            <p className="text-sm font-bold">{plan.clinicOpenTime}<span className="text-muted-foreground font-normal">–</span>{plan.clinicCloseTime}</p>
            <p className="text-[10px] text-muted-foreground">{plan.maxClinicDaysPerWeek} days max</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Life readiness</p>
              <p className={`text-xs font-bold ${lifeReadiness >= 70 ? "text-emerald-600 dark:text-emerald-400" : lifeReadiness >= 40 ? "text-primary" : "text-amber-500"}`}>{lifeReadiness}%</p>
            </div>
            {[
              { label: "Sched", checks: plan.scheduleChecks, items: SCHEDULE_CHECKS },
              { label: "Family", checks: plan.familyChecks, items: FAMILY_CHECKS },
              { label: "Nursing", checks: plan.nursingChecks, items: NURSING_CHECKS },
              { label: "Welbng", checks: plan.wellbeingChecks, items: WELLBEING_CHECKS },
              { label: "Identity", checks: plan.identityChecks, items: IDENTITY_CHECKS },
            ].map(({ label, checks, items }) => {
              const pct = Math.round((checks.filter(k => items.some(i => i.key === k)).length / Math.max(1, items.length)) * 100);
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-[8px] text-muted-foreground w-12 shrink-0">{label}</span>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-primary" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-[8px] font-bold w-5 text-right shrink-0 ${pct >= 70 ? "text-emerald-600 dark:text-emerald-400" : pct >= 40 ? "text-primary" : "text-amber-500"}`}>{pct}%</span>
                </div>
              );
            })}
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
          {schoolDropConflict && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">School run clash detected</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Clinic opens at {plan.clinicOpenTime} — school drop is at {familySchedule.elsySchoolStart}. On clinic days someone else needs to cover the drop. Sort this on the Family tab.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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

              <ClosurePlanner
                closureDates={extras.closureDates}
                onChange={dates => updateExtras({ closureDates: dates })}
              />
            </div>

            <div className="lg:col-span-3 space-y-5">
              <LaunchCountdown targetExitDate={plan.targetExitDate} noticeWeeks={plan.nursingNoticeWeeks} />
              <SmartScheduleAdvisor
                familySchedule={familySchedule}
                currentDays={plan.clinicDays}
                currentOpenTime={plan.clinicOpenTime}
                currentCloseTime={plan.clinicCloseTime}
                dayTimeOverrides={extras.dayTimeOverrides}
                onApply={(days, open, close) => update({ clinicDays: days, clinicOpenTime: open, clinicCloseTime: close })}
                onDayOverride={(day, override) => {
                  const next = { ...extras.dayTimeOverrides };
                  if (override === null) delete next[day]; else next[day] = override;
                  updateExtras({ dayTimeOverrides: next });
                }}
              />

              <ScheduleAnalytics
                clinicDays={plan.clinicDays}
                clinicOpenTime={plan.clinicOpenTime}
                clinicCloseTime={plan.clinicCloseTime}
                familySchedule={familySchedule}
                dayTimeOverrides={extras.dayTimeOverrides}
              />

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
                    schoolStart={familySchedule.elsySchoolStart}
                    schoolEnd={familySchedule.elsySchoolFinish}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Abi's Working Week</CardTitle>
                  <CardDescription className="text-xs">Your real clinic window after school runs — your actual daily capacity</CardDescription>
                </CardHeader>
                <CardContent>
                  <AbiWeek
                    clinicDays={plan.clinicDays}
                    clinicOpenTime={plan.clinicOpenTime}
                    clinicCloseTime={plan.clinicCloseTime}
                    familySchedule={familySchedule}
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

          <CoverageMatrix
            clinicDays={plan.clinicDays}
            daySchedules={familySchedule.daySchedules}
            weekBDaySchedules={familySchedule.weekBDaySchedules}
            fortnightEnabled={familySchedule.fortnightEnabled}
          />

          {/* ── Location triangle ── */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Logistics Triangle
              </CardTitle>
              <CardDescription className="text-xs">
                Home → school → clinic. Every clinic day this triangle needs to close — someone has to cover each leg.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Elsy row */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Elsy</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <LocationNode icon="🏠" label="Home" sub="4 Masons Ave, PO9 3FQ" color="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700" />
                  <TravelBadge mins={familySchedule.travelHomeToElsyMins} />
                  <LocationNode icon="🏫" label="Clanfield Junior" sub={`${familySchedule.elsySchoolStart}–${familySchedule.elsySchoolFinish}`} color="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" childName="Elsy" />
                  <TravelBadge mins={familySchedule.travelElsyToClinicMins} />
                  <LocationNode
                    icon="🏥"
                    label={activeProperty?.address || "Clinic"}
                    sub={activeProperty?.postcode || "Winchester"}
                    color="bg-primary/5 border-primary/20"
                  />
                </div>
              </div>
              {/* Eli row */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Eli</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <LocationNode icon="🏠" label="Home" sub="4 Masons Ave, PO9 3FQ" color="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700" />
                  <TravelBadge mins={familySchedule.travelHomeToEliMins} />
                  <LocationNode icon="🏫" label="Horndean Tech" sub={`${familySchedule.eliSchoolStart}–${familySchedule.eliSchoolFinish}`} color="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800" childName="Eli" />
                  <TravelBadge mins={familySchedule.travelEliToClinicMins} />
                  <LocationNode
                    icon="🏥"
                    label={activeProperty?.address || "Clinic"}
                    sub={activeProperty?.postcode || "Winchester"}
                    color="bg-primary/5 border-primary/20"
                  />
                </div>
              </div>

              {/* Chain pickup row — shown when both schools finish within 60 min */}
              {(() => {
                const elsyFinish = t2m(familySchedule.elsySchoolFinish);
                const eliFinish  = t2m(familySchedule.eliSchoolFinish);
                const gap = Math.abs(elsyFinish - eliFinish);
                if (gap > 60) return null;
                const firstIsEli = eliFinish <= elsyFinish;
                return (
                  <div className="space-y-1 mt-1 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" />
                      Chain pickup — {firstIsEli ? "Eli" : "Elsy"} finishes first ({gap} min gap)
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <LocationNode
                        icon="🏫"
                        label={firstIsEli ? "Horndean Tech" : "Clanfield Junior"}
                        sub={firstIsEli ? familySchedule.eliSchoolFinish : familySchedule.elsySchoolFinish}
                        color="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"
                      />
                      <TravelBadge mins={firstIsEli ? familySchedule.travelEliToElsyMins : familySchedule.travelElsyToEliMins} />
                      <LocationNode
                        icon="🏫"
                        label={firstIsEli ? "Clanfield Junior" : "Horndean Tech"}
                        sub={firstIsEli ? familySchedule.elsySchoolFinish : familySchedule.eliSchoolFinish}
                        color="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      />
                      <span className="text-[9px] text-muted-foreground ml-1">
                        arrive {m2t(Math.min(elsyFinish, eliFinish) + (firstIsEli ? familySchedule.travelEliToElsyMins : familySchedule.travelElsyToEliMins))}
                        {" "}(vs {m2t(Math.max(elsyFinish, eliFinish))} finish)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* ── Fortnightly schedule settings ── */}
          {(() => {
            const anchor = new Date(familySchedule.fortnightAnchorDate + "T12:00:00");
            const upcomingDadFridays: string[] = [];
            if (familySchedule.fortnightEnabled) {
              const today = new Date(); today.setHours(12, 0, 0, 0);
              for (let i = 0; i < 26; i++) {
                const d = new Date(anchor.getTime() + i * 14 * 24 * 60 * 60 * 1000);
                if (d >= today) upcomingDadFridays.push(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
                if (upcomingDadFridays.length >= 6) break;
              }
            }
            return (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Fortnightly Schedule
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Enable when the schedule differs every other week — e.g. kids' dad collects on alternating Fridays
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => {
                        if (!familySchedule.fortnightEnabled) {
                          const wkB: DaySchedules = JSON.parse(JSON.stringify(familySchedule.daySchedules));
                          if (wkB["Friday"]) {
                            wkB["Friday"] = { ...wkB["Friday"], elsy: { ...(wkB["Friday"].elsy ?? { dropBy: "", pickupBy: "" }), pickupBy: "Dad" }, eli: { ...(wkB["Friday"].eli ?? { dropBy: "", pickupBy: "" }), pickupBy: "Dad" } };
                          }
                          updateFS({ fortnightEnabled: true, weekBDaySchedules: wkB });
                        } else {
                          updateFS({ fortnightEnabled: false });
                        }
                      }}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${familySchedule.fortnightEnabled ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"}`}
                    >
                      {familySchedule.fortnightEnabled ? "On" : "Off"}
                    </button>
                  </div>
                </CardHeader>
                {familySchedule.fortnightEnabled && (
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0 w-36">First Week B date</Label>
                      <input
                        type="date"
                        value={familySchedule.fortnightAnchorDate}
                        onChange={e => updateFS({ fortnightAnchorDate: e.target.value })}
                        className="h-8 text-sm rounded-lg border border-border px-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-[10px] text-muted-foreground">Week B = the "different" week (e.g. Dad's Friday)</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Upcoming Week B Fridays (Dad collects)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {upcomingDadFridays.map(d => (
                          <span key={d} className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full">{d}</span>
                        ))}
                      </div>
                      <p className="text-[9px] text-muted-foreground">Based on anchor date · fortnightly from {new Date(familySchedule.fortnightAnchorDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Week A and Week B tabs appear in each child's schedule card and in Abi's Working Week view. Set them independently.</p>
                  </CardContent>
                )}
              </Card>
            );
          })()}

          {/* ── Conflict banner ── */}
          {familyConflicts.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1.5">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {familyConflicts.length} unassigned school run{familyConflicts.length > 1 ? "s" : ""} on clinic days
              </p>
              <div className="space-y-0.5">
                {familyConflicts.map((c, i) => (
                  <p key={i} className="text-xs text-destructive/80 pl-6">• {c}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── Chain pickup warnings ── */}
          {chainPickupWarnings.length > 0 && (
            <div className="space-y-3">
              {chainPickupWarnings.map(w => (
                <div key={w.day} className={`rounded-xl border p-4 space-y-3 ${
                  w.feasible
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20"
                    : "border-destructive/40 bg-destructive/5"
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${w.feasible ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${w.feasible ? "text-amber-700 dark:text-amber-300" : "text-destructive"}`}>
                        {w.weekLabel}{w.day}: Chain pickup — {w.firstChild} then {w.secondChild}
                      </p>
                      <p className={`text-xs mt-0.5 ${w.feasible ? "text-amber-600/80 dark:text-amber-400/80" : "text-destructive/80"}`}>
                        Both children assigned to Abi, finishing {w.gap} min apart — driving {w.firstChild}→{w.secondChild} ({w.driveToSecond} min)
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
                      w.feasible
                        ? w.bufferMins >= 10 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-300"
                        : "bg-destructive/15 text-destructive"
                    }`}>
                      {w.feasible ? (w.bufferMins >= 0 ? `+${w.bufferMins} min` : "tight") : `${Math.abs(w.bufferMins)} min late`}
                    </span>
                  </div>

                  {/* Chain timing diagram */}
                  <div className="flex items-center gap-1.5 text-[10px] flex-wrap ml-7">
                    <span className="font-bold px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">{w.firstChild} out {w.firstFinish}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">drive {w.driveToSecond} min</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className={`font-bold px-2 py-1 rounded ${
                      w.feasible
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-destructive/15 text-destructive"
                    }`}>arrive {w.arriveAtSecond}</span>
                    <span className="text-muted-foreground">(vs {w.secondChild} out {w.secondFinish})</span>
                    {w.feasible && w.bufferMins > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">· {w.bufferMins} min to spare</span>
                    )}
                    {!w.feasible && (
                      <span className="text-destructive font-medium">· {Math.abs(w.bufferMins)} min too late — needs cover</span>
                    )}
                  </div>

                  {!w.feasible && (
                    <p className="text-xs text-destructive/80 ml-7">
                      Abi can't collect both children alone on {w.day}. Assign one pickup to David or arrange school club/another carer.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Clinic location per day ── */}
          <DayLocationStrip
            clinicDays={plan.clinicDays}
            daySchedules={familySchedule.daySchedules}
            onChange={(day, loc) => {
              const next = { ...familySchedule.daySchedules };
              next[day] = { ...next[day], clinicLocation: loc };
              updateFS({ daySchedules: next });
            }}
          />

          {/* ── Per-child schedule ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChildScheduleCard
              childName="Elsy"
              school="Clanfield Junior School"
              schoolStart={familySchedule.elsySchoolStart}
              schoolFinish={familySchedule.elsySchoolFinish}
              travelHomeToSchool={familySchedule.travelHomeToElsyMins}
              travelSchoolToWinchesterMins={familySchedule.travelElsyToClinicMins}
              travelWinchesterToSchoolMins={familySchedule.travelClinicToElsyMins}
              travelSchoolToBedhamptonMins={familySchedule.travelElsyToBedhamptonMins}
              travelBedhamptonToSchoolMins={familySchedule.travelBedhamptonToElsyMins}
              clinicDays={plan.clinicDays}
              clinicOpenTime={plan.clinicOpenTime}
              daySchedules={familySchedule.daySchedules}
              onDayChange={(day, role, who) => {
                const next = { ...familySchedule.daySchedules };
                next[day] = { ...next[day], elsy: { ...(next[day]?.elsy ?? { dropBy: "", pickupBy: "" }), [role]: who } };
                updateFS({ daySchedules: next });
              }}
              childKey="elsy"
              accentColor="amber"
              backupCarerName={familySchedule.backupCarerName}
              fortnightEnabled={familySchedule.fortnightEnabled}
              weekBDaySchedules={familySchedule.weekBDaySchedules}
              onWeekBDayChange={(day, role, who) => {
                const next = { ...familySchedule.weekBDaySchedules };
                next[day] = { ...next[day], elsy: { ...(next[day]?.elsy ?? { dropBy: "", pickupBy: "" }), [role]: who } };
                updateFS({ weekBDaySchedules: next });
              }}
            />
            <ChildScheduleCard
              childName="Eli"
              school="Horndean Technology College"
              schoolStart={familySchedule.eliSchoolStart}
              schoolFinish={familySchedule.eliSchoolFinish}
              travelHomeToSchool={familySchedule.travelHomeToEliMins}
              travelSchoolToWinchesterMins={familySchedule.travelEliToClinicMins}
              travelWinchesterToSchoolMins={familySchedule.travelClinicToEliMins}
              travelSchoolToBedhamptonMins={familySchedule.travelEliToBedhamptonMins}
              travelBedhamptonToSchoolMins={familySchedule.travelBedhamptonToEliMins}
              clinicDays={plan.clinicDays}
              clinicOpenTime={plan.clinicOpenTime}
              daySchedules={familySchedule.daySchedules}
              onDayChange={(day, role, who) => {
                const next = { ...familySchedule.daySchedules };
                next[day] = { ...next[day], eli: { ...(next[day]?.eli ?? { dropBy: "", pickupBy: "" }), [role]: who } };
                updateFS({ daySchedules: next });
              }}
              childKey="eli"
              accentColor="violet"
              backupCarerName={familySchedule.backupCarerName}
              fortnightEnabled={familySchedule.fortnightEnabled}
              weekBDaySchedules={familySchedule.weekBDaySchedules}
              onWeekBDayChange={(day, role, who) => {
                const next = { ...familySchedule.weekBDaySchedules };
                next[day] = { ...next[day], eli: { ...(next[day]?.eli ?? { dropBy: "", pickupBy: "" }), [role]: who } };
                updateFS({ weekBDaySchedules: next });
              }}
            />
          </div>

          {/* ── Abi's week view ── */}
          <AbiWeek
            clinicDays={plan.clinicDays}
            clinicOpenTime={plan.clinicOpenTime}
            clinicCloseTime={plan.clinicCloseTime}
            familySchedule={familySchedule}
          />

          {/* ── Travel & school time config ── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> School Times & Travel Estimates
              </CardTitle>
              <CardDescription className="text-xs">
                Set times for both clinic locations — the day's location (Winchester or Bedhampton) determines which figures are used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/40">
                <div className="space-y-1 flex-1 max-w-[180px]">
                  <Label className="text-xs text-muted-foreground">Park &amp; walk to clinic (min)</Label>
                  <Input
                    type="number" min={1} max={30}
                    value={familySchedule.parkAndWalkMins}
                    onChange={e => updateFS({ parkAndWalkMins: +e.target.value })}
                    className="h-7 text-xs w-24"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Added to every arrival and departure time — affects Abi's first client window and last appointment cut-off
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 mb-4 space-y-1.5">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Google Maps verified · 5 min buffer applied
                </p>
                <p className="text-[10px] text-muted-foreground">Horndean Tech (PO8 9PQ) · Clanfield Junior (PO8 0RE) · Home (PO9 3FQ) · Winchester SO23. Adjust below if your live times differ.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Elsy */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Elsy — Clanfield Junior School</p>
                  <div className="grid grid-cols-2 gap-2">
                    <TravelInput label="School starts" value={familySchedule.elsySchoolStart} isTime onChange={v => updateFS({ elsySchoolStart: v })} />
                    <TravelInput label="School finishes" value={familySchedule.elsySchoolFinish} isTime onChange={v => updateFS({ elsySchoolFinish: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <TravelInput label="Home → school (min)" value={familySchedule.travelHomeToElsyMins} onChange={v => updateFS({ travelHomeToElsyMins: +v })} />
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">Winchester</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TravelInput label="School → clinic (min)" value={familySchedule.travelElsyToClinicMins} onChange={v => updateFS({ travelElsyToClinicMins: +v })} />
                      <TravelInput label="Clinic → school (min)" value={familySchedule.travelClinicToElsyMins} onChange={v => updateFS({ travelClinicToElsyMins: +v })} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Bedhampton</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TravelInput label="School → clinic (min)" value={familySchedule.travelElsyToBedhamptonMins} onChange={v => updateFS({ travelElsyToBedhamptonMins: +v })} />
                      <TravelInput label="Clinic → school (min)" value={familySchedule.travelBedhamptonToElsyMins} onChange={v => updateFS({ travelBedhamptonToElsyMins: +v })} />
                    </div>
                  </div>
                </div>
                {/* Eli */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Eli — Horndean Technology College</p>
                  <div className="grid grid-cols-2 gap-2">
                    <TravelInput label="School starts" value={familySchedule.eliSchoolStart} isTime onChange={v => updateFS({ eliSchoolStart: v })} />
                    <TravelInput label="School finishes" value={familySchedule.eliSchoolFinish} isTime onChange={v => updateFS({ eliSchoolFinish: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <TravelInput label="Home → school (min)" value={familySchedule.travelHomeToEliMins} onChange={v => updateFS({ travelHomeToEliMins: +v })} />
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">Winchester</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TravelInput label="School → clinic (min)" value={familySchedule.travelEliToClinicMins} onChange={v => updateFS({ travelEliToClinicMins: +v })} />
                      <TravelInput label="Clinic → school (min)" value={familySchedule.travelClinicToEliMins} onChange={v => updateFS({ travelClinicToEliMins: +v })} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20 p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Bedhampton</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TravelInput label="School → clinic (min)" value={familySchedule.travelEliToBedhamptonMins} onChange={v => updateFS({ travelEliToBedhamptonMins: +v })} />
                      <TravelInput label="Clinic → school (min)" value={familySchedule.travelBedhamptonToEliMins} onChange={v => updateFS({ travelBedhamptonToEliMins: +v })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chain pickup travel time */}
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Chain pickup — between schools (Horndean ↔ Clanfield, ~3.9 km via B2149)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <TravelInput label="Eli → Elsy school (min)" value={familySchedule.travelEliToElsyMins} onChange={v => updateFS({ travelEliToElsyMins: +v })} />
                    <TravelInput label="Elsy → Eli school (min)" value={familySchedule.travelElsyToEliMins} onChange={v => updateFS({ travelElsyToEliMins: +v })} />
                  </div>
                  <p className="text-[9px] text-muted-foreground">Used to check whether Abi can feasibly collect both children on the same day when both pickups are assigned to her.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── David + contingency + checklist ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">David's Role</CardTitle>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Be concrete</span>
                  </div>
                  <CardDescription className="text-xs">"He'll help" is not a plan. "He does school run Mon–Thu and checks school email on clinic days" is.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0 w-32">Backup carer name</Label>
                    <input
                      type="text"
                      placeholder="e.g. Grandma, Sandra, Childminder…"
                      value={familySchedule.backupCarerName}
                      onChange={e => updateFS({ backupCarerName: e.target.value })}
                      className="flex-1 h-8 text-sm rounded-lg border border-border px-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Days available to support</Label>
                    <div className="flex-1 flex items-center gap-2">
                      <input type="range" min={1} max={7} value={familySchedule.davidAvailabilityDays} onChange={e => updateFS({ davidAvailabilityDays: +e.target.value })} className="flex-1 accent-primary" />
                      <span className={`text-sm font-bold w-12 text-right ${familySchedule.davidAvailabilityDays >= 4 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                        {familySchedule.davidAvailabilityDays}d
                      </span>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Write it down as if explaining to someone else: 'David does X on Y days. He handles Z. He does NOT do W. After 7pm, clinic is not his problem.'"
                    value={familySchedule.davidRoleNotes}
                    onChange={e => updateFS({ davidRoleNotes: e.target.value })}
                    className="min-h-[100px] text-sm resize-none"
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Contingency Plan</CardTitle>
                  <CardDescription className="text-xs">INSET days, illness, school events — what's the fallback when the normal plan breaks?</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="e.g. Mum covers if David unavailable. INSET days: David WFH. Sports day / assemblies: I attend unless back-to-back bookings. If child is sick: David first call, then Mum, then I cancel last-resort."
                    value={familySchedule.contingencyPlan}
                    onChange={e => updateFS({ contingencyPlan: e.target.value })}
                    className="min-h-[90px] text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
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
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed italic">"'David will figure it out' is not a plan. Clinics fail because the practitioner discovered — in month two, during a full book — that there was no actual arrangement for who picks up the children."</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NURSING EXIT ════════════════════════════════════════════════════════ */}
      {tab === "nursing" && (
        <div className="space-y-6">
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
                      <Label className="text-xs text-muted-foreground">Target exit date</Label>
                      <Input type="date" value={plan.targetExitDate} onChange={e => update({ targetExitDate: e.target.value })} className="h-9 text-sm font-medium" />
                    </div>
                  </div>
                  {plan.targetExitDate && parsePlanDate(plan.targetExitDate) && (() => {
                    const exitD = parsePlanDate(plan.targetExitDate)!;
                    const noticeD = new Date(exitD.getTime() - plan.nursingNoticeWeeks * 7 * 24 * 60 * 60 * 1000);
                    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Give notice by</p>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">{fmt(noticeD)}</p>
                        </div>
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                          <p className="text-[10px] text-primary font-medium uppercase tracking-wide">Last day</p>
                          <p className="text-sm font-bold text-primary mt-0.5">{fmt(exitD)}</p>
                        </div>
                      </div>
                    );
                  })()}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IncomeBridge
              nursingMonthlyIncome={extras.nursingMonthlyIncomeGbp}
              clinicDays={plan.clinicDays}
              onChange={v => updateExtras({ nursingMonthlyIncomeGbp: v })}
            />
            <NoticeScripts />
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
                  <CardDescription className="text-xs">Things that don't move for the clinic. Ever. Add them here so you don't have to fight for them later.</CardDescription>
                </CardHeader>
                <CardContent>
                  <NonNegotiablesList
                    items={extras.nonNegotiablesList}
                    onChange={items => updateExtras({ nonNegotiablesList: items })}
                  />
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

              <CapacityCalculator
                clinicDays={plan.clinicDays}
                clinicOpenTime={plan.clinicOpenTime}
                clinicCloseTime={plan.clinicCloseTime}
                familySchedule={familySchedule}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ IDENTITY ════════════════════════════════════════════════════════════ */}
      {tab === "identity" && (
        <div className="space-y-6">
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
              <ThePitch
                value={extras.thePitch}
                onChange={v => updateExtras({ thePitch: v })}
              />

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
                    <Label className="text-sm font-medium">Fear Inventory</Label>
                    <p className="text-xs text-muted-foreground">Name every fear — then track it. What's named can be managed.</p>
                    <FearInventory
                      items={extras.fearInventory}
                      onChange={items => updateExtras({ fearInventory: items })}
                    />
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

              {extras.fearInventory.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Fear inventory</p>
                  <p className="text-xs text-muted-foreground">{extras.fearInventory.filter(f => f.status === "resolved").length}/{extras.fearInventory.length} fears resolved — keep going.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
