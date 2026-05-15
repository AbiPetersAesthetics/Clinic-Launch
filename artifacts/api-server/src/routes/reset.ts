import { Router } from "express";
import { db } from "@workspace/db";
import {
  complianceItemsTable,
  cqcMilestonesTable,
  lifestylePlanTable,
  financialsTable,
  fixedCostItemsTable,
  propertiesTable,
  decisionsTable,
  marketingItemsTable,
  projectsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/projects/:id/reset/:section", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const { section } = req.params;

  try {
    switch (section) {

      case "compliance":
        await db.update(complianceItemsTable)
          .set({ status: "not_started", notes: null, policyStatus: null, updatedAt: new Date() })
          .where(eq(complianceItemsTable.projectId, projectId));
        await db.update(cqcMilestonesTable)
          .set({ status: "not_started", notes: null, dueDate: null, updatedAt: new Date() })
          .where(eq(cqcMilestonesTable.projectId, projectId));
        break;

      case "lifestyle":
        await db.update(lifestylePlanTable)
          .set({
            clinicDays: '["Mon","Tue","Wed","Thu"]',
            clinicOpenTime: "09:00",
            clinicCloseTime: "18:00",
            scheduleNotes: "",
            schoolStartTime: "09:00",
            schoolFinishTime: "15:30",
            dropCoveredBy: "",
            pickupCoveredBy: "",
            schoolContingencyPlan: "",
            davidAvailabilityDays: 5,
            davidRoleNotes: "",
            nursingStatus: "still_working",
            nursingNoticeWeeks: 12,
            targetExitDate: "",
            nursingExitNotes: "",
            maxClinicDaysPerWeek: 4,
            sickCoverPlan: "",
            holidayPlan: "",
            nonNegotiables: "",
            mostExcitedAbout: "",
            biggestConcerns: "",
            supportNetwork: "",
            familyScheduleJson: "{}",
            extrasJson: "{}",
            scheduleChecks: "[]",
            familyChecks: "[]",
            nursingChecks: "[]",
            wellbeingChecks: "[]",
            identityChecks: "[]",
            updatedAt: new Date(),
          })
          .where(eq(lifestylePlanTable.projectId, projectId));
        break;

      case "financials":
        await db.delete(fixedCostItemsTable)
          .where(eq(fixedCostItemsTable.projectId, projectId));
        await db.update(financialsTable)
          .set({
            rentGbp: 0, ratesGbp: 0, utilitiesGbp: 0, internetGbp: 0,
            insuranceGbp: 0, accountantGbp: 0, softwareGbp: 0,
            wasteContractGbp: 0, cleanerGbp: 0, subscriptionsGbp: 0,
            financeRepaymentsGbp: 0,
            stockPercent: 8, marketingGbp: 0, staffingGbp: 0,
            commissionsPercent: 0, consumablesGbp: 0,
            averageClientValueGbp: 120, wincAcvGbp: 155,
            treatmentRoomsCount: 2, practitionerHoursPerDay: 7,
            workingDaysPerMonth: 22,
            conservativeOccupancyPercent: 40,
            realisticOccupancyPercent: 65,
            aggressiveOccupancyPercent: 85,
            repeatBookingRatePercent: 60, membershipRevenueGbp: 0,
            ownerDrawingsGbp: 0, runwaySavingsGbp: 0,
            personalSalaryNeedsGbp: 0, nursingIncomeGbp: 4500,
            targetDrawingsGbp: 4000,
            schoolFeesGbp: 0, travelGbp: 0, otherHouseholdGbp: 0,
            existingClinicRevenueGbp: 0, bedhStockPercent: 35,
            bedhRentGbp: 0, bedhSoftwareGbp: 0, bedhStaffingGbp: 0,
            bedhInsuranceGbp: 0, bedhMarketingGbp: 0, bedhamptonCostsGbp: 0,
            vatCurrentTurnoverGbp: 75000,
            updatedAt: new Date(),
          })
          .where(eq(financialsTable.projectId, projectId));
        break;

      case "properties-notes":
        await db.update(propertiesTable)
          .set({
            viewingChecklistData: null,
            viewingNotes: null,
            negotiationNotes: null,
            manualCompetitors: [],
            scoringWeights: null,
            updatedAt: new Date(),
          })
          .where(eq(propertiesTable.projectId, projectId));
        break;

      case "decisions":
        await db.delete(decisionsTable)
          .where(eq(decisionsTable.projectId, projectId));
        break;

      case "marketing":
        await db.update(marketingItemsTable)
          .set({ status: "not_started", notes: "", updatedAt: new Date() })
          .where(eq(marketingItemsTable.projectId, projectId));
        await db.update(projectsTable)
          .set({ updatedAt: new Date() } as any)
          .where(eq(projectsTable.id, projectId));
        await db.execute(
          `UPDATE projects SET waitlist_count = 0 WHERE id = ${projectId}`
        );
        break;

      default:
        return res.status(400).json({ error: `Unknown section: ${section}` });
    }

    return res.json({ ok: true, section, projectId });
  } catch (err) {
    console.error("Reset error:", err);
    return res.status(500).json({ error: "Reset failed" });
  }
});

export default router;
