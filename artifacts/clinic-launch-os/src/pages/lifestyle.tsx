import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, Clock, Sun, Heart, Users,
  Stethoscope, Leaf, AlertCircle, Star, ChevronRight,
  CalendarDays, ArrowRight, Shield, Sparkles, MapPin,
} from "lucide-react";

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
  // Winchester travel times
  travelHomeToElsyMins: number;
  travelElsyToClinicMins: number;
  travelClinicToElsyMins: number;
  travelHomeToEliMins: number;
  travelEliToClinicMins: number;
  travelClinicToEliMins: number;
  // Bedhampton travel times (much shorter — local)
  travelElsyToBedhamptonMins: number;
  travelBedhamptonToElsyMins: number;
  travelEliToBedhamptonMins: number;
  travelBedhamptonToEliMins: number;
  parkAndWalkMins: number;
  contingencyPlan: string;
  davidAvailabilityDays: number;
  davidRoleNotes: string;
  daySchedules: DaySchedules;
}

const DEFAULT_DAY_ENTRY = {
  elsy: { dropBy: "", pickupBy: "" },
  eli: { dropBy: "", pickupBy: "" },
  clinicLocation: "winchester" as ClinicLocation,
};

const DEFAULT_FAMILY_SCHEDULE: FamilySchedule = {
  elsySchoolStart: "08:45",
  elsySchoolFinish: "15:15",
  eliSchoolStart: "08:30",
  eliSchoolFinish: "14:50",
  travelHomeToElsyMins: 8,
  travelElsyToClinicMins: 28,
  travelClinicToElsyMins: 30,
  travelHomeToEliMins: 10,
  travelEliToClinicMins: 28,
  travelClinicToEliMins: 30,
  travelElsyToBedhamptonMins: 5,
  travelBedhamptonToElsyMins: 5,
  travelEliToBedhamptonMins: 8,
  travelBedhamptonToEliMins: 8,
  parkAndWalkMins: 10,
  contingencyPlan: "",
  davidAvailabilityDays: 5,
  davidRoleNotes: "",
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
}

const EMPTY: Plan = {
  clinicDays: ["Mon", "Tue", "Wed", "Thu"], clinicOpenTime: "09:00", clinicCloseTime: "18:00", scheduleNotes: "",
  schoolStartTime: "09:00", schoolFinishTime: "15:30", dropCoveredBy: "", pickupCoveredBy: "",
  schoolContingencyPlan: "", davidAvailabilityDays: 5, davidRoleNotes: "",
  nursingStatus: "still_working", nursingNoticeWeeks: 12, targetExitDate: "", nursingExitNotes: "",
  maxClinicDaysPerWeek: 4, sickCoverPlan: "", holidayPlan: "", nonNegotiables: "",
  mostExcitedAbout: "", biggestConcerns: "", supportNetwork: "",
  scheduleChecks: [], familyChecks: [], nursingChecks: [], wellbeingChecks: [], identityChecks: [],
  familyScheduleJson: "{}",
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

function PersonSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full h-7 text-xs rounded-lg border px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer ${
        !value
          ? "border-destructive/50 text-muted-foreground"
          : value === "Abi"
          ? "border-primary/50 text-primary font-semibold"
          : "border-border text-foreground"
      }`}
    >
      <option value="">— assign —</option>
      <option value="Abi">Abi</option>
      <option value="David">David</option>
      <option value="Other / backup">Other / backup</option>
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
  clinicDays, clinicOpenTime, daySchedules, onDayChange, childKey, accentColor,
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
}) {
  const isAmber = accentColor === "amber";
  const accent = isAmber
    ? { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-400" }
    : { bg: "bg-violet-50 dark:bg-violet-950/20", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-400" };

  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent.dot}`} />
            <CardTitle className="text-sm">{childName}</CardTitle>
          </div>
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
          const schedule = daySchedules[day]?.[childKey] ?? { dropBy: "", pickupBy: "" };
          const noCover = !schedule.dropBy || !schedule.pickupBy;
          const loc = daySchedules[day]?.clinicLocation ?? "winchester";
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
                      onChange={e => onDayChange(day, "dropTime", e.target.value)}
                      className="text-[10px] font-mono text-foreground/70 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary w-[52px]"
                    />
                    {hasClubDrop && (
                      <span className="text-[8px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1 rounded font-bold">CLUB</span>
                    )}
                  </div>
                  <PersonSelect value={schedule.dropBy} onChange={who => onDayChange(day, "dropBy", who)} />
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
                      onChange={e => onDayChange(day, "pickupTime", e.target.value)}
                      className="text-[10px] font-mono text-foreground/70 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary w-[52px]"
                    />
                    {hasClubPickup && (
                      <span className="text-[8px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1 rounded font-bold">CLUB</span>
                    )}
                  </div>
                  <PersonSelect value={schedule.pickupBy} onChange={who => onDayChange(day, "pickupBy", who)} />
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
  const clinicDayList = DAYS.filter(d => clinicDays.includes(d));
  if (clinicDayList.length === 0) return null;

  const dayTimelines = clinicDayList.map(day => {
    const ds = familySchedule.daySchedules[day];
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

  const familyConflicts = useMemo(() => plan.clinicDays.flatMap(day => {
    const ds = familySchedule.daySchedules[day];
    if (!ds) return [`${day}: no schedule configured`];
    const issues: string[] = [];
    if (!ds.elsy?.dropBy) issues.push(`${day}: Elsy's drop-off not assigned`);
    if (!ds.elsy?.pickupBy) issues.push(`${day}: Elsy's pick-up not assigned`);
    if (!ds.eli?.dropBy) issues.push(`${day}: Eli's drop-off not assigned`);
    if (!ds.eli?.pickupBy) issues.push(`${day}: Eli's pick-up not assigned`);
    return issues;
  }), [plan.clinicDays, familySchedule.daySchedules]);

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
            </div>

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
                    schoolStart={familySchedule.elsySchoolStart}
                    schoolEnd={familySchedule.elsySchoolFinish}
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
            </CardContent>
          </Card>

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
