import { Router } from "express";
import { db } from "@workspace/db";
import { phasesTable, tasksTable, costOptimisationRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { LaunchTask, CostOptimisationRule } from "@workspace/db";

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

const DEFAULT_RULES: Omit<CostOptimisationRule, "id" | "createdAt" | "projectId">[] = [
  {
    keyword: "solicitor",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: true,
    severityIfAbsent: "critical",
    rationale: "No solicitor provision detected — legal risk is unacceptable for a commercial lease. A solicitor is required for lease review and negotiation.",
    isActive: true,
  },
  {
    keyword: "clinical waste",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: true,
    severityIfAbsent: "critical",
    rationale: "No clinical waste contract detected — CQC compliance requires a registered clinical waste disposal contract before registration.",
    isActive: true,
  },
  {
    keyword: "fire risk",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: true,
    severityIfAbsent: "critical",
    rationale: "No fire risk assessment detected — HSE statutory requirement for all clinical premises.",
    isActive: true,
  },
  {
    keyword: "insurance",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: false,
    severityIfAbsent: "critical",
    rationale: "Insurance on LOW cost tier — inadequate professional indemnity and public liability cover is not acceptable for a clinical business.",
    isActive: true,
  },
  {
    keyword: "electrical",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: false,
    severityIfAbsent: "critical",
    rationale: "Electrical work on LOW cost tier — unsafe installation in a clinical environment creates serious liability and CQC risk.",
    isActive: true,
  },
  {
    keyword: "compliance",
    forceCategory: "dangerous_to_cut",
    isAbsenceCheck: false,
    severityIfAbsent: "warning",
    rationale: "Compliance consultant on LOW cost tier — regulatory shortcuts before CQC registration create unacceptable business risk.",
    isActive: true,
  },
];

async function getOrSeedRules(projectId: number): Promise<CostOptimisationRule[]> {
  const existing = await db.select().from(costOptimisationRulesTable)
    .where(eq(costOptimisationRulesTable.projectId, projectId));

  if (existing.length > 0) return existing;

  // Seed defaults for this project
  const seeded = await db.insert(costOptimisationRulesTable).values(
    DEFAULT_RULES.map(r => ({ ...r, projectId }))
  ).returning();
  return seeded;
}

function deriveCategory(task: LaunchTask): { category: OptimisationCategory; potentialSavingGbp: number; rationale: string } {
  const isCritical = task.isCriticalRisk;
  const isNonNeg = task.isNonNegotiable;
  const tier = task.costTier;
  const risk = task.riskLevel;

  if ((isCritical || isNonNeg) && tier === "low") {
    return {
      category: "dangerous_to_cut",
      potentialSavingGbp: 0,
      rationale: isNonNeg
        ? "Non-negotiable task on LOW cost tier — this creates unacceptable risk. Upgrade to MID or HIGH immediately."
        : "Critical risk task on LOW cost tier — safety/compliance is compromised. Increase budget.",
    };
  }

  if (isNonNeg) {
    return {
      category: "non_negotiable",
      potentialSavingGbp: 0,
      rationale: "This cost cannot be reduced. It is operationally or legally mandated.",
    };
  }

  if (risk === "high" && tier === "low" && !isCritical) {
    return {
      category: "dangerous_to_cut",
      potentialSavingGbp: 0,
      rationale: "High-risk item on LOW cost tier — cost-cutting here creates significant operational risk.",
    };
  }

  if (risk === "low" && tier === "high" && !isCritical && !isNonNeg) {
    const saving = Math.round(task.selectedCost - task.costLow);
    return {
      category: "luxury_item",
      potentialSavingGbp: Math.max(0, saving),
      rationale: `Low-risk task on HIGH cost tier. Switch to LOW to save approximately ${saving > 0 ? `£${saving.toLocaleString()}` : "some cost"}.`,
    };
  }

  if (tier === "high" && !isCritical && !isNonNeg && risk !== "high") {
    const saving = Math.round(task.selectedCost - task.costMid);
    return {
      category: "safe_to_reduce",
      potentialSavingGbp: Math.max(0, saving),
      rationale: `Currently on HIGH cost tier. Switching to MID could save approximately £${Math.max(0, saving).toLocaleString()}.`,
    };
  }

  if (task.status === "not_started" && risk === "low" && !isCritical && !isNonNeg) {
    return {
      category: "delayable",
      potentialSavingGbp: Math.round(task.selectedCost),
      rationale: "Not yet started and low risk. Could be deferred to preserve launch cash flow.",
    };
  }

  return {
    category: "operationally_critical",
    potentialSavingGbp: 0,
    rationale: "Core operational cost. Required for launch with no safe reduction path.",
  };
}

function applyRuleOverrides(
  task: LaunchTask,
  derived: ReturnType<typeof deriveCategory>,
  rules: CostOptimisationRule[]
): ReturnType<typeof deriveCategory> {
  const titleLower = task.title.toLowerCase();
  for (const rule of rules) {
    if (!rule.isActive || rule.isAbsenceCheck) continue;
    if (!titleLower.includes(rule.keyword.toLowerCase())) continue;
    // Rule matches — if task is on LOW tier, override category + rationale
    if (task.costTier === "low" && rule.forceCategory) {
      return {
        category: rule.forceCategory as OptimisationCategory,
        potentialSavingGbp: 0,
        rationale: rule.rationale,
      };
    }
  }
  return derived;
}

router.get("/projects/:projectId/optimisation-analysis", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId));
  const phaseMap = new Map(phases.map(p => [p.id, p.name]));

  const allTasks = (await Promise.all(
    phases.map(p => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id)))
  )).flat();

  const rules = await getOrSeedRules(projectId);
  const activeRules = rules.filter(r => r.isActive);

  const incompleteTasks = allTasks.filter(t => t.status !== "complete");

  const items: OptimisationItem[] = incompleteTasks.map(task => {
    const derived = deriveCategory(task);
    const final = applyRuleOverrides(task, derived, activeRules);
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
      category: final.category,
      potentialSavingGbp: final.potentialSavingGbp,
      rationale: final.rationale,
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
  const currentCashRequirement = incompleteTasks.reduce((sum, t) => sum + t.selectedCost, 0);
  const cashRequirementWithSavings = Math.max(0, currentCashRequirement - totalPotentialSaving);

  const dangerousCount = categorised.dangerous_to_cut.length;
  const highRiskCount = incompleteTasks.filter(t => t.riskLevel === "high" || t.riskLevel === "critical").length;
  const criticalCount = incompleteTasks.filter(t => t.isCriticalRisk).length;
  const operationalRiskScore = Math.min(100, Math.round(
    dangerousCount * 15 + highRiskCount * 5 + criticalCount * 8
  ));

  const smartRiskFlags: SmartRiskFlag[] = [];

  // Dangerous-to-cut items
  for (const item of categorised.dangerous_to_cut) {
    smartRiskFlags.push({
      level: "critical",
      message: item.rationale,
      taskId: item.taskId,
      taskTitle: item.taskTitle,
    });
  }

  // Absence checks: for each absence rule, flag if NO incomplete task matches the keyword
  const incompleteTitles = incompleteTasks.map(t => t.title.toLowerCase());
  for (const rule of activeRules) {
    if (!rule.isAbsenceCheck) continue;
    const found = incompleteTitles.some(title => title.includes(rule.keyword.toLowerCase()));
    if (!found) {
      smartRiskFlags.push({
        level: rule.severityIfAbsent as "warning" | "critical",
        message: rule.rationale,
      });
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
