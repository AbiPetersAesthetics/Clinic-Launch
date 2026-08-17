/**
 * Posture analysis — the part of Sightline that exercises judgement rather than
 * just measurement.
 *
 * Any scanner can tell you "GPTBot is disallowed". That is a fact, and on its
 * own it is useless: it might be exactly what you intended, or it might be
 * costing you every AI citation you would otherwise earn. What matters is
 * whether your configuration is *coherent* — whether the thing it does matches
 * any goal a rational business could hold.
 *
 * There are only four coherent postures:
 *
 *   open           Everything allowed. Maximum reach, content used for training.
 *   citation-only  Training blocked, answer engines allowed. Maximum reach with
 *                  no training donation. This is what most businesses want, and
 *                  most of them do not know it is available.
 *   closed         Everything blocked. Coherent for paywalled or private sites.
 *   unconfigured   No robots.txt at all — permissive by default, by accident.
 *
 * And two incoherent ones, which are where the money is:
 *
 *   training-only  You block the crawlers that would *cite* you while allowing
 *                  the crawlers that *train* on you. This is the precise inverse
 *                  of what almost everyone wants, and it is common, because the
 *                  bots have confusingly similar names and the damage is
 *                  completely invisible from your own browser.
 *   incoherent     Reach crawlers blocked in a pattern with no coherent reading.
 *
 * Naming that mistake, in the customer's own configuration, with the exact line
 * number, is the product.
 *
 * @module core/posture
 */

import { AGENTS, totalReachWeight } from './registry.js';

/** @typedef {import('./types.js').Posture} Posture */
/** @typedef {import('./types.js').AgentVerdict} AgentVerdict */

/**
 * @typedef {object} PostureAnalysis
 * @property {Posture} posture
 * @property {string} summary            One-paragraph plain-English verdict.
 * @property {boolean} coherent
 * @property {number} reachLostWeight    0–1. Share of AI reach forfeited.
 * @property {number} trainingBlockedRatio 0–1.
 * @property {string[]} blockedReach     Tokens of blocked reach-critical agents.
 * @property {string[]} blockedTraining  Tokens of blocked training agents.
 * @property {string|null} recommendation
 */

/**
 * Infer posture from per-agent verdicts.
 *
 * @param {AgentVerdict[]} verdicts
 * @param {{ robotsTxtPresent: boolean }} context
 * @returns {PostureAnalysis}
 */
export function analysePosture(verdicts, context) {
  const trainingAgents = AGENTS.filter((a) => a.purpose === 'training');
  const blockedTraining = verdicts
    .filter((v) => !v.allowed && v.agent.purpose === 'training')
    .map((v) => v.agent.token);
  const blockedReachVerdicts = verdicts.filter((v) => !v.allowed && v.agent.reachWeight > 0);
  const blockedReach = blockedReachVerdicts.map((v) => v.agent.token);

  const lostWeight = blockedReachVerdicts.reduce((sum, v) => sum + v.agent.reachWeight, 0);
  const reachLostWeight = lostWeight / totalReachWeight();
  const trainingBlockedRatio =
    trainingAgents.length === 0 ? 0 : blockedTraining.length / trainingAgents.length;

  if (!context.robotsTxtPresent) {
    return {
      posture: 'unconfigured',
      coherent: false,
      summary:
        'This site has no robots.txt, so every AI crawler is allowed everything by default. Nothing is broken — you have full AI reach — but the outcome is an accident rather than a decision, and you are donating your content to model training without having chosen to.',
      reachLostWeight: 0,
      trainingBlockedRatio: 0,
      blockedReach,
      blockedTraining,
      recommendation:
        'Publish a robots.txt that keeps every answer engine allowed and opts out of training. You keep all your visibility and stop giving your content away.',
    };
  }

  // The expensive mistake: reach sacrificed while training is waved through.
  if (reachLostWeight > 0.1 && trainingBlockedRatio < 0.5) {
    return {
      posture: 'training-only',
      coherent: false,
      summary: `This configuration is backwards. You are blocking ${blockedReach.length} crawler${blockedReach.length === 1 ? '' : 's'} that would cite you in AI answers (${blockedReach.join(', ')}), while leaving the training crawlers allowed. You are paying the full cost of being invisible and receiving none of the benefit of controlling your content.`,
      reachLostWeight,
      trainingBlockedRatio,
      blockedReach,
      blockedTraining,
      recommendation:
        'Invert it. Allow every search and user-triggered crawler, and disallow the training crawlers instead. Blocking a training crawler costs you nothing in visibility.',
    };
  }

  if (reachLostWeight >= 0.75 && trainingBlockedRatio >= 0.6) {
    return {
      posture: 'closed',
      coherent: true,
      summary:
        'This site is closed to AI systems across the board — training and answer engines alike. That is a coherent choice for paywalled, private, or licence-only content. It does mean AI assistants cannot recommend you to anyone.',
      reachLostWeight,
      trainingBlockedRatio,
      blockedReach,
      blockedTraining,
      recommendation:
        'If this is deliberate, nothing needs changing. If you sell to people who ask assistants for recommendations, consider allowing the search crawlers while keeping training blocked.',
    };
  }

  if (reachLostWeight <= 0.02 && trainingBlockedRatio >= 0.5) {
    return {
      posture: 'citation-only',
      coherent: true,
      summary: `This is the posture most businesses should want and few achieve. Every crawler that can cite you is allowed, and ${blockedTraining.length} training crawler${blockedTraining.length === 1 ? '' : 's'} are opted out. You get the visibility without donating your content to model training.`,
      reachLostWeight,
      trainingBlockedRatio,
      blockedReach,
      blockedTraining,
      recommendation: null,
    };
  }

  if (reachLostWeight <= 0.02 && trainingBlockedRatio < 0.5) {
    return {
      posture: 'open',
      coherent: true,
      summary:
        'Everything is allowed: answer engines can cite you, and training crawlers can use your content. Maximum reach, no restrictions. Coherent — provided donating your content to model training is a decision you have actually made.',
      reachLostWeight,
      trainingBlockedRatio,
      blockedReach,
      blockedTraining,
      recommendation:
        'If you would rather not feed model training, you can opt out of every training crawler without losing a single citation.',
    };
  }

  return {
    posture: 'incoherent',
    coherent: false,
    summary: `This configuration does not correspond to any consistent goal. ${blockedReach.length} answer-engine crawler${blockedReach.length === 1 ? ' is' : 's are'} blocked (${blockedReach.join(', ')}) while others are allowed, and training access is only partly restricted. The usual cause is a robots.txt that has been added to by several people over several years without anyone auditing the result.`,
    reachLostWeight,
    trainingBlockedRatio,
    blockedReach,
    blockedTraining,
    recommendation:
      'Replace the accumulated rules with a single deliberate policy: allow everything that cites you, block everything that trains on you.',
  };
}

/**
 * Human-readable label for a posture.
 *
 * @param {Posture} posture
 * @returns {string}
 */
export function postureLabel(posture) {
  switch (posture) {
    case 'open':
      return 'Open';
    case 'citation-only':
      return 'Citation-only';
    case 'training-only':
      return 'Backwards';
    case 'closed':
      return 'Closed';
    case 'incoherent':
      return 'Incoherent';
    case 'unconfigured':
      return 'Unconfigured';
    default:
      return 'Unknown';
  }
}
