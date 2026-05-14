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

export interface BedhamptonMonthlyRevenue {
  month: string; // YYYY-MM format
  revenue: number;
  appointmentCount: number;
  avgTransactionValue: number;
  growthPct: number | null;
}

export interface BedhamptonLiveData {
  summary: BedhamptonSummary;
  recentMonths: BedhamptonMonthlyRevenue[];
  fetchedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function fetchBedhamptonLive(): Promise<BedhamptonLiveData> {
  const [summary, allMonths] = await Promise.all([
    fetchWithCache<BedhamptonSummary>(`${EXTERNAL_BASE}/api/analytics/summary`),
    fetchWithCache<BedhamptonMonthlyRevenue[]>(`${EXTERNAL_BASE}/api/analytics/monthly-revenue`),
  ]);

  // Determine the current month in YYYY-MM format so we can exclude it.
  // The current month is always partial (in-progress) — including it biases
  // 3-month averages downward. Only completed, past months are used.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Sort by month ascending (YYYY-MM string sort is lexicographically correct),
  // then filter: must have positive revenue AND be a past (completed) month.
  // slice(-8) is safe only after sorting — the external API returns months in
  // arbitrary order and must never be sliced unsorted.
  const completedMonths = allMonths
    .filter((m) => m.revenue > 0 && m.month < currentMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8);

  return {
    summary,
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
    const { summary, recentMonths } = await fetchBedhamptonLive();

    // recentMonths is already sorted ascending by fetchBedhamptonLive — slice(-6) is safe
    const last6 = recentMonths.slice(-6);
    const trendLines = last6
      .map((m) => {
        const [year, month] = m.month.split("-");
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        });
        return `  ${label}: ${fmt(m.revenue)}`;
      })
      .join(" | ");

    // Trailing 3-month average for trend characterisation (last 3 completed months)
    const last3 = recentMonths.slice(-3);
    const avg3 = last3.length > 0 ? last3.reduce((s, m) => s + m.revenue, 0) / last3.length : 0;

    return `
--- LIVE BEDHAMPTON CLINIC DATA (real data from Abi's existing clinic, fetched ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}) ---
Abi Peters currently operates an aesthetics clinic in Bedhampton, Hampshire. This is the financial foundation for the Winchester launch.

Current performance:
• This month revenue: ${fmt(summary.projectedMonthRevenue)} (projected) | Last month: ${fmt(summary.lastMonthRevenue)} | MoM growth: ${summary.revenueGrowthPct > 0 ? "+" : ""}${summary.revenueGrowthPct}%
• Average client spend: ${fmt(summary.avgClientSpend)} | Appointments this month: ${summary.appointmentsThisMonth}
• Repeat client rate: ${summary.repeatClientPct}% | Total revenue since launch: ${fmt(summary.totalRevenue)}
• 3-month average revenue (completed months only): ${fmt(avg3)}/month
• Top treatment: ${summary.topTreatment}

Recent monthly revenue (last 6 completed months, sorted chronologically):
${trendLines}

Use this data when assessing financial viability, rent affordability, cash runway, or launch readiness. Bedhampton income is the financial safety net for the Winchester launch period.
---`.trim();
  } catch {
    return `Note: Live Bedhampton clinic data is temporarily unavailable. Base financial analysis on the Winchester project assumptions provided in the question.`;
  }
}

// ─── GET /api/bedhampton/summary ─────────────────────────────────────────────

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
