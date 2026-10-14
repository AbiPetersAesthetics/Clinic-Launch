// Owed to directors: everything a director paid personally for the business (on a personal
// card, or from a personal bank account), which the company owes back on their director's
// loan account. For each: the VAT to reclaim, the proof in hand, whether it is in the
// company's books yet, and when the company paid it back. The entries are the ones on the
// personal accounts in Credit Cards; this page only adds the admin to them.
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";
const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

type Receipt = "none" | "receipt" | "vat_invoice" | "invoice_no_vat";
type CardRow = { id: number; name: string; holder: string | null; account: "business" | "personal"; status: string; last4: string | null; creditLimitGbp: number };
type Entry = { id: number; cardId: number; date: string; kind: string; description: string; amountGbp: number; taskId: number | null; note: string | null; vatGbp: number | null; receipt: Receipt; booked: boolean; repaidDate: string | null };
type CardsData = { cards: CardRow[]; entries: Entry[]; lineTitles?: Record<string, string> };
type Patch = Partial<Pick<Entry, "vatGbp" | "receipt" | "booked" | "repaidDate">>;

const RECEIPTS: { value: Receipt; label: string }[] = [
  { value: "none", label: "Nothing yet" },
  { value: "receipt", label: "Receipt or order email" },
  { value: "vat_invoice", label: "VAT invoice" },
  { value: "invoice_no_vat", label: "Invoice, no VAT" },
];
const isCard = (c: CardRow) => !!c.last4 || (c.creditLimitGbp ?? 0) > 0 || /card/i.test(c.name);
// "Credit card: Virgin Money, ending 6965" or "Current account: Monzo", the account's own name trimmed of the owner.
const methodOf = (c: CardRow) => {
  const name = c.name.replace(/^[A-Z][a-z]+:\s*/, "").replace(/\s*\(director's loan\)\s*/i, "").trim();
  return isCard(c) ? { kind: "Credit card", detail: name.replace(/\s*credit card$/i, "") + (c.last4 ? `, ending ${c.last4}` : "") } : { kind: "Current account", detail: name.replace(/^personal current account\s*/i, "").replace(/^\((.*)\)$/, "$1") || "personal" };
};
const methodText = (c: CardRow) => { const m = methodOf(c); return m.kind + ": " + m.detail; };
const gbp = (v: number) => `${v < 0 ? "−" : ""}£${Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
// A purchase is owed to the director; a refund back to them reduces it.
const owedOf = (e: Entry) => (e.kind === "refund" ? -e.amountGbp : e.amountGbp);
const vatOf = (e: Entry) => (e.kind === "refund" ? -(e.vatGbp ?? 0) : e.vatGbp ?? 0);

async function send(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

export default function OwedPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["cards", PROJECT_ID];
  const { data, isLoading, error } = useQuery<CardsData>({ queryKey: key, queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/cards`).then(r => r.json()) });
  const patch = useMutation({
    mutationFn: ({ id, b }: { id: number; b: Patch }) => send(`/projects/${PROJECT_ID}/card-entries/${id}`, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" }),
  });
  const [show, setShow] = useState<"owed" | "repaid" | "all">("owed");
  const [guide, setGuide] = useState(false);

  // Personal accounts only: what the business owes back. Business cards are the company's own debt.
  const personal = useMemo(() => (data?.cards ?? []).filter(c => c.account === "personal"), [data]);
  const byCard = new Map(personal.map(c => [c.id, c]));
  const rows = useMemo(() => (data?.entries ?? []).filter(e => byCard.has(e.cardId) && (e.kind === "purchase" || e.kind === "refund"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id), [data, personal]);
  const holders = [...new Set(personal.map(c => c.holder || "A director"))];
  const titles = data?.lineTitles ?? {};

  const open = rows.filter(e => !e.repaidDate);
  const owed = open.reduce((s, e) => s + owedOf(e), 0);
  const repaid = rows.filter(e => e.repaidDate).reduce((s, e) => s + owedOf(e), 0);
  const vatReady = rows.filter(e => e.receipt === "vat_invoice").reduce((s, e) => s + vatOf(e), 0);
  const vatWaiting = rows.filter(e => e.receipt !== "vat_invoice" && e.receipt !== "invoice_no_vat" && (e.vatGbp ?? 0) > 0).reduce((s, e) => s + vatOf(e), 0);
  const vatUnknown = rows.filter(e => e.vatGbp == null && e.receipt !== "invoice_no_vat").length;
  const unbooked = rows.filter(e => !e.booked);
  const shown = rows.filter(e => show === "all" ? true : show === "owed" ? !e.repaidDate : !!e.repaidDate);

  const download = () => {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ["Date", "Supplier and item", "Paid with", "Director", "Plan line", "Amount inc VAT", "VAT", "Net of VAT", "Proof", "In the books", "Paid back on"];
    const lines = rows.map(e => { const c = byCard.get(e.cardId)!; const vat = e.vatGbp ?? 0;
      return [e.date, q(e.description), q(methodText(c)), q(c.holder || ""), q(e.taskId != null ? titles[e.taskId] ?? "" : ""), owedOf(e).toFixed(2), (e.kind === "refund" ? -vat : vat).toFixed(2), (owedOf(e) - (e.kind === "refund" ? -vat : vat)).toFixed(2), q(RECEIPTS.find(r => r.value === e.receipt)?.label ?? ""), e.booked ? "Yes" : "No", e.repaidDate ?? ""].join(","); });
    const blob = new Blob([[head.join(","), ...lines].join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `owed-to-directors-${iso(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Owed to directors" subtitle={`What ${holders.join(" and ") || "a director"} paid personally for the business, which the company owes back (the director's loan): the VAT to reclaim, the proof in hand, whether it is in the company's books, and what has been paid back.`}
        action={<Button type="button" variant="outline" size="sm" onClick={download} disabled={!rows.length}><Download className="w-4 h-4 mr-1.5" />Download for the accountant</Button>} />

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700">Could not load: {(error as Error).message}</CardContent></Card>}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="The company owes" value={gbp(owed)} sub={`${open.length} ${open.length === 1 ? "item" : "items"} not yet paid back${repaid > 0.005 ? `; ${gbp(repaid)} paid back so far` : ""}`} />
          <Tile label="VAT to reclaim now" value={gbp(vatReady)} sub="on VAT invoices in hand: goes on the next VAT return" />
          <Tile label="VAT waiting on proof" value={gbp(vatWaiting)} sub={vatWaiting > 0.005 ? "ask the supplier for a VAT invoice in the company's name" : "nothing waiting"} tone={vatWaiting > 0.005 ? "warn" : undefined} />
          <Tile label="Not in the books yet" value={String(unbooked.length)} sub={unbooked.length ? `${gbp(unbooked.reduce((s, e) => s + owedOf(e), 0))} to record with the company` : "all recorded"} tone={unbooked.length ? "warn" : undefined} />
        </div>
      )}

      {data && personal.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><h2 className="text-lg font-semibold" style={SERIF}>Still owed, by how it was paid</h2></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {personal.map(c => { const mine = open.filter(e => e.cardId === c.id); const m = methodOf(c);
              return (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{m.kind}</div>
                  <div className="text-sm font-medium">{m.detail}</div>
                  <div className="text-xs text-muted-foreground">{c.holder || "A director"}</div>
                  <div className="text-xl font-semibold tabular-nums mt-1">{gbp(mine.reduce((t, e) => t + owedOf(e), 0))}</div>
                  <div className="text-xs text-muted-foreground">{mine.length} {mine.length === 1 ? "item" : "items"} not yet paid back</div>
                </div>
              ); })}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button type="button" className="flex items-center justify-between gap-3 text-left w-full" onClick={() => setGuide(g => !g)} aria-expanded={guide}>
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>How to record this with the company</h2>
            {guide ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
          </button>
          {!guide && <p className="text-xs text-muted-foreground">Five steps, once a month. Open for the detail.</p>}
        </CardHeader>
        {guide && (
          <CardContent className="text-sm space-y-3 max-w-4xl leading-relaxed">
            <Step n={1} title="Keep the proof, in the company's name">For each item, keep the receipt or invoice. Over £250, it must be a full VAT invoice addressed to Abi Peters Aesthetics Ltd (VAT number GB 523 3501 30), or the VAT cannot be reclaimed. Set the Proof column as each one arrives; anything still on "Nothing yet" or "Receipt" with VAT on it needs chasing.</Step>
            <Step n={2} title="Send the month's list to the accountant">Once a month, click Download for the accountant and send the file with the receipts to Mark Wolfe & Co. It is your expense claim: what you paid, when, the VAT and what it was for. Ask them which way they want it each month and whether the company keeps its books in software (Xero, QuickBooks, FreeAgent); if it does, the list goes in as expenses paid by a director.</Step>
            <Step n={3} title="How it is recorded">Each item goes into the company's books as its own cost (furniture and fit-out as assets, consumables as expenses), with the VAT as VAT to reclaim, and the full amount owed to you on your director's loan account. Tick In the books once that is done. A company owing its director money is fine: no tax, no interest needed.</Step>
            <Step n={4} title="Reclaim the VAT">The VAT goes on the company's monthly VAT return for the month on the invoice, whether or not you have been paid back. The VAT to reclaim now figure is what is ready to go on.</Step>
            <Step n={5} title="Pay yourself back">When the cash allows, transfer the amount from the business bank to your own account, referenced "Director's loan repayment", and fill in Paid back on for the items it covers. The repayment is not salary, so there is no tax or National Insurance on it. Then update Bank today on <Link href="/financials" className="underline">Money</Link>.</Step>
            <p className="text-xs text-muted-foreground">Confirm the treatment with the accountant; this is the usual approach, not advice for the company's own position.</p>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>Everything paid personally</h2>
            <div className="flex gap-1" role="group" aria-label="Show">
              {([["owed", "Still owed"], ["repaid", "Paid back"], ["all", "All"]] as const).map(([v, l]) => (
                <Button key={v} type="button" size="sm" variant={show === v ? "default" : "outline"} className="h-8" aria-pressed={show === v} onClick={() => setShow(v)}>{l}</Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">From the personal accounts in <Link href="/cards" className="underline">Credit Cards</Link>. To add something, add it there as a charge on the card or account it was paid from.</p>
        </CardHeader>
        <CardContent>
          {!shown.length ? <p className="text-sm text-muted-foreground">{rows.length ? "Nothing here with this filter." : "Nothing paid personally yet."}</p> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">Items paid personally for the business</caption>
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-3 py-2">Date</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">What</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Paid with</th>
                    <th scope="col" className="text-right font-medium px-3 py-2">Amount</th>
                    <th scope="col" className="text-right font-medium px-3 py-2">VAT</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Proof</th>
                    <th scope="col" className="text-center font-medium px-3 py-2">In the books</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Paid back on</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shown.map(e => <Row key={e.id} e={e} card={byCard.get(e.cardId)!} line={e.taskId != null ? titles[e.taskId] : undefined} onPatch={b => patch.mutate({ id: e.id, b })} />)}
                </tbody>
                <tfoot className="bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>{shown.length} {shown.length === 1 ? "item" : "items"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{gbp(shown.reduce((s, e) => s + owedOf(e), 0))}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{gbp(shown.reduce((s, e) => s + vatOf(e), 0))}</td>
                    <td colSpan={3} className="px-3 py-2 text-xs font-normal text-muted-foreground">{vatUnknown ? `${vatUnknown} with the VAT not entered yet` : ""}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <Card className="shadow-sm"><CardContent className="p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums leading-tight mt-0.5 ${tone === "warn" ? "text-amber-700" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2">
      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">{n}</span>
      <div><div className="font-semibold">{title}</div><div className="text-muted-foreground">{children}</div></div>
    </div>
  );
}

function Row({ e, card, line, onPatch }: { e: Entry; card: CardRow; line?: string; onPatch: (b: Patch) => void }) {
  const [vat, setVat] = useState(e.vatGbp == null ? "" : String(e.vatGbp));
  const saveVat = () => { const v = vat.trim() === "" ? null : Math.round(Number(vat) * 100) / 100; if (v !== null && !Number.isFinite(v)) return; if (v !== e.vatGbp) onPatch({ vatGbp: v }); };
  const needsVatInvoice = e.receipt !== "vat_invoice" && e.receipt !== "invoice_no_vat" && (e.vatGbp ?? 0) > 0 && e.amountGbp > 250;
  return (
    <tr className="align-top hover:bg-muted/20">
      <td className="px-3 py-2 whitespace-nowrap">{longDate(e.date)}</td>
      <td className="px-3 py-2 min-w-[220px]">
        <div className="font-medium">{e.description}{e.kind === "refund" ? " (refund)" : ""}</div>
        {line && <div className="text-xs text-muted-foreground">{line}</div>}
      </td>
      <td className="px-3 py-2 min-w-[150px]">
        {(() => { const m = methodOf(card); return (<>
          <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${m.kind === "Credit card" ? "bg-primary text-primary-foreground" : "border border-primary/40 text-primary"}`}>{m.kind}</span>
          <div className="text-xs mt-0.5">{m.detail}</div>
        </>); })()}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{gbp(owedOf(e))}</td>
      <td className="px-3 py-1.5 text-right">
        <Input type="number" min={0} step="0.01" value={vat} onChange={ev => setVat(ev.target.value)} onBlur={saveVat} onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
          aria-label={`VAT on ${e.description}`} placeholder="?" className="h-8 w-24 ml-auto text-right tabular-nums" disabled={e.receipt === "invoice_no_vat"} />
      </td>
      <td className="px-3 py-1.5 min-w-[190px]">
        <Select value={e.receipt} onValueChange={v => onPatch(v === "invoice_no_vat" ? { receipt: v as Receipt, vatGbp: 0 } : { receipt: v as Receipt })}>
          <SelectTrigger className={`h-8 text-xs ${needsVatInvoice ? "border-amber-400" : ""}`} aria-label={`Proof for ${e.description}`}><SelectValue /></SelectTrigger>
          <SelectContent>{RECEIPTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        {needsVatInvoice && <div className="text-[11px] text-amber-800 mt-1">Over £250: needs a VAT invoice to the company</div>}
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={e.booked} onChange={ev => onPatch({ booked: ev.target.checked })} aria-label={`${e.description} is in the company's books`} />
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Input type="date" value={e.repaidDate ?? ""} onChange={ev => onPatch({ repaidDate: ev.target.value || null })} className="h-8 w-[140px] text-xs" aria-label={`Paid back on, ${e.description}`} />
          {!e.repaidDate && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onPatch({ repaidDate: iso(new Date()) })}>Today</Button>}
        </div>
      </td>
    </tr>
  );
}
