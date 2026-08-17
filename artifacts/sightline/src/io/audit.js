/**
 * Audit orchestration — gather evidence, then hand it to the pure core.
 *
 * The split matters: this module decides *what to fetch*, and knows nothing
 * about what any of it means. `core/report.js` decides what it means, and knows
 * nothing about the network. Snapshots are returned alongside reports so they
 * can be stored and re-scored later against an updated crawler registry.
 *
 * @module io/audit
 */

import { fetchUrl, probeAgent, mapLimit, assertSafeUrl, UnsafeUrlError } from './fetcher.js';
import { probeableAgents } from '../core/registry.js';
import { parseRobotsTxt } from '../core/robots.js';
import { buildReport } from '../core/report.js';

/** @typedef {import('../core/types.js').SiteSnapshot} SiteSnapshot */
/** @typedef {import('../core/types.js').AuditReport} AuditReport */

/**
 * @typedef {object} AuditOptions
 * @property {boolean} [probeAgents]   Live per-crawler HTTP probes. Default true.
 * @property {number} [maxProbes]      Cap on crawlers probed. Default 8.
 * @property {number} [concurrency]    Simultaneous requests to the target. Default 4.
 * @property {AbortSignal} [signal]
 * @property {(stage: string) => void} [onProgress]
 */

/**
 * Audit a URL end to end.
 *
 * @param {string} input        A URL or bare hostname.
 * @param {AuditOptions} [options]
 * @returns {Promise<{ report: AuditReport, snapshot: SiteSnapshot }>}
 */
export async function audit(input, options = {}) {
  const target = normaliseUrl(input);
  await assertSafeUrl(target);

  const snapshot = await captureSnapshot(target, options);
  return { report: buildReport(snapshot), snapshot };
}

/**
 * Gather every piece of evidence about a site.
 *
 * @param {string} pageUrl
 * @param {AuditOptions} options
 * @returns {Promise<SiteSnapshot>}
 */
export async function captureSnapshot(pageUrl, options = {}) {
  const {
    probeAgents: shouldProbe = true,
    maxProbes = 8,
    concurrency = 4,
    signal,
    onProgress = () => {},
  } = options;

  const origin = new URL(pageUrl).origin;

  onProgress('Fetching page, robots.txt and llms.txt');
  const [page, robotsTxt, llmsTxt] = await Promise.all([
    fetchUrl(pageUrl, { signal }),
    fetchUrl(`${origin}/robots.txt`, { signal }),
    fetchUrl(`${origin}/llms.txt`, { signal }),
  ]);

  // Only check the sitemap the site actually declares. Guessing at
  // /sitemap.xml and reporting its absence as a failure would be noise.
  const robots = parseRobotsTxt(robotsTxt.body, { present: robotsTxt.status === 200 });
  /** @type {import('../core/types.js').FetchResult|null} */
  let sitemap = null;
  const declared = robots.sitemaps[0];
  if (declared) {
    onProgress('Checking declared sitemap');
    sitemap = await safeFetch(declared, signal);
  }

  /** @type {import('../core/types.js').AgentProbe[]} */
  let agentProbes = [];
  if (shouldProbe) {
    const agents = probeableAgents().slice(0, maxProbes);
    onProgress(`Probing ${agents.length} crawlers`);
    agentProbes = await mapLimit(
      agents.map((agent) => () => probeAgent(pageUrl, agent.token, { signal })),
      concurrency,
    );
  }

  return {
    origin,
    pageUrl: page.url || pageUrl,
    robotsTxt,
    page,
    llmsTxt: llmsTxt.status === 200 ? llmsTxt : null,
    sitemap,
    agentProbes,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch a URL that came from the audited site itself, tolerating the case where
 * it points somewhere we refuse to go.
 *
 * @param {string} url
 * @param {AbortSignal|undefined} signal
 * @returns {Promise<import('../core/types.js').FetchResult|null>}
 */
async function safeFetch(url, signal) {
  try {
    return await fetchUrl(url, { signal });
  } catch (error) {
    if (error instanceof UnsafeUrlError) return null;
    throw error;
  }
}

/**
 * Accept what people actually type. "example.com", "example.com/pricing" and
 * "https://example.com" all mean the same thing to a user.
 *
 * @param {string} input
 * @returns {string}
 */
export function normaliseUrl(input) {
  const trimmed = input.trim();
  if (trimmed === '') throw new UnsafeUrlError('No URL provided');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    url.hash = '';
    return url.toString();
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${input}`);
  }
}
