// Rooms and kit: Abi's view of the furniture, equipment and finishes. The budget
// lines are plan tasks, read live from the Plan & Timeline; her items are what she
// plans to buy against each one. Prices as paid (inc VAT where charged), matching
// the plan's own figures.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { X, Link2, ExternalLink } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";

type Area = { id: number; areaKey: string; name: string; covers: string | null; sortOrder: number };
type Line = { id: number; taskId: number; areaKey: string; sortOrder: number; title: string; phase: string; budgetGbp: number; basis: string; planStatus: "paid" | "part-paid" | "committed" | "planned"; amountPaidGbp: number; savingBaseline: number | null; savingApplied: boolean; missing: boolean };
type Item = { id: number; areaKey: string; taskId: number | null; name: string; amountGbp: number; status: "planned" | "ordered" | "paid"; note: string | null; url: string | null; imageUrl: string | null; linkTitle: string | null; createdAt: string };
type KitData = { areas: Area[]; lines: Line[]; items: Item[] };

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
  const addItem = useMutation({ mutationFn: (body: { taskId: number; name: string; amountGbp: number; status: string; url?: string }) => send("POST", `/projects/${PROJECT_ID}/kit/items`, body), onSuccess: refresh, onError: fail });
  const removeItem = useMutation({ mutationFn: (id: number) => send("DELETE", `/projects/${PROJECT_ID}/kit/items/${id}`), onSuccess: refresh, onError: fail });

  const lines = data?.lines ?? [], items = data?.items ?? [];
  const totals = useMemo(() => {
    const budget = lines.reduce((s, l) => s + l.budgetGbp, 0);
    const planned = items.reduce((s, i) => s + i.amountGbp, 0);
    const bought = items.filter(i => i.status !== "planned").reduce((s, i) => s + i.amountGbp, 0);
    return { budget, planned, bought, diff: budget - planned };
  }, [lines, items]);
  const areas = (data?.areas ?? []).filter(a => lines.some(l => l.areaKey === a.areaKey));
  const orphans = items.filter(i => !i.taskId || !lines.some(l => l.taskId === i.taskId));

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms & Kit" subtitle="The furniture, equipment and finishes, by area. Each budget is a line in the Plan & Timeline and changes when the plan does. Add what you plan to buy against each one, at the price you will pay." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Budget, from the plan" value={gbp(totals.budget)} sub={`${lines.length} plan lines`} />
        <Tile label="Planned" value={gbp(totals.planned)} sub="everything on the lists" />
        <Tile label="Bought" value={gbp(totals.bought)} sub="ordered or paid" />
        <Tile label="Position" value={totals.diff >= 0 ? `${gbp(totals.diff)} under` : `${gbp(-totals.diff)} over`} sub="planned against budget" tone={totals.diff >= 0 ? "good" : "bad"} />
      </div>

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the plan lines…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700 dark:text-rose-400">Could not load the rooms and kit: {(error as Error).message}</CardContent></Card>}
      {!isLoading && !error && lines.length === 0 && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground">No plan lines are on this page yet. They are set up when the app starts; if this stays empty, the plan tasks could not be matched.</CardContent></Card>}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {areas.map(area => (
          <Card key={area.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{area.name}</CardTitle>
              {area.covers && <p className="text-xs text-muted-foreground">{area.covers}</p>}
              <AreaTotal lines={lines.filter(l => l.areaKey === area.areaKey)} items={items} />
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.filter(l => l.areaKey === area.areaKey).map(line => (
                <LineBlock key={line.id} line={line} items={items.filter(i => i.taskId === line.taskId)}
                  onPatch={(id, patch) => patchItem.mutate({ id, patch })}
                  onAdd={body => addItem.mutate({ taskId: line.taskId, ...body })}
                  onRemove={id => removeItem.mutate(id)} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {orphans.length > 0 && (
        <Card className="shadow-sm border-amber-300 dark:border-amber-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Items not attached to a plan line</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {orphans.map(it => (
              <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_88px_minmax(200px,1fr)_32px] gap-1.5 items-center text-sm">
                <span className="truncate">{it.name}</span>
                <span className="text-right tabular-nums">{gbp(it.amountGbp)}</span>
                <Select onValueChange={v => patchItem.mutate({ id: it.id, patch: { taskId: Number(v) } })}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Attach to a plan line"><SelectValue placeholder="Attach to a plan line" /></SelectTrigger>
                  <SelectContent>{lines.filter(l => !l.missing).map(l => <SelectItem key={l.taskId} value={String(l.taskId)}>{l.title}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${it.name}`} onClick={() => removeItem.mutate(it.id)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Budgets are the plan's current figures: what was paid if paid, else what is committed, else the selected cost with savings applied. Change them in <Link href="/project" className="underline">Plan & Timeline</Link>. Prices here are as you pay them, VAT included where it is charged, so they compare like with like with the plan. Statuses: planned (an idea with a price), ordered (committed, not yet paid), paid.</p>
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

function AreaTotal({ lines, items }: { lines: Line[]; items: Item[] }) {
  const budget = lines.reduce((s, l) => s + l.budgetGbp, 0);
  const planned = items.filter(i => lines.some(l => l.taskId === i.taskId)).reduce((s, i) => s + i.amountGbp, 0);
  const diff = budget - planned;
  return (
    <div className="flex justify-between text-sm pt-1">
      <span className="text-muted-foreground">Budget {gbp(budget)}, planned {gbp(planned)}</span>
      <span className={`font-semibold tabular-nums ${diff >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{diff >= 0 ? `${gbp(diff)} under` : `${gbp(-diff)} over`}</span>
    </div>
  );
}

function LineBlock({ line, items, onPatch, onAdd, onRemove }: {
  line: Line; items: Item[];
  onPatch: (id: number, patch: Partial<Item>) => void;
  onAdd: (body: { name: string; amountGbp: number; status: string; url?: string }) => void;
  onRemove: (id: number) => void;
}) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [status, setStatus] = useState<Item["status"]>("planned"); const [url, setUrl] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [linkFor, setLinkFor] = useState<number | null>(null);
  const planned = items.reduce((s, i) => s + i.amountGbp, 0);
  const paid = items.filter(i => i.status === "paid").reduce((s, i) => s + i.amountGbp, 0);
  const ordered = items.filter(i => i.status === "ordered").reduce((s, i) => s + i.amountGbp, 0);
  const bought = paid + ordered;
  const budget = line.budgetGbp, diff = budget - planned, base = Math.max(budget, planned, 1);
  const pct = (v: number) => `${(100 * Math.max(0, v) / base).toFixed(1)}%`;
  const submit = (e: React.FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; onAdd({ name: n, amountGbp: Math.round(parseFloat(amount) || 0), status, url: url.trim() || undefined }); setName(""); setAmount(""); setStatus("planned"); setUrl(""); };
  const planBadge = line.planStatus === "paid" ? <Badge variant="secondary" className="text-[10px]">paid in the plan</Badge>
    : line.planStatus === "part-paid" ? <Badge variant="secondary" className="text-[10px]">part-paid in the plan</Badge>
    : line.planStatus === "committed" ? <Badge variant="secondary" className="text-[10px]">committed in the plan</Badge> : null;

  return (
    <div className={`rounded-md border p-3 space-y-2 ${line.missing ? "border-amber-300 dark:border-amber-800" : "border-border"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{line.title}</div>
          <div className="text-[11px] text-muted-foreground">
            {line.missing ? "This line has been removed from the plan." : <>Plan budget <span className="font-semibold text-foreground tabular-nums">{gbp(budget)}</span> {line.basis}{line.savingBaseline != null && line.savingApplied && line.savingBaseline !== budget ? `, was ${gbp(line.savingBaseline)} before savings` : ""}</>}
            {" "}{planBadge}
          </div>
        </div>
        <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${diff >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{diff >= 0 ? `${gbp(diff)} under` : `${gbp(-diff)} over`}</span>
      </div>
      <div className="h-1.5 rounded-sm bg-muted overflow-hidden flex" role="img" aria-label={`${line.title}: planned ${gbp(planned)} against ${gbp(budget)}`}>
        <i className="block h-full bg-emerald-600" style={{ width: pct(Math.min(paid, budget)) }} />
        <i className="block h-full bg-emerald-400" style={{ width: pct(Math.min(ordered, Math.max(0, budget - paid))) }} />
        <i className="block h-full bg-sky-400" style={{ width: pct(Math.min(planned, budget) - Math.min(bought, budget)) }} />
        {planned > budget && <i className="block h-full bg-rose-500" style={{ width: pct(planned - budget) }} />}
      </div>
      <div className="space-y-1.5">
        {items.map(it => (
          <div key={it.id} className="space-y-1">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_88px_100px_32px_32px] gap-1.5 items-center">
              {it.imageUrl
                ? <a href={it.url ?? it.imageUrl} target="_blank" rel="noreferrer" title={it.linkTitle ?? it.url ?? ""} className="block w-10 h-10 rounded-sm overflow-hidden bg-muted shrink-0"><img src={it.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} /></a>
                : <span className="block w-0 h-8" aria-hidden="true" />}
              <Input defaultValue={it.name} className="h-8 text-sm" aria-label="Item"
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.name) onPatch(it.id, { name: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Input type="number" min={0} step={1} defaultValue={Math.round(it.amountGbp)} className="h-8 text-sm text-right tabular-nums" aria-label="Price as paid"
                onBlur={e => { const v = Math.round(parseFloat(e.target.value) || 0); if (v !== Math.round(it.amountGbp)) onPatch(it.id, { amountGbp: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Select value={it.status} onValueChange={v => onPatch(it.id, { status: v as Item["status"] })}>
                <SelectTrigger className="h-8 text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="sm" variant="ghost" className={`h-8 w-8 p-0 ${it.url ? "text-primary" : "text-muted-foreground"}`} aria-label={it.url ? `Change the link for ${it.name}` : `Add a link for ${it.name}`} aria-expanded={linkFor === it.id} onClick={() => setLinkFor(linkFor === it.id ? null : it.id)}><Link2 className="w-4 h-4" /></Button>
              {confirmId === it.id
                ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={() => { onRemove(it.id); setConfirmId(null); }} onBlur={() => setConfirmId(null)}>Sure?</Button>
                : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${it.name}`} onClick={() => setConfirmId(it.id)}><X className="w-4 h-4" /></Button>}
            </div>
            {linkFor === it.id && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5 items-center pl-1">
                <Input type="url" defaultValue={it.url ?? ""} placeholder="Paste the product page link" className="h-8 text-sm" aria-label={`Link for ${it.name}`} autoFocus
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onPatch(it.id, { url: (e.target as HTMLInputElement).value.trim() }); setLinkFor(null); } if (e.key === "Escape") setLinkFor(null); }}
                  onBlur={e => { const v = e.target.value.trim(); if (v !== (it.url ?? "")) onPatch(it.id, { url: v }); setLinkFor(null); }} />
                {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline whitespace-nowrap"><ExternalLink className="w-3 h-3" />Open</a>}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Enter to save</span>
              </div>
            )}
            {it.linkTitle && !it.imageUrl && it.url && <div className="pl-1 text-[11px] text-muted-foreground truncate"><a href={it.url} target="_blank" rel="noreferrer" className="underline">{it.linkTitle}</a></div>}
          </div>
        ))}
      </div>
      {!line.missing && (
        <form onSubmit={submit} className="space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_88px_100px_auto] gap-1.5 items-center">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="What will you buy?" className="h-8 text-sm" aria-label={`New item for ${line.title}`} />
            <Input type="number" min={0} step={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="£ as paid" className="h-8 text-sm text-right" aria-label="Price as paid" />
            <Select value={status} onValueChange={v => setStatus(v as Item["status"])}>
              <SelectTrigger className="h-8 text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-8">Add</Button>
          </div>
          <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Link to the product page (optional): its picture will show here" className="h-8 text-sm" aria-label={`Link for the new item under ${line.title}`} />
        </form>
      )}
    </div>
  );
}
