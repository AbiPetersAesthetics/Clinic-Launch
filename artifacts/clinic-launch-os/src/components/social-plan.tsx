import React, { useState } from "react";
import { Instagram, Video, Camera, CheckCircle2, Circle, Repeat, ShieldCheck, Star } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Social plan v2, after the three-model validation pass. Key corrections:
// the shoot is split around the analyser arriving mid-September; Winchester is a
// countdown, not a first reveal; founding is honest scarcity plus a spring wave-two
// waitlist so we never sell places that do not exist; Monday education rotates
// across treatments; a monthly Google-review Story ask; results carry a consent
// and a "one person's result" caveat. British English, no dashes, no POM named,
// no percentage discounts.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#b07aa1"; // matches the Social lane on the Level 0 timeline

const ENGINE = [
  { day: "Monday", tag: "Educate", what: "Answer one real question, and rotate the treatment so it never narrows: analysis, boosters, microneedling, polynucleotides, facials, peels, skincare.", eg: "“Before I recommend a single treatment, I do this.”" },
  { day: "Wednesday", tag: "Human", what: "The person and the place. Abi's story, the room taking shape, the countdown to Winchester.", eg: "“You know Winchester is coming. Here is where we are up to.”" },
  { day: "Friday", tag: "Proof or offer", what: "A client's words or the current call to action. Early on, lean on words, the free offer and founding scarcity, not staged results. Always end with what to do next.", eg: "“A handful of the 40 founding places are left.”" },
];

// Session 1: nothing here needs the analyser, so it can all be filmed now.
const SESSION1 = [
  { id: "s1a", t: "Meet Abi", hook: "“I trained as a nurse before I ever touched skin. Here is why that changes everything for you.” ANP and Independent Prescriber, why you opened.", len: "45s" },
  { id: "s1b", t: "What a skin booster actually is", hook: "“Skin boosters, what actually are they?” Not filler, think a deep drink of water for the skin.", len: "30s" },
  { id: "s1c", t: "Nurse-led vs the high street", hook: "“The real difference in medical aesthetics is the part you cannot see on Instagram.” Safety, honesty, prescribing. One of your strongest angles.", len: "30s" },
  { id: "s1d", t: "When I will talk you out of a treatment", hook: "“I will happily tell you when you do not need one.” The honesty angle, your other strongest.", len: "30s" },
  { id: "s1e", t: "Winchester countdown", hook: "“You know Winchester is coming. Here is where we are up to.” Progress, not a first reveal.", len: "30s" },
  { id: "s1f", t: "Microneedling, what to expect", hook: "“What actually happens in a microneedling appointment.” Calm and clear.", len: "30s" },
  { id: "s1g", t: "Polynucleotides, in plain English", hook: "“The regenerative treatment everyone is asking about, explained simply.”", len: "30s" },
  { id: "s1h", t: "Facials and peels, who they suit", hook: "“Not everyone needs an injectable. Sometimes the honest answer is a facial or a peel.” Keeps the feed broad.", len: "30s" },
  { id: "s1i", t: "Founding, honest scarcity", hook: "“We are capping the Winchester opening at 40 founding clients, and a real number are already taken. Here is what founding actually gives you.” Priority, never a discount.", len: "30s" },
  { id: "s1j", t: "Book ahead (offer as words)", hook: "“Your honest first step is a free skin analysis. Book your place ahead now; I will show you the scanner itself very soon.” No machine shown.", len: "25s" },
  { id: "s1k", t: "Opening teaser and thank you", hook: "“2 November. Jewry Street. I cannot wait.” Warm sign-off to the founding community.", len: "20s" },
];

// Session 2: needs the analyser in the room, so film from mid-September.
const SESSION2 = [
  { id: "s2a", t: "Why I start with a skin analysis", hook: "“Before I recommend a single treatment, I do this.” Show the scan itself, and why evidence beats guesswork.", len: "30s" },
  { id: "s2b", t: "Your free analysis, what it shows", hook: "“This is what your free skin analysis reveals, and why it changes the plan.” The scanner in action.", len: "30s" },
];

const BROLL_NOW = "Hands and close-ups, product shots, the treatment room, the shopfront and signage, Abi walking in.";
const BROLL_LATER = "The analyser screen and the scan in progress (film these in session 2, once the machine is in the room).";

const TIPS = [
  "Film vertical (9:16), by a window for natural light, phone at eye height.",
  "One idea per clip, 20 to 45 seconds. Leave two seconds of quiet at the start and end for trimming.",
  "Batch six to eight in one sitting. Save the originals; each clip becomes one Reel and one Story.",
  "No script needed. Say the hook, then talk to one real client as if they were in the room.",
];

const MONTHS = [
  { m: "September", focus: "Reboot the feed and push the free Bedhampton analysis. Winchester is a countdown, not a reveal.",
    mon: "Rotate: the skin analysis, skin boosters, facials, what nurse-led means.", wed: "Abi's story; the Winchester journey, where we are up to.", fri: "Book your free Bedhampton analysis ahead (runs until 30 Oct). Before the scanner is in, offer as words, not analyser visuals." },
  { m: "October", focus: "Countdown to 2 November. Behind-the-scenes fit-out. Pivot from Bedhampton to Winchester founding by mid-month.",
    mon: "What to expect: microneedling, boosters, peels, facials.", wed: "Fit-out progress, the room taking shape, counting down.", fri: "Final Bedhampton slots (closes 30 Oct), then Winchester founding: a handful of the 40 places left." },
  { m: "November", focus: "OPEN on 2 Nov. Founding fills, the review engine starts. Expect few fresh results yet, so lean on words and scarcity.",
    mon: "Post-treatment care and skin-health foundations.", wed: "Opening week at 9A Jewry Street; the space; Abi in clinic.", fri: "Founding places update (honest scarcity), early client words, and a Google review ask. Once 40 are gone, the call to action becomes the spring founding waitlist (wave two)." },
  { m: "December", focus: "Christmas and the first real retail moment. Non-prescription gifts only.",
    mon: "Why medical-grade skincare, skincare as a gift.", wed: "The clinic at Christmas; curating non-prescription gift sets.", fri: "Vouchers and non-prescription skincare sets (never a prescription product as an off-the-shelf gift), with the last order dates." },
  { m: "January", focus: "New year, memberships. Protect the diary before the second clinician arrives in spring.",
    mon: "Build a plan, not a one-off.", wed: "Why clients choose a monthly membership.", fri: "Book a January analysis, or join the spring founding waitlist (wave two)." },
];

const RULES = [
  "Never name a prescription-only treatment (or any brand of one). Talk about the concern and invite a consultation instead.",
  "No percentage discounts, ever. The value is the free analysis, founding status, and honest advice.",
  "Faces and before-and-afters only with written consent on file.",
  "Any result carries the line “this is one person's result, everyone's skin is different”. Never imply a guarantee (CAP 3.11).",
  "Repurpose everything: each post also becomes a Story, and the best line becomes an email snippet or a Google post.",
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 14%, transparent)` }}>{children}</span>;
}

function ShotRow({ s, n, done, onToggle }: { s: { id: string; t: string; hook: string; len: string }; n: number; done: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${done ? "bg-muted/40" : "bg-card hover:bg-muted/25"}`}>
      {done ? <CheckCircle2 className="w-[18px] h-[18px] mt-0.5 shrink-0 text-emerald-500" /> : <Circle className="w-[18px] h-[18px] mt-0.5 shrink-0 text-muted-foreground/40" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`text-[13.5px] font-semibold ${done ? "line-through text-muted-foreground" : ""}`}>{n}. {s.t}</span>
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground ml-auto shrink-0">{s.len}</span>
        </span>
        <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{s.hook}</span>
      </span>
    </button>
  );
}

export default function SocialPlan() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setDone(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const total = SESSION1.length + SESSION2.length;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b" style={{ background: `color-mix(in srgb, ${ACCENT} 6%, transparent)` }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: ACCENT }}><Instagram className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-widest">Social, the repeatable engine</span></div>
          <h2 className="text-lg font-semibold">Back on Instagram and Facebook, three posts a week, batch filmed</h2>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-3xl">One filming session gives weeks of content. The engine below never changes, so it is never “what do we post?” again. Social is reach and reassurance, not the booking engine, so keep it lean and repurposed.</p>
        </div>
      </div>

      {/* film sessions */}
      <div className="rounded-2xl border-2 bg-card overflow-hidden" style={{ borderColor: `color-mix(in srgb, ${ACCENT} 40%, transparent)` }}>
        <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ background: `color-mix(in srgb, ${ACCENT} 8%, transparent)` }}>
          <Video className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-[15px] font-bold">The shoot, split around the analyser</h3>
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground tabular-nums">{done.size} / {total} filmed</span>
        </div>
        <div className="p-3 sm:p-4 space-y-4">
          {/* session 1 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[13px] font-bold" style={{ color: ACCENT }}>Session 1, film now</span>
              <span className="text-[11px] text-muted-foreground">nothing here needs the machine</span>
            </div>
            <div className="space-y-1.5">
              {SESSION1.map((s, i) => <ShotRow key={s.id} s={s} n={i + 1} done={done.has(s.id)} onToggle={() => toggle(s.id)} />)}
            </div>
          </div>
          {/* session 2 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[13px] font-bold" style={{ color: ACCENT }}>Session 2, once the analyser is in (about mid September)</span>
            </div>
            <p className="text-[12px] text-muted-foreground mb-2">Until the scanner is in the room, the free-analysis Fridays promote booking ahead as words (session 1, clip 10); they just cannot show the scan yet.</p>
            <div className="space-y-1.5">
              {SESSION2.map((s, i) => <ShotRow key={s.id} s={s} n={SESSION1.length + i + 1} done={done.has(s.id)} onToggle={() => toggle(s.id)} />)}
            </div>
          </div>
          {/* b-roll + tips */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-1"><Camera className="w-3.5 h-3.5" style={{ color: ACCENT }} /><span className="text-[10.5px] font-bold uppercase tracking-wide">B-roll to grab</span></div>
              <p className="text-[12px] text-muted-foreground leading-snug"><span className="font-semibold text-foreground/80">Now:</span> {BROLL_NOW}</p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-1"><span className="font-semibold text-foreground/80">Session 2:</span> {BROLL_LATER}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide mb-1">Filming, kept simple</div>
              <ul className="text-[12px] text-muted-foreground leading-snug space-y-1 list-disc pl-4">
                {TIPS.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* the weekly engine */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15] flex items-center gap-2">
          <Repeat className="w-4 h-4" style={{ color: ACCENT }} /><h3 className="text-[15px] font-bold">The weekly engine</h3>
          <span className="text-[11px] text-muted-foreground ml-2">same three slots, every week</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-px bg-border">
          {ENGINE.map(e => (
            <div key={e.day} className="bg-card p-4">
              <div className="flex items-center gap-2 mb-1.5"><span className="text-[13px] font-bold">{e.day}</span><Pill>{e.tag}</Pill></div>
              <p className="text-[12.5px] text-foreground/90 leading-snug">{e.what}</p>
              <p className="text-[12px] italic mt-1.5" style={{ color: ACCENT }}>{e.eg}</p>
            </div>
          ))}
        </div>
      </div>

      {/* monthly review ask */}
      <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `color-mix(in srgb, ${ACCENT} 12%, transparent)` }}><Star className="w-4 h-4" style={{ color: ACCENT }} /></div>
        <div>
          <p className="text-[13px] font-bold">Once a month, on Stories (not the feed): ask for a Google review</p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">A new profile opens at zero against rivals on 130 to 150 reviews, so this matters. “If I have looked after your skin, a Google review means the world to a new clinic.” Ask everyone, never incentivised, never selective.</p>
        </div>
      </div>

      {/* month by month */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15]"><h3 className="text-[15px] font-bold">Month by month, to January</h3><p className="text-[11.5px] text-muted-foreground mt-0.5">Same three slots each week, themed to what the clinic is doing that month.</p></div>
        <div className="divide-y">
          {MONTHS.map(mo => (
            <div key={mo.m} className="px-5 py-4">
              <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
                <span className="text-[14px] font-bold" style={{ color: ACCENT }}>{mo.m}</span>
                <span className="text-[12px] text-muted-foreground">{mo.focus}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {[["Mon", mo.mon], ["Wed", mo.wed], ["Fri", mo.fri]].map(([d, txt]) => (
                  <div key={d} className="rounded-lg border bg-muted/20 px-3 py-2">
                    <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{d}</span>
                    <p className="text-[12px] leading-snug mt-0.5">{txt}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* the rules */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15] flex items-center gap-2"><ShieldCheck className="w-4 h-4" style={{ color: ACCENT }} /><h3 className="text-[15px] font-bold">The five rules</h3></div>
        <ul className="p-4 space-y-2">
          {RULES.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
