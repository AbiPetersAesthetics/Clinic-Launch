import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, ArrowUpDown, Check, Copy, ExternalLink, Info, Link2,
  Pencil, Search, ShieldAlert, X,
} from "lucide-react";
import {
  ACTION_PLAN_INTRO, GROUP_INTRO, LISTING_PACK_INTRO, SKIP_INTRO,
  SOURCE_DATA_SUMMARY, SOURCE_DOMAINS_SHORTLISTED, TEMPLATE_INTRO,
  BACKLINK_COMPETITORS, BACKLINK_GROUPS, BACKLINK_SKIP_LIST,
} from "@/lib/backlink-reference";

const PROJECT_ID = 1;
const API = `/api`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: number;
  projectId: number;
  rank: number;
  priority: string;
  category: string;
  website: string;
  domain: string;
  why?: string | null;
  competitors?: string | null;
  groups?: string[] | null;
  cost?: string | null;
  applyUrl?: string | null;
  infoNeeded?: string | null;
  template?: string | null;
  status: string;
  owner?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  dateContacted?: string | null;
  followUpDate?: string | null;
  liveUrl?: string | null;
  updatedAt?: string;
}

interface ListingPackItem {
  id: number;
  section: string;
  field: string;
  value?: string | null;
  remaining?: string | null;
  status: string;
  sortOrder: number;
}

interface OutreachTemplate {
  id: number;
  templateId: string;
  use: string;
  wording: string;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────
// The eleven agreed statuses, plus the two the workbook was already using
// ("Check existing" on the map and directory setups, "In progress" on Obagi),
// kept so that seeding never quietly rewrites a status somebody set.
const STATUSES = [
  "Not started", "Check existing", "Preparing", "In progress", "Ready to apply",
  "Applied/contacted", "Awaiting response", "Follow-up due", "Approved",
  "Live", "Rejected", "Dependent", "Not pursuing",
] as const;

const SUCCESS_STATUSES = ["Approved", "Live"];
const ACTIVE_STATUSES = [
  "Check existing", "Preparing", "In progress", "Ready to apply",
  "Applied/contacted", "Follow-up due",
];
const CLOSED_STATUSES = ["Rejected", "Not pursuing"];

const PACK_STATUSES = ["Known", "Draft", "Incomplete", "Missing", "Approved"] as const;

const PRIORITY_ORDER: Record<string, number> = { "P1 Now": 0, "P2 Next": 1, "P3 Later": 2 };

const ALL = "__all__";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isComplete(status: string) {
  return SUCCESS_STATUSES.includes(status);
}
function isResolved(status: string) {
  return SUCCESS_STATUSES.includes(status) || CLOSED_STATUSES.includes(status);
}
function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
/** A date only reads as overdue while the target can still be acted on. */
function isOverdue(value: string | null | undefined, status: string) {
  if (!value || isResolved(status)) return false;
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() < todayMidnight().getTime();
}
function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}
/** Free or paid is a sentence in the workbook, so it is bucketed for filtering. */
function costBucket(cost?: string | null): "Free" | "Paid" | "Conditional" {
  const c = (cost ?? "").toLowerCase();
  if (/\bfree\b/.test(c) && !/paid|cost|fee|\bpurchase\b/.test(c)) return "Free";
  if (/paid|fee|cost|donation|£|\blevy\b/.test(c)) return "Paid";
  if (/^free/.test(c)) return "Free";
  return "Conditional";
}

function priorityClass(priority: string) {
  if (priority === "P1 Now") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (priority === "P2 Next") return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function statusClass(status: string) {
  if (status === "Live") return "bg-emerald-600 text-white border-emerald-600";
  if (SUCCESS_STATUSES.includes(status)) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (status === "Follow-up due" || status === "Rejected") return "bg-destructive/15 text-destructive border-destructive/30";
  if (status === "Awaiting response") return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  if (ACTIVE_STATUSES.includes(status)) return "bg-primary/15 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
}

function packStatusClass(status: string) {
  if (status === "Approved") return "bg-emerald-600 text-white border-emerald-600";
  if (status === "Known") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (status === "Missing") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className={`h-8 gap-1.5 ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : (label ?? "Copy")}
    </Button>
  );
}

function ExtLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <span className="text-muted-foreground">Not supplied</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-1 text-primary hover:underline underline-offset-2"
    >
      <span className="break-all">{children}</span>
      <ExternalLink className="w-3 h-3 shrink-0 self-center" />
    </a>
  );
}

function StatTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "bad" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-snug">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums mt-1.5 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BacklinksPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["backlinks", PROJECT_ID],
    queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/backlinks`).then(r => r.json()),
  });

  const { data: pack = [] } = useQuery<ListingPackItem[]>({
    queryKey: ["backlink-listing-pack", PROJECT_ID],
    queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/backlink-listing-pack`).then(r => r.json()),
  });

  const { data: templates = [] } = useQuery<OutreachTemplate[]>({
    queryKey: ["backlink-templates", PROJECT_ID],
    queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/backlink-templates`).then(r => r.json()),
  });

  const patchOpportunity = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Opportunity> }) =>
      fetch(`${API}/projects/${PROJECT_ID}/backlinks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlinks", PROJECT_ID] }),
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const patchPack = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ListingPackItem> }) =>
      fetch(`${API}/projects/${PROJECT_ID}/backlink-listing-pack/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlink-listing-pack", PROJECT_ID] }),
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const patchTemplate = useMutation({
    mutationFn: ({ id, wording }: { id: number; wording: string }) =>
      fetch(`${API}/projects/${PROJECT_ID}/backlink-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wording }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlink-templates", PROJECT_ID] });
      toast({ title: "Template saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const open = useMemo(
    () => opportunities.find(o => o.id === openId) ?? null,
    [opportunities, openId],
  );

  const stats = useMemo(() => {
    const completed = opportunities.filter(o => isComplete(o.status)).length;
    return {
      total: opportunities.length,
      p1: opportunities.filter(o => o.priority === "P1 Now").length,
      p2: opportunities.filter(o => o.priority === "P2 Next").length,
      p3: opportunities.filter(o => o.priority === "P3 Later").length,
      notStarted: opportunities.filter(o => o.status === "Not started").length,
      inProgress: opportunities.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
      awaiting: opportunities.filter(o => o.status === "Awaiting response").length,
      completed,
      live: opportunities.filter(o => o.status === "Live").length,
      overdue: opportunities.filter(o => isOverdue(o.targetDate, o.status) || isOverdue(o.followUpDate, o.status)).length,
      percent: opportunities.length ? Math.round((completed / opportunities.length) * 100) : 0,
    };
  }, [opportunities]);

  return (
    <>
      <PageHeader
        title="Backlinks"
        subtitle={`${stats.total} prioritised targets · ${stats.live} links live`}
      />

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="pack">Listing Pack</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="avoid">Avoid</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-0">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mb-5">{ACTION_PLAN_INTRO}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatTile label="Total opportunities" value={stats.total} />
            <StatTile label="P1 Now" value={stats.p1} tone="good" />
            <StatTile label="P2 Next" value={stats.p2} tone="warn" />
            <StatTile label="P3 Later" value={stats.p3} />
            <StatTile label="Not started" value={stats.notStarted} />
            <StatTile label="In progress" value={stats.inProgress} tone="warn" />
            <StatTile label="Awaiting response" value={stats.awaiting} tone="warn" />
            <StatTile label="Completed" value={stats.completed} tone="good" />
            <StatTile label="Links secured" value={stats.live} tone="good" />
            <StatTile label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? "bad" : "default"} />
          </div>

          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Completed opportunities</h2>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {stats.completed} of {stats.total} approved or live
                  <span className="ml-2 font-semibold text-foreground">{stats.percent}%</span>
                </p>
              </div>
              <div
                className="mt-3 h-2.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stats.percent}
                aria-label="Opportunities completed"
              >
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${stats.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.live} of those are confirmed live backlinks.
              </p>
            </CardContent>
          </Card>

          <NextActions opportunities={opportunities} onOpen={setOpenId} isLoading={isLoading} />
        </TabsContent>

        {/* ── Opportunities ── */}
        <TabsContent value="opportunities" className="mt-0">
          <OpportunityTable opportunities={opportunities} onOpen={setOpenId} isLoading={isLoading} />
        </TabsContent>

        {/* ── Listing pack ── */}
        <TabsContent value="pack" className="mt-0">
          <ListingPackPanel items={pack} onSave={(id, data) => patchPack.mutate({ id, data })} />
        </TabsContent>

        {/* ── Templates ── */}
        <TabsContent value="templates" className="mt-0">
          <TemplatesPanel
            templates={templates}
            opportunities={opportunities}
            onSave={(id, wording) => patchTemplate.mutate({ id, wording })}
          />
        </TabsContent>

        {/* ── Avoid ── */}
        <TabsContent value="avoid" className="mt-0">
          <AvoidPanel />
        </TabsContent>

        {/* ── Competitors ── */}
        <TabsContent value="competitors" className="mt-0">
          <CompetitorsPanel />
        </TabsContent>
      </Tabs>

      <OpportunityDialog
        opportunity={open}
        template={templates.find(t => t.templateId === open?.template)}
        onClose={() => setOpenId(null)}
        onChange={(data) => open && patchOpportunity.mutate({ id: open.id, data })}
      />
    </>
  );
}

// ─── Next actions ─────────────────────────────────────────────────────────────
function NextActions({
  opportunities, onOpen, isLoading,
}: {
  opportunities: Opportunity[];
  onOpen: (id: number) => void;
  isLoading: boolean;
}) {
  const queue = useMemo(
    () => opportunities
      .filter(o => !isComplete(o.status))
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) || a.rank - b.rank)
      .slice(0, 14),
    [opportunities],
  );

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <h2 className="text-sm font-semibold">Next actions</h2>
        <p className="text-xs text-muted-foreground mt-1">
          The highest-priority targets not yet approved or live, in workbook rank order.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Every opportunity is approved or live. Nothing is waiting.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {queue.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onOpen(o.id)}
                  className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-md px-2 -mx-2"
                >
                  <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground mt-0.5">{o.rank}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{o.website}</span>
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">{o.category}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {(isOverdue(o.targetDate, o.status) || isOverdue(o.followUpDate, o.status)) && (
                      <AlertTriangle className="w-4 h-4 text-destructive" aria-label="Overdue" />
                    )}
                    <Badge variant="outline" className={priorityClass(o.priority)}>{o.priority}</Badge>
                    <Badge variant="outline" className={`hidden sm:inline-flex ${statusClass(o.status)}`}>{o.status}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Opportunity table ────────────────────────────────────────────────────────
type SortKey = "rank" | "priority" | "status" | "targetDate" | "updatedAt";

function OpportunityTable({
  opportunities, onOpen, isLoading,
}: {
  opportunities: Opportunity[];
  onOpen: (id: number) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [group, setGroup] = useState(ALL);
  const [cost, setCost] = useState(ALL);
  // Default view: incomplete P1 first, then workbook rank order.
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const options = useMemo(() => ({
    categories: [...new Set(opportunities.map(o => o.category))].sort(),
    owners: [...new Set(opportunities.map(o => o.owner).filter(Boolean) as string[])].sort(),
    groups: [...new Set(opportunities.flatMap(o => o.groups ?? []))].sort(),
    statuses: STATUSES.filter(s => opportunities.some(o => o.status === s)),
  }), [opportunities]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = opportunities.filter(o => {
      if (priority !== ALL && o.priority !== priority) return false;
      if (category !== ALL && o.category !== category) return false;
      if (status !== ALL && o.status !== status) return false;
      if (owner !== ALL && o.owner !== owner) return false;
      if (group !== ALL && !(o.groups ?? []).includes(group)) return false;
      if (cost !== ALL && costBucket(o.cost) !== cost) return false;
      if (!q) return true;
      return [o.website, o.domain, o.competitors ?? "", o.category, o.notes ?? ""]
        .join(" ").toLowerCase().includes(q);
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "priority":
          return (
            Number(isComplete(a.status)) - Number(isComplete(b.status)) ||
            ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir ||
            a.rank - b.rank
          );
        case "status":
          return (
            (STATUSES.indexOf(a.status as typeof STATUSES[number]) - STATUSES.indexOf(b.status as typeof STATUSES[number])) * dir ||
            a.rank - b.rank
          );
        case "targetDate":
        case "updatedAt": {
          // Blank dates always sort last, whichever direction is chosen.
          const av = a[sortKey] ?? "";
          const bv = b[sortKey] ?? "";
          if (!av && !bv) return a.rank - b.rank;
          if (!av) return 1;
          if (!bv) return -1;
          return av.localeCompare(bv) * dir;
        }
        default:
          return (a.rank - b.rank) * dir;
      }
    });
  }, [opportunities, search, priority, category, status, owner, group, cost, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const activeFilters =
    (search ? 1 : 0) + [priority, category, status, owner, group, cost].filter(v => v !== ALL).length;

  const clearAll = () => {
    setSearch(""); setPriority(ALL); setCategory(ALL); setStatus(ALL);
    setOwner(ALL); setGroup(ALL); setCost(ALL);
  };

  const SortHead = ({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) => (
    <th scope="col" className={`px-3 py-2.5 text-left font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </th>
  );

  const filterSelect = (
    label: string, value: string, set: (v: string) => void, items: string[], allLabel: string,
  ) => (
    <div className="min-w-0">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {items.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <label htmlFor="backlink-search" className="sr-only">Search by website, domain or competitor</label>
            <Input
              id="backlink-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by website, domain, competitor or note"
              className="pl-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {filterSelect("Priority", priority, setPriority, ["P1 Now", "P2 Next", "P3 Later"], "All priorities")}
            {filterSelect("Category", category, setCategory, options.categories, "All categories")}
            {filterSelect("Status", status, setStatus, [...options.statuses], "All statuses")}
            {filterSelect("Owner", owner, setOwner, options.owners, "All owners")}
            {filterSelect("Group", group, setGroup, options.groups, "All groups")}
            {filterSelect("Free or paid", cost, setCost, ["Free", "Paid", "Conditional"], "Free and paid")}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {rows.length} of {opportunities.length} shown
            </p>
            {activeFilters > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={clearAll} className="h-8 gap-1.5">
                <X className="w-3.5 h-3.5" />
                Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-16 text-center">Loading opportunities…</p>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold">No opportunities match those filters</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try clearing the search box or widening a filter.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={clearAll} className="mt-4">
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm border-collapse">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <SortHead label="Rank" k="rank" className="w-16" />
                  <SortHead label="Priority" k="priority" className="w-28" />
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Website</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Category</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Free or paid</th>
                  <SortHead label="Status" k="status" />
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Owner</th>
                  <SortHead label="Target" k="targetDate" />
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Follow-up</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Apply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(o => {
                  const targetLate = isOverdue(o.targetDate, o.status);
                  const followLate = isOverdue(o.followUpDate, o.status);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => onOpen(o.id)}
                      className="align-top cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onOpen(o.id); }}
                          className="font-semibold tabular-nums text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${o.website}`}
                        >
                          {o.rank}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={priorityClass(o.priority)}>{o.priority}</Badge>
                      </td>
                      <td className="px-3 py-3 max-w-[16rem]">
                        <span className="font-medium">{o.website}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{o.domain}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{o.category}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[14rem]">{o.cost}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={statusClass(o.status)}>{o.status}</Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{o.owner}</td>
                      <td className={`px-3 py-3 tabular-nums ${targetLate ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {o.targetDate ? (
                          <span className="inline-flex items-center gap-1">
                            {targetLate && <AlertTriangle className="w-3.5 h-3.5" aria-label="Overdue" />}
                            {formatDate(o.targetDate)}
                          </span>
                        ) : <span className="text-muted-foreground/50">Not set</span>}
                      </td>
                      <td className={`px-3 py-3 tabular-nums ${followLate ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {o.followUpDate ? (
                          <span className="inline-flex items-center gap-1">
                            {followLate && <AlertTriangle className="w-3.5 h-3.5" aria-label="Overdue" />}
                            {formatDate(o.followUpDate)}
                          </span>
                        ) : <span className="text-muted-foreground/50">Not set</span>}
                      </td>
                      <td className="px-3 py-3 text-xs" onClick={e => e.stopPropagation()}>
                        <ExtLink href={o.applyUrl}>Open</ExtLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ─── Opportunity dialog ───────────────────────────────────────────────────────
function OpportunityDialog({
  opportunity: o, template, onClose, onChange,
}: {
  opportunity: Opportunity | null;
  template?: OutreachTemplate;
  onClose: () => void;
  onChange: (data: Partial<Opportunity>) => void;
}) {
  if (!o) return null;

  const complete = isComplete(o.status);
  const targetLate = isOverdue(o.targetDate, o.status);
  const followLate = isOverdue(o.followUpDate, o.status);

  const labelClass = "block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  return (
    <Dialog open={!!o} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">Rank {o.rank}</span>
            <Badge variant="outline" className={priorityClass(o.priority)}>{o.priority}</Badge>
            <Badge variant="outline" className={statusClass(o.status)}>{o.status}</Badge>
          </div>
          <DialogTitle className="text-left">{o.website}</DialogTitle>
          <p className="text-sm text-muted-foreground text-left">{o.domain} · {o.category}</p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {o.applyUrl && (
            <Button asChild size="sm" className="gap-1.5">
              <a href={o.applyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open application page
              </a>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={complete ? "default" : "outline"}
            onClick={() => onChange({ status: complete ? "Applied/contacted" : "Approved" })}
            aria-pressed={complete}
            className={complete ? "gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" : "gap-1.5"}
          >
            <Check className="w-4 h-4" />
            {complete ? "Marked complete" : "Mark complete"}
          </Button>
          {template && <CopyButton text={template.wording} label={`Copy ${template.templateId}`} />}
        </div>

        {/* ── Working state ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">Your record</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bl-status" className={labelClass}>Status</label>
                <Select value={o.status} onValueChange={v => onChange({ status: v })}>
                  <SelectTrigger id="bl-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="bl-owner" className={labelClass}>Owner</label>
                <Input
                  id="bl-owner"
                  defaultValue={o.owner ?? ""}
                  onBlur={e => e.target.value !== (o.owner ?? "") && onChange({ owner: e.target.value })}
                  placeholder="Who is doing this"
                />
              </div>

              <div>
                <label htmlFor="bl-target" className={labelClass}>Target date</label>
                <Input
                  id="bl-target"
                  type="date"
                  value={toDateInput(o.targetDate)}
                  onChange={e => onChange({ targetDate: e.target.value })}
                  className={targetLate ? "border-destructive text-destructive" : ""}
                />
                {targetLate && (
                  <p className="mt-1 text-xs font-medium text-destructive inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Target date has passed
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bl-contacted" className={labelClass}>Date contacted</label>
                <Input
                  id="bl-contacted"
                  type="date"
                  value={toDateInput(o.dateContacted)}
                  onChange={e => onChange({ dateContacted: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="bl-followup" className={labelClass}>Follow-up date</label>
                <Input
                  id="bl-followup"
                  type="date"
                  value={toDateInput(o.followUpDate)}
                  onChange={e => onChange({ followUpDate: e.target.value })}
                  className={followLate ? "border-destructive text-destructive" : ""}
                />
                {followLate && (
                  <p className="mt-1 text-xs font-medium text-destructive inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Follow-up is overdue
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bl-live" className={labelClass}>Live backlink URL</label>
                <Input
                  id="bl-live"
                  type="url"
                  inputMode="url"
                  defaultValue={o.liveUrl ?? ""}
                  onBlur={e => e.target.value !== (o.liveUrl ?? "") && onChange({ liveUrl: e.target.value })}
                  placeholder="https://"
                />
                {o.liveUrl && (
                  <p className="mt-1 text-xs"><ExtLink href={o.liveUrl}>Check the live link</ExtLink></p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="bl-notes" className={labelClass}>Notes</label>
              <Textarea
                id="bl-notes"
                rows={4}
                defaultValue={o.notes ?? ""}
                onBlur={e => e.target.value !== (o.notes ?? "") && onChange({ notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Analysis ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">From the workbook</h3>

            <div>
              <p className={labelClass}>Why it is valuable</p>
              <p className="text-sm leading-relaxed">{o.why}</p>
            </div>
            <div>
              <p className={labelClass}>Competitors with the link</p>
              <p className="text-sm leading-relaxed">{o.competitors}</p>
            </div>
            <div>
              <p className={labelClass}>Groups seen</p>
              <p className="text-sm">{(o.groups ?? []).join(", ") || "Not recorded"}</p>
            </div>
            <div>
              <p className={labelClass}>Free or paid</p>
              <p className="text-sm">{o.cost}</p>
            </div>
            <div>
              <p className={labelClass}>Application or contact page</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <ExtLink href={o.applyUrl}>{o.applyUrl}</ExtLink>
                {o.applyUrl && <CopyButton text={o.applyUrl} />}
              </div>
            </div>
            <div>
              <p className={labelClass}>Information needed</p>
              <p className="text-sm leading-relaxed">{o.infoNeeded}</p>
              {o.infoNeeded && <CopyButton text={o.infoNeeded} label="Copy list" className="mt-2" />}
            </div>
            <div>
              <p className={labelClass}>Outreach route</p>
              <p className="text-sm">
                {template ? `Template ${template.templateId}: ${template.use}` : o.template}
              </p>
            </div>

            {template && (
              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className={labelClass}>Template {template.templateId} wording</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{template.wording}</p>
                <CopyButton text={template.wording} label="Copy wording" className="mt-3" />
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

// ─── Listing pack ─────────────────────────────────────────────────────────────
function ListingPackPanel({
  items, onSave,
}: {
  items: ListingPackItem[];
  onSave: (id: number, data: Partial<ListingPackItem>) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const complete = items.filter(i => i.status === "Known" || i.status === "Approved").length;
  const percent = items.length ? Math.round((complete / items.length) * 100) : 0;
  const missing = items.filter(i => i.status === "Missing" || i.status === "Incomplete");

  const sections = useMemo(() => {
    const map = new Map<string, ListingPackItem[]>();
    for (const i of items) {
      const list = map.get(i.section) ?? [];
      list.push(i);
      map.set(i.section, list);
    }
    return [...map.entries()];
  }, [items]);

  const packText = items.filter(i => i.value).map(i => `${i.field}: ${i.value}`).join("\n");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{LISTING_PACK_INTRO}</p>
        <CopyButton text={packText} label="Copy the whole pack" />
      </div>

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Completion</h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {complete} of {items.length} known or approved
              <span className="ml-2 font-semibold text-foreground">{percent}%</span>
            </p>
          </div>
          <div
            className="mt-3 h-2.5 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
            aria-label="Listing pack completion"
          >
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4 min-w-0">
          {sections.map(([section, rows]) => (
            <Card key={section}>
              <h2 className="px-5 py-3 border-b border-border bg-muted/40 text-sm font-semibold rounded-t-lg">{section}</h2>
              <ul className="divide-y divide-border">
                {rows.map(item => (
                  <li key={item.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{item.field}</h3>
                          <Badge variant="outline" className={packStatusClass(item.status)}>{item.status}</Badge>
                        </div>

                        {editing === item.id ? (
                          <div className="mt-2">
                            <label htmlFor={`pack-${item.id}`} className="sr-only">{item.field}</label>
                            <Textarea
                              id={`pack-${item.id}`}
                              rows={item.section === "Copy" ? 6 : 2}
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              placeholder="Add the confirmed value"
                            />
                            <div className="flex gap-2 mt-2">
                              <Button
                                type="button" size="sm"
                                onClick={() => { onSave(item.id, { value: draft.trim() }); setEditing(null); }}
                                className="gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : item.value ? (
                          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{item.value}</p>
                        ) : (
                          <p className="mt-1.5 text-sm italic text-muted-foreground">Nothing recorded yet.</p>
                        )}

                        {item.remaining && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                            <span className="font-semibold uppercase tracking-wider">What remains</span>: {item.remaining}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Select value={item.status} onValueChange={v => onSave(item.id, { status: v })}>
                          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PACK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {editing !== item.id && (
                          <Button
                            type="button" size="sm" variant="outline" className="h-8 gap-1.5"
                            onClick={() => { setDraft(item.value ?? ""); setEditing(item.id); }}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </Button>
                        )}
                        <CopyButton text={item.value ?? ""} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Missing information</h2>
            {missing.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Every field is known or approved. The pack is ready to reuse.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {missing.map(i => (
                  <li key={i.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${i.status === "Missing" ? "bg-destructive" : "bg-amber-500"}`} />
                      <span className="font-medium">{i.field}</span>
                    </div>
                    <p className="ml-4 mt-0.5 text-xs text-muted-foreground leading-relaxed">{i.remaining}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────
function TemplatesPanel({
  templates, opportunities, onSave,
}: {
  templates: OutreachTemplate[];
  opportunities: Opportunity[];
  onSave: (id: number, wording: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mb-5">{TEMPLATE_INTRO}</p>
      <div className="space-y-4">
        {templates.map(t => {
          const users = opportunities.filter(o => o.template === t.templateId);
          return (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {t.templateId}
                    </span>
                    <h2 className="text-sm font-semibold">{t.use}</h2>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {editing !== t.id && (
                      <Button
                        type="button" size="sm" variant="outline" className="h-8 gap-1.5"
                        onClick={() => { setDraft(t.wording); setEditing(t.id); }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    )}
                    <CopyButton text={t.wording} label="Copy wording" />
                  </div>
                </div>

                {editing === t.id ? (
                  <div className="mt-3">
                    <label htmlFor={`tmpl-${t.id}`} className="sr-only">Wording for template {t.templateId}</label>
                    <Textarea id={`tmpl-${t.id}`} rows={9} value={draft} onChange={e => setDraft(e.target.value)} />
                    <div className="flex gap-2 mt-2">
                      <Button type="button" size="sm" onClick={() => { onSave(t.id, draft); setEditing(null); }} className="gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{t.wording}</p>
                )}

                {users.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Used by {users.length} opportunit{users.length === 1 ? "y" : "ies"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {users.map(u => u.website).join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ─── Avoid ────────────────────────────────────────────────────────────────────
function AvoidPanel() {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof BACKLINK_SKIP_LIST>();
    for (const item of BACKLINK_SKIP_LIST) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, []);

  const tone = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("spam")) return "bg-destructive";
    if (c.includes("low-quality") || c.includes("low-value")) return "bg-amber-500";
    return "bg-primary";
  };

  return (
    <>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mb-4">{SKIP_INTRO}</p>

      <Card className="mb-5 border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-5 flex gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-sm font-semibold">Do not copy a competitor backlink simply because it exists</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              The {BACKLINK_SKIP_LIST.length} entries below explain why parts of the competitor profile are
              either ineligible for this clinic or actively harmful to chase. Each one records what would
              have to change before it could be reconsidered.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {grouped.map(([category, rows]) => (
          <section key={category}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              {category}
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{rows.length}</Badge>
            </h2>
            <div className="mt-3 space-y-3">
              {rows.map(item => (
                <Card key={item.examples} className="relative overflow-hidden">
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${tone(category)}`} aria-hidden />
                  <CardContent className="p-5 pl-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-mono text-sm font-medium break-all">{item.examples}</p>
                      <Badge variant="outline" className="shrink-0">Seen in {item.seenIn}</Badge>
                    </div>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why to skip</dt>
                        <dd className="mt-1 text-sm leading-relaxed">{item.why}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Only reconsider when</dt>
                        <dd className="mt-1 text-sm leading-relaxed">{item.reconsider}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ─── Competitors ──────────────────────────────────────────────────────────────
function CompetitorsPanel() {
  const maxDomains = Math.max(...BACKLINK_COMPETITORS.map(c => c.domains));

  return (
    <>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mb-4">{GROUP_INTRO}</p>

      <Card className="mb-5 border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex gap-3">
          <Info className="w-5 h-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">
              Authority Score is a third-party diagnostic, not a Google ranking metric
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              The Authority Score columns below come from the supplied Semrush exports. Google does not
              publish or use that score. Read the numbers as a rough sort order for where to look first,
              never as evidence of how a competitor ranks.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {BACKLINK_GROUPS.map(g => (
          <Card key={g.group}>
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{g.group}</h2>
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {g.gapRows.toLocaleString("en-GB")} gap rows
                </Badge>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Competitors assessed ({g.competitors.length})
                  </dt>
                  <dd className="mt-1">{g.competitors.join(", ")}</dd>
                </div>
                <div className="flex gap-6">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Raw leader</dt>
                    <dd className="mt-1 font-medium">{g.rawLeader}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Leader rows at AS 30 plus</dt>
                    <dd className="mt-1 font-medium tabular-nums">{g.leaderStrongRows}</dd>
                  </div>
                </div>
              </dl>
              <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground leading-relaxed">
                {g.conclusion}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <h2 className="px-5 py-3 border-b border-border bg-muted/40 text-sm font-semibold rounded-t-lg">
          Individual competitor comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm border-collapse">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Group</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Competitor</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Domains</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">AS 30 plus</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {BACKLINK_COMPETITORS.map(c => (
                <tr key={`${c.group}-${c.competitor}`} className="align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.group}</td>
                  <td className="px-4 py-3 font-medium">{c.competitor}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums">{c.domains.toLocaleString("en-GB")}</span>
                      <span className="h-1.5 w-16 shrink-0 rounded-full bg-muted overflow-hidden" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.domains / maxDomains) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.strongRows}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md">{c.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            Source domain analysis
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{SOURCE_DATA_SUMMARY}</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {SOURCE_DOMAINS_SHORTLISTED} of those domains were carried into the action plan. The remainder
            were marked no action because no realistic, relevant and repeatable opportunity was identified.
            Three further targets are strategic additions that did not appear in the supplied gap at all.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
