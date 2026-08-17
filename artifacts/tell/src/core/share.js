/**
 * The share card.
 *
 * This is the product's distribution mechanism, so it gets the same care as the
 * scoring. Wordle's grid worked because it was spoiler-free, instantly
 * recognisable, and unreadable to anyone who had not played — which made not
 * playing uncomfortable.
 *
 * Ours encodes two dimensions instead of one. Each square carries both whether
 * you were right and whether you were sure:
 *
 *     🟩  right, and confident        — earned it
 *     🟦  right, but hedging          — got there without conviction
 *     🟨  wrong, and hedging          — at least you knew
 *     🟥  wrong, and confident        — the interesting one
 *
 * That fourth square is the engine. A row of red is funnier and more
 * provocative than a low score, and it is the thing people post to be seen
 * being wrong — which is a far lower barrier than posting to be seen winning.
 *
 * @module core/share
 */

/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').DailyPuzzle} DailyPuzzle */

const CONFIDENT = 0.75;

/**
 * Build the shareable text block.
 *
 * @param {DailyPuzzle} puzzle
 * @param {Result} result
 * @param {{ url?: string }} [options]
 * @returns {string}
 */
export function shareText(puzzle, result, options = {}) {
  const url = options.url ?? 'tell.game';
  const grid = result.answers.map(squareFor).join('');
  const sure = Math.round(result.meanConfidence * 100);
  const right = Math.round(result.accuracy * 100);

  return [
    `Tell #${puzzle.number}`,
    grid,
    `${sure}% sure · ${right}% right`,
    result.archetype.verdict,
    url,
  ].join('\n');
}

/**
 * @param {import('./types.js').MarkedAnswer} answer
 * @returns {string}
 */
function squareFor(answer) {
  const confident = answer.probability >= CONFIDENT;
  if (answer.correct) return confident ? '🟩' : '🟦';
  return confident ? '🟥' : '🟨';
}

/**
 * A one-line summary for link previews and meta tags.
 *
 * @param {Result} result
 * @returns {string}
 */
export function headline(result) {
  const sure = Math.round(result.meanConfidence * 100);
  const right = Math.round(result.accuracy * 100);

  if (result.overconfidence >= 0.25) {
    return `They were ${sure}% sure and ${right}% right. Can you do better?`;
  }
  if (result.accuracy >= 0.8) {
    return `${result.correct}/${result.rounds}. Can you still tell the difference?`;
  }
  return `Most people can't tell any more. Can you?`;
}

/**
 * The legend, so a first-time viewer of the grid can decode it — and, having
 * decoded it, wants their own.
 *
 * @returns {{ square: string, meaning: string }[]}
 */
export function legend() {
  return [
    { square: '🟩', meaning: 'right, and sure' },
    { square: '🟦', meaning: 'right, but unsure' },
    { square: '🟨', meaning: 'wrong, and unsure' },
    { square: '🟥', meaning: 'wrong, and sure' },
  ];
}
