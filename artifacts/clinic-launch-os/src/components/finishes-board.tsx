// Colours and finishes: Abi's paint and flooring shortlist, one surface at a time, on
// schematics of the shopfront, the reception and a treatment room. Each option is a
// paint chip: the colour, the product's picture and a Choose button. Until a surface
// has a colour chosen, the drawings show the first on its shortlist, marked as such.
// Saved through /api/projects/:id/finishes.
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shopfront, Reception, TreatmentRoom, type Role, type Colours } from "@/components/finish-schematics";
import { X, Pencil, Pipette, Droplet, ExternalLink, Check, Plus } from "lucide-react";

export type Zone = "outside" | "inside" | "floor";
export type Surface = { id: number; zone: Zone; role: Role | null; name: string; brief: string | null; chosenOptionId: number | null; sortOrder: number };
export type Option = { id: number; surfaceId: number; name: string; brand: string | null; code: string | null; finish: string | null; hex: string | null; url: string | null; imageUrl: string | null; linkTitle: string | null; status: "idea" | "sample"; note: string | null; sortOrder: number };
export type FinishesData = { surfaces: Surface[]; options: Option[] };
export type OptionBody = { name?: string; brand?: string | null; code?: string | null; finish?: string | null; hex?: string | null; url?: string | null; note?: string | null; status?: Option["status"] };

export const ZONE_ORDER: Zone[] = ["outside", "inside", "floor"];
const ZONE_LABEL: Record<Zone, { title: string; blurb: string; example: string }> = {
  outside: { title: "Outside", blurb: "The shopfront: the white and the blue.", example: "a hanging sign" },
  inside: { title: "Inside", blurb: "The walls, the feature blue and the woodwork.", example: "the ceilings" },
  floor: { title: "Floors", blurb: "Both are in CBS's contract; the range and colour are Abi's to pick.", example: "the corridor" },
};
const SHORT: Record<Role, string> = { shop_main: "Shopfront", shop_trim: "Door & frames", feature: "Feature wall", walls: "Reception walls", walls_clinical: "Treatment walls", woodwork: "Woodwork", floor_clinical: "Treatment floor", floor_front: "Reception floor" };
export function shortName(s: Surface): string { return s.role ? SHORT[s.role] : s.name; }

const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const HATCH: CSSProperties = { backgroundImage: "repeating-linear-gradient(45deg, #E8E5DF 0 4px, #D3CEC5 4px 6px)" };
export function Swatch({ hex, className = "" }: { hex: string | null; className?: string }) {
  return <span className={`inline-block border border-black/15 shrink-0 ${className}`} style={hex ? { background: hex } : HATCH} aria-hidden="true" />;
}

async function send(method: string, path: string, body?: unknown) {
  const r = await fetch(`/api${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

// An option being tried on the drawings: hovered, or pinned with a click.
type Trying = { role: Role; option: Option } | null;
// What a drawing shows for a role, and why.
type Shown = { hex: string | null; name: string | null; state: "chosen" | "trying" | "shortlist" | "none" };
const NONE: Shown = { hex: null, name: null, state: "none" };

export function FinishesBoard({ projectId, data, isLoading, error }: { projectId: number; data?: FinishesData; isLoading: boolean; error: Error | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["finishes", projectId] });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });
  const base = `/projects/${projectId}/finishes`;
  const addSurface = useMutation({ mutationFn: (b: { zone: Zone; name: string }) => send("POST", `${base}/surfaces`, b), onSuccess: refresh, onError: fail });
  const patchSurface = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<Surface, "name" | "brief" | "chosenOptionId">> }) => send("PATCH", `${base}/surfaces/${id}`, patch), onSuccess: refresh, onError: fail });
  const removeSurface = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/surfaces/${id}`), onSuccess: refresh, onError: fail });
  const addOption = useMutation({ mutationFn: (b: OptionBody & { surfaceId: number }) => send("POST", `${base}/options`, b), onSuccess: refresh, onError: fail });
  const patchOption = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: OptionBody }) => send("PATCH", `${base}/options/${id}`, patch), onSuccess: refresh, onError: fail });
  const removeOption = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/options/${id}`), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["kit", projectId] }); }, onError: fail });

  const [hover, setHover] = useState<Trying>(null);
  const [pinned, setPinned] = useState<Trying>(null);

  const surfaces = useMemo(() => [...(data?.surfaces ?? [])].sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone) || a.sortOrder - b.sortOrder || a.id - b.id), [data]);
  const options = useMemo(() => [...(data?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [data]);
  const byId = useMemo(() => new Map(options.map(o => [o.id, o])), [options]);
  const chosenFor = (s: Surface): Option | null => (s.chosenOptionId != null ? byId.get(s.chosenOptionId) ?? null : null);

  // The chosen colour per role; else the first on the shortlist; a hovered or pinned option on top.
  const shown = useMemo(() => {
    const m: Partial<Record<Role, Shown>> = {};
    for (const s of surfaces) {
      if (!s.role) continue;
      const chosen = s.chosenOptionId != null ? byId.get(s.chosenOptionId) : undefined;
      const first = options.find(o => o.surfaceId === s.id);
      m[s.role] = chosen ? { hex: chosen.hex, name: chosen.name, state: "chosen" } : first ? { hex: first.hex, name: first.name, state: "shortlist" } : NONE;
    }
    for (const t of [pinned, hover]) if (t) m[t.role] = { hex: t.option.hex, name: t.option.name, state: "trying" };
    return m;
  }, [surfaces, options, byId, hover, pinned]);
  const colours = useMemo<Colours>(() => {
    const c: Colours = {};
    for (const [role, v] of Object.entries(shown) as [Role, Shown][]) c[role] = v.hex;
    return c;
  }, [shown]);
  const legend = (roles: Role[]) => roles.map(r => ({ role: r, label: SHORT[r], ...(shown[r] ?? NONE) }));
  const tryOn = (s: Surface, o: Option | null): Trying => (o && s.role ? { role: s.role, option: o } : null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SchematicCard title="Shopfront" legend={legend(["shop_main", "shop_trim"])}><Shopfront c={colours} /></SchematicCard>
        <SchematicCard title="Reception" legend={legend(["feature", "walls", "woodwork", "floor_front"])}><Reception c={colours} /></SchematicCard>
        <SchematicCard title="Treatment rooms" legend={legend(["walls_clinical", "woodwork", "floor_clinical"])}><TreatmentRoom c={colours} /></SchematicCard>
      </div>
      <p className="text-xs text-muted-foreground max-w-4xl leading-relaxed">
        Hover a colour to try it on the drawings; click it to keep it there while you compare
        {pinned ? <>, or <button type="button" className="underline" onClick={() => setPinned(null)}>stop trying {pinned.option.name}</button></> : null}.
        {" "}Until a surface has a colour chosen, the drawings show the first on its shortlist. A screen is not a sample pot: put a tester on the wall before anything is ordered.
      </p>

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the colours and finishes…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700">Could not load the colours and finishes: {error.message}</CardContent></Card>}

      {ZONE_ORDER.map(zone => (
        <Card key={zone} className="shadow-sm">
          <CardHeader className="pb-3">
            <h2 className="text-2xl font-semibold leading-tight" style={SERIF}>{ZONE_LABEL[zone].title}</h2>
            <p className="text-xs text-muted-foreground">{ZONE_LABEL[zone].blurb}</p>
          </CardHeader>
          <CardContent>
            <div className="divide-y border-t">
              {surfaces.filter(s => s.zone === zone).map(s => (
                <SurfaceRow key={s.id} surface={s} options={options.filter(o => o.surfaceId === s.id)} chosen={chosenFor(s)} pinnedId={pinned?.option.id ?? null}
                  onHover={o => setHover(tryOn(s, o))}
                  onPin={o => setPinned(p => (p?.option.id === o.id ? null : tryOn(s, o)))}
                  onChoose={id => patchSurface.mutate({ id: s.id, patch: { chosenOptionId: id } })}
                  onPatchSurface={patch => patchSurface.mutate({ id: s.id, patch })}
                  onRemoveSurface={() => removeSurface.mutate(s.id)}
                  onAdd={b => addOption.mutate({ surfaceId: s.id, ...b })}
                  onPatch={(id, patch) => patchOption.mutate({ id, patch })}
                  onRemove={id => removeOption.mutate(id)} />
              ))}
            </div>
            <AddSurface zone={zone} onAdd={name => addSurface.mutate({ zone, name })} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SchematicCard({ title, legend, children }: { title: string; legend: ({ role: Role; label: string } & Shown)[]; children: ReactNode }) {
  return (
    <Card className="shadow-sm overflow-hidden">
      <div className="bg-muted/40 border-b">{children}</div>
      <CardContent className="p-3 space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        {legend.map(l => (
          <div key={l.role} className="flex items-center gap-2 text-xs min-w-0">
            <Swatch hex={l.hex} className="w-3.5 h-3.5 rounded-full" />
            <span className="text-muted-foreground shrink-0">{l.label}:</span>
            <span className={`truncate ${l.state === "none" ? "italic text-muted-foreground" : l.state === "chosen" ? "font-medium" : ""}`}>{l.name ?? "nothing shortlisted"}</span>
            {l.state === "shortlist" && <span className="shrink-0 rounded px-1 py-px text-[10px] bg-muted text-muted-foreground">shortlisted</span>}
            {l.state === "trying" && <span className="shrink-0 rounded px-1 py-px text-[10px] bg-primary/10 text-primary">trying</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SurfaceRow({ surface: s, options, chosen, pinnedId, onHover, onPin, onChoose, onPatchSurface, onRemoveSurface, onAdd, onPatch, onRemove }: {
  surface: Surface; options: Option[]; chosen: Option | null; pinnedId: number | null;
  onHover: (o: Option | null) => void; onPin: (o: Option) => void; onChoose: (optionId: number | null) => void;
  onPatchSurface: (patch: Partial<Pick<Surface, "name" | "brief">>) => void; onRemoveSurface: () => void;
  onAdd: (b: OptionBody) => void; onPatch: (id: number, patch: OptionBody) => void; onRemove: (id: number) => void;
}) {
  const [form, setForm] = useState<"new" | number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [brief, setBrief] = useState(s.brief ?? "");
  const [confirm, setConfirm] = useState(false);
  const drawn = !!s.role;
  const editingOption = typeof form === "number" ? options.find(o => o.id === form) : undefined;
  return (
    <section id={`surface-${s.id}`} aria-label={s.name} className="py-4 space-y-3 scroll-mt-4">
      <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-[200px] flex-1 max-w-3xl">
          <h3 className="text-sm font-semibold leading-snug">{s.name}</h3>
          {s.brief && !editing && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.brief}</p>}
          {!drawn && <p className="text-[11px] text-muted-foreground mt-0.5 italic">Not on the drawings.</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {chosen
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium pl-1 pr-2.5 py-0.5"><Swatch hex={chosen.hex} className="w-4 h-4 rounded-full" />{chosen.name}</span>
            : <span className="text-xs italic text-muted-foreground mr-1">Not chosen yet</span>}
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Rename ${s.name}`} aria-expanded={editing} onClick={() => { setName(s.name); setBrief(s.brief ?? ""); setEditing(v => !v); }}><Pencil className="w-4 h-4" /></Button>
          {confirm
            ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={onRemoveSurface} onBlur={() => setConfirm(false)}>Sure?</Button>
            : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${s.name} and its shortlist`} onClick={() => setConfirm(true)}><X className="w-4 h-4" /></Button>}
        </div>
      </div>
      {editing && (
        <form className="grid gap-2 max-w-3xl" onSubmit={e => { e.preventDefault(); const n = name.trim(); if (!n) return; onPatchSurface({ name: n, brief: brief.trim() || null }); setEditing(false); }}>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" aria-label="Surface name" />
          <Input value={brief} onChange={e => setBrief(e.target.value)} placeholder="What this surface is and what constrains it" className="h-8 text-sm" aria-label="Brief" />
          <div className="flex gap-2"><Button type="submit" size="sm" className="h-8">Save</Button><Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {options.map(o => (
          <Chip key={o.id} option={o} chosen={chosen?.id === o.id} pinned={pinnedId === o.id} drawn={drawn}
            onHover={onHover} onPin={onPin}
            onChoose={() => onChoose(chosen?.id === o.id ? null : o.id)}
            onEdit={() => setForm(form === o.id ? null : o.id)}
            onPatch={patch => onPatch(o.id, patch)}
            onRemove={() => onRemove(o.id)} />
        ))}
        <button type="button" onClick={() => setForm(form === "new" ? null : "new")} aria-expanded={form === "new"}
          className="min-h-[164px] rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="w-5 h-5" />Add a colour
        </button>
      </div>
      {form === "new" && <div className="rounded-lg border bg-muted/30 p-3"><OptionForm key="new" label="Add" onSubmit={onAdd} onCancel={() => setForm(null)} /></div>}
      {editingOption && <div className="rounded-lg border bg-muted/30 p-3"><OptionForm key={editingOption.id} initial={editingOption} label="Save" onSubmit={b => { onPatch(editingOption.id, b); setForm(null); }} onCancel={() => setForm(null)} /></div>}
    </section>
  );
}

// A paint chip: the colour as the card, the product's picture set into its corner.
function Chip({ option: o, chosen, pinned, drawn, onHover, onPin, onChoose, onEdit, onPatch, onRemove }: {
  option: Option; chosen: boolean; pinned: boolean; drawn: boolean;
  onHover: (o: Option | null) => void; onPin: (o: Option) => void; onChoose: () => void; onEdit: () => void; onPatch: (patch: OptionBody) => void; onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const sample = o.status === "sample";
  const details = [o.brand, o.code, o.finish].filter(Boolean).join(", ");
  return (
    <div className={`relative flex flex-col rounded-lg border bg-card overflow-hidden transition-shadow ${chosen ? "border-primary ring-2 ring-primary/25" : pinned ? "border-primary/60 ring-2 ring-primary/10" : "hover:shadow-md"}`}
      onMouseEnter={() => drawn && onHover(o)} onMouseLeave={() => drawn && onHover(null)}>
      <div className="relative h-20 border-b border-black/10" style={o.hex ? { background: o.hex } : HATCH}>
        <button type="button" disabled={!drawn} aria-pressed={pinned}
          aria-label={drawn ? (pinned ? `Stop trying ${o.name} on the drawings` : `Try ${o.name} on the drawings`) : o.name}
          title={drawn ? (pinned ? "Stop trying this on the drawings" : "Try this on the drawings") : "This surface is not on the drawings"}
          className="absolute inset-0 w-full h-full cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => onPin(o)} onFocus={() => drawn && onHover(o)} onBlur={() => drawn && onHover(null)} />
        {chosen && <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm pointer-events-none"><Check className="w-3 h-3" />Chosen</span>}
        <button type="button" onClick={() => onPatch({ status: sample ? "idea" : "sample" })} aria-pressed={sample} aria-label={`${o.name}: sample pot in hand`} title={sample ? "Sample pot in hand" : "Mark: sample pot in hand"}
          className={`absolute right-1.5 top-1.5 z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sample ? "bg-primary text-primary-foreground" : "bg-white/90 text-slate-500 hover:text-slate-900"}`}>
          <Droplet className="w-3.5 h-3.5" />
        </button>
        {o.imageUrl
          ? <a href={o.url ?? o.imageUrl} target="_blank" rel="noreferrer" title={o.linkTitle ?? o.url ?? ""} className="absolute right-1.5 bottom-1.5 z-10 block w-11 h-11 rounded-md overflow-hidden ring-2 ring-white shadow bg-muted">
              <img src={o.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
            </a>
          : o.url ? <a href={o.url} target="_blank" rel="noreferrer" aria-label={`Open the page for ${o.name}`} className="absolute right-1.5 bottom-1.5 z-10 w-6 h-6 rounded-full bg-white/90 text-slate-600 flex items-center justify-center shadow-sm"><ExternalLink className="w-3 h-3" /></a> : null}
        {!o.hex && <span className="absolute left-2 bottom-1.5 text-[10px] font-medium text-slate-600 pointer-events-none">No colour set</span>}
      </div>
      <div className="flex-1 flex flex-col gap-0.5 p-2.5 bg-muted/30">
        <div className="text-xs font-semibold leading-tight truncate" title={o.name}>{o.name}</div>
        <div className="text-[10px] text-muted-foreground truncate" title={details || undefined}>{details || o.hex || " "}</div>
        {sample && <div className="text-[10px] text-primary font-medium">Sample in hand</div>}
        <div className="mt-auto flex items-center gap-1 pt-2">
          <Button type="button" size="sm" variant={chosen ? "default" : "outline"} className="h-7 flex-1 px-1.5 text-[11px]" onClick={onChoose} title={chosen ? "Un-choose" : "Choose this one"}>{chosen ? "Chosen" : "Choose"}</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label={`Edit ${o.name}`} onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          {confirm
            ? <Button type="button" size="sm" variant="destructive" className="h-7 px-1.5 text-[11px]" onClick={onRemove} onBlur={() => setConfirm(false)}>Sure?</Button>
            : <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label={`Remove ${o.name}`} onClick={() => setConfirm(true)}><X className="w-3.5 h-3.5" /></Button>}
        </div>
      </div>
    </div>
  );
}

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

function OptionForm({ initial, label, onSubmit, onCancel }: { initial?: Option; label: string; onSubmit: (b: OptionBody) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [finish, setFinish] = useState(initial?.finish ?? "");
  const [hex, setHex] = useState(initial?.hex ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const canPick = typeof window !== "undefined" && !!(window as EyeDropperWindow).EyeDropper;
  const pick = async () => {
    const Dropper = (window as EyeDropperWindow).EyeDropper; if (!Dropper) return;
    try { const r = await new Dropper().open(); if (r?.sRGBHex) setHex(r.sRGBHex.toUpperCase()); } catch { /* closed without picking */ }
  };
  const trimmed = hex.trim();
  const validHex = /^#?[0-9a-f]{6}$/i.test(trimmed);
  const asHex = validHex ? `#${trimmed.replace("#", "").toUpperCase()}` : null;
  const field = "h-8 text-sm bg-background";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim(); if (!n || (trimmed && !validHex)) return;
    onSubmit({ name: n, brand: brand.trim() || null, code: code.trim() || null, finish: finish.trim() || null, hex: asHex, url: url.trim() || null, ...(initial ? { note: note.trim() || null } : {}) });
    if (!initial) { setName(""); setBrand(""); setCode(""); setFinish(""); setHex(""); setUrl(""); }
  };
  return (
    <form onSubmit={submit} className="space-y-2" onKeyDown={e => { if (e.key === "Escape") onCancel(); }}>
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2">
        <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={initial ? "Name" : "Colour or product, e.g. Hague Blue"} aria-label="Name" className={field} />
        <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" aria-label="Brand" className={field} />
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Code or number" aria-label="Code" className={field} />
        <Input value={finish} onChange={e => setFinish(e.target.value)} placeholder="Finish: matt, eggshell, vinyl" aria-label="Finish" className={field} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={asHex ?? "#EFF3F8"} onChange={e => setHex(e.target.value.toUpperCase())} aria-label="Pick the swatch colour" className="h-8 w-9 rounded-md border border-input bg-background p-0.5 cursor-pointer" />
        {canPick && <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title="Pick a colour from anywhere on your screen, a product photo included" aria-label="Pick a colour from the screen" onClick={pick}><Pipette className="w-4 h-4" /></Button>}
        <Input value={hex} onChange={e => setHex(e.target.value)} placeholder="#1F2A44" aria-label="Hex colour" className={`${field} w-[112px] font-mono ${trimmed && !validHex ? "border-rose-400" : ""}`} />
        <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Product page link (optional): its picture shows on the chip" aria-label="Link" className={`${field} flex-1 min-w-[220px]`} />
      </div>
      {initial && <Input value={note} onChange={e => setNote(e.target.value)} placeholder="A note: where it goes, what the sample looked like on the wall" aria-label="Note" className={field} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" className="h-8">{label}</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>{initial ? "Cancel" : "Done"}</Button>
        {trimmed && !validHex && <span className="text-[11px] text-rose-700">A colour is six hex digits, like #1F2A44.</span>}
      </div>
    </form>
  );
}

function AddSurface({ zone, onAdd }: { zone: Zone; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="border-t pt-2">
      {open
        ? <form className="flex flex-wrap items-center gap-2 pt-1" onSubmit={e => { e.preventDefault(); const n = name.trim(); if (!n) return; onAdd(n); setName(""); setOpen(false); }} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
            <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={`Another ${zone === "floor" ? "floor" : "surface"} to decide, e.g. ${ZONE_LABEL[zone].example}`} aria-label={`New ${zone} surface`} className="h-8 text-sm flex-1 min-w-[220px]" />
            <Button type="submit" size="sm" className="h-8">Add</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>Cancel</Button>
          </form>
        : <Button type="button" variant="ghost" size="sm" className="h-8 px-2 -ml-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add another {zone === "floor" ? "floor" : "surface"}</Button>}
    </div>
  );
}
