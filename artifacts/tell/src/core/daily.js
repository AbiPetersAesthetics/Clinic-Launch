/**
 * The daily puzzle.
 *
 * Derived entirely from the date, so every player in the world gets the same
 * five pairs without the server storing anything, without a scheduled job, and
 * without a database to fall over when a link spikes. The puzzle for any date
 * can be recomputed on any machine, forwards or backwards, from the corpus
 * alone.
 *
 * That is a growth decision as much as an engineering one: a shared daily
 * puzzle is what makes a score comparable, and comparability is what makes it
 * worth posting.
 *
 * @module core/daily
 */

/** @typedef {import('./types.js').Pair} Pair */
/** @typedef {import('./types.js').Sample} Sample */
/** @typedef {import('./types.js').DailyPuzzle} DailyPuzzle */

/** Day zero. Puzzle numbering counts from here. */
export const EPOCH = '2026-01-01';

/** Rounds per daily puzzle. Five is long enough to measure, short enough to finish. */
export const ROUNDS = 5;

/**
 * Build the puzzle for a date.
 *
 * @param {string} date       ISO date, e.g. "2026-08-17".
 * @param {Sample[]} corpus
 * @returns {DailyPuzzle}
 */
export function puzzleForDate(date, corpus) {
  const random = mulberry32(hashString(`tell:${date}`));
  const topics = groupByTopic(corpus);

  // Pick topics first, then one sample of each kind within the topic. Pairing
  // within a topic is what forces the judgement onto voice rather than subject.
  const chosenTopics = shuffle(
    topics.filter((t) => t.human.length > 0 && t.ai.length > 0),
    random,
  ).slice(0, ROUNDS);

  const pairs = chosenTopics.map((topic, index) => {
    const human = pick(topic.human, random);
    const ai = pick(topic.ai, random);
    const humanSide = /** @type {'left'|'right'} */ (random() < 0.5 ? 'left' : 'right');

    return {
      id: `${date}-${index}`,
      topic: topic.name,
      left: humanSide === 'left' ? human : ai,
      right: humanSide === 'left' ? ai : human,
      humanSide,
    };
  });

  return { date, number: puzzleNumber(date), pairs };
}

/**
 * Today's date in UTC. UTC deliberately: a puzzle that rolls over at different
 * moments in different places is not a shared puzzle.
 *
 * @param {Date} [now]
 * @returns {string}
 */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Days since the epoch, which is the number people quote when they share.
 *
 * @param {string} date
 * @returns {number}
 */
export function puzzleNumber(date) {
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / 86_400_000;
  return Math.floor(days) + 1;
}

/**
 * Strip the answers from a puzzle before it goes over the wire.
 *
 * Sending `humanSide` would obviously give the game away, but so would the
 * sample ids: corpus ids encode their author (`bread-h`, `bread-a`), so
 * shipping them hands the answer to anyone who opens the network tab — and
 * someone would post the trick within the hour of launch. The client only ever
 * needs the text, so nothing else goes.
 *
 * @param {DailyPuzzle} puzzle
 * @returns {object}
 */
export function withoutAnswers(puzzle) {
  return {
    date: puzzle.date,
    number: puzzle.number,
    pairs: puzzle.pairs.map((pair) => ({
      id: pair.id,
      topic: pair.topic,
      left: { text: pair.left.text },
      right: { text: pair.right.text },
    })),
  };
}

/**
 * Reveal provenance after marking, so players can see who wrote what and check
 * the game is being straight with them.
 *
 * @param {DailyPuzzle} puzzle
 * @returns {object[]}
 */
export function revealFor(puzzle) {
  return puzzle.pairs.map((pair) => {
    const human = pair.humanSide === 'left' ? pair.left : pair.right;
    const ai = pair.humanSide === 'left' ? pair.right : pair.left;
    return {
      pairId: pair.id,
      humanSide: pair.humanSide,
      human: { provenance: human.provenance, source: human.source ?? null },
      ai: { provenance: ai.provenance, model: ai.model ?? null },
    };
  });
}

/**
 * @param {Sample[]} corpus
 * @returns {{ name: string, human: Sample[], ai: Sample[] }[]}
 */
function groupByTopic(corpus) {
  /** @type {Map<string, { name: string, human: Sample[], ai: Sample[] }>} */
  const map = new Map();
  for (const sample of corpus) {
    let entry = map.get(sample.topic);
    if (!entry) {
      entry = { name: sample.topic, human: [], ai: [] };
      map.set(sample.topic, entry);
    }
    (sample.author === 'human' ? entry.human : entry.ai).push(sample);
  }
  // Sorted so the grouping is stable regardless of corpus insertion order.
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * xmur3 string hash — turns a date into a well-distributed 32-bit seed.
 *
 * @param {string} value
 * @returns {number}
 */
export function hashString(value) {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * mulberry32 — small, fast, well-distributed seeded PRNG.
 *
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates, seeded.
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} random
 * @returns {T[]}
 */
function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} random
 * @returns {T}
 */
function pick(items, random) {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick called on an empty list');
  return item;
}
