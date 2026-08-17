/**
 * Attribution probe — if an AI system reads this page, will it credit you
 * correctly, and will it trust you enough to use you?
 *
 * Reach and comprehension get you into the candidate set. Attribution decides
 * whether you are the source that gets named. Assistants resolve pages to
 * *entities* — a named organisation with an identity that can be corroborated
 * across the web — and they prefer sources whose claims of authorship,
 * expertise and recency are machine-checkable rather than merely asserted in
 * prose.
 *
 * @module core/probes/attribution
 */

/** @typedef {import('../types.js').Finding} Finding */
/** @typedef {import('../html.js').PageAnalysis} PageAnalysis */

/** Schema types that establish who is publishing. */
const ENTITY_TYPES = new Set([
  'Organization',
  'Corporation',
  'LocalBusiness',
  'NGO',
  'EducationalOrganization',
  'GovernmentOrganization',
  'Person',
  'MedicalBusiness',
  'ProfessionalService',
  'Store',
  'Restaurant',
]);

/** Schema types that make a page's content itself machine-readable. */
const CONTENT_TYPES = new Set([
  'Article',
  'NewsArticle',
  'BlogPosting',
  'TechArticle',
  'Product',
  'Service',
  'FAQPage',
  'HowTo',
  'Recipe',
  'Event',
  'Course',
  'SoftwareApplication',
  'QAPage',
  'WebPage',
]);

/**
 * @param {PageAnalysis} page
 * @param {{ origin: string, pageUrl: string }} context
 * @returns {Finding[]}
 */
export function probeAttribution(page, context) {
  /** @type {Finding[]} */
  const findings = [];
  const allTypes = new Set(page.jsonLd.flatMap((b) => b.types));
  const invalid = page.jsonLd.filter((b) => !b.valid);

  if (page.jsonLd.length === 0) {
    findings.push({
      id: 'no-structured-data',
      pillar: 'attribution',
      severity: 'high',
      title: 'No structured data on the page',
      detail:
        'There is no JSON-LD, so everything about this page — who published it, what it sells, when it was updated — has to be inferred from prose. Structured data is the difference between an assistant guessing your identity and knowing it, and it is the most reliable way to be resolved to a stable entity rather than an anonymous URL.',
      fix: 'Add Organization JSON-LD sitewide, plus a type describing this page specifically (Article, Product, Service, FAQPage).',
      scoreImpact: 30,
      docs: 'https://schema.org/Organization',
    });
  } else {
    if (invalid.length > 0) {
      findings.push({
        id: 'invalid-json-ld',
        pillar: 'attribution',
        severity: 'high',
        title: `${invalid.length} JSON-LD block${invalid.length === 1 ? '' : 's'} failed to parse`,
        detail:
          'Malformed JSON-LD is discarded silently by every consumer. You are carrying the maintenance cost of structured data while receiving none of its benefit, and nothing in your own tooling will tell you.',
        evidence: invalid.map((b) => b.error ?? 'parse error').join('\n'),
        fix: 'Fix the JSON syntax. A trailing comma or an unescaped quote is the usual cause.',
        scoreImpact: 20,
      });
    }

    const hasEntity = [...allTypes].some((t) => ENTITY_TYPES.has(t));
    if (!hasEntity) {
      findings.push({
        id: 'no-entity-schema',
        pillar: 'attribution',
        severity: 'medium',
        title: 'No Organization or Person schema',
        detail:
          'You have structured data but nothing that states who publishes this site. Without a declared entity an assistant cannot connect this page to your brand, your other pages, or your presence elsewhere — so citations end up vague or attributed to someone else.',
        evidence: `Types found: ${[...allTypes].join(', ') || 'none'}`,
        fix: 'Add an Organization block with name, url, logo and sameAs links to your official profiles.',
        scoreImpact: 15,
        docs: 'https://schema.org/Organization',
      });
    }

    const hasContentType = [...allTypes].some((t) => CONTENT_TYPES.has(t));
    if (!hasContentType) {
      findings.push({
        id: 'no-content-schema',
        pillar: 'attribution',
        severity: 'low',
        title: 'No schema describing the page content',
        detail:
          'Nothing declares what kind of page this is. Typing it as an Article, Product, Service or FAQPage tells an assistant what questions the page is fit to answer.',
        fix: 'Add the schema type that matches this page.',
        scoreImpact: 8,
      });
    }

    if (!hasSameAs(page)) {
      findings.push({
        id: 'no-sameas',
        pillar: 'attribution',
        severity: 'low',
        title: 'No sameAs links to corroborate your identity',
        detail:
          'sameAs links your entity to its profiles elsewhere — Companies House, LinkedIn, Wikipedia, Crunchbase. Assistants use exactly this kind of corroboration to decide that two mentions refer to the same organisation, and to decide that the organisation is real.',
        fix: 'Add a sameAs array to your Organization schema listing your official profiles.',
        scoreImpact: 6,
        docs: 'https://schema.org/sameAs',
      });
    }
  }

  if (!page.canonical) {
    findings.push({
      id: 'no-canonical',
      pillar: 'attribution',
      severity: 'medium',
      title: 'No canonical URL declared',
      detail:
        'Without a canonical, the same content reachable at several URLs is treated as several competing pages. Citation credit is split across them, and an assistant may cite a tracking-parameter variant of your page instead of the real one.',
      fix: 'Add <link rel="canonical"> pointing at the preferred URL of this page.',
      scoreImpact: 10,
    });
  } else if (!canonicalMatchesOrigin(page.canonical, context.origin)) {
    findings.push({
      id: 'cross-origin-canonical',
      pillar: 'attribution',
      severity: 'high',
      title: 'The canonical URL points at a different domain',
      detail: `This page declares its canonical as ${page.canonical}, which is not on ${context.origin}. You are instructing engines to credit another domain for this content. That is correct for syndicated copies and catastrophic anywhere else.`,
      evidence: `<link rel="canonical" href="${page.canonical}">`,
      fix: 'Point the canonical at this page’s own URL unless this really is a syndicated copy.',
      scoreImpact: 25,
    });
  }

  if (!page.dateModified) {
    findings.push({
      id: 'no-date-modified',
      pillar: 'attribution',
      severity: 'low',
      title: 'No publication or modification date',
      detail:
        'Assistants weight recency heavily, especially for anything that could plausibly have changed. An undated page is treated as being of unknown age, which loses to a dated competitor.',
      fix: 'Add dateModified and datePublished to your JSON-LD.',
      scoreImpact: 6,
    });
  }

  if (Object.keys(page.openGraph).length === 0) {
    findings.push({
      id: 'no-open-graph',
      pillar: 'attribution',
      severity: 'low',
      title: 'No Open Graph metadata',
      detail:
        'Open Graph tags are a cheap, redundant statement of your title, description and image. Several assistants fall back to them when other metadata is missing or ambiguous.',
      fix: 'Add og:title, og:description, og:url and og:image.',
      scoreImpact: 4,
    });
  }

  return findings;
}

/**
 * @param {PageAnalysis} page
 * @returns {boolean}
 */
function hasSameAs(page) {
  return page.jsonLd.some((block) => JSON.stringify(block.data ?? '').includes('"sameAs"'));
}

/**
 * @param {string} canonical
 * @param {string} origin
 * @returns {boolean}
 */
function canonicalMatchesOrigin(canonical, origin) {
  try {
    // Relative canonicals are resolved against the page, so they always match.
    if (!/^https?:\/\//i.test(canonical)) return true;
    return new URL(canonical).host.replace(/^www\./, '') === new URL(origin).host.replace(/^www\./, '');
  } catch {
    return true;
  }
}
