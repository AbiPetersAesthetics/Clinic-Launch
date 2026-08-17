/**
 * Sightline HTTP server.
 *
 * Zero dependencies, on purpose. The whole product is a deterministic function
 * of a few HTTP fetches, so the server needs to do exactly three things: serve
 * a page, run audits, and refuse to be abused. Every dependency added here
 * would be supply-chain risk and memory footprint bought for nothing.
 *
 * That frugality is also the business model. A stateless Node process with no
 * database, no queue and no per-audit token spend costs a few pounds a month to
 * run at meaningful traffic, which is what lets a subscription price hold a
 * ~95% gross margin.
 *
 * @module server/server
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { audit } from '../io/audit.js';
import { UnsafeUrlError } from '../io/fetcher.js';
import { ENGINE_VERSION } from '../core/report.js';
import { AGENTS, REGISTRY_VERSION } from '../core/registry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(HERE, 'static');

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/** Audits are expensive for the *target* site, so results are cached briefly. */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** @type {Map<string, { at: number, report: unknown }>} */
const cache = new Map();

/** Crude fixed-window rate limiting. Enough to stop casual abuse. */
const RATE_LIMIT = Number(process.env['RATE_LIMIT'] ?? 20);
const RATE_WINDOW_MS = 60 * 1000;
/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map();

/** @type {Record<string,string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal error' });
  });
});

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('x-content-type-options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  switch (url.pathname) {
    case '/healthz':
      sendJson(res, 200, { ok: true, engine: ENGINE_VERSION });
      return;

    case '/api/registry':
      // Published deliberately: the registry is the most useful reference in
      // the category, and being the canonical source for it is a growth
      // channel in its own right.
      sendJson(res, 200, {
        version: REGISTRY_VERSION,
        agents: AGENTS,
      });
      return;

    case '/api/audit':
      await handleAudit(req, res, url);
      return;

    default:
      await serveStatic(url.pathname, res);
  }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {URL} url
 * @returns {Promise<void>}
 */
async function handleAudit(req, res, url) {
  /** @type {string|null} */
  let target = url.searchParams.get('url');

  if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      const parsed = /** @type {{url?: unknown}} */ (JSON.parse(body || '{}'));
      if (typeof parsed.url === 'string') target = parsed.url;
    } catch {
      sendJson(res, 400, { error: 'Request body must be JSON' });
      return;
    }
  } else if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Use GET or POST' });
    return;
  }

  if (!target || target.trim() === '') {
    sendJson(res, 400, { error: 'Provide a "url" parameter' });
    return;
  }

  if (!allowRequest(clientKey(req))) {
    res.setHeader('retry-after', '60');
    sendJson(res, 429, { error: 'Rate limit exceeded. Try again in a minute.' });
    return;
  }

  const key = target.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.setHeader('x-cache', 'hit');
    sendJson(res, 200, cached.report);
    return;
  }

  try {
    const probeAgents = url.searchParams.get('probe') !== 'false';
    const { report } = await audit(target, { probeAgents });
    cache.set(key, { at: Date.now(), report });
    pruneCache();
    res.setHeader('x-cache', 'miss');
    sendJson(res, 200, report);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : 'Could not audit that URL',
    });
  }
}

/**
 * Serve a file from the static directory, refusing any path that escapes it.
 *
 * @param {string} pathname
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = normalize(join(STATIC_DIR, relative));

  if (!resolved.startsWith(STATIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(resolved);
    const ext = resolved.slice(resolved.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {string}
 */
function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function allowRequest(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

/** Keep the in-memory caches bounded. */
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.at > CACHE_TTL_MS) cache.delete(key);
  }
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}

server.listen(PORT, HOST, () => {
  process.stdout.write(`Sightline listening on http://${HOST}:${PORT}\n`);
  process.stdout.write(`Engine ${ENGINE_VERSION}\n`);
});

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
