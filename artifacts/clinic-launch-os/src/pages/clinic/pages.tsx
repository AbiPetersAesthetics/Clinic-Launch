// Clinic: the Diary (the Clinic Board), and Stock, a simple list Abi keeps from her screen. Low
// items become cards. The stock list is written only by the people using it.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID, useProposals } from "@/lib/alfred";
import { ProposalCard } from "@/components/proposal-card";
import PeoplePage from "@/pages/people";
import CompliancePage from "@/pages/compliance";
import ProjectPage from "@/pages/project";
import { Page, PageHead, Section, Rows, Next, longDay } from "@/components/page";
import { EmbeddedBoard } from "@/components/board-shell";

const back = { href: "/clinic", label: "Clinic" };

export function DiaryPage() {
  return (
    <Page>
      <PageHead eyebrow="Clinic" title="Diary" back={back}>
        <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">The next 14 days day by day, money taken against booked, the consultations booked from the ads, and from opening who turns up and comes back. Refreshed daily at about 07:40 from ANS.</p>
      </PageHead>
      <EmbeddedBoard src={`/api/projects/${PROJECT_ID}/boards/clinic`} title="Winchester Clinic Board" />
    </Page>
  );
}

interface Item { id: number; name: string; kind: string; clinic: string; onHand: number; reorderAt: number; low: boolean; updatedAt: string }

export function StockList({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["alfred", "stock"], queryFn: async () => (await fetch(`/api/projects/${PROJECT_ID}/stock`)).json() as Promise<{ items: Item[] }> });
  const [name, setName] = useState(""); const [onHand, setOnHand] = useState("1"); const [reorderAt, setReorderAt] = useState("1");
  const [err, setErr] = useState<string | null>(null);
  const call = async (url: string, method: string, body: unknown) => {
    setErr(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Could not save"); return; }
    qc.setQueryData(["alfred", "stock"], j);
  };
  const items = (data?.items ?? []).filter((i) => !compact || i.low);
  return (
    <div className="space-y-4">
      {items.length ? (
        <Rows>
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 border-b border-border">
              <span className="flex-1 min-w-0"><span className="block text-ink">{i.name}</span><span className={`block text-[0.78rem] ${i.low ? "text-watch" : "text-ink-muted"}`}>{i.low ? "Reorder: " : ""}{i.onHand} in stock, reorder at {i.reorderAt}, {i.clinic}</span></span>
              <button type="button" aria-label={`One fewer ${i.name}`} onClick={() => call(`/api/projects/${PROJECT_ID}/stock/${i.id}`, "PATCH", { onHand: Math.max(0, i.onHand - 1) })} className="w-11 h-11 rounded-full border border-ink text-ink text-lg">−</button>
              <span className="w-8 text-center tabular font-medium">{i.onHand}</span>
              <button type="button" aria-label={`One more ${i.name}`} onClick={() => call(`/api/projects/${PROJECT_ID}/stock/${i.id}`, "PATCH", { onHand: i.onHand + 1 })} className="w-11 h-11 rounded-full border border-ink text-ink text-lg">+</button>
            </li>
          ))}
        </Rows>
      ) : <p className="text-[0.9rem] text-ink-muted">{compact ? "Nothing is low." : "No items yet. Add the Obagi lines and consumables you want to keep an eye on, with the count at which to reorder."}</p>}
      {!compact && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void call(`/api/projects/${PROJECT_ID}/stock`, "POST", { name, onHand, reorderAt }).then(() => setName("")); }} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted flex-1 min-w-[160px]">Item<input value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] font-normal normal-case tracking-normal text-ink" placeholder="Obagi Vitamin C serum" /></label>
          <label className="grid gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted w-24">In stock<input inputMode="numeric" value={onHand} onChange={(e) => setOnHand(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] font-normal text-ink" /></label>
          <label className="grid gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-muted w-24">Reorder at<input inputMode="numeric" value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} className="min-h-[44px] rounded-xl border border-input px-3 text-[1rem] font-normal text-ink" /></label>
          <button type="submit" disabled={!name.trim()} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em] disabled:opacity-50">Add</button>
        </form>
      )}
      {err && <p className="text-act text-[0.85rem]">{err}</p>}
    </div>
  );
}

export function StockPage() {
  return (
    <Page>
      <PageHead eyebrow="Clinic" title="Stock" back={back}>
        <p className="text-[0.95rem] text-ink-muted max-w-[60ch]">Obagi and consumables against their reorder points. Abi updates the counts from her screen; anything at or under its reorder point shows as a card.</p>
      </PageHead>
      <Section title="Items"><StockList /></Section>
      <Next>The list is typed, not read from a supplier; its counts are only as current as the last tap.</Next>
    </Page>
  );
}

// Team and capacity: the facts that every rule must respect, the decisions that touch Abi's working
// pattern (made by Abi and David together), then the existing people and capacity page.
export function TeamPage() {
  const { data: props } = useProposals();
  const joint = (props?.open ?? []).filter((p) => (p.decide_with ?? "").includes("Abi"));
  return (
    <Page>
      <PageHead eyebrow="Clinic" title="Team and capacity" back={back} />
      <Section title="Abi's working pattern">
        <p className="text-[1.05rem] text-ink leading-relaxed max-w-[60ch]">Abi works Tuesday to Saturday and never on Mondays (owner, 15 Nov 2026). Winchester's published hours are Tuesday to Friday; Bedhampton is one day a week from December, the day still to be decided by Abi and David. No recommendation or diary rule proposes a Monday.</p>
      </Section>
      {joint.length > 0 && <Section title="To decide together"><div className="grid gap-3 md:grid-cols-2">{joint.map((p) => <ProposalCard key={p.id} p={p} compact />)}</div></Section>}
      <Section title="The second clinician">
        <p className="text-[0.98rem] text-ink-2 leading-relaxed max-w-[62ch]">The trigger is demand proven against Abi's capacity: the diary over 90% booked for three weeks running at Winchester. Diary fill is read each Monday by the capacity review; it is not measured until Winchester's first full week. Then the Patient Coordinator.</p>
      </Section>
      <Section title="People and capacity, as planned"><PeoplePage /></Section>
    </Page>
  );
}

// Compliance and the opening checklist are planning-era pages kept as they were. Each now opens the
// ALFRED way: a plain sentence saying what the page is and how far to trust it, then the old page.
export function ComplianceArea() {
  return (
    <div className="space-y-6">
      <PageHead eyebrow="Clinic" title="Compliance" back={back}>
        <p className="font-sans font-semibold text-[1.2rem] sm:text-[1.4rem] leading-snug text-ink max-w-[52ch]">This is the CQC tracker from the planning stage. Its readiness figures are only what has been ticked here, not how things stand.</p>
        <p className="text-[0.95rem] text-ink-2 max-w-[62ch]">The dated items that can lapse (insurance, registrations, training, policies, filming consent) are not tracked here yet; until they are, nothing on this page feeds Today.</p>
      </PageHead>
      <CompliancePage />
    </div>
  );
}

export function OpeningArea() {
  const { data } = useQuery({ queryKey: ["alfred", "project-dates"], queryFn: async () => (await fetch(`/api/projects/${PROJECT_ID}`)).json() as Promise<{ targetOpeningDate?: string | null }> });
  const open = data?.targetOpeningDate ? data.targetOpeningDate.slice(0, 10) : null;
  const days = open ? Math.ceil((Date.parse(`${open}T00:00:00Z`) - Date.now()) / 86400000) : null;
  return (
    <div className="space-y-6">
      <PageHead eyebrow="Clinic" title="Opening checklist" back={back}>
        {open && days != null && <p className="font-sans font-semibold text-[1.2rem] sm:text-[1.4rem] leading-snug text-ink max-w-[52ch]">{days > 0 ? `Winchester opens on ${longDay(open)}, in ${days} ${days === 1 ? "day" : "days"}.` : `Winchester opened on ${longDay(open)}.`}</p>}
        <p className="text-[0.95rem] text-ink-2 max-w-[62ch]">The project plan from the planning stage: every phase, task and cost, kept as it was. Abi's own countdown to the first patients is <Link href="/abi/ready" className="underline">Ready for Winchester</Link>.</p>
      </PageHead>
      <ProjectPage />
    </div>
  );
}
