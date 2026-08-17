/**
 * Scoring — measuring self-knowledge, not just correctness.
 *
 * A plain "4 out of 5" is forgettable. What people actually want to know, and
 * what they will screenshot, is the gap between how sure they felt and how right
 * they were. That gap is measurable, and measuring it properly is what makes
 * this a real instrument rather than a quiz.
 *
 * We ask for a confidence with every answer, which turns each round into a
 * probabilistic forecast and lets us use the standard tools for scoring
 * forecasts:
 *
 * **Brier score** — the mean squared error of the forecasts. Always guessing at
 * 50% scores 0.25, so 0.25 is the line between skill and noise.
 *
 * **Murphy's decomposition** — Brier = reliability − resolution + uncertainty,
 * which separates two very different ways of being wrong:
 *
 *   - *reliability* (calibration): when you said 90%, were you right 90% of the
 *     time? Lower is better.
 *   - *resolution* (discrimination): did you separate the cases you knew from
 *     the ones you didn't, or was every answer the same shrug? Higher is better.
 *
 * Someone can be poorly calibrated but highly discriminating, or perfectly
 * calibrated and useless. Collapsing that into one number would throw away the
 * interesting half of the result.
 *
 * **Overconfidence** — mean confidence minus accuracy. Not the most
 * sophisticated statistic here, but the one that lands: "you were 92% sure and
 * 48% right" needs no explanation.
 *
 * @module core/scoring
 */

/** @typedef {import('./types.js').Answer} Answer */
/** @typedef {import('./types.js').Pair} Pair */
/** @typedef {import('./types.js').MarkedAnswer} MarkedAnswer */
/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').Archetype} Archetype */

/** A coin flip stated at 50% confidence. The reference point for all skill. */
export const CHANCE_BRIER = 0.25;

/**
 * Mark a set of answers against the puzzle and produce the full verdict.
 *
 * @param {Pair[]} pairs
 * @param {Answer[]} answers
 * @returns {Result}
 */
export function score(pairs, answers) {
  const byId = new Map(pairs.map((p) => [p.id, p]));

  /** @type {MarkedAnswer[]} */
  const marked = [];
  for (const answer of answers) {
    const pair = byId.get(answer.pairId);
    if (!pair) continue;
    const confidence = clamp(answer.confidence, 50, 100);
    marked.push({
      pairId: answer.pairId,
      correct: answer.choice === pair.humanSide,
      confidence,
      probability: confidence / 100,
    });
  }

  const rounds = marked.length;
  if (rounds === 0) return emptyResult();

  const correct = marked.filter((m) => m.correct).length;
  const accuracy = correct / rounds;
  const meanConfidence = mean(marked.map((m) => m.probability));
  const brier = mean(marked.map((m) => (m.probability - (m.correct ? 1 : 0)) ** 2));
  const { reliability, resolution } = decompose(marked, accuracy);

  const result = {
    rounds,
    correct,
    accuracy,
    meanConfidence,
    overconfidence: meanConfidence - accuracy,
    brier,
    calibration: reliability,
    discrimination: resolution,
    // Murphy's skill score: how much better than always guessing.
    skillVsChance: (CHANCE_BRIER - brier) / CHANCE_BRIER,
    answers: marked,
  };

  return { ...result, archetype: classify(result) };
}

/**
 * Murphy's decomposition, computed over confidence bins.
 *
 * Forecasts are grouped by the confidence stated, then each group contributes
 * its squared distance from that group's actual hit rate (reliability) and from
 * the overall base rate (resolution).
 *
 * @param {MarkedAnswer[]} marked
 * @param {number} baseRate
 * @returns {{ reliability: number, resolution: number }}
 */
function decompose(marked, baseRate) {
  /** @type {Map<number, MarkedAnswer[]>} */
  const bins = new Map();
  for (const answer of marked) {
    const bin = Math.round(answer.probability * 10) / 10;
    const existing = bins.get(bin);
    if (existing) existing.push(answer);
    else bins.set(bin, [answer]);
  }

  let reliability = 0;
  let resolution = 0;
  const total = marked.length;

  for (const [bin, group] of bins) {
    const weight = group.length / total;
    const hitRate = group.filter((g) => g.correct).length / group.length;
    reliability += weight * (bin - hitRate) ** 2;
    resolution += weight * (hitRate - baseRate) ** 2;
  }

  return { reliability, resolution };
}

/**
 * Turn the numbers into a verdict a person would repeat out loud.
 *
 * The two axes are accuracy and overconfidence, because that is where the
 * emotional content lives. Being wrong is fine. Being *certain* and wrong is
 * the thing worth telling people about.
 *
 * @param {Omit<Result, 'archetype'>} result
 * @returns {Archetype}
 */
export function classify(result) {
  const { accuracy, overconfidence, discrimination } = result;
  const sharp = accuracy >= 0.7;
  const overconfident = overconfidence >= 0.15;
  const humble = overconfidence <= -0.1;

  if (sharp && !overconfident && !humble) {
    return {
      id: 'calibrated',
      name: 'Calibrated',
      verdict: 'You know what you know.',
      detail:
        'You picked well and your confidence tracked your accuracy. This is rarer than it sounds — most people who score as highly as you did are considerably more sure of themselves than they have earned.',
    };
  }

  if (sharp && overconfident) {
    return {
      id: 'sharp-and-certain',
      name: 'Sharp but certain',
      verdict: 'Right more often than not, and surer than that.',
      detail:
        'Your eye is genuinely good. Your confidence still ran ahead of it, which is the failure mode that matters: the times you were wrong, you had no idea you were wrong.',
    };
  }

  if (!sharp && overconfident) {
    return {
      id: 'confidently-wrong',
      name: 'Confidently wrong',
      verdict: 'You were sure. You were also mistaken.',
      detail:
        'The gap between your confidence and your accuracy is the whole point of this game. Almost everyone believes they can spot machine writing. Very few can, and the belief survives the evidence.',
    };
  }

  if (humble && sharp) {
    return {
      id: 'underrated',
      name: 'Quietly right',
      verdict: 'Better than you gave yourself credit for.',
      detail:
        'You were more accurate than you were confident. Unusual, and worth knowing — you can trust your instinct here more than you currently do.',
    };
  }

  if (discrimination < 0.02) {
    return {
      id: 'coin-flip',
      name: 'Coin flip',
      verdict: 'You were guessing, and you knew it.',
      detail:
        'Your answers carried no more information than a coin. That is an honest result, and it is where most people genuinely sit once the writing is any good.',
    };
  }

  return {
    id: 'uncertain',
    name: 'Honestly lost',
    verdict: 'Not sure, and not right.',
    detail:
      'You did not claim to know, and you did not. There is no shame in that: current models write cleanly enough that the tells people rely on stopped working some time ago.',
  };
}

/**
 * How this player compares to the base rate for the puzzle. Kept separate from
 * scoring because it depends on aggregate data the core does not hold.
 *
 * @param {number} accuracy
 * @param {number[]} allAccuracies
 * @returns {number} Percentile, 0–100.
 */
export function percentile(accuracy, allAccuracies) {
  if (allAccuracies.length === 0) return 50;
  const below = allAccuracies.filter((a) => a < accuracy).length;
  return Math.round((below / allAccuracies.length) * 100);
}

/**
 * @returns {Result}
 */
function emptyResult() {
  const base = {
    rounds: 0,
    correct: 0,
    accuracy: 0,
    meanConfidence: 0,
    overconfidence: 0,
    brier: CHANCE_BRIER,
    calibration: 0,
    discrimination: 0,
    skillVsChance: 0,
    answers: /** @type {MarkedAnswer[]} */ ([]),
  };
  return { ...base, archetype: classify(base) };
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
