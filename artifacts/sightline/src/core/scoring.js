/**
 * Scoring.
 *
 * Two rules govern this module, and both exist to keep the number honest:
 *
 * 1. **Every point lost traces to a finding.** A score is a summary of the
 *    findings, never an independent judgement. If we cannot show you the reason,
 *    we do not deduct the point.
 * 2. **The weighting reflects consequence, not effort.** Reach dominates because
 *    being unreachable makes every other quality irrelevant: perfect structured
 *    data on a page no assistant may fetch is worth nothing.
 *
 * @module core/scoring
 */

/** @typedef {import('./types.js').Finding} Finding */
/** @typedef {import('./types.js').Pillar} Pillar */
/** @typedef {import('./types.js').PillarScore} PillarScore */

/**
 * Pillar weights. They sum to 1.
 *
 * @type {Record<Pillar, number>}
 */
export const PILLAR_WEIGHTS = {
  reach: 0.45,
  comprehension: 0.25,
  attribution: 0.18,
  governance: 0.12,
};

/** @type {Record<Pillar, string>} */
export const PILLAR_LABELS = {
  reach: 'Reach',
  comprehension: 'Comprehension',
  attribution: 'Attribution',
  governance: 'Governance',
};

/** @type {Record<Pillar, string>} */
export const PILLAR_QUESTIONS = {
  reach: 'Can AI systems fetch your pages?',
  comprehension: 'Can they read and understand what they fetch?',
  attribution: 'Will they credit you, and do they trust you?',
  governance: 'Is your AI policy deliberate and maintained?',
};

/** Ordering used everywhere findings are displayed. */
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Score each pillar from its findings.
 *
 * @param {Finding[]} findings
 * @returns {PillarScore[]}
 */
export function scorePillars(findings) {
  return /** @type {Pillar[]} */ (Object.keys(PILLAR_WEIGHTS)).map((pillar) => {
    const own = findings.filter((f) => f.pillar === pillar);
    const deducted = own.reduce((sum, f) => sum + f.scoreImpact, 0);
    return {
      pillar,
      score: clamp(Math.round(100 - deducted), 0, 100),
      weight: PILLAR_WEIGHTS[pillar],
      findings: sortFindings(own),
    };
  });
}

/**
 * Combine pillar scores into the headline number.
 *
 * @param {PillarScore[]} pillars
 * @returns {number}
 */
export function overallScore(pillars) {
  const total = pillars.reduce((sum, p) => sum + p.score * p.weight, 0);
  return clamp(Math.round(total), 0, 100);
}

/**
 * @param {number} score
 * @returns {string}
 */
export function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  if (score >= 35) return 'E';
  return 'F';
}

/**
 * A one-line reading of the headline score, so the number is never presented
 * without an interpretation.
 *
 * @param {number} score
 * @returns {string}
 */
export function scoreSummary(score) {
  if (score >= 90) return 'AI systems can reach, read and correctly attribute this site.';
  if (score >= 80) return 'Fundamentally healthy, with a few fixable gaps.';
  if (score >= 65) return 'Reachable, but leaving meaningful AI visibility on the table.';
  if (score >= 50) return 'Significant problems are limiting how often AI systems can use this site.';
  if (score >= 35) return 'Serious barriers. Most assistants will struggle to cite this site.';
  return 'This site is effectively invisible to AI assistants.';
}

/**
 * Sort by severity, then by score impact within a severity.
 *
 * @param {Finding[]} findings
 * @returns {Finding[]}
 */
export function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return bySeverity !== 0 ? bySeverity : b.scoreImpact - a.scoreImpact;
  });
}

/**
 * The findings worth acting on first: highest impact, actionable, deduplicated
 * by pillar so the list reads as a plan rather than a pile.
 *
 * @param {Finding[]} findings
 * @param {number} [limit]
 * @returns {Finding[]}
 */
export function priorityFindings(findings, limit = 5) {
  return sortFindings(findings.filter((f) => f.severity !== 'info' && f.scoreImpact > 0)).slice(
    0,
    limit,
  );
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
