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

  // ── Gather all data in parallel ───────────────────────────────────────────
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
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const blockedTasks = allTasks.filter((t) => t.status === "blocked").length;
  const criticalIncomplete = allTasks.filter((t) => t.isCriticalRisk && t.status !== "complete");
  const highRiskIncomplete = allTasks.filter((t) => t.riskLevel === "high" && t.status !== "complete");
  const launchReadinessPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const phaseProgress = phases.map((ph) => {
    const pTasks = allTasks.filter((t) => t.phaseId === ph.id);
    const done = pTasks.filter((t) => t.status === "complete").length;
    const blocked = pTasks.filter((t) => t.status === "blocked").length;
    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
    return `${ph.name}: ${done}/${pTasks.length} complete (${pct}%)${blocked > 0 ? ` — ${blocked} blocked` : ""}`;
  });

  const criticalTaskList = criticalIncomplete.slice(0, 6).map((t) => `  • [${t.status}] ${t.title}`).join("\n");

  // ── Financial calculations for all 3 scenarios ───────────────────────────
  function calcScenario(occupancyPct: number, acv: number, f: NonNullable<typeof financial>) {
    const slotsPerMonth = f.treatmentRoomsCount * f.practitionerHoursPerDay * f.workingDaysPerMonth;
    const revenue = Math.round((slotsPerMonth * (occupancyPct / 100)) * acv + f.membershipRevenueGbp);
    const fixed = Math.round(
      f.rentGbp + f.ratesGbp + f.utilitiesGbp + f.internetGbp +
      f.insuranceGbp + f.accountantGbp + f.softwareGbp +
      f.wasteContractGbp + f.cleanerGbp + f.subscriptionsGbp + f.financeRepaymentsGbp
    );
    const variableRate = (f.stockPercent + f.commissionsPercent) / 100;
    const variable = Math.round(revenue * variableRate + f.marketingGbp + f.staffingGbp + f.consumablesGbp);
    const net = revenue - fixed - variable;
    return { revenue, fixed, variable, net, occupancyPct, acv };
  }

  let financialContext = "No financial model entered yet.";
  let cashRunwayMonths = 0;
  let rentToRevenuePct = 0;
  let breakEvenRevenue = 0;
  let vatRisk = false;
  let vatRiskDetail = "";
  let bedhCoverageMonths = 0;

  if (financial) {
    const conservative = calcScenario(financial.conservativeOccupancyPercent, financial.averageClientValueGbp, financial);
    const realistic = calcScenario(financial.realisticOccupancyPercent, financial.averageClientValueGbp, financial);
    const aggressive = calcScenario(financial.aggressiveOccupancyPercent, financial.wincAcvGbp || financial.averageClientValueGbp, financial);

    // Break-even: fixed costs / (1 - variable cost %)
    const variableRatio = (financial.stockPercent + financial.commissionsPercent) / 100;
    breakEvenRevenue = Math.round(realistic.fixed / (1 - variableRatio));

    // Cash runway pre-opening
    const monthlyCashDrain = (financial.personalSalaryNeedsGbp + financial.ownerDrawingsGbp)
      - (financial.existingClinicRevenueGbp + financial.nursingIncomeGbp);
    cashRunwayMonths = monthlyCashDrain > 0 ? Math.round(financial.runwaySavingsGbp / monthlyCashDrain) : 99;

    // Rent as % of realistic revenue
    rentToRevenuePct = realistic.revenue > 0 ? Math.round((financial.rentGbp / realistic.revenue) * 100) : 0;

    // VAT risk: current turnover + projected Winchester annual revenue vs £90k
    const projectedAnnualWinc = realistic.revenue * 12;
    const combinedTurnover = (financial.vatCurrentTurnoverGbp || 0) + projectedAnnualWinc;
    vatRisk = combinedTurnover > 85000;
    vatRiskDetail = vatRisk
      ? `ALERT: Combined turnover (£${Math.round(combinedTurnover / 1000)}k) likely exceeds £90k VAT threshold — mandatory VAT registration will add ~20% to client prices unless exempt treatments dominate`
      : `Combined annual turnover (£${Math.round(combinedTurnover / 1000)}k) is below the £90k VAT threshold`;

    // Bedhampton coverage: how many months of Winchester fixed costs does Bedh revenue cover
    bedhCoverageMonths = financial.existingClinicRevenueGbp > 0 && realistic.fixed > 0
      ? parseFloat((financial.existingClinicRevenueGbp / realistic.fixed * 12).toFixed(1))
      : 0;

    financialContext = `=== THREE-SCENARIO FINANCIAL MODEL ===

Conservative (${financial.conservativeOccupancyPercent}% occupancy, £${financial.averageClientValueGbp} ACV):
  Revenue: £${conservative.revenue.toLocaleString()}/mo | Fixed: £${conservative.fixed.toLocaleString()}/mo | Variable: £${conservative.variable.toLocaleString()}/mo | Net: £${conservative.net.toLocaleString()}/mo

Realistic (${financial.realisticOccupancyPercent}% occupancy, £${financial.averageClientValueGbp} ACV):
  Revenue: £${realistic.revenue.toLocaleString()}/mo | Fixed: £${realistic.fixed.toLocaleString()}/mo | Variable: £${realistic.variable.toLocaleString()}/mo | Net: £${realistic.net.toLocaleString()}/mo

Aggressive (${financial.aggressiveOccupancyPercent}% occupancy, £${(financial.wincAcvGbp || financial.averageClientValueGbp)} ACV):
  Revenue: £${aggressive.revenue.toLocaleString()}/mo | Fixed: £${aggressive.fixed.toLocaleString()}/mo | Variable: £${aggressive.variable.toLocaleString()}/mo | Net: £${aggressive.net.toLocaleString()}/mo

Key ratios (Realistic scenario):
  Break-even revenue needed: £${breakEvenRevenue.toLocaleString()}/mo
  Rent as % of revenue: ${rentToRevenuePct}% (industry guideline: aim for <15%)
  Treatment rooms: ${financial.treatmentRoomsCount} | Avg client value: £${financial.averageClientValueGbp} | Winchester ACV target: £${financial.wincAcvGbp || "not set"}
  Practitioner hours/day: ${financial.practitionerHoursPerDay} | Working days/mo: ${financial.workingDaysPerMonth}

Personal finance:
  Owner drawings target: £${financial.ownerDrawingsGbp}/mo | Personal salary needs: £${financial.personalSalaryNeedsGbp}/mo
  Nursing income: £${financial.nursingIncomeGbp}/mo | Cash runway savings: £${financial.runwaySavingsGbp.toLocaleString()}
  Pre-opening cash runway: ${cashRunwayMonths >= 99 ? "Secure (income exceeds burn)" : `${cashRunwayMonths} months`}
  Bedhampton income in model: £${financial.existingClinicRevenueGbp}/mo
  Bedhampton coverage of Winchester fixed costs: ${bedhCoverageMonths > 0 ? `${bedhCoverageMonths} months of fixed costs covered per year` : "not calculated"}
  Self-funding buffer target: ${financial.selfFundingBufferPercent}% net margin

VAT risk:
  ${vatRiskDetail}

Membership revenue: £${financial.membershipRevenueGbp}/mo | Repeat booking rate: ${financial.repeatBookingRatePercent}%`;
  }

  // ── Fixed cost itemisation ────────────────────────────────────────────────
  const totalFixedItemsCost = fixedCostsRaw.reduce((s, c) => s + (c.amountGbp ?? 0), 0);
  const fixedCostContext = fixedCostsRaw.length > 0
    ? `Itemised fixed costs (${fixedCostsRaw.length} items, £${totalFixedItemsCost.toLocaleString()}/mo total):\n${fixedCostsRaw.map((c) => `  • ${c.name}: £${c.amountGbp}/mo (${c.costType})`).join("\n")}`
    : "No itemised fixed costs entered yet — financial model uses category totals only.";

  // ── Property context ──────────────────────────────────────────────────────
  const allPropertyLines = allPropertiesRaw.map((p) =>
    `  ${p.isActiveForProject ? "★ SELECTED" : "○"} ${p.address || "Unknown"} (${p.postcode || "?"}): £${p.monthlyRentGbp || "?"}/mo | ${p.sqFootage || "?"}sqft | Stage: ${p.stage || "unknown"} | Use class: ${p.useClass || "?"} | VAT on rent: ${p.vatOnRent ? "Yes" : "No/unknown"}`
  ).join("\n");

  const propertyContext = allPropertiesRaw.length > 0
    ? `${allPropertiesRaw.length} properties in pipeline:\n${allPropertyLines}\n\nActive property notes: ${activeProperty?.notes || "none"}`
    : "No properties added yet.";

  // ── Compliance context ────────────────────────────────────────────────────
  const applicable = complianceItemsRaw.filter((i) => i.status !== "not_applicable");
  const compliant = applicable.filter((i) => i.status === "complete" || i.policyStatus === "signed_off");
  const complianceGaps = applicable.filter((i) => i.status === "not_started" || i.status === "in_progress");
  const compliancePct = applicable.length > 0 ? Math.round((compliant.length / applicable.length) * 100) : 0;
  const cqcNotStarted = cqcMilestonesRaw.filter((m) => m.status === "not_started");
  const cqcInProgress = cqcMilestonesRaw.filter((m) => m.status === "in_progress");
  const cqcComplete = cqcMilestonesRaw.filter((m) => m.status === "complete");

  const complianceContext = `CQC registration milestones: ${cqcComplete.length} complete | ${cqcInProgress.length} in progress | ${cqcNotStarted.length} not started
Compliance items: ${compliancePct}% complete (${compliant.length}/${applicable.length} items)
Outstanding compliance gaps (first 8):
${complianceGaps.slice(0, 8).map((i) => `  • [${i.status}] ${i.title ?? "Unnamed"}`).join("\n") || "  None"}
CQC milestones not yet started (first 5): ${cqcNotStarted.slice(0, 5).map((m) => m.title ?? "Unnamed").join(", ") || "None"}`;

  // ── Decisions context ─────────────────────────────────────────────────────
  const decisionsContext = decisionsRaw.length > 0
    ? `${decisionsRaw.length} strategic decisions logged:\n${decisionsRaw.slice(-10).map((d) => `  • [${d.category}] ${d.title}: ${(d.reasoning ?? "").slice(0, 150)}`).join("\n")}`
    : "No strategic decisions logged yet.";

  // ── Live Bedhampton data ──────────────────────────────────────────────────
  let bedhContext = "Live Bedhampton data unavailable.";
  if (bedhamptonRaw) {
    const { summary, recentMonths } = bedhamptonRaw;
    const avg3m = recentMonths.slice(-3).reduce((s, m) => s + m.revenue, 0) / Math.max(recentMonths.slice(-3).length, 1);
    const avg6m = recentMonths.slice(-6).reduce((s, m) => s + m.revenue, 0) / Math.max(recentMonths.slice(-6).length, 1);
    const revTrend = recentMonths.slice(-6).map((m) => {
      const [y, mo] = m.month.split("-");
      const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      return `${label}: £${Math.round(m.revenue).toLocaleString()}`;
    }).join(" → ");

    bedhContext = `Abi's existing Bedhampton clinic — the financial safety net for Winchester:
  This month (projected): £${Math.round(summary.projectedMonthRevenue).toLocaleString()} | Last month: £${Math.round(summary.lastMonthRevenue).toLocaleString()} | MoM growth: ${summary.revenueGrowthPct > 0 ? "+" : ""}${summary.revenueGrowthPct}%
  3-month average: £${Math.round(avg3m).toLocaleString()}/mo | 6-month average: £${Math.round(avg6m).toLocaleString()}/mo
  Total revenue to date: £${Math.round(summary.totalRevenue).toLocaleString()}
  Avg client spend: £${summary.avgClientSpend} | Repeat client rate: ${summary.repeatClientPct}%
  Appointments this month: ${summary.appointmentsThisMonth} | Top treatment: ${summary.topTreatment}
  Revenue trend: ${revTrend}`;
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  const daysToOpening = Math.ceil((new Date("2026-11-01").getTime() - Date.now()) / 86400000);
  const weeksToOpening = Math.round(daysToOpening / 7);
  const timelineContext = `Target opening: 1 November 2026 — ${daysToOpening} days (${weeksToOpening} weeks) away
Overall launch readiness: ${launchReadinessPct}% (${completedTasks} of ${totalTasks} tasks complete, ${inProgressTasks} in progress, ${blockedTasks} blocked)
Critical incomplete tasks: ${criticalIncomplete.length}
${criticalTaskList || "  None flagged"}
High-risk incomplete tasks: ${highRiskIncomplete.length}
Phase-by-phase progress:
  ${phaseProgress.join("\n  ")}`;

  // ── Master prompt ─────────────────────────────────────────────────────────
  const masterPrompt = `You are a senior healthcare business consultant and launch advisor with deep expertise in UK private aesthetics clinics, CQC regulation, and SME financial planning. Your client is Abi Peters, a qualified aesthetics practitioner opening her first dedicated clinic at 9A Jewry Street, Winchester, targeting 1 November 2026.

This is a high-stakes, real business decision. Abi has put personal savings and professional reputation on the line. Be thorough, honest, and specific. Do not hedge excessively — give her a clear verdict she can act on.

Analyse ALL the data below across five dimensions: Financial Viability, Regulatory Readiness, Operational Preparedness, Timeline Risk, and Market/Strategic Position. Then return a structured JSON assessment.

=== DIMENSION 1: TIMELINE & TASK READINESS ===
${timelineContext}

=== DIMENSION 2: FINANCIAL MODEL (ALL 3 SCENARIOS) ===
${financialContext}

=== DIMENSION 3: FIXED COST DETAIL ===
${fixedCostContext}

=== DIMENSION 4: PROPERTY PIPELINE ===
${propertyContext}

=== DIMENSION 5: CQC & REGULATORY COMPLIANCE ===
${complianceContext}

=== DIMENSION 6: LIVE BEDHAMPTON CLINIC (existing revenue base — critical financial safety net) ===
${bedhContext}

=== DIMENSION 7: STRATEGIC DECISIONS MADE ===
${decisionsContext}

=== COMPUTED METRICS (pre-calculated for you) ===
• Break-even monthly revenue: £${breakEvenRevenue.toLocaleString() || "unknown"}
• Rent as % of realistic revenue: ${rentToRevenuePct}%
• Cash runway pre-opening: ${cashRunwayMonths >= 99 ? "secure" : `${cashRunwayMonths} months`}
• VAT risk: ${vatRisk ? "HIGH" : "LOW"} — ${vatRiskDetail}
• Bedhampton income coverage of Winchester fixed costs: ${bedhCoverageMonths > 0 ? `${bedhCoverageMonths} months/yr` : "unknown"}
• Days to opening: ${daysToOpening}

Return ONLY valid JSON (no markdown, no commentary outside the JSON). Use this exact schema:
{
  "verdict": "PROCEED" | "PROCEED_WITH_CONDITIONS" | "DELAY" | "DO_NOT_PROCEED",
  "verdictLabel": "<concise verdict label, e.g. 'Proceed with conditions — 4 must-dos before signing lease'>",
  "confidenceScore": <integer 0-100: probability of a successful, viable launch>,
  "executiveSummary": "<1 crisp paragraph: the overall picture, the single biggest risk, and your bottom-line recommendation>",
  "detailedAssessment": {
    "financial": "<2-3 sentences: assess all 3 scenarios, break-even, runway, VAT risk, rent burden — use real numbers>",
    "regulatory": "<2-3 sentences: CQC registration urgency, compliance gaps that could delay opening, realistic timeline to full compliance>",
    "operational": "<2-3 sentences: property status, task readiness, blocked items, what could derail launch operationally>",
    "timeline": "<2-3 sentences: is ${daysToOpening} days enough? what's the critical path? where is slack being burned?>",
    "strategic": "<2 sentences: Bedhampton as safety net, market positioning, long-term viability assessment>"
  },
  "riskScores": {
    "financial": <1-10 where 10 = extremely high risk>,
    "regulatory": <1-10>,
    "operational": <1-10>,
    "timeline": <1-10>,
    "overall": <1-10>
  },
  "riskRationale": {
    "financial": "<one sentence explaining the financial risk score>",
    "regulatory": "<one sentence>",
    "operational": "<one sentence>",
    "timeline": "<one sentence>"
  },
  "strengths": [
    "<specific strength 1 — cite actual numbers from the data>",
    "<strength 2>",
    "<strength 3>",
    "<strength 4>",
    "<strength 5 if genuinely warranted>"
  ],
  "concerns": [
    "<specific concern 1 — use actual numbers, be precise>",
    "<concern 2>",
    "<concern 3>",
    "<concern 4>",
    "<concern 5 if genuinely warranted>"
  ],
  "conditions": [
    "<non-negotiable condition 1 — only if verdict is PROCEED_WITH_CONDITIONS or DELAY>",
    "<condition 2>"
  ],
  "immediateActions": [
    { "action": "<specific action>", "priority": "critical" | "high" | "medium", "deadline": "<e.g. 'Within 2 weeks', 'Before lease signing', 'By end of June'>", "rationale": "<one sentence why this matters>" },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." }
  ],
  "thirtyDayPlan": [
    { "week": "Week 1", "focus": "<theme>", "actions": ["<action 1>", "<action 2>", "<action 3>"] },
    { "week": "Week 2", "focus": "<theme>", "actions": ["<action 1>", "<action 2>", "<action 3>"] },
    { "week": "Week 3", "focus": "<theme>", "actions": ["<action 1>", "<action 2>", "<action 3>"] },
    { "week": "Week 4", "focus": "<theme>", "actions": ["<action 1>", "<action 2>", "<action 3>"] }
  ],
  "reviewTrigger": "<specific event or metric threshold that should trigger re-running this analysis>",
  "nextReviewDate": "<ISO 8601 date — suggest a concrete date for the next formal review>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 5000,
      messages: [{ role: "user", content: masterPrompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        verdict: "DELAY",
        verdictLabel: "Unable to assess — try again",
        confidenceScore: 0,
        executiveSummary: clean.slice(0, 500),
        detailedAssessment: {},
        riskScores: { financial: 5, regulatory: 5, operational: 5, timeline: 5, overall: 5 },
        riskRationale: {},
        strengths: [],
        concerns: [],
        conditions: [],
        immediateActions: [],
        thirtyDayPlan: [],
        reviewTrigger: "When more project data is entered.",
        nextReviewDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      };
    }

    // Also pass computed metrics back so the UI can display them without re-computing
    return res.json({
      ...parsed,
      _computed: {
        breakEvenRevenue,
        rentToRevenuePct,
        cashRunwayMonths,
        vatRisk,
        vatRiskDetail,
        bedhCoverageMonths,
        daysToOpening,
        launchReadinessPct,
        compliancePct,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return res.status(500).json({ error: msg });
  }
});

export default router;
