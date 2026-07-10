import { Router } from "express";
import { db } from "@workspace/db";
import {
  staffRolesTable, workforceSettingsTable, financialsTable, projectsTable, lifestylePlanTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { claudeComplete } from "@workspace/integrations-anthropic-ai";

const router = Router();

export const ROLE_TYPES = ["clinician", "reception", "management", "support"] as const;
export const ROLE_STATUSES = ["planned", "recruiting", "onboarding", "active", "departed"] as const;

type Allocation = { fromMonth: string; bedhamptonDays: number; winchesterDays: number; chichesterDays: number };
type Trigger = { type: string; note?: string; occupancyPct?: number };

// Scenario ramp profiles (mirror ai.ts so demand matches the rest of the app).
const RAMP: Record<string, { startOcc: number; rampMonths: number; targetKey: string }> = {
  conservative: { startOcc: 20, rampMonths: 8, targetKey: "conservativeOccupancyPercent" },
  realistic: { startOcc: 25, rampMonths: 6, targetKey: "realisticOccupancyPercent" },
  aggressive: { startOcc: 35, rampMonths: 4, targetKey: "aggressiveOccupancyPercent" },
  delayed_ramp: { startOcc: 15, rampMonths: 12, targetKey: "realisticOccupancyPercent" },
  economic_downturn: { startOcc: 15, rampMonths: 9, targetKey: "conservativeOccupancyPercent" },
  stress_test: { startOcc: 5, rampMonths: 10, targetKey: "conservativeOccupancyPercent" },
};

// ── month helpers ───────────────────────────────────────────────────────────
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}
function keyFromIndex(idx: number): string {
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function addWeeks(key: string, weeks: number): string {
  // approximate: shift by whole months (weeks/4.345)
  return keyFromIndex(monthIndex(key) - Math.round(weeks / 4.345));
}
function labelMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ── settings (auto-create) ──────────────────────────────────────────────────
async function getSettings(projectId: number) {
  let [s] = await db.select().from(workforceSettingsTable).where(eq(workforceSettingsTable.projectId, projectId));
  if (!s) {
    [s] = await db.insert(workforceSettingsTable).values({ projectId }).returning();
  }
  return s;
}

// ── auto-seed the real phased roster on first use ────────────────────────────
async function seedRosterIfEmpty(projectId: number, openMonth: string) {
  const existing = await db.select().from(staffRolesTable).where(eq(staffRolesTable.projectId, projectId));
  if (existing.length > 0) return;

  const openIdx = monthIndex(openMonth);
  const M = (offset: number) => keyFromIndex(openIdx + offset);

  const rows = [
    {
      projectId, name: "Abi Peters", roleType: "clinician", status: "active", isOwner: true,
      startDate: monthKey(new Date()), leadTimeWeeks: 0, annualCostGbp: 0, sortOrder: 0,
      triggerJson: JSON.stringify({ type: "owner", note: "Founder — splits across sites as Winchester ramps" }),
      allocationsJson: JSON.stringify([
        { fromMonth: monthKey(new Date()), bedhamptonDays: 5, winchesterDays: 0, chichesterDays: 0 },
        { fromMonth: M(0), bedhamptonDays: 2, winchesterDays: 3, chichesterDays: 0 },
        { fromMonth: M(6), bedhamptonDays: 1, winchesterDays: 4, chichesterDays: 0 },
        { fromMonth: M(12), bedhamptonDays: 0, winchesterDays: 5, chichesterDays: 0 },
      ]),
      notes: "Anchors Winchester's brand from opening while tapering Bedhampton days as the second clinician takes over.",
    },
    {
      projectId, name: "Bedhampton Clinician (backfill)", roleType: "clinician", status: "planned",
      startDate: M(-1), leadTimeWeeks: 14, annualCostGbp: 42000, sortOrder: 1,
      triggerJson: JSON.stringify({ type: "before_open", note: "Recruit ~14 weeks before Winchester opens so they shadow Abi at Bedhampton first, then hold it as she splits her week." }),
      allocationsJson: JSON.stringify([
        { fromMonth: M(-1), bedhamptonDays: 0, winchesterDays: 0, chichesterDays: 0 },
        { fromMonth: M(0), bedhamptonDays: 3, winchesterDays: 0, chichesterDays: 0 },
        { fromMonth: M(6), bedhamptonDays: 4, winchesterDays: 0, chichesterDays: 0 },
        { fromMonth: M(12), bedhamptonDays: 5, winchesterDays: 0, chichesterDays: 0 },
      ]),
      notes: "The mitigation for risk R014 (Abi as sole clinician). Overlap/shadow month protects the 290+ review reputation and the £10k/mo Bedhampton cash engine.",
    },
    {
      projectId, name: "Receptionist", roleType: "reception", status: "planned",
      startDate: M(5), leadTimeWeeks: 6, annualCostGbp: 24000, sortOrder: 2,
      triggerJson: JSON.stringify({ type: "winchester_occupancy", occupancyPct: 45, note: "Bring in when Winchester crosses ~45% occupancy and front-desk admin outgrows what a clinician should do between clients." }),
      allocationsJson: JSON.stringify([{ fromMonth: M(5), bedhamptonDays: 0, winchesterDays: 5, chichesterDays: 0 }]),
      notes: "Trigger is volume, not a fixed date — the date shown is the current estimate from the ramp.",
    },
    {
      projectId, name: "Clinic Manager", roleType: "management", status: "planned",
      startDate: M(12), leadTimeWeeks: 8, annualCostGbp: 34000, sortOrder: 3,
      triggerJson: JSON.stringify({ type: "team_size", note: "Once you're two clinicians + reception across two sites, someone other than Abi should own rotas, stock, compliance and HR." }),
      allocationsJson: JSON.stringify([{ fromMonth: M(12), bedhamptonDays: 0, winchesterDays: 5, chichesterDays: 0 }]),
      notes: "May be pulled forward by the Chichester move.",
    },
    {
      projectId, name: "Second Winchester Clinician", roleType: "clinician", status: "planned",
      startDate: M(11), leadTimeWeeks: 14, annualCostGbp: 42000, sortOrder: 4,
      triggerJson: JSON.stringify({ type: "winchester_occupancy", occupancyPct: 80, note: "When Abi's Winchester days are ~80%+ booked and you're turning clients away — the second treatment room earns out." }),
      allocationsJson: JSON.stringify([{ fromMonth: M(11), bedhamptonDays: 0, winchesterDays: 3, chichesterDays: 0 }]),
      notes: "Depends on Winchester having 2 usable treatment rooms.",
    },
  ];
  await db.insert(staffRolesTable).values(rows);
}

// ── compensation / offer engine ─────────────────────────────────────────────
export const PAY_MODELS = ["employed", "day_rate", "revenue_share", "net_profit_share", "hybrid"] as const;

type PayParams = {
  salaryFteGbp?: number; oncostPct?: number; dayRateGbp?: number;
  revSharePct?: number; baseRetainerMonthlyGbp?: number;
  // A paid but NON-BILLABLE ramp: months from her start spent training / shadowing
  // (generating £0) before she bills, plus one-off training-course fees, plus a
  // stipend that keeps a %-share clinician paid while she can't yet bill.
  trainingMonths?: number; trainingCostGbp?: number; trainingStipendMonthlyGbp?: number;
};

function payDefaults(role: { annualCostGbp: number; payJson: string }): Required<PayParams> {
  const p: PayParams = JSON.parse(role.payJson || "{}");
  const salary = p.salaryFteGbp ?? (role.annualCostGbp || 38000);
  return {
    salaryFteGbp: salary,
    oncostPct: p.oncostPct ?? 15,
    dayRateGbp: p.dayRateGbp ?? Math.round(salary / 220 / 10) * 10, // ~220 working days/yr
    revSharePct: p.revSharePct ?? 45,
    baseRetainerMonthlyGbp: p.baseRetainerMonthlyGbp ?? 800,
    trainingMonths: p.trainingMonths ?? 0,
    trainingCostGbp: p.trainingCostGbp ?? 0,
    trainingStipendMonthlyGbp: p.trainingStipendMonthlyGbp ?? 1500,
  };
}

// Revenue a clinician generates per working day at a site.
function revPerDay(site: "bedhampton" | "winchester" | "chichester", occPct: number, fin: {
  bedRevPerDay: number; winMatureRevPerDay: number; targetOcc: number;
}) {
  if (site === "bedhampton" || site === "chichester") return fin.bedRevPerDay;
  // Winchester scales with occupancy up to its mature rate
  return Math.round(fin.winMatureRevPerDay * Math.min(1, occPct / fin.targetOcc));
}

function grossPayMonthly(model: string, pp: Required<PayParams>, totalDays: number, monthlyRevenue: number, monthlyNetProfit: number, inTraining: boolean): number {
  const wk = 4.345;
  // A %-share clinician can't live on a share of £0 while training — pay the stipend.
  if (inTraining && (model === "revenue_share" || model === "net_profit_share")) {
    return Math.round(pp.trainingStipendMonthlyGbp);
  }
  switch (model) {
    case "day_rate": return Math.round(totalDays * wk * pp.dayRateGbp);
    case "revenue_share": return Math.round(monthlyRevenue * pp.revSharePct / 100);
    case "net_profit_share": return Math.round(monthlyNetProfit * pp.revSharePct / 100);
    case "hybrid": return Math.round(pp.baseRetainerMonthlyGbp + monthlyRevenue * pp.revSharePct / 100);
    case "employed":
    default: return Math.round((pp.salaryFteGbp / 12) * Math.min(1, totalDays / 5));
  }
}

function loadedCostMonthly(model: string, gross: number, pp: Required<PayParams>): number {
  // Employer on-costs (NI, pension, levy) only apply to employed engagements.
  return model === "employed" ? Math.round(gross * (1 + pp.oncostPct / 100)) : gross;
}

function computeCompensation(
  role: { annualCostGbp: number; payJson: string; payModel: string; allocationsJson: string; roleType: string; isOwner: boolean; startDate: string | null },
  fin: { bedRevPerDay: number; winMatureRevPerDay: number; targetOcc: number; stockPct: number },
  occByMonth: Map<number, number>,
) {
  const pp = payDefaults(role);
  const segs: Allocation[] = JSON.parse(role.allocationsJson || "[]");
  const isClinician = role.roleType === "clinician";
  // Non-billable training/shadowing window: [start, start + trainingMonths)
  const startIdx = role.startDate ? monthIndex(role.startDate) : (segs[0] ? monthIndex(segs[0].fromMonth) : null);
  const trainingEndIdx = startIdx != null ? startIdx + pp.trainingMonths : null;

  const phases = segs.map(a => {
    const mIdx = monthIndex(a.fromMonth);
    const occ = occByMonth.get(mIdx) ?? 0;
    const inTraining = trainingEndIdx != null && mIdx < trainingEndIdx;
    const totalDays = a.bedhamptonDays + a.winchesterDays + a.chichesterDays;
    // During training she's on-site but shadowing/learning — she doesn't bill.
    const revenue = (!isClinician || inTraining) ? 0 : Math.round(
      (a.bedhamptonDays * revPerDay("bedhampton", occ, fin)
        + a.winchesterDays * revPerDay("winchester", occ, fin)
        + a.chichesterDays * revPerDay("chichester", occ, fin)) * 4.345,
    );
    const stock = Math.round(revenue * fin.stockPct / 100);
    const netProfit = revenue - stock; // treatment net (after consumables/POMs)
    const gross = grossPayMonthly(role.payModel, pp, totalDays, revenue, netProfit, inTraining);
    const loaded = loadedCostMonthly(role.payModel, gross, pp);
    const site = a.chichesterDays > 0 ? "Chichester" : a.winchesterDays > 0 && a.bedhamptonDays > 0 ? "Bed + Winchester"
      : a.winchesterDays > 0 ? "Winchester" : a.bedhamptonDays > 0 ? "Bedhampton" : "—";
    return {
      fromMonth: a.fromMonth, label: labelMonth(a.fromMonth),
      totalDays, site, training: inTraining,
      monthlyRevenue: revenue, monthlyGrossPay: gross, monthlyLoadedCost: loaded,
      monthlyStock: stock, monthlyContribution: revenue - loaded - stock,
      annualGrossPay: gross * 12,
    };
  });

  // Full-time steady state = the busiest PRODUCTIVE (non-training) phase; drives
  // the headline + 4-model comparison. On ties prefer the latest (destination site).
  const productive = phases.filter(p => !p.training);
  const ftPool = productive.length ? productive : phases;
  const ft = ftPool.reduce((best, p) => (p.totalDays >= (best?.totalDays ?? -1) ? p : best), ftPool[0]);

  // Cost of the training window before she brings in a penny (salary+on-costs
  // over the non-billable months, plus one-off course fees).
  const trainingPhases = phases.filter(p => p.training);
  const trainingSalaryCost = trainingPhases.reduce((s, p) => s + p.monthlyLoadedCost, 0)
    + Math.max(0, (pp.trainingMonths - trainingPhases.length)) * (ft ? loadedCostMonthly(role.payModel, grossPayMonthly(role.payModel, pp, ft.totalDays, 0, 0, true), pp) : 0);
  const investmentBeforeProductive = Math.round(trainingSalaryCost + pp.trainingCostGbp);

  const ftNet = ft ? ft.monthlyRevenue - Math.round(ft.monthlyRevenue * fin.stockPct / 100) : 0;
  const comparison = isClinician && ft ? PAY_MODELS.map(m => {
    const gross = grossPayMonthly(m, pp, ft.totalDays, ft.monthlyRevenue, ftNet, false);
    const loaded = loadedCostMonthly(m, gross, pp);
    const stock = Math.round(ft.monthlyRevenue * fin.stockPct / 100);
    return {
      model: m,
      monthlyGrossPay: gross, annualGrossPay: gross * 12,
      monthlyLoadedCost: loaded,
      monthlyContribution: ft.monthlyRevenue - loaded - stock,
    };
  }) : [];

  return {
    payModel: role.payModel, params: pp, phases, comparison,
    trainingMonths: pp.trainingMonths, trainingCostGbp: pp.trainingCostGbp,
    investmentBeforeProductive,
    fullTime: ft ? { label: ft.label, days: ft.totalDays, site: ft.site, monthlyRevenue: ft.monthlyRevenue, monthlyGrossPay: ft.monthlyGrossPay, monthlyLoadedCost: ft.monthlyLoadedCost, monthlyContribution: ft.monthlyContribution } : null,
    paysForHerself: ft ? (ft.monthlyContribution >= 0) : null,
  };
}

// ── capacity vs demand engine ────────────────────────────────────────────────
function allocationFor(role: { allocationsJson: string }, mIdx: number): Allocation | null {
  const segs: Allocation[] = JSON.parse(role.allocationsJson || "[]");
  let current: Allocation | null = null;
  for (const s of segs) {
    if (monthIndex(s.fromMonth) <= mIdx) current = s;
  }
  return current;
}

async function buildAnalysis(projectId: number) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [financial] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  const openMonth = project?.targetOpeningDate ? monthKey(new Date(project.targetOpeningDate)) : keyFromIndex(monthIndex(monthKey(new Date())) + 4);
  const settings = await getSettings(projectId);
  await seedRosterIfEmpty(projectId, openMonth);
  const roles = await db.select().from(staffRolesTable).where(eq(staffRolesTable.projectId, projectId)).orderBy(asc(staffRolesTable.sortOrder));

  const scenario = financial?.selectedScenario ?? "delayed_ramp";
  const prof = RAMP[scenario] ?? RAMP.delayed_ramp;
  const targetOcc = Number((financial as Record<string, unknown> | undefined)?.[prof.targetKey] ?? 70);
  const rooms = settings.winchesterRooms;
  const fullDays = settings.fullSiteDaysPerWeek;
  const openIdx = monthIndex(openMonth);
  const chichesterIdx = settings.chichesterMoveMonth ? monthIndex(settings.chichesterMoveMonth) : null;

  const startIdx = monthIndex(monthKey(new Date()));
  const months: string[] = [];
  for (let i = 0; i < 24; i++) months.push(keyFromIndex(startIdx + i));

  const series = months.map(mk => {
    const mIdx = monthIndex(mk);

    // ── demand (clinician-days/week needed) ──
    const monthsOpen = mIdx - openIdx;
    const occ = monthsOpen < 0 ? 0
      : Math.min(targetOcc, prof.startOcc + (targetOcc - prof.startOcc) * (monthsOpen / prof.rampMonths));
    const winDemand = Math.round((occ / 100) * rooms * fullDays * 10) / 10;

    const moved = chichesterIdx != null && mIdx >= chichesterIdx;
    const bedDemand = moved ? 0 : settings.bedhamptonDaysNeeded;
    const chiDemand = moved ? settings.bedhamptonDaysNeeded : 0;

    // ── capacity from active/planned roles ──
    let bedCap = 0, winCap = 0, chiCap = 0;
    for (const r of roles) {
      if (r.roleType !== "clinician") continue;
      // planned roles contribute from their startDate (that's the plan being shown)
      if (r.startDate && monthIndex(r.startDate) > mIdx) continue;
      const a = allocationFor(r, mIdx);
      if (!a) continue;
      bedCap += a.bedhamptonDays; winCap += a.winchesterDays; chiCap += a.chichesterDays;
    }

    return {
      month: mk,
      label: labelMonth(mk),
      occupancyPct: Math.round(occ),
      bedhampton: { demand: bedDemand, capacity: bedCap, gap: Math.round((bedCap - bedDemand) * 10) / 10 },
      winchester: { demand: winDemand, capacity: winCap, gap: Math.round((winCap - winDemand) * 10) / 10 },
      chichester: { demand: chiDemand, capacity: chiCap, gap: Math.round((chiCap - chiDemand) * 10) / 10 },
    };
  });

  // Monthly staffing cost over time (planned roles counted from start)
  const costSeries = months.map(mk => {
    const mIdx = monthIndex(mk);
    let monthly = 0;
    for (const r of roles) {
      if (r.isOwner) continue;
      if (r.startDate && monthIndex(r.startDate) > mIdx) continue;
      if (r.status === "departed") continue;
      monthly += (r.annualCostGbp || 0) / 12;
    }
    return { month: mk, label: labelMonth(mk), monthlyStaffCost: Math.round(monthly) };
  });

  // Revenue-per-clinician-day basis for the compensation/offer engine.
  const f = financial as Record<string, unknown> | undefined;
  const existingRev = Number(f?.existingClinicRevenueGbp ?? 10000) || 10000;
  const bedDays = settings.bedhamptonDaysNeeded || 5;
  const bedRevPerDay = Math.round(existingRev / (bedDays * 4.345));
  const bedAcv = Number(f?.averageClientValueGbp ?? 120) || 120;
  const wincAcv = Number(f?.wincAcvGbp ?? 0) || bedAcv;
  const winMatureRevPerDay = Math.round(bedRevPerDay * (wincAcv / bedAcv));
  const stockPct = Number(f?.stockPercent ?? 25) || 25;
  const fin = { bedRevPerDay, winMatureRevPerDay, targetOcc, stockPct };

  return { series, costSeries, roles, settings, openMonth, scenario, targetOcc, rooms, fin };
}

// ── triggers: which hires are due to start now ───────────────────────────────
function computeTriggers(roles: { id: number; name: string; status: string; startDate: string | null; leadTimeWeeks: number; triggerJson: string; roleType: string }[]) {
  const now = monthKey(new Date());
  const nowIdx = monthIndex(now);
  const alerts: { roleId: number; name: string; recruitByMonth: string; startMonth: string | null; overdue: boolean; weeksUntil: number; message: string; rationale?: string }[] = [];
  for (const r of roles) {
    if (!["planned", "recruiting"].includes(r.status)) continue;
    if (!r.startDate) continue;
    const recruitBy = addWeeks(r.startDate, r.leadTimeWeeks);
    const recruitIdx = monthIndex(recruitBy);
    const due = recruitIdx <= nowIdx;
    if (!due) continue; // only surface hires it's time to act on
    const trig: Trigger = JSON.parse(r.triggerJson || "{}");
    alerts.push({
      roleId: r.id,
      name: r.name,
      recruitByMonth: recruitBy,
      startMonth: r.startDate,
      overdue: recruitIdx < nowIdx,
      weeksUntil: Math.round((recruitIdx - nowIdx) * 4.345),
      message: recruitIdx < nowIdx
        ? `Recruitment for ${r.name} should already be under way — target start ${labelMonth(r.startDate)}.`
        : `Time to start recruiting ${r.name} — needs ~${r.leadTimeWeeks} weeks to start by ${labelMonth(r.startDate)}.`,
      rationale: trig.note,
    });
  }
  return alerts;
}

// ── endpoints ────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/workforce", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const analysis = await buildAnalysis(projectId);
  const triggers = computeTriggers(analysis.roles);
  const occByMonth = new Map<number, number>();
  for (const s of analysis.series) occByMonth.set(monthIndex(s.month), s.occupancyPct);
  res.json({
    ...analysis,
    triggers,
    roles: analysis.roles.map(r => ({
      ...r,
      allocations: JSON.parse(r.allocationsJson || "[]"),
      trigger: JSON.parse(r.triggerJson || "{}"),
      pay: JSON.parse(r.payJson || "{}"),
      intake: JSON.parse(r.intakeJson || "{}"),
      readinessPlan: r.readinessPlan ?? null,
      packagePlan: r.packagePlan ?? null,
      compensation: computeCompensation(r, analysis.fin, occByMonth),
    })),
    roleTypes: ROLE_TYPES,
    roleStatuses: ROLE_STATUSES,
    payModels: PAY_MODELS,
  });
});

// lightweight triggers-only feed for Today / digest
router.get("/projects/:projectId/workforce/triggers", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const roles = await db.select().from(staffRolesTable).where(eq(staffRolesTable.projectId, projectId));
  res.json({ triggers: computeTriggers(roles) });
});

router.post("/projects/:projectId/staff-roles", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const b = req.body as Partial<{ name: string; roleType: string; status: string; startDate: string; leadTimeWeeks: number; annualCostGbp: number; allocations: Allocation[]; trigger: Trigger; notes: string; sortOrder: number }>;
  if (!b.name?.trim()) return res.status(400).json({ error: "name is required." });
  const [row] = await db.insert(staffRolesTable).values({
    projectId, name: b.name.trim(),
    roleType: b.roleType ?? "clinician",
    status: b.status ?? "planned",
    startDate: b.startDate ?? null,
    leadTimeWeeks: b.leadTimeWeeks ?? 12,
    annualCostGbp: b.annualCostGbp ?? 0,
    allocationsJson: JSON.stringify(b.allocations ?? []),
    triggerJson: JSON.stringify(b.trigger ?? {}),
    notes: b.notes ?? "",
    sortOrder: b.sortOrder ?? 99,
  }).returning();
  res.json(row);
});

router.patch("/staff-roles/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["name", "roleType", "status", "startDate", "leadTimeWeeks", "annualCostGbp", "notes", "sortOrder", "payModel"]) {
    if (k in b) patch[k] = b[k];
  }
  if ("allocations" in b) patch.allocationsJson = JSON.stringify(b.allocations);
  if ("trigger" in b) patch.triggerJson = JSON.stringify(b.trigger);
  if ("pay" in b) patch.payJson = JSON.stringify(b.pay);
  if ("intake" in b) patch.intakeJson = JSON.stringify(b.intake);
  const [row] = await db.update(staffRolesTable).set(patch).where(eq(staffRolesTable.id, id)).returning();
  res.json(row);
});

router.delete("/staff-roles/:id", async (req, res) => {
  await db.delete(staffRolesTable).where(eq(staffRolesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.patch("/projects/:projectId/workforce-settings", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  await getSettings(projectId);
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["chichesterMoveMonth", "winchesterRooms", "bedhamptonDaysNeeded", "fullSiteDaysPerWeek", "planNarrative"]) {
    if (k in b) patch[k] = b[k];
  }
  const [row] = await db.update(workforceSettingsTable).set(patch).where(eq(workforceSettingsTable.projectId, projectId)).returning();
  res.json(row);
});

// ── AI workforce planner ─────────────────────────────────────────────────────
router.post("/projects/:projectId/workforce/ai-plan", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [financial] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  const [lifestyle] = await db.select().from(lifestylePlanTable).where(eq(lifestylePlanTable.projectId, projectId));
  const settings = await getSettings(projectId);
  const roles = await db.select().from(staffRolesTable).where(eq(staffRolesTable.projectId, projectId));

  const ctx = {
    winchesterOpen: project?.targetOpeningDate,
    scenario: financial?.selectedScenario,
    bedhamptonMonthlyRevenueGbp: financial?.existingClinicRevenueGbp,
    winchesterAcvGbp: (financial as Record<string, unknown> | undefined)?.wincAcvGbp,
    winchesterRooms: settings.winchesterRooms,
    abiNursingExit: lifestyle?.targetExitDate,
    abiClinicDays: lifestyle?.clinicDays,
    chichesterMoveMonth: settings.chichesterMoveMonth,
    currentRoster: roles.map(r => ({ name: r.name, roleType: r.roleType, status: r.status, startDate: r.startDate })),
    today: new Date().toISOString().slice(0, 10),
  };

  const prompt = `You are a workforce planner for a two-site nurse-led aesthetics clinic business (Abi Peters Aesthetics). Context (JSON):
${JSON.stringify(ctx, null, 1)}

The strategic problem: Abi is currently the ONLY clinician. Bedhampton (the existing clinic, ~£${ctx.bedhamptonMonthlyRevenueGbp}/mo) is the cash engine and must never lose coverage. Winchester opens soon but ramps slowly (cold start). We must phase: keep Bedhampton fully covered, bring Abi to Winchester to anchor its brand, backfill Bedhampton with a second clinician (recruited early and shadowed in), then add a receptionist, a clinic manager, and a second Winchester clinician as volume justifies — and eventually relocate Bedhampton to Chichester once the workforce is stable.

Produce a phased workforce plan. Every hire must be justified by a capacity/cash trigger, not a guessed date. Allocations are in clinician-DAYS-PER-WEEK per site. Use month keys "YYYY-MM".

Return ONLY valid JSON:
{
  "narrative": "6-10 sentence plain-English plan for the owners: the sequence, why, and the single most urgent action right now",
  "roles": [
    { "name": "", "roleType": "clinician|reception|management|support", "status": "active|planned",
      "startDate": "YYYY-MM", "leadTimeWeeks": <int>, "annualCostGbp": <int>,
      "trigger": { "type": "before_open|winchester_occupancy|team_size|date|owner", "occupancyPct": <int optional>, "note": "why this timing" },
      "allocations": [ { "fromMonth": "YYYY-MM", "bedhamptonDays": <0-5>, "winchesterDays": <0-5>, "chichesterDays": <0-5> } ],
      "notes": "" }
  ],
  "chichesterMoveMonth": "YYYY-MM or null",
  "keyRisks": ["..."]
}`;

  try {
    const raw = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 8000, jsonOnly: true });
    const plan = JSON.parse(raw);
    res.json({ plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Planning failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// Replace the roster with an AI (or edited) plan
router.post("/projects/:projectId/workforce/apply-plan", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { roles, chichesterMoveMonth, narrative } = req.body as {
    roles: Array<{ name: string; roleType?: string; status?: string; startDate?: string; leadTimeWeeks?: number; annualCostGbp?: number; trigger?: Trigger; allocations?: Allocation[]; notes?: string }>;
    chichesterMoveMonth?: string | null; narrative?: string;
  };
  if (!Array.isArray(roles) || roles.length === 0) return res.status(400).json({ error: "roles are required." });

  await db.delete(staffRolesTable).where(eq(staffRolesTable.projectId, projectId));
  await db.insert(staffRolesTable).values(roles.map((r, i) => ({
    projectId, name: r.name,
    roleType: r.roleType ?? "clinician",
    status: r.status ?? "planned",
    isOwner: /abi/i.test(r.name),
    startDate: r.startDate ?? null,
    leadTimeWeeks: r.leadTimeWeeks ?? 12,
    annualCostGbp: r.annualCostGbp ?? 0,
    triggerJson: JSON.stringify(r.trigger ?? {}),
    allocationsJson: JSON.stringify(r.allocations ?? []),
    notes: r.notes ?? "",
    sortOrder: i,
  })));
  await getSettings(projectId);
  await db.update(workforceSettingsTable)
    .set({ chichesterMoveMonth: chichesterMoveMonth ?? null, planNarrative: narrative ?? null, updatedAt: new Date() })
    .where(eq(workforceSettingsTable.projectId, projectId));
  res.json({ ok: true });
});

// ── AI practitioner readiness & onboarding plan ──────────────────────────────
router.post("/staff-roles/:id/readiness-plan", async (req, res) => {
  const id = parseInt(req.params.id);
  const [role] = await db.select().from(staffRolesTable).where(eq(staffRolesTable.id, id));
  if (!role) return res.status(404).json({ error: "Role not found." });

  const intake = JSON.parse(role.intakeJson || "{}") as {
    registration?: string; isPrescriber?: boolean; scope?: string[];
    readyBy?: string; currentTraining?: string; notes?: string;
  };
  if (!intake.registration && !intake.scope?.length) {
    return res.status(400).json({ error: "Fill in the practitioner's registration and scope first." });
  }

  const analysis = await buildAnalysis(role.projectId);
  const occByMonth = new Map<number, number>();
  for (const s of analysis.series) occByMonth.set(monthIndex(s.month), s.occupancyPct);
  const comp = computeCompensation(role, analysis.fin, occByMonth);

  const bedRevMonthly = Math.round(analysis.fin.bedRevPerDay * (analysis.settings.bedhamptonDaysNeeded || 5) * 4.345);
  const prompt = `You are an experienced, straight-talking UK medical-aesthetics clinic operator and compliance adviser. The clinic is Abi Peters Aesthetics; the owner-clinician is Abi. Branding is "MEDICALLY-LED". CQC-regulated activities are planned. The owner is bringing on a new practitioner ("she") to hold the Bedhampton clinic so Abi can move to a new Winchester site; the Bedhampton clinic later relocates to Chichester (${analysis.settings.chichesterMoveMonth ?? "2028"}).

THE PRACTITIONER (from the owner's intake — treat as fact, do not contradict):
- Professional registration: ${intake.registration || "not stated"}
- Independent prescriber: ${intake.isPrescriber ? "Yes — HCPC independent prescriber" : "No / not stated"}
- Intended scope (what she'll deliver): ${(intake.scope || []).join(", ") || "not stated"}
- Aesthetics training/experience she ALREADY holds: ${intake.currentTraining?.trim() || "NONE / not provided"}
- Must be seeing clients UNSUPERVISED by: ${intake.readyBy || "mid-October 2026"}
- Other notes: ${intake.notes || "none"}

THE MONEY (already computed — cite, don't recompute):
- Bedhampton currently turns over ~£${bedRevMonthly.toLocaleString()}/mo, generated by Abi. It is the cash engine funding this whole transition.
- Planned package for her: ${role.payModel}, indicative ~£${comp.fullTime ? comp.fullTime.monthlyGrossPay.toLocaleString() : "?"}/mo once fully productive.
- Non-billable training/shadowing window in the plan: ${comp.trainingMonths} month(s); one-off training-course budget £${(comp.trainingCostGbp || 0).toLocaleString()}.
- Estimated cost to carry her BEFORE she bills a penny (salary + on-costs through the non-billable months + course fees): ~£${(comp.investmentBeforeProductive || 0).toLocaleString()}.

CRITICAL CONTEXT you must reason about honestly:
- She is an independent prescriber but may be NEWLY qualified with little/no aesthetic prescribing history, and may have ZERO prior aesthetics injecting/skin experience. If her held training is "NONE", she is a competent healthcare professional and prescriber but an AESTHETICS NOVICE — she needs the FULL foundation-to-advanced training pathway AND supervised clinical hours to competency, not a top-up. Do not pretend a novice can be solo across a full injectables + skin menu in a few weeks.
- "MEDICALLY-LED" branding: a paramedic independent prescriber is a registered healthcare professional and a prescriber, which supports a medically-led/prescriber-led positioning — but CONFIRM how you word it, because "medically-led" can imply doctor-led to the public and the ASA/consumers; note the distinction.

Produce a practical READINESS & ONBOARDING PLAN. Plain text, UK conventions, ALL-CAPS section headings, dated working BACK from the ready-by date. Use "CONFIRM:" for anything regulatory that must be verified rather than asserted. Sections:
1. SCOPE & REGULATORY POSITION — what she can deliver and prescribe as an HCPC paramedic IP; CONFIRM items (paramedic-IP prescribing of the specific aesthetic POMs incl. toxin/hyaluronidase — paramedic IPs cannot prescribe controlled drugs, but these are POMs not CDs; pharmacy willingness to supply against a paramedic prescription; newly-qualified-prescriber governance/mentoring); the medically-led branding wording point.
2. TRAINING PATHWAY FROM HER ACTUAL STARTING POINT — given what she already holds (${intake.currentTraining?.trim() ? "as stated above" : "NONE"}), the specific accredited training she needs, in sequence, with realistic durations: foundation toxin & filler, then advanced/full-face, skin (microneedling/peels/boosters), complications incl. hyaluronidase & vascular occlusion, BLS/anaphylaxis, safeguarding. Then the supervised clinical hours / logged cases to competency before solo. Be honest about elapsed weeks.
3. REGISTRATIONS & INSURANCE — HCPC IP annotation check, aesthetic indemnity for a paramedic (and whether insurers require X supervised cases first), adding her to clinic cover, JCCP/Save Face, DBS, references.
4. CLINIC ONBOARDING — SOPs, pharmacy/prescribing governance for a new prescriber, records/consent, and the SUPERVISION plan while she builds (who supervises — Abi? — and how that works once Abi is at Winchester).
5. THE PACKAGE & HOW BEDHAMPTON FUNDS IT — reason explicitly: during her training/shadowing months she is PAID but generates ~£0, while Abi is still generating the ~£${bedRevMonthly.toLocaleString()}/mo Bedhampton income. So Bedhampton must carry BOTH Abi's presence and her salary + course fees (~£${(comp.investmentBeforeProductive || 0).toLocaleString()} before she bills). State whether that is affordable from Bedhampton's ~£${bedRevMonthly.toLocaleString()}/mo, and recommend the fairest package STRUCTURE for a trainee-to-productive clinician (e.g. lower base during training rising on competency sign-off; employed vs self-employed given she can't be genuinely self-employed while supervised & non-billing; a revenue-share once solo). Give concrete figures.
6. ONBOARDING TIMELINE — a back-planned checklist from today to ${intake.readyBy || "mid-October 2026"} with rough dates.
7. WHAT I NEED FROM YOU — 4-6 specific remaining questions.

End with a blunt one-line VERDICT on whether "${intake.readyBy || "mid-October 2026"}" is realistic for HER starting point — and if not, the earliest realistic solo date and/or a reduced initial scope (e.g. toxin-only first) that WOULD be safe by then.`;

  try {
    const text = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 6000 });
    await db.update(staffRolesTable).set({ readinessPlan: text, updatedAt: new Date() }).where(eq(staffRolesTable.id, id));
    res.json({ plan: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Plan generation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ── AI-curated pay/package recommendation ────────────────────────────────────
router.post("/staff-roles/:id/recommend-package", async (req, res) => {
  const id = parseInt(req.params.id);
  const [role] = await db.select().from(staffRolesTable).where(eq(staffRolesTable.id, id));
  if (!role) return res.status(404).json({ error: "Role not found." });

  const intake = JSON.parse(role.intakeJson || "{}") as {
    registration?: string; isPrescriber?: boolean; scope?: string[]; readyBy?: string;
    currentTraining?: string; notes?: string;
    packagePrefs?: { exclusivity?: string; whosePatients?: string; herPreference?: string; businessPriority?: string; clawback?: string };
  };

  const analysis = await buildAnalysis(role.projectId);
  const occByMonth = new Map<number, number>();
  for (const s of analysis.series) occByMonth.set(monthIndex(s.month), s.occupancyPct);
  const comp = computeCompensation(role, analysis.fin, occByMonth);
  const bedRevMonthly = Math.round(analysis.fin.bedRevPerDay * (analysis.settings.bedhamptonDaysNeeded || 5) * 4.345);
  const netProfitMonthly = Math.round(bedRevMonthly * (1 - analysis.fin.stockPct / 100));
  const prefs = intake.packagePrefs || {};

  const modelSummary = comp.comparison.map(m =>
    `- ${m.model}: she earns ~£${m.annualGrossPay.toLocaleString()}/yr, business keeps ~£${m.monthlyContribution.toLocaleString()}/mo at full time.`,
  ).join("\n");

  const prompt = `You are a straight-talking UK aesthetics-clinic operator and remuneration adviser. Curate ONE recommended pay/package for a specific clinician — do not present a menu, make the call and justify it. The owner is overwhelmed by options; give a clear recommendation in plain English.

THE CLINICIAN & SITUATION:
- ${role.name}. Registration: ${intake.registration || "?"}; independent prescriber: ${intake.isPrescriber ? "yes (newly qualified)" : "no"}. Aesthetics experience: ${intake.currentTraining?.trim() || "NONE — novice, needs full training"}.
- She holds the Bedhampton clinic as Abi moves to Winchester, then relocates to Chichester (${analysis.settings.chichesterMoveMonth ?? "2028"}). Branding: medically-led.
- Needs to be client-facing by ${intake.readyBy || "mid-Oct 2026"} (readiness plan says full-menu-solo by then is unrealistic for a novice; a reduced scope is).

THE OWNER'S ANSWERS (decisive — weight these heavily):
- Her commitment: ${prefs.exclusivity || "not stated"}
- Whose patients she works: ${prefs.whosePatients || "not stated"}
- What she'd value: ${prefs.herPreference || "not stated"}
- The business's priority: ${prefs.businessPriority || "not stated"}
- Training clawback wanted: ${prefs.clawback || "yes — repay training pro-rata if she leaves within a set period"}

THE ECONOMICS (already computed — cite, don't recompute):
- Bedhampton turns over ~£${bedRevMonthly.toLocaleString()}/mo; net profit after consumables ~£${netProfitMonthly.toLocaleString()}/mo. This is the existing book Abi built.
- Cost to carry her through the ${comp.trainingMonths}-month non-billable training window: ~£${(comp.investmentBeforeProductive || 0).toLocaleString()} (incl. £${(comp.trainingCostGbp || 0).toLocaleString()} course fees).
- For reference, at full time each pay model would give roughly:
${modelSummary}

REASON IT THROUGH HONESTLY, then RECOMMEND:
- Employment status: if she works OUR existing book, is full-time-with-us and trained by us, she is EMPLOYED — a self-employed profit-share is not defensible (CONFIRM with accountant). Say so plainly.
- Because she works the existing book (Abi's goodwill), she should NOT get a big share of revenue she didn't create. But the owner wants to INCENTIVISE GROWTH. Square this: a fair structure is an employed BASE (covers running the existing book) PLUS a growth bonus — a share of net profit ABOVE the current ~£${netProfitMonthly.toLocaleString()}/mo baseline (so she's rewarded only for growing the site beyond what it already does).
- Training period: a lower training salary while non-billable and learning, stepping up to full base on competency sign-off. Training costs paid by the clinic under a TRAINING AGREEMENT with pro-rata clawback if she leaves within N years.
- Show her a SECURE view and an UPSIDE view of the same structure (base is the secure floor; growth bonus is the upside) since the owner is unsure what she'd prefer.

Return PLAIN TEXT with these sections:
1. THE RECOMMENDATION IN ONE LINE.
2. WHY THIS (not the others) — 3-4 sentences on status, whose-book, and incentive.
3. THE NUMBERS — training-period pay, base after sign-off, the growth-bonus formula with an illustrative figure at the current baseline and at +20% growth; what she'd earn secure vs with upside; what it costs/keeps the business.
4. THE TRAINING AGREEMENT & CLAWBACK — plain-English clause the owner can give an accountant/solicitor (amount, taper, trigger).
5. WATCH-OUTS — status/IR35 (CONFIRM with accountant), and one thing to negotiate.`;

  try {
    const text = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 5000 });
    await db.update(staffRolesTable).set({ packagePlan: text, updatedAt: new Date() }).where(eq(staffRolesTable.id, id));
    res.json({ plan: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Recommendation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ── AI draft offer / heads of terms for a role ───────────────────────────────
router.post("/staff-roles/:id/draft-offer", async (req, res) => {
  const id = parseInt(req.params.id);
  const [role] = await db.select().from(staffRolesTable).where(eq(staffRolesTable.id, id));
  if (!role) return res.status(404).json({ error: "Role not found." });

  const analysis = await buildAnalysis(role.projectId);
  const occByMonth = new Map<number, number>();
  for (const s of analysis.series) occByMonth.set(monthIndex(s.month), s.occupancyPct);
  const comp = computeCompensation(role, analysis.fin, occByMonth);
  const settings = analysis.settings;

  const intakeO = JSON.parse(role.intakeJson || "{}") as { currentTraining?: string; registration?: string; isPrescriber?: boolean };
  const phaseLines = comp.phases.map(p =>
    `- From ${p.label}: ${p.totalDays} days/week at ${p.site}${p.training ? " [TRAINING/SHADOWING — non-billable]" : ""}. She generates ~£${p.monthlyRevenue.toLocaleString()}/mo; she earns ~£${p.monthlyGrossPay.toLocaleString()}/mo; cost to the business ~£${p.monthlyLoadedCost.toLocaleString()}/mo; contribution ~£${p.monthlyContribution.toLocaleString()}/mo.`,
  ).join("\n");
  const trainingContext = comp.trainingMonths > 0
    ? `\nIMPORTANT — she starts with a ${comp.trainingMonths}-month PAID training/shadowing period during which she generates £0 (she is learning and shadowing Abi). Registration: ${intakeO.registration || "?"}; independent prescriber: ${intakeO.isPrescriber ? "yes" : "no"}; aesthetics experience already held: ${intakeO.currentTraining?.trim() || "NONE (novice)"}. The offer must handle this fairly: a training-period arrangement (e.g. lower base while training, rising to the full package on competency sign-off), a training-cost / clawback point (~£${(comp.trainingCostGbp || 0).toLocaleString()} of course fees — who pays, and repayment if she leaves within N months), and the fact she can't be genuinely self-employed while supervised and non-billing. Total carried before she bills: ~£${(comp.investmentBeforeProductive || 0).toLocaleString()}.`
    : "";

  const modelLabel: Record<string, string> = {
    employed: "employed (PAYE salary)",
    day_rate: "self-employed day rate",
    revenue_share: "revenue share (% of gross takings)",
    net_profit_share: "profit share (% of each treatment's NET profit, after product/consumable cost)",
    hybrid: "hybrid (base retainer plus revenue share)",
  };

  const prompt = `You are an experienced UK aesthetics-clinic operator helping the owner (Abi Peters) shape a fair, affordable written OFFER for a clinician.

THE PERSON & THE PLAN:
- Role: ${role.name} (${role.roleType}).
- Chosen pay model: ${modelLabel[role.payModel] ?? role.payModel}.
- Pay parameters: ${JSON.stringify(comp.params)}.
- Bedhampton is Abi's existing clinic; Winchester opens ${analysis.openMonth}; Bedhampton relocates to Chichester ${settings.chichesterMoveMonth ?? "(date TBC)"}. The intent is this clinician covers Bedhampton part-time as Abi shifts to Winchester, then goes full-time when the clinic becomes Chichester.
- Phased economics (already computed from the plan — do NOT recompute, cite these figures):
${phaseLines}
- Full-time steady state: ${comp.fullTime ? `${comp.fullTime.days} days/week at ${comp.fullTime.site}, earning ~£${comp.fullTime.monthlyGrossPay.toLocaleString()}/mo, contributing ~£${comp.fullTime.monthlyContribution.toLocaleString()}/mo after pay and stock.` : "n/a"}
- Does she cover her cost at full time: ${comp.paysForHerself ? "yes" : "not yet / borderline"}.${trainingContext}

Write a clear, warm-but-professional OFFER / HEADS OF TERMS the owner could adapt and send. UK employment/self-employment conventions. Plain text (no markdown). Include, as sections:
1. THE ROLE AND THE JOURNEY — the phased plan in plain English (part-time Bedhampton now → full-time Chichester), so the clinician understands the growth path and why it's structured this way.
2. HOW YOU'LL BE PAID — the pay model explained simply with the actual numbers, at both the part-time and full-time stages.
3. DAYS, LOCATION & TIMELINE — the indicative days/week and site at each stage with approximate dates.
4. WHAT WE ASK OF YOU — reasonable expectations (registration/insurance/indemnity, notice, professional conduct).
5. WHAT YOU CAN EXPECT FROM US — support, progression to full-time, autonomy.
6. NEXT STEPS — a friendly close inviting a conversation; note that this is an outline, not a contract, and terms will be confirmed formally.

If the pay model is a share of profit/revenue: explain it in the offer as a share of each treatment's NET profit (after product/consumable cost) where applicable, state the %, and be clear that during the supervised training window she is on a fixed training arrangement (stipend/employed), switching to the self-employed profit-share only once she is signed off to work solo.

Then, AFTER the offer, add a short section headed "--- FOR ABI'S EYES ONLY (not part of the offer) ---" with 4-6 blunt bullet points covering: affordability; the risk of paying her before she bills; whether this pay model suits a part-time, building clinician; and — IMPORTANTLY — the EMPLOYMENT STATUS / IR35 point: a self-employed profit-share is only defensible once she is genuinely autonomous (own patients, own indemnity, control of her work); while she is a SUPERVISED TRAINEE being directed by Abi, HMRC may treat her as employed, so the training period should be employed/stipend and the self-employed profit-share should begin at solo sign-off. Flag "CONFIRM with your accountant" on the status point.`;

  try {
    const text = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 4000 });
    res.json({ offer: text, compensation: comp });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Offer generation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ── AI: benchmark & balance the WHOLE team's pay to current market ────────────
router.post("/projects/:projectId/workforce/benchmark-pay", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const analysis = await buildAnalysis(projectId);
  const settings = analysis.settings;
  const bedRevMonthly = Math.round(analysis.fin.bedRevPerDay * (settings.bedhamptonDaysNeeded || 5) * 4.345);
  const netProfitMonthly = Math.round(bedRevMonthly * (1 - analysis.fin.stockPct / 100));
  const chichesterMove = settings.chichesterMoveMonth ?? "2028-04";

  const team = analysis.roles.filter(r => !r.isOwner).map(r => {
    const intk = JSON.parse(r.intakeJson || "{}") as { registration?: string; isPrescriber?: boolean; currentTraining?: string; readyBy?: string };
    const allocs = JSON.parse(r.allocationsJson || "[]") as Allocation[];
    const daysDesc = allocs.length
      ? allocs.map(a => `${a.fromMonth}: ${(a.bedhamptonDays || 0) + (a.winchesterDays || 0) + (a.chichesterDays || 0)}d/wk`).join("; ")
      : "days not set";
    return {
      id: r.id, name: r.name, roleType: r.roleType, status: r.status, startDate: r.startDate,
      currentAnnualCostGbp: r.annualCostGbp, notes: r.notes || "",
      registration: intk.registration || null, isPrescriber: intk.isPrescriber || false,
      experience: intk.currentTraining || null, days: daysDesc,
    };
  });

  const teamBlock = team.map(t =>
    `- id ${t.id}: "${t.name}" (${t.roleType}, ${t.status}). Currently costed at £${(t.currentAnnualCostGbp || 0).toLocaleString()}/yr loaded. Days: ${t.days}.${t.registration ? ` Registration: ${t.registration}.` : ""}${t.experience ? ` Aesthetics experience: ${t.experience}.` : ""}${t.notes ? ` Notes: ${t.notes}` : ""}`,
  ).join("\n");

  const prompt = `You are a UK remuneration adviser who benchmarks pay for small medical-aesthetics clinics. Set FAIR, MARKET-GROUNDED, INTERNALLY-BALANCED pay for this whole team. The owner has been using placeholder salary figures and wants them replaced with defensible numbers for TODAY'S market.

LOCATION & CONTEXT (critical for benchmarking):
- Clinics in Winchester (Hampshire) and Chichester (West Sussex) — affluent South-East England, but NOT London. Benchmark to current regional market: above UK national median, below central-London rates.
- Small, owner-run, medically-led aesthetics clinic. CQC-regulated activities planned.
- Benchmark to the market as of 2026. These are INDICATIVE ranges from professional norms — you MUST flag that the owner should sense-check against live local job ads / recruitment-agency data, and that pay has drifted up with inflation.

THE TEAM (benchmark every role; "id" is the database id — echo it back exactly):
${teamBlock}

AFFORDABILITY ANCHOR (cite, don't recompute):
- The existing Bedhampton book turns over ~£${bedRevMonthly.toLocaleString()}/mo; net profit after consumables ~£${netProfitMonthly.toLocaleString()}/mo.

SPECIAL CASE — the new practitioner (the clinician being trained from scratch):
- She is a registered paramedic + newly-qualified independent prescriber, but a COMPLETE aesthetics novice being trained by the clinic. Her pay must be a PROGRESSION, not one flat number:
  (1) a REDUCED TRAINING SALARY while she is non-billable and learning (~first 3 months);
  (2) a SOLO-CLINICIAN BASE once she is signed off to treat clients on her own;
  (3) a CLINICAL-LEAD / MANAGER UPLIFT when she starts managing another member of staff (or a few) — expected ~9–12 months after the Chichester clinic opens (Chichester ~${chichesterMove}), i.e. she runs the site and line-manages others.
- She is EMPLOYED (PAYE) and ALSO gets a growth bonus on top (already decided elsewhere) — so benchmark only her BASE salary at each stage; do not fold the bonus in. Her applied steady-state salary = the solo-clinician base (stage 2).

RULES:
- Keep the team INTERNALLY COHERENT: a manager/clinical-lead must out-earn a solo clinician; a solo clinician must out-earn a coordinator/receptionist; a receptionist must out-earn a junior support role. No junior role may approach a senior one. Explicitly reconcile the figures against each other.
- Salaries are FTE (full-time equivalent). If a role is clearly part-time by its days, still quote the FTE salary and note actual cost is pro-rata.
- "loadedCostGbp" = fully-loaded annual cost to the business = gross salary + ~15% employer on-costs (NI + pension). Round sensibly.
- Be realistic and current — do not lowball or inflate. A brand-new trainee injector is NOT worth a seasoned clinician's salary; a proven clinical lead running a site is worth meaningfully more.

Return ONLY valid JSON, no prose outside it, in exactly this shape:
{
  "roles": [
    { "roleId": <number, the id given above>, "name": "<role name>", "salaryGbp": <gross FTE salary, integer>, "loadedCostGbp": <loaded annual cost, integer>, "marketLowGbp": <integer>, "marketHighGbp": <integer>, "basis": "<one sentence: what this benchmark is anchored to>" }
  ],
  "sarahStages": [
    { "stage": "<e.g. Training (non-billable, ~3 mo)>", "figure": "<e.g. ~£2,750/mo (~£33k pro-rata)>", "note": "<one line>" }
  ],
  "coherence": "<2-3 sentences reconciling the figures against each other so the owner can see the ladder is sensible>",
  "watchOuts": ["<verify-locally / inflation caveat>", "<one more practical caveat>"],
  "narrative": "<4-6 sentences the owner reads first: what you've set each person at and why, in plain English, naming the figures>"
}`;

  try {
    const raw = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 6000, jsonOnly: true });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: "AI returned unparseable benchmark." }); }
    await db.update(workforceSettingsTable)
      .set({ payBenchmark: JSON.stringify(parsed), updatedAt: new Date() })
      .where(eq(workforceSettingsTable.projectId, projectId));
    res.json({ benchmark: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Benchmark failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// Apply the stored benchmark: set each role's salary + loaded cost to the recommendation.
router.post("/projects/:projectId/workforce/apply-benchmark", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const settings = await getSettings(projectId);
  if (!settings.payBenchmark) return res.status(400).json({ error: "No benchmark to apply — generate one first." });
  let benchmark: { roles?: { roleId?: number; salaryGbp?: number; loadedCostGbp?: number }[] };
  try { benchmark = JSON.parse(settings.payBenchmark); }
  catch { return res.status(500).json({ error: "Stored benchmark is corrupt." }); }

  let applied = 0;
  for (const b of benchmark.roles || []) {
    if (!b.roleId || !b.salaryGbp) continue;
    const [role] = await db.select().from(staffRolesTable).where(eq(staffRolesTable.id, b.roleId));
    if (!role || role.projectId !== projectId || role.isOwner) continue;
    const pay = JSON.parse(role.payJson || "{}") as Record<string, unknown>;
    pay.salaryFteGbp = b.salaryGbp;
    await db.update(staffRolesTable).set({
      annualCostGbp: b.loadedCostGbp ?? Math.round(b.salaryGbp * 1.15),
      payJson: JSON.stringify(pay),
      updatedAt: new Date(),
    }).where(eq(staffRolesTable.id, b.roleId));
    applied++;
  }
  res.json({ applied });
});

export default router;
