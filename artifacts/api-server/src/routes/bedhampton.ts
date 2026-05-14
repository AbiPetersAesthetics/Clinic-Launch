import { Router } from "express";

const router = Router();

const EXTERNAL_BASE = "https://clinic-data-upload.replit.app";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

async function fetchWithCache<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data as T;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`External API error: ${res.status} ${url}`);
  const data = (await res.json()) as T;
  cache.set(url, { data, fetchedAt: now });
  return data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BedhamptonSummary {
  revenueThisMonth: number;
  revenueMtd: number;
  projectedMonthRevenue: number;
  lastMonthRevenue: number;
  avgClientSpend: number;
  avgClientSpendTrend: number;
  appointmentsThisMonth: number;
  repeatClientPct: number;
  revenueGrowthPct: number;
  topTreatment: string;
  totalAppointments: number;
  totalRevenue: number;
  revenueMtdNet: number;
  projectedMonthRevenueNet: number;
}

export interface BedhamptonExpansion {
  currentBaselineRevenue: number;
  winchesterViabilityRevenue: number;
  existingContribution: number;
  revenueGap: number;
  estimatedBreakevenOccupancy: number;
  riskReducedRunway: number;
  projectedWinchesterRevenue: number;
  onTrack: boolean;
}

export interface BedhamptonMonthlyRevenue {
  month: string;
  revenue: number;
  appointmentCount: number;
  avgTransactionValue: number;
  growthPct: number | null;
}

export interface BedhamptonLiveData {
  summary: BedhamptonSummary;
  expansion: BedhamptonExpansion;
  recentMonths: BedhamptonMonthlyRevenue[];
  fetchedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function fetchBedhamptonLive(): Promise<BedhamptonLiveData> {
  const [summary, expansion, allMonths] = await Promise.all([
    fetchWithCache<BedhamptonSummary>(`${EXTERNAL_BASE}/api/analytics/summary`),
    fetchWithCache<BedhamptonExpansion>(`${EXTERNAL_BASE}/api/expansion/model`),
    fetchWithCache<BedhamptonMonthlyRevenue[]>(`${EXTERNAL_BASE}/api/analytics/monthly-revenue`),
  ]);

  // Last 8 completed months (exclude current partial month)
  const completedMonths = allMonths.filter((m) => m.revenue > 0).slice(-8);

  return {
    summary,
    expansion,
    recentMonths: completedMonths,
    fetchedAt: new Date().toISOString(),
  };
}

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

/** Returns a formatted string block to inject into AI system prompts */
export async function getBedhamptonContext(): Promise<string> {
  try {
    const { summary, expansion, recentMonths } = await fetchBedhamptonLive();

    const trendLines = recentMonths
      .slice(-6)
      .map((m) => {
        const [year, month] = m.month.split("-");
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        });
        return `  ${label}: ${fmt(m.revenue)}`;
      })
      .join(" | ");

    return `
--- LIVE BEDHAMPTON CLINIC DATA (real data from Abi's existing clinic, fetched ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}) ---
Abi Peters currently operates an aesthetics clinic in Bedhampton, Hampshire. This is the financial foundation for the Winchester launch.

Current performance:
• This month revenue: ${fmt(summary.projectedMonthRevenue)} (projected) | Last month: ${fmt(summary.lastMonthRevenue)} | MoM growth: ${summary.revenueGrowthPct > 0 ? "+" : ""}${summary.revenueGrowthPct}%
• Average client spend: ${fmt(summary.avgClientSpend)} | Appointments this month: ${summary.appointmentsThisMonth}
• Repeat client rate: ${summary.repeatClientPct}% | Total revenue to date: ${fmt(summary.totalRevenue)}
• Top treatment: ${summary.topTreatment}

Recent monthly revenue (last 6 months):
${trendLines}

Winchester expansion model (from financial planning data):
• Winchester minimum viable monthly revenue: ${fmt(expansion.winchesterViabilityRevenue)}
• Bedhampton monthly contribution to Winchester launch: ${fmt(expansion.currentBaselineRevenue)}/month baseline
• Revenue gap to Winchester viability: ${fmt(expansion.revenueGap)}/month
• Currently on track for Nov 2026 Winchester opening: ${expansion.onTrack ? "Yes" : "No — gap must close before opening"}
• Projected Winchester year-1 monthly revenue: ${fmt(expansion.projectedWinchesterRevenue)}

Use this data when assessing property rent affordability, launch financial viability, cash runway, or recommending revenue targets. Bedhampton income is the financial safety net for the Winchester launch period.
---`.trim();
  } catch {
    // If external API is unavailable, return a soft fallback so AI still works
    return `Note: Live Bedhampton clinic data is temporarily unavailable. Base financial analysis on the Winchester project assumptions provided in the question.`;
  }
}

// ─── GET /api/bedhampton/summary ─────────────────────────────────────────────
// Returns live Bedhampton data for the frontend financials panel

router.get("/bedhampton/summary", async (_req, res) => {
  try {
    const data = await fetchBedhamptonLive();
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch Bedhampton data";
    return res.status(502).json({ error: msg });
  }
});

export default router;
