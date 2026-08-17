/**
 * Fixture builders.
 *
 * Because `buildReport` is a pure function of a snapshot, the entire analysis
 * engine can be exercised from literals — no network, no mocks, no timing.
 */

/** @typedef {import('../../src/core/types.js').SiteSnapshot} SiteSnapshot */
/** @typedef {import('../../src/core/types.js').FetchResult} FetchResult */

/**
 * @param {Partial<FetchResult> & { body?: string, status?: number }} [overrides]
 * @returns {FetchResult}
 */
export function fetchResult(overrides = {}) {
  return {
    url: 'https://example.com/',
    requestedUrl: 'https://example.com/',
    status: 200,
    headers: {},
    body: '',
    elapsedMs: 10,
    redirectChain: [],
    error: null,
    ...overrides,
  };
}

/**
 * A snapshot of a healthy, well-configured site. Individual tests override the
 * one dimension they are about, so a failure points at a single cause.
 *
 * @param {object} [overrides]
 * @param {string} [overrides.robotsTxt]
 * @param {string} [overrides.html]
 * @param {string|null} [overrides.llmsTxt]
 * @param {import('../../src/core/types.js').AgentProbe[]} [overrides.agentProbes]
 * @param {number} [overrides.robotsStatus]
 * @returns {SiteSnapshot}
 */
export function snapshot(overrides = {}) {
  const {
    robotsTxt = GOOD_ROBOTS,
    html = GOOD_HTML,
    llmsTxt = GOOD_LLMS_TXT,
    agentProbes = [],
    robotsStatus = 200,
  } = overrides;

  return {
    origin: 'https://example.com',
    pageUrl: 'https://example.com/',
    robotsTxt: fetchResult({ body: robotsTxt, status: robotsStatus }),
    page: fetchResult({ body: html }),
    llmsTxt: llmsTxt === null ? null : fetchResult({ body: llmsTxt }),
    sitemap: fetchResult({ body: '<urlset></urlset>' }),
    agentProbes,
    fetchedAt: '2026-08-17T10:00:00.000Z',
  };
}

export const GOOD_ROBOTS = [
  'User-agent: GPTBot',
  'User-agent: ClaudeBot',
  'User-agent: CCBot',
  'User-agent: Google-Extended',
  'User-agent: Applebot-Extended',
  'User-agent: meta-externalagent',
  'User-agent: Bytespider',
  'User-agent: anthropic-ai',
  'User-agent: AI2Bot',
  'User-agent: cohere-ai',
  'User-agent: Diffbot',
  'User-agent: Timpibot',
  'User-agent: omgili',
  'Disallow: /',
  '',
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: https://example.com/sitemap.xml',
].join('\n');

/** robots.txt that blocks the answer engines and allows the training bots. */
export const BACKWARDS_ROBOTS = [
  'User-agent: OAI-SearchBot',
  'User-agent: Claude-SearchBot',
  'User-agent: PerplexityBot',
  'Disallow: /',
  '',
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: https://example.com/sitemap.xml',
].join('\n');

export const GOOD_HTML = `<!doctype html>
<html lang="en-GB">
<head>
  <title>Acme Widgets — Precision Components for Industry</title>
  <meta name="description" content="Acme Widgets manufactures precision components for industrial applications, shipping worldwide from Sheffield since 1974.">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Acme Widgets">
  <meta property="og:description" content="Precision components for industry.">
  <meta property="og:site_name" content="Acme Widgets">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Acme Widgets",
    "url": "https://example.com",
    "sameAs": ["https://www.linkedin.com/company/acme"],
    "dateModified": "2026-08-01"
  }
  </script>
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "WebPage", "name": "Home" }
  </script>
</head>
<body>
  <main>
    <h1>Precision components for industry</h1>
    <p>${'Acme Widgets has manufactured precision components in Sheffield since 1974. '.repeat(12)}</p>
    <h2>What we make</h2>
    <p>${'Our catalogue covers bearings, housings and custom assemblies to tolerance. '.repeat(12)}</p>
    <h2>How to order</h2>
    <p>${'Request a quotation and our engineering team will respond within one day. '.repeat(12)}</p>
  </main>
</body>
</html>`;

export const SPA_HTML = `<!doctype html>
<html lang="en">
<head><title>App</title></head>
<body>
  <div id="root"></div>
  <script src="/bundle.js">${'x'.repeat(60000)}</script>
</body>
</html>`;

export const GOOD_LLMS_TXT = [
  '# Acme Widgets',
  '',
  '> Precision components for industrial applications.',
  '',
  '## Core pages',
  '',
  '- [Home](https://example.com/): Overview.',
  '- [Products](https://example.com/products): Full catalogue.',
  '',
].join('\n');
