// The command palette (UX plan 2.3): Ctrl+K or Cmd+K on a desktop, the search button on a phone.
// One box with three kinds of result: Go to (every page), Find (a lead, an ad, a plan line, a card
// entry) and Do (update the bank balance, open a board full screen).
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AREAS, ARCHIVE, MORE } from "./nav";
import { PROJECT_ID } from "@/lib/alfred";

interface SearchIndex { leads: { name: string; status: string; ad: string }[]; ads: { name: string; status: string }[]; lines: { id: number; title: string; phase: string }[]; entries: { id: number; description: string; date: string; card: string }[] }

let openPalette: (() => void) | null = null;
export const showPalette = () => openPalette?.();

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, go] = useLocation();
  useEffect(() => {
    openPalette = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); openPalette = null; };
  }, []);
  const { data } = useQuery({ queryKey: ["alfred", "search"], enabled: open, staleTime: 5 * 60_000,
    queryFn: async () => (await fetch(`/api/projects/${PROJECT_ID}/search-index`)).json() as Promise<SearchIndex> });
  const pages = useMemo(() => [
    ...AREAS.map((a) => ({ href: a.href, label: a.label, area: "", keywords: a.key === "today" ? "brief home" : "" })),
    ...AREAS.flatMap((a) => a.pages.map((p) => ({ ...p, area: a.label }))),
    ...MORE.map((p) => ({ ...p, area: "More", keywords: p.note ?? "" })),
    { href: "/more", label: "More", area: "", keywords: "archive" },
    ...ARCHIVE.map((p) => ({ ...p, area: "Archive", keywords: "" })),
  ], []);
  const run = (href: string) => { setOpen(false); go(href); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Go to a page, find a lead, or do something" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Do">
          <CommandItem value="do update bank balance tide" onSelect={() => run("/money?bank=1")}>Update bank balance</CommandItem>
          <CommandItem value="do approve proposals inbox decide" onSelect={() => run("/inbox")}>Decide open proposals</CommandItem>
          <CommandItem value="do open build cash board full screen master record" onSelect={() => run("/money/build-cash?full=1")}>Open the Build Cash Board full screen</CommandItem>
          <CommandItem value="do settings hand left right" onSelect={() => run("/settings")}>Switch hands (left or right)</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {pages.map((p) => <CommandItem key={p.href + p.label} value={`go ${p.label} ${p.area} ${p.keywords ?? ""}`} onSelect={() => run(p.href)}>{p.label}{p.area && <span className="ml-auto text-xs text-muted-foreground">{p.area}</span>}</CommandItem>)}
        </CommandGroup>
        {data && (
          <CommandGroup heading="Find">
            {data.leads.map((l) => <CommandItem key={`l${l.name}`} value={`find lead ${l.name} ${l.ad}`} onSelect={() => run("/patients/pathway")}>{l.name}<span className="ml-auto text-xs text-muted-foreground">lead, {l.status}</span></CommandItem>)}
            {data.ads.map((a) => <CommandItem key={`a${a.name}`} value={`find ad ${a.name}`} onSelect={() => run("/growth/ads/every-ad")}>{a.name}<span className="ml-auto text-xs text-muted-foreground">ad, {a.status.toLowerCase()}</span></CommandItem>)}
            {data.lines.map((l) => <CommandItem key={`p${l.id}`} value={`find plan line ${l.title} ${l.phase}`} onSelect={() => run(`/clinic/opening?taskId=${l.id}`)}>{l.title}<span className="ml-auto text-xs text-muted-foreground">plan line</span></CommandItem>)}
            {data.entries.map((e) => <CommandItem key={`e${e.id}`} value={`find card entry ${e.description} ${e.card}`} onSelect={() => run("/money/obligations")}>{e.description}<span className="ml-auto text-xs text-muted-foreground">{e.card}, {e.date}</span></CommandItem>)}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
