// Activity (UX plan 3.4): every run, newest first, what it read and wrote, and whether it worked.
// Silence is a failure: a run that does not log shows here as missed once the heartbeat sees it.
import { useState } from "react";
import { useActivity, dayTime, type Run } from "@/lib/alfred";
import { StateDot } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";

const STATE: Record<string, { dot: string; word: string }> = { ok: { dot: "fresh", word: "OK" }, partial: { dot: "ageing", word: "Partial" }, failed: { dot: "failed", word: "Failed" }, missed: { dot: "stale", word: "Missed" } };

export default function ActivityPage() {
  const { data, isLoading } = useActivity();
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState("all");
  const runs = data?.runs ?? [];
  const agents = [...new Set(runs.map((r) => r.agent))];
  const shown = runs.filter((r) => (agent === "all" || r.agent === agent) && (status === "all" || r.status === status || (status === "changed" && (r.wrote?.length || r.proposed))));
  const sel = "min-h-[40px] rounded-full border border-input px-3 text-[0.85rem] bg-background";
  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-3">
        <span className="eyebrow">Activity</span>
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">What the agents did</h1>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)} className={sel}><option value="all">Every agent</option>{agents.map((a) => <option key={a}>{a}</option>)}</select>
          <select aria-label="Result" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="all">Any result</option><option value="ok">OK</option><option value="partial">Partial</option><option value="failed">Failed</option><option value="missed">Missed</option><option value="changed">Changed something</option></select>
        </div>
      </header>
      {isLoading && <Skeleton className="h-40 rounded-xl" />}
      {!isLoading && shown.length === 0 && <p className="text-ink-muted">No runs logged yet. Each scheduled run writes a row here as its last step.</p>}
      {shown.length > 0 && (
        <ol className="divide-y divide-border rounded-xl border border-card-border">
          {shown.map((r: Run) => {
            const st = STATE[r.status] ?? STATE.ok;
            return (
              <li key={r.id} className="px-4 py-3 grid gap-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[0.82rem] text-ink-muted tabular">{dayTime(r.started_at ?? r.finished_at)}</span>
                  <span className="font-semibold text-ink">{r.agent}</span>
                  <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.12em]"><StateDot state={st.dot} />{st.word}</span>
                </div>
                {r.summary && <p className="text-[0.9rem] text-ink leading-relaxed">{r.summary}</p>}
                <p className="text-[0.78rem] text-ink-muted">
                  {r.sources?.length ? <>Read: {r.sources.map((s) => `${s.source}${s.to && !Number.isNaN(Date.parse(s.to)) ? ` (to ${dayTime(s.to)})` : ""}`).join(", ")}. </> : null}
                  {r.wrote?.length ? <>Wrote: {r.wrote.join(", ")}. </> : null}
                  {r.proposed ? <>Proposed: {r.proposed}. </> : null}{r.alerts ? <>Alerts: {r.alerts}.</> : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
