# Tell

**One of these was written by a person. Can you still tell?**

A daily game. Five rounds, each with two pieces of writing on the same subject —
one human, one machine. Pick the person, and say how sure you are.

The confidence is the point. Almost everyone believes they can spot machine
writing. Very few can, and the belief tends to survive the evidence.

```bash
npm start   # http://localhost:3000
npm test    # 36 tests
```

---

## Why this spreads

Three mechanics, all deliberate:

**The gap is the payload.** A score of 2/5 is forgettable. *"You were 93% sure
and 20% right"* is a thing people repeat. The game measures self-knowledge, not
trivia, and self-knowledge is the more uncomfortable — and therefore more
shareable — result.

**The grid encodes two dimensions.** Wordle's grid worked because it was
spoiler-free, instantly recognisable, and meaningless to anyone who had not
played. Ours carries confidence as well as correctness:

```
Tell #229
🟥🟩🟥🟥🟥
93% sure · 20% right
You were sure. You were also mistaken.
```

| | |
| --- | --- |
| 🟩 | right, and sure |
| 🟦 | right, but unsure |
| 🟨 | wrong, and unsure |
| 🟥 | wrong, and sure |

That red row is the engine. People post it *to be seen being wrong*, which is a
far lower barrier than posting to be seen winning — and a row of red provokes
"I'd do better than that" in everyone who sees it.

**Being wrong is the shareable outcome.** Most viral games require you to
perform well before you will post. This one is most tempting to share when you
lose, which multiplies the pool of people willing to share it.

## The second loop

The result screen invites you to submit your own writing. If it enters the
corpus, you find out how many people were convinced a human wrote it.

That loop does two jobs at once. It is pure identity currency — *"41% of people
thought I was a bot"* is irresistible — and it supplies the human half of the
corpus, so **content cost stays at zero however far this spreads.** A daily game
usually dies of content exhaustion. This one is fed by the people playing it.

## Honesty about the corpus

A game about telling truth from imitation cannot be shifty about its own
sources, so every sample carries a provenance label and the reveal shows it:

- `public-domain` — real human writing, out of copyright
- `user-submitted` — real human writing, submitted by a player
- `seed` — **written for the initial corpus so the game is playable on day one**
- `generated` — written by a language model

**The current corpus is entirely seed and generated content.** The human-side
samples are written in a human register but were authored for this repository,
not harvested from real writers. That is disclosed in the code, in the reveal,
and here. Player submissions and public-domain text displace seed items as they
arrive — the type system and the reveal already support both.

## What the scoring actually measures

Asking for a confidence with every answer turns each round into a probabilistic
forecast, which lets us use the standard tools for scoring forecasts rather than
inventing a points system.

**Brier score** — mean squared error of the forecasts. Always guessing at 50%
scores 0.25, so 0.25 is the line between skill and noise.

**Murphy's decomposition** — `Brier = reliability − resolution + uncertainty`,
which separates two very different ways of being wrong:

- *reliability* (calibration): when you said 90%, were you right 90% of the
  time? Lower is better.
- *resolution* (discrimination): did you separate what you knew from what you
  didn't, or was every answer the same shrug? Higher is better.

You can be badly calibrated but highly discriminating, or perfectly calibrated
and useless. Collapsing those into one number throws away the interesting half.
The decomposition is verified against the identity in the test suite.

**Overconfidence** — mean confidence minus accuracy. The least sophisticated
statistic here and the only one that needs no explanation.

## Architecture

```
src/
  core/            pure — no I/O, no clock, no storage
    types.js       domain vocabulary
    corpus.js      samples, with provenance per item
    daily.js       deterministic date-seeded puzzle generation
    scoring.js     Brier, Murphy decomposition, archetypes
    share.js       the share card
  server/          zero-dependency HTTP server + web UI
```

**The puzzle is a pure function of the date.** Every player worldwide gets the
same five pairs with no database, no scheduled job, and nothing to seed. Any
date's puzzle can be recomputed on any machine, forwards or backwards, from the
corpus alone.

That is a survival decision as much as an architectural one: the failure mode
for a game that catches fire is falling over on the day it catches fire, and the
usual cause is a database in the request path. There isn't one.

**Marking happens server-side.** The client never receives `humanSide` — and
never receives sample ids either, since corpus ids encode their own author
(`bread-h`, `bread-a`). Both leaks are covered by regression tests, because
either one would be posted publicly within an hour of launch.

Zero runtime dependencies. Node 22 standard library only. TypeScript checks the
codebase in strict mode through JSDoc, with no build step.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/puzzle?date=` | Today's puzzle, answers stripped. Future dates refused. |
| `POST /api/play` | Mark a play — returns verdict, reveal and share card |
| `POST /api/submit` | Contribute your own writing to the corpus |
| `GET /healthz` | Liveness |

## Honest limitations

- **The corpus is seed content**, as disclosed above. Real submissions are the
  intended source and the code path exists, but it is not yet populated.
- **Aggregate stats are in memory**, so percentiles reset when the process
  restarts. Deliberate: this is a nice-to-have that must never be able to take
  the game down.
- **Submissions are queued, not moderated.** A public launch needs review and
  abuse handling before player text reaches other players.
- **Whether "spotting AI" is a durable skill is genuinely unclear.** The
  research suggests people are near chance once the writing is any good. The
  game is designed to report that honestly rather than to sell a skill it cannot
  teach.

## Commercial strategy

See [`docs/MONETISATION.md`](docs/MONETISATION.md).
