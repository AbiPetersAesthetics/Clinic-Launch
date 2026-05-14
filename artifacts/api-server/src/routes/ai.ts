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
  // NOTE: This analysis is about whether to proceed with property negotiation
  // and heads of terms — NOT about launch readiness. Task/phase/CQC data is
  // intentionally excluded; that will be planned after the property decision.
  const [
    allPropertiesRaw,
    financialRaw,
    decisionsRaw,
    fixedCostsRaw,
    bedhamptonRaw,
  ] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    db.select().from(decisionsTable).where(eq(decisionsTable.projectId, projectId)),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
    fetchBedhamptonLive().catch(() => null),
  ]);

  const financial = financialRaw[0] ?? null;
  const activeProperty = allPropertiesRaw.find((p) => p.isActiveForProject) ?? allPropertiesRaw[0] ?? null;

  // Dynamic property label used throughout prompts — never hardcode location name
  const propertyLabel = activeProperty
    ? [activeProperty.address, activeProperty.postcode].filter(Boolean).join(", ")
    : "selected property";
  const propertyTown = activeProperty?.postcode?.split(" ")[0] || activeProperty?.address?.split(",").at(-2)?.trim() || "the selected location";

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

    financialContext = `=== THREE-SCENARIO FINANCIAL MODEL (for ${propertyLabel}) ===

Conservative (${financial.conservativeOccupancyPercent}% occupancy, £${financial.averageClientValueGbp} ACV):
  Revenue: £${conservative.revenue.toLocaleString()}/mo | Fixed: £${conservative.fixed.toLocaleString()}/mo | Variable: £${conservative.variable.toLocaleString()}/mo | Net: £${conservative.net.toLocaleString()}/mo

Realistic (${financial.realisticOccupancyPercent}% occupancy, £${financial.averageClientValueGbp} ACV):
  Revenue: £${realistic.revenue.toLocaleString()}/mo | Fixed: £${realistic.fixed.toLocaleString()}/mo | Variable: £${realistic.variable.toLocaleString()}/mo | Net: £${realistic.net.toLocaleString()}/mo

Aggressive (${financial.aggressiveOccupancyPercent}% occupancy, £${(financial.wincAcvGbp || financial.averageClientValueGbp)} ACV):
  Revenue: £${aggressive.revenue.toLocaleString()}/mo | Fixed: £${aggressive.fixed.toLocaleString()}/mo | Variable: £${aggressive.variable.toLocaleString()}/mo | Net: £${aggressive.net.toLocaleString()}/mo

Key ratios (Realistic scenario):
  Break-even revenue needed: £${breakEvenRevenue.toLocaleString()}/mo
  Rent as % of revenue: ${rentToRevenuePct}% (industry guideline: aim for <15%)
  Treatment rooms: ${financial.treatmentRoomsCount} | Avg client value: £${financial.averageClientValueGbp} | Target ACV (new clinic): £${financial.wincAcvGbp || "not set"}
  Practitioner hours/day: ${financial.practitionerHoursPerDay} | Working days/mo: ${financial.workingDaysPerMonth}

Personal finance:
  Owner drawings target: £${financial.ownerDrawingsGbp}/mo | Personal salary needs: £${financial.personalSalaryNeedsGbp}/mo
  Nursing income: £${financial.nursingIncomeGbp}/mo | Cash runway savings: £${financial.runwaySavingsGbp.toLocaleString()}
  Pre-opening cash runway: ${cashRunwayMonths >= 99 ? "Secure (income exceeds burn)" : `${cashRunwayMonths} months`}
  Bedhampton income in model: £${financial.existingClinicRevenueGbp}/mo
  Bedhampton coverage of new clinic fixed costs: ${bedhCoverageMonths > 0 ? `${bedhCoverageMonths} months of fixed costs covered per year` : "not calculated"}
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

    bedhContext = `Abi's existing Bedhampton clinic — the financial safety net for the new clinic:
  This month (projected): £${Math.round(summary.projectedMonthRevenue).toLocaleString()} | Last month: £${Math.round(summary.lastMonthRevenue).toLocaleString()} | MoM growth: ${summary.revenueGrowthPct > 0 ? "+" : ""}${summary.revenueGrowthPct}%
  3-month average: £${Math.round(avg3m).toLocaleString()}/mo | 6-month average: £${Math.round(avg6m).toLocaleString()}/mo
  Total revenue to date: £${Math.round(summary.totalRevenue).toLocaleString()}
  Avg client spend: £${summary.avgClientSpend} | Repeat client rate: ${summary.repeatClientPct}%
  Appointments this month: ${summary.appointmentsThisMonth} | Top treatment: ${summary.topTreatment}
  Revenue trend: ${revTrend}`;
  }

  const daysToOpening = Math.ceil((new Date("2026-11-01").getTime() - Date.now()) / 86400000);

  // ── Master prompt ─────────────────────────────────────────────────────────
  const masterPrompt = `You are a senior commercial property and business finance advisor specialising in UK healthcare and aesthetics SMEs. Your client is Abi Peters, a qualified aesthetics practitioner who runs a successful clinic in Bedhampton, Hampshire.

THE DECISION IN FRONT OF HER: Should she proceed into active property negotiation and agree heads of terms for a clinic space at ${propertyLabel}, targeting an opening of 1 November 2026?

IMPORTANT FRAMING: This is NOT a launch readiness check. Do not assess CQC compliance progress, task lists, or operational preparation — those will be planned once the property decision is made. Focus entirely on: (1) whether the financial model stacks up against this property, (2) whether the property terms are commercially sound, (3) whether her personal financial position supports the commitment, and (4) whether the market opportunity at this location justifies the risk.

Be direct, specific, and commercial. Cite real numbers. Do not hedge excessively — she needs a clear answer she can act on this week.

=== FINANCIAL MODEL (all 3 scenarios, pre-calculated) ===
${financialContext}

=== ITEMISED FIXED COSTS ===
${fixedCostContext}

=== PROPERTY PIPELINE ===
${propertyContext}

=== LIVE BEDHAMPTON CLINIC PERFORMANCE (her existing business — the financial safety net) ===
${bedhContext}

=== STRATEGIC DECISIONS ALREADY MADE ===
${decisionsContext}

=== KEY COMPUTED RATIOS ===
• Break-even monthly revenue (${propertyLabel}): £${breakEvenRevenue.toLocaleString() || "not calculated"}
• Rent as % of realistic monthly revenue: ${rentToRevenuePct}% (healthy = <15%, stretched = >20%)
• Personal cash runway (savings covering living costs pre-opening): ${cashRunwayMonths >= 99 ? "secure — income exceeds outgoings" : `${cashRunwayMonths} months`}
• VAT threshold risk: ${vatRisk ? "HIGH" : "LOW"} — ${vatRiskDetail}
• Bedhampton income covers ${bedhCoverageMonths > 0 ? `${bedhCoverageMonths} months of new clinic fixed costs per year` : "unknown — set Bedhampton revenue in financial model"}
• Days until target opening: ${daysToOpening}

Return ONLY valid JSON (no markdown, no text outside the JSON object). Schema:
{
  "verdict": "PROCEED" | "PROCEED_WITH_CONDITIONS" | "DELAY" | "DO_NOT_PROCEED",
  "verdictLabel": "<concise label, e.g. 'Proceed to negotiation — 3 must-dos first' or 'Strong proceed — financials support it'>",
  "confidenceScore": <integer 0-100: your confidence the new clinic at this property will be financially viable if she signs>,
  "executiveSummary": "<1-2 crisp paragraphs: does the financial model support committing to this property at this rent? What is the single biggest commercial risk? What is your clear recommendation — use numbers>",
  "detailedAssessment": {
    "financial": "<2-3 sentences on the three scenarios: which is realistic given Bedhampton's current trajectory, what the break-even occupancy looks like, and whether the numbers justify the rent commitment — cite figures>",
    "property": "<2-3 sentences on the property terms: is the rent commercially reasonable for this location? What terms matter most in heads of terms negotiations? What should she push back on or clarify before signing?>",
    "market": "<2-3 sentences on the local market opportunity at ${propertyTown}: is there demand for premium aesthetics here? How does the location work for footfall and client acquisition? What is the competitive risk?>",
    "strategic": "<2 sentences on strategic fit: does this move make sense for Abi's business at this stage? How does Bedhampton's current performance de-risk or complicate the move?>",
    "personal": "<2 sentences on her personal financial position: does her runway, nursing income, and Bedhampton income give her enough buffer to safely commit to this lease?>"
  },
  "riskScores": {
    "financial": <1-10 where 10 = extremely high risk — assess affordability, break-even realism, VAT exposure>,
    "property": <1-10 — assess rent level, lease terms known so far, location risk>,
    "market": <1-10 — assess Winchester demand, competition, pricing power>,
    "strategic": <1-10 — assess timing, personal readiness, Bedhampton dependency>,
    "overall": <1-10>
  },
  "riskRationale": {
    "financial": "<one sentence>",
    "property": "<one sentence>",
    "market": "<one sentence>",
    "strategic": "<one sentence>"
  },
  "strengths": [
    "<strength 1 — cite actual numbers>",
    "<strength 2>",
    "<strength 3>",
    "<strength 4>",
    "<strength 5 if genuinely warranted>"
  ],
  "concerns": [
    "<concern 1 — use real numbers, be precise>",
    "<concern 2>",
    "<concern 3>",
    "<concern 4>",
    "<concern 5 if warranted>"
  ],
  "conditions": [
    "<condition 1 that must be resolved before proceeding — only include if verdict is PROCEED_WITH_CONDITIONS or DELAY>",
    "<condition 2>"
  ],
  "immediateActions": [
    { "action": "<specific action — focused on property negotiation and financial preparation>", "priority": "critical" | "high" | "medium", "deadline": "<e.g. 'Before heads of terms', 'This week', 'Within 2 weeks'>", "rationale": "<one sentence>" },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." },
    { "action": "...", "priority": "...", "deadline": "...", "rationale": "..." }
  ],
  "thirtyDayPlan": [
    { "week": "Week 1", "focus": "<negotiation/due diligence theme>", "actions": ["<action>", "<action>", "<action>"] },
    { "week": "Week 2", "focus": "<theme>", "actions": ["<action>", "<action>", "<action>"] },
    { "week": "Week 3", "focus": "<theme>", "actions": ["<action>", "<action>", "<action>"] },
    { "week": "Week 4", "focus": "<theme>", "actions": ["<action>", "<action>", "<action>"] }
  ],
  "negotiationPoints": [
    "<key point to negotiate in heads of terms 1 — e.g. rent-free period, break clause, fit-out contribution>",
    "<point 2>",
    "<point 3>",
    "<point 4 if warranted>"
  ],
  "reviewTrigger": "<what would change your verdict — e.g. rent increases above X, Bedhampton revenue drops below Y>",
  "nextReviewDate": "<ISO 8601 date>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 5000,
      messages: [{ role: "user", content: masterPrompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    // Strip markdown fences then extract just the JSON object (handles leading/trailing prose)
    let clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Last-resort: try to pull executiveSummary out of the raw text so at least
      // the card shows something meaningful rather than a JSON blob
      const summaryMatch = raw.match(/"executiveSummary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = {
        verdict: "DELAY",
        verdictLabel: "Unable to assess — try again",
        confidenceScore: 0,
        executiveSummary: summaryMatch
          ? summaryMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
          : "Analysis could not be parsed. Please refresh to try again.",
        detailedAssessment: {},
        riskScores: { financial: 5, property: 5, market: 5, strategic: 5, overall: 5 },
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

    // Pass computed metrics back so the UI can display them without re-computing
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
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return res.status(500).json({ error: msg });
  }
});

// ─── POST /api/projects/:projectId/financial/generate ─────────────────────────
// AI generates a PROPOSAL (no DB writes) — returns every possible cost with
// detailed reasoning so the user can review and selectively accept.
router.post("/projects/:projectId/financial/generate", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);

  const [property] = await db.select().from(propertiesTable)
    .where(eq(propertiesTable.projectId, projectId))
    .then(rows => rows.filter(r => r.isActiveForProject));

  const existingItems = await db.select().from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId));

  const propertyContext = property ? `
Property: ${property.address || "unknown address"}, ${property.postcode || "unknown postcode"}
Floor size: ${property.sqFootage ? `${property.sqFootage} sq ft` : "unknown — assume ~600-800 sq ft high street unit"}
Monthly rent: £${(property.monthlyRentGbp ?? 0).toFixed(0)}
Annual business rates: £${(property.businessRatesGbp ?? 0).toFixed(0)} → £${Math.round((property.businessRatesGbp ?? 0) / 12)}/month
Monthly service charge: £${Math.round((property.serviceChargeGbp ?? 0) / 12)}
VAT on rent: ${property.vatOnRent ? "YES — 20% VAT on top of rent (landlord has opted to tax)" : "No VAT on rent"}
Lease length: ${property.leaseLength || "unknown"}
Use class: ${property.useClass || "Class E commercial"}
` : "No active property set — use assumptions for a typical UK high street aesthetics clinic (600 sq ft, mid-market location).";

  const existingList = existingItems.length > 0
    ? `\nExisting cost items in the model:\n${existingItems.map(i => `  • "${i.name}": £${i.amountGbp}/mo`).join("\n")}`
    : "";

  const prompt = `UK aesthetics clinic financial model. Solo ANP practitioner, premium positioning, Ltd Co.
${propertyContext}${existingList}

Generate a complete set of monthly cost estimates. Return ONLY valid JSON, no markdown:

{
  "fixedCosts": [
    { "name": "Rent / Lease", "category": "Property & Occupancy", "amountGbp": 0, "reasoning": "1 sentence with specific reference", "confidence": "high|medium|low", "isEssential": true }
  ],
  "variableCosts": { "stockPercent": 14, "stockPercentReasoning": "1 sentence", "commissionsPercent": 0, "staffingGbp": 0, "consumablesGbp": 90, "consumablesReasoning": "1 sentence", "marketingGbp": 0 },
  "revenue": { "wincAcvGbp": 220, "wincAcvReasoning": "1 sentence", "treatmentRoomsCount": 1, "practitionerHoursPerDay": 7, "workingDaysPerMonth": 21, "conservativeOccupancyPercent": 30, "realisticOccupancyPercent": 60, "aggressiveOccupancyPercent": 80 },
  "flags": ["max 3 critical compliance/financial warnings"]
}

Required fixedCosts items (use exact category names shown):
Property & Occupancy: Rent / Lease, Business Rates, Service Charge, Contents & Equipment Insurance
Utilities: Electricity, Gas / Heating, Water & Sewerage, Business Internet
Clinical & Regulatory: Medical Indemnity Insurance, Public Liability Insurance, Clinical Waste Contract, CPD & Training
Software & Technology: Practice Management Software, Card Payment Processing, Accounting Software, Website & Domain, Telecoms
Professional Services: Accountant / Bookkeeper, Payroll Administration
Marketing & Brand: Digital Marketing Budget, Content Creation & Photography, Printed Materials
Operations: Cleaner / Cleaning Contract, Laundry & Linen, Stationery & Office Supplies
Financial & Banking: Business Bank Charges, Finance Repayments
Contingency: Miscellaneous / Contingency

Rules:
- Property items (Rent, Rates, Service Charge): use EXACT figures from property data above
- confidence: "high" = property-derived or regulatory standard, "medium" = estimated range, "low" = highly variable
- isEssential: true if legally required or operationally critical
- reasoning: 1 concise sentence citing a specific supplier, regulation, or benchmark figure
- stockPercent: 12-16% for premium injectables
- wincAcvGbp: realistic average across all treatment types for premium ANP clinic`;

  const max_completion_tokens = 3500;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const fixedMatch = clean.match(/"fixedCosts"\s*:\s*(\[[\s\S]*?\](?=\s*[,}]))/);
      const varMatch = clean.match(/"variableCosts"\s*:\s*(\{[\s\S]*?\}(?=\s*[,}]))/);
      const revMatch = clean.match(/"revenue"\s*:\s*(\{[\s\S]*?\}(?=\s*[,}]))/);
      const flagsMatch = clean.match(/"flags"\s*:\s*(\[[\s\S]*?\])/);
      parsed = {
        fixedCosts: fixedMatch ? JSON.parse(fixedMatch[1]) : [],
        variableCosts: varMatch ? JSON.parse(varMatch[1]) : {},
        revenue: revMatch ? JSON.parse(revMatch[1]) : {},
        flags: flagsMatch ? JSON.parse(flagsMatch[1]) : [],
      };
    }

    // Tag each fixed cost as matching an existing item or new
    const normName = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const taggedCosts = (parsed.fixedCosts ?? []).map((fc: any) => ({
      ...fc,
      existingItemId: existingItems.find(i => normName(i.name) === normName(fc.name))?.id ?? null,
    }));

    return res.json({
      fixedCosts: taggedCosts,
      variableCosts: parsed.variableCosts ?? {},
      revenue: parsed.revenue ?? {},
      flags: parsed.flags ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return res.status(500).json({ error: msg });
  }
});

// Apply a set of accepted AI proposals to the DB
router.post("/projects/:projectId/financial/apply-proposal", async (req, res) => {
  const projectId = parseInt(req.params["projectId"] as string);
  const { fixedCosts = [], variableCosts = {}, revenue = {} } = req.body;

  const existingItems = await db.select().from(fixedCostItemsTable)
    .where(eq(fixedCostItemsTable.projectId, projectId));

  const normName = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const fc of fixedCosts) {
    if (typeof fc.amountGbp !== "number") continue;
    const match = existingItems.find(i => normName(i.name) === normName(fc.name));
    if (match) {
      await db.update(fixedCostItemsTable)
        .set({ amountGbp: fc.amountGbp, updatedAt: new Date() })
        .where(eq(fixedCostItemsTable.id, match.id));
    } else {
      // New item not in existing list
      await db.insert(fixedCostItemsTable).values({
        projectId,
        name: fc.name,
        amountGbp: fc.amountGbp,
        costType: fc.costType ?? "unique",
        sortOrder: existingItems.length + fixedCosts.indexOf(fc),
      });
    }
  }

  const vc = variableCosts as Record<string, any>;
  const rev = revenue as Record<string, any>;
  const modelUpdates: Record<string, any> = { updatedAt: new Date() };
  if (typeof vc.stockPercent === "number")       modelUpdates.stockPercent = vc.stockPercent;
  if (typeof vc.commissionsPercent === "number") modelUpdates.commissionsPercent = vc.commissionsPercent;
  if (typeof vc.staffingGbp === "number")        modelUpdates.staffingGbp = vc.staffingGbp;
  if (typeof vc.consumablesGbp === "number")     modelUpdates.consumablesGbp = vc.consumablesGbp;
  if (typeof vc.marketingGbp === "number")       modelUpdates.marketingGbp = vc.marketingGbp;
  if (typeof rev.wincAcvGbp === "number")                   modelUpdates.wincAcvGbp = rev.wincAcvGbp;
  if (typeof rev.treatmentRoomsCount === "number")          modelUpdates.treatmentRoomsCount = rev.treatmentRoomsCount;
  if (typeof rev.practitionerHoursPerDay === "number")      modelUpdates.practitionerHoursPerDay = rev.practitionerHoursPerDay;
  if (typeof rev.workingDaysPerMonth === "number")          modelUpdates.workingDaysPerMonth = rev.workingDaysPerMonth;
  if (typeof rev.conservativeOccupancyPercent === "number") modelUpdates.conservativeOccupancyPercent = rev.conservativeOccupancyPercent;
  if (typeof rev.realisticOccupancyPercent === "number")    modelUpdates.realisticOccupancyPercent = rev.realisticOccupancyPercent;
  if (typeof rev.aggressiveOccupancyPercent === "number")   modelUpdates.aggressiveOccupancyPercent = rev.aggressiveOccupancyPercent;

  if (Object.keys(modelUpdates).length > 1) {
    await db.update(financialsTable).set(modelUpdates).where(eq(financialsTable.projectId, projectId));
  }

  const [updatedModel] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  const updatedItems = await db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId));

  return res.json({ model: updatedModel, fixedCostItems: updatedItems });
});

export default router;
