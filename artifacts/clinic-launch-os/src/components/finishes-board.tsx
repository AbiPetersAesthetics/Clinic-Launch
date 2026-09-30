// Colours and finishes: Abi's paint and flooring shortlist, one surface at a time,
// drawn onto schematics of the shopfront, the reception and a treatment room as she
// chooses. Options carry a swatch (a hex colour), the product details and a link,
// whose picture the server fetches. Saved through /api/projects/:id/finishes.
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shopfront, Reception, TreatmentRoom, type Role, type Colours } from "@/components/finish-schematics";
import { X, Pencil, Pipette, Droplet, ExternalLink, Check } from "lucide-react";

export type Zone = "outside" | "inside" | "floor";
export type Surface = { id: number; zone: Zone; role: Role | null; name: string; brief: string | null; chosenOptionId: number | null; sortOrder: number };
export type Option = { id: number; surfaceId: number; name: string; brand: string | null; code: string | null; finish: string | null; hex: string | null; url: string | null; imageUrl: string | null; linkTitle: string | null; status: "idea" | "sample"; note: string | null; sortOrder: number };
export type FinishesData = { surfaces: Surface[]; options: Option[] };
export type OptionBody = { name?: string; brand?: string | null; code?: string | null; finish?: string | null; hex?: string | null; url?: string | null; note?: string | null; status?: Option["status"] };

export const ZONE_ORDER: Zone[] = ["outside", "inside", "floor"];
const ZONE_LABEL: Record<Zone, { title: string; blurb: string; example: string }> = {
  outside: { title: "Outside", blurb: "The shopfront: the white and the blue.", example: "a hanging sign" },
  inside: { title: "Inside", blurb: "The walls, the feature panelling and the woodwork.", example: "the ceilings" },
  floor: { title: "Floors", blurb: "Both in CBS's contract; the range and colour are Abi's to pick.", example: "the corridor" },
};
const SHORT: Record<Role, string> = { shop_main: "Shopfront", shop_trim: "Door & frames", feature: "Feature wall", walls: "Walls", walls_clinical: "Clinical walls", woodwork: "Woodwork", floor_clinical: "Treatment floor", floor_front: "Front floor" };
export function shortName(s: Surface): string { return s.role ? SHORT[s.role] : s.name; }

const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const HATCH: CSSProperties = { backgroundImage: "repeating-linear-gradient(45deg, #E8E5DF 0 4px, #D3CEC5 4px 6px)" };
export function Swatch({ hex, className = "" }: { hex: string | null; className?: string }) {
  return <span className={`inline-block border border-black/10 shrink-0 ${className}`} style={hex ? { background: hex } : HATCH} aria-hidden="true" />;
}

async function send(method: string, path: string, body?: unknown) {
  const r = await fetch(`/api${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || `Request failed (${r.status})`); }
  return r.json();
}

// An option being tried on the drawings: hovered, or pinned with a click.
type Trying = { role: Role; option: Option } | null;

export function FinishesBoard({ projectId, data, isLoading, error }: { projectId: number; data?: FinishesData; isLoading: boolean; error: Error | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["finishes", projectId];
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast({ title: "That did not save", description: e instanceof Error ? e.message : "Try again in a moment.", variant: "destructive" });
  const base = `/projects/${projectId}/finishes`;
  const addSurface = useMutation({ mutationFn: (b: { zone: Zone; name: string }) => send("POST", `${base}/surfaces`, b), onSuccess: refresh, onError: fail });
  const patchSurface = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<Surface, "name" | "brief" | "chosenOptionId">> }) => send("PATCH", `${base}/surfaces/${id}`, patch), onSuccess: refresh, onError: fail });
  const removeSurface = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/surfaces/${id}`), onSuccess: refresh, onError: fail });
  const addOption = useMutation({ mutationFn: (b: OptionBody & { surfaceId: number }) => send("POST", `${base}/options`, b), onSuccess: refresh, onError: fail });
  const patchOption = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: OptionBody }) => send("PATCH", `${base}/options/${id}`, patch), onSuccess: refresh, onError: fail });
  const removeOption = useMutation({ mutationFn: (id: number) => send("DELETE", `${base}/options/${id}`), onSuccess: refresh, onError: fail });

  const [hover, setHover] = useState<Trying>(null);
  const [pinned, setPinned] = useState<Trying>(null);

  const surfaces = useMemo(() => [...(data?.surfaces ?? [])].sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone) || a.sortOrder - b.sortOrder || a.id - b.id), [data]);
  const options = data?.options ?? [];
  const byId = useMemo(() => new Map(options.map(o => [o.id, o])), [options]);
  const chosenFor = (s: Surface): Option | null => (s.chosenOptionId != null ? byId.get(s.chosenOptionId) ?? null : null);

  // What the drawings show: the chosen option per role, then whatever is pinned, then whatever is hovered.
  const colours = useMemo<Colours>(() => {
    const c: Colours = {};
    for (const s of surfaces) if (s.role) c[s.role] = (s.chosenOptionId != null ? byId.get(s.chosenOptionId)?.hex : null) ?? null;
    for (const t of [pinned, hover]) if (t) c[t.role] = t.option.hex;
    return c;
  }, [surfaces, byId, hover, pinned]);
  const showing = (role: Role): { name: string | null; trying: boolean } => {
    for (const t of [hover, pinned]) if (t && t.role === role) return { name: t.option.name, trying: true };
    const s = surfaces.find(x => x.role === role);
    const o = s ? chosenFor(s) : null;
    return { name: o?.name ?? null, trying: false };
  };
  const legend = (roles: Role[]) => roles.map(r => ({ role: r, label: SHORT[r], hex: colours[r] ?? null, ...showing(r) }));

  const tryOn = (s: Surface, o: Option | null): Trying => (o && s.role ? { role: s.role, option: o } : null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SchematicCard title="Shopfront" legend={legend(["shop_main", "shop_trim"])}><Shopfront c={colours} /></SchematicCard>
        <SchematicCard title="Reception" legend={legend(["feature", "walls", "woodwork", "floor_front"])}><Reception c={colours} /></SchematicCard>
        <SchematicCard title="Treatment room" legend={legend(["walls_clinical", "woodwork", "floor_clinical"])}><TreatmentRoom c={colours} /></SchematicCard>
      </div>
      <p className="text-xs text-muted-foreground">
        Schematics to compare combinations, not renders. Hover a swatch to try it on the drawings; click it to keep it there while you look at the others.{" "}
        {pinned && <button type="button" className="underline" onClick={() => setPinned(null)}>Stop trying {pinned.option.name}.</button>}{" "}
        A screen is not a sample pot: confirm on the wall with a tester before anything is ordered.
      </p>

      {isLoading && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-muted-foreground animate-pulse">Loading the colours and finishes…</CardContent></Card>}
      {error && <Card className="shadow-sm"><CardContent className="p-6 text-sm text-rose-700 dark:text-rose-400">Could not load the colours and finishes: {error.message}</CardContent></Card>}

      {ZONE_ORDER.map(zone => (
        <section key={zone} className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold leading-tight" style={SERIF}>{ZONE_LABEL[zone].title}</h2>
            <p className="text-xs text-muted-foreground">{ZONE_LABEL[zone].blurb}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {surfaces.filter(s => s.zone === zone).map(s => (
              <SurfaceCard key={s.id} surface={s} options={options.filter(o => o.surfaceId === s.id)} chosen={chosenFor(s)} pinnedId={pinned?.option.id ?? null}
                onHover={o => setHover(tryOn(s, o))}
                onPin={o => setPinned(p => (p?.option.id === o.id ? null : tryOn(s, o)))}
                onChoose={id => patchSurface.mutate({ id: s.id, patch: { chosenOptionId: id } })}
                onPatchSurface={patch => patchSurface.mutate({ id: s.id, patch })}
                onRemoveSurface={() => removeSurface.mutate(s.id)}
                onAdd={b => addOption.mutate({ surfaceId: s.id, ...b })}
                onPatch={(id, patch) => patchOption.mutate({ id, patch })}
                onRemove={id => removeOption.mutate(id)} />
            ))}
            <AddSurface zone={zone} onAdd={name => addSurface.mutate({ zone, name })} />
          </div>
        </section>
      ))}
    </div>
  );
}

function SchematicCard({ title, legend, children }: { title: string; legend: { role: Role; label: string; hex: string | null; name: string | null; trying: boolean }[]; children: ReactNode }) {
  return (
    <Card className="shadow-sm overflow-hidden">
      <div className="bg-muted/40 border-b">{children}</div>
      <CardContent className="p-3 space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        {legend.map(l => (
          <div key={l.role} className="flex items-center gap-2 text-xs min-w-0">
            <Swatch hex={l.hex} className="w-3.5 h-3.5 rounded-full" />
            <span className="text-muted-foreground shrink-0">{l.label}:</span>
            <span className={`truncate ${l.name ? "" : "text-muted-foreground italic"}`}>{l.name ?? "not chosen yet"}{l.trying ? " (trying)" : ""}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SurfaceCard({ surface: s, options, chosen, pinnedId, onHover, onPin, onChoose, onPatchSurface, onRemoveSurface, onAdd, onPatch, onRemove }: {
  surface: Surface; options: Option[]; chosen: Option | null; pinnedId: number | null;
  onHover: (o: Option | null) => void; onPin: (o: Option) => void; onChoose: (optionId: number | null) => void;
  onPatchSurface: (patch: Partial<Pick<Surface, "name" | "brief">>) => void; onRemoveSurface: () => void;
  onAdd: (b: OptionBody) => void; onPatch: (id: number, patch: OptionBody) => void; onRemove: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [brief, setBrief] = useState(s.brief ?? "");
  const [confirm, setConfirm] = useState(false);
  return (
    <Card id={`surface-${s.id}`} className="shadow-sm scroll-mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-snug">{s.name}</CardTitle>
            {chosen
              ? <div className="flex items-center gap-1.5 text-xs mt-1"><Swatch hex={chosen.hex} className="w-3.5 h-3.5 rounded-full" /><span className="font-medium">{chosen.name}</span><span className="text-muted-foreground">chosen</span></div>
              : <div className="text-xs text-muted-foreground mt-1 italic">Nothing chosen yet</div>}
            {s.brief && !editing && <p className="text-xs text-muted-foreground mt-1">{s.brief}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Edit ${s.name}`} aria-expanded={editing} onClick={() => { setName(s.name); setBrief(s.brief ?? ""); setEditing(v => !v); }}><Pencil className="w-4 h-4" /></Button>
            {confirm
              ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={onRemoveSurface} onBlur={() => setConfirm(false)}>Sure?</Button>
              : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${s.name} and its shortlist`} onClick={() => setConfirm(true)}><X className="w-4 h-4" /></Button>}
          </div>
        </div>
        {editing && (
          <form className="grid gap-1.5 pt-2" onSubmit={e => { e.preventDefault(); const n = name.trim(); if (!n) return; onPatchSurface({ name: n, brief: brief.trim() || null }); setEditing(false); }}>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" aria-label="Surface name" />
            <Input value={brief} onChange={e => setBrief(e.target.value)} placeholder="What this surface is and what constrains it" className="h-8 text-sm" aria-label="Brief" />
            <div className="flex gap-1"><Button type="submit" size="sm" className="h-8">Save</Button><Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button></div>
          </form>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {options.length === 0 && <p className="text-xs text-muted-foreground">Nothing shortlisted yet. Add a colour or a product below; paste its page link and the picture comes with it.</p>}
        {options.map(o => (
          <OptionRow key={o.id} option={o} chosen={chosen?.id === o.id} pinned={pinnedId === o.id} drawn={!!s.role}
            onHover={onHover} onPin={onPin}
            onChoose={() => onChoose(chosen?.id === o.id ? null : o.id)}
            onPatch={patch => onPatch(o.id, patch)}
            onRemove={() => onRemove(o.id)} />
        ))}
        <OptionForm label="Add" onSubmit={onAdd} />
      </CardContent>
    </Card>
  );
}

function OptionRow({ option: o, chosen, pinned, drawn, onHover, onPin, onChoose, onPatch, onRemove }: {
  option: Option; chosen: boolean; pinned: boolean; drawn: boolean;
  onHover: (o: Option | null) => void; onPin: (o: Option) => void; onChoose: () => void; onPatch: (patch: OptionBody) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const details = [o.brand, o.code, o.finish, o.hex].filter(Boolean).join(", ");
  const sample = o.status === "sample";
  return (
    <div className={`rounded-md border p-2 ${chosen ? "border-primary/60 bg-primary/5" : pinned ? "border-dashed border-primary/60" : "border-border"}`}
      onMouseEnter={() => drawn && onHover(o)} onMouseLeave={() => drawn && onHover(null)}>
      {/* One line on a desk; on a phone the controls wrap under the name. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <button type="button" className="w-10 h-10 sm:w-11 sm:h-11 rounded-md border border-black/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default" style={o.hex ? { background: o.hex } : HATCH}
          title={drawn ? (pinned ? "Stop trying this on the drawings" : "Try this on the drawings") : "This surface is not on the drawings"} aria-label={`${o.name}${o.hex ? `, ${o.hex}` : ", no colour set"}`} aria-pressed={pinned} disabled={!drawn}
          onClick={() => onPin(o)} onFocus={() => drawn && onHover(o)} onBlur={() => drawn && onHover(null)} />
        <div className="min-w-[140px] flex-1">
          <div className="text-sm font-medium truncate">{o.name}{sample && <Badge variant="secondary" className="ml-1.5 text-[10px] font-normal align-middle">sample in hand</Badge>}</div>
          <div className="text-[11px] text-muted-foreground truncate">{[details, o.linkTitle].filter(Boolean).join(", ")}</div>
          {o.note && !editing && <div className="text-[11px] text-muted-foreground truncate">{o.note}</div>}
        </div>
        {o.imageUrl
          ? <a href={o.url ?? o.imageUrl} target="_blank" rel="noreferrer" title={o.linkTitle ?? o.url ?? ""} className="hidden sm:block w-11 h-11 rounded-md overflow-hidden bg-muted shrink-0"><img src={o.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} /></a>
          : o.url ? <a href={o.url} target="_blank" rel="noreferrer" className="text-muted-foreground shrink-0" aria-label={`Open the link for ${o.name}`}><ExternalLink className="w-4 h-4" /></a> : null}
        <div className="flex items-center gap-1 ml-auto">
        <Button type="button" size="sm" variant="ghost" className={`h-8 w-8 p-0 ${sample ? "text-primary" : "text-muted-foreground"}`} title={sample ? "A sample pot or swatch is in hand" : "Mark: sample pot or swatch in hand"} aria-pressed={sample} aria-label={`${o.name}: sample in hand`} onClick={() => onPatch({ status: sample ? "idea" : "sample" })}><Droplet className="w-4 h-4" /></Button>
        <Button type="button" size="sm" variant={chosen ? "default" : "outline"} className="h-8 text-xs" onClick={onChoose} title={chosen ? "Un-choose" : "Choose this one"}>{chosen ? <><Check className="w-3.5 h-3.5 mr-1" />Chosen</> : "Choose"}</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Edit ${o.name}`} aria-expanded={editing} onClick={() => setEditing(v => !v)}><Pencil className="w-4 h-4" /></Button>
        {confirm
          ? <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={onRemove} onBlur={() => setConfirm(false)}>Sure?</Button>
          : <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${o.name}`} onClick={() => setConfirm(true)}><X className="w-4 h-4" /></Button>}
        </div>
      </div>
      {editing && <div className="pt-2"><OptionForm initial={o} label="Save" onSubmit={b => { onPatch(b); setEditing(false); }} onCancel={() => setEditing(false)} /></div>}
    </div>
  );
}

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

function OptionForm({ initial, label, onSubmit, onCancel }: { initial?: Option; label: string; onSubmit: (b: OptionBody) => void; onCancel?: () => void }) {
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
    try { const r = await new Dropper().open(); if (r?.sRGBHex) setHex(r.sRGBHex.toUpperCase()); } catch { /* she closed it */ }
  };
  const trimmed = hex.trim();
  const validHex = /^#?[0-9a-f]{6}$/i.test(trimmed);
  const asHex = validHex ? `#${trimmed.replace("#", "").toUpperCase()}` : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim(); if (!n || (trimmed && !validHex)) return;
    onSubmit({ name: n, brand: brand.trim() || null, code: code.trim() || null, finish: finish.trim() || null, hex: asHex, url: url.trim() || null, ...(initial ? { note: note.trim() || null } : {}) });
    if (!initial) { setName(""); setBrand(""); setCode(""); setFinish(""); setHex(""); setUrl(""); }
  };
  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-1.5">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={initial ? "Name" : "Colour or product, e.g. Hague Blue"} aria-label="Name" className="h-8 text-sm" />
        <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" aria-label="Brand" className="h-8 text-sm" />
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Code or number" aria-label="Code" className="h-8 text-sm" />
        <Input value={finish} onChange={e => setFinish(e.target.value)} placeholder="Finish: matt, eggshell, vinyl" aria-label="Finish" className="h-8 text-sm" />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_112px_minmax(0,1fr)_auto] gap-1.5 items-center">
        <div className="flex items-center gap-1">
          <input type="color" value={asHex ?? "#EFF3F8"} onChange={e => setHex(e.target.value.toUpperCase())} aria-label="Pick the swatch colour" className="h-8 w-9 rounded-md border border-input bg-transparent p-0.5 cursor-pointer" />
          {canPick && <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title="Pick a colour from anywhere on your screen, a product photo included" aria-label="Pick a colour from the screen" onClick={pick}><Pipette className="w-4 h-4" /></Button>}
        </div>
        <Input value={hex} onChange={e => setHex(e.target.value)} placeholder="#1F2A44" aria-label="Hex colour" className={`h-8 text-sm font-mono ${trimmed && !validHex ? "border-rose-400" : ""}`} />
        <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Product page link (optional): its picture shows here" aria-label="Link" className="h-8 text-sm col-span-2 sm:col-span-1" />
        <div className="flex gap-1 col-span-2 sm:col-span-1">
          <Button type="submit" size="sm" className="h-8">{label}</Button>
          {onCancel && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>Cancel</Button>}
        </div>
      </div>
      {initial && <Input value={note} onChange={e => setNote(e.target.value)} placeholder="A note: where it goes, what the sample looked like on the wall" aria-label="Note" className="h-8 text-sm" />}
    </form>
  );
}

function AddSurface({ zone, onAdd }: { zone: Zone; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); const n = name.trim(); if (!n) return; onAdd(n); setName(""); }} className="flex gap-1.5 items-center rounded-md border border-dashed p-3 lg:col-span-2">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder={`Another ${zone === "floor" ? "floor" : "surface"} to decide, e.g. ${ZONE_LABEL[zone].example}`} className="h-8 text-sm" aria-label={`New ${zone} surface`} />
      <Button type="submit" size="sm" variant="outline" className="h-8">Add</Button>
    </form>
  );
}
