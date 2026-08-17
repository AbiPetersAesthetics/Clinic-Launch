/**
 * Report assembly.
 *
 * The seam of the whole system: a pure function from a `SiteSnapshot` to an
 * `AuditReport`. Everything above it is network I/O; everything below it is
 * arithmetic and judgement.
 *
 * Keeping this boundary sharp buys three things that matter commercially. Tests
 * run against fixture snapshots with no network at all. Stored snapshots can be
 * re-scored under an updated registry without re-crawling anyone's site — so
 * when a new crawler appears, every historical audit can be brought forward.
 * And the marginal cost of a re-score is a few milliseconds of CPU, which is
 * what makes monitoring viable at subscription prices.
 *
 * @module core/report
 */

import { analyseHtml } from './html.js';
import { parseRobotsTxt } from './robots.js';
import { probeAccess } from './probes/access.js';
import { probeComprehension } from './probes/comprehension.js';
import { probeAttribution } from './probes/attribution.js';
import { probeGovernance } from './probes/governance.js';
import { analysePosture } from './posture.js';
import { buildRemediation } from './remediate.js';
import { scorePillars, overallScore, grade, sortFindings } from './scoring.js';
import { REGISTRY_VERSION } from './registry.js';

/** @typedef {import('./types.js').SiteSnapshot} SiteSnapshot */
/** @typedef {import('./types.js').AuditReport} AuditReport */

export const ENGINE_VERSION = `sightline/0.1.0+registry.${REGISTRY_VERSION}`;

/**
 * Build a complete report from gathered evidence.
 *
 * @param {SiteSnapshot} snapshot
 * @returns {AuditReport}
 */
export function buildReport(snapshot) {
  const started = Date.now();

  const robots = parseRobotsTxt(snapshot.robotsTxt.body, {
    present: snapshot.robotsTxt.status === 200,
  });
  const page = analyseHtml(snapshot.page.body);
  const path = pathOf(snapshot.pageUrl);

  const access = probeAccess(robots, snapshot.agentProbes, path);
  const posture = analysePosture(access.verdicts, { robotsTxtPresent: robots.present });

  // If the page itself did not come back, every downstream probe would be
  // analysing an error page and reporting its shortcomings as though they were
  // the site's. That produces a confident, entirely meaningless report, so the
  // content pillars are suppressed and the failure is stated plainly instead.
  const unreachable = unreachableFinding(snapshot);

  const findings = sortFindings(
    unreachable
      ? [...access.findings, unreachable]
      : [
          ...access.findings,
          ...probeComprehension(page),
          ...probeAttribution(page, { origin: snapshot.origin, pageUrl: snapshot.pageUrl }),
          ...probeGovernance({
            llmsTxt: snapshot.llmsTxt,
            sitemap: snapshot.sitemap,
            page,
            posture,
          }),
        ],
  );

  const pillars = scorePillars(findings);
  const score = overallScore(pillars);

  return {
    origin: snapshot.origin,
    pageUrl: snapshot.pageUrl,
    generatedAt: new Date().toISOString(),
    score,
    grade: grade(score),
    posture: posture.posture,
    postureSummary: posture.summary,
    pillars,
    findings,
    agents: access.verdicts,
    remediation: buildRemediation({
      robots,
      verdicts: access.verdicts,
      page,
      findings,
      origin: snapshot.origin,
    }),
    meta: {
      fetchedAt: snapshot.fetchedAt,
      durationMs: Date.now() - started,
      robotsTxtPresent: robots.present,
      llmsTxtPresent: snapshot.llmsTxt?.status === 200,
      pageBytes: page.htmlBytes,
      engineVersion: ENGINE_VERSION,
    },
  };
}

/**
 * A finding for the case where the page could not be retrieved at all.
 *
 * Deliberately scored against every content pillar at once: a page that cannot
 * be fetched has no comprehension or attribution qualities to measure, and
 * scoring it as though it merely lacked a meta description would be dishonest.
 *
 * @param {SiteSnapshot} snapshot
 * @returns {import('./types.js').Finding|null}
 */
function unreachableFinding(snapshot) {
  const { status, error, url } = snapshot.page;
  if (status === 200) return null;

  const cause =
    status === 0
      ? `the request failed (${error ?? 'no response'})`
      : `the server returned HTTP ${status}`;

  return {
    id: 'page-unreachable',
    pillar: 'comprehension',
    severity: 'critical',
    title: 'The page could not be retrieved',
    detail:
      `Sightline asked for ${url} and ${cause}. No AI system can read a page it cannot fetch, so nothing further about this page can be assessed. ` +
      'If the page loads in your browser but not for us, the difference is almost always a bot-management or WAF rule that refuses unfamiliar user-agents — which is exactly what it does to AI crawlers too.',
    evidence: `${url} → ${status === 0 ? error ?? 'no response' : `HTTP ${status}`}`,
    fix: 'Confirm the URL is publicly reachable, then check whether your CDN or WAF is refusing non-browser user-agents.',
    scoreImpact: 100,
  };
}

/**
 * @param {string} url
 * @returns {string}
 */
function pathOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return '/';
  }
}
