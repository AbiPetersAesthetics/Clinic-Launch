// Settings: which hand holds the phone (left by default: Today at bottom left, Approve at the left of
// each card; right mirrors both), and how ALFRED tells you things.
import { setHand, useHand } from "@/lib/alfred";

export default function SettingsPage() {
  const hand = useHand();
  const opt = (h: "left" | "right", label: string) => (
    <label className={`flex items-center gap-3 min-h-[52px] px-4 rounded-xl border cursor-pointer ${hand === h ? "border-ink bg-wash" : "border-card-border"}`}>
      <input type="radio" name="hand" checked={hand === h} onChange={() => setHand(h)} className="w-4 h-4" />{label}
    </label>
  );
  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-3"><span className="eyebrow">More</span><h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight text-ink">Settings</h1></header>
      <section className="space-y-3" aria-labelledby="hand-h">
        <h2 id="hand-h" className="eyebrow">Hand</h2>
        <p className="text-[0.9rem] text-ink-muted">The phone tab bar and the Approve button sit where your thumb reaches them. Saved on this device.</p>
        <div className="grid gap-2 sm:grid-cols-2">{opt("left", "Left: Today at bottom left")}{opt("right", "Right: Today at bottom right")}</div>
      </section>
      <section className="space-y-3" aria-labelledby="n-h">
        <h2 id="n-h" className="eyebrow">Notifications</h2>
        <ul className="grid gap-2 text-[0.9rem]">
          <li className="rounded-xl border border-card-border p-4"><b>Morning brief email</b>, 07:45, to accounts@abipetersaesthetics.co.uk only, and only on days something needs a decision. Silence means fine.</li>
          <li className="rounded-xl border border-card-border p-4"><b>Push to this phone</b> for red alerts, 07:00 to 21:00. On an iPhone, ALFRED must be added to the home screen first.</li>
        </ul>
      </section>
    </div>
  );
}
