// The bank, held as the separate Tide accounts, each with where its figure came from and its date
// ("from statement, dated 13 Nov"). The forecast starts from the accounts in the bank; money still
// arriving (unsettled card takings) is shown but not counted. When a balance is saved, every funding
// row dated on or before it must be ticked as inside it or left out on purpose, so nothing is counted
// twice (data audit M2).
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID, dayMonth, type FundingOption } from "@/lib/alfred";

export interface Account { name: string; balanceGbp: number | null; source: string; asAt: string; arriving?: boolean }
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SOURCES = ["statement", "owner stated", "export, to confirm", "screenshot", "not known"];
const DEFAULTS: Account[] = [
  { name: "Current account", balanceGbp: null, source: "statement", asAt: todayIso() },
  { name: "Instant Saver", balanceGbp: null, source: "statement", asAt: todayIso() },
  { name: "Tax Saver", balanceGbp: null, source: "not known", asAt: todayIso() },
  { name: "Merchant account (card takings arriving)", balanceGbp: null, source: "screenshot", asAt: todayIso(), arriving: true },
];

export function AccountsView({ accounts }: { accounts: Account[] }) {
  const inBank = accounts.filter((a) => !a.arriving && a.balanceGbp != null).reduce((s, a) => s + (a.balanceGbp ?? 0), 0);
  return (
    <div className="grid gap-1">
      <ul className="border-t border-border">
        {accounts.map((a) => (
          <li key={a.name} className="flex items-baseline justify-between gap-3 py-2 border-b border-border">
            <span className="min-w-0"><span className="block text-ink">{a.name}</span><span className="block text-[0.8rem] text-ink-2">{a.balanceGbp == null ? "not measured yet" : `${a.arriving ? "arriving, not counted; " : ""}${a.source === "statement" ? "from statement" : a.source}, dated ${dayMonth(a.asAt)}`}</span></span>
            <span className="tabular font-medium text-ink shrink-0">{a.balanceGbp == null ? "" : gbp(a.balanceGbp)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-[1rem] font-semibold text-ink pt-1"><span>In the bank</span><span className="tabular">{gbp(inBank)}</span></p>
    </div>
  );
}

export function BankInput({ bank, fundingOptions, autoFocus = false, onSaved }: { bank: { balanceGbp: number; asAt: string; inBalance: number[]; accounts?: Account[] | null } | null; fundingOptions: FundingOption[]; autoFocus?: boolean; onSaved?: () => void }) {
  const qc = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>(() => (bank?.accounts?.length ? bank.accounts.map((a) => ({ ...a })) : DEFAULTS.map((a) => ({ ...a }))));
  const [inBalance, setInBalance] = useState<number[]>(bank?.inBalance ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const asAt = accounts.filter((a) => !a.arriving && a.balanceGbp != null).map((a) => a.asAt).sort().pop() ?? todayIso();
  const total = useMemo(() => accounts.filter((a) => !a.arriving && a.balanceGbp != null).reduce((s, a) => s + (a.balanceGbp ?? 0), 0), [accounts]);
  const due = fundingOptions.filter((f) => f.month <= asAt.slice(0, 7));
  const [seen, setSeen] = useState<number[]>([]);
  const unanswered = due.filter((f) => !inBalance.includes(f.id) && !seen.includes(f.id));
  const set = (i: number, patch: Partial<Account>) => setAccounts((l) => l.map((a, k) => (k === i ? { ...a, ...patch } : a)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accounts.some((a) => !a.arriving && a.balanceGbp != null)) { setMsg({ ok: false, text: "Enter at least one account's balance" }); return; }
    if (unanswered.length) { setMsg({ ok: false, text: `Say whether ${unanswered.map((f) => f.label).join(" and ")} is in this balance` }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/projects/${PROJECT_ID}/cash-model/bank`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ balanceGbp: Math.round(total * 100) / 100, asAt, inBalance: inBalance.filter((id) => due.some((f) => f.id === id)), accounts }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not save the balance");
      setMsg({ ok: true, text: `Saved: ${gbp(total)} in the bank at ${dayMonth(asAt)}. Every board now starts from it.` });
      qc.invalidateQueries({ queryKey: ["alfred"] });
      qc.invalidateQueries({ queryKey: ["cash-model"] });
      onSaved?.();
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save the balance" }); }
    finally { setBusy(false); }
  };

  const input = "min-h-[44px] rounded-xl border border-input bg-background px-3 text-[1rem] text-ink";
  return (
    <form onSubmit={save} className="grid gap-4" aria-label="Update the bank balance">
      {accounts.map((a, i) => (
        <fieldset key={a.name} className="grid gap-2 border-t border-border pt-3">
          <legend className="text-[0.95rem] font-semibold text-ink">{a.name}{a.arriving ? <span className="font-normal text-ink-2"> (shown, not counted)</span> : null}</legend>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input aria-label={`${a.name} balance in pounds`} autoFocus={autoFocus && i === 0} inputMode="decimal" value={a.balanceGbp ?? ""} placeholder="not known" onChange={(e) => set(i, { balanceGbp: e.target.value === "" ? null : Number(e.target.value.replace(/[£,\s]/g, "")) })} className={`${input} tabular`} />
            <input aria-label={`${a.name} as at`} type="date" value={a.asAt} max={todayIso()} onChange={(e) => set(i, { asAt: e.target.value })} className={input} />
          </div>
          <select aria-label={`${a.name} source`} value={a.source} onChange={(e) => set(i, { source: e.target.value })} className={input}>
            {SOURCES.map((s) => <option key={s} value={s}>{s === "statement" ? "From a statement" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </fieldset>
      ))}
      <p className="flex justify-between text-[1.05rem] font-semibold text-ink border-t border-line-strong pt-2"><span>In the bank, at {dayMonth(asAt)}</span><span className="tabular">{gbp(total)}</span></p>
      {due.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="text-[0.95rem] text-ink mb-1">Funding dated on or before {dayMonth(asAt)}: is each one inside this balance?</legend>
          {due.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 text-[0.95rem]">
              <span className="flex-1 min-w-[160px]">{f.label} <span className="text-ink-2 tabular">£{Math.round(f.amount).toLocaleString("en-GB")}</span></span>
              <button type="button" onClick={() => { setInBalance((l) => [...new Set([...l, f.id])]); setSeen((l) => [...l, f.id]); }} className={`min-h-[40px] px-4 rounded-full border text-[0.85rem] ${inBalance.includes(f.id) ? "bg-ink text-white border-ink" : "border-ink text-ink"}`}>In it</button>
              <button type="button" onClick={() => { setInBalance((l) => l.filter((x) => x !== f.id)); setSeen((l) => [...new Set([...l, f.id])]); }} className={`min-h-[40px] px-4 rounded-full border text-[0.85rem] ${seen.includes(f.id) && !inBalance.includes(f.id) ? "bg-ink text-white border-ink" : "border-ink text-ink"}`}>Not yet</button>
            </div>
          ))}
          <p className="text-[0.82rem] text-ink-2">If one has not arrived and its date is wrong, change the date on the funding record; the forecast counts it from that date.</p>
        </fieldset>
      )}
      <button type="submit" disabled={busy} className="justify-self-start min-h-[44px] px-8 rounded-full bg-ink text-white text-[0.85rem] font-semibold disabled:opacity-50">{busy ? "Saving" : "Save the bank"}</button>
      {msg && <p role="status" className={`text-[0.9rem] ${msg.ok ? "text-good" : "text-act"}`}>{msg.text}</p>}
    </form>
  );
}
