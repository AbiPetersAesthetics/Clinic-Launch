// Studio (replaces the Social Board) and Search and reviews (replaces the SEO Board and Backlinks).
// Studio: what Abi films next, with the film-by date, the hook, the script and the campaign it feeds;
// what is live; how posts did. Search: the tracked queries for each clinic with the 3 day stale rule,
// and the Google profiles against named competitors.
import { usePage, type Chip } from "@/lib/alfred";
import { Page, PageHead, Section, Rows, RowItem, NotYet, Next, longDay } from "@/components/page";
import { Sources } from "@/components/fresh";
import { Skeleton } from "@/components/ui/skeleton";

const back = { href: "/growth", label: "Growth" };

export function StudioPage() {
  const { data } = usePage("studio");
  const next: any[] = data?.next ?? [];
  const first = next[0];
  return (
    <Page>
      <PageHead eyebrow="Growth" title="Studio" back={back}>
        {data && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{first ? `Next to film: ${first.id}, "${first.title}", by ${longDay(first.filmBy)}${first.overdue ? ", which has passed" : ""}. ${data.thisWeek > 1 ? `${data.thisWeek} clips are due in the next seven days.` : ""}` : "Nothing is waiting to be filmed."}</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <Section title="Film next" note={`${data.total} clips planned to December 2027`}>
            <Rows>
              {next.map((v) => (
                <li key={v.id} className="py-3 border-b border-border grid gap-1">
                  <div className="flex items-baseline gap-3"><span className="text-[0.85rem] text-ink-muted tabular w-[6.5rem] shrink-0">{longDay(v.filmBy)}</span><span className="font-semibold text-ink">{v.id} {v.title}</span></div>
                  <p className="text-[0.9rem] text-ink leading-relaxed sm:pl-[7.25rem]">"{v.hook}"</p>
                  <p className="text-[0.8rem] text-ink-muted sm:pl-[7.25rem]">For {v.forCampaign}{v.where ? `; filmed ${v.where}` : ""}{v.scriptRef ? <> · <a href={v.scriptRef} target="_blank" rel="noreferrer" className="underline">script</a></> : null}</p>
                </li>
              ))}
            </Rows>
          </Section>
          <Section title="Live now">
            {data.live.length ? <Rows>{data.live.map((v: any) => <RowItem key={v.id}><span className="min-w-0"><span className="block font-semibold text-ink">{v.id} {v.title}</span><span className="block text-[0.82rem] text-ink-muted leading-relaxed">{v.notes}</span></span></RowItem>)}</Rows> : <p className="text-ink-muted">No clips live.</p>}
          </Section>
          <Section title="How posts and Reels did">
            {data.posts ? <p className="text-ink-muted">Post performance is in.</p> : <NotYet what={data.postsNote} />}
          </Section>
          {data.cadence && <Next>{data.cadence}</Next>}
        </>
      )}
    </Page>
  );
}

function QueryRows({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="text-ink-muted text-[0.9rem]">No tracked queries with impressions in the window.</p>;
  return (
    <Rows>
      {rows.map((q) => {
        const moved = q.prior != null ? q.prior - q.position : null;
        return (
          <li key={q.q} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 border-b border-border">
            <span className="min-w-0"><span className="block text-[0.92rem] text-ink">{q.q}</span><span className="block text-[0.78rem] text-ink-muted">{q.impressions} impressions, {q.clicks} clicks</span></span>
            <span className="text-right"><span className="block tabular font-medium text-ink">{q.position.toFixed(1)}</span><span className={`block text-[0.75rem] ${moved == null ? "text-ink-muted" : moved > 0.5 ? "text-good" : moved < -0.5 ? "text-act" : "text-ink-muted"}`}>{moved == null ? "new" : moved > 0.5 ? `up ${moved.toFixed(1)}` : moved < -0.5 ? `down ${(-moved).toFixed(1)}` : "steady"}</span></span>
          </li>
        );
      })}
    </Rows>
  );
}

export function SearchPage() {
  const { data } = usePage("search");
  const t = data?.totals;
  return (
    <Page>
      <PageHead eyebrow="Growth" title="Search and reviews" back={back}>
        {data && t && <p className="font-display text-[1.3rem] sm:text-[1.5rem] leading-[1.35] text-ink max-w-[52ch]">{data.stale ? `Search figures are stale: last refreshed ${data.lastRefreshed}. Nothing below feeds a verdict until the daily refresh runs again.` : `${t.window.clicks} clicks from ${t.window.impressions.toLocaleString("en-GB")} search impressions in the last 28 days, against ${t.priorWindow.clicks} from ${t.priorWindow.impressions.toLocaleString("en-GB")} in the 28 before.`}</p>}
        {data && <Sources chips={data.sources as Chip[]} />}
      </PageHead>
      {!data ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <p className="text-[0.82rem] text-ink-muted">Average position on Google for each tracked query, {data.window}. Lower is better; page one is 10 or under. A query needs about 30 impressions before it is acted on.</p>
          <Section title="Winchester"><QueryRows rows={data.winchester} /></Section>
          <Section title="Bedhampton"><QueryRows rows={data.bedhampton} /></Section>
          <Section title="Both clinics (no town named)"><QueryRows rows={data.shared} /></Section>
          <Section title="Google reviews against competitors">
            {data.reviews ? (
              <Rows>{(data.reviews.profiles ?? []).map((p: any) => <RowItem key={p.name}><span className="flex-1"><span className="block text-ink">{p.name}</span><span className="block text-[0.8rem] text-ink-muted">{p.town}</span></span><span className="tabular text-right"><span className="block font-medium">{p.reviews} reviews</span><span className="block text-[0.78rem] text-ink-muted">{p.rating} stars</span></span></RowItem>)}</Rows>
            ) : <NotYet what={data.reviewsNote} />}
          </Section>
          <Next>Citations and links progress joins this page from the Tuesday run; the old Backlinks page is in the archive.</Next>
        </>
      )}
    </Page>
  );
}
