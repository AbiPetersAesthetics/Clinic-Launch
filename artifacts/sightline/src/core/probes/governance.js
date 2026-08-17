/**
 * Governance probe — is this site's relationship with AI systems deliberate?
 *
 * The other three pillars measure outcomes. This one measures intent. A site
 * that has consciously decided what it wants from AI, and expressed it in the
 * files built for that purpose, is in a fundamentally different position from
 * one whose outcome is the residue of a panic in 2023 — even when the two score
 * identically on reach today. Configuration drifts; intent is what tells you
 * which direction to fix the drift in.
 *
 * @module core/probes/governance
 */

/** @typedef {import('../types.js').Finding} Finding */
/** @typedef {import('../types.js').FetchResult} FetchResult */
/** @typedef {import('../html.js').PageAnalysis} PageAnalysis */
/** @typedef {import('../posture.js').PostureAnalysis} PostureAnalysis */

/**
 * @param {object} input
 * @param {FetchResult|null} input.llmsTxt
 * @param {FetchResult|null} input.sitemap
 * @param {PageAnalysis} input.page
 * @param {PostureAnalysis} input.posture
 * @returns {Finding[]}
 */
export function probeGovernance({ llmsTxt, sitemap, page, posture }) {
  /** @type {Finding[]} */
  const findings = [];

  const hasLlmsTxt = llmsTxt !== null && llmsTxt.status === 200 && llmsTxt.body.trim() !== '';
  if (!hasLlmsTxt) {
    findings.push({
      id: 'no-llms-txt',
      pillar: 'governance',
      severity: 'medium',
      title: 'No llms.txt',
      detail:
        'llms.txt is a Markdown file at your site root that tells an AI system which pages actually matter and what this site is for. robots.txt governs access; llms.txt governs navigation. Adoption is still low, which is precisely why it is worth doing — it is a cheap, uncontested way to steer how assistants describe you, and coding agents already fetch it routinely.',
      fix: 'Publish /llms.txt. This report generates a starting version for you.',
      scoreImpact: 15,
      docs: 'https://llmstxt.org',
    });
  } else {
    findings.push(...validateLlmsTxt(llmsTxt.body));
  }

  if (sitemap && sitemap.status !== 200) {
    findings.push({
      id: 'sitemap-unreachable',
      pillar: 'governance',
      severity: 'medium',
      title: 'The declared sitemap is unreachable',
      detail: `robots.txt points at a sitemap that returned HTTP ${sitemap.status}. Crawlers that rely on it to discover your pages get nothing, and fall back to link-following.`,
      evidence: `${sitemap.requestedUrl} → HTTP ${sitemap.status}`,
      fix: 'Fix the sitemap URL, or remove the Sitemap line if it no longer exists.',
      scoreImpact: 10,
    });
  }

  if (page.aiMeta.includes('noai')) {
    findings.push({
      id: 'noai-meta',
      pillar: 'governance',
      severity: 'info',
      title: 'A "noai" directive is present',
      detail:
        'You are signalling that this content should not be used for AI training. Be aware that "noai" is a community convention rather than a standard: some crawlers honour it, most ignore it, and it carries no legal weight on its own. robots.txt remains the mechanism operators actually implement.',
      fix: 'Keep it if you like, but express the same intent in robots.txt, which is where it will be acted on.',
      scoreImpact: 0,
    });
  }

  if (!posture.coherent && posture.posture !== 'unconfigured') {
    findings.push({
      id: `incoherent-posture-${posture.posture}`,
      pillar: 'governance',
      severity: posture.posture === 'training-only' ? 'critical' : 'high',
      title:
        posture.posture === 'training-only'
          ? 'Your AI policy is inverted: you block the crawlers that cite you and allow the ones that train on you'
          : 'Your AI policy is internally inconsistent',
      detail: posture.summary,
      fix: posture.recommendation ?? undefined,
      // The individual blocks are already scored in the reach pillar; this
      // scores the governance failure of not having a coherent policy at all.
      scoreImpact: posture.posture === 'training-only' ? 35 : 20,
    });
  }

  return findings;
}

/**
 * Validate an llms.txt against the community spec: an H1 name, an optional
 * blockquote summary, then H2 sections of Markdown links.
 *
 * @param {string} body
 * @returns {Finding[]}
 */
function validateLlmsTxt(body) {
  /** @type {Finding[]} */
  const findings = [];
  const lines = body.split(/\r?\n/);
  const hasH1 = lines.some((l) => /^#\s+\S/.test(l));
  const linkCount = (body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  const hasSections = lines.some((l) => /^##\s+\S/.test(l));

  if (!hasH1) {
    findings.push({
      id: 'llms-txt-no-title',
      pillar: 'governance',
      severity: 'low',
      title: 'llms.txt has no H1 title',
      detail:
        'The spec expects the file to open with a single H1 naming the site. Without it, a reader has no declared subject for everything that follows.',
      fix: 'Start the file with "# Your Site Name".',
      scoreImpact: 4,
    });
  }

  if (linkCount === 0) {
    findings.push({
      id: 'llms-txt-no-links',
      pillar: 'governance',
      severity: 'medium',
      title: 'llms.txt contains no links',
      detail:
        'The entire point of the file is to point at the pages that matter. Without links it conveys nothing an assistant could act on.',
      fix: 'List your key pages as Markdown links under H2 sections.',
      scoreImpact: 8,
    });
  } else if (!hasSections) {
    findings.push({
      id: 'llms-txt-no-sections',
      pillar: 'governance',
      severity: 'low',
      title: 'llms.txt has no H2 sections',
      detail:
        'Grouping links under H2 headings ("## Docs", "## Products") tells a reader what each group is for, rather than presenting an undifferentiated list.',
      fix: 'Group your links under descriptive H2 headings.',
      scoreImpact: 3,
    });
  } else {
    findings.push({
      id: 'llms-txt-valid',
      pillar: 'governance',
      severity: 'info',
      title: `Valid llms.txt with ${linkCount} curated link${linkCount === 1 ? '' : 's'}`,
      detail:
        'You are in the small minority of sites that explicitly steer AI systems toward their most important pages. This is a real advantage and it costs nothing to maintain.',
      scoreImpact: 0,
    });
  }

  return findings;
}
