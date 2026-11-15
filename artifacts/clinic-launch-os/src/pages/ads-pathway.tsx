import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

// Ads Pathway: Meta ad to lead to email and WhatsApp to booked consultation, refreshed twice a
// day by the scheduled pathway check in the skin-clinic repo (ads/meta/pathway). Read only.

const PROJECT_ID = 1;

interface Lead { name: string; ad: string; formSent: string; visit: string; status: string; statusText: string }
interface AdRow { creative: string; adset: string; status: string; spend: number; impressions: number; clicks: number; leads: number; frequency: number }
interface AdSet { name: string; spend: number; reach: number; frequency: number; leads: number }
interface Pathway {
  updated: string;
  windowFrom: string;
  spend: { total: number; leadForms: number; bookingAd: number };
  leadForms: { clicks: number };
  bookingAd: { clicks: number; toBookingPage: number; toLandingPage: number; traced: number; landingLive: string };
  followUp: { sent: number; replies: number };
  totals: { impressions: number; linkClicks: number };
  adsets: AdSet[];
  ads: AdRow[];
  leads: Lead[];
  other: string[];
  summary: string;
}

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

function Tile({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-1">{note}</div>}
    </CardContent></Card>
  );
}

function Stage({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "muted" }) {
  const cls = tone === "good" ? "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30" : tone === "muted" ? "bg-muted/40" : "bg-card";
  return (
    <div className={`rounded-lg border p-3 min-w-0 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export default function AdsPathwayPage() {
  const { data, isLoading } = useQuery<{ data: Pathway | null; createdAt: string | null }>({
    queryKey: ["ads-pathway", PROJECT_ID],
    queryFn: async () => {
      const r = await fetch(`/api/projects/${PROJECT_ID}/ads-pathway`, { credentials: "include" });
      if (!r.ok) throw new Error("Could not load the ads pathway");
      return r.json();
    },
  });

  const p = data?.data;
  if (isLoading) return <div className="p-6 text-muted-foreground">Loading the ads pathway…</div>;
  if (!p) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl">
        <PageHeader title="Ads Pathway" subtitle="Meta ad to booked consultation" />
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No snapshot yet. The twice-daily pathway check saves one here each morning and evening.</CardContent></Card>
      </div>
    );
  }

  const leads = p.leads.length;
  const booked = p.leads.filter((l) => l.status === "booked").length;
  const ctr = (100 * p.totals.linkClicks) / p.totals.impressions;
  const maxFreq = Math.max(...p.adsets.map((a) => a.frequency));
  const fatigue = maxFreq < 2 ? "No fatigue" : maxFreq <= 3 ? "Watch" : "Refresh creative";

  const groups = new Map<string, AdRow & { sets: number }>();
  for (const a of p.ads) {
    const g = groups.get(a.creative) ?? { ...a, spend: 0, impressions: 0, clicks: 0, leads: 0, frequency: 0, sets: 0 };
    g.spend += a.spend; g.impressions += a.impressions; g.clicks += a.clicks; g.leads += a.leads;
    g.frequency = Math.max(g.frequency, a.frequency); g.sets += 1;
    if (a.status === "Active") g.status = "Active";
    groups.set(a.creative, g);
  }
  const bookedBy: Record<string, number> = {};
  for (const l of p.leads) if (l.status === "booked") {
    const k = [...groups.keys()].find((c) => c.startsWith(l.ad)) ?? l.ad;
    bookedBy[k] = (bookedBy[k] ?? 0) + 1;
  }
  const rank = (g: { status: string; leads: number }) => (g.status !== "Active" ? 2 : g.leads ? 0 : 1);
  const adList = [...groups.values()].sort((x, y) => rank(x) - rank(y) || (rank(x) === 0 ? x.spend / x.leads - y.spend / y.leads : y.spend - x.spend));

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-6">
      <PageHeader title="Ads Pathway" subtitle={`Meta ad to booked consultation, since ${p.windowFrom}. Updated ${p.updated}.`} />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Tile label="Spent" value={`£${Math.round(p.spend.total)}`} note="three campaigns" />
        <Tile label="Leads" value={String(leads)} note="all in GHL" />
        <Tile label="Cost per lead" value={gbp(p.spend.total / leads)} note={`${gbp(p.spend.leadForms / leads)} on lead form ads`} />
        <Tile label="Booked consultations" value={String(booked)} note={`${booked} of ${leads} booked themselves`} />
        <Tile label="Per booked consultation" value={booked ? gbp(p.spend.total / booked) : "n/a"} note="all spend" />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile label="Link click rate" value={`${ctr.toFixed(1)}%`} note={`${p.totals.linkClicks} clicks, ${p.totals.impressions.toLocaleString("en-GB")} views`} />
        <Tile label="Cost per click" value={gbp(p.spend.total / p.totals.linkClicks)} />
        <Tile label="Cost per 1,000 views" value={gbp((1000 * p.spend.total) / p.totals.impressions)} />
        <Tile label="Frequency, highest ad set" value={maxFreq.toFixed(2)} note={<Badge variant={fatigue === "No fatigue" ? "secondary" : "destructive"}>{fatigue}</Badge>} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">The pathway</h2>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <Stage label="Lead form ads" value={gbp(p.spend.leadForms)} sub={`${p.leadForms.clicks} clicks`} />
          <Stage label="Leads in GHL" value={String(leads)} sub={`${Math.round((100 * leads) / p.leadForms.clicks)}% of clicks`} />
          <Stage label="Email + WhatsApp" value={`${p.followUp.sent} of ${leads}`} sub={`${p.followUp.replies} replies`} />
          <Stage label="Booked in ANS" value={String(booked)} sub={`${leads - booked} not yet`} tone="good" />
        </div>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mt-2">
          <Stage label="Booking page ad" value={gbp(p.spend.bookingAd)} sub={`${p.bookingAd.clicks} clicks`} tone="muted" />
          <Stage label="To booking page" value={String(p.bookingAd.toBookingPage)} sub="before the landing page" tone="muted" />
          <Stage label="To landing page" value={String(p.bookingAd.toLandingPage)} sub={`live ${p.bookingAd.landingLive}`} tone="muted" />
          <Stage label="Bookings traced" value={String(p.bookingAd.traced)} sub="from this ad" tone="muted" />
        </div>
        <p className="text-sm text-muted-foreground mt-3">{p.summary}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Every lead, traced</h2>
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="text-muted-foreground text-left"><tr>
              <th className="p-3">Lead</th><th className="p-3">Ad</th><th className="p-3">Form sent</th><th className="p-3">Booking page</th><th className="p-3">ANS</th>
            </tr></thead>
            <tbody>{p.leads.map((l) => (
              <tr key={l.name + l.formSent} className="border-t">
                <td className="p-3">{l.name}</td><td className="p-3">{l.ad}</td><td className="p-3 tabular-nums">{l.formSent}</td><td className="p-3">{l.visit}</td>
                <td className="p-3"><Badge variant={l.status === "booked" ? "default" : "secondary"}>{l.statusText}</Badge></td>
              </tr>))}</tbody>
          </table>
        </CardContent></Card>
        <p className="text-sm text-muted-foreground mt-2">Outside the lead forms: {p.other.join(" ")}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Every ad</h2>
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="text-muted-foreground"><tr className="text-right">
              <th className="p-3 text-left">Ad</th><th className="p-3">Spend</th><th className="p-3">Views</th><th className="p-3">Clicks</th><th className="p-3">Click rate</th>
              <th className="p-3">Per click</th><th className="p-3">Leads</th><th className="p-3">Per lead</th><th className="p-3">Booked</th><th className="p-3">Frequency</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>{adList.map((g) => (
              <tr key={g.creative} className={`border-t text-right tabular-nums ${g.status !== "Active" ? "text-muted-foreground" : ""}`}>
                <td className="p-3 text-left">{g.creative}{g.sets > 1 && <span className="text-xs text-muted-foreground"> ({g.sets} ad sets)</span>}</td>
                <td className="p-3">{gbp(g.spend)}</td><td className="p-3">{g.impressions}</td><td className="p-3">{g.clicks}</td>
                <td className="p-3">{g.impressions ? `${((100 * g.clicks) / g.impressions).toFixed(1)}%` : ""}</td>
                <td className="p-3">{g.clicks ? gbp(g.spend / g.clicks) : ""}</td><td className="p-3">{g.leads}</td>
                <td className="p-3">{g.leads ? gbp(g.spend / g.leads) : "none yet"}</td><td className="p-3">{bookedBy[g.creative] ?? 0}</td>
                <td className="p-3">{g.frequency.toFixed(2)}</td><td className="p-3">{g.status}</td>
              </tr>))}</tbody>
          </table>
        </CardContent></Card>
        <p className="text-sm text-muted-foreground mt-2">No ad is judged before 7 days or £50 spent. Frequency over 3 in a small local audience means the creative needs refreshing.</p>
      </section>
    </div>
  );
}
