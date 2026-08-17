/**
 * The seed corpus.
 *
 * **Disclosure, stated plainly because the whole game depends on it:** every
 * sample here is seed content, written to make the game playable on day one.
 * The items marked `human` are written in a human register but were authored for
 * this corpus, not harvested from real writers. They are labelled `seed`, that
 * label is shown to players in the reveal, and the README says so too.
 *
 * A game about telling truth from imitation cannot be coy about its own
 * provenance. So the corpus carries provenance per item, the reveal shows it,
 * and the production path is explicit: real player submissions
 * (`user-submitted`) and public-domain writing (`public-domain`) displace seed
 * items as they arrive. That is also the growth loop — the corpus is
 * contributed by the players, so content cost stays at zero however far this
 * spreads.
 *
 * Samples are paired by topic. Without that, players discriminate on subject
 * matter rather than on voice and the measurement is worthless.
 *
 * @module core/corpus
 */

/** @typedef {import('./types.js').Sample} Sample */

/**
 * @type {Sample[]}
 */
export const CORPUS = [
  // --- coffee ---
  {
    id: 'coffee-h',
    author: 'human',
    provenance: 'seed',
    topic: 'coffee',
    text: "I've had the same grinder for nine years and it's louder than a drill, but the one time I tried to replace it I stood in the shop for forty minutes and left with nothing. My wife says this is a personality trait rather than a coffee problem.",
  },
  {
    id: 'coffee-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'coffee',
    text: 'Choosing the right grinder is one of the most important decisions a home coffee enthusiast can make. A quality burr grinder delivers consistent particle size, which is essential for balanced extraction and a richer, more flavourful cup.',
  },

  // --- moving house ---
  {
    id: 'moving-h',
    author: 'human',
    provenance: 'seed',
    topic: 'moving house',
    text: "We moved in August, which everyone told us not to do. The van man was three hours late and then reversed into the gatepost, and somehow that was the least stressful part of the day. I still can't find the box with the cheese grater in it.",
  },
  {
    id: 'moving-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'moving house',
    text: 'Moving house can be a stressful experience, but careful planning makes all the difference. Start by decluttering well in advance, label every box clearly by room, and keep essential items in a separate bag so your first night in your new home is comfortable.',
  },

  // --- a delayed flight ---
  {
    id: 'flight-h',
    author: 'human',
    provenance: 'seed',
    topic: 'a delayed flight',
    text: 'Six hours in Stansted with a dead phone and one of those sandwiches that costs £7 and tastes like the fridge it came out of. The gate changed four times. By the end I was quite enjoying it in a bleak sort of way.',
  },
  {
    id: 'flight-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'a delayed flight',
    text: 'Flight delays are an unfortunate reality of modern travel. Staying calm, keeping your airline informed, and knowing your passenger rights can turn a frustrating situation into a manageable one — and in many cases you may be entitled to compensation.',
  },

  // --- learning an instrument ---
  {
    id: 'guitar-h',
    author: 'human',
    provenance: 'seed',
    topic: 'learning an instrument',
    text: "Three years in and I still can't play a barre chord cleanly. My teacher says my thumb is in the wrong place. It has been in the wrong place since 2023 and shows no sign of moving.",
  },
  {
    id: 'guitar-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'learning an instrument',
    text: 'Learning an instrument is a rewarding journey that builds discipline and patience. Consistent daily practice, even in short sessions, is far more effective than occasional long ones, and celebrating small milestones keeps motivation high along the way.',
  },

  // --- baking ---
  {
    id: 'bread-h',
    author: 'human',
    provenance: 'seed',
    topic: 'baking',
    text: 'My starter is called Gerald and he lives in the fridge door, which I am told is wrong. He produces a loaf roughly every ten days that is dense enough to prop a door open. I have stopped pretending this is going to improve.',
  },
  {
    id: 'bread-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'baking',
    text: 'Sourdough baking rewards patience and attention to detail. Maintaining a healthy starter, understanding hydration ratios, and allowing sufficient time for bulk fermentation are the three pillars of a well-structured loaf with an open crumb.',
  },

  // --- job interviews ---
  {
    id: 'interview-h',
    author: 'human',
    provenance: 'seed',
    topic: 'job interviews',
    text: 'They asked me where I saw myself in five years and I said "honestly, not doing this interview again", which got a laugh from one of them and absolute silence from the other two. Did not get the job. Would say it again.',
  },
  {
    id: 'interview-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'job interviews',
    text: 'Preparing for an interview involves more than rehearsing answers. Research the organisation thoroughly, prepare specific examples that demonstrate your impact, and remember that the conversation is a two-way process — you are assessing them as much as they are assessing you.',
  },

  // --- cities ---
  {
    id: 'city-h',
    author: 'human',
    provenance: 'seed',
    topic: 'cities',
    text: 'Everyone says Rome and I understand why but I found it exhausting, all that queuing in heat. Give me Bologna. Nobody is there, the food is better, and you can walk for an hour under those arcades without getting rained on or photographed.',
  },
  {
    id: 'city-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'cities',
    text: 'Italy offers something for every kind of traveller. Rome dazzles with its ancient history, Florence enchants with Renaissance art, and Bologna delights food lovers with its rich culinary traditions — each city revealing a different facet of the country.',
  },

  // --- sleep ---
  {
    id: 'sleep-h',
    author: 'human',
    provenance: 'seed',
    topic: 'sleep',
    text: "The 3am thing where you wake up and immediately remember something embarrassing from 2011. Not a current problem. Not anything I can act on. Just the brain filing through the archive and reading out the worst bits.",
  },
  {
    id: 'sleep-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'sleep',
    text: 'Waking during the night is more common than many people realise. Establishing a consistent sleep schedule, limiting screen exposure before bed, and creating a cool, dark environment can significantly improve both sleep quality and duration over time.',
  },

  // --- secondhand bookshops ---
  {
    id: 'books-h',
    author: 'human',
    provenance: 'seed',
    topic: 'secondhand bookshops',
    text: 'Went in for nothing in particular and came out with a 1974 guide to British canals and a novel I already own. The man behind the counter did not look up once. Perfect shop, genuinely, no notes.',
  },
  {
    id: 'books-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'secondhand bookshops',
    text: 'There is something uniquely charming about secondhand bookshops. The scent of aged paper, the thrill of an unexpected find, and the sense of history in every well-thumbed volume combine to create an experience that no online retailer can quite replicate.',
  },

  // --- running ---
  {
    id: 'running-h',
    author: 'human',
    provenance: 'seed',
    topic: 'running',
    text: "Signed up for a half marathon in a moment of confidence in January. It is now August. I have run four times. The number of times I have thought about running is somewhere north of two hundred.",
  },
  {
    id: 'running-a',
    author: 'ai',
    provenance: 'generated',
    model: 'illustrative',
    topic: 'running',
    text: 'Training for a half marathon requires a structured and progressive approach. Gradually increasing your weekly mileage, incorporating rest days, and listening to your body are key to arriving at the start line both prepared and injury-free.',
  },
];

/**
 * How many distinct topics have a usable human/AI pair. Below `ROUNDS`, the
 * daily puzzle would have to repeat a topic within a single play.
 *
 * @param {Sample[]} [corpus]
 * @returns {number}
 */
export function playableTopics(corpus = CORPUS) {
  /** @type {Map<string, Set<string>>} */
  const topics = new Map();
  for (const sample of corpus) {
    let authors = topics.get(sample.topic);
    if (!authors) {
      authors = new Set();
      topics.set(sample.topic, authors);
    }
    authors.add(sample.author);
  }
  return [...topics.values()].filter((a) => a.has('human') && a.has('ai')).length;
}
