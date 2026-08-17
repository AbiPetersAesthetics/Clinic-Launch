/**
 * Tell — domain model.
 *
 * Types only, no logic and no I/O. Everything in `core/` is a pure function
 * over these shapes, which is what lets the daily puzzle be identical for every
 * player on earth without the server storing a single row.
 *
 * @module core/types
 */

/**
 * Where a text sample came from. Recorded per item because the honesty of the
 * whole game depends on it: a player is entitled to know that the "human"
 * samples are genuinely human.
 *
 * - `public-domain`  Real human writing, out of copyright.
 * - `user-submitted` Real human writing, submitted by a player.
 * - `seed`           Written for the initial corpus so the game is playable on
 *                    day one. Clearly disclosed, and displaced by real
 *                    submissions as they arrive.
 * - `generated`      Written by a language model.
 *
 * @typedef {'public-domain' | 'user-submitted' | 'seed' | 'generated'} Provenance
 */

/**
 * One text sample.
 *
 * @typedef {object} Sample
 * @property {string} id
 * @property {'human' | 'ai'} author
 * @property {Provenance} provenance
 * @property {string} text
 * @property {string} [source]     Attribution, where one exists.
 * @property {string} [model]      Which model wrote it, for `generated` items.
 * @property {string} topic        Used to pair samples on a shared subject.
 */

/**
 * A single round: two samples on the same topic, one human, one machine.
 * Pairing by topic matters — otherwise players discriminate on subject matter
 * rather than on voice, and the game measures nothing.
 *
 * @typedef {object} Pair
 * @property {string} id
 * @property {string} topic
 * @property {Sample} left
 * @property {Sample} right
 * @property {'left' | 'right'} humanSide
 */

/**
 * A player's answer to one round.
 *
 * @typedef {object} Answer
 * @property {string} pairId
 * @property {'left' | 'right'} choice
 * @property {number} confidence   50–100. In a two-way choice, below 50 is
 *                                 just the opposite choice held more firmly,
 *                                 so the scale starts at a coin flip.
 */

/**
 * A round's outcome after marking.
 *
 * @typedef {object} MarkedAnswer
 * @property {string} pairId
 * @property {boolean} correct
 * @property {number} confidence
 * @property {number} probability  confidence / 100.
 */

/**
 * The full statistical verdict on a play.
 *
 * @typedef {object} Result
 * @property {number} rounds
 * @property {number} correct
 * @property {number} accuracy          0–1.
 * @property {number} meanConfidence     0–1.
 * @property {number} overconfidence     meanConfidence − accuracy. The headline.
 * @property {number} brier              Mean squared error of the forecasts.
 * @property {number} calibration        Reliability term. Lower is better.
 * @property {number} discrimination     Resolution term. Higher is better.
 * @property {number} skillVsChance      Brier improvement over always guessing.
 * @property {MarkedAnswer[]} answers
 * @property {Archetype} archetype
 */

/**
 * A plain-language reading of the result. This is what people screenshot, so it
 * has to be true, specific, and quotable.
 *
 * @typedef {object} Archetype
 * @property {string} id
 * @property {string} name
 * @property {string} verdict
 * @property {string} detail
 */

/**
 * A day's puzzle. Derived deterministically from the date, so it needs no
 * storage and cannot be tampered with.
 *
 * @typedef {object} DailyPuzzle
 * @property {string} date       ISO date, UTC.
 * @property {number} number     Days since launch — the shareable puzzle number.
 * @property {Pair[]} pairs
 */

export {};
