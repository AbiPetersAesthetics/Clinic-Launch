// ALFRED's navigation (ALFRED-PLAN.md section 2): five areas, More behind the logo, the archive
// under More. Nothing is deleted: retired pages keep their addresses in the archive.
import { Sun, PoundSterling, TrendingUp, Users, Stethoscope, Inbox, Activity, MoreHorizontal, type LucideIcon } from "lucide-react";

export interface NavPage { href: string; label: string; note?: string; keywords?: string }
export interface NavArea { key: string; href: string; label: string; icon: LucideIcon; pages: NavPage[] }

export const AREAS: NavArea[] = [
  { key: "today", href: "/", label: "Today", icon: Sun, pages: [] },
  { key: "money", href: "/money", label: "Money", icon: PoundSterling, pages: [
    { href: "/money/build-cash", label: "Build Cash Board", note: "The master record: the bank, the build, the card and every line", keywords: "master record build" },
    { href: "/money/stands-alone", label: "Stands Alone", note: "When Winchester pays its own way: the test that decides Bedhampton and pay", keywords: "bedhampton pay salary" },
    { href: "/money/takings", label: "Takings", note: "Taken and booked, by clinic, against the plan", keywords: "revenue sales takings" },
    { href: "/money/obligations", label: "Obligations", note: "VAT, cards and their 0% dates, loans, the directors' loan", keywords: "vat cards loans owed directors barclaycard virgin" },
    { href: "/money/cash-line", label: "Cash Line", note: "The Tide balance day by day", keywords: "tide balance daily" },
    { href: "/money/plan", label: "Money Plan", note: "How Winchester pays for itself", keywords: "forecast simulator" },
  ] },
  { key: "growth", href: "/growth", label: "Growth", icon: TrendingUp, pages: [
    { href: "/growth/ads", label: "Ads", note: "Every ad and audience, the last 14 days, the simulator", keywords: "meta facebook instagram creative audience" },
    { href: "/growth/plan", label: "Plan", note: "The 12 month calendar, month by month, and ideas", keywords: "calendar campaigns black friday ideas" },
    { href: "/growth/studio", label: "Studio", note: "Abi's filming queue, what is live, how posts did", keywords: "video filming reels social instagram" },
    { href: "/growth/search", label: "Search and reviews", note: "Rankings, Google reviews against rivals, citations", keywords: "seo search console google reviews citations backlinks" },
    { href: "/growth/market", label: "Market", note: "Prices, offers and competitors", keywords: "competition pricing" },
  ] },
  { key: "patients", href: "/patients", label: "Patients", icon: Users, pages: [
    { href: "/patients/pathway", label: "Pathway", note: "Every lead from ad to diary to paying, and who has not booked yet", keywords: "leads trace bookings follow up" },
    { href: "/patients/due-back", label: "Due back", note: "Patients whose course or review is due", keywords: "recall return" },
    { href: "/patients/reviews", label: "Reviews", note: "Reviews received, asked, and who to ask next", keywords: "google reviews ask" },
  ] },
  { key: "clinic", href: "/clinic", label: "Clinic", icon: Stethoscope, pages: [
    { href: "/clinic/diary", label: "Diary", note: "Day by day, taken against booked", keywords: "ans diary appointments" },
    { href: "/clinic/team", label: "Team and capacity", note: "The second clinician trigger, then the Patient Coordinator", keywords: "staff people capacity hire" },
    { href: "/clinic/compliance", label: "Compliance", note: "Dated items that can lapse", keywords: "cqc insurance policies training" },
    { href: "/clinic/stock", label: "Stock", note: "Obagi and consumables against their reorder points", keywords: "obagi stock reorder" },
    { href: "/clinic/opening", label: "Opening checklist", note: "Every task and date until 8 December", keywords: "project tasks timeline plan" },
  ] },
];

export const MORE: NavPage[] = [
  { href: "/inbox", label: "Inbox", note: "Every card and its history" },
  { href: "/activity", label: "Activity", note: "Every run, what it read and changed" },
  { href: "/sources", label: "Sources", note: "Each data source: last read, next run, healthy or not" },
  { href: "/abi", label: "Abi's screen", note: "Her day, what to film, low stock" },
  { href: "/settings", label: "Settings", note: "Hand, notifications" },
  { href: "/build", label: "Build", note: "What is finished and what is left" },
];
export const EXTRA_ICONS: Record<string, LucideIcon> = { "/inbox": Inbox, "/activity": Activity, "/more": MoreHorizontal };

export const ARCHIVE: NavPage[] = [
  { href: "/archive/home-tiles", label: "Home tiles (the first home screen)" },
  { href: "/opening-board", label: "Opening Board" },
  { href: "/archive/ads-ideas", label: "Ads Ideas (now a tab of Plan)" },
  { href: "/archive/launch-marketing", label: "Launch Marketing" },
  { href: "/archive/cards", label: "Credit Cards register" },
  { href: "/archive/owed", label: "Owed to directors" },
  { href: "/risk-register", label: "Risks" },
  { href: "/backlinks", label: "Backlinks" },
  { href: "/financials", label: "Forecast Model" },
  { href: "/today", label: "Today (planning era)" },
  { href: "/digest", label: "Weekly Brief (planning era)" },
  { href: "/kit", label: "Rooms and Kit" },
  { href: "/suppliers", label: "Suppliers and Tenders" },
  { href: "/optimisation", label: "Cost Savings" },
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
  if (path === "/") return "today";
  for (const a of AREAS) if (a.key !== "today" && (path === a.href || path.startsWith(a.href + "/"))) return a.key;
  return "more";
}

export function titleOf(path: string): string {
  for (const a of AREAS) {
    if (a.href === path) return a.label;
    const p = a.pages.find((x) => path === x.href || path.startsWith(x.href + "/"));
    if (p) return p.label;
  }
  if (path === "/more") return "More";
  return MORE.find((p) => p.href === path)?.label ?? ARCHIVE.find((p) => p.href === path)?.label ?? "ALFRED";
}
