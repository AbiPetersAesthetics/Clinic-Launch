# Sightline

**Can AI assistants find your website?**

Your customers have started asking ChatGPT, Claude, Perplexity and Google AI for
recommendations instead of scrolling search results. Sightline checks whether
those systems can reach your site, read it, and cite you — and generates the
exact configuration to fix it when they cannot.

```bash
node src/cli.js example.com
```

---

## The problem it solves

The major AI operators each run **several separate crawlers with separate
robots.txt tokens, doing completely different jobs**:

| Crawler | Operator | Job | Blocking it costs you |
| --- | --- | --- | --- |
| `GPTBot` | OpenAI | model training | **nothing** |
| `OAI-SearchBot` | OpenAI | the index behind ChatGPT Search | **your presence in ChatGPT** |
| `ChatGPT-User` | OpenAI | fetches a page a user asked about | that page, on request |
| `ClaudeBot` | Anthropic | model training | **nothing** |
| `Claude-SearchBot` | Anthropic | Claude's web search index | **citations in Claude** |
| `Google-Extended` | Google | Gemini training (a token, not a real bot) | **nothing** — and *not* AI Overviews |
| `Googlebot` | Google | Search, AI Overviews and AI Mode | **everything** |

The names differ by a hyphen. During the 2023–24 wave of blocking "AI
scrapers", enormous numbers of sites pasted in lists that caught both kinds — so
they gave away the training data anyway and deleted themselves from the answer
engines. As of early 2026, **41% of B2B sites still block at least one major AI
bot**.

Nothing tells you. No error, no warning, no dashboard. You simply stop being
recommended.

## What it checks

Four pillars, weighted by consequence.

**Reach (45%)** — Can AI systems fetch you? A full RFC 9309 robots.txt parse
with a verdict for every crawler in the registry, *plus* live per-user-agent HTTP
probes. That second half catches the failure robots.txt cannot show you: a CDN
or WAF returning 403 to AI crawlers while your robots.txt politely says "allow".

**Comprehension (25%)** — Can they read what they fetch? Client-side rendering
detection (Googlebot runs JavaScript; the crawlers behind ChatGPT, Claude and
Perplexity largely do not, so an SPA arrives at them blank), `noindex`,
`nosnippet`, headings, titles, descriptions, content density.

**Attribution (18%)** — Will they credit you? Structured data, entity schema,
`sameAs` corroboration, canonicals, freshness signals.

**Governance (12%)** — Is your policy deliberate? `llms.txt`, sitemap health,
legacy tokens, and whether your configuration is internally coherent at all.

### The posture verdict

The part that exercises judgement rather than measurement. Sightline classifies
what your configuration *means*:

- **Citation-only** — training blocked, answer engines allowed. What most
  businesses want, and few achieve.
- **Open** / **Closed** — coherent, if deliberate.
- **Backwards** — you block the crawlers that would cite you and allow the ones
  that train on you. The exact inverse of what almost everyone wants.
- **Incoherent** — no consistent reading. Usually a robots.txt several people
  have added to over several years.

## Usage

### CLI

```bash
node src/cli.js example.com                      # full audit, human readable
node src/cli.js example.com --verbose            # every finding
node src/cli.js example.com --json > report.json # machine readable
node src/cli.js example.com --write ./public     # write the generated fixes
node src/cli.js example.com --no-probe           # skip live crawler probes
```

Exits non-zero on a critical finding, so it works as a CI guard:

```yaml
- run: node src/cli.js https://example.com --fail-on critical
```

### Server

```bash
npm start          # http://localhost:3000
PORT=8080 npm start
```

| Endpoint | Purpose |
| --- | --- |
| `GET /` | Web UI |
| `GET /api/audit?url=example.com` | Full report as JSON |
| `POST /api/audit` | `{"url": "example.com"}` |
| `GET /api/registry` | The crawler registry, free and unauthenticated |
| `GET /healthz` | Liveness |

### Tests

```bash
npm test          # 86 tests
npm run typecheck # TypeScript in strict mode, via JSDoc
```

## Architecture

The organising principle is that **all I/O lives at the edge and everything else
is a pure function**.

```
src/
  core/                 pure — no network, no clock, no filesystem
    types.js            the domain vocabulary
    registry.js         the AI crawler registry — the core IP
    robots.js           RFC 9309 parser and matcher
    html.js             HTML analysis primitives
    posture.js          coherence judgement
    probes/             one module per pillar
    scoring.js          deterministic, explainable scoring
    remediate.js        generates robots.txt, llms.txt, JSON-LD
    report.js           SiteSnapshot -> AuditReport   ← the seam
  io/                   the only network access
    fetcher.js          HTTP, SSRF defence, bounded concurrency
    audit.js            orchestration
  render/terminal.js    text rendering
  server/               zero-dependency HTTP server + web UI
```

`buildReport(snapshot)` is a pure function. That single decision buys:

- **Testability.** The whole engine is exercised from literal fixtures — 86
  tests, no network, no mocks, no flakiness.
- **Re-scoring.** Stored snapshots can be re-scored against an updated registry
  without re-crawling anyone. When a new crawler appears, every historical report
  can be brought forward for the cost of CPU.
- **Margin.** No model calls, no token spend, no queue. An audit is ~15 HTTP
  requests and a few milliseconds of CPU, which is what lets a subscription hold
  a ~97% gross margin.

### Zero runtime dependencies

Node 22 standard library only — `node:test`, `node:http`, global `fetch`. No
framework, no build step, no lockfile drift, no supply-chain surface. TypeScript
checks the codebase in strict mode through JSDoc annotations without a compile
step.

This is not minimalism for its own sake. The core IP is a deterministic analysis
engine; dependencies would add risk and hosting cost for no value.

### Safety

The service fetches URLs supplied by strangers, so hostnames are resolved before
connecting and checked against loopback, private, link-local, carrier-grade NAT
and unique-local ranges — with **every redirect hop re-validated**, since
otherwise a public URL can redirect to `169.254.169.254`. Responses are size- and
time-bounded, static file serving is path-traversal guarded, and the API is rate
limited.

## Honest limitations

- **One page per audit.** Sitewide crawling is not implemented.
- **No JavaScript execution.** Deliberate — it is what the AI crawlers do — but
  it means Sightline cannot see what a rendering crawler like Googlebot would.
- **Probes are point-in-time.** A bot manager may behave differently under load
  or from a different network location.
- **Reach weights are judgement, not measurement.** They are calibrated to
  assistant reach as of Q3 2026 and express the shape of the risk, not a precise
  traffic forecast.
- **It reports what your configuration does.** It does not predict rankings, and
  it does not measure whether you are currently being cited.

## Commercial strategy

See [`docs/MONETISATION.md`](docs/MONETISATION.md) for pricing, unit economics,
the acquisition plan, and a frank account of the risks.
