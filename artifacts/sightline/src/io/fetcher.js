/**
 * HTTP fetching — the only I/O in the system.
 *
 * Everything downstream is a pure function over the `FetchResult` values this
 * module produces, which is what keeps the engine testable without a network.
 *
 * Two responsibilities beyond "make a request":
 *
 * **Safety.** This service fetches URLs supplied by strangers. Left naive, that
 * is a server-side request forgery primitive pointed at whatever else shares its
 * network — cloud metadata endpoints being the classic target. So hostnames are
 * resolved before connecting and the resulting addresses are checked against
 * private, loopback, link-local and unique-local ranges, with redirects
 * re-validated at every hop rather than only on the first request.
 *
 * **Politeness.** We identify ourselves honestly, cap response sizes, bound
 * every request in time, and limit concurrency. A tool that audits crawler
 * behaviour has no business behaving badly itself.
 *
 * @module io/fetcher
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** @typedef {import('../core/types.js').FetchResult} FetchResult */

/** How we identify ourselves when not impersonating a crawler for a probe. */
export const SIGHTLINE_UA =
  'Mozilla/5.0 (compatible; SightlineBot/0.1; +https://sightline.audit/bot)';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/**
 * Thrown for URLs we refuse to fetch. Distinguished from network failures so
 * the API can answer 400 rather than 502.
 */
export class UnsafeUrlError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/**
 * Fetch a URL, following redirects manually so every hop is re-validated.
 *
 * Never throws for network conditions — failures come back as a `FetchResult`
 * with `status: 0` and an `error`, because "the server refused us" is itself a
 * finding we want to report rather than an exception that aborts the audit.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.userAgent]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<FetchResult>}
 */
export async function fetchUrl(url, options = {}) {
  const userAgent = options.userAgent ?? SIGHTLINE_UA;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  /** @type {string[]} */
  const redirectChain = [];

  let current = url;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertSafeUrl(current);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const abortListener = () => controller.abort();
      options.signal?.addEventListener('abort', abortListener, { once: true });

      /** @type {Response} */
      let response;
      try {
        response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': userAgent,
            accept: 'text/html,application/xhtml+xml,text/plain,*/*;q=0.8',
            'accept-language': 'en',
          },
        });
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortListener);
      }

      const headers = headersToObject(response.headers);

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return result(current, url, response.status, headers, '', started, redirectChain);
        }
        const next = new URL(location, current).toString();
        redirectChain.push(next);
        current = next;
        continue;
      }

      const body = await readCapped(response);
      return result(current, url, response.status, headers, body, started, redirectChain);
    }

    return errorResult(url, `More than ${MAX_REDIRECTS} redirects`, started, redirectChain);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `Timed out after ${timeoutMs}ms`
          : error.message
        : String(error);
    return errorResult(url, message, started, redirectChain);
  }
}

/**
 * Probe how an origin responds to a specific crawler's user-agent.
 *
 * This is what catches edge blocking: a robots.txt can say "allow" while a bot
 * manager three layers up returns 403 to anything with "GPTBot" in the header.
 * Only an actual request in that identity reveals it.
 *
 * @param {string} url
 * @param {string} token
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<import('../core/types.js').AgentProbe>}
 */
export async function probeAgent(url, token, options = {}) {
  const started = Date.now();
  const response = await fetchUrl(url, {
    userAgent: crawlerUserAgent(token),
    timeoutMs: 8000,
    signal: options.signal,
  });

  const blocked = isBlockingStatus(response.status);
  return {
    token,
    status: response.status,
    blocked,
    blockReason: blocked ? describeBlock(response) : null,
    elapsedMs: Date.now() - started,
  };
}

/**
 * Realistic user-agent strings for probing. Operators publish full strings; the
 * product token alone is often not enough to trigger the same edge rules.
 *
 * @param {string} token
 * @returns {string}
 */
export function crawlerUserAgent(token) {
  switch (token) {
    case 'GPTBot':
      return 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
    case 'OAI-SearchBot':
      return 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot';
    case 'ChatGPT-User':
      return 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
    case 'ClaudeBot':
      return 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)';
    case 'Claude-SearchBot':
      return 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com/claude-searchbot)';
    case 'Claude-User':
      return 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)';
    case 'PerplexityBot':
      return 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)';
    case 'Perplexity-User':
      return 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)';
    case 'Googlebot':
      return 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    case 'bingbot':
      return 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
    case 'Applebot':
      return 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)';
    case 'Amazonbot':
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)';
    default:
      return `Mozilla/5.0 (compatible; ${token}/1.0)`;
  }
}

/**
 * Statuses that mean "you specifically are not welcome" rather than "this page
 * does not exist". A 404 is not a block; a 403 or 429 is.
 *
 * @param {number} status
 * @returns {boolean}
 */
function isBlockingStatus(status) {
  return status === 401 || status === 403 || status === 429 || status === 451 || status === 0;
}

/**
 * @param {FetchResult} response
 * @returns {string}
 */
function describeBlock(response) {
  const server = response.headers['server'] ?? '';
  if (response.status === 0) return response.error ?? 'connection failed';
  if (/cloudflare/i.test(server)) return `HTTP ${response.status} from Cloudflare`;
  if (response.headers['cf-mitigated']) return `Cloudflare bot mitigation (${response.headers['cf-mitigated']})`;
  if (response.status === 429) return 'rate limited';
  if (response.status === 451) return 'blocked for legal reasons';
  return `HTTP ${response.status}${server ? ` from ${server}` : ''}`;
}

/**
 * Reject anything that is not a public, plain-HTTP(S) destination.
 *
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function assertSafeUrl(url) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(`Only http and https are supported, got "${parsed.protocol}"`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  // Literal addresses are checked directly; names are resolved first so a
  // hostname pointing at 127.0.0.1 or 169.254.169.254 cannot slip through.
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new UnsafeUrlError(`Refusing to fetch a private address: ${host}`);
    }
    return;
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new UnsafeUrlError(`Refusing to fetch an internal hostname: ${host}`);
  }

  /** @type {{address: string}[]} */
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve ${host}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnsafeUrlError(`${host} resolves to a private address (${address})`);
    }
  }
}

/**
 * True for loopback, private, link-local, carrier-grade NAT and unique-local
 * addresses — everything that is not routable on the public internet.
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isPrivateAddress(address) {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (version === 6) {
    const normalised = address.toLowerCase();
    if (normalised === '::1' || normalised === '::') return true;
    if (normalised.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(normalised)) return true; // unique-local
    // IPv4-mapped addresses (::ffff:127.0.0.1) must be checked as IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true;
}

/**
 * Read a response body, stopping once the cap is reached so a hostile or
 * accidental multi-gigabyte response cannot exhaust memory.
 *
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function readCapped(response) {
  if (!response.body) return await response.text();

  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;

  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await reader.cancel().catch(() => {});

  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
    .subarray(0, MAX_BYTES)
    .toString('utf8');
}

/**
 * @param {Headers} headers
 * @returns {Record<string,string>}
 */
function headersToObject(headers) {
  /** @type {Record<string,string>} */
  const out = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * @param {number} status
 * @returns {boolean}
 */
function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * @param {string} url
 * @param {string} requestedUrl
 * @param {number} status
 * @param {Record<string,string>} headers
 * @param {string} body
 * @param {number} started
 * @param {string[]} redirectChain
 * @returns {FetchResult}
 */
function result(url, requestedUrl, status, headers, body, started, redirectChain) {
  return {
    url,
    requestedUrl,
    status,
    headers,
    body,
    elapsedMs: Date.now() - started,
    redirectChain,
    error: null,
  };
}

/**
 * @param {string} url
 * @param {string} error
 * @param {number} started
 * @param {string[]} redirectChain
 * @returns {FetchResult}
 */
function errorResult(url, error, started, redirectChain) {
  return {
    url,
    requestedUrl: url,
    status: 0,
    headers: {},
    body: '',
    elapsedMs: Date.now() - started,
    redirectChain,
    error,
  };
}

/**
 * Run tasks with bounded concurrency, preserving input order.
 *
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
export async function mapLimit(tasks, limit) {
  /** @type {T[]} */
  const results = new Array(tasks.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      const task = tasks[index];
      if (task) results[index] = await task();
    }
  });

  await Promise.all(workers);
  return results;
}
