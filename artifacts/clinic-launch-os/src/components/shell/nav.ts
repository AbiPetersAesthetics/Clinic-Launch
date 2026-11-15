// ALFRED's navigation (UX plan 2.2 and 2.3): four areas and their pages, the archive under More.
import { Sun, PoundSterling, TrendingUp, Stethoscope, Inbox, Activity, MoreHorizontal, type LucideIcon } from "lucide-react";

export interface NavPage { href: string; label: string; note?: string; wip?: boolean; keywords?: string }
export interface NavArea { key: string; href: string; label: string; icon: LucideIcon; pages: NavPage[] }

export const AREAS: NavArea[] = [
  { key: "today", href: "/", label: "Today", icon: Sun, pages: [] },
  { key: "money", href: "/money", label: "Money", icon: PoundSterling, pages: [
    { href: "/money", label: "Overview and Build Cash Board", note: "The bank, the plan's low point, the cards; the master record below", keywords: "bank balance build cash master record" },
    { href: "/money/cash-line", label: "Cash Line", note: "The Tide balance day by day", keywords: "tide balance daily" },
    { href: "/money/plan", label: "Money Plan", note: "How Winchester pays for itself", keywords: "forecast simulator pay" },
    { href: "/money/cards", label: "Credit Cards", note: "Balances, limits and 0% dates", keywords: "barclaycard virgin card register" },
    { href: "/money/owed", label: "Owed to directors", note: "The director's loan", keywords: "directors loan" },
  ] },
  { key: "growth", href: "/growth", label: "Growth", icon: TrendingUp, pages: [
    { href: "/growth", label: "Overview", note: "Ads, social and search in one view" },
    { href: "/growth/ads", label: "Ads Board", note: "The command board for paid ads", keywords: "meta facebook instagram leads booked" },
    { href: "/growth/ads/every-ad", label: "Every ad and audience", note: "Each ad, best first; fatigue", keywords: "creative ad set audience frequency" },
    { href: "/growth/ads/leads", label: "Leads", note: "Every lead traced from form to diary", keywords: "pathway lead trace" },
    { href: "/growth/plan", label: "Plan", note: "The 12 month calendar and month by month", keywords: "calendar campaigns months" },
    { href: "/growth/last-14-days", label: "Last 14 days", note: "Daily bars and week on week", keywords: "daily week" },
    { href: "/growth/simulator", label: "Simulator", note: "If we scale: what a budget buys", keywords: "scale budget" },
    { href: "/growth/ideas", label: "Ideas", note: "Ways to lift the return", keywords: "roas ideas benchmarks" },
    { href: "/growth/how-it-works", label: "How it works", note: "The scheduled runs and the data", keywords: "schedule runs data" },
    { href: "/growth/social", label: "Social Board", note: "Abi's filming queue and posts", keywords: "video filming reels instagram", wip: true },
    { href: "/growth/seo", label: "SEO Board", note: "Search rankings and listings", keywords: "search console google rankings citations", wip: true },
    { href: "/growth/market", label: "Market and competitors", note: "Prices, offers and rivals", keywords: "competition pricing" },
    { href: "/growth/marketing", label: "Launch Marketing", note: "The launch plan, day by day", keywords: "launch" },
  ] },
  { key: "clinic", href: "/clinic", label: "Clinic", icon: Stethoscope, pages: [
    { href: "/clinic", label: "Overview", note: "Takings, the diary ahead, from opening who comes back" },
    { href: "/clinic/board", label: "Diary and takings", note: "The Clinic Board", keywords: "clinic board ans diary takings" },
    { href: "/clinic/people", label: "People and capacity", note: "Team and diary capacity", keywords: "team staff capacity" },
    { href: "/clinic/compliance", label: "Compliance and CQC", note: "What must be in place", keywords: "cqc policies" },
    { href: "/clinic/plan", label: "Plan and timeline", note: "Every task and date until 8 Dec", keywords: "project tasks timeline build" },
  ] },
];

export const EXTRA = [
  { key: "inbox", href: "/inbox", label: "Inbox", icon: Inbox },
  { key: "activity", href: "/activity", label: "Activity", icon: Activity },
  { key: "more", href: "/more", label: "More", icon: MoreHorizontal },
];

export const ARCHIVE: NavPage[] = [
  { href: "/today", label: "Today (planning era)" },
  { href: "/digest", label: "Weekly Brief (planning era)" },
  { href: "/financials", label: "Forecast Model" },
  { href: "/opening-board", label: "Opening Board (decisions list)" },
  { href: "/kit", label: "Rooms and Kit" },
  { href: "/suppliers", label: "Suppliers and Tenders" },
  { href: "/optimisation", label: "Cost Savings" },
  { href: "/risk-register", label: "Risks" },
  { href: "/backlinks", label: "Backlinks" },
  { href: "/dashboard", label: "Go/No-Go Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/lease-strategy", label: "Lease Strategy" },
  { href: "/risk-intelligence", label: "Risk Intelligence" },
  { href: "/operational-model", label: "Operational Model" },
  { href: "/decisions", label: "Decisions" },
  { href: "/lifestyle", label: "Life Design" },
  { href: "/franchise", label: "Franchise Model" },
];

export function areaOf(path: string): string {
  if (path === "/" ) return "today";
  for (const a of AREAS) if (a.key !== "today" && (path === a.href || path.startsWith(a.href + "/"))) return a.key;
  if (path.startsWith("/inbox")) return "inbox";
  if (path.startsWith("/activity")) return "activity";
  return "more";
}

export function titleOf(path: string): string {
  for (const a of AREAS) for (const p of a.pages) if (p.href === path) return p.href === a.href ? a.label : p.label;
  const a = AREAS.find((x) => x.href === path) ?? EXTRA.find((x) => x.href === path);
  if (a) return a.label;
  if (path === "/settings") return "Settings";
  return ARCHIVE.find((p) => p.href === path)?.label ?? "ALFRED";
}
