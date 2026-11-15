// Home: the screen Launch OS opens on (owner, 15 Nov 2026: "a splash screen so when I arrive I can
// click what I want to go to"). Big tiles for the command boards first, then every area.
import { Link } from "wouter";
import { LayoutTemplate, Target, Gauge, Zap, PoundSterling, Megaphone, TrendingUp, BookOpen, CreditCard, Wallet, Users, ShieldCheck, ListTodo } from "lucide-react";

type Tile = { href: string; label: string; note: string; icon: React.ElementType };

const COMMAND: Tile[] = [
  { href: "/build-cash", label: "Build Cash Board", note: "The master record: the bank, the build, the card and every line.", icon: LayoutTemplate },
  { href: "/ads-board", label: "Ads Board", note: "Every ad, what a paying patient costs, ROAS and the 12 month plan.", icon: Target },
  { href: "/clinic-board", label: "Clinic Board", note: "Takings, the diary ahead and, from opening, who turns up and comes back.", icon: Gauge },
];

const AREAS: { title: string; tiles: Tile[] }[] = [
  { title: "Patients and growth", tiles: [
    { href: "/ads-ideas", label: "Ads Ideas", note: "Ways to lift ROAS, with the evidence", icon: Zap },
    { href: "/market", label: "Market & Competitors", note: "Prices, offers and rivals", icon: PoundSterling },
    { href: "/marketing", label: "Launch Marketing", note: "The launch plan, day by day", icon: Megaphone },
  ] },
  { title: "Money", tiles: [
    { href: "/cash-line", label: "Cash Line", note: "The bank, day by day", icon: TrendingUp },
    { href: "/money-plan", label: "Money Plan", note: "How Winchester pays for itself", icon: BookOpen },
    { href: "/cards", label: "Credit Cards", note: "Balances, limits and 0% dates", icon: CreditCard },
    { href: "/owed", label: "Owed to directors", note: "The director's loan", icon: Wallet },
  ] },
  { title: "Clinic", tiles: [
    { href: "/people", label: "People & Capacity", note: "Team and diary capacity", icon: Users },
    { href: "/compliance", label: "Compliance & CQC", note: "What must be in place", icon: ShieldCheck },
  ] },
  { title: "Build, until opening", tiles: [
    { href: "/project", label: "Plan & Timeline", note: "Every task and date", icon: ListTodo },
  ] },
];

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const toOpen = Math.ceil((Date.parse("2026-12-08T00:00:00Z") - Date.now()) / 86400000);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />Abi Peters Skin Clinic</p>
        <h1 className="mt-2 text-[1.9rem] sm:text-[2.4rem] leading-tight" style={{ fontFamily: "var(--app-font-serif)", fontWeight: 500 }}>{greeting()}. Where to?</h1>
        {toOpen > 0 && <p className="mt-1 text-muted-foreground">Winchester opens in {toOpen} {toOpen === 1 ? "day" : "days"}.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {COMMAND.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-xl border border-card-border bg-card p-5 sm:p-6 grid gap-3 hover:border-primary transition-colors">
            <t.icon className="w-6 h-6 text-primary" />
            <span className="text-xl" style={{ fontFamily: "var(--app-font-serif)", fontWeight: 500 }}>{t.label}</span>
            <span className="text-sm text-muted-foreground leading-relaxed">{t.note}</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary group-hover:underline">Open</span>
          </Link>
        ))}
      </div>

      {AREAS.map((a) => (
        <section key={a.title} className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{a.title}</h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {a.tiles.map((t) => (
              <Link key={t.href} href={t.href} className="rounded-xl border border-card-border bg-card p-4 grid gap-1.5 hover:border-primary transition-colors min-w-0">
                <t.icon className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{t.label}</span>
                <span className="text-xs text-muted-foreground leading-snug">{t.note}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
