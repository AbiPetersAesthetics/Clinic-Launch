// Rooms and kit: Abi's board. The colours and floors she is choosing, and the
// furniture, equipment and finishes by area. The budget lines are plan tasks, read
// live from the Plan & Timeline; her items are what she plans to buy against each
// one. Prices as paid (inc VAT where charged), matching the plan's own figures.
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { FinishesBoard, Swatch, ZONE_ORDER, shortName, type FinishesData, type Option as FinishOption, type Surface } from "@/components/finishes-board";
import { X, Link2, ExternalLink, BedSingle, Armchair, MessagesSquare, Paintbrush, PartyPopper, Palette, type LucideIcon } from "lucide-react";

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

const AREA_ICONS: Record<string, LucideIcon> = { treatment: BedSingle, reception: Armchair, consult: MessagesSquare, finish: Paintbrush, opening: PartyPopper };

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
  const finishes = useQuery<FinishesData>({ queryKey: ["finishes", PROJECT_ID], queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/finishes`).then(r => r.json()) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });

  const patchItem = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: Partial<Item> }) => send("PATCH", `/projects/${PROJECT_ID}/kit/items/${id}`, patch), onSuccess: refresh, onError: fail });
  const addItem = useMutation({ mutationFn: (body: { taskId: number; name: string; amountGbp: number; status: string; url?: string }) => send("POST", `/projects/${PROJECT_ID}/kit/items`, body), onSuccess: refresh, onError: fail });
  const removeItem = useMutation({ mutationFn: (id: number) => send("DELETE", `/projects/${PROJECT_ID}/kit/items/${id}`), onSuccess: refresh, onError: fail });

  // The two boards are tabs; #finishes in the address opens the colours one.
  const [tab, setTab] = useState<string>(() => (typeof window !== "undefined" && window.location.hash === "#finishes" ? "finishes" : "kit"));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = tab === "finishes" ? "#finishes" : "";
    if (window.location.hash !== h) window.history.replaceState(null, "", `${window.location.pathname}${h}`);
  }, [tab]);
  // A link to #finishes while the page is already open switches the tab too.
  useEffect(() => {
    const onHash = () => setTab(window.location.hash === "#finishes" ? "finishes" : "kit");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goToSurface = (id: number) => { setTab("finishes"); window.setTimeout(() => document.getElementById(`surface-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); };

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
      <PageHeader title="Rooms & Kit" subtitle="Abi's board: the colours and floors being chosen, and the furniture and kit by room. Budgets follow the Plan & Timeline." />

      <PaletteStrip data={finishes.data} onPick={goToSurface} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kit"><Armchair className="w-3.5 h-3.5 mr-1.5" />Furniture & kit</TabsTrigger>
          <TabsTrigger value="finishes"><Palette className="w-3.5 h-3.5 mr-1.5" />Colours & finishes</TabsTrigger>
        </TabsList>

        <TabsContent value="kit" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Budget, from the plan" value={gbp(totals.budget)} sub={`${lines.length} plan lines`} />
            <Tile label="Planned" value={gbp(totals.planned)} sub="everything on the lists" />
            <Tile label="Bought" value={gbp(totals.bought)} sub="ordered or paid" />
            <Tile label="Position" value={totals.diff >= 0 ? `${gbp(totals.diff)} under` : `${gbp(-totals.diff)} over`} sub="planned against budget" tone={totals.diff >= 0 ? "good" : "bad"} />
          </div>

          {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the plan lines…</CardContent></Card>}
          {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700 dark:text-rose-400">Could not load the rooms and kit: {(error as Error).message}</CardContent></Card>}
          {!isLoading && !error && lines.length === 0 && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground">No plan lines are on this page yet. They are set up when the app starts; if this stays empty, the plan tasks could not be matched.</CardContent></Card>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {areas.map(area => {
              const Icon = AREA_ICONS[area.areaKey] ?? Armchair;
              const areaLines = lines.filter(l => l.areaKey === area.areaKey);
              const pictures = items.filter(i => i.imageUrl && areaLines.some(l => l.taskId === i.taskId));
              return (
                <Card key={area.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true"><Icon className="w-5 h-5" /></span>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug">{area.name}</CardTitle>
                        {area.covers && <p className="text-xs text-muted-foreground mt-0.5">{area.covers}</p>}
                      </div>
                    </div>
                    {pictures.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2" aria-label="Pictures from the links on this room's lists">
                        {pictures.slice(0, 8).map(p => (
                          <a key={p.id} href={p.url ?? p.imageUrl ?? "#"} target="_blank" rel="noreferrer" title={`${p.name}${p.linkTitle ? `: ${p.linkTitle}` : ""}`} className="block w-14 h-14 rounded-md overflow-hidden bg-muted ring-1 ring-border">
                            <img src={p.imageUrl ?? ""} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                          </a>
                        ))}
                        {pictures.length > 8 && <span className="text-xs text-muted-foreground self-center">+{pictures.length - 8} more</span>}
                      </div>
                    )}
                    <AreaTotal lines={areaLines} items={items} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {areaLines.map(line => (
                      <LineBlock key={line.id} line={line} items={items.filter(i => i.taskId === line.taskId)}
                        onPatch={(id, patch) => patchItem.mutate({ id, patch })}
                        onAdd={body => addItem.mutate({ taskId: line.taskId, ...body })}
                        onRemove={id => removeItem.mutate(id)} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {orphans.length > 0 && (
            <Card className="shadow-sm border-amber-300 dark:border-amber-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Items not attached to a plan line</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {orphans.map(it => (
                  <div key={it.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="truncate flex-1 min-w-[120px]">{it.name}</span>
                    <span className="text-right tabular-nums w-[72px] sm:w-[88px]">{gbp(it.amountGbp)}</span>
                    <Select onValueChange={v => patchItem.mutate({ id: it.id, patch: { taskId: Number(v) } })}>
                      <SelectTrigger className="h-8 text-xs w-[200px] sm:flex-1" aria-label="Attach to a plan line"><SelectValue placeholder="Attach to a plan line" /></SelectTrigger>
                      <SelectContent>{lines.filter(l => !l.missing).map(l => <SelectItem key={l.taskId} value={String(l.taskId)}>{l.title}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${it.name}`} onClick={() => removeItem.mutate(it.id)}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">Budgets are the plan's current figures: what was paid if paid, else what is committed, else the selected cost with savings applied. Change them in <Link href="/project" className="underline">Plan & Timeline</Link>. Prices here are as you pay them, VAT included where it is charged, so they compare like with like with the plan. Statuses: planned (an idea with a price), ordered (committed, not yet paid), paid.</p>
        </TabsContent>

        <TabsContent value="finishes" className="mt-4">
          <FinishesBoard projectId={PROJECT_ID} data={finishes.data} isLoading={finishes.isLoading} error={(finishes.error as Error | null) ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The colours chosen so far, as chips: the clinic's palette taking shape. A chip
// opens its surface on the colours tab.
function PaletteStrip({ data, onPick }: { data?: FinishesData; onPick: (surfaceId: number) => void }) {
  const chosen = useMemo(() => {
    if (!data) return [] as { s: Surface; o: FinishOption }[];
    const byId = new Map(data.options.map(o => [o.id, o]));
    return [...data.surfaces]
      .sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone) || a.sortOrder - b.sortOrder)
      .flatMap(s => { const o = s.chosenOptionId != null ? byId.get(s.chosenOptionId) : undefined; return o ? [{ s, o }] : []; });
  }, [data]);
  if (!data) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mr-1">The palette so far</span>
      {chosen.length === 0 && <span className="text-xs text-muted-foreground">Nothing chosen yet. Shortlist and choose under Colours & finishes.</span>}
      {chosen.map(({ s, o }) => (
        <button key={s.id} type="button" onClick={() => onPick(s.id)} className="inline-flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={`${s.name}: ${o.name}`}>
          <Swatch hex={o.hex} className="w-5 h-5 rounded-full" />
          <span className="font-medium">{shortName(s)}</span>
          <span className="text-muted-foreground truncate max-w-[160px]">{o.name}</span>
        </button>
      ))}
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
    <div className="flex justify-between text-sm pt-2">
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
            {/* One line on a desk; on a phone the price and status wrap under the name. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {it.imageUrl
                ? <a href={it.url ?? it.imageUrl} target="_blank" rel="noreferrer" title={it.linkTitle ?? it.url ?? ""} className="block w-10 h-10 rounded-sm overflow-hidden bg-muted shrink-0"><img src={it.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} /></a>
                : null}
              <Input defaultValue={it.name} className="h-8 text-sm flex-1 min-w-[140px]" aria-label="Item"
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.name) onPatch(it.id, { name: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Input type="number" min={0} step={1} defaultValue={Math.round(it.amountGbp)} className="h-8 text-sm text-right tabular-nums w-[72px] sm:w-[88px]" aria-label="Price as paid"
                onBlur={e => { const v = Math.round(parseFloat(e.target.value) || 0); if (v !== Math.round(it.amountGbp)) onPatch(it.id, { amountGbp: v }); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <Select value={it.status} onValueChange={v => onPatch(it.id, { status: v as Item["status"] })}>
                <SelectTrigger className="h-8 text-xs w-[88px] sm:w-[100px]" aria-label="Status"><SelectValue /></SelectTrigger>
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="What will you buy?" className="h-8 text-sm flex-1 min-w-[140px]" aria-label={`New item for ${line.title}`} />
            <Input type="number" min={0} step={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="£ as paid" className="h-8 text-sm text-right w-[72px] sm:w-[88px]" aria-label="Price as paid" />
            <Select value={status} onValueChange={v => setStatus(v as Item["status"])}>
              <SelectTrigger className="h-8 text-xs w-[88px] sm:w-[100px]" aria-label="Status"><SelectValue /></SelectTrigger>
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
