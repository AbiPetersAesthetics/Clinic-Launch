import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, supplierQuotesTable, tasksTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// ─── GET /projects/:projectId/suppliers ──────────────────────────────────────

router.get("/projects/:projectId/suppliers", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid projectId" });

  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.projectId, projectId))
    .orderBy(suppliersTable.category, suppliersTable.name);

  const quotes = await db
    .select()
    .from(supplierQuotesTable)
    .where(eq(supplierQuotesTable.projectId, projectId));

  const quotesBySupplier = new Map<number, typeof quotes>();
  for (const q of quotes) {
    if (!quotesBySupplier.has(q.supplierId)) quotesBySupplier.set(q.supplierId, []);
    quotesBySupplier.get(q.supplierId)!.push(q);
  }

  const result = suppliers.map(s => ({
    ...s,
    quotes: quotesBySupplier.get(s.id) ?? [],
  }));

  return res.json(result);
});

// ─── POST /projects/:projectId/suppliers ─────────────────────────────────────

router.post("/projects/:projectId/suppliers", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid projectId" });

  const { name, category, contactName, phone, email, website, notes, status, linkedTaskId } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }

  const [supplier] = await db
    .insert(suppliersTable)
    .values({
      projectId,
      name: name.trim(),
      category: category ?? "Other",
      contactName: contactName ?? "",
      phone: phone ?? "",
      email: email ?? "",
      website: website ?? "",
      notes: notes ?? "",
      status: status ?? "Researching",
      linkedTaskId: linkedTaskId ?? null,
    })
    .returning();

  return res.status(201).json({ ...supplier, quotes: [] });
});

// ─── GET /projects/:projectId/tasks/:taskId/supplier-quotes ──────────────────

router.get("/projects/:projectId/tasks/:taskId/supplier-quotes", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const taskId = parseInt(req.params.taskId);
  if (isNaN(projectId) || isNaN(taskId)) return res.status(400).json({ error: "Invalid params" });

  const quotes = await db
    .select({
      id: supplierQuotesTable.id,
      supplierId: supplierQuotesTable.supplierId,
      projectId: supplierQuotesTable.projectId,
      taskId: supplierQuotesTable.taskId,
      description: supplierQuotesTable.description,
      amountGbp: supplierQuotesTable.amountGbp,
      vatIncluded: supplierQuotesTable.vatIncluded,
      validUntil: supplierQuotesTable.validUntil,
      status: supplierQuotesTable.status,
      notes: supplierQuotesTable.notes,
      attachmentUrl: supplierQuotesTable.attachmentUrl,
      receivedAt: supplierQuotesTable.receivedAt,
      createdAt: supplierQuotesTable.createdAt,
      updatedAt: supplierQuotesTable.updatedAt,
      supplierName: suppliersTable.name,
      supplierCategory: suppliersTable.category,
    })
    .from(supplierQuotesTable)
    .innerJoin(suppliersTable, eq(supplierQuotesTable.supplierId, suppliersTable.id))
    .where(and(
      eq(supplierQuotesTable.projectId, projectId),
      eq(supplierQuotesTable.taskId, taskId),
    ))
    .orderBy(desc(supplierQuotesTable.createdAt));

  return res.json(quotes);
});

// ─── GET /suppliers/:id ───────────────────────────────────────────────────────

router.get("/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  const quotes = await db
    .select()
    .from(supplierQuotesTable)
    .where(eq(supplierQuotesTable.supplierId, id))
    .orderBy(desc(supplierQuotesTable.createdAt));

  return res.json({ ...supplier, quotes });
});

// ─── PUT /suppliers/:id ───────────────────────────────────────────────────────

router.put("/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const allowed = ["name", "category", "contactName", "phone", "email", "website", "notes", "status", "isFavourited", "linkedTaskId"];
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) patch[key] = req.body[key];
  }

  const [updated] = await db
    .update(suppliersTable)
    .set(patch)
    .where(eq(suppliersTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Supplier not found" });

  const quotes = await db
    .select()
    .from(supplierQuotesTable)
    .where(eq(supplierQuotesTable.supplierId, id))
    .orderBy(desc(supplierQuotesTable.createdAt));

  return res.json({ ...updated, quotes });
});

// ─── DELETE /suppliers/:id ────────────────────────────────────────────────────

router.delete("/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await db.delete(supplierQuotesTable).where(eq(supplierQuotesTable.supplierId, id));
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));

  return res.json({ success: true });
});

// ─── POST /suppliers/:id/quotes ───────────────────────────────────────────────

router.post("/suppliers/:id/quotes", async (req, res) => {
  const supplierId = parseInt(req.params.id);
  if (isNaN(supplierId)) return res.status(400).json({ error: "Invalid supplierId" });

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  const { description, amountGbp, vatIncluded, validUntil, status, notes, attachmentUrl, receivedAt, taskId } = req.body;

  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "description is required" });
  }

  const [quote] = await db
    .insert(supplierQuotesTable)
    .values({
      supplierId,
      projectId: supplier.projectId,
      taskId: taskId != null ? Number(taskId) : null,
      description: description.trim(),
      amountGbp: amountGbp != null ? String(amountGbp) : null,
      vatIncluded: vatIncluded ?? false,
      validUntil: validUntil ?? null,
      status: status ?? "Received",
      notes: notes ?? "",
      attachmentUrl: attachmentUrl ?? "",
      receivedAt: receivedAt ?? null,
    })
    .returning();

  // Update supplier status to Quoted if still Researching or Contacted
  if (supplier.status === "Researching" || supplier.status === "Contacted") {
    await db
      .update(suppliersTable)
      .set({ status: "Quoted", updatedAt: new Date() })
      .where(eq(suppliersTable.id, supplierId));
  }

  // If quote is Accepted and linked to a task, apply the quoted amount as the task's selectedCost
  if (quote.status === "Accepted" && quote.taskId != null && quote.amountGbp != null) {
    const amount = parseFloat(quote.amountGbp);
    if (!isNaN(amount) && amount > 0) {
      await db
        .update(tasksTable)
        .set({ selectedCost: amount, costTier: "quoted", updatedAt: new Date() })
        .where(eq(tasksTable.id, quote.taskId));
    }
  }

  return res.status(201).json(quote);
});

// ─── PUT /quotes/:id ─────────────────────────────────────────────────────────

router.put("/quotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const allowed = ["description", "amountGbp", "vatIncluded", "validUntil", "status", "notes", "attachmentUrl", "receivedAt", "taskId"];
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) {
      if (key === "amountGbp" && req.body[key] != null) {
        patch[key] = String(req.body[key]);
      } else if (key === "taskId") {
        patch[key] = req.body[key] != null ? Number(req.body[key]) : null;
      } else {
        patch[key] = req.body[key];
      }
    }
  }

  const [updated] = await db
    .update(supplierQuotesTable)
    .set(patch)
    .where(eq(supplierQuotesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Quote not found" });

  // If quote is now Accepted and linked to a task, apply the quoted amount as selectedCost
  if (updated.status === "Accepted" && updated.taskId != null && updated.amountGbp != null) {
    const amount = parseFloat(updated.amountGbp);
    if (!isNaN(amount) && amount > 0) {
      await db
        .update(tasksTable)
        .set({ selectedCost: amount, costTier: "quoted", updatedAt: new Date() })
        .where(eq(tasksTable.id, updated.taskId));
    }
  }

  return res.json(updated);
});

// ─── DELETE /quotes/:id ───────────────────────────────────────────────────────

router.delete("/quotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await db.delete(supplierQuotesTable).where(eq(supplierQuotesTable.id, id));
  return res.json({ success: true });
});

// ─── GET /projects/:projectId/suppliers/summary ───────────────────────────────

router.get("/projects/:projectId/suppliers/summary", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid projectId" });

  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.projectId, projectId));

  const quotes = await db
    .select()
    .from(supplierQuotesTable)
    .where(eq(supplierQuotesTable.projectId, projectId));

  const acceptedQuotes = quotes.filter(q => q.status === "Accepted");
  const receivedQuotes = quotes.filter(q => q.status !== "Rejected");

  const totalCommittedGbp = acceptedQuotes.reduce((sum, q) => sum + (parseFloat(q.amountGbp ?? "0") || 0), 0);
  const totalPipelineGbp = receivedQuotes.reduce((sum, q) => sum + (parseFloat(q.amountGbp ?? "0") || 0), 0);

  const byCategory: Record<string, { count: number; quotedCount: number; contractedCount: number }> = {};
  for (const s of suppliers) {
    if (!byCategory[s.category]) byCategory[s.category] = { count: 0, quotedCount: 0, contractedCount: 0 };
    byCategory[s.category].count++;
    if (s.status === "Quoted" || s.status === "Contracted") byCategory[s.category].quotedCount++;
    if (s.status === "Contracted") byCategory[s.category].contractedCount++;
  }

  return res.json({
    totalSuppliers: suppliers.length,
    contractedCount: suppliers.filter(s => s.status === "Contracted").length,
    quotedCount: suppliers.filter(s => s.status === "Quoted").length,
    totalQuotes: quotes.length,
    acceptedQuotes: acceptedQuotes.length,
    totalCommittedGbp: Math.round(totalCommittedGbp),
    totalPipelineGbp: Math.round(totalPipelineGbp),
    byCategory,
  });
});

export default router;
