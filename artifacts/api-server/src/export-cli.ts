// Exports ALFRED's cash model for the clinic repo's 12 month model (ops/model/README.md): the same
// buildCashModel every money screen reads, so the exported model never holds its own copy of a
// figure. Refuses when the typed bank balance is over 7 days old, unless --allow-stale.
// Run: node --env-file=../../.env dist/export-cli.mjs <path to cash-model-export.json> [--allow-stale]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildCashModel } from "./routes/cash-model";
import { STANDS_ALONE_TAKINGS, WINC_KEEP_PCT } from "./lib/cash-model-defaults";

const [out, flag] = process.argv.slice(2);
if (!out) { console.error("Give the path to cash-model-export.json"); process.exit(1); }

(async () => {
  const J: any = await buildCashModel(1, { scenario: "central", months: 24 });
  const bank = J.bank;
  if (bank) {
    const age = (Date.now() - Date.parse(bank.asAt + "T12:00:00Z")) / 86400000;
    if (age > 7 && flag !== "--allow-stale") { console.error(`Refused: the bank balance is ${Math.floor(age)} days old (${bank.asAt}). Update it, or pass --allow-stale.`); process.exit(2); }
  }
  const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const fromMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()).slice(0, 7);
  const rows = (J.rows ?? []).filter((r: any) => r.month >= fromMonth).slice(0, 13).map((r: any) => ({
    month: r.month, bedhGross: Math.round(r.bedh?.gross ?? 0), wincGross: Math.round(r.winc?.gross ?? 0), wincCapacity: r.wincCapacity ?? null, wincOccupancy: r.wincOccupancy ?? null,
    bedhDays: r.bedhDays ?? null, wincDays: r.wincDays ?? null, marketing: Math.round(r.running?.marketing ?? 0), rentPaid: Math.round(r.rentPaid ?? 0), rates: Math.round(r.rates ?? 0),
    operatingProfit: Math.round(r.operatingProfit ?? 0), wincStandMargin: Math.round(r.wincStandMargin ?? 0), buildVatPaid: Math.round((r.vatPaidBank ?? 0) + (r.vatPaidCard ?? 0)), buildVatRefund: Math.round(r.vatRefund ?? 0),
    fundingIn: Math.round(r.fundingIn ?? 0), loanDrawn: Math.round(r.loanDrawn ?? 0), loanRepayment: Math.round(r.loanRepayment ?? 0), loanOwed: Math.round(r.loanOwed ?? 0),
    projectPaidFromBank: Math.round(r.projectBank ?? 0), cardRepayment: Math.round(r.cardRepayment ?? 0), cardOwed: Math.round(r.cardOwed ?? 0), abiPayCost: Math.round(r.payCost ?? 0),
    openingBank: Math.round(r.openingBank ?? 0), closingBank: Math.round(r.closingBank ?? 0), belowFloor: !!r.belowFloor,
  }));
  const low = rows.reduce((a: any, r: any) => (!a || r.closingBank < a.bank ? { month: (J.rows.find((x: any) => x.month === r.month)?.label) ?? r.month, bank: r.closingBank } : a), null);
  const first = J.rows.find((r: any) => (r.payCost ?? 0) > 0);
  const available = J.availableLoans?.[0];
  const doc = {
    ...prev,
    _note: "Export of the ALFRED cash model (Clinic-Launch artifacts/api-server/src/export-cli.ts, from buildCashModel, the same function every money screen reads). Input to ops/model/build.js. The owner's decisions of 15 Nov 2026 (Bedhampton one day a week from December, ad spend from the ads plan, the 13,000 loan undated) are now in the model itself, so rerun repeats the main forecast.",
    exportedIso: new Date().toISOString(),
    exportedBy: "scripts/export-cash-model.mjs",
    scenario: "central (Recommended)",
    startMonth: J.config?.startMonth,
    bank: bank ? { balanceGbp: bank.balanceGbp, asAt: bank.asAt, typed: true, fundingTickedAsInBalance: bank.inBalance ?? [], accounts: J.bankAccounts ?? null } : null,
    lowest: low, firstPayMonth: first?.label ?? null, cashFloor: J.config?.cashFloor, standsAloneTakings: STANDS_ALONE_TAKINGS, wincKeepPct: WINC_KEEP_PCT,
    loan: available ? { principal: available.principal, drawMonth: null, annualRatePct: available.annualRatePct, repayments: available.repayments, status: "available, not drawn (owner, 15 Nov 2026)" } : prev.loan,
    marketingByMonth: J.marketingByMonth ?? null,
    rows,
  };
  // The owner's decisions are in the model itself now, so the "decisions applied" re-run is the same
  // forecast; it is kept in the shape ops/model/build.js reads.
  const same = { lowest: low, firstPayMonth: first?.label ?? null, rows };
  (doc as any).rerun = { _note: "Identical to the main forecast: the owner's decisions of 15 Nov 2026 are saved in the model.", oneDay: same, oneDayAdsPlan: same };
  const text = JSON.stringify(doc, null, 2) + "\n";
  if (/[\u2013\u2014]/.test(text)) { console.error("Refused: the export contains an em or en dash"); process.exit(1); }
  writeFileSync(out, text);
  console.log(`Exported: bank ${bank?.balanceGbp} at ${bank?.asAt}; lowest ${low?.month} ${low?.bank}; first pay ${first?.label ?? "none"}`);
  process.exit(0);
})().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
