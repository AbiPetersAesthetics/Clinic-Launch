import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../src/core/report.js';
import { analysePosture } from '../src/core/posture.js';
import { probeAccess } from '../src/core/probes/access.js';
import { parseRobotsTxt } from '../src/core/robots.js';
import { PILLAR_WEIGHTS } from '../src/core/scoring.js';
import { AGENTS, totalReachWeight, findAgent } from '../src/core/registry.js';
import {
  snapshot,
  GOOD_ROBOTS,
  BACKWARDS_ROBOTS,
  SPA_HTML,
  GOOD_HTML,
} from './helpers/snapshot.js';

/**
 * @param {import('../src/core/types.js').AuditReport} report
 * @param {string} id
 */
const has = (report, id) => report.findings.some((f) => f.id === id);

describe('registry integrity', () => {
  test('training crawlers never carry reach weight', () => {
    // The central claim of the product: opting out of training is free.
    for (const agent of AGENTS.filter((a) => a.purpose === 'training')) {
      assert.equal(agent.reachWeight, 0, `${agent.token} must have zero reach weight`);
    }
  });

  test('every search and user crawler carries reach weight', () => {
    for (const agent of AGENTS.filter((a) => a.purpose === 'search' || a.purpose === 'user')) {
      assert.ok(agent.reachWeight > 0, `${agent.token} must have a reach weight`);
    }
  });

  test('tokens are unique', () => {
    const tokens = AGENTS.map((a) => a.token.toLowerCase());
    assert.equal(new Set(tokens).size, tokens.length);
  });

  test('every agent documents what blocking it means, and cites a source', () => {
    for (const agent of AGENTS) {
      assert.ok(agent.blockingMeans.length > 20, `${agent.token} needs a real consequence`);
      assert.match(agent.docs, /^https?:\/\//, `${agent.token} needs a docs URL`);
    }
  });

  test('lookup is case-insensitive', () => {
    assert.equal(findAgent('gptbot')?.token, 'GPTBot');
    assert.equal(findAgent('  OAI-SearchBot ')?.token, 'OAI-SearchBot');
    assert.equal(findAgent('nope'), undefined);
  });

  test('pillar weights sum to one', () => {
    const total = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });
});

describe('posture detection', () => {
  /**
   * @param {string} robotsTxt
   */
  function postureFor(robotsTxt) {
    const robots = parseRobotsTxt(robotsTxt, { present: true });
    const { verdicts } = probeAccess(robots, [], '/');
    return analysePosture(verdicts, { robotsTxtPresent: robots.present });
  }

  test('recognises the citation-only posture and calls it coherent', () => {
    const result = postureFor(GOOD_ROBOTS);
    assert.equal(result.posture, 'citation-only');
    assert.equal(result.coherent, true);
    assert.equal(result.reachLostWeight, 0);
  });

  test('flags the inverted posture as the headline problem', () => {
    const result = postureFor(BACKWARDS_ROBOTS);
    assert.equal(result.posture, 'training-only');
    assert.equal(result.coherent, false);
    assert.match(result.summary, /backwards/i);
    assert.ok(result.blockedReach.includes('OAI-SearchBot'));
    assert.ok(result.recommendation);
  });

  test('recognises a fully open site', () => {
    const result = postureFor('User-agent: *\nAllow: /\nSitemap: https://example.com/s.xml');
    assert.equal(result.posture, 'open');
    assert.equal(result.coherent, true);
  });

  test('recognises a deliberately closed site', () => {
    const result = postureFor('User-agent: *\nDisallow: /');
    assert.equal(result.posture, 'closed');
    assert.equal(result.coherent, true);
  });

  test('treats a missing robots.txt as unconfigured rather than open', () => {
    const robots = parseRobotsTxt('', { present: false });
    const { verdicts } = probeAccess(robots, [], '/');
    const result = analysePosture(verdicts, { robotsTxtPresent: false });
    assert.equal(result.posture, 'unconfigured');
  });

  test('reach lost is measured by weight, not by crawler count', () => {
    // Blocking Googlebot alone must outweigh blocking several minor crawlers.
    const google = postureFor('User-agent: Googlebot\nDisallow: /');
    const minor = postureFor('User-agent: YouBot\nUser-agent: MistralAI-User\nDisallow: /');
    assert.ok(google.reachLostWeight > minor.reachLostWeight);
  });
});

describe('buildReport — end to end', () => {
  test('a well-configured site scores highly and reports no critical findings', () => {
    const report = buildReport(snapshot());
    assert.ok(report.score >= 85, `expected a high score, got ${report.score}`);
    assert.equal(report.posture, 'citation-only');
    assert.equal(report.findings.filter((f) => f.severity === 'critical').length, 0);
    assert.equal(report.grade, report.score >= 90 ? 'A' : 'B');
  });

  test('the inverted configuration is caught, scored down, and explained', () => {
    const report = buildReport(snapshot({ robotsTxt: BACKWARDS_ROBOTS }));
    assert.equal(report.posture, 'training-only');
    assert.ok(has(report, 'blocked-oai-searchbot'));
    assert.ok(has(report, 'incoherent-posture-training-only'));
    assert.ok(report.score < 60, `expected a low score, got ${report.score}`);

    const reach = report.pillars.find((p) => p.pillar === 'reach');
    assert.ok(reach && reach.score < 60);
  });

  test('blocking training crawlers produces informational findings worth zero points', () => {
    const report = buildReport(snapshot());
    const optOuts = report.findings.filter((f) => f.id.startsWith('training-opt-out-'));
    assert.ok(optOuts.length >= 5);
    for (const finding of optOuts) {
      assert.equal(finding.severity, 'info');
      assert.equal(finding.scoreImpact, 0);
    }
  });

  test('detects client-side rendering as a critical comprehension failure', () => {
    const report = buildReport(snapshot({ html: SPA_HTML }));
    const finding = report.findings.find((f) => f.id === 'client-side-rendering');
    assert.ok(finding);
    assert.equal(finding.severity, 'critical');
    assert.match(finding.detail, /Googlebot renders JavaScript/);
  });

  test('detects a noindex meta tag', () => {
    const html = GOOD_HTML.replace('<title>', '<meta name="robots" content="noindex,follow"><title>');
    const report = buildReport(snapshot({ html }));
    assert.ok(has(report, 'meta-noindex'));
  });

  test('detects nosnippet, which silently removes a site from AI answers', () => {
    const html = GOOD_HTML.replace('<title>', '<meta name="robots" content="nosnippet"><title>');
    const report = buildReport(snapshot({ html }));
    const finding = report.findings.find((f) => f.id === 'meta-nosnippet');
    assert.ok(finding);
    assert.equal(finding.severity, 'high');
  });

  test('detects a cross-origin canonical', () => {
    const html = GOOD_HTML.replace(
      'href="https://example.com/"',
      'href="https://someone-else.com/"',
    );
    const report = buildReport(snapshot({ html }));
    assert.ok(has(report, 'cross-origin-canonical'));
  });

  test('detects invalid JSON-LD', () => {
    const html = GOOD_HTML.replace('"name": "Acme Widgets",', '"name": "Acme Widgets",,');
    const report = buildReport(snapshot({ html }));
    assert.ok(has(report, 'invalid-json-ld'));
  });

  test('reports a missing llms.txt and validates a present one', () => {
    assert.ok(has(buildReport(snapshot({ llmsTxt: null })), 'no-llms-txt'));
    assert.ok(has(buildReport(snapshot()), 'llms-txt-valid'));
  });

  test('every score deduction traces back to a finding', () => {
    const report = buildReport(snapshot({ robotsTxt: BACKWARDS_ROBOTS, html: SPA_HTML }));
    for (const pillar of report.pillars) {
      const deducted = pillar.findings.reduce((sum, f) => sum + f.scoreImpact, 0);
      assert.equal(pillar.score, Math.max(0, Math.min(100, Math.round(100 - deducted))));
    }
  });

  test('findings are ordered with the most severe first', () => {
    const report = buildReport(snapshot({ robotsTxt: BACKWARDS_ROBOTS, html: SPA_HTML }));
    const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    for (let i = 1; i < report.findings.length; i++) {
      const previous = report.findings[i - 1];
      const current = report.findings[i];
      assert.ok(previous && current && rank[previous.severity] <= rank[current.severity]);
    }
  });

  test('scores stay within bounds even when everything is wrong', () => {
    const report = buildReport(
      snapshot({ robotsTxt: 'User-agent: *\nDisallow: /', html: '<html><body></body></html>', llmsTxt: null }),
    );
    assert.ok(report.score >= 0 && report.score <= 100);
    for (const pillar of report.pillars) {
      assert.ok(pillar.score >= 0 && pillar.score <= 100);
    }
    assert.ok(['E', 'F'].includes(report.grade), `expected a failing grade, got ${report.grade}`);
  });
});

describe('edge blocking', () => {
  test('a live 403 is caught even when robots.txt allows the crawler', () => {
    const report = buildReport(
      snapshot({
        robotsTxt: 'User-agent: *\nAllow: /\nSitemap: https://example.com/s.xml',
        agentProbes: [
          { token: 'OAI-SearchBot', status: 403, blocked: true, blockReason: 'HTTP 403 from Cloudflare', elapsedMs: 5 },
        ],
      }),
    );
    assert.ok(has(report, 'edge-blocking-contradicts-robots'));
    const verdict = report.agents.find((a) => a.agent.token === 'OAI-SearchBot');
    assert.equal(verdict?.allowed, false);
    assert.equal(verdict?.blockedBy, 'http');
  });

  test('a 404 is not treated as a block', () => {
    const report = buildReport(
      snapshot({
        agentProbes: [
          { token: 'OAI-SearchBot', status: 404, blocked: false, blockReason: null, elapsedMs: 5 },
        ],
      }),
    );
    assert.equal(has(report, 'edge-blocking-contradicts-robots'), false);
  });
});

describe('overbroad token detection', () => {
  test('warns that a short token catches an operator’s search crawler too', () => {
    const report = buildReport(
      snapshot({ robotsTxt: 'User-agent: Claude\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://example.com/s.xml' }),
    );
    const finding = report.findings.find((f) => f.id.startsWith('overbroad-token-claude'));
    assert.ok(finding, 'expected an overbroad-token finding');
    assert.match(finding.detail, /prefix, not by exact name/);
    assert.ok(has(report, 'blocked-claude-searchbot'));
  });
});

describe('remediation', () => {
  test('generates a robots.txt that fixes the inverted posture', () => {
    const report = buildReport(snapshot({ robotsTxt: BACKWARDS_ROBOTS }));
    const generated = report.remediation.robotsTxt;

    // Re-parsing the generated file must yield the coherent posture.
    const reparsed = parseRobotsTxt(generated, { present: true });
    const { verdicts } = probeAccess(reparsed, [], '/');
    const posture = analysePosture(verdicts, { robotsTxtPresent: true });

    assert.equal(posture.posture, 'citation-only');
    assert.equal(posture.reachLostWeight, 0);
  });

  test('preserves non-AI rules from the original file', () => {
    const original = [
      'User-agent: SemrushBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Disallow: /admin',
    ].join('\n');
    const report = buildReport(snapshot({ robotsTxt: original }));

    assert.match(report.remediation.robotsTxt, /User-agent: semrushbot/i);
    assert.match(report.remediation.robotsTxt, /Disallow: \/admin/);
  });

  test('always declares a sitemap', () => {
    const report = buildReport(snapshot({ robotsTxt: 'User-agent: *\nAllow: /' }));
    assert.match(report.remediation.robotsTxt, /^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);
  });

  test('generated llms.txt and JSON-LD are well formed', () => {
    const report = buildReport(snapshot());
    assert.match(report.remediation.llmsTxt, /^# /);
    assert.match(report.remediation.llmsTxt, /^## /m);

    const parsed = JSON.parse(report.remediation.jsonLd);
    assert.equal(parsed['@type'], 'Organization');
    assert.equal(parsed.url, 'https://example.com');
  });

  test('the action plan leads with the most consequential fix', () => {
    const report = buildReport(snapshot({ robotsTxt: BACKWARDS_ROBOTS }));
    assert.match(report.remediation.steps[0] ?? '', /Unblock the answer engines/);
  });

  test('a healthy site is told there is nothing to do', () => {
    const report = buildReport(snapshot());
    assert.match(report.remediation.steps.join(' '), /No structural changes needed/);
  });
});

describe('unreachable pages', () => {
  /**
   * Regression: an early build happily analysed a proxy error page and reported
   * "no <title>" and "no structured data" as though they were the customer's
   * problems. A report that cannot be gathered must say so, not invent findings.
   *
   * @param {Partial<import('../src/core/types.js').FetchResult>} pageOverrides
   */
  function unreachableReport(pageOverrides) {
    const base = snapshot();
    return buildReport({ ...base, page: { ...base.page, ...pageOverrides } });
  }

  test('a 403 is reported as unreachable, not as thin content', () => {
    const report = unreachableReport({ status: 403, body: 'Forbidden' });
    assert.ok(has(report, 'page-unreachable'));
    assert.equal(has(report, 'missing-title'), false);
    assert.equal(has(report, 'no-structured-data'), false);
  });

  test('a connection failure is reported as unreachable', () => {
    const report = unreachableReport({ status: 0, body: '', error: 'ECONNREFUSED' });
    const finding = report.findings.find((f) => f.id === 'page-unreachable');
    assert.ok(finding);
    assert.match(finding.detail, /ECONNREFUSED/);
  });

  test('robots.txt findings still apply when the page is unreachable', () => {
    const base = snapshot({ robotsTxt: BACKWARDS_ROBOTS });
    const report = buildReport({ ...base, page: { ...base.page, status: 500, body: '' } });
    assert.ok(has(report, 'blocked-oai-searchbot'));
    assert.ok(has(report, 'page-unreachable'));
  });

  test('a 200 page is analysed normally', () => {
    assert.equal(has(buildReport(snapshot()), 'page-unreachable'), false);
  });
});

describe('determinism', () => {
  test('the same snapshot always produces the same score', () => {
    const input = snapshot({ robotsTxt: BACKWARDS_ROBOTS, html: SPA_HTML });
    const a = buildReport(input);
    const b = buildReport(input);
    assert.equal(a.score, b.score);
    assert.deepEqual(
      a.findings.map((f) => f.id),
      b.findings.map((f) => f.id),
    );
  });

  test('total reach weight is stable and non-zero', () => {
    assert.ok(totalReachWeight() > 0);
  });
});
