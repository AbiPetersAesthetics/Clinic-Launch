import React, { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Level 0 marketing overview: every channel, both clinics, converging on 2 Nov.
// The front page of the marketing area. Hover any bar or beat for the full
// theme, hook, date and which clinic it belongs to.
// ─────────────────────────────────────────────────────────────────────────────

type Loc = "bed" | "winch" | "both";
type Item = {
  kind: "bar" | "beat";
  from: string; to?: string;
  label: string;
  loc: Loc;
  theme?: string;
  detail: string;
  up?: boolean; end?: boolean; faint?: boolean;
};
type Lane = { name: string; note: string; c: string; items: Item[] };

const START = Date.UTC(2026, 8, 1), END = Date.UTC(2027, 0, 31);
const pct = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ((Date.UTC(y, m - 1, d) - START) / (END - START)) * 100;
};
const LAUNCH = pct("2026-11-02");

const LOC: Record<Loc, { label: string; cls: string }> = {
  bed:   { label: "Bedhampton", cls: "bg-[#a9805e]/15 text-[#8a6547] dark:text-[#d1a482] border-[#a9805e]/30" },
  winch: { label: "Winchester", cls: "bg-[#3a4a63]/12 text-[#3a4a63] dark:text-[#93a6c8] border-[#3a4a63]/25" },
  both:  { label: "Both clinics", cls: "bg-[#7FA49A]/15 text-[#587F72] dark:text-[#9ec3b8] border-[#7FA49A]/30" },
};

const LANES: Lane[] = [
  { name: "SEO & Google profile", note: "the map pack and reviews", c: "#3a4a63", items: [
    { kind: "bar", from: "2026-09-03", to: "2027-01-31", label: "Winchester profile, then reviews", loc: "winch", theme: "Own the Winchester map pack",
      detail: "Create and verify the Google Business Profile with a 2 November open date. Rivals hold 130 to 150 reviews and you would open with none, so this is the longest lead time job. Then a steady reviews drive, 8 to 10 a month, asked in person and never incentivised." },
    { kind: "beat", from: "2026-09-01", label: "Bedhampton profile live", loc: "bed", theme: "Already verified, 5.0 from 84 reviews", up: true,
      detail: "Bedhampton is verified and managed, 5.0 from 84 reviews. Only Winchester is missing." },
    { kind: "beat", from: "2026-09-03", label: "Create Winchester profile", loc: "winch", up: false,
      detail: "Longest lead time of anything. Address, 2 November open date, categories, photos, then start verification." },
    { kind: "beat", from: "2026-11-02", label: "Reviews drive begins", loc: "winch", up: true, theme: "8 to 10 a month",
      detail: "Every attended client asked in person, plus a desk QR code. Unfiltered and unincentivised." },
  ] },
  { name: "Google Ads", note: "Search, then retail", c: "#7FA49A", items: [
    { kind: "beat", from: "2026-09-10", label: "Advertiser verification", loc: "both", up: true,
      detail: "Gates any spend. Also repair the two Business Profile conversion actions currently showing Needs attention." },
    { kind: "bar", from: "2026-10-15", to: "2027-01-31", label: "Brand + local Search", loc: "both", theme: "Protect the name, then local intent",
      detail: "Brand Search protects the words Abi Peters Skin Clinic. Non brand is area specific: Winchester keywords (skin clinic winchester, skin analysis hampshire, aesthetics winchester) and Havant keywords (skin clinic havant). Presence only targeting. Never bid on or name a prescription treatment." },
    { kind: "bar", from: "2026-12-01", to: "2026-12-24", label: "PMax: retail", loc: "winch", theme: "Christmas skincare and vouchers",
      detail: "Performance Max for the gift vouchers and skincare feed, this month only, small budget." },
  ] },
  { name: "Meta prospecting", note: "dialled down, launch creative", c: "#5b7590", items: [
    { kind: "beat", from: "2026-09-02", label: "Cut cold spend to £8", loc: "winch", up: true, theme: "Stop buying leads you cannot serve",
      detail: "The 12 mile pool is saturating (cost per lead £3.16 to £5.64). Cut prospecting to about £8 a day; the launch turns on the 448 already in hand, not new leads." },
    { kind: "beat", from: "2026-09-08", label: "Shoot the 3 concepts", loc: "winch", up: false, theme: "Ten minute answer / The shelf / Nothing is sold",
      detail: "One filming day for the three ad concepts. Concept 3, Abi to camera, becomes the live launch creative." },
    { kind: "bar", from: "2026-09-15", to: "2026-11-02", label: "Concept 3 live", loc: "winch", theme: "Nothing is sold on the day",
      detail: "Hook: Abi, first person, a ten minute scan and honest advice with no sales pitch, in a town where the clinic does not yet exist. About £8 a day cold plus £3 a day to warm engagers, so the November follow up call is warm." },
    { kind: "bar", from: "2026-11-03", to: "2027-01-31", label: "Evergreen diary fill", loc: "winch", faint: true, theme: "Low, steady, after launch",
      detail: "About £8 a day of evergreen prospecting once open, feeding the diary rather than the founding 40." },
  ] },
  { name: "Meta retargeting", note: "the form-submitters, not new leads", c: "#7b98b5", items: [
    { kind: "beat", from: "2026-09-25", label: "Build the audience", loc: "winch", up: true, theme: "Form submits, website, engagers",
      detail: "A customer list uploaded from GHL (the durable copy of the 448), plus the website 180 day and engagement audiences, excluding anyone booked." },
    { kind: "bar", from: "2026-10-12", to: "2026-11-01", label: "Retarget the 448", loc: "winch", theme: "Founding, first 40, priority window",
      detail: "Hook: the founding list chooses appointments from 26 October, a week before everyone else. Not new leads, they already raised a hand, so it optimises to landing page views, ends the day before opening, and closes the moment the 40th books." },
    { kind: "bar", from: "2026-11-03", to: "2026-11-30", label: "Phase 2 diary fill", loc: "winch", theme: "Engagers, after launch",
      detail: "A small presence to the engager audiences once open, keeping the November diary filling." },
  ] },
  { name: "Newsletter & nurture", note: "email, SMS, WhatsApp: where the 40 are won", c: "#907a86", items: [
    { kind: "bar", from: "2026-09-03", to: "2026-09-30", label: "Sort the 448", loc: "winch", theme: "Autumn, or next year?",
      detail: "One gentle question by SMS to the whole warm list, so people sort themselves without any sense of a race. 40 a day, batched." },
    { kind: "bar", from: "2026-10-05", to: "2026-10-16", label: "Earn it", loc: "winch", theme: "What the clinic is, the honest diary",
      detail: "Two emails to the engaged: what the clinic actually is, and the honest bit about one nurse and a small diary. This is where the founding forty is framed as a fact about capacity, not a countdown." },
    { kind: "bar", from: "2026-10-19", to: "2026-10-30", label: "Select the 40", loc: "winch", theme: "Which November week? A held slot",
      detail: "Which week suits, then a specific time held with your name on it. A named slot converts far better than a booking link, and nobody is ever rejected." },
    { kind: "bar", from: "2026-11-02", to: "2026-11-16", label: "Launch fortnight", loc: "winch", theme: "Doors, aftercare, reviews",
      detail: "Reminders, the same evening plan and aftercare, day three and day seven check ins, and the review ask." },
    { kind: "beat", from: "2026-09-22", label: "Bedhampton cold invite", loc: "bed", up: false, theme: "Bedhampton now, or Winchester in Nov",
      detail: "To Bedhampton enquirers who never booked: the free analysis is on locally until 30 October, and Winchester opens 2 November if the drive suits. Both doors, their choice." },
    { kind: "beat", from: "2026-10-01", label: "Bedhampton warm invite", loc: "bed", up: true, theme: "Follow Abi to Winchester, founding first",
      detail: "A personal note from Abi to existing Bedhampton clients, honest about the 25 minute drive, with first refusal on a founding place before the 448. The warmest people in the whole plan." },
    { kind: "beat", from: "2026-10-20", label: "Treatment-intent pre-book", loc: "winch", up: false, theme: "You mentioned lines, lips, skin",
      detail: "Leads who named a treatment are written to about that. Anti-wrinkle interest goes to a consultation (a prescription medicine cannot be advertised); everything else by name." },
    { kind: "beat", from: "2026-11-02", label: "Memberships offered", loc: "winch", up: true, theme: "Your monthly skin plan",
      detail: "From opening, membership is the next step after a first treatment: a pre-booked recurring slot that fills the diary and retains." },
    { kind: "beat", from: "2026-12-01", label: "Monthly newsletter", loc: "both", up: false, theme: "One list, both sites, 1st of the month",
      detail: "After launch the two tracks fold into one monthly newsletter to the whole opted-in list, Winchester led." },
  ] },
  { name: "Bedhampton harvest", note: "the earning clinic, local only", c: "#a9805e", items: [
    { kind: "bar", from: "2026-09-10", to: "2026-10-30", label: "Harvest ads, 10 miles of PO9", loc: "bed", theme: "Free analysis before it moves",
      detail: "Hook: a £50 AI Skin Analysis, complimentary until 30 October, because the scanner then moves to Winchester. A 14 day skincare add-on if a treatment is booked. No discount. Local only, 10 miles of PO9." },
    { kind: "beat", from: "2026-09-10", label: "Ads live", loc: "bed", up: true,
      detail: "Reactivate the paused Bedhampton campaign with the new offer, tight local targeting, and the vetted reel." },
    { kind: "beat", from: "2026-10-26", label: "Route base to Winchester", loc: "bed", up: false,
      detail: "From 26 October, new Bedhampton enquiries are answered with the Winchester November offer, not an appointment that cannot happen." },
    { kind: "beat", from: "2026-10-30", label: "Offer closes, last analysis", loc: "bed", up: true, end: true,
      detail: "The analyser leaves for Winchester. Bedhampton harvest ends." },
  ] },
  { name: "Partnerships & PR", note: "partners, gifting, the open evening", c: "#c2a672", items: [
    { kind: "bar", from: "2026-09-15", to: "2027-01-31", label: "Local partners + outreach", loc: "winch", theme: "Bridal, hair, gyms, cafes",
      detail: "A rolling programme of local partnerships and reciprocal referrals with businesses whose clients plan skin ahead: bridal boutiques, hair salons, boutique gyms, wedding venues, cafes." },
    { kind: "beat", from: "2026-09-22", label: "Shortlist + outreach", loc: "winch", up: true,
      detail: "Build the partner shortlist and send the first outreach, offering their clients a complimentary skin analysis." },
    { kind: "beat", from: "2026-10-15", label: "Micro-influencer gifting", loc: "winch", up: false, theme: "Gift the scan, no obligation",
      detail: "Gift the analysis to local Hampshire micro-influencers, capped so the diary holds." },
    { kind: "beat", from: "2026-11-05", label: "Founding open evening", loc: "winch", up: true, theme: "The launch event",
      detail: "A founding open evening in launch week: the room, the scanner, Abi, and the founding cohort." },
  ] },
  { name: "Retail & memberships", note: "the compounding margin", c: "#5a9b90", items: [
    { kind: "beat", from: "2026-11-02", label: "Memberships live", loc: "winch", up: true, theme: "Skin Circle £19, Skin Plan £115",
      detail: "The public ladder from opening: Skin Circle at 19, the Skin Plan at 115 (founder 95), Advanced at 185. A member is a pre-booked recurring slot." },
    { kind: "bar", from: "2026-12-01", to: "2026-12-24", label: "Christmas vouchers + gift sets", loc: "winch", theme: "POM-safe gifts, drive January",
      detail: "Gift vouchers and curated skincare sets, compliant, sold from the shop front to drive January bookings." },
    { kind: "beat", from: "2026-12-19", label: "Last Christmas posting", loc: "winch", up: false,
      detail: "Last order date for posted gifts before the clinic closes 24 December to 1 January." },
    { kind: "bar", from: "2027-01-02", to: "2027-01-31", label: "January skin plans + wave two", loc: "winch", theme: "New-year pre-sell",
      detail: "New-year skin plans and membership pre-sell, and founding wave two opens on the waitlist as the second, skin-focused clinician starts." },
  ] },
];

// Bands
type Seg = { from: string; to: string; label: string; c: string; loc?: Loc; solid?: boolean; faint?: boolean; theme?: string; detail: string };
const OFFER_ROWS: Seg[][] = [
  [
    { from: "2026-09-15", to: "2026-10-30", label: "Bedhampton: free analysis + 14-day add-on", c: "#a9805e", loc: "bed", theme: "No discount", detail: "A complimentary AI Skin Analysis, normally £50, plus a complimentary skincare add-on if a treatment is booked within 14 days. No percentage discount. Ends 30 October." },
    { from: "2026-11-02", to: "2026-11-30", label: "Winchester: free analysis, all month", c: "#5a9b90", loc: "winch", detail: "The complimentary AI Skin Analysis is free to everyone at Winchester through November. Returns to £50 in December." },
    { from: "2026-12-01", to: "2027-01-31", label: "Analysis returns to £50", c: "#6d7386", faint: true, loc: "winch", detail: "From 1 December the analysis is a paid £50 assessment." },
  ],
  [
    { from: "2026-10-01", to: "2026-11-30", label: "Founding wave one: first 40, priority + pricing held 12 months", c: "#907a86", loc: "winch", theme: "Status, not a discount", detail: "The first 40 clients. Priority booking window from 26 October, founding pricing held for twelve months, a complimentary add-on with the first treatment. Never a discount. 20 already booked." },
    { from: "2026-12-01", to: "2027-01-31", label: "Founding wave two (waitlist)", c: "#907a86", faint: true, loc: "winch", detail: "Overflow goes on the honest waitlist as wave two, opened when the second, skin-focused clinician starts. Warm Bedhampton clients who miss wave one get priority." },
  ],
  [
    { from: "2026-12-01", to: "2026-12-24", label: "Christmas: vouchers + gift sets", c: "#c2a672", loc: "winch", detail: "Gift vouchers and curated skincare sets, POM-safe, to drive January bookings." },
    { from: "2027-01-02", to: "2027-01-31", label: "January: new-year skin plans + pre-sell", c: "#7FA49A", loc: "winch", detail: "New-year skin plans and membership pre-sell." },
  ],
];
const LOC_ROWS: Seg[][] = [
  [{ from: "2026-09-01", to: "2026-10-30", label: "Bedhampton: trading + harvest, closes 30 Oct", c: "#a9805e", loc: "bed", detail: "The earning clinic keeps trading and harvesting local clients, then closes on 30 October as Abi moves across." }],
  [
    { from: "2026-09-01", to: "2026-11-02", label: "Winchester: fit-out and build", c: "#3a4a63", faint: true, loc: "winch", detail: "Fit-out, systems, profile and content, while nothing is yet open." },
    { from: "2026-11-02", to: "2027-01-31", label: "Winchester OPEN, the clinic", c: "#3a4a63", solid: true, loc: "winch", detail: "Open on Monday 2 November, then the primary clinic." },
  ],
];

const MONTHS = [["2026-09-01", "Sep"], ["2026-10-01", "Oct"], ["2026-11-01", "Nov"], ["2026-12-01", "Dec"], ["2027-01-01", "Jan"]];
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}`; };

type Hover = { title: string; loc: Loc; theme?: string; detail: string; range: string; x: number; y: number } | null;

export default function MarketingTimeline() {
  const [hover, setHover] = useState<Hover>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const enter = (e: React.MouseEvent, o: { label: string; loc?: Loc; theme?: string; detail: string; from: string; to?: string }) => {
    setHover({ title: o.label, loc: o.loc ?? "winch", theme: o.theme, detail: o.detail,
      range: o.to ? `${fmtDate(o.from)} to ${fmtDate(o.to)}` : fmtDate(o.from),
      x: e.clientX, y: e.clientY });
  };
  const move = (e: React.MouseEvent) => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : h);
  const leave = () => setHover(null);

  const seg = (s: Seg, i: number) => {
    const l = pct(s.from), w = pct(s.to) - l;
    return (
      <div key={i} onMouseEnter={e => enter(e, s)} onMouseMove={move} onMouseLeave={leave}
        className="absolute top-0 h-[15px] rounded-[2px] flex items-center px-2 overflow-hidden cursor-default"
        style={{ left: `${l}%`, width: `${w}%`,
          background: s.solid ? s.c : `color-mix(in srgb, ${s.c} ${s.faint ? 9 : 20}%, var(--color-card))`,
          border: `1px solid color-mix(in srgb, ${s.c} ${s.faint ? 30 : 48}%, transparent)`,
          borderStyle: s.faint ? "dashed" : "solid" }}>
        <span className="text-[8.5px] font-semibold truncate" style={{ color: s.solid ? "#fff" : `color-mix(in srgb, ${s.c} 66%, var(--color-foreground))` }}>{s.label}</span>
      </div>
    );
  };

  return (
    <div className="rounded-md border bg-card overflow-hidden" ref={wrapRef}>
      <div className="px-4 sm:px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Level 0 · the whole launch on one view</div>
          <h2 className="text-lg font-semibold mt-0.5">Every channel, both clinics, converging on 2 November</h2>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-xs">Hover any bar or dot for the theme, hook, dates and clinic. Newsletters and ads are individual to each clinic in the run-up, then Winchester-led.</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1000px] px-4 sm:px-5 py-4">
          {/* axis */}
          <div className="relative h-4 ml-[210px] border-b border-border">
            {MONTHS.map(([iso, lbl], i) => (
              <React.Fragment key={iso}>
                {i > 0 && <div className="absolute top-0 bottom-0 border-l border-border" style={{ left: `${pct(iso)}%` }} />}
                <div className="absolute top-0 text-[10px] font-semibold tracking-[0.12em] uppercase text-foreground/70 pl-1.5" style={{ left: `${pct(iso)}%` }}>{lbl}</div>
              </React.Fragment>
            ))}
          </div>

          {/* body */}
          <div className="relative">
            {/* bands */}
            {[{ k: "Locations", rows: LOC_ROWS }, { k: "Offers", rows: OFFER_ROWS }].map(b => (
              <div key={b.k} className="flex border-b border-border">
                <div className="w-[210px] shrink-0 py-1.5 pr-2 flex flex-col justify-center">
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{b.k}</div>
                </div>
                <div className="flex-1 flex flex-col gap-[3px] py-1.5">
                  {b.rows.map((row, ri) => <div key={ri} className="relative h-[15px]">{row.map(seg)}</div>)}
                </div>
              </div>
            ))}

            {/* lanes */}
            {LANES.map((ln, li) => (
              <div key={li} className="flex border-b border-border last:border-b-0 min-h-[52px]">
                <div className="w-[210px] shrink-0 pr-2 flex flex-col justify-center" style={{ borderRight: `2px solid ${ln.c}` }}>
                  <div className="text-[12px] font-bold leading-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: ln.c }} />{ln.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{ln.note}</div>
                </div>
                <div className="relative flex-1">
                  {ln.items.map((it, ii) => {
                    if (it.kind === "bar") {
                      const l = pct(it.from), w = pct(it.to!) - l;
                      return (
                        <div key={ii} onMouseEnter={e => enter(e, it)} onMouseMove={move} onMouseLeave={leave}
                          className="absolute top-1/2 -translate-y-1/2 h-[15px] rounded-[2px] flex items-center px-1.5 overflow-hidden cursor-default"
                          style={{ left: `${l}%`, width: `${w}%`,
                            background: `color-mix(in srgb, ${ln.c} ${it.faint ? 9 : 20}%, var(--color-card))`,
                            border: `1px ${it.faint ? "dashed" : "solid"} color-mix(in srgb, ${ln.c} ${it.faint ? 30 : 45}%, transparent)` }}>
                          <span className="text-[8.5px] font-semibold truncate" style={{ color: `color-mix(in srgb, ${ln.c} 64%, var(--color-foreground))` }}>{it.label}</span>
                        </div>
                      );
                    }
                    const x = pct(it.from);
                    return (
                      <div key={ii} onMouseEnter={e => enter(e, it)} onMouseMove={move} onMouseLeave={leave}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-default group" style={{ left: `${x}%` }}>
                        <span className="w-[11px] h-[11px] rounded-full border-2 group-hover:scale-125 transition-transform"
                          style={{ background: it.end ? "var(--color-card)" : ln.c, borderColor: ln.c, boxShadow: `0 0 0 3px var(--color-card)` }} />
                        <span className={`absolute ${it.up ? "bottom-[13px]" : "top-[13px]"} text-[8px] font-semibold text-foreground/70 whitespace-nowrap text-center leading-tight`}
                          style={{ left: x < 12 ? "0" : x > 88 ? "auto" : "50%", right: x > 88 ? "0" : "auto", transform: x < 12 || x > 88 ? "none" : "translateX(-50%)", width: "max-content", maxWidth: "150px" }}>{it.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* convergence spine — overlay spans the track (left of it is the 210px label column) */}
            <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ left: "210px" }}>
              <div className="absolute -top-4 bottom-0 w-[2.5px] rounded" style={{ left: `${LAUNCH}%`, background: "linear-gradient(#7FA49A, color-mix(in srgb,#7FA49A 40%,transparent))", boxShadow: "0 0 12px 1px color-mix(in srgb,#7FA49A 45%,transparent)" }} />
              <div className="absolute -top-4 -translate-x-1/2 px-2 py-1 rounded-[3px] text-center whitespace-nowrap" style={{ left: `${LAUNCH}%`, background: "#587F72", color: "#fff" }}>
                <div className="text-[8.5px] font-bold tracking-wide">MON 2 NOV</div>
                <div className="text-[11px] font-semibold leading-none" style={{ fontFamily: "var(--app-font-serif)" }}>Winchester opens</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* hover tooltip */}
      {hover && (
        <div className="fixed z-50 pointer-events-none w-[280px] rounded-md border bg-popover shadow-lg p-3"
          style={{ left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 296), top: hover.y + 14 }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-wide border rounded-full px-1.5 py-0.5 ${LOC[hover.loc].cls}`}>{LOC[hover.loc].label}</span>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums ml-auto">{hover.range}</span>
          </div>
          <div className="text-[13px] font-semibold leading-tight text-popover-foreground">{hover.title}</div>
          {hover.theme && <div className="text-[11px] font-medium mt-0.5" style={{ color: "#587F72" }}>{hover.theme}</div>}
          <div className="text-[11.5px] text-muted-foreground leading-relaxed mt-1.5">{hover.detail}</div>
        </div>
      )}
    </div>
  );
}
