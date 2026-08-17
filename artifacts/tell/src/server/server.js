/**
 * Tell — HTTP server.
 *
 * Zero dependencies, and almost no state. The puzzle is a pure function of the
 * date, so there is nothing to schedule, nothing to seed, and nothing to
 * migrate. A viral spike is served from CPU alone.
 *
 * That matters more here than in most products: the failure mode for a game
 * that catches fire is falling over on the day it catches fire, and the usual
 * cause is a database in the request path. There isn't one.
 *
 * Marking happens server-side. The client never receives `humanSide`, so the
 * answers cannot be read out of the page — which they would be, publicly,
 * within an hour of launch.
 *
 * @module server/server
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { puzzleForDate, todayUtc, withoutAnswers, revealFor } from '../core/daily.js';
import { CORPUS } from '../core/corpus.js';
import { score, percentile } from '../core/scoring.js';
import { shareText, headline, legend } from '../core/share.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(HERE, 'static');
const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const PUBLIC_URL = process.env['PUBLIC_URL'] ?? 'tell.game';

/**
 * Aggregate accuracies per date, so a player can be told where they landed.
 * In memory deliberately — this is a nice-to-have, and it must never be able to
 * take the game down. A real deployment swaps this for a counter store.
 *
 * @type {Map<string, number[]>}
 */
const plays = new Map();

/** Player-submitted samples awaiting review before they enter the corpus. */
const submissions = /** @type {{text: string, topic: string, at: string}[]} */ ([]);

/** @type {Record<string,string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer((req, res) => {
  handle(req, res).catch(() => sendJson(res, 500, { error: 'Something went wrong' }));
});

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  res.setHeader('x-content-type-options', 'nosniff');

  switch (url.pathname) {
    case '/healthz':
      sendJson(res, 200, { ok: true, corpus: CORPUS.length });
      return;

    case '/api/puzzle': {
      const date = validDate(url.searchParams.get('date')) ?? todayUtc();
      const puzzle = puzzleForDate(date, CORPUS);
      sendJson(res, 200, { ...withoutAnswers(puzzle), legend: legend() });
      return;
    }

    case '/api/play': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST only' });
        return;
      }
      await handlePlay(req, res);
      return;
    }

    case '/api/submit': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST only' });
        return;
      }
      await handleSubmit(req, res);
      return;
    }

    default:
      await serveStatic(url.pathname, res);
  }
}

/**
 * Mark a play and return the verdict, the reveal, and the share card.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handlePlay(req, res) {
  /** @type {{date?: unknown, answers?: unknown}} */
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: 'Body must be JSON' });
    return;
  }

  const date = validDate(typeof body.date === 'string' ? body.date : null) ?? todayUtc();
  if (!Array.isArray(body.answers)) {
    sendJson(res, 400, { error: 'answers must be an array' });
    return;
  }

  const answers = body.answers
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      pairId: String(a.pairId ?? ''),
      choice: a.choice === 'right' ? /** @type {const} */ ('right') : /** @type {const} */ ('left'),
      confidence: Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : 50,
    }));

  const puzzle = puzzleForDate(date, CORPUS);
  const result = score(puzzle.pairs, answers);

  const history = plays.get(date) ?? [];
  const rank = percentile(result.accuracy, history);
  if (result.rounds > 0) {
    history.push(result.accuracy);
    // Bound the array so a long-lived process cannot grow without limit.
    if (history.length > 5000) history.shift();
    plays.set(date, history);
  }

  sendJson(res, 200, {
    result,
    reveal: revealFor(puzzle),
    share: shareText(puzzle, result, { url: PUBLIC_URL }),
    headline: headline(result),
    percentile: rank,
    playedToday: history.length,
    averageAccuracy: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : null,
  });
}

/**
 * Accept a player's own writing for the corpus.
 *
 * This is the second loop and the reason content cost stays at zero: players
 * supply the human half of the game, and get told later how many people
 * mistook them for a machine.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handleSubmit(req, res) {
  /** @type {{text?: unknown, topic?: unknown}} */
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: 'Body must be JSON' });
    return;
  }

  const text = String(body.text ?? '').trim();
  const topic = String(body.topic ?? '').trim();

  if (text.length < 80 || text.length > 900) {
    sendJson(res, 400, { error: 'Write between 80 and 900 characters.' });
    return;
  }
  if (topic === '') {
    sendJson(res, 400, { error: 'Pick a topic so we can pair it fairly.' });
    return;
  }

  submissions.push({ text, topic, at: new Date().toISOString() });
  sendJson(res, 200, {
    accepted: true,
    queued: submissions.length,
    message:
      'Queued for review. Once it is live you will find out how many people thought a person wrote it.',
  });
}

/**
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
 * Accept only well-formed ISO dates, and refuse the future — otherwise anyone
 * can read tomorrow's puzzle today.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
function validDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return null;
  return value > todayUtc() ? null : value;
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
      if (size > 32 * 1024) {
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

server.listen(PORT, HOST, () => {
  process.stdout.write(`Tell listening on http://${HOST}:${PORT}\n`);
});

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
