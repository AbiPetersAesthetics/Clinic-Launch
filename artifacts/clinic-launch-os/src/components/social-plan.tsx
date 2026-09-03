import React, { useState } from "react";
import { Instagram, Video, Camera, CheckCircle2, Circle, Repeat, ShieldCheck } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Social plan: a repeatable engine, a batch-film shot list for a single morning,
// and a month-by-month calendar to January. Compliant by design: no prescription
// treatment is ever named, no percentage discounts, faces and before-and-afters
// only with written consent.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#b07aa1"; // matches the Social lane on the Level 0 timeline

const ENGINE = [
  { day: "Monday", tag: "Educate", what: "Answer one real question people actually ask. Abi to camera, or a simple carousel.", eg: "“Before I recommend a single treatment, I do this.”" },
  { day: "Wednesday", tag: "Human", what: "The person and the place. Abi's story, the room, the journey to Winchester.", eg: "“A little behind the scenes: the clinic is coming together.”" },
  { day: "Friday", tag: "Proof or offer", what: "A result (with written consent) or the current call to action. Always end with what to do next.", eg: "“Your skin, properly looked at, on me, until the end of October.”" },
];

const SHOTLIST = [
  { t: "Meet Abi", hook: "“I trained as a nurse before I ever touched skin, and it changes everything.” Who you are, ANP and Independent Prescriber, why you opened.", len: "45s" },
  { t: "Why I start with a skin analysis", hook: "“Before I recommend a single treatment, I do this.” The scan, and why evidence beats guesswork.", len: "30s" },
  { t: "What a skin booster actually is", hook: "“Skin boosters, what actually are they?” Not filler, think a deep drink of water for the skin.", len: "30s" },
  { t: "Nurse-led vs the high street", hook: "“The difference is the bit you cannot see.” Safety, honesty, prescribing.", len: "30s" },
  { t: "When I will talk you out of a treatment", hook: "“I will happily tell you when you do not need one.” The honesty angle.", len: "30s" },
  { t: "The Winchester story", hook: "“Some big news: I am opening my own clinic in Winchester.” The move from Bedhampton.", len: "30s" },
  { t: "Microneedling, what to expect", hook: "“What actually happens in a microneedling appointment.” Calm and clear.", len: "30s" },
  { t: "Polynucleotides, in plain English", hook: "“The regenerative treatment everyone is asking about, explained simply.”", len: "30s" },
  { t: "Free analysis at Bedhampton", hook: "“Your skin, properly looked at, on me, until the end of October.” Local only, book link.", len: "25s" },
  { t: "Founding clients teaser", hook: "“The first 40 through the Winchester door get something no one else will.” Priority, not a discount.", len: "25s" },
  { t: "Opening teaser and thank you", hook: "“2 November. Jewry Street. I cannot wait.” Warm sign-off to the founding community.", len: "20s" },
];

const BROLL = "Hands and close-ups, product shots, the treatment room, the shopfront and signage, Abi walking in, the analyser screen. These overlay the talking clips and turn them into Reels.";

const TIPS = [
  "Film vertical (9:16), by a window for natural light, phone at eye height.",
  "One idea per clip, 20 to 45 seconds. Leave two seconds of quiet at the start and end for trimming.",
  "Batch six to eight in one sitting. Save the originals; each clip becomes one Reel and one Story.",
  "You do not need a script. Say the hook, then talk to one real client as if they were in the room.",
];

const MONTHS = [
  { m: "September", focus: "Reboot the feed and push the Bedhampton free analysis. Introduce Abi and the Winchester journey.",
    mon: "Education: the skin analysis, skin boosters, what nurse-led means.", wed: "Abi's story; the journey to Winchester begins.", fri: "Free analysis at Bedhampton (until 30 Oct), with the book link." },
  { m: "October", focus: "Build anticipation for 2 November. Behind-the-scenes fit-out, founding teaser, last-chance Bedhampton.",
    mon: "Education: what to expect at each treatment.", wed: "Fit-out progress, the room taking shape.", fri: "Last chance free analysis at Bedhampton (closes 30 Oct), then the founding teaser." },
  { m: "November", focus: "OPEN. Doors on 2 Nov, the room, first clients (with consent), founding places filling, first reviews.",
    mon: "Education tied to what people are booking.", wed: "Opening week, the space, Abi in clinic.", fri: "Founding places (first 40), then a result or a client's words." },
  { m: "December", focus: "Christmas and the first real retail moment. Gift vouchers and curated skincare sets, kept POM-safe.",
    mon: "Education: why medical-grade skincare, skincare as a gift.", wed: "The clinic at Christmas; the gift sets behind the scenes.", fri: "Vouchers and sets, with the last posting and order dates." },
  { m: "January", focus: "New year, new plans. Memberships turn one-off clients into pre-booked monthly slots.",
    mon: "Education: build a plan, not a one-off.", wed: "A member's why, or a client's journey.", fri: "Memberships and new-year skin plans; book a January analysis." },
];

const RULES = [
  "Never name a prescription-only treatment (or any brand of one). Talk about the concern and invite a consultation instead.",
  "No percentage discounts, ever. The value is the free analysis, founding status, and honest advice.",
  "Faces and before-and-afters only with written consent on file.",
  "Repurpose everything: each post also becomes a Story, and the best line becomes an email snippet or a Google post.",
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 14%, transparent)` }}>{children}</span>;
}

export default function SocialPlan() {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setDone(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b" style={{ background: `color-mix(in srgb, ${ACCENT} 6%, transparent)` }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: ACCENT }}><Instagram className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-widest">Social, the repeatable engine</span></div>
          <h2 className="text-lg font-semibold">Back on Instagram and Facebook, three posts a week, batch filmed</h2>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-3xl">One filming morning gives weeks of content. The engine below never changes, so it is never “what do we post?” again. Social is reach and reassurance, not the booking engine, so keep it lean and repurposed.</p>
        </div>
      </div>

      {/* film this today */}
      <div className="rounded-2xl border-2 bg-card overflow-hidden" style={{ borderColor: `color-mix(in srgb, ${ACCENT} 40%, transparent)` }}>
        <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ background: `color-mix(in srgb, ${ACCENT} 8%, transparent)` }}>
          <Video className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-[15px] font-bold">Film this today</h3>
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground tabular-nums">{done.size} / {SHOTLIST.length} filmed</span>
        </div>
        <div className="p-3 sm:p-4">
          <p className="text-[12px] text-muted-foreground mb-3">Eleven clips, one sitting. Tick each as you go. Top to bottom is fine.</p>
          <div className="space-y-1.5">
            {SHOTLIST.map((s, i) => {
              const ticked = done.has(i);
              return (
                <button key={i} onClick={() => toggle(i)} className={`w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${ticked ? "bg-muted/40" : "bg-card hover:bg-muted/25"}`}>
                  {ticked ? <CheckCircle2 className="w-[18px] h-[18px] mt-0.5 shrink-0 text-emerald-500" /> : <Circle className="w-[18px] h-[18px] mt-0.5 shrink-0 text-muted-foreground/40" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`text-[13.5px] font-semibold ${ticked ? "line-through text-muted-foreground" : ""}`}>{i + 1}. {s.t}</span>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground ml-auto shrink-0">{s.len}</span>
                    </span>
                    <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{s.hook}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-1"><Camera className="w-3.5 h-3.5" style={{ color: ACCENT }} /><span className="text-[10.5px] font-bold uppercase tracking-wide">Also grab this B-roll</span></div>
              <p className="text-[12px] text-muted-foreground leading-snug">{BROLL}</p>
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

      {/* month by month */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15]"><h3 className="text-[15px] font-bold">Month by month, to January</h3><p className="text-[11.5px] text-muted-foreground mt-0.5">Same three slots each week, themed to what the clinic is doing that month.</p></div>
        <div className="divide-y">
          {MONTHS.map(mo => (
            <div key={mo.m} className="px-5 py-4">
              <div className="flex items-baseline gap-2.5 mb-2">
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
        <div className="px-5 py-3.5 border-b bg-muted/[0.15] flex items-center gap-2"><ShieldCheck className="w-4 h-4" style={{ color: ACCENT }} /><h3 className="text-[15px] font-bold">The four rules</h3></div>
        <ul className="p-4 space-y-2">
          {RULES.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
