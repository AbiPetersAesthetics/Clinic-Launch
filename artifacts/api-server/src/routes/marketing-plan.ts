export type DeepBlock = { h: string; b: string };
export interface PlanItem { category: string; title: string; detail: string; channel: string; owner: string; weekStart: string; dayDate: string; sortOrder: number; deep: DeepBlock[]; }
// Winchester launch plan, corrected against the live Meta/GHL/Google/site audit of 1 September 2026.
// Generated from the four verified build documents (correction, nurture, retargeting, creative, Bedhampton).
export const PLAN_ITEMS: PlanItem[] = [
  {
    "category": "top",
    "title": "Read this first: the list is already full (448 leads vs 40 places)",
    "detail": "Acquisition is not the constraint. Selection, conversion and capacity are.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 0,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The whole plan was written as though the job is to fill the list. The list is already full. There are 395 leads (448 opportunities in GHL) against a founding cap of 40, served by one nurse at 30 to 35 appointments a week."
      },
      {
        "h": "WHY",
        "b": "Acquisition is not the constraint. Selection, conversion and capacity are. Every extra lead bought from here is a lead for a place that no longer exists, at a rising price."
      },
      {
        "h": "KEY FIGURES",
        "b": "395 leads captured (448 opportunities in GHL). 40 founding places. Cost per lead £5.64 over the last 7 days against £3.16 lifetime. 3.6 leads per 1,000 reached, down from 13.8 lifetime. £422 released by correcting the cold spend."
      },
      {
        "h": "NOTE",
        "b": "Headline state, measured 1 September 2026: Meta prospecting live and producing leads daily, no Winchester Business Profile, no Google campaigns, 62 days to launch (Monday 2 November). Read this before anything else in the plan."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q1 Google Ads: not started, verification still gates launch",
    "detail": "Account 431-745-4350, zero campaigns, both conversion actions Needs attention.",
    "channel": "google",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 1,
    "deep": [
      {
        "h": "STATUS",
        "b": "Not started. Account 431-745-4350 is still named Abi Peters Aesthetics. Zero campaigns exist, brand or non-brand. The only conversion actions are the two Business Profile defaults, both showing Needs attention with zero recorded results."
      },
      {
        "h": "NOTE",
        "b": "Advertiser verification still gates any launch, so start verification early. Nothing can spend on Google until it clears."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q2 Website and landing pages: live, but the domain is unverified with Meta",
    "detail": "All ten pages return 200; no Meta verification, meta tag or DNS record; Google's is present.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 2,
    "deep": [
      {
        "h": "STATUS",
        "b": "Live, not verified. All ten pages return 200, including /winchester, /bedhampton, /founding and /skin-audit. The old domain 308 redirects to the new one, so the CRM listing still resolves and is cosmetic only."
      },
      {
        "h": "NOTE",
        "b": "The domain has no Meta verification, no meta tag and no DNS record, while Google's is present. Verifying the domain with Meta is the fix (see the switch-on task)."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q3 Business Profiles: Bedhampton verified, Winchester does not exist",
    "detail": "You would open Winchester with no profile; the map pack belongs to two rivals.",
    "channel": "google",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 3,
    "deep": [
      {
        "h": "STATUS",
        "b": "Bedhampton is verified and managed, 5.0 from 84 reviews. Winchester does not exist as a profile."
      },
      {
        "h": "NOTE",
        "b": "The Winchester map pack currently belongs to The Aesthetics Bae (5.0 from 151 reviews) and Dr Victoria Cosmetic Dermatology (4.8 from 131). You would open with none, which is why creating the Winchester profile is the longest lead-time job here."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q4 Booking export: manual weekly CSV, matched on email each Sunday",
    "detail": "No API and no server-side booking event; this reconciliation is the only closed loop.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 4,
    "deep": [
      {
        "h": "STATUS",
        "b": "Manual. Weekly CSV export from the booking system, not screenshots and not a manual count. Match on email each Sunday and write back First Treatment Date, Value and Revenue Status."
      },
      {
        "h": "NOTE",
        "b": "There is no API and no server-side booking event, so this reconciliation is the only closed loop available. Build it as a standing Sunday routine."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q5 Live Meta ad set: the age band is a suggestion, not a limit",
    "detail": "age_min is 18 and Advantage Audience is on with full expansion; the two videos were never fairly tested.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 5,
    "deep": [
      {
        "h": "STATUS",
        "b": "Drifting. Jewry Street pin, 12 mile radius, home and recent, excluding Chandler's Ford, Eastleigh and Southampton. Age reads 28 to 65, but age_min is 18 and Advantage Audience is on with full expansion, so the band is a suggestion rather than a limit."
      },
      {
        "h": "NOTE",
        "b": "All three live ads are static images. Both videos are paused on under £6 of spend and were never fairly tested."
      }
    ]
  },
  {
    "category": "top",
    "title": "Q6 Conversions API: worth reconnecting, but rank it below profile and retargeting",
    "detail": "Pixel fires PageView and Lead only; leads bypass the site, so CAPI won't improve lead measurement.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 6,
    "deep": [
      {
        "h": "STATUS",
        "b": "Yes, later. Worth reconnecting, but rank it below the Winchester profile and the retargeting build. The pixel fires PageView and Lead only."
      },
      {
        "h": "NOTE",
        "b": "Because leads arrive through instant forms that never touch the website, reconnecting will not improve lead measurement. Its value is audience durability and retargeting quality."
      }
    ]
  },
  {
    "category": "top",
    "title": "DONE: Meta prospecting live and producing leads daily",
    "detail": "Stop planning this; the cold ad set is already running and delivering.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 7,
    "deep": [
      {
        "h": "STATUS",
        "b": "Already built and live. Meta prospecting is running and producing leads daily. Stop planning it as a Phase 0 job; the only open question is the budget (see the cold-spend cut)."
      }
    ]
  },
  {
    "category": "top",
    "title": "DONE: website, all landing pages and the old-domain redirect",
    "detail": "Ten pages return 200; the old domain 308-redirects to the new one.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 8,
    "deep": [
      {
        "h": "STATUS",
        "b": "Already built and live. Website, all landing pages and the old-domain redirect are done. Ten pages return 200. Stop planning these; the only website job left is Meta domain verification."
      }
    ]
  },
  {
    "category": "top",
    "title": "DONE: pipeline, custom fields and WhatsApp built in the CRM",
    "detail": "GHL is wired; stop planning this part of Phase 0.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 9,
    "deep": [
      {
        "h": "STATUS",
        "b": "Already built. Pipeline, custom fields and WhatsApp are in the CRM. Stop planning them. Remaining CRM work is additive (Booked and Attended stages, nurture stop-on-booking, weekly export), handled in the retargeting spec."
      }
    ]
  },
  {
    "category": "top",
    "title": "DONE: Bedhampton Business Profile verified, 5.0 from 84 reviews",
    "detail": "Bedhampton is verified and managed; only Winchester is missing.",
    "channel": "google",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 10,
    "deep": [
      {
        "h": "STATUS",
        "b": "Already done. The Bedhampton Business Profile is verified and managed, 5.0 from 84 reviews. Only the Winchester profile is missing (see the switch-on task to create it)."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: create the Winchester Business Profile, 2 November opening date",
    "detail": "Longest lead time of anything here; set the opening date to Monday 2 November.",
    "channel": "google",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 11,
    "deep": [
      {
        "h": "WHY",
        "b": "This has the longest lead time of anything in Phase 0. Winchester does not exist as a profile today, and the map pack belongs to two established rivals. Verification and review-building both take weeks, so start now."
      },
      {
        "h": "STEPS",
        "b": "1. Create the Winchester Business Profile at the Jewry Street address. 2. Set the opening date to Monday 2 November 2026 (Google supports a future open date). 3. Begin verification immediately. 4. Keep the listing accurate and ready to switch to open on launch day."
      },
      {
        "h": "NOTE",
        "b": "Highest return, lowest effort this week. Do not wait for the rest of the plan to settle before starting it."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: verify the domain with Meta, then reconnect the Conversions API",
    "detail": "Domain verified 2 Sep. The Conversions API turned out to be a fresh setup, not a reconnect, and is deferred to the retargeting build.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 12,
    "deep": [
      {
        "h": "DONE (domain)",
        "b": "Domain verified 2 September 2026. The facebook-domain-verification meta tag is live in the site head (base.njk, so every page) and shows green in Meta Business settings."
      },
      {
        "h": "STATE (CAPI)",
        "b": "Verified 2 September: there is NOTHING to reconnect. Only the browser Meta Pixel 433665886446944 is connected; no server or partner integration exists (the earlier server events stopped in December 2025 and the integration is gone). So this is a fresh CAPI setup, not a reconnect."
      },
      {
        "h": "ROUTE (when built)",
        "b": "Scoped 2 September: go GHL-native, not the Conversions API Gateway (the Gateway only mirrors website pixel events, the weakest signal here since instant-form leads never touch the site). Facebook is already connected in GHL for the page and lead ads, so there is no OAuth wall. Build a workflow that sends a conversion event to Meta CAPI when a lead reaches booked or attended, passing email and phone as match keys, to pixel 433665886446944 and ad account 1565785360704219. Confirm the GHL plan exposes the Facebook Conversions API workflow action first; if not, fall back to Zapier to CAPI. The owner picks the exact trigger stage at build time."
      },
      {
        "h": "WHY (deferred)",
        "b": "Deferred to the retargeting build on 2 September by the owner. CAPI does not improve lead measurement here (leads arrive via instant forms that never touch the site); its value is audience durability and retargeting quality, which is why it ranks below the Winchester profile and the retargeting build."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: cut cold prospecting from about £19.80 a day to £8",
    "detail": "Done 2 Sep: already cut to £5 a day (tighter than £8), only Ad 1 and Ad 3 live. Full reclassification steps are in the Retargeting phase.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 13,
    "deep": [
      {
        "h": "DONE",
        "b": "Actioned 2 September in Ads Manager: the Winchester campaign is now £5 a day (it is a CBO campaign, so the budget sits at campaign level), with only Ad 1 (Calm Premium control) and Ad 3 (Opening Soon on Jewry Street) live and Ad 2, 4 and 5 paused. That is tighter than the £8 this task asked for, so the decision is made. Nothing more to do here today."
      },
      {
        "h": "WHY (the rationale that drove it)",
        "b": "Cost per lead had moved from £3.16 lifetime to £5.64 over seven days, against 395 leads for a cap of 40. Left unchanged the cold ad set would have bought roughly 200 more leads for places that no longer exist. At £5 it now runs as a low presence trickle, not a lead machine."
      },
      {
        "h": "FULL STEPS (where the detail lives)",
        "b": "The fuller reclassification, the exclusions and the formal deadline are in the Retargeting phase of this plan: 'Decision 1: cut cold prospecting from £19.34 to £8 a day' and 'Companion change: add exclusions to the prospecting ad set'. Those still say £8, which you have since tightened to £5, so treat them as satisfied. Revisit whether to reframe the ad set as evergreen diary fill when the retargeting build goes live."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: launch the retargeting campaign against the 395",
    "detail": "A small, correctly sized retargeting campaign to convert the warm list.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 14,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The 395 are warm and opted in. Turning 40 of them into founding clients is 10.1 per cent conversion, which is the entire business case. A small retargeting campaign sits underneath the conversation plan; it is not the thing that fills the 40 on its own."
      },
      {
        "h": "FULL STEPS (where the detail lives)",
        "b": "This is the headline; the full step-by-step is the Retargeting phase of this plan, in order: Baseline audit of the 395, then Audience Steps 1 to 5 (export the founding list from GHL, confirm the legal basis, upload the customer list to Meta, size the union, branch on its size), then build the campaign shell and objective, the Warm First Party ad set, Facebook and Instagram placements only, the £210 lifetime envelope (10p per person), UTM tracking, ads A1 (live 12 to 25 October) then A2 (26 October to 1 November), and the hard stop that pauses the campaign when the 40th place books. Flight Monday 12 October to Sunday 1 November."
      },
      {
        "h": "DO NOW",
        "b": "Do not launch spend today; this builds now and flies on 12 October. Start with Audience Step 1 (export the founding list from GHL) and Step 3 (upload it to Meta) so the audience is warmed and ready. Everything else in the Retargeting phase can be built against it in the run-up."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: open the November booking calendar in ANS",
    "detail": "So interest can become a booking; the single highest value operational change.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 15,
    "deep": [
      {
        "h": "WHY",
        "b": "Until November availability is open and bookable, warm interest has nowhere to go. Opening the calendar is the single highest value operational change: it is what lets a conversation become a booking."
      },
      {
        "h": "STEPS",
        "b": "1. Open the November Winchester calendar in ANS. 2. Confirm it is genuinely bookable. 3. Align it with the founding priority window if that decision is taken (founding list chooses from Monday 26 October, general booking from Monday 2 November)."
      }
    ]
  },
  {
    "category": "top",
    "title": "Build: confirm how many complimentary analysis slots exist per week",
    "detail": "Capacity number needed before any offer runs; sets the free-analysis ceiling.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 16,
    "deep": [
      {
        "h": "DECISION",
        "b": "Confirm how many complimentary AI Skin Analysis slots exist per week. Nothing currently caps how many free analyses are given away, and one nurse runs only 30 to 35 appointments a week."
      },
      {
        "h": "CAPACITY",
        "b": "A 30 minute analysis against a 60 minute standard slot means 12 analyses a week consume about 6 of 30 to 35 slots (17 to 20 per cent, affordable); a full 60 minutes pushes it to 34 to 40 per cent, which is not affordable. Also confirm whether the 30 to 35 a week is Winchester only or shared with Bedhampton, and state the Winchester share before any ad runs."
      }
    ]
  },
  {
    "category": "top",
    "title": "Build: weekly booking export routine into the CRM",
    "detail": "Sunday CSV, match on email, write back First Treatment Date, Value, Revenue Status.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-06",
    "sortOrder": 17,
    "deep": [
      {
        "h": "STEPS",
        "b": "Each Sunday, export the weekly CSV from the booking system (not screenshots, not a manual count). Match on email and write back First Treatment Date, Value and Revenue Status into the CRM."
      },
      {
        "h": "WHY",
        "b": "There is no API and no server-side booking event, so this manual reconciliation is the only closed loop between bookings and the CRM. Make it a standing weekly habit."
      }
    ]
  },
  {
    "category": "top",
    "title": "Build: decide the founding 40 selection mechanic",
    "detail": "The real launch decision, missing from the plan: how the 40 are chosen from 395.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 18,
    "deep": [
      {
        "h": "DECISION",
        "b": "How are the founding 40 chosen from 395 warm leads? This is the real launch decision and it is missing from the original plan. It needs an owner call and a written basis, especially if any Apply Now or genuine-selection framing is used in ads."
      },
      {
        "h": "NOTE",
        "b": "It interacts with what founding actually buys (a priority booking window from 26 October is the honest, exclusive, zero-cost option) and with capacity. Settle it before the announcement cadence begins."
      }
    ]
  },
  {
    "category": "top",
    "title": "Build: finish advertiser verification, then brand-defence Search only",
    "detail": "Verification gates any Google launch; run brand Search only once cleared.",
    "channel": "google",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 19,
    "deep": [
      {
        "h": "STEPS",
        "b": "1. Complete Google advertiser verification (it gates any launch). 2. Once cleared, run brand-defence Search only, protecting Abi Peters and clinic-name queries. Nothing non-brand and no spend before verification and the conversion-action repair are done."
      },
      {
        "h": "NOTE",
        "b": "Account 431-745-4350 has zero campaigns today. Brand defence is the only Google spend contemplated pre-launch."
      }
    ]
  },
  {
    "category": "top",
    "title": "Build: repair the two Needs attention conversion actions before any spend",
    "detail": "Both Business Profile default actions show Needs attention with zero results.",
    "channel": "google",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-09",
    "sortOrder": 20,
    "deep": [
      {
        "h": "STEPS",
        "b": "The only conversion actions in the Google account are the two Business Profile defaults, both showing Needs attention with zero recorded results. Fix them so conversions record properly before any Google spend goes live."
      },
      {
        "h": "NOTE",
        "b": "Sequence: advertiser verification, then repair these actions, then brand-defence Search. Do not spend with broken conversion tracking."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B1: read the workflow moving records to Contacted",
    "detail": "Confirm whether the 413 Contacted records were already messaged, then rewrite A1a's opener if so.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 21,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "The Founding List pipeline (XviU0AiNzzdmBK83koVl) holds 448: 35 New Meta Lead, 413 Contacted, 0 Replied/Interested, 0 Later/No Reply. lastStageChangeAt is spread 15 Aug to 1 Sep, so something moves records to Contacted on a rolling basis."
      },
      {
        "h": "WHY",
        "b": "If those 413 already had a message, then A1a's line 'you put your name down' is a second or third touch and every reply assumption is stale. Trigger on the TAG 'winchester founding client', not the stage New Meta Lead (which only reaches 35)."
      },
      {
        "h": "STEPS",
        "b": "1. Open the workflow that has been moving records to Contacted since 15 Aug. 2. Read exactly what it sends and when. 3. If a message already went out, rewrite A1a's opening line before Phase A sends."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B2: confirm the WhatsApp sender and get the templates approved",
    "detail": "The whole design is reply-based; WhatsApp is connected, so the job is the approved templates that let the first message send.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 22,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Confirm the WhatsApp Business number is connected in GHL and can send and receive. WhatsApp is already set up, so the real work is getting the business-initiated templates approved: every first outbound is a template, and each reply-gated step (autumn/next year, YES, KEEP, STOP) then runs free-form inside the 24 hour window."
      },
      {
        "h": "NOTE",
        "b": "First outbound is always an approved WhatsApp template, because no session is open yet. Once the contact replies, the 24 hour window opens and the rest of the thread is free-form WhatsApp."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B3: write the lawful basis for WhatsApp and email",
    "detail": "Retrieve the instant-form consent wording and record that it covers direct marketing by WhatsApp and email.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 23,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Write down the lawful basis once, covering both WhatsApp and email. Retrieve the exact instant-form consent wording, confirm it covers direct marketing by WhatsApp and email, and record the date range."
      },
      {
        "h": "WHY",
        "b": "PECR reg 22 applies to WhatsApp marketing as it does to email. Some records predate 1 Sep 2026, so consent may have degraded. This is owner decision 6 in section 14. If consent covers email, Phase B goes to the whole Requested pool; if not, only to Marketing Opt In = Yes."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Pause the Winchester prospecting ad set today",
    "detail": "Pause Winchester | 12 Mile Radius | 28-65 | Open Targeting; the pool is exhausted and Phase A excludes it.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 24,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Winchester | 12 Mile Radius | 28-65 | Open Targeting runs at about £19.34 a day. Today to 2 Nov is 62 days, another £1,199 buying 170 to 213 more leads at £5.64 against a cap of 40. Cost per founding place today is £1,249/40 = £31.23; keep spending and it becomes £2,448/40 = £61.20."
      },
      {
        "h": "WHY",
        "b": "The CPL trend is structural, not creative: 28,608 lifetime reach in a 12 mile radius, only 6,710 in the last 7 days at frequency 1.96. CPL moved £3.16 lifetime to £5.64 last 7 days to £7.07 last 3 days."
      },
      {
        "h": "STEPS",
        "b": "1. Today (2 Sep) pause the ad set. 2. If it is ever unpaused, tighten advantage_audience, targeting_optimization and age_min first."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Founding is wave one (40). The waitlist is wave two.",
    "detail": "20 of 40 already booked. Keep 40 a real, closing cohort; the waitlist becomes a second founding wave when the second clinician starts (planned spring 2027).",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 25,
    "deep": [
      {
        "h": "THE DECISION",
        "b": "20 of the 40 founding places are already booked, with the nurture barely started, 448 warm leads still waiting, and the Bedhampton base now invited too. Demand clearly exceeds 40. The question is whether to raise the cap."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Do not inflate 40. The whole brand, and every ad, rests on 40 being a real limit that one nurse can look after honestly. Quietly moving it to 60 breaks that promise, and the CAP Code expects a stated limit to be genuine. Instead, keep 40 as wave one, let it close cleanly (it is over half gone, which makes the scarcity true), and open a Founding wave two on the honest waitlist, released when the second, skin-focused clinician starts. That matches the cap to the capacity to serve it, and captures the overflow instead of turning warm people away."
      },
      {
        "h": "HOW",
        "b": "Everyone past 40, and everyone whose held slot lapses, goes onto the waitlist (the C4, C5 and D8 mechanic already does this). Tag them founding-wave-2. When the second, skin-focused clinician starts in spring 2027 (about April or May), open roughly another 40 places to that list first, in order. Warm Bedhampton clients who miss wave one get priority on wave two."
      },
      {
        "h": "CAPACITY NOTE",
        "b": "Wave two cannot open until there is a second pair of hands to deliver it. The second, skin-focused clinician is planned for about April or May 2027, six or more months after opening: the first winter is deliberately for stabilising one nurse in one room, not for stretching it. So even if wave one fills fast, hold wave two for the spring rather than pulling the hire forward. Let the waitlist build in the meantime; a queue content to wait is a stronger asset than a diary that overpromises."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B4: get the analyser specification into the compliance folder",
    "detail": "B1 copy claims the device photographs and measures skin in layers, a technical claim needing manufacturer docs.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 26,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "B1 email copy says the device 'photographs and measures your skin in layers', a specific technical claim. Get the analyser specification into the compliance folder and verify it against the manufacturer documentation."
      },
      {
        "h": "WHY",
        "b": "If the device does surface photography with software only, use the softer wording: replace with 'It photographs and analyses your skin in detail...'. Also check the word 'AI' actually matches the device."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B5: add the WhatsApp delivery tick to the analyser consent form",
    "detail": "D4 sends the report by WhatsApp: facial imagery and health data, Article 9; imaging consent is not channel consent.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 27,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Add an explicit WhatsApp delivery consent tick to the in-clinic analyser consent form."
      },
      {
        "h": "WHY",
        "b": "D4 sends the analysis report and plan by WhatsApp. That is facial imagery and health data (Article 9). Consent to imaging is not consent to the delivery channel, so a separate tick is required before any report is sent by WhatsApp."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B6: answer the seven owner decisions in section 14",
    "detail": "Days in Winchester, price-hold cost, weekly free-analysis cap and revenue target, Bedhampton cover, messaging owner, lawful basis, reconciliation owner.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 28,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Six blockers gate the build; B6 is answering the seven owner decisions in section 14 before the sequence goes live."
      },
      {
        "h": "DECISION",
        "b": "1. How many days a week Abi is in Winchester (30 to 35 is her total across both clinics; at three days the real Winchester number is nearer 18 to 21 and the founding 40 take half). Decides whether C6 and D3 go to the whole list or a throttled slice, and fixes B2's wording. 2. The founding benefit is four elements; what does the twelve-month price hold cost (compute before B2 sends on 12 Oct). 3. How many complimentary analysis hours per week and what November must earn (cap at a stated number, 8 a sensible start; set a November revenue target). 4. Does Bedhampton keep running through November and who covers it. 5. Who answers messages 09:00 to 17:00, five days a week, from the day Phase A starts (about 30 hours of messaging labour before a single appointment). 6. One written lawful-basis position covering WhatsApp and email (blocker B3). 7. Confirm the reconciliation owner and the daily slot."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Structural fix: build a Winchester calendar inside GHL",
    "detail": "At the moment a slot is accepted, book a placeholder in the GHL calendar as well as the ANS diary.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 29,
    "deep": [
      {
        "h": "WHY",
        "b": "There is no appointment-date field in GHL; the only DATE fields are contact.first_treatment_date and contact.entry_date, so 'appointment is tomorrow' cannot be built against text. A GHL Winchester calendar fixes D1 date reminders, the D2 merge field, the D4 attended trigger, and D5/D6/D7 timing, and gives a countable diary without an ANS API, collapsing the daily ritual to about 30 seconds."
      },
      {
        "h": "STEPS",
        "b": "1. Create a Winchester calendar inside GHL. 2. At the moment a slot is accepted, book a placeholder event in the GHL calendar as well as the ANS diary. 3. Keep the two diaries in step (Confirmed is hand-written at the appointment)."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Structural fix: add the three new text fields",
    "detail": "contact.offered_slot, contact.founding_week and contact.skin_concern_safe, all load-bearing for the sequence.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 30,
    "deep": [
      {
        "h": "STEPS",
        "b": "Create three new text fields. 1. contact.offered_slot: the nurse enters this at the moment of offer; used by C2, C3, C4, D8 and the C7/D1 confirmations. Format 'Tuesday 10 November at 2pm'. Load-bearing. 2. contact.founding_week: set on the C1 reply; drives the per-week cap in C2. 3. contact.skin_concern_safe: written by workflow, allow list only, used by A2."
      },
      {
        "h": "NOTE",
        "b": "Also clean the duplicate keys before building: contact.subject appears twice and contact.message appears twice, and merge fields on a duplicated key resolve unpredictably. Point the cap workflow at the real Priority Access field contact.priority_access (QFP9hFbNkkC9rbzv0oB1), NOT the booby-trapped 'Would you like priority access?' field (q3drS9TcT4hMPk3hxP7a, key contact.how_did_you_hear_about_our_company)."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Build the Priority Access state machine",
    "detail": "contact.priority_access states from blank through Requested, Booked, Confirmed, Waitlist, December, Keep in touch, Not now.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 31,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The selection narrows through three questions, each slightly more demanding; the uninterested simply do not answer and deselect themselves in private with no rejection event. The cap is never announced as a race and nobody is told they lost. The cap binds at booking, not treatment."
      },
      {
        "h": "STEPS",
        "b": "States on contact.priority_access: blank = not yet asked. Requested = said autumn, wants November (set by A1a/A1b on positive reply). Booked = accepted slot in both diaries, counts against 40 (C2 on YES plus daily reconciliation). Confirmed = founding client, plan agreed, first treatment date set (manual at appointment). Waitlist = wants founding but November full or hold lapsed (C4 or C5). December = chose December (C1 or C5). Keep in touch = replied KEEP to A3. Not now = declined, or three asks and silence."
      },
      {
        "h": "NOTE",
        "b": "Cap counter smart list is Booked OR Confirmed; at 40, pause C2 and start C5. Keep in touch is included in the C6, D3 and D9 audiences. Two guards on every send: Clinic Interest = Winchester, and split first touch by whether First Treatment Date is empty."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "A1a: re-opener WhatsApp to new leads",
    "detail": "First touch to the founding tag: autumn or next year, batched 40 a day from Tue 3 Sep.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 32,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Tag 'winchester founding client', Clinic Interest = Winchester, First Treatment Date empty, created before 1 Sep 2026, not stage New Meta Lead. Batched 40 a day from Tue 3 Sep, Mon to Fri at 10:00."
      },
      {
        "h": "CHANNEL",
        "b": "Approved WhatsApp template (no session open yet). Before the first send, confirm the template is approved and every merge field resolves, since an empty variable fails template validation."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it's Abi. You put your name down for the new Winchester clinic. We open on Monday 2 November and I'm planning the diary now. Is your skin something you'd like looked at this autumn, or is it more of a next year thing? Just reply autumn or next year. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "On send: stage Contacted. On 'autumn': stage Replied/Interested, Priority Access Requested, Treatment Timeline Autumn 2026. On 'next year': stage Later/No Reply, Priority Access Not now, Treatment Timeline 2027. No reply in 4 days: stage Later/No Reply, fire A2."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "A1b: re-opener WhatsApp to existing clients",
    "detail": "Shorter yes/not yet ask to people Abi has treated before; on yes, skip Phase B and go to C1.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 33,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "As A1a but First Treatment Date NOT empty (if the field is never backfilled, build this list from ANS or Total Revenue > 0, else A1b fires to nobody and everyone gets the cold script)."
      },
      {
        "h": "CHANNEL",
        "b": "WhatsApp, 10:00 Mon to Fri, batched from Tue 3 Sep."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it's Abi. You already know how I work so I'll keep this short. The Winchester clinic opens on Monday 2 November and I'm keeping a few founding places for people I've treated before. Would you like one? Just reply yes or not yet. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "On yes: Priority Access Requested, stage Replied/Interested, skip Phase B, go straight to C1."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "A4: consent housekeeping WhatsApp",
    "detail": "Asks Requested contacts with no marketing opt-in for email consent, 24 hours after Requested.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 34,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Requested AND Marketing Opt In empty. WhatsApp, same thread, 24 hours after Requested."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "One bit of housekeeping {{contact.first_name}}. Would you like the occasional email from me about the clinic, opening times and skin advice? Reply YES and I'll add you. Reply NO and I'll only ever message you about your own appointments. Either is genuinely fine. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "YES: Marketing Opt In Yes. NO: Marketing Opt In No, excluded from Phase B, no WhatsApp fallback."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Bedhampton warm: build the migration list in GHL",
    "detail": "Segment the existing Bedhampton clients, the warmest founding candidates you have, and tag them.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 35,
    "deep": [
      {
        "h": "WHY",
        "b": "The existing Bedhampton clients already know and trust Abi. They convert far better than any cold lead, and Bedhampton is closing, so they need somewhere to go. They should be offered a founding place before the cold 448, not after."
      },
      {
        "h": "STEPS",
        "b": "1. In GHL, build a smart list of existing Bedhampton clients: opportunity Revenue Status is First Payment Taken or Repeat Client, OR First Treatment Date is set, OR Total Revenue is greater than 0. 2. Exclude anyone already on the Winchester Founding List. 3. Tag them bedhampton-warm. 4. Separately tag Bedhampton enquirers who never became clients as bedhampton-cold. 5. Confirm the counts, so you know how many founding places to hold for warm clients."
      },
      {
        "h": "NOTE",
        "b": "Warm clients get first refusal on founding. Hold places for them before opening the list wider."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "A2: second ask, personalised if/else branch",
    "detail": "Fires 4 days after no reply to A1a; a merge field cannot conditionally rewrite a sentence, so build two branches.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-07",
    "sortOrder": 36,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Stage Later/No Reply, 4 days elapsed, no inbound. WhatsApp at 17:30. Build as an if/else branch: an empty merge field would send 'you told me you wanted to work on .'"
      },
      {
        "h": "WHATSAPP COPY (Branch 1, skin_concern_safe set)",
        "b": "Hi {{contact.first_name}}, Abi here. When you did the skin audit on the website you told me you wanted to work on {{contact.skin_concern_safe}}. I open in Winchester on 2 November and I'll be doing the in-clinic skin analysis there, complimentary until 30 November. Would you like me to hold you a time, or leave you be for now? Reply STOP to opt out."
      },
      {
        "h": "WHATSAPP COPY (Branch 2, everyone else)",
        "b": "Hi {{contact.first_name}}, Abi here. You put your name down for the Winchester clinic a little while back. I open there on 2 November and I'll be doing the in-clinic skin analysis, complimentary until 30 November. Would you like me to hold you a time, or leave you be for now? Reply STOP to opt out."
      },
      {
        "h": "NOTE",
        "b": "skin_concern_safe is written only where the raw Skin Audit Concerns matches an allow list (fine lines, texture, pigmentation, dryness, redness, breakouts, dullness, laxity); anything else, including blank, falls to branch 2. Never merge a free-text field without an allow list (strict liability, Human Medicines Regs 2012 reg 284). The website skin audit is the free online form; the skin analysis is the in-clinic £50 imaging session; do not use the terms interchangeably."
      },
      {
        "h": "WRITE-BACK",
        "b": "On reply: stage Replied/Interested, Priority Access Requested. No reply in 10 days: fire A3."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Monday scoreboard: six numbers, 15 minutes",
    "detail": "Every Monday pull Requested, Booked, Confirmed, December, Not now and total first treatment value from smart lists.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-07",
    "sortOrder": 37,
    "deep": [
      {
        "h": "STEPS",
        "b": "Every Monday, 15 minutes, read six numbers, all as smart lists: Requested, Booked, Confirmed, December, Not now, and the sum of first treatment value."
      },
      {
        "h": "NOTE",
        "b": "The cap counter (Booked OR Confirmed) is the binding number; at 40, pause C2 and start C5. This scoreboard is the only place the count reliably lives and it feeds the failure-branch checkpoints on 16 Oct and 20 Oct."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "A3: graceful close, I'll leave you be",
    "detail": "Last message after two unanswered touches; reply KEEP to stay in touch, otherwise close and suppress.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-17",
    "sortOrder": 38,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Stage Later/No Reply, A2 sent 10 days ago, no inbound. Email if Marketing Opt In = Yes, WhatsApp only if blank, never if No. 08:00."
      },
      {
        "h": "SUBJECT",
        "b": "I'll leave you be"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, I've messaged twice and had no reply, which is completely fine. I'll stop here. The Winchester clinic opens on Monday 2 November at 9A Jewry Street, Winchester. The skin analysis is complimentary there until 30 November if you ever fancy it. It's an assessment, not a sales meeting. If you'd like me to keep in touch about the clinic, reply KEEP and I will. Otherwise this is my last message. Abi"
      },
      {
        "h": "WRITE-BACK",
        "b": "On KEEP: Marketing Opt In Yes, Priority Access Keep in touch, evergreen S6, receives C6, D3, D9. No reply: Priority Access Not now, close the Founding List opportunity, evergreen S6, suppressed from every further send including D9."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Bedhampton cold invite: Bedhampton now, or Winchester in November",
    "detail": "To Bedhampton enquirers who never booked, offer the local analysis now and the Winchester option too.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-22",
    "sortOrder": 39,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Tag bedhampton-cold (enquired, never became a client). Marketing Opt In respected: WhatsApp where consented, email otherwise."
      },
      {
        "h": "STRATEGY",
        "b": "Give them both doors and let them choose. The Bedhampton free analysis is on until 30 October and is the nearer option; Winchester opens 2 November for anyone happy with the drive. No pressure, honest about the closure."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it's Abi. Two things while I still can: my Bedhampton clinic has a complimentary skin analysis on until 30 October, and I'm opening a new clinic in Winchester on 2 November if that is easier for you. Either way I would love to see you. Which suits? Reply STOP to opt out. Abi"
      },
      {
        "h": "NOTE",
        "b": "Bedhampton locals who will not travel are still worth an analysis before 30 October, that is the harvest. The ones happy to travel become Winchester leads. Do not decide for them."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Bedhampton warm invite: follow Abi to Winchester (founding first)",
    "detail": "Personal invite to existing Bedhampton clients, honest on the drive, first refusal on a founding place.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-09-27",
    "dayDate": "2026-10-01",
    "sortOrder": 40,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Tag bedhampton-warm. From Abi personally: WhatsApp first, email for the fuller version. Sent before the Winchester 448 founding booking opens on 26 October, so loyal clients get first pick."
      },
      {
        "h": "STRATEGY",
        "b": "These are the warmest people in the whole plan. Be honest that Winchester is about 25 minutes further, let them decide, and make the founding place a genuine thank-you for their loyalty. Never pushy. If the drive does not work for them, that is completely fine."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it's Abi. A change I wanted you to hear from me first: I'm opening my own clinic in Winchester on 2 November, and winding Bedhampton down. It's about 25 minutes up the road, and I would love to keep looking after your skin there. I'm holding founding places for my Bedhampton clients first, before anyone else. Would you like one? Just reply yes, or tell me your thoughts. Abi x"
      },
      {
        "h": "EMAIL COPY",
        "b": "Subject: A change, and a place saved for you\n\nHi {{contact.first_name}},\n\nAfter all this time at Bedhampton, I'm opening my own clinic in Winchester on Monday 2 November, at 9A Jewry Street. Bedhampton is winding down as I move across.\n\nI know Winchester is a bit further for you, about 25 minutes, so I wanted to be honest about that and let you decide. What I can promise is that the care does not change. And because you have trusted me here, you get first refusal on a founding place before I open the list to anyone else: priority booking, founding pricing held for twelve months, and a plan written for your skin rather than sold to you on the day.\n\nIf the drive works for you, I would genuinely love to keep looking after you. If it does not, thank you, truly, for everything.\n\n[ Reserve my founding place ]\n\nAbi x"
      },
      {
        "h": "WRITE-BACK",
        "b": "On yes: Priority Access Requested, tag founding-warm, route into the C1 week question so they pick a November slot like any founding client. These bookings count against the 40."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B1: what the clinic actually is (email)",
    "detail": "First Phase B email to the Requested opted-in pool; sets up honesty and the £50 assessment.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-05",
    "sortOrder": 41,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Requested AND Marketing Opt In Yes AND Clinic Interest Winchester. Email Mon 5 Oct 07:30. If B3 concludes original consent covers email, send to the whole Requested pool."
      },
      {
        "h": "SUBJECT",
        "b": "What I'm opening in Winchester"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, A short note about what's coming, so you know whether it's for you. I'm a nurse. The Winchester clinic is one room, one practitioner, and appointments long enough to actually look at your skin before anyone suggests anything. No packages sold at the door, and nothing I would not be happy to have done myself. Every first appointment starts with the skin analysis. It photographs and measures your skin in layers, so we work from what is there rather than what either of us assumes. The analysis is a £50 assessment, and it is complimentary at Winchester until 30 November. We open on Monday 2 November at 9A Jewry Street, Winchester. I'll write once more before then. Abi"
      },
      {
        "h": "NOTE",
        "b": "If B4 finds surface photography only, replace with 'It photographs and analyses your skin in detail...'. Price wording 'The analysis is a £50 assessment' is forward-looking and true; never 'normally £50' (it has never been charged at Winchester, unsubstantiated under CAP 3.17). No write-back on open."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B2: the honest bit about the diary (email)",
    "detail": "Second Phase B email; explains the founding forty and its four benefits, no discount, nothing to buy.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 42,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "As B1 plus B1 sent 7 days ago. Email Mon 12 Oct 07:30."
      },
      {
        "h": "SUBJECT",
        "b": "The honest bit about the diary"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, There is one of me, so there are only so many appointments in a week. That is the whole business. Because of that, I'm opening the first month as a founding group of forty. Founding clients get their prices held at launch rates for twelve months from their first treatment, priority booking, a complimentary skincare add on with their first treatment, and a plan written before we start rather than sold to them on the day. It is not a discount and there is nothing to buy today. Next week I'll ask you which week in November suits. If November doesn't suit, that is genuinely fine. December is open, and the analysis is complimentary to anyone who comes in before the end of November, founding place or not. Abi"
      },
      {
        "h": "NOTE",
        "b": "The founding benefit is four elements (priority booking, complimentary skincare add on with first treatment, founding pricing held twelve months, first 40); do not drop the add-on. Cost the twelve-month price hold before this sends (owner decision 2). 'only so many appointments in a week' replaces 'about thirty a week' until owner decision 1. 'It is not a discount and there is nothing to buy today' is word-for-word locked."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Failure branch checkpoint: Friday 16 October",
    "detail": "Count Priority Access = Requested; 55+ proceed, under 55 phone, under 30 reconsider the cap.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-16",
    "sortOrder": 43,
    "deep": [
      {
        "h": "WHY",
        "b": "Realistic first-WhatsApp reply is 8 to 18 per cent. The 12 per cent scenario produces 18 founding clients, not 40, so the plan needs a dated decision point."
      },
      {
        "h": "DECISION",
        "b": "Friday 16 October, count Priority Access = Requested. 55 or more: proceed as planned. Under 55: phone the non-repliers (not a fourth WhatsApp), pull December forward, and open founding to web and walk-in from 2 Nov. Under 30: all of that, plus reconsider whether 40 is the right cap (a real 25 beats a padded 40)."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C1: the week question",
    "detail": "Asks Requested contacts which November week suits; single send Mon 19 Oct.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 44,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Requested (sent regardless of Marketing Opt In, one-to-one reply). WhatsApp. Mon 19 Oct 09:00, single send."
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, Abi. Time to put dates in. Which suits you best for your first appointment: the week of 2 November, 9 November, 16 November, or 23 November? Or reply December if that is easier. Whichever you pick I'll hold you a time and send it back. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "On a November reply: Founding Week set, Treatment Timeline November 2026, stage stays Replied/Interested, queue for C2. On December: Priority Access December, exit founding, receive C6 and D3. No reply in 5 days: Priority Access stays Requested, stage Later/No Reply, receive C6 and D3 only, no chase."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Start retargeting at £8 a day",
    "detail": "Air cover behind the WhatsApp sequence to the lead-form and website audiences, 19 Oct to 15 Nov.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 45,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Mon 19 Oct, start retargeting at £8 a day to the lead-form and website audiences, running 19 Oct to 15 Nov (£224). This is air cover behind the WhatsApp sequence, not a lead machine."
      },
      {
        "h": "NOTE",
        "b": "Phase A excludes the live prospecting audience. If prospecting is ever unpaused, tighten advantage_audience, targeting_optimization and age_min first."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "Failure branch checkpoint: Monday 20 October (media decision)",
    "detail": "If Booked under 25 release up to £400 for a two-week launch reach push; if 25+ spend nothing further.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-20",
    "sortOrder": 46,
    "deep": [
      {
        "h": "DECISION",
        "b": "Monday 20 October is the media decision. If Booked is under 25, release up to £400 for a two-week local reach push over the launch fortnight. If Booked is 25 or more, spend nothing further."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C2: the held slot (manual task)",
    "detail": "Offer a held hour to the next in the queue; nurse writes offered_slot and books both diaries at the offer.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-21",
    "sortOrder": 47,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Founding Week set AND Priority Access Requested AND combined Booked+Confirmed under 40 AND Booked in that Founding Week under 10. Rolling, earliest week first then reply time. Build as a manual task with a saved snippet, not send-and-forget. WhatsApp, from Wed 21 Oct within 24 hours of the C1 reply. Both caps hard."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, I've held {{contact.offered_slot}} for you at 9A Jewry Street. It's a full hour: the analysis first, then we talk about what is worth doing and what isn't. Nothing to pay to hold it. Reply YES and I'll confirm, or tell me a better day and I'll move it. I'll keep it until Thursday evening."
      },
      {
        "h": "STEPS",
        "b": "At the moment of offer the nurse writes contact.offered_slot (format 'Tuesday 10 November at 2pm'), books the GHL placeholder and the ANS diary, all three at the offer."
      },
      {
        "h": "WRITE-BACK",
        "b": "On YES: Priority Access Booked, confirm the calendar event, evergreen S3, opportunity.revenue_status No Payment Yet, fire C7. On counter-offer: re-offer, rewrite offered_slot. 'Nothing to pay to hold it' is word-for-word locked."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C7: confirmation and preparation",
    "detail": "Fires the instant Priority Access becomes Booked; confirms slot and how to prepare.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-21",
    "sortOrder": 48,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access changes to Booked. WhatsApp if session open else WhatsApp, immediately."
      },
      {
        "h": "MESSAGE",
        "b": "That's you booked, {{contact.first_name}}: {{contact.offered_slot}}, 9A Jewry Street, Winchester. Two things that help. Come without make-up if you can, and have a think about the one thing that bothers you most when you look in the mirror. That is where we'll start. Anything you want to ask before then, just message me here. Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C3: the 48 hour nudge",
    "detail": "Same-thread reminder that the held slot is still there until tomorrow evening.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-23",
    "sortOrder": 49,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "C2 sent 48 hours ago AND Priority Access still Requested. Same thread, 48 hours, 17:00."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, just so it doesn't quietly disappear: {{contact.offered_slot}} is still yours until tomorrow evening. Yes, or a different day, either is easy."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C4: releasing the hold",
    "detail": "Lets the slot go gracefully after 72 hours; nobody is rejected, C2 fires for the next in the queue.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-24",
    "sortOrder": 50,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "C2 sent 72 hours ago AND Priority Access still Requested. Same thread, 72 hours, 18:00."
      },
      {
        "h": "MESSAGE",
        "b": "No problem at all, I've let that time go so someone else can use it. You haven't missed anything: the diary is open into December, and the analysis is complimentary to anyone who comes in before the end of November. Say the word whenever you're ready and I'll find you a time. Abi. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "Priority Access Waitlist, clear offered_slot, stage Later/No Reply, evergreen S8, delete the placeholders. C2 fires for the next in the queue. This message is locked word-for-word."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C5: November is full",
    "detail": "Sent when the cap reaches 40; offers December and keeps the complimentary analysis open.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 51,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Combined Booked+Confirmed reaches 40 AND contact is Requested or Waitlist with a November Founding Week. WhatsApp, one-to-one, within 24 hours."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, an honest update. The November founding places have gone. I would rather not fit you in at a time that does not do the appointment justice. What I can do: the first week of December is open and yours to choose from, and if you come in before the end of November the skin analysis is still complimentary, founding place or not. If a November time frees up, you are first on my list. Shall I look at December for you? Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "On yes: Priority Access December, evergreen S2. No reply: stays Waitlist, evergreen S8, eligible for D8."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "C6: opening on 2 November to everyone else",
    "detail": "Bulk email to the wider opted-in list once the founding round is running.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 52,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Clinic Interest Winchester AND Marketing Opt In Yes AND Priority Access not Booked/Confirmed/Not now (Keep in touch included). Email Mon 26 Oct 07:30. Throttle if Winchester capacity is thin."
      },
      {
        "h": "SUBJECT",
        "b": "Opening on 2 November"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, We open on Monday 2 November at 9A Jewry Street in Winchester. If you'd like to come in, the skin analysis is complimentary for the whole of November. You'll see your own skin properly, and hear what I would actually do about it. You are under no obligation to do any of it. The diary is here: [booking link] Abi"
      },
      {
        "h": "WRITE-BACK",
        "b": "One link, no Treatment Interest write-back on click."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "From 30 October: route the engaged Bedhampton base to Winchester",
    "detail": "When Bedhampton closes, move any warm or cold Bedhampton lead who is engaged but not yet booked onto the Winchester nurture.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 53,
    "deep": [
      {
        "h": "WHY",
        "b": "The analyser and the Bedhampton offer both end on 30 October. After that, the only door left for an engaged Bedhampton lead is Winchester, so the nurture has to move them across rather than let them go cold."
      },
      {
        "h": "STEPS",
        "b": "1. From 26 October, any bedhampton-warm or bedhampton-cold contact who is engaged but has no booking is offered the Winchester November complimentary analysis, and for warm clients a founding place if any remain (or wave two). 2. New Bedhampton enquiries from 26 October are answered with the Winchester offer, not a Bedhampton appointment that cannot happen. 3. Keep it honest about the 25 minute drive."
      },
      {
        "h": "NOTE",
        "b": "This is the one direction that is allowed. The Winchester 448 are never asked to travel to Bedhampton; the Bedhampton base is warmly invited to Winchester."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D1: day-before reminder",
    "detail": "Sent the evening before each founding appointment.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-01",
    "sortOrder": 54,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "GHL Winchester calendar event tomorrow. WhatsApp, 17:00 the day before."
      },
      {
        "h": "MESSAGE",
        "b": "See you tomorrow, {{contact.first_name}}: {{contact.offered_slot}}, 9A Jewry Street, Winchester. No make-up if you can manage it. If tomorrow has gone wrong for you, just tell me and we'll move it, no drama. Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D2: doors open to the founding group",
    "detail": "Launch-morning thank-you to everyone Booked or Confirmed.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 55,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Booked or Confirmed. WhatsApp. Mon 2 Nov 08:00."
      },
      {
        "h": "MESSAGE",
        "b": "We're open. Thank you for putting your name down back in the summer and then waiting for it, it genuinely made this possible. Your time is already in the diary and I'll send a reminder the day before. Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D4: the same evening (analysis and plan)",
    "detail": "Manual send of the analysis and written plan the evening of each attended appointment.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 56,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "GHL calendar event marked attended. WhatsApp if open and consent on file (blocker B5) else secure alternative, 19:00. About 5 minutes each, roughly 3.3 hours across 40; unbudgeted labour needing an open session and the B5 consent tick."
      },
      {
        "h": "MESSAGE",
        "b": "Lovely to meet you today, {{contact.first_name}}. Your analysis and the plan we talked through are attached. Nothing to decide tonight. If anything feels odd on your skin over the next couple of days, message me here rather than Googling it. If something is painful, spreading, or you are worried at all, please ring me on 07849 989869, and if you cannot reach me contact 111 or your GP."
      },
      {
        "h": "WRITE-BACK",
        "b": "Evergreen S4. If a treatment agreed: Priority Access Confirmed, opportunity.first_treatment_date, first_treatment_value, revenue_status First Payment Taken, evergreen S5, close Founding List won. Did not attend: Priority Access Waitlist, evergreen S7, slot released to D8."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D3: doors open to the wider list",
    "detail": "Bulk email to the opted-in list the morning after opening.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-03",
    "sortOrder": 57,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Clinic Interest Winchester AND Marketing Opt In Yes AND Priority Access not Booked/Confirmed/Not now (Keep in touch included). Email Tue 3 Nov 07:30."
      },
      {
        "h": "SUBJECT",
        "b": "We opened yesterday"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, The Winchester clinic opened yesterday at 9A Jewry Street. It is quieter and smaller than most people expect, which is deliberate. The skin analysis is complimentary all month. Around an hour, no obligation, and you leave with a clear picture of your own skin and an honest view of the options, including doing nothing. [booking link] Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D8: a time has come free",
    "detail": "Offers a released November slot to the oldest waitlisted contact first, one at a time.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-04",
    "sortOrder": 58,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Waitlist AND a November slot released by C4 or a no-show, one person at a time, oldest first. WhatsApp within 2 hours."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, a November time has come free: {{contact.offered_slot}}. It's yours if you want it, first refusal because you asked first. Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D5: day three check-in",
    "detail": "Short how-is-the-skin message three days after the appointment.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-05",
    "sortOrder": 59,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Attended 3 days ago. WhatsApp, 09:00."
      },
      {
        "h": "MESSAGE",
        "b": "Morning {{contact.first_name}}, three days on. How is the skin behaving? Abi"
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D6: the review ask",
    "detail": "Asks every attended client for a Google review seven days on; never selective.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-08",
    "dayDate": "2026-11-09",
    "sortOrder": 60,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Attended 7 days ago, no other condition. Do not exclude complainants: selective solicitation breaches the DMCC Act 2024 and Google policy. WhatsApp, 11:00. Disable the ANS review request for Winchester first."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, if you have a couple of minutes, a few honest lines on Google would help a new clinic more than anything else. [link] And whatever you put there, if anything wasn't right please tell me as well so I can put it right. Abi"
      },
      {
        "h": "NOTE",
        "b": "'as well' not 'instead'."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D7: the first step",
    "detail": "Gentle nudge to book the first treatment ten days on, only where none is booked.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-08",
    "dayDate": "2026-11-12",
    "sortOrder": 61,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Attended 10 days ago AND opportunity.first_treatment_date empty. WhatsApp, 10:00."
      },
      {
        "h": "MESSAGE",
        "b": "{{contact.first_name}}, no rush at all, but the plan we wrote has a first step in it, and your analysis is a snapshot of your skin on the day we took it. Happy to find you a time whenever you are ready, or to leave it. Abi"
      },
      {
        "h": "WRITE-BACK",
        "b": "Never claim the analysis 'works best started while current'. On yes: evergreen S5 plus revenue fields. No reply: evergreen S8."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "D9: the 30 November date",
    "detail": "Final email to the never-attended opted-in list; the analysis is £50 from 1 December.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-15",
    "dayDate": "2026-11-16",
    "sortOrder": 62,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Clinic Interest Winchester AND Marketing Opt In Yes AND never attended AND Priority Access not Not now (Keep in touch included). Email Mon 16 Nov 07:30."
      },
      {
        "h": "SUBJECT",
        "b": "A date worth knowing"
      },
      {
        "h": "MESSAGE",
        "b": "Hi {{contact.first_name}}, Just so you know: the complimentary skin analysis runs until 30 November. From 1 December it is £50. No pressure either way. But if you have been meaning to come in, that is the date. [booking link] Abi"
      },
      {
        "h": "NOTE",
        "b": "Never 'goes back to £50' (never charged at Winchester); 'From 1 December it is £50' is forward-looking. 'No pressure either way. But if you have been meaning to come in, that is the date.' is locked word-for-word."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Fill the diary: the white-space engine",
    "detail": "How treatment-intent, memberships, founding rebooking and the Bedhampton warm base fill paid slots in parallel with the free analyses, from opening day.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 63,
    "deep": [
      {
        "h": "THE WHITE-SPACE PROBLEM",
        "b": "One nurse runs about 30 to 35 appointments a week. The free AI Skin Analysis is capped at about 12 a week and makes no money: it is the top of the funnel, not the diary. That leaves roughly 18 to 23 paid slots a week, the white space, and today the only thing filling it is the hope that an analysis converts to a treatment later. That is too slow to open a clinic on. This workstream fills the white space directly, from opening day, alongside the analysis nurture rather than in place of it."
      },
      {
        "h": "STRATEGY, THE FOUR ENGINES",
        "b": "1. Treatment intent. The 443 warm leads already typed what they want into Treatment Interest on the Meta forms. We map that to a safe cluster and invite each person to book the thing they asked for, consultation first. 2. Memberships. Skin Circle at 19 a month, The Skin Plan at 115 Winchester with a founder rate of 95, and Skin Plan Advanced at 185 are pre-booked recurring slots, the single best way to fill white space and retain, so every warm and every new client is offered the membership as the natural next step. 3. Founding rebooking. Every founding client and every first treatment leaves with the next visit booked, so the diary compounds instead of resetting to zero. 4. The Bedhampton warm base. Existing Bedhampton clients who are local enough, or willing to follow Abi across, are invited as known paying regulars, not as cold leads."
      },
      {
        "h": "PARALLEL, NOT INSTEAD OF",
        "b": "The analysis funnel keeps running for anyone who is unsure, curious or unmapped: it stays the safe default. The diary-fill tracks sit alongside it and take only the people who have already named a treatment or a membership. Nobody is pulled out of the analysis nurture to force a booking; they are simply offered the faster route when they have already asked for it."
      },
      {
        "h": "WHAT GOOD LOOKS LIKE",
        "b": "Paid slots booked each week climbs toward 18 to 23 without pushing total appointments past about 30 to 35. Members signed each week builds a stable recurring base. Treatment bookings appear across the filler, boosters and skin clusters, not only from analyses. The anti-wrinkle-concern cluster produces consultations with Abi, never an advertised treatment."
      },
      {
        "h": "CAPACITY",
        "b": "This engine is built to fill the white space, not to overflow it. One nurse across two overlapping clinics in November is the hard ceiling. Demand above about 30 to 35 appointments a week goes onto an honest waitlist, not into an overbooked diary. The capacity governor item holds the mechanism."
      },
      {
        "h": "OWNERS",
        "b": "David builds the segmentation, tags, pipeline and dashboard in GHL. Abi is the voice of every outbound message and runs every consultation. This item is the shared brief that the rest of the Fill the diary workstream is built against."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Segment the list by Treatment Interest",
    "detail": "Map the free-text Treatment Interest to six safe clusters with an allow list, and fall back to the analysis funnel for anyone unsure or unmapped.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 64,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Treatment Interest is free text typed by the public on the Meta instant forms. It can contain misspellings, several treatments at once, brand names, or a prescription-only request. Treat it exactly like the Skin Audit Concerns field: it is a routing signal only. We map it to a safe cluster through an allow list and never merge the raw value into any outbound message, subject line or merge tag. If a phrase does not match the allow list, the contact is unsure by default and stays in the analysis funnel."
      },
      {
        "h": "ALLOW LIST, TEMPLATE",
        "b": "Match on lower-cased Treatment Interest, in this precedence order, first match wins.\n1. anti-wrinkle-concern (prescription route, consultation only, never named): anti-wrinkle, anti wrinkle, wrinkles, frown, frown lines, forehead lines, crows feet, the 11s, expression lines, looking tired, looking cross, prevention, preventative, gummy smile, masseter, jaw clenching, teeth grinding, lip flip, sweating, excessive sweating, hyperhidrosis, and any brand or toxin name a member of the public might type.\n2. membership: membership, member, monthly, subscription, skin circle, skin plan, package, join.\n3. filler: filler, dermal filler, lips, lip filler, cheeks, cheek, tear trough, under eye, undereye, temple, chin, jawline, volume, nasolabial, marionette.\n4. boosters: profhilo, skin booster, boosters, skinvive, polynucleotide, polynucleotides, sculptra, exosome, exosomes, regenerative, skin quality, hydration, glow.\n5. skin: microneedling, needling, peel, chemical peel, facial, medical facial, acne, pigmentation, melasma, rosacea, scarring, texture, pores, skincare, led, b12, dull.\n6. unsure: blank, not sure, dont know, advice, general, everything, or anything that matches none of the above."
      },
      {
        "h": "WRITE-BACK",
        "b": "For each contact, set the custom field Diary Cluster to one of anti-wrinkle-concern, filler, boosters, skin, membership or unsure, and add the matching tag cluster-anti-wrinkle-concern, cluster-filler, cluster-boosters, cluster-skin, cluster-membership or cluster-unsure. Never write the raw Treatment Interest into Diary Cluster, into any outbound field, or into any message body. Keep the raw value only in the read-only source field for the audit trail."
      },
      {
        "h": "FALLBACK",
        "b": "Anyone tagged cluster-unsure, and anyone whose Treatment Interest is empty or unmapped, is left in, or returned to, the AI Skin Analysis nurture. The analysis is the safe default: it needs no cluster, names no treatment, and lets Abi assess in person. Nobody is invited to book a named treatment on the strength of an ambiguous phrase."
      },
      {
        "h": "TRIGGER",
        "b": "Run the mapping twice. First, a one-off batch across the existing 443 warm Winchester leads and the Bedhampton base in September, so every warm contact carries a Diary Cluster before the October pre-book invites go out. Second, on every new form submit going forward, so new leads are clustered the moment they arrive. Re-run the batch after any allow-list change."
      },
      {
        "h": "CAPACITY",
        "b": "Clustering creates warm demand faster than one nurse can serve it. Do not release the cluster invites all at once. Stage them behind the capacity governor so the number invited to book in any week matches the paid slots actually open that week."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Anti-wrinkle-concern is consultation-only and never named",
    "detail": "The prescription cluster leads with the concern and books a consultation with Abi; it never names the treatment, the toxin or a brand, and never promises a result.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 65,
    "deep": [
      {
        "h": "RULE",
        "b": "Botulinum toxin is a prescription-only medicine, sold to the clinic as anti-wrinkle treatment across one, two or three areas at 190, 255 and 305, plus the lip flip, gummy smile, masseter, platysmal and hyperhidrosis uses. You cannot advertise a prescription-only medicine to the public, including to people who enquired about it. This is strict liability under the Human Medicines Regulations 2012 regulation 284 and CAP Code 12.12, so we err safe every time. A single non-compliant message to this cluster is a breach regardless of intent."
      },
      {
        "h": "WHAT WE LEAD WITH",
        "b": "Lead with the concern, never the treatment: lines, expression, prevention, looking tired, looking cross, feeling that the face looks crosser or older than the person feels. Then offer the one honest first step, a consultation with Abi, who assesses the skin and expression and advises honestly on what will and will not help. A consultation is a service, not a medicine, so it is fully bookable and promotable."
      },
      {
        "h": "BANNED IN OUTBOUND",
        "b": "To this cluster, never write: the treatment name, any toxin, any brand, the areas or their prices, the words that describe the mechanism, and never any promise or implication of a result. No before and after, no result guarantee, no time-limited treatment offer. If a sentence would still make sense with a brand name dropped in, it is too close to the line."
      },
      {
        "h": "COPY, COMPLIANT INVITE",
        "b": "Hi {{contact.first_name}}, it is Abi here. You mentioned you would like to look a little less tired and cross around the eyes and brow. The honest first step is a proper consultation with me, where I look at your skin and your expression and tell you plainly what will help and what will not, with no pressure at all. Would you like me to hold you a slot?"
      },
      {
        "h": "CONSENT",
        "b": "The private Frown Free Club carries a prescribed, individually assessed schedule and never appears in any public nurture, ad, post or broadcast. It is offered only in person, by Abi, after a consultation and prescription. Keep it entirely out of every automated message and every cluster invite."
      },
      {
        "h": "NOTE",
        "b": "This rule governs the cluster-anti-wrinkle-concern tag from the segmentation item. Every message that could reach that tag is reviewed by Abi before it goes live. When in doubt, route the person to a consultation or back to the free analysis rather than risk naming the medicine."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Build the Skin Focus segment in GHL",
    "detail": "Map the free-text Treatment Interest to a safe skin cluster via an allow list, then tag it ready for the warm pre-book invites.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 66,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The skin track absorbs analysis converts and every non-injectable enquiry, so it needs its own clean segment before any invite goes out. Build one tag, Skin Focus, filtered to Clinic Interest Winchester and Marketing Opt In true, plus a Skin Cluster field holding the matched sub-theme so later copy can speak to the right concern without ever touching the raw text."
      },
      {
        "h": "TRIGGER, allow-list mapping",
        "b": "Treatment Interest is free text typed by the public. Lower-case it and match on keywords, whole word where possible. Map to Skin Focus when the value contains any of: acne, spot, spots, breakout, breakouts, congestion, congested, blackhead, texture, rough, bumpy, uneven, pigmentation, pigment, dark mark, dark marks, sun damage, melasma, pores, pore, redness, rosacea, high colour, flushing, peel, peels, chemical peel, microneedling, micro needling, dermapen, facial, facials, glow, dull, dullness, tired skin, skincare, skin care, skincare plan, skin plan, skin health, scar, scarring, blemish, blemishes. Set Skin Cluster to the matched theme: acne, texture, pigmentation, redness, pores, peels-microneedling, facials or skin-plan."
      },
      {
        "h": "TRIGGER, what NOT to map here",
        "b": "Leave for other tracks: any anti-wrinkle, line, frown, expression, tired or cross, brand or toxin wording goes to the anti-wrinkle consultation track, never here. Filler, lip, lips, cheek, tear trough, jaw, chin, temple, Profhilo, SkinVive, skin booster, volume goes to the injectables track. If a value hits both a skin and an injectable term, tag both and let the earliest booking win."
      },
      {
        "h": "WRITE-BACK",
        "b": "Add tag Skin Focus, set Skin Cluster to the matched theme, and record the date the mapping ran. Do not overwrite an existing manual tag. Leave anything ambiguous in a Skin Focus, review queue for a human eye rather than guessing."
      },
      {
        "h": "NOTE",
        "b": "Never merge the raw Treatment Interest value into any outbound message. Speak only to the safe cluster label, exactly the same rule as Skin Audit Concerns. The public typed that field and it can contain anything."
      },
      {
        "h": "CAPACITY",
        "b": "This only sizes the audience, it books nobody, but it sets up two-wave sending. One nurse has roughly 18 to 23 paid slots a week between the capped free analyses, so the segment must be splittable in half for staggered invites."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Map clusters to the pipeline so bookings can be counted",
    "detail": "Each cluster writes to a pipeline stage and the Diary Cluster field so paid bookings can be reconciled by cluster for the dashboard.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 67,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Booking runs in Aesthetics Nurse Software, an enclosed iframe with no API and no outbound webhook, so there is no automatic booking event. Paid bookings therefore have to be counted by hand and attributed to a cluster. This item makes that reconciliation quick by giving every clustered contact a pipeline home, so David can move a card and know instantly which cluster the paid slot came from."
      },
      {
        "h": "STAGES",
        "b": "In the existing Winchester pipeline, add a Fill the diary lane with these stages: Clustered warm, Invited to book, Consultation booked, Treatment booked, Member signed, and Rebooked. A contact enters at Clustered warm carrying its Diary Cluster field, moves to Invited to book when its cluster invite is sent, and onward as David reconciles ANS by hand. The Diary Cluster field stays on the card throughout so bookings can be split six ways."
      },
      {
        "h": "WRITE-BACK",
        "b": "When David marks a slot booked and attended in the weekly reconciliation, he moves the card and confirms the Diary Cluster and, for members, the tier: Skin Circle, The Skin Plan, or Skin Plan Advanced. This is the only reliable source of paid bookings by cluster, since ANS cannot report it. Keep the raw Treatment Interest out of the card title; use the cluster label only."
      },
      {
        "h": "NOTE",
        "b": "The anti-wrinkle-concern cluster stops at Consultation booked in the diary lane. It never carries a Treatment booked value tied to a named prescription treatment in any outbound-visible field. Any treatment that follows a consultation is recorded by Abi in the clinical notes, not surfaced in marketing copy or automations."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Wire the skin-plan consultation into the pipeline",
    "detail": "Give the skin track its own visible pipeline stage so David can count the paid white-space fill by hand each week.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 68,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The paid diary between the free analyses is the white space we are filling. To manage it we need a Skin, booked stage in the pipeline, separate from the free-analysis flow, so at a glance we can see how many paid skin slots and skin-plan consultations are pledged for opening fortnight."
      },
      {
        "h": "TRIGGER",
        "b": "A Skin Focus contact books a skin appointment or a skin-plan consultation, or replies YES to a warm invite. Because the treatments here are not prescription-only, the skin-plan consultation and every treatment can be booked and promoted freely, unlike the anti-wrinkle track."
      },
      {
        "h": "WRITE-BACK",
        "b": "Move the opportunity into Skin, booked, add tag Skin Focus Booked, stamp the booking date and the Skin Cluster sub-theme, and remove the contact from any further pre-book invite step so they are not chased for something they have already done."
      },
      {
        "h": "NOTE",
        "b": "ANS is an enclosed iframe with no booking event or webhook, so the actual booking cannot fire this automatically. David reconciles skin bookings by hand every week in the Marketing tab, the same manual method used for the analyses, and moves the stage himself. The automation only handles the YES-reply path inside GHL."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Build the expression and prevention warm segment",
    "detail": "Map anti-wrinkle enquiries to a POM-safe concern cluster, then tag and consent-gate them for the pre-book invite.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 69,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "A contact enters this segment only when all three are true: Clinic Interest = Winchester; Marketing Opt In = yes; and the free-text Treatment Interest value matches the allow-list below. Nothing else routes in. This runs in parallel with the AI Skin Analysis nurture, it does not replace it."
      },
      {
        "h": "ALLOW-LIST MAPPING (raw Treatment Interest to safe cluster)",
        "b": "Treatment Interest is free text typed by the public, so map it, never echo it. Values that map into this cluster: anti wrinkle, anti-wrinkle, antiwrinkle, wrinkles, lines, fine lines, frown, frown lines, 11s, forehead, forehead lines, crows feet, crow's feet, crows-feet, expression lines, prevention, preventative, preventive, looking tired, look tired, tired looking, look cross, looking cross, angry looking, smooth, smoothing. Match case-insensitively and trim spacing. Anything not on this list does NOT enter this track. Under no circumstances merge the raw typed value into outbound copy (same rule as Skin Audit Concerns): several of these values name or hint at a medicine, and repeating them back to the public would itself be an advert for a POM."
      },
      {
        "h": "WRITE-BACK",
        "b": "Apply the tag track-expression-prevention. Do not create or apply any tag, note or custom field that names a medicine, a toxin or a brand. The stored label describes the concern, not the treatment."
      },
      {
        "h": "CONSENT",
        "b": "Action only contacts with Marketing Opt In = yes. Where the Priority Access flag is also set, route the contact to the first-week November consultation hold ahead of the rest of the segment."
      },
      {
        "h": "CAPACITY",
        "b": "One nurse does about 30 to 35 appointments a week, of which roughly 18 to 23 are paid slots. Cap how many of this segment are actioned per week so the invites cannot promise more consultation time than Abi can honestly give. Hold a named first-week ceiling (about 8 to 10 consultations) and stop inviting once it is full."
      },
      {
        "h": "NOTE (why the field, not the value)",
        "b": "Botulinum toxin is a prescription-only medicine and cannot be advertised to the public, including to the very people who typed its name into the form. Keying on the concern cluster (not the raw value) lets us reach warm enquirers while keeping every downstream message about the concern and the consultation, never the medicine."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Segment: skin quality and regenerative interest",
    "detail": "Build the GHL segment that maps free-text Treatment Interest to the safe booster and regenerative cluster.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 70,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "These are warm leads who already named a skin-quality or regenerative want. None of it is a POM, so we can name the treatments and book them directly. This segment feeds the paid white space between the capped free analyses: consultations and first treatments booked from opening day, not 'an analysis might convert later'. It runs in parallel with the AI Skin Analysis nurture, it does not replace it."
      },
      {
        "h": "TRIGGER",
        "b": "Contact matches ALL of: Clinic Interest = Winchester; Marketing Opt In = yes; and Treatment Interest (free text) maps to the cluster on the allow list below. Priority Access = yes marks the original 443 warm leads and gets the earlier invite wave."
      },
      {
        "h": "ALLOW LIST (COPY-SAFE MAPPING)",
        "b": "Lower-case and trim Treatment Interest, then match against these tokens only: hydration, hydrated, dehydrated, dry skin, glow, glowing, radiance, dull, dullness, tired skin, tired-looking, flat skin, skin quality, texture, collagen, regenerative, regeneration, bio-remodelling, injectable moisturiser, skin booster, skin boosters, booster, profhilo, skinvive, polynucleotide, polynucleotides, PN, exosome, exosomes. A match sets the cluster. This is a safe cluster label only. NEVER merge the raw typed value into any outbound message (same rule as Skin Audit Concerns), because the public types free text."
      },
      {
        "h": "WRITE-BACK",
        "b": "On match, add tag track-boosters-regen. Do not remove any analysis-nurture tag; the two tracks co-exist. Anything that does not match the allow list is NOT added here: route it to a manual-review view for David, or to the correct named track (filler, or the concern-led anti-wrinkle consultation track). Never guess a cluster from an unrecognised value."
      },
      {
        "h": "CAPACITY",
        "b": "One nurse does about 30 to 35 appointments a week, roughly 18 to 23 of them paid. This track competes for the same paid slots as the filler and anti-wrinkle consultation tracks. Cap the invite waves to diary capacity, invite Priority Access contacts first, and hold the rest on an honest waitlist rather than over-filling week one."
      },
      {
        "h": "NOTE",
        "b": "Exosomes are applied topically after microneedling to support recovery. They are never described as injected, anywhere in this track. Nothing in this cluster is a POM, so all of it is nameable and bookable."
      }
    ]
  },
  {
    "category": "diary",
    "title": "POM guardrail card for the expression track",
    "detail": "The short checklist every message in this track must pass before it is allowed to send.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-16",
    "sortOrder": 71,
    "deep": [
      {
        "h": "NOTE (compliance, read before writing or sending anything in this track)",
        "b": "This is the highest-risk track we run, so it is worded defensively on purpose. Advertising a prescription-only medicine to the public is a strict-liability offence under the Human Medicines Regulations 2012 reg 284, and CAP Code rule 12.12 prohibits marketing that references a POM to the public. Strict liability means intent and good faith are no defence, so we err safe."
      },
      {
        "h": "THE FIVE THINGS EVERY MESSAGE MUST DO",
        "b": "1. Never name the treatment, the toxin, or any brand, in subject line, body, tags or links. 2. Never promise or imply a result (no smoother, no younger, no lasts x months). 3. Lead with the concern the person raised (lines, expression, prevention, looking tired or cross). 4. Invite a consultation with Abi, which is a service and not a POM, so it is bookable and promotable. 5. Frame the consultation as honest assessment and advice with no pressure to proceed. If a draft fails any one of these, it does not send."
      },
      {
        "h": "WHY A CONSULTATION IS SAFE TO PROMOTE",
        "b": "A consultation is a clinical conversation and assessment. Abi looks at the skin, listens, and advises honestly on what would and would not help. It is a service in its own right, priced and bookable, and it does not reference or promise any medicine. That is the entire mechanism by which this track can market at all: we sell the conversation, never the prescription."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Filler and lip segment: build the smart list",
    "detail": "Map Treatment Interest to the filler-lip cluster via an allow list, tag warm and cold, exclude POM terms.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-18",
    "sortOrder": 72,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Contact has Clinic Interest = Winchester AND Marketing Opt In = yes AND Treatment Interest (free text) matches the filler-lip allow list below. Rebuild the smart list nightly so new Meta instant-form leads flow in on their own."
      },
      {
        "h": "ALLOW LIST (map raw free text to a safe cluster, never merge the raw value into copy)",
        "b": "Match, case-insensitive contains, on: lip, lips, lip filler, filler, dermal filler, tear trough, under eye, under-eye, dark circles, eye bags, cheek, cheeks, midface, volume, definition, facial balancing, chin, jawline, temple. Map all of these to the internal cluster tag filler-lip. Outbound copy may only ever use the safe words lip filler, dermal filler, tear trough treatment, cheek and facial balancing. Same rule as Skin Audit Concerns: the public's typed words are data, never merged verbatim into a message or an ad."
      },
      {
        "h": "EXCLUDE (route elsewhere, do not add to this segment)",
        "b": "If the same free text also matches the anti-wrinkle allow list (line, lines, wrinkle, frown, forehead, crow, crows feet, anti wrinkle, sweating, hyperhidrosis, masseter, jaw slimming, teeth grinding, gummy) send it to the anti-wrinkle consultation track, not here. Note the jaw ambiguity: jawline definition or jaw filler is filler (this track), but jaw slimming, teeth grinding or masseter is a POM (anti-wrinkle track). Flag any contact whose text contains a bare jaw for a quick human read before any send."
      },
      {
        "h": "WRITE-BACK",
        "b": "Tag matched contacts win-filler-lip and split warm (Revenue Status First Payment Taken or Repeat, or First Treatment Date set, or Total Revenue greater than 0, or tag bedhampton-warm) from cold (enquired, never converted). Store the mapped cluster label in a custom field so each send picks the right variant; never store the raw free text in an outbound field."
      },
      {
        "h": "CAPACITY",
        "b": "One nurse does about 30 to 35 appointments a week, roughly 18 to 23 of them paid. Consultations from this track must fill that white space, not sit on top of the capped free analyses. Cap the warm invite sends per week so accepted bookings stay inside one diary, and hold the rest as a named waitlist rather than overfilling."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Build the membership audience in GHL",
    "detail": "Tags, a custom field and three saved segments so every membership track can fire cleanly.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-22",
    "sortOrder": 73,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Membership is the white-space filler. A member holds a pre-booked recurring diary slot, so every attended analysis and every first treatment should have a membership conversation waiting behind it. This item is the plumbing the other membership items enrol from."
      },
      {
        "h": "BUILD",
        "b": "Create tags: membership-interested, member-skin-circle, member-skin-plan, member-skin-plan-advanced, membership-offered, membership-declined. Add a custom field Membership Interest (dropdown: Skin Circle, The Skin Plan, Advanced, Not now). Build three saved smart lists: (1) attended a first paid treatment with no membership tag; (2) attended a free AI Skin Analysis with no membership tag; (3) warm leads with Marketing Opt In yes whose mapped Treatment Interest cluster is ongoing skin care and who have not booked."
      },
      {
        "h": "NOTE",
        "b": "Map Treatment Interest to the ongoing-care cluster through the allow list only (skin boosters, facials, skin plans, general skin). Never merge the raw free-text value into any outbound copy, same rule as Skin Audit Concerns."
      },
      {
        "h": "TRIGGER",
        "b": "Nothing sends from this item. It defines the audiences and fields the later membership items rely on."
      },
      {
        "h": "CAPACITY",
        "b": "One nurse does about 30 to 35 appointments a week. Members hold recurring slots, so cap active Skin Plan and Advanced members at what the diary can protect, starting at the thirty founder places, and let Skin Circle, which is one LED session a month, carry the overflow. Review before lifting any cap."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Filler consultation: booking calendar and follow-up workflow",
    "detail": "Stand up a bookable consultation service (not a POM), auto-confirm, remind, and write the outcome back to the pipeline.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 74,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "A consultation is a service, not a prescription-only medicine, so it is fully bookable and promotable. It is the honest front door for filler and lips: Abi assesses, talks through options and costs, and there is no pressure to treat on the day. Every asset in this track books toward the consultation, never toward a named treatment as a guaranteed outcome."
      },
      {
        "h": "BUILD",
        "b": "Create a Filler and facial balancing consultation calendar in GHL, mapped only into the paid white-space slots, not the analysis slots. Auto-send a confirmation and a same-day reminder (copy lives in the message items below). On booking, move the opportunity to a Consultation booked stage; on attendance, to Consultation attended; wire a no-show path and a rebook path."
      },
      {
        "h": "WRITE-BACK",
        "b": "Stamp Priority Access on anyone who books from a warm invite so they keep their place if the diary fills. Record the consultation outcome (proceeding, thinking it over, or not suitable) as an opportunity note so nurture softens or stops accordingly and no one is chased after a no."
      },
      {
        "h": "CONSENT",
        "b": "No before-and-after or client photos in any asset without written consent on file; any clinical photos Abi takes stay in the record and are never used in marketing. No result guarantees anywhere in the booking flow or the reminders."
      },
      {
        "h": "CAPACITY",
        "b": "Because this track can create more demand than one nurse can serve, keep the consultation calendar's daily cap conservative for the opening fortnight and let David widen it only once the real diary shape is known."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Capacity governor and honest waitlist",
    "detail": "Cap the engine to about 30 to 35 appointments a week; when paid slots are full, warm invites pause and overflow goes to an honest waitlist, not an overbooked diary.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-05",
    "sortOrder": 75,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The engine can create warm demand faster than one nurse can serve it, especially across two overlapping clinics in November. The governor keeps the promise honest: we fill the white space, we do not oversell it. The weekly ceiling is about 30 to 35 appointments, of which about 12 are free analyses and 18 to 23 are paid slots. Invites are released to match the paid slots genuinely open that week, not the size of the list."
      },
      {
        "h": "MECHANISM",
        "b": "Each week David sets a paid-slot budget from the diary. Cluster invites and membership offers are released up to that budget only. When the paid slots for a week are full, pause the outbound invites for that week and switch new interest to the waitlist message below. Stagger founding onboarding across weeks rather than booking all forty founding clients into November at once. State clearly which days Abi is at Winchester and which at Bedhampton during the November move, so nobody is offered a slot on a day the nurse is at the other site."
      },
      {
        "h": "COPY, WAITLIST MESSAGE",
        "b": "Hi {{contact.first_name}}, it is Abi. I am so pleased you want to come in. I am one nurse and this week is full, so rather than rush you I would rather hold you the first proper slot that opens. May I add you to my personal waitlist and message you the moment one comes free? You will be near the front."
      },
      {
        "h": "NOTE",
        "b": "The waitlist is genuine scarcity, not a tactic: never invite more people than can actually be seen. Flag to the owners that a second pair of hands should be in place before January, when founding onboarding, memberships and rebookings all compound on top of new demand."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Fire the membership offer after a first treatment",
    "detail": "A GHL workflow that waits two days after an attended first treatment, then sends the invite.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-06",
    "sortOrder": 76,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Enrol when an opportunity reaches Treatment Attended (or a First Treatment Date is set) AND Clinic Interest is Winchester AND Marketing Opt In is yes AND the tag membership-offered is absent. Do not enrol anyone already tagged member-skin-plan or member-skin-plan-advanced."
      },
      {
        "h": "STRATEGY",
        "b": "The best moment to offer a plan is just after a good first result, when the client can feel the difference and wants to protect it. The workflow waits two days so the message lands once the skin has settled, not on the drive home."
      },
      {
        "h": "WRITE-BACK",
        "b": "On send, add the tag membership-offered. If the client replies yes or books, add the matching member tag and set Membership Interest. If there is no reply after seven days, send one gentle WhatsApp nudge, then stop and leave them in the ordinary nurture."
      },
      {
        "h": "NOTE",
        "b": "This workflow sends the copy held in the item 'Post-treatment membership invite'. Keep the two in step: if the copy changes, only the template it points to needs editing, not the workflow."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Diary fill dashboard: David's weekly watch",
    "detail": "What David reconciles by hand every Friday: paid slots booked versus capacity, members signed, and treatment bookings by cluster.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 77,
    "deep": [
      {
        "h": "WHAT TO WATCH",
        "b": "Three numbers, every week. 1. Paid slots booked versus capacity: paid slots filled this week against the 18 to 23 available, and total appointments against the 30 to 35 ceiling. 2. Members signed: new Skin Circle, Skin Plan and Skin Plan Advanced sign-ups this week and the running recurring base. 3. Treatment bookings by cluster: paid bookings split across filler, boosters, skin and membership, with anti-wrinkle-concern shown as consultations booked, never as a named treatment."
      },
      {
        "h": "HOW",
        "b": "ANS is enclosed and cannot report any of this automatically, so the dashboard is reconciled by hand from the Winchester pipeline and the ANS diary. David moves the pipeline cards and reads the counts off the Diary Cluster field and the member tags. Log the three numbers in the Marketing tab tracker each Friday so the trend is visible week on week."
      },
      {
        "h": "FRIDAY 15-MINUTE CHECK",
        "b": "1. Count paid slots booked this week and next; compare to capacity. 2. Count members signed this week; update the running base. 3. Split paid bookings by cluster; note any cluster going quiet. 4. Check the anti-wrinkle-concern line is consultations only. 5. If paid slots are full for the coming week, confirm the capacity governor has paused invites and the waitlist is catching overflow. 6. If a cluster is under-filling the white space, flag the matching invite track to reopen next week."
      },
      {
        "h": "NOTE",
        "b": "The primary launch metric, cost per booked and attended analysis, still lives in the analysis funnel tracker. This dashboard measures the parallel goal: paid diary utilisation, the recurring member base, and where the paid bookings are coming from. Watched together they show whether the white space is filling from opening day or still waiting on slow conversions."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Warm pre-book invite: booster consultation (email)",
    "detail": "October email inviting the skin-quality segment to reserve an early Winchester appointment before general booking opens.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-13",
    "sortOrder": 78,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Sent to tag track-boosters-regen, Priority Access first. Goal is a pre-booked consultation or first treatment in the opening fortnight, filling paid white space from day one. Lead with the concern (skin quality, glow), name the non-POM treatments plainly, promise nothing, and keep it consultation-first and no-pressure."
      },
      {
        "h": "SUBJECT",
        "b": "An early skin appointment, held for you in Winchester"
      },
      {
        "h": "PREVIEW",
        "b": "The skin-quality treatments you asked about, and an honest plan first."
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nWhen you got in touch, the thing on your mind was your skin quality: that lit-from-within glow that comes and goes, or skin that looks a little tired or flat however well you look after it.\n\nThat is exactly what our skin booster and regenerative treatments are for. Rather than changing your face, they work on the skin itself, with deep hydration, better texture and a healthier bounce that builds over a few weeks.\n\nOur nurse-led clinic on Jewry Street, Winchester opens on Monday 2 November, and I would love to see you in the first fortnight. Because you reached out early, you can reserve a first appointment now, before general booking fills up.\n\nIt always starts with a proper consultation. I am Abi, an Aesthetic Nurse Prescriber, and I will look at your skin honestly and talk through what would genuinely help, whether that is Profhilo, Skinvive, polynucleotides or a course of microneedling. I only ever recommend what is right for you, and there is no pressure to go ahead on the day.\n\nReply to this email, or tap below, and I will hold a slot for you.\n\n[Reserve my first appointment]\n\nWarmly,\nAbi"
      },
      {
        "h": "CAPACITY",
        "b": "Send in a capped wave sized to the opening fortnight's paid slots. If it books out, switch the call to action to an honest waitlist rather than promising times we cannot staff with one nurse across two clinics in November."
      },
      {
        "h": "NOTE",
        "b": "No result promised, no discount, no POM named. The booking link points to the Winchester booking page, not a raw treatment menu."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Warm skin leads: pre-book a skin appointment for opening",
    "detail": "Email the Skin Focus segment inviting a skin treatment or a skin-plan consultation in Winchester's first fortnight.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-13",
    "sortOrder": 79,
    "deep": [
      {
        "h": "GOAL",
        "b": "Convert warm, self-declared skin interest straight into a paid opening-fortnight booking, from Abi's own voice, before launch week. Send to wave one of the Skin Focus segment only."
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "Your skin, a plan, and an early slot with your name on it"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hello {{contact.first_name}},\n\nWhen you got in touch, you told us your skin was on your mind. Now that our Winchester clinic is nearly ready, I wanted to write to you first.\n\nFrom opening week you can book a skin appointment at 9A Jewry Street. We start with a proper look at what your skin actually needs, then I give you a clear, honest plan. Depending on what we find, that might be microneedling, a chemical peel, one of our medical facials, or a simple skincare plan you can follow at home. There is no pressure to have anything on the day, and I will never make a promise I cannot keep. Just a real assessment and my honest advice.\n\nIf you would like one of the first appointments, reply to this email or tap the button below and I will hold a time for you.\n\nI am one nurse as we open, so the early diary is genuinely limited. First come, first booked.\n\nWarmly,\nAbi"
      },
      {
        "h": "NOTE, link",
        "b": "Button and reply both route to the skin appointment calendar in ANS. Do not personalise the copy from the raw Treatment Interest text, the concern words above are deliberately generic to the Skin Focus cluster."
      },
      {
        "h": "WRITE-BACK",
        "b": "Openers and clickers who do not book within five days drop into the WhatsApp nudge. Anyone who books is tagged Skin Focus Booked and stops receiving the sequence."
      },
      {
        "h": "CAPACITY",
        "b": "Send in two waves, not the whole segment at once, so the first-fortnight diary is not oversold by one nurse. Once weeks one and two are full, switch the button to an honest waitlist rather than a live slot."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Warm pre-book invite: booster consultation (WhatsApp)",
    "detail": "Short WhatsApp follow-up to the pre-book email for the skin-quality segment who did not book.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-16",
    "sortOrder": 80,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "WhatsApp is already connected to GHL. Sent three days after the email to segment members who have not booked. Same goal, lighter touch, easy yes. Reply handled by Abi."
      },
      {
        "h": "WHATSAPP TEMPLATE COPY",
        "b": "Hi {{contact.first_name}}, it is Abi at Abi Peters Skin Clinic. You asked about treatments for skin quality and glow. Our Winchester clinic opens on 2 November and I am holding early appointments for people who reached out first. It starts with an honest consultation, no pressure. Would you like me to reserve one for you? Reply YES and I will sort it."
      },
      {
        "h": "NOTE",
        "b": "Submit this for WhatsApp template approval before scheduling; it cannot go out until approved. Map it to the pre-book nurture step for tag track-boosters-regen. No POM, no discount, no promised result."
      },
      {
        "h": "CAPACITY",
        "b": "Only send to the same capped wave as the email. Do not widen the audience while one nurse is covering the opening fortnight."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Warm pre-book: lips and facial balancing",
    "detail": "October invite to the filler-lip warm segment to reserve a consultation in the opening fortnight.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 81,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Segment win-filler-lip, warm split, mapped cluster lip filler, dermal filler or cheek and facial balancing (not tear trough). Send in staggered daily batches from 19 October so replies stay inside one diary; hold overflow on the waitlist with Priority Access."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it is Abi from Abi Peters Skin Clinic. You got in touch about lip or dermal filler, so I wanted you to hear first: my new Winchester clinic opens on 2 November, and I am holding a few consultation times in the opening fortnight for people who enquired early. A consultation is a proper sit-down with me to talk through what you are after and whether filler is the right option for you, with no pressure to have anything done on the day. Would you like me to hold one? Reply YES and I will send you some times. Abi"
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "A consultation held for you in Winchester, {{contact.first_name}}"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nIt is Abi here. A little while ago you got in touch about lip or dermal filler, and I did not want you to miss this: my new Winchester clinic opens on 2 November, and I am setting aside a small number of consultation times in the first fortnight for the people who enquired early.\n\nI work consultation-first, always. That means we sit down together, I look at your face as a whole, I listen to what you would like to change, and I tell you honestly what I would and would not recommend. Sometimes that is filler, sometimes it is something gentler, and sometimes it is nothing at all for now. There is never any pressure to go ahead on the day.\n\nSo you can plan, lip and dermal filler starts at 180 pounds for 0.5ml and 300 pounds for 1ml, and I will always talk you through costs openly before anything is booked.\n\nWould you like me to hold a consultation for you? Just reply to this email or text me on 07849 989869 and I will send you some times.\n\nWarmly,\nAbi\nAbi Peters Skin Clinic, Winchester"
      },
      {
        "h": "CONSENT / CLAIMS",
        "b": "No before-and-after images and no promised results; the invite sells the honest consultation, not an outcome. Prices quoted are the real Winchester list: 0.5ml 180 pounds, 1ml 300 pounds."
      },
      {
        "h": "CAPACITY",
        "b": "This is the warm list most likely to book, so meter the send: a daily batch sized to the consultation slots actually available, waitlist the rest, and never let accepted YES replies exceed the opening-fortnight white space that one nurse can serve."
      }
    ]
  },
  {
    "category": "diary",
    "title": "October pre-book invite, email",
    "detail": "Warm October email to the expression segment, offering to reserve a first-week November consultation with Abi.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-20",
    "sortOrder": 82,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "These leads already told us what is on their mind, so we do not restart the funnel. We write to them once, personally, before opening, and offer to hold a first-week slot. The value is priority and Abi's honest attention, not a discount. This is one of the tracks that fills paid white space directly rather than waiting for a free analysis to convert."
      },
      {
        "h": "SUBJECT",
        "b": "A first-week appointment with Abi, held for you"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hello {{contact.first_name}},\n\nThank you for getting in touch about the lines and the expression changes you had been noticing. I am Abi, the nurse behind the new Winchester clinic, and I wanted to write to you myself before we open.\n\nWhen you enquired you mentioned you had been feeling as though you look a little tired or cross, even when you are not. That is one of the most common things people raise with me, and it is exactly the sort of thing I like to sit down and talk through properly before anyone decides on anything at all.\n\nOur doors open on 2 November. I am keeping a small number of first-week consultation appointments for the people who reached out early, and I would like to hold one for you. A consultation is simply a proper conversation. I look at your skin, I listen to what is bothering you, and I give you my honest view on what would help, what would not, and what I would happily leave alone. There is no pressure to book anything on the day.\n\nIf you would like me to reserve a first-week slot, just reply to this message or use the button below, and we will find a time that suits you.\n\nWarmly,\nAbi"
      },
      {
        "h": "CAPACITY",
        "b": "Send in tranches against the first-week ceiling, not all at once. Once the held first-week consultations are gone, switch later replies to the next available week rather than overpromising. One nurse, so the diary is the constraint we protect."
      },
      {
        "h": "NOTE",
        "b": "Copy leads entirely with the concern the lead themselves raised and invites a consultation only. It names no treatment, toxin or brand, and promises no result. The raw Treatment Interest value is never quoted back, only the safe concern language."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Membership invite for ongoing-care leads",
    "detail": "October pre-book note to warm leads who want a routine, not a one-off.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-20",
    "sortOrder": 83,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Send to saved segment 3: warm leads, Marketing Opt In yes, whose mapped Treatment Interest cluster is ongoing skin care (skin boosters, facials, skin plans, general skin). Map through the allow list only and never merge the raw Treatment Interest text into the copy."
      },
      {
        "h": "STRATEGY",
        "b": "Some people do not want a single treatment, they want someone to look after their skin over time. For them the plan is the product, offered before the doors open so a founder place is genuinely reserved."
      },
      {
        "h": "EMAIL COPY",
        "b": "Subject: A plan for your skin, {{contact.first_name}}\n\nHi {{contact.first_name}},\n\nYou got in touch about looking after your skin, and it sounds like you are after a routine rather than a one-off. That is exactly what The Skin Plan is for.\n\nIt is a monthly place kept in my diary for you: a skin treatment each month and a device rescan with written notes, so we build results steadily and you can see them. It is £115 a month, and as one of my first Winchester clients you can lock in the founder rate of £95 a month for as long as you stay. There are only thirty founder places, and they are going before we open on the first of November.\n\nIf you would like me to hold one for you, just reply and I will note your name. We will still start with a proper consultation so the plan fits your skin, never the other way round.\n\nAbi"
      },
      {
        "h": "CONSENT",
        "b": "Marketing Opt In yes only. No prescription treatment named, no result promised, a plan and a consultation only. Safe to send."
      }
    ]
  },
  {
    "category": "diary",
    "title": "October pre-book invite, WhatsApp",
    "detail": "Short October text version for enquirers who prefer a message, holding a first-week consultation.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-22",
    "sortOrder": 84,
    "deep": [
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it's Abi from the new Winchester skin clinic. Thank you for enquiring about those lines and the tired look you mentioned. We open on 2 November and I am keeping a few first-week consultations for early enquirers. Would you like me to hold one for you? It is just an honest look and my advice, with no pressure to book anything on the day. Reply YES and I will find you a time. Reply STOP to opt out."
      },
      {
        "h": "CAPACITY",
        "b": "Same first-week ceiling as the email. Text and email share one pool of held slots, so decrement both from the same count to avoid double-booking Abi."
      },
      {
        "h": "NOTE",
        "b": "Concern-led, consultation-only, no medicine named, no result promised, STOP included for opt-out compliance."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Warm pre-book: tear trough and under-eye",
    "detail": "October invite to the under-eye sub-cluster, consultation-critical, framed around looking tired rather than a promised fix.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-22",
    "sortOrder": 85,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Segment win-filler-lip, warm split, mapped cluster tear trough, dark circles or under-eye only. A separate send from the lips invite because the under-eye is an advanced assessment: not everyone is suitable, so the copy leans harder on the honest consultation."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it is Abi from Abi Peters Skin Clinic. You asked about the under-eye area, tired eyes or dark circles. My Winchester clinic opens on 2 November and I am holding a few consultation times early on. The under-eye is one area where a proper assessment really matters, because tear trough treatment suits some people and not others, and I would rather tell you honestly than book you in regardless. Shall I hold a consultation for you? Reply YES for times. Abi"
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "About those tired-looking eyes, {{contact.first_name}}"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nIt is Abi. You got in touch about the under-eye area, whether that was dark circles, a little hollowing, or just looking tired when you feel perfectly fine. My new Winchester clinic opens on 2 November, and I am keeping some consultation times free in the opening fortnight for early enquirers like you.\n\nI want to be straight with you about the under-eye, because it is the area I am most careful with. Tear trough treatment can help some people and is not right for others, and the only way to know is to look properly, in person. So the first step is always a consultation: I assess the area, explain what is realistic, and tell you honestly if I do not think it is the right route for you. No pressure, and nothing done on the day unless you are certain.\n\nSo you can plan, a tear trough treatment is 430 pounds, and we would only ever get there after that honest conversation.\n\nWould you like me to hold a consultation for you? Reply here or text 07849 989869 and I will send some times.\n\nWarmly,\nAbi\nAbi Peters Skin Clinic, Winchester"
      },
      {
        "h": "CONSENT / CLAIMS",
        "b": "No promised outcome and no before-and-after; suitability is explicitly framed as uncertain until assessed in person. The price stated is the real Winchester tear trough price, 430 pounds."
      },
      {
        "h": "NOTE",
        "b": "If a contact mapped here only on a bare dark circles or tired term that could equally be a skincare concern, it is fine for this consultation to conclude in a skin plan instead. Record the real outcome so the parallel nurture follows the genuine need."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Skin leads WhatsApp nudge for an early slot",
    "detail": "Gently nudge Skin Focus leads who did not act on the email, with a ready-to-submit WhatsApp template.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-22",
    "sortOrder": 86,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Tag Skin Focus, did not open or click the 13 October invite within five days, Marketing Opt In true. Send WhatsApp. David builds and fires it, the words are Abi's."
      },
      {
        "h": "WHATSAPP TEMPLATE, ready to submit, marketing category",
        "b": "Hi {{contact.first_name}}, it is Abi from Abi Peters Skin Clinic. Our Winchester clinic opens on 2 November and I am holding a few early skin appointments for the people who enquired first. If you would still like a proper look at your skin and an honest plan, reply YES and I will send you a time. No pressure at all."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Abi Peters Skin Clinic: hi {{contact.first_name}}, we open in Winchester on 2 Nov and I am holding a few early skin appointments. Reply YES for a time, or STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "A YES reply moves the opportunity to Skin, booked once a time is agreed, tags Skin Focus Booked, and ends the nudge. No reply after this step leaves the contact in the from-opening nurture, it does not chase them again before launch."
      },
      {
        "h": "CAPACITY",
        "b": "This reaches the leads most likely to fill a slot, so watch the diary as replies land. Once the opening fortnight is full, change the ask from a time to the waitlist wording, still one nurse only."
      }
    ]
  },
  {
    "category": "diary",
    "title": "From-opening consultation invite, email",
    "detail": "Opening-week email to the expression segment inviting a consultation with Abi now the doors are open.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 87,
    "deep": [
      {
        "h": "SUBJECT",
        "b": "We are open, and there is a chair here for you"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hello {{contact.first_name}},\n\nWe are officially open in Winchester, and I have not forgotten that you got in touch about the expression lines and that slightly tired look that had been on your mind.\n\nIf it is still something you would like to do something about, the best first step is a consultation with me. We sit down together, I assess your skin and the way it moves when you talk and smile, and I tell you honestly what I think will help, what will not, and what I would leave well alone. Some people leave with a plan. Some leave reassured that they need very little. Both are completely fine, and there is never any pressure either way.\n\nIf you would like to come in, reply to this message or book a consultation using the link below, and I will look after you from there.\n\nWarmly,\nAbi"
      },
      {
        "h": "CAPACITY",
        "b": "Runs across 2 to 9 November alongside the analysis nurture. Keep an eye on the paid diary daily. If consultation slots fill, pause the send rather than let replies wait, because a slow or apologetic reply undoes the warmth of the invite."
      },
      {
        "h": "NOTE",
        "b": "Opens on the concern the lead raised, invites a consultation, names no treatment, toxin or brand, and makes no promise of outcome. Explicitly offers reassurance and a no as valid outcomes, which keeps it advice-led rather than sales-led."
      }
    ]
  },
  {
    "category": "diary",
    "title": "From opening: doors are open, book your consultation",
    "detail": "Opening-day message to any filler-lip contact not yet booked, warm and cold, honest and no-pressure.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 88,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Segment win-filler-lip, anyone without a Consultation booked stage. Sends on opening day, 2 November. Suppress anyone who already replied YES or booked from the October warm invite."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, Abi here: my Winchester clinic is officially open. You enquired about lip or dermal filler a while back, so if the timing is better now, I would love to see you for a consultation. No pressure, just an honest chat about whether it is right for you. Text me on 07849 989869 or reply YES and I will send some times. Abi"
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "We are open in Winchester, {{contact.first_name}}"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nIt is Abi, with a quick and happy update: my new Winchester clinic is now open.\n\nYou got in touch a while ago about lip or dermal filler. Life gets busy and timing is everything, so if now suits you better, the door is open. The first step is always a relaxed consultation with me: I look at the whole picture, listen to what you would like, and give you my honest view, including when the answer is not to treat. You are never committed to anything on the day.\n\nIf you would like to come in, just reply to this email or text me on 07849 989869 and I will find you a time that works.\n\nWarmly,\nAbi\nAbi Peters Skin Clinic, Winchester"
      },
      {
        "h": "CAPACITY",
        "b": "The opening-week diary is tight and shared with the free analyses, so release these invitations in daily batches and route accepted bookings into the paid white-space slots only, waitlisting once the fortnight fills."
      },
      {
        "h": "CONSENT / CLAIMS",
        "b": "No result claims and no imagery; the ask is the consultation, and the honest no-pressure framing is the whole point."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Opening day: booster appointment ready (email)",
    "detail": "2 November email telling the skin-quality segment the Winchester clinic is open and their appointment is ready to book.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 89,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "First from-opening touch to tag track-boosters-regen. Converts the warm intent into a booked consultation or first treatment now that the clinic is live. Names the non-POM treatments plainly, stays consultation-first."
      },
      {
        "h": "SUBJECT",
        "b": "We are open in Winchester, and your skin appointment is ready"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nWe are open. Our nurse-led skin clinic on Jewry Street, Winchester welcomed its first clients today, and the appointment you were thinking about, for skin quality and glow, is ready to book.\n\nIf dull, dehydrated or tired-looking skin is what you want to work on, this is where we start. Skin boosters and regenerative treatments, such as Profhilo, Skinvive and polynucleotides, hydrate and improve the skin from within and build over a few weeks into a natural, healthy glow. For texture and firmness, microneedling, with exosomes applied afterwards to support recovery, is another route we might take.\n\nEverything begins with a consultation with me. I will assess your skin, talk you through the options honestly, and we decide together, if at all. No pressure, ever.\n\n[Book my consultation]\n\nI look forward to seeing you on Jewry Street.\n\nAbi"
      },
      {
        "h": "CAPACITY",
        "b": "This lands the same week as the free-analysis launch, so paid slots are tight. Keep an honest waitlist ready and stagger bookings across the fortnight rather than promising same-week times we cannot staff."
      },
      {
        "h": "NOTE",
        "b": "Exosomes described as applied afterwards to support recovery, never injected. No result guaranteed, no discount, no POM named."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Opening week: the skin menu is live in Winchester",
    "detail": "From-opening nurture email to the Skin Focus segment, tying the free November analysis to a bookable paid skin appointment.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 90,
    "deep": [
      {
        "h": "GOAL",
        "b": "On opening day, turn warm skin interest into booked paid appointments, and use the free AI Skin Analysis, free to everyone in November, as the reason to come in now rather than later."
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "We are open. Your skin appointment is ready to book"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hello {{contact.first_name}},\n\nWe are open. From today you can book your skin appointment at 9A Jewry Street, Winchester.\n\nYou told us your skin was on your mind, so here is exactly what that first visit looks like. We start with a proper assessment, including a complimentary AI Skin Analysis all through November, then I talk you through what would genuinely help. That might be microneedling, a chemical peel, one of our medical facials, or a skincare plan to follow at home. You decide what happens next, and there is never any pressure.\n\nBook here: {link}\n\nThe opening diary is limited to what one nurse can do well, so if your first choice of time has gone, ask me to add you to the waitlist and I will fit you in as soon as I can.\n\nSee you soon,\nAbi"
      },
      {
        "h": "NOTE",
        "b": "The complimentary analysis is the free hero asset and it is what makes this paid booking easy to say yes to. Keep the two joined all month: every skin appointment opens with the analysis. Still no result guarantees, and no client faces or before and after in any follow-up without written consent."
      },
      {
        "h": "CAPACITY",
        "b": "This lands on launch day alongside the general opening sends, so it will pull hard. Hold back wave two of the Skin Focus segment by a few days, and move to the waitlist the moment weeks one and two fill."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Post-treatment membership invite",
    "detail": "The message that turns a happy first treatment into a booked monthly slot.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 91,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Lead with the plan and the protected slot, never a saving. A member is booked in before they leave, which is the recurring slot that fills the white space between the capped free analyses."
      },
      {
        "h": "EMAIL COPY",
        "b": "Subject: Keeping your results going, {{contact.first_name}}\n\nHi {{contact.first_name}},\n\nIt was lovely to look after you. Skin does best with a little and often rather than one big push, so the clients who see the steadiest results are usually the ones on a plan.\n\nThe Skin Plan is a monthly place in my diary kept just for you: one skin treatment each month, plus a device rescan with written notes so we can both see how your skin is actually changing. It is £115 a month, and as one of my first Winchester clients you can lock in the founder rate of £95 a month for as long as you stay. There are only thirty founder places.\n\nIf you would like a little more, Skin Plan Advanced at £185 a month adds a deeper quarterly session. And if you simply want to keep your glow ticking over, Skin Circle at £19 a month gives you a monthly LED session and member pricing on your skincare.\n\nNo pressure at all. Have a read, and reply here or text me and I will hold your place.\n\nAbi"
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, it was lovely to look after you. If you would like to keep your results going, The Skin Plan holds you a monthly slot with me plus a skin rescan, founder rate £95 a month for my first thirty Winchester clients. Happy to hold you a place, no pressure. Just reply here. Abi"
      },
      {
        "h": "CONSENT",
        "b": "Send only to contacts with Marketing Opt In yes. The copy names no prescription treatment and promises no result. It offers a plan and a place, which are services, so it is safe to send."
      }
    ]
  },
  {
    "category": "diary",
    "title": "In-clinic membership conversation",
    "detail": "What Abi says at the end of a first treatment or analysis to offer the plan in person.",
    "channel": "found",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 92,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The strongest sign-ups happen in the room, not by email. The email and WhatsApp are the safety net for anyone Abi did not get to in person. Offer it warmly, once, and let them decide."
      },
      {
        "h": "SCRIPT",
        "b": "At the end of the appointment, while writing notes: 'Your skin has responded really well. The clients who keep this going tend to do it with a plan rather than booking in fits and starts. I keep a monthly slot for plan clients, so you would have a set time with me each month and I rescan your skin so we can both see it changing. It is £115 a month, and because you are one of my first Winchester clients I can hold the founder rate of £95 for you, there are only thirty of those. Would you like me to keep one for you?' If they hesitate: 'No pressure at all, have a think. Shall I pop a place on hold for a week so you do not miss the founder rate?'"
      },
      {
        "h": "WRITE-BACK",
        "b": "If they say yes in clinic, David sets up the GoCardless plan and tags the contact member-skin-plan. If they want to think it over, tag membership-offered so the follow-up email does not repeat the ask cold."
      },
      {
        "h": "NOTE",
        "b": "This is the public ladder only. The private Frown Free Club and any prescription-only treatment stay out of this conversation entirely."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Opening-week post: why I consult before any filler",
    "detail": "Consultation-first education post for opening week, names filler and lips plainly, no before-and-after.",
    "channel": "social",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-04",
    "sortOrder": 93,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "A public, POM-safe post that names filler and lips plainly and sells the honest consultation, not a result. It reinforces the same message the warm and opening nurtures carry, so the paid track and the social feed say one thing. Runs in the Wednesday human slot in opening week."
      },
      {
        "h": "CAPTION COPY",
        "b": "Here is something I say to almost everyone who comes in about lip or dermal filler: let us have a proper conversation first.\n\nA consultation with me is not a sales pitch. I look at your whole face, I listen to what is bothering you, and I tell you honestly what I would recommend, which is sometimes filler, sometimes something gentler, and sometimes nothing at all for now. You never have to decide anything on the day.\n\nMy new Winchester clinic is open, and a consultation is the first step for filler, lips, cheeks and the under-eye area. If you have been thinking about it, come and talk it through with no pressure.\n\nDrop me a message or call 07849 989869. Abi x"
      },
      {
        "h": "CONSENT / CLAIMS",
        "b": "No before-and-after and no client images unless written consent is on file; no promised outcomes. The post leads with the concern and the consultation, and names only non-POM treatments (filler, lips, cheeks, under-eye)."
      },
      {
        "h": "CAPACITY",
        "b": "If the post drives more consultation requests than the opening-fortnight white space holds, David waitlists with Priority Access rather than overbooking Abi's single-nurse diary."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Opening week: booster appointment (WhatsApp)",
    "detail": "Opening-week WhatsApp nudge for the skin-quality segment who have not yet booked.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-04",
    "sortOrder": 94,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Second from-opening touch, WhatsApp, to segment members not yet booked. Warm, direct, easy to reply. Abi handles the thread and finds a time."
      },
      {
        "h": "WHATSAPP TEMPLATE COPY",
        "b": "Hi {{contact.first_name}}, Abi here. We are now open in Winchester on Jewry Street. Your appointment for skin quality and glow is ready whenever you are. It starts with an honest consultation, with no pressure to book anything on the day. Shall I find you a time this fortnight? Reply and I will help."
      },
      {
        "h": "NOTE",
        "b": "Use an approved WhatsApp template. No POM, no discount, no promised result. Map to the from-opening nurture step for tag track-boosters-regen."
      },
      {
        "h": "CAPACITY",
        "b": "Send in line with remaining paid slots for the fortnight. If full, offer the waitlist rather than an appointment we cannot honour."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Post: the skin treatments now open in Winchester",
    "detail": "Wednesday treatment post naming the non-POM skin menu plainly, one call to action to book a skin appointment.",
    "channel": "social",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-04",
    "sortOrder": 95,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Organic support for the skin track in launch week. These treatments are not prescription-only, so name them plainly and openly, unlike anything in the anti-wrinkle track. Hook first, one call to action, local hashtags in the first comment."
      },
      {
        "h": "CAPTION COPY",
        "b": "Your skin, looked at properly.\n\nNow open at 9A Jewry Street, Winchester. If your skin has been on your mind, breakouts, texture, dullness, pigmentation or redness, come in for a proper assessment and an honest plan. Depending on what your skin needs, that could be microneedling, a chemical peel, one of our medical facials, or a simple routine to follow at home. Every visit this month starts with a complimentary AI Skin Analysis.\n\nNo pressure, no promises I cannot keep, just a nurse led look and clear advice.\n\nTap the link to book, or send me a message.\n\nAbi"
      },
      {
        "h": "FIRST COMMENT, hashtags",
        "b": "#WinchesterSkinClinic #WinchesterFacials #HampshireSkin #Winchester #SkinHealth #JewryStreet"
      },
      {
        "h": "SHOT LIST",
        "b": "Treatment room, the analysis machine, Abi to camera talking about the first visit. Warm, calm, unhurried, no salesy energy."
      },
      {
        "h": "CONSENT",
        "b": "No client faces and no before and after without written consent. Use Abi, the room and the machine only unless a signed consent is on file."
      },
      {
        "h": "CAPACITY",
        "b": "Organic reach is small and warm, so this is a light demand source. If it does pull, point overflow to the waitlist rather than opening more of one nurse's diary."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Membership as the next step after an analysis",
    "detail": "For clients who came for the free analysis: offer the plan, not just a single treatment.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-04",
    "sortOrder": 96,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Enrol from segment 2: attended a free AI Skin Analysis, no membership tag, Marketing Opt In yes. Sends the day after the analysis, alongside and not instead of the normal analysis nurture."
      },
      {
        "h": "STRATEGY",
        "b": "The analysis is capped at about twelve a week and makes no money, so its job is to open a door. For anyone whose scan showed things worth working on over time, the honest next step is a plan, not a single appointment. This runs in parallel with the analysis nurture and simply adds the membership door."
      },
      {
        "h": "EMAIL COPY",
        "b": "Subject: What your scan showed us, {{contact.first_name}}\n\nHi {{contact.first_name}},\n\nThank you for coming in for your skin analysis. The things your scan picked up are the kind that respond best to steady care over a few months rather than one appointment, so I wanted to mention the plan built for exactly that.\n\nThe Skin Plan keeps you a monthly slot with me: one skin treatment a month and a device rescan with written notes, so at each visit we can both see what your skin is actually doing. It is £115 a month, with a founder rate of £95 for my first thirty Winchester clients.\n\nIf a full plan is more than you want right now, Skin Circle at £19 a month keeps things ticking over with a monthly LED session and member pricing on your skincare, a gentle way to stay in a routine.\n\nNo rush and no pressure. If you would like me to hold a place, just reply.\n\nAbi"
      },
      {
        "h": "CONSENT",
        "b": "Marketing Opt In yes only. Describes what the scan flagged in general terms, names no prescription treatment and promises no result. Safe to send."
      }
    ]
  },
  {
    "category": "diary",
    "title": "From-opening consultation nudge, WhatsApp",
    "detail": "Gentle opening-week text to segment members who have not yet replied, offering a consultation time.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-06",
    "sortOrder": 97,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Send only to expression-segment contacts who received the 2 November email, are still Marketing Opt In = yes, and have not replied or booked. One nudge only, then leave them in the standing nurture."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, Abi here at the new Winchester clinic. We are open, and I still have a couple of consultation times this week if you would like to talk through those lines you mentioned. No pressure, just an honest look and my advice. Reply YES for a time. Reply STOP to opt out."
      },
      {
        "h": "CAPACITY",
        "b": "Only send if there are genuinely consultation times left in the week. If the diary is full, hold this message rather than offer time that does not exist."
      },
      {
        "h": "NOTE",
        "b": "Concern-led, consultation-only, no medicine named, no result promised, single nudge, STOP for opt-out. If they do not respond, they stay in the parallel analysis and skin nurture, they are not chased again on this track."
      }
    ]
  },
  {
    "category": "diary",
    "title": "From opening: gentle second touch",
    "detail": "Soft single follow-up to filler-lip contacts who have not replied, with an easy opt-down.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-06",
    "sortOrder": 98,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Segment win-filler-lip, no reply and no booking after the 2 November message. One gentle follow-up only, then stop. Honour any opt-down immediately."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, just a soft nudge from Abi: no rush at all, but if you would still like to talk through lip or dermal filler, my Winchester consultations are open and I am happy to hold you a time. If now is not right, no worries and I will leave you be. Just let me know either way. Abi"
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "No rush, {{contact.first_name}}, whenever you are ready"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nA gentle follow-up, and genuinely no pressure. I know an enquiry from a while back does not always mean the time is right now, and that is completely fine.\n\nIf you would still like to talk through lip or dermal filler, my Winchester consultations are open and I would be glad to hold you a time. A consultation is just an honest conversation with me about whether it is the right thing for you, nothing more until you are ready.\n\nAnd if now is not the moment, that is absolutely fine too. Just reply and say so and I will not keep nudging. You can always come back when it suits.\n\nWarmly,\nAbi\nAbi Peters Skin Clinic, Winchester"
      },
      {
        "h": "NOTE",
        "b": "This is the last touch in the paid filler-lip track. After it, contacts fall back to the general analysis nurture that runs in parallel; they are not chased again on filler specifically."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Turn skin bookings into a monthly Skin Plan",
    "detail": "Invite opening-week skin clients into a membership to pre-book recurring slots and fill the paid white space.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-06",
    "sortOrder": 99,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "A membership is a pre-booked recurring slot, the single best way to fill the white space between the free analyses and to keep a skin client past a single treatment. Offer it at the end of a first skin appointment and by this email to everyone who booked skin in opening week. David sets up the recurring billing and slot, Abi is the voice and makes the recommendation."
      },
      {
        "h": "EMAIL SUBJECT",
        "b": "The simplest way to keep your skin moving in the right direction"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hello {{contact.first_name}},\n\nIt has been lovely to see your skin getting the attention it deserves. If you would like to keep it going, a membership is the easiest way, and it holds a regular slot in the diary just for you.\n\nSkin Circle, 19 a month: one LED session each month, plus member pricing on your skincare. Cancel any time. The easy first step.\n\nThe Skin Plan, founder rate 95 a month held for a full twelve months, 115 after that: a monthly skin treatment we choose together, plus a rescan on the analysis machine with written notes, so you can actually see your skin change month by month.\n\nThe Skin Plan Advanced, 185 a month: everything in The Skin Plan, with a microneedling or exosome session every quarter.\n\nThere is no lock in beyond the month you are in, and I will only ever suggest the level that genuinely suits your skin and your budget. Reply and tell me which sounds right, and I will set it up.\n\nWarmly,\nAbi"
      },
      {
        "h": "SCRIPT, in-clinic ask",
        "b": "If you enjoyed today and want to keep it up, the easiest way is our Skin Circle at 19 a month, one LED session and member pricing on your skincare. If you would like a proper plan, The Skin Plan holds you a monthly treatment and a rescan for 95 a month as a founder, held for a year. No rush at all, have a think, and I can set it up before you leave or drop you a note."
      },
      {
        "h": "CAPACITY",
        "b": "Members hold recurring slots, so cap founder Skin Plan and Skin Plan Advanced places to protect the single-nurse diary and track them against the 18 to 23 weekly paid appointments. Once the recurring diary is full, pause the monthly-treatment tiers and keep only Skin Circle open, as its LED session is quick and light on nurse time. This is exactly the retention that lets a second skin-focused clinician be justified before January."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Skin Circle as the easy yes",
    "detail": "A GBP 19 monthly on-ramp so no warm lead leaves empty-handed.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-06",
    "sortOrder": 100,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Not everyone will commit to a full monthly treatment plan, and that is fine. Skin Circle at £19 is the easy yes: a monthly LED session brings them back through the door every month, which is a booked slot and a habit, and many step up to The Skin Plan later. It keeps the relationship rather than losing the lead to nothing."
      },
      {
        "h": "TRIGGER",
        "b": "Offer Skin Circle to anyone tagged membership-offered who declined The Skin Plan, and to direct Skin Circle enquirers. On sign-up David sets the GoCardless plan and tags member-skin-circle."
      },
      {
        "h": "WHATSAPP COPY",
        "b": "Hi {{contact.first_name}}, no problem at all if a full plan is not right just now. Skin Circle is a gentler option at £19 a month: a monthly LED session to keep your skin ticking over, plus member pricing on your skincare, and you can stop any time. Would you like me to set it up? Abi"
      },
      {
        "h": "CAPACITY",
        "b": "Skin Circle is one LED session a month, light on nurse time, so it can safely carry more members than the treatment plans. It is the right home for overflow demand that the capped analyses and the thirty founder plan places cannot absorb."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Opening week nurture: what good skin quality means (email)",
    "detail": "Educational from-opening email for the skin-quality segment who have not booked, explaining the regenerative options honestly.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-07",
    "sortOrder": 101,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Third from-opening touch, for non-bookers. No hard sell. Teaches what skin boosters and regenerative treatments actually do, sets honest expectations (builds over weeks, best after a short course), and invites a consultation. Keeps the segment warm without pressure."
      },
      {
        "h": "SUBJECT",
        "b": "What good skin quality actually means, and how we build it"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nA quick note, and no hard sell.\n\nWhen people tell me they want their glow back, they usually mean skin that looks hydrated, even and awake, rather than anything dramatic. That is the whole idea behind skin boosters and regenerative treatments.\n\nThey are not fillers and they do not change your shape. Profhilo and Skinvive spread soft hydration through the skin for bounce and light. Polynucleotides support the skin's own repair and quality over a course. Microneedling, sometimes finished with exosomes applied to the surface to aid recovery, works on texture and fine lines. Results build over two to four weeks and are usually best after a short course.\n\nThe honest part is that the right choice depends entirely on your skin, which is why we always start with a consultation and never a menu. If you would like me to take a look, I am now seeing clients in Winchester.\n\n[Book a consultation]\n\nAbi"
      },
      {
        "h": "NOTE",
        "b": "Exosomes applied to the surface, never injected. Results framed as building over weeks and varying between people, never guaranteed. No POM, no discount."
      },
      {
        "h": "CAPACITY",
        "b": "This is a soft nurture, not a push, so it is safe to send to the whole non-booked segment. Bookings still land on the honest waitlist once the fortnight's paid slots are full."
      }
    ]
  },
  {
    "category": "diary",
    "title": "Next step: The Skin Plan for booster clients (email)",
    "detail": "Membership email offering booster and regenerative clients a pre-booked recurring monthly slot as their next step.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-11-08",
    "dayDate": "2026-11-09",
    "sortOrder": 102,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "A membership is a pre-booked recurring slot, so it is the single best way to fill the paid white space and retain. Sent to booster-track contacts who have booked or attended a first appointment, positioning consistency, not a one-off, as the way to hold skin quality. Public, no POM, promotable freely."
      },
      {
        "h": "SUBJECT",
        "b": "The simplest way to keep your skin at its best"
      },
      {
        "h": "EMAIL COPY",
        "b": "Hi {{contact.first_name}},\n\nIf skin quality is your goal, the thing that makes the biggest difference is not a single treatment, it is consistency.\n\nThat is what The Skin Plan is for. It is our monthly membership for people who want to look after their skin properly over time:\n\n- A skin treatment every month, chosen for where your skin is that month\n- A device rescan with written notes, so we can see the change rather than guess at it\n- Priority booking and member pricing\n\nThe Skin Plan is 115 pounds a month in Winchester, and as a founding member you can hold the founder rate of 95 pounds a month. If you would like a lighter option, Skin Circle is 19 pounds a month, with a monthly LED session and a standing member saving on your skincare. There is also Skin Plan Advanced at 185 pounds a month, which adds a quarterly microneedling or exosome session for skin that needs a little more.\n\nNo lock-in, and you can cancel any time. We can set it up at your appointment, or reply here and I will explain how it would work for your skin.\n\nAbi"
      },
      {
        "h": "CAPACITY",
        "b": "Memberships book a recurring slot, so each one permanently reserves diary time. Onboard founding members in a staggered way so the monthly slots stay serviceable by one nurse; flag to David when recurring commitments start crowding out new-client capacity."
      },
      {
        "h": "NOTE",
        "b": "Public and no POM. No percentage figure is quoted in the copy, member benefits are stated as founder pricing and a standing member saving. The private Frown Free Club is never mentioned here. Founder rate held for 12 months per the launch terms."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Decision 1: cut cold prospecting from £19.34 to £8 a day",
    "detail": "Reclassify the live prospecting ad set as evergreen diary fill, not founding acquisition.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 103,
    "deep": [
      {
        "h": "DECISION",
        "b": "Deadline Friday 4 September. Ad set 120252011075130558 runs at about £19.34 a day. Today to 1 November is 61 days, about £1,180 more spend at a CPL that moved from £3.16 lifetime to £5.64 over the last seven days. That is another 200 or so leads against a cap of 40."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Cut to £8 a day from Monday 7 September and reclassify it. It stops being justified by the founding 40 and is justified instead by evergreen diary fill from 3 November, target about 40 leads a month. Releases about £615."
      },
      {
        "h": "NOTE",
        "b": "Keep or pause is the owner's call, but it must be a decision, not a default."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Baseline audit of the 395: segment engaged, contactable, cold",
    "detail": "Audit contactability and consent across the 395 to target real two-way conversations.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-07",
    "sortOrder": 104,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Forty from 395 is 10.1 per cent conversion on a warm, opted-in list with WhatsApp connected. Very achievable and it is the entire business case. £210 of Meta will not fix a conversation problem, so conversations get specified first."
      },
      {
        "h": "STEPS",
        "b": "Baseline audit in the week of 7 September: of the 395, (1) how many ever contacted, (2) how many replied, (3) how many have a working phone and WhatsApp consent. Then segment into engaged, contactable, cold."
      },
      {
        "h": "NOTE",
        "b": "Target a real two way conversation with 120 of the 395. Forty bookings from 120 is a 33 per cent close."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Finding 1: no single warm audience can carry the ad set, build a union",
    "detail": "Every warm asset is below Meta's floor alone, so the primary audience is a union led by a GHL customer list.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-07",
    "sortOrder": 105,
    "deep": [
      {
        "h": "NOTE",
        "b": "Delivery status: 25% Video View (120216553243880558) 8,900 to 10,500 ACTIVE; 365 Day Instagram (120216553251130558) 3,600 to 4,300 ACTIVE; 365 Day Facebook (120216553252930558) 2,700 to 3,100 ACTIVE; 30 Day Facebook at floor ACTIVE. Lead Form Open With Submission (120235722805390558), Lead Form Open Nil Submission (120235722764790558), Website 180 Day (120220204216300558) and 180 Day Website (120216553250160558) are all at or below 1,000 INACTIVE. 25 lookalikes below floor INACTIVE."
      },
      {
        "h": "STRATEGY",
        "b": "\"Approximately 1,000\" is Meta's floor reading, not a count. Every warm asset is too small to deliver alone, which forces a union structure and makes the union size a prerequisite. No lookalikes in this campaign; all 25 are prospecting tools built Jan and Mar 2025 with seeds below floor."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Finding 2: lead form audiences are perishable, use a GHL upload",
    "detail": "Meta caps lead form audiences at 90 days, so the durable copy of the 395 must come from GHL.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-07",
    "sortOrder": 106,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Meta caps lead form engagement audiences at 90 days retention. The July leads begin dropping in September and are largely gone by mid October."
      },
      {
        "h": "RECOMMENDATION",
        "b": "The durable copy of the 395 is in GHL, so the primary audience must be a customer list uploaded from GHL, not the platform lead form audience."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Decision 2: what \"founding\" actually buys (priority window)",
    "detail": "Make the founding exclusive a priority booking window from 26 October, not the free analysis.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-11",
    "sortOrder": 107,
    "deep": [
      {
        "h": "DECISION",
        "b": "Deadline Friday 11 September. At present the founding benefit and the general November offer are the same thing, a complimentary AI Skin Analysis. That is not an exclusive, and advertising it as one is a misleading exclusivity claim."
      },
      {
        "h": "RECOMMENDATION",
        "b": "The founding exclusive is a priority booking window. The founding list chooses appointments from Monday 26 October. Booking opens to everyone else Monday 2 November. Genuinely exclusive, costs nothing, honest. The complimentary analysis stays available to everyone booking before end November."
      },
      {
        "h": "NOTE",
        "b": "If no priority window is granted, \"founding\" and \"40\" come out of the ad copy and this becomes a straightforward opening announcement."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Decision 3: capacity numbers (analysis length, weekly cap, Winchester share)",
    "detail": "Lock analysis length, weekly free-analysis cap and whether 30 to 35 slots are Winchester only.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-11",
    "sortOrder": 108,
    "deep": [
      {
        "h": "DECISION",
        "b": "Deadline Friday 11 September. Forty founding clients each get a complimentary analysis; nothing currently caps how many more are given away before 30 November. Three numbers are needed."
      },
      {
        "h": "CAPACITY",
        "b": "How long is an analysis appointment: 30 min against a 60 min standard slot means 12 analyses a week consume about 6 of 30 to 35 weekly slots (17 to 20 per cent, affordable); a full 60 minutes is 34 to 40 per cent, not affordable. Recommendation: 30 minute analysis blocks."
      },
      {
        "h": "RECOMMENDATION",
        "b": "How many complimentary analyses a week and when: 12 a week in three fixed blocks of four, diarised in advance, founding clients first claim through November. Is 30 to 35 a week Winchester only or shared with Bedhampton: Bedhampton still trades to end October; if shared, the Winchester share must be stated before any ad runs."
      },
      {
        "h": "NOTE",
        "b": "Founding scheduling window Monday 2 to Friday 27 November: at 12 a week that is 48 slots for 40 people, fits with slack."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "GHL: add Booked and Attended stages, stop nurture on Booked",
    "detail": "Extend the Winchester pipeline so a Booked card halts nurture and Attended anchors treatment data.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-18",
    "sortOrder": 109,
    "deep": [
      {
        "h": "STEPS",
        "b": "The Winchester pipeline ends at Later or No Reply today. (1) Add Booked and Attended stages. (2) Moving a card to Booked stops the nurture immediately. (3) The Attended stage lets First Treatment Date, Value and Revenue Status hang off it."
      },
      {
        "h": "WRITE-BACK",
        "b": "This replaces a suppression list. Bookings complete inside the ANS iframe with no completion event, no API and no thank-you URL, so the pipeline move is the only closed loop. Do not build the iframe focus detection hack."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Build the retargeting campaign shell and objective",
    "detail": "Create the Traffic campaign optimised for Landing Page Views, lifetime budget at ad set level.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 110,
    "deep": [
      {
        "h": "NOTE",
        "b": "Name: APA | Winchester | Founding Retargeting | October 2026."
      },
      {
        "h": "STRATEGY",
        "b": "Objective Traffic, optimised for Landing Page Views. Not Leads (they already gave details). Not conversion optimisation on the Lead pixel event (it needs about 50 events a week and the retargeting slice would sit permanently learning-limited). Landing Page View, not Link Click."
      },
      {
        "h": "BUDGET",
        "b": "Buying auction, lifetime budget at ad set level, Advantage campaign budget OFF. Attribution 7 day click 1 day view. Flight Monday 12 October to Sunday 1 November inclusive, 21 days, ends the day before opening. Nothing runs before 12 October."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Audience Step 1: export the founding list from GHL",
    "detail": "Export only the Winchester Founding List pipeline with marketing opt-in, correct columns.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 111,
    "deep": [
      {
        "h": "STEPS",
        "b": "Filter pipeline is APA | Winchester Founding List and Marketing Opt-In = yes. Do not export all opted-in contacts. Columns: email, phone, first name, last name, city, postcode, country."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Audience Step 2: confirm legal basis, keep the audience name generic",
    "detail": "Confirm the privacy notice covers matched advertising audiences before uploading.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 112,
    "deep": [
      {
        "h": "CONSENT",
        "b": "Confirm legal basis before uploading. Confirm the privacy notice covers matched advertising audiences."
      },
      {
        "h": "NOTE",
        "b": "Keep the audience name generic: never name a treatment or skin concern in a Meta audience name."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Audience Step 3: upload the customer list to Meta",
    "detail": "Upload the exported list as a customer audience and read the matched size.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 113,
    "deep": [
      {
        "h": "STEPS",
        "b": "Upload as APA | Winchester Founding List | Oct 2026 by Friday 25 September. Read the matched size."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Audience Step 4: size the full union in the ad set builder",
    "detail": "Add the four platform audiences to the customer list and read the union size.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 114,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "Read the size of the full union in the ad set builder with the four platform audiences added: the customer list, Lead Form Open With Submission (120235722805390558), Lead Form Open Nil Submission (120235722764790558), Website 180 Day (120220204216300558) and 180 Day Website (120216553250160558). Expect 600 to 1,500."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Audience Step 5: branch on the union size",
    "detail": "Build as specified if union 1,000 or more, else add three engager audiences and rename.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 115,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "Union 1,000 or more: build as specified. Union under 1,000: the ad set will not deliver, so add 25% Video View (120216553243880558), 365 Day Instagram (120216553251130558) and 365 Day Facebook (120216553252930558), then rename to Winchester | 25 Mile Radius | 25 to 65 | Warm Plus Engagers."
      },
      {
        "h": "NOTE",
        "b": "Do not publish and hope. Budget set at 10p per person once the union is sized."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Configure the retargeting ad set (Warm First Party)",
    "detail": "Widen geo to 25 miles, ages 25 to 65+, Advantage audience OFF, no detailed targeting.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 116,
    "deep": [
      {
        "h": "TARGETING",
        "b": "Ad set: Winchester | 25 Mile Radius | 25 to 65 | Warm First Party. Geo Winchester Jewry Street 25 mile radius, living in or recently in. Widen from 12 miles and drop the Chandler's Ford, Eastleigh, Southampton exclusions (those are prospecting economics; a warm hand-raiser from Eastleigh is qualified). Age 25 to 65+, all genders. Detailed targeting none. Exclusions none."
      },
      {
        "h": "NOTE",
        "b": "Advantage audience OFF, use \"switch to original audience options\" (the single most common way a retargeting campaign silently becomes prospecting). Verify after publish: estimated size close to your measured union, low thousands; if hundreds of thousands, expansion is still on."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Set placements: Facebook and Instagram only",
    "detail": "Manual placements, all positions, deselect Audience Network and Messenger.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 117,
    "deep": [
      {
        "h": "NOTE",
        "b": "Placements manual, Facebook and Instagram only, all positions. Deselect Audience Network and Messenger."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Set the lifetime budget: 10p per person, capped at £210",
    "detail": "Lifetime budget sized at 10p per person in the audience, hard cap £210.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-25",
    "sortOrder": 118,
    "deep": [
      {
        "h": "BUDGET",
        "b": "Lifetime = 10p per person in the audience, capped at £210 (union 1,200 = £120; 1,600 = £160; 2,000 = £200; 2,100+ = £210 cap). Use lifetime not daily."
      },
      {
        "h": "NOTE",
        "b": "CPM sensitivity £18 to £30, decided in advance; if high, accept lower reach, do not raise the budget."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Tracking: UTM tag and the closing WhatsApp question",
    "detail": "No suppression list; UTM to /founding/ plus one closing question on the confirmation.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-08",
    "sortOrder": 119,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "No suppression list (excluding 40 booked from a 1,500 pool at 50 to 70 per cent match with 24 to 48 hour lag suppresses about 1 per cent of impressions, about £2, not worth six upload cycles). Bookings complete inside the ANS iframe with no completion event, so the pipeline Booked and Attended stages replace it. Do not build the iframe focus detection hack."
      },
      {
        "h": "NOTE",
        "b": "UTM tagging does work: the site captures utm_source, utm_medium, utm_campaign, utm_content, utm_term into a first party ap_attr cookie for 90 days and merges into every GHL form post. Use the canonical www domain."
      },
      {
        "h": "COPY UTM URL",
        "b": "https://www.abipetersskinclinic.co.uk/founding/?utm_source=facebook&utm_medium=paid_social&utm_campaign=winchester_founding_retargeting&utm_content={{ad.name}}&utm_term={{adset.name}}"
      },
      {
        "h": "MESSAGE",
        "b": "Out of interest, what prompted you to book this week?"
      },
      {
        "h": "NOTE",
        "b": "Add that one closing question to the first WhatsApp confirmation, free text, one line."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Decision 4: confirm £50 as the Winchester list price",
    "detail": "Publish £50 as the Winchester list price before 9 Oct or remove the price line from both ads.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-09",
    "sortOrder": 120,
    "deep": [
      {
        "h": "DECISION",
        "b": "Deadline Friday 9 October. prices.json records £50 as a Bedhampton guide price and notes Winchester \"may differ\". A \"normally £50\" claim needs a price the service has genuinely been sold at."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Confirm £50 as the published Winchester list price before 9 October. Ad copy uses \"It is £50 on our price list\", supportable once the list says so."
      },
      {
        "h": "NOTE",
        "b": "If not confirmed, the price reference comes out of both ads."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Companion change: add exclusions to the prospecting ad set",
    "detail": "Exclude owned audiences from the live prospecting ad set so the two campaigns do not bid against each other.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-09",
    "sortOrder": 121,
    "deep": [
      {
        "h": "STEPS",
        "b": "By Friday 9 October, add exclusions to prospecting ad set 120252011075130558: exclude Lead Form Open With Submission, Website 180 Day and the new APA | Winchester Founding List | Oct 2026 list."
      },
      {
        "h": "NOTE",
        "b": "This stops paying prospecting rates to re-collect owned contacts and prevents the two campaigns bidding against each other from 12 Oct. Expect CPM and CPL to rise slightly."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Companion change: restore the pixel mid-funnel signal (not a prerequisite)",
    "detail": "Add a ViewContent event on /founding/ and /prices/ when there is time; do not repoint ads at /prices/.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-09",
    "sortOrder": 122,
    "deep": [
      {
        "h": "STEPS",
        "b": "When there is time, add a ViewContent event on /founding/ and /prices/. Not a prerequisite: LPV optimisation runs off PageView, which already fires."
      },
      {
        "h": "NOTE",
        "b": "Do not repoint either ad at /prices/ or any anti-wrinkle consultation page. Meta and the ASA treat the landing page as part of the ad, and the price list carries POM framing that is fine organically and wrong as a paid destination."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Hard stop: pause the campaign when the 40th place books",
    "detail": "The moment the 40th founding place is booked, pause the campaign the same day.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 123,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "The moment the 40th place is booked, pause the campaign. The daily 09:00 diary check is the only place the count exists and is the trigger for this stop rule."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Ad A1: founding list re-opener (live 12 to 25 Oct)",
    "detail": "Static image ad to /founding/, CTA Sign Up, leads on the priority booking window.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 124,
    "deep": [
      {
        "h": "NOTE",
        "b": "Live 12 to 25 October. Destination /founding/. CTA Sign Up."
      },
      {
        "h": "AD COPY PRIMARY TEXT",
        "b": "Abi Peters Skin Clinic opens on Jewry Street in Winchester on Monday 2 November. The founding list is the first 40 clients. Joining it means you choose your appointment from Monday 26 October, a week before booking opens to everyone else. It is one nurse and a small diary, so 40 is a real limit rather than a marketing one. Every new client starts with an AI Skin Analysis with Abi. It is £50 on our price list and it is complimentary for anyone booking before the end of November. You will leave with an honest view of your skin, a clear sense of what is worth doing and what is not, and a plan you are free to take away and think about. No pressure to book anything on the day. That has never been how Abi works."
      },
      {
        "h": "AD COPY HEADLINE",
        "b": "Winchester opens Monday 2 November."
      },
      {
        "h": "AD COPY DESCRIPTION",
        "b": "Founding list, first 40 clients."
      },
      {
        "h": "NOTE",
        "b": "One single image ad in three crops (4:5 feeds, 1:1 fallback, 9:16 Stories/Reels). Shot list: Abi in the Winchester treatment room, natural light, unhurried; the Jewry Street frontage; the treatment room empty and calm. No before and after, needles, injections, annotated faces or stock models. On-image text minimal (\"Winchester. Opening 2 November.\"), never the price or the number 40. Built and submitted by Thursday 8 October, scheduled start Monday 12 October."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Announcement email 1 to all 395",
    "detail": "GHL email: Winchester opens 2 Nov, founding list chooses from 26 Oct.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 125,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Announcement: Winchester opens 2 November, founding list chooses from 26 October. Email to all 395 via a GHL workflow."
      },
      {
        "h": "NOTE",
        "b": "Sent Mon 12 Oct, the same day the campaign goes live and the daily 09:00 diary check begins."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Daily 09:00 diary check from 12 Oct",
    "detail": "Each morning: open the ANS diary, move new bookings to Booked, write down founding places left.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 126,
    "deep": [
      {
        "h": "STEPS",
        "b": "Daily 09:00 from 12 October: Abi opens the ANS diary, moves new bookings to Booked in GHL, and writes down the founding places remaining."
      },
      {
        "h": "NOTE",
        "b": "Five minute habit. It is the only place the count exists and the trigger for every stop rule."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "WhatsApp to all consented leads (shorter)",
    "detail": "Same announcement, shorter, WhatsApp to everyone with consent.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-14",
    "sortOrder": 127,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Same message as email 1 but shorter. WhatsApp to all leads with consent."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Frequency rules and the single headroom raise",
    "detail": "Check frequency at day 7 and day 14, cut budget if it runs hot, raise once only under strict conditions.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 128,
    "deep": [
      {
        "h": "NOTE",
        "b": "Frequency is controlled structurally by the lifetime budget (you cannot set a frequency cap on Traffic). Check the Frequency column Mon 19 Oct and Mon 26 Oct."
      },
      {
        "h": "STEPS",
        "b": "(1) If rolling 7 day frequency exceeds 3.0, cut remaining budget by a third. (2) If it also has outbound CTR below 1.0 per cent, cut by half and coast. (3) Headroom rule: at the day 7 check Monday 19 October, raise the lifetime budget once to the £210 cap only if fewer than 18 founding places booked AND rolling frequency under 3.0. Run continuously, no dayparting."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Email 2 to non-openers (different subject)",
    "detail": "Second email, different subject line, to non-openers only.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 129,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Second email with a different subject, sent to non-openers only."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Success metrics: platform ratios and the one number that matters",
    "detail": "Track reach, frequency, CPM, CTR and cost per LPV, but 40 places filled by 1 Nov is the only real target.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 130,
    "deep": [
      {
        "h": "NOTE",
        "b": "Platform ratios (primary): reach as a share of the matched union 60 to 85 per cent (investigate under 50); total frequency over 21 days 3.3 to 5.6 (over 6.5); rolling 7 day frequency 1.1 to 2.0 (over 3.0); CPM £18 to £30 (over £40 sustained); outbound CTR 2.0 to 4.0 per cent (under 1.0); LPV 95 to 360 (fewer than 80); cost per LPV £0.55 to £2.00 (over £2.50); LPV a day at least 5 (under 3)."
      },
      {
        "h": "STRATEGY",
        "b": "Business metrics live in GHL: 40 founding places filled by Sunday 1 November is the only number that matters. Founding to paid conversion target 60 per cent book a paid treatment within 30 days. Media cost per founding client: 40 from 395 leads at £1,249 is £31.23; adding £210 retargeting takes it to about £36; if prospecting runs on it rises to about £66. Break even: total media £1,459 across 40 needs more than about £37 of gross margin each, a low bar."
      },
      {
        "h": "DECISION",
        "b": "Stop and escalate rules: 40 filled before 1 Nov, pause same day; fewer than 18 at Mon 19 Oct, apply the headroom rule and add phone calls early; fewer than 25 at Mon 26 Oct, the problem is follow up not media, do not raise budget; CPM over £40 sustained, cut remaining budget by a third; if the complimentary analysis blocks fill up, stop advertising the free analysis."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "WhatsApp reminder to non-responders",
    "detail": "Short reminder by WhatsApp to everyone who has not responded.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-21",
    "sortOrder": 131,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Short reminder to non-responders, sent by WhatsApp."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Ad A2: founding diary open (swap in 26 Oct to 1 Nov)",
    "detail": "Swap creative to Book Now once the founding booking route is genuinely live on /founding/.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 132,
    "deep": [
      {
        "h": "NOTE",
        "b": "Live 26 October to 1 November. Swap in only if the founding booking route is genuinely live on /founding/. CTA Book Now."
      },
      {
        "h": "AD COPY PRIMARY TEXT",
        "b": "Abi Peters Skin Clinic opens on Jewry Street in Winchester on Monday 2 November, and the founding diary is open now. Founding clients are the first 40 through the door. It is one nurse and a small diary, so 40 is a real limit rather than a marketing one. Booking opens to everyone else on 2 November. Every new client starts with an AI Skin Analysis with Abi. It is £50 on our price list and it is complimentary for anyone booking before the end of November. You will leave with an honest view of your skin, a clear sense of what is worth doing and what is not, and a plan you are free to take away and think about. No pressure to book anything on the day. That has never been how Abi works."
      },
      {
        "h": "AD COPY HEADLINE",
        "b": "The founding diary is open."
      },
      {
        "h": "AD COPY DESCRIPTION",
        "b": "First 40 clients, one nurse, one small diary."
      },
      {
        "h": "NOTE",
        "b": "Same single image in three crops as A1. One version live at a time."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Founding booking opens: link to everyone engaged",
    "detail": "Send the booking link to everyone engaged by email and WhatsApp as the priority window opens.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 133,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Founding booking opens. Send the booking link to everyone engaged, by email and WhatsApp."
      },
      {
        "h": "NOTE",
        "b": "Also the day Ad A2 swaps in and the day 14 check runs."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Abi phones the most engaged non-bookers",
    "detail": "Ten calls a day to engaged non-bookers, about 30 minutes a day, 27 to 30 Oct.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-27",
    "sortOrder": 134,
    "deep": [
      {
        "h": "STEPS",
        "b": "Tuesday 27 to Friday 30 October: Abi phones the most engaged non-bookers, 10 a day, about 30 minutes a day."
      },
      {
        "h": "NOTE",
        "b": "If fewer than 18 booked at the Mon 19 Oct check, add these phone calls early."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "General booking opens: email and social",
    "detail": "On launch day, open general booking with an email to all and an organic social post.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-02",
    "sortOrder": 135,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "General booking opens. Announce by email and social on launch day, Monday 2 November."
      }
    ]
  },
  {
    "category": "retarget",
    "title": "Phase 2: Diary Fill campaign and Ad B from 3 Nov",
    "detail": "Post-launch engager campaign to /book-consultation/, £105 lifetime, founding messaging retired.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-11-01",
    "dayDate": "2026-11-03",
    "sortOrder": 136,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Engager audiences belong from 3 November, not before. Campaign APA | Winchester | Diary Fill | November 2026, ad set Winchester | 12 Mile Radius | 28 to 65 | Social Engagers. Audience 25% Video View (120216553243880558) + 365 Day Instagram (120216553251130558) + 365 Day Facebook (120216553252930558), exclude the phase 1 union. Geo Winchester 12 mile radius home plus recent, keeping the Chandler's Ford, Eastleigh, Southampton exclusions."
      },
      {
        "h": "BUDGET",
        "b": "£105 lifetime, 3 to 30 November, about £3.50 a day. A presence, not a diary-filling machine."
      },
      {
        "h": "AD COPY PRIMARY TEXT",
        "b": "A nurse led skin clinic has opened on Jewry Street in Winchester. Abi Peters is an aesthetic nurse. The way she works is unhurried: a proper consultation first, a clear explanation of what might help your skin and what is not worth doing, and no push towards anything you are not sure about. Every new client starts with an AI Skin Analysis. It takes clinical images of your skin across several light spectra, and Abi talks you through the results herself. If you have been curious about aesthetics but cautious about where to go, this is a sensible place to start. You leave with information, not a commitment."
      },
      {
        "h": "AD COPY HEADLINE",
        "b": "Nurse led skin clinic, Winchester."
      },
      {
        "h": "AD COPY DESCRIPTION",
        "b": "Open now on Jewry Street."
      },
      {
        "h": "NOTE",
        "b": "Destination /book-consultation/, CTA Book Now. This copy does not push the complimentary analysis (November free blocks are committed to the founding 40). Founding messaging retires entirely once the 40 are in."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Read first: the pool is saturated, not the creative",
    "detail": "Lead volume is not the constraint; spend less than half and put the best concept where it converts.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 137,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "The three creative concepts are good. The plan around them has changed and the change matters more than the creative. 395 leads in the Winchester list, founding cap 40, one nurse 30 to 35 a week; the conversion needed is 40 out of 395, 10.1 per cent. Lead volume is not the constraint."
      },
      {
        "h": "WHY",
        "b": "If we keep spending about £19.80 a day from 15 Sep to 2 Nov that is a further £950 and about 181 leads. Cost per founding client goes from £1,249/40 = £31.23 to £2,199/40 = £54.98: same 40 clients, 76 per cent more expensive."
      },
      {
        "h": "EVIDENCE FOR SATURATION",
        "b": "Not frequency (1.96 over 7 days is unremarkable). Leads per thousand reached: lifetime 395 from 28,608 reach = 13.8 per 1,000; last 7 days 24 from 6,710 = 3.6 per 1,000. A 74 per cent collapse in conversion per person reached, and last week delivered 23 per cent of lifetime unique reach. The pool is exhausted. Day to day CPL (1 to 7 around a mean of 3.8) is ordinary variation; 27 Aug at £21.21 was the day after the bank holiday."
      },
      {
        "h": "NOTE",
        "b": "Cheaper levers considered and rejected. Widen the geo or drop the exclusions: rejected because we do not want more cold leads; it costs nothing and should be tried before another shoot if we ever do. Advantage Audience is on, with expansion_all and age_min 18, so 28 to 65 is not enforced, a possible cause of quality drift that has nothing to do with creative."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Three finished ad concepts fully specified, plus a media plan that spends less than half of current, puts the best concept in front of the people who will convert, and moves the rest to Bedhampton (the clinic that earns money and has no advertising)."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: is the Winchester room shootable by 8 September",
    "detail": "Confirm the room is fitted and shootable by 8 Sep, or everything shoots at Bedhampton.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 138,
    "deep": [
      {
        "h": "DECISION",
        "b": "Is the Winchester room fitted and shootable by 8 September? All three concepts specify it."
      },
      {
        "h": "WHY",
        "b": "This is the largest execution risk and it is only seven days away. If the room is not ready, everything shoots at Bedhampton and no copy or visual may name or imply the Winchester room."
      },
      {
        "h": "NOTE",
        "b": "Deadline 3 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: pull the last 30 days lead age breakdown",
    "detail": "If a meaningful share of leads is under 35, duplicate the ad set with Advantage Audience off and age_min 30.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 139,
    "deep": [
      {
        "h": "STEPS",
        "b": "Pull the age breakdown of the last 30 days of leads. If a meaningful share is under 35, duplicate the ad set with Advantage Audience off and age_min 30."
      },
      {
        "h": "WHY",
        "b": "Advantage Audience is on with expansion_all and age_min 18, so the 28 to 65 band is not enforced. Under-target leads may be a cause of quality drift that has nothing to do with creative."
      },
      {
        "h": "NOTE",
        "b": "Deadline 3 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: length of a complimentary analysis slot",
    "detail": "Decide how long a complimentary analysis slot runs in the diary.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 140,
    "deep": [
      {
        "h": "DECISION",
        "b": "How long is a complimentary analysis slot in the diary?"
      },
      {
        "h": "NOTE",
        "b": "Feeds the weekly capacity maths and the diarised analysis blocks. Deadline 5 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: how many free analysis slots a week and which days",
    "detail": "Decide the number of complimentary analysis slots per week and the days they sit on.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 141,
    "deep": [
      {
        "h": "DECISION",
        "b": "How many complimentary analysis slots per week and which days (for example eight across two afternoons)?"
      },
      {
        "h": "NOTE",
        "b": "Deadline 5 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: is the free analysis the gate to founding or separate",
    "detail": "Decide whether the complimentary analysis is the gate to founding status; this sets the CTA button.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 142,
    "deep": [
      {
        "h": "DECISION",
        "b": "Is the complimentary analysis the gate to founding status, or separate? This decides the CTA button: Sign Up if it is open, Apply Now only if the founding 40 is a genuine selection with a written basis."
      },
      {
        "h": "NOTE",
        "b": "Deadline 5 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Concept 1: The ten minute answer",
    "detail": "Still ad, ambiguity aversion, sells information not treatment. Shoot on the day, then hold.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 143,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Angle ambiguity aversion; sells information, not treatment."
      },
      {
        "h": "PRIMARY TEXT",
        "b": "Nothing is sold on the day. Most people can describe what they do not like about their skin. Very few have ever had a proper look at it. The AI skin analysis takes about ten minutes. A camera captures your skin, and a nurse takes you through what it picks up: texture, tone, pigment, redness, the areas that look different to how they feel. It is a consultation aid rather than a diagnosis. You leave with a clear record of your skin and an honest view on what is worth doing, here or anywhere else. We open in Winchester on Monday 2 November. The analysis will be £50 from December. It is complimentary for appointments in November. Abi is one nurse, so the number of appointments each week is limited. Add your name and we will be in touch as times become available, and we will tell you honestly if November is full."
      },
      {
        "h": "HEADLINE COPY",
        "b": "Headline: Ten minutes. An honest look. Description: Nurse-led in Winchester. CTA: Sign Up."
      },
      {
        "h": "VISUAL",
        "b": "Single still, 4:5 1080x1350 with a 9:16 crop. Abi seated at the analysis screen with her own scan on the display (removes the consent problem). Daylight from a window to camera left, overhead clinical light off, phone 1x lens never 0.5x, portrait mode off."
      },
      {
        "h": "ON-IMAGE TEXT COPY",
        "b": "Top left in the site serif: \"What is actually going on with my skin?\" then smaller: \"Ten minutes will show you what is there.\""
      },
      {
        "h": "NOTE",
        "b": "Do not include before and after, price stickers, arrows, starbursts, countdowns, stock, or legible client data. Shoot on the day if it allows (twenty minutes, room already lit) then hold; deploy when lead volume is a constraint or as a November replacement if Concept 3 fatigues."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Concept 2: The shelf",
    "detail": "Still-life ad, loss aversion on money already spent, permission to own fewer things. Shoot and hold.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 144,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Angle loss aversion on money already spent; permission to own fewer things."
      },
      {
        "h": "PRIMARY TEXT",
        "b": "Nothing is sold on the day. Most bathroom shelves hold a few half-used bottles that were bought on a guess. The AI skin analysis is ten minutes with a camera and a nurse. It gives you a record of what the camera picks up, so the next thing you buy, or do, is a considered choice rather than a hopeful one. It is a consultation aid rather than a diagnosis. Often the honest answer is fewer products, not more, and we will say so if that is what we see. We open in Winchester on Monday 2 November. The analysis will be £50 from December. It is complimentary for appointments in November. Abi is one nurse, so the number of appointments each week is limited. Add your name and we will be in touch as times become available, and we will tell you honestly if November is full."
      },
      {
        "h": "HEADLINE COPY",
        "b": "Headline: Fewer products, better chosen. Description: Ten minutes with a nurse. CTA: Sign Up."
      },
      {
        "h": "VISUAL",
        "b": "A still life, no face, 4:5 plus a flat-lay variant. Seven to nine unbranded skincare bottles in a loose cluster with one clean folded blank card set apart (never a real analysis sheet; that is health data). Single window light, camera left."
      },
      {
        "h": "ON-IMAGE TEXT COPY",
        "b": "Bottom left: \"Most of these were bought on a guess.\" then: \"Ten minutes of evidence instead of another guess.\""
      },
      {
        "h": "NOTE",
        "b": "Caution: point at the objects, not the reader; never make a woman feel inadequate (ASA). Shoot on the day (twenty minutes, room already lit) then hold; deploy when lead volume is a constraint or as a November replacement if Concept 3 fatigues."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: open the November Winchester calendar in ANS",
    "detail": "Open the November Winchester diary in ANS so interest can become a booking.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-12",
    "sortOrder": 145,
    "deep": [
      {
        "h": "STEPS",
        "b": "Open the November Winchester calendar in ANS."
      },
      {
        "h": "WHY",
        "b": "The single highest value operational change. Without a bookable diary, interest cannot convert."
      },
      {
        "h": "NOTE",
        "b": "Deadline 12 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Decision: write the nothing-sold-on-the-day rule",
    "detail": "Write down the rule for the analysis appointment: nothing sold on the day.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 146,
    "deep": [
      {
        "h": "RULE",
        "b": "Write down the rule for the analysis appointment: nothing is sold on the day. No payment, no product, no price list unless asked."
      },
      {
        "h": "NOTE",
        "b": "Complete before 15 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Build: one instant form per concept, named after its concept",
    "detail": "Duplicate the instant form once per concept and name each form after its concept for attribution.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 147,
    "deep": [
      {
        "h": "STEPS",
        "b": "Duplicate the instant form once per concept and name each form after its concept."
      },
      {
        "h": "WHY",
        "b": "The only workable attribution, since instant form leads never load the website. Reply rate per ad and booked November appointments are read from these concept-named forms."
      },
      {
        "h": "NOTE",
        "b": "Complete before 15 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Build: confirm form privacy, opt-in and WhatsApp handling",
    "detail": "Confirm each form carries a privacy notice, a marketing opt-in for email and WhatsApp.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 148,
    "deep": [
      {
        "h": "STEPS",
        "b": "Confirm the form carries a privacy notice link, a specific marketing opt-in covering email and WhatsApp."
      },
      {
        "h": "NOTE",
        "b": "Complete before 15 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Concept 3: Nothing is sold on the day (launch video)",
    "detail": "30-second vertical video in Abi's first-person voice, fear of the room. This is the launch creative, live 15 Sep.",
    "channel": "meta",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 149,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Angle fear of the room, in Abi's first-person voice. This is the proven launch creative and the only concept run cold."
      },
      {
        "h": "PRIMARY TEXT",
        "b": "Nothing is sold on the day. A lot of people put off asking about their skin because they expect to be sold something. I am Abi, a registered nurse. The AI skin analysis is ten minutes: a camera, a screen, and a straight conversation about what it picks up. It is a consultation aid rather than a diagnosis, and I will not hand you a treatment plan unless you ask me for one. Sometimes the useful answer is to change one thing at home and see me again in six months. Sometimes it is to leave things alone. You will get my honest view either way. We open in Winchester on Monday 2 November. The analysis will be £50 from December. It is complimentary for appointments in November. I am one nurse, so the number of appointments each week is limited. Add your name and I will be in touch as times become available, and I will tell you honestly if November is full."
      },
      {
        "h": "SPOKEN SCRIPT",
        "b": "Nothing is sold on the day. I am Abi, I am a registered nurse, and in November we open in Winchester. For that first month the AI skin analysis is complimentary. It takes ten minutes. A camera looks at your skin and we go through what it picks up together. It is a consultation aid, not a diagnosis. I tell you honestly what I would and would not do. Tap below and I will be in touch."
      },
      {
        "h": "HEADLINE COPY",
        "b": "Headline: Nothing is sold on the day. Description: Nurse-led. No sales pitch. CTA: Sign Up (Apply Now only if the founding 40 is a genuine selection with a written basis)."
      },
      {
        "h": "VISUAL",
        "b": "30 second vertical video, one take no cuts, native 9:16 1080x1920 with a 4:5 centre crop. Abi seated at eye level about 1.2m, rear camera, she faces the window, phone between her and the window, audio within 60cm or AirPods, head and shoulders, analysis screen out of focus behind. She looks down the lens, does not smile on the first line, no music or a low piano bed. Script is 71 words, about 32 seconds. Burnt-in captions in the bottom third; it is watched on mute."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Media: launch Concept 3 cold at £8/day from 15 Sep",
    "detail": "Concept 3 only, one ad in the existing ad set, £8 a day (about £384). Pause the incumbent, do not delete.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 150,
    "deep": [
      {
        "h": "STEPS",
        "b": "Run Concept 3 only as one ad in the existing ad set at £8 a day, 15 Sep to 2 Nov (about £384). Pause the incumbent, do not delete it."
      },
      {
        "h": "WHY",
        "b": "The purpose is not volume, it is to have the launch creative proven and the account warm for November (about 70 leads over seven weeks, more than enough on top of the 395). Do not run all three concepts against each other: each arm would get about 12 leads a week, would never resolve and never exit learning."
      },
      {
        "h": "NOTE",
        "b": "Advantage Audience is on with expansion_all and age_min 18, so watch quality; if the last 30 days skew under 35, duplicate with Advantage off and age_min 30."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Media: launch Concept 3 warm video at £3/day from 15 Sep",
    "detail": "Concept 3 video to the hand-raisers, £2 to £3 a day (about £120). The highest value media in the plan.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 151,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "Winchester lead form submitters + Website 180 day + Facebook and Instagram engagement."
      },
      {
        "h": "BUDGET",
        "b": "£2 to £3 a day, 15 Sep to 2 Nov (about £120). Objective Video Views or Reach (they already gave their details). Frequency capped 6 to 8 across the seven weeks."
      },
      {
        "h": "WHY",
        "b": "Concept 3 as video to the people who put their hand up. This is the highest value media in the plan."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Media: the money table and £422 released to Bedhampton",
    "detail": "Winchester total £528 against a £950 run rate; £422 released goes to Bedhampton.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 152,
    "deep": [
      {
        "h": "BUDGET",
        "b": "Winchester cold Concept 3 £8/day 15 Sep to 2 Nov = £384. Winchester warm Concept 3 video £3/day = £144. Winchester total £528. Current run rate if left alone £19.80/day = £950. Released £422."
      },
      {
        "h": "NOTE",
        "b": "Cost per founding client, all 40 from the existing list plus this spend, is £1,777/40 = £44.43, against £54.98 if the current run rate continues."
      },
      {
        "h": "WRITE-BACK",
        "b": "The £422 released goes to Bedhampton (open, earning, £990.31 lifetime ad spend verified in the account, currently paused so no live advertising, offer expires end October)."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Kill criteria and weekly judging for the cold ad",
    "detail": "Pause and reopen the creative decision if CPL over £12 across 10 days, or reply rate below the incumbent's.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-22",
    "sortOrder": 153,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Kill criteria for the cold ad: CPL over £12 across a rolling 10 days, or reply rate below the incumbent's. If either fires, pause and reopen the launch creative decision."
      },
      {
        "h": "STEPS",
        "b": "Judge on reply rate per ad (Replied or Interested / leads, from the concept-named forms) and booked November appointments per ad (matched by hand weekly), plus the qualitative WhatsApp replies. Read weekly from 22 September."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Review point 1: read the numbers on 29 September",
    "detail": "First scheduled review of the refreshed media plan.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-27",
    "dayDate": "2026-09-29",
    "sortOrder": 154,
    "deep": [
      {
        "h": "STEPS",
        "b": "First review point. Judge on reply rate per ad (Replied or Interested / leads, from the concept-named forms) and booked November appointments per ad (matched by hand weekly), plus the qualitative WhatsApp replies. Read weekly from 22 September."
      },
      {
        "h": "NOTE",
        "b": "Apply the kill criteria: CPL over £12 across a rolling 10 days, or reply rate below the incumbent's, pause and reopen the launch creative decision."
      }
    ]
  },
  {
    "category": "creative",
    "title": "Review point 2: read the numbers on 13 October",
    "detail": "Second scheduled review of the refreshed media plan.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-13",
    "sortOrder": 155,
    "deep": [
      {
        "h": "STEPS",
        "b": "Second review point. Judge on reply rate per ad (from the concept-named forms) and booked November appointments per ad (matched by hand weekly), plus the qualitative WhatsApp replies."
      },
      {
        "h": "NOTE",
        "b": "Apply the kill criteria: CPL over £12 across a rolling 10 days, or reply rate below the incumbent's, pause and reopen the launch creative decision."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 1: cut the live Winchester ad set to £5 a day today",
    "detail": "Ad set 120252011075130558 burns about £19.34 a day buying leads you cannot serve; drop it to £5 now.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 156,
    "deep": [
      {
        "h": "WHY",
        "b": "The live Winchester ad set 120252011075130558 spends about £19.34 a day at a CPL that moved from £3.16 lifetime to £5.64 over seven days and £9.68 on 31 Aug. Running unchanged to 2 November costs about £1,200 and buys 150 to 210 more leads against only 40 founding places."
      },
      {
        "h": "STEPS",
        "b": "1) In Ads Manager cut the ad set to £5 a day today. 2) Leave the rest of Winchester as is apart from this cut. Saves about £890, the single highest return action this week."
      },
      {
        "h": "NOTE",
        "b": "This is step 1 of the build window and also section 0's step zero: it costs nothing and saves the most."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Verified live state: account, campaign and ad IDs",
    "detail": "Record what is actually live before spending: account 1565785360704219, paused July campaign, four ads, two findings.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 157,
    "deep": [
      {
        "h": "NOTE",
        "b": "Ad account 1565785360704219. Campaign 120252260138780558 'APA | Bedhampton | Cold Consultation | July 2026' is PAUSED, OUTCOME_LEADS, £20 a day at campaign level, Advantage campaign budget ON, started 21 June 2026. Ad set 120252260138890558 is ACTIVE, effective CAMPAIGN_PAUSED."
      },
      {
        "h": "NOTE",
        "b": "Ads: Ad 1 120252260138870558 Natural Results Consultation 5,923 impressions £79.42; Ad 2 120252260138880558 Not Sure Where To Start 10,209 impressions £162.78; Ad 3 120252260138850558 Skin Quality 2,999 impressions £40.86; Ad 4 120252260138860558 Abi Reel Natural Medically Led 35,506 impressions £707.25 (the delivery winner). Campaign lifetime £990.31, 54,637 impressions, 16,456 reach, frequency 3.32, 57 leads, £17.37 per lead."
      },
      {
        "h": "DECISION",
        "b": "Finding 1: the ad set name does not describe the targeting. Named '12 Mile Radius, 25 to 65, Open Targeting' but saved targeting is Havant plus 25 mile radius, home or recent, Advantage Audience on including geographic expansion, saved minimum age 18 not 25. Havant to Jewry Street is 20.6 miles, so this ad set covered the entire live Winchester 12 mile radius and the two campaigns were bidding against each other. This is the most valuable finding, worth more than the budget decision."
      },
      {
        "h": "DECISION",
        "b": "Finding 2: the £160 lifetime figure in the brief does not match the account (£990.31). The four ads reconcile exactly, so the account figure is sound. Correct £160 before anyone reports spend upward. All forecasting uses £17.37 as the pessimistic CPL baseline."
      },
      {
        "h": "NOTE",
        "b": "The honest deadline: /bedhampton/ already states the analyser moves to Winchester on 1 November, a genuine reason for an end date. Guard it: if the analyser does not move, pull the line."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 13: work the existing 395 by phone and WhatsApp (ongoing)",
    "detail": "Start converting the leads you already own from 2 Sep; acquisition is not the constraint, conversion is.",
    "channel": "email",
    "owner": "abi",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 158,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "You hold 395 leads (448 in GHL) and 40 founding places. Lead volume is not the constraint; conversion and clinical capacity are. Work the existing list by phone and WhatsApp on an ongoing basis from 2 September, before any Bedhampton money is released."
      },
      {
        "h": "GATE",
        "b": "Release Bedhampton spend only when the 40 founding places are filled, or provably unfillable, from the 395 you already own."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 2: answer the three pre-money decisions D1, D2, D3",
    "detail": "Three owner questions gate any Bedhampton spend: trading days, speed to contact, and the deposit.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 159,
    "deep": [
      {
        "h": "DECISION",
        "b": "D1: does Bedhampton still trade after 2 November and on how many days a week? The add-on window means an analysis on 30 Oct can produce a treatment booking on 13 Nov and an appointment as late as 29 Nov. If Bedhampton closes or drops to one day, you would sell November capacity that does not exist."
      },
      {
        "h": "DECISION",
        "b": "D2: who answers a new lead and within what time? Speed to first contact is the largest single lever. One nurse with a client in the chair cannot answer in five minutes. Without a named owner and a service level the booking rate is fiction."
      },
      {
        "h": "DECISION",
        "b": "D3: do you take a £25 fully redeemable deposit at booking? Free appointments with no commitment device commonly no-show at 30 to 50 per cent. If declined, the attendance assumption drops to 60 per cent."
      },
      {
        "h": "GATE",
        "b": "Release Bedhampton spend only when the 40 founding places are filled, or provably unfillable, from the 395 you already own."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 3: vet both reused creatives frame by frame",
    "detail": "Reuse Ad 4 reel and Ad 2 hero only after confirming no result claims, medically led wording or old offer.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 160,
    "deep": [
      {
        "h": "STEPS",
        "b": "Reuse Ad 4 reel (creative 1535936224849019) and Ad 2 hero image (creative 1020123900599555). Before reuse confirm: no result claim including 'natural results'; no 'medically led' (use nurse led); no burnt-in old July offer; no before and after; no close-up problem shots. If any are present, re-edit or replace and move the 10 Sep start."
      },
      {
        "h": "NOTE",
        "b": "Landing page check: /bedhampton/ and the booking embed must carry no POM names, no before and after and no result claims for the whole run."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 4: create GHL fields and add-on tags",
    "detail": "Add fields Analysis Date and Add On Window Closes plus the four add-on lifecycle tags.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 161,
    "deep": [
      {
        "h": "STEPS",
        "b": "Create GHL fields Analysis Date and Add On Window Closes. Create tags bh-analysis-attended, bh-addon-live, bh-addon-redeemed, bh-addon-expired. These carry the add-on window mechanics in section 7."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 5: decide and create the Bedhampton pipeline",
    "detail": "Choose a new four stage Bedhampton pipeline or the existing eight stage evergreen with a source tag.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 162,
    "deep": [
      {
        "h": "DECISION",
        "b": "There is no Bedhampton pipeline today. Decide a new four stage Bedhampton pipeline or reuse the existing eight stage evergreen pipeline with a source tag, then create it in GHL. This is a prerequisite for the form mapping and test lead in step 12."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 6: submit three WhatsApp templates for approval",
    "detail": "Approval takes days, so submit the three WhatsApp templates now; do not leave this to the end.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 163,
    "deep": [
      {
        "h": "STEPS",
        "b": "Submit three WhatsApp templates for approval in GHL. Meta review and WhatsApp template approval take days, so do not leave this: it is on the critical path for the day 2, day 7 and day 12 follow ups outside the 24 hour session window."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "The offer: complimentary AI Skin Analysis, normally £50",
    "detail": "Free analysis at Bedhampton to Fri 30 Oct, add-on cleanser or SPF50 if a treatment is booked within 14 days.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 164,
    "deep": [
      {
        "h": "OFFER",
        "b": "A complimentary AI Skin Analysis, normally £50, at Bedhampton up to and including Friday 30 October 2026 (published reason true: the analyser moves to Winchester on 1 November). Nothing is sold on the day; the client leaves with a written plan. If they start a treatment from that plan and book within 14 days of their analysis, their first appointment includes a complimentary cleanser or SPF50 from the professional skincare range, chosen for their skin, worth £42 to £56. One public end date everywhere: Friday 30 October."
      },
      {
        "h": "WORDING RULES",
        "b": "No percentage anywhere. Value is a genuine usual price ('normally £50', 'worth £42 to £56', never 'up to £56'). Use 'included with your first treatment' never 'free gift with purchase'. Never 'medical grade', write 'professional skincare'. No countdown, no hurry. Internal rule never published: the add-on never attaches to a prescription treatment."
      },
      {
        "h": "PUBLIC TERMS COPY",
        "b": "One per new client. Subject to suitability at consultation. Skin treatments only."
      },
      {
        "h": "MECHANICS",
        "b": "At the analysis Abi hands the written plan with the date and 'add-on included if you book by [date plus 14]'. Booking must be within 14 days; the appointment may sit up to 30 days out. GHL on attended sets Analysis Date, computes Add On Window Closes = Analysis Date + 14, applies bh-addon-live. Follow up day 2 plan recap, day 7 check-in, day 12 last reminder by WhatsApp template and email (a business-initiated template is used outside the 24 hour window). Tag bh-addon-redeemed on the treatment, bh-addon-expired at day 15. One per client, max 30 redemptions (about £1,500 retail, about £750 cost); ring fence 30 units."
      },
      {
        "h": "EVIDENCE",
        "b": "On file before launch: dated proof the analysis has genuinely been charged at £50, dated captures of the £42 to £56 products, all prices VAT inclusive."
      },
      {
        "h": "NOTE",
        "b": "Nothing is sold on the day is absolute: no price list handed over, no product sold, no deposit for a treatment, no card machine at the analysis. The £25 booking deposit, if adopted, is taken at the point of booking the analysis and is fully redeemable."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 7: build three custom audiences",
    "detail": "Build Winchester lead form submitters, Bedhampton lead form submitters and the client list for exclusion.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 165,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "Build three custom audiences: Winchester lead form submitters, Bedhampton lead form submitters, and the client list (marketing consent only). These are used as exclusions on the cold ad set."
      },
      {
        "h": "NOTE",
        "b": "Meta caps lead form engagement audiences at 90 days retention. If so, export about 1,000 submitters from GHL and upload as a customer list instead (no retention cap, better match). Marketing consent only."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 8: build and publish the new instant form",
    "detail": "Higher-intent form, four fields, two qualifying questions, health-data consent and a diary completion link.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 166,
    "deep": [
      {
        "h": "STEPS",
        "b": "Build and publish a new instant form named 'Bedhampton | AI Skin Analysis | Sep 2026'. Published forms cannot be edited, so get it right before publishing. Fields: first name, last name, email, mobile."
      },
      {
        "h": "TEMPLATE",
        "b": "Custom question 1: What would you most like to talk about? (sun exposure and pigmentation / lines and texture / redness / breakouts and congestion / general skin health). Custom question 2: When would you like to come in? (this week / in the next two weeks / just looking for now)."
      },
      {
        "h": "CONSENT",
        "b": "Skin answers can be Article 9 health data; marketing consent alone is not an Article 9 condition. Frame as a conversation topic, add the privacy link, map the marketing consent tick to Marketing Opt-In, and add a separate explicit consent for storing what the client says about their skin."
      },
      {
        "h": "SCOPE COPY",
        "b": "This is a cosmetic skin assessment, not a medical diagnosis. If you are concerned about a mole or a change in your skin, please see your GP."
      },
      {
        "h": "COMPLETION URL COPY",
        "b": "https://abipetersskinclinic.co.uk/bedhampton/#book"
      },
      {
        "h": "NOTE",
        "b": "Completion button 'View the diary' points to the URL above with UTM including utm_content=iform_thanks."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 9: verify the page lead ads terms are accepted",
    "detail": "leadgen_tos_accepted read false but lead ads are delivering, so glance and do not block.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 167,
    "deep": [
      {
        "h": "STEPS",
        "b": "Verify the Facebook page lead ads terms are accepted. leadgen_tos_accepted false was recorded, but lead ads are delivering now (24 leads in the last 7 days on Winchester), so the reading is stale. Glance, do not block."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 10: ring fence stock for the add-on",
    "detail": "Set aside 30 units of the professional skincare add-on before ads go live.",
    "channel": "found",
    "owner": "abi",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 168,
    "deep": [
      {
        "h": "CAPACITY",
        "b": "Ring fence 30 units of the professional skincare range (cleanser or SPF50) for the add-on. One per client, max 30 redemptions, roughly £1,500 retail and about £750 cost."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Build a new campaign, do not reuse the July one",
    "detail": "Archive campaign 120252260138780558 and switch off all four ads; the spending limit makes reuse a dead end.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 169,
    "deep": [
      {
        "h": "WHY",
        "b": "Do not unpause 120252260138780558. Meta's campaign spending limit counts total spend since creation; it has spent £990.31, so a £1,400 cap leaves about £410 and delivery hard stops around 19 Sep. Archive the old campaign and switch off all four ads (they carry the old July offer)."
      },
      {
        "h": "STEPS",
        "b": "New campaign: name 'APA | Bedhampton | Skin Analysis | Sep and Oct 2026'; objective Leads; budget at ad set level, CBO OFF; campaign spending limit £800 lifetime; special ad category none; status paused until the form, audiences and both ads are approved and one test lead lands in GHL with attribution."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Ad set spec: Bedhampton | PO9 10 Miles | 30 to 60 | Cold",
    "detail": "Tight cold local ad set, PO9 10 miles, living-in home only, age 30 to 60, £15 a day, 10 Sep to 25 Oct.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 170,
    "deep": [
      {
        "h": "TARGETING",
        "b": "Name 'Bedhampton | PO9 10 Miles | 30 to 60 | Cold'. Location search PO9 radius 10 miles (or pin the clinic and 10 miles). Location type people living in this location, home only. Age 30 to 60 and set Audience Controls minimum age to 30. Advantage Audience OFF if available; turn off location expansion specifically. Detailed targeting none."
      },
      {
        "h": "EXCLUSIONS",
        "b": "Excluded locations: Isle of Wight and Winchester (city). PO9 to Jewry Street is 20.6 miles, so this closes the thin overlap band near Bishop's Waltham. Excluded audiences: Winchester lead form submitters, Bedhampton lead form submitters, and your client list (marketing consent only)."
      },
      {
        "h": "BUDGET",
        "b": "£15 a day at ad set level. Placements Advantage placements all. Optimisation Leads, instant form, highest volume, no cost cap at launch. Instant form new (published forms cannot be edited)."
      },
      {
        "h": "SCHEDULE",
        "b": "Start Thursday 10 September 2026 08:00, end Sunday 25 October 2026 23:59."
      },
      {
        "h": "NOTE",
        "b": "No paid warm ad set. The addressable warm pool after exclusions is about 500 to 2,000; message them free from GHL by WhatsApp template in week one. Below about 3,000 addressable, do not buy retargeting. Winchester stays as is apart from the section 0 budget cut."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 11: build campaign, ad set and both ads, submit for review",
    "detail": "Assemble the new campaign, ad set and Ads A and B in Ads Manager and submit; review takes 24 to 48 hours.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 171,
    "deep": [
      {
        "h": "STEPS",
        "b": "Build the new campaign, the cold ad set and both ads, and submit for review. Allow 24 to 48 hours. Keep the campaign paused until the form, audiences and both ads are approved and one test lead has landed in GHL with attribution (step 12)."
      },
      {
        "h": "NOTE",
        "b": "Build new ads, do not edit the old ones."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Ring-fence the Bedhampton week for one nurse",
    "detail": "20 to 24 slots for existing and paid clients, 4 to 6 for complimentary analyses; acquisition never eats revenue.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 172,
    "deep": [
      {
        "h": "CAPACITY",
        "b": "Ring fence the week: 20 to 24 slots for existing clients and paid treatments, 4 to 6 for complimentary analyses, the rest buffer and admin. Acquisition never eats revenue slots."
      },
      {
        "h": "NOTE",
        "b": "What these clients are: Bedhampton revenue, Google reviews before launch, and a warm base who have met Abi. They are not a Winchester founding pipeline."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 12: land one test lead and confirm GHL attribution",
    "detail": "Send a test lead end to end, confirm it maps on form id into the pipeline with full attribution.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-09",
    "sortOrder": 173,
    "deep": [
      {
        "h": "STEPS",
        "b": "Land one test lead end to end and confirm attribution in GHL. Mapping is keyed on the form id. Confirm the lead lands in the chosen Bedhampton pipeline (the new four stage, or the eight stage evergreen with a source tag) with full attribution before ads go live."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Ad A (reel): complimentary AI Skin Analysis, normally £50",
    "detail": "Reel copy reusing Ad 4 subject to vetting; CTA Book now, headline Complimentary AI Skin Analysis.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 174,
    "deep": [
      {
        "h": "AD COPY",
        "b": "Bedhampton: a £50 AI Skin Analysis, complimentary until Friday 30 October. Your skin changes quietly. Most people notice the result, not the cause. At my clinic in Bedhampton, the AI Skin Analysis gives us a proper look at your skin: the sun exposure, pigmentation, redness, texture and hydration the camera picks up. We read it together on screen, in plain English, and I write you a plan. It is complimentary here until Friday 30 October, because the analyser then moves to my new Winchester clinic. Nothing is sold to you on the day. You take the plan home and think about it. If you decide to start, and you book within 14 days of your analysis, your first treatment includes a complimentary cleanser or SPF50 from my professional skincare range, chosen for your skin, worth £42 to £56. Abi Peters, Advanced Nurse Practitioner, NMC registered. 16 years in healthcare. This is a cosmetic skin assessment, not a medical diagnosis. If you are concerned about a mole or a change in your skin, please see your GP. One per new client. Subject to suitability at consultation. Skin treatments only."
      },
      {
        "h": "HEADLINE COPY",
        "b": "Complimentary AI Skin Analysis"
      },
      {
        "h": "DESCRIPTION COPY",
        "b": "Normally £50. Bedhampton, until Friday 30 October."
      },
      {
        "h": "NOTE",
        "b": "Reuses Ad 4 reel, subject to vetting. CTA Book now (or Sign up if the diary link is not live)."
      },
      {
        "h": "COPY RULES",
        "b": "Never place prescriber status, injectable language, 'wrinkles', 'relaxing', units or brand initials in the same ad, image, caption or landing page. Hold 'I' and 'my'; keep 'we' for the moment Abi and the client read the screen together."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Ad B (image): not sure where to start?",
    "detail": "Image copy reusing Ad 2 subject to vetting; CTA Book now, headline Not sure where to start?",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 175,
    "deep": [
      {
        "h": "AD COPY",
        "b": "An AI Skin Analysis in Bedhampton, normally £50, complimentary until Friday 30 October. If you have been meaning to do something about your skin for a while and have not known where to begin, start here. We scan, we look at the results together, and I tell you honestly what is worth doing and what is not. Sometimes the answer is good skincare and patience, and I will say so. After 30 October the analyser moves to my new Winchester clinic, so that is the last date it can be done at Bedhampton. There is no selling on the day. Go away, think about it, and if you book a treatment from your plan within 14 days of your analysis, your first appointment includes a complimentary cleanser or SPF50 from my professional skincare range, chosen for your skin, worth £42 to £56. Bedhampton, a short drive from Havant, Emsworth, Waterlooville and Portsmouth. This is a cosmetic skin assessment, not a medical diagnosis. If you are concerned about a mole or a change in your skin, please see your GP. One per new client. Subject to suitability at consultation. Skin treatments only."
      },
      {
        "h": "HEADLINE COPY",
        "b": "Not sure where to start?"
      },
      {
        "h": "DESCRIPTION COPY",
        "b": "An unhurried, nurse-led look at your skin."
      },
      {
        "h": "NOTE",
        "b": "Reuses Ad 2 image, subject to vetting. CTA Book now. Book one new 20 second asset now (scan reading on screen), live 1 October."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 14: ads live Thursday 10 September 08:00",
    "detail": "Cold Bedhampton campaign goes live once approved and the test lead is confirmed.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 176,
    "deep": [
      {
        "h": "STEPS",
        "b": "Set the campaign live Thursday 10 September 2026 at 08:00, once the form, audiences and both ads are approved and one test lead has landed in GHL with attribution."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Budget in two tranches with the 1 October gate",
    "detail": "£315 committed 10 to 30 Sep, £375 gated 1 to 25 Oct; release tranche two only if cost per attended is under £55.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 177,
    "deep": [
      {
        "h": "BUDGET",
        "b": "Tranche one committed 10 Sep to 30 Sep, 21 days, £15 a day, £315. Tranche two gated 1 Oct to 25 Oct, 25 days, £15 a day, £375. Total £690 against a campaign spending limit of £800. Roughly £1,570 is freed across both campaigns once the Winchester cut is included."
      },
      {
        "h": "GATE",
        "b": "The 1 October gate is real: release tranche two only if the manually reconciled cost per attended analysis is under £55. Before tranche two, pull the actual stage counts from the 395 Winchester pipeline leads, because real observed behaviour beats an assumed rate."
      },
      {
        "h": "TARGETING",
        "b": "What £690 should produce: at £17.37 CPL, 40 leads; with the radius cut, no overlap, higher intent form and stronger offer, target £12 to £15, so 46 to 57 leads."
      },
      {
        "h": "SCENARIOS",
        "b": "Plan case with the £25 deposit: lead to booked 50 per cent, attended 75 per cent, 17 to 21 attended analyses, cost per attended £33 to £41. No deposit: attended 60 per cent, 14 to 17, £41 to £49. Downside, no deposit and weaker calling: 35 per cent booked, 60 per cent attended, 10 to 12, £58 to £69."
      },
      {
        "h": "FINANCIALS",
        "b": "Plan case: 40 per cent of 17 to 21 attended convert to 7 to 8 first treatments at about £200, so £1,400 to £1,700 first treatment revenue against £690 media plus about £190 add-on cost (£25 each) plus about £265 consumables (£35 each), roughly £1,145 cost. Acquisition is bought at close to cost and repays on the second treatment, skincare repeat and reviews. The real ceiling is the nurse: four complimentary analyses a week at 45 minutes is three hours of unpaid clinical time."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 15: message the warm Bedhampton list free from GHL",
    "detail": "Reach the warm pool by WhatsApp template free from GHL in week one; do not buy retargeting for it.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 178,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "The addressable warm pool after exclusions is about 500 to 2,000. Message them free from GHL by WhatsApp template in the week of 14 September. Below about 3,000 addressable, do not buy retargeting, so there is no paid warm ad set."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Step 16: book the new creative shoot for 1 October",
    "detail": "Book a shoot for a new 20 second asset (scan reading on screen) to go live 1 October.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 179,
    "deep": [
      {
        "h": "STEPS",
        "b": "Book the new creative shoot for 1 October. Capture one new 20 second asset showing the scan reading on screen. Target going live 1 October alongside the reused creatives."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "Measurement: ten manual minutes a day",
    "detail": "Track attended analyses (target 17 to 21) and the metric triggers; review every Friday, frequency weekly from 21 Sep.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-20",
    "dayDate": "2026-09-21",
    "sortOrder": 180,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Manual, ten minutes a day. Headline number: attended analyses at Bedhampton, target 17 to 21, minimum 14."
      },
      {
        "h": "NOTE",
        "b": "Metrics with review triggers: leads 46 to 57 (trigger under 20 by 30 Sep); CPL £12 to £15 (above £20 for five days); speed to first contact automated WhatsApp inside 60 seconds then two named human call blocks a day, three attempts across 72 hours (trigger any day with no call block); lead to booked within 72 hours 50 per cent or more (below 35); booked to attended 75 per cent with deposit, 60 without (below 55, add a two hour reminder); cost per attended analysis under £45 (above £55 at the 1 Oct gate, above £65 for two weeks); analysis to treatment within 14 days 40 per cent so 7 to 8 (below 25, the plan conversation needs work); second treatment within 90 days 40 per cent; first treatment revenue £1,400 to £1,700 against about £1,145 cost (below £1,000); add-on redemptions 7 to 9 (approaching 30, pause); new Google reviews by 31 Oct 15 (below 8 at 15 Oct); analysis slots booked out two weeks ahead is the binding constraint (pause immediately); frequency below 3.5 (check weekly from 21 Sep, refresh creative never raise budget)."
      },
      {
        "h": "DECISION",
        "b": "Stop and shift rules: cost per attended above £55 at the 1 Oct gate, do not release tranche two; above £65 for two weeks, pause and work the list; new client slots booked out two weeks ahead, pause immediately; frequency above 3.5, refresh creative not budget; review every Friday."
      },
      {
        "h": "NOTE",
        "b": "Reviews stay clean: ask every attended client on the day, never mention the offer in the same conversation, never ask only the pleased. Unfiltered and unincentivised or not at all."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "12 Oct: drop the Bedhampton ad set to £10 a day",
    "detail": "Scheduled not conditional: Abi's Winchester day cuts clinical capacity by about a fifth, so cut spend.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 181,
    "deep": [
      {
        "h": "STEPS",
        "b": "Monday 12 October, drop the ad set to £10 a day. This is scheduled, not conditional: Abi's Winchester day cuts Bedhampton clinical capacity by about a fifth, so buy fewer leads to match."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "25 Oct: stop cold acquisition",
    "detail": "Cold acquisition stops Sunday 25 Oct so the last leads still get an analysis before the deadline.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-25",
    "sortOrder": 182,
    "deep": [
      {
        "h": "STEPS",
        "b": "Cold acquisition stops Sunday 25 October so the last leads still get an analysis. The last analysis at Bedhampton is Friday 30 October."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "26 Oct: switch new Bedhampton enquiries to Winchester",
    "detail": "GHL rule routes any new Bedhampton enquiry from 26 Oct to the Winchester November offer and founding list.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-26",
    "sortOrder": 183,
    "deep": [
      {
        "h": "STEPS",
        "b": "Build the 26 October switch now. From 26 Oct a new Bedhampton enquiry cannot be promised the analysis at Bedhampton; a GHL rule routes them to the Winchester November offer and the founding list."
      }
    ]
  },
  {
    "category": "bedhampton",
    "title": "30 Oct: last analysis at Bedhampton, protect launch week",
    "detail": "Friday 30 Oct is the last Bedhampton analysis; take no new treatments into launch week beyond regulars.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-25",
    "dayDate": "2026-10-30",
    "sortOrder": 184,
    "deep": [
      {
        "h": "STEPS",
        "b": "Last analysis at Bedhampton Friday 30 October. Protect 2 to 8 November: no new Bedhampton treatments into launch week beyond regulars."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Owner decisions: the master list before anything is built",
    "detail": "One consolidated list of every distinct call the owner must make, each with its own deadline.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 185,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Acquisition is not the constraint. The list is already full: 395 leads on Meta (448 opportunities in GHL) against a founding cap of 40, served by one nurse at 30 to 35 appointments a week. Selection, conversion and capacity are the real problems, so most of what remains is decisions and build, not more ad spend. Every ad, message and build step below waits on one of these calls."
      },
      {
        "h": "DECISION GATES BY DATE",
        "b": "Wed 3 Sep: Winchester room shootable by 8 Sep; age breakdown of recent leads; does Bedhampton trade after 2 Nov and on how many days; who answers a new lead and within what time; £25 redeemable deposit or not. Fri 4 Sep: live prospecting budget (cut, pause or reclassify); reconciliation owner and daily slot. Fri 5 Sep: analysis appointment length; how many free analyses a week and what November must earn; is the free analysis the gate to founding or separate. Fri 11 Sep: what founding actually buys; how many days a week Abi is in Winchester. Fri 12 Sep: open the November Winchester calendar in ANS. Mon 15 Sep: write down the nothing-sold-on-the-day rule. Fri 9 Oct: confirm the £50 Winchester list price. Sun 12 Oct: cost the twelve-month founding price hold. Ongoing from 3 Sep: one written lawful-basis position for WhatsApp and email."
      },
      {
        "h": "NOTE",
        "b": "The retargeting Decisions 1 to 4, the creative seven decisions, the Bedhampton D1 to D3 and the nurture seven owner decisions overlap heavily. They are merged here into the genuinely distinct calls. Each is broken out as its own dated item that follows."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Locks: what must not be changed (nurture section 15)",
    "detail": "Six non-negotiable rules protecting the honest, no-pressure voice; reproduced word for word.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 186,
    "deep": [
      {
        "h": "LOCK",
        "b": "1 Scarcity attaches to diary access and to a complimentary assessment, never to a treatment. 2 No countdown device anywhere (C2's \"until Thursday evening\" and C3's \"until tomorrow evening\" are real diary holds). 3 A3 and C4 are the best messages (\"I'll leave you be\", \"I've let that time go so someone else can use it\"); nobody is ever rejected. 4 B2's \"It is not a discount and there is nothing to buy today\" and C2's \"Nothing to pay to hold it\", word for word. 5 D9's \"No pressure either way. But if you have been meaning to come in, that is the date.\" 6 The Winchester list is never asked to travel to Bedhampton."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Locks: what was cut, do not re-add (Bedhampton section 11)",
    "detail": "Rejected ideas and non-compliant claims that must not creep back into the Bedhampton build.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 187,
    "deep": [
      {
        "h": "DO NOT RE-ADD",
        "b": "reusing campaign 120252260138780558 (£990 already spent); the £7/day warm retargeting ad set £413 (pool 500 to 2,000, message from GHL free); budget of £1,367 (£690 in two tranches with a real gate); the \"founding client pipeline\" justification and its target of 10 (these are Bedhampton clients); the word \"harvest\" in campaign names and headings (reads as extractive over a shoulder); \"Bedhampton Skin Plan sign-ups at £85 target 6\" (undefined); the claim the analysis detects \"UV damage forming beneath the surface\" and \"pigmentation in its early stages\" (an early disease claim the device does not support); \"medical grade skincare\"; \"Independent Prescriber\" in the ad (reads as prescription injectables available, use NMC registered); \"Worth up to £56\" (Abi chooses, most get the lower item); \"Never prescription treatments\" in public terms (keep as internal rule only)."
      },
      {
        "h": "NOTE",
        "b": "Correct the £160 lifetime figure quoted in the brief before anyone reports spend upward: the account shows £990.31 and the four ads reconcile exactly."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Locks: the terminology that is fixed everywhere",
    "detail": "Skin audit vs skin analysis, ANS, and the full address, locked across ads, messages and the website.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 188,
    "deep": [
      {
        "h": "TERMINOLOGY",
        "b": "Skin audit = the free online form these leads completed. Skin analysis = the in-clinic £50 imaging session (pick this term everywhere including the website). Aesthetics Nurse Software (ANS), not \"Aesthetic Nurse Software\". 9A Jewry Street, Winchester, not \"Jewry Street\" alone on first mention."
      },
      {
        "h": "NOTE",
        "b": "Do not use skin audit and skin analysis interchangeably: the leads did the free online skin audit; the skin analysis is the paid in-clinic imaging session. Confirm before build: 448 in GHL vs Meta's 395 vs the plan's 443, three numbers for one list; the arithmetic assumes 448 is the true reachable figure."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: is the Winchester room fitted and shootable by 8 September",
    "detail": "All three creative concepts specify the Winchester room; this is the largest execution risk.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 189,
    "deep": [
      {
        "h": "DECISION",
        "b": "Is the Winchester room fitted and shootable by 8 September. All three creative concepts specify it. This is the largest execution risk and it is only seven days away."
      },
      {
        "h": "RECOMMENDATION",
        "b": "If it is not ready, everything shoots at Bedhampton and no copy or visual may name or imply the Winchester room. Decide by 3 September so the shoot can be planned either way."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: pull the age breakdown and enforce the age band if skewed young",
    "detail": "Advantage Audience is on with age_min 18, so the 28 to 65 band is not enforced.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 190,
    "deep": [
      {
        "h": "DECISION",
        "b": "Pull the age breakdown of the last 30 days of leads. Advantage Audience is on with expansion and age_min 18, so 28 to 65 is a suggestion, not a limit, and may be a cause of quality drift that has nothing to do with creative."
      },
      {
        "h": "RECOMMENDATION",
        "b": "If a meaningful share of recent leads is under 35, duplicate the ad set with Advantage Audience off and age_min 30."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: does Bedhampton trade after 2 November and on how many days",
    "detail": "The add-on window means a 30 Oct analysis can produce an appointment as late as 29 Nov.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 191,
    "deep": [
      {
        "h": "DECISION",
        "b": "Does Bedhampton still trade after 2 November and on how many days a week. The add-on window means an analysis on 30 October can produce a treatment booking on 13 November and an appointment as late as 29 November. If Bedhampton closes or drops to one day, you would be selling November capacity that does not exist."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Answer before any Bedhampton money is released, and name who covers Bedhampton through November. These clients are Bedhampton revenue, Google reviews and a warm base who have met Abi; they are not a Winchester founding pipeline."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: who answers a new lead and within what time",
    "detail": "Speed to first contact is the largest single lever; without a named owner the booking rate is fiction.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 192,
    "deep": [
      {
        "h": "DECISION",
        "b": "Who answers a new lead and within what time, and who answers messages 09:00 to 17:00 five days a week from the day Phase A starts. Speed to first contact is the largest single lever. One nurse with a client in the chair cannot answer in five minutes. The whole programme is about 30 hours of messaging labour before a single appointment."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Name the owner and a service level: automated WhatsApp inside 60 seconds, then two named human call blocks a day, three attempts across 72 hours. Consider VA hours. Without this the booking rate is fiction."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: take a £25 fully redeemable deposit at booking or not",
    "detail": "Free appointments with no commitment device commonly no-show at 30 to 50 per cent.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 193,
    "deep": [
      {
        "h": "DECISION",
        "b": "Do you take a £25 fully redeemable deposit at the point of booking. Free appointments with no commitment device commonly no-show at 30 to 50 per cent. If declined, the attendance assumption drops to about 60 per cent."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Take the £25 at booking, fully redeemable against treatment. It is taken when the analysis is booked, never at the analysis itself. Nothing is sold on the day stays absolute: no card machine at the analysis."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: one written lawful-basis position for WhatsApp and email",
    "detail": "Blocker B3; the whole nurture design is reply-based and PECR reg 22 applies to WhatsApp marketing as to email.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 194,
    "deep": [
      {
        "h": "DECISION",
        "b": "Write down the lawful basis once, covering WhatsApp and email, before Phase A starts. Retrieve the exact instant-form consent wording, confirm it covers direct marketing by WhatsApp and email, and record the date range. PECR reg 22 applies to WhatsApp marketing as to email, and some records predate 1 September 2026 so consent may have degraded."
      },
      {
        "h": "RECOMMENDATION",
        "b": "This is blocker B3 and it gates the whole sequence. Separately, by Friday 25 September, confirm the privacy notice covers matched advertising audiences before any customer list is uploaded to Meta, and keep every Meta audience name generic (never name a treatment or skin concern)."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: cut, pause or reclassify the live prospecting spend",
    "detail": "Ad set 120252011075130558 runs at about £19.34 a day buying leads for places that no longer exist.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 195,
    "deep": [
      {
        "h": "DECISION",
        "b": "Ad set 120252011075130558 runs at about £19.34 a day. Today to 1 November is 61 days, so about £1,180 more spend at a CPL that moved from £3.16 lifetime to £5.64 over the last seven days. That is another 200 or so leads against a cap of 40. Keep, cut or pause: it must be an active decision, not a default."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Cut to £8 a day from Monday 7 September and reclassify it. It stops being justified by the founding 40 and is justified instead by evergreen diary fill from 3 November, target about 40 leads a month. Releases about £615. (The creative doc proposes the same £8/day carrying Concept 3 as launch creative; the Bedhampton and nurture docs argue for a deeper cut to £5/day or a full pause on 2 Sep. The owner picks one, but the spend cannot keep running unchanged.)"
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: confirm the reconciliation owner and the daily slot",
    "detail": "The weekly CSV booking export and daily diary check are the only closed loop; someone must own them.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 196,
    "deep": [
      {
        "h": "DECISION",
        "b": "Confirm who owns the reconciliation and when. There is no booking API and no server-side booking event, so a weekly CSV export from the booking system, matched on email each Sunday, is the only closed loop. A daily 09:00 diary check from 12 October is the only place the founding count exists and the trigger for every stop rule."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Name the owner and a fixed daily slot. Weekly: match on email each Sunday and write back First Treatment Date, Value and Revenue Status. Daily: open the ANS diary, move new bookings to Booked in GHL, write down founding places remaining. A five minute habit."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: how long is a complimentary analysis appointment",
    "detail": "30 minutes consumes about 6 of 30 to 35 weekly slots; a full 60 minutes is not affordable.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 197,
    "deep": [
      {
        "h": "DECISION",
        "b": "How long is a complimentary analysis appointment. At 30 minutes against a 60 minute standard slot, 12 analyses a week consume about 6 of 30 to 35 weekly slots (17 to 20 per cent, affordable). At a full 60 minutes it is 34 to 40 per cent, not affordable."
      },
      {
        "h": "RECOMMENDATION",
        "b": "30 minute analysis blocks. (Bedhampton's own figure is 45 minutes for four a week, three hours of unpaid clinical time; hold Winchester tighter.)"
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: how many free analyses a week, which days, and what November must earn",
    "detail": "Nothing currently caps how many complimentary analyses are given away before 30 November.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 198,
    "deep": [
      {
        "h": "DECISION",
        "b": "How many complimentary analyses a week, on which days, and what November must earn. Forty founding clients each get a free analysis, and nothing currently caps how many more are given away before 30 November. C6, D3 and D9 offer the same free hour to the whole opted-in list, uncapped. There is no revenue number anywhere and there should be."
      },
      {
        "h": "RECOMMENDATION",
        "b": "12 a week in three fixed blocks of four, diarised in advance, founding clients first claim through November (a sensible alternative floor is 8 a week). Ring-fence the rest of the week for paid treatment and set a stated November revenue target."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: is the free analysis the gate to founding status or separate",
    "detail": "This decides the CTA button on the ad and the funnel logic.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 199,
    "deep": [
      {
        "h": "DECISION",
        "b": "Is the complimentary analysis the gate to founding status, or separate from it. This decides the CTA button on the creative (Sign Up versus Apply Now)."
      },
      {
        "h": "RECOMMENDATION",
        "b": "The complimentary analysis cannot be the scarce thing: it is available to everyone until 30 November. What is scarce is the founding benefit and the diary. Apply Now / Apply is only honest if the founding 40 is a genuine selection with a written basis; otherwise keep Sign Up."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: what \"founding\" actually buys",
    "detail": "Advertising a shared free analysis as a founding exclusive is a misleading exclusivity claim.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-11",
    "sortOrder": 200,
    "deep": [
      {
        "h": "DECISION",
        "b": "What founding actually buys. At present the founding benefit and the general November offer are the same thing, a complimentary AI Skin Analysis. That is not an exclusive, and advertising it as one is a misleading exclusivity claim."
      },
      {
        "h": "RECOMMENDATION",
        "b": "The founding exclusive is a priority booking window: the founding list chooses appointments from Monday 26 October, booking opens to everyone else Monday 2 November. Genuinely exclusive, costs nothing, honest. The complimentary analysis stays available to everyone booking before end November. If no priority window is granted, founding and 40 come out of the ad copy and this becomes a straightforward opening announcement. The founding benefit is four elements: priority booking, a complimentary skincare add-on with the first treatment, founding pricing held twelve months, and the first 40. Do not drop the add-on."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: how many days a week is Abi in Winchester",
    "detail": "30 to 35 a week is her total across both clinics; at three days the real Winchester number is nearer 18 to 21.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-11",
    "sortOrder": 201,
    "deep": [
      {
        "h": "DECISION",
        "b": "How many days a week is Abi in Winchester, and is 30 to 35 a week Winchester only or shared with Bedhampton. 30 to 35 is her total across both clinics. At three Winchester days the real Winchester number is nearer 18 to 21 a week, and the founding 40 consume half."
      },
      {
        "h": "RECOMMENDATION",
        "b": "State the Winchester share of capacity before any ad runs. It decides whether C6 and D3 go to the whole list or a throttled slice, and it fixes B2's wording (\"only so many appointments in a week\")."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: open the November Winchester calendar in ANS",
    "detail": "The single highest value operational change: interest cannot become a booking without it.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-12",
    "sortOrder": 202,
    "deep": [
      {
        "h": "DECISION",
        "b": "Open the November Winchester calendar in ANS so interest can become a booking. Described as the single highest value operational change. Nothing downstream (the held-slot messages, the founding count, the day-before reminders) can work until the diary is bookable."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Publish November Winchester availability and make it bookable by 12 September. A parallel GHL Winchester calendar holds a placeholder event at the moment a slot is accepted, giving a countable diary without an ANS API."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: write down the nothing-sold-on-the-day rule for the analysis",
    "detail": "The rule that governs every analysis appointment, set in writing before creative goes out.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 203,
    "deep": [
      {
        "h": "DECISION",
        "b": "Write down the rule for the analysis appointment before 15 September, so everyone works to the same script."
      },
      {
        "h": "RULE",
        "b": "Nothing is sold on the day: no payment, no product, no price list unless asked. The client leaves with a written plan. The £25 booking deposit, if adopted, is taken at the point of booking the analysis and is fully redeemable, never at the analysis."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: confirm £50 as the published Winchester list price",
    "detail": "A \"normally £50\" claim needs a price the service has genuinely been sold at.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-04",
    "dayDate": "2026-10-09",
    "sortOrder": 204,
    "deep": [
      {
        "h": "DECISION",
        "b": "prices.json records £50 as a Bedhampton guide price and notes Winchester \"may differ\". A price claim needs a price the service has genuinely been sold at. Confirm £50 as the published Winchester list price before 9 October."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Ad copy uses \"It is £50 on our price list\", supportable once the list says so. At Winchester the analysis has never been charged, so use forward-looking wording (\"The analysis is a £50 assessment\", \"From 1 December it is £50\"), never \"normally £50\" or \"goes back to £50\". If £50 is not confirmed, the price reference comes out of the ads entirely."
      }
    ]
  },
  {
    "category": "tail",
    "title": "Decision: cost the twelve-month founding price hold",
    "detail": "If launch prices sit below mature prices, a hold across 40 clients has a real cash number.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-10-11",
    "dayDate": "2026-10-12",
    "sortOrder": 205,
    "deep": [
      {
        "h": "DECISION",
        "b": "The founding benefit is four elements; what does the twelve-month price hold cost. If launch prices sit below mature prices, a hold across 40 clients has a cash number, and it sits close to the no-discounts rule."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Compute the cost before email B2 sends on 12 October, since B2 is where the twelve-month hold is promised in writing."
      }
    ]
  },
  {
    "category": "build",
    "title": "Build week: write every message before a single thing goes live",
    "detail": "One week now. Everything written and loaded, then it runs on a Friday check.",
    "channel": "email",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 300,
    "deep": [
      { "h": "WHY", "b": "Sixty-two days out with the list already full, the constraint is your time, not leads. If every email and WhatsApp is written and loaded now, the ten weeks to launch run on a fifteen-minute Friday check, not on you drafting a send the night before." },
      { "h": "WHAT", "b": "One build week. By Friday 13 September every message for both tracks exists in GHL, in its workflow, with its wait and its send time set. Nothing outbound is written after this week; from here it is monitoring and small edits only." },
      { "h": "RULE", "b": "British English, no percentage discounts, and no naming of any prescription-only treatment or an anti-wrinkle offer that resolves to one. Founding is a place and a price, never a discount." }
    ]
  },
  {
    "category": "build",
    "title": "Load the Winchester nurture into GHL and schedule it",
    "detail": "Every Winchester sequence built as a workflow, waits and send windows set.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 301,
    "deep": [
      { "h": "WHAT", "b": "Build every Winchester sequence as a GHL workflow: the founding selection fortnight, the autumn-or-next-year decision thread, the treatment-intent nurtures, and the membership invitations. Set each wait and send window so they fire on their own." },
      { "h": "SEQUENCES", "b": "Founding selection from the scan, the honest-diary decision series, one treatment-intent thread per interest the lead ticked, and the Skin Plan and membership invitations that fill the paying diary between the free scans." },
      { "h": "NOTE", "b": "Personalise by the interest already captured on the lead. Someone who asked about skin gets the skin thread the day we open, not a generic newsletter." }
    ]
  },
  {
    "category": "build",
    "title": "Load the Bedhampton harvest messages, warm and cold",
    "detail": "Reactivation, the fourteen-day add-on, and the follow-Abi-to-Winchester series.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 302,
    "deep": [
      { "h": "WHAT", "b": "Build the Bedhampton reactivation thread: the free-analysis invitation, the fourteen-day add-on reminder, and the follow-Abi-to-Winchester migration series for both warm and cold local leads." },
      { "h": "OFFER", "b": "Complimentary analysis at Bedhampton through October, offer closes 30 October, then the scanner moves to Winchester. Local only, within ten miles of PO9." },
      { "h": "NOTE", "b": "Warm and cold both get invited. The cold list is the cheapest audience you own; press it now while there is still a Bedhampton chair to book." }
    ]
  },
  {
    "category": "build",
    "title": "Submit every email and WhatsApp template for approval now",
    "detail": "Templates, domain and numbers need lead time. Get them verified in build week.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 303,
    "deep": [
      { "h": "WHY", "b": "Templates and any new sending domain or number need lead time to verify and warm. Submit them in build week so nothing is held in review when a send is due." },
      { "h": "WHAT", "b": "Register and verify the sends, warm the domain, and get the WhatsApp templates approved. Send yourself one test through every workflow and read it on a phone before it goes near a lead." }
    ]
  },
  {
    "category": "build",
    "title": "Batch-film six weeks of content and the three ad concepts in one session",
    "detail": "Shoot once; the feed and the ads both run for weeks without filming again.",
    "channel": "social",
    "owner": "abi",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 304,
    "deep": [
      { "h": "WHY", "b": "Filming is the thing that stalls a feed. Shoot once and the feed and the ads both run for weeks without stopping to film again." },
      { "h": "WHAT", "b": "One session: the founding story, treatment education, the room and Abi, and the three ad concepts. Cut into Reels, Stories, an email snippet and a Google profile post. Faces and before-and-afters only with written consent." },
      { "h": "NOTE", "b": "Repeat the shoot once a fortnight to top up. It is a top-up, not the growth lever; the growth lever is the loaded nurture." }
    ]
  },
  {
    "category": "build",
    "title": "Set the weekly review: every Friday, fifteen minutes, all channels",
    "detail": "One recurring check. It is the only report, and it runs the whole engine.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-05",
    "sortOrder": 305,
    "deep": [
      { "h": "WHAT", "b": "One recurring fifteen-minute review, every Friday. It is the only report. Reconcile booked-and-attended scans by hand from ANS against the ad spend, then read one number per channel." },
      { "h": "CHECKLIST", "b": "Cost per lead, founding places filled out of 40, reviews added this month, members signed, and the diary against capacity. Confirm the pre-loaded sends fired. Adjust next week's spend; write nothing new." },
      { "h": "WHY", "b": "Because everything is built up front, the week's work is checking, not producing. Fifteen minutes on a Friday keeps the whole engine honest without pulling Abi off the floor." }
    ]
  },
  {
    "category": "build",
    "title": "Queue the social calendar a fortnight ahead",
    "detail": "Always two weeks out, so the feed never waits on a free afternoon.",
    "channel": "social",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-08",
    "sortOrder": 306,
    "deep": [
      { "h": "WHAT", "b": "Queue the organic posts two weeks out at all times, so the feed never depends on a free afternoon. Three a week: Monday, Wednesday, Friday." },
      { "h": "NOTE", "b": "Repurpose, do not reinvent. Each post also becomes a Story, and the best line becomes an email snippet or a Google post." }
    ]
  },
  {
    "category": "build",
    "title": "Build the referral (introductions) mechanic: the £25 each-way credit",
    "detail": "Founding clients are your warmest, cheapest introducers. Load it now so it is live from day one.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-09",
    "sortOrder": 308,
    "deep": [
      { "h": "WHAT", "b": "Set up the referral in GHL: a unique share link or code per client, and a 25 pound clinic credit to BOTH the introducer and the introduced person, released only when the introduced person attends and pays for their first treatment. Build it in build week so it is live from the very first founding client." },
      { "h": "WHY", "b": "A founding client who has been looked after is the warmest introducer you will ever have, and by far the cheapest Winchester lead. Ads and the 448 list fill the launch; introductions are what compound after it, at close to zero cost." },
      { "h": "POM-SAFE", "b": "The reward is clinic credit toward any service, never money off a named prescription-only treatment, and it is never framed as a discount. The introducer earns it only on the introduced person's first attended, paid visit, so it cannot reward a no-show and it stays a genuine thank-you, not an inducement to a medicine." },
      { "h": "MESSAGE", "b": "The ask is loaded as an automation and goes out warmly after a good visit, never at the point of sale: 'If you know someone who would love their skin looked after the way yours was, send them this. You will both get 25 pounds toward your next visit when they come in.' Do not rely on remembering to ask." }
    ]
  },
  {
    "category": "build",
    "title": "Build the review-request automation now (the D6 ask), and disable the ANS default",
    "detail": "Reviews are the compounding asset that makes every other channel cheaper. Load the ask, never leave it manual.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-06",
    "dayDate": "2026-09-10",
    "sortOrder": 309,
    "deep": [
      { "h": "WHAT", "b": "Build the review request as a GHL automation now, so it fires on its own from launch: WhatsApp, seven days after an attended visit, at 11:00. The full trigger and wording live in the D6 task in the nurture section; this is the build-week task to load it, not leave it to memory." },
      { "h": "FIRST STEP", "b": "Disable the ANS built-in review request for Winchester first, or clients get asked twice. One ask, from one system." },
      { "h": "COMPLIANCE", "b": "Ask EVERY attended client, never only the happy ones: selective solicitation breaches the DMCC Act 2024 and Google policy. The message invites an honest review and asks the client to tell Abi directly if anything was not right, as well as (not instead of) leaving it." },
      { "h": "WHY", "b": "A new Winchester profile starts at zero reviews next to established rivals. A loaded, every-visit ask is what closes that gap fastest, and more reviews are what make the map pack and the Google ads cheaper over time." }
    ]
  },
  {
    "category": "creative",
    "title": "Three posts a week: the Monday, Wednesday, Friday themes, by clinic",
    "detail": "A fixed weekly skeleton, Bedhampton-led then Winchester-led, all from the shoot.",
    "channel": "social",
    "owner": "both",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-15",
    "sortOrder": 307,
    "deep": [
      { "h": "RHYTHM", "b": "Monday is authority or education, Wednesday is human or behind the scenes, Friday is proof or the current offer. Same skeleton every week so it is quick to fill." },
      { "h": "BY CLINIC", "b": "Through October the Bedhampton posts push the free local analysis before the scanner moves; the Winchester posts build the room, Abi and the founding window. From 2 November it is one Winchester-led feed." },
      { "h": "NOTE", "b": "Lean and repurposed from the batch shoot. Organic social is reach and reassurance, not the booking engine; do not let it eat the Friday review time." }
    ]
  }
];
