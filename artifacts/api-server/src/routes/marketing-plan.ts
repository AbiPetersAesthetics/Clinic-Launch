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
    "detail": "The domain has no Meta verification; add the meta tag or DNS record first.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 12,
    "deep": [
      {
        "h": "STEPS",
        "b": "1. Verify abipetersskinclinic.co.uk in Meta Business settings (meta tag or DNS record; Google's is already present, Meta's is missing). 2. Once verified, reconnect the Conversions API."
      },
      {
        "h": "WHY",
        "b": "CAPI will not improve lead measurement (leads arrive via instant forms that never touch the site, and the pixel fires PageView and Lead only). Its real value is audience durability and retargeting quality, which is why it ranks below the Winchester profile and the retargeting build."
      }
    ]
  },
  {
    "category": "top",
    "title": "Switch on: cut cold prospecting from about £19.80 a day to £8",
    "detail": "You are paying a rising price (£5.64 CPL) for leads you cannot serve.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 13,
    "deep": [
      {
        "h": "WHY",
        "b": "Cost per lead moved from £3.16 lifetime to £5.64 over the last 7 days, and there are already 395 leads against a cap of 40. Left unchanged the cold ad set buys roughly 200 more leads for places that no longer exist."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Cut to £8 a day and reclassify the ad set: it is no longer justified by the founding 40, it is justified by evergreen diary fill from 3 November, target about 40 leads a month. Releases about £422 to £615 depending on timing."
      },
      {
        "h": "NOTE",
        "b": "Keep or pause is the owner's call, but it must be a decision, not a default. The formal deadline and the £8 figure are set out as Decision 1 in the retargeting spec (by Friday 4 September, cut from Monday 7 September)."
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
        "h": "NOTE",
        "b": "This is a build, not a same-day switch. The full spec (audience union from GHL, £210 lifetime envelope, flight Monday 12 October to Sunday 1 November) lives in the retargeting document. Kick off the audience export and build now so it is ready to fly on 12 October."
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
    "title": "B2: confirm the SMS sender is a two-way UK long code",
    "detail": "The whole design is reply-based; an alphanumeric sender ID makes every gate fail silently.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 22,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Confirm the SMS sender number is a two-way UK mobile long code that can receive replies. If it is an alphanumeric sender ID, contacts cannot reply, and every reply-gated step (autumn/next year, YES, KEEP, STOP) silently fails."
      },
      {
        "h": "NOTE",
        "b": "First outbound is always SMS (WhatsApp sessions are closed); WhatsApp only takes over once the contact has replied."
      }
    ]
  },
  {
    "category": "nurture",
    "title": "B3: write the lawful basis for SMS and email",
    "detail": "Retrieve the instant-form consent wording and record that it covers direct marketing by SMS and email.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-02",
    "sortOrder": 23,
    "deep": [
      {
        "h": "BLOCKER",
        "b": "Write down the lawful basis once, covering both SMS and email. Retrieve the exact instant-form consent wording, confirm it covers direct marketing by SMS and email, and record the date range."
      },
      {
        "h": "WHY",
        "b": "PECR reg 22 applies to SMS as it does to email. Some records predate 1 Sep 2026, so consent may have degraded. This is owner decision 6 in section 14. If consent covers email, Phase B goes to the whole Requested pool; if not, only to Marketing Opt In = Yes."
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
    "detail": "20 of 40 already booked. Keep 40 a real, closing cohort; the waitlist becomes a second founding wave when the second clinician starts.",
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
        "b": "Everyone past 40, and everyone whose held slot lapses, goes onto the waitlist (the C4, C5 and D8 mechanic already does this). Tag them founding-wave-2. When the second clinician's start date is set, open roughly another 40 places to that list first, in order. Warm Bedhampton clients who miss wave one get priority on wave two."
      },
      {
        "h": "CAPACITY NOTE",
        "b": "Wave two cannot open until there is a second pair of hands to deliver it. Tying it to the hire is what keeps the promise honest and the diary deliverable. If wave one is filling this fast, bring the second clinician forward."
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
        "b": "1. How many days a week Abi is in Winchester (30 to 35 is her total across both clinics; at three days the real Winchester number is nearer 18 to 21 and the founding 40 take half). Decides whether C6 and D3 go to the whole list or a throttled slice, and fixes B2's wording. 2. The founding benefit is four elements; what does the twelve-month price hold cost (compute before B2 sends on 12 Oct). 3. How many complimentary analysis hours per week and what November must earn (cap at a stated number, 8 a sensible start; set a November revenue target). 4. Does Bedhampton keep running through November and who covers it. 5. Who answers messages 09:00 to 17:00, five days a week, from the day Phase A starts (about 30 hours of messaging labour before a single appointment). 6. One written lawful-basis position covering SMS and email (blocker B3). 7. Confirm the reconciliation owner and the daily slot."
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
    "title": "A1a: re-opener SMS to new leads",
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
        "b": "SMS (WhatsApp session closed). Before the first send, search the text for the curly apostrophe U+2019 (it forces UCS-2 and drops the segment from 160 to 67 characters)."
      },
      {
        "h": "SMS COPY",
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
    "title": "A1b: re-opener SMS to existing clients",
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
        "b": "SMS, 10:00 Mon to Fri, batched from Tue 3 Sep."
      },
      {
        "h": "SMS COPY",
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
    "title": "A4: consent housekeeping SMS",
    "detail": "Asks Requested contacts with no marketing opt-in for email consent, 24 hours after Requested.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 34,
    "deep": [
      {
        "h": "TRIGGER",
        "b": "Priority Access Requested AND Marketing Opt In empty. SMS, same thread, 24 hours after Requested."
      },
      {
        "h": "SMS COPY",
        "b": "One bit of housekeeping {{contact.first_name}}. Would you like the occasional email from me about the clinic, opening times and skin advice? Reply YES and I'll add you. Reply NO and I'll only ever message you about your own appointments. Either is genuinely fine. Reply STOP to opt out."
      },
      {
        "h": "WRITE-BACK",
        "b": "YES: Marketing Opt In Yes. NO: Marketing Opt In No, excluded from Phase B, no SMS fallback."
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
        "b": "Stage Later/No Reply, 4 days elapsed, no inbound. SMS at 17:30. Build as an if/else branch: an empty merge field would send 'you told me you wanted to work on .'"
      },
      {
        "h": "SMS COPY (Branch 1, skin_concern_safe set)",
        "b": "Hi {{contact.first_name}}, Abi here. When you did the skin audit on the website you told me you wanted to work on {{contact.skin_concern_safe}}. I open in Winchester on 2 November and I'll be doing the in-clinic skin analysis there, complimentary until 30 November. Would you like me to hold you a time, or leave you be for now? Reply STOP to opt out."
      },
      {
        "h": "SMS COPY (Branch 2, everyone else)",
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
        "b": "Stage Later/No Reply, A2 sent 10 days ago, no inbound. Email if Marketing Opt In = Yes, SMS only if blank, never if No. 08:00."
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
        "b": "Tag bedhampton-cold (enquired, never became a client). Marketing Opt In respected: SMS where consented, email otherwise."
      },
      {
        "h": "STRATEGY",
        "b": "Give them both doors and let them choose. The Bedhampton free analysis is on until 30 October and is the nearer option; Winchester opens 2 November for anyone happy with the drive. No pressure, honest about the closure."
      },
      {
        "h": "SMS COPY",
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
        "b": "Tag bedhampton-warm. From Abi personally: SMS first, email for the fuller version. Sent before the Winchester 448 founding booking opens on 26 October, so loyal clients get first pick."
      },
      {
        "h": "STRATEGY",
        "b": "These are the warmest people in the whole plan. Be honest that Winchester is about 25 minutes further, let them decide, and make the founding place a genuine thank-you for their loyalty. Never pushy. If the drive does not work for them, that is completely fine."
      },
      {
        "h": "SMS COPY",
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
        "b": "Realistic first-SMS reply is 8 to 18 per cent. The 12 per cent scenario produces 18 founding clients, not 40, so the plan needs a dated decision point."
      },
      {
        "h": "DECISION",
        "b": "Friday 16 October, count Priority Access = Requested. 55 or more: proceed as planned. Under 55: phone the non-repliers (not a fourth SMS), pull December forward, and open founding to web and walk-in from 2 Nov. Under 30: all of that, plus reconsider whether 40 is the right cap (a real 25 beats a padded 40)."
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
        "b": "Priority Access Requested (sent regardless of Marketing Opt In, one-to-one reply). WhatsApp where a session is open from a Phase A reply, else SMS. Mon 19 Oct 09:00, single send."
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
    "detail": "Air cover behind the SMS sequence to the lead-form and website audiences, 19 Oct to 15 Nov.",
    "channel": "meta",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-19",
    "sortOrder": 45,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Mon 19 Oct, start retargeting at £8 a day to the lead-form and website audiences, running 19 Oct to 15 Nov (£224). This is air cover behind the SMS sequence, not a lead machine."
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
        "b": "Founding Week set AND Priority Access Requested AND combined Booked+Confirmed under 40 AND Booked in that Founding Week under 10. Rolling, earliest week first then reply time. Build as a manual task with a saved snippet, not send-and-forget. WhatsApp falling back to SMS, from Wed 21 Oct within 24 hours of the C1 reply. Both caps hard."
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
        "b": "Priority Access changes to Booked. WhatsApp if session open else SMS, immediately."
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
        "b": "Combined Booked+Confirmed reaches 40 AND contact is Requested or Waitlist with a November Founding Week. WhatsApp or SMS, one-to-one, within 24 hours."
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
        "b": "GHL Winchester calendar event tomorrow. WhatsApp or SMS, 17:00 the day before."
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
        "b": "Priority Access Booked or Confirmed. WhatsApp if open else SMS. Mon 2 Nov 08:00."
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
        "b": "Priority Access Waitlist AND a November slot released by C4 or a no-show, one person at a time, oldest first. WhatsApp if open else SMS within 2 hours."
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
        "b": "Attended 3 days ago. WhatsApp if open else SMS, 09:00."
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
        "b": "Attended 7 days ago, no other condition. Do not exclude complainants: selective solicitation breaches the DMCC Act 2024 and Google policy. WhatsApp if open else SMS, 11:00. Disable the ANS review request for Winchester first."
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
        "b": "Attended 10 days ago AND opportunity.first_treatment_date empty. WhatsApp if open else SMS, 10:00."
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
    "category": "retarget",
    "title": "Decision 1: cut cold prospecting from £19.34 to £8 a day",
    "detail": "Reclassify the live prospecting ad set as evergreen diary fill, not founding acquisition.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-04",
    "sortOrder": 63,
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
    "sortOrder": 64,
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
    "sortOrder": 65,
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
    "sortOrder": 66,
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
    "sortOrder": 67,
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
    "sortOrder": 68,
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
    "sortOrder": 69,
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
    "sortOrder": 70,
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
    "sortOrder": 71,
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
    "sortOrder": 72,
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
    "sortOrder": 73,
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
    "sortOrder": 74,
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
    "sortOrder": 75,
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
    "sortOrder": 76,
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
    "sortOrder": 77,
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
    "sortOrder": 78,
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
    "sortOrder": 79,
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
    "sortOrder": 80,
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
    "sortOrder": 81,
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
    "sortOrder": 82,
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
    "sortOrder": 83,
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
    "sortOrder": 84,
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
    "sortOrder": 85,
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
    "sortOrder": 86,
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
    "sortOrder": 87,
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
    "sortOrder": 88,
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
    "sortOrder": 89,
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
    "sortOrder": 90,
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
    "title": "SMS reminder to non-responders",
    "detail": "Short reminder by SMS to everyone who has not responded.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-10-18",
    "dayDate": "2026-10-21",
    "sortOrder": 91,
    "deep": [
      {
        "h": "MESSAGE",
        "b": "Short reminder to non-responders, sent by SMS."
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
    "sortOrder": 92,
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
    "sortOrder": 93,
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
    "sortOrder": 94,
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
    "sortOrder": 95,
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
    "sortOrder": 96,
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
    "sortOrder": 97,
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
    "sortOrder": 98,
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
    "sortOrder": 99,
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
    "sortOrder": 100,
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
    "sortOrder": 101,
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
    "sortOrder": 102,
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
    "sortOrder": 103,
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
    "sortOrder": 104,
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
    "sortOrder": 105,
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
    "sortOrder": 106,
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
    "sortOrder": 107,
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
    "detail": "Confirm each form carries a privacy notice, a marketing opt-in for email and SMS, and separate WhatsApp handling.",
    "channel": "found",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 108,
    "deep": [
      {
        "h": "STEPS",
        "b": "Confirm the form carries a privacy notice link, a specific marketing opt-in covering email and SMS, and separate WhatsApp handling."
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
    "sortOrder": 109,
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
    "sortOrder": 110,
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
    "sortOrder": 111,
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
    "sortOrder": 112,
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
        "b": "The £422 released goes to Bedhampton (open, earning, £160 lifetime ad spend, no live advertising, offer expires end October)."
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
    "sortOrder": 113,
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
    "sortOrder": 114,
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
    "sortOrder": 115,
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
    "sortOrder": 116,
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
    "sortOrder": 117,
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
    "sortOrder": 118,
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
    "sortOrder": 119,
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
    "sortOrder": 120,
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
    "sortOrder": 121,
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
    "sortOrder": 122,
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
    "sortOrder": 123,
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
    "sortOrder": 124,
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
        "b": "At the analysis Abi hands the written plan with the date and 'add-on included if you book by [date plus 14]'. Booking must be within 14 days; the appointment may sit up to 30 days out. GHL on attended sets Analysis Date, computes Add On Window Closes = Analysis Date + 14, applies bh-addon-live. Follow up day 2 plan recap, day 7 check-in, day 12 last reminder on SMS and email (WhatsApp needs approved templates outside the 24 hour window). Tag bh-addon-redeemed on the treatment, bh-addon-expired at day 15. One per client, max 30 redemptions (about £1,500 retail, about £750 cost); ring fence 30 units."
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
    "sortOrder": 125,
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
    "sortOrder": 126,
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
    "sortOrder": 127,
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
    "sortOrder": 128,
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
    "sortOrder": 129,
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
    "sortOrder": 130,
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
        "b": "No paid warm ad set. The addressable warm pool after exclusions is about 500 to 2,000; message them free from GHL by WhatsApp template and SMS in week one. Below about 3,000 addressable, do not buy retargeting. Winchester stays as is apart from the section 0 budget cut."
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
    "sortOrder": 131,
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
    "sortOrder": 132,
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
    "sortOrder": 133,
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
    "sortOrder": 134,
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
    "sortOrder": 135,
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
    "sortOrder": 136,
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
    "sortOrder": 137,
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
    "detail": "Reach the warm pool by WhatsApp template and SMS free from GHL in week one; do not buy retargeting for it.",
    "channel": "email",
    "owner": "david",
    "weekStart": "2026-09-13",
    "dayDate": "2026-09-14",
    "sortOrder": 138,
    "deep": [
      {
        "h": "AUDIENCE",
        "b": "The addressable warm pool after exclusions is about 500 to 2,000. Message them free from GHL by WhatsApp template and SMS in the week of 14 September. Below about 3,000 addressable, do not buy retargeting, so there is no paid warm ad set."
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
    "sortOrder": 139,
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
    "sortOrder": 140,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Manual, ten minutes a day. Headline number: attended analyses at Bedhampton, target 17 to 21, minimum 14."
      },
      {
        "h": "NOTE",
        "b": "Metrics with review triggers: leads 46 to 57 (trigger under 20 by 30 Sep); CPL £12 to £15 (above £20 for five days); speed to first contact automated WhatsApp/SMS inside 60 seconds then two named human call blocks a day, three attempts across 72 hours (trigger any day with no call block); lead to booked within 72 hours 50 per cent or more (below 35); booked to attended 75 per cent with deposit, 60 without (below 55, add a two hour reminder); cost per attended analysis under £45 (above £55 at the 1 Oct gate, above £65 for two weeks); analysis to treatment within 14 days 40 per cent so 7 to 8 (below 25, the plan conversation needs work); second treatment within 90 days 40 per cent; first treatment revenue £1,400 to £1,700 against about £1,145 cost (below £1,000); add-on redemptions 7 to 9 (approaching 30, pause); new Google reviews by 31 Oct 15 (below 8 at 15 Oct); analysis slots booked out two weeks ahead is the binding constraint (pause immediately); frequency below 3.5 (check weekly from 21 Sep, refresh creative never raise budget)."
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
    "sortOrder": 141,
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
    "sortOrder": 142,
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
    "sortOrder": 143,
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
    "sortOrder": 144,
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
    "sortOrder": 145,
    "deep": [
      {
        "h": "STRATEGY",
        "b": "Acquisition is not the constraint. The list is already full: 395 leads on Meta (448 opportunities in GHL) against a founding cap of 40, served by one nurse at 30 to 35 appointments a week. Selection, conversion and capacity are the real problems, so most of what remains is decisions and build, not more ad spend. Every ad, message and build step below waits on one of these calls."
      },
      {
        "h": "DECISION GATES BY DATE",
        "b": "Wed 3 Sep: Winchester room shootable by 8 Sep; age breakdown of recent leads; does Bedhampton trade after 2 Nov and on how many days; who answers a new lead and within what time; £25 redeemable deposit or not. Fri 4 Sep: live prospecting budget (cut, pause or reclassify); reconciliation owner and daily slot. Fri 5 Sep: analysis appointment length; how many free analyses a week and what November must earn; is the free analysis the gate to founding or separate. Fri 11 Sep: what founding actually buys; how many days a week Abi is in Winchester. Fri 12 Sep: open the November Winchester calendar in ANS. Mon 15 Sep: write down the nothing-sold-on-the-day rule. Fri 9 Oct: confirm the £50 Winchester list price. Sun 12 Oct: cost the twelve-month founding price hold. Ongoing from 3 Sep: one written lawful-basis position for SMS and email."
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
    "sortOrder": 146,
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
    "sortOrder": 147,
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
    "sortOrder": 148,
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
    "sortOrder": 149,
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
    "sortOrder": 150,
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
    "sortOrder": 151,
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
    "sortOrder": 152,
    "deep": [
      {
        "h": "DECISION",
        "b": "Who answers a new lead and within what time, and who answers messages 09:00 to 17:00 five days a week from the day Phase A starts. Speed to first contact is the largest single lever. One nurse with a client in the chair cannot answer in five minutes. The whole programme is about 30 hours of messaging labour before a single appointment."
      },
      {
        "h": "RECOMMENDATION",
        "b": "Name the owner and a service level: automated WhatsApp or SMS inside 60 seconds, then two named human call blocks a day, three attempts across 72 hours. Consider VA hours. Without this the booking rate is fiction."
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
    "sortOrder": 153,
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
    "title": "Decision: one written lawful-basis position for SMS and email",
    "detail": "Blocker B3; the whole nurture design is reply-based and PECR reg 22 applies to SMS as to email.",
    "channel": "found",
    "owner": "both",
    "weekStart": "2026-08-30",
    "dayDate": "2026-09-03",
    "sortOrder": 154,
    "deep": [
      {
        "h": "DECISION",
        "b": "Write down the lawful basis once, covering SMS and email, before Phase A starts. Retrieve the exact instant-form consent wording, confirm it covers direct marketing by SMS and email, and record the date range. PECR reg 22 applies to SMS as to email, and some records predate 1 September 2026 so consent may have degraded."
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
    "sortOrder": 155,
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
    "sortOrder": 156,
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
    "sortOrder": 157,
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
    "sortOrder": 158,
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
    "sortOrder": 159,
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
    "sortOrder": 160,
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
    "sortOrder": 161,
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
    "sortOrder": 162,
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
    "sortOrder": 163,
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
    "sortOrder": 164,
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
    "sortOrder": 165,
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
  }
];
