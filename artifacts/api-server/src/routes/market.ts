import { Router } from "express";
import { db } from "@workspace/db";
import {
  competitorsTable, treatmentsTable, competitorPricesTable, competitorMembershipsTable,
  membershipsTable, referralsTable, membershipEnrolmentsTable, salesTransactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  validateMembershipInclusions, buildPublicMembershipExport, computeMedian, varianceFlag,
  computeFaceValue, revenuePerHour, vatElement, detectGaps, copyComplianceIssues,
  type TreatmentLite, type InclusionSpec, type PriceSample, type PricePoint,
} from "../lib/market-rules";
import {
  TREATMENTS, COMPETITOR_SEEDS, WINCHESTER_PRICES, BEDHAMPTON_PRICES,
  COMP_MEMBERSHIPS, OUR_MEMBERSHIPS, FOUNDERS_OFFER, REFERRAL_SCHEME, CAPTURED_W, CAPTURED_B,
} from "./market-seed-data";

const router = Router();

const MEDICAL_CREDENTIALS = new Set(["nurse", "nurse_prescriber", "anp_prescriber", "doctor_gp", "doctor_specialist", "dentist", "pharmacist"]);
const BANDS: Record<string, number[]> = { winchester: [1, 10, 20], bedhampton: [5, 10, 20] };

function parseJsonSafe<T>(s: string | null | undefined, fallback: T): T {
  try { const v = JSON.parse(s || ""); return (v ?? fallback) as T; } catch { return fallback; }
}

async function treatmentsByKey(): Promise<Map<string, TreatmentLite>> {
  const rows = await db.select().from(treatmentsTable);
  const map = new Map<string, TreatmentLite>();
  for (const t of rows) map.set(t.key, { key: t.key, displayName: t.displayName, isPom: t.isPom, durationMinutes: t.durationMinutes, priceWinchester: t.priceWinchester, priceBedhampton: t.priceBedhampton });
  return map;
}

// ── POST /market/reseed: idempotent full reseed from the verified capture ───
router.post("/projects/:id/market/reseed", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    // 1. Treatments (replace)
    await db.delete(treatmentsTable);
    let sort = 0;
    for (const t of TREATMENTS) {
      await db.insert(treatmentsTable).values({
        key: t.key, displayName: t.displayName, category: t.category, isPom: t.isPom,
        durationMinutes: t.durationMinutes, priceWinchester: t.priceWinchester, priceBedhampton: t.priceBedhampton,
        courseSize: t.courseSize ?? null, coursePriceWinchester: t.coursePriceWinchester ?? null, coursePriceBedhampton: t.coursePriceBedhampton ?? null,
        isNew: t.isNew ?? false, description: t.description ?? "",
        varianceReasonWinchester: t.varianceReasonWinchester ?? "", varianceReasonBedhampton: t.varianceReasonBedhampton ?? "",
        sortOrder: (sort += 10),
      });
    }

    // 2. Competitors: upsert by name fragment
    const existing = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId));
    const idByMatch = new Map<string, number>();
    for (const seed of COMPETITOR_SEEDS) {
      const found = existing.find(c => (c.name ?? "").toLowerCase().includes(seed.match))
        ?? existing.find(c => seed.name.toLowerCase().includes((c.name ?? "").toLowerCase()) && (c.name ?? "").length > 4);
      const patch: Record<string, unknown> = {
        tradingName: seed.tradingName ?? "", town: seed.town ?? "", leadClinician: seed.leadClinician ?? "",
        credential: seed.credential ?? "", cqcRegistered: seed.cqcRegistered ?? false, cqcNumber: seed.cqcNumber ?? "",
        bacn: seed.bacn ?? false, publishesPrices: seed.publishesPrices ?? "",
        bookingPlatform: seed.bookingPlatform ?? "", skincareBrands: JSON.stringify(seed.skincareBrands ?? []),
        devices: JSON.stringify(seed.devices ?? []),
        distanceKmWinchester: seed.distanceKmWinchester ?? null, distanceKmBedhampton: seed.distanceKmBedhampton ?? null,
        threatLevel: seed.threatLevel ?? "", updatedAt: new Date(),
      };
      if (seed.address) patch.address = seed.address;
      if (seed.googleReviewCount != null) patch.googleReviewCount = seed.googleReviewCount;
      if (seed.googleRating) patch.googleRating = seed.googleRating;
      if (seed.websiteUrl) patch.website = seed.websiteUrl;
      if (seed.notes) patch.notes = seed.notes;
      if (found) {
        await db.update(competitorsTable).set(patch).where(eq(competitorsTable.id, found.id));
        idByMatch.set(seed.match, found.id);
      } else {
        const [created] = await db.insert(competitorsTable).values({ projectId, name: seed.name, lastChecked: CAPTURED_W, ...patch } as any).returning();
        idByMatch.set(seed.match, created.id);
      }
    }

    // 3. Competitor prices (replace)
    await db.delete(competitorPricesTable);
    const insertPrices = async (rows: typeof WINCHESTER_PRICES, captured: string) => {
      for (const [match, key, price, qualifier, courseSize, coursePrice] of rows) {
        const cid = idByMatch.get(match);
        if (!cid) continue;
        const seed = COMPETITOR_SEEDS.find(s => s.match === match);
        await db.insert(competitorPricesTable).values({
          competitorId: cid, treatmentKey: key, priceGbp: price, priceQualifier: qualifier,
          courseSize: courseSize ?? null, coursePriceGbp: coursePrice ?? null,
          sourceUrl: seed?.pricePageUrl || seed?.websiteUrl || "", capturedDate: captured,
        });
      }
    };
    await insertPrices(WINCHESTER_PRICES, CAPTURED_W);
    await insertPrices(BEDHAMPTON_PRICES, CAPTURED_B);

    // 4. Competitor memberships (replace)
    await db.delete(competitorMembershipsTable);
    for (const m of COMP_MEMBERSHIPS) {
      const cid = idByMatch.get(m.match);
      if (!cid) continue;
      await db.insert(competitorMembershipsTable).values({
        competitorId: cid, programmeName: m.programmeName, model: m.model,
        priceMonthlyGbp: m.priceMonthlyGbp ?? null, founderPriceGbp: m.founderPriceGbp ?? null, annualPriceGbp: m.annualPriceGbp ?? null,
        minCommitmentMonths: m.minCommitmentMonths ?? null,
        includedTreatments: JSON.stringify(m.includedTreatments ?? []),
        discountRetailPct: m.discountRetailPct ?? null, discountTreatmentsPct: m.discountTreatmentsPct ?? null,
        includesPom: m.includesPom, statedSavingGbp: m.statedSavingGbp ?? null, deliveredBy: m.deliveredBy ?? "",
        featuresJson: JSON.stringify({ priceHighGbp: m.priceHighGbp ?? null }),
        sourceUrl: COMPETITOR_SEEDS.find(s => s.match === m.match)?.websiteUrl ?? "", capturedDate: CAPTURED_W,
        ...(m.notes ? {} : {}),
      });
    }

    // 5. Our memberships (replace): POM validation runs even on seed
    const tmap = await treatmentsByKey();
    await db.delete(membershipsTable);
    for (const m of OUR_MEMBERSHIPS) {
      const check = validateMembershipInclusions(m.inclusions as InclusionSpec[], m.isPublic, tmap);
      if (!check.ok) return res.status(400).json({ error: `Seed blocked for ${m.name}: ${check.error}` });
      await db.insert(membershipsTable).values({
        name: m.name, tierRank: m.tierRank, site: m.site, priceMonthlyGbp: m.priceMonthlyGbp,
        founderPriceGbp: m.founderPriceGbp ?? null, founderPlaces: m.founderPlaces ?? null,
        minCommitmentMonths: m.minCommitmentMonths, noticePeriodDays: m.noticePeriodDays,
        inclusions: JSON.stringify(m.inclusions), isPublic: m.isPublic,
        liveFromDate: m.liveFromDate, deliveredBy: m.deliveredBy,
        includedMinutesPerMonth: m.includedMinutesPerMonth,
        featuresJson: JSON.stringify(m.features), notes: m.notes ?? "",
      });
    }

    return res.json({
      treatments: TREATMENTS.length,
      competitors: idByMatch.size,
      prices: WINCHESTER_PRICES.length + BEDHAMPTON_PRICES.length,
      competitorMemberships: COMP_MEMBERSHIPS.length,
      ourMemberships: OUR_MEMBERSHIPS.length,
    });
  } catch (err) {
    console.error("[market reseed]", err);
    return res.status(500).json({ error: "Reseed failed" });
  }
});

// ── GET /market/pricing?catchment=winchester|bedhampton ─────────────────────
router.get("/projects/:id/market/pricing", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const catchment = (req.query.catchment as string) === "bedhampton" ? "bedhampton" : "winchester";
    const bands = BANDS[catchment];

    const [treatments, comps, prices] = await Promise.all([
      db.select().from(treatmentsTable).orderBy(treatmentsTable.sortOrder),
      db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId)),
      db.select().from(competitorPricesTable),
    ]);

    const distOf = (c: any) => catchment === "winchester" ? c.distanceKmWinchester : c.distanceKmBedhampton;
    const medicalIds = new Map<number, number>(); // id -> distance
    for (const c of comps) {
      const d = distOf(c);
      if (d != null && MEDICAL_CREDENTIALS.has(c.credential ?? "")) medicalIds.set(c.id, d);
    }
    const compName = new Map(comps.map(c => [c.id, c.name ?? ""]));

    const now = Date.now();
    const staleCutoff = 90 * 86400000;

    const rows = treatments.filter(t => t.category !== "consultation").map(t => {
      const tPrices = prices.filter(p => p.treatmentKey === t.key);
      const perBand: Record<string, ReturnType<typeof computeMedian>> = {};
      for (const band of bands) {
        const samples: PriceSample[] = tPrices
          .filter(p => medicalIds.has(p.competitorId) && (medicalIds.get(p.competitorId) as number) <= band)
          .map(p => ({ priceGbp: p.priceGbp as number, qualifier: p.priceQualifier, competitorId: p.competitorId }));
        perBand[`${band}km`] = computeMedian(samples);
      }
      const widest = perBand[`${bands[bands.length - 1]}km`];
      const ourPrice = catchment === "winchester" ? t.priceWinchester : t.priceBedhampton;
      const flag = varianceFlag(ourPrice && ourPrice > 0 ? ourPrice : null, widest.median);
      const reason = catchment === "winchester" ? t.varianceReasonWinchester : t.varianceReasonBedhampton;
      const stale = tPrices.some(p => medicalIds.has(p.competitorId) && p.capturedDate && (now - new Date(p.capturedDate).getTime()) > staleCutoff);
      const compRows = tPrices
        .filter(p => distOf(comps.find(c => c.id === p.competitorId)) != null)
        .map(p => ({
          competitorId: p.competitorId, name: compName.get(p.competitorId),
          priceGbp: p.priceGbp, qualifier: p.priceQualifier, courseSize: p.courseSize, coursePriceGbp: p.coursePriceGbp,
          sourceUrl: p.sourceUrl, capturedDate: p.capturedDate,
          medical: medicalIds.has(p.competitorId),
          distanceKm: distOf(comps.find(c => c.id === p.competitorId)),
        }))
        .sort((a, b) => (a.priceGbp ?? 99999) - (b.priceGbp ?? 99999));
      return {
        key: t.key, displayName: t.displayName, category: t.category, isPom: t.isPom, isNew: t.isNew,
        durationMinutes: t.durationMinutes,
        priceWinchester: t.priceWinchester, priceBedhampton: t.priceBedhampton,
        ourPrice, revenuePerHour: revenuePerHour(ourPrice, t.durationMinutes),
        courseSize: t.courseSize,
        coursePrice: catchment === "winchester" ? t.coursePriceWinchester : t.coursePriceBedhampton,
        bands: perBand, varianceFlag: flag, varianceReason: reason || "",
        varianceNeedsReason: flag != null && !(reason || "").trim(),
        stale, notOnOurMenu: ourPrice == null,
        competitors: compRows,
      };
    });

    // Credential segmentation across the widest band
    const widestBand = bands[bands.length - 1];
    const credGroups: Record<string, string[]> = { doctor: ["doctor_gp", "doctor_specialist"], nurse: ["nurse", "nurse_prescriber", "anp_prescriber"], dentist: ["dentist"] };
    const segmentation = Object.entries(credGroups).map(([label, creds]) => {
      const ids = new Set(comps.filter(c => { const d = distOf(c); return d != null && d <= widestBand && creds.includes(c.credential ?? ""); }).map(c => c.id));
      const diffs: number[] = [];
      for (const t of treatments) {
        const all = prices.filter(p => p.treatmentKey === t.key && medicalIds.has(p.competitorId) && (medicalIds.get(p.competitorId) as number) <= widestBand);
        const grp = all.filter(p => ids.has(p.competitorId));
        const mAll = computeMedian(all.map(p => ({ priceGbp: p.priceGbp as number, qualifier: p.priceQualifier, competitorId: p.competitorId })));
        const mGrp = computeMedian(grp.map(p => ({ priceGbp: p.priceGbp as number, qualifier: p.priceQualifier, competitorId: p.competitorId })));
        if (mAll.median && mGrp.median) diffs.push((mGrp.median - mAll.median) / mAll.median);
      }
      const avg = diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 1000) / 10 : null;
      return { group: label, clinics: ids.size, avgVsMarketPct: avg, sampledTreatments: diffs.length };
    });

    return res.json({ catchment, bands: bands.map(b => `${b}km`), rows, segmentation, capturedDates: { winchester: CAPTURED_W, bedhampton: CAPTURED_B } });
  } catch (err) {
    console.error("[market pricing]", err);
    return res.status(500).json({ error: "Pricing view failed" });
  }
});

// ── GET /market/memberships: ladder, gaps, scoreboard, matrix, commitment ───
router.get("/projects/:id/market/memberships", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const [comps, programmes, ours, tmap] = await Promise.all([
      db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId)),
      db.select().from(competitorMembershipsTable),
      db.select().from(membershipsTable).orderBy(membershipsTable.tierRank),
      treatmentsByKey(),
    ]);
    const compName = new Map(comps.map(c => [c.id, c.name ?? ""]));

    const ladder = programmes.map(p => ({
      id: p.id, clinic: compName.get(p.competitorId) ?? "", programmeName: p.programmeName, model: p.model,
      priceMonthlyGbp: p.priceMonthlyGbp, priceHighGbp: parseJsonSafe<{ priceHighGbp: number | null }>(p.featuresJson, { priceHighGbp: null }).priceHighGbp,
      founderPriceGbp: p.founderPriceGbp, minCommitmentMonths: p.minCommitmentMonths,
      includesPom: p.includesPom, statedSavingGbp: p.statedSavingGbp, deliveredBy: p.deliveredBy, notes: (p as any).notes ?? "",
    }));

    // Gap detection, recomputed from the data (never hardcoded)
    const points: PricePoint[] = [];
    for (const p of ladder) {
      const low = p.founderPriceGbp != null && p.priceMonthlyGbp != null ? Math.min(p.founderPriceGbp, p.priceMonthlyGbp) : (p.priceMonthlyGbp ?? p.founderPriceGbp);
      const high = Math.max(p.priceMonthlyGbp ?? 0, p.priceHighGbp ?? 0, p.founderPriceGbp ?? 0);
      if (low != null && low > 0) points.push({ low, high: Math.max(high, low) });
    }
    const gaps = detectGaps(points, 30);

    // Compliance scoreboard
    const pomProgrammes = ladder.filter(p => p.includesPom);

    // Our tiers with COMPUTED face value and revenue per hour
    const ourTiers = ours.map(m => {
      const inclusions = parseJsonSafe<InclusionSpec[]>(m.inclusions, []);
      const site = m.site === "bedhampton" ? "bedhampton" : "winchester";
      const faceW = computeFaceValue(inclusions, "winchester", tmap);
      const faceB = computeFaceValue(inclusions, "bedhampton", tmap);
      return {
        id: m.id, name: m.name, tierRank: m.tierRank, site: m.site,
        priceMonthlyGbp: m.priceMonthlyGbp, founderPriceGbp: m.founderPriceGbp, founderPlaces: m.founderPlaces,
        minCommitmentMonths: m.minCommitmentMonths, noticePeriodDays: m.noticePeriodDays,
        isPublic: m.isPublic, liveFromDate: m.liveFromDate, deliveredBy: m.deliveredBy,
        inclusions, features: parseJsonSafe<Record<string, unknown>>(m.featuresJson, {}),
        faceValueGbp: m.site === "both" ? { winchester: faceW, bedhampton: faceB } : (site === "winchester" ? { winchester: faceW } : { bedhampton: faceB }),
        revenuePerHour: m.priceMonthlyGbp && m.includedMinutesPerMonth > 0 ? revenuePerHour(m.priceMonthlyGbp, m.includedMinutesPerMonth) : null,
        notes: m.notes,
      };
    });

    // Feature matrix
    const FEATURES = ["includedTreatment", "rollover", "pause", "skinAnalysis", "writtenProgressNotes", "retailDiscount", "courseDiscount", "priorityBooking", "ambassadorScheme", "statedSaving"];
    const matrix = {
      features: FEATURES,
      competitors: ladder.map(p => ({
        name: `${p.clinic}: ${p.programmeName}`,
        values: {
          includedTreatment: p.model === "treatment_included" || p.model === "credit_wallet" ? true : p.model === "discount_only" ? false : null,
          statedSaving: p.statedSavingGbp != null, retailDiscount: null, courseDiscount: null,
          rollover: null, pause: null, skinAnalysis: null, writtenProgressNotes: null, priorityBooking: null,
          ambassadorScheme: /hartfree/i.test(p.clinic),
        } as Record<string, boolean | null>,
      })),
      us: ourTiers.filter(t => t.isPublic).map(t => ({
        name: `APA: ${t.name} (${t.site})`,
        values: Object.fromEntries(FEATURES.map(f => [f,
          f === "ambassadorScheme" ? true /* referral scheme instrumented from day one */ :
          f === "statedSaving" ? false /* we state face value, computed, not a saving claim */ :
          Boolean((t.features as any)[f]),
        ])),
      })),
    };

    // Commitment comparison
    const commitment = [
      ...ladder.filter(p => p.priceMonthlyGbp != null).map(p => ({ name: `${p.clinic}: ${p.programmeName}`, months: p.minCommitmentMonths ?? 0, us: false })),
      ...ourTiers.filter(t => t.isPublic && t.priceMonthlyGbp != null).map(t => ({ name: `APA: ${t.name} (${t.site})`, months: t.minCommitmentMonths, us: true })),
    ].sort((a, b) => a.months - b.months);

    return res.json({ ladder, gaps, pomProgrammes: { count: pomProgrammes.length, list: pomProgrammes.map(p => `${p.clinic}: ${p.programmeName}`) }, cleanProgrammes: ladder.filter(p => !p.includesPom).map(p => `${p.clinic}: ${p.programmeName}`), ourTiers, matrix, commitment, foundersOffer: FOUNDERS_OFFER });
  } catch (err) {
    console.error("[market memberships]", err);
    return res.status(500).json({ error: "Membership view failed" });
  }
});

// ── Our packages: price list + export with the private-tier gate ─────────────
router.get("/projects/:id/market/packages", async (req, res) => {
  try {
    const treatments = await db.select().from(treatmentsTable).orderBy(treatmentsTable.sortOrder);
    const rows = treatments.map(t => ({
      key: t.key, displayName: t.displayName, category: t.category, isPom: t.isPom, isNew: t.isNew,
      durationMinutes: t.durationMinutes,
      priceWinchester: t.priceWinchester, priceBedhampton: t.priceBedhampton,
      courseSize: t.courseSize, coursePriceWinchester: t.coursePriceWinchester, coursePriceBedhampton: t.coursePriceBedhampton,
      revenuePerHourWinchester: revenuePerHour(t.priceWinchester, t.durationMinutes),
      revenuePerHourBedhampton: revenuePerHour(t.priceBedhampton, t.durationMinutes),
      vatElementWinchester: t.priceWinchester ? vatElement(t.priceWinchester) : null,
      description: t.description,
    }));
    return res.json({ rows, vatNote: "All prices VAT inclusive. VRN 523 3501 30, registered 1 August 2026. VAT element is price divided by 6." });
  } catch (err) {
    console.error("[market packages]", err);
    return res.status(500).json({ error: "Packages view failed" });
  }
});

// Export for public surfaces (website, ads, founders funnel, GHL non-patient
// sequences). The gate lives in buildPublicMembershipExport, not in the UI.
router.get("/projects/:id/market/packages/export", async (req, res) => {
  try {
    const audience = (req.query.audience as string) === "patient" ? "patient" : "public";
    const [treatments, ours] = await Promise.all([
      db.select().from(treatmentsTable).orderBy(treatmentsTable.sortOrder),
      db.select().from(membershipsTable).orderBy(membershipsTable.tierRank),
    ]);
    const tmap = await treatmentsByKey();
    const memberships = audience === "public" ? buildPublicMembershipExport(ours) : ours;
    const exported = {
      audience,
      priceList: treatments.filter(t => t.category !== "consultation" || (t.priceWinchester ?? 0) === 0).map(t => ({
        treatment: t.displayName, category: t.category,
        winchester: t.priceWinchester, bedhampton: t.priceBedhampton,
        course: t.courseSize ? { size: t.courseSize, winchester: t.coursePriceWinchester, bedhampton: t.coursePriceBedhampton } : null,
      })),
      memberships: memberships.map(m => ({
        name: m.name, site: m.site, priceMonthlyGbp: m.priceMonthlyGbp,
        founderPriceGbp: m.founderPriceGbp, minCommitmentMonths: m.minCommitmentMonths,
        inclusions: parseJsonSafe<InclusionSpec[]>(m.inclusions, []),
        faceValue: {
          winchester: computeFaceValue(parseJsonSafe<InclusionSpec[]>(m.inclusions, []), "winchester", tmap),
          bedhampton: computeFaceValue(parseJsonSafe<InclusionSpec[]>(m.inclusions, []), "bedhampton", tmap),
        },
      })),
      foundersOffer: audience === "public" ? FOUNDERS_OFFER : FOUNDERS_OFFER,
    };
    // Belt and braces: a public export must never contain the private plan.
    if (audience === "public" && exported.memberships.some(m => /frown free/i.test(m.name))) {
      return res.status(500).json({ error: "Export gate failure: private membership leaked into a public export" });
    }
    return res.json(exported);
  } catch (err) {
    console.error("[market export]", err);
    return res.status(500).json({ error: "Export failed" });
  }
});

// Create or update one of our memberships: POM validation BLOCKS the write.
router.post("/projects/:id/market/memberships", async (req, res) => {
  try {
    const body = req.body;
    const tmap = await treatmentsByKey();
    const inclusions: InclusionSpec[] = Array.isArray(body.inclusions) ? body.inclusions : parseJsonSafe<InclusionSpec[]>(body.inclusions, []);
    const isPublic = body.isPublic !== false;
    const check = validateMembershipInclusions(inclusions, isPublic, tmap);
    if (!check.ok) return res.status(422).json({ error: check.error });
    const values = {
      name: body.name ?? "Untitled", tierRank: body.tierRank ?? 0, site: body.site ?? "both",
      priceMonthlyGbp: body.priceMonthlyGbp ?? null, founderPriceGbp: body.founderPriceGbp ?? null,
      founderPlaces: body.founderPlaces ?? null, minCommitmentMonths: body.minCommitmentMonths ?? 0,
      noticePeriodDays: body.noticePeriodDays ?? 30, inclusions: JSON.stringify(inclusions),
      isPublic, liveFromDate: body.liveFromDate ?? "", deliveredBy: body.deliveredBy ?? "",
      includedMinutesPerMonth: body.includedMinutesPerMonth ?? 0,
      featuresJson: JSON.stringify(body.features ?? {}), notes: body.notes ?? "", updatedAt: new Date(),
    };
    if (body.id) {
      const [updated] = await db.update(membershipsTable).set(values).where(eq(membershipsTable.id, body.id)).returning();
      return res.json({ membership: updated });
    }
    const [created] = await db.insert(membershipsTable).values(values).returning();
    return res.json({ membership: created });
  } catch (err) {
    console.error("[market membership write]", err);
    return res.status(500).json({ error: "Membership write failed" });
  }
});

// ── Referrals ────────────────────────────────────────────────────────────────
router.post("/projects/:id/market/referrals", async (req, res) => {
  try {
    const { referrerContactId, refereeContactId, ghlTag } = req.body;
    if (!referrerContactId) return res.status(400).json({ error: "referrerContactId required" });
    const code = "APA-" + String(referrerContactId).replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
    const [created] = await db.insert(referralsTable).values({
      referrerContactId, refereeContactId: refereeContactId ?? null, referralCode: code,
      status: "sent", creditReferrerGbp: REFERRAL_SCHEME.creditReferrerGbp, creditRefereeGbp: REFERRAL_SCHEME.creditRefereeGbp,
      ghlTag: ghlTag ?? "",
    }).returning();
    return res.json({ referral: created });
  } catch (err) {
    console.error("[referral create]", err);
    return res.status(500).json({ error: "Referral create failed" });
  }
});

router.patch("/projects/:id/market/referrals/:rid", async (req, res) => {
  try {
    const rid = parseInt(req.params.rid);
    const { status, refereeContactId } = req.body;
    const allowed = ["sent", "registered", "booked", "attended", "credited"];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (refereeContactId !== undefined) patch.refereeContactId = refereeContactId;
    if (status === "attended") patch.attendedAt = new Date();
    if (status === "credited") patch.creditedAt = new Date();
    const [updated] = await db.update(referralsTable).set(patch).where(eq(referralsTable.id, rid)).returning();
    return res.json({ referral: updated });
  } catch (err) {
    console.error("[referral update]", err);
    return res.status(500).json({ error: "Referral update failed" });
  }
});

router.get("/projects/:id/market/referrals/report", async (req, res) => {
  try {
    const all = await db.select().from(referralsTable);
    const byStatus: Record<string, number> = { sent: 0, registered: 0, booked: 0, attended: 0, credited: 0 };
    let totalDaysToAttend = 0, attendedCount = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.attendedAt && r.createdAt) { totalDaysToAttend += (new Date(r.attendedAt).getTime() - new Date(r.createdAt).getTime()) / 86400000; attendedCount++; }
    }
    const costPerAcquisition = attendedCount > 0 ? REFERRAL_SCHEME.creditReferrerGbp + REFERRAL_SCHEME.creditRefereeGbp : null;
    return res.json({
      scheme: REFERRAL_SCHEME, funnel: byStatus, total: all.length,
      avgDaysToAttendance: attendedCount ? Math.round(totalDaysToAttend / attendedCount) : null,
      costPerAcquisitionGbp: costPerAcquisition,
      engagedReplyReferrals: all.filter(r => (r.ghlTag ?? "").includes("engaged")).length,
      note: "Cost per acquisition is the 50 pounds of clinic credit per attended referral. Compare against Meta CPL. Referred-patient lifetime value tracking begins once ANS sales data flows into sales_transactions.",
    });
  } catch (err) {
    console.error("[referral report]", err);
    return res.status(500).json({ error: "Referral report failed" });
  }
});

// ── Membership enrolments (billing surface: GHL recurring card + FFC plans) ──
router.get("/projects/:id/market/enrolments", async (_req, res) => {
  try {
    const rows = await db.select().from(membershipEnrolmentsTable);
    return res.json({ enrolments: rows });
  } catch (err) {
    console.error("[enrolments]", err);
    return res.status(500).json({ error: "Enrolments read failed" });
  }
});

router.post("/projects/:id/market/enrolments", async (req, res) => {
  try {
    const b = req.body;
    if (!b.contactId) return res.status(400).json({ error: "contactId required" });
    const values = {
      contactId: b.contactId, membershipId: b.membershipId ?? null,
      planType: b.planType === "ffc" ? "ffc" : "tier", site: b.site ?? "winchester",
      priceMonthlyGbp: b.priceMonthlyGbp ?? 0, nextBillingDate: b.nextBillingDate ?? "",
      failedPaymentCount: b.failedPaymentCount ?? 0, pauseStatus: !!b.pauseStatus,
      minTermMonthsRemaining: b.minTermMonthsRemaining ?? 0,
      enrolmentDate: b.enrolmentDate ?? "", prescriber: b.prescriber ?? "",
      scheduleJson: JSON.stringify(b.schedule ?? []), paymentsMadeGbp: b.paymentsMadeGbp ?? 0,
      treatmentsTaken: b.treatmentsTaken ?? 0, balanceGbp: b.balanceGbp ?? 0,
      ghlSubscriptionId: b.ghlSubscriptionId ?? "", updatedAt: new Date(),
    };
    if (b.id) {
      const [updated] = await db.update(membershipEnrolmentsTable).set(values).where(eq(membershipEnrolmentsTable.id, b.id)).returning();
      return res.json({ enrolment: updated });
    }
    const [created] = await db.insert(membershipEnrolmentsTable).values(values).returning();
    return res.json({ enrolment: created });
  } catch (err) {
    console.error("[enrolment write]", err);
    return res.status(500).json({ error: "Enrolment write failed" });
  }
});

// ── Sales journal (VAT split) ────────────────────────────────────────────────
router.post("/projects/:id/market/transactions", async (req, res) => {
  try {
    const { site, treatmentKey, treatmentDate, grossGbp, paymentMethod, contactId } = req.body;
    if (!treatmentKey || !treatmentDate || grossGbp == null) return res.status(400).json({ error: "treatmentKey, treatmentDate and grossGbp required" });
    const [created] = await db.insert(salesTransactionsTable).values({
      site: site ?? "winchester", treatmentKey, treatmentDate,
      grossGbp: Number(grossGbp), vatGbp: vatElement(Number(grossGbp)),
      paymentMethod: paymentMethod ?? "card", contactId: contactId ?? "", source: "ans",
    }).returning();
    return res.json({ transaction: created });
  } catch (err) {
    console.error("[transaction]", err);
    return res.status(500).json({ error: "Transaction write failed" });
  }
});

router.get("/projects/:id/market/vat-journal", async (req, res) => {
  try {
    const month = (req.query.month as string) ?? "";
    const all = await db.select().from(salesTransactionsTable);
    const rows = month ? all.filter(t => t.treatmentDate.startsWith(month)) : all;
    const gross = rows.reduce((s, t) => s + t.grossGbp, 0);
    const vat = rows.reduce((s, t) => s + t.vatGbp, 0);
    const klarna = rows.filter(t => t.paymentMethod === "klarna");
    const klarnaByTreatment: Record<string, number> = {};
    for (const t of klarna) klarnaByTreatment[t.treatmentKey] = (klarnaByTreatment[t.treatmentKey] ?? 0) + 1;
    return res.json({
      month: month || "all", transactions: rows.length,
      grossGbp: Math.round(gross * 100) / 100, vatGbp: Math.round(vat * 100) / 100, netGbp: Math.round((gross - vat) * 100) / 100,
      klarnaUptake: { count: klarna.length, byTreatment: klarnaByTreatment },
      note: "Tax point is the treatment date. Source is ANS, never the Tide settlement (settlements are net and land days late). Export to QuickBooks with the gross, VAT and net split.",
    });
  } catch (err) {
    console.error("[vat journal]", err);
    return res.status(500).json({ error: "VAT journal failed" });
  }
});

// ── Part 7: insights computed from the combined dataset ──────────────────────
router.get("/projects/:id/market/insights", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const [comps, treatments, prices] = await Promise.all([
      db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId)),
      db.select().from(treatmentsTable),
      db.select().from(competitorPricesTable),
    ]);
    const medical = comps.filter(c => MEDICAL_CREDENTIALS.has(c.credential ?? "") && ((c.distanceKmWinchester != null && c.distanceKmWinchester <= 20) || (c.distanceKmBedhampton != null && c.distanceKmBedhampton <= 20)));
    const medicalIds = new Set(medical.map(c => c.id));
    const ourKeys = new Set(treatments.filter(t => (t.priceWinchester ?? 0) > 0 || (t.priceBedhampton ?? 0) > 0).map(t => t.key));

    // Treatments 3+ local medical competitors offer that we do not
    const offeredCount: Record<string, Set<number>> = {};
    for (const p of prices) {
      if (!medicalIds.has(p.competitorId)) continue;
      (offeredCount[p.treatmentKey] ??= new Set()).add(p.competitorId);
    }
    const weLack = Object.entries(offeredCount).filter(([k, ids]) => ids.size >= 3 && !ourKeys.has(k)).map(([k, ids]) => ({ treatmentKey: k, offeredBy: ids.size }));

    // Treatments we offer that nobody else prices locally
    const uniqueToUs = treatments.filter(t => ourKeys.has(t.key) && !(offeredCount[t.key]?.size) && t.category !== "consultation").map(t => ({ key: t.key, displayName: t.displayName }));

    // Two-site price gap leakage risk (>25 percent cheaper in Bedhampton)
    const leakage = treatments
      .filter(t => (t.priceWinchester ?? 0) > 0 && (t.priceBedhampton ?? 0) > 0)
      .map(t => ({ key: t.key, displayName: t.displayName, winchester: t.priceWinchester as number, bedhampton: t.priceBedhampton as number, gapPct: Math.round(((t.priceWinchester as number) - (t.priceBedhampton as number)) / (t.priceWinchester as number) * 100) }))
      .filter(r => r.gapPct >= 25)
      .sort((a, b) => b.gapPct - a.gapPct);

    // Revenue per hour ranking
    const revRank = treatments
      .filter(t => (t.priceWinchester ?? 0) > 0)
      .map(t => ({ key: t.key, displayName: t.displayName, isPom: t.isPom, revPerHourW: revenuePerHour(t.priceWinchester, t.durationMinutes) }))
      .sort((a, b) => (b.revPerHourW ?? 0) - (a.revPerHourW ?? 0));

    // Supplier overlap and review velocity from competitor fields
    const supplierOverlap = comps.filter(c => {
      const brands = parseJsonSafe<string[]>((c as any).skincareBrands, []);
      const platform = ((c as any).bookingPlatform ?? "").toLowerCase();
      return brands.some(b => /obagi/i.test(b)) || platform === "ans";
    }).map(c => ({ name: c.name, brands: parseJsonSafe<string[]>((c as any).skincareBrands, []), bookingPlatform: (c as any).bookingPlatform }));
    const reviewVelocity = comps.filter(c => (c.googleReviewCount ?? 0) >= 100).map(c => ({ name: c.name, reviews: c.googleReviewCount, rating: c.googleRating }));

    return res.json({ weLack, uniqueToUs, leakage, revRank: revRank.slice(0, 12), supplierOverlap, reviewVelocity });
  } catch (err) {
    console.error("[market insights]", err);
    return res.status(500).json({ error: "Insights failed" });
  }
});

// Config for the UI
router.get("/projects/:id/market/config", async (_req, res) => {
  return res.json({ foundersOffer: FOUNDERS_OFFER, referralScheme: REFERRAL_SCHEME, capturedDates: { winchester: CAPTURED_W, bedhampton: CAPTURED_B } });
});

export default router;
