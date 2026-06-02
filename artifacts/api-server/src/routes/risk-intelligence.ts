import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import {
  financialsTable,
  fixedCostItemsTable,
  phasesTable,
  tasksTable,
  propertiesTable,
  projectsTable,
  projectAiAnalysesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  calcWinchester,
  calcBedhampton,
  calcCombined,
  calcOwner,
  calcWincAtOccupancy,
} from "../lib/financialEngine";

const router = Router();

const RISK_SYSTEM_PROMPT = `You are a hostile commercial due diligence consultant hired by the bank, not the founder. You have been given a complete financial model for a two-site medical aesthetics expansion. Your job is to find every way this plan can fail and present your findings without softening them.

CONSTRAINTS YOU MUST FOLLOW:
- VAT has been fully modelled and planned for in the financial projections. Do NOT raise VAT registration as a risk or blind spot. It is accounted for.
- Every sentence must reference specific figures from the model. Never write anything that could apply to any aesthetics business in general.
- Do not be encouraging. Do not acknowledge strengths. Do not pad with qualifications.
- Do not write bullet point lists. Write in dense analytical prose — each paragraph should build on the last.
- Each part must be at minimum 400 words. Shallow analysis is not acceptable.
- You are not writing a balanced report. You are writing the case for why this plan fails.

PART 1 — BLIND SPOTS
Go beyond the obvious. The founders have already thought about occupancy risk and launch costs. Find the second-order effects — what happens when two things go wrong simultaneously, or when a dependency chain breaks in sequence. Look at: the relationship between the Bedhampton revenue figure and the Winchester ramp — what is the specific cash consequence if Bedhampton underperforms by 20% during the Winchester ramp period? What does a 3-month construction delay do to the pre-opening cost model given the lease structure? What happens to the combined P&L when Winchester hits break-even occupancy at exactly the same month Bedhampton crosses the self-funding closure threshold — what is the gap month where both clinics are running at marginal economics simultaneously? What are the operational costs that do not appear in this model at all — equipment maintenance contracts, consumables inflation, staff illness cover, regulatory inspection costs, insurance premium increases after year 1? What does the owner drawings figure imply about the personal financial buffer — is there a month where drawings plus business losses plus household costs exceed the nursing income plus runway savings combined? Identify every assumption that has been made by absence — every cost that is zero in this model that will not be zero in reality.

PART 2 — EARLY WARNING SIGNALS
For every risk identified in Part 1, define the exact number that moves first in the monthly accounts — not a category, a specific line. State the threshold value at which that number signals a developing crisis rather than normal noise. Example format: "If stock costs as a percentage of Winchester revenue exceed X% in month Y, that is not a bad month — that is a pricing or mix problem that compounds." Give the tripwire for each risk. Include the lead time between the tripwire appearing and the crisis becoming irreversible — some risks give 30 days, some give 6 months. State which are which and why. Be specific about the interaction effects: which two tripwires firing simultaneously means the plan is structurally broken rather than temporarily stressed.

PART 3 — THE RESPONSE PLAYBOOK
For every tripwire in Part 2, write the exact operational response. Not "review marketing spend" — state the specific channel, the offer structure, the target audience segment implied by Winchester's location and demographic, and the realistic timeline from action to booking impact in an aesthetics context (hint: it is not 2 weeks). Not "reduce costs" — state which line items can be cut in month 1 without destroying revenue capacity, which require 60 days notice, and which are contractually fixed for the lease term. Include the personal finance response: at what point does the nursing income need to increase, what does that imply for clinical hours, and what does that do to Winchester treatment capacity? Write the playbook as if the founder has just seen a bad month-end report and has 48 hours to decide.

PART 4 — THE ONE THING
Given the specific numbers in this model — the occupancy assumptions, the Bedhampton revenue, the runway savings, the owner drawings, the fixed cost base, the launch timeline — what is the single most likely failure mode? Do not hedge. Pick one. Then walk through the exact month-by-month sequence from the trigger event to the point of no return. Name the months. State the P&L position in each month. Identify the last decision point where the trajectory could have been changed and what that decision would have cost. State what the business looks like at the point the founders would actually admit there is a problem — and how far past the last recovery point that moment typically arrives.

PART 5 — COMPETITOR RESPONSE
Winchester is a specific market. A new medical aesthetics clinic opening at 9A Jewry Street with a visible location and the marketing spend implied by this model will be noticed within 30 days by every established clinic within a 15-mile radius. Model the specific competitive response: which clinics are most threatened by this opening (not by name — by profile: high-volume budget, premium low-volume, or multi-service), what their retaliation toolkit looks like in practice (review campaigns, price matching on entry treatments, referral incentives to existing patients), and how long the retaliation typically lasts. Then tell me the pre-emptive moves that need to happen in the 60 days before opening — not general brand building, specific tactical positioning decisions that cost money and need to appear in this budget.

PART 6 — THE RECOVERY QUESTION
Winchester is at 50% of the realistic revenue assumption at month 6. That is a specific number. Calculate what the actual monthly P&L looks like at that revenue level given the fixed cost base in this model. How many months of runway savings remain at that burn rate? Now identify the three fastest levers to pull — each must be actionable within 14 days, must be specific to the Winchester location and clinic model, and must address the actual problem (insufficient patient volume) rather than the symptom (insufficient revenue). For each lever, state the cost of pulling it, the realistic patient volume increase within 90 days, and the cash position at the end of those 90 days assuming the lever works at 70% of expectation. State which lever has the highest failure risk and why.

PART 7 — SEASONAL COLLISION
Medical aesthetics in the UK has a well-documented seasonal pattern. Winchester opens in November 2026. Map the expected Winchester ramp curve — starting occupancy, monthly increase rate, target occupancy — against the known aesthetics calendar. Identify every month in the first 12 where a weak ramp month (early in the ramp, before word-of-mouth builds) coincides with a seasonally slow trading period. For each collision month, state the actual projected cash position using the delayed-ramp scenario figures in this model. State the cumulative P&L deficit by the first recovery month. Then identify the seasonal peak months and explain why a clinic that opened in November 2026 may be structurally disadvantaged entering those peaks relative to established competitors who have 12 months of patient data and loyalty.

PART 8 — HUMAN FACTORS
This business operates on two people. One of them is also a nurse providing the income that funds the pre-opening period. Look at what the model implies about their combined working week at operational maturity: Winchester treatment hours implied by occupancy, Bedhampton treatment hours, admin, marketing, compliance, CQC requirements, equipment maintenance, supplier management, staff management if and when staff are added. Calculate the total implied weekly hours. Then identify where the P&L first shows the signature of founder burnout before anyone uses that word: which revenue line starts to plateau when clinical hours are maxed, which cost line starts to rise when quality control slips, which booking metric signals that patient experience is degrading. State the specific month in the ramp where the human system hits its structural limit given these numbers, and what that means for the financial model's assumptions from that point forward.`;

function splitIntoParts(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const partRegex = /PART\s+(\d+)\s*[—–-]+\s*[^\n]*/gi;
  const matches: { index: number; id: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = partRegex.exec(text)) !== null) {
    matches.push({ index: m.index, id: m[1] });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const body = content.replace(/^PART\s+\d+\s*[—–-]+\s*[^\n]*\n?/i, "").trim();
    result[matches[i].id] = body;
  }
  return result;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "£0";
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function pct(n: number | null | undefined) {
  if (n == null) return "0%";
  return `${Math.round(n)}%`;
}

async function buildContext(projectId: number): Promise<string> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [rawModel] = await db.select().from(financialsTable).where(eq(financialsTable.projectId, projectId));
  if (!rawModel) throw new Error("No financial model found");

  const [activeProperty] = await db
    .select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)));

  const model = { ...rawModel } as any;
  if (activeProperty) {
    if (activeProperty.monthlyRentGbp != null) model.rentGbp = activeProperty.monthlyRentGbp;
    if (activeProperty.businessRatesGbp != null) model.ratesGbp = Math.round(activeProperty.businessRatesGbp / 12);
    if (activeProperty.vatOnRent != null) model.vatOnRent = activeProperty.vatOnRent;
  }

  const fixedCostItems = await db.select().from(fixedCostItemsTable).where(eq(fixedCostItemsTable.projectId, projectId));
  const dynamicFixedCosts = fixedCostItems.length > 0
    ? fixedCostItems.reduce((s, i) => s + (i.amountGbp || 0), 0)
    : undefined;

  const phases = await db.select().from(phasesTable).where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const phaseIds = phases.map(p => p.id);
  const allTasks = phaseIds.length > 0
    ? (await Promise.all(phaseIds.map(pid => db.select().from(tasksTable).where(eq(tasksTable.phaseId, pid))))).flat()
    : [];

  const SCENARIOS: Record<string, { startOcc: number; rampMonths: number; targetOcc: number }> = {
    realistic:    { startOcc: 25, rampMonths: 6,  targetOcc: model.realisticOccupancyPercent },
    conservative: { startOcc: 20, rampMonths: 8,  targetOcc: model.conservativeOccupancyPercent },
    delayed_ramp: { startOcc: 15, rampMonths: 12, targetOcc: model.realisticOccupancyPercent },
  };

  const results: Record<string, any> = {};
  for (const [name, scen] of Object.entries(SCENARIOS)) {
    const winc = calcWinchester(model, scen.targetOcc, 1.0, 0.20, dynamicFixedCosts);
    const bedh = calcBedhampton(model);
    const combined = calcCombined(winc, bedh, model, null);
    const owner = calcOwner(winc, bedh, model, 0, dynamicFixedCosts);

    const cashflow = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const occ = month <= scen.rampMonths
        ? scen.startOcc + (scen.targetOcc - scen.startOcc) * (month / scen.rampMonths)
        : scen.targetOcc;
      const sim = calcWincAtOccupancy(model, Math.round(occ * 10) / 10, 1.0, 0.20, dynamicFixedCosts);
      const bedhNet = calcBedhampton(model).netProfit;
      const combinedNet = sim.netProfit + bedhNet;
      const cumulative = results[name]?.cashflow
        ? results[name].cashflow.slice(0, month - 1).reduce((s: number, m: any) => s + m.combinedNet, 0) + combinedNet
        : combinedNet;
      return {
        month,
        occ: Math.round(occ * 10) / 10,
        rev: Math.round(sim.grossRevenue),
        fixed: Math.round(sim.fixedCosts),
        variable: Math.round(sim.variableCosts),
        wincNet: Math.round(sim.netProfit),
        bedhNet: Math.round(bedhNet),
        combinedNet: Math.round(combinedNet),
      };
    });

    // Compute running cumulative
    let cum = 0;
    for (const m of cashflow) {
      cum += m.combinedNet;
      (m as any).cumulative = Math.round(cum);
    }

    results[name] = { winc, bedh, combined, owner, cashflow };
  }

  const r = results.realistic;
  const completedTasks = allTasks.filter(t => t.status === "complete").length;
  const blockedTasks = allTasks.filter(t => t.status === "blocked").length;
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;
  const totalCost = allTasks.reduce((s, t) => s + t.selectedCost, 0);
  const totalCostHigh = allTasks.reduce((s, t) => s + t.costHigh, 0);
  const totalCostLow = allTasks.reduce((s, t) => s + t.costLow, 0);

  const daysToOpening = project?.targetOpeningDate
    ? Math.ceil((new Date(project.targetOpeningDate).getTime() - Date.now()) / 86400000)
    : null;

  const openingMonth = project?.targetOpeningDate ? (() => {
    const d = new Date(project.targetOpeningDate);
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  })() : "November 2026";

  const fixedCostLines = fixedCostItems.length > 0
    ? fixedCostItems.map(i => `  ${i.name} (${i.costType === "unique" ? "Winchester only" : "shared dual-clinic"}): ${fmt(i.amountGbp)}/month`).join("\n")
    : `  Rent: ${fmt(model.rentGbp)}/month\n  Rates: ${fmt(model.ratesGbp)}/month\n  Utilities: ${fmt(model.utilitiesGbp)}/month\n  Insurance: ${fmt(model.insuranceGbp)}/month\n  Software: ${fmt(model.softwareGbp)}/month\n  Accountant: ${fmt(model.accountantGbp)}/month`;

  const totalFixedMonthly = fixedCostItems.length > 0
    ? dynamicFixedCosts!
    : (model.rentGbp + model.ratesGbp + model.utilitiesGbp + model.insuranceGbp + model.softwareGbp + model.accountantGbp + model.wasteContractGbp + model.cleanerGbp + model.subscriptionsGbp + model.financeRepaymentsGbp);

  const cashflowTable = (scenario: string) => {
    const cf = results[scenario].cashflow as any[];
    return cf.map(m =>
      `  Month ${String(m.month).padStart(2)}: Occ ${m.occ}% | Winchester Rev ${fmt(m.rev)} | Fixed ${fmt(m.fixed)} | Variable ${fmt(m.variable)} | Winc Net ${fmt(m.wincNet)} | Bedh Net ${fmt(m.bedhNet)} | Combined Net ${fmt(m.combinedNet)} | Cumulative P&L ${fmt(m.cumulative)}`
    ).join("\n");
  };

  // Calculate occupancy at break-even
  const treatmentSlotsPerMonth = Math.round(model.workingDaysPerMonth * model.practitionerHoursPerDay);
  const realisticSlotsUsed = Math.round(treatmentSlotsPerMonth * (model.realisticOccupancyPercent / 100));
  const conservativeSlotsUsed = Math.round(treatmentSlotsPerMonth * (model.conservativeOccupancyPercent / 100));
  const breakEvenSlotsUsed = Math.round(treatmentSlotsPerMonth * ((r.winc.breakEvenOccupancy ?? 0) / 100));

  // Personal finance analysis
  const totalPersonalNeeds = (model.ownerDrawingsGbp || 0) + (model.schoolFeesGbp || 0) + (model.travelGbp || 0) + (model.otherHouseholdGbp || 0);
  const personalIncome = model.nursingIncomeGbp || 0;
  const personalGap = totalPersonalNeeds - personalIncome;

  return `CLINIC LAUNCH OS — COMPLETE FINANCIAL MODEL
Business: Abi Peters Aesthetics Ltd
Model date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
Target opening: ${openingMonth}${daysToOpening != null ? ` (${daysToOpening} days away)` : ""}
Active property: ${activeProperty ? `${activeProperty.address || "9A Jewry Street"}, ${activeProperty.city || "Winchester"}` : "9A Jewry Street, Winchester"}

═══ WINCHESTER — REVENUE MODEL ═══
Average client value (ACV): ${fmt(model.wincAcvGbp)}
Working days per month: ${model.workingDaysPerMonth}
Practitioner hours per day: ${model.practitionerHoursPerDay}
Total treatment slots per month: ${treatmentSlotsPerMonth}
Treatment rooms: ${model.treatmentRoomsCount}
Repeat booking rate: ${pct(model.repeatBookingRatePercent)}
Membership revenue: ${fmt(model.membershipRevenueGbp)}/month

Occupancy targets:
  Conservative: ${pct(model.conservativeOccupancyPercent)} → ${conservativeSlotsUsed} slots/month → ${fmt(calcWincAtOccupancy(model, model.conservativeOccupancyPercent, 1.0, 0.20, dynamicFixedCosts).grossRevenue)}/month gross
  Realistic: ${pct(model.realisticOccupancyPercent)} → ${realisticSlotsUsed} slots/month → ${fmt(calcWincAtOccupancy(model, model.realisticOccupancyPercent, 1.0, 0.20, dynamicFixedCosts).grossRevenue)}/month gross
  Aggressive: ${pct(model.aggressiveOccupancyPercent)} → ${Math.round(treatmentSlotsPerMonth * model.aggressiveOccupancyPercent / 100)} slots/month → ${fmt(calcWincAtOccupancy(model, model.aggressiveOccupancyPercent, 1.0, 0.20, dynamicFixedCosts).grossRevenue)}/month gross
  Break-even: ${pct(r.winc.breakEvenOccupancy)} → ${breakEvenSlotsUsed} slots/month → ${fmt(r.winc.breakEvenRevenue)}/month gross

═══ WINCHESTER — FIXED COSTS (monthly) ═══
Total fixed cost base: ${fmt(totalFixedMonthly)}/month (${fmt(totalFixedMonthly * 12)}/year)
Breakdown:
${fixedCostLines}

═══ WINCHESTER — VARIABLE COSTS ═══
Stock as % of revenue: ${model.stockPercent}%
  At realistic occ: ${fmt(calcWincAtOccupancy(model, model.realisticOccupancyPercent, 1.0, 0.20, dynamicFixedCosts).grossRevenue * model.stockPercent / 100)}/month
Marketing (fixed monthly spend): ${fmt(model.marketingGbp)}
Staffing: ${fmt(model.staffingGbp)}/month
Commissions: ${model.commissionsPercent}%
Consumables: ${fmt(model.consumablesGbp)}/month

═══ PRE-OPENING COSTS ═══
Months paying rent before opening (lease signed early): ${model.preOpeningPropertyMonths}
Rent-free months from landlord: ${model.freeRentMonths || 0}
Pre-opening property cash cost: ${fmt((model.preOpeningPropertyMonths - (model.freeRentMonths || 0)) * model.rentGbp + model.preOpeningPropertyMonths * model.ratesGbp)}
Launch budget (selected costs): ${fmt(totalCost)} | Low estimate: ${fmt(totalCostLow)} | High estimate: ${fmt(totalCostHigh)}
Budget variance risk: ${fmt(totalCostHigh - totalCost)} gap between selected and worst case
Task progress: ${completedTasks} complete / ${inProgressTasks} in progress / ${blockedTasks} blocked / ${allTasks.length} total

═══ BEDHAMPTON — EXISTING CLINIC ═══
Monthly gross revenue: ${fmt(model.existingClinicRevenueGbp)}
Stock %: ${model.bedhStockPercent}%
Stock cost at current revenue: ${fmt(model.existingClinicRevenueGbp * model.bedhStockPercent / 100)}/month
Monthly fixed costs:
  Rent: ${fmt(model.bedhRentGbp)}
  Software/ANS: ${fmt(model.bedhSoftwareGbp)}
  Staffing: ${fmt(model.bedhStaffingGbp)}
  Insurance: ${fmt(model.bedhInsuranceGbp)}
  Marketing: ${fmt(model.bedhMarketingGbp)}
  Other: ${fmt(model.bedhamptonCostsGbp)}
  Total Bedh fixed: ${fmt(model.bedhRentGbp + model.bedhSoftwareGbp + model.bedhStaffingGbp + model.bedhInsuranceGbp + model.bedhMarketingGbp + model.bedhamptonCostsGbp)}
Bedhampton net monthly profit: ${fmt(r.bedh.netProfit)}
Bedhampton capacity ceiling (joint revenue at which Bedh slots exhausted): ${fmt(model.bedhCapacityCeilGbp)}
Closure trigger: Winchester net margin ≥ ${model.selfFundingBufferPercent}% of gross revenue

═══ OWNER / PERSONAL FINANCE ═══
Owner drawings target: ${fmt(model.ownerDrawingsGbp)}/month
Nursing income: ${fmt(model.nursingIncomeGbp)}/month (primary personal income during ramp)
Personal salary need (modelled): ${fmt(model.personalSalaryNeedsGbp)}/month
Target drawings (maturity): ${fmt(model.targetDrawingsGbp)}/month
Runway savings available: ${fmt(model.runwaySavingsGbp)}
School fees: ${fmt(model.schoolFeesGbp)}/month
Travel costs: ${fmt(model.travelGbp)}/month
Other household: ${fmt(model.otherHouseholdGbp)}/month
Total personal cost base: ${fmt(totalPersonalNeeds)}/month
Personal income vs needs gap: ${personalGap > 0 ? fmt(personalGap) + "/month shortfall (nursing income insufficient)" : fmt(Math.abs(personalGap)) + "/month surplus on nursing income alone"}

═══ KEY COMPUTED METRICS — REALISTIC SCENARIO ═══
Winchester at target occupancy (${pct(model.realisticOccupancyPercent)}):
  Gross revenue: ${fmt(r.winc.grossRevenue)}/month
  Fixed costs: ${fmt(r.winc.fixedCosts)}/month
  Variable costs: ${fmt(r.winc.variableCosts)}/month
  Gross profit: ${fmt(r.winc.grossProfit)}/month
  Net profit: ${fmt(r.winc.netProfit)}/month
  Net margin: ${pct(r.winc.netProfit / r.winc.grossRevenue * 100)}

Bedhampton:
  Net profit: ${fmt(r.bedh.netProfit)}/month

Combined at maturity:
  Monthly net profit: ${fmt(r.combined.monthlyNetProfit ?? (r.winc.netProfit + r.bedh.netProfit))}
  Annual revenue: ${fmt(r.combined.annualRevenue)}
  Annual net profit: ${fmt(r.combined.annualNetProfit)}
  Cash runway from savings: ${r.owner.cashRunwayMonths != null ? r.owner.cashRunwayMonths + " months" : "N/A"}
  Monthly owner surplus at maturity: ${fmt(r.owner.monthlyOwnerSurplus)}

═══ 12-MONTH RAMP — REALISTIC (25%→${pct(model.realisticOccupancyPercent)}, 6 months) ═══
${cashflowTable("realistic")}

═══ 12-MONTH RAMP — CONSERVATIVE (20%→${pct(model.conservativeOccupancyPercent)}, 8 months) ═══
${cashflowTable("conservative")}

═══ 12-MONTH RAMP — DELAYED RAMP / COLD START (15%→${pct(model.realisticOccupancyPercent)}, 12 months) ═══
(This is the scenario where there is no waiting list and word-of-mouth is slow)
${cashflowTable("delayed_ramp")}`;
}

router.post("/projects/:projectId/risk-intelligence", async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  let context: string;
  try {
    context = await buildContext(projectId);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullText = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: RISK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Produce the full 8-part risk briefing for this financial model. Be specific to every figure. Do not hold back.\n\n${context}`,
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Persist to DB
    try {
      const parts = splitIntoParts(fullText);
      await db.delete(projectAiAnalysesTable)
        .where(and(
          eq(projectAiAnalysesTable.projectId, projectId),
          eq(projectAiAnalysesTable.analysisType, "risk_intelligence")
        ));
      await db.insert(projectAiAnalysesTable).values({
        projectId,
        analysisType: "risk_intelligence",
        contextNote: `Generated ${new Date().toISOString()}`,
        resultJson: { fullText, parts, generatedAt: new Date().toISOString() },
      });
    } catch (_) {
      // Non-fatal — streaming already succeeded
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message ?? "API error" })}\n\n`);
    res.end();
  }
});

router.get("/projects/:projectId/risk-intelligence/latest", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [row] = await db
    .select()
    .from(projectAiAnalysesTable)
    .where(and(
      eq(projectAiAnalysesTable.projectId, projectId),
      eq(projectAiAnalysesTable.analysisType, "risk_intelligence")
    ))
    .orderBy(desc(projectAiAnalysesTable.createdAt))
    .limit(1);

  if (!row) return res.json({ data: null });
  return res.json({ data: row.resultJson, generatedAt: row.contextNote });
});

export default router;
