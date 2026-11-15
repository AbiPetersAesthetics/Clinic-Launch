# ALFRED data audit, 15 November 2026

Scope: every figure ALFRED shows or relies on, traced to its source; the 12 month model; the
scheduled runs. Standard: every figure is real, sourced and dated, or says "not measured yet".

How it was done: read only. The database was queried with SELECT statements inside read only
transactions. The cash model was run through its own `buildCashModel` function, and re-run in
memory with two inputs changed (nothing saved). Both Google Business Profiles were read through the
Local Falcon connector. ANS, Clarity, Meta Ads Manager and Google Ads were **not** opened: where a
finding rests on a run book or a note rather than the live system, the evidence column says so.

Severity: **wrong** (a figure or statement is untrue), **stale** (true once, not refreshed),
**unsourced** (no traceable source, or the source does not fit the use), **contradictory** (two
copies of one fact disagree).

Fix: **Done** (fixed in this audit, clinic repo), **Build** (instruction for the ALFRED build
agent), **Owner** (only David can decide or supply it).

## 1. The ten that matter most

1. **The money model disagrees with the owner's own later decisions, and the difference takes the
   bank below its floor.** As built (Bedhampton two days, ads at 600 a month) the lowest month end
   is 10,134 in November 2026. Re-run with Bedhampton on one day (owner, 22 Oct) and ads at the
   15 Nov plan, November closes at 9,901 and December at 9,141, both under the 10,000 floor, and
   Abi's first pay moves from March 2027 to December 2027. (M3, M4)
2. **The bank figure is a typed 2,279 from 9 November.** The 37,000 investment landed the next day.
   A 10,000 gift is dated 5 November, before the balance, yet is not ticked as inside it, so the
   model adds it on top: either it is double counted or its date is wrong. (M1, M2)
3. **December only stays above the floor if a 13,000 loan recorded as "likely" arrives in December**
   and a 10,017 VAT refund lands the same month. (M5)
4. **The 8 December scheduled switch will publish a superseded offer.** It writes "the analysis is
   50, redeemable, from 8 Dec" onto the ad pages; the owner decided on 14 Nov that it stays free
   until the end of February. The site already says the old thing in five places. (P6)
5. **Compliance shows 0% because the table is a CQC seed list from May**: 47 items, none complete,
   none dated, one saying the clinic "cannot open" without a CQC certificate, which the owner's
   record contradicts. It measures nothing real. (C1)
6. **What a patient is worth is Bedhampton's figure with Winchester's margin.** 168 and 400 come
   from Bedhampton invoices, March to September 2026; the 62% kept is Winchester's. And an ad
   lead's first visit is a free consultation. (M10)
7. **The forecast cannot yet be checked against the ads.** 11 leads and 6 booked consultations in
   four days is real; whether they pay is not measured until mid January 2027. For the forecast's
   22 new patients in January to come from ads, about 4 in 10 booked consultations must turn up and
   pay. Bedhampton's own history for consultation-first patients was 1 in 20 in 90 days. (A3)
8. **Three of the four daily and weekly runs have never run**, and five agents in the plan have no
   scheduled task at all. A run that never starts is not reported as missed. (section 4)
9. **The Bedhampton Google profile lists "Botox treatments" as a service** and shows opening hours
   on four days, two of which clash with Winchester's from 8 December. (O7, O8)
10. **The app's Winchester price column is not the live price list**: at least 8 treatments differ
    from the site, and the model's 1.48 price factor was worked out from it. (P1, M9)

## 2. Every finding

### Money model

| # | What | Where | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| M1 | Bank balance is typed: 2,279 as at 9 Nov 2026, seeded at 12:00 that day. 6 days old; stale by ALFRED's own 7 day rule on 16 Nov. 37,000 landed on 10 Nov, so today's real balance is unknown. | DB `financial_models.cash_model_json.bank` | stale | `{"asAt":"2026-11-09","balanceGbp":2279,"inBalance":[],"bankSeeded":true}`; investment 7 note "in Tide on the 10th" | **Owner** types today's balance. **Build**: when it is over 7 days old, every forecast line built on it is labelled stale, not only the balance. |
| M2 | The 10,000 gift is dated 5 Nov, before the 9 Nov balance, but `inBalance` is empty, so the model adds it to the 2,279. If it had arrived, the bank is overstated by 10,000 and November ends near 134. Its note says "not in the bank on 1 November; can be called in when wanted". | DB `investments` row 8; cash model November `fundingIn` 54,049 = 37,000 + 10,000 + 7,049 | contradictory | Model run 15 Nov | **Owner**: has it arrived, and when? **Build**: when a balance is typed, ask about every funding row dated on or before it. |
| M3 | Bedhampton runs two days a week from December in the model (`oneDayFrom: null`). The owner's later decision is one day a week (22 Oct). Twelve month Bedhampton takings: 81,887 on two days, 58,346 on one. | `cash-model-defaults.ts` line 119 to 126; memory note `bedhampton-closing` | wrong | Re-run with `oneDayFrom "2026-12"`: December closes 9,692 (below floor), first pay moves to Nov 27 | **Owner** confirms the day and start date. **Build** then sets `bedh.plan.oneDayFrom`. |
| M4 | Ad spend is 600 a month in the model. The 15 Nov ads plan is 25 a day now (about 760 a month) with a 40 a day cap. Twelve months: 7,200 in the model, 11,015 at today's budget with the dated extras, 13,493 at the plan's peak. | `cash-model-defaults.ts` marketing; `ads-plan.json`; `monthly-plan.json` | contradictory | `ops/model/model-12-months.json` totals. With M3 and M4 together: Nov 9,901, Dec 9,141, first pay Dec 27 | **Owner** decides which figure the money model carries. **Build**: read marketing from the ads plan. |
| M5 | The 13,000 investor loan is "likely drawn in December 2026" and the model draws it on 15 Dec. December closes 10,608 with it. Without it December would be about 2,400 overdrawn. The 10,017 build VAT refund is also assumed to land in December. | DB `investments` row 9; model December row | unsourced | Model run | **Owner**: confirmed date of the draw. **Build**: show unconfirmed inflows as a separate line the floor test does not count. |
| M6 | Winchester works 3 days of 7 hours in the model (capacity 31,595 a month). The site publishes 4 days, 27.75 hours a week. With Bedhampton on one day the model itself gives Winchester 4 days (42,127). | `cash-model-defaults.ts` capacity; `src/_data/site.json` openingHours | contradictory | Model rows `wincDays: 3`; site Tue, Wed, Fri 09:45 to 17:15, Thu 08:45 to 14:00 | **Build**: capacity from published hours. Follows from M3. |
| M7 | The patient figures stop at 30 Sep 2026. `BEDH_NEW_PATIENTS` ends at September; October and November are an assumed 20 a month; Bedhampton takings for October and November are typed guesses of 8,000 and 9,000. Actual: October 8,870.25; November 6,886.50 taken plus 4,140 booked to 27 Nov. The history block ends at September. | `cash-model-defaults.ts` lines 22 to 26, 94, 110, 156 | stale | `ops/clinic/clinic.json` (ANS, 15 Nov) | **Build**: take actual months from the clinic snapshot. New patient counts need a fresh ANS read: the clinic refresh records them from 8 Dec; October and November need one manual ANS export. |
| M8 | December's "founding cohort" is 60 people and 4,400 booked, counted in ANS on 1 Nov. The comment lists 13 + 6 + 47, which is 66. Not refreshed since; six ad consultations alone have been added. | `cash-model-defaults.ts` lines 45 to 51 | stale | Code comment; `pathway.json` (6 booked from ads, 12 to 15 Nov) | **Build**: read December's booked Winchester total from the clinic snapshot once the refresh splits by clinic. |
| M9 | Winchester prices are modelled as 1.48 times what Bedhampton charged (1.184 at introductory prices), worked out against the app's `price_winchester` column. That column no longer matches the live list (P1). | `cash-model-defaults.ts` PRICES | unsourced | P1 | **Build**: recompute from Winchester's own invoices after the first full month. Until then label it assumed. |
| M10 | Patient value: 168 first visit, 400 year one, 62% kept. Source found: ANS export of 30 Sep 2026, Bedhampton prices (168.04 first month, 134.22 a return visit, about 1.7 returns in year one). The 62% is Winchester's blended margin, so "245 kept" mixes the two clinics. At the model's own factors a Winchester patient's year one would be about 469 (introductory) to 586 (list). An ad lead's first visit is free. | `ads-plan.json` assumptions; `ads/STRATEGY.md`; `cash-model-defaults.ts` PATIENT_MODEL | unsourced for Winchester | Arithmetic: 168.04 + 1.7 x 134.22 = 396 | **Done**: the basis is now written beside the figures in `ads-plan.json` and `STRATEGY.md`. **Build**: label them "Bedhampton prices, Mar to Sep 2026" on the Ads Board; replace with Winchester's own figures when they exist. |
| M11 | "New patient room: 10 a week alone, 20 with two" has no source. 10 a week is about 43 a month; the cash model's Recommended forecast is 16 to 24 and its Fast case caps at 36. | `ads-plan.json` assumptions | unsourced, contradictory | Files compared | **Owner**: Abi's real number of new patient slots a week. |
| M12 | Card debt in the model (17,810 at the end of November) is unpaid plan lines scheduled "on the card", with VAT. The register holds 14,845.42 on the two real cards: Virgin 11,225.60 of 11,400 (closed to new 0% purchases since 29 Oct) and Barclaycard 3,619.82 of 6,500 (last entry 7 Nov). The gap implies about 2,965 still to go on a card in November against 2,880 of 0% headroom. A further 5,023.53 is owed to the directors on three "cards" that are bank accounts. | Model November row; DB `credit_cards`, `card_entries` | contradictory | SELECT sums by card, 15 Nov | **Build**: start card debt from the register, per card, and keep directors' loans apart. **Owner**: enter card spend since 7 Nov. |
| M13 | Card repayments are 1/24 a month, clearing in November 2028. Virgin's 0% ends 30 Aug 2028 (model still owes about 2,226 then) and the Barclaycard's is "taken to end" 1 Oct 2028. The Barclaycard's real end date, APR, due day and minimum are unconfirmed, and both cards show no direct debit. | DB `credit_cards.offers_json`, notes; model rows 2028-08 to 2028-10 | unsourced | DB row 5 note | **Owner**: Barclaycard details; set a direct debit for the minimum on both. **Build**: repay each card before its own 0% end date. |
| M14 | VAT: the model holds no return due dates and no net amounts. It assumes monthly returns with the build VAT refund arriving the month after. The plan's Obligations page needs dates. The task "VAT Registration Monitoring" is still "not started" although the business is VAT registered. | `cash-model-defaults.ts` vatReturns; DB `launch_tasks` | unsourced | Code; task row | **Owner** (or the accountant): confirm monthly returns and the due dates from the HMRC account. **Build**: add the dates and an estimate. |
| M15 | Pending shareholder rows say "the 1% equity kicker on the 10,000 loan", effective 26 Nov 2026. The loan is 13,000 and is drawn in mid December. | DB `shareholders` rows 8 to 10 | stale | Rows read 15 Nov | **Build** (with the owner's yes): correct the note and date. |
| M16 | The owner's memory note still gives the loan as 10,000 with repayments of 364, and Bedhampton as two days. Both were superseded (1 Nov and 22 Oct). | Memory `business-record-2026-09-26.md` | stale | DB row 9; memory `bedhampton-closing.md` | **Owner** session: add a "superseded" line. Not changed here. |
| M17 | The project's target opening date is 27 November 2026, and launch readiness is 12%. The old Today page prints "Target 27 November". | DB `projects`; `today.tsx` line 169 | wrong | Row read 15 Nov | **Build**: set 2026-12-08; stop showing the readiness percentage (C2). |
| M18 | Legacy pages hard-code a 2 November opening. | `marketing-timeline.tsx` 42, 46, 90, 165, 205; `social-plan.tsx` 34, 86, 94; `export.tsx` 455; `lifestyle.tsx` 1780; `marketing.tsx` 330 | stale | grep | **Build**: archive pages carry a banner "archived, figures as written on their date", or the strings go. |
| M19 | A second clinician is in the ads plan from March 2027 (cap 60 a day, an introduction campaign) but not in the cash model: no pay, no takings. `workforce_settings` still describes a receptionist, a clinic manager and a Chichester move, all dropped in the owner's record. | `ads-plan.json` caps; DB `workforce_settings` | contradictory, stale | Files compared | **Owner**: a date or "not before X". **Build**: Team page reads nothing from the old workforce table. |
| M20 | Stands Alone threshold in the model is 14,200 a month (5,327 running costs + 474 loan + 3,000 kept at 62.1p). The owner's memory note says about 14,100 with a 364 repayment. On the Recommended forecast Winchester does not reach it inside the 12 months (10,693 in Nov 2027); the model meets it in October 2028. | `cash-model-defaults.ts` line 63; model rows | contradictory (minor) | Model run | **Build**: Stands Alone page reads the model's figure and shows the forecast month. |

### Opening date, hours and the Google profiles

| # | What | Where | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| O1 | 8 December 2026 is consistent across the site (about 70 strings checked), `clinic.json`, `brief.ts` and the plans, with model days on 2 and 3 Dec. The exceptions are M17, M18 and O2. | Site `src/`, clinic repo | none | grep | None. |
| O2 | The Winchester Google profile's opening date is 2 December 2026 and its status is "open". The public opening is 8 Dec; 2 Dec is the first model day. | Google profile `openInfo` | contradictory | Read 15 Nov through Local Falcon | **Owner**: which date Google should show. |
| O3 | The Winchester profile description ends "The clinic opens on Tuesday 8 December 2026". True today; wrong from 8 Dec. No scheduled run changes it: the opening switch task does not touch the profile. | Google profile `profile.description` | stale from 8 Dec | Read 15 Nov | **Owner**: approve new wording; add it to the 8 Dec switch. |
| O4 | Winchester closes at 17:00 on Tue, Wed and Fri on Google, 17:15 on the site. | Google profile `regularHours`; `site.json` | contradictory | Read 15 Nov | **Owner**: choose; change the other. |
| O5 | `nap.json` says Winchester hours are "to be confirmed" and that the Google profile "currently says 9 and must be corrected". The site publishes the hours and the profile now reads "9a Jewry Street". | `src/_data/nap.json` Winchester `hours`, `note` | stale | Files; profile read 15 Nov | Site data, not changed here. Next site session. |
| O6 | "Winchester hours will be published ahead of the 8 December 2026 opening", on a site that publishes them two pages away. | `src/pages/the-clinic.njk` line 107; `book-consultation.njk` line 30 | contradictory | Files | Site, not changed here. |
| O7 | The Bedhampton profile shows hours on Tue 18:00 to 20:00, Thu 10:00 to 13:30, Fri 10:00 to 17:30 and Sat 10:00 to 12:30. From 8 Dec Winchester is open Thu 08:45 to 14:00 and Fri 09:45 to 17:15. Abi cannot be in both, and the owner's decision is one Bedhampton day. | Google profile, Bedhampton | contradictory from 8 Dec | Read 15 Nov | **Owner**: Bedhampton's day (same decision as M3). |
| O8 | The Bedhampton profile lists the structured service "Botox treatments". That is a prescription-only medicine named on a public profile. The Winchester profile uses "Anti-wrinkle consultation" instead. | Google profile, Bedhampton `serviceItems` | wrong (compliance) | Read 15 Nov | **Owner** says the word; removing it is a profile edit. |

### Prices and offers

| # | What | Where | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| P1 | The app's `price_winchester` column (last edited 6 Sep) differs from the site's Winchester list: microneedling face 215 against 125 (course of three 580 against 330 to 375 in the ads plan); face and neck 255 against 135; face, neck and décolletage 300 against 150; polynucleotides 280 against 250; Sculptra 430 against 500; exosomes face 275 against 300; Fillmed Bright peel 75 against 45; and Profhilo face and neck 625 against 600 in ANS. The `actual_price_winchester` column matches the site on these. | DB `treatments`; `src/content/treatments/*.md`; `ads-plan.json` | stale | Table read 15 Nov; site front matter | **Build**: pages read `actual_price_winchester`, or the table is synced from the site files. |
| P2 | Lip and dermal filler: the site says 180 for 0.5ml and 495 for 2ml; ANS (and the app's actual column) say 200 and 500. Open since 6 Nov. | `dermal-fillers.md` lines 15, 27; DB `treatments` filler05, filler2 | contradictory | Files; memory note of 6 Nov | **Owner**: one price each. |
| P3 | At introductory prices microneedling face and neck (135) costs more than face, neck and décolletage (130). | ANS, per the 6 Nov record | contradictory | Memory note `ans-winchester-opening-prices`; not re-read in ANS | **Owner**. |
| P4 | Black Friday proposal: skin boosters course of three at 345. The site already offers the same course at an introductory 340 to anyone booking before 8 Dec, which includes Black Friday week. | `ads-plan.json` giftweek26; `restylane-skinboosters.md` line 40 | contradictory | Files | **Owner**, with the other Black Friday prices due 19 Nov. |
| P5 | `prices.json` says its prices are Bedhampton's and that Winchester's "will be confirmed before it opens", though they are published. It also lists Sculptra "From 400" at Bedhampton; the owner's record says Sculptra is Winchester only at 500 a vial. | `src/_data/prices.json` disclaimer, Regenerative group | stale, contradictory | File; memory `business-record` | **Owner** on Sculptra. Site, not changed here. |
| P6 | Skin analysis after opening. The site says the 50 comes off a treatment from 8 Dec, or that it "returns to its normal 50", or that it is free only for those who book before 8 Dec. The owner decided on 14 Nov: free until the end of February 2027, 50 redeemable from 1 March, and "normally 50" removed at the 6 Dec ad swap. The scheduled task `winchester-opening-switch` (8 Dec 07:00) is written to the old terms and will put "50, redeemable, from 8 Dec" on the ad pages. `meta-evergreen-opening-draft` (4 Dec) asks for introductory prices in ads that go live as they end. | `skin-analysis.md` line 43; `book-consultation.njk` line 161; `winchester-skin-analysis.njk` line 171; `faqs.json` line 9; `bedhampton.njk` line 326; `site.json` offer.note; both task prompts | contradictory | Files; memory `ads-plan-dec-2026` (14 Nov) | **Owner** confirms once; then the site and both task prompts are corrected before 4 Dec. |
| P7 | "Bedhampton carries on, with the same treatments and prices at both." There are two price lists. | `src/pages/the-clinic.njk` line 34 | wrong | P1, site treatment files | Site, not changed here. |
| P8 | "300+ five-star reviews on Google and Fresha" appears on 13 pages. Google holds 100 for Bedhampton at 5.0 and none for Winchester; the Fresha part is read by no run. | `src/pages/*.njk` | unsourced (the Fresha share) | Profiles read 15 Nov | **Build**: the reviews run records both counts weekly, so the claim has a dated source. |
| P9 | Skin analysis length: 45 minutes in the capacity review prompt, 30 in the app and the site. | `ads-capacity-review/SKILL.md`; DB `treatments`; `prices.json` | contradictory (minor) | Files | Next live session reads ANS and corrects the wrong one. |

### Ads

| # | What | Where | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| A1 | ROAS targets were 2.5x and 6x in the rulebook, 1.8x and 4.5x in the plan the board reads. | `ads/STRATEGY.md` line 70; `ads-plan.json` targets | contradictory | Commit 1857d99 lowered the plan the same evening | **Done**: STRATEGY.md now says 1.8x and 4.5x. |
| A2 | "Twice-daily pathway check (12:00, 16:00)". It runs at 08:00, 12:00 and 16:00. | `ads/STRATEGY.md` line 116; `state.json` note; `README.md` line 9 | stale | Task cron `0 8,12,16 * * *` | **Done** in all three. **Build**: same wording in `ads-pathway.tsx` 68, `opening-board.tsx` 3 and 14, `opening-board.ts` 3 and 32, `ads-pathway.ts` 1. |
| A3 | Forecast against reality. Measured, 12 to 15 Nov: 79.52 spent, 11 leads (7.23 each), 6 booked (55%; one of the 11 was already a patient), 13.25 per booked consultation. At that rate the evergreen's 25 a day buys about 105 leads and 58 booked consultations a month. For the model's 22 new patients in January and February to come from ads alone, 38% to 42% of booked consultations must attend and pay; 27% to 37% for the rest of the year. Not measurable before mid January 2027. | `pathway.json`; `ops/model/model-12-months.json` | unsourced (the forecast) | Bedhampton history, for context only and not used: 1 in 20 consultation-first patients treated within 90 days (ANS, 30 Sep); 5.3% of leads to treatment (22 Oct) | **Build**: show the required rate beside the measured one from January. No verdict before then. |
| A4 | "First consultations are 2 Dec 2026 onwards". The first ad lead consultation booked is 11 Dec; the six run from 11 Dec to 8 Jan. Takings from ad leads cannot appear before mid December. | `ads/STRATEGY.md` line 22 | stale | `pathway.json` apptIso | **Done**. |
| A5 | Actual spend is 22.19 a full day against a 25 budget. | `pathway.json` daily | none | 13 to 15 Nov rows | None; shown in the model. |
| A6 | Google Ads. A note of 10 Nov says campaign v2 is live at up to 25 a day. The 15 Nov rulebook says Google returns only when three conditions hold, its optimisation task has been off since 12 Nov, and three of its task folders are unregistered. The 8 Dec switch still checks "the Google ads". Whether the campaign is paused was not verified (Google Ads not opened). If it is live, its spend is in no plan and no run watches it. | Memory `ads-plan-dec-2026`; `ads/STRATEGY.md`; scheduled tasks | contradictory | Task list 15 Nov | **Owner**: is it paused? Next live session checks the account. |
| A7 | Diary fill, attended, paying patients, ROAS: null. | `pathway.json` capacity, outcomes | not measured yet | First capacity review is 16 Nov; first consultation 11 Dec | None. ALFRED must say "not measured yet". |
| A8 | The clinic data file was stamped 20:40 when it had been saved at 19:44: a time in the future makes figures look fresher than they are. | `ops/clinic/clinic.json` updated, updatedIso | wrong | Commit 886c7df at 19:44:56 +0000; DB snapshot 19:44:43Z | **Done** in the file (the DB snapshot keeps 20:40 until the 07:40 run). **Build**: `push-board.mjs` and `log-run.mjs` refuse a time later than now. |
| A9 | The clinic run book said its task "could not be created" and was "waiting to be scheduled". It is scheduled and enabled. | `ops/clinic/REFRESH.md` | stale | Task list 15 Nov | **Done**; accuracy checks and the activity log step added. |
| A10 | ANS's "this month" total includes appointments booked later in the month; practitioner profiles mislabel the clinic (the Winchester profile was used at Bedhampton earlier in the year). | ANS | confirmed from the run book, not re-read in ANS | `clinic.json` byClinicNote; `REFRESH.md` step 1 | Already handled: taken and booked are kept apart and the split is by the clinic on each invoice. **Build**: every takings figure says "taken" or "booked". |

### Compliance, tasks and the activity log

| # | What | Where | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| C1 | Compliance: 47 items, 0 complete, 2 in progress, 45 not started, none with a date, last touched 7 Jul. It is the CQC registration seed of 9 May, including "CQC registration certificate: clinic CANNOT open to patients without this". The owner's record: not CQC registered, a decision for early 2027. The sidebar's 0% is true to the table and says nothing about the clinic. | DB `compliance_items`, `cqc_milestones` | wrong | Table read 15 Nov | **Build**: no percentage. The page holds only dated items that can lapse, and the badge is "n due in 60 days" or "no dates entered yet". **Owner** supplies the dates: indemnity and premises insurance, NMC registration and revalidation, ICO fee, clinical waste contract, life support and anaphylaxis training, DBS, fire alarm service, PAT, lease dates. |
| C2 | Tasks: 134 live, 6 complete, 13 in progress, 108 not started, 7 deferred. Building works show 3 of 23 complete with practical completion due on 27 Nov. Launch readiness reads 12%. Nobody has been keeping statuses. | DB `launch_tasks`, `projects.launch_readiness_percent` | stale | Counts read 15 Nov | **Build**: no percentage built on these; show each task's last update. **Owner or Abi**: a ten minute pass before 8 Dec, or archive the list on opening as the plan says. |
| C3 | The activity log has two rows, both written at 20:22 for runs that happened at 12:14 and 16:27. The heartbeat ignores any agent that has never logged, so a run that never starts is never missed. | DB `activity`; `heartbeat.ts` line 31 | wrong | Rows read 15 Nov; code | **Build**: every agent in `SCHEDULES` is expected from a start date, logged or not. |
| C4 | Agent names and times disagree. Heartbeat expects "Brief" at 07:55 and "Money watch" daily at 07:50; the run book logs "Morning brief" at 07:45 and runs Money watch on Mondays at 07:00. A brief at 07:45 would run before the money watch and may run before the clinic refresh (07:30 plus up to 12 minutes). | `heartbeat.ts`; `ALFRED-PLAN.md` section 4; clinic repo `ops/alfred-runs.md` | contradictory | Files | **Build**: one table of agents (name, time) used by the plan, the heartbeat and the run book. Suggested order: clinic 07:30, pathway 08:00, money watch 08:20, brief 08:30. |
| C5 | ALFRED's `seo` and `videos` snapshots were each pushed once by hand on 15 Nov. No scheduled run pushes them, so the app's copy ages while the files stay fresh. | DB `board_snapshots` | stale from tomorrow | One row each | **Build**: the content planner pushes videos; the reviews run (or a step in the clinic refresh) pushes `seo/targets.json`. |

## 3. The 12 month model

There is not yet one coherent forecast. The cash model (app), the ads plan (`ads-plan.json`,
`monthly-plan.json`) and capacity (`STRATEGY.md`, the site's hours) were each written at a
different time to a different set of owner decisions.

Written to the clinic repo: `ops/model/model-12-months.json` (built by `ops/model/build.js` from
`ops/model/cash-model-export.json`, the ads plan, `pathway.json` and `clinic.json`) and
`ops/model/README.md` (how each line is refreshed). It holds 24 labelled assumptions, 7 conflicts
with the winning source, what has been measured, and 12 months of: new patients, takings by clinic
(low, forecast, high; Bedhampton on two days and on one), ad spend (model, plan, ceiling), capacity,
bank (as built and with the owner's later decisions applied) and what falls due.

| Month | Winchester new patients (forecast) | Winchester takings | Bedhampton, 2 days / 1 day | Ads: model / plan | Bank at month end: as built / decisions applied |
|---|---|---|---|---|---|
| Dec 26 | 60 booked on 1 Nov (mostly free consultations) | 4,400 | 7,734 / 5,997 | 600 / 935 | 10,608 / 9,141 (below floor) |
| Jan 27 | 22 | 7,567 | 7,375 / 5,578 | 600 / 1,120 | 15,483 / 12,752 |
| Feb 27 | 22 | 9,403 | 7,044 / 5,199 | 600 / 860 | 21,523 / 17,501 |
| Mar 27 | 16 | 8,278 | 6,939 / 5,042 | 600 / 805 | 18,364 / 13,395 |
| Apr 27 | 16.25 | 8,575 | 6,827 / 4,891 | 600 / 900 | 23,331 / 17,552 |
| May 27 | 16.5 | 8,767 | 6,776 / 4,802 | 600 / 930 | 26,454 / 19,959 |
| Jun 27 | 16.75 | 9,107 | 6,703 / 4,698 | 600 / 845 | 23,295 / 16,254 |
| Jul 27 | 17 | 9,452 | 6,583 / 4,559 | 600 / 775 | 28,261 / 20,352 |
| Aug 27 | 17.25 | 9,744 | 6,533 / 4,485 | 600 / 620 | 33,227 / 24,602 |
| Sep 27 | 17.5 | 10,014 | 6,456 / 4,391 | 600 / 1,050 | 30,069 / 20,857 |
| Oct 27 | 17.75 | 10,332 | 6,457 / 4,365 | 600 / 1,085 | 35,035 / 25,207 |
| Nov 27 | 18 | 10,693 | 6,460 / 4,339 | 600 / 1,090 | 40,001 / 29,988 |

All figures are forecasts from the cash model run on 15 Nov 2026 from a bank balance typed on
9 Nov. "Decisions applied" is the same model with Bedhampton on one day from December and ads at
918 a month (the plan's 12 month average), re-run in memory and not saved. Actual columns are null
until the month happens.

Which source wins where they disagree:

| Conflict | Winner | Why |
|---|---|---|
| Bedhampton days (2 in the model, 1 per the owner) | Owner, 22 Oct: one day | The later decision; the model was not updated |
| Ad spend (600 a month, or 25 to 40 a day) | The ads plan, as a ceiling | Agreed 15 Nov, and it is what is being spent |
| Winchester's week (3 days, or 4) | The published hours | They are what patients can book |
| Patient value (168 / 400 / 62%) | Neither yet | Bedhampton prices with Winchester's margin; replace with Winchester's own invoices |
| Winchester prices (app column, site, ANS) | Site and ANS where they agree | What patients are quoted and charged |
| Skin analysis price after opening | Owner, 14 Nov: free to the end of Feb | The later decision |
| ROAS targets | `ads-plan.json`: 1.8x and 4.5x | Changed last, with a source |

Missing inputs, left null with a note in the model: Winchester actual takings and new patients
(from 8 Dec); attended and paying ad patients (from 11 Dec, a rate from mid January); diary fill
(first read 16 Nov); real bank balance (typed); VAT return dates and amounts; a second clinician's
cost, takings and start date.

## 4. The automation

### Every scheduled run

| Run | Where it runs | When | Reads | Writes | Recent runs | What stops it unattended |
|---|---|---|---|---|---|---|
| `ads-pathway-check` | Local task | 08:00, 12:00, 16:00 daily | Meta connector, GHL connector, ANS and Clarity in Chrome | `pathway.json`, `state.json`, board artifact, ALFRED ads snapshot, activity row | 2 runs, both 15 Nov, both succeeded. The 08:00 slot has never run | Desktop app closed or PC asleep; Chrome extension not connected or ANS signed out (it then carries on without ANS and says so); Meta or GHL connector token expired. The Meta, Artifact and tool search calls are not on the allow list and pass only through auto mode |
| `clinic-board-refresh` | Local task | 07:30 daily | ANS in Chrome | `clinic.json`, ALFRED clinic snapshot, activity row | **Never run**. First run 16 Nov | As above; all of it depends on ANS in Chrome. Its creation was refused once by the safety check |
| `meta-evergreen-review` | Local task | Mon and Thu 09:30 | Meta connector, GHL connector | `optimisation-log.md`, email, proposals. May pause a losing ad | **Never run**. First run 16 Nov | Desktop app; connectors. Pausing an ad is a write to the ad account and may be held by the safety check |
| `ads-capacity-review` | Local task | Mon 12:30 | ANS in Chrome, Meta connector, `pathway.json` | `pathway.json` capacity and outcomes, log, email, proposals | **Never run**. First run 16 Nov | Chrome and ANS; it overlaps the 12:00 pathway run, which also uses ANS in Chrome |
| `weekly-gsc-refresh` | Local task | Sun 20:00 | Search Console in Chrome | `seo/targets.json` | Ran 8 and 15 Nov; on 15 Nov there was nothing to do | Redundant since the GitHub Action went daily. Missed 1 Nov with the PC off |
| `google-ads-keyword-optimisation` | Local task, **disabled** | Mon and Thu 09:15 | Google Ads in Chrome | Google Ads, log | Last ran 12 Nov, no changes | Off. See A6 |
| `winchester-opening-switch` | Local task, one-off | 8 Dec 07:00 | Repo, ANS, Google Ads | **Live site, ANS prices**, email | Not yet | Chrome and ANS at 07:00 on opening day; written to superseded terms (P6). Do not let it run as written |
| `meta-evergreen-opening-draft` | Local task, one-off | 4 Dec 09:00 | Meta connector, Desktop photos | Draft file, email | Not yet | Its brief contradicts the ads plan (P6) |
| `monthly-newsletter-slot-update` | Local task | 27th, 09:00 | Repo | A reminder | Ran 27 Aug, 27 Sep, 27 Oct | Desktop app only |
| `seasonal-nurture-slot-rotate` | Local task | 25 Feb, May, Aug, Nov | Repo | Draft copy, reminder | Ran 25 Aug | Desktop app only |
| Refresh SEO targets | GitHub Action | Daily 03:17 UTC | Search Console API | `seo/targets.json` | Commits on 14 and 15 Nov | Nothing local. Fails only if the Google sign-in federation breaks; GitHub emails on failure |
| Live site check | GitHub Action | Daily 04:50 UTC | The live site | Nothing | Not checked (no GitHub CLI on this PC) | Nothing local |
| Weekly SEO, daily health watch, Tuesday citations, weekly journal | Cloud routines | Mon 07:00 UTC; daily 05:30 UTC; Tue | Repo, Gmail (Semrush emails) | Site commits, emails | Routine commits seen on 13 Nov; routine list not opened in this audit | Nothing local. Cannot sign in to anything; cannot reach ALFRED's database |
| `alfred-morning-brief`, `alfred-money-watch`, `alfred-content-planner`, `alfred-ux-audit` | **Do not exist** | Run books say 07:45 daily, Mon 07:00, Fri 10:00, the 1st | ALFRED | Email, proposals | None | Not created. Names and times disagree with the plan and the heartbeat (C4) |
| Search and reviews (plan: Tue 08:30) | **Does not exist** | | | | None | No task and no run book |

Unregistered folders with prompts but no task: `gads-v2-daily`, `gads-v2-weekly-report`,
`gads-v2-monthly-review`, `ab-test-day1-check`, `ab-test-halfway-check`.

### Every data source in the plan: who refreshes it, and how old it may get

| Source | Owner run | Freshness limit | State on 15 Nov | Gap |
|---|---|---|---|---|
| Meta spend, leads | Pathway check | 26 hours; stale 2 hours after a missed slot | Fresh, 19:05 | None |
| GHL leads and replies | Pathway check | Same | Fresh | None |
| ANS bookings, outcomes | Pathway check (outcomes at 08:00) | Same | Fresh; outcomes not yet measurable | First 08:00 run is 16 Nov |
| Clarity | Pathway check | Same | Fresh | None |
| ANS takings and diary | Clinic refresh | 26 hours | Read by hand 15 Nov, 19:44 | Task has never run |
| Diary fill, 21 days | Capacity review | none set (suggest 8 days) | Not measured yet | No freshness rule |
| Search Console | GitHub Action | 72 hours | Fresh, 15 Nov | ALFRED's copy is pushed by no run (C5) |
| Semrush | One snapshot, 19 Sep; weekly emails | Never refreshes | Labelled as such | None |
| Filming queue | Content planner | 14 days | Pushed by hand 15 Nov | Task not created |
| Bank balance | The owner types it | 7 days | 6 days old | **No run can do this.** Money watch should ask; its task does not exist |
| Cards | Typed into the register | 31 days | Last entry 7 Nov | No prompt; no statement date check (Barclaycard statement on the 19th) |
| Cash model actuals (takings, new patients into the model) | Nobody | none | Hard-coded to 30 Sep | **Gap.** Needs the build change in M7 |
| 12 month model | Nobody yet | suggest 7 days | Built by hand 15 Nov | Needs `export-cash-model.mjs` and a Monday rebuild |
| VAT dates and amounts | Nobody | none | Absent | **Gap.** Owner or accountant supplies; then money watch reads |
| Google reviews, rating, competitors | Nobody | suggest 8 days | Read by hand 15 Nov: Winchester 0, Bedhampton 100 at 5.0 | **Gap.** Search and reviews run does not exist. The ads plan's Google trigger ("about 20 reviews") depends on it |
| Citations and links | Tuesday cloud routine | weekly | Not checked here | ALFRED does not read its output |
| Compliance dates | Nobody | per item | None entered | **Gap** (C1) |
| Stock | Nobody; Abi from her screen | weekly | No table, no data | **Gap.** Manual by design |
| Task statuses | Nobody | none | Stale (C2) | Manual only |
| Due back, reviews asked and received | Clinic refresh, from opening | daily | Not built | No run book yet |
| Follow-up drafts | Plan says the pathway agent drafts them | daily | The run book says it never proposes | Plan and run book disagree |
| Google Ads spend | Nobody (tasks off) | daily if live | Unknown (A6) | **Gap** if the campaign is live |

### The most reliable way to run each

- **Cloud, no laptop needed (most reliable).** Anything read through an API or connector: Search
  Console (already an Action), the live site check, Meta spend and GHL leads, Google reviews through
  Local Falcon, Semrush emails. Move the Meta and GHL half of the pathway check and a new weekly
  reviews read to cloud routines, so those numbers survive a closed laptop. Blocker to fix first:
  a cloud routine cannot reach ALFRED's database. **Build**: one token-protected endpoint on the
  hosted app (`POST /api/ingest/<key>`) that accepts a snapshot or an activity row, so no database
  password leaves the laptop.
- **Local scheduled task (works only while the desktop app is open, the PC is awake, and Chrome is
  connected and signed in).** Everything that needs ANS or Clarity: takings, diary, bookings,
  attendance, outcomes, due back. ANS has no API and no connector. Make these honest rather than
  silent: each run logs failed or partial when Chrome is missing, and the heartbeat reports a run
  that never started. Ask ANS whether it can email a scheduled financial report; if it can, takings
  move to the cloud through Gmail. Space the ANS runs so two never use Chrome at once (move the
  capacity review to 13:15).
- **A prompt to the owner (cannot be automated, and should not be).** The bank balance (no feed;
  Claude does not sign in to banking), card balances and Barclaycard terms, VAT returns filed and
  paid, compliance renewal dates, the loan draw date, task statuses, stock (Abi), and every decision
  in section 6. ALFRED's job here is to ask on time: a card on Today when the bank is over 7 days
  old, on the 20th for the card statement, and 30 days before any dated item lapses.
- **Never unattended.** Budget changes, new ads, publishing, messages to patients, Google profile
  edits, ANS prices, the live site on opening day. These wait for a yes in a live session.

Allow list. `.claude/settings.local.json` holds 28 rules: Chrome, six GHL reads, three Gmail calls,
file tools, `node`, `python`, `npm run build` and git. It has no rule for the Meta Ads connector
reads, the Artifact publish, Local Falcon or tool search, so those calls rest on auto mode each
time. For the owner to paste if a run stalls on a prompt: the read-only Meta tools
(`ads_get_ad_accounts`, `ads_get_ad_entities`, `ads_get_creatives`, `ads_insights_performance_trend`),
`Artifact`, `ToolSearch`, the Local Falcon read tools, and `mcp__a7fd48c1...opportunities_get-pipelines`.

## 5. What was fixed in this audit (clinic repo)

| File | Before | After | Source |
|---|---|---|---|
| `ads/STRATEGY.md` | ROAS targets 2.5x first visit, 6x year one | 1.8x and 4.5x | `ads-plan.json` targets; commit 1857d99 |
| `ads/STRATEGY.md` | "twice-daily pathway check (12:00, 16:00)" | three times a day (08:00, 12:00, 16:00), plus the daily clinic refresh | Task cron `0 8,12,16 * * *` |
| `ads/STRATEGY.md` | "first consultations are 2 Dec 2026 onwards" | first ad lead consultation booked is 11 Dec 2026; model days are not ad leads | `pathway.json` apptIso |
| `ads/STRATEGY.md` | 400 and 245 with no basis | basis stated: Bedhampton prices, Winchester margin, a planning figure | `cash-model-defaults.ts` PATIENT_MODEL, WINC_KEEP_PCT |
| `ads/meta/pathway/ads-plan.json` | assumptions with no source | `basis` added beside them | Same |
| `ads/meta/pathway/state.json` | "twice-daily" | 08:00, 12:00 and 16:00 | Task cron |
| `ads/meta/pathway/README.md` | "run twice a day"; checks covered leads and bookings only | three times a day; added sum checks, a no-future-timestamp check, and "name the source that could not be read" | Task cron; A8 |
| `ops/clinic/REFRESH.md` | "could not be created... waiting to be scheduled" | scheduled, first run 16 Nov; six accuracy checks; timestamp rule; activity log step; monthly model rebuild | Task list; A8 |
| `ops/clinic/clinic.json` | updated 20:40 (in the future) | 19:44, when it was saved | Commit 886c7df; DB snapshot 19:44:43Z |
| `ops/model/` (new) | nothing | `model-12-months.json`, `cash-model-export.json`, `build.js`, `README.md` | Section 3 |

Not changed, by instruction: the database, anything in Clinic-Launch outside `docs/`, the live site
pages and site data, ads, CRM, ANS, the Google profiles, the scheduled task prompts, the owner's
memory notes.

## 6. Decisions only the owner can make

1. **Bedhampton**: one day a week from 8 December, confirmed? Which day? (M3, O7)
2. **Bank**: today's balance, and whether the 10,000 gift is in it. (M1, M2)
3. **The 13,000 loan**: the date it will be drawn. (M5)
4. **Ad spend in the money model**: 600 a month, or the ads plan's 25 to 40 a day, knowing the bank
   dips under 10,000 in November and December with the plan. (M4)
5. **Skin analysis**: free until the end of February, 50 redeemable from 1 March, confirmed? Then
   the site and the 4 Dec and 8 Dec tasks are corrected. (P6)
6. **The 8 December switch**: allowed to change the live site and ANS prices unattended at 07:00, or
   run in a live session that morning?
7. **Bedhampton Google profile**: remove "Botox treatments" from its services. (O8)
8. **Google profile, Winchester**: opening date 2 Dec or 8 Dec; closing 17:00 or 17:15; the new
   description for opening day. (O2, O3, O4)
9. **Prices**: filler 0.5ml 180 or 200, 2ml 495 or 500; the microneedling face and neck anomaly;
   Sculptra at Bedhampton; Black Friday prices by 19 Nov, including skin boosters at 345 against the
   introductory 340. (P2 to P5)
10. **Google Ads**: is campaign v2 paused? (A6)
11. **Cards**: Barclaycard end date, APR, due day, minimum; a direct debit on both. (M13)
12. **VAT**: confirm monthly returns and their due dates. (M14)
13. **Compliance**: the renewal dates in C1. **Tasks**: update or archive at opening. (C1, C2)
14. **New patient room**: how many new patients a week Abi can see alone. (M11)
15. **Second clinician**: a date, or "not before". (M19)

## 7. Instructions for the build agent

1. **Compliance badge and page** (C1): remove the percentage. Dated items only; badge reads "n due
   in 60 days" or "no dates entered yet". Do not render the CQC seed rows.
2. **Opening date** (M17, M18): one constant, 2026-12-08, used everywhere; correct
   `projects.target_opening_date`; drop or banner the "2 November" strings on archive pages.
3. **No percentages built on stale tables** (C2): launch readiness and task completion show the
   date each task was last touched, or nothing.
4. **Cash model inputs** (M3 to M9), each only after the owner's answer in section 6:
   `bedh.plan.oneDayFrom`; marketing read from the ads plan; Winchester capacity from published
   hours; Bedhampton actual months and the history block from the clinic snapshot; the December
   cohort from the clinic snapshot once it splits by clinic.
5. **Bank** (M1, M2, M5): when a balance is saved, list every funding row dated on or before it
   and require a tick or a new date. Over 7 days old: label every forecast line stale. Show
   unconfirmed inflows apart from the floor test.
6. **Cards and obligations** (M12 to M14): start card debt from `credit_cards` and `card_entries`
   per card; directors' loans separate; each card repaid before its own 0% end; unconfirmed card
   fields shown as "to confirm"; VAT return dates and estimates once supplied.
7. **Heartbeat** (C3, C4): one agent table for names and times; every listed agent expected from a
   start date whether or not it has ever logged; `log-run.mjs` and `push-board.mjs` refuse a
   timestamp later than now.
8. **Freshness rules**: add `reviews` (8 days), `model` (7 days), `diaryFill` (8 days),
   `compliance`, `stock`. The `seo` and `videos` snapshots need a scheduled push (C5).
9. **Ads Board** (M10, A2, A3): label patient value "Bedhampton prices, March to September 2026";
   show the required booked-to-paying rate beside the measured one from January; "three times a
   day" in the five places listed in A2.
10. **Treatments table** (P1): read `actual_price_winchester`, or sync the table from the site's
    treatment files.
11. **Model**: add `scripts/export-cash-model.mjs` exactly as `ops/model/README.md` in the clinic
    repo describes; push `model-12-months.json` as board key `model`; Stands Alone and Takings read
    it, showing forecast beside taken and booked.
12. **Clinic takings** (A10): every figure labelled taken or booked; read the per clinic numbers the
    refresh now adds beside `byClinic`.
13. **Cloud ingest**: a token-protected `POST /api/ingest/<key>` on the hosted app for snapshots and
    activity rows, so cloud routines can feed ALFRED without the database password.
14. **Run book mismatches to settle with the clinic repo** (C4): `ops/alfred-runs.md` against
    `ALFRED-PLAN.md` section 4 and `heartbeat.ts`.
