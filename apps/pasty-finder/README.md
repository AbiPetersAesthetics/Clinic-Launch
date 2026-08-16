# Proper Pasty — Cornwall pasty finder

Ranks Cornish pasty shops by **reviews**, **opening hours** and **distance from where
you're standing**, for holiday goers who want the best local pasty rather than the
nearest chain.

One self-contained `index.html`. No build step, no dependencies, no server required.
It lives outside the pnpm workspace globs, so it is not part of the Clinic Launch
build, typecheck or deploy.

## Running it

**Quickest** — open `apps/pasty-finder/index.html` in a browser. Everything works
except GPS: browsers refuse geolocation on `file://` origins, so pick your town from
the dropdown or type a postcode.

**With GPS** — serve it over http and the "Use my location" button works:

```sh
cd apps/pasty-finder && python3 -m http.server 8000
# then open http://localhost:8000
```

To use it on a phone while actually in Cornwall, host the single file anywhere
static (GitHub Pages, Netlify drop, any web server). It's one file with no backend.

## How the ranking works

Each shop gets a **Pasty Score** out of 100 — a weighted blend of three signals,
shown as three bars on every card so you can see what drove the number:

| Signal | Default weight | How it's scored |
| --- | --- | --- |
| Reviews | 45% | Star rating, pulled toward neutral when the sample is thin. A 4.6 from 900 people beats a 4.9 from six. |
| Distance | 35% | Sharp falloff — on foot, 400 m and 4 km are different propositions, while 30 km and 40 km are both "a drive". |
| Open now | 20% | Open wins. About to close is nearly as bad as shut, because you're walking there with a hungry child. |

Drag the weights under **Tune ranking**. Chasing a five-star pasty is a different
holiday from wanting one in the next ten minutes. Weights, your location and your
API key persist in the browser.

A signal that is genuinely unknown scores a neutral 0.5 and its bar renders grey with
a `—` rather than a number, so an unknown never quietly masquerades as a good score.

## Where the data comes from

Open the **Scan** panel to see and control all three sources.

**Built-in list (always available, works with no signal).** 30 real, long-established
Cornish makers — Philp's, Ann's, Warrens, Rowe's, the Chough Bakery, Pengenna,
Barnecutt, Sarah's and the rest.

Be clear about what this list is and isn't:

- Coordinates are **town-level approximations**, good enough to rank "what's near me",
  not for turn-by-turn navigation. Cards say `approx. location` until a live scan
  replaces them.
- Opening hours are **indicative patterns** for a Cornish bakery, not published times.
  They always render with a dashed outline, a `≈` and the word `(estimated)`.
- **No star ratings are invented.** Seed entries carry no rating at all. Ratings only
  ever appear from a live Google lookup.

**OpenStreetMap (free, no key).** Sweeps every bakery and pasty shop mapped in
Cornwall via the Overpass API, keyed on the county's ONS code with a bounding-box
fallback. Brings real surveyed coordinates and real published opening hours, plus
phone numbers and websites. Carries no reviews. Merged entries lose their `approx.`
and `(estimated)` markers because the data behind them is now surveyed.

**Google Places (your own key).** The only source here that carries star ratings and
review counts. Get a key from the Google Cloud console, enable *Places API (New)*, and
paste it in — the panel has step-by-step instructions. The key is stored in your
browser's local storage and sent only to Google.

Scans merge rather than replace: a shop is treated as the same business when its name
reduces to the same core **and** it is within 1.2 km, so the Truro and Padstow branches
of a chain stay separate entries.

## Caveats worth reading before you drive anywhere

- Distances are **straight-line**, not road miles. A shop 3 km away across the Fal is a
  long way round.
- Seasonal hours change constantly and pasty shops sell out. Ring ahead if it matters.
- The bounding-box fallback used when the Overpass area lookup fails bleeds slightly
  into west Devon on the eastern edge.

## Development

The logic is deliberately kept in pure functions near the top of the script —
`parseHours`, `openState`, `haversineKm`, `ratingScore`, `distScore`, `openScore`,
`googleHours`, `normName`, `findMatch`, `mergeInto` — so they can be extracted and
tested without a DOM.

`parseHours` implements the subset of the OSM `opening_hours` grammar that actually
turns up on bakeries: day ranges and lists, multiple spans per day, `off`/`closed`,
`24/7`, and closing times that run past midnight. Anything it cannot read returns
`null`, which surfaces honestly as "Hours unknown — ring ahead" rather than a guess.

Map data © OpenStreetMap contributors (ODbL). Ratings, where shown, © Google.
Not affiliated with any bakery.
