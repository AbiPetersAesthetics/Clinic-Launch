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

// Ready-to-post calendar. Each week has three posts (Mon/Wed/Fri) with a creative
// idea and a finished caption. Compliant: no POM named, no discounts, results carry
// consent and the "one person's result" caveat. [Date] and [Client words] are the
// only things to fill in before posting.
const CALENDAR = [
  { wc: "w/c 14 September", phase: "Reboot and Bedhampton harvest", posts: [
    { d: "Mon", slot: "Educate", idea: "Abi to camera: the one thing before any treatment.", cap: "Before I recommend a single treatment, I do one thing: a proper skin analysis. Clinical imaging that shows what is happening beneath the surface, so your plan rests on evidence, not guesswork. Free at my Bedhampton clinic right now. Comment ANALYSIS or tap the link. #NurseLedAesthetics #HampshireSkin #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "Meet Abi, fresh angle: 16 years, prescriber, Winchester coming.", cap: "Hi, I am Abi. I trained as a nurse before I ever touched skin, and 16 years on it still shapes everything: safety first, honesty always, natural over overdone. This autumn I am opening my own clinic in Winchester, and I would love you to follow along. #NurseLed #WinchesterAesthetics #AbiPetersSkinClinic" },
    { d: "Fri", slot: "Offer", idea: "Free analysis, offer as words (scanner not shown yet).", cap: "Your skin, properly looked at, on me. A free skin analysis is the honest first step: no pressure, and nothing sold on the day. At my Bedhampton clinic until the end of October. Book ahead, link in bio. #FreeSkinAnalysis #Bedhampton #HonestAdvice" },
  ]},
  { wc: "w/c 21 September", phase: "Reboot and Bedhampton harvest", posts: [
    { d: "Mon", slot: "Educate", idea: "What a skin booster actually is.", cap: "Skin boosters, what actually are they? Not filler, they do not change your shape. Think a deep drink of water for your skin, hydration that helps it look fresher from within. Not right for everyone, which is why I start with an analysis. Curious? Link in bio. #SkinBoosters #HampshireSkin #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "Winchester journey, where we are up to (countdown, not reveal).", cap: "You know Winchester is coming, so here is where we are up to. The unit on Jewry Street is becoming somewhere calm and considered, every detail chosen so you feel at ease the second you walk in. Opening 2 November. #WinchesterAesthetics #ComingSoon #Winchester" },
    { d: "Fri", slot: "Offer", idea: "The honest first step.", cap: "No hard sell, ever. Just an honest look at your skin and a plan that fits you. The free skin analysis is booking now at Bedhampton until the end of October. Tap the link or DM me SKIN. #FreeSkinAnalysis #HonestAdvice #Bedhampton" },
  ]},
  { wc: "w/c 28 September", phase: "Reboot, scanner now in", posts: [
    { d: "Mon", slot: "Educate", idea: "Nurse-led vs high street (your strongest angle).", cap: "The real difference in medical aesthetics is the part you cannot see on Instagram. As a nurse and prescriber, the assessment and the honest no when a treatment is not right for you are where the safety lives. That is what nurse-led actually means. #NurseLedAesthetics #MedicalAesthetics #HampshireSkin" },
    { d: "Wed", slot: "Human", idea: "Behind the scenes fit-out.", cap: "A little behind the scenes. The Winchester clinic is coming together and I cannot quite believe it. Save this and follow along, the countdown is on. #WinchesterAesthetics #BehindTheScenes #ComingSoon" },
    { d: "Fri", slot: "Proof", idea: "The scan, what it shows (analyser now in).", cap: "This is what your free skin analysis actually shows: what is happening beneath the surface, not just what the eye sees. It is why your plan is built on evidence. Free at Bedhampton until the end of October, book ahead. #SkinAnalysis #FreeSkinAnalysis #SkinHealth" },
  ]},
  { wc: "w/c 5 October", phase: "Countdown", posts: [
    { d: "Mon", slot: "Educate", idea: "Facials and peels, who they suit (broaden beyond lips).", cap: "Not everyone needs an injectable. Sometimes the honest answer is a medical-grade facial or a peel to get your skin healthy first. Skin health before anything else, always. Book an analysis and let us find out what yours needs. #MedicalFacial #ChemicalPeel #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "Room taking shape, four weeks to go.", cap: "Four weeks to go. The Winchester room is nearly there. Opening Monday 2 November on Jewry Street. #Winchester #ComingSoon #WinchesterAesthetics" },
    { d: "Fri", slot: "Offer", idea: "Last weeks of the free Bedhampton analysis.", cap: "The free skin analysis at Bedhampton closes at the end of October, then the scanner moves to Winchester. If you have been meaning to book your honest first step, now is the time. Link in bio. #FreeSkinAnalysis #Bedhampton #LastChance" },
  ]},
  { wc: "w/c 12 October", phase: "Countdown and founding teaser", posts: [
    { d: "Mon", slot: "Educate", idea: "Microneedling, what to expect (fresh angle).", cap: "What actually happens in a microneedling appointment, and why it works with your skin rather than against it. Calm, clinical, and always after a proper consultation. Questions? Drop them below. #Microneedling #SkinHealth #NurseLedAesthetics" },
    { d: "Wed", slot: "Human", idea: "The honest no.", cap: "I will happily tell you when you do not need a treatment. That honesty is the whole reason people trust a nurse-led clinic, your skin first, never the biggest sale. #HonestAdvice #NurseLed #MedicalAesthetics" },
    { d: "Fri", slot: "Offer", idea: "Founding teaser, scarcity begins.", cap: "Something for the first people through the Winchester door. We are capping our opening at 40 founding clients: priority booking, and founding pricing held for good. A real number are already taken. DM me FOUNDING. #Winchester #FoundingClient" },
  ]},
  { wc: "w/c 19 October", phase: "Countdown, final Bedhampton", posts: [
    { d: "Mon", slot: "Educate", idea: "Polynucleotides in plain English.", cap: "The regenerative treatment everyone is asking about, explained simply: polynucleotides help your skin repair and strengthen from within. Not for everyone, and that is the point. An analysis tells us if it is right for you. #Polynucleotides #SkinHealth #HampshireSkin" },
    { d: "Wed", slot: "Human", idea: "Shopfront and signage, nearly there.", cap: "Nearly there. Jewry Street, Winchester, opening 2 November. This still does not feel real. #Winchester #ComingSoon" },
    { d: "Fri", slot: "Offer", idea: "Final Bedhampton and founding.", cap: "Two things this week: the free Bedhampton analysis closes 30 October, and Winchester founding places, the first 40, are filling. For your honest first step or a founding place, tap the link. #FreeSkinAnalysis #FoundingClient #Winchester" },
  ]},
  { wc: "w/c 26 October", phase: "Launch run-in", posts: [
    { d: "Mon", slot: "Educate", idea: "Your skin plan, not a one-off.", cap: "The best results do not come from one appointment, they come from a plan. That is what the analysis builds: a step by step that fits your skin and your life. Start with the free scan. #SkinPlan #SkinHealth #NurseLed" },
    { d: "Wed", slot: "Human", idea: "Opening week is here (2 Nov).", cap: "This time next week, the doors open. Monday 2 November, 9A Jewry Street, Winchester. I cannot wait to welcome you. #Winchester #OpeningSoon #AbiPetersSkinClinic" },
    { d: "Fri", slot: "Offer", idea: "Founding, a handful left.", cap: "A handful of the 40 founding places are left before we open on Monday. Priority booking and founding pricing held for good, never a discount, just first through the door. DM FOUNDING. #FoundingClient #Winchester" },
  ]},
  { wc: "w/c 2 November", phase: "LAUNCH WEEK", posts: [
    { d: "Mon", slot: "Open", idea: "Doors-open reel: the room, Abi, Jewry Street.", cap: "We are open. Abi Peters Skin Clinic is now on Jewry Street, Winchester. If you have been waiting, this is your moment. Book your place, link in bio. #Winchester #NowOpen #AbiPetersSkinClinic" },
    { d: "Wed", slot: "Human", idea: "A walk through the clinic.", cap: "Come inside. Every corner of the Winchester clinic was chosen to make you feel calm the moment you arrive. This is where your skin journey starts. #Winchester #NurseLed #SkinClinic" },
    { d: "Fri", slot: "Proof", idea: "First clients (with consent) and a review ask.", cap: "Our first Winchester clients, thank you. If I have looked after your skin, an honest Google review means the world to a brand-new clinic. Founding places are nearly gone. #Winchester #FoundingClient" },
  ]},
  { wc: "w/c 9 November", phase: "Founding fills, reviews", posts: [
    { d: "Mon", slot: "Educate", idea: "Aftercare, get the best from your treatment.", cap: "Looked after your skin with us? Here is how to get the very best from it in the days after. Simple, honest aftercare, no fuss. #Aftercare #SkinHealth #NurseLed" },
    { d: "Wed", slot: "Human", idea: "A client experience (with consent).", cap: "One week in, and I am so grateful. [Client's own words, shared with permission.] This is one person's experience, and everyone's skin is different. #Winchester #ClientLove" },
    { d: "Fri", slot: "Offer", idea: "Founding full, waitlist opens.", cap: "The 40 founding places have gone, thank you. You can now join the spring founding waitlist to be first when we open more places next year. Link in bio. #Winchester #Waitlist" },
  ]},
  { wc: "w/c 16 November", phase: "Winchester-led", posts: [
    { d: "Mon", slot: "Educate", idea: "Why medical-grade skincare works.", cap: "Why medical-grade skincare actually works: higher active levels, matched to your skin, not picked off a shelf. It is the foundation of every plan. #Skincare #Obagi #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "Two weeks in, thank you, review ask on Stories.", cap: "Two weeks of Winchester. Thank you for such a warm welcome. If we have looked after you, a Google review helps a new clinic more than you know. #Winchester #ThankYou" },
    { d: "Fri", slot: "Offer", idea: "Free analysis now at Winchester too.", cap: "The free skin analysis is now at Winchester as well, through November. Your honest first step, nothing sold on the day. Book ahead. #FreeSkinAnalysis #Winchester" },
  ]},
  { wc: "w/c 23 November", phase: "Winchester-led, Christmas teaser", posts: [
    { d: "Mon", slot: "Educate", idea: "Which treatment do I need? You do not have to know.", cap: "Skin boosters, a facial, microneedling, how do you know which you need? You do not have to. That is exactly what the analysis is for. Start there. #SkinHealth #NurseLed #SkinAnalysis" },
    { d: "Wed", slot: "Human", idea: "A day in the clinic.", cap: "A day in the Winchester clinic: calm, considered, honest. Exactly what I always wanted to build. #Winchester #NurseLed" },
    { d: "Fri", slot: "Offer", idea: "Christmas teaser.", cap: "Christmas is coming, and the nicest gift is healthy skin. Vouchers and curated skincare sets land next week. #Christmas #SkincareGift" },
  ]},
  { wc: "w/c 30 November", phase: "Christmas retail", posts: [
    { d: "Mon", slot: "Educate", idea: "Skincare as a gift that does something.", cap: "The gift that actually does something: medical-grade skincare, chosen properly. Our Christmas sets are non-prescription and ready to give. #ChristmasGift #Skincare" },
    { d: "Wed", slot: "Human", idea: "Behind the scenes, wrapping gift sets.", cap: "Wrapping up something lovely. A peek at this year's Christmas skincare sets and vouchers. #Christmas #Winchester" },
    { d: "Fri", slot: "Offer", idea: "Vouchers and sets live.", cap: "Gift vouchers and skincare sets are here. Give healthy skin this Christmas, book or buy in the link. #ChristmasGift #SkincareSet" },
  ]},
  { wc: "w/c 7 December", phase: "Christmas retail", posts: [
    { d: "Mon", slot: "Educate", idea: "How to actually use your skincare.", cap: "Got skincare for Christmas, or treating yourself? Here is the order to use it in so it actually works. Little things, big difference. #Skincare #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "The clinic at Christmas.", cap: "The Winchester clinic at Christmas. Thank you for a first month I will never forget. #Winchester #Christmas" },
    { d: "Fri", slot: "Offer", idea: "Last order dates for gifts.", cap: "Last chance for Christmas: order gift vouchers and skincare sets by [date] to arrive in time. Link in bio. #ChristmasGift #LastOrders" },
  ]},
  { wc: "w/c 14 December", phase: "Christmas, winding down", posts: [
    { d: "Mon", slot: "Educate", idea: "New-year skin starts with a plan.", cap: "Thinking about your skin for the new year? The best results start with a plan, not a one-off. Book a January analysis and begin properly. #SkinPlan #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "A thank you, and what is coming in January.", cap: "As the year closes, thank you. In January we open memberships, a simple way to look after your skin all year. More soon. #Winchester #ThankYou" },
    { d: "Fri", slot: "Offer", idea: "Vouchers for a January treat.", cap: "Give yourself January to look forward to. Gift vouchers work on treatments and skincare. Link in bio. #Voucher #Winchester" },
  ]},
  { wc: "w/c 5 January", phase: "New year and memberships", posts: [
    { d: "Mon", slot: "Educate", idea: "A plan, not a one-off.", cap: "New year, real skin goals. The results people love come from a plan over time, not a single appointment. Start with a skin analysis and we will build yours. #SkinPlan #SkinHealth #NurseLed" },
    { d: "Wed", slot: "Human", idea: "Why clients choose a membership.", cap: "Why so many clients choose a monthly membership: their skin gets looked after all year, a pre-booked slot that is always theirs. Ask me how it works. #Membership #SkinHealth" },
    { d: "Fri", slot: "Offer", idea: "Book a January analysis or join the waitlist.", cap: "Book your January skin analysis, your honest first step. Or, if you missed founding, join the spring waitlist for wave two. Link in bio. #FreeSkinAnalysis #Waitlist #Winchester" },
  ]},
  { wc: "w/c 12 January", phase: "New year and memberships", posts: [
    { d: "Mon", slot: "Educate", idea: "Consistency beats intensity.", cap: "The secret to good skin is not one big treatment, it is consistency. That is the whole idea behind a plan and a membership. Small steps, looked after. #SkinHealth #NurseLed" },
    { d: "Wed", slot: "Human", idea: "A member's why (with consent).", cap: "Why one of our members joined, in her words, shared with permission. This is one person's experience, everyone's skin is different. #Membership #ClientLove" },
    { d: "Fri", slot: "Offer", idea: "Analysis and membership.", cap: "Start the year with an honest look at your skin and a plan you can actually keep up. Book your analysis, link in bio. #FreeSkinAnalysis #SkinPlan #Winchester" },
  ]},
  { wc: "w/c 19 January", phase: "New year and memberships", posts: [
    { d: "Mon", slot: "Educate", idea: "What medical-grade actually means.", cap: "Medical-grade is not a marketing word. It means higher actives, prescribed to your skin by a nurse and prescriber, not guessed from a shelf. That is the difference. #Skincare #NurseLed #SkinHealth" },
    { d: "Wed", slot: "Human", idea: "Behind the scenes, the year ahead.", cap: "A peek at what is coming this year at Winchester. Bigger plans, same honesty. Follow along. #Winchester #NurseLed" },
    { d: "Fri", slot: "Offer", idea: "Membership close, book the analysis.", cap: "If you want your skin looked after all year, a membership is the simplest way. It starts with an analysis, so book yours. Link in bio. #Membership #FreeSkinAnalysis" },
  ]},
  { wc: "w/c 26 January", phase: "New year and memberships", posts: [
    { d: "Mon", slot: "Educate", idea: "One honest question to ask any clinic.", cap: "One honest question worth asking any clinic: will you tell me when I do not need a treatment? We always will. That is nurse-led. #HonestAdvice #NurseLedAesthetics" },
    { d: "Wed", slot: "Human", idea: "Thank you, and the waitlist.", cap: "Thank you for a brilliant few months. If you are waiting on a founding place, the spring waitlist is open, you will be first when we grow. #Winchester #Waitlist" },
    { d: "Fri", slot: "Offer", idea: "Book your first step.", cap: "Whatever your skin needs this year, it starts the same honest way: a skin analysis. Book yours, link in bio. #FreeSkinAnalysis #SkinHealth #Winchester" },
  ]},
];

// From a review of the live @abipetersskinclinic feed (136 posts): what is
// already covered, so social freshens rather than repeats, and where the gaps are.
const COVERED = [
  "Lips and dermal-filler before-and-afters, by far the heaviest theme.",
  "The honesty and nurse-led voice: honest guide to treatment, a longer consultation, what happens when it goes wrong.",
  "Get to know Abi and welcome posts, personal content, the Fresha award.",
  "Microneedling and SkinVive skin boosters.",
];
const WHITESPACE = [
  "The AI Skin Analysis, your whole way in, and absent from 136 posts.",
  "Winchester: the countdown and the opening (only in the bio today).",
  "Founding places and honest scarcity.",
  "Facials, chemical peels, polynucleotides, and medical-grade skincare as a system.",
];

const RULES = [
  "Never name a prescription-only treatment (or any brand of one). Talk about the concern and invite a consultation instead.",
  "No discount posts, ever (no 15% off, no new-client offer). The value is the free analysis, founding status, and honest advice.",
  "Faces and before-and-afters only with written consent on file.",
  "Any result carries the line “this is one person's result, everyone's skin is different”. Never imply a guarantee (CAP 3.11).",
  "Repurpose everything: each post also becomes a Story, and the best line becomes an email snippet or a Google post.",
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 14%, transparent)` }}>{children}</span>;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const copy = () => { try { navigator.clipboard?.writeText(text); } catch { /* ignore */ } setOk(true); setTimeout(() => setOk(false), 1400); };
  return <button onClick={copy} className={`shrink-0 text-[10px] font-semibold border rounded px-1.5 py-0.5 transition-colors ${ok ? "text-emerald-600 border-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>{ok ? "Copied" : "Copy caption"}</button>;
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

      {/* already on the feed, so freshen not repeat */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15]">
          <h3 className="text-[15px] font-bold">Already on your feed, so freshen not repeat</h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">@abipetersskinclinic is 136 posts in and reads as a lips-and-filler account. This plan repositions it to nurse-led skin. Settle the brand name on “Skin Clinic” and keep it consistent.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-px bg-border">
          <div className="bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Already covered, do a new angle</div>
            <ul className="space-y-1.5">
              {COVERED.map((c, i) => <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-muted-foreground"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/40" />{c}</li>)}
            </ul>
          </div>
          <div className="bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: ACCENT }}>White space, the plan owns this</div>
            <ul className="space-y-1.5">
              {WHITESPACE.map((c, i) => <li key={i} className="flex items-start gap-2 text-[12px] leading-snug"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />{c}</li>)}
            </ul>
          </div>
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

      {/* content calendar, ready to post */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/[0.15]"><h3 className="text-[15px] font-bold">Content calendar, ready to post</h3><p className="text-[11.5px] text-muted-foreground mt-0.5">Every Monday, Wednesday and Friday from mid September to end January, each with a creative idea and a finished caption. Fill in [date] and [client words], add before-and-afters only with written consent, and check any offer date before it goes out.</p></div>
        <div className="divide-y">
          {CALENDAR.map(wk => (
            <div key={wk.wc} className="px-4 sm:px-5 py-4">
              <div className="flex items-baseline gap-2.5 mb-2.5 flex-wrap">
                <span className="text-[13px] font-bold" style={{ color: ACCENT }}>{wk.wc}</span>
                <span className="text-[11px] text-muted-foreground">{wk.phase}</span>
              </div>
              <div className="space-y-2">
                {wk.posts.map((p, i) => (
                  <div key={i} className="rounded-xl border bg-muted/15 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-card border">{p.d}</span>
                      <Pill>{p.slot}</Pill>
                      <span className="ml-auto"><CopyBtn text={p.cap} /></span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground mb-1 italic">{p.idea}</p>
                    <p className="text-[12.5px] leading-snug text-foreground/90 whitespace-pre-wrap">{p.cap}</p>
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
