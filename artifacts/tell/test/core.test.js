import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { score, classify, percentile, CHANCE_BRIER } from '../src/core/scoring.js';
import {
  puzzleForDate,
  puzzleNumber,
  todayUtc,
  withoutAnswers,
  revealFor,
  mulberry32,
  hashString,
  ROUNDS,
} from '../src/core/daily.js';
import { CORPUS, playableTopics } from '../src/core/corpus.js';
import { shareText, headline, legend } from '../src/core/share.js';

/**
 * @param {import('../src/core/types.js').Pair[]} pairs
 * @param {(pair: import('../src/core/types.js').Pair, i: number) => {correct: boolean, confidence: number}} plan
 */
function answersFor(pairs, plan) {
  return pairs.map((pair, i) => {
    const { correct, confidence } = plan(pair, i);
    const wrongSide = pair.humanSide === 'left' ? 'right' : 'left';
    return {
      pairId: pair.id,
      choice: /** @type {'left'|'right'} */ (correct ? pair.humanSide : wrongSide),
      confidence,
    };
  });
}

describe('corpus', () => {
  test('has enough topics to fill a daily puzzle without repeating', () => {
    assert.ok(playableTopics() >= ROUNDS, `only ${playableTopics()} playable topics`);
  });

  test('every topic has both a human and an AI sample', () => {
    /** @type {Map<string, Set<string>>} */
    const topics = new Map();
    for (const s of CORPUS) {
      if (!topics.has(s.topic)) topics.set(s.topic, new Set());
      topics.get(s.topic)?.add(s.author);
    }
    for (const [topic, authors] of topics) {
      assert.ok(authors.has('human') && authors.has('ai'), `${topic} is unpaired`);
    }
  });

  test('every sample declares provenance, and AI samples name a model', () => {
    for (const sample of CORPUS) {
      assert.ok(sample.provenance, `${sample.id} has no provenance`);
      assert.ok(sample.text.length > 40, `${sample.id} is too short to judge`);
      if (sample.author === 'ai') assert.ok(sample.model, `${sample.id} must name its model`);
    }
  });

  test('sample ids are unique', () => {
    const ids = CORPUS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('daily puzzle', () => {
  test('is identical for every player on the same date', () => {
    const a = puzzleForDate('2026-08-17', CORPUS);
    const b = puzzleForDate('2026-08-17', CORPUS);
    assert.deepEqual(a, b);
  });

  test('differs between dates', () => {
    const a = puzzleForDate('2026-08-17', CORPUS);
    const b = puzzleForDate('2026-08-18', CORPUS);
    assert.notDeepEqual(
      a.pairs.map((p) => p.id + p.humanSide + p.left.id),
      b.pairs.map((p) => p.id + p.humanSide + p.left.id),
    );
  });

  test('always yields the full number of rounds', () => {
    for (const date of ['2026-01-01', '2026-08-17', '2027-03-09']) {
      assert.equal(puzzleForDate(date, CORPUS).pairs.length, ROUNDS);
    }
  });

  test('never repeats a topic within one puzzle', () => {
    for (let day = 1; day <= 60; day++) {
      const date = `2026-08-${String(day % 28 + 1).padStart(2, '0')}`;
      const topics = puzzleForDate(date, CORPUS).pairs.map((p) => p.topic);
      assert.equal(new Set(topics).size, topics.length, `repeat on ${date}`);
    }
  });

  test('each pair holds exactly one human and one AI sample, correctly flagged', () => {
    const puzzle = puzzleForDate('2026-08-17', CORPUS);
    for (const pair of puzzle.pairs) {
      const human = pair.humanSide === 'left' ? pair.left : pair.right;
      const ai = pair.humanSide === 'left' ? pair.right : pair.left;
      assert.equal(human.author, 'human');
      assert.equal(ai.author, 'ai');
      assert.equal(pair.left.topic, pair.right.topic);
    }
  });

  test('the human is not always on the same side', () => {
    const sides = new Set();
    for (let day = 1; day <= 20; day++) {
      const date = `2026-09-${String(day).padStart(2, '0')}`;
      for (const pair of puzzleForDate(date, CORPUS).pairs) sides.add(pair.humanSide);
    }
    assert.equal(sides.size, 2, 'human side must vary');
  });

  test('puzzle numbering counts from the epoch', () => {
    assert.equal(puzzleNumber('2026-01-01'), 1);
    assert.equal(puzzleNumber('2026-01-02'), 2);
    assert.equal(puzzleNumber('2026-12-31'), 365);
  });

  test('todayUtc returns an ISO date', () => {
    assert.match(todayUtc(new Date('2026-08-17T23:30:00Z')), /^2026-08-17$/);
  });

  test('withoutAnswers strips everything that would give the game away', () => {
    const puzzle = puzzleForDate('2026-08-17', CORPUS);
    const wire = JSON.stringify(withoutAnswers(puzzle));
    assert.equal(wire.includes('humanSide'), false);
    assert.equal(wire.includes('"author"'), false);
    assert.equal(wire.includes('provenance'), false);
    assert.equal(wire.includes('generated'), false);
  });

  test('the wire format leaks no sample ids — corpus ids encode the author', () => {
    // Regression: ids like "bread-h" / "bread-a" name their own answer, so
    // shipping them hands the game to anyone with the network tab open.
    const puzzle = puzzleForDate('2026-08-17', CORPUS);
    const wire = JSON.stringify(withoutAnswers(puzzle));
    for (const sample of CORPUS) {
      assert.equal(wire.includes(`"${sample.id}"`), false, `leaked sample id ${sample.id}`);
    }
  });

  test('the wire format still carries everything the client needs to play', () => {
    const wire = /** @type {any} */ (withoutAnswers(puzzleForDate('2026-08-17', CORPUS)));
    assert.equal(wire.pairs.length, ROUNDS);
    for (const pair of wire.pairs) {
      assert.ok(pair.id && pair.topic);
      assert.ok(pair.left.text.length > 0 && pair.right.text.length > 0);
    }
  });

  test('the reveal discloses provenance for both sides', () => {
    const reveal = revealFor(puzzleForDate('2026-08-17', CORPUS));
    assert.equal(reveal.length, ROUNDS);
    for (const item of reveal) {
      assert.ok(/** @type {any} */ (item).human.provenance);
      assert.ok(/** @type {any} */ (item).ai.provenance);
    }
  });
});

describe('seeded randomness', () => {
  test('the same seed produces the same stream', () => {
    const a = mulberry32(hashString('tell:2026-08-17'));
    const b = mulberry32(hashString('tell:2026-08-17'));
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  test('values stay in [0, 1)', () => {
    const random = mulberry32(hashString('x'));
    for (let i = 0; i < 500; i++) {
      const value = random();
      assert.ok(value >= 0 && value < 1);
    }
  });

  test('different seeds diverge', () => {
    assert.notEqual(hashString('2026-08-17'), hashString('2026-08-18'));
  });
});

describe('scoring', () => {
  const pairs = puzzleForDate('2026-08-17', CORPUS).pairs;

  test('a perfect, fully confident play', () => {
    const result = score(pairs, answersFor(pairs, () => ({ correct: true, confidence: 100 })));
    assert.equal(result.accuracy, 1);
    assert.equal(result.brier, 0);
    assert.equal(result.overconfidence, 0);
    assert.equal(result.skillVsChance, 1);
  });

  test('confidently wrong is the worst possible Brier score', () => {
    const result = score(pairs, answersFor(pairs, () => ({ correct: false, confidence: 100 })));
    assert.equal(result.accuracy, 0);
    assert.equal(result.brier, 1);
    assert.equal(result.overconfidence, 1);
    assert.ok(result.skillVsChance < 0, 'must score worse than guessing');
    assert.equal(result.archetype.id, 'confidently-wrong');
  });

  test('pure guessing scores exactly at chance', () => {
    const result = score(
      pairs,
      answersFor(pairs, (_p, i) => ({ correct: i % 2 === 0, confidence: 50 })),
    );
    assert.equal(result.brier, CHANCE_BRIER);
    assert.equal(result.skillVsChance, 0);
  });

  test('overconfidence is mean confidence minus accuracy', () => {
    // Four of five right, every answer stated at 90%.
    const result = score(
      pairs,
      answersFor(pairs, (_p, i) => ({ correct: i < 4, confidence: 90 })),
    );
    assert.equal(result.accuracy, 0.8);
    assert.equal(result.meanConfidence, 0.9);
    assert.ok(Math.abs(result.overconfidence - 0.1) < 1e-9);
  });

  test('confidence below 50 is clamped — a two-way choice cannot beat a coin backwards', () => {
    const result = score(pairs, [
      { pairId: pairs[0].id, choice: pairs[0].humanSide, confidence: 10 },
    ]);
    assert.equal(result.meanConfidence, 0.5);
  });

  test('a hedged but accurate player discriminates without being overconfident', () => {
    const result = score(pairs, answersFor(pairs, () => ({ correct: true, confidence: 60 })));
    assert.equal(result.accuracy, 1);
    assert.ok(result.overconfidence < 0, 'underconfident');
    assert.equal(result.archetype.id, 'underrated');
  });

  test('unanswered and unknown pairs are ignored rather than counted wrong', () => {
    const result = score(pairs, [
      { pairId: pairs[0].id, choice: pairs[0].humanSide, confidence: 80 },
      { pairId: 'does-not-exist', choice: 'left', confidence: 90 },
    ]);
    assert.equal(result.rounds, 1);
    assert.equal(result.correct, 1);
  });

  test('an empty play does not divide by zero', () => {
    const result = score(pairs, []);
    assert.equal(result.rounds, 0);
    assert.equal(result.brier, CHANCE_BRIER);
    assert.ok(result.archetype.id);
  });

  test('Murphy decomposition holds: brier = reliability - resolution + uncertainty', () => {
    const result = score(
      pairs,
      answersFor(pairs, (_p, i) => ({ correct: i !== 2, confidence: i % 2 === 0 ? 90 : 60 })),
    );
    const uncertainty = result.accuracy * (1 - result.accuracy);
    const reconstructed = result.calibration - result.discrimination + uncertainty;
    assert.ok(
      Math.abs(reconstructed - result.brier) < 1e-9,
      `decomposition off by ${Math.abs(reconstructed - result.brier)}`,
    );
  });

  test('every archetype carries a quotable verdict', () => {
    for (const accuracy of [0, 0.2, 0.5, 0.8, 1]) {
      for (const confidence of [0.5, 0.7, 0.95]) {
        const archetype = classify({
          rounds: 5,
          correct: accuracy * 5,
          accuracy,
          meanConfidence: confidence,
          overconfidence: confidence - accuracy,
          brier: 0.2,
          calibration: 0.05,
          discrimination: 0.05,
          skillVsChance: 0.2,
          answers: [],
        });
        assert.ok(archetype.name && archetype.verdict && archetype.detail);
      }
    }
  });
});

describe('percentile', () => {
  test('ranks against the field', () => {
    assert.equal(percentile(0.8, [0.2, 0.4, 0.6, 1.0]), 75);
    assert.equal(percentile(0.0, [0.2, 0.4]), 0);
  });

  test('an empty field is treated as median', () => {
    assert.equal(percentile(0.8, []), 50);
  });
});

describe('share card', () => {
  const puzzle = puzzleForDate('2026-08-17', CORPUS);

  test('encodes both correctness and confidence in the grid', () => {
    const result = score(puzzle.pairs, [
      { pairId: puzzle.pairs[0].id, choice: puzzle.pairs[0].humanSide, confidence: 95 },
      { pairId: puzzle.pairs[1].id, choice: puzzle.pairs[1].humanSide, confidence: 55 },
      { pairId: puzzle.pairs[2].id, choice: flip(puzzle.pairs[2].humanSide), confidence: 55 },
      { pairId: puzzle.pairs[3].id, choice: flip(puzzle.pairs[3].humanSide), confidence: 95 },
    ]);
    const text = shareText(puzzle, result);
    assert.ok(text.includes('🟩🟦🟨🟥'), `grid was: ${text.split('\n')[1]}`);
  });

  test('leads with the puzzle number and never leaks answers', () => {
    const result = score(puzzle.pairs, answersFor(puzzle.pairs, () => ({ correct: true, confidence: 80 })));
    const text = shareText(puzzle, result);
    assert.match(text, /^Tell #\d+/);

    // The card must be spoiler-free: nothing that identifies which side was
    // human, which samples were used, or what the topics were.
    assert.equal(text.includes('humanSide'), false);
    for (const pair of puzzle.pairs) {
      assert.equal(text.includes(pair.topic), false, `leaked topic ${pair.topic}`);
      assert.equal(text.includes(pair.left.id), false);
      assert.equal(text.includes(pair.right.id), false);
      assert.equal(text.includes(pair.left.text.slice(0, 20)), false);
    }
  });

  test('states both numbers, because the gap between them is the point', () => {
    const result = score(
      puzzle.pairs,
      answersFor(puzzle.pairs, (_p, i) => ({ correct: i < 2, confidence: 95 })),
    );
    const text = shareText(puzzle, result);
    assert.match(text, /95% sure · 40% right/);
  });

  test('headline invites the reader to try', () => {
    const result = score(
      puzzle.pairs,
      answersFor(puzzle.pairs, (_p, i) => ({ correct: i === 0, confidence: 95 })),
    );
    assert.match(headline(result), /\?$/);
  });

  test('the legend covers all four squares used by the grid', () => {
    assert.equal(legend().length, 4);
    assert.deepEqual(
      legend().map((l) => l.square),
      ['🟩', '🟦', '🟨', '🟥'],
    );
  });
});

/**
 * @param {'left'|'right'} side
 * @returns {'left'|'right'}
 */
function flip(side) {
  return side === 'left' ? 'right' : 'left';
}
