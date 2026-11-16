// Stock cost, treatment by treatment (owner, 16 Nov 2026). Every Bedhampton and Winchester treatment
// with its own product cost at each clinic (Winchester filler is a more premium product), priced at
// Bedhampton, at Winchester's introductory price and at Winchester's list, and its gross profit and gross margin, after VAT
// gross margin after VAT and product. The owner types the figures in; anything missing is flagged.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID } from "@/lib/alfred";
import { gbp0 } from "@/components/page";
import { Hover, TipHead, TipRow, TipNote, V } from "@/components/viz";

interface Item { key: string; name: string; category: string; courseSize: number | null; bedhPrice: number | null; wincList: number | null; introPrice: number | null; introSource: string | null; bedhCost: number | null; wincCost: number | null; bedhSource: string | null; wincSource: string | null; bedhPriceSource?: string; wincListSource?: string }
type Edit = Partial<Record<"bedhCost" | "wincCost" | "introPrice", string>>;
const CAT: Record<string, string> = { anti_wrinkle: "Anti-wrinkle treatment", filler: "Dermal filler", regenerative: "Skin boosters and regenerative", skin: "Skin treatments and facials" };
const gbp2 = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// Gross profit on one treatment: sales before VAT (the price less the one sixth of VAT inside it)
// less the cost of sales (the product). Gross margin is that as a share of sales before VAT.
function grossProfit(price: number | null, cost: number | null, vatRate: number) {
  if (price == null || price <= 0 || cost == null) return null;
  const vat = (price * vatRate) / (1 + vatRate), net = price - vat, gp = net - cost;
  return { pounds: gp, margin: (100 * gp) / net, vat, net };
}

function Margin({ price, cost, vatRate, label }: { price: number | null; cost: number | null; vatRate: number; label: string }) {
  const k = grossProfit(price, cost, vatRate);
  if (price == null) return <span className="text-ink-muted">not offered</span>;
  if (!k) return <span className="text-watch font-semibold">needs a cost</span>;
  const tone = k.margin >= 66 ? "text-good" : k.margin >= 48 ? "text-ink" : "text-act";
  return (
    <Hover tip={<><TipHead>{label}</TipHead><TipRow label="Price, including VAT" value={gbp2(price)} /><TipRow label="VAT, one sixth" value={`−${gbp2(Math.round(k.vat * 100) / 100)}`} /><TipRow label="Sales before VAT" value={gbp2(Math.round(k.net * 100) / 100)} /><TipRow label="Cost of sales (product)" value={`−${gbp2(cost!)}`} /><TipRow label="Gross profit" value={gbp2(Math.round(k.pounds * 100) / 100)} strong /><TipNote><span>Gross margin {Math.round(k.margin)}% of sales before VAT. Before overheads: rent, rates, staff and running costs.</span></TipNote></>}>
      <span className={`tabular font-bold ${tone} underline decoration-dotted underline-offset-4`}>{Math.round(k.margin)}%</span>
      <span className="block text-[0.74rem] text-ink-muted tabular">{gbp0(k.pounds)} gross profit</span>
    </Hover>
  );
}

export function StockEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["alfred", "stock-costs"], queryFn: async () => { const r = await fetch(`/api/projects/${PROJECT_ID}/stock-costs`); if (!r.ok) throw new Error("Could not load stock costs"); return r.json() as Promise<{ items: Item[]; savedAt: string | null; vatRate: number }>; } });
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const vatRate = data?.vatRate ?? 0.2;
  const val = (it: Item, f: keyof Edit): number | null => { const e = edits[it.key]?.[f]; if (e !== undefined) return e === "" ? null : Number(e); return it[f]; };
  const items = data?.items ?? [];
  const missing = items.filter((it) => val(it, "bedhCost") == null || val(it, "wincCost") == null);
  const estimates = items.filter((it) => (edits[it.key]?.bedhCost === undefined && it.bedhSource === "Launch OS estimate") || (edits[it.key]?.wincCost === undefined && it.wincSource === "Launch OS estimate"));
  const dirty = Object.keys(edits).length > 0;
  const groups = useMemo(() => { const g = new Map<string, Item[]>(); for (const it of items) { if (onlyMissing && val(it, "bedhCost") != null && val(it, "wincCost") != null) continue; g.set(it.category, [...(g.get(it.category) ?? []), it]); } return [...g.entries()]; }, [items, edits, onlyMissing]);
  const set = (it: Item, f: keyof Edit, v: string) => setEdits((x) => {
    const clean = v.replace(/[^0-9.]/g, "");
    const cur = { ...(x[it.key] ?? {}) };
    if (clean === (it[f] == null ? "" : String(it[f]))) delete cur[f]; else cur[f] = clean;
    const y = { ...x }; if (Object.keys(cur).length) y[it.key] = cur; else delete y[it.key]; return y;
  });
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, any> = {};
      for (const [k, e] of Object.entries(edits)) { body[k] = {}; for (const [f, v] of Object.entries(e)) body[k][f] = v === "" ? null : Number(v); }
      const r = await fetch(`/api/projects/${PROJECT_ID}/stock-costs`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: body }) });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.error ?? "Could not save" }); return; }
      qc.setQueryData(["alfred", "stock-costs"], j); setEdits({});
      setMsg({ ok: true, text: `Saved ${Object.keys(body).length} ${Object.keys(body).length === 1 ? "treatment" : "treatments"}.` });
    } finally { setBusy(false); }
  };
  const input = (it: Item, f: keyof Edit, src: string | null) => {
    const e = edits[it.key]?.[f];
    const v = e !== undefined ? e : it[f] == null ? "" : String(it[f]);
    const empty = v === "" && f !== "introPrice";
    return (
      <span className="grid gap-0.5 justify-items-end">
        <span className={`inline-flex items-center rounded-lg border px-2 min-h-[38px] w-[5.6rem] ${e !== undefined ? "border-ink bg-wash" : empty ? "border-watch bg-watch-bg" : "border-line-strong bg-card"}`}>
          <span className="text-ink-muted text-[0.85rem]">£</span>
          <input inputMode="decimal" value={v} onChange={(ev) => set(it, f, ev.target.value)} placeholder="?" aria-label={`${it.name}: ${f === "bedhCost" ? "product cost at Bedhampton" : f === "wincCost" ? "product cost at Winchester" : "Winchester introductory price"}`} className="w-full bg-transparent text-right tabular font-semibold text-ink outline-none" />
        </span>
        <span className="text-[0.68rem] text-ink-muted leading-none">{e !== undefined ? "changed" : empty ? "needs a figure" : v === "" ? "blank: list price" : src === "you" ? "your figure" : src ?? ""}</span>
      </span>
    );
  };
  if (!data) return <p className="text-ink-muted">Loading the treatment list.</p>;
  return (
    <div className="grid gap-3" id="w-stock-editor">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <b className="text-ink text-[1.02rem]">Stock cost, treatment by treatment</b>
        <span className="text-[0.8rem] text-ink-muted">{data.savedAt ? `last saved ${new Date(data.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "no figures of yours saved yet"}</span>
      </div>
      <p className="text-[0.9rem] text-ink-2 leading-relaxed max-w-[74ch]">Type what the product costs for one treatment, before VAT, at each clinic. Winchester has its own column because its filler is a more premium product. Gross margin is gross profit (sales before VAT, less the product) as a share of sales before VAT, before overheads; point at it for the working.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 min-h-[34px] text-[0.82rem] font-semibold ${missing.length ? "bg-watch-bg text-watch" : "bg-sage-whisper text-good"}`}>{missing.length ? `${missing.length} ${missing.length === 1 ? "treatment needs" : "treatments need"} a product cost` : "Every treatment has a product cost"}</span>
        {estimates.length > 0 && <span className="inline-flex items-center rounded-full px-3 min-h-[34px] text-[0.82rem] bg-wash text-ink-2">{estimates.length} still on the old Launch OS estimate</span>}
        <button type="button" onClick={() => setOnlyMissing((x) => !x)} aria-pressed={onlyMissing} className={`min-h-[34px] px-3.5 rounded-full border text-[0.82rem] font-semibold ${onlyMissing ? "bg-ink text-white border-ink" : "border-line-strong text-ink"}`}>{onlyMissing ? "Show every treatment" : "Show only the missing"}</button>
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[860px] text-[0.88rem]">
          <thead>
            <tr className="text-[0.64rem] uppercase tracking-[0.1em] text-ink-muted">
              <th className="text-left py-1 pr-3" rowSpan={2}>Treatment</th>
              <th colSpan={3} className="text-center py-1 border-b border-line-strong" style={{ background: V.wash }}>Bedhampton</th>
              <th className="w-3" />
              <th colSpan={4} className="text-center py-1 border-b border-line-strong" style={{ background: V.wash }}>Winchester</th>
            </tr>
            <tr className="text-[0.64rem] uppercase tracking-[0.1em] text-ink-muted border-b border-line-strong">
              <th className="text-right py-2 px-2">Price</th><th className="text-right py-2 px-2">Product</th><th className="text-right py-2 px-2">Gross margin</th>
              <th />
              <th className="text-right py-2 px-2">Product</th><th className="text-right py-2 px-2">Introductory price</th><th className="text-right py-2 px-2">Gross margin, introductory</th><th className="text-right py-2 px-2">List price, gross margin</th>
            </tr>
          </thead>
          {groups.map(([cat, list]) => (
            <tbody key={cat}>
              <tr><td colSpan={9} className="pt-4 pb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-ink">{CAT[cat] ?? cat}</td></tr>
              {list.map((it) => {
                const intro = val(it, "introPrice");
                return (
                  <tr key={it.key} className="border-b border-border align-top hover:bg-wash/50">
                    <td className="py-2 pr-3 text-ink font-semibold">{it.name}{it.courseSize ? <span className="block text-[0.72rem] font-normal text-ink-muted">prices per session; course of {it.courseSize}</span> : null}</td>
                    <td className="py-2 px-2 text-right tabular">{it.bedhPrice != null ? <>{gbp0(it.bedhPrice)}<span className="block text-[0.68rem] text-ink-muted leading-none pt-1">{it.bedhPriceSource}</span></> : <span className="text-ink-muted">not offered</span>}</td>
                    <td className="py-2 px-2 text-right">{input(it, "bedhCost", it.bedhSource)}</td>
                    <td className="py-2 px-2 text-right"><Margin price={it.bedhPrice} cost={val(it, "bedhCost")} vatRate={vatRate} label={`${it.name}, Bedhampton`} /></td>
                    <td />
                    <td className="py-2 px-2 text-right">{input(it, "wincCost", it.wincSource)}</td>
                    <td className="py-2 px-2 text-right">{input(it, "introPrice", it.introSource)}</td>
                    <td className="py-2 px-2 text-right"><Margin price={intro ?? it.wincList} cost={val(it, "wincCost")} vatRate={vatRate} label={`${it.name}, Winchester introductory`} /></td>
                    <td className="py-2 px-2 text-right"><span className="block tabular text-ink-2">{it.wincList != null ? gbp0(it.wincList) : "not offered"}{it.wincListSource && it.wincListSource !== "price list" ? <span className="block text-[0.68rem] text-ink-muted leading-none pt-0.5">{it.wincListSource}</span> : null}</span><Margin price={it.wincList} cost={val(it, "wincCost")} vatRate={vatRate} label={`${it.name}, Winchester list`} /></td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!dirty || busy} onClick={save} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.85rem] font-semibold disabled:opacity-40">{busy ? "Saving" : dirty ? `Save ${Object.keys(edits).length} ${Object.keys(edits).length === 1 ? "treatment" : "treatments"}` : "Nothing changed"}</button>
        {dirty && <button type="button" onClick={() => { setEdits({}); setMsg(null); }} className="min-h-[44px] px-5 rounded-full border border-ink text-[0.85rem] font-semibold text-ink">Put them back</button>}
        {msg && <span className={`text-[0.9rem] font-semibold ${msg.ok ? "text-good" : "text-act"}`}>{msg.text}</span>}
      </div>
      <p className="text-[0.82rem] text-ink-muted leading-relaxed max-w-[74ch]">These figures do not move the forecast yet. The forecast takes one stock figure for all treatments (30.6p in the pound), because the mix of treatments sold is not recorded. Once these costs are complete and the clinic refresh reads treatment counts from ANS, the forecast will take stock from this list instead. Prices marked ANS are what the online diary charges, read on 16 November; the rest come from the price list. Introductory prices start from the ANS record of 6 November.</p>
    </div>
  );
}
