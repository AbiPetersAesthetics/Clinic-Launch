import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, phasesTable, tasksTable, financialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const CRITICAL_RISK_KEYWORDS = ["solicitor", "clinical waste", "compliance", "fire risk", "insurance", "electrical", "cqc"];

router.get("/projects/:projectId/dashboard", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Not found" });

  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const allTasks = (await Promise.all(phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id))))).flat();

  const totalTaskCount = allTasks.length;
  const completedTaskCount = allTasks.filter(t => t.status === "complete").length;
  const blockedTaskCount = allTasks.filter(t => t.status === "blocked").length;
  const highRiskTaskCount = allTasks.filter(t => t.riskLevel === "high" || t.riskLevel === "critical").length;
  const criticalRiskFlagCount = allTasks.filter(t => t.isCriticalRisk).length;

  const totalProjectCostLow = allTasks.reduce((sum, t) => sum + t.costLow, 0);
  const totalProjectCostMid = allTasks.reduce((sum, t) => sum + t.costMid, 0);
  const totalProjectCostHigh = allTasks.reduce((sum, t) => sum + t.costHigh, 0);
  const currentSelectedCost = allTasks.reduce((sum, t) => sum + t.selectedCost, 0);

  const launchReadinessPercent = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0;

  // Days to opening
  let daysToOpening: number | null = null;
  if (project.targetOpeningDate) {
    const target = new Date(project.targetOpeningDate);
    const now = new Date();
    daysToOpening = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Financial data
  const [financial] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  let projectedFirstYearProfit: number | null = null;
  let monthlyBurnRate: number | null = null;
  let cashRunwayMonths: number | null = null;

  if (financial) {
    const slotsPerMonth = financial.treatmentRoomsCount * financial.practitionerHoursPerDay * financial.workingDaysPerMonth;
    const monthlyRevenue = (slotsPerMonth * (financial.realisticOccupancyPercent / 100)) * financial.averageClientValueGbp + financial.membershipRevenueGbp;
    const monthlyFixed = financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp + financial.internetGbp + financial.insuranceGbp + financial.accountantGbp + financial.softwareGbp + financial.wasteContractGbp + financial.cleanerGbp + financial.subscriptionsGbp + financial.financeRepaymentsGbp;
    const monthlyVariable = monthlyRevenue * ((financial.stockPercent + financial.commissionsPercent) / 100) + financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;
    monthlyBurnRate = monthlyFixed + monthlyVariable;
    projectedFirstYearProfit = (monthlyRevenue - (monthlyBurnRate ?? 0)) * 12;
    const monthlyCashDrain = financial.personalSalaryNeedsGbp + financial.ownerDrawingsGbp - financial.existingClinicRevenueGbp;
    cashRunwayMonths = monthlyCashDrain > 0 ? financial.runwaySavingsGbp / monthlyCashDrain : 99;
  }

  // Confidence score (0-100)
  const completionScore = launchReadinessPercent * 0.4;
  const riskPenalty = Math.min(highRiskTaskCount * 3, 20);
  const criticalPenalty = Math.min(criticalRiskFlagCount * 5, 20);
  const financialBonus = financial ? 10 : 0;
  const projectConfidenceScore = Math.max(0, Math.round(40 + completionScore - riskPenalty - criticalPenalty + financialBonus));

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
    projectConfidenceScore,
    phaseProgress,
  });
});

router.get("/projects/:projectId/risk-flags", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const allTasks = (await Promise.all(phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id))))).flat();

  const flags: Array<{ level: string; category: string; message: string; taskId?: number; taskTitle?: string }> = [];

  // Check critical risk tasks
  allTasks.filter(t => t.isCriticalRisk && t.status !== "complete").forEach(t => {
    flags.push({
      level: "critical",
      category: "compliance",
      message: `Critical task incomplete: "${t.title}"`,
      taskId: t.id,
      taskTitle: t.title,
    });
  });

  // Check for dangerous LOW tier selections on non-negotiable tasks
  allTasks.filter(t => t.isNonNegotiable && t.costTier === "low" && t.status !== "complete").forEach(t => {
    flags.push({
      level: "critical",
      category: "cost",
      message: `Non-negotiable task "${t.title}" is set to LOW cost tier — this may create unacceptable risk.`,
      taskId: t.id,
      taskTitle: t.title,
    });
  });

  // Check for high proportion of HIGH cost selections
  const highTierCount = allTasks.filter(t => t.costTier === "high").length;
  if (allTasks.length > 0 && highTierCount / allTasks.length > 0.5) {
    flags.push({
      level: "warning",
      category: "budget",
      message: `Over 50% of tasks are on HIGH cost tier — total project cost is likely to exceed budget. Review cost selections.`,
    });
  }

  // Check for blocked tasks
  const blockedTasks = allTasks.filter(t => t.status === "blocked");
  if (blockedTasks.length > 3) {
    flags.push({
      level: "warning",
      category: "schedule",
      message: `${blockedTasks.length} tasks are currently blocked — this may delay your opening date.`,
    });
  }

  res.json(flags);
});

export default router;
