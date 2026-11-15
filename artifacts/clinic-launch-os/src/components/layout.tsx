import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ListTodo,
  Calculator,
  Building2,
  AlertTriangle,
  BookOpen,
  Zap,
  ShieldCheck,
  Network,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  MapPin,
  TrendingUp,
  Leaf,
  Gauge,
  Megaphone,
  Target,
  FileDown,
  Scale,
  ShoppingBag,
  Brain,
  Users,
  PoundSterling,
  Newspaper,
  Link2,
  Armchair,
  LayoutTemplate,
  CreditCard,
  Wallet,
} from "lucide-react";

const PROJECT_ID = 1;

// Days to the first treatments (model days 2 Dec 2026) and to opening (8 Dec 2026), always correct.
function OpeningCountdown() {
  const day = (iso: string) => Math.ceil((Date.parse(iso + "T00:00:00Z") - Date.now()) / 86400000);
  const model = day("2026-12-02"), open = day("2026-12-08");
  if (open < 0) return null;
  return (
    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
      {model > 0 && <span className="px-3 py-1 rounded-full border border-card-border">First treatments in <b className="text-foreground">{model}</b> days</span>}
      <span className="px-3 py-1 rounded-full border border-card-border">Winchester opens in <b className="text-foreground">{open}</b> {open === 1 ? "day" : "days"}</span>
    </div>
  );
}

function AbiPetersLogo() {
  // The clinic's official logo (from the website, public/assets/images/logos/abi-peters-logo-official-dot.png).
  return (
    <div className="select-none">
      <img src={`${import.meta.env.BASE_URL}brand/abi-peters-logo.png`} alt="Abi Peters Skin Clinic" width={168} height={54} className="block h-auto w-[168px]" />
      <div className="text-sidebar-foreground/50 tracking-[0.22em] uppercase mt-2" style={{ fontSize: "0.6rem", fontWeight: 600 }}>
        A.L.F.R.E.D.
      </div>
    </div>
  );
}

function SidebarNav({
  navItems,
  location,
  onNavigate,
}: {
  navItems: { href: string; label: string; icon: React.ElementType; badge?: string; badgeAlert?: boolean; wip?: boolean }[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="px-4 space-y-0.5">
      {navItems.map((item) => {
        const isActive = location === item.href;
        if (item.wip) {
          return (
            <div key={item.href} aria-disabled="true" title="Work in progress" className="flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium text-sidebar-foreground/35 cursor-not-allowed select-none">
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full border border-sidebar-border">WIP</span>
            </div>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                item.badgeAlert
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30"
              }`}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  // The planning-era top strip, the cost-tier risk banner and the two queries that fed them (polled
  // every 15 and 60 seconds and then discarded) were removed on 15 Nov 2026. The compliance badge
  // went with them: its list was last maintained on 7 Jul 2026, so its percentage meant nothing.
  // The sidebar in areas (15 Nov 2026). Command boards first: the few pages opened every day.
  // Build retires into the archive after opening; Clinic grows into operations.
  const sections: { title: string; note?: string; items: { href: string; label: string; icon: React.ElementType; badge?: string; badgeAlert?: boolean; wip?: boolean }[] }[] = [
    { title: "Command boards", items: [
      { href: "/", label: "Today", icon: LayoutDashboard },
      { href: "/build-cash", label: "Build Cash Board", icon: LayoutTemplate },
      { href: "/growth/ads", label: "Ads Board", icon: Target },
      { href: "/clinic-board", label: "Clinic Board", icon: Gauge },
      { href: "/social-board", label: "Social Board", icon: Megaphone, wip: true },
      { href: "/seo-board", label: "SEO Board", icon: Link2, wip: true },
    ] },
    { title: "Money", items: [
      { href: "/money", label: "Money overview and bank", icon: Wallet },
      { href: "/cash-line", label: "Cash Line", icon: TrendingUp },
      { href: "/money-plan", label: "Money Plan", icon: BookOpen },
      { href: "/cards", label: "Credit Cards", icon: CreditCard },
      { href: "/owed", label: "Owed to directors", icon: Wallet },
    ] },
    { title: "Patients and growth", items: [
      { href: "/ads-ideas", label: "Ads Ideas", icon: Zap },
      { href: "/marketing", label: "Launch Marketing", icon: Megaphone },
      { href: "/market", label: "Market & Competitors", icon: PoundSterling },
    ] },
    { title: "Clinic", items: [
      { href: "/people", label: "People & Capacity", icon: Users },
      { href: "/compliance", label: "Compliance & CQC", icon: ShieldCheck },
    ] },
    { title: "Build", note: "retires after opening", items: [
      { href: "/project", label: "Plan & Timeline", icon: ListTodo },
    ] },
  ];

  // Planning Archive — the go/no-go era tools, kept for reference
  const archiveItems = [
    { href: "/today", label: "Today (parked for operations)", icon: LayoutDashboard },
    { href: "/digest", label: "Weekly Brief (parked for operations)", icon: Newspaper },
    { href: "/financials", label: "Forecast Model", icon: Calculator },
    { href: "/opening-board", label: "Opening Board (decisions list)", icon: Gauge },
    { href: "/kit", label: "Rooms & Kit", icon: Armchair },
    { href: "/suppliers", label: "Suppliers & Tenders", icon: ShoppingBag },
    { href: "/optimisation", label: "Cost Savings", icon: Zap },
    { href: "/risk-register", label: "Risks", icon: AlertTriangle },
    { href: "/backlinks", label: "Backlinks (becoming the SEO Board)", icon: Link2 },
    { href: "/dashboard", label: "Go/No-Go Dashboard", icon: Gauge },
    { href: "/properties", label: "Properties", icon: Building2 },
    { href: "/lease-strategy", label: "Lease Strategy", icon: Scale },
    { href: "/risk-intelligence", label: "Risk Intelligence", icon: Brain },
    { href: "/operational-model", label: "Operational Model", icon: Gauge },
    { href: "/decisions", label: "Decisions", icon: BookOpen },
    { href: "/lifestyle", label: "Life Design", icon: Leaf },
    { href: "/franchise", label: "Franchise Model", icon: Network },
  ];

  const locationInArchive = archiveItems.some(i => i.href === location);
  const [archiveOpen, setArchiveOpen] = useState(locationInArchive);
  // Keep the archive open when navigating into one of its pages
  useEffect(() => {
    if (locationInArchive) setArchiveOpen(true);
  }, [locationInArchive]);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* ── Mobile overlay backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: always visible | mobile: slide-in drawer) ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar border-r border-sidebar-border
          transform transition-transform duration-300 ease-in-out
          md:static md:w-64 md:translate-x-0 md:z-auto md:shrink-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-sidebar-border flex items-start justify-between">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} aria-label="Home"><AbiPetersLogo /></Link>
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 -mr-1 -mt-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              <div className="px-7 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/40">
                {sec.title}{sec.note && <span className="normal-case tracking-normal font-normal"> · {sec.note}</span>}
              </div>
              <SidebarNav
                navItems={sec.items}
                location={location}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          ))}

          <div>
            <button
              className="w-full flex items-center justify-between px-7 py-1.5 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
              onClick={() => setArchiveOpen(o => !o)}
              aria-expanded={archiveOpen}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em]">Parked and archive</span>
              {archiveOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {archiveOpen && (
              <SidebarNav
                navItems={archiveItems}
                location={location}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Bottom: export + location */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          <Link
            href="/export"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
              location === "/export"
                ? "bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground border-sidebar-border/60"
            }`}
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            Export Full Report PDF
          </Link>
          <p className="text-sidebar-foreground/30 text-[10px] tracking-[0.15em] uppercase">
            Winchester · 9A Jewry Street
          </p>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Sticky top bar ── */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border h-14 md:h-16 flex items-center px-4 md:px-6 shrink-0 gap-3">

          {/* Phone: the menu on the left (owner is left-handed), then the logo */}
          <button
            className="md:hidden -ml-1 text-foreground p-2 rounded-full hover:bg-muted transition-colors shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="md:hidden" aria-label="Home"><img src={`${import.meta.env.BASE_URL}brand/abi-peters-logo.png`} alt="Abi Peters Skin Clinic" width={120} height={39} className="block h-auto w-[120px]" /></Link>

          <OpeningCountdown />
        </header>

        {/* ── Page content ── */}
        {/* overflow-x-hidden: any element wider than the viewport must scroll inside its
            own overflow-x-auto wrapper — never pan the whole page sideways (mobile wobble). */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8" style={{ overscrollBehaviorX: "none" }}>
          <div className="max-w-6xl mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
