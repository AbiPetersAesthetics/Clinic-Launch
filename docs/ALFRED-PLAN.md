# ALFRED: the complete clinic operating system (master plan, 15 November 2026)

This plan supersedes the phase list in `UX-PLAN-2026-11.md` (its design system, freshness rules,
proposal queue and wireframes still stand). The owner has handed the product over: "take this from
me and completely overhaul it, adding or removing elements and pages, to make this the complete
ALFRED clinic OS." Decisions below are made, not open questions.

## 1. What ALFRED is

The owner (David) is high level. ALFRED does the rest: it reads every system the clinic runs on,
tells him what matters, proposes what to do with the evidence, and acts once he says yes. Abi, the
nurse prescriber, gets her own simple screen so she knows what to film, who to message and how her
week looks. Nobody opens ALFRED to hunt for a number.

Three promises on every screen:

1. **Told, not shown.** Each screen opens with a verdict sentence, at most four figures, at most
   three "needs you" cards and one line on what is next. One phone screen, one scroll. Detail is one
   tap away.
2. **True or absent.** Every figure carries its source and age. Stale data is labelled and never
   feeds a verdict. What cannot be measured yet says "not measured yet" and the date it will be.
   No estimates dressed as facts, no historic stand-ins.
3. **One yes.** Anything ALFRED wants to do arrives as a card with evidence and Approve, Reject or
   Ask. Spend, publishing, messages to patients and deletions always wait for a yes. Reading,
   measuring, drafting and tidying never do.

ALFRED holds no clinical records. Patients appear as first name and initial at most; everything
clinical stays in ANS.

## 2. The areas (final navigation)

Phone: a bottom tab bar, left to right **Today, Money, Growth, Patients, Clinic** (Today under the
left thumb; a setting flips it). The logo opens More. Desktop: the same five in a slim sidebar,
Ctrl+K to jump anywhere.

### Today
- The brief: one overall verdict, the "needs you" inbox (max five shown, rest behind "all"), the
  verdict line of each area, and "what ALFRED did" (last runs, plain sentences).
- Dates this week: one merged list from every area (campaign switch-ons, filming due, VAT, card 0%
  ends, insurance renewals, opening milestones).
- Bank balance prompt when the typed balance is over 7 days old.

### Money
- **Command:** bank today, lowest point ahead and when, takings this week taken against booked,
  what is due out in the next 14 days.
- **Build Cash Board** (the owner's master record: unchanged content, kept as the detail page).
- **Stands Alone** (new): the business record's test, Winchester's own contribution covering full
  running costs, James's repayment and the £3,000 kept, two months running; it decides Bedhampton
  and when Abi's pay starts. Shows this month against the line and the forecast month it is met.
- **Takings:** taken, booked, by clinic, by week, against the Money Plan forecast.
- **Obligations** (new): VAT return dates and estimated amount, card balances with 0% end dates,
  directors' loan, James's and Bill's repayments, in date order.
- Cash Line and Money Plan stay as detail pages. Credit Cards and Owed fold into Obligations.

### Growth
- **Command:** cost per booked consultation, cost per paying patient, ROAS against the industry
  figure, leads and bookings this week against last, live campaigns and the next switch.
- **Ads:** every ad and audience, last 14 days, the simulator.
- **Plan:** the 12 month calendar and month by month (Black Friday included), with Ideas folded in
  as a tab. Launch Marketing retires into the archive.
- **Studio** (new, replaces the Social Board): Abi's filming queue from `videos.json` (next to
  film, film-by date, hook, script link, the campaign it feeds), what is live, and how posts and
  Reels performed.
- **Search and reviews** (new, replaces SEO Board and Backlinks): rankings for the tracked
  Winchester and Bedhampton queries (3 day stale rule), Google profile review count and rating
  against named competitors, citations and links progress.
- **Market:** prices, offers and competitors (existing merged page).

### Patients
- **Command:** new patients this month, consultations that became treatments, returned within the
  period, no-show rate.
- **Pathway:** every lead from ad to diary to paying to returning (the lead table, with match
  method), plus bookings that came from outside the ads.
- **Not booked yet** (inside Pathway): leads that have not booked and consultations that have not
  converted, as a count and a list (first name and initial, days waiting). When a follow-up is worth
  sending, ALFRED raises one approval card ("4 leads have not booked after 2 days. Send each a
  personal WhatsApp from the clinic number?" with the message shown); on a yes the messages go
  through GHL in the next live session. Nothing is sent unattended. (Owner, 15 Nov 2026: a page of
  drafts was not useful; every page that only shows drafts or what Claude could answer becomes a card
  with an action, or goes.)
- **Due back** (new, from opening): patients whose course or review is due (counts and first name
  with initial), read from ANS; the biggest lever on return visits.
- **Reviews** (new): reviews received this month, asked against received, the next to ask.

### Clinic
- **Command:** diary fill next 21 days by clinic, hours booked this week, days to opening (until 8
  Dec), anything expiring.
- **Diary:** the day by day view, taken against booked, online share.
- **Team and capacity:** the second clinician trigger (demand proven against the capacity cap),
  then the Patient Coordinator.
- **Compliance:** only dated items that can lapse: insurance, registrations, training, policies,
  consent forms for filming; each with its renewal date feeding Today.
- **Stock** (new, simple): Obagi and consumables with a reorder point, updated by Abi from her
  screen; low items become cards.
- **Opening checklist:** Plan and Timeline until 8 Dec, then it archives itself.

### Abi (new, `/abi`)
One phone screen for Abi: today and tomorrow in the diary (counts and times, no patient detail
beyond ANS), decisions she and David make together (marked "decide with", such as Bedhampton's
regular day), what to film this week with the script, reviews to ask for, stock to tick. No money,
no ads tables, no drafted messages. Abi works Tuesday to Saturday, never Mondays.

### More
Inbox (all cards and their history), Activity (every run, what it read and changed), Sources (each
data source, last read, next run, healthy or not), Settings (handedness, notifications), Archive
(every legacy page, nothing deleted).

## 3. What goes

Home tiles, the Opening Board, Ads Ideas as a separate page, Ads Pathway, Launch Marketing, the
Social and SEO WIP stubs, Credit Cards and Owed as top-level pages, the Risks page, Backlinks as a
page, Forecast Model, Today (old) and Weekly Brief (old). All move to Archive or fold into the
pages above. No data is deleted.

## 4. The agents (who does the work)

| Agent | When | Owns | Alone | Needs a yes |
|---|---|---|---|---|
| Pathway | 08:00, 12:00, 16:00 | ads spend, leads, bookings, outcomes, returns, accuracy checks | read, record | one follow-up card when worth sending (messages through GHL after a yes) |
| Clinic | 07:40 daily | takings taken and booked, diary, attendance, due back | read, record | nothing |
| Capacity | Mon 12:30 | diary fill, cost per paying patient, budget step, campaign switches | recommend | budget, switch on or off |
| Creative | Mon and Thu 09:30 | ad health, fatigue, video queue order | reorder queue, draft ads | pause, launch, new creative |
| Money watch | 07:50 daily | bank floor, dues in 14 days, VAT and card dates, Stands Alone | alert | any payment or change |
| Search and reviews | Tue 08:30 | rankings, review counts, citations | read, record, draft review replies | posting replies |
| Brief | 07:55 daily | builds Today, emails only when something needs him | send to accounts@ only | nothing |
| Auditor | 1st of month | opens every screen at phone size against the three promises | file fixes as cards | code changes |

Every run logs to Activity and writes proposals through `push-proposal.mjs`. A missed run shows on
Today and Sources within an hour. If the app refuses to schedule one, its run book goes in the
clinic repo under `ops/` and the refusal is a card on Today.

## 5. Build order (each slice is pushed when it builds; partial is fine)

1. **Shell:** five tabs, More, Ctrl+K, redirects from every old URL, archive moved. Today brief
   finished with the merged dates list.
2. **Command layer on every area** from the summaries: Money, Growth, Patients, Clinic. Detail
   pages split out; no page fails the one-scroll rule.
3. **New pages with data that already exists:** Studio (videos.json), Plan with Ideas, Pathway,
   Follow up (drafts), Takings, Obligations (cards, loans, VAT dates from the cash model), Sources,
   Activity, Inbox.
4. **New pages needing new reads:** Stands Alone (cash model plus takings), Search and reviews
   (seo/targets.json, Google profile via the Local Falcon connector), Due back and Reviews (ANS,
   from opening), Stock (manual list), Abi's screen.
5. **Agents:** run books and schedules for Money watch, Search and reviews, Brief, Auditor; the
   approved-items run book; heartbeat.
6. **Audit:** every screen at 375px against the three promises; scores and fixes written to
   `docs/UX-AUDIT-2026-11.md`; fix what fails; repeat until every screen passes.

Rules for every slice: ALFRED naming; the website's look (white, navy ink, slate, sage, 12px
cards, pill buttons, serif headings); LF line endings; the Build Cash Board must render after every
change; both builds pass before a push; British English; no em or en dashes; no prescription-only
medicine named or priced in anything a patient could see; only real figures.
