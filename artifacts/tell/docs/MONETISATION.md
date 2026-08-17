# Tell — commercial strategy

My own assessment, including the parts that argue against it.

---

## The honest framing first

**Viral reach and reliable revenue pull in opposite directions.** Sightline (the
other product in this repo) monetises reliably and spreads slowly. Tell spreads
fast and monetises indirectly. A daily game acquires enormous attention from
people who have no intention of paying for anything.

So the question is not "how do we charge players" — mostly you don't. It is
**"who pays for access to this audience, this data, or this instrument?"** There
are three credible answers, and one of them is considerably better than the
other two.

## The asset being built

Not the game. The game is the acquisition mechanism. Three assets accrue behind
it:

1. **A daily habit** with a shared, comparable score — the thing that made
   Wordle worth seven figures to the NYT.
2. **A calibration dataset** — how well humans distinguish machine text, by
   text type, over time, at scale. Nobody has this. Its value increases as
   models improve and the answer changes.
3. **A validated instrument.** The scoring is not a quiz; it is a proper
   forecast-scoring model with a Murphy decomposition. That makes it usable as
   an *assessment*, which is what turns a free game into a B2B product.

## Revenue lines, best first

### 1. Corporate AI-literacy assessment — the real business

Organisations are spending genuine money on AI literacy in 2026, and the budget
sits in training, compliance and risk rather than marketing. What they cannot
currently buy is a **measurement**: not "did staff attend the session" but "can
our people actually distinguish machine-generated content, and how confident are
they when they're wrong?"

That second half is the sellable part. Overconfidence in staff assessing
AI-generated material is a live operational risk — in recruitment screening,
procurement, due diligence, journalism and grading. A team report showing an
average overconfidence gap of +40 points is a finding a risk officer can act on.

- £500–2,000 per cohort assessment, or £3k–12k/year for ongoing benchmarking
- Same engine, different framing: private puzzle set, team dashboard, report
- Sold to compliance and L&D, who have budget and no alternative supplier
- **Low support burden, annual renewal, no consumer churn**

The consumer game is the funnel: an executive plays it, scores badly, is
unsettled, and wonders how their team would do.

### 2. Education

The same instrument, sold to schools and universities, where the assessment
problem is acute and the budget cycle is predictable. Lower price
(£200–600/institution/year), higher volume, strong word of mouth between
departments. Slower to sell, very sticky once embedded in a curriculum.

### 3. Consumer and audience monetisation

Real but modest, and it should not be the plan:

- **Premium** (£2/mo): archive access, personal calibration history over time,
  unlimited practice sets. Converts 1–3% of a daily audience at best.
- **Sponsorship**: a daily puzzle with an audience is a newsletter-shaped asset.
  Sells at CPM once the audience is provably durable, not before.
- **The dataset**: aggregate findings are genuinely newsworthy — "people are now
  at 52% on modern models, down from 71% two years ago" is a story that gets
  written up, which feeds the loop. Publish it free; it buys reach worth more
  than a licence fee.

## Unit economics

The puzzle is a pure function of the date. No database in the request path, no
model inference, no per-play cost.

| | |
| --- | --- |
| Marginal cost per play | effectively zero |
| Infrastructure at 100k plays/day | one small VPS |
| Content cost | zero — the corpus is player-contributed |

This matters more than it sounds. Most viral consumer products have costs that
scale with the spike, so success is expensive and a front-page day can be
financially painful. Here the spike is nearly free, which means the downside of
virality is bounded and the upside is not.

## Why this could genuinely spread

- **The subject is maximally live.** "Can you still tell what's real" is the
  cultural question of 2026, not a niche interest.
- **Losing is the shareable outcome**, which multiplies the sharing pool.
- **The grid is unreadable to non-players**, which is what creates the itch.
- **Press writes itself.** "Most people can't tell any more" is a story
  publications actively want, and every article is a link.
- **It is a shared daily event**, which is what turns a spike into a habit.

## Why it might not

**Most viral attempts fail, and this one might.** Virality is not a plan, it is
an outcome; the honest position is that the mechanics are sound and the coin
still has to land. Everything below is a real risk, not a formality.

- **Novelty decay.** Quiz-shaped games spike and die. Wordle survived on a
  genuinely renewable puzzle; whether "spot the machine" stays interesting past
  a fortnight is unproven, and it is the single biggest threat.
- **The corpus is the whole product, and it is currently seed content.** Until
  real submissions arrive at volume, the game is only as good as one author's
  impression of how people write. This is the most urgent thing to fix.
- **Models keep improving.** The game gets harder until it becomes pure chance,
  at which point it stops being a game. That is also a finding worth publishing,
  but it is an expiry date on the consumer product — which is precisely why the
  B2B assessment, where "nobody can tell" is itself the valuable result, is the
  durable line rather than the game.
- **Moderation.** The moment players supply text to other players, you own a
  content-moderation problem. Not optional before launch.
- **The audience may not convert at all.** People who play a free daily game are
  not obviously the people who buy corporate assessments. The funnel is
  plausible, not proven.

## Sequencing

| Phase | Focus | Marker |
| --- | --- | --- |
| 0–1 month | Replace seed corpus with real submissions; add moderation | 500+ real human samples |
| 1–3 months | Launch publicly. Publish the aggregate finding as a story. | Daily returning players |
| 3–6 months | Team mode: private sets, cohort report, dashboard | First paid cohort |
| 6–12 months | Education tier; annual benchmarking contracts | Recurring B2B revenue |

## The blunt summary

The game is the cheapest audience-acquisition mechanism available, and it costs
almost nothing to run whether ten people play or ten million. But **the revenue
is in the assessment, not the game** — and if that conversion does not
materialise, this is a popular free thing rather than a business.

Compared with Sightline: Tell has a far higher ceiling and a far higher chance
of returning nothing. If the objective is dependable passive income, Sightline is
the better instrument. If the objective is a shot at something that gets big,
this is it. They are not mutually exclusive — the honest play is to run Sightline
as the earner and Tell as the lottery ticket, since the marginal cost of keeping
Tell alive is close to zero.
