/**
 * A robots.txt parser and matcher implementing RFC 9309, including the
 * real-world behaviours that determine whether a site is actually reachable.
 *
 * Three details matter more than the rest, and getting any of them wrong
 * produces confidently wrong advice:
 *
 * 1. **Group selection uses prefix matching, not equality.** A line reading
 *    `User-agent: Claude` matches ClaudeBot, Claude-User *and* Claude-SearchBot.
 *    Site owners write a short token meaning "the training bot" and silently
 *    disallow the search bot too. Only the single most specific (longest)
 *    matching token applies — matching groups are not merged.
 *
 * 2. **The most specific *rule* wins, not the first one.** Specificity is the
 *    length of the path pattern. On an exact tie, `Allow` beats `Disallow`.
 *    Reading top-to-bottom gives the wrong answer constantly.
 *
 * 3. **An empty `Disallow:` means allow everything**, and is not the same as a
 *    missing line.
 *
 * Everything here is pure: text in, verdicts out.
 *
 * @module core/robots
 */

/** @typedef {import('./types.js').RobotsDocument} RobotsDocument */
/** @typedef {import('./types.js').RobotsGroup} RobotsGroup */
/** @typedef {import('./types.js').RobotsRule} RobotsRule */
/** @typedef {import('./types.js').RobotsDecision} RobotsDecision */
/** @typedef {import('./types.js').ParseIssue} ParseIssue */

/**
 * Parse a robots.txt document.
 *
 * Never throws. Malformed input yields issues rather than an exception, because
 * a broken robots.txt is a finding we want to report, not a crash.
 *
 * @param {string} text
 * @param {{ present?: boolean }} [options]
 * @returns {RobotsDocument}
 */
export function parseRobotsTxt(text, options = {}) {
  const present = options.present ?? true;
  /** @type {RobotsGroup[]} */
  const groups = [];
  /** @type {string[]} */
  const sitemaps = [];
  /** @type {ParseIssue[]} */
  const issues = [];

  // Strip a UTF-8 BOM, which otherwise corrupts the first field name and makes
  // the entire first group silently inert.
  const source = text.replace(/^﻿/, '');
  const lines = source.split(/\r\n|\r|\n/);

  /** @type {RobotsGroup | null} */
  let current = null;
  // Consecutive User-agent lines share one rule set. Once a rule appears, the
  // next User-agent line starts a fresh group (RFC 9309 §2.2.1).
  let acceptingAgents = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const withoutComment = stripComment(lines[i] ?? '');
    const line = withoutComment.trim();
    if (line === '') continue;

    const colon = line.indexOf(':');
    if (colon === -1) {
      issues.push({
        severity: 'warning',
        line: lineNo,
        message: `Line is not a "field: value" pair and will be ignored by crawlers: "${truncate(line, 60)}"`,
      });
      continue;
    }

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (field) {
      case 'user-agent': {
        if (value === '') {
          issues.push({
            severity: 'error',
            line: lineNo,
            message: 'Empty User-agent value. This group will be ignored.',
          });
          break;
        }
        if (current && acceptingAgents) {
          current.agents.push(value.toLowerCase());
        } else {
          current = { agents: [value.toLowerCase()], rules: [], crawlDelay: null, line: lineNo };
          groups.push(current);
          acceptingAgents = true;
        }
        break;
      }

      case 'allow':
      case 'disallow': {
        if (!current) {
          issues.push({
            severity: 'error',
            line: lineNo,
            message: `"${field}" appears before any User-agent line, so every crawler ignores it.`,
          });
          break;
        }
        acceptingAgents = false;
        // An empty Disallow is the documented way to say "allow everything".
        // An empty Allow is meaningless and is skipped.
        if (value === '') {
          if (field === 'disallow') {
            current.rules.push({ type: 'allow', path: '/', line: lineNo });
          }
          break;
        }
        current.rules.push({ type: field, path: value, line: lineNo });
        break;
      }

      case 'crawl-delay': {
        if (!current) break;
        acceptingAgents = false;
        const delay = Number.parseFloat(value);
        if (Number.isFinite(delay)) current.crawlDelay = delay;
        break;
      }

      case 'sitemap': {
        if (value !== '') sitemaps.push(value);
        break;
      }

      default:
        // Unknown fields are legal and must be ignored, per RFC 9309 §2.2.4.
        break;
    }
  }

  return { groups, sitemaps, issues, present, raw: text };
}

/**
 * Decide whether `userAgent` may fetch `path`.
 *
 * @param {RobotsDocument} doc
 * @param {string} userAgent  Crawler product token, e.g. "OAI-SearchBot".
 * @param {string} path       Path with leading slash, e.g. "/pricing".
 * @returns {RobotsDecision}
 */
export function isAllowed(doc, userAgent, path) {
  // A missing robots.txt permits everything. So does an empty one.
  if (!doc.present || doc.groups.length === 0) {
    return { allowed: true, rule: null, matchedAgents: [], basis: 'default' };
  }

  const group = selectGroup(doc, userAgent);
  if (!group) {
    return { allowed: true, rule: null, matchedAgents: [], basis: 'default' };
  }

  const basis = group.agents.includes('*') && !matchesSpecifically(group, userAgent)
    ? /** @type {const} */ ('wildcard')
    : /** @type {const} */ ('explicit');

  const rule = selectRule(group.rules, path);
  if (!rule) {
    return { allowed: true, rule: null, matchedAgents: group.agents, basis };
  }

  return {
    allowed: rule.type === 'allow',
    rule,
    matchedAgents: group.agents,
    basis,
  };
}

/**
 * Choose the group that governs a crawler.
 *
 * Per RFC 9309 §2.2.1 a crawler obeys exactly one group: the one whose
 * user-agent token is the longest case-insensitive prefix of its name. The
 * wildcard group applies only when no named token matches at all.
 *
 * @param {RobotsDocument} doc
 * @param {string} userAgent
 * @returns {RobotsGroup | null}
 */
export function selectGroup(doc, userAgent) {
  const name = userAgent.toLowerCase();
  /** @type {RobotsGroup | null} */
  let best = null;
  let bestLength = -1;

  for (const group of doc.groups) {
    for (const agent of group.agents) {
      if (agent === '*') continue;
      if (name.startsWith(agent) && agent.length > bestLength) {
        best = group;
        bestLength = agent.length;
      }
    }
  }
  if (best) return best;

  for (const group of doc.groups) {
    if (group.agents.includes('*')) return group;
  }
  return null;
}

/**
 * True when the group names this crawler directly rather than catching it via
 * the wildcard.
 *
 * @param {RobotsGroup} group
 * @param {string} userAgent
 * @returns {boolean}
 */
function matchesSpecifically(group, userAgent) {
  const name = userAgent.toLowerCase();
  return group.agents.some((a) => a !== '*' && name.startsWith(a));
}

/**
 * Pick the winning rule for a path: longest pattern wins; `Allow` wins ties.
 *
 * @param {RobotsRule[]} rules
 * @param {string} path
 * @returns {RobotsRule | null}
 */
export function selectRule(rules, path) {
  /** @type {RobotsRule | null} */
  let best = null;
  let bestLength = -1;

  for (const rule of rules) {
    if (!pathMatches(rule.path, path)) continue;
    const length = rule.path.length;
    if (length > bestLength) {
      best = rule;
      bestLength = length;
    } else if (length === bestLength && rule.type === 'allow') {
      // Equal specificity resolves in favour of Allow.
      best = rule;
    }
  }
  return best;
}

/**
 * Match a robots.txt path pattern against a path.
 *
 * Supports the two documented operators: `*` for any run of characters and a
 * trailing `$` to anchor the end. Patterns are prefix matches otherwise.
 *
 * @param {string} pattern
 * @param {string} path
 * @returns {boolean}
 */
export function pathMatches(pattern, path) {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  // Fast path: no wildcard means a plain prefix (or exact, when anchored) test.
  if (!body.includes('*')) {
    return anchored ? path === body : path.startsWith(body);
  }

  const source = '^' + body.split('*').map(escapeRegExp).join('.*') + (anchored ? '$' : '');
  return new RegExp(source).test(path);
}

/**
 * Every rule in the document that mentions the given agent token, so findings
 * can quote the exact offending line back to the user.
 *
 * @param {RobotsDocument} doc
 * @param {string} token
 * @returns {{ group: RobotsGroup, rules: RobotsRule[] }[]}
 */
export function rulesMentioning(doc, token) {
  const needle = token.toLowerCase();
  return doc.groups
    .filter((g) => g.agents.some((a) => a === needle))
    .map((group) => ({ group, rules: group.rules }));
}

/**
 * True when the agent is disallowed from the site root, which is the practical
 * definition of "blocked entirely".
 *
 * @param {RobotsDocument} doc
 * @param {string} userAgent
 * @returns {boolean}
 */
export function isFullyBlocked(doc, userAgent) {
  return !isAllowed(doc, userAgent, '/').allowed;
}

/**
 * Remove a `#` comment, which may appear anywhere on a line.
 *
 * @param {string} line
 * @returns {string}
 */
function stripComment(line) {
  const hash = line.indexOf('#');
  return hash === -1 ? line : line.slice(0, hash);
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function truncate(value, max) {
  return value.length <= max ? value : value.slice(0, max - 1) + '…';
}
