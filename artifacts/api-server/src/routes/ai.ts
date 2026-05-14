import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  fixedCostItemsTable, propertiesTable, financialsTable,
  phasesTable, tasksTable, decisionsTable,
  complianceItemsTable, cqcMilestonesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { getBedhamptonContext, fetchBedhamptonLive } from "./bedhampton";

const router = Router();

const SYSTEM_PROMPT = `You are a specialist senior consultant helping Abi Peters set up a private aesthetics clinic at 9A Jewry Street, Winchester, Hampshire, UK. Target opening: 1 November 2026.

Context:
- Solo practitioner clinic (Advanced Nurse Practitioner) offering aesthetic treatments (injectables, skin treatments, medical-grade skincare retail)
- Self-funded launch, budget-conscious but premium positioning
- CQC registration required as a regulated activity under the Health & Social Care Act 2008
- Winchester city centre location — affluent market, ABC1 demographic, strong female spending power
- Key challenges: finding suitable property, CQC compliance, clinical governance, marketing, financial sustainability

Your role:
- Provide thorough, expert-level analysis and advice — not brief bullet points
- Structure every response with clear section headings (using **bold** or ## headers)
- Go deep on each topic: include specific costs (in GBP with ranges), named organisations, trade bodies, regulatory bodies, and directories to search
- When finding suppliers or contractors: identify Hampshire/South East England specialists first, then national providers — give specific company names where possible, or tell the user exactly how/where to find them
- When giving costs: use realistic 2025/2026 UK market rates. Give low/mid/high estimates. Explain what drives the cost variation
- When recommending contacts: name specific professional bodies (CQC, JCCP, BCAM, RICS, CIMSPA, PHE, ICO, etc.) and what to look for
- Always flag CQC or clinical governance implications and explain the specific regulatory mechanism involved
- When asked for suppliers or quotes: provide 5-8 options with how to contact, vet, and compare them
- Include risks, red flags, and mitigation steps for every recommendation
- A response of 600–1200 words is appropriate for most questions — err on the side of being thorough
- End every response with a clear "Next Steps" section listing 3-5 prioritised immediate actions`;

router.post("/ai/task-research", async (req, res) => {
  const { taskTitle, taskDescription, taskPhase, query } = req.body as {
    taskTitle?: string;
    taskDescription?: string;
    taskPhase?: string;
    query: string;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const taskContext = [
    taskTitle && `Task: ${taskTitle}`,
    taskPhase && `Phase: ${taskPhase}`,
    taskDescription && `Description: ${taskDescription}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userMessage = taskContext
    ? `${taskContext}\n\nQuestion: ${query}`
    : query;

  try {
    const bedhamptonContext = await getBedhamptonContext();
    const systemWithContext = `${SYSTEM_PROMPT}\n\n${bedhamptonContext}`;

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemWithContext },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// ─── POST /api/ai/assess-property-costs ───────────────────────────────────────
// Given a property, AI estimates likely monthly running costs and flags any
// additional cost lines the user may not have considered.
router.post("/ai/assess-property-costs", async (req, res) => {
  const { projectId, propertyId } = req.body as { projectId: number; propertyId?: number };

  // Load property data
  let property: any = null;
  if (propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
    property = p;
  } else {
    // Find active property
    const [p] = await db.select().from(propertiesTable)
      .where(eq(propertiesTable.projectId, projectId));
    property = p;
  }

  // Load existing cost items
  const existingItems = await db.select().from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId));

  const propertyContext = property ? `
Property: ${property.address || "unknown"}, ${property.postcode || ""}
Size: ${property.sqFootage ? `${property.sqFootage} sq ft` : "unknown"}
Monthly rent: ${property.monthlyRentGbp ? `£${property.monthlyRentGbp}` : "unknown"}
Annual business rates: ${property.businessRatesGbp ? `£${property.businessRatesGbp}` : "unknown"}
Monthly service charge: ${property.serviceChargeGbp ? `£${property.serviceChargeGbp}` : "unknown"}
Lease length: ${property.leaseLength || "unknown"}
VAT on rent: ${property.vatOnRent ? "Yes" : "No / unknown"}
Use class: ${property.useClass || "unknown"}
` : "No property selected yet";

  const existingCostContext = existingItems.length > 0
    ? `\nExisting cost items:\n${existingItems.map(i => `- ${i.name}: £${i.amountGbp}/month (${i.costType})`).join("\n")}`
    : "\nNo cost items entered yet.";

  const prompt = `You are a specialist commercial property and business cost advisor for UK aesthetics clinics.

${propertyContext}
${existingCostContext}

This is a solo-practitioner aesthetic clinic (Advanced Nurse Practitioner) opening in a high street commercial premises. The clinic will offer injectable treatments, skin treatments, and medical-grade skincare retail.

Please provide:

1. **Estimated monthly amounts** for each of the existing cost items above that have £0 (use realistic 2025/2026 UK market rates for this type and size of property)

2. **Additional cost lines** the operator may not have considered — specific to this property type, location, and clinic use. For each, provide: name, estimated monthly cost, whether it's unique to Winchester or shared across both clinic locations (dual), and why it's relevant.

Respond in this exact JSON format only, no preamble:
{
  "estimates": [
    { "name": "exact name matching existing item", "estimatedMonthly": 150, "reasoning": "brief explanation" }
  ],
  "additionalCosts": [
    { "name": "cost name", "estimatedMonthly": 50, "costType": "unique|dual", "reasoning": "why this applies" }
  ],
  "flags": [
    "any important financial or compliance flags specific to this property or clinic type"
  ]
}`;

  res.setHeader("Content-Type", "application/json");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Attempt to parse; if JSON is truncated, try to recover a partial result
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Try to recover by finding the last complete top-level key
      const estimates = clean.match(/"estimates"\s*:\s*(\[[\s\S]*?\])/)?.[1];
      const additional = clean.match(/"additionalCosts"\s*:\s*(\[[\s\S]*?\])/)?.[1];
      const flags = clean.match(/"flags"\s*:\s*(\[[\s\S]*?\])/)?.[1];
      parsed = {
        estimates: estimates ? JSON.parse(estimates) : [],
        additionalCosts: additional ? JSON.parse(additional) : [],
        flags: flags ? JSON.parse(flags) : ["Note: AI response was partially truncated — some suggestions may be missing."],
      };
    }
    return res.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return res.status(500).json({ error: msg });
  }
});

// ─── POST /api/projects/:projectId/go-no-go ───────────────────────────────────
// Aggregates all available data and returns a structured launch recommendation.

router.post("/projects/:projectId/go-no-go", async (req, res) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

  // ── Gather all data in parallel ──────────────────────────────────────────
  const [
    phases,
    allPropertiesRaw,
    financialRaw,
    decisionsRaw,
    complianceItemsRaw,
    cqcMilestonesRaw,
    fixedCostsRaw,
    bedhamptonRaw,
  ] = await Promise.all([
    db.select().from(phasesTable).where(eq(phasesTable.projectId, projectId)),
    db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    db.select().from(decisionsTable).where(eq(decisionsTable.projectId, projectId)),
    db.select().from(complianceItemsTable).where(eq(complianceItemsTable.projectId, projectId)),
    db.select().from(cqcMilestonesTable).where(eq(cqcMilestonesTable.projectId, projectId)),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
    fetchBedhamptonLive().catch(() => null),
  ]);

  // ── All tasks across phases ───────────────────────────────────────────────
  const allTasks = (await Promise.all(
    phases.map((p) => db.select().from(tasksTable).where(eq(tasksTable.phaseId, p.id)))
  )).flat();

  const financial = financialRaw[0] ?? null;
  const activeProperty = allPropertiesRaw.find((p) => p.isActiveForProject) ?? allPropertiesRaw[0] ?? null;

  // ── Task summary ─────────────────────────────────────────────────────────
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "complete").length;
  const blockedTasks = allTasks.filter((t) => t.status === "blocked").length;
  const criticalIncomplete = allTasks.filter((t) => t.isCriticalRisk && t.status !== "complete");
  const highRiskIncomplete = allTasks.filter((t) => t.riskLevel === "high" && t.status !== "complete");
  const launchReadinessPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const phaseProgress = phases.map((ph) => {
    const pTasks = allTasks.filter((t) => t.phaseId === ph.id);
    const done = pTasks.filter((t) => t.status === "complete").length;
    return `${ph.name}: ${done}/${pTasks.length} complete (${pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0}%)`;
  });

  // ── Financial context ─────────────────────────────────────────────────────
  let financialContext = "No financial model entered yet.";
  let monthlyFixedCosts = 0;
  let projectedMonthlyRevenue = 0;
  let projectedMonthlyNet = 0;
  let cashRunwayMonths = 0;

  if (financial) {
    const slots = financial.treatmentRoomsCount * financial.practitionerHoursPerDay * financial.workingDaysPerMonth;
    projectedMonthlyRevenue = Math.round((slots * (financial.realisticOccupancyPercent / 100)) * financial.averageClientValueGbp + financial.membershipRevenueGbp);
    monthlyFixedCosts = Math.round(
      financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp + financial.internetGbp +
      financial.insuranceGbp + financial.accountantGbp + financial.softwareGbp +
      financial.wasteContractGbp + financial.cleanerGbp + financial.subscriptionsGbp + financial.financeRepaymentsGbp
    );
    const monthlyVariable = Math.round(projectedMonthlyRevenue * ((financial.stockPercent + financial.commissionsPercent) / 100) + financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp);
    projectedMonthlyNet = projectedMonthlyRevenue - monthlyFixedCosts - monthlyVariable;
    const monthlyCashDrain = financial.personalSalaryNeedsGbp + financial.ownerDrawingsGbp - financial.existingClinicRevenueGbp;
    cashRunwayMonths = monthlyCashDrain > 0 ? Math.round(financial.runwaySavingsGbp / monthlyCashDrain) : 99;

    financialContext = `Winchester Financial Model (Realistic scenario):
• Projected monthly revenue: £${projectedMonthlyRevenue.toLocaleString()} | Monthly fixed costs: £${monthlyFixedCosts.toLocaleString()}
• Projected monthly net profit: £${projectedMonthlyNet.toLocaleString()} | Annual net: £${(projectedMonthlyNet * 12).toLocaleString()}
• Cash runway (pre-opening burn): ${cashRunwayMonths >= 99 ? "Secure (no monthly drain)" : `${cashRunwayMonths} months`}
• Owner drawings target: £${financial.ownerDrawingsGbp}/mo | Nursing income: £${financial.nursingIncomeGbp}/mo
• Treatment rooms: ${financial.treatmentRoomsCount} | Avg client value: £${financial.averageClientValueGbp} | Realistic occupancy: ${financial.realisticOccupancyPercent}%
• Runway savings: £${financial.runwaySavingsGbp.toLocaleString()} | Business capital: £${financial.businessCapitalGbp?.toLocaleString() ?? "not set"}
• Bedhampton existing clinic revenue (in model): £${financial.existingClinicRevenueGbp}/mo`;
  }

  // ── Fixed cost items ──────────────────────────────────────────────────────
  const fixedCostContext = fixedCostsRaw.length > 0
    ? `Fixed cost items entered (${fixedCostsRaw.length} items, total £${fixedCostsRaw.reduce((s, c) => s + (c.amountGbp ?? 0), 0).toLocaleString()}/mo):\n${fixedCostsRaw.map((c) => `• ${c.name}: £${c.amountGbp}/mo (${c.costType})`).join("\n")}`
    : "No detailed fixed cost items entered.";

  // ── Property context ──────────────────────────────────────────────────────
  const propertyContext = activeProperty
    ? `Selected property: ${activeProperty.address || "Unknown"} (${activeProperty.postcode || "no postcode"})
• Size: ${activeProperty.sqFootage || "?"}sqft | Monthly rent: £${activeProperty.monthlyRentGbp || "?"} | Annual rent: £${activeProperty.annualRentGbp || "?"}
• Lease status: ${activeProperty.stage || "not set"} | Use class: ${activeProperty.useClass || "unknown"}
• VAT on rent: ${activeProperty.vatOnRent ? "Yes" : "No/unknown"} | Parking: ${activeProperty.parkingSpaces ?? "?"} spaces
• Notes: ${activeProperty.notes || "none"}`
    : `No property selected yet. ${allPropertiesRaw.length} properties in pipeline.`;

  // ── Compliance context ────────────────────────────────────────────────────
  const applicable = complianceItemsRaw.filter((i) => i.status !== "not_applicable");
  const compliant = applicable.filter((i) => i.status === "complete" || i.policyStatus === "signed_off");
  const compliancePct = applicable.length > 0 ? Math.round((compliant.length / applicable.length) * 100) : 0;
  const cqcStarted = cqcMilestonesRaw.some((m) => m.status !== "not_started");
  const criticalComplianceGaps = applicable.filter((i) => i.status === "not_started" || i.status === "in_progress").slice(0, 5).map((i) => i.title ?? "Unnamed item");

  const complianceContext = `CQC & Compliance:
• Compliance readiness: ${compliancePct}% (${compliant.length}/${applicable.length} items complete)
• CQC registration process: ${cqcStarted ? "Started" : "Not started yet"}
• Critical gaps: ${criticalComplianceGaps.length > 0 ? criticalComplianceGaps.join(", ") : "None identified"}`;

  // ── Decisions context ─────────────────────────────────────────────────────
  const decisionsContext = decisionsRaw.length > 0
    ? `Key decisions logged (${decisionsRaw.length} total):\n${decisionsRaw.slice(-8).map((d) => `• [${d.category}] ${d.title}: ${d.reasoning?.slice(0, 120) ?? ""}`).join("\n")}`
    : "No decisions logged yet.";

  // ── Live Bedhampton data ──────────────────────────────────────────────────
  let bedhContext = "Bedhampton live data unavailable.";
  if (bedhamptonRaw) {
    const { summary, recentMonths } = bedhamptonRaw;
    const avg3m = recentMonths.slice(-3).reduce((s, m) => s + m.revenue, 0) / Math.max(recentMonths.slice(-3).length, 1);
    bedhContext = `Live Bedhampton clinic performance:
• This month: £${Math.round(summary.projectedMonthRevenue).toLocaleString()} projected | Last month: £${Math.round(summary.lastMonthRevenue).toLocaleString()} | Growth: ${summary.revenueGrowthPct > 0 ? "+" : ""}${summary.revenueGrowthPct}%
• 3-month average: £${Math.round(avg3m).toLocaleString()}/month | Total revenue to date: £${Math.round(summary.totalRevenue).toLocaleString()}
• Avg client spend: £${summary.avgClientSpend} | Repeat rate: ${summary.repeatClientPct}%
• Appointments this month: ${summary.appointmentsThisMonth} | Top treatment: ${summary.topTreatment}`;
  }

  // ── Days to opening ───────────────────────────────────────────────────────
  const daysToOpening = Math.ceil((new Date("2026-11-01").getTime() - Date.now()) / 86400000);
  const timelineContext = `Target opening: 1 November 2026 (${daysToOpening} days away)
• Launch readiness: ${launchReadinessPct}% of tasks complete (${completedTasks}/${totalTasks})
• Blocked tasks: ${blockedTasks} | Critical incomplete tasks: ${criticalIncomplete.length}
• High-risk incomplete tasks: ${highRiskIncomplete.length}
• Phase progress:\n  ${phaseProgress.join("\n  ")}`;

  // ── Compose the master prompt ─────────────────────────────────────────────
  const masterPrompt = `You are a senior business consultant and launch advisor. Your job is to assess whether Abi Peters should proceed with opening a private aesthetics clinic at 9A Jewry Street, Winchester, targeting 1 November 2026.

Evaluate ALL of the following data holistically and return a structured JSON recommendation. Be direct, honest, and specific — this is a real business decision with significant personal and financial stakes.

=== TIMELINE ===
${timelineContext}

=== FINANCIAL MODEL ===
${financialContext}

=== DETAILED FIXED COSTS ===
${fixedCostContext}

=== PROPERTY ===
${propertyContext}

=== CQC & COMPLIANCE ===
${complianceContext}

=== LIVE BEDHAMPTON CLINIC (existing business — the financial safety net) ===
${bedhContext}

=== KEY DECISIONS MADE ===
${decisionsContext}

Based on everything above, return ONLY valid JSON in this exact format (no markdown, no preamble):
{
  "verdict": "PROCEED" | "PROCEED_WITH_CONDITIONS" | "DELAY" | "DO_NOT_PROCEED",
  "verdictLabel": "string (e.g. 'Proceed', 'Proceed — with conditions', 'Delay — 3 months', 'Stop and reassess')",
  "confidenceScore": <integer 0-100, your confidence in a successful launch>,
  "summary": "<2-3 substantive paragraph assessment covering: the overall picture, the biggest single risk, and your honest recommendation — be direct>",
  "strengths": ["<specific strength 1, referencing actual data>", "<strength 2>", "<strength 3>", "<strength 4 if warranted>"],
  "concerns": ["<specific concern 1 — use actual numbers>", "<concern 2>", "<concern 3>", "<concern 4 if warranted>"],
  "conditions": ["<condition 1 — only include if verdict is PROCEED_WITH_CONDITIONS or DELAY, else empty array>"],
  "immediateActions": ["<specific action 1 that should happen in the next 30 days>", "<action 2>", "<action 3>", "<action 4>"],
  "reviewTrigger": "<what specific event or metric should trigger a re-run of this analysis>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: masterPrompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { verdict: "DELAY", verdictLabel: "Unable to assess — data incomplete", confidenceScore: 0, summary: clean, strengths: [], concerns: [], conditions: [], immediateActions: [], reviewTrigger: "When more data is entered." };
    }

    return res.json({ ...parsed, generatedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return res.status(500).json({ error: msg });
  }
});

export default router;
