// Rooms and kit: the furniture, equipment and finishes budget by area, and what
// Abi plans to buy against it. Amounts ex VAT. Saved in the app's database.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";

type Area = { id: number; areaKey: string; name: string; budgetGbp: number; covers: string | null; sortOrder: number };
type Item = { id: number; areaKey: string; name: string; amountGbp: number; status: "planned" | "ordered" | "paid"; note: string | null; createdAt: string };
type KitData = { areas: Area[]; items: Item[] };

const STATUSES: { value: Item["status"]; label: string }[] = [
  { value: "planned", label: "planned" },
  { value: "ordered", label: "ordered" },
  { value: "paid", label: "paid" },
];

const gbp = (v: number) => `${v < 0 ? "−" : ""}£${Math.abs(Math.round(v)).toLocaleString("en-GB")}`;

async function send(method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

export default function KitPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["kit", PROJECT_ID];
  const { data, isLoading, error } = useQuery<KitData>({ queryKey: key, queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/kit`).then(r => r.json()) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });

  const patchItem = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: Partial<Item> }) => send("PATCH", `/projects/${PROJECT_ID}/kit/items/${id}`, patch), onSuccess: refresh, onError: fail });
  const addItem = useMutation({ mutationFn: (body: { areaKey: string; name: string; amountGbp: number; status: string }) => send("POST", `/projects/${PROJECT_ID}/kit/items`, body), onSuccess: refresh, onError: fail });
  const removeItem = useMutation({ mutationFn: (id: number) => send("DELETE", `/projects/${PROJECT_ID}/kit/items/${id}`), onSuccess: refresh, onError: fail });
  const patchArea = useMutation({ mutationFn: ({ id, budgetGbp }: { id: number; budgetGbp: number }) => send("PATCH", `/projects/${PROJECT_ID}/kit/areas/${id}`, { budgetGbp }), onSuccess: refresh, onError: fail });

  const totals = useMemo(() => {
    const areas = data?.areas ?? [], items = data?.items ?? [];
    const budget = areas.reduce((s, a) => s + a.budgetGbp, 0);
    const planned = items.reduce((s, i) => s + i.amountGbp, 0);
    const bought = items.filter(i => i.status !== "planned").reduce((s, i) => s + i.amountGbp, 0);
    return { budget, planned, bought, diff: budget - planned };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms & Kit" subtitle="The furniture, equipment and finishes budget by area, and what is planned against it. Prices ex VAT. The building work is in CBS's contract and listed under each area for reference." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Budget" value={gbp(totals.budget)} sub="all areas, ex VAT" />
        <Tile label="Planned" value={gbp(totals.planned)} sub="everything on the lists" />
        <Tile label="Bought" value={gbp(totals.bought)} sub="ordered or paid" />
        <Tile label="Position" value={totals.diff >= 0 ? `${gbp(totals.diff)} under` : `${gbp(-totals.diff)} over`} sub="planned against budget" tone={totals.diff >= 0 ? "good" : "bad"} />
      </div>

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the lists…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700 dark:text-rose-400">Could not load the rooms and kit: {(error as Error).message}</CardContent></Card>}

      <div className="grid lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
        {(data?.areas ?? []).map(area => (
          <AreaCard key={area.id} area={area} items={(data?.items ?? []).filter(i => i.areaKey === area.areaKey)}
            onBudget={b => patchArea.mutate({ id: area.id, budgetGbp: b })}
            onPatch={(id, patch) => patchItem.mutate({ id, patch })}
            onAdd={body => addItem.mutate({ areaKey: area.areaKey, ...body })}
            onRemove={id => removeItem.mutate(id)} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Statuses: planned (an idea with a price), ordered (committed, not yet paid), paid. Bought counts ordered and paid. If a quote includes VAT, take a sixth off before entering it. Budgets come from the launch plan with savings applied; changing one here does not change the plan.</p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  const colour = tone === "good" ? "text-emerald-700 dark:text-emerald-400" : tone === "bad" ? "text-rose-700 dark:text-rose-400" : "";
  return (
    <Card className="shadow-sm"><CardContent className="p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums leading-tight mt-0.5 ${colour}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </CardContent></Card>
  );
}

function AreaCard({ area, items, onBudget, onPatch, onAdd, onRemove }: {
  area: Area; items: Item[];
  onBudget: (budget: number) => void;
  onPatch: (id: number, patch: Partial<Item>) => void;
  onAdd: (body: { name: string; amountGbp: number; status: string }) => void;
  onRemove: (id: number) => void;
}) {
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [status, setStatus] = useState<Item["status"]>("planned");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const planned = items.reduce((s, i) => s + i.amountGbp, 0);
  const paid = items.filter(i => i.status === "paid").reduce((s, i) => s + i.amountGbp, 0);
  const ordered = items.filter(i => i.status === "ordered").reduce((s, i) => s + i.amountGbp, 0);
  const bought = paid + ordered;
  const budget = area.budgetGbp, diff = budget - planned, base = Math.max(budget, planned, 1);
  const pct = (v: number) => `${(100 * Math.max(0, v) / base).toFixed(1)}%`;

  const commitBudget = () => { if (budgetDraft === null) return; const v = Math.round(parseFloat(budgetDraft) || 0); setBudgetDraft(null); if (v !== budget && v >= 0) onBudget(v); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; onAdd({ name: n, amountGbp: Math.round(parseFloat(amount) || 0), status }); setName(""); setAmount(""); setStatus("planned"); };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base">{area.name}</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">Budget
            <Input type="number" min={0} step={1} className="h-8 w-28 text-right tabular-nums" value={budgetDraft ?? String(Math.round(budget))}
              onChange={e => setBudgetDraft(e.target.value)} onBlur={commitBudget} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-label={`Budget for ${area.name}`} />
          </label>
        </div>
        {area.covers && <p className="text-xs text-muted-foreground">{area.covers}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 rounded-sm bg-muted overflow-hidden flex" role="img" aria-label={`${area.name}: planned ${gbp(planned)} against ${gbp(budget)}`}>
          <i className="block h-full bg-emerald-600" style={{ width: pct(Math.min(paid, budget)) }} />
          <i className="block h-full bg-emerald-400" style={{ width: pct(Math.min(ordered, Math.max(0, budget - paid))) }} />
          <i className="block h-full bg-sky-400" style={{ width: pct(Math.min(planned, budget) - Math.min(bought, budget)) }} />
          {planned > budget && <i className="block h-full bg-rose-500" style={{ width: pct(planned - budget) }} />}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Planned {gbp(planned)}{bought ? `, of which bought ${gbp(bought)}` : ""}</span>
          <span className={`font-semibold tabular-nums ${diff >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{diff >= 0 ? `${gbp(diff)} under` : `${gbp(-diff)} over`}</span>
        </div>

        <div className="space-y-1.5">
          {items.length === 0 && <div className="text-xs text-muted-foreground">Nothing on the list yet.</div>}
          {items.map(it => (
            <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_88px_100px_32px] gap-1.5 items-center">
              <Input defaultValue={it.name} className="h-8 text-sm" aria-label="Item"
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.name) onPatch(it.id, { name: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Input type="number" min={0} step={1} defaultValue={Math.round(it.amountGbp)} className="h-8 text-sm text-right tabular-nums" aria-label="Price ex VAT"
                onBlur={e => { const v = Math.round(parseFloat(e.target.value) || 0); if (v !== Math.round(it.amountGbp)) onPatch(it.id, { amountGbp: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Select value={it.status} onValueChange={v => onPatch(it.id, { status: v as Item["status"] })}>
                <SelectTrigger className="h-8 text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              {confirmId === it.id
                ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs col-span-1" onClick={() => { onRemove(it.id); setConfirmId(null); }} onBlur={() => setConfirmId(null)}>Sure?</Button>
                : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${it.name}`} onClick={() => setConfirmId(it.id)}><X className="w-4 h-4" /></Button>}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_88px_100px_auto] gap-1.5 items-center pt-2 border-t">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="What is it? e.g. feature wall" className="h-8 text-sm" aria-label="New item" />
          <Input type="number" min={0} step={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="£ ex VAT" className="h-8 text-sm text-right" aria-label="Price ex VAT" />
          <Select value={status} onValueChange={v => setStatus(v as Item["status"])}>
            <SelectTrigger className="h-8 text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" size="sm" className="h-8">Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}
