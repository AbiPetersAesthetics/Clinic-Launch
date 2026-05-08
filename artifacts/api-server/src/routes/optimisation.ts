import { Router } from "express";
import { db } from "@workspace/db";
import { phasesTable, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { LaunchTask } from "@workspace/db";

const router = Router();

type OptimisationCategory =
  | "safe_to_reduce"
  | "delayable"
  | "non_negotiable"
  | "dangerous_to_cut"
  | "luxury_item"
  | "operationally_critical";

interface OptimisationItem {
  taskId: number;
  taskTitle: string;
  phaseId: number;
  phaseName: string;
  costTier: string;
  selectedCost: number;
  costLow: number;
  costMid: number;
  costHigh: number;
  category: OptimisationCategory;
  potentialSavingGbp: number;
  rationale: string;
}

interface SmartRiskFlag {
  level: "warning" | "critical";
  message: string;
  taskId?: number;
  taskTitle?: string;
}

function categoriseTask(task: LaunchTask): { category: OptimisationCategory; potentialSavingGbp: number; rationale: string } {
  const isCritical = task.isCriticalRisk;
  const isNonNeg = task.isNonNegotiable;
  const tier = task.costTier;
  const risk = task.riskLevel;

  // Dangerous: critical/non-negotiable task on low tier
  if ((isCritical || isNonNeg) && tier === "low") {
    return {
      category: "dangerous_to_cut",
      potentialSavingGbp: 0,
      rationale: isNonNeg
        ? "Non-negotiable task on LOW cost tier — this creates unacceptable risk. Upgrade to MID or HIGH immediately."
        : "Critical risk task on LOW cost tier — safety/compliance is compromised. Increase budget.",
    };
  }

  // Non-negotiable at appropriate tier
  if (isNonNeg) {
    return {
      category: "non_negotiable",
      potentialSavingGbp: 0,
      rationale: "This cost cannot be reduced. It is operationally or legally mandated.",
    };
  }

  // High risk item on LOW tier (not non-negotiable) — still dangerous
  if (risk === "high" && tier === "low" && !isCritical) {
    return {
      category: "dangerous_to_cut",
      potentialSavingGbp: 0,
      rationale: "High-risk item on LOW cost tier — cost-cutting here creates significant operational risk.",
    };
  }

  // Low risk on HIGH tier — luxury, safe to cut back
  if (risk === "low" && tier === "high" && !isCritical && !isNonNeg) {
    const saving = Math.round(task.selectedCost - task.costLow);
    return {
      category: "luxury_item",
      potentialSavingGbp: Math.max(0, saving),
      rationale: `Low-risk task on HIGH cost tier. Switch to LOW to save approximately ${saving > 0 ? `£${saving.toLocaleString()}` : "some cost"}.`,
    };
  }

  // On HIGH tier, not critical — safe to reduce to MID
  if (tier === "high" && !isCritical && !isNonNeg && risk !== "high") {
    const saving = Math.round(task.selectedCost - task.costMid);
    return {
      category: "safe_to_reduce",
      potentialSavingGbp: Math.max(0, saving),
      rationale: `Currently on HIGH cost tier. Switching to MID could save approximately £${Math.max(0, saving).toLocaleString()}.`,
    };
  }

  // Not started, low/medium risk — potentially delayable
  if (task.status === "not_started" && risk === "low" && !isCritical && !isNonNeg) {
    return {
      category: "delayable",
      potentialSavingGbp: Math.round(task.selectedCost),
      rationale: "Not yet started and low risk. Could be deferred to preserve launch cash flow.",
    };
  }

  // Default — operationally critical
  return {
    category: "operationally_critical",
    potentialSavingGbp: 0,
    rationale: "Core operational cost. Required for launch with no safe reduction path.",
  };
}

router.get("/projects/:projectId/optimisation-analysis", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const phaseMap = new Map(phases.map(p => [p.id, p.name]));

  const allTasks = (await Promise.all(
    phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id)))
  )).flat();

  const items: OptimisationItem[] = allTasks
    .filter(t => t.status !== "complete")
    .map(task => {
      const { category, potentialSavingGbp, rationale } = categoriseTask(task);
      return {
        taskId: task.id,
        taskTitle: task.title,
        phaseId: task.phaseId,
        phaseName: phaseMap.get(task.phaseId) ?? "Unknown",
        costTier: task.costTier,
        selectedCost: task.selectedCost,
        costLow: task.costLow,
        costMid: task.costMid,
        costHigh: task.costHigh,
        category,
        potentialSavingGbp,
        rationale,
      };
    });

  const categorised: Record<OptimisationCategory, OptimisationItem[]> = {
    safe_to_reduce: [],
    delayable: [],
    non_negotiable: [],
    dangerous_to_cut: [],
    luxury_item: [],
    operationally_critical: [],
  };
  for (const item of items) {
    categorised[item.category].push(item);
  }

  const totalPotentialSaving = items.reduce((sum, i) => sum + i.potentialSavingGbp, 0);
  const currentCashRequirement = allTasks
    .filter(t => t.status !== "complete")
    .reduce((sum, t) => sum + t.selectedCost, 0);
  const cashRequirementWithSavings = Math.max(0, currentCashRequirement - totalPotentialSaving);

  // Operational risk score: 0 (safe) to 100 (dangerous)
  const dangerousCount = categorised.dangerous_to_cut.length;
  const highRiskCount = allTasks.filter(t => (t.riskLevel === "high" || t.riskLevel === "critical") && t.status !== "complete").length;
  const criticalCount = allTasks.filter(t => t.isCriticalRisk && t.status !== "complete").length;
  const operationalRiskScore = Math.min(100, Math.round(
    dangerousCount * 15 + highRiskCount * 5 + criticalCount * 8
  ));

  // Smart risk flags
  const smartRiskFlags: SmartRiskFlag[] = [];

  for (const item of categorised.dangerous_to_cut) {
    smartRiskFlags.push({
      level: "critical",
      message: item.rationale,
      taskId: item.taskId,
      taskTitle: item.taskTitle,
    });
  }

  // Specific keyword checks for critical categories
  const criticalKeywords = [
    { keyword: "solicitor", message: "No solicitor provision detected — legal risk is unacceptable for commercial lease." },
    { keyword: "clinical waste", message: "No clinical waste contract — CQC compliance requirement." },
    { keyword: "compliance", message: "Compliance consultant at LOW cost — regulatory risk for clinic registration." },
    { keyword: "fire risk", message: "Fire risk assessment on LOW budget — HSE statutory requirement." },
    { keyword: "insurance", message: "Insurance on LOW tier — inadequate professional indemnity cover is unacceptable." },
    { keyword: "electrical", message: "Electrical budget at LOW tier — unsafe installation risk for clinical environment." },
  ];

  for (const { keyword, message } of criticalKeywords) {
    const matched = allTasks.filter(
      t => t.title.toLowerCase().includes(keyword) && t.costTier === "low" && t.status !== "complete"
    );
    for (const task of matched) {
      if (!smartRiskFlags.some(f => f.taskId === task.id)) {
        smartRiskFlags.push({ level: "critical", message, taskId: task.id, taskTitle: task.title });
      }
    }
  }

  return res.json({
    projectId,
    categorised,
    totalPotentialSaving,
    currentCashRequirement,
    cashRequirementWithSavings,
    operationalRiskScore,
    smartRiskFlags,
    totalItems: items.length,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
