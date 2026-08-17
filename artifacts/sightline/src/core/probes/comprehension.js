/**
 * Comprehension probe — if an AI system reaches this page, can it read it?
 *
 * Reach without comprehension is worthless. A crawler that is allowed in and
 * then receives an empty shell has learned nothing about you, and you will never
 * see a symptom: the page looks perfect in your browser, because your browser
 * runs the JavaScript that the crawler does not.
 *
 * @module core/probes/comprehension
 */

import { formatBytes } from '../html.js';

/** @typedef {import('../types.js').Finding} Finding */
/** @typedef {import('../html.js').PageAnalysis} PageAnalysis */

/**
 * @param {PageAnalysis} page
 * @returns {Finding[]}
 */
export function probeComprehension(page) {
  /** @type {Finding[]} */
  const findings = [];
  const words = page.text.split(/\s+/).filter(Boolean).length;

  // The highest-impact finding in this pillar, by a wide margin.
  if (page.likelyClientRendered) {
    findings.push({
      id: 'client-side-rendering',
      pillar: 'comprehension',
      severity: 'critical',
      title: 'Your content requires JavaScript, so most AI crawlers see an empty page',
      detail:
        `${page.clientRenderReason} Googlebot renders JavaScript and will see this page normally. The crawlers behind ChatGPT, Claude and Perplexity largely do not — they read the HTML your server returns and nothing more. To them this page is blank. ` +
        'This failure is invisible from your own browser, which is why it survives for years on otherwise well-built sites.',
      evidence: `${words} words of text in ${formatBytes(page.htmlBytes)} of HTML, against ${formatBytes(page.scriptBytes)} of JavaScript.`,
      fix: 'Server-render or pre-render your pages. Next.js, Nuxt, Astro and SvelteKit all do this by default; the usual cause is a client-only SPA build or a rendering mode that was switched off.',
      scoreImpact: 55,
    });
  } else if (words < 150 && page.htmlBytes > 500) {
    findings.push({
      id: 'thin-content',
      pillar: 'comprehension',
      severity: 'high',
      title: 'Very little readable text on the page',
      detail: `Only ${words} words of extractable text. Answer engines quote and summarise text; a page with almost none cannot be quoted, and so is rarely selected as a source even when it ranks.`,
      fix: 'Add substantive written content covering what this page is actually about.',
      scoreImpact: 25,
    });
  }

  if (page.robotsMeta.includes('noindex')) {
    findings.push({
      id: 'meta-noindex',
      pillar: 'comprehension',
      severity: 'critical',
      title: 'This page is marked noindex',
      detail:
        'A robots meta tag instructs search and answer engines not to index this page. Whatever your robots.txt permits, this page will not appear in AI answers. If this is a live commercial page, it is almost certainly a leftover from staging.',
      evidence: `<meta name="robots" content="${page.robotsMeta.join(', ')}">`,
      fix: 'Remove the noindex directive.',
      scoreImpact: 60,
    });
  }

  if (page.robotsMeta.includes('nosnippet') || page.robotsMeta.includes('max-snippet:0')) {
    findings.push({
      id: 'meta-nosnippet',
      pillar: 'comprehension',
      severity: 'high',
      title: 'Snippets are suppressed, which also suppresses AI answers',
      detail:
        'A "nosnippet" or "max-snippet:0" directive forbids engines from quoting any of this page. Because AI Overviews and assistant answers are built from snippets, this removes you from generated answers even though you remain indexed. Very few sites that set this intend that consequence.',
      evidence: `<meta name="robots" content="${page.robotsMeta.join(', ')}">`,
      fix: 'Remove the directive, or set an explicit "max-snippet:-1" to permit full-length excerpts.',
      scoreImpact: 30,
    });
  }

  if (!page.title) {
    findings.push({
      id: 'missing-title',
      pillar: 'comprehension',
      severity: 'high',
      title: 'No <title> element',
      detail:
        'The title is the strongest single signal of what a page is about, and it is what assistants use as the display label when citing you.',
      fix: 'Add a descriptive <title> of roughly 50–60 characters.',
      scoreImpact: 15,
    });
  } else if (page.title.length < 15) {
    findings.push({
      id: 'short-title',
      pillar: 'comprehension',
      severity: 'low',
      title: 'The page title is very short',
      detail: `"${page.title}" gives an assistant little to work with when deciding whether this page answers a question.`,
      fix: 'Expand the title to describe the page’s subject specifically.',
      scoreImpact: 4,
    });
  }

  if (!page.description) {
    findings.push({
      id: 'missing-description',
      pillar: 'comprehension',
      severity: 'medium',
      title: 'No meta description',
      detail:
        'Answer engines frequently use the meta description as a summary of the page when deciding relevance. Without one they must infer a summary, which is less reliable and often less flattering.',
      fix: 'Add a meta description of 120–160 characters that states plainly what the page offers.',
      scoreImpact: 8,
    });
  }

  const h1s = page.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    findings.push({
      id: 'missing-h1',
      pillar: 'comprehension',
      severity: 'medium',
      title: 'No <h1> heading',
      detail:
        'Headings are how a machine reconstructs the structure of a document. Without an h1 there is no stated main subject, and the page reads as an undifferentiated block of text.',
      fix: 'Add a single <h1> naming the page’s subject.',
      scoreImpact: 8,
    });
  } else if (h1s.length > 1) {
    findings.push({
      id: 'multiple-h1',
      pillar: 'comprehension',
      severity: 'low',
      title: `${h1s.length} <h1> headings on one page`,
      detail:
        'Multiple top-level headings leave the main subject ambiguous, and extraction has to guess which one is the real title.',
      fix: 'Keep one <h1> and demote the rest to <h2>.',
      scoreImpact: 3,
    });
  }

  const skips = findHeadingSkips(page.headings);
  if (skips.length > 0) {
    findings.push({
      id: 'heading-hierarchy-skips',
      pillar: 'comprehension',
      severity: 'low',
      title: 'Heading levels are skipped',
      detail: `The document jumps ${skips.slice(0, 3).join(', ')}. Machine readers use heading depth to work out which passages belong to which section; skipped levels make that nesting ambiguous.`,
      fix: 'Use heading levels in order, without gaps.',
      scoreImpact: 3,
    });
  }

  if (page.headings.length === 0 && words > 300) {
    findings.push({
      id: 'no-headings',
      pillar: 'comprehension',
      severity: 'medium',
      title: 'A long page with no headings at all',
      detail:
        'Assistants retrieve and cite passages, not whole pages. With no headings there are no passage boundaries, so the whole document has to be treated as one lump and is far less likely to be quoted.',
      fix: 'Break the content into sections with descriptive headings.',
      scoreImpact: 10,
    });
  }

  if (!page.lang) {
    findings.push({
      id: 'missing-lang',
      pillar: 'comprehension',
      severity: 'low',
      title: 'No language declared on <html>',
      detail:
        'Without a lang attribute, language must be guessed. This matters most for multilingual sites, where the wrong guess sends your page into the wrong answers entirely.',
      fix: 'Add a lang attribute, for example <html lang="en-GB">.',
      scoreImpact: 3,
    });
  }

  if (page.textRatio < 0.05 && !page.likelyClientRendered && page.htmlBytes > 20000) {
    findings.push({
      id: 'low-text-ratio',
      pillar: 'comprehension',
      severity: 'low',
      title: 'Content is buried in markup',
      detail: `Readable text is ${(page.textRatio * 100).toFixed(1)}% of the document. Heavy markup makes reliable extraction of the main content harder, and increases the chance an assistant quotes navigation or boilerplate instead of your actual content.`,
      fix: 'Reduce wrapper markup and mark the main content with a <main> landmark or <article> element.',
      scoreImpact: 5,
    });
  }

  if (page.images > 4 && page.imagesWithoutAlt / page.images > 0.5) {
    findings.push({
      id: 'images-missing-alt',
      pillar: 'comprehension',
      severity: 'low',
      title: `${page.imagesWithoutAlt} of ${page.images} images have no alt text`,
      detail:
        'Alt text is the only description of an image available to a text-based crawler. On pages where images carry real information — products, charts, before-and-after — that information is simply absent.',
      fix: 'Add alt text describing what each meaningful image shows.',
      scoreImpact: 4,
    });
  }

  return findings;
}

/**
 * @param {import('../html.js').Heading[]} headings
 * @returns {string[]}
 */
function findHeadingSkips(headings) {
  /** @type {string[]} */
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    const previous = headings[i - 1];
    const current = headings[i];
    if (previous && current && current.level > previous.level + 1) {
      skips.push(`h${previous.level} → h${current.level}`);
    }
  }
  return [...new Set(skips)];
}
