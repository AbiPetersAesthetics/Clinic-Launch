// The phone tab bar, left to right Today, Money, Growth, Patients, Clinic: Today under the left
// thumb with its count. A right hand in Settings mirrors the order. More opens from the logo.
import { Link } from "wouter";
import { AREAS, areaOf } from "./nav";
import { useHand } from "@/lib/alfred";

export function BottomTabs({ location, count }: { location: string; count: number }) {
  const hand = useHand();
  const ordered = hand === "right" ? [...AREAS].reverse() : AREAS;
  const current = areaOf(location);
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="grid grid-cols-5 h-16">
        {ordered.map((t) => {
          const active = current === t.key;
          return (
            <li key={t.key}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-[0.7rem] ${active ? "text-ink font-semibold" : "text-ink-muted"}`}>
                <span className={`flex items-center justify-center w-12 h-7 rounded-full ${active ? "bg-wash" : ""}`}><t.icon className="w-5 h-5" /></span>
                {t.label}
                {t.key === "today" && count > 0 && <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[0.62rem] font-semibold flex items-center justify-center" aria-label={`${count} need you`}>{count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
