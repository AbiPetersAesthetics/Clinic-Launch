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
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  calcWinchester,
  calcBedhampton,
  calcCombined,
  calcOwner,
  calcWincAtOccupancy,
} from "../lib/financialEngine";

const router = Router();

const RISK_SYSTEM_PROMPT = `You are a senior commercial consultant stress-testing a two-site medical aesthetics business expansion. You have been given the complete financial model. Your job is to find what the founders have missed and tell them exactly what to do about it. Be specific to these numbers. Do not give generic startup advice. Do not be encouraging.

PART 1 — BLIND SPOTS
Identify the risks the founders almost certainly have not modelled. Not the obvious ones. Look for second-order effects, timing mismatches, dependency chains, and things that only become visible when you look at the numbers together rather than in isolation. Be specific to these actual figures.

PART 2 — EARLY WARNING SIGNALS
For each risk identified, define the specific measurable early warning signal that would appear in the monthly accounts BEFORE the risk becomes a crisis. What number moves first? By how much? Give me a tripwire, not a theme.

PART 3 — THE RESPONSE PLAYBOOK
For each risk and its tripwire, write a specific response plan. Not 'reduce costs' — tell me exactly which costs, in which order, with what lead time. Not 'increase marketing' — tell me which channel, what offer, targeting whom, with what expected timeline to impact. Treat this as an operations manual for a bad month.

PART 4 — THE ONE THING
If only one thing goes wrong in year one, what is it most likely to be given these specific numbers? Walk me through the exact sequence of events from trigger to crisis, month by month.

PART 5 — COMPETITOR RESPONSE
Given the visible clinic location and marketing spend implied by these numbers, how are established local competitors likely to react in months 1–6? What does retaliation look like in practice — pricing, reviews, ad spend — and what is the pre-emptive response?

PART 6 — THE RECOVERY QUESTION
If Winchester is at 50% of expected revenue at month 6, what are the three fastest levers to pull — not to save the project, but to buy 90 days of runway while the founders make the go/no-go call on the break clause?

PART 7 — SEASONAL COLLISION
Map the Winchester ramp curve against known aesthetics seasonality. Where does a weak ramp month coincide with a naturally slow trading month? Those are the dangerous windows — identify them specifically and state what the cash position looks like in each one.

PART 8 — HUMAN FACTORS
This business runs on two people. Look at the workload implied by these numbers — treatments, admin, marketing, compliance, two sites — and identify where the human system breaks before the financial one does. What does founder burnout look like in a P&L before anyone admits it is happening? Name the specific metrics that move first.

Format each part with its heading (e.g. "PART 1 — BLIND SPOTS") followed by your analysis. Be direct, be specific to the numbers, and do not pad with encouragement.`;

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

  // Apply active property overrides
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

  // Calculate at realistic, conservative, and delayed_ramp scenarios
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
      return {
        month,
        occ: Math.round(occ * 10) / 10,
        rev: Math.round(sim.grossRevenue),
        fixed: Math.round(sim.fixedCosts),
        variable: Math.round(sim.variableCosts),
        net: Math.round(sim.netProfit),
      };
    });

    results[name] = { winc, bedh, combined, owner, cashflow };
  }

  const r = results.realistic;
  const completedTasks = allTasks.filter(t => t.status === "complete").length;
  const blockedTasks = allTasks.filter(t => t.status === "blocked").length;
  const totalCost = allTasks.reduce((s, t) => s + t.selectedCost, 0);
  const totalCostHigh = allTasks.reduce((s, t) => s + t.costHigh, 0);

  const daysToOpening = project?.targetOpeningDate
    ? Math.ceil((new Date(project.targetOpeningDate).getTime() - Date.now()) / 86400000)
    : null;

  const openingMonth = project?.targetOpeningDate ? (() => {
    const d = new Date(project.targetOpeningDate);
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  })() : "November 2026";

  const fixedCostLines = fixedCostItems.length > 0
    ? fixedCostItems.map(i => `  ${i.name} (${i.costType}): ${fmt(i.amountGbp)}/month`).join("\n")
    : `  Rent: ${fmt(model.rentGbp)}/month\n  Rates: ${fmt(model.ratesGbp)}/month\n  Utilities: ${fmt(model.utilitiesGbp)}/month\n  Insurance: ${fmt(model.insuranceGbp)}/month\n  Software: ${fmt(model.softwareGbp)}/month\n  Accountant: ${fmt(model.accountantGbp)}/month`;

  const cashflowTable = (scenario: string) => {
    const cf = results[scenario].cashflow as any[];
    return cf.map(m =>
      `  Month ${m.month} (Occ ${m.occ}%): Rev ${fmt(m.rev)}, Fixed ${fmt(m.fixed)}, Var ${fmt(m.variable)}, Net ${fmt(m.net)}`
    ).join("\n");
  };

  return `CLINIC LAUNCH OS — FULL FINANCIAL MODEL CONTEXT
Business: Abi Peters Aesthetics Ltd — two-site medical aesthetics expansion
Target opening: ${openingMonth} (${daysToOpening != null ? `${daysToOpening} days from today` : "date not set"})
Active property: ${activeProperty ? `${activeProperty.address || "9A Jewry Street"}, ${activeProperty.city || "Winchester"}` : "9A Jewry Street, Winchester"}
Current date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}

═══ WINCHESTER — REVENUE INPUTS ═══
Average client value (ACV): ${fmt(model.wincAcvGbp)}
Working days/month: ${model.workingDaysPerMonth}
Practitioner hours/day: ${model.practitionerHoursPerDay}
Treatment rooms: ${model.treatmentRoomsCount}
Occupancy targets: Conservative ${pct(model.conservativeOccupancyPercent)}, Realistic ${pct(model.realisticOccupancyPercent)}, Aggressive ${pct(model.aggressiveOccupancyPercent)}
Repeat booking rate: ${pct(model.repeatBookingRatePercent)}
Membership revenue: ${fmt(model.membershipRevenueGbp)}/month

═══ WINCHESTER — FIXED COSTS (monthly) ═══
Total fixed cost base: ${fmt(dynamicFixedCosts ?? (model.rentGbp + model.ratesGbp + model.utilitiesGbp + model.insuranceGbp + model.softwareGbp + model.accountantGbp + model.wasteContractGbp + model.cleanerGbp + model.subscriptionsGbp + model.financeRepaymentsGbp))}
Breakdown:
${fixedCostLines}

═══ WINCHESTER — VARIABLE COSTS ═══
Stock (% of revenue): ${model.stockPercent}%
Marketing (fixed monthly): ${fmt(model.marketingGbp)}
Staffing: ${fmt(model.staffingGbp)}/month
Commissions: ${model.commissionsPercent}%
Consumables: ${fmt(model.consumablesGbp)}/month

═══ BEDHAMPTON — EXISTING CLINIC (will close when Winchester self-funds) ═══
Monthly revenue: ${fmt(model.existingClinicRevenueGbp)}
Stock %: ${model.bedhStockPercent}%
Rent: ${fmt(model.bedhRentGbp)}/month
Software/ANS: ${fmt(model.bedhSoftwareGbp)}/month
Staffing: ${fmt(model.bedhStaffingGbp)}/month
Insurance: ${fmt(model.bedhInsuranceGbp)}/month
Marketing: ${fmt(model.bedhMarketingGbp)}/month
Other costs: ${fmt(model.bedhamptonCostsGbp)}/month
Net Bedhampton monthly profit: ${fmt(r.bedh.netProfit)}
Self-funding trigger: Winchester net margin ≥ ${model.selfFundingBufferPercent}% of gross revenue

═══ OWNER / PERSONAL PLANNING ═══
Owner drawings target: ${fmt(model.ownerDrawingsGbp)}/month
Nursing income: ${fmt(model.nursingIncomeGbp)}/month
Runway savings (available): ${fmt(model.runwaySavingsGbp)}
Personal salary need: ${fmt(model.personalSalaryNeedsGbp)}/month
School fees: ${fmt(model.schoolFeesGbp)}/month
Travel: ${fmt(model.travelGbp)}/month
Other household: ${fmt(model.otherHouseholdGbp)}/month

═══ VAT POSITION ═══
Current rolling 12-month turnover (all clinics): ${fmt(model.vatCurrentTurnoverGbp)}
Registration threshold: £90,000
VAT on rent: ${model.vatOnRent ? "Yes — landlord charges VAT" : "No"}
Months of pre-opening property costs: ${model.preOpeningPropertyMonths}
Rent-free months (landlord-agreed): ${model.freeRentMonths || 0}

═══ LAUNCH COSTS — PROJECT PLAN ═══
Total tasks: ${allTasks.length} (${completedTasks} complete, ${blockedTasks} blocked)
Selected total (launch budget): ${fmt(totalCost)}
High-end total (worst case): ${fmt(totalCostHigh)}

═══ COMPUTED RESULTS — REALISTIC SCENARIO ═══
(Opening at ${pct(model.realisticOccupancyPercent)} occupancy, 25% start → full target over 6 months)
Winchester monthly revenue (at target): ${fmt(r.winc.grossRevenue)}
Winchester fixed costs: ${fmt(r.winc.fixedCosts)}
Winchester variable costs: ${fmt(r.winc.variableCosts)}
Winchester gross profit: ${fmt(r.winc.grossProfit)}
Winchester net profit (at target occ): ${fmt(r.winc.netProfit)}
Break-even occupancy: ${pct(r.winc.breakEvenOccupancy)}
Break-even revenue: ${fmt(r.winc.breakEvenRevenue)}
Combined annual revenue: ${fmt(r.combined.annualRevenue)}
Combined annual net profit: ${fmt(r.combined.annualNetProfit)}
EBITDA: ${fmt(r.combined.ebitda)}
Cash runway (savings): ${r.owner.cashRunwayMonths != null ? `${r.owner.cashRunwayMonths} months` : "N/A"}
Monthly owner surplus (at maturity): ${fmt(r.owner.monthlyOwnerSurplus)}

═══ 12-MONTH RAMP — REALISTIC SCENARIO ═══
${cashflowTable("realistic")}

═══ 12-MONTH RAMP — DELAYED RAMP SCENARIO ═══
(Worst-case cold start: 15% occupancy, 12-month ramp — no waiting list)
${cashflowTable("delayed_ramp")}

═══ 12-MONTH RAMP — CONSERVATIVE SCENARIO ═══
${cashflowTable("conservative")}`;
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

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: RISK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the complete financial model data. Produce your full 8-part risk briefing now.\n\n${context}`,
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message ?? "API error" })}\n\n`);
    res.end();
  }
});

export default router;
