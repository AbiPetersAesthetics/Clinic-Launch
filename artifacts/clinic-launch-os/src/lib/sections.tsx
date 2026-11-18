// Section menu for long pages (owner, 18 Nov 2026: "On these massive pages we need a sub menu
// floating to the left where we can click down, stuff should be automatically closed and we can
// open it. Do it for the entire build").
// Every <Section> on a page and every section inside an embedded server board registers here. When a
// page has three or more, the sections start closed and a menu floats at the left: sticky beside the
// page on wide screens, a button at the bottom left on phones and tablets. A page with one or two
// sections is left exactly as it was.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ListTree, X } from "lucide-react";

export interface SectionItem {
  key: string;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  go: () => void;
  el: () => Element | null; // for page order
  idx?: number;              // order inside an embedded board
  remote?: boolean;          // lives inside an embedded board
}

interface Ctx { items: SectionItem[]; localCount: number; register: (it: SectionItem) => () => void }
const SectionsCtx = createContext<Ctx | null>(null);
export const useSections = () => useContext(SectionsCtx);
export const MIN_SECTIONS = 3;

function byPageOrder(a: SectionItem, b: SectionItem) {
  const ea = a.el(), eb = b.el();
  if (ea && eb && ea !== eb) return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  return (a.idx ?? 0) - (b.idx ?? 0);
}

export function SectionsProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, SectionItem>());
  const [version, setVersion] = useState(0);
  const register = useCallback((it: SectionItem) => {
    map.current.set(it.key, it);
    setVersion((v) => v + 1);
    return () => { if (map.current.get(it.key) === it) { map.current.delete(it.key); setVersion((v) => v + 1); } };
  }, []);
  const value = useMemo(() => {
    const items = [...map.current.values()].sort(byPageOrder);
    return { items, localCount: items.filter((i) => !i.remote).length, register };
  }, [version, register]);
  return <SectionsCtx.Provider value={value}>{children}</SectionsCtx.Provider>;
}

function Menu({ items, onPick }: { items: SectionItem[]; onPick?: () => void }) {
  const allOpen = items.every((i) => i.open);
  return (
    <nav aria-label="Sections on this page" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">On this page</span>
        <button type="button" onClick={() => items.forEach((i) => i.setOpen(!allOpen))} className="text-[0.75rem] text-ink-muted underline min-h-[32px]">{allOpen ? "Close all" : "Open all"}</button>
      </div>
      <ul className="border-t border-border">
        {items.map((i) => (
          <li key={i.key} className="border-b border-border">
            <button type="button" onClick={() => { i.go(); onPick?.(); }} className="w-full text-left flex items-start gap-2 py-2 min-h-[40px] text-[0.84rem] leading-snug text-ink hover:text-slate">
              <span aria-hidden className={`mt-[0.45em] inline-block w-1.5 h-1.5 rounded-full shrink-0 ${i.open ? "bg-ink" : "border border-ink-muted"}`} />
              <span className="min-w-0">{i.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// The page with its menu: a sticky column at the left on wide screens, a floating button below that.
export function SectionsFrame({ children }: { children: ReactNode }) {
  const s = useSections();
  const [location] = useLocation();
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(false); }, [location]);
  const items = s?.items ?? [];
  const show = items.length >= MIN_SECTIONS;
  return (
    <div className={show ? "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8" : ""}>
      {show && (
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1"><Menu items={items} /></div>
        </aside>
      )}
      <div className="min-w-0">{children}</div>
      {show && (
        <>
          <button type="button" onClick={() => setSheet(true)} aria-label="Sections on this page"
            className="lg:hidden fixed left-3 z-40 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-ink text-white text-[0.78rem] font-semibold shadow-lg"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}>
            <ListTree className="w-4 h-4" />Sections
          </button>
          {sheet && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setSheet(false)}>
              <div className="absolute left-0 bottom-0 top-0 w-[min(20rem,85vw)] bg-background p-4 overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
                <div className="flex justify-end"><button type="button" onClick={() => setSheet(false)} aria-label="Close" className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center"><X className="w-5 h-5" /></button></div>
                <Menu items={items} onPick={() => setSheet(false)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
