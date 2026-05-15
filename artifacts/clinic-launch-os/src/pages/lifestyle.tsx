import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, Clock, Sun, Heart, Users,
  Stethoscope, Leaf, AlertCircle, Star,
} from "lucide-react";

const PROJECT_ID = 1;
const API_BASE = "/api";

type TabKey = "schedule" | "family" | "nursing" | "wellbeing" | "identity";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface Plan {
  clinicDays: string[];
  clinicOpenTime: string;
  clinicCloseTime: string;
  scheduleNotes: string;
  schoolStartTime: string;
  schoolFinishTime: string;
  dropCoveredBy: string;
  pickupCoveredBy: string;
  schoolContingencyPlan: string;
  davidAvailabilityDays: number;
  davidRoleNotes: string;
  nursingStatus: string;
  nursingNoticeWeeks: number;
  targetExitDate: string;
  nursingExitNotes: string;
  maxClinicDaysPerWeek: number;
  sickCoverPlan: string;
  holidayPlan: string;
  nonNegotiables: string;
  mostExcitedAbout: string;
  biggestConcerns: string;
  supportNetwork: string;
  scheduleChecks: string[];
  familyChecks: string[];
  nursingChecks: string[];
  wellbeingChecks: string[];
  identityChecks: string[];
}

const EMPTY: Plan = {
  clinicDays: ["Mon", "Tue", "Wed", "Thu"],
  clinicOpenTime: "09:00",
  clinicCloseTime: "18:00",
  scheduleNotes: "",
  schoolStartTime: "09:00",
  schoolFinishTime: "15:30",
  dropCoveredBy: "",
  pickupCoveredBy: "",
  schoolContingencyPlan: "",
  davidAvailabilityDays: 5,
  davidRoleNotes: "",
  nursingStatus: "still_working",
  nursingNoticeWeeks: 12,
  targetExitDate: "",
  nursingExitNotes: "",
  maxClinicDaysPerWeek: 4,
  sickCoverPlan: "",
  holidayPlan: "",
  nonNegotiables: "",
  mostExcitedAbout: "",
  biggestConcerns: "",
  supportNetwork: "",
  scheduleChecks: [],
  familyChecks: [],
  nursingChecks: [],
  wellbeingChecks: [],
  identityChecks: [],
};

function parseJson(s: string | null | undefined, fallback: string[]): string[] {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

function fromApi(raw: Record<string, any>): Plan {
  return {
    ...EMPTY,
    ...raw,
    clinicDays: parseJson(typeof raw.clinicDays === "string" ? raw.clinicDays : JSON.stringify(raw.clinicDays), EMPTY.clinicDays),
    scheduleChecks: parseJson(typeof raw.scheduleChecks === "string" ? raw.scheduleChecks : JSON.stringify(raw.scheduleChecks), []),
    familyChecks: parseJson(typeof raw.familyChecks === "string" ? raw.familyChecks : JSON.stringify(raw.familyChecks), []),
    nursingChecks: parseJson(typeof raw.nursingChecks === "string" ? raw.nursingChecks : JSON.stringify(raw.nursingChecks), []),
    wellbeingChecks: parseJson(typeof raw.wellbeingChecks === "string" ? raw.wellbeingChecks : JSON.stringify(raw.wellbeingChecks), []),
    identityChecks: parseJson(typeof raw.identityChecks === "string" ? raw.identityChecks : JSON.stringify(raw.identityChecks), []),
  };
}

function toApi(p: Plan) {
  return {
    ...p,
    clinicDays: JSON.stringify(p.clinicDays),
    scheduleChecks: JSON.stringify(p.scheduleChecks),
    familyChecks: JSON.stringify(p.familyChecks),
    nursingChecks: JSON.stringify(p.nursingChecks),
    wellbeingChecks: JSON.stringify(p.wellbeingChecks),
    identityChecks: JSON.stringify(p.identityChecks),
  };
}

const SCHEDULE_CHECKS = [
  { key: "school_time_checked", label: "Checked clinic hours don't clash with school drop-off on working days" },
  { key: "lunch_planned", label: "Planned what happens if a client runs over lunch — who collects?" },
  { key: "late_clients", label: "Decided how late you're willing to take appointments" },
  { key: "buffer_days", label: "Built in at least one non-clinic day per week for admin, rest, and life" },
];

const FAMILY_CHECKS = [
  { key: "drop_agreed", label: "Agreed who does school drop on each clinic day" },
  { key: "pickup_agreed", label: "Agreed who does school pickup on each clinic day" },
  { key: "inset_days", label: "Have a plan for INSET days, school holidays, and half terms" },
  { key: "sick_child", label: "Have a plan for when Eli or Elsy is too unwell for school" },
  { key: "school_events", label: "Decided how to handle school plays, sports days, parents' evenings" },
  { key: "david_backup", label: "David knows which days he's on duty — and it's in the diary" },
  { key: "emergency_contact", label: "Set up an emergency backup contact (grandparent, friend) the school can call" },
];

const NURSING_CHECKS = [
  { key: "notice_checked", label: "Read your employment contract — confirmed the required notice period" },
  { key: "handover_plan", label: "Have a rough idea for a handover plan with your ward/team" },
  { key: "reference_lined_up", label: "Have a professional reference lined up who won't be surprised" },
  { key: "nmc_checked", label: "Checked NMC registration — you can stay registered after leaving NHS" },
  { key: "david_knows_date", label: "Told David your target exit date and he's on board" },
  { key: "emotional_talked", label: "Talked through the emotional side — identity, routine, security" },
  { key: "slow_ramp_plan", label: "Have a plan for what happens if the clinic ramp is slower than expected" },
  { key: "locum_cover", label: "Ward knows you're going — they can plan locum cover in time" },
];

const WELLBEING_CHECKS = [
  { key: "bad_week_plan", label: "Have a plan for a week with very few clients — financially and emotionally" },
  { key: "peer_support", label: "Identified a mentor, peer, or business friend to talk to monthly" },
  { key: "financial_alarm", label: "Agreed with David what the 'this isn't working' conversation looks like — and when" },
  { key: "first_holiday", label: "Planned the first holiday post-opening (even if it's just 3 days)" },
  { key: "non_clinical_passion", label: "Have something outside the clinic that's yours — not business, not kids" },
  { key: "boundaries_set", label: "David knows which hours/days are yours — not to be asked about business" },
];

const IDENTITY_CHECKS = [
  { key: "said_it_aloud", label: "Practised saying \"I own an aesthetics clinic\" without immediately qualifying it" },
  { key: "qualified_question", label: "Decided how to handle \"but are you qualified?\" — you have an answer ready" },
  { key: "community_joined", label: "Joined or identified an aesthetics practitioner community to be part of" },
  { key: "colleagues_told", label: "Told the nursing colleagues who matter — not as a rumour, directly" },
  { key: "12m_vision_written", label: "Written down what success looks like in 12 months — not just financial" },
  { key: "failure_plan", label: "Decided what \"this isn't working\" looks like and what you'd do — so it's not a secret fear" },
];

function Checklist({
  items,
  checked,
  onChange,
}: {
  items: { key: string; label: string }[];
  checked: string[];
  onChange: (keys: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(checked.includes(key) ? checked.filter(k => k !== key) : [...checked, key]);
  };
  const done = checked.filter(k => items.some(i => i.key === k)).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{done} of {items.length} considered</span>
        <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => toggle(item.key)}
          className="w-full flex items-start gap-3 text-left group"
        >
          {checked.includes(item.key)
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" />}
          <span className={`text-sm leading-snug ${checked.includes(item.key) ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function SectionProgress({ checks, total }: { checks: string[]; total: number }) {
  const done = checks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
      pct === 100 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : pct >= 50 ? "bg-primary/20 text-primary border-primary/30"
      : "bg-muted text-muted-foreground border-border"
    }`}>
      {done}/{total}
    </span>
  );
}

export default function LifestylePage() {
  const [plan, setPlan] = useState<Plan>(EMPTY);
  const [tab, setTab] = useState<TabKey>("schedule");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setPlan(fromApi(data));
        setLoaded(true);
        setSaveStatus("idle");
      });
  }, []);

  const save = useCallback((p: Plan) => {
    setSaveStatus("saving");
    fetch(`${API_BASE}/projects/${PROJECT_ID}/lifestyle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApi(p)),
    })
      .then(r => r.json())
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("unsaved"));
  }, []);

  const update = useCallback((patch: Partial<Plan>) => {
    setPlan(prev => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), 600);
      setSaveStatus("unsaved");
      return next;
    });
  }, [save]);

  const toggleCheck = useCallback((field: keyof Plan, key: string) => {
    setPlan(prev => {
      const arr = prev[field] as string[];
      const next = { ...prev, [field]: arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key] };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), 600);
      setSaveStatus("unsaved");
      return next;
    });
  }, [save]);

  const clinicDaysCount = plan.clinicDays.length;
  const schoolDropConflict = plan.clinicDays.some(() => {
    const openH = parseInt(plan.clinicOpenTime.split(":")[0]);
    const schoolH = parseInt(plan.schoolStartTime.split(":")[0]);
    return openH <= schoolH;
  });

  const tabs: { key: TabKey; label: string; icon: React.ElementType; checks: string[]; total: number }[] = [
    { key: "schedule", label: "Schedule", icon: Clock, checks: plan.scheduleChecks, total: SCHEDULE_CHECKS.length },
    { key: "family", label: "Family", icon: Users, checks: plan.familyChecks, total: FAMILY_CHECKS.length },
    { key: "nursing", label: "Leaving Nursing", icon: Stethoscope, checks: plan.nursingChecks, total: NURSING_CHECKS.length },
    { key: "wellbeing", label: "Wellbeing", icon: Heart, checks: plan.wellbeingChecks, total: WELLBEING_CHECKS.length },
    { key: "identity", label: "Identity", icon: Star, checks: plan.identityChecks, total: IDENTITY_CHECKS.length },
  ];

  const totalChecks = tabs.reduce((s, t) => s + t.total, 0);
  const doneChecks = tabs.reduce((s, t) => s + t.checks.filter(k => t.key === "schedule" ? SCHEDULE_CHECKS.some(i => i.key === k) : t.key === "family" ? FAMILY_CHECKS.some(i => i.key === k) : t.key === "nursing" ? NURSING_CHECKS.some(i => i.key === k) : t.key === "wellbeing" ? WELLBEING_CHECKS.some(i => i.key === k) : IDENTITY_CHECKS.some(i => i.key === k)).length, 0);

  if (!loaded) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Leaf className="w-6 h-6 text-primary" />
            Life Design
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Opening a clinic is a life change, not just a business decision. This section helps you plan the parts that don't appear on a spreadsheet.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">Considerations covered</div>
            <div className="text-lg font-bold text-primary">{doneChecks}/{totalChecks}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-md border ${
            saveStatus === "saved" ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
            : saveStatus === "saving" ? "text-muted-foreground border-border animate-pulse"
            : saveStatus === "unsaved" ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20"
            : "text-muted-foreground border-transparent"
          }`}>
            {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : ""}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <SectionProgress checks={t.checks} total={t.total} />
          </button>
        ))}
      </div>

      {/* ═══ SCHEDULE ══════════════════════════════════════════════════════════ */}
      {tab === "schedule" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Clinic Days</CardTitle>
                <CardDescription className="text-xs">Which days will the clinic be open?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => {
                    const on = plan.clinicDays.includes(day);
                    return (
                      <button key={day} onClick={() => update({ clinicDays: on ? plan.clinicDays.filter(d => d !== day) : [...plan.clinicDays, day] })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {clinicDaysCount} days/week selected
                  {clinicDaysCount > 4 && <span className="ml-2 text-amber-600"> — more than 4 days is a lot alongside family life</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Opening Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Open from</Label>
                    <Input type="time" value={plan.clinicOpenTime} onChange={e => update({ clinicOpenTime: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Close at</Label>
                    <Input type="time" value={plan.clinicCloseTime} onChange={e => update({ clinicCloseTime: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes — What Does a Good Clinic Day Look Like?</CardTitle>
                <CardDescription className="text-xs">Vision, rhythm, what you're protecting</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea placeholder="e.g. Start at 9am after drop-off. Lunch 12:30–1:30 — no clients. Finish by 5:30pm so I'm home before bedtime. Admin day on Fridays, not a client day." value={plan.scheduleNotes} onChange={e => update({ scheduleNotes: e.target.value })} className="min-h-[100px] text-sm resize-none" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            {schoolDropConflict && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Potential school run clash</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Clinic opens at {plan.clinicOpenTime} — school drop is at {plan.schoolStartTime}. Check the Family tab to confirm who covers.</p>
                </div>
              </div>
            )}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Schedule Considerations</CardTitle>
                <CardDescription className="text-xs">Tick each one as you've thought it through</CardDescription>
              </CardHeader>
              <CardContent>
                <Checklist items={SCHEDULE_CHECKS} checked={plan.scheduleChecks} onChange={v => update({ scheduleChecks: v })} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1">Something worth sitting with</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"The schedule you plan in November won't survive first contact with January. Build in one fully protected non-clinic day per week from day one — not when you're already burnt out."</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ FAMILY ════════════════════════════════════════════════════════════ */}
      {tab === "family" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">The School Run — Eli & Elsy</CardTitle>
                <CardDescription className="text-xs">Concrete logistics, not vague "we'll figure it out"</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">School starts</Label>
                    <Input type="time" value={plan.schoolStartTime} onChange={e => update({ schoolStartTime: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">School finishes</Label>
                    <Input type="time" value={plan.schoolFinishTime} onChange={e => update({ schoolFinishTime: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Drop-off covered by (on clinic days)</Label>
                  <Input placeholder="e.g. David on Mon/Tue/Wed, Mum on Thursdays" value={plan.dropCoveredBy} onChange={e => update({ dropCoveredBy: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pick-up covered by (on clinic days)</Label>
                  <Input placeholder="e.g. David every day I'm at clinic" value={plan.pickupCoveredBy} onChange={e => update({ pickupCoveredBy: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contingency plan — illness, INSET days, school events</Label>
                  <Textarea placeholder="e.g. Mum is backup for illness. INSET days: David works from home. Sports day / assemblies: Abi attends if not booked." value={plan.schoolContingencyPlan} onChange={e => update({ schoolContingencyPlan: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">David's Role</CardTitle>
                <CardDescription className="text-xs">What he's actually committed to — specifically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Days per week David is available to support</Label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={7} value={plan.davidAvailabilityDays} onChange={e => update({ davidAvailabilityDays: parseInt(e.target.value) })} className="flex-1" />
                    <span className="text-sm font-semibold w-16 text-right">{plan.davidAvailabilityDays} days</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">His specific commitments (be concrete)</Label>
                  <Textarea placeholder="e.g. David does school run Mon–Thu. He handles all school communications on clinic days. He has capacity for one Saturday clinic admin morning per month. He will not be asked about clinic problems after 7pm." value={plan.davidRoleNotes} onChange={e => update({ davidRoleNotes: e.target.value })} className="min-h-[100px] text-sm resize-none" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Family Logistics Checklist</CardTitle>
                <CardDescription className="text-xs">The things that catch you off guard if you haven't planned them</CardDescription>
              </CardHeader>
              <CardContent>
                <Checklist items={FAMILY_CHECKS} checked={plan.familyChecks} onChange={v => update({ familyChecks: v })} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1">Worth saying out loud</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"The clinics that fail in year one often do so because the practitioner didn't have a real plan for who was running the home. 'David will figure it out' is not a plan. 'David does school run Monday to Thursday and we've agreed it in writing' is."</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ NURSING EXIT ══════════════════════════════════════════════════════ */}
      {tab === "nursing" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Where Are You Now?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {[
                    { value: "still_working", label: "Still working as normal — haven't told anyone" },
                    { value: "exploring", label: "Starting to wind down mentally — no formal steps yet" },
                    { value: "notice_given", label: "Notice given — leaving date is set" },
                    { value: "left", label: "Already left nursing" },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${plan.nursingStatus === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <input type="radio" name="nursingStatus" value={opt.value} checked={plan.nursingStatus === opt.value} onChange={() => update({ nursingStatus: opt.value })} className="accent-primary" />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">The Practicalities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notice period required (weeks)</Label>
                    <Input type="number" min={1} max={52} value={plan.nursingNoticeWeeks} onChange={e => update({ nursingNoticeWeeks: parseInt(e.target.value) || 12 })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Target exit month/year</Label>
                    <Input type="month" value={plan.targetExitDate} onChange={e => update({ targetExitDate: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>
                {plan.targetExitDate && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    To leave by <strong>{new Date(plan.targetExitDate + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>, you need to give notice by <strong>
                      {new Date(new Date(plan.targetExitDate + "-01").getTime() - plan.nursingNoticeWeeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </strong>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes — anything specific to your situation</Label>
                  <Textarea placeholder="e.g. I need to manage this carefully with my ward manager — we're already short-staffed. I'm worried about being guilt-tripped into staying longer." value={plan.nursingExitNotes} onChange={e => update({ nursingExitNotes: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Have You Thought About…</CardTitle>
                <CardDescription className="text-xs">The things people don't realise until it's too late</CardDescription>
              </CardHeader>
              <CardContent>
                <Checklist items={NURSING_CHECKS} checked={plan.nursingChecks} onChange={v => update({ nursingChecks: v })} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1">On the emotional side</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"Leaving nursing isn't just a job change — it's leaving an identity you've held for years. Being 'a nurse' has probably shaped how you see yourself and how others see you. That's worth grieving a little, and then celebrating properly. Don't skip the emotional processing to get to the business planning."</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ WELLBEING ═════════════════════════════════════════════════════════ */}
      {tab === "wellbeing" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Limits — Set Them Now</CardTitle>
                <CardDescription className="text-xs">Before the pressure of running a business sets them for you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Maximum clinic days per week (your firm limit)</Label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={6} value={plan.maxClinicDaysPerWeek} onChange={e => update({ maxClinicDaysPerWeek: parseInt(e.target.value) })} className="flex-1" />
                    <span className="text-sm font-semibold w-16 text-right">{plan.maxClinicDaysPerWeek} days max</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">This is a boundary, not a target. Even if you have appointments available.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">If Abi is sick — what happens to bookings?</Label>
                  <Textarea placeholder="e.g. Cancel with 24h notice, offer rescheduled same week. Build a 1-week buffer in the diary so rescheduling is easy. No locum — I'll absorb it." value={plan.sickCoverPlan} onChange={e => update({ sickCoverPlan: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Holiday plan — how will you handle being away?</Label>
                  <Textarea placeholder="e.g. Minimum 3 weeks off per year. Close the clinic fully — no locum in year 1. Communicate holiday dates to clients 6 weeks ahead. Summer holidays: 2 weeks off, not full 6 weeks." value={plan.holidayPlan} onChange={e => update({ holidayPlan: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Non-negotiables — what doesn't move for the clinic?</Label>
                  <Textarea placeholder="e.g. School sports day, parents' evenings, Christmas concert. Wednesdays are short days — home by 4pm. First week of school holidays always off." value={plan.nonNegotiables} onChange={e => update({ nonNegotiables: e.target.value })} className="min-h-[80px] text-sm resize-none" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sustainability Checklist</CardTitle>
                <CardDescription className="text-xs">The things most business owners only wish they'd sorted earlier</CardDescription>
              </CardHeader>
              <CardContent>
                <Checklist items={WELLBEING_CHECKS} checked={plan.wellbeingChecks} onChange={v => update({ wellbeingChecks: v })} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> The burnout pattern to avoid</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">Month 1–3: "I'll just take every booking I can get." Month 4: Exhausted, snapping at home, dreading Mondays. Month 6: Wondering if it was a mistake. The fix is simple but hard: protect your non-clinic days before you need to, not after.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ IDENTITY ══════════════════════════════════════════════════════════ */}
      {tab === "identity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">In Your Own Words</CardTitle>
                <CardDescription className="text-xs">Not the business case — the personal one</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">What are you most excited about?</Label>
                  <Textarea placeholder="Not the financial projections — what actually lights you up about this." value={plan.mostExcitedAbout} onChange={e => update({ mostExcitedAbout: e.target.value })} className="min-h-[90px] text-sm resize-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">What worries you most — honestly?</Label>
                  <Textarea placeholder="The fears you haven't said out loud yet. Naming them makes them smaller." value={plan.biggestConcerns} onChange={e => update({ biggestConcerns: e.target.value })} className="min-h-[90px] text-sm resize-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your support network — who's in your corner?</Label>
                  <Textarea placeholder="e.g. David — practical and emotional support. Mum — school run backup. Sarah (nurse friend) — peer support. Looking for: a business mentor or aesthetics practitioner peer group." value={plan.supportNetwork} onChange={e => update({ supportNetwork: e.target.value })} className="min-h-[90px] text-sm resize-none" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">The Identity Shift Checklist</CardTitle>
                <CardDescription className="text-xs">From "I'm a nurse who does aesthetics" to "I own an aesthetics clinic"</CardDescription>
              </CardHeader>
              <CardContent>
                <Checklist items={IDENTITY_CHECKS} checked={plan.identityChecks} onChange={v => update({ identityChecks: v })} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> The bigger picture</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">"In 12 months, Eli and Elsy will know you as the person who built something. That's a story you'll tell them about what's possible. The financial model matters — but this is what you're actually doing it for."</p>
              </CardContent>
            </Card>

            {plan.mostExcitedAbout && (
              <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Why you're doing this</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">"{plan.mostExcitedAbout}"</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
