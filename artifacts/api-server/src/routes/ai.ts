import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  fixedCostItemsTable, propertiesTable, financialsTable,
  phasesTable, tasksTable, decisionsTable,
  complianceItemsTable, cqcMilestonesTable,
  lifestylePlanTable, competitorsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 90_000);
    const completion = await openai.chat.completions.create(
      { model: "gpt-5.1", messages: [{ role: "user", content: prompt }], max_completion_tokens: 4000 },
      { signal: abort.signal },
    );
    clearTimeout(timeout);

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

  // ── Fixed cost itemisation (computed first — used in financial calcs below) ──
  const totalFixedItemsCost = fixedCostsRaw.reduce((s, c) => s + (c.amountGbp ?? 0), 0);

  let financialContext = "No financial model entered yet.";
  let cashRunwayMonths = 0;
  let modelIncomplete = false;
  let rentToRevenuePct = 0;
  let breakEvenRevenue = 0;
  let vatRisk = false;
  let vatRiskDetail = "";
  let bedhCoverageMonths = 0;

  if (financial) {
    // All three scenarios now use wincAcvGbp (Winchester-specific ACV, e.g. £155)
    // rather than the legacy averageClientValueGbp (originally set from Bedhampton, e.g. £120).
    // Conservative/Realistic previously used the wrong ACV, understating Winchester revenue.
    const wincAcv = financial.wincAcvGbp || financial.averageClientValueGbp;
    const conservative = calcScenario(financial.conservativeOccupancyPercent, wincAcv, financial);
    const realistic = calcScenario(financial.realisticOccupancyPercent, wincAcv, financial);
    const aggressive = calcScenario(financial.aggressiveOccupancyPercent, wincAcv, financial);

    // Use itemised fixed cost total when available — the scenario's `fixed` field only
    // sums legacy individual columns which may be incomplete if the user switched to
    // the dynamic fixed cost items list.
    const actualMonthlyFixed = totalFixedItemsCost > 0 ? totalFixedItemsCost : realistic.fixed;

    // Break-even: (fixedCosts + fixedVarItems) / (1 - variableRatio)
    // fixedVarItems = marketing + staffing + consumables (fixed monthly amounts, not %-of-revenue).
    // Previously omitted fixedVarItems, understating break-even by those amounts.
    const variableRatio = (financial.stockPercent + financial.commissionsPercent) / 100;
    const fixedVarItems = financial.marketingGbp + financial.staffingGbp + financial.consumablesGbp;
    breakEvenRevenue = Math.round((actualMonthlyFixed + fixedVarItems) / Math.max(1 - variableRatio, 0.01));

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

    const netAfterFixed = (occ: typeof realistic) => occ.revenue - actualMonthlyFixed - occ.variable;

    financialContext = `=== THREE-SCENARIO FINANCIAL MODEL (for ${propertyLabel}) ===
IMPORTANT: Use £${actualMonthlyFixed.toLocaleString()}/mo as the definitive monthly fixed cost figure (from itemised cost list). The scenario 'Fixed:' lines below show legacy category totals which may be incomplete.

Conservative (${financial.conservativeOccupancyPercent}% occupancy, £${wincAcv} ACV):
  Revenue: £${conservative.revenue.toLocaleString()}/mo | Fixed (actual): £${actualMonthlyFixed.toLocaleString()}/mo | Variable: £${conservative.variable.toLocaleString()}/mo | Net: £${netAfterFixed(conservative).toLocaleString()}/mo

Realistic (${financial.realisticOccupancyPercent}% occupancy, £${wincAcv} ACV):
  Revenue: £${realistic.revenue.toLocaleString()}/mo | Fixed (actual): £${actualMonthlyFixed.toLocaleString()}/mo | Variable: £${realistic.variable.toLocaleString()}/mo | Net: £${netAfterFixed(realistic).toLocaleString()}/mo

Aggressive (${financial.aggressiveOccupancyPercent}% occupancy, £${wincAcv} ACV):
  Revenue: £${aggressive.revenue.toLocaleString()}/mo | Fixed (actual): £${actualMonthlyFixed.toLocaleString()}/mo | Variable: £${aggressive.variable.toLocaleString()}/mo | Net: £${netAfterFixed(aggressive).toLocaleString()}/mo

Key ratios (Realistic scenario, using actual fixed costs):
  Break-even revenue needed: £${breakEvenRevenue.toLocaleString()}/mo
  Rent as % of revenue: ${rentToRevenuePct}% (industry guideline: aim for <15%)
  Bedhampton income vs new clinic fixed costs: ${bedhCoverageMonths}× (Bedh earns ${bedhCoverageMonths}× the new clinic's monthly fixed costs — NOT 4 years' worth)
  Treatment rooms: ${financial.treatmentRoomsCount} | Avg client value: £${financial.averageClientValueGbp} | Target ACV (new clinic): £${financial.wincAcvGbp || "not set"}
  Practitioner hours/day: ${financial.practitionerHoursPerDay} | Working days/mo: ${financial.workingDaysPerMonth}

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

  // ── Property context ──────────────────────────────────────────────────────
  const allPropertyLines = allPropertiesRaw.map((p) =>
    `  ${p.isActiveForProject ? "★ SELECTED" : "○"} ${p.address || "Unknown"} (${p.postcode || "?"}): £${p.monthlyRentGbp || "?"}/mo | ${p.sqFootage || "?"}sqft | Stage: ${p.status || "unknown"} | Use class: ${p.useClass || "?"} | VAT on rent: ${p.vatOnRent ? "Yes" : "No/unknown"}`
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
Fixed monthly variable items (marketing + staffing + consumables): £${fixedMonthlyCosts2.toLocaleString()}
Total monthly cost base (fixed + fixed-variable): £${totalMonthlyCost.toLocaleString()}
Variable cost rate (stock + commissions): ${Math.round(varRate * 100)}% of revenue
Winchester ACV target: £${wincAcv}
Max monthly treatment slots (capacity ceiling): ${maxMonthlySlots} slots/month (${financial.treatmentRoomsCount} room × ${financial.practitionerHoursPerDay}hrs/day × ${financial.workingDaysPerMonth} clinic days)
Revenue ceiling at 100% occupancy: £${Math.round(maxMonthlySlots * wincAcv).toLocaleString()}/month

⚠ CAPACITY MODEL CORRECTION (17 clinic days, not 22):
The model now uses 17 realistic clinic days/month (accounts for weekends, admin, training, holidays).
The previous 22-day assumption overstated capacity by 29%.
  Old revenue ceiling (22 days): £${Math.round(financial.treatmentRoomsCount * financial.practitionerHoursPerDay * 22 * wincAcv).toLocaleString()}/month
  New revenue ceiling (17 days): £${Math.round(maxMonthlySlots * wincAcv).toLocaleString()}/month
  Reduction: £${Math.round((financial.treatmentRoomsCount * financial.practitionerHoursPerDay * 22 - maxMonthlySlots) * wincAcv).toLocaleString()}/month less ceiling revenue

Break-even monthly revenue: £${breakEvenRevenue.toLocaleString()}
Break-even occupancy needed (17-day model): ~${beOcc}% of capacity
  (Old 22-day break-even occupancy was ~${financial.treatmentRoomsCount > 0 && wincAcv > 0 ? Math.round((breakEvenRevenue / (financial.treatmentRoomsCount * financial.practitionerHoursPerDay * 22 * wincAcv)) * 100) : 0}% — now ${beOcc}% under corrected model)

MANDATORY: The executiveSummary must state the revenue ceiling under 17 days (£${Math.round(maxMonthlySlots * wincAcv).toLocaleString()}/mo at 100% occ), the break-even occupancy now required (${beOcc}%), and compare to the old 22-day ceiling (£${Math.round(financial.treatmentRoomsCount * financial.practitionerHoursPerDay * 22 * wincAcv).toLocaleString()}/mo). This context is material to the go/no-go decision.

FORMULA for each month's net P&L:
  netProfitLoss = projectedRevenue - totalMonthlyCost - (projectedRevenue × variableCostRate)
  i.e. = projectedRevenue × (1 - ${Math.round(varRate * 100) / 100}) - £${totalMonthlyCost.toLocaleString()}

RAMP-UP ASSUMPTIONS — apply ALL of the following:
CRITICAL: Bedhampton is ~40 minutes from Winchester. These are two entirely separate client bases. There are ZERO client transfers from Bedhampton to Winchester. Winchester starts from a completely cold base — no existing clients will follow her there. Do NOT factor any Bedhampton client transfer into any month's projection.
1. Launch: Nov 2026. Month 1 occupancy: 15–22% (genuine cold start — brand new Winchester audience, zero carry-over bookings from Bedhampton)
2. Ramp is marketing-led not referral-led: Abi has strong social media presence, META ads planned, Hampshire press/Muddy Stilettos coverage, and a soft launch event targeting local Winchester contacts. This accelerates new client acquisition above a typical cold-start curve, but does NOT substitute for the absence of a pre-built local client base.
3. Months 2–4: grow 5–8% occupancy per month as marketing spend converts and early Google reviews accumulate
4. Months 5–8: grow 3–5% per month — word-of-mouth building, repeat bookings starting from month 3–4 clients
5. Months 9–12: growth slows to 1–3% per month — plateau approaching realistic occupancy ceiling
6. Seasonal multipliers (apply to baseline occupancy): Nov +5% (pre-Christmas demand spike), Dec -12% (holiday quiet), Jan +10% (new year resolution surge), Feb -5% (quietest month), Mar +3%, Apr +2%, May +5% (pre-summer), Jun +3%, Jul -4%, Aug -6%, Sep +2%, Oct +4% (pre-Christmas early bookings)
7. Do NOT exceed ${Math.round(financial.realisticOccupancyPercent * 1.15)}% occupancy in any month (cap at 115% of the realistic scenario)
8. In driverNote for each month, reference Winchester-specific acquisition drivers only (e.g. META ads, Google reviews, walk-in footfall, Hampshire press, repeat bookings from early clients) — NEVER mention Bedhampton clients`;
})() : "Financial model not yet entered — cannot compute ramp-up model inputs."}

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
    "<key point to negotiate in heads of terms 1 — e.g. rent-free period, break clause, fit-out contribution>",
    "<point 2>",
    "<point 3>",
    "<point 4 if warranted>"
  ],
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
    const timeout = setTimeout(() => abort.abort(), 120_000);
    const completion = await openai.chat.completions.create(
      { model: "gpt-5.4", max_completion_tokens: 9000, messages: [{ role: "user", content: masterPrompt }] },
      { signal: abort.signal },
    );
    clearTimeout(timeout);

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
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 90_000);
    const completion = await openai.chat.completions.create(
      { model: "gpt-5.1", messages: [{ role: "user", content: prompt }], max_completion_tokens },
      { signal: abort.signal },
    );
    clearTimeout(timeout);

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
