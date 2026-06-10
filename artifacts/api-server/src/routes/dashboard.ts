import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, phasesTable, tasksTable, financialsTable, complianceItemsTable, cqcMilestonesTable, propertiesTable, propertyTaskOverridesTable, fixedCostItemsTable, competitorsTable, marketingItemsTable, risksTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { calcCliniciansMonthlyCost } from "../lib/financialEngine";

const router = Router();

const CRITICAL_RISK_KEYWORDS = ["solicitor", "clinical waste", "compliance", "fire risk", "insurance", "electrical", "cqc"];

router.get("/projects/:projectId/dashboard", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Not found" });

  const phases = await db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const baseTasks = (await Promise.all(phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id))))).flat();

  // Days to opening
  let daysToOpening: number | null = null;
  if (project.targetOpeningDate) {
    const target = new Date(project.targetOpeningDate);
    const now = new Date();
    daysToOpening = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Financial + property + fixed cost items + marketing + risks — fetched in parallel
  const [
    [financial],
    allProperties,
    fixedCostItems,
    allCompetitors,
    allMarketingItems,
    allRisks,
  ] = await Promise.all([
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId)),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
    db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId)),
    db.select().from(marketingItemsTable).where(eq(marketingItemsTable.projectId, projectId)),
    db.select().from(risksTable).where(eq(risksTable.projectId, projectId)),
  ]);

  // Risk Register scoring — only risks from the Register contribute to risk posture
  const openRisks = allRisks.filter(r => r.status !== "Closed" && r.status !== "Mitigated");
  const criticalRegisterRisks = openRisks.filter(r => r.likelihood * r.impact >= 15);
  const highRegisterRisks    = openRisks.filter(r => r.likelihood * r.impact >= 12 && r.likelihood * r.impact < 15);
  const criticalRiskFlagCount = openRisks.filter(r => r.likelihood * r.impact >= 12).length;

  const activeProperty = allProperties.find(p => p.isActiveForProject) ?? allProperties[0] ?? null;

  // Merge property overrides onto base tasks (same pattern as phases-with-tasks)
  const overrideMap = new Map<number, Record<string, unknown>>();
  if (activeProperty) {
    const overrides = await db.select().from(propertyTaskOverridesTable)
      .where(eq(propertyTaskOverridesTable.propertyId, activeProperty.id));
    for (const o of overrides) overrideMap.set(o.taskId, o as Record<string, unknown>);
  }

  const allTasks = baseTasks.map(t => {
    const o = overrideMap.get(t.id);
    if (!o) return t;
    return {
      ...t,
      status:       ((o.status       ?? t.status)       as string),
      selectedCost: ((o.selectedCost ?? t.selectedCost) as number),
      costTier:     ((o.costTier     ?? t.costTier)     as string),
    };
  });

  const totalTaskCount     = allTasks.length;
  const completedTaskCount = allTasks.filter(t => t.status === "complete").length;
  const blockedTaskCount   = allTasks.filter(t => t.status === "blocked").length;
  const highRiskTaskCount  = allTasks.filter(t => t.riskLevel === "high" || t.riskLevel === "critical").length;

  const totalProjectCostLow  = baseTasks.reduce((sum, t) => sum + t.costLow,  0);
  const totalProjectCostMid  = baseTasks.reduce((sum, t) => sum + t.costMid,  0);
  const totalProjectCostHigh = baseTasks.reduce((sum, t) => sum + t.costHigh, 0);
  const currentSelectedCost  = allTasks.reduce((sum, t) => sum + (t.selectedCost ?? 0), 0);

  const launchReadinessPercent = totalTaskCount > 0
    ? Math.round((completedTaskCount / totalTaskCount) * 100)
    : 0;

  // Short display name: first segment before a comma (e.g. "9a Jewry Street")
  const activePropertyAddress = activeProperty?.address ?? null;
  const activePropertyPostcode = activeProperty?.postcode ?? null;
  const activePropertyShortName = activeProperty?.address
    ? activeProperty.address.split(",")[0].trim()
    : null;

  let projectedFirstYearProfit: number | null = null;
  let monthlyBurnRate: number | null = null;
  let cashRunwayMonths: number | null = null;
  let cashRunwayNote: string | null = null;
  let breakEvenRevenue: number | null = null;
  let realisticRevenue: number | null = null;
  let realisticNetProfit: number | null = null;
  let conservativeNetProfit: number | null = null;
  let aggressiveNetProfit: number | null = null;
  let selectedScenario: string = "realistic";
  let selectedNetProfit: number | null = null;
  let selectedRevenue: number | null = null;
  let vatRisk: boolean | null = null;
  let vatHeadroomGbp: number | null = null;
  let vatMonthsToThreshold: number | null = null;

  if (financial) {
    const slotsPerMonth = financial.treatmentRoomsCount * financial.practitionerHoursPerDay * financial.workingDaysPerMonth;

    // Use itemised fixed costs when available (more accurate than legacy fields)
    const totalFixedItemsCost = fixedCostItems.reduce((s, c) => s + (c.amountGbp ?? 0), 0);
    const legacyFixed = financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp + financial.internetGbp + financial.insuranceGbp + financial.accountantGbp + financial.softwareGbp + financial.wasteContractGbp + financial.cleanerGbp + financial.subscriptionsGbp + financial.financeRepaymentsGbp;
    const clinicianCostDash = calcCliniciansMonthlyCost((financial as any).additionalCliniciansJson);
    const actualFixed = (totalFixedItemsCost > 0 ? totalFixedItemsCost : legacyFixed) + clinicianCostDash;

    const acv = financial.wincAcvGbp || financial.averageClientValueGbp;
    const variableRatio = (financial.stockPercent + financial.commissionsPercent) / 100;
    const fixedVarItems = financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;

    const calcNet = (occupancyPct: number) => {
      const rev = Math.round((slotsPerMonth * (occupancyPct / 100)) * acv + financial.membershipRevenueGbp);
      const variable = Math.round(rev * variableRatio + fixedVarItems);
      return { rev, net: rev - actualFixed - variable };
    };

    const conservative = calcNet(financial.conservativeOccupancyPercent);
    const realistic = calcNet(financial.realisticOccupancyPercent);
    const aggressive = calcNet(financial.aggressiveOccupancyPercent);

    realisticRevenue = realistic.rev;
    realisticNetProfit = realistic.net;
    conservativeNetProfit = conservative.net;
    aggressiveNetProfit = aggressive.net;

    // Read which scenario the user last selected (persisted in DB)
    selectedScenario = (financial as any).selectedScenario ?? "realistic";
    const scenarioMap: Record<string, { rev: number; net: number }> = {
      conservative, realistic, aggressive,
      // stress tests fall back to conservative figures
      delayed_ramp: realistic, economic_downturn: conservative, stress_test: conservative,
    };
    const sel = scenarioMap[selectedScenario] ?? realistic;
    selectedNetProfit = sel.net;
    selectedRevenue = sel.rev;

    monthlyBurnRate = actualFixed + Math.round(realistic.rev * variableRatio + fixedVarItems);
    projectedFirstYearProfit = realistic.net * 12;

    // Break-even: revenue at which net = 0 (covers fixed + variable overheads)
    breakEvenRevenue = Math.round((actualFixed + fixedVarItems) / Math.max(1 - variableRatio, 0.01));

    // Improved runway: accounts for Bedhampton net contribution (after stock/running costs)
    // and monthly project cost burn spread across months until opening.
    // This gives a genuine capital runway rather than the previous formula which returned 99
    // whenever personal salary fields were zero.
    const bedhStockPct = ((financial as any).bedhStockPercent ?? 35) / 100;
    const bedhNetMonthly = Math.max(0,
      financial.existingClinicRevenueGbp * (1 - bedhStockPct)
      - ((financial as any).bedhRentGbp ?? 0)
      - ((financial as any).bedhMarketingGbp ?? 0)
      - ((financial as any).bedhamptonCostsGbp ?? 0)
    );
    // Spread total project cost across months from now until opening
    const preOpenMonths = daysToOpening !== null ? Math.max(1, Math.ceil(daysToOpening / 30)) : 6;
    const projectCostBurnPerMonth = currentSelectedCost / preOpenMonths;
    const personalMonthly = financial.personalSalaryNeedsGbp + financial.ownerDrawingsGbp;
    const monthlyCashDrain = personalMonthly + projectCostBurnPerMonth - bedhNetMonthly;
    cashRunwayMonths = monthlyCashDrain > 0
      ? Math.round(financial.runwaySavingsGbp / monthlyCashDrain)
      : 99; // income genuinely exceeds burn
    cashRunwayNote = `£${Math.round(financial.runwaySavingsGbp / 1000)}k capital ÷ £${Math.round(Math.max(monthlyCashDrain, 0)).toLocaleString()}/mo net drain | project costs £${Math.round(projectCostBurnPerMonth).toLocaleString()}/mo over ${preOpenMonths}mo · personal £${Math.round(personalMonthly).toLocaleString()}/mo · Bedh net £${Math.round(bedhNetMonthly).toLocaleString()}/mo`;

    // VAT awareness: forecast months until threshold from current turnover + projected Winc revenue
    const projectedAnnualWinc = realistic.rev * 12;
    const vatCurrentTurnover = financial.vatCurrentTurnoverGbp || 0;
    const combinedTurnover = vatCurrentTurnover + projectedAnnualWinc;
    vatRisk = combinedTurnover > 90000;
    vatHeadroomGbp = Math.max(0, 90000 - combinedTurnover);
    vatMonthsToThreshold = realistic.rev > 0
      ? Math.max(0, Math.ceil((90000 - vatCurrentTurnover) / realistic.rev))
      : null;
  }

  // Competition summary
  let competitionSummary: {
    hasData: boolean;
    competitorCount: number;
    highThreatCount: number;
    marketSpaceScore: number | null;
    topThreatName: string | null;
    topThreatScore: number | null;
    avgCompRating: number | null;
    nurseLedIPCount: number;
    verifiedCount: number;
  } = {
    hasData: false,
    competitorCount: 0,
    highThreatCount: 0,
    marketSpaceScore: null,
    topThreatName: null,
    topThreatScore: null,
    avgCompRating: null,
    nurseLedIPCount: 0,
    verifiedCount: 0,
  };
  if (allCompetitors.length > 0) {
    const scored = allCompetitors.map(c => {
      const dist = parseFloat(c.distanceMiles || "5") || 5;
      const proxScore = dist <= 0.5 ? 88 : dist <= 1 ? 76 : dist <= 2 ? 62 : dist <= 3 ? 48 : 32;
      const rating = parseFloat(c.googleRating || "0") || 0;
      const reviewScore = Math.min((rating / 5) * 60 + Math.min((c.googleReviewCount || 0) / 300, 1) * 40, 100);
      const score = Math.round(proxScore * 0.15 + (c.clinicalAuthorityScore || 50) * 0.15 + reviewScore * 0.15 + (c.brandStrengthScore || 50) * 0.15 + (c.premisesStrengthScore || 50) * 0.10 + Math.min((c.instagramFollowers || 0) / 5000, 1) * 100 * 0.05 + 50 * 0.25);
      return { ...c, threatScore: score };
    }).sort((a, b) => b.threatScore - a.threatScore);

    const nurseLedIP = allCompetitors.filter(c => c.clinicType === "nurse-led" && c.independentPrescriber).length;
    const saturation = nurseLedIP / Math.max(allCompetitors.length, 1);
    const marketSpaceScore = Math.round(Math.max(25, Math.min(90, (1 - saturation * 0.6) * 75 + 15)));
    const ratedComps = allCompetitors.filter(c => parseFloat(c.googleRating || "0") > 0);
    const avgRating = ratedComps.length ? Math.round((ratedComps.reduce((s, c) => s + parseFloat(c.googleRating || "0"), 0) / ratedComps.length) * 10) / 10 : null;

    competitionSummary = {
      hasData: true,
      competitorCount: allCompetitors.length,
      highThreatCount: scored.filter(c => c.threatScore >= 68).length,
      marketSpaceScore,
      topThreatName: scored[0]?.name ?? null,
      topThreatScore: scored[0]?.threatScore ?? null,
      avgCompRating: avgRating,
      nurseLedIPCount: nurseLedIP,
      verifiedCount: allCompetitors.filter(c => c.manuallyVerified).length,
    };
  }

  // Marketing readiness + waitlist
  let marketingReadinessPct = 0;
  let waitlistCount = 0;
  if (allMarketingItems.length > 0) {
    const applicable = allMarketingItems.filter(i => i.status !== "na" && !i.title.startsWith("⚠"));
    if (applicable.length > 0) {
      const score = applicable.reduce(
        (acc, i) => acc + (i.status === "done" ? 1 : i.status === "in_progress" ? 0.5 : 0),
        0,
      );
      marketingReadinessPct = Math.round((score / applicable.length) * 100);
    }
  }
  waitlistCount = (project as any).waitlistCount ?? 0;

  // Phase progress
  const phaseProgress = await Promise.all(phases.map(async (phase) => {
    const phaseTasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phase.id));
    const completed = phaseTasks.filter(t => t.status === "complete").length;
    const percentComplete = phaseTasks.length > 0 ? Math.round((completed / phaseTasks.length) * 100) : 0;
    return {
      phaseId: phase.id,
      phaseName: phase.name,
      completedTasks: completed,
      totalTasks: phaseTasks.length,
      percentComplete,
      status: phase.status,
    };
  }));

  // Compliance readiness score
  const complianceItems = await db.select().from(complianceItemsTable).where(eq(complianceItemsTable.projectId, projectId));
  const complianceMilestones = await db.select().from(cqcMilestonesTable).where(eq(cqcMilestonesTable.projectId, projectId));
  const applicableItems = complianceItems.filter(i => i.status !== "not_applicable");
  const completeItems = applicableItems.filter(i => i.status === "complete" || i.policyStatus === "signed_off");
  const complianceReadinessPercent = applicableItems.length > 0 ? Math.round((completeItems.length / applicableItems.length) * 100) : 0;
  const cqcNotStarted = complianceMilestones.length > 0 && complianceMilestones.every(m => m.status === "not_started");

  // Confidence score — 5 earned pillars, nothing given for free (0-100)
  const fmt = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  const davidCap = (financial as any)?.davidApprovedCapGbp ?? 80000;
  const outerLimitCalc = davidCap * (7 / 6);

  // Pillar 1: Progress (0–20) — task completion rate; floor of 1 so any completions register
  const cpProgress = completedTaskCount === 0
    ? 0
    : Math.max(1, Math.round(Math.min(launchReadinessPercent * 0.2, 20)));

  // Pillar 2: Budget health (0–20) — selected cost vs approved cap
  const cpBudget = currentSelectedCost <= davidCap ? 20
    : currentSelectedCost <= outerLimitCalc ? 12
    : 4;

  // Pillar 3: Financial viability (0–20) — projected monthly net at opening
  const cpFinancial = selectedNetProfit == null ? 0
    : selectedNetProfit >= 6000 ? 20
    : selectedNetProfit >= 3000 ? 16
    : selectedNetProfit >= 1000 ? 10
    : selectedNetProfit >= 0 ? 5
    : 0;

  // Pillar 4: Risk posture (0–20) — scored from Risk Register only
  // Critical (score ≥15): -2 pts each; High (score 12–14): -1 pt each
  const cpRisk = Math.max(0, Math.round(20 - (criticalRegisterRisks.length * 2) - (highRegisterRisks.length * 1)));

  // Pillar 5: Compliance + timeline headroom (0–20)
  const cpCompPart = Math.round(Math.min(complianceReadinessPercent * 0.1, 10));
  const cpTimePart = daysToOpening == null ? 5
    : daysToOpening >= 120 ? 10
    : daysToOpening >= 60 ? 6
    : daysToOpening >= 30 ? 3
    : 1;
  const cpCompliance = cpCompPart + cpTimePart;

  const projectConfidenceScore = cpProgress + cpBudget + cpFinancial + cpRisk + cpCompliance;

  const confidenceBreakdown = {
    progress:   { score: cpProgress,   max: 20, detail: `${completedTaskCount} of ${totalTaskCount} tasks complete` },
    budget:     { score: cpBudget,     max: 20, detail: currentSelectedCost <= davidCap ? `Within ${fmt(davidCap)} approved cap` : currentSelectedCost <= outerLimitCalc ? `Stretch — ${fmt(currentSelectedCost)} vs ${fmt(davidCap)} cap` : `Over outer limit (${fmt(outerLimitCalc)}) — review deferrals` },
    financial:  { score: cpFinancial,  max: 20, detail: selectedNetProfit != null ? `${selectedNetProfit >= 0 ? "+" : ""}${fmt(selectedNetProfit)}/mo net at ${selectedScenario}` : "Financial model not configured" },
    risk:       { score: cpRisk,       max: 20, detail: criticalRiskFlagCount === 0 ? "No high/critical risks open" : `${criticalRegisterRisks.length} critical · ${highRegisterRisks.length} high risk${criticalRiskFlagCount !== 1 ? "s" : ""} open in Register` },
    compliance: { score: cpCompliance, max: 20, detail: `${complianceReadinessPercent}% compliance complete · ${daysToOpening ?? "?"} days to launch` },
  };

  return res.json({
    projectId,
    projectName: project.name,
    status: project.status,
    targetOpeningDate: project.targetOpeningDate,
    daysToOpening,
    launchReadinessPercent,
    totalTaskCount,
    completedTaskCount,
    blockedTaskCount,
    highRiskTaskCount,
    criticalRiskFlagCount,
    totalProjectCostLow,
    totalProjectCostMid,
    totalProjectCostHigh,
    currentSelectedCost,
    projectedFirstYearProfit,
    monthlyBurnRate,
    cashRunwayMonths,
    cashRunwayNote,
    projectConfidenceScore,
    phaseProgress,
    complianceReadinessPercent,
    cqcNotStarted,
    activePropertyAddress,
    activePropertyPostcode,
    activePropertyShortName,
    breakEvenRevenue,
    realisticRevenue,
    realisticNetProfit,
    conservativeNetProfit,
    aggressiveNetProfit,
    selectedScenario,
    selectedNetProfit,
    selectedRevenue,
    vatRisk,
    vatHeadroomGbp,
    vatMonthsToThreshold,
    competitionSummary,
    marketingReadinessPct,
    waitlistCount,
    confidenceBreakdown,
  });
});

router.get("/projects/:projectId/risk-flags", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  // Load Risk Register and tasks in parallel
  const [risks, phases] = await Promise.all([
    db.select().from(risksTable).where(eq(risksTable.projectId, projectId)),
    db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active"))),
  ]);
  const allTasks = (await Promise.all(phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id))))).flat();

  const flags: Array<{ level: string; category: string; message: string; riskId?: string; riskTitle?: string }> = [];

  // ── Risk Register flags — the sole source of risk information ─────────────
  const openRisks = risks.filter(r => r.status !== "Closed" && r.status !== "Mitigated");

  // Critical risks (score ≥ 15) → critical flags
  openRisks
    .filter(r => r.likelihood * r.impact >= 15)
    .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))
    .forEach(r => {
      flags.push({
        level: "critical",
        category: r.category?.toLowerCase() ?? "risk",
        message: r.title,
        riskId: r.riskId,
        riskTitle: r.title,
      });
    });

  // High risks (score 12–14) → critical flags
  openRisks
    .filter(r => r.likelihood * r.impact >= 12 && r.likelihood * r.impact < 15)
    .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))
    .forEach(r => {
      flags.push({
        level: "critical",
        category: r.category?.toLowerCase() ?? "risk",
        message: r.title,
        riskId: r.riskId,
        riskTitle: r.title,
      });
    });

  // Medium risks (score 6–11) → warnings
  openRisks
    .filter(r => r.likelihood * r.impact >= 6 && r.likelihood * r.impact < 12)
    .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))
    .forEach(r => {
      flags.push({
        level: "warning",
        category: r.category?.toLowerCase() ?? "risk",
        message: r.title,
        riskId: r.riskId,
        riskTitle: r.title,
      });
    });

  // ── Operational project checks (budget / schedule — not risk score driven) ─
  const blockedTasks = allTasks.filter(t => t.status === "blocked");
  if (blockedTasks.length > 3) {
    flags.push({
      level: "warning",
      category: "schedule",
      message: `${blockedTasks.length} tasks are currently blocked — this may delay your opening date.`,
    });
  }

  const highTierCount = allTasks.filter(t => t.costTier === "high").length;
  if (allTasks.length > 0 && highTierCount / allTasks.length > 0.5) {
    flags.push({
      level: "warning",
      category: "budget",
      message: `Over 50% of tasks are on HIGH cost tier — total project cost is likely to exceed budget.`,
    });
  }

  res.json(flags);
});

router.get("/projects/:projectId/burndown", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Not found" });

  const phases = await db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const allTasks = (await Promise.all(phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id))))).flat();

  const totalTasks = allTasks.length;
  if (totalTasks === 0) return res.json([]);

  const completedTasks = allTasks.filter(t => t.status === "complete");

  // Anchor week 0 to the project creation date
  const projectStart = new Date(project.createdAt);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  // Count completions per week using each task's updatedAt timestamp
  const completionsByWeek = new Map<number, number>();
  for (const task of completedTasks) {
    const weeksSinceStart = Math.floor((new Date(task.updatedAt).getTime() - projectStart.getTime()) / msPerWeek);
    const week = Math.max(0, weeksSinceStart);
    completionsByWeek.set(week, (completionsByWeek.get(week) ?? 0) + 1);
  }

  // Span 16 weeks from project start into the future
  const WEEKS = 16;
  const points = [];
  let cumulativeCompleted = 0;

  for (let i = 0; i <= WEEKS; i++) {
    cumulativeCompleted += completionsByWeek.get(i) ?? 0;
    const remaining = totalTasks - cumulativeCompleted;
    const idealRemaining = Math.max(0, totalTasks - (totalTasks / WEEKS) * i);

    points.push({
      weekNumber: i,
      weekLabel: i === 0 ? "Now" : `Wk ${i}`,
      totalTasks,
      remainingTasks: remaining,
      completedTasks: cumulativeCompleted,
      idealRemaining: Math.round(idealRemaining * 10) / 10,
    });
  }

  return res.json(points);
});

export default router;
