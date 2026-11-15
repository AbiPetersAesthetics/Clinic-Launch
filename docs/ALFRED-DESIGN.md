# ALFRED design system (15 November 2026)

The owner's brief: "make it really easy to understand and digest, like a proper company has built
it." The standard is a product team's work (Stripe's dashboard, the FT graphics desk), not a
dashboard template. The logo and the navy ink are the anchor; everything else serves reading.
Reference screens: **Today** (`pages/home.tsx`) and **Growth** (`pages/growth/command.tsx`). Every
other screen follows them. Charts are in `components/charts.tsx`.

## The seven rules

1. **One idea per section, led by a plain sentence.** "Each booked consultation is costing £13.25.
   Our limit is £30." A non-analyst understands it without the chart; the chart proves it.
2. **Comparisons are pictures, not text.** A figure sits against its limit or last week as a bullet
   bar, the pathway is a funnel with proportional widths, the diary is a filled bar per day, the
   year is a timeline, money is a line with the £10,000 floor drawn on it.
3. **Label directly.** Words sit on the chart. No legends, no axis clutter, no abbreviations ("cost
   per lead", never CPL), no jargon.
4. **Colour means one thing.** Green on target, amber watch, red problem. Everything else is ink
   and grey. Every chart must still read in greyscale; status is always a dot plus a word.
5. **Strong hierarchy.** One large sentence or figure per section, generous space, short lines,
   16px minimum body on phones. Small print is a single source-and-age line.
6. **Cut ruthlessly.** A number that does not change a decision goes to a detail page or goes. No
   grids of eight tiles, no tables on command screens, at most four figures a screen.
7. **Tables only on detail pages,** designed: right-aligned numerals, clear headers, hairline rows,
   a sticky first column on phones, best and worst rows marked.

## Contrast (owner, 15 Nov 2026: "washed out and hard to digest")

- Every text and background pair passes WCAG AA, 4.5 to 1. Measured on white: ink `#1F2A44` 14.3,
  ink 2 `#3A4458` 9.8, muted `#4A5568` 7.5, slate `#445B72` 7.0, problem text `#A33A3A` 6.5, watch
  text `#8A5A12` 5.9, good `#1E8449` 4.7. Nothing lighter than `#4A5568` is used for text.
- Body text is ink at full strength; ink 2 is for the second line only.
- Headings are heavy (800 for page titles and section labels, 700 for card titles and sentences).
- Sections are broken by a 2px ink rule and real space; cards have a 1.5px `#AEB7C6` edge.
- One strong accent per screen: the verdict sits on a solid navy band in white type.
- Status is a solid dot (good, watch or problem colour) and a bold label, never a tint.
- Charts use solid ink and slate; no pastel fills.
- A card is one line of why, one number, one action; the rest is behind "Show evidence".

## Type

One family, Mulish (sans), with system fallbacks. Serif is no longer used in new screens.

| Role | Size (phone / desktop) | Weight | Notes |
|---|---|---|---|
| Page title | 28 / 34px | 600 | tracking -0.015em |
| Verdict sentence | 22 / 27px | 600 | at most 30 characters a line on a phone, 44 on desktop |
| Section sentence | 18 / 20px | 600 | one per section |
| Hero figure | 48px | 600 | proportional figures; one per view at most |
| Figure in a row | 26 / 32px | 500 | |
| Body | 16 / 15px | 400 | line height 1.5 |
| Label | 13px | 600 | small capitals, tracked 0.14em |
| Source and age | 12 to 13px | 400 | the only small print |

Columns of numbers use tabular figures; standalone figures use proportional ones.

## Colour roles

| Role | Hex | Use |
|---|---|---|
| Ink | `#1F2A44` | text, the measured mark in every chart |
| Ink 2 | `#3A4458` | secondary text, chart labels |
| Muted | `#4A5568` | axis words, the source line |
| Track | `#E7E9EE` | the unfilled part of a bar, hairline rules |
| Baseline | `#C5CAD3` | comparison marks, upcoming items |
| Good | `#1E8449` | on target (with the word) |
| Watch | `#B5800C` | watch (with the word) |
| Problem | `#C0392B` | problem (with the word), money under zero |

The three status colours pass the colour-blind separation check (dataviz validator, light, white
surface); amber is under 3:1 on white, so it always carries a word.

## Spacing

4px base. 16px phone gutter. 20px between items in a section, 40px between sections. Cards (12px
radius, hairline border, no shadow) only for things that need a decision.

## Charts

- **Bullet** (figure against its limit): grey track, the measured bar in the status colour, the limit
  as a 2px ink tick, value and limit named on the chart.
- **Funnel**: stages as bars proportional to the first; the count at the bar end; stages not yet
  measurable drawn as an outline with the date they start.
- **Day columns**: one series in ink, the latest value labelled, first and last day named.
- **Balance line**: 2px ink line, the £10,000 floor drawn and named as a reference line (not an
  alarm, owner 15 Nov), the lowest month labelled; months below zero marked in the problem colour.
- **Diary bars**: one bar per clinic day, booked against open time, the share at the right.
- **Timeline**: months across the top, each campaign named on its own line with its bar below, live
  ones in ink, the rest grey; today a thin ink line.

No dual axes, no pies, no legends for a single series, no gridlines beyond a hairline, no motion
beyond a 150ms fade.

## Copy

Plain, specific, British. Say what happened and what to do. Never "insights", "leverage",
"unlock", "optimise", exclamation marks, em or en dashes. Empty states say what will appear, which
run fills it and when.
