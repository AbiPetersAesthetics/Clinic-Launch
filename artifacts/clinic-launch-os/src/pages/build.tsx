// More > Build: how far the ALFRED build has got. Every deliverable in the master plan, grouped by
// area, with its status and a note; the build line is the real deploy time and commit.
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHead, Section } from "@/components/page";

interface BuildStatus { percent: number; counts: { done: number; partial: number; todo: number; total: number }; builtIso: string | null; commit: string | null; items: { area: string; name: string; status: "done" | "partial" | "todo"; note: string }[] }

export const useBuildStatus = () => useQuery({ queryKey: ["alfred", "build"], queryFn: async () => (await fetch("/api/build-status")).json() as Promise<BuildStatus>, staleTime: 10 * 60_000 });

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function BuildLine({ className = "" }: { className?: string }) {
  const { data } = useBuildStatus();
  if (!data?.builtIso) return null;
  return <Link href="/build" className={`text-[0.72rem] text-ink-muted hover:underline ${className}`}>Build {when(data.builtIso)} · {data.percent}% complete</Link>;
}

const WORD = { done: "Done", partial: "Partly done", todo: "To do" } as const;
const DOT = { done: "bg-sage-deep border-sage-deep", partial: "bg-watch-bg border-watch", todo: "bg-transparent border-ink-muted" } as const;

export default function BuildPage() {
  const { data } = useBuildStatus();
  const areas = [...new Set((data?.items ?? []).map((i) => i.area))];
  return (
    <Page>
      <PageHead eyebrow="More" title="Build" back={{ href: "/more", label: "More" }}>
        {data && <p className="font-display text-[1.35rem] leading-[1.35] text-ink max-w-[46ch]">ALFRED is {data.percent}% built: {data.counts.done} of {data.counts.total} parts done, {data.counts.partial} partly done, {data.counts.todo} still to do.</p>}
        {data && (
          <div className="max-w-xl" aria-hidden>
            <div className="h-px bg-line-strong relative"><div className="absolute left-0 top-0 h-px bg-ink" style={{ width: `${data.percent}%` }} /></div>
          </div>
        )}
        {data?.builtIso && <p className="text-[0.78rem] text-ink-muted">Last deployed {when(data.builtIso)}, commit {data.commit}. Done means live, showing real data or the honest "not measured yet", and readable on a phone.</p>}
      </PageHead>
      {areas.map((a) => (
        <Section key={a} title={a}>
          <ul className="border-t border-border">
            {data!.items.filter((i) => i.area === a).map((i) => (
              <li key={i.name} className="py-2.5 border-b border-border grid gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">{i.name}</span>
                  <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted shrink-0"><span className={`w-[7px] h-[7px] rounded-full border-[1.5px] ${DOT[i.status]}`} />{WORD[i.status]}</span>
                </div>
                <span className="text-[0.82rem] text-ink-muted leading-snug">{i.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </Page>
  );
}
