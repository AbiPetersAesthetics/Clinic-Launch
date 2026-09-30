// Money page: the cash model (owner specification of 30 September 2026).
// Two linked tables, profit and loss then cash flow, one row per month, with
// financial-year (August to July) totals. Every cell's hover says where its
// number came from. Numbers come from GET /api/projects/:id/cash-model.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

const PROJECT_ID = 1;

type Site = { gross: number; vat: number; net: number; product: number; contribution: number };
type Row = {
  month: string; label: string; fy: string;
  bedh: Site; winc: Site; total: Site;
  running: { utilities: number; general: number; marketing: number; oneOff: number; total: number };
  rentAccrued: number; rates: number; operatingProfit: number; wincOwnProfit: number; bedhOwnProfit: number;
  payGate: boolean; paySalary: number; payCost: number; profitRetained: number;
  openingBank: number; fundingIn: number; loanDrawn: number; projectBank: number;
  cardDrawn: number; cardFundedCosts: number; cardRepayment: number; cardOwed: number;
  loanRepayment: number; loanInterest: number; loanOwed: number; rentPaid: number; rentTiming: number;
  moneyIn: number; moneyOutBank: number; net: number; closingBank: number;
  belowFloor: boolean; cardOverLimit: boolean; why: Record<string, string>;
};
type Check = { name: string; pass: boolean; detail: string };
type PlanLine = { taskId: number; title: string; phase: string; status: string; recorded: number; paid: number; remainingExVat: number; vatBasis: string; plan: { month: string; share: number; method: string }[]; planProblem: string | null };
type CashModel = {
  scenario: string; scenarios: Record<string, { label: string; note: string }>;
  config: any; rows: Row[]; fyTotals: Record<string, Record<string, number>>; checks: Check[];
  lowest: { month: string; bank: number }; firstPayMonth: string | null;
  projectLines: PlanLine[]; paidToDate: number;
  funding: { month: string; amount: number; kind: string; label: string }[];
  loans: { label: string; principal: number; drawMonth: string; annualRatePct: number; holidayMonths: number; repayments: number }[];
  ownership: { from: string | null; status: string; holders: { name: string; equityPercent: number }[] }[];
  history: { bedhTakings: Record<string, number>; source: string };
};

// Money: whole pounds, a true minus sign for negatives.
const gbp = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return "";
  const r = Math.round(v);
  return `${r < 0 ? "−" : ""}£${Math.abs(r).toLocaleString("en-GB")}`;
};
const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${String(y).slice(2)}`; };

function Cell({ v, title, strong, tone, sub }: { v: number; title?: string; strong?: boolean; tone?: "neg" | "pos" | "muted"; sub?: string }) {
  const colour = tone === "muted" ? "text-muted-foreground" : v < -0.5 ? "text-rose-600 dark:text-rose-400" : tone === "pos" ? "text-emerald-700 dark:text-emerald-400" : "";
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${strong ? "font-semibold" : ""} ${colour}`} title={title}>
      {Math.abs(v) < 0.5 ? <span className="text-muted-foreground/40">0</span> : gbp(v)}
      {sub && <div className="text-[9px] font-normal text-muted-foreground leading-tight">{sub}</div>}
    </td>
  );
}

function Th({ children, hint, left }: { children: React.ReactNode; hint?: string; left?: boolean }) {
  return (
    <th className={`px-2 py-2 ${left ? "text-left sticky left-0 bg-muted/40 z-10" : "text-right"} font-medium align-bottom`}>
      <div className="leading-tight">{children}</div>
      {hint && <div className="text-[9px] font-normal text-muted-foreground normal-case tracking-normal">{hint}</div>}
    </th>
  );
}

export function CashModelPanel() {
  const [scenario, setScenario] = useState<string | null>(null);
  const [months, setMonths] = useState<12 | 36>(12);
  const [cashView, setCashView] = useState<"flow" | "reference">("flow");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  const { data, isLoading, error } = useQuery<CashModel>({
    queryKey: ["cash-model", PROJECT_ID, scenario, months],
    queryFn: async () => {
      const r = await fetch(`/api/projects/${PROJECT_ID}/cash-model?months=${months}${scenario ? `&scenario=${scenario}` : ""}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load the cash model");
      return r.json();
    },
  });

  // Rows with a financial-year total after the last month of each year.
  const withTotals = useMemo(() => {
    if (!data) return [] as ({ kind: "row"; row: Row } | { kind: "fy"; fy: string; partial: boolean; last: Row })[];
    const out: ({ kind: "row"; row: Row } | { kind: "fy"; fy: string; partial: boolean; last: Row })[] = [];
    data.rows.forEach((row, i) => {
      out.push({ kind: "row", row });
      const next = data.rows[i + 1];
      if (!next || next.fy !== row.fy) out.push({ kind: "fy", fy: row.fy, partial: row.month.slice(5) !== "07", last: row });
    });
    return out;
  }, [data]);

  if (isLoading) return <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Running the cash model…</CardContent></Card>;
  if (error || !data) return <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700 dark:text-rose-400">Could not load the cash model: {(error as Error)?.message}</CardContent></Card>;

  const c = data.config;
  const floor = c.cashFloor as number;
  const belowFloor = data.rows.filter(r => r.belowFloor);
  const cardPeak = data.rows.reduce((m, r) => Math.max(m, r.cardOwed), 0);
  const failing = data.checks.filter(k => !k.pass);
  const fy = (k: string, f: string) => data.fyTotals[k]?.[f] ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header, controls and summary ─────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Cash model</CardTitle>
              <CardDescription className="text-sm max-w-3xl">
                Starts {monthLabel(c.startMonth)} with {gbp(c.openingBank)} in the bank at {c.openingDate.split("-").reverse().join("/")} (bank plus cash in hand). Earlier months are history and do not change that balance.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border overflow-hidden text-xs">
                {Object.entries(data.scenarios).map(([k, s]) => (
                  <button key={k} onClick={() => setScenario(k)} title={s.note}
                    className={`px-2.5 py-1 ${data.scenario === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s.label}</button>
                ))}
              </div>
              <div className="flex rounded-md border overflow-hidden text-xs">
                {([12, 36] as const).map(m => (
                  <button key={m} onClick={() => setMonths(m)} className={`px-2.5 py-1 ${months === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{m} mo</button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 rounded-md bg-muted/40 border px-3 py-2">
            Project costs are shown ex VAT. The VAT on build costs and card-bought items is funded from personal funds and recovered through the VAT return, so it sits outside the company cash model.
            Takings are entered inc VAT; every sale is standard-rated, so VAT on sales is one sixth of takings at both sites.
          </p>
          <p className="text-xs text-muted-foreground">{data.scenarios[data.scenario]?.note} Winchester takings are as entered to June 2027, then a straight line to {gbp(c.winc.growth.target)} a month by {monthLabel(c.winc.growth.month)}, then held.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile label="Lowest bank" value={gbp(data.lowest.bank)} sub={data.lowest.month} tone={data.lowest.bank < floor ? "bad" : data.lowest.bank < floor * 1.2 ? "warn" : "good"} />
            <Tile label={`Months under ${gbp(floor)}`} value={String(belowFloor.length)} sub={belowFloor.length ? belowFloor.map(r => r.label).join(", ") : "Never below the floor"} tone={belowFloor.length ? "bad" : "good"} />
            <Tile label="Card owed at peak" value={gbp(cardPeak)} sub={`Limit ${gbp(c.card.limit)}, repaid over ${c.card.repayMonths} months`} tone={cardPeak > c.card.limit ? "bad" : "neutral"} />
            <Tile label="Abi's pay starts" value={data.firstPayMonth ?? "Not in view"} sub="Salary, under the rule below" tone="neutral" />
            <Tile label="Checks" value={`${data.checks.length - failing.length} of ${data.checks.length}`} sub={failing.length ? `${failing.length} failing` : "All passing"} tone={failing.length ? "bad" : "good"} />
          </div>
        </CardContent>
      </Card>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bank balance, card and loan</CardTitle>
          <CardDescription className="text-sm">Closing bank each month against the {gbp(floor)} cash floor. The lowest point is marked.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.rows} margin={{ top: 16, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={months === 36 ? 2 : 0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `£${Math.round(v / 1000)}k`} width={48} />
                <Tooltip formatter={(v: number, n: string) => [gbp(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="closingBank" name="Bank (closing)" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} />
                <Line type="monotone" dataKey="cardOwed" name="Card owed" stroke="#b45309" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="loanOwed" name="Loan owed" stroke="#64748b" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
                <ReferenceLine y={floor} stroke="#e11d48" strokeDasharray="6 4" label={{ value: `Cash floor ${gbp(floor)}`, position: "insideBottomRight", fontSize: 11, fill: "#e11d48" }} />
                <ReferenceDot x={data.lowest.month} y={data.lowest.bank} r={5} fill="#e11d48" stroke="white" label={{ value: `Lowest ${gbp(data.lowest.bank)}`, position: "top", fontSize: 11 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Checks ────────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sanity checks</CardTitle></CardHeader>
        <CardContent className="pt-0 grid md:grid-cols-2 gap-2">
          {data.checks.map(k => (
            <div key={k.name} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${k.pass ? "" : "border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800"}`}>
              {k.pass ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <div><div className="font-medium">{k.name}</div><div className="text-muted-foreground">{k.detail}</div></div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Profit and loss ───────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Profit and loss (trading)</CardTitle>
          <CardDescription className="text-sm">Each month shows the combined total, with Bedhampton (B) and Winchester (W) underneath. Hover any figure to see where it came from.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide text-[10px]">
                <tr>
                  <Th left>Month</Th>
                  <Th hint="inc VAT">Gross takings</Th>
                  <Th hint="one sixth of gross">VAT on sales</Th>
                  <Th hint="ex VAT">Net sales</Th>
                  <Th hint="ex VAT">Product cost</Th>
                  <Th hint="ex VAT">Contribution</Th>
                  <Th hint="ex VAT">Running costs</Th>
                  <Th hint="no VAT on rent">Rent and rates</Th>
                  <Th hint="ex VAT">Operating profit</Th>
                  <Th hint="salary, with employer NI">Abi's pay</Th>
                  <Th hint="ex VAT">Profit retained</Th>
                </tr>
              </thead>
              <tbody>
                {withTotals.map((x, i) => x.kind === "row" ? (
                  <tr key={x.row.month} className={`border-t border-border/40 ${x.row.belowFloor ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}`}>
                    <td className="px-2 py-1.5 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">{x.row.label}</td>
                    <Cell v={x.row.total.gross} sub={`B ${gbp(x.row.bedh.gross)} · W ${gbp(x.row.winc.gross)}`} title={x.row.why.winc} />
                    <Cell v={-x.row.total.vat} sub={`B ${gbp(x.row.bedh.vat)} · W ${gbp(x.row.winc.vat)}`} title={x.row.why.vat} tone="muted" />
                    <Cell v={x.row.total.net} title="Gross takings less VAT on sales" />
                    <Cell v={-x.row.total.product} sub={`B ${gbp(x.row.bedh.product)} · W ${gbp(x.row.winc.product)}`} title="Net sales less contribution, at each site's contribution percentage" tone="muted" />
                    <Cell v={x.row.total.contribution} sub={`B ${gbp(x.row.bedh.contribution)} · W ${gbp(x.row.winc.contribution)}`} title={x.row.why.contribution} strong />
                    <Cell v={-x.row.running.total} sub={x.row.running.oneOff ? `incl ${gbp(x.row.running.oneOff)} one-off` : undefined}
                      title={`Utilities ${gbp(x.row.running.utilities)}, existing running costs ${gbp(x.row.running.general)}, marketing ${gbp(x.row.running.marketing)}${x.row.running.oneOff ? `, one-off ${gbp(x.row.running.oneOff)}` : ""}`} tone="muted" />
                    <Cell v={-(x.row.rentAccrued + x.row.rates)} sub={x.row.rentAccrued ? undefined : "rent free"} title={`Rent ${gbp(x.row.rentAccrued)} (accrued monthly; paid quarterly, see cash flow) and rates ${gbp(x.row.rates)}`} tone="muted" />
                    <Cell v={x.row.operatingProfit} title={x.row.why.operatingProfit} strong />
                    <Cell v={-x.row.payCost} sub={x.row.paySalary ? `salary ${gbp(x.row.paySalary)}` : undefined} title={x.row.why.pay} tone="muted" />
                    <Cell v={x.row.profitRetained} title="Operating profit less Abi's pay" strong />
                  </tr>
                ) : (
                  <tr key={`fy-${x.fy}-${i}`} className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-2 py-1.5 sticky left-0 bg-muted/60 z-10 whitespace-nowrap">{x.fy} total{x.partial ? ` (to ${x.last.label})` : ""}</td>
                    <Cell v={fy(x.fy, "grossBedh") + fy(x.fy, "grossWinc")} sub={`B ${gbp(fy(x.fy, "grossBedh"))} · W ${gbp(fy(x.fy, "grossWinc"))}`} />
                    <Cell v={-fy(x.fy, "vat")} tone="muted" />
                    <Cell v={fy(x.fy, "grossBedh") + fy(x.fy, "grossWinc") - fy(x.fy, "vat")} />
                    <Cell v={-(fy(x.fy, "grossBedh") + fy(x.fy, "grossWinc") - fy(x.fy, "vat") - fy(x.fy, "contribution"))} tone="muted" />
                    <Cell v={fy(x.fy, "contribution")} strong />
                    <Cell v={-fy(x.fy, "runningTotal")} tone="muted" />
                    <Cell v={-(fy(x.fy, "rentAccrued") + fy(x.fy, "rates"))} tone="muted" />
                    <Cell v={fy(x.fy, "operatingProfit")} strong />
                    <Cell v={-fy(x.fy, "payCost")} tone="muted" />
                    <Cell v={fy(x.fy, "profitRetained")} strong />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Cash flow ─────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Cash flow</CardTitle>
              <CardDescription className="text-sm">Linked to the profit and loss above: operating profit, adjusted for timing, becomes the change in the bank.</CardDescription>
            </div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button onClick={() => setCashView("flow")} className={`px-2.5 py-1 ${cashView === "flow" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Cash flow</button>
              <button onClick={() => setCashView("reference")} className={`px-2.5 py-1 ${cashView === "reference" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Money in and out</button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {cashView === "flow" ? (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide text-[10px]">
                  <tr>
                    <Th left>Month</Th>
                    <Th>Opening bank</Th>
                    <Th hint="from the P&amp;L">Operating profit</Th>
                    <Th hint="equity, gift, loans">Funding in</Th>
                    <Th hint="ex VAT, bank">Project spend</Th>
                    <Th hint="costs put on the card">Card funded</Th>
                    <Th hint="1/24 of each draw">Card repaid</Th>
                    <Th>Loan repaid</Th>
                    <Th hint="quarterly in advance">Rent timing</Th>
                    <Th>Abi's pay</Th>
                    <Th>Closing bank</Th>
                    <Th>Card owed</Th>
                    <Th>Loan owed</Th>
                  </tr>
                </thead>
                <tbody>
                  {withTotals.map((x, i) => x.kind === "row" ? (
                    <tr key={x.row.month} className={`border-t border-border/40 ${x.row.belowFloor ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}`}>
                      <td className="px-2 py-1.5 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">{x.row.label}</td>
                      <Cell v={x.row.openingBank} tone="muted" />
                      <Cell v={x.row.operatingProfit} title={x.row.why.operatingProfit} />
                      <Cell v={x.row.fundingIn} title={x.row.why.fundingIn} tone="pos" />
                      <Cell v={-x.row.projectBank} title={x.row.why.projectBank} />
                      <Cell v={x.row.cardFundedCosts} title="Running costs paid by card this month (added back: they leave the bank later, as repayments)" tone="muted" />
                      <Cell v={-x.row.cardRepayment} title={x.row.why.cardRepayment} />
                      <Cell v={-x.row.loanRepayment} title={x.row.why.loanRepayment ?? "No loan repayment this month"} />
                      <Cell v={x.row.rentTiming} title={`${x.row.why.rentPaid}. Rent in the P&L is ${gbp(x.row.rentAccrued)}, so the timing difference is ${gbp(x.row.rentTiming)}`} tone="muted" />
                      <Cell v={-x.row.payCost} title={x.row.why.pay} />
                      <Cell v={x.row.closingBank} strong title={`Opening ${gbp(x.row.openingBank)} + money in ${gbp(x.row.moneyIn)} - money out ${gbp(x.row.moneyOutBank)}`} />
                      <Cell v={x.row.cardOwed} title={x.row.why.cardDrawn} tone="muted" />
                      <Cell v={x.row.loanOwed} title={x.row.loanInterest ? `Includes interest of ${gbp(x.row.loanInterest)} this month` : undefined} tone="muted" />
                    </tr>
                  ) : (
                    <tr key={`cfy-${x.fy}-${i}`} className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-2 py-1.5 sticky left-0 bg-muted/60 z-10 whitespace-nowrap">{x.fy} total{x.partial ? ` (to ${x.last.label})` : ""}</td>
                      <td />
                      <Cell v={fy(x.fy, "operatingProfit")} />
                      <Cell v={fy(x.fy, "fundingIn")} />
                      <Cell v={-fy(x.fy, "projectBank")} />
                      <td />
                      <Cell v={-fy(x.fy, "cardRepayment")} />
                      <Cell v={-fy(x.fy, "loanRepayment")} />
                      <Cell v={fy(x.fy, "rentAccrued") - fy(x.fy, "rentPaid")} />
                      <Cell v={-fy(x.fy, "payCost")} />
                      <Cell v={fy(x.fy, "closingBank")} />
                      <Cell v={fy(x.fy, "cardOwed")} />
                      <Cell v={fy(x.fy, "loanOwed")} />
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide text-[10px]">
                  <tr><Th left>Month</Th><Th>Money in</Th><Th hint="bank">Money out</Th><Th>Net</Th><Th>Bank balance</Th><Th>Card drawn</Th><Th>Card owed</Th></tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.month} className={`border-t border-border/40 ${r.belowFloor ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}`}>
                      <td className="px-2 py-1.5 font-medium sticky left-0 bg-card z-10">{r.label}</td>
                      <Cell v={r.moneyIn} title={`Contribution ${gbp(r.total.contribution)} + funding ${gbp(r.fundingIn)}`} />
                      <Cell v={r.moneyOutBank} title={r.why.moneyOutBank} />
                      <Cell v={r.net} strong />
                      <Cell v={r.closingBank} strong />
                      <Cell v={r.cardDrawn} title={r.why.cardDrawn} tone="muted" />
                      <Cell v={r.cardOwed} tone="muted" />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Abi's pay, funding and ownership ──────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">How Abi's pay is worked out</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-2 text-muted-foreground">
            <p><span className="text-foreground font-medium">1. The gate.</span> Nothing is paid until Winchester has made a profit on its own for {c.pay.gateMonths} months in a row. Once open, the gate stays open.</p>
            <p><span className="text-foreground font-medium">2. What the business keeps.</span> Each month the business keeps the first {gbp(c.pay.retention)} of operating profit, after loan repayments.</p>
            <p><span className="text-foreground font-medium">3. What Abi takes.</span> Everything above that is paid as salary, up to {gbp(c.pay.capMonthly)} a month (the basic-rate limit of £50,270 a year), then it stops.</p>
            <p><span className="text-foreground font-medium">4. What it costs.</span> The company also pays employer's National Insurance at {c.pay.niRatePct}% on salary above {gbp(c.pay.niThresholdAnnual)} a year, so the full salary costs about £4,755 a month.</p>
            <p className="text-foreground">In this view: {data.firstPayMonth ? `pay starts in ${data.firstPayMonth}.` : "no pay within the months shown."}</p>
            <p>Salary rather than dividends: once James holds shares, a dividend is paid to every shareholder in proportion. Confirm with the accountant.</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Funding</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-2">
            {data.funding.map(f => (
              <div key={f.label} className="flex justify-between gap-2"><span>{f.label} <span className="text-muted-foreground">({f.kind}, {monthLabel(f.month)})</span></span><span className="tabular-nums font-medium">{gbp(f.amount)}</span></div>
            ))}
            {data.loans.map(l => (
              <div key={l.label} className="space-y-0.5">
                <div className="flex justify-between gap-2"><span>{l.label} <span className="text-muted-foreground">(loan, {monthLabel(l.drawMonth)})</span></span><span className="tabular-nums font-medium">{gbp(l.principal)}</span></div>
                <div className="text-muted-foreground">{l.annualRatePct}% a year, {l.holidayMonths}-month holiday with interest accruing, then {l.repayments} monthly repayments.</div>
              </div>
            ))}
            <div className="text-muted-foreground pt-1 border-t">Credit card: {gbp(c.card.limit)} at 0%, each draw repaid over {c.card.repayMonths} months from the month after.</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ownership over time</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-3">
            {data.ownership.map(p => (
              <div key={`${p.status}-${p.from}`}>
                <div className="text-muted-foreground mb-0.5">
                  {p.from && p.from > "2025-12-31" ? `From ${p.from.split("-").reverse().join("/")}` : "Until 30 September 2026"}
                  {p.status === "pending" && <span className="ml-1.5 text-amber-700 dark:text-amber-400 font-medium">pending: not final until the 1% is issued</span>}
                </div>
                <div className="flex flex-wrap gap-x-3">{p.holders.map(h => <span key={h.name}>{h.name} <span className="tabular-nums font-medium">{h.equityPercent}%</span></span>)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Project payments ─────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle("lines")}>
          <CardTitle className="text-sm flex items-center gap-1.5">
            {open.lines ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Project costs: when each is paid
          </CardTitle>
          <CardDescription className="text-xs">The payment month and method drive the cash model, not the task's due date. Paid to date {gbp(data.paidToDate)}, as recorded.</CardDescription>
        </CardHeader>
        {open.lines && (
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase tracking-wide">
                <tr><Th left>Line</Th><Th>Recorded</Th><Th>Paid</Th><Th hint="ex VAT">Still to pay</Th><Th>When and how</Th></tr>
              </thead>
              <tbody>
                {data.projectLines.map(l => (
                  <tr key={l.taskId} className={`border-t border-border/40 ${l.planProblem ? "bg-rose-50 dark:bg-rose-950/20" : ""}`}>
                    <td className="px-2 py-1.5 sticky left-0 bg-card z-10"><div className="font-medium">{l.title}</div><div className="text-[10px] text-muted-foreground">{l.phase} · {l.vatBasis}</div></td>
                    <Cell v={l.recorded} tone="muted" />
                    <Cell v={l.paid} tone="muted" />
                    <Cell v={l.remainingExVat} />
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{l.planProblem ?? (l.remainingExVat < 0.5 ? <span className="text-muted-foreground">paid</span> : l.plan.map(p => `${monthLabel(p.month)} ${p.method}${p.share < 1 ? ` (${Math.round(p.share * 100)}%)` : ""}`).join(", "))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </Card>

      {/* ── History ───────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle("history")}>
          <CardTitle className="text-sm flex items-center gap-1.5">
            {open.history ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Before {monthLabel(c.startMonth)} (actuals, not part of the model)
          </CardTitle>
        </CardHeader>
        {open.history && (
          <CardContent className="text-xs space-y-1">
            {Object.entries(data.history.bedhTakings).map(([m, v]) => (
              <div key={m} className="flex justify-between max-w-sm"><span>Bedhampton takings, {monthLabel(m)} (inc VAT)</span><span className="tabular-nums">{gbp(v)}</span></div>
            ))}
            <div className="flex justify-between max-w-sm"><span>Project costs paid before {monthLabel(c.startMonth)}, as recorded</span><span className="tabular-nums">{gbp(data.paidToDate)}</span></div>
            <p className="text-muted-foreground pt-1">Source: {data.history.source}. These do not change the opening balance.</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const border = tone === "bad" ? "border-rose-300 dark:border-rose-800" : tone === "warn" ? "border-amber-300 dark:border-amber-800" : tone === "good" ? "border-emerald-300 dark:border-emerald-800" : "border-border";
  return (
    <div className={`rounded-lg border ${border} p-3`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

export default CashModelPanel;
