// Credit cards: the register of the cards the build goes on and what is on each one,
// against its limit and its 0% dates, with the plan lines that are due to go on a card.
// Only the last four digits of a card are kept; the API refuses anything longer.
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Pencil, CreditCard as CardIcon, ShieldCheck } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";
const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

type OfferKind = "purchases" | "balance transfers" | "money transfers";
type Offer = { kind: OfferKind; ratePct: number; start: string | null; end: string; feePct: number | null };
type CardRow = {
  id: number; name: string; holder: string | null; account: "business" | "personal"; last4: string | null;
  creditLimitGbp: number; aprPct: number | null; offers: Offer[]; minPaymentPct: number | null; minPaymentFloorGbp: number | null;
  statementDay: number | null; dueDay: number | null; directDebit: "none" | "minimum" | "fixed" | "full"; directDebitGbp: number | null;
  notes: string | null; status: "open" | "closed"; sortOrder: number;
};
type EntryKind = "opening" | "purchase" | "transfer" | "fee" | "interest" | "payment" | "refund";
type Entry = { id: number; cardId: number; date: string; kind: EntryKind; description: string; amountGbp: number; taskId: number | null; note: string | null };
type Planned = { taskId: number; title: string; phase: string; planStatus: "paid" | "part-paid" | "unpaid"; grossGbp: number; parts: { month: string; amountGbp: number }[]; cardGbp: number };
type CardsData = { cards: CardRow[]; entries: Entry[]; planned: Planned[] };
type CardBody = Record<string, unknown>;
type EntryBody = { date: string; kind: EntryKind; description: string; amountGbp: number; taskId: number | null };

const OFFER_KINDS: OfferKind[] = ["purchases", "balance transfers", "money transfers"];
const ENTRY_KINDS: { value: EntryKind; label: string }[] = [
  { value: "purchase", label: "Purchase" },
  { value: "payment", label: "Payment" },
  { value: "refund", label: "Refund" },
  { value: "transfer", label: "Balance transfer" },
  { value: "fee", label: "Fee" },
  { value: "interest", label: "Interest" },
  { value: "opening", label: "Balance brought forward" },
];
const KIND_LABEL = Object.fromEntries(ENTRY_KINDS.map(k => [k.value, k.label])) as Record<EntryKind, string>;
const CREDITS = new Set<EntryKind>(["payment", "refund"]);
const signed = (e: Entry) => (CREDITS.has(e.kind) ? -e.amountGbp : e.amountGbp);
// A plan title as this page shows it: a spaced dash between words becomes a colon.
const SPACED_DASH = new RegExp(` +[-${String.fromCharCode(0x2013, 0x2014)}] +`, "g");
const tidy = (title: string) => title.replace(SPACED_DASH, ": ");

const gbp = (v: number, pence = false) => `${v < 0 ? "−" : ""}£${Math.abs(v).toLocaleString("en-GB", pence ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
const asDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s: string) => asDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthName = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
function daysUntil(s: string) { const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((asDate(s).getTime() - now.getTime()) / 86400000); }
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
// The next date this day of the month falls on, today included; short months use their last day.
function nextOnDay(dayOfMonth: number) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let k = 0; k < 2; k++) {
    const last = new Date(now.getFullYear(), now.getMonth() + k + 1, 0).getDate();
    const d = new Date(now.getFullYear(), now.getMonth() + k, Math.min(dayOfMonth, last));
    if (d >= now) return iso(d);
  }
  return iso(now);
}

// What a card stands at: balance and room left; for each running 0% offer, what sits
// under it and what clearing that before it ends would take; and the minimum payment
// from the card's rule. Transfers sit under a transfer offer and everything else under
// the purchase offer; payments go to whichever offer ends first, as a careful payer
// would. A card with one offer running counts its whole balance under it.
function statsFor(card: CardRow, entries: Entry[]) {
  const mine = entries.filter(e => e.cardId === card.id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const sum = (f: (e: Entry) => boolean) => mine.filter(f).reduce((t, e) => t + e.amountGbp, 0);
  const balance = Math.round(mine.reduce((s, e) => s + signed(e), 0) * 100) / 100;
  const limit = card.creditLimitGbp || 0;
  const live = card.offers.filter(o => daysUntil(o.end) >= 0).sort((a, b) => a.end.localeCompare(b.end));
  const buckets = { purchases: Math.max(0, sum(e => !CREDITS.has(e.kind) && e.kind !== "transfer") - sum(e => e.kind === "refund")), transfers: sum(e => e.kind === "transfer") };
  const endOf = (b: "purchases" | "transfers") => live.find(o => (b === "purchases") === (o.kind === "purchases"))?.end ?? "9999-12-31";
  let paid = sum(e => e.kind === "payment");
  for (const b of (["purchases", "transfers"] as const).slice().sort((x, y) => endOf(x).localeCompare(endOf(y)))) { const take = Math.min(buckets[b], paid); buckets[b] -= take; paid -= take; }
  const plans = live.map(offer => {
    const days = daysUntil(offer.end);
    const months = Math.max(1, Math.floor(days / 30.44));
    const under = Math.round(Math.max(0, live.length === 1 ? balance : offer.kind === "purchases" ? buckets.purchases : buckets.transfers) * 100) / 100;
    return { offer, days, months, under, perMonth: under > 0 ? Math.ceil(under / months) : 0 };
  });
  const next = plans[0] ?? null;
  const ruleSet = card.minPaymentPct != null || card.minPaymentFloorGbp != null;
  const minimum = !ruleSet ? null : balance <= 0 ? 0 : Math.min(balance, Math.max(card.minPaymentFloorGbp ?? 0, (balance * (card.minPaymentPct ?? 0)) / 100));
  return { mine, balance, limit, available: limit - balance, used: limit > 0 ? balance / limit : 0, plans, next, minimum, due: card.dueDay ? nextOnDay(card.dueDay) : null };
}
type Stats = ReturnType<typeof statsFor>;

async function send(method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

export default function CardsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["cards", PROJECT_ID];
  const { data, isLoading, error } = useQuery<CardsData>({ queryKey: key, queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/cards`).then(r => r.json()) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });
  const base = `/projects/${PROJECT_ID}`;
  const addCard = useMutation({ mutationFn: (b: CardBody) => send("POST", `${base}/cards`, b) as Promise<CardRow>, onSuccess: refresh, onError: fail });
  const patchCard = useMutation({ mutationFn: ({ id, b }: { id: number; b: CardBody }) => send("PATCH", `${base}/cards/${id}`, b), onSuccess: refresh, onError: fail });
  const removeCard = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/cards/${id}`), onSuccess: refresh, onError: fail });
  const addEntry = useMutation({ mutationFn: ({ cardId, b }: { cardId: number; b: EntryBody }) => send("POST", `${base}/cards/${cardId}/entries`, b), onSuccess: refresh, onError: fail });
  const patchEntry = useMutation({ mutationFn: ({ id, b }: { id: number; b: Partial<EntryBody> & { cardId?: number } }) => send("PATCH", `${base}/card-entries/${id}`, b), onSuccess: refresh, onError: fail });
  const removeEntry = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/card-entries/${id}`), onSuccess: refresh, onError: fail });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const cards = data?.cards ?? [], entries = data?.entries ?? [], planned = data?.planned ?? [];
  const ordered = useMemo(() => [...cards.filter(c => c.status === "open"), ...cards.filter(c => c.status === "closed")], [cards]);
  const stats = useMemo(() => new Map(ordered.map(c => [c.id, statsFor(c, entries)])), [ordered, entries]);
  const selected = ordered.find(c => c.id === selectedId) ?? ordered[0] ?? null;
  const showForm = adding || (!isLoading && !error && cards.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Credit Cards" subtitle="What is on each card, against its limit and its 0% dates." />

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the cards…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700">Could not load the cards: {(error as Error).message}</CardContent></Card>}

      {ordered.length > 0 && <Totals cards={ordered.filter(c => c.status === "open")} stats={stats} />}

      {!isLoading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map(c => <CardFace key={c.id} card={c} s={stats.get(c.id)!} selected={!showForm && selected?.id === c.id} onSelect={() => { setSelectedId(c.id); setAdding(false); }} />)}
          <button type="button" onClick={() => setAdding(true)} aria-expanded={showForm}
            className="min-h-[196px] rounded-2xl border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="w-5 h-5" />Add a card
          </button>
        </div>
      )}

      {showForm && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>Add a card</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" />Only the last four digits of the card. Never the full number, the expiry date or the security code.</p>
          </CardHeader>
          <CardContent>
            <CardForm creating onSubmit={b => addCard.mutate(b, { onSuccess: c => { setAdding(false); setSelectedId(c.id); } })} onCancel={cards.length ? () => setAdding(false) : undefined} />
          </CardContent>
        </Card>
      )}

      {!showForm && selected && (
        <CardDetail key={selected.id} card={selected} s={stats.get(selected.id)!} planned={planned}
          onPatchCard={b => patchCard.mutate({ id: selected.id, b })}
          onRemoveCard={() => removeCard.mutate(selected.id, { onSuccess: () => setSelectedId(null) })}
          onAddEntry={b => addEntry.mutate({ cardId: selected.id, b })}
          onPatchEntry={(id, b) => patchEntry.mutate({ id, b })}
          onRemoveEntry={id => removeEntry.mutate(id)} />
      )}

      {data && <FromThePlan planned={planned} entries={entries} cards={ordered.filter(c => c.status === "open")} onRecord={(cardId, p, amount) => addEntry.mutate({ cardId, b: { date: todayIso(), kind: "purchase", description: tidy(p.title), amountGbp: amount, taskId: p.taskId } })} />}

      <p className="text-xs text-muted-foreground max-w-4xl leading-relaxed">
        Balances are what is recorded here: the balance brought forward, plus purchases, transfers, fees and interest, less payments and refunds. The minimum payment is an estimate from the card's rule; the statement is the authority. The plan lines below are the ones whose payment plan in <Link href="/project" className="underline">Plan & Timeline</Link> says card, at the figure the plan holds, VAT included where it is charged.
      </p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "bad" }) {
  const colour = tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "";
  return (
    <Card className="shadow-sm"><CardContent className="p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums leading-tight mt-0.5 ${colour}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}

function Totals({ cards, stats }: { cards: CardRow[]; stats: Map<number, Stats> }) {
  const all = cards.map(c => ({ c, s: stats.get(c.id)! }));
  const balance = all.reduce((t, x) => t + x.s.balance, 0);
  const limit = all.reduce((t, x) => t + x.s.limit, 0);
  const minimums = all.filter(x => x.s.minimum != null);
  const dues = all.map(x => x.s.due).filter((d): d is string => !!d).sort();
  const offers = all.flatMap(x => x.s.plans.map(p => ({ card: x.c.name, p }))).sort((a, b) => a.p.offer.end.localeCompare(b.p.offer.end));
  const nextOffer = offers.find(x => x.p.under > 0) ?? offers[0];
  const days = nextOffer ? nextOffer.p.days : null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile label="On the cards" value={gbp(balance)} sub={limit ? `of ${gbp(limit)} in limits` : "no limits set yet"} />
      <Tile label="Still available" value={gbp(limit - balance)} sub={limit ? `${Math.round((100 * balance) / limit)}% used` : undefined} tone={limit && balance / limit > 0.9 ? "bad" : undefined} />
      <Tile label="Minimum payments" value={minimums.length ? `about ${gbp(minimums.reduce((t, x) => t + (x.s.minimum ?? 0), 0))}` : "not set"} sub={dues.length ? `next due ${longDate(dues[0])}` : "add the due dates"} />
      <Tile label="Next 0% to end" value={nextOffer ? longDate(nextOffer.p.offer.end) : "none running"} sub={nextOffer ? `${nextOffer.card}, ${days} days${nextOffer.p.under > 0 ? `, ${gbp(nextOffer.p.under)} under it` : ", nothing under it"}` : undefined} tone={days != null && days <= 60 && nextOffer?.p.under ? "warn" : undefined} />
    </div>
  );
}

// The card as a card: name and holder, the last four digits, the balance against the
// limit, and the next 0% offer to end.
function CardFace({ card, s, selected, onSelect }: { card: CardRow; s: Stats; selected: boolean; onSelect: () => void }) {
  const closed = card.status === "closed";
  const used = Math.min(1, Math.max(0, s.used));
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`${card.name}: ${gbp(s.balance)} on the card`}
      className={`relative min-h-[196px] rounded-2xl p-5 text-left text-white flex flex-col justify-between gap-3 overflow-hidden shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-lg"} ${closed ? "opacity-60 grayscale" : ""}`}
      style={{ background: "linear-gradient(135deg, #1F2A44 0%, #2B3A56 55%, #445B72 100%)" }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 w-48 h-48 rounded-full bg-white/[0.06]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight truncate" style={SERIF}>{card.name}</div>
          <div className="text-[11px] text-white/70 truncate">{[card.holder, card.account === "personal" ? "Personal" : "Business"].filter(Boolean).join(" · ")}</div>
        </div>
        {closed ? <span className="shrink-0 text-[10px] uppercase tracking-wide bg-white/15 rounded px-1.5 py-0.5">Closed</span> : <CardIcon className="shrink-0 w-5 h-5 text-white/50" aria-hidden="true" />}
      </div>
      <div className="relative font-mono text-sm tracking-[0.25em] text-white/80">•••• {card.last4 ?? "····"}</div>
      <div className="relative space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/60">On the card</div>
            <div className="text-2xl font-semibold tabular-nums leading-none mt-0.5">{gbp(s.balance)}</div>
          </div>
          <div className="text-right text-[11px] text-white/70 tabular-nums leading-snug">{s.limit ? <>of {gbp(s.limit)}<br />{gbp(s.available)} free</> : "no limit set"}</div>
        </div>
        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className={`h-full rounded-full ${used > 0.9 ? "bg-rose-300" : used > 0.7 ? "bg-amber-200" : "bg-[#A7C0B6]"}`} style={{ width: `${(used * 100).toFixed(1)}%` }} /></div>
        <div className="text-[11px] text-white/80 truncate">{s.next ? `${s.next.offer.ratePct}% on ${s.next.offer.kind} until ${longDate(s.next.offer.end)}, ${s.next.days} days` : "No 0% offer running"}</div>
      </div>
    </button>
  );
}

function CardDetail({ card, s, planned, onPatchCard, onRemoveCard, onAddEntry, onPatchEntry, onRemoveEntry }: {
  card: CardRow; s: Stats; planned: Planned[];
  onPatchCard: (b: CardBody) => void; onRemoveCard: () => void;
  onAddEntry: (b: EntryBody) => void; onPatchEntry: (id: number, b: Partial<EntryBody>) => void; onRemoveEntry: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px]">
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>{card.name}</h2>
            <p className="text-xs text-muted-foreground">{[card.holder, card.account === "personal" ? "personal card" : "business card", card.last4 ? `ending ${card.last4}` : "ending not set", card.status === "closed" ? "closed" : null].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant={editing ? "default" : "outline"} className="h-8" onClick={() => setEditing(v => !v)}><Pencil className="w-3.5 h-3.5 mr-1.5" />{editing ? "Close the details" : "Edit the details"}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onPatchCard({ status: card.status === "open" ? "closed" : "open" })}>{card.status === "open" ? "Close the card" : "Reopen the card"}</Button>
            {s.mine.length === 0 && (confirm
              ? <Button type="button" size="sm" variant="destructive" className="h-8" onClick={onRemoveCard} onBlur={() => setConfirm(false)}>Sure? Delete it</Button>
              : <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setConfirm(true)}>Delete</Button>)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {editing && <div className="rounded-lg border bg-muted/30 p-4"><CardForm initial={card} onSubmit={b => { onPatchCard(b); setEditing(false); }} onCancel={() => setEditing(false)} /></div>}
        <Facts card={card} s={s} />
        <Ledger s={s} planned={planned} onAdd={onAddEntry} onPatch={onPatchEntry} onRemove={onRemoveEntry} />
      </CardContent>
    </Card>
  );
}

function Fact({ label, children, tone }: { label: string; children: ReactNode; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</dt>
      <dd className={`text-sm mt-0.5 ${tone === "warn" ? "text-amber-800" : ""}`}>{children}</dd>
    </div>
  );
}

function Facts({ card, s }: { card: CardRow; s: Stats }) {
  const rule = card.minPaymentPct != null || card.minPaymentFloorGbp != null
    ? [card.minPaymentPct != null ? `${card.minPaymentPct}% of the balance` : null, card.minPaymentFloorGbp != null ? `at least ${gbp(card.minPaymentFloorGbp)}` : null].filter(Boolean).join(", ")
    : null;
  const debit = card.directDebit === "minimum" ? "Pays the minimum" : card.directDebit === "full" ? "Pays the full balance" : card.directDebit === "fixed" ? `Pays ${card.directDebitGbp != null ? gbp(card.directDebitGbp, true) : "a fixed amount"} a month` : "None set up";
  const ended = card.offers.filter(o => daysUntil(o.end) < 0);
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 rounded-lg border p-4">
      <Fact label="On the card"><span className="text-lg font-semibold tabular-nums">{gbp(s.balance, true)}</span></Fact>
      <Fact label="Credit limit">{s.limit ? <span className="tabular-nums">{gbp(s.limit)} <span className="text-muted-foreground">({Math.round(s.used * 100)}% used)</span></span> : <span className="text-muted-foreground">not set</span>}</Fact>
      <Fact label="Still available" tone={s.limit && s.available < s.limit * 0.1 ? "warn" : undefined}>{s.limit ? <span className="tabular-nums">{gbp(s.available, true)}</span> : <span className="text-muted-foreground">set the limit</span>}</Fact>
      <Fact label="Rate after the offers">{card.aprPct != null ? `${card.aprPct}%` : <span className="text-muted-foreground">not set</span>}</Fact>

      <div className="col-span-2 md:col-span-4 grid gap-1.5">
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">0% offers</dt>
        <dd className="grid gap-1.5">
          {card.offers.length === 0 && <span className="text-sm text-muted-foreground">None recorded.</span>}
          {s.plans.map((p, i) => (
            <div key={`live-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.days <= 60 && p.under > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{p.days} days left</span>
              <span><span className="font-medium">{p.offer.ratePct}% on {p.offer.kind}</span>{p.offer.start ? ` from ${longDate(p.offer.start)}` : ""} until {longDate(p.offer.end)}{p.offer.feePct ? `, ${p.offer.feePct}% fee` : ""}</span>
              <span className="text-muted-foreground">{p.under > 0 ? <>{gbp(p.under)} under it: about <span className="font-semibold text-foreground">{gbp(p.perMonth)} a month</span> clears it by then ({p.months} {p.months === 1 ? "month" : "months"})</> : "nothing under it"}</span>
            </div>
          ))}
          {ended.map((o, i) => <div key={`ended-${i}`} className="text-xs text-muted-foreground">{o.ratePct}% on {o.kind} ended {longDate(o.end)}.</div>)}
        </dd>
      </div>

      <Fact label="Minimum payment">{rule ? <>{s.minimum != null && <span className="font-semibold tabular-nums">about {gbp(s.minimum, true)}</span>}<span className="block text-xs text-muted-foreground">{rule}</span></> : <span className="text-muted-foreground">rule not set</span>}</Fact>
      <Fact label="Payment due">{card.dueDay ? <>{s.due && <span className="font-semibold">{longDate(s.due)}</span>}<span className="block text-xs text-muted-foreground">the {ordinal(card.dueDay)} of each month</span></> : <span className="text-muted-foreground">not set</span>}</Fact>
      <Fact label="Statement">{card.statementDay ? `the ${ordinal(card.statementDay)} of each month` : <span className="text-muted-foreground">not set</span>}</Fact>
      <Fact label="Direct debit" tone={card.directDebit === "none" && s.balance > 0 ? "warn" : undefined}>{debit}</Fact>
      {card.notes && <div className="col-span-2 md:col-span-4"><Fact label="Notes"><span className="whitespace-pre-wrap">{card.notes}</span></Fact></div>}
    </dl>
  );
}

// What is on the card, newest first, with the balance after each entry.
function Ledger({ s, planned, onAdd, onPatch, onRemove }: { s: Stats; planned: Planned[]; onAdd: (b: EntryBody) => void; onPatch: (id: number, b: Partial<EntryBody>) => void; onRemove: (id: number) => void }) {
  const [form, setForm] = useState<EntryKind | number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const titleOf = useMemo(() => new Map(planned.map(p => [p.taskId, tidy(p.title)])), [planned]);
  const rows = useMemo(() => { let run = 0; return s.mine.map(e => { run += signed(e); return { e, after: Math.round(run * 100) / 100 }; }).reverse(); }, [s.mine]);
  const editing = typeof form === "number" ? s.mine.find(e => e.id === form) : undefined;
  return (
    <section className="space-y-3" aria-label="What is on the card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold" style={SERIF}>What is on it</h3>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" className="h-8" onClick={() => setForm(form === "purchase" ? null : "purchase")}><Plus className="w-3.5 h-3.5 mr-1.5" />Add a charge</Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setForm(form === "payment" ? null : "payment")}><Plus className="w-3.5 h-3.5 mr-1.5" />Record a payment</Button>
        </div>
      </div>
      {typeof form === "string" && <div className="rounded-lg border bg-muted/30 p-3"><EntryForm key={form} kind={form} planned={planned} empty={s.mine.length === 0} onSubmit={b => { onAdd(b); setForm(null); }} onCancel={() => setForm(null)} /></div>}
      {editing && <div className="rounded-lg border bg-muted/30 p-3"><EntryForm key={editing.id} initial={editing} kind={editing.kind} planned={planned} onSubmit={b => { onPatch(editing.id, b); setForm(null); }} onCancel={() => setForm(null)} /></div>}
      {rows.length === 0
        ? <p className="text-sm text-muted-foreground">Nothing recorded yet. Start with the balance today as a balance brought forward, then add each charge and payment as it happens.</p>
        : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Entries on the card, newest first</caption>
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="text-left font-medium px-3 py-2">Date</th>
                  <th scope="col" className="text-left font-medium px-3 py-2">What</th>
                  <th scope="col" className="text-right font-medium px-3 py-2">Amount</th>
                  <th scope="col" className="text-right font-medium px-3 py-2 hidden sm:table-cell">Balance after</th>
                  <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ e, after }) => (
                  <tr key={e.id} className="hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{longDate(e.date)}</td>
                    <td className="px-3 py-2 min-w-[180px]">
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-muted-foreground">{KIND_LABEL[e.kind]}{e.taskId ? ` · plan line: ${titleOf.get(e.taskId) ?? "no longer on a card in the plan"}` : ""}</div>
                    </td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${CREDITS.has(e.kind) ? "text-emerald-700" : ""}`}>{CREDITS.has(e.kind) ? `−${gbp(e.amountGbp, true)}` : gbp(e.amountGbp, true)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground hidden sm:table-cell">{gbp(after, true)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Edit ${e.description}`} onClick={() => setForm(form === e.id ? null : e.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                      {confirm === e.id
                        ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={() => { onRemove(e.id); setConfirm(null); }} onBlur={() => setConfirm(null)}>Sure?</Button>
                        : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${e.description}`} onClick={() => setConfirm(e.id)}><X className="w-4 h-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 text-xs font-medium text-muted-foreground ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="font-normal text-[11px]">{hint}</span>}
    </label>
  );
}

function EntryForm({ initial, kind, planned, empty, onSubmit, onCancel }: { initial?: Entry; kind: EntryKind; planned: Planned[]; empty?: boolean; onSubmit: (b: EntryBody) => void; onCancel: () => void }) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [k, setK] = useState<EntryKind>(initial?.kind ?? (empty && kind === "purchase" ? "opening" : kind));
  const [description, setDescription] = useState(initial?.description ?? (empty && kind === "purchase" ? "Balance brought forward" : ""));
  const [amount, setAmount] = useState(initial ? String(initial.amountGbp) : "");
  const [taskId, setTaskId] = useState<string>(initial?.taskId ? String(initial.taskId) : "none");
  const field = "h-9 text-sm bg-background text-foreground font-normal";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!description.trim() || !Number.isFinite(a) || a < 0 || !date) return;
    onSubmit({ date, kind: k, description: description.trim(), amountGbp: Math.round(a * 100) / 100, taskId: taskId === "none" ? null : Number(taskId) });
  };
  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) onCancel(); }} className="grid gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-[150px_180px_minmax(0,1fr)_130px] gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} required /></Field>
        <Field label="Type">
          <Select value={k} onValueChange={v => setK(v as EntryKind)}>
            <SelectTrigger className={field} aria-label="Type"><SelectValue /></SelectTrigger>
            <SelectContent>{ENTRY_KINDS.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="What it was" className="col-span-2 sm:col-span-1"><Input autoFocus value={description} onChange={e => setDescription(e.target.value)} placeholder={CREDITS.has(k) ? "e.g. Direct debit" : "e.g. Treatment couch deposit"} className={field} required /></Field>
        <Field label="Amount (£)"><Input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={`${field} tabular-nums`} required /></Field>
      </div>
      {!CREDITS.has(k) && k !== "opening" && (
        <Field label="Plan line it pays for (optional)" className="max-w-xl">
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger className={field} aria-label="Plan line"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not a plan line</SelectItem>
              {planned.map(p => <SelectItem key={p.taskId} value={String(p.taskId)}>{tidy(p.title)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="h-8">{initial ? "Save" : "Add"}</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

type OfferDraft = { kind: OfferKind; ratePct: string; start: string; end: string; feePct: string };
const toDraft = (o: Offer): OfferDraft => ({ kind: o.kind, ratePct: String(o.ratePct ?? 0), start: o.start ?? "", end: o.end, feePct: o.feePct != null ? String(o.feePct) : "" });
const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

// Every detail of a card, in the order of the list the owner was given.
function CardForm({ initial, creating, onSubmit, onCancel }: { initial?: CardRow; creating?: boolean; onSubmit: (b: CardBody) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [holder, setHolder] = useState(initial?.holder ?? "");
  const [account, setAccount] = useState<"business" | "personal">(initial?.account ?? "business");
  const [last4, setLast4] = useState(initial?.last4 ?? "");
  const [limit, setLimit] = useState(str(initial?.creditLimitGbp || null));
  const [apr, setApr] = useState(str(initial?.aprPct));
  const [offers, setOffers] = useState<OfferDraft[]>(initial?.offers.map(toDraft) ?? []);
  const [minPct, setMinPct] = useState(str(initial?.minPaymentPct));
  const [minFloor, setMinFloor] = useState(str(initial?.minPaymentFloorGbp));
  const [statementDay, setStatementDay] = useState(str(initial?.statementDay));
  const [dueDay, setDueDay] = useState(str(initial?.dueDay));
  const [debit, setDebit] = useState<CardRow["directDebit"]>(initial?.directDebit ?? "none");
  const [debitGbp, setDebitGbp] = useState(str(initial?.directDebitGbp));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [opening, setOpening] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIso());
  const field = "h-9 text-sm bg-background text-foreground font-normal";
  const last4Bad = last4 !== "" && !/^\d{4}$/.test(last4);
  const setOffer = (i: number, patch: Partial<OfferDraft>) => setOffers(list => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || last4Bad) return;
    onSubmit({
      name: name.trim(), holder: holder.trim() || null, account, last4: last4 || null,
      creditLimitGbp: num(limit) ?? 0, aprPct: num(apr),
      offers: offers.filter(o => o.end).map(o => ({ kind: o.kind, ratePct: num(o.ratePct) ?? 0, start: o.start || null, end: o.end, feePct: num(o.feePct) })),
      minPaymentPct: num(minPct), minPaymentFloorGbp: num(minFloor), statementDay: num(statementDay), dueDay: num(dueDay),
      directDebit: debit, directDebitGbp: debit === "fixed" ? num(debitGbp) : null, notes: notes.trim() || null,
      ...(creating && opening.trim() ? { openingBalanceGbp: num(opening), openingDate } : {}),
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-5">
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold mb-2">The card</legend>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Card name"><Input autoFocus={creating} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Barclaycard Business" className={field} required /></Field>
          <Field label="Whose card"><Input value={holder} onChange={e => setHolder(e.target.value)} placeholder="David, Abi or the company" className={field} /></Field>
          <Field label="Business or personal" hint="Build costs on a personal card are owed back by the company.">
            <Select value={account} onValueChange={v => setAccount(v as "business" | "personal")}>
              <SelectTrigger className={field} aria-label="Business or personal"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="business">Business card</SelectItem><SelectItem value="personal">Personal card</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Last four digits" hint={last4Bad ? "Four digits, nothing more." : "Only the last four."}>
            <Input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} autoComplete="off" placeholder="1234" className={`${field} font-mono tracking-widest w-28 ${last4Bad ? "border-rose-400" : ""}`} />
          </Field>
          <Field label="Credit limit (£)"><Input type="number" min={0} step="1" value={limit} onChange={e => setLimit(e.target.value)} className={`${field} tabular-nums`} /></Field>
          <Field label="Rate after the offers (% APR)"><Input type="number" min={0} max={100} step="0.01" value={apr} onChange={e => setApr(e.target.value)} className={`${field} tabular-nums`} /></Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold mb-1">0% offers</legend>
        {offers.length === 0 && <p className="text-xs text-muted-foreground">None yet. Many cards have two, on purchases and on balance transfers, ending on different dates.</p>}
        {offers.map((o, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[180px_90px_150px_150px_90px_auto] gap-2 items-end rounded-md border bg-background/60 p-2">
            <Field label="On">
              <Select value={o.kind} onValueChange={v => setOffer(i, { kind: v as OfferKind })}>
                <SelectTrigger className={field} aria-label={`Offer ${i + 1} covers`}><SelectValue /></SelectTrigger>
                <SelectContent>{OFFER_KINDS.map(k => <SelectItem key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Rate %"><Input type="number" min={0} max={100} step="0.01" value={o.ratePct} onChange={e => setOffer(i, { ratePct: e.target.value })} className={`${field} tabular-nums`} /></Field>
            <Field label="Starts"><Input type="date" value={o.start} onChange={e => setOffer(i, { start: e.target.value })} className={field} /></Field>
            <Field label="Ends"><Input type="date" value={o.end} onChange={e => setOffer(i, { end: e.target.value })} className={field} required /></Field>
            <Field label="Fee %"><Input type="number" min={0} max={100} step="0.01" value={o.feePct} onChange={e => setOffer(i, { feePct: e.target.value })} className={`${field} tabular-nums`} /></Field>
            <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground" aria-label={`Remove offer ${i + 1}`} onClick={() => setOffers(list => list.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
          </div>
        ))}
        {offers.length < 4 && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 -ml-2 w-fit text-xs" onClick={() => setOffers(list => [...list, { kind: list.some(x => x.kind === "purchases") ? "balance transfers" : "purchases", ratePct: "0", start: "", end: "", feePct: "" }])}><Plus className="w-3.5 h-3.5 mr-1.5" />Add an offer</Button>}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold mb-2">Payments</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Minimum: % of the balance"><Input type="number" min={0} max={100} step="0.01" value={minPct} onChange={e => setMinPct(e.target.value)} className={`${field} tabular-nums`} /></Field>
          <Field label="Minimum: at least (£)"><Input type="number" min={0} step="0.01" value={minFloor} onChange={e => setMinFloor(e.target.value)} className={`${field} tabular-nums`} /></Field>
          <Field label="Statement date (day)"><Input type="number" min={1} max={31} step="1" value={statementDay} onChange={e => setStatementDay(e.target.value)} className={`${field} tabular-nums`} /></Field>
          <Field label="Payment due (day)"><Input type="number" min={1} max={31} step="1" value={dueDay} onChange={e => setDueDay(e.target.value)} className={`${field} tabular-nums`} /></Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Direct debit">
            <Select value={debit} onValueChange={v => setDebit(v as CardRow["directDebit"])}>
              <SelectTrigger className={field} aria-label="Direct debit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="minimum">The minimum</SelectItem>
                <SelectItem value="fixed">A fixed amount</SelectItem>
                <SelectItem value="full">The full balance</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {debit === "fixed" && <Field label="Amount each month (£)"><Input type="number" min={0} step="0.01" value={debitGbp} onChange={e => setDebitGbp(e.target.value)} className={`${field} tabular-nums`} /></Field>}
        </div>
      </fieldset>

      {creating && (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold mb-2">What is on it now</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Balance today (£)" hint="From the banking app; leave empty if it is clear."><Input type="number" min={0} step="0.01" value={opening} onChange={e => setOpening(e.target.value)} className={`${field} tabular-nums`} /></Field>
            <Field label="As at"><Input type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} className={field} /></Field>
          </div>
        </fieldset>
      )}

      <Field label="Notes" className="max-w-2xl"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth remembering about this card" className={field} /></Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" className="h-9">{creating ? "Add the card" : "Save the details"}</Button>
        {onCancel && <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

// The plan lines whose payment plan puts them on a card, with how much of each is
// recorded on a card so far, and a one-step way to record the rest on a chosen card.
function FromThePlan({ planned, entries, cards, onRecord }: { planned: Planned[]; entries: Entry[]; cards: CardRow[]; onRecord: (cardId: number, p: Planned, amount: number) => void }) {
  const onCards = useMemo(() => {
    const m = new Map<number, { amount: number; cards: Set<number> }>();
    for (const e of entries) if (e.taskId != null && !CREDITS.has(e.kind)) { const x = m.get(e.taskId) ?? { amount: 0, cards: new Set<number>() }; x.amount += e.amountGbp; x.cards.add(e.cardId); m.set(e.taskId, x); }
    return m;
  }, [entries]);
  const nameOf = new Map(cards.map(c => [c.id, c.name]));
  const total = planned.reduce((s, p) => s + p.cardGbp, 0);
  const recorded = planned.reduce((s, p) => s + Math.min(p.cardGbp, onCards.get(p.taskId)?.amount ?? 0), 0);
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>Going on the cards, from the plan</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl">The plan lines whose payment plan says card. When one goes on a card, record it there, so the card's balance and the plan agree.</p>
          </div>
          <div className="text-sm tabular-nums sm:text-right"><span className="font-semibold">{gbp(total)}</span> <span className="text-muted-foreground">planned on cards</span><div className="text-xs text-muted-foreground">{gbp(recorded)} recorded so far</div></div>
        </div>
      </CardHeader>
      <CardContent>
        {planned.length === 0
          ? <p className="text-sm text-muted-foreground">No plan line has card in its payment plan.</p>
          : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">Plan lines due to go on a card</caption>
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-3 py-2">When</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Plan line</th>
                    <th scope="col" className="text-right font-medium px-3 py-2">On a card</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {planned.map(p => {
                    const on = onCards.get(p.taskId);
                    const left = Math.round((p.cardGbp - (on?.amount ?? 0)) * 100) / 100;
                    return (
                      <tr key={p.taskId} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{p.parts.map(x => monthName(x.month)).join(", ")}</td>
                        <td className="px-3 py-2 min-w-[200px]">
                          <div className="font-medium">{tidy(p.title)}</div>
                          <div className="text-xs text-muted-foreground">{p.phase}{p.planStatus !== "unpaid" ? ` · ${p.planStatus} in the plan` : ""}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{gbp(p.cardGbp, true)}</td>
                        <td className="px-3 py-2 min-w-[220px]">
                          {on && <div className="text-xs text-emerald-800 mb-1">{gbp(on.amount, true)} on {[...on.cards].map(id => nameOf.get(id) ?? "a closed card").join(" and ")}</div>}
                          {left > 0.5 && (cards.length
                            ? <RecordOn cards={cards} amount={left} onRecord={id => onRecord(id, p, left)} />
                            : <span className="text-xs text-muted-foreground">Add a card to record it.</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

function RecordOn({ cards, amount, onRecord }: { cards: CardRow[]; amount: number; onRecord: (cardId: number) => void }) {
  const [picked, setPicked] = useState("");
  // Only ever a card that is open now; with one card open, that one.
  const cardId = cards.some(c => String(c.id) === picked) ? picked : cards.length === 1 ? String(cards[0].id) : "";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={cardId} onValueChange={setPicked}>
        <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Which card"><SelectValue placeholder="Which card?" /></SelectTrigger>
        <SelectContent>{cards.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.last4 ? ` (${c.last4})` : ""}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!cardId} onClick={() => onRecord(Number(cardId))}>Record {gbp(amount, true)}</Button>
    </div>
  );
}
