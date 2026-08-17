/**
 * HTML analysis primitives.
 *
 * Deliberately dependency-free and deliberately *not* a full DOM. We only need
 * to answer the questions an AI crawler would ask of a document, and every one
 * of those is answerable from the raw bytes:
 *
 *   - Is there readable content here without executing JavaScript?
 *   - What is this page about, and who published it?
 *   - Is there machine-readable structure, or only visual structure?
 *
 * The first question is the one that matters most and the one most tools skip.
 * Googlebot renders JavaScript; the crawlers behind ChatGPT, Claude and
 * Perplexity largely do not. A React or Vue app that ships an empty `<div id="root">`
 * is fully visible in Google and completely invisible to every other assistant —
 * and nothing in the site owner's own browser will ever reveal that.
 *
 * @module core/html
 */

/**
 * @typedef {object} JsonLdBlock
 * @property {unknown} data
 * @property {string[]} types    Flattened schema type values found anywhere inside.
 * @property {boolean} valid     False when the block is not parseable JSON.
 * @property {string} [error]
 */

/**
 * @typedef {object} PageAnalysis
 * @property {string|null} title
 * @property {string|null} description
 * @property {string|null} canonical
 * @property {string|null} lang
 * @property {string[]} robotsMeta        Directives from <meta name="robots">.
 * @property {string[]} aiMeta            AI-specific opt-out directives found.
 * @property {Heading[]} headings
 * @property {JsonLdBlock[]} jsonLd
 * @property {Record<string,string>} openGraph
 * @property {number} htmlBytes
 * @property {number} textBytes           Visible text after stripping markup.
 * @property {number} scriptBytes
 * @property {number} textRatio           textBytes / htmlBytes.
 * @property {boolean} likelyClientRendered
 * @property {string|null} clientRenderReason
 * @property {number} paragraphs
 * @property {number} links
 * @property {number} images
 * @property {number} imagesWithoutAlt
 * @property {string|null} dateModified
 * @property {string} text                Extracted visible text.
 */

/**
 * @typedef {object} Heading
 * @property {number} level
 * @property {string} text
 */

/** Frameworks that ship an empty mount point and fill it in the browser. */
const SPA_ROOT_PATTERN =
  /<(?:div|main)[^>]*\bid=["'](?:root|app|__next|__nuxt|q-app|svelte)["'][^>]*>\s*<\/(?:div|main)>/i;

/**
 * Analyse an HTML document.
 *
 * @param {string} html
 * @returns {PageAnalysis}
 */
export function analyseHtml(html) {
  const htmlBytes = Buffer.byteLength(html, 'utf8');
  const scriptBytes = sumMatchLengths(html, /<script\b[^>]*>[\s\S]*?<\/script>/gi);
  const text = extractText(html);
  const textBytes = Buffer.byteLength(text, 'utf8');

  const jsonLd = extractJsonLd(html);
  const headings = extractHeadings(html);
  const robotsMeta = extractRobotsMeta(html);

  const cr = detectClientRendering({ html, text, htmlBytes, scriptBytes, textBytes });

  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i, decodeEntities),
    description: metaContent(html, 'description'),
    canonical: firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]*\shref=["']([^"']+)["']/i,
    ) ?? firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]*\srel=["']canonical["']/i),
    lang: firstMatch(html, /<html[^>]*\blang=["']([^"']+)["']/i),
    robotsMeta,
    aiMeta: extractAiMeta(html, robotsMeta),
    headings,
    jsonLd,
    openGraph: extractOpenGraph(html),
    htmlBytes,
    textBytes,
    scriptBytes,
    textRatio: htmlBytes === 0 ? 0 : textBytes / htmlBytes,
    likelyClientRendered: cr.likely,
    clientRenderReason: cr.reason,
    paragraphs: countMatches(html, /<p\b[^>]*>/gi),
    links: countMatches(html, /<a\b[^>]*\shref=/gi),
    images: countMatches(html, /<img\b[^>]*>/gi),
    imagesWithoutAlt: countImagesWithoutAlt(html),
    dateModified: extractDateModified(html, jsonLd),
    text,
  };
}

/**
 * Decide whether the page's content depends on client-side JavaScript.
 *
 * Three independent signals, strongest first. Any one of them firing is enough,
 * because each on its own means a non-rendering crawler gets nothing useful.
 *
 * @param {{html: string, text: string, htmlBytes: number, scriptBytes: number, textBytes: number}} input
 * @returns {{likely: boolean, reason: string|null}}
 */
function detectClientRendering({ html, text, htmlBytes, scriptBytes, textBytes }) {
  if (SPA_ROOT_PATTERN.test(html)) {
    return {
      likely: true,
      reason: 'The document contains an empty application mount point, so the content is injected by JavaScript after load.',
    };
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 100 && scriptBytes > textBytes * 3 && htmlBytes > 2000) {
    return {
      likely: true,
      reason: `The raw HTML carries only ${words} words of text against ${formatBytes(scriptBytes)} of JavaScript.`,
    };
  }

  if (words < 40 && htmlBytes > 1000) {
    return {
      likely: true,
      reason: `The raw HTML contains almost no readable text (${words} words).`,
    };
  }

  return { likely: false, reason: null };
}

/**
 * Extract visible text, dropping markup and non-rendered elements.
 *
 * @param {string} html
 * @returns {string}
 */
export function extractText(html) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract and parse every JSON-LD block.
 *
 * @param {string} html
 * @returns {JsonLdBlock[]}
 */
export function extractJsonLd(html) {
  /** @type {JsonLdBlock[]} */
  const blocks = [];
  const pattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const raw = (match[1] ?? '').trim();
    if (raw === '') continue;
    try {
      const data = JSON.parse(raw);
      blocks.push({ data, types: collectTypes(data), valid: true });
    } catch (error) {
      blocks.push({
        data: null,
        types: [],
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return blocks;
}

/**
 * Walk arbitrary JSON-LD and collect every `@type`, including nested graphs.
 *
 * @param {unknown} node
 * @param {string[]} [acc]
 * @returns {string[]}
 */
function collectTypes(node, acc = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    const record = /** @type {Record<string, unknown>} */ (node);
    const type = record['@type'];
    if (typeof type === 'string') acc.push(type);
    else if (Array.isArray(type)) {
      for (const t of type) if (typeof t === 'string') acc.push(t);
    }
    for (const value of Object.values(record)) collectTypes(value, acc);
  }
  return acc;
}

/**
 * @param {string} html
 * @returns {Heading[]}
 */
export function extractHeadings(html) {
  /** @type {Heading[]} */
  const headings = [];
  const pattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const text = decodeEntities((match[2] ?? '').replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (text !== '') headings.push({ level: Number(match[1]), text });
  }
  return headings;
}

/**
 * @param {string} html
 * @returns {Record<string,string>}
 */
export function extractOpenGraph(html) {
  /** @type {Record<string,string>} */
  const og = {};
  const pattern =
    /<meta\b[^>]*\b(?:property|name)=["'](og:[^"']+)["'][^>]*\bcontent=["']([^"']*)["']/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    og[(match[1] ?? '').toLowerCase()] = decodeEntities(match[2] ?? '');
  }
  return og;
}

/**
 * Directives from `<meta name="robots">` and the crawler-specific variants.
 *
 * @param {string} html
 * @returns {string[]}
 */
function extractRobotsMeta(html) {
  /** @type {string[]} */
  const directives = [];
  const pattern =
    /<meta\b[^>]*\bname=["']((?:robots|googlebot|google|bingbot)[^"']*)["'][^>]*\bcontent=["']([^"']*)["']/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    for (const part of (match[2] ?? '').split(',')) {
      const value = part.trim().toLowerCase();
      if (value !== '') directives.push(value);
    }
  }
  return [...new Set(directives)];
}

/**
 * AI-specific opt-out directives. `noai` and `noimageai` are conventions rather
 * than standards; `nosnippet` and `max-snippet:0` are standards that also
 * suppress AI answer excerpts, which is the part people miss.
 *
 * @param {string} html
 * @param {string[]} robotsMeta
 * @returns {string[]}
 */
function extractAiMeta(html, robotsMeta) {
  /** @type {string[]} */
  const found = [];
  for (const directive of robotsMeta) {
    if (
      directive === 'noai' ||
      directive === 'noimageai' ||
      directive === 'nosnippet' ||
      directive === 'noindex' ||
      directive === 'max-snippet:0' ||
      directive.startsWith('noml')
    ) {
      found.push(directive);
    }
  }
  if (/<meta\b[^>]*\bname=["'](?:noai|tdm-reservation)["']/i.test(html)) {
    found.push('tdm-reservation');
  }
  return [...new Set(found)];
}

/**
 * @param {string} html
 * @param {JsonLdBlock[]} jsonLd
 * @returns {string|null}
 */
function extractDateModified(html, jsonLd) {
  for (const block of jsonLd) {
    const found = findKey(block.data, 'dateModified') ?? findKey(block.data, 'datePublished');
    if (typeof found === 'string') return found;
  }
  return (
    firstMatch(html, /<meta\b[^>]*\bproperty=["']article:modified_time["'][^>]*\bcontent=["']([^"']+)["']/i) ??
    firstMatch(html, /<time\b[^>]*\bdatetime=["']([^"']+)["']/i)
  );
}

/**
 * @param {unknown} node
 * @param {string} key
 * @returns {unknown}
 */
function findKey(node, key) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findKey(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node && typeof node === 'object') {
    const record = /** @type {Record<string, unknown>} */ (node);
    if (key in record) return record[key];
    for (const value of Object.values(record)) {
      const found = findKey(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * @param {string} html
 * @param {string} name
 * @returns {string|null}
 */
function metaContent(html, name) {
  const pattern = new RegExp(
    `<meta\\b[^>]*\\bname=["']${name}["'][^>]*\\bcontent=["']([^"']*)["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${name}["']`,
    'i',
  );
  return firstMatch(html, pattern, decodeEntities) ?? firstMatch(html, reversed, decodeEntities);
}

/**
 * @param {string} html
 * @returns {number}
 */
function countImagesWithoutAlt(html) {
  let count = 0;
  const pattern = /<img\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    if (!/\balt=/i.test(match[0])) count++;
  }
  return count;
}

/**
 * @param {string} html
 * @param {RegExp} pattern
 * @param {(value: string) => string} [transform]
 * @returns {string|null}
 */
function firstMatch(html, pattern, transform) {
  const match = pattern.exec(html);
  if (!match || match[1] === undefined) return null;
  const value = transform ? transform(match[1]) : match[1];
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {string} html
 * @param {RegExp} pattern
 * @returns {number}
 */
function countMatches(html, pattern) {
  return (html.match(pattern) ?? []).length;
}

/**
 * @param {string} html
 * @param {RegExp} pattern
 * @returns {number}
 */
function sumMatchLengths(html, pattern) {
  let total = 0;
  for (const match of html.match(pattern) ?? []) total += Buffer.byteLength(match, 'utf8');
  return total;
}

/** Minimal entity decoding — enough for titles and descriptions. */
const ENTITIES = /** @type {Record<string,string>} */ ({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
});

/**
 * @param {string} value
 * @returns {string}
 */
export function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    const key = String(name).toLowerCase();
    if (key in ENTITIES) return ENTITIES[key] ?? whole;
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
