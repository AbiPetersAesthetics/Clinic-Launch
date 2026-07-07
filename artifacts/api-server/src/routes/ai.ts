import { Router } from "express";
import { claudeComplete, claudeStreamText } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import {
  fixedCostItemsTable, propertiesTable, financialsTable,
  phasesTable, tasksTable, decisionsTable,
  complianceItemsTable, cqcMilestonesTable,
  lifestylePlanTable, competitorsTable,
  investmentsTable, projectAiAnalysesTable,
  propertyTaskOverridesTable,
} from "@workspace/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { getBedhamptonContext, fetchBedhamptonLive } from "./bedhampton";

const router = Router();

// ─── Scenario profiles (mirrors financials.ts — single source in financialEngine ideally) ──
const AI_SCENARIO_PROFILES: Record<string, {
  getTargetOcc: (m: any) => number;
  startOcc: number;
  rampMonths: number;
  note: string;
}> = {
  conservative:      { getTargetOcc: (m) => m.conservativeOccupancyPercent,                               startOcc: 20, rampMonths: 8,  note: "Conservative occupancy target, steady 8-month ramp" },
  realistic:         { getTargetOcc: (m) => m.realisticOccupancyPercent,                                  startOcc: 25, rampMonths: 6,  note: "Realistic occupancy target, standard 6-month ramp" },
  aggressive:        { getTargetOcc: (m) => m.aggressiveOccupancyPercent,                                 startOcc: 35, rampMonths: 4,  note: "High occupancy target, fast 4-month ramp — strong marketing required" },
  delayed_ramp:      { getTargetOcc: (m) => m.realisticOccupancyPercent,                                  startOcc: 15, rampMonths: 12, note: "Realistic occupancy target but cautious 12-month ramp — cold-start, no waiting list" },
  economic_downturn: { getTargetOcc: (m) => Math.round(m.conservativeOccupancyPercent * 0.8),             startOcc: 15, rampMonths: 9,  note: "Economic pressure: reduced consumer demand, −15% average spend" },
  stress_test:       { getTargetOcc: (m) => Math.max(Math.round(m.conservativeOccupancyPercent * 0.65), 12), startOcc: 5, rampMonths: 10, note: "Worst case: cold start at 5% occupancy, very slow ramp, lower spend" },
};

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

    const stream = claudeStreamText({
      maxTokens: 4096,
      messages: [
        { role: "system", content: systemWithContext },
        { role: "user", content: userMessage },
      ],
    });

    for await (const content of stream) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
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
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const content = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4000,
      signal: abort.signal,
    });
    clearTimeout(timeout);
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
    lifestyleRaw,
    competitorsRaw,
  ] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    db.select().from(decisionsTable).where(eq(decisionsTable.projectId, projectId)),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
    fetchBedhamptonLive().catch(() => null),
    db.select().from(lifestylePlanTable).where(eq(lifestylePlanTable.projectId, projectId)).then(r => r[0] ?? null),
    db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId))
      .orderBy(desc(competitorsTable.trustScore)),
  ]);

  const financial = financialRaw[0] ?? null;
  const activeProperty = allPropertiesRaw.find((p) => p.isActiveForProject) ?? allPropertiesRaw[0] ?? null;

  // Dynamic property label used throughout prompts — never hardcode location name
  const propertyLabel = activeProperty
    ? [activeProperty.address, activeProperty.postcode].filter(Boolean).join(", ")
    : "selected property";
  const propertyTown = activeProperty?.postcode?.split(" ")[0] || activeProperty?.address?.split(",").at(-2)?.trim() || "the selected location";

  // ── Financial calculations for all 3 scenarios ───────────────────────────
  // fixedCostsOverride: pass the actual fixed cost total from the items table so that
  // .net is always correct — legacy individual fields (rentGbp etc.) are 0 when the
  // user has switched to the dynamic fixed cost items list.
  function calcScenario(occupancyPct: number, acv: number, f: NonNullable<typeof financial>, fixedCostsOverride?: number, vatRate = 0) {
    const slotsPerMonth = f.treatmentRoomsCount * f.practitionerHoursPerDay * f.workingDaysPerMonth;
    const revenue = Math.round((slotsPerMonth * (occupancyPct / 100)) * acv + f.membershipRevenueGbp);
    // Use the items-table total when available; fall back to legacy individual fields
    const legacyFixed = Math.round(
      f.rentGbp + f.ratesGbp + f.utilitiesGbp + f.internetGbp +
      f.insuranceGbp + f.accountantGbp + f.softwareGbp +
      f.wasteContractGbp + f.cleanerGbp + f.subscriptionsGbp + f.financeRepaymentsGbp
    );
    const fixed = fixedCostsOverride ?? legacyFixed;
    const variableRate = (f.stockPercent + f.commissionsPercent) / 100;
    const variable = Math.round(revenue * variableRate + f.marketingGbp + f.staffingGbp + f.consumablesGbp);
    const vatLiability = Math.round(revenue * vatRate);
    const net = revenue - fixed - variable - vatLiability;
    return { revenue, fixed, variable, vatLiability, net, occupancyPct, acv };
  }

  // ── Fixed cost itemisation (computed first — used in financial calcs below) ──
  const totalFixedItemsCost = fixedCostsRaw.reduce((s, c) => s + (c.amountGbp ?? 0), 0);

  let financialContext = "No financial model entered yet.";
  let cashRunwayMonths = 0;
  let modelIncomplete = false;
  let rentToRevenuePct = 0;
  let breakEvenRevenue = 0;
  let vatRateForCalc = 0;
  let vatRisk = false;
  let vatRiskDetail = "";
  let bedhCoverageMonths = 0;
  // Active scenario — set inside if (financial) block, used in masterPrompt IIFE below
  let activeScenarioKey = "realistic";
  let activeStartOcc = 25;
  let activeRampMonths = 6;
  let activeTargetOcc = 60;
  let activeScenarioNote = "Realistic occupancy, standard 6-month ramp";

  if (financial) {
    // Resolve the active scenario from the model's selectedScenario field
    activeScenarioKey = (financial as any).selectedScenario || "realistic";
    const activeProf = AI_SCENARIO_PROFILES[activeScenarioKey] || AI_SCENARIO_PROFILES.realistic;
    activeStartOcc = activeProf.startOcc;
    activeRampMonths = activeProf.rampMonths;
    activeTargetOcc = Math.round(activeProf.getTargetOcc(financial));
    activeScenarioNote = activeProf.note;

    // Item 3: Apply lifestyle-derived working days and hours (same logic as deriveLifestyleSchedule
    // in financials.ts) so AI uses the current Life Design schedule, not a potentially stale DB value.
    if (lifestyleRaw) {
      const ls = lifestyleRaw;
      const parseArr = (v: unknown): string[] => {
        if (Array.isArray(v)) return v;
        try { return v ? JSON.parse(v as string) : []; } catch { return []; }
      };
      const clinicDays = parseArr(ls.clinicDays);
      if (clinicDays.length > 0) {
        (financial as any).workingDaysPerMonth = Math.round(clinicDays.length * 4.33);
      }
      if (ls.clinicOpenTime && ls.clinicCloseTime) {
        const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
        const rawMins = toMins(String(ls.clinicCloseTime)) - toMins(String(ls.clinicOpenTime));
        const derivedHours = Math.max(1, Math.round((rawMins / 60 - 0.5) * 2) / 2); // 30-min lunch
        (financial as any).practitionerHoursPerDay = derivedHours;
      }
    }

    // All three scenarios now use wincAcvGbp (Winchester-specific ACV, e.g. £230)
    // rather than the legacy averageClientValueGbp (originally set from Bedhampton).
    const wincAcv = financial.wincAcvGbp || financial.averageClientValueGbp;

    // VAT rate determination — mirrors /financial/calculate endpoint logic exactly.
    // VAT is a business-wide obligation (rolling £90k threshold across all clinics).
    // If Bedhampton alone (£75k) already pushes combined turnover past £90k when
    // Winchester opens, VAT applies from Month 1 and must be deducted from net profit.
    const vatCurrentTurnoverAi = (financial as any).vatCurrentTurnoverGbp ?? 0;
    const bedhAnnualRevAi = (financial.existingClinicRevenueGbp || 0) * 12;
    const vatWillApplyAtOpening = vatCurrentTurnoverAi >= 90000 ||
      (vatCurrentTurnoverAi + bedhAnnualRevAi >= 90000);
    vatRateForCalc = vatWillApplyAtOpening ? 0.20 : 0;

    // Use itemised fixed cost total when available — legacy individual fields (rentGbp etc.)
    // are 0 when the user has switched to the dynamic fixed cost items list.
    const actualMonthlyFixed = totalFixedItemsCost > 0 ? totalFixedItemsCost : Math.round(
      financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp + financial.internetGbp +
      financial.insuranceGbp + financial.accountantGbp + financial.softwareGbp +
      financial.wasteContractGbp + financial.cleanerGbp + financial.subscriptionsGbp + financial.financeRepaymentsGbp
    );

    // Guard against 0% occupancy inputs — if conservative/aggressive haven't been set,
    // use sensible fallbacks so the AI isn't given £0 revenue scenarios.
    const conservativeOcc = financial.conservativeOccupancyPercent > 0
      ? financial.conservativeOccupancyPercent
      : Math.round(financial.realisticOccupancyPercent * 0.5) || 30;
    const aggressiveOcc = financial.aggressiveOccupancyPercent > 0
      ? financial.aggressiveOccupancyPercent
      : Math.min(Math.round(financial.realisticOccupancyPercent * 1.35), 95) || 80;
    const conservativeOccNote = financial.conservativeOccupancyPercent === 0
      ? ` (⚠ not set — using ${conservativeOcc}% fallback)` : "";
    const aggressiveOccNote = financial.aggressiveOccupancyPercent === 0
      ? ` (⚠ not set — using ${aggressiveOcc}% fallback)` : "";

    const conservative = calcScenario(conservativeOcc, wincAcv, financial, actualMonthlyFixed, vatRateForCalc);
    const realistic    = calcScenario(financial.realisticOccupancyPercent, wincAcv, financial, actualMonthlyFixed, vatRateForCalc);
    const aggressive   = calcScenario(aggressiveOcc, wincAcv, financial, actualMonthlyFixed, vatRateForCalc);

    // Break-even: (fixedCosts + fixedVarItems) / (1 - variableRatio - vatRate)
    // VAT is a cost like any other on the P&L — once registered, every £1 of gross revenue
    // costs 20p in VAT liability, so the margin available to cover fixed costs is reduced.
    // Formula matches financialEngine.ts calcWinchester() exactly.
    const variableRatio = (financial.stockPercent + financial.commissionsPercent) / 100;
    const fixedVarItems = financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;
    breakEvenRevenue = Math.round((actualMonthlyFixed + fixedVarItems) / Math.max(1 - variableRatio - vatRateForCalc, 0.01));

    // Cash runway pre-opening — uses net Bedhampton contribution (after stock/running costs),
    // plus a project cost burn allocation spread across the pre-opening window.
    // This matches the dashboard formula and avoids the sentinel-99 bug when personal fields are zero.
    const bedhStockPct = ((financial as any).bedhStockPercent ?? 35) / 100;
    const bedhNetMonthly = Math.max(0,
      financial.existingClinicRevenueGbp * (1 - bedhStockPct)
      - ((financial as any).bedhRentGbp ?? 0)
      - ((financial as any).bedhMarketingGbp ?? 0)
      - ((financial as any).bedhamptonCostsGbp ?? 0)
    );
    const nursingNet = financial.nursingIncomeGbp ?? 0;
    // This route intentionally excludes task data (property-decision focused).
    // Runway here uses personal monthly costs vs net Bedhampton contribution only.
    const personalMonthly = financial.personalSalaryNeedsGbp + financial.ownerDrawingsGbp;
    const monthlyCashDrain = personalMonthly - bedhNetMonthly - nursingNet;
    const modelIncomplete = personalMonthly === 0 && financial.existingClinicRevenueGbp === 0 && nursingNet === 0;
    cashRunwayMonths = monthlyCashDrain > 0
      ? Math.round(financial.runwaySavingsGbp / monthlyCashDrain)
      : 99;

    // Rent as % of realistic revenue
    rentToRevenuePct = realistic.revenue > 0 ? Math.round((financial.rentGbp / realistic.revenue) * 100) : 0;

    // VAT risk: current turnover + projected annual revenue vs £90k
    const projectedAnnualWinc = realistic.revenue * 12;
    const combinedTurnover = (financial.vatCurrentTurnoverGbp || 0) + projectedAnnualWinc;
    vatRisk = combinedTurnover > 85000;
    vatRiskDetail = vatRisk
      ? `ALERT: Combined turnover (£${Math.round(combinedTurnover / 1000)}k) likely exceeds £90k VAT threshold — mandatory VAT registration will add ~20% to client prices unless exempt treatments dominate`
      : `Combined annual turnover (£${Math.round(combinedTurnover / 1000)}k) is below the £90k VAT threshold`;

    // Bedhampton coverage ratio: how many times Bedhampton monthly income covers
    // the new clinic's monthly fixed costs. E.g. 2.4 means Bedh earns 2.4× fixed costs.
    bedhCoverageMonths = actualMonthlyFixed > 0 && financial.existingClinicRevenueGbp > 0
      ? parseFloat((financial.existingClinicRevenueGbp / actualMonthlyFixed).toFixed(1))
      : 0;

    const activeScenarioCalc = calcScenario(activeTargetOcc, wincAcv, financial, actualMonthlyFixed, vatRateForCalc);

    financialContext = `=== ACTIVE PLANNING SCENARIO: ${activeScenarioKey.toUpperCase().replace(/_/g, " ")} ===
This is the scenario Abi has selected as her planning baseline. The three reference scenarios below provide context — the active scenario's ramp parameters drive the monthly forecast.
Active scenario: ${activeScenarioNote}
Active target occupancy: ${activeTargetOcc}% | Opening occupancy: ${activeStartOcc}% | Ramp to target: ${activeRampMonths} months | ACV: £${wincAcv}
VAT: ${vatRateForCalc > 0 ? `20% APPLIED — combined business turnover (Bedhampton £${Math.round((financial as any).vatCurrentTurnoverGbp ?? 0).toLocaleString()}/yr + Winchester) exceeds £90k VAT threshold from Month 1. All net figures below are after VAT liability.` : "0% — below VAT registration threshold"}
Active scenario steady-state net (at ${activeTargetOcc}% occ): £${activeScenarioCalc.net.toLocaleString()}/mo
  (Revenue: £${activeScenarioCalc.revenue.toLocaleString()} − Fixed: £${activeScenarioCalc.fixed.toLocaleString()} − Variable: £${activeScenarioCalc.variable.toLocaleString()}${vatRateForCalc > 0 ? ` − VAT: £${activeScenarioCalc.vatLiability.toLocaleString()}` : ""})

=== THREE-SCENARIO REFERENCE FINANCIALS (for ${propertyLabel}) ===
Fixed costs source: itemised cost list (${totalFixedItemsCost > 0 ? `${fixedCostsRaw.length} items, total £${actualMonthlyFixed.toLocaleString()}/mo` : "no items — using legacy fields"})

Conservative (${conservativeOcc}% occ${conservativeOccNote}, £${wincAcv} ACV)${activeScenarioKey === "conservative" ? " ← ACTIVE SCENARIO" : ""}:
  Revenue: £${conservative.revenue.toLocaleString()}/mo | Fixed: £${conservative.fixed.toLocaleString()}/mo | Variable: £${conservative.variable.toLocaleString()}/mo${vatRateForCalc > 0 ? ` | VAT: £${conservative.vatLiability.toLocaleString()}/mo` : ""} | Net: £${conservative.net.toLocaleString()}/mo

Realistic (${financial.realisticOccupancyPercent}% occ, £${wincAcv} ACV)${activeScenarioKey === "realistic" ? " ← ACTIVE SCENARIO" : ""}${activeScenarioKey === "delayed_ramp" ? " ← ACTIVE TARGET (delayed_ramp reaches this occupancy over 12 months)" : ""}:
  Revenue: £${realistic.revenue.toLocaleString()}/mo | Fixed: £${realistic.fixed.toLocaleString()}/mo | Variable: £${realistic.variable.toLocaleString()}/mo${vatRateForCalc > 0 ? ` | VAT: £${realistic.vatLiability.toLocaleString()}/mo` : ""} | Net: £${realistic.net.toLocaleString()}/mo

Aggressive (${aggressiveOcc}% occ${aggressiveOccNote}, £${wincAcv} ACV):
  Revenue: £${aggressive.revenue.toLocaleString()}/mo | Fixed: £${aggressive.fixed.toLocaleString()}/mo | Variable: £${aggressive.variable.toLocaleString()}/mo${vatRateForCalc > 0 ? ` | VAT: £${aggressive.vatLiability.toLocaleString()}/mo` : ""} | Net: £${aggressive.net.toLocaleString()}/mo

Variable cost assumptions (these drive profitability — flag any zero values as data gaps):
  Stock/COGS: ${financial.stockPercent}% of revenue${financial.stockPercent === 0 ? " ⚠ DATA GAP — 0% stock is not realistic for an aesthetics clinic. Botulinum toxin, filler, skinboosters = real product costs. Industry benchmark: 12–20% for premium injectables. Profits WILL be overstated until this is filled in." : ""}
  Commissions: ${financial.commissionsPercent}% of revenue
  Marketing (fixed monthly): £${financial.marketingGbp}
  Staffing (fixed monthly): £${financial.staffingGbp}
  Consumables (fixed monthly): £${financial.consumablesGbp} (already captured within variable cost percentages — do NOT flag as missing or a data gap)
  Total variable % of revenue: ${Math.round(variableRatio * 100)}% | Total fixed variable items: £${fixedVarItems.toLocaleString()}/mo

Winchester ACV:${financial.wincAcvGbp ? ` £${financial.wincAcvGbp} (Winchester-specific)` : ` £${financial.averageClientValueGbp} (⚠ FALLBACK — Winchester ACV not entered; using Bedhampton's £${financial.averageClientValueGbp}. Winchester is a premium clinic; its ACV may differ significantly.)`}

Key ratios (Realistic scenario, using actual fixed costs${vatRateForCalc > 0 ? ", VAT-adjusted" : ""}):
  Break-even revenue needed: £${breakEvenRevenue.toLocaleString()}/mo${vatRateForCalc > 0 ? ` (incl. 20% VAT liability — formula: (fixed+fixedVar) ÷ (1 − varRate − 0.20))` : ""}
  Rent as % of revenue: ${rentToRevenuePct}% (industry guideline: aim for <15%)
  Bedhampton income vs new clinic fixed costs: ${bedhCoverageMonths}× (Bedh earns ${bedhCoverageMonths}× the new clinic's monthly fixed costs — NOT 4 years' worth)
  Treatment rooms: ${financial.treatmentRoomsCount} | Practitioner hours/day: ${financial.practitionerHoursPerDay} | Working days/mo: ${financial.workingDaysPerMonth}

Personal finance & domestic commitments:
  Salary target (drawings): £${financial.targetDrawingsGbp || financial.ownerDrawingsGbp}/mo
  School fees: £${(financial as any).schoolFeesGbp || 0}/mo
  Travel: £${(financial as any).travelGbp || 0}/mo
  Other household: £${(financial as any).otherHouseholdGbp || 0}/mo
  Total monthly household need: £${((financial.targetDrawingsGbp || financial.ownerDrawingsGbp || 0) + ((financial as any).schoolFeesGbp || 0) + ((financial as any).travelGbp || 0) + ((financial as any).otherHouseholdGbp || 0)).toLocaleString()}/mo
  Personal salary needs (min): £${financial.personalSalaryNeedsGbp}/mo
  Nursing income: £${financial.nursingIncomeGbp}/mo | Cash runway savings: £${financial.runwaySavingsGbp.toLocaleString()}
  Pre-opening cash runway: ${modelIncomplete ? "⚠ Model incomplete — enter personal salary needs + Bedhampton income to calculate" : cashRunwayMonths >= 99 ? "Secure — income exceeds personal burn" : `${cashRunwayMonths} months`}
  Bedhampton income in model: £${financial.existingClinicRevenueGbp}/mo
  Self-funding buffer target: ${financial.selfFundingBufferPercent}% net margin

VAT risk:
  ${vatRiskDetail}

Membership revenue: £${financial.membershipRevenueGbp}/mo | Repeat booking rate: ${financial.repeatBookingRatePercent}%`;
  }
  const fixedCostContext = fixedCostsRaw.length > 0
    ? `Itemised fixed costs (${fixedCostsRaw.length} items, £${totalFixedItemsCost.toLocaleString()}/mo total):\n${fixedCostsRaw.map((c) => `  • ${c.name}: £${c.amountGbp}/mo (${c.costType})`).join("\n")}`
    : "No itemised fixed costs entered yet — financial model uses category totals only.";

  // ── Property comparison context (Item 6) ─────────────────────────────────
  // Computes break-even for each property using its rent/rates substituted into
  // the shared fixed cost base. Used in the AI prompt for a direct comparison.
  const propertyComparisonContext = (financial && allPropertiesRaw.length >= 2) ? (() => {
    const wincAcv2 = financial.wincAcvGbp || financial.averageClientValueGbp;
    const variableRatioP = (financial.stockPercent + financial.commissionsPercent) / 100;
    const fixedVarItemsP = financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;
    const activePropRent  = activeProperty?.monthlyRentGbp || 0;
    const activePropRates = Math.round((activeProperty?.businessRatesGbp || 0) / 12);
    // Shared costs = total fixed items minus active property's rent + rates
    const sharedFixed = totalFixedItemsCost - activePropRent - activePropRates;

    const propDetails = allPropertiesRaw.map(p => {
      const monthlyRent  = p.monthlyRentGbp || 0;
      const monthlyRates = Math.round((p.businessRatesGbp || 0) / 12);
      const monthlyServiceCharge = Math.round((p.serviceChargeGbp || 0) / 12);
      const propFixed    = sharedFixed + monthlyRent + monthlyRates;
      const beRev        = Math.round((propFixed + fixedVarItemsP) / Math.max(1 - variableRatioP - vatRateForCalc, 0.01));
      const slots1Room   = financial.practitionerHoursPerDay * financial.workingDaysPerMonth;
      const revCeiling1  = Math.round(slots1Room * wincAcv2);
      const revCeiling2  = Math.round(slots1Room * 2 * wincAcv2);
      const beOcc1 = revCeiling1 > 0 ? Math.round((beRev / revCeiling1) * 100) : 0;
      const beOcc2 = revCeiling2 > 0 ? Math.round((beRev / revCeiling2) * 100) : 0;
      return { p, monthlyRent, monthlyRates, monthlyServiceCharge, propFixed, beRev, beOcc1, beOcc2, revCeiling1, revCeiling2 };
    });

    const lines = propDetails.map(({ p, monthlyRent, monthlyRates, monthlyServiceCharge, propFixed, beRev, beOcc1, beOcc2, revCeiling1, revCeiling2 }) =>
      `${p.isActiveForProject ? "★ ACTIVE" : "○ ALTERNATIVE"}: ${p.address || "Unknown"} (${p.postcode || "?"})
  Monthly rent: £${monthlyRent.toLocaleString()} | Monthly rates: £${monthlyRates.toLocaleString()} | Service charge: ~£${monthlyServiceCharge.toLocaleString()}/mo
  Total monthly fixed costs (with this property's rent/rates): £${propFixed.toLocaleString()}/mo
  Break-even revenue: £${beRev.toLocaleString()}/mo
  Break-even occupancy — 1 treatment room model: ${beOcc1}% (rev ceiling £${revCeiling1.toLocaleString()}/mo at 100%)
  Break-even occupancy — 2 treatment room model: ${beOcc2}% (rev ceiling £${revCeiling2.toLocaleString()}/mo at 100%)
  VAT on rent: ${p.vatOnRent ? "YES — adds 20% to monthly cost" : "NO (confirmed)"}
  Size: ${p.sqFootage || "?"}sqft | Use class: ${p.useClass || "?"} | Status: ${p.status || "unknown"}
  Notes: ${p.notes || "none"}`
    ).join("\n\n");

    return `=== PROPERTY COMPARISON: ${allPropertiesRaw.map(p => p.address).join(" vs ")} ===
${lines}

INSTRUCTIONS FOR propertyComparison FIELD — address ALL six points:
1. True all-in monthly cost for each property: use the computed figures above (not your own estimates)
2. Revenue ceiling: 9A = 1 room (£${Math.round(financial.practitionerHoursPerDay * financial.workingDaysPerMonth * wincAcv2).toLocaleString()}/mo at 100%). If 34A has 2 rooms, use the 2-room ceiling above. State the practical implication for growth.
3. Listed building fit-out risk at 34A Jewry Street: specific constraints (listed building consents required, structural changes restricted, partition/fit-out limitations, higher insurance, longer planning timeline — these are material to cost and opening date)
4. Signage viability: compare ability to install external clinical branding at each property; listed building planning restrictions vs 9A
5. Break-even occupancy: use the computed figures above — state both, compare, recommend which is more achievable given the ramp model
6. Named recommendation: state clearly which property you recommend and why in 2–3 sentences`;
  })() : "";

  // ── Property context ──────────────────────────────────────────────────────
  const allPropertyLines = allPropertiesRaw.map((p) =>
    `  ${p.isActiveForProject ? "★ SELECTED" : "○"} ${p.address || "Unknown"} (${p.postcode || "?"}): £${p.monthlyRentGbp || "?"}/mo | ${p.sqFootage || "?"}sqft | Stage: ${p.status || "unknown"} | Use class: ${p.useClass || "?"} | VAT on rent: ${p.vatOnRent ? "Yes (landlord opted to tax — adds 20% to monthly cost)" : "No (confirmed)"}`
  ).join("\n");

  const propertyContext = allPropertiesRaw.length > 0
    ? `${allPropertiesRaw.length} properties in pipeline:\n${allPropertyLines}\n\nActive property notes: ${activeProperty?.notes || "none"}`
    : "No properties added yet.";

  // ── Competition context ───────────────────────────────────────────────────
  let competitionContext = "No competitors have been researched yet — market risk assessment based on general Winchester market knowledge only.";
  if (competitorsRaw.length > 0) {
    const top = competitorsRaw.slice(0, 15);
    const highThreat = top.filter(c => (c.estimatedThreatScore ?? 0) >= 70);
    const medThreat  = top.filter(c => (c.estimatedThreatScore ?? 0) >= 40 && (c.estimatedThreatScore ?? 0) < 70);
    const avgRatingArr = top.filter(c => c.googleRating && parseFloat(c.googleRating) > 0)
                          .map(c => parseFloat(c.googleRating!));
    const avgGoogleRating = avgRatingArr.length > 0
      ? (avgRatingArr.reduce((s, r) => s + r, 0) / avgRatingArr.length).toFixed(1)
      : null;

    // Pricing summary
    const TREATMENT_LABELS: Record<string, string> = {
      antiWrinkle1: "Anti-wrinkle 1 area", antiWrinkle2: "Anti-wrinkle 2 areas", antiWrinkle3: "Anti-wrinkle 3 areas",
      lipFiller05: "Lip filler 0.5ml", lipFiller1: "Lip filler 1ml", cheekFiller: "Cheek filler",
      jawChin: "Jaw/chin filler", tearTrough: "Tear trough", skinBooster: "Skin booster",
      profhilo: "Profhilo", polynucleotides: "Polynucleotides", microneedling: "Microneedling", chemicalPeel: "Chemical peel",
    };
    const APA_TARGET_PRICES: Record<string, number> = {
      antiWrinkle1: 200, antiWrinkle2: 280, antiWrinkle3: 350,
      lipFiller05: 280, lipFiller1: 350, cheekFiller: 350, jawChin: 380, tearTrough: 400,
      skinBooster: 300, profhilo: 650, polynucleotides: 350, microneedling: 200, chemicalPeel: 150,
    };
    const pricingRows: string[] = [];
    for (const [key, label] of Object.entries(TREATMENT_LABELS)) {
      const compPrices = top
        .map(c => { try { return (JSON.parse(c.pricingJson ?? "{}") as Record<string,number>)[key] || 0; } catch { return 0; } })
        .filter(p => p > 0);
      if (compPrices.length === 0) continue;
      const sorted = [...compPrices].sort((a, b) => a - b);
      const min = sorted[0], max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)];
      const apaTarget = APA_TARGET_PRICES[key] ?? 0;
      const allWithApa = [...compPrices, apaTarget].sort((a, b) => b - a);
      const apaRank = allWithApa.indexOf(apaTarget) + 1;
      pricingRows.push(`  ${label}: market £${min}–£${max} (median £${median}, ${compPrices.length} competitors) | APA target £${apaTarget} → ranks ${apaRank}${["st","nd","rd"][apaRank-1]||"th"} most expensive of ${allWithApa.length}`);
    }

    const lines = top.map(c =>
      `  • ${c.name ?? "Unknown"} (${c.clinicType ?? "unknown type"}) — threat: ${c.estimatedThreatScore ?? "?"}/100` +
      (c.distanceMiles ? `, ${c.distanceMiles} miles` : "") +
      (c.googleRating ? `, Google ${c.googleRating}★` + (c.googleReviewCount ? ` (${c.googleReviewCount} reviews)` : "") : "") +
      (c.premisesType ? `, ${c.premisesType}` : "") +
      (c.positioningCategory ? `, positioned as: ${c.positioningCategory}` : "") +
      (c.independentPrescriber ? ", IP" : "") +
      (c.saveFace ? ", Save Face accredited" : "") +
      (c.threatReason ? `\n    Threat: ${c.threatReason}` : "")
    ).join("\n");

    competitionContext = `${competitorsRaw.length} competitors researched (showing top ${top.length} by threat score):
${lines}

PRICING ANALYSIS — APA target vs market (where competitor pricing is entered):
${pricingRows.length > 0 ? pricingRows.join("\n") : "  No competitor pricing data entered yet."}

Summary: ${highThreat.length} high-threat competitors (score ≥70), ${medThreat.length} medium-threat (40–69).${avgGoogleRating ? ` Average Google rating across researched competitors: ${avgGoogleRating}★.` : ""}
Note: This data was researched by Abi directly — treat as more reliable than AI-generated estimates.`;
  }

  // ── Winchester demographics context ────────────────────────────────────────
  const demographicsContext = `=== WINCHESTER CATCHMENT DEMOGRAPHICS (for market analysis) ===
Population: ~47,000 city, ~125,000 Winchester district.
Affluence: Consistently ranked top 5 most affluent cities outside London. Average household income ~£52,000 (vs UK average ~£35,000). High homeownership (>65%). Very low unemployment.
Demographics profile: Predominantly ABC1 professional/managerial. Strong 35–60 female demographic — the core aesthetics consumer. High concentration of teachers, NHS professionals, solicitors, accountants, business owners.
Education: University of Winchester (~8,000 students) + several outstanding schools attracting relocating professional families.
Tourism & footfall: 1.5M+ visitors/year. City centre footfall is stable year-round (cathedral, high street, market). King's Walk / Jewry Street area: secondary high street — lower rent than primary pitch, good passing trade from independent retail and dining.
Spend patterns: Winchester consumers are price-aware but quality-driven. Premium positioning is viable if justified — clients here will pay more for a qualified medical practitioner over a beauty therapist. They research practitioners carefully; Save Face, reviews, and credentials matter.
Key competitor dynamic: Several established nurse-led and doctor-led clinics already exist, suggesting proven demand for medical aesthetics. Market is not saturated. No dominant single-operator with 100+ reviews and full treatment menu.
Seasonal patterns: Strong Jan (new year resolutions), pre-summer (May–June), and pre-Christmas (Oct–Nov) peaks. Summer quieter for anti-wrinkle as patients plan treatments around holidays.
Client acquisition: Winchester is an Instagram-active, referral-driven market. Local Facebook community groups (Hampshire Aesthetics etc.) are influential. Word-of-mouth from a high-quality result spreads fast in a community this size (~50,000 active local social media users).`;

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

  // ── Lifestyle / life-design context ───────────────────────────────────────
  let lifestyleContext = "Life design plan: not completed yet.";
  if (lifestyleRaw) {
    const ls = lifestyleRaw;

    // Parse checklist arrays
    const parseArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      try { return v ? JSON.parse(v as string) : []; } catch { return []; }
    };
    const schedChecks = parseArr(ls.scheduleChecks);
    const famChecks = parseArr(ls.familyChecks);
    const nurChecks = parseArr(ls.nursingChecks);
    const wbChecks = parseArr(ls.wellbeingChecks);
    const idChecks = parseArr(ls.identityChecks);
    const clinicDays = parseArr(ls.clinicDays);
    const totalChecks = 5 + 8 + 8 + 6 + 7; // total items across all checklists
    const doneChecks = schedChecks.length + famChecks.length + nurChecks.length + wbChecks.length + idChecks.length;
    const lifeReadinessPct = Math.round((doneChecks / totalChecks) * 100);

    // Nursing income implications
    const nursingStatusLabels: Record<string, string> = {
      still_working: "Still working full nursing shifts — nursing income is active",
      exploring: "Mentally winding down from nursing — no formal steps yet",
      notice_given: "Notice given to nursing employer — income will stop",
      left: "Already left nursing — no nursing income",
    };
    const nursingIncomeActive = ls.nursingStatus === "still_working" || ls.nursingStatus === "exploring";

    // Calculate notice deadline from target exit date + notice period
    let noticeDeadlineStr = "Not calculated — no target exit date set";
    if (ls.targetExitDate) {
      const exitMs = new Date(ls.targetExitDate + "-01").getTime();
      const noticeMs = (ls.nursingNoticeWeeks ?? 12) * 7 * 24 * 60 * 60 * 1000;
      const deadline = new Date(exitMs - noticeMs);
      noticeDeadlineStr = deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    // Revenue ceiling check: does the financial model's working days match the lifestyle max?
    const financialWorkingDays = financial?.workingDaysPerMonth ?? 0;
    const maxMonthlyClinicDays = (ls.maxClinicDaysPerWeek ?? 4) * 4.3;
    const revenueCeilingConflict = financialWorkingDays > maxMonthlyClinicDays;

    const schoolCovered = (ls.dropCoveredBy ?? "").trim().length > 0 && (ls.pickupCoveredBy ?? "").trim().length > 0;

    lifestyleContext = `=== LIFE DESIGN PLAN (personal readiness — feeds directly into launch viability) ===

NURSING EXIT STATUS: ${nursingStatusLabels[ls.nursingStatus ?? "still_working"] ?? ls.nursingStatus}
  Notice period: ${ls.nursingNoticeWeeks ?? 12} weeks | Target exit: ${ls.targetExitDate || "not set"} | Give-notice deadline: ${noticeDeadlineStr}
  Nursing income currently in model: £${financial?.nursingIncomeGbp ?? 0}/mo
  ${nursingIncomeActive ? "⚠ Nursing income is still live — if she exits before opening, the runway calculation must be revised downward" : "⚠ Nursing income has stopped or will stop — runway is now dependent on Bedhampton income and savings only"}
  ${ls.nursingExitNotes ? `Exit notes: "${ls.nursingExitNotes}"` : ""}

CLINIC SCHEDULE:
  Planned clinic days: ${clinicDays.join(", ") || "not set"} (${clinicDays.length} days/week)
  Opening hours: ${ls.clinicOpenTime}–${ls.clinicCloseTime}
  Hard personal maximum: ${ls.maxClinicDaysPerWeek ?? 4} clinic days/week (≈${Math.round(maxMonthlyClinicDays)} days/month)
  Financial model uses: ${financialWorkingDays} working days/month
  ${revenueCeilingConflict ? `⚠ REVENUE CEILING CONFLICT: financial model assumes ${financialWorkingDays} days/month but personal max is ~${Math.round(maxMonthlyClinicDays)} days/month — the revenue projections are OVERSTATED and must be revised` : `✓ Schedule model is consistent with personal maximum`}
  ${ls.scheduleNotes ? `Schedule vision: "${ls.scheduleNotes.slice(0, 200)}"` : ""}

FAMILY & SCHOOL LOGISTICS (Eli & Elsy):
  School: ${ls.schoolStartTime}–${ls.schoolFinishTime}
  Drop-off covered by: ${ls.dropCoveredBy || "NOT SPECIFIED"}
  Pick-up covered by: ${ls.pickupCoveredBy || "NOT SPECIFIED"}
  ${!schoolCovered ? "⚠ School run not yet allocated — this is an operational risk. No cover plan = cancellations or client-time conflicts" : "✓ School run coverage is allocated"}
  Contingency plan: ${ls.schoolContingencyPlan ? `"${ls.schoolContingencyPlan.slice(0, 150)}"` : "not written"}
  David's support: ${ls.davidAvailabilityDays ?? 5} days/week available
  ${ls.davidRoleNotes ? `David's specific role: "${ls.davidRoleNotes.slice(0, 200)}"` : "David's specific commitments: not documented"}

WELLBEING & SUSTAINABILITY:
  Sick cover plan: ${ls.sickCoverPlan ? `"${ls.sickCoverPlan.slice(0, 150)}"` : "not written"}
  Holiday plan: ${ls.holidayPlan ? `"${ls.holidayPlan.slice(0, 150)}"` : "not written"}
  Non-negotiables: ${ls.nonNegotiables ? `"${ls.nonNegotiables.slice(0, 200)}"` : "not written"}

PERSONAL MOTIVATION & CONCERNS:
  Most excited about: ${ls.mostExcitedAbout ? `"${ls.mostExcitedAbout.slice(0, 200)}"` : "not written"}
  Biggest concerns: ${ls.biggestConcerns ? `"${ls.biggestConcerns.slice(0, 200)}"` : "not written"}
  Support network: ${ls.supportNetwork ? `"${ls.supportNetwork.slice(0, 200)}"` : "not written"}

LIFE READINESS SCORE: ${lifeReadinessPct}% (${doneChecks}/${totalChecks} considerations addressed)
  Schedule: ${schedChecks.length}/5 | Family: ${famChecks.length}/8 | Nursing exit: ${nurChecks.length}/8 | Wellbeing: ${wbChecks.length}/6 | Identity: ${idChecks.length}/7`;
  }

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
${propertyComparisonContext ? `\n${propertyComparisonContext}\n` : ""}
=== LIVE BEDHAMPTON CLINIC PERFORMANCE (her existing business — the financial safety net) ===
${bedhContext}

=== COMPETITIVE LANDSCAPE (researched by Abi — real data, not AI estimates) ===
${competitionContext}

${demographicsContext}

=== STRATEGIC DECISIONS ALREADY MADE ===
${decisionsContext}

${lifestyleContext}

=== KEY COMPUTED RATIOS ===
• Break-even monthly revenue (${propertyLabel}): £${breakEvenRevenue.toLocaleString() || "not calculated"}
• Rent as % of realistic monthly revenue: ${rentToRevenuePct}% (healthy = <15%, stretched = >20%)
• Personal cash runway (savings covering living costs pre-opening): ${modelIncomplete ? "⚠ model incomplete — personal salary and Bedhampton income not yet entered; do NOT state runway as secure" : cashRunwayMonths >= 99 ? "secure — income exceeds outgoings" : `${cashRunwayMonths} months`}
• VAT threshold risk: ${vatRisk ? "HIGH" : "LOW"} — ${vatRiskDetail}
• Bedhampton income covers ${bedhCoverageMonths > 0 ? `${bedhCoverageMonths} months of new clinic fixed costs per year` : "unknown — set Bedhampton revenue in financial model"}
• Days until target opening: ${daysToOpening}

${financial ? (() => {
  const wincAcv = financial.wincAcvGbp || financial.averageClientValueGbp;
  const maxMonthlySlots = financial.treatmentRoomsCount * financial.practitionerHoursPerDay * financial.workingDaysPerMonth;
  const actualMonthlyFixed2 = totalFixedItemsCost > 0 ? totalFixedItemsCost : (financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp + financial.internetGbp + financial.insuranceGbp + financial.accountantGbp + financial.softwareGbp + financial.wasteContractGbp + financial.cleanerGbp + financial.subscriptionsGbp + financial.financeRepaymentsGbp);
  const varRate = (financial.stockPercent + financial.commissionsPercent) / 100;
  const fixedMonthlyCosts2 = financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;
  const totalMonthlyCost = actualMonthlyFixed2 + fixedMonthlyCosts2;
  const beOcc = maxMonthlySlots > 0 && wincAcv > 0 ? Math.round((breakEvenRevenue / (maxMonthlySlots * wincAcv)) * 100) : 0;
  return `=== 12-MONTH REVENUE FORECAST — MODEL INPUTS (use these exact numbers — do NOT change fixed costs) ===
Monthly fixed costs (definitive): £${actualMonthlyFixed2.toLocaleString()}
Variable cost breakdown (drives every month's net P&L — gaps will overstate profit):
  Stock/COGS: ${financial.stockPercent}% of revenue${financial.stockPercent === 0 ? " ⚠ DATA GAP: 0% stock. Aesthetics = real product costs (toxin, filler, skinboosters). Benchmark: 12–20%. Profits overstated until corrected." : ""}
  Commissions: ${financial.commissionsPercent}% of revenue
  Marketing (fixed/mo): £${financial.marketingGbp}
  Staffing (fixed/mo): £${financial.staffingGbp}
  Consumables (fixed/mo): £${financial.consumablesGbp} (captured in variable costs — do NOT flag as missing)
  Total fixed variable items (marketing+staffing+consumables): £${fixedMonthlyCosts2.toLocaleString()}/mo
Total monthly cost base (fixed + fixed-variable items): £${totalMonthlyCost.toLocaleString()}
Variable cost rate applied to revenue (stock + commissions): ${Math.round(varRate * 100)}% of revenue
Winchester ACV: £${wincAcv}${financial.wincAcvGbp === 0 ? ` ⚠ FALLBACK — wincAcvGbp not set; using Bedhampton ACV £${financial.averageClientValueGbp}. Verify this is correct for a premium Winchester clinic.` : " (Winchester-specific)"}
Max monthly treatment slots (capacity ceiling): ${maxMonthlySlots} slots/month (${financial.treatmentRoomsCount} room × ${financial.practitionerHoursPerDay}hrs/day × ${financial.workingDaysPerMonth} clinic days)
Revenue ceiling at 100% occupancy: £${Math.round(maxMonthlySlots * wincAcv).toLocaleString()}/month

Break-even monthly revenue: £${breakEvenRevenue.toLocaleString()}
Break-even occupancy needed: ~${beOcc}% of capacity

FORMULA for each month's net P&L (VAT-adjusted):
  netProfitLoss = projectedRevenue - totalMonthlyCost - (projectedRevenue × variableCostRate) - (projectedRevenue × vatRate)
  i.e. = projectedRevenue × (1 - ${Math.round(varRate * 100) / 100} - ${vatRateForCalc}) - £${totalMonthlyCost.toLocaleString()}
  VAT rate: ${vatRateForCalc > 0 ? `${Math.round(vatRateForCalc * 100)}% — combined business turnover exceeds £90k threshold from Month 1; VAT liability deducted from every month's revenue` : "0% — below VAT threshold"}

RAMP-UP ASSUMPTIONS — apply ALL of the following:
CRITICAL: Bedhampton is ~40 minutes from Winchester. These are two entirely separate client bases. There are ZERO client transfers from Bedhampton to Winchester. Winchester starts from a completely cold base — no existing clients will follow her there. Do NOT factor any Bedhampton client transfer into any month's projection.

ACTIVE SCENARIO RAMP PARAMETERS (use these exact values — they come from the model Abi is planning from):
  Scenario: ${activeScenarioKey.replace(/_/g, " ")} — ${activeScenarioNote}
  Month 1 opening occupancy: ${activeStartOcc}%
  Months to reach target occupancy: ${activeRampMonths} months
  Target (plateau) occupancy: ${activeTargetOcc}%
  Linear ramp formula: each month adds approximately ${activeRampMonths > 0 ? Math.round((activeTargetOcc - activeStartOcc) / activeRampMonths) : 0}% occupancy until the ${activeTargetOcc}% ceiling is reached

1. Launch: Nov 2026. Month 1 occupancy: ${activeStartOcc}% (this is the model's actual starting occupancy — do NOT use a different figure)
2. Ramp is marketing-led not referral-led: Abi has strong social media presence, META ads planned, Hampshire press/Muddy Stilettos coverage, and a soft launch event targeting local Winchester contacts. This accelerates new client acquisition above a typical cold-start curve, but does NOT substitute for the absence of a pre-built local client base.
3. Apply the linear ramp above, reaching ${activeTargetOcc}% by Month ${activeRampMonths}, then plateau
4. Seasonal multipliers (apply to baseline occupancy): Nov +5% (pre-Christmas demand spike), Dec -12% (holiday quiet), Jan +10% (new year resolution surge), Feb -5% (quietest month), Mar +3%, Apr +2%, May +5% (pre-summer), Jun +3%, Jul -4%, Aug -6%, Sep +2%, Oct +4% (pre-Christmas early bookings)
5. Do NOT exceed ${Math.round(activeTargetOcc * 1.15)}% occupancy in any month (cap at 115% of the active scenario's target occupancy of ${activeTargetOcc}%)
6. In driverNote for each month, reference Winchester-specific acquisition drivers only (e.g. META ads, Google reviews, walk-in footfall, Hampshire press, repeat bookings from early clients) — NEVER mention Bedhampton clients`;
})() : "Financial model not yet entered — cannot compute ramp-up model inputs."}

MANDATORY CONSTRAINTS — you MUST comply with ALL of the following before generating your response:
1. BUSINESS RATES: The business rates figure is taken exclusively from the itemised fixed costs list provided above. Do NOT independently calculate, estimate, or override rates — use only the exact figure from that list.
2. BEDHAMPTON REVENUE: All calculations use the manually entered model figure (£${financial?.existingClinicRevenueGbp || 0}/mo). The live Bedhampton feed figures shown in the context are for reference only — they must NOT be used in any calculation.
3. CONSUMABLES: Do NOT include consumables as a concern, data gap, or missing cost item. Consumables are captured within the variable cost percentages. Remove any consumables flag from concerns or conditions.
4. VAT ON RENT at 9A Jewry Street: This is CONFIRMED NO VAT on rent — a verified fact. Do NOT flag VAT on rent as a risk, concern, condition, or negotiation point for 9A Jewry Street under any circumstances whatsoever.
5. BREAK-EVEN FIGURES: Use only the pre-computed break-even revenue (£${breakEvenRevenue.toLocaleString()}/mo) supplied above. Do NOT recalculate independently.
6. CAPACITY MODEL: The revenue ceiling and break-even occupancy use the exact working days (${financial?.workingDaysPerMonth || 0} days/mo) and hours/day (${financial?.practitionerHoursPerDay || 0} hrs) from the Life Design plan above. Do NOT substitute different figures.
7. PROPERTY COMPARISON: You MUST populate the propertyComparison field. Use the computed figures from the PROPERTY COMPARISON section above — do not substitute your own estimates.

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
    "competitorAnalysis": "<3-4 sentences of detailed competitor analysis: who are the highest-threat operators and WHY? Reference specific names, their positioning, pricing, Google reviews, and distance. Where does APA have a clear edge (IP status, nurse credentials, Bedhampton reviews)? Where is she vulnerable? Use the pricing rank data to assess whether her target prices are commercially defensible — cite actual treatment prices and ranks.>",
    "demographics": "<3-4 sentences on the Winchester catchment demographics as they relate to this business: what is the realistic addressable market size, who is the core client, what spending power exists, what does the seasonal and footfall pattern mean for her revenue model, and how does the Jewry Street location specifically sit within the city's consumer geography? Be specific and commercial — not generic>",
    "strategic": "<2 sentences on strategic fit: does this move make sense for Abi's business at this stage? How does Bedhampton's current performance de-risk or complicate the move?>",
    "personal": "<2 sentences on her personal financial position: does her runway, nursing income, and Bedhampton income give her enough buffer to safely commit to this lease?>",
    "lifeDesign": "<2-3 sentences on personal readiness: does the nursing exit timeline align with the opening date? Is the clinic schedule model consistent with her personal maximum? Are there unresolved family logistics (school run, David's role) that represent operational risk? Flag any revenue ceiling conflicts between the financial model and her personal day-limit.>"
  },
  "riskScores": {
    "financial": <1-10 where 10 = extremely high risk — assess affordability, break-even realism, VAT exposure>,
    "property": <1-10 — assess rent level, lease terms known so far, location risk>,
    "market": <1-10 — assess Winchester demand, competition, pricing power>,
    "strategic": <1-10 — assess timing, personal readiness, Bedhampton dependency>,
    "lifeDesign": <1-10 — assess nursing exit timing, schedule model realism, school run coverage, family support solidity>,
    "overall": <1-10>
  },
  "riskRationale": {
    "financial": "<one sentence>",
    "property": "<one sentence>",
    "market": "<one sentence>",
    "strategic": "<one sentence>",
    "lifeDesign": "<one sentence — nursing exit timing, schedule realism, family logistics>"
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
    "<key lease negotiation point 1 — e.g. rent-free period: push for X months>",
    "<key point 2 — e.g. break clause: year 3, 6 months notice>",
    "<key point 3 — e.g. repairing obligations: internal only + schedule of condition>",
    "<key point 4 — e.g. fit-out contribution: ask £X or equivalent rent-free>"
  ],
  "propertyComparison": {
    "properties": [
      {
        "address": "<full address>",
        "isActive": <true for the currently selected property>,
        "monthlyRent": <integer>,
        "monthlyRates": <integer>,
        "monthlyAllIn": <integer — rent + rates + service charge>,
        "totalMonthlyFixed": <integer — all fixed costs with this property's rent/rates>,
        "breakEvenRevenue": <integer — use the computed figure from PROPERTY COMPARISON section above>,
        "breakEvenOccupancy1Room": <integer % — use computed figure>,
        "breakEvenOccupancy2Rooms": <integer % — use computed figure if 2 rooms available>,
        "revenueCeiling1Room": <integer — £/mo at 100% occupancy, 1 room>,
        "revenueCeiling2Rooms": <integer — £/mo at 100% occupancy, 2 rooms>,
        "vatOnRent": <boolean>,
        "listedBuildingRisk": "<specific fit-out and planning constraints for listed buildings, or 'None' if not listed>",
        "signageViability": "<assessment of external signage options and planning constraints>",
        "notes": "<any other commercially relevant property-specific notes>"
      }
    ],
    "recommendation": "<named recommendation: state clearly which property you recommend and why in 2-3 sentences — cite real numbers>",
    "keyDifferentiators": ["<specific difference 1 with numbers>", "<specific difference 2>", "<specific difference 3>"]
  },
  "reviewTrigger": "<what would change your verdict — e.g. rent increases above X, Bedhampton revenue drops below Y>",
  "nextReviewDate": "<ISO 8601 date>",
  "monthlyRevenueForecast": [
    {
      "month": "Nov 2026",
      "monthIndex": 1,
      "projectedRevenue": <integer — use the formula: slots × occupancyPct/100 × ACV, rounded to nearest £50>,
      "occupancyPct": <integer — apply ramp-up + seasonal multiplier>,
      "newClientsProjected": <integer — estimated new Winchester clients booked that month>,
      "netProfitLoss": <integer — use the formula above: revenue × (1-varRate) - totalMonthlyCost>,
      "cumulativePL": <integer — running total from month 1>,
      "confidencePct": <integer 40-90 — how confident are you in THIS month's projection; month 1 highest certainty, later months lower>,
      "driverNote": "<1 sentence: what drives this month — e.g. 'Pre-Christmas demand spike + META ads converting early Winchester enquiries'>",
      "isBreakEven": <true if projectedRevenue >= breakEvenRevenue, else false>
    },
    { "month": "Dec 2026", "monthIndex": 2 },
    { "month": "Jan 2027", "monthIndex": 3 },
    { "month": "Feb 2027", "monthIndex": 4 },
    { "month": "Mar 2027", "monthIndex": 5 },
    { "month": "Apr 2027", "monthIndex": 6 },
    { "month": "May 2027", "monthIndex": 7 },
    { "month": "Jun 2027", "monthIndex": 8 },
    { "month": "Jul 2027", "monthIndex": 9 },
    { "month": "Aug 2027", "monthIndex": 10 },
    { "month": "Sep 2027", "monthIndex": 11 },
    { "month": "Oct 2027", "monthIndex": 12 }
  ],
  "revenueForecast": {
    "breakEvenMonth": <integer 1-12, or null if break-even not reached within 12 months>,
    "firstProfitableMonth": "<e.g. 'Mar 2027' or 'Not within Year 1'>",
    "totalYear1Revenue": <integer — sum of all 12 months' projectedRevenue>,
    "totalYear1NetPL": <integer — sum of all 12 months' netProfitLoss>,
    "peakMonth": "<e.g. 'Oct 2027' — highest revenue month>",
    "peakMonthRevenue": <integer>,
    "year1Narrative": "<2-3 sentences: overall arc of Year 1 — when does she break even, what does the cumulative deficit look like, can Bedhampton absorb it, is this a viable business in Year 1? Use actual £ numbers.>",
    "revenueViabilityVerdict": "strong" | "viable" | "marginal" | "unlikely",
    "keyRampRisks": ["<specific risk 1 — e.g. 'December quiet period creates £X cash gap'>", "<risk 2>", "<risk 3>"],
    "keyRampCatalysts": ["<what would accelerate ramp-up 1>", "<catalyst 2>", "<catalyst 3>"]
  }
}`;

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 300_000);
    const raw = await claudeComplete({
      messages: [{ role: "user", content: masterPrompt }],
      maxTokens: 9000,
      signal: abort.signal,
    });
    clearTimeout(timeout);
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

// ─── POST /api/projects/:projectId/go-no-go/lease-strategy ───────────────────
// Full negotiation strategy — opening position, covenant strength, concession
// priority order with £ impact, sequencing, counter-offer framework,
// deal-breaker logic, and integrated HoT checklist. All numbers derived from
// the financial model; AI generates narrative, rankings, and framing.

router.post("/projects/:projectId/go-no-go/lease-strategy", async (req, res) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

  const [financialRaw, allPropertiesRaw, projectPhases, fixedItems] = await Promise.all([
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)),
    db.select().from(propertiesTable).where(eq(propertiesTable.projectId, projectId)),
    db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active"))),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
  ]);

  const phaseIds = projectPhases.map(p => p.id);
  const allTasks = phaseIds.length > 0
    ? await db.select().from(tasksTable).where(inArray(tasksTable.phaseId, phaseIds))
    : [];

  const financial = financialRaw[0] ?? null;
  const property = allPropertiesRaw.find((p) => p.isActiveForProject) ?? allPropertiesRaw[0] ?? null;

  const monthlyRent = property?.monthlyRentGbp ?? 0;
  const sqft = property?.sqFootage ?? 0;
  const leaseLength = property?.leaseLength ?? "unknown";
  const serviceCharge = property?.serviceChargeGbp ?? 0;
  const vatOnRent = property?.vatOnRent ?? false;
  const useClass = property?.useClass ?? "unknown";
  const address = [property?.address, property?.postcode].filter(Boolean).join(", ") || "selected property";

  // ── Server-calculated numbers injected directly into prompt ──────────────────
  const openingOfferRent = monthlyRent > 0 ? Math.round(monthlyRent * 0.88) : 0;
  const discountGbp = monthlyRent - openingOfferRent;

  // Total monthly fixed costs
  const modelFixedCosts = financial
    ? Math.round(financial.rentGbp + financial.ratesGbp + financial.utilitiesGbp +
        financial.internetGbp + financial.insuranceGbp + financial.accountantGbp +
        financial.softwareGbp + financial.wasteContractGbp + financial.cleanerGbp +
        financial.subscriptionsGbp + financial.financeRepaymentsGbp)
    : 0;
  const totalFixed = fixedItems.length > 0
    ? Math.round(fixedItems.reduce((s, c) => s + (c.amountGbp ?? 0), 0))
    : modelFixedCosts;

  // Monthly revenue at each scenario
  const acv = financial ? (financial.wincAcvGbp || financial.averageClientValueGbp || 155) : 155;
  const rooms = financial?.treatmentRoomsCount ?? 2;
  const hours = financial?.practitionerHoursPerDay ?? 7;
  const days = financial?.workingDaysPerMonth ?? 17;
  const varRate = financial ? (financial.stockPercent + financial.commissionsPercent) / 100 : 0.08;

  const scenarioRev = (occ: number) =>
    Math.round(rooms * Math.floor(hours) * days * acv * (occ / 100));
  const conservRev = financial ? scenarioRev(financial.conservativeOccupancyPercent) : 0;
  const realisticRev = financial ? scenarioRev(financial.realisticOccupancyPercent) : 0;
  const aggressiveRev = financial ? scenarioRev(financial.aggressiveOccupancyPercent) : 0;

  // Walk-away is a RANGE — ceiling = asking rent; floor = opening offer
  // Hard rule: never pay more than asking rent
  // Each missing critical concession reduces the acceptable ceiling toward the opening offer
  // Break clause (yr 3) = 40% of gap, rent-free ≥3mo = 35%, service charge cap = 25%
  const concessionGap = monthlyRent - openingOfferRent; // = 12% of asking
  const walkAwayMax = monthlyRent;       // absolute ceiling — only if ALL 3 critical concessions secured
  const walkAwayMin = openingOfferRent;  // floor — if NO concessions secured, walk at opening offer
  const breakClauseValue = Math.round(concessionGap * 0.40);
  const rentFreeValue    = Math.round(concessionGap * 0.35);
  const svcCapValue      = Math.round(concessionGap * 0.25);

  // Break-even monthly revenue (for context)
  const breakEvenRev = varRate < 1 ? Math.round(totalFixed / (1 - varRate)) : 0;

  // Fit-out task cost estimate
  const fitOutTasks = allTasks.filter(t =>
    (t.title ?? "").toLowerCase().match(/fit.?out|refurb|build|interior|plumb|electric|flooring/));
  const fitOutCostEstimate = fitOutTasks.reduce((s, t) => s + (t.selectedCost || t.costMid || 0), 0);

  // Bedhampton + capital
  const bedhAnnual = financial ? (financial.existingClinicRevenueGbp || 0) * 12 : 0;
  const businessCapital = financial?.runwaySavingsGbp ?? 0;
  const freeRentInModel = financial?.freeRentMonths ?? 0;
  const nursingIncome = financial?.nursingIncomeGbp ?? 0;

  // ── Context blocks ─────────────────────────────────────────────────────────
  const propCtx = property ? `
PROPERTY: ${address}
Size: ${sqft > 0 ? `${sqft} sq ft` : "not measured"}
Asking rent: £${monthlyRent}/mo (£${(monthlyRent * 12).toLocaleString()}/yr)
Service charge: ${serviceCharge > 0 ? `£${serviceCharge}/yr` : "not known"}
VAT on rent: ${vatOnRent ? "YES — landlord has opted to tax; 20% on top of rent" : "No"}
Use class: ${useClass}
Lease length offered: ${leaseLength}
Location tier: Secondary Winchester pitch — not prime high street` : "No active property selected.";

  const finCtx = financial ? `
FINANCIAL MODEL:
Winchester ACV: £${acv} | Treatment rooms: ${rooms} | Practitioner hours/day: ${hours} | Working days/mo: ${days}
Conservative (${financial.conservativeOccupancyPercent}% occ): £${conservRev.toLocaleString()}/mo gross revenue
Realistic (${financial.realisticOccupancyPercent}% occ): £${realisticRev.toLocaleString()}/mo gross revenue
Aggressive (${financial.aggressiveOccupancyPercent}% occ): £${aggressiveRev.toLocaleString()}/mo gross revenue
Monthly break-even revenue needed: £${breakEvenRev.toLocaleString()}
Total monthly fixed costs: £${totalFixed.toLocaleString()}
Variable cost rate: ${Math.round(varRate * 100)}%
Bedhampton annual turnover: £${bedhAnnual.toLocaleString()} (temporary support clinic — will close once Winchester self-funds)
Business capital available: £${businessCapital.toLocaleString()}
Nursing income (monthly, personal): £${nursingIncome.toLocaleString()}
Fit-out cost estimate from project tasks: ${fitOutCostEstimate > 0 ? `£${fitOutCostEstimate.toLocaleString()}` : "not yet quantified — clinical-grade fit-out required"}
Rent-free months already modelled: ${freeRentInModel}` : "No financial model available.";

  const calcCtx = `
SERVER-CALCULATED NUMBERS — use these EXACT figures in openingPosition:
  Opening offer rent: £${openingOfferRent}/mo (12.0% below asking; saving £${discountGbp}/mo vs asking)
  Walk-away — RANGE (asking rent is the absolute hard ceiling; never exceed it):
    walkAwayRentMax: £${walkAwayMax}/mo — ONLY if ALL THREE critical concessions secured (break clause + ≥3mo rent-free + service charge cap)
    walkAwayRentMin: £${walkAwayMin}/mo — if NONE of the three secured (= opening offer; walk away entirely)
    Break clause at yr 3 unlocks: £${breakClauseValue}/mo headroom (40% of the 12% gap)
    Rent-free ≥3mo unlocks:      £${rentFreeValue}/mo headroom (35% of the 12% gap)
    Service charge cap unlocks:  £${svcCapValue}/mo headroom (25% of the 12% gap)
  Value of 1 month rent-free: £${monthlyRent.toLocaleString()} (= asking rent)
  Value of 6 months rent-free: £${(monthlyRent * 6).toLocaleString()}
  Break clause exposure — 5yr lease, no break at yr 3: £${(monthlyRent * 24).toLocaleString()} total (24 months × asking rent)`;

  const prompt = `You are a specialist UK commercial property negotiation advisor for aesthetics clinics.

${propCtx}
${finCtx}
${calcCtx}

TENANT: Abi Peters — nurse prescriber (independent prescriber, highest clinical qualification for aesthetics), opening second clinic. Existing clinic Bedhampton has strong Google reviews and £${Math.round(bedhAnnual / 1000)}k/yr turnover. First-time commercial tenant. Premium medical aesthetics — not a beauty salon.

STRATEGIC PHILOSOPHY (apply throughout):
1. Covenant strength is the primary lever — lead with who Abi is before any numbers
2. Non-rent concessions (rent-free, break clause, fit-out) have more financial value than headline rent reduction
3. Leverage is highest before the landlord knows the ceiling — opening position must be defensible with genuine justification, not arbitrary
4. Secure concessions first; settle rent last
5. In a competitive letting situation, being a high-quality, low-risk tenant beats being a low bidder

Winchester E-class market norms (2024-2026):
- Rent-free: 3–6 months typical; clinical tenants with fit-out investment can justify more
- Break clause: landlords resist but concede for quality tenants; year 3 on a 5yr lease is achievable
- Rent review: avoid OMV; push CPI-capped (≤5%) or fixed uplift every 3-5 years
- Repairing: landlords push FRI; negotiate internal only + schedule of condition
- Service charge: typically uncapped; push for cap with transparent schedule
- Deposit: 3–6 months typical; reduce to 3mo or personal guarantee for demonstrably strong tenants

Return ONLY valid JSON (no markdown fences). Schema:
{
  "openingPosition": {
    "openingOfferRent": ${openingOfferRent},
    "targetSettlement": <int ≤ £${monthlyRent} — realistic final agreed figure; in competitive market near asking is normal>,
    "walkAwayRentMax": ${walkAwayMax},
    "walkAwayRentMin": ${walkAwayMin},
    "walkAwayExplanation": "We will pay up to £${walkAwayMax}/mo only if [name the 3 specific concessions using the actual numbers — e.g. 'a break clause at year 3', '≥3 months rent-free', 'a capped service charge schedule'] are all secured. Without all three protections, we walk at £${walkAwayMin}/mo.",
    "discountJustification": [
      "<reason 1: secondary pitch characteristic — specific to this location>",
      "<reason 2: cold-start risk of new location without existing Winchester patient base>",
      "<reason 3: capital investment in clinical-grade fit-out required before revenue>",
      "<reason 4: revenue ramp-up period before break-even, backed by model figures>"
    ],
    "walkAwayJustification": "<1 sentence using the model numbers provided — which scenario, what the maths shows>",
    "negotiationApproach": "<2 sentences: what APA leads with (covenant quality), and where the negotiation energy focuses (concessions not rent)>"
  },
  "covenantStrength": {
    "rating": "strong" | "moderate" | "developing",
    "headline": "<1 sentence Abi would use to open a landlord meeting — draws on her specific credentials and Bedhampton data>",
    "strengths": [
      { "title": "Clinical Credentials", "detail": "<specific to IP status and clinical qualification>", "level": "high" | "medium" | "low" },
      { "title": "Trading Track Record", "detail": "<reference Bedhampton revenue £${Math.round(bedhAnnual/1000)}k/yr>", "level": "high" | "medium" | "low" },
      { "title": "Capital Position", "detail": "<reference £${businessCapital.toLocaleString()} capital and Bedhampton support>", "level": "high" | "medium" | "low" },
      { "title": "Fit-Out Investment", "detail": "<clinical-grade fit-out adds value to landlord's asset>", "level": "high" | "medium" | "low" },
      { "title": "Long-Term Commitment", "detail": "<premium clinic, not speculative retail>", "level": "high" | "medium" | "low" }
    ]
  },
  "concessions": [
    {
      "rank": 1,
      "name": "<concession name>",
      "category": "rent-free" | "break-clause" | "fit-out-contribution" | "rent-review" | "deposit" | "repairing" | "service-charge" | "other",
      "ask": "<specific ask with numbers>",
      "minimum": "<minimum acceptable>",
      "financialImpactGbp": <int — £ value of winning this; use the calculated values above>,
      "impactBasis": "<1 line showing the maths — e.g. '6mo × £${monthlyRent}/mo asking rent'>",
      "tenantPosition": "<1 sentence: genuine reason from the tenant's commercial position>",
      "priority": "critical" | "high" | "medium"
    }
  ],
  "sequencing": [
    {
      "stage": 1,
      "title": "Establish Covenant Package — Before Any Numbers",
      "objective": "<what this stage achieves before rent is discussed>",
      "actions": ["<concrete action drawing on Bedhampton data or credentials>", "<second action>"],
      "status": "ready" | "in-progress" | "pending"
    },
    {
      "stage": 2,
      "title": "Submit Near-Asking Offer to Be Shortlisted",
      "objective": "<why this sequence — lead with quality not discount>",
      "actions": ["<what to submit and how>", "<what to include in the offer pack>"],
      "status": "ready" | "in-progress" | "pending"
    },
    {
      "stage": 3,
      "title": "Layer Concession Asks Once in Preferred-Bidder Position",
      "objective": "<why concessions come after selection, not before>",
      "actions": ["<first concession to raise and how>", "<sequencing if landlord pushes back>"],
      "status": "ready" | "in-progress" | "pending"
    },
    {
      "stage": 4,
      "title": "Settle Rent — Last",
      "objective": "<why rent is the final point — and what's already been won by this stage>",
      "actions": ["<what the tenant has locked in before this conversation>", "<how to frame final rent>"],
      "status": "pending"
    }
  ],
  "counterOfferFramework": {
    "holdFirm": [
      { "item": "<what to hold firm on>", "reason": "<why this is non-negotiable in model terms>", "exposureGbp": <int — £ exposure if lost> }
    ],
    "canConcede": [
      { "item": "<what can be conceded>", "condition": "<under what counter or in exchange for what>", "financialImpactGbp": <int> }
    ],
    "walkAwayTriggers": [
      { "condition": "<specific trigger that breaks the deal commercially>", "financialExposure": "<£ quantified>", "modelBasis": "<which scenario or calculation from the model>" }
    ]
  },
  "dealBreakers": [
    { "condition": "<specific deal-breaking condition>", "threshold": "<the specific limit>", "modelBasis": "<calculation from the model numbers above>", "exposureGbp": <int> }
  ],
  "headsOfTerms": [
    { "clause": "Agreed rent", "status": "must-confirm", "yourPosition": "£${openingOfferRent}–£${monthlyRent}/mo", "landlordPosition": "£${monthlyRent}/mo asking", "financialImpact": "£${discountGbp * 12}/yr if full reduction achieved", "importance": "critical" },
    { "clause": "Rent-free period", "status": "negotiate", "yourPosition": "<target>", "landlordPosition": "<typical>", "financialImpact": "<£ per month, use £${monthlyRent}/mo>", "importance": "critical" },
    { "clause": "Lease length", "status": "must-confirm", "yourPosition": "<tenant preference>", "landlordPosition": "<what's offered: ${leaseLength}>", "financialImpact": "<total commitment £>", "importance": "critical" },
    { "clause": "Break clause", "status": "negotiate", "yourPosition": "<year and notice>", "landlordPosition": "<typical resistance>", "financialImpact": "<downside exposure if not obtained>", "importance": "critical" },
    { "clause": "Rent review mechanism", "status": "negotiate", "yourPosition": "<CPI-capped or fixed uplift>", "landlordPosition": "<OMV every 5yr default>", "financialImpact": "<compounding risk over lease term>", "importance": "high" },
    { "clause": "Service charge cap", "status": "negotiate", "yourPosition": "<cap + transparent schedule>", "landlordPosition": "<uncapped typical>", "financialImpact": "<annual risk uncapped>", "importance": "high" },
    { "clause": "Repairing obligations", "status": "negotiate", "yourPosition": "Internal repairing only + schedule of condition", "landlordPosition": "Full repairing and insuring (FRI)", "financialImpact": "<dilapidations exposure FRI vs IRI>", "importance": "high" },
    { "clause": "Schedule of condition", "status": "must-confirm", "yourPosition": "Photographic schedule before signing", "landlordPosition": "<often omitted>", "financialImpact": "Protects against dilapidations claims at lease end", "importance": "high" },
    { "clause": "Use class — clinical aesthetics", "status": "must-confirm", "yourPosition": "Class E confirmed for medical aesthetics / clinical use", "landlordPosition": "<may need consent for clinical use>", "financialImpact": "Deal-breaker if refused — cannot trade", "importance": "critical" },
    { "clause": "Fit-out contribution", "status": "negotiate", "yourPosition": "<ask amount>", "landlordPosition": "<not standard but negotiable>", "financialImpact": "${fitOutCostEstimate > 0 ? `£${fitOutCostEstimate.toLocaleString()} estimated total fit-out` : "Significant fit-out investment required"}", "importance": "high" },
    { "clause": "Subletting / assignment", "status": "negotiate", "yourPosition": "<flexibility to assign or sublet>", "landlordPosition": "<landlord consent required>", "financialImpact": "<exit option value>", "importance": "medium" },
    { "clause": "Rent deposit", "status": "negotiate", "yourPosition": "2 months (agreed in heads of terms)", "landlordPosition": "3–6 months upfront", "financialImpact": "${monthlyRent * 2} cash tied up at exchange", "importance": "high" },
    { "clause": "Insurance obligations", "status": "must-confirm", "yourPosition": "<clinical liability + contents>", "landlordPosition": "<building insurance landlord; contents/liability tenant>", "financialImpact": "Clinical liability essential pre-trade", "importance": "medium" },
    { "clause": "Signage / fascia rights", "status": "must-confirm", "yourPosition": "Premium fascia signage essential for brand", "landlordPosition": "<landlord consent required>", "financialImpact": "Brand visibility directly impacts marketing CAC", "importance": "medium" },
    { "clause": "Planning consent for clinical use", "status": "must-confirm", "yourPosition": "Confirmed before exchange", "landlordPosition": "<Class E may need specific clinical consent>", "financialImpact": "Deal-breaker if retrospective — cannot open", "importance": "critical" }
  ]
}`;

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const raw = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8000,
      signal: abort.signal,
    });
    clearTimeout(timeout);
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
      return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
    }

    return res.json({ ...parsed, generatedAt: new Date().toISOString() });
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
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const content = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: max_completion_tokens,
      signal: abort.signal,
    });
    clearTimeout(timeout);
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

// ─── Funding Analysis ─────────────────────────────────────────────────────────

// GET  /api/projects/:projectId/funding-analysis  — fetch latest saved analysis
router.get("/projects/:projectId/funding-analysis", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const rows = await db.select()
    .from(projectAiAnalysesTable)
    .where(eq(projectAiAnalysesTable.projectId, projectId))
    .orderBy(desc(projectAiAnalysesTable.createdAt))
    .limit(1);
  if (!rows.length) return res.json(null);
  return res.json({ ...rows[0].resultJson as object, _savedAt: rows[0].createdAt, _contextNote: rows[0].contextNote });
});

// POST /api/projects/:projectId/funding-analysis  — run AI analysis
router.post("/projects/:projectId/funding-analysis", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const contextNote: string = (req.body.contextNote ?? "").trim();

  // ── 1. Load raw data ───────────────────────────────────────────────────────
  const [investments, financial, fixedCostItems] = await Promise.all([
    db.select().from(investmentsTable).where(eq(investmentsTable.projectId, projectId)),
    db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId)).then(r => r[0] ?? null),
    db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId)),
  ]);
  const fin = financial; // both names are used below

  // ── 2. Capital requirement from tasks + overrides ─────────────────────────
  const { sql: sqlTmpl } = await import("drizzle-orm");
  const taskRows = await db.execute(sqlTmpl`
    SELECT
      t.id,
      t.status,
      COALESCE(pto.selected_cost, t.selected_cost)  AS selected_cost,
      COALESCE(pto.cost_high,     t.cost_high)       AS high_risk_cost,
      COALESCE(pto.status, t.status) AS eff_status
    FROM launch_tasks t
    JOIN launch_phases ph ON ph.id = t.phase_id
    LEFT JOIN property_task_overrides pto
      ON pto.task_id = t.id AND pto.property_id = 11
    WHERE ph.project_id = ${projectId}
      AND ph.status = 'active'
      AND COALESCE(pto.status, t.status) NOT IN ('superseded','deferred')
  `);
  const capitalSelected = (taskRows.rows as any[]).reduce((s, r) => s + Number(r.selected_cost ?? 0), 0);
  const capitalHighRisk  = (taskRows.rows as any[]).reduce((s, r) => s + Number(r.high_risk_cost ?? 0), 0);

  // ── 2b. Pre-opening resources available (business capital + Bedhampton income) ─
  const businessCapital      = financial?.runwaySavingsGbp ?? 0;
  const bedhMonthlyRev       = (financial as any)?.existingClinicRevenueGbp || 0;
  const bedhStockP           = (financial as any)?.bedhStockPercent ?? 35;
  const bedhRunning          = ((financial as any)?.bedhRentGbp || 0) +
    ((financial as any)?.bedhMarketingGbp || 0) + ((financial as any)?.bedhamptonCostsGbp || 0) +
    ((financial as any)?.bedhSoftwareGbp || 0) + ((financial as any)?.bedhStaffingGbp || 0) +
    ((financial as any)?.bedhInsuranceGbp || 0);
  const bedhNetMonthlyAI     = Math.max(0, bedhMonthlyRev * (1 - bedhStockP / 100) - bedhRunning);
  const projRow              = await db.select().from((await import("@workspace/db")).projectsTable).where((await import("drizzle-orm")).eq((await import("@workspace/db")).projectsTable.id, projectId)).limit(1);
  const openingDateAI        = projRow[0]?.targetOpeningDate ? new Date(projRow[0].targetOpeningDate) : null;
  const nowAI                = new Date();
  const preOpenMonthsAI      = openingDateAI
    ? Math.max(0, (openingDateAI.getFullYear() - nowAI.getFullYear()) * 12 + (openingDateAI.getMonth() - nowAI.getMonth()))
    : 0;
  const preOpenBedhNetAI     = Math.round(bedhNetMonthlyAI * preOpenMonthsAI);
  const totalSelfFundableAI  = Math.round(businessCapital + preOpenBedhNetAI);
  const realNeedSelected     = Math.max(0, Math.round(capitalSelected   - totalSelfFundableAI));
  const realNeedHighRisk     = Math.max(0, Math.round(capitalHighRisk   - totalSelfFundableAI));

  // ── 3. Quick financial projections (FY1-3) ────────────────────────────────
  const loans   = investments.filter(i => i.type === "loan");
  const equity  = investments.filter(i => i.type === "equity");
  const totalCapital = investments.reduce((s, i) => s + (i.amountGbp ?? 0), 0);
  const totalEquityPct = equity.reduce((s, i) => s + (i.equityPercent ?? 0), 0);

  function monthlyRepaymentCalc(principal: number, annualRate: number, term: number): number {
    if (term <= 0 || principal <= 0) return 0;
    if (annualRate <= 0) return principal / term;
    const r = annualRate / 100 / 12;
    return principal * (r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
  }

  const totalMonthlyLoanRepayment = loans.reduce((s, l) => {
    return s + monthlyRepaymentCalc(l.amountGbp ?? 0, l.interestRatePercent ?? 0, l.repaymentTermMonths ?? 0);
  }, 0);

  const acv           = (fin as any)?.wincAcvGbp || (fin as any)?.averageClientValueGbp || 155;
  const rooms         = (fin as any)?.treatmentRoomsCount ?? 1;
  const hours         = (fin as any)?.practitionerHoursPerDay ?? 7;
  const days          = (fin as any)?.workingDaysPerMonth ?? 17;
  const realisticOcc  = ((fin as any)?.realisticOccupancyPercent ?? 65) / 100;
  const slotsPerMonth = rooms * hours * days;
  const monthlyRevenue = slotsPerMonth * realisticOcc * acv + ((fin as any)?.membershipRevenueGbp ?? 0);

  const fixedMonthly  = fixedCostItems.length > 0
    ? fixedCostItems.reduce((s, i) => s + (i.amountGbp ?? 0), 0)
    : ((fin as any)?.rentGbp ?? 0) + ((fin as any)?.ratesGbp ?? 0) + ((fin as any)?.utilitiesGbp ?? 0) +
      ((fin as any)?.insuranceGbp ?? 0) + ((fin as any)?.accountantGbp ?? 0) + ((fin as any)?.softwareGbp ?? 0);

  const variableRatio    = (((fin as any)?.stockPercent ?? 12) + ((fin as any)?.commissionsPercent ?? 0)) / 100;
  const variableMonthly  = monthlyRevenue * variableRatio + ((fin as any)?.marketingGbp ?? 0);
  const directorSalary   = (fin as any)?.ownerDrawingsGbp || (fin as any)?.targetDrawingsGbp || 0;
  const grossMonthlyProfit = monthlyRevenue - variableMonthly - fixedMonthly;
  const netMonthlyBeforeDirector = grossMonthlyProfit;
  const netMonthlyAfterAll = netMonthlyBeforeDirector - (directorSalary / 12) - totalMonthlyLoanRepayment;

  // FY estimates (approximated — real computation is in investments.ts)
  const fy1Revenue = monthlyRevenue * 7;   // ~7 trading months in FY1
  const fy2Revenue = monthlyRevenue * 12;
  const fy3Revenue = monthlyRevenue * 12 * 1.08;
  const grossMargin = monthlyRevenue > 0 ? (grossMonthlyProfit / monthlyRevenue) : 0;

  // ── 3b. Investment gap scenarios ─────────────────────────────────────────
  // Gaps are calculated against the REAL funding need (after offsetting existing
  // business capital and pre-opening Bedhampton income) — NOT the gross project cost.
  const gapLow    = Math.max(0, realNeedSelected - totalCapital);
  const gapMedium = Math.max(0, Math.round(realNeedSelected * 1.2) - totalCapital); // +20% working capital buffer
  const gapHigh   = Math.max(0, realNeedHighRisk - totalCapital);

  // ── 4. Build prompt ───────────────────────────────────────────────────────
  const financialContext = `
GROSS PROJECT COST (fit-out + all tasks):
- Selected (base) plan: £${Math.round(capitalSelected).toLocaleString()}
- High-risk (worst-case) plan: £${Math.round(capitalHighRisk).toLocaleString()}

PRE-OPENING RESOURCES (self-fundable — do NOT include in the investor ask):
- Business capital already in the business: £${Math.round(businessCapital).toLocaleString()}
- Pre-opening Bedhampton net income (${preOpenMonthsAI} months to launch): £${preOpenBedhNetAI.toLocaleString()}
- Total self-fundable: £${totalSelfFundableAI.toLocaleString()}

REAL INVESTMENT ASK (gross cost minus self-fundable resources):
- Against base plan: £${realNeedSelected.toLocaleString()} — this is what needs external funding
- Against worst-case: £${realNeedHighRisk.toLocaleString()}
- IMPORTANT: Do NOT present the £${Math.round(capitalSelected).toLocaleString()} gross cost as the investor ask. The business has £${totalSelfFundableAI.toLocaleString()} it can self-fund. The real ask is £${realNeedSelected.toLocaleString()}.

INVESTMENT GAP TIERS (based on real ask, after existing capital and Bedhampton income):
- Low — covers real ask exactly: £${gapLow.toLocaleString()} still needed
- Medium — real ask + 20% working capital buffer: £${gapMedium.toLocaleString()} still needed
- High — worst-case real ask: £${gapHigh.toLocaleString()} still needed

FUNDING ALREADY MODELLED IN DB:
- Total capital committed: £${Math.round(totalCapital).toLocaleString()}
- Loans: ${loans.length > 0 ? loans.map(l => `${l.name}: £${l.amountGbp?.toLocaleString()} at ${l.interestRatePercent}% over ${l.repaymentTermMonths} months`).join("; ") : "None"}
- Equity investors: ${equity.length > 0 ? equity.map(e => `${e.name}: £${e.amountGbp?.toLocaleString()} for ${e.equityPercent}% equity`).join("; ") : "None"}
- Total equity given up: ${totalEquityPct.toFixed(1)}%
- Total monthly loan repayment: £${Math.round(totalMonthlyLoanRepayment).toLocaleString()}

FINANCIAL MODEL (Winchester clinic, realistic scenario):
- Avg treatment value: £${acv}
- Treatment slots/month: ${slotsPerMonth}
- Realistic occupancy: ${Math.round(realisticOcc * 100)}%
- Est. monthly revenue at realistic occupancy: £${Math.round(monthlyRevenue).toLocaleString()}
- Monthly fixed costs: £${Math.round(fixedMonthly).toLocaleString()}
- Monthly variable costs: £${Math.round(variableMonthly).toLocaleString()}
- Director salary (annual): £${Math.round(directorSalary).toLocaleString()}
- Gross monthly profit: £${Math.round(grossMonthlyProfit).toLocaleString()}
- Net monthly after director + loan repayments: £${Math.round(netMonthlyAfterAll).toLocaleString()}
- Gross margin: ${(grossMargin * 100).toFixed(1)}%

3-YEAR REVENUE TRAJECTORY (approximated, realistic scenario):
- FY1 (Aug 2026–Jul 2027, ~7 trading months): £${Math.round(fy1Revenue).toLocaleString()}
- FY2 (full year, +0%): £${Math.round(fy2Revenue).toLocaleString()}
- FY3 (full year, +8% growth): £${Math.round(fy3Revenue).toLocaleString()}
`.trim();

  const userContext = contextNote
    ? `\n\nADDITIONAL CONTEXT FROM ABI:\n${contextNote}`
    : "\n\nNo additional context provided.";

  const prompt = `${financialContext}${userContext}

Based on this data, provide a structured funding strategy analysis for Abi's Winchester clinic launch. Consider:
1. Can the projected cash flows service debt comfortably?
2. Is the capital requirement achievable through loan alone, equity alone, hybrid, or self-funding?
3. What are the specific risks and opportunity costs of each route?
4. What are the concrete next steps?

Respond with ONLY valid JSON (no markdown, no prose outside JSON) in this exact structure:
{
  "verdict": "LOAN_RECOMMENDED" | "EQUITY_RECOMMENDED" | "HYBRID" | "SELF_FUND" | "INSUFFICIENT_DATA",
  "verdictLabel": "string (short label, e.g. 'Loan Finance Recommended')",
  "verdictSummary": "string (2-3 sentence overall verdict)",
  "recommendation": "string (3-5 sentence detailed recommendation paragraph)",
  "loanCase": {
    "suitabilityScore": number (1-10),
    "pros": ["string", ...],
    "cons": ["string", ...],
    "suggestedAmount": number (GBP),
    "suggestedTermMonths": number,
    "estimatedMonthlyRepayment": number (GBP),
    "affordabilityNote": "string"
  },
  "equityCase": {
    "suitabilityScore": number (1-10),
    "pros": ["string", ...],
    "cons": ["string", ...],
    "dilutionRisk": "Low" | "Medium" | "High",
    "dilutionNote": "string"
  },
  "selfFundCase": {
    "feasible": boolean,
    "suitabilityScore": number (1-10),
    "pros": ["string", ...],
    "cons": ["string", ...],
    "note": "string"
  },
  "repaymentCapacity": {
    "maxAffordableMonthlyGbp": number,
    "debtServiceCoverRatio": number,
    "breakEvenNote": "string",
    "capacityNote": "string"
  },
  "investmentGap": {
    "gapLow": ${gapLow},
    "gapMedium": ${gapMedium},
    "gapHigh": ${gapHigh},
    "lowLabel": "string (≤8 words — what Low covers)",
    "mediumLabel": "string (≤8 words — what Medium covers)",
    "highLabel": "string (≤8 words — what High covers)",
    "lowDetail": "string (2 sentences — what this amount unlocks and the risk of stopping here)",
    "mediumDetail": "string (2 sentences — what this amount unlocks and why the 15% buffer matters)",
    "highDetail": "string (2 sentences — what full worst-case coverage buys and who it's for)",
    "recommendedTier": "low" | "medium" | "high",
    "gapNarrative": "string (2-3 sentences summarising the overall funding gap position)"
  },
  "keyRisks": ["string", ...],
  "actionItems": ["string", ...],
  "dashboardSummary": "string (≤12 words for dashboard widget)"
}`;

  // ── 5. Call Claude ────────────────────────────────────────────────────────
  const raw = await claudeComplete({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    maxTokens: 2000,
  });
  let result: any;
  try {
    result = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    return res.status(500).json({ error: "AI returned malformed JSON", raw });
  }

  // Always stamp server-calculated gap numbers — AI narrative is additive only
  if (!result.investmentGap) result.investmentGap = {};
  result.investmentGap.gapLow    = gapLow;
  result.investmentGap.gapMedium = gapMedium;
  result.investmentGap.gapHigh   = gapHigh;
  result.investmentGap._capitalSelected = Math.round(capitalSelected);
  result.investmentGap._capitalHighRisk = Math.round(capitalHighRisk);
  result.investmentGap._totalCommitted  = Math.round(totalCapital);

  // ── 6. Persist ────────────────────────────────────────────────────────────
  await db.delete(projectAiAnalysesTable)
    .where(eq(projectAiAnalysesTable.projectId, projectId));

  const [saved] = await db.insert(projectAiAnalysesTable).values({
    projectId,
    analysisType: "funding",
    contextNote,
    resultJson: result,
  }).returning();

  return res.json({ ...result, _savedAt: saved.createdAt, _contextNote: contextNote });
});

export default router;
