# ALFRED UX audit (November 2026)

The Auditor's record (method in the clinic repo, `ops/alfred-runs.md`, Auditor). Every page in the
navigation opened at 375 by 812 (Browser pane, preset mobile), signed in to the local API on the
production database, read only. Each page scored 0 to 2 on three questions:

- **See**: can David see what matters within 5 seconds?
- **Real**: is every figure real and dated?
- **Told**: is there nothing he has to work out that ALFRED should have told him?

Overflow is `scrollWidth` against `innerWidth`, plus any element whose right edge passes the screen
outside a scrolling box (the page hides horizontal overflow, so clipping does not show in
`scrollWidth` alone; inside the framed boards the same check runs on the frame's document).
Length is document height over screen height; command pages should be no more than 2.

## 17 November 2026

### Scores

Before is the first pass; after is the same page re-opened at 375px once the fixes below were in.
Length is in screen heights.

| Page | See | Real | Told | Before | After | Length before, after | Overflow |
|---|---|---|---|---|---|---|---|
| Today `/` | 2 | 1 to 2 | 1 to 2 | 4 | 6 | 3.8, 3.5 | none |
| Money `/money` | 2 | 2 | 1 to 2 | 5 | 6 | 4.4, 3.3 | none |
| Build Cash Board | 1 | 2 | 2 | 5 | 5 | 11.7 (detail) | none, inside the frame too |
| Stands Alone | 2 | 2 | 2 | 6 | 6 | 3.7 (detail) | none |
| Takings | 2 | 1 to 2 | 1 to 2 | 4 | 6 | 3.0 (detail) | none |
| Obligations | 1 | 1 to 2 | 1 to 2 | 3 | 5 | 4.0 (detail) | none |
| Cash Line | 2 | 2 | 1 | 5 | 5 | 9.4 (detail) | none |
| Money Plan | 2 | 2 | 1 | 5 | 5 | 37.2 (detail) | none |
| How the numbers are built | 2 | 1 | 2 | 5 | 5 | 30.4 (detail) | none |
| Growth `/growth` | 2 | 2 | 2 | 6 | 6 | 6.4, 3.2 | none |
| Ads | 2 | 2 | 2 | 6 | 6 | 3.4, 2.8 | none |
| Every ad and audience | 1 | 2 | 2 | 5 | 5 | 2.8 | none |
| Last 14 days | 0 to 1 | 2 | 1 to 2 | 3 | 5 | 4.1, 2.2 | **inside the frame: fixed** |
| Simulator | 1 | 2 | 2 | 5 | 5 | 3.1 | none |
| How it works | 1 | 2 | 2 | 5 | 5 | 1.7 | none |
| Plan | 1 | 2 | 1 | 4 | 4 | 46.2 (detail) | none |
| Studio | 2 | 2 | 2 | 6 | 6 | 3.3 | none |
| Search and reviews | 2 | 1 to 2 | 2 | 5 | 6 | 4.6 | none |
| Market | 0 to 2 | 1 to 2 | 0 to 1 | 1 | 5 | 5.3, 5.7 | none |
| Patients `/patients` | 2 | 1 to 2 | 2 | 5 | 6 | 3.0, 2.4 | none |
| Pathway | 2 | 2 | 2 | 6 | 6 | 8.1 (detail) | none (table scrolls in its box) |
| Due back | 2 | 2 | 2 | 6 | 6 | 1.0 | none |
| Reviews | 1 to 2 | 1 to 2 | 1 to 2 | 3 | 6 | 1.0 | none |
| Clinic `/clinic` | 2 | 2 | 2 | 6 | 6 | 3.0, 2.2 | none |
| Diary | 1 | 2 | 2 | 5 | 5 | 3.0 | none |
| Team and capacity | 2 | 2 | 1 | 5 | 5 | 4.7 | **two buttons cut off: fixed** |
| Compliance | 0 to 2 | 0 to 1 | 0 to 1 | 0 | 4 | 3.6, 4.1 | none |
| Stock | 2 | 2 | 2 | 6 | 6 | 1.0 | none |
| Opening checklist | 0 to 2 | 0 to 1 | 0 to 1 | 0 | 4 | 11.5, 11.8 | none |
| More | 2 | 2 | 2 | 6 | 6 | 2.3 | none |
| Inbox | 2 | 2 | 2 | 6 | 6 | 12 (list) | none |
| Activity | 2 | 2 | 2 | 6 | 6 | 17.2 (list) | none |
| Sources | 2 | 2 | 2 | 6 | 6 | 2.2 | none |
| Abi `/abi` | 2 | 2 | 2 | 6 | 6 | 3.7, 2.9 | none |
| Ready for Winchester `/abi/ready` | 2 | 2 | 2 | 6 | 6 | 3.6 | none |
| Settings | 2 | 1 to 2 | 2 | 5 | 6 | 1.0 | none |
| Build | 2 | 2 | 2 | 6 | 6 | 9.0 (list) | none |

37 pages. Total before 177 of 222; after 203 of 222. No page has horizontal page scroll.

### Failures found, and what was done

1. **Last 14 days ran off the screen.** Inside the framed board, a card's grid column sized itself
   to the 620px chart, so the card's headline paragraph and both charts were 5,500px wide and
   clipped. Fixed for every server board: a card is one column no wider than itself; long
   accuracy-check pills wrap.
2. **Today said 15 were waiting for a word; the Inbox had 11.** The section count used the brief's
   total, which also counts the four warnings. It now counts from the Inbox. The verdict's "15
   things need you" is right and stays.
3. **Today's bank line said "Now £31,930" while the bank was £15,762.** Every point on that line is
   a month-end from the plan; the first is now named "End of Nov".
4. **Takings called last week "This week".** The second row read "This week (from Mon 9 Nov)
   £2,212"; it now reads "Week from Mon 9 Nov".
5. **Card offer end dates had no year.** "0% purchases to Wed 30 Aug" and "0% money transfers to
   Mon 30 Aug" are a year apart (2028 and 2027). They now carry the year.
6. **Search window as raw dates and "1 clicks".** Now "16 Oct to 12 Nov" and "1 click".
7. **Patients showed a source age on figures that do not exist yet** ("Not measured yet ... ANS
   takings, 6 h ago"). A figure not measured yet now carries no age.
8. **Reviews said "Not measured yet" with no date**, on a Tuesday after the 08:30 run. It now names
   the next run (Tuesday 24 November).
9. **Settings gave the morning brief as 07:45**; the run and the heartbeat say 07:55. Corrected.
10. **Compliance read "0% compliant" across 47 items** while Bedhampton trades. It now opens with a
    sentence saying it is the planning-era tracker, that its figures are only what was ticked, and
    that the dated items that can lapse are not tracked yet and feed nothing.
11. **The opening checklist read "Time to open date 63 days"** with 21 days to go. The 63 is the
    start date (6 Oct) to opening (8 Dec); it is now labelled so, and the page opens with
    "Winchester opens on Tue 8 Dec, in 21 days" from the plan's own opening date.
12. **Market opened on a wall of leakage text with no date.** It now opens with what it is (the
    verified capture of 31 August 2026, with VAT) and that it does not refresh.
13. **Team: Re-plan with AI and Add role ran off the right edge.** The rows wrap.
14. **Command pages too long.** Growth was 6.4 screens. On a phone each second chart now sits one
    tap below its sentence ("Show the chart" style buttons; open as before from 640px wide), area
    pages list their pages as pills, questions are one line into the Inbox, an eyebrow that only
    repeats the title is dropped, Growth no longer draws the funnel twice, and Abi sees three clips
    with the rest one tap away.
15. **Dashes and the serif.** Headings everywhere are now the one sans family; the em and en dashes
    are out of the visible copy of the planning-era pages still in the navigation (project plan,
    compliance, people, market, competitors).

### Still failing, with the reason

- **Length.** Today (3.5), Money (3.3), Growth (3.2), Ads (2.8), Abi (2.9), Patients (2.4) and
  Clinic (2.2) are still over two screens at 375 by 812. What is left on them is what the plan puts
  there (verdict, four figures, up to three warning cards, the week's dates, the questions); the
  warning cards alone are about 550px on Growth and Ads. Getting under two screens needs a decision
  on how much of the brief to show, not a layout fix. Proposal: on a phone show one warning card
  and the first three dates, with the rest one tap away.
- **How the numbers are built**: two growth model descriptions drop the pound sign ("about 60
  people, 4,400"; "4,000 in December to 14,700 in June 2027"). They are server copy beside the
  model figures and were left alone in this pass.
- **Compliance and the opening checklist** are still the planning-era pages underneath their new
  sentence. The plan's Compliance (only dated items that can lapse) is a build item, not a design
  fix.
- **Obligations, Plan, Diary, Every ad, Simulator, How it works** open on a one-line description
  rather than a verdict; they are detail pages under a command page that carries the verdict.
- **Cash Line and Money Plan** repeat the whole Money summary above their board.
- About 40 retired archive files still contain dashes; they are not in the navigation.
