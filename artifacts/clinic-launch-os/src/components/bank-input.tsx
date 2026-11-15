// Update the bank balance from Today or Money, without visiting the archive. The same save as the
// Bank today card on the Forecast Model page: the balance, its date, and any funding already in it.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_ID, dayMonth, useHand, type BankLite, type FundingOption } from "@/lib/alfred";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export function BankInput({ bank, fundingOptions, autoFocus = false, onSaved }: { bank: BankLite | null; fundingOptions: FundingOption[]; autoFocus?: boolean; onSaved?: () => void }) {
  const qc = useQueryClient();
  const hand = useHand();
  const [amount, setAmount] = useState("");
  const [asAt, setAsAt] = useState(todayIso());
  const [inBalance, setInBalance] = useState<number[]>(bank?.inBalance ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const due = fundingOptions.filter((f) => f.month <= asAt.slice(0, 7));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount.replace(/[£,\s]/g, ""));
    if (!Number.isFinite(n)) { setMsg({ ok: false, text: "Enter the balance in pounds" }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/projects/${PROJECT_ID}/cash-model/bank`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ balanceGbp: n, asAt, inBalance: inBalance.filter((id) => due.some((f) => f.id === id)) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not save the balance");
      setMsg({ ok: true, text: `Saved: ${gbp(n)} on ${dayMonth(asAt)}. Every board now starts from it.` });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["alfred"] });
      qc.invalidateQueries({ queryKey: ["cash-model"] });
      onSaved?.();
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save the balance" }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="grid gap-3" aria-label="Update the bank balance">
      <div className={`flex flex-wrap items-end gap-2 ${hand === "right" ? "flex-row-reverse" : ""}`}>
        <label className="grid gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-muted flex-1 min-w-[140px]">Tide balance (£)
          <input autoFocus={autoFocus} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={bank ? `was ${gbp(bank.balanceGbp)}` : "0"} className="min-h-[44px] rounded-xl border border-input bg-background px-3 text-[1rem] font-normal normal-case tracking-normal text-ink tabular" />
        </label>
        <label className="grid gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">As at
          <input type="date" value={asAt} max={todayIso()} onChange={(e) => setAsAt(e.target.value)} className="min-h-[44px] rounded-xl border border-input bg-background px-3 text-[1rem] font-normal normal-case tracking-normal text-ink" />
        </label>
        <button type="submit" disabled={busy || !amount} className="min-h-[44px] px-6 rounded-full bg-ink text-white text-[0.78rem] font-semibold uppercase tracking-[0.16em] disabled:opacity-50">{busy ? "Saving" : "Save"}</button>
      </div>
      {due.length > 0 && (
        <fieldset className="grid gap-1">
          <legend className="text-[0.8rem] text-ink-muted mb-1">Funding due by then: tick any already in this balance</legend>
          {due.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-[0.9rem] min-h-[32px]">
              <input type="checkbox" className="h-4 w-4" checked={inBalance.includes(f.id)} onChange={(e) => setInBalance((l) => (e.target.checked ? [...l, f.id] : l.filter((x) => x !== f.id)))} />
              <span>{f.label}</span><span className="text-ink-muted tabular">{gbp(f.amount)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {msg && <p role="status" className={`text-[0.85rem] ${msg.ok ? "text-good" : "text-act"}`}>{msg.text}</p>}
    </form>
  );
}
