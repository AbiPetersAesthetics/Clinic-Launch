import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { tasksTable, propertyTaskOverridesTable, phasesTable, propertiesTable, financialsTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";

const router = Router();

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Accepted: PDF, JPG, PNG, WebP"), ok);
  },
});

function getSelectedCost(costTier: string, costLow: number, costMid: number, costHigh: number, currentSelectedCost = 0): number {
  if (costTier === "quoted") return currentSelectedCost; // preserve quote-applied amount
  if (costTier === "low") return costLow;
  if (costTier === "high") return costHigh;
  return costMid;
}

router.get("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.phaseId, phaseId)).orderBy(sql`${tasksTable.dueDate} ASC NULLS LAST, ${tasksTable.sortOrder} ASC`);
  res.json(tasks.map(t => ({ ...t, dependencies: t.dependencies ? JSON.parse(t.dependencies) : [] })));
});

router.post("/phases/:phaseId/tasks", async (req, res) => {
  const phaseId = parseInt(req.params.phaseId);
  const {
    title, description, owner, contractor, supplier,
    status, riskLevel, costTier, costLow, costMid, costHigh,
    dueDate, startDate, durationDays, dependencies, notes,
    isNonNegotiable, isCriticalRisk, sortOrder,
    costVatStatus, supplyScope, procurementStatus,
  } = req.body;

  const tier = costTier ?? "mid";
  const low = costLow ?? 0;
  const mid = costMid ?? 0;
  const high = costHigh ?? 0;

  const [task] = await db.insert(tasksTable).values({
    phaseId,
    title,
    description,
    owner,
    contractor,
    supplier,
    status: status ?? "not_started",
    riskLevel: riskLevel ?? "low",
    costTier: tier,
    costLow: low,
    costMid: mid,
    costHigh: high,
    selectedCost: getSelectedCost(tier, low, mid, high),
    startDate,
    dueDate,
    durationDays,
    dependencies: dependencies ? JSON.stringify(dependencies) : null,
    notes,
    isNonNegotiable: isNonNegotiable ?? false,
    isCriticalRisk: isCriticalRisk ?? false,
    costVatStatus: costVatStatus ?? "vat_unknown",
    supplyScope: supplyScope ?? "to_confirm",
    procurementStatus: procurementStatus ?? "to_specify",
    sortOrder: sortOrder ?? 0,
  }).returning();

  res.status(201).json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
});

router.get("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) return res.status(404).json({ error: "Not found" });
  return res.json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
});

async function handleTaskUpdate(req: import("express").Request, res: import("express").Response) {
  const id = parseInt(req.params["id"] as string);

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const body = req.body;
  const propertyId: number | undefined = body.propertyId ? parseInt(body.propertyId) : undefined;

  // If a propertyId is provided, upsert into property_task_overrides instead of the base task
  if (propertyId) {
    // Fetch existing override FIRST so we can use it as a fallback for selectedCost calculation
    const [existing_override] = await db.select().from(propertyTaskOverridesTable)
      .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));

    // Build a patch containing ONLY the fields explicitly present in the request body.
    // Never write null for fields not in the request — the merge in phases-with-tasks uses
    // `o.field !== undefined ? o.field : t.field`, so a stored null would wipe the base task value.
    const mutableKeys = ["status", "notes", "owner", "contractor", "supplier",
      "costTier", "costLow", "costMid", "costHigh", "startDate", "dueDate", "durationDays", "files", "quotes",
      "costVatStatus", "supplyScope", "procurementStatus",
      "actualCost", "committedCost", "paidStatus", "paymentDate", "invoiceRef", "invoiceDate", "varianceNote", "invoiceVatStatus", "invoiceFileUrl"] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of mutableKeys) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    // Recalculate selectedCost using override → base fallback chain
    const tier = (body.costTier ?? existing_override?.costTier ?? existing.costTier) as string;
    const low = body.costLow ?? existing_override?.costLow ?? existing.costLow;
    const mid = body.costMid ?? existing_override?.costMid ?? existing.costMid;
    const high = body.costHigh ?? existing_override?.costHigh ?? existing.costHigh;
    const currentSelectedCost = body.selectedCost ?? existing_override?.selectedCost ?? existing.selectedCost;
    patch.selectedCost = getSelectedCost(tier, low, mid, high, currentSelectedCost);

    if (existing_override) {
      await db.update(propertyTaskOverridesTable)
        .set(patch)
        .where(and(eq(propertyTaskOverridesTable.propertyId, propertyId), eq(propertyTaskOverridesTable.taskId, id)));
    } else {
      await db.insert(propertyTaskOverridesTable).values({ propertyId, taskId: id, ...patch });
    }

    // Build a synthetic overrideRow for the return value (merges patch over existing override)
    const overrideRow = { ...(existing_override ?? {}), ...patch, propertyId, taskId: id };

    // Global fields (not property-specific) must also be written back to the base task.
    // description, title, riskLevel, isNonNegotiable, isCriticalRisk have no columns in
    // property_task_overrides — without this they are silently dropped on every save.
    const globalUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)           globalUpdates.title = body.title;
    if (body.description !== undefined)     globalUpdates.description = body.description;
    if (body.riskLevel !== undefined)       globalUpdates.riskLevel = body.riskLevel;
    if (body.isNonNegotiable !== undefined) globalUpdates.isNonNegotiable = body.isNonNegotiable;
    if (body.isCriticalRisk !== undefined)  globalUpdates.isCriticalRisk = body.isCriticalRisk;
    if (body.phaseId !== undefined)         globalUpdates.phaseId = body.phaseId;
    if (body.dependencies !== undefined) {
      globalUpdates.dependencies = body.dependencies ? JSON.stringify(body.dependencies) : null;
    }

    const [updatedBase] = await db.update(tasksTable)
      .set(globalUpdates)
      .where(eq(tasksTable.id, id))
      .returning();

    // Return the merged task: base (with global updates) + property override
    const mergedTask = {
      ...(updatedBase ?? existing),
      ...overrideRow,
      dependencies: (updatedBase ?? existing).dependencies
        ? JSON.parse((updatedBase ?? existing).dependencies as string)
        : [],
      _hasOverride: true,
    };
    return res.json(mergedTask);
  }

  // No propertyId — update the base task directly
  const tier = body.costTier ?? existing.costTier;
  const low = body.costLow ?? existing.costLow;
  const mid = body.costMid ?? existing.costMid;
  const high = body.costHigh ?? existing.costHigh;

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  delete updates.propertyId;
  // For "quoted" tier, preserve the quote-set selectedCost unless explicitly overridden
  updates.selectedCost = getSelectedCost(tier, low, mid, high, body.selectedCost ?? existing.selectedCost);

  if (body.dependencies !== undefined) {
    updates.dependencies = body.dependencies ? JSON.stringify(body.dependencies) : null;
  }

  if (body.quotes !== undefined) {
    updates.quotes = body.quotes ?? [];
  }

  const [task] = await db.update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, id))
    .returning();
  if (!task) return res.status(404).json({ error: "Not found" });
  return res.json({ ...task, dependencies: task.dependencies ? JSON.parse(task.dependencies) : [] });
}

router.put("/tasks/:id", handleTaskUpdate);

router.patch("/tasks/:id", handleTaskUpdate);

router.delete("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

// ── POST /tasks/:id/upload-invoice ─────────────────────────────────────────
router.post("/tasks/:id/upload-invoice", invoiceUpload.single("file"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const dir = path.join(process.cwd(), "uploads", "invoices", String(id));
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(req.file.originalname) || ".pdf";
    const filename = `invoice_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(dir, filename), req.file.buffer);

    const fileUrl = `/uploads/invoices/${id}/${filename}`;
    return res.json({ invoiceFileUrl: fileUrl });
  } catch (err) {
    console.error("[upload-invoice]", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// ─── GET /projects/:projectId/project-controls ────────────────────────────────
// Returns planned vs actual vs committed vs forecast, variance, category
// breakdown (by phase), monthly spend array, and task-level actuals list.

router.get("/projects/:projectId/project-controls", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    // Load phases, tasks, overrides, and financial model in parallel
    const [phases, activePropertyRows, modelRows] = await Promise.all([
      db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId)).orderBy(phasesTable.sortOrder),
      db.select().from(propertiesTable).where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true))),
      db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    ]);

    const activePhases = phases.filter(p => p.status === "active");
    const phaseIds = activePhases.map(p => p.id);
    const baseTasks = phaseIds.length > 0
      ? await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phaseIds))
      : [];

    const activeProperty = activePropertyRows[0];
    const overrideMap = new Map<number, Record<string, unknown>>();
    if (activeProperty) {
      const overrides = await db.select().from(propertyTaskOverridesTable)
        .where(eq(propertyTaskOverridesTable.propertyId, activeProperty.id));
      for (const o of overrides) overrideMap.set(o.taskId, o as Record<string, unknown>);
    }

    // Merge overrides onto base tasks, preferring override values
    const allTasks = baseTasks.map(t => {
      const o = overrideMap.get(t.id);
      if (!o) return t as Record<string, unknown>;
      return {
        ...t,
        selectedCost: (o.selectedCost ?? t.selectedCost) as number,
        startDate: o.startDate !== undefined ? o.startDate : (t as any).startDate,
        dueDate: o.dueDate !== undefined ? o.dueDate : t.dueDate,
        actualCost: (o.actualCost ?? (t as any).actualCost) as number | null,
        committedCost: (o.committedCost ?? (t as any).committedCost) as number | null,
        paidStatus: (o.paidStatus ?? (t as any).paidStatus) as string | null,
        paymentDate: (o.paymentDate ?? (t as any).paymentDate) as string | null,
        invoiceRef: (o.invoiceRef ?? (t as any).invoiceRef) as string | null,
        invoiceDate: (o.invoiceDate ?? (t as any).invoiceDate) as string | null,
        varianceNote: (o.varianceNote ?? (t as any).varianceNote) as string | null,
        invoiceVatStatus: (o.invoiceVatStatus ?? (t as any).invoiceVatStatus) as string | null,
        invoiceFileUrl: (o.invoiceFileUrl ?? (t as any).invoiceFileUrl) as string | null,
      } as Record<string, unknown>;
    });

    const model = modelRows[0];
    const davidApprovedCapGbp = (model as any)?.davidApprovedCapGbp ?? 60000;

    // ── Headline totals ────────────────────────────────────────────────────────
    let plannedBudget = 0;
    let actualSpend = 0;
    let committedCosts = 0;
    let forecastFinalCost = 0;
    let reclaimableVat = 0;

    for (const task of allTasks) {
      const planned = (task.selectedCost as number) ?? 0;
      const actual = (task.actualCost as number) ?? 0;
      const committed = (task.committedCost as number) ?? 0;
      const paid = task.paidStatus as string | null;
      const vatStatus = task.invoiceVatStatus as string | null;

      plannedBudget += planned;

      if (paid === "paid" && actual > 0) {
        actualSpend += actual;
        forecastFinalCost += actual;
        // Reclaimable VAT at standard 20% rate
        if (vatStatus === "inc") reclaimableVat += actual / 6;       // 20/120 of gross
        else if (vatStatus === "exc") reclaimableVat += actual * 0.20; // 20% on top
        // "exempt" or null → 0
      } else if (committed > 0) {
        committedCosts += committed;
        forecastFinalCost += committed;
        // Include expected reclaimable on committed costs
        if (vatStatus === "inc") reclaimableVat += committed / 6;
        else if (vatStatus === "exc") reclaimableVat += committed * 0.20;
      } else {
        forecastFinalCost += planned;
      }
    }

    const varianceGbp = forecastFinalCost - plannedBudget;
    const variancePct = plannedBudget > 0 ? (varianceGbp / plannedBudget) * 100 : 0;
    const uncommittedBudget = plannedBudget - actualSpend - committedCosts;
    const capHeadroomGbp = davidApprovedCapGbp - forecastFinalCost;
    const outerLimitGbp = davidApprovedCapGbp * (7 / 6); // stretch zone = +1/6 above cap (e.g. £80k → £93.3k)

    const hasSomeActuals = actualSpend > 0 || committedCosts > 0;
    let budgetStatus = "no_actuals";
    if (hasSomeActuals) {
      if (forecastFinalCost > davidApprovedCapGbp * (7 / 6)) budgetStatus = "over_approved_cap";
      else if (forecastFinalCost > davidApprovedCapGbp) budgetStatus = "stretch";
      else if (variancePct > 5) budgetStatus = "slight_overspend";
      else budgetStatus = "on_track";
    }

    // ── Completion metrics ─────────────────────────────────────────────────────
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === "complete").length;
    const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const spendCompletionPct = forecastFinalCost > 0 ? Math.round((actualSpend / forecastFinalCost) * 100) : 0;
    const weightedCompletionPct = plannedBudget > 0
      ? Math.round(allTasks.filter(t => t.status === "complete").reduce((s, t) => s + ((t.selectedCost as number) ?? 0), 0) / plannedBudget * 100)
      : 0;

    // ── Category breakdown by phase ────────────────────────────────────────────
    const categoryBreakdown = activePhases.map(phase => {
      const phaseTasks = allTasks.filter(t => t.phaseId === phase.id);
      let pPlanned = 0, pActual = 0, pCommitted = 0, pForecast = 0;
      for (const task of phaseTasks) {
        const planned = (task.selectedCost as number) ?? 0;
        const actual = (task.actualCost as number) ?? 0;
        const committed = (task.committedCost as number) ?? 0;
        const paid = task.paidStatus as string | null;
        pPlanned += planned;
        if (paid === "paid" && actual > 0) { pActual += actual; pForecast += actual; }
        else if (committed > 0) { pCommitted += committed; pForecast += committed; }
        else { pForecast += planned; }
      }
      const pVarianceGbp = pForecast - pPlanned;
      const pVariancePct = pPlanned > 0 ? (pVarianceGbp / pPlanned) * 100 : 0;
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        planned: Math.round(pPlanned),
        actualSpend: Math.round(pActual),
        committed: Math.round(pCommitted),
        forecastFinal: Math.round(pForecast),
        varianceGbp: Math.round(pVarianceGbp),
        variancePct: Math.round(pVariancePct * 10) / 10,
        taskCount: phaseTasks.length,
        completedCount: phaseTasks.filter(t => t.status === "complete").length,
      };
    });

    // ── Task actuals (only tasks with recorded spend) ──────────────────────────
    const taskActuals = allTasks
      .filter(t => ((t.actualCost as number) ?? 0) > 0 || ((t.committedCost as number) ?? 0) > 0)
      .map(t => {
        const planned = (t.selectedCost as number) ?? 0;
        const actual = (t.actualCost as number) ?? 0;
        const committed = (t.committedCost as number) ?? 0;
        const paid = t.paidStatus as string | null;
        const effective = paid === "paid" && actual > 0 ? actual : committed > 0 ? committed : planned;
        return {
          taskId: t.id,
          taskTitle: t.title,
          phaseId: t.phaseId,
          plannedCost: Math.round(planned),
          actualCost: Math.round(actual),
          committedCost: Math.round(committed),
          paidStatus: paid,
          invoiceRef: t.invoiceRef,
          invoiceDate: t.invoiceDate,
          invoiceVatStatus: t.invoiceVatStatus,
          paymentDate: t.paymentDate,
          varianceNote: t.varianceNote,
          supplier: t.supplier,
          varianceGbp: Math.round(effective - planned),
          variancePct: planned > 0 ? Math.round(((effective - planned) / planned) * 1000) / 10 : 0,
        };
      });

    // ── Monthly spend breakdown (16-month window: 2 past + 14 future) ─────────
    const today = new Date();
    const monthlySpend: Array<{
      month: string; planned: number; actual: number; committed: number;
      cumPlanned: number; cumActual: number; cumForecast: number;
    }> = [];
    let cumPlanned = 0, cumActual = 0, cumForecast = 0;

    for (let i = -2; i < 14; i++) {
      const mDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthLabel = mDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      let mPlanned = 0, mActual = 0, mCommitted = 0;

      for (const task of allTasks) {
        const planned = (task.selectedCost as number) ?? 0;
        const actual = (task.actualCost as number) ?? 0;
        const committed = (task.committedCost as number) ?? 0;
        const paid = task.paidStatus as string | null;
        const invDate = task.invoiceDate as string | null;
        const schedDate = ((task.startDate as string | null) || (task.dueDate as string | null));

        // Paid actuals → schedule to invoice date
        if (paid === "paid" && actual > 0 && invDate) {
          const d = new Date(invDate);
          if (d.getFullYear() === mDate.getFullYear() && d.getMonth() === mDate.getMonth()) mActual += actual;
        }

        // Committed → schedule to invoice date if set, else startDate
        if (committed > 0) {
          const cDate = invDate || schedDate;
          if (cDate) {
            const d = new Date(cDate);
            if (d.getFullYear() === mDate.getFullYear() && d.getMonth() === mDate.getMonth()) mCommitted += committed;
          }
        }

        // Planned → schedule to startDate / dueDate
        if (planned > 0 && schedDate) {
          const d = new Date(schedDate);
          if (d.getFullYear() === mDate.getFullYear() && d.getMonth() === mDate.getMonth()) mPlanned += planned;
        }
      }

      // Forecast = actual paid + committed + unrecorded planned (subtract planned for tasks with a committed/actual)
      const mForecast = mActual + mCommitted;
      cumPlanned += mPlanned;
      cumActual += mActual;
      cumForecast += mForecast + (mPlanned > mActual + mCommitted ? mPlanned - mActual - mCommitted : 0);

      monthlySpend.push({
        month: monthLabel,
        planned: Math.round(mPlanned),
        actual: Math.round(mActual),
        committed: Math.round(mCommitted),
        cumPlanned: Math.round(cumPlanned),
        cumActual: Math.round(cumActual),
        cumForecast: Math.round(cumForecast),
      });
    }

    return res.json({
      plannedBudget: Math.round(plannedBudget),
      actualSpend: Math.round(actualSpend),
      committedCosts: Math.round(committedCosts),
      forecastFinalCost: Math.round(forecastFinalCost),
      varianceGbp: Math.round(varianceGbp),
      variancePct: Math.round(variancePct * 10) / 10,
      budgetStatus,
      davidApprovedCapGbp,
      reclaimableVat: Math.round(reclaimableVat),
      uncommittedBudget: Math.round(uncommittedBudget),
      capHeadroomGbp: Math.round(capHeadroomGbp),
      outerLimitGbp: Math.round(outerLimitGbp),
      taskCompletionPct,
      spendCompletionPct,
      weightedCompletionPct,
      categoryBreakdown,
      taskActuals,
      monthlySpend,
    });
  } catch (err) {
    console.error("[project-controls]", err);
    return res.status(500).json({ error: "Failed to compute project controls" });
  }
});

export default router;
