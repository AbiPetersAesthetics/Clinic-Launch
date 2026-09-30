// ── Cash model for the Money page ────────────────────────────────────────────
// Built to the owner's specification of 30 September 2026. Pure: no database,
// no dates from the clock. Every figure comes from CashInputs, and each row
// carries a plain-English "why" for the hover on the page.
//
// Conventions (sanity check 2):
//   takings are VAT inclusive (gross); VAT on sales is gross x rate / (1 + rate);
//   contribution is what is left of gross after VAT on sales and product cost;
//   running costs, rent, rates and project costs are ex VAT. VAT on build and
//   card-bought project items is funded personally and recovered through the
//   VAT return, so it sits outside the company cash model.

export type Method = "bank" | "card";

export type ProjectPayment = { month: string; amountExVat: number; method: Method; label: string; taskId?: number };
export type OneOff = { month: string; amount: number; method: Method; label: string; pnl: boolean };
export type FundingIn = { month: string; amount: number; kind: "equity" | "gift"; label: string };
export type LoanTerms = { label: string; principal: number; drawMonth: string; annualRatePct: number; holidayMonths: number; repayments: number };
// The split week: from `from`, Abi works bedhDays at Bedhampton and wincDays at
// Winchester. Bedhampton stays open, taking `monthly`, until moving its days to
// Winchester would earn more than keeping them, for consecutiveMonths running.
export type BedhSplit = { from: string; monthly: number; bedhDays: number; wincDays: number; consecutiveMonths: number };
// What a Winchester day can hold: booked hours are worth perBookedHour, and a day
// is counted full at maxBookedPct of hoursPerDay.
export type WincCapacity = { perBookedHour: number; hoursPerDay: number; maxBookedPct: number };

export type CashInputs = {
  startMonth: string;            // "2026-10"
  months: number;                // rows to produce
  openingBank: number;           // bank plus cash at the end of the month before startMonth
  bedh: { takings: Record<string, number>; contributionPct: number; split?: BedhSplit };
  winc: {
    takings: Record<string, number>;
    contributionPct: number;
    // After the last explicit month, a straight line to `target` by `month`, then held.
    growth?: { target: number; month: string };
    capacity?: WincCapacity;
  };
  vatRate: number;               // 0.2: every sale is standard-rated
  rent: { annual: number; rentStart: string; quarterDays: string[] }; // rentStart "YYYY-MM-DD"; quarterDays "MM-DD"
  rates: { monthly: number; from: string };
  utilities: { monthly: number; buildMonthly: number; buildUntil: string; from: string };
  running: { monthly: number };
  // wincFrom: the month the ads become Winchester's. cardFrom: null means never on the card.
  marketing: { monthly: number; wincFrom: string; cardFrom: string | null };
  card: { limit: number; repayMonths: number };
  cashFloor: number;
  pay: { retention: number; capMonthly: number; niRatePct: number; niThresholdAnnual: number; gateMonths: number };
  projectPayments: ProjectPayment[];
  oneOffs: OneOff[];
  funding: FundingIn[];
  loans: LoanTerms[];
};

export type Site = { gross: number; vat: number; net: number; product: number; contribution: number };

export type CashRow = {
  month: string; label: string; fy: string;
  // Profit and loss
  bedh: Site; winc: Site; total: Site;
  running: { utilities: number; general: number; marketing: number; oneOff: number; total: number };
  rentAccrued: number; rates: number;
  operatingProfit: number;
  wincOwnProfit: number; bedhOwnProfit: number;
  // The split week: Winchester demand, what its days can hold, and the monthly test
  // of moving Bedhampton's days across (gain at Winchester against loss at Bedhampton).
  bedhOpen: boolean; wincDemand: number; wincCapacity: number | null; switchGain: number; switchLoss: number;
  payGate: boolean; paySalary: number; payCost: number;
  profitRetained: number;
  // Cash flow
  openingBank: number;
  fundingIn: number; loanDrawn: number;
  projectBank: number;
  cardDrawn: number; cardFundedCosts: number; cardRepayment: number; cardOwed: number;
  loanRepayment: number; loanInterest: number; loanOwed: number;
  rentPaid: number; rentTiming: number;
  moneyIn: number; moneyOutBank: number; net: number;
  closingBank: number;
  belowFloor: boolean; cardOverLimit: boolean;
  why: Record<string, string>;
};

export type CashCheck = { name: string; pass: boolean; detail: string };
export type CashResult = { rows: CashRow[]; fyTotals: Record<string, Partial<Record<keyof CashRow, number>>>; checks: CashCheck[]; lowest: { month: string; bank: number } };

// ── month helpers ────────────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}
const label = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${String(y).slice(2)}`; };
// Financial year runs August to July.
export const fyOf = (ym: string) => { const [y, m] = ym.split("-").map(Number); const s = m >= 8 ? y : y - 1; return `FY${String(s).slice(2)}/${String(s + 1).slice(2)}`; };
const r2 = (v: number) => Math.round(v * 100) / 100;
const gbp = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;

// Winchester takings: explicit months first, then the growth line.
export function wincTakings(inp: CashInputs, ym: string): number {
  const t = inp.winc.takings;
  if (t[ym] != null) return t[ym];
  const keys = Object.keys(t).sort();
  if (!keys.length || ym < keys[0]) return 0;
  const last = keys[keys.length - 1];
  const g = inp.winc.growth;
  if (!g || ym <= last) return 0;
  const span = monthsBetween(last, g.month);
  if (span <= 0 || ym >= g.month) return g.target;
  return t[last] + (g.target - t[last]) * (monthsBetween(last, ym) / span);
}

// Winchester takings its days can hold in a month (weeks = 52 / 12).
export function wincCapacityFor(inp: CashInputs, daysPerWeek: number): number {
  const c = inp.winc.capacity;
  if (!c) return Infinity;
  return daysPerWeek * (52 / 12) * c.hoursPerDay * (c.maxBookedPct / 100) * c.perBookedHour;
}

// Rent: quarterly in advance on the quarter days. The first payment falls on the
// last quarter day on or before rentStart and covers rentStart to the next quarter
// day, apportioned by days; after that each quarter day pays a quarter's rent.
export function rentSchedule(inp: CashInputs, fromYm: string, toYm: string): Record<string, number> {
  const out: Record<string, number> = {};
  const start = new Date(inp.rent.rentStart + "T00:00:00Z");
  const y0 = Number(fromYm.slice(0, 4)) - 1, y1 = Number(toYm.slice(0, 4)) + 1;
  const days: Date[] = [];
  for (let y = y0; y <= y1; y++) for (const q of inp.rent.quarterDays) days.push(new Date(`${y}-${q}T00:00:00Z`));
  days.sort((a, b) => a.getTime() - b.getTime());
  const firstIdx = days.reduce((k, d, i) => (d <= start ? i : k), -1);
  if (firstIdx < 0) return out;
  const next = days[firstIdx + 1];
  const apportioned = inp.rent.annual * ((next.getTime() - start.getTime()) / 864e5) / 365;
  const put = (d: Date, v: number) => { const ym = d.toISOString().slice(0, 7); if (ym >= fromYm && ym <= toYm) out[ym] = (out[ym] ?? 0) + v; };
  put(days[firstIdx], apportioned);
  for (let i = firstIdx + 1; i < days.length; i++) put(days[i], inp.rent.annual / 4);
  return out;
}

// Abi's pay: gross salary s costs the company s plus employer NI on the part above
// the monthly threshold. Solve for the largest s whose cost fits `available`.
export function salaryFor(available: number, p: CashInputs["pay"]): { salary: number; cost: number } {
  if (available <= 0) return { salary: 0, cost: 0 };
  const thr = p.niThresholdAnnual / 12, ni = p.niRatePct / 100;
  const costOf = (s: number) => s + ni * Math.max(0, s - thr);
  let s = available <= thr ? available : (available + ni * thr) / (1 + ni);
  s = Math.min(s, p.capMonthly);
  return { salary: r2(s), cost: r2(costOf(s)) };
}

function site(gross: number, pct: number, vatRate: number): Site {
  const vat = gross * vatRate / (1 + vatRate);
  const contribution = gross * pct / 100;
  return { gross, vat, net: gross - vat, product: gross - vat - contribution, contribution };
}

export function runCashModel(inp: CashInputs): CashResult {
  const months = Array.from({ length: inp.months }, (_, i) => addMonths(inp.startMonth, i));
  const lastYm = months[months.length - 1];
  const rentPaidMap = rentSchedule(inp, inp.startMonth, lastYm);
  const rentStartYm = inp.rent.rentStart.slice(0, 7);
  const sp = inp.bedh.split;
  const capSplit = sp ? wincCapacityFor(inp, sp.wincDays) : Infinity;
  const capFull = sp ? wincCapacityFor(inp, sp.wincDays + sp.bedhDays) : Infinity;
  let bedhOpen = true, switchRun = 0;

  // Card: every draw is repaid in equal parts over repayMonths, starting the month after.
  const draws: { month: string; amount: number }[] = [];
  // Loans: draw, holiday with interest accruing, then level repayments.
  const loanState = inp.loans.map(l => ({ l, balance: 0, pmt: 0 }));

  const rows: CashRow[] = [];
  let bank = inp.openingBank;
  let gateRun = 0, gateOpen = false;

  for (const ym of months) {
    const why: Record<string, string> = {};
    // Sites. Before the split, Bedhampton takes its entered months and Winchester its
    // demand. During the split Winchester is held to what its days can take; once
    // Bedhampton closes, Abi's week is all Winchester.
    const splitOn = !!sp && ym >= sp.from;
    const openThisMonth = bedhOpen;
    const wincDemand = wincTakings(inp, ym);
    const wincCapacity = splitOn ? (openThisMonth ? capSplit : capFull) : null;
    const bedhGross = splitOn && !openThisMonth ? 0 : (inp.bedh.takings[ym] ?? (splitOn ? sp!.monthly : 0));
    const bedh = site(bedhGross, inp.bedh.contributionPct, inp.vatRate);
    const winc = site(wincCapacity == null ? wincDemand : Math.min(wincDemand, wincCapacity), inp.winc.contributionPct, inp.vatRate);
    // The switch test: would giving Bedhampton's days to Winchester earn more than
    // Bedhampton makes on them? Only Winchester demand beyond its current days counts.
    let switchGain = 0, switchLoss = 0;
    if (splitOn && openThisMonth) {
      switchGain = (Math.min(wincDemand, capFull) - Math.min(wincDemand, capSplit)) * inp.winc.contributionPct / 100;
      switchLoss = bedh.contribution;
      switchRun = switchGain > switchLoss ? switchRun + 1 : 0;
      if (switchRun >= sp!.consecutiveMonths) bedhOpen = false; // closes from next month
    }
    const total: Site = {
      gross: bedh.gross + winc.gross, vat: bedh.vat + winc.vat, net: bedh.net + winc.net,
      product: bedh.product + winc.product, contribution: bedh.contribution + winc.contribution,
    };
    why.winc = inp.winc.takings[ym] != null ? `Winchester takings for ${label(ym)} as entered` : (wincDemand > 0 ? `Growth line from the last entered month to ${gbp(inp.winc.growth!.target)} by ${label(inp.winc.growth!.month)}` : "Winchester not trading");
    if (wincCapacity != null && wincDemand > wincCapacity) why.winc += `; demand ${gbp(wincDemand)} is held to the ${gbp(wincCapacity)} that ${openThisMonth ? sp!.wincDays : sp!.wincDays + sp!.bedhDays} days a week can take`;
    why.bedh = splitOn && !openThisMonth ? "Bedhampton closed: moving its days to Winchester paid more"
      : inp.bedh.takings[ym] != null ? `Bedhampton takings for ${label(ym)} as entered`
      : splitOn ? `Bedhampton on ${sp!.bedhDays} days a week, Winchester on ${sp!.wincDays}` : "Bedhampton not trading";
    if (splitOn && openThisMonth) why.switch = `Moving Bedhampton's ${sp!.bedhDays} days to Winchester would add ${gbp(switchGain)} a month there and lose ${gbp(switchLoss)} at Bedhampton: ${switchGain > switchLoss ? "worth it" : "keep Bedhampton open"}`;
    why.vat = `VAT on sales = gross x 1/6 at both sites (${gbp(bedh.vat)} Bedhampton, ${gbp(winc.vat)} Winchester)`;
    why.contribution = `${inp.bedh.contributionPct}% of Bedhampton gross + ${inp.winc.contributionPct}% of Winchester gross, after VAT and product cost`;

    // Running costs
    const utilities = ym >= inp.utilities.from ? (ym <= inp.utilities.buildUntil ? inp.utilities.buildMonthly : inp.utilities.monthly) : 0;
    const general = inp.running.monthly;
    const marketing = inp.marketing.monthly;
    const marketingOnCard = inp.marketing.cardFrom != null && ym >= inp.marketing.cardFrom;
    const marketingIsWinc = ym >= inp.marketing.wincFrom;
    const oneOffs = inp.oneOffs.filter(o => o.month === ym);
    const oneOffPnl = oneOffs.filter(o => o.pnl).reduce((s, o) => s + o.amount, 0);
    const runningTotal = utilities + general + marketing + oneOffPnl;
    const rates = ym >= inp.rates.from ? inp.rates.monthly : 0;
    const rentAccrued = ym >= rentStartYm ? inp.rent.annual / 12 : 0;
    const operatingProfit = total.contribution - runningTotal - rates - rentAccrued;
    why.operatingProfit = `Contribution ${gbp(total.contribution)} less running costs ${gbp(runningTotal)}, rates ${gbp(rates)} and rent ${gbp(rentAccrued)}${rentAccrued === 0 ? " (rent free)" : ""}`;

    // Site profit, used for the pay gate. Rates, utilities and rent are always
    // Winchester's. Marketing is Bedhampton's until wincFrom (the Bedhampton
    // ads), Winchester's after, however it is paid. General running costs sit with
    // Bedhampton while it trades and move to Winchester when it closes.
    const bedhTrading = bedh.gross > 0;
    const bedhOwnProfit = bedh.contribution - (marketingIsWinc ? 0 : marketing) - (bedhTrading ? general : 0);
    const wincOwnProfit = winc.contribution - rates - utilities - rentAccrued - oneOffPnl - (marketingIsWinc ? marketing : 0) - (bedhTrading ? 0 : general);

    // Loans
    let loanDrawn = 0, loanRepayment = 0, loanInterest = 0, loanOwed = 0;
    for (const st of loanState) {
      const { l } = st; const r = l.annualRatePct / 100 / 12;
      const since = monthsBetween(l.drawMonth, ym);
      if (since === 0) { st.balance += l.principal; loanDrawn += l.principal; }
      else if (since > 0 && since <= l.holidayMonths) { const i = st.balance * r; st.balance += i; loanInterest += i; }
      else if (since > l.holidayMonths && since <= l.holidayMonths + l.repayments && st.balance > 0.005) {
        if (!st.pmt) st.pmt = r > 0 ? st.balance * r / (1 - Math.pow(1 + r, -l.repayments)) : st.balance / l.repayments;
        const i = st.balance * r; const pay = Math.min(st.pmt, st.balance + i);
        st.balance = st.balance + i - pay; loanInterest += i; loanRepayment += pay;
      }
      loanOwed += Math.max(0, st.balance);
    }
    if (loanDrawn) why.loanDrawn = inp.loans.filter(l => l.drawMonth === ym).map(l => `${l.label}: ${gbp(l.principal)} drawn`).join("; ");
    if (loanRepayment) why.loanRepayment = `Level repayment after the ${inp.loans[0]?.holidayMonths ?? 0}-month holiday, interest having accrued during it`;

    // Abi's pay: the gate opens once Winchester has made a profit for gateMonths
    // consecutive months, and stays open. Then she takes the profit above the
    // retention (after loan repayments), up to the cap, with employer NI on top.
    gateRun = wincOwnProfit >= 0 && winc.gross > 0 ? gateRun + 1 : 0;
    if (gateRun >= inp.pay.gateMonths) gateOpen = true;
    const available = operatingProfit - loanRepayment - inp.pay.retention;
    const pay = gateOpen ? salaryFor(available, inp.pay) : { salary: 0, cost: 0 };
    why.pay = !gateOpen
      ? `No pay: Winchester has not yet made a profit for ${inp.pay.gateMonths} months running`
      : available <= 0
        ? `No pay: profit after loan repayments ${gbp(operatingProfit - loanRepayment)} is not above the ${gbp(inp.pay.retention)} the business keeps`
        : `Salary ${gbp(pay.salary)} (company cost ${gbp(pay.cost)} with employer NI) from the ${gbp(available)} above the ${gbp(inp.pay.retention)} retained, capped at ${gbp(inp.pay.capMonthly)}`;

    // Card
    const projCard = inp.projectPayments.filter(p => p.month === ym && p.method === "card");
    const oneOffCard = oneOffs.filter(o => o.method === "card");
    const cardFundedCosts = (marketingOnCard ? marketing : 0) + oneOffCard.filter(o => o.pnl).reduce((s, o) => s + o.amount, 0);
    const cardDrawn = projCard.reduce((s, p) => s + p.amountExVat, 0) + cardFundedCosts + oneOffCard.filter(o => !o.pnl).reduce((s, o) => s + o.amount, 0);
    const cardRepayment = draws.reduce((s, d) => { const k = monthsBetween(d.month, ym); return s + (k >= 1 && k <= inp.card.repayMonths ? d.amount / inp.card.repayMonths : 0); }, 0);
    if (cardDrawn) draws.push({ month: ym, amount: cardDrawn });
    const prevOwed = rows.length ? rows[rows.length - 1].cardOwed : 0;
    const cardOwed = prevOwed + cardDrawn - cardRepayment;
    why.cardDrawn = [...projCard.map(p => `${p.label} ${gbp(p.amountExVat)}`), ...(marketingOnCard ? [`marketing ${gbp(marketing)}`] : []), ...oneOffCard.map(o => `${o.label} ${gbp(o.amount)}`)].join("; ") || "Nothing put on the card";
    why.cardRepayment = `1/${inp.card.repayMonths} of each earlier draw, from the month after it`;

    // Bank
    const projBank = inp.projectPayments.filter(p => p.month === ym && p.method === "bank");
    const projectBank = projBank.reduce((s, p) => s + p.amountExVat, 0) + oneOffs.filter(o => o.method === "bank" && !o.pnl).reduce((s, o) => s + o.amount, 0);
    why.projectBank = projBank.map(p => `${p.label} ${gbp(p.amountExVat)}`).join("; ") || "No project payments from the bank";
    const rentPaid = rentPaidMap[ym] ?? 0;
    why.rentPaid = rentPaid ? `Quarterly in advance on the quarter day (${gbp(rentPaid)})` : "No rent payment falls in this month";
    const funding = inp.funding.filter(f => f.month === ym);
    const fundingIn = funding.reduce((s, f) => s + f.amount, 0) + loanDrawn;
    why.fundingIn = [...funding.map(f => `${f.label} ${gbp(f.amount)} (${f.kind})`), ...(loanDrawn ? [why.loanDrawn] : [])].join("; ") || "No funding in";

    const bankRunning = utilities + general + (marketingOnCard ? 0 : marketing) + oneOffs.filter(o => o.pnl && o.method === "bank").reduce((s, o) => s + o.amount, 0);
    const moneyIn = fundingIn + total.contribution;
    const moneyOutBank = projectBank + rentPaid + rates + bankRunning + loanRepayment + cardRepayment + pay.cost;
    const openingBank = bank;
    bank = openingBank + moneyIn - moneyOutBank;
    why.moneyOutBank = `Project ${gbp(projectBank)}, rent ${gbp(rentPaid)}, rates ${gbp(rates)}, running ${gbp(bankRunning)}, loan ${gbp(loanRepayment)}, card ${gbp(cardRepayment)}, Abi ${gbp(pay.cost)}`;

    rows.push({
      month: ym, label: label(ym), fy: fyOf(ym),
      bedh, winc, total,
      running: { utilities, general, marketing, oneOff: oneOffPnl, total: runningTotal },
      rentAccrued, rates, operatingProfit, wincOwnProfit, bedhOwnProfit,
      bedhOpen: bedh.gross > 0, wincDemand, wincCapacity: wincCapacity == null || wincCapacity === Infinity ? null : wincCapacity, switchGain, switchLoss,
      payGate: gateOpen, paySalary: pay.salary, payCost: pay.cost, profitRetained: operatingProfit - pay.cost,
      openingBank, fundingIn, loanDrawn, projectBank,
      cardDrawn, cardFundedCosts, cardRepayment, cardOwed,
      loanRepayment, loanInterest, loanOwed,
      rentPaid, rentTiming: rentAccrued - rentPaid,
      moneyIn, moneyOutBank, net: moneyIn - moneyOutBank, closingBank: bank,
      belowFloor: bank < inp.cashFloor, cardOverLimit: cardOwed > inp.card.limit,
      why,
    });
  }

  // Financial-year totals (flows summed, balances taken at the year's last month)
  const flows: (keyof CashRow)[] = ["operatingProfit", "payCost", "profitRetained", "fundingIn", "projectBank", "cardDrawn", "cardRepayment", "loanRepayment", "rentPaid", "rentAccrued", "rates", "moneyIn", "moneyOutBank", "net"];
  const fyTotals: CashResult["fyTotals"] = {};
  for (const r of rows) {
    const t = (fyTotals[r.fy] ??= {});
    for (const k of flows) (t as any)[k] = ((t as any)[k] ?? 0) + (r[k] as number);
    (t as any).grossBedh = ((t as any).grossBedh ?? 0) + r.bedh.gross;
    (t as any).grossWinc = ((t as any).grossWinc ?? 0) + r.winc.gross;
    (t as any).vat = ((t as any).vat ?? 0) + r.total.vat;
    (t as any).contribution = ((t as any).contribution ?? 0) + r.total.contribution;
    (t as any).runningTotal = ((t as any).runningTotal ?? 0) + r.running.total;
    (t as any).closingBank = r.closingBank; (t as any).cardOwed = r.cardOwed; (t as any).loanOwed = r.loanOwed;
  }

  // Checks (sanity checks 1 and 6)
  const checks: CashCheck[] = [];
  let prevClose = inp.openingBank, prevCard = 0, rollOk = true, cardOk = true, vatOk = true;
  for (const r of rows) {
    if (Math.abs(prevClose + r.moneyIn - r.moneyOutBank - r.closingBank) > 0.01) rollOk = false;
    if (Math.abs(prevCard + r.cardDrawn - r.cardRepayment - r.cardOwed) > 0.01) cardOk = false;
    const expect = (r.bedh.gross + r.winc.gross) * inp.vatRate / (1 + inp.vatRate);
    if (Math.abs(r.total.vat - expect) > 0.01) vatOk = false;
    prevClose = r.closingBank; prevCard = r.cardOwed;
  }
  checks.push({ name: "Bank rolls forward", pass: rollOk, detail: "opening + money in - money out = closing, every month" });
  checks.push({ name: "Card rolls forward", pass: cardOk, detail: "owed last month + drawn - repaid = owed, every month" });
  checks.push({ name: "VAT on sales is 1/6 of gross at both sites", pass: vatOk, detail: "standard-rated at 20% from August 2026" });
  const cashFlowTie = rows.every(r => Math.abs(r.openingBank + r.operatingProfit + r.fundingIn - r.projectBank + r.cardFundedCosts - r.cardRepayment - r.loanRepayment + r.rentTiming - r.payCost - r.closingBank) < 0.01);
  checks.push({ name: "Cash flow ties to profit", pass: cashFlowTie, detail: "opening + operating profit + funding - project - card repayments + card-funded costs - loan + rent timing - pay = closing" });
  const under = rows.filter(r => r.belowFloor).map(r => r.label);
  checks.push({ name: `Bank stays above the ${gbp(inp.cashFloor)} floor`, pass: under.length === 0, detail: under.length ? `Below in ${under.join(", ")}` : "Never below" });
  const over = rows.filter(r => r.cardOverLimit).map(r => r.label);
  checks.push({ name: `Card stays within the ${gbp(inp.card.limit)} limit`, pass: over.length === 0, detail: over.length ? `Over in ${over.join(", ")}` : "Always within" });

  const low = rows.reduce((a, r) => (r.closingBank < a.bank ? { month: r.label, bank: r.closingBank } : a), { month: "", bank: Infinity });
  return { rows, fyTotals, checks, lowest: low };
}
