# Proper Pasty — Cornwall pasty finder

Ranks Cornish pasty shops by **reviews**, **opening hours** and **distance from where
you're standing**, for holiday goers who want the best local pasty rather than the
nearest chain — and tells you whether you'll actually get there before it shuts.

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

## The arrival check

Ranking tells you where the good pasties are. The line under each card tells you
whether you'll get one:

> 🚶 **8 min walk** — arrive 15:48, 1h 7m before they shut.
>
> 🚗 Too far to walk in time — **drive 15 min**, arrive 15:55 with 30 min to spare.
>
> ⛔ Open now, but it shuts at 15:50 — **you won't make it** (92 min even driving).

It combines the walking time with the closing time and allows five minutes to queue
and choose. If the walk won't make it, it checks whether driving would before giving
up. Shops that haven't opened yet get a leave-by time instead — and if the walk is
longer than the wait, it says "set off now" rather than quoting a time in the past.

The **I'll make it** filter reduces the list to shops you can actually reach in time.
At 16:20 on a Monday from Truro that's 2 of 30 — which is the whole point.

Walking assumes 4.8 km/h and driving 38 km/h, each with a detour allowance on top of
the straight-line distance (30% and 40%) plus a few minutes to park. The estimates err
slow deliberately: being told you'll make it and then finding the shutters down is a
much worse outcome than the reverse.

## Look and feel

The interface is built around one motif — the crimp. It cuts the scalloped edge under
the header, and the pasty silhouette in the artwork and the app mark is generated from
the same path function, which lays small arcs along a dome. Each arc's radius has to
stay above half the chord it spans; at exactly half an SVG arc becomes a semicircle,
and anything below gets clamped up to one, which turns a crimp into a row of balloons.

Beyond that: a display serif over a UI sans, a score dial per card, staggered card
entry, animated score bars, skeleton rows during scans, and a full dark theme with a
three-way toggle (light → dark → follow system). The artwork re-tints itself for dark
mode, so the scenes become night scenes. Every animation is dropped under
`prefers-reduced-motion`.

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
review counts — and real photographs of each shop. Get a key from the Google Cloud
console, enable *Places API (New)*, and paste it in — the panel has step-by-step
instructions. The key is stored in your browser's local storage and sent only to Google.

## Images

> [!IMPORTANT]
> **The bundled photographs are test assets, not cleared for redistribution.**
> They were supplied for this local build to see how the app looks with real
> photography. Their provenance and licensing are unverified. Before this goes
> anywhere public, replace them — delete the `PHOTOS` object and the app falls
> straight back to its own drawn artwork with no other changes needed.

Card and header imagery is layered, each layer painting over the one beneath, so a
failure at any level degrades to the layer below rather than to a broken image box:

1. **Generated artwork (always).** A Cornish scene drawn as inline SVG — cliffs,
   harbour masts, moorland, rooftops or a lighthouse, chosen deterministically from
   the shop's name so the list looks varied and a given shop always looks the same.
   No network, no licensing, sharp at any DPI, and it works with no signal.
2. **Bundled library photographs.** Two pasty photos, cropped to five derivatives
   (header, two card sizes, two thumbnails) and embedded as base64 data URIs — about
   177 KB in total. Being inline keeps the app a single self-contained file that renders
   photography with no network at all. They are **generic pasty photographs, not
   pictures of any particular shop**, so the UI labels them "Library photo" and the
   header reads "Library photograph · not a specific shop". That labelling is the point:
   a stock image must never read as a picture of the bakery on the card.
3. **Google Places photos.** Real photographs *of the actual shop*, fetched with the
   user's own key and credited to the photographer. These override the library image
   and are captioned with the credit instead. The top pick's photo loads eagerly;
   thumbnails stay lazy to spare a holiday data plan.
4. **Wikimedia Commons (optional).** A button swaps the header for a freely-licensed
   photograph credited to its photographer. No longer fetched automatically, since a
   usable header image now ships with the file.

No bakery photographs are scraped from the web and no image URL is hardcoded. Verified
by test: with photography bundled in, loading the app makes **zero outbound network
requests**.

The derivatives were produced by cropping and re-encoding through Chromium's canvas
(`enc.js` pattern — cover-crop, centred, JPEG q0.64), since no image tooling was
available in the build environment.

Scans merge rather than replace: a shop is treated as the same business when its name
reduces to the same core **and** it is within 1.2 km, so the Truro and Padstow branches
of a chain stay separate entries.

## Caveats worth reading before you drive anywhere

- Distances are **straight-line**, not road miles. A shop 3 km away across the Fal is a
  long way round. Walking and driving times apply a flat detour allowance to that
  straight line — they're a sense-check, not a route.
- Seasonal hours change constantly and pasty shops sell out. Ring ahead if it matters.
- The bounding-box fallback used when the Overpass area lookup fails bleeds slightly
  into west Devon on the eastern edge.

## Development

The logic is deliberately kept in pure functions near the top of the script —
`parseHours`, `openState`, `haversineKm`, `travel`, `arrival`, `ratingScore`,
`distScore`, `openScore`, `googleHours`, `normName`, `findMatch`, `mergeInto`,
`pastyPath`, `sceneSVG` — so they can be extracted from the HTML and tested without a
DOM, which is how they were developed.

`parseHours` implements the subset of the OSM `opening_hours` grammar that actually
turns up on bakeries: day ranges and lists, multiple spans per day, `off`/`closed`,
`24/7`, and closing times that run past midnight. Anything it cannot read returns
`null`, which surfaces honestly as "Hours unknown — ring ahead" rather than a guess.

Map data © OpenStreetMap contributors (ODbL). Ratings and shop photographs, where
shown, © Google and their respective photographers. Bundled library photographs are
unverified test assets — see the note under **Images**. Not affiliated with any bakery.
