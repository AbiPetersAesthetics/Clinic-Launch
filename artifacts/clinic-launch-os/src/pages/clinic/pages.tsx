// Clinic: the Diary (the Clinic Board), and Stock, a simple list Abi keeps from her screen. Low
// items become cards. The stock list is written only by the people using it.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID } from "@/lib/alfred";
import { Page, PageHead, Section, Rows, Next } from "@/components/page";
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
