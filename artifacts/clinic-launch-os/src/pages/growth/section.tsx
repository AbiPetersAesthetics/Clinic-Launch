// A Growth detail page: one section of the Ads Board (or Ads Ideas) on its own, framed from the same
// snapshot so every figure and accuracy check stays exactly as the board computes it.
import { useEffect, useState } from "react";
import { Page, PageHead } from "@/components/page";
import { EmbeddedBoard } from "@/components/board-shell";
import { PROJECT_ID } from "@/lib/alfred";

const ads = { href: "/growth/ads", label: "Ads" };
const SECTIONS: Record<string, { title: string; src: string; back: { href: string; label: string }; eyebrow?: string; note?: string }> = {
  "patient-maths": { title: "Patient Maths", src: `/api/projects/${PROJECT_ID}/boards/patient-maths`, back: ads, note: "How many consultations Abi can take, what a paying patient may cost, and the leads, clicks and budget that follow. Worked out live every time it opens." },
  "every-ad": { title: "Every ad and audience", src: `/api/projects/${PROJECT_ID}/boards/ads/ads`, back: ads, note: "Each ad best first, every audience with its fatigue, and the all-time figures." },
  "last-14-days": { title: "Last 14 days", src: `/api/projects/${PROJECT_ID}/boards/ads/last14`, back: ads, note: "Day by day spend, leads and bookings, and this week against last." },
  simulator: { title: "Simulator", src: `/api/projects/${PROJECT_ID}/boards/ads/simulator`, back: ads, note: "What a budget would buy. Every slider opens on a measured figure." },
  "how-it-works": { title: "How it works", src: `/api/projects/${PROJECT_ID}/boards/ads/how`, back: ads, note: "The scheduled runs that collect the data, and a lead's first 90 days." },
  pathway: { title: "Pathway", src: `/api/projects/${PROJECT_ID}/boards/ads/leads`, back: { href: "/patients", label: "Patients" }, eyebrow: "Patients" },
  ideas: { title: "Ads Ideas", src: `/api/projects/${PROJECT_ID}/boards/ads-ideas`, back: { href: "/more", label: "More" }, eyebrow: "Archive" },
  opening: { title: "Opening Board", src: `/api/projects/${PROJECT_ID}/boards/opening`, back: { href: "/more", label: "More" }, eyebrow: "Archive" },
};

export function GrowthSection({ id }: { id: string }) {
  const s = SECTIONS[id];
  if (!s) return null;
  return (
    <Page>
      <PageHead eyebrow={s.eyebrow ?? "Growth"} title={s.title} back={s.back}>{s.note && <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">{s.note}</p>}</PageHead>
      <EmbeddedBoard src={s.src} title={s.title} />
    </Page>
  );
}

// Plan: the 12 month calendar and month by month, with Ideas as a second tab.
export function PlanPage() {
  const fromHash = () => (window.location.hash === "#ideas" ? "ideas" : "plan");
  const [tab, setTab] = useState<"plan" | "ideas">(fromHash);
  useEffect(() => { const on = () => setTab(fromHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const choose = (t: "plan" | "ideas") => { setTab(t); history.replaceState(null, "", `#${t}`); };
  return (
    <Page>
      <PageHead eyebrow="Growth" title="Plan" back={{ href: "/growth", label: "Growth" }}>
        <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">What we advertise and when, month by month to December 2027, Black Friday included; and the ideas that could lift the return, with their evidence.</p>
      </PageHead>
      <div role="tablist" aria-label="Plan or ideas" className="flex gap-6 border-b border-border">
        {(["plan", "ideas"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => choose(t)} className={`min-h-[44px] -mb-px border-b-2 text-[0.92rem] ${tab === t ? "border-ink text-ink font-semibold" : "border-transparent text-ink-muted"}`}>{t === "plan" ? "The plan" : "Ideas"}</button>
        ))}
      </div>
      {tab === "plan"
        ? <EmbeddedBoard key="plan" src={`/api/projects/${PROJECT_ID}/boards/ads/plan`} title="The 12 month plan" />
        : <EmbeddedBoard key="ideas" src={`/api/projects/${PROJECT_ID}/boards/ads-ideas`} title="Ads Ideas" />}
    </Page>
  );
}
