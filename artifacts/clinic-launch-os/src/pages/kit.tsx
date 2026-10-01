// Rooms and kit: Abi's board. What she is buying, room by room, against budgets read
// live from the Plan & Timeline, and the colours and floors she is choosing. Prices
// are as paid (inc VAT where charged), matching the plan's own figures.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { FinishesBoard, Swatch, ZONE_ORDER, shortName, type FinishesData, type Option as FinishOption, type Surface } from "@/components/finishes-board";
import { X, Link2, ExternalLink, BedSingle, Armchair, PaintRoller, Sparkles, PartyPopper, Palette, Plus, Package, ShoppingBag, type LucideIcon } from "lucide-react";

const PROJECT_ID = 1;
const API = "/api";
const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

type Status = "planned" | "ordered" | "paid";
type Area = { id: number; areaKey: string; name: string; covers: string | null; sortOrder: number };
type Line = { id: number; taskId: number; areaKey: string; sortOrder: number; title: string; label: string | null; phase: string; budgetGbp: number; basis: string; planStatus: "paid" | "part-paid" | "committed" | "planned"; amountPaidGbp: number; savingBaseline: number | null; savingApplied: boolean; missing: boolean };
type Item = { id: number; areaKey: string; taskId: number | null; name: string; amountGbp: number; status: Status; note: string | null; url: string | null; imageUrl: string | null; linkTitle: string | null; finishOptionId: number | null; createdAt: string };
type KitData = { areas: Area[]; lines: Line[]; items: Item[] };
type NewItem = { name: string; amountGbp: number; status: Status; url?: string; finishOptionId?: number | null };
type ItemPatch = Partial<Pick<Item, "name" | "amountGbp" | "status" | "url" | "finishOptionId" | "taskId">>;

const STATUSES: { value: Status; label: string; tone: string }[] = [
  { value: "planned", label: "Planned", tone: "bg-muted/60 text-muted-foreground" },
  { value: "ordered", label: "Ordered", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "paid", label: "Paid", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
];
const AREA_ICONS: Record<string, LucideIcon> = { treatment: BedSingle, reception: Armchair, paint: PaintRoller, finish: Sparkles, opening: PartyPopper };
const iconFor = (areaKey: string) => AREA_ICONS[areaKey] ?? Package;

const gbp = (v: number) => `${v < 0 ? "−" : ""}£${Math.abs(Math.round(v)).toLocaleString("en-GB")}`;
// The board's name for a line: its label, else the plan's title tidied for display.
const SPACED_DASH = new RegExp(` +[-${String.fromCharCode(0x2013, 0x2014)}] +`, "g");
const lineName = (l: Line) => l.label || l.title.replace(SPACED_DASH, ": ");

function sumUp(lines: Line[], items: Item[]) {
  const ids = new Set(lines.map(l => l.taskId));
  const mine = items.filter(i => i.taskId != null && ids.has(i.taskId));
  const budget = lines.reduce((s, l) => s + l.budgetGbp, 0);
  const planned = mine.reduce((s, i) => s + i.amountGbp, 0);
  const paid = mine.filter(i => i.status === "paid").reduce((s, i) => s + i.amountGbp, 0);
  const ordered = mine.filter(i => i.status === "ordered").reduce((s, i) => s + i.amountGbp, 0);
  return { budget, planned, paid, ordered, bought: paid + ordered, left: budget - planned };
}
type Sums = ReturnType<typeof sumUp>;
type Room = { area: Area; lines: Line[]; sums: Sums };

async function send(method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

export default function KitPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["kit", PROJECT_ID];
  const kit = useQuery<KitData>({ queryKey: key, queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/kit`).then(r => r.json()) });
  const finishes = useQuery<FinishesData>({ queryKey: ["finishes", PROJECT_ID], queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/finishes`).then(r => r.json()) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });

  const patchItem = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: ItemPatch }) => send("PATCH", `/projects/${PROJECT_ID}/kit/items/${id}`, patch), onSuccess: refresh, onError: fail });
  const addItem = useMutation({ mutationFn: (body: NewItem & { taskId: number }) => send("POST", `/projects/${PROJECT_ID}/kit/items`, body), onSuccess: refresh, onError: fail });
  const removeItem = useMutation({ mutationFn: (id: number) => send("DELETE", `/projects/${PROJECT_ID}/kit/items/${id}`), onSuccess: refresh, onError: fail });

  // The two boards are tabs; #finishes in the address opens the colours one.
  const [tab, setTab] = useState<string>(() => (typeof window !== "undefined" && window.location.hash === "#finishes" ? "finishes" : "kit"));
  useEffect(() => {
    const h = tab === "finishes" ? "#finishes" : "";
    if (window.location.hash !== h) window.history.replaceState(null, "", `${window.location.pathname}${h}`);
  }, [tab]);
  useEffect(() => {
    const onHash = () => setTab(window.location.hash === "#finishes" ? "finishes" : "kit");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const scrollTo = (id: string) => window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  const goToSurface = (surfaceId: number) => { setTab("finishes"); scrollTo(`surface-${surfaceId}`); };

  const lines = kit.data?.lines ?? [], items = kit.data?.items ?? [];
  const rooms = useMemo<Room[]>(() => (kit.data?.areas ?? [])
    .filter(a => (kit.data?.lines ?? []).some(l => l.areaKey === a.areaKey))
    .map(area => { const ls = (kit.data?.lines ?? []).filter(l => l.areaKey === area.areaKey); return { area, lines: ls, sums: sumUp(ls, kit.data?.items ?? []) }; }), [kit.data]);
  const orphans = items.filter(i => !i.taskId || !lines.some(l => l.taskId === i.taskId));
  const colourOf = useMemo(() => new Map((finishes.data?.options ?? []).map(o => [o.id, o])), [finishes.data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms & Kit" subtitle="Abi's board: what we are buying, room by room, and the colours and floors." />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <TabsList className="h-10">
            <TabsTrigger value="kit" className="px-4"><ShoppingBag className="w-4 h-4 mr-2" />Kit & budgets</TabsTrigger>
            <TabsTrigger value="finishes" className="px-4"><Palette className="w-4 h-4 mr-2" />Colours & finishes</TabsTrigger>
          </TabsList>
          <PaletteStrip data={finishes.data} onPick={goToSurface} />
        </div>

        <TabsContent value="kit" className="mt-0 space-y-6">
          {kit.isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the plan lines…</CardContent></Card>}
          {kit.error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700">Could not load the rooms and kit: {(kit.error as Error).message}</CardContent></Card>}
          {!kit.isLoading && !kit.error && lines.length === 0 && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground">No plan lines are on this page yet. They are set up when the app starts; if this stays empty, the plan tasks could not be matched.</CardContent></Card>}

          {rooms.length > 0 && <RoomSummary rooms={rooms} orphans={orphans} onJump={k => scrollTo(`room-${k}`)} />}

          {rooms.map(room => (
            <RoomSection key={room.area.id} room={room} items={items} finishes={finishes.data} colourOf={colourOf}
              onPatch={(id, patch) => patchItem.mutate({ id, patch })}
              onAdd={(taskId, body) => addItem.mutate({ taskId, ...body })}
              onRemove={id => removeItem.mutate(id)} />
          ))}

          {orphans.length > 0 && (
            <Card className="shadow-sm border-amber-300">
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold">Not attached to a plan line</h2>
                <p className="text-xs text-muted-foreground">These count in the total but against no budget. Attach each to the line it belongs to.</p>
              </CardHeader>
              <CardContent>
                <ul className="divide-y border-t">
                  {orphans.map(it => (
                    <li key={it.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="flex-1 min-w-[140px] truncate font-medium">{it.name}</span>
                      <span className="tabular-nums w-[80px] text-right">{gbp(it.amountGbp)}</span>
                      <Select onValueChange={v => patchItem.mutate({ id: it.id, patch: { taskId: Number(v) } })}>
                        <SelectTrigger className="h-8 text-xs w-[240px]" aria-label={`Attach ${it.name} to a plan line`}><SelectValue placeholder="Attach to a plan line" /></SelectTrigger>
                        <SelectContent>{lines.filter(l => !l.missing).map(l => <SelectItem key={l.taskId} value={String(l.taskId)}>{lineName(l)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${it.name}`} onClick={() => removeItem.mutate(it.id)}><X className="w-4 h-4" /></Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground max-w-4xl leading-relaxed">
            Each budget is a line in the <Link href="/project" className="underline">Plan & Timeline</Link> and moves when the plan does: what was paid if paid, else what is committed, else the selected cost with savings applied. Prices are as you pay them, VAT included where it is charged. The bar shows paid in dark green, ordered in light green, planned in blue and anything over budget in red.
          </p>
        </TabsContent>

        <TabsContent value="finishes" className="mt-0">
          <FinishesBoard projectId={PROJECT_ID} data={finishes.data} isLoading={finishes.isLoading} error={(finishes.error as Error | null) ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The colours chosen so far, as small chips beside the tabs. A chip opens its surface.
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mr-1">Colours chosen</span>
      {chosen.length === 0 && <span className="text-xs text-muted-foreground">none yet</span>}
      {chosen.map(({ s, o }) => (
        <button key={s.id} type="button" onClick={() => onPick(s.id)} title={`${s.name}: ${o.name}`} className="inline-flex items-center gap-1.5 rounded-full border bg-card pl-0.5 pr-2.5 py-0.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Swatch hex={o.hex} className="w-5 h-5 rounded-full" />
          <span className="font-medium">{shortName(s)}</span>
        </button>
      ))}
    </div>
  );
}

// Under or over budget, as a pill; nothing yet when the line has neither.
function Position({ left, empty }: { left: number; empty?: boolean }) {
  if (empty) return <span className="text-xs text-muted-foreground whitespace-nowrap">nothing yet</span>;
  const over = left < 0;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${over ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{over ? `${gbp(-left)} over` : `${gbp(left)} under`}</span>;
}

function Meter({ s, className = "" }: { s: Sums; className?: string }) {
  const base = Math.max(s.budget, s.planned, 1);
  const pct = (v: number) => `${(100 * Math.max(0, v) / base).toFixed(1)}%`;
  const paid = Math.min(s.paid, s.budget);
  const ordered = Math.min(s.ordered, Math.max(0, s.budget - s.paid));
  const plannedOnly = Math.max(0, Math.min(s.planned, s.budget) - Math.min(s.bought, s.budget));
  return (
    <div className={`h-1.5 rounded-full bg-muted overflow-hidden flex ${className}`} role="img" aria-label={`Planned ${gbp(s.planned)} against a budget of ${gbp(s.budget)}`}>
      <i className="block h-full bg-emerald-600" style={{ width: pct(paid) }} />
      <i className="block h-full bg-emerald-400" style={{ width: pct(ordered) }} />
      <i className="block h-full bg-sky-400" style={{ width: pct(plannedOnly) }} />
      {s.planned > s.budget && <i className="block h-full bg-rose-500" style={{ width: pct(s.planned - s.budget) }} />}
    </div>
  );
}

// The top of the board: every room with its budget, what is planned and bought, and where it stands.
function RoomSummary({ rooms, orphans, onJump }: { rooms: Room[]; orphans: Item[]; onJump: (areaKey: string) => void }) {
  const orphanPlanned = orphans.reduce((s, i) => s + i.amountGbp, 0);
  const orphanBought = orphans.filter(i => i.status !== "planned").reduce((s, i) => s + i.amountGbp, 0);
  const budget = rooms.reduce((s, r) => s + r.sums.budget, 0);
  const planned = rooms.reduce((s, r) => s + r.sums.planned, 0) + orphanPlanned;
  const bought = rooms.reduce((s, r) => s + r.sums.bought, 0) + orphanBought;
  const th = "font-medium px-3 py-2.5";
  return (
    <Card className="shadow-sm overflow-hidden">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Budget, planned and bought, by room</caption>
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className={`${th} text-left pl-4`}>Room</th>
            <th scope="col" className={`${th} text-right hidden sm:table-cell`}>Budget</th>
            <th scope="col" className={`${th} text-right`}>Planned</th>
            <th scope="col" className={`${th} text-right hidden md:table-cell`}>Bought</th>
            <th scope="col" className={`${th} text-right pr-4`}>Position</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rooms.map(({ area, sums }) => {
            const Icon = iconFor(area.areaKey);
            return (
              <tr key={area.id} className="hover:bg-muted/30">
                <th scope="row" className="text-left font-normal pl-4 pr-3 py-2.5">
                  <button type="button" onClick={() => onJump(area.areaKey)} className="flex items-center gap-2.5 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true"><Icon className="w-4 h-4" /></span>
                    <span className="font-medium hover:underline underline-offset-2">{area.name}</span>
                  </button>
                  {(sums.budget > 0 || sums.planned > 0) && <Meter s={sums} className="mt-2 ml-[38px] max-w-[240px]" />}
                </th>
                <td className="text-right px-3 hidden sm:table-cell">{gbp(sums.budget)}</td>
                <td className="text-right px-3">{gbp(sums.planned)}</td>
                <td className="text-right px-3 hidden md:table-cell">{gbp(sums.bought)}</td>
                <td className="text-right pl-3 pr-4"><Position left={sums.left} empty={sums.budget === 0 && sums.planned === 0} /></td>
              </tr>
            );
          })}
          {orphans.length > 0 && (
            <tr>
              <th scope="row" className="text-left font-normal pl-4 pr-3 py-2.5 text-amber-800">Not attached to a line</th>
              <td className="text-right px-3 hidden sm:table-cell text-muted-foreground">£0</td>
              <td className="text-right px-3">{gbp(orphanPlanned)}</td>
              <td className="text-right px-3 hidden md:table-cell">{gbp(orphanBought)}</td>
              <td className="text-right pl-3 pr-4"><Position left={-orphanPlanned} /></td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t-2 bg-muted/20 font-semibold">
          <tr>
            <th scope="row" className="text-left pl-4 pr-3 py-3">All rooms</th>
            <td className="text-right px-3 hidden sm:table-cell">{gbp(budget)}</td>
            <td className="text-right px-3">{gbp(planned)}</td>
            <td className="text-right px-3 hidden md:table-cell">{gbp(bought)}</td>
            <td className="text-right pl-3 pr-4"><Position left={budget - planned} /></td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

function RoomSection({ room, items, finishes, colourOf, onPatch, onAdd, onRemove }: {
  room: Room; items: Item[]; finishes?: FinishesData; colourOf: Map<number, FinishOption>;
  onPatch: (id: number, patch: ItemPatch) => void; onAdd: (taskId: number, body: NewItem) => void; onRemove: (id: number) => void;
}) {
  const { area, lines, sums } = room;
  const Icon = iconFor(area.areaKey);
  return (
    <Card id={`room-${area.areaKey}`} className="shadow-sm scroll-mt-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="flex items-start gap-3 min-w-[220px] flex-1">
            <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true"><Icon className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>{area.name}</h2>
              {area.covers && <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">{area.covers}</p>}
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="text-sm tabular-nums"><span className="font-semibold">{gbp(sums.planned)}</span> <span className="text-muted-foreground">planned of {gbp(sums.budget)}</span></div>
            <div className="mt-1"><Position left={sums.left} empty={sums.budget === 0 && sums.planned === 0} /></div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y border-t">
          {lines.map(line => (
            <LineBlock key={line.id} line={line} items={items.filter(i => i.taskId === line.taskId)} Icon={Icon}
              finishes={finishes} colourOf={colourOf}
              onPatch={onPatch} onAdd={body => onAdd(line.taskId, body)} onRemove={onRemove} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LineBlock({ line, items, Icon, finishes, colourOf, onPatch, onAdd, onRemove }: {
  line: Line; items: Item[]; Icon: LucideIcon; finishes?: FinishesData; colourOf: Map<number, FinishOption>;
  onPatch: (id: number, patch: ItemPatch) => void; onAdd: (body: NewItem) => void; onRemove: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const paint = line.areaKey === "paint";
  const s = sumUp([line], items);
  const savings = line.savingBaseline != null && line.savingApplied && line.savingBaseline !== line.budgetGbp ? `was ${gbp(line.savingBaseline)} before savings` : null;
  const planState = line.planStatus === "paid" ? "paid in the plan" : line.planStatus === "part-paid" ? "part-paid in the plan" : line.planStatus === "committed" ? "committed in the plan" : null;
  const meta = line.missing ? "This line has been removed from the plan." : [`Plan budget ${gbp(line.budgetGbp)} ${line.basis}`, savings, planState].filter(Boolean).join(" · ");
  return (
    <section className="py-4 space-y-2.5" aria-label={lineName(line)}>
      <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-[200px] flex-1">
          <h3 className="text-sm font-semibold leading-snug" title={`In the plan as: ${line.title}`}>{lineName(line)}</h3>
          <p className={`text-xs ${line.missing ? "text-amber-700" : "text-muted-foreground"}`}>{meta}</p>
        </div>
        <div className="flex items-center gap-2 text-xs tabular-nums whitespace-nowrap">
          {s.planned > 0 && <span className="text-muted-foreground">{gbp(s.planned)} planned</span>}
          <Position left={s.left} empty={s.budget === 0 && s.planned === 0} />
        </div>
      </div>
      {(s.budget > 0 || s.planned > 0) && <Meter s={s} />}
      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map(it => (
            <ItemRow key={it.id} item={it} paint={paint} Icon={Icon} colour={it.finishOptionId != null ? colourOf.get(it.finishOptionId) ?? null : null}
              finishes={finishes} onPatch={patch => onPatch(it.id, patch)} onRemove={() => onRemove(it.id)} />
          ))}
        </ul>
      )}
      {!line.missing && (adding
        ? <AddItemForm paint={paint} finishes={finishes} onAdd={onAdd} onClose={() => setAdding(false)} />
        : <Button type="button" variant="ghost" size="sm" className="h-8 px-2 -ml-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />{paint ? "Add a paint" : "Add an item"}</Button>)}
    </section>
  );
}

// A picture for every row: the product's picture with its colour along the bottom, the
// colour on its own, or the room's icon, so the rows line up.
function Thumb({ item, hex, Icon }: { item: Item; hex: string | null; Icon: LucideIcon }) {
  const box = "relative block w-10 h-10 rounded-md overflow-hidden shrink-0 border border-black/10";
  if (item.imageUrl) return (
    <a href={item.url ?? item.imageUrl} target="_blank" rel="noreferrer" title={item.linkTitle ?? item.url ?? ""} className={`${box} bg-muted`}>
      <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
      {hex && <span className="absolute inset-x-0 bottom-0 h-3 border-t border-white/80" style={{ background: hex }} />}
    </a>
  );
  if (hex) return <span className={box} style={{ background: hex }} title="Its colour, from the shortlist" />;
  return <span className={`${box} bg-muted/50 flex items-center justify-center text-muted-foreground/50`} aria-hidden="true"><Icon className="w-4 h-4" /></span>;
}

function StatusSelect({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  const tone = STATUSES.find(s => s.value === value)?.tone ?? "";
  return (
    <Select value={value} onValueChange={v => onChange(v as Status)}>
      <SelectTrigger className={`h-8 w-[100px] rounded-full text-xs font-medium shadow-none ${tone}`} aria-label="Status"><SelectValue /></SelectTrigger>
      <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// For paint: which colour on the Colours & finishes shortlist a tin is.
function ColourSelect({ value, finishes, onChange, className = "" }: { value: number | null; finishes?: FinishesData; onChange: (id: number | null) => void; className?: string }) {
  const groups = useMemo(() => {
    if (!finishes) return [] as { s: Surface; options: FinishOption[] }[];
    return [...finishes.surfaces]
      .sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone) || a.sortOrder - b.sortOrder)
      .map(s => ({ s, options: finishes.options.filter(o => o.surfaceId === s.id) }))
      .filter(g => g.options.length > 0);
  }, [finishes]);
  return (
    <Select value={value != null ? String(value) : "none"} onValueChange={v => onChange(v === "none" ? null : Number(v))}>
      <SelectTrigger className={`h-8 text-xs bg-background ${className}`} aria-label="Its colour, from the shortlist"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No colour linked</SelectItem>
        {groups.map(({ s, options }) => (
          <SelectGroup key={s.id}>
            <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{shortName(s)}</SelectLabel>
            {options.map(o => (
              <SelectItem key={o.id} value={String(o.id)}>
                <span className="inline-flex items-center gap-2"><Swatch hex={o.hex} className="w-3.5 h-3.5 rounded-full" />{o.name}{s.chosenOptionId === o.id ? " (chosen)" : ""}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {groups.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Shortlist colours under Colours & finishes first.</div>}
      </SelectContent>
    </Select>
  );
}

function ItemRow({ item, paint, Icon, colour, finishes, onPatch, onRemove }: {
  item: Item; paint: boolean; Icon: LucideIcon; colour: FinishOption | null; finishes?: FinishesData;
  onPatch: (patch: ItemPatch) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Edits look like plain text until hovered or focused.
  const quiet = "h-8 text-sm border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background";
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } };
  return (
    <li className="rounded-md -mx-2 px-2 py-1 hover:bg-muted/40 focus-within:bg-muted/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Thumb item={item} hex={colour?.hex ?? null} Icon={Icon} />
        <Input defaultValue={item.name} aria-label="Item" className={`${quiet} flex-1 min-w-[150px] font-medium`}
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== item.name) onPatch({ name: v }); }} onKeyDown={blurOnEnter} />
        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
            <Input type="number" min={0} step={1} defaultValue={Math.round(item.amountGbp)} aria-label="Price as paid" className={`${quiet} w-[96px] pl-6 tabular-nums`}
              onBlur={e => { const v = Math.round(parseFloat(e.target.value) || 0); if (v !== Math.round(item.amountGbp)) onPatch({ amountGbp: v }); }} onKeyDown={blurOnEnter} />
          </div>
          <StatusSelect value={item.status} onChange={v => onPatch({ status: v })} />
          <Button type="button" size="sm" variant="ghost" className={`h-8 w-8 p-0 ${item.url || colour ? "text-primary" : "text-muted-foreground"}`} aria-expanded={open}
            aria-label={paint ? `Link and colour for ${item.name}` : item.url ? `Change the link for ${item.name}` : `Add a link for ${item.name}`} title={paint ? "Link and colour" : "Link"}
            onClick={() => setOpen(v => !v)}>{paint ? <Palette className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}</Button>
          {confirm
            ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={() => { onRemove(); setConfirm(false); }} onBlur={() => setConfirm(false)}>Sure?</Button>
            : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${item.name}`} onClick={() => setConfirm(true)}><X className="w-4 h-4" /></Button>}
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 pt-2 pb-1 sm:pl-12">
          <Input type="url" defaultValue={item.url ?? ""} placeholder="Paste the product page link: its picture shows here" aria-label={`Link for ${item.name}`} className="h-8 text-sm flex-1 min-w-[200px] bg-background" autoFocus
            onKeyDown={e => { blurOnEnter(e); if (e.key === "Escape") setOpen(false); }}
            onBlur={e => { const v = e.target.value.trim(); if (v !== (item.url ?? "")) onPatch({ url: v }); }} />
          {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline whitespace-nowrap"><ExternalLink className="w-3 h-3" />Open</a>}
          {paint && <ColourSelect value={item.finishOptionId} finishes={finishes} onChange={id => onPatch({ finishOptionId: id })} className="w-[220px]" />}
        </div>
      )}
      {!open && item.linkTitle && !item.imageUrl && item.url && <div className="sm:pl-12 text-[11px] text-muted-foreground truncate"><a href={item.url} target="_blank" rel="noreferrer" className="underline">{item.linkTitle}</a></div>}
    </li>
  );
}

function AddItemForm({ paint, finishes, onAdd, onClose }: { paint: boolean; finishes?: FinishesData; onAdd: (body: NewItem) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("planned");
  const [url, setUrl] = useState("");
  const [colour, setColour] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const optionName = (id: number | null) => (id == null ? "" : finishes?.options.find(o => o.id === id)?.name ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { nameRef.current?.focus(); return; }
    onAdd({ name: n, amountGbp: Math.round(parseFloat(amount) || 0), status, url: url.trim() || undefined, ...(paint ? { finishOptionId: colour } : {}) });
    setName(""); setAmount(""); setStatus("planned"); setUrl(""); setColour(null);
    nameRef.current?.focus();
  };
  return (
    <form onSubmit={submit} aria-label={paint ? "Add a paint" : "Add an item"} className="rounded-lg border bg-muted/30 p-3 space-y-2"
      onKeyDown={e => { if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) onClose(); }}>
      <div className="flex flex-wrap gap-2">
        <Input ref={nameRef} autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={paint ? "Which paint: brand, finish and size" : "What will you buy?"} aria-label="Name" className="h-8 text-sm flex-1 min-w-[180px] bg-background" />
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
          <Input type="number" min={0} step={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="as paid" aria-label="Price as paid" className="h-8 w-[104px] pl-6 text-sm bg-background" />
        </div>
        <StatusSelect value={status} onChange={setStatus} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Product page link (optional): its picture shows here" aria-label="Link" className="h-8 text-sm flex-1 min-w-[200px] bg-background" />
        {paint && <ColourSelect value={colour} finishes={finishes} onChange={id => { setColour(id); if (!name.trim()) setName(optionName(id)); }} className="w-[220px]" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" className="h-8">Add</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onClose}>Done</Button>
        {paint && <span className="text-[11px] text-muted-foreground">Link its colour from the shortlist and the swatch shows on the tin.</span>}
      </div>
    </form>
  );
}
