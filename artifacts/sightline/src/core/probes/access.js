/**
 * Reach probe — can AI systems reach this site at all?
 *
 * Produces a verdict for every crawler in the registry by combining two
 * independent sources of truth:
 *
 *   1. What robots.txt *says*.
 *   2. What the server *did* when we asked as that crawler.
 *
 * They disagree more often than people expect. A permissive robots.txt in front
 * of a bot-management rule that 403s anything with "GPT" in its user-agent is
 * one of the most common failures on the modern web, and it is undetectable
 * from robots.txt alone — which is why every robots.txt-only checker misses it.
 *
 * @module core/probes/access
 */

import { AGENTS } from '../registry.js';
import { isAllowed, selectGroup } from '../robots.js';

/** @typedef {import('../types.js').Finding} Finding */
/** @typedef {import('../types.js').AgentVerdict} AgentVerdict */
/** @typedef {import('../types.js').RobotsDocument} RobotsDocument */
/** @typedef {import('../types.js').AgentProbe} AgentProbe */

/**
 * @typedef {object} AccessResult
 * @property {AgentVerdict[]} verdicts
 * @property {Finding[]} findings
 */

/**
 * @param {RobotsDocument} robots
 * @param {AgentProbe[]} probes
 * @param {string} path  Path of the analysed page.
 * @returns {AccessResult}
 */
export function probeAccess(robots, probes, path) {
  const probeByToken = new Map(probes.map((p) => [p.token.toLowerCase(), p]));

  /** @type {AgentVerdict[]} */
  const verdicts = AGENTS.map((agent) => {
    const decision = isAllowed(robots, agent.token, path);
    const probe = probeByToken.get(agent.token.toLowerCase()) ?? null;
    const httpBlocked = probe?.blocked ?? false;

    /** @type {'robots'|'http'|'both'|null} */
    let blockedBy = null;
    if (!decision.allowed && httpBlocked) blockedBy = 'both';
    else if (!decision.allowed) blockedBy = 'robots';
    else if (httpBlocked) blockedBy = 'http';

    return { agent, allowed: decision.allowed && !httpBlocked, blockedBy, decision, probe };
  });

  return { verdicts, findings: buildFindings(robots, verdicts) };
}

/**
 * @param {RobotsDocument} robots
 * @param {AgentVerdict[]} verdicts
 * @returns {Finding[]}
 */
function buildFindings(robots, verdicts) {
  /** @type {Finding[]} */
  const findings = [];

  for (const verdict of verdicts) {
    const { agent } = verdict;

    // Blocking a training crawler is free. Say so explicitly and positively —
    // users arrive braced to be told everything is wrong, and this is the one
    // place where the honest answer is "that was a good decision".
    if (!verdict.allowed && agent.purpose === 'training') {
      findings.push({
        id: `training-opt-out-${slug(agent.token)}`,
        pillar: 'reach',
        severity: 'info',
        title: `${agent.token} is blocked — no visibility cost`,
        detail: `${agent.token} collects content for ${agent.operator} model training. Blocking it removes your content from future training runs and costs you nothing in AI answers or citations.`,
        evidence: evidenceFor(verdict),
        scoreImpact: 0,
        docs: agent.docs,
      });
      continue;
    }

    if (verdict.allowed) continue;

    // A reach-critical crawler is blocked. This is what people are paying to find.
    const severity = severityForWeight(agent.reachWeight);
    findings.push({
      id: `blocked-${slug(agent.token)}`,
      pillar: 'reach',
      severity,
      title: `${agent.token} is blocked — ${agent.product} cannot see you`,
      detail: `${agent.blockingMeans}${agent.note ? ` ${agent.note}` : ''}`,
      evidence: evidenceFor(verdict),
      fix:
        verdict.blockedBy === 'http'
          ? `Your robots.txt allows ${agent.token}, but the server refused the request. Whitelist this user-agent in your CDN, WAF or bot-management rules.`
          : `Remove the rule blocking ${agent.token}, or replace it with an explicit allow group.`,
      scoreImpact: agent.reachWeight,
      docs: agent.docs,
    });
  }

  findings.push(...contradictionFindings(verdicts));
  findings.push(...robotsHygieneFindings(robots, verdicts));
  return findings;
}

/**
 * Cases where robots.txt and the live server disagree.
 *
 * @param {AgentVerdict[]} verdicts
 * @returns {Finding[]}
 */
function contradictionFindings(verdicts) {
  /** @type {Finding[]} */
  const findings = [];
  const httpOnly = verdicts.filter((v) => v.blockedBy === 'http');

  if (httpOnly.length > 0) {
    findings.push({
      id: 'edge-blocking-contradicts-robots',
      pillar: 'reach',
      severity: 'critical',
      title: 'Your server blocks AI crawlers that robots.txt allows',
      detail: `Your robots.txt permits ${httpOnly.map((v) => v.agent.token).join(', ')}, but the server refused those requests at the HTTP level. Something between the crawler and your content — a CDN rule, a WAF, or a bot-management product — is overriding your stated policy. Because robots.txt looks correct, this class of failure usually goes unnoticed for months.`,
      evidence: httpOnly
        .map((v) => `${v.agent.token} → HTTP ${v.probe?.status ?? 0}${v.probe?.blockReason ? ` (${v.probe.blockReason})` : ''}`)
        .join('\n'),
      fix: 'Add these user-agents to the allow list in your CDN or bot-management configuration. In Cloudflare this is a Bot Management or WAF custom rule exception.',
      scoreImpact: Math.min(40, httpOnly.reduce((s, v) => s + v.agent.reachWeight / 3, 0)),
    });
  }

  return findings;
}

/**
 * Structural problems with the robots.txt itself.
 *
 * @param {RobotsDocument} robots
 * @param {AgentVerdict[]} verdicts
 * @returns {Finding[]}
 */
function robotsHygieneFindings(robots, verdicts) {
  /** @type {Finding[]} */
  const findings = [];

  if (!robots.present) {
    findings.push({
      id: 'no-robots-txt',
      pillar: 'reach',
      severity: 'low',
      title: 'No robots.txt',
      detail:
        'Every crawler is allowed everything by default, so your reach is unharmed. But you have no way to opt out of model training, and no way to steer crawlers away from pages you would rather they ignored.',
      fix: 'Publish a robots.txt. The generated one in this report is a good starting point.',
      scoreImpact: 3,
    });
    return findings;
  }

  // A broad token that silently catches an operator's search crawler as well as
  // its training crawler. This is the single highest-value finding in the tool.
  for (const verdict of verdicts) {
    if (verdict.allowed || verdict.agent.reachWeight === 0) continue;
    const group = selectGroup(robots, verdict.agent.token);
    if (!group) continue;
    const broad = group.agents.find(
      (a) => a !== '*' && verdict.agent.token.toLowerCase().startsWith(a) && a.length < verdict.agent.token.length,
    );
    if (!broad) continue;

    const alsoCaught = verdicts.filter(
      (v) => v.agent.token !== verdict.agent.token && v.agent.token.toLowerCase().startsWith(broad),
    );

    findings.push({
      id: `overbroad-token-${slug(broad)}-${slug(verdict.agent.token)}`,
      pillar: 'reach',
      severity: 'high',
      title: `The rule "User-agent: ${broad}" is catching more crawlers than you think`,
      detail: `robots.txt matches user-agents by prefix, not by exact name. Your group for "${broad}" therefore applies to ${verdict.agent.token} as well${alsoCaught.length > 0 ? `, along with ${alsoCaught.map((v) => v.agent.token).join(', ')}` : ''}. If you meant to opt out of ${verdict.agent.operator}'s model training only, this has gone considerably further than that: it also blocks ${verdict.agent.product}.`,
      evidence: `Line ${group.line}: User-agent: ${broad}`,
      fix: `Name each crawler explicitly. Disallow the training crawler by its full token and add an explicit allow group for ${verdict.agent.token}.`,
      scoreImpact: 0, // The underlying block is already scored; this explains it.
      docs: verdict.agent.docs,
    });
  }

  // Legacy tokens that no longer do anything.
  const legacy = verdicts.filter(
    (v) => v.agent.compliance === 'token-only' && v.agent.token === 'anthropic-ai' && !v.allowed,
  );
  if (legacy.length > 0) {
    findings.push({
      id: 'legacy-tokens',
      pillar: 'governance',
      severity: 'low',
      title: 'Your robots.txt contains obsolete AI crawler tokens',
      detail:
        'Tokens such as "anthropic-ai" were superseded by named crawlers and no longer control anything. They are harmless, but they indicate a file that has not been reviewed since the current crawler landscape settled — which is usually where real misconfigurations hide.',
      fix: 'Replace legacy tokens with the current named crawlers.',
      scoreImpact: 2,
    });
  }

  for (const issue of robots.issues) {
    findings.push({
      id: `robots-syntax-${issue.line}`,
      pillar: 'reach',
      severity: issue.severity === 'error' ? 'medium' : 'low',
      title: `robots.txt syntax problem on line ${issue.line}`,
      detail: issue.message,
      evidence: `Line ${issue.line}`,
      fix: 'Correct the line so crawlers interpret your rules as intended.',
      scoreImpact: issue.severity === 'error' ? 5 : 1,
    });
  }

  if (robots.sitemaps.length === 0) {
    findings.push({
      id: 'no-sitemap-declared',
      pillar: 'reach',
      severity: 'medium',
      title: 'No sitemap declared in robots.txt',
      detail:
        'Answer-engine crawlers such as OAI-SearchBot and Claude-SearchBot use sitemaps to discover and re-check pages. Without one they rely on following links, so new and updated pages are found late or not at all.',
      fix: 'Add a "Sitemap:" line pointing at your sitemap.xml.',
      scoreImpact: 6,
    });
  }

  return findings;
}

/**
 * @param {AgentVerdict} verdict
 * @returns {string|undefined}
 */
function evidenceFor(verdict) {
  const parts = [];
  if (verdict.decision.rule) {
    parts.push(
      `robots.txt line ${verdict.decision.rule.line}: ${verdict.decision.rule.type === 'allow' ? 'Allow' : 'Disallow'}: ${verdict.decision.rule.path} (group: ${verdict.decision.matchedAgents.join(', ')})`,
    );
  }
  if (verdict.probe?.blocked) {
    parts.push(`Live request as ${verdict.agent.token} returned HTTP ${verdict.probe.status}`);
  }
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * @param {number} weight
 * @returns {import('../types.js').Severity}
 */
function severityForWeight(weight) {
  if (weight >= 55) return 'critical';
  if (weight >= 25) return 'high';
  if (weight >= 10) return 'medium';
  return 'low';
}

/**
 * @param {string} value
 * @returns {string}
 */
function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
