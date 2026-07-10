import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { formatGBP } from "@/lib/format";

const PROJECT_ID = 1;

type DigestTask = { id: number; title: string; phase?: string; due?: string; owner?: string | null };
type Digest = {
  generatedAt: string;
  daysToOpen: number | null;
  targetOpeningDate: string | null;
  completedThisWeek: DigestTask[];
  inProgress: DigestTask[];
  overdue: DigestTask[];
  dueNext7Days: DigestTask[];
  money: { paidToDate: number; committed: number; plannedTotal: number };
  tenders: { suppliers: number; contracted: number; quotesAwaitingDecision: number };
  compliance: { done: number; total: number };
  hiring: { name: string; startMonth: string | null; overdue: boolean }[];
  focus: string | null;
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}

function TaskList({ heading, tasks, empty, showDue }: { heading: string; tasks: DigestTask[]; empty: string; showDue?: boolean }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{heading} ({tasks.length})</h3>
      {tasks.length === 0
        ? <p className="text-sm text-muted-foreground mt-1.5">{empty}</p>
        : (
          <ul className="mt-1.5 space-y-1">
            {tasks.map(t => (
              <li key={t.id} className="text-sm flex items-baseline gap-2">
                <span className="flex-1">{t.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t.phase}{showDue && t.due ? ` · due ${fmtDate(t.due)}` : ""}{t.owner ? ` · ${t.owner}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

export default function DigestPage() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async (withAi: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${PROJECT_ID}/weekly-digest${withAi ? "?ai=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load digest");
      setDigest(j as Digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load digest");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(true); }, []);

  const copyText = async () => {
    if (!digest) return;
    const L: string[] = [];
    L.push(`WINCHESTER LAUNCH — WEEKLY BRIEF (${new Date(digest.generatedAt).toLocaleDateString("en-GB")})`);
    if (digest.daysToOpen != null) L.push(`${digest.daysToOpen} days to opening (${fmtDate(digest.targetOpeningDate)})`);
    if (digest.focus) L.push("", "FOCUS THIS WEEK", digest.focus);
    const add = (h: string, ts: DigestTask[], due = false) => {
      L.push("", `${h.toUpperCase()} (${ts.length})`);
      ts.length ? ts.forEach(t => L.push(`- ${t.title}${due && t.due ? ` (due ${fmtDate(t.due)})` : ""}`)) : L.push("- none");
    };
    add("Overdue", digest.overdue, true);
    add("Due in the next 7 days", digest.dueNext7Days, true);
    add("In progress", digest.inProgress);
    add("Completed this week", digest.completedThisWeek);
    L.push("", "MONEY", `Paid to date: ${formatGBP(digest.money.paidToDate)}`, `Committed: ${formatGBP(digest.money.committed)}`, `Planned total: ${formatGBP(digest.money.plannedTotal)}`);
    L.push("", "TENDERS", `${digest.tenders.suppliers} suppliers · ${digest.tenders.contracted} contracted · ${digest.tenders.quotesAwaitingDecision} quotes awaiting a decision`);
    L.push("", "COMPLIANCE", `${digest.compliance.done} of ${digest.compliance.total} items complete`);
    if (digest.hiring.length) L.push("", "HIRING", ...digest.hiring.map(h => `- ${h.overdue ? "OVERDUE: " : "Start recruiting: "}${h.name} (target start ${h.startMonth ?? "TBC"})`));
    await navigator.clipboard.writeText(L.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Weekly Brief</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
            The Monday check-in — what moved, what's due, where the money is
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={copyText} disabled={!digest}>
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            {copied ? "Copied" : "Copy for email"}
          </Button>
          <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Today</Button></Link>
        </div>
      </div>

      {loading && !digest && (
        <Card><CardContent className="p-8 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />Preparing your brief… (the focus paragraph is AI-written, ~30s)
        </CardContent></Card>
      )}
      {error && <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>}

      {digest && (
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <p className="font-serif text-2xl">
                {digest.daysToOpen != null ? <>{digest.daysToOpen} days to opening</> : "Opening date not set"}
              </p>
              <p className="text-xs text-muted-foreground">Generated {new Date(digest.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>

            {digest.focus && (
              <div className="mt-4 bg-accent rounded-md p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em]">Focus this week</h3>
                <p className="text-sm leading-relaxed mt-1.5 whitespace-pre-line">{digest.focus}</p>
              </div>
            )}

            <TaskList heading="Overdue" tasks={digest.overdue} empty="Nothing overdue." showDue />
            <TaskList heading="Due in the next 7 days" tasks={digest.dueNext7Days} empty="Nothing dated in the next 7 days." showDue />
            <TaskList heading="In progress" tasks={digest.inProgress} empty="Nothing marked in progress." />
            <TaskList heading="Completed this week" tasks={digest.completedThisWeek} empty="No tasks completed in the last 7 days." />

            {digest.hiring.length > 0 && (
              <section className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Hiring — act now ({digest.hiring.length})</h3>
                <ul className="mt-1.5 space-y-1">
                  {digest.hiring.map((h, i) => (
                    <li key={i} className={`text-sm ${h.overdue ? "text-destructive font-medium" : ""}`}>
                      {h.overdue ? "Overdue: " : "Start recruiting: "}{h.name}<span className="text-muted-foreground"> · target start {h.startMonth ?? "TBC"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-border">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Money</h3>
                <p className="text-sm mt-1.5">Paid <span className="font-semibold">{formatGBP(digest.money.paidToDate)}</span></p>
                <p className="text-sm">Committed <span className="font-semibold">{formatGBP(digest.money.committed)}</span></p>
                <p className="text-sm">Planned <span className="font-semibold">{formatGBP(digest.money.plannedTotal)}</span></p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tenders</h3>
                <p className="text-sm mt-1.5">{digest.tenders.suppliers} suppliers</p>
                <p className="text-sm">{digest.tenders.contracted} contracted</p>
                <p className="text-sm">{digest.tenders.quotesAwaitingDecision} quotes awaiting decision</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Compliance</h3>
                <p className="text-sm mt-1.5">{digest.compliance.done} of {digest.compliance.total} complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
