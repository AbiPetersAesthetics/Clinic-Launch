# Sightline — commercial strategy

Written as the product owner's own assessment, not a pitch. The optimistic case
and the reasons it might not work are both here.

---

## 1. The wedge

A specific, verifiable, expensive mistake that businesses are making right now
and cannot see.

The major AI operators each run **several separate crawlers with separate
robots.txt tokens doing completely different jobs**. OpenAI runs `GPTBot`
(training), `OAI-SearchBot` (the index behind ChatGPT Search) and `ChatGPT-User`
(fetches a page when a user asks). Anthropic mirrors this with `ClaudeBot`,
`Claude-SearchBot` and `Claude-User`. Google splits `Googlebot` from
`Google-Extended`.

The consequences are wildly asymmetric:

| Blocking… | Costs you |
| --- | --- |
| a **training** crawler | nothing at all |
| a **search** crawler | your presence in AI answers |

The names differ by a hyphen. During the 2023–24 "block the AI scrapers" wave,
a very large number of sites pasted in block lists that caught both. **A Q1 2026
cohort audit found 41% of B2B sites still block at least one major AI bot**, and
each blocked engine is estimated to cost 18–34% of potential citations there.

The failure is completely invisible from the inside. There is no error, no
warning in Search Console, no drop in a dashboard anybody looks at. The site
simply stops being recommended.

Sightline finds it in ten seconds, explains the consequence in money terms, and
generates the corrected file.

## 2. Why not just build another GEO tool

The visible market — Profound ($499/mo), Peec (€85–425/mo), Semrush's AI
toolkit ($99/mo) — tracks **whether you get mentioned**. That is a different
product with worse economics:

- It burns LLM tokens on every scheduled prompt, so gross margin is structurally
  capped and costs scale with customers.
- The output is a metric, not a fix. It tells you that you are losing without
  telling you why or what to do.
- It is crowded and funded.

Sightline sits underneath that layer and answers **why**, deterministically. No
model calls, no token spend, no hallucination surface. Different buyer moment
(diagnosis, not measurement), different cost structure, and complementary rather
than competitive — which also makes it a plausible acquisition or integration
target for the tracking vendors later.

## 3. What is actually defensible

Not the code. Any competent engineer could rebuild the scanner in a fortnight.
The defensibility is in three places:

1. **The crawler registry.** Purpose classification, reach weighting, robots
   compliance and consequence text for ~28 crawlers, versioned and kept current.
   Operators add and rename bots continually. This is a maintenance commitment,
   and maintenance commitments are what competitors abandon.
2. **The judgement layer.** Anyone can report "GPTBot is disallowed". Naming the
   configuration as *backwards* — you are blocking what cites you and allowing
   what trains on you — requires an opinion about what businesses want. That
   opinion is the product.
3. **Longitudinal data.** Once monitoring is running, the history of a site's
   configuration (and, in aggregate, of the whole web's) is a dataset nobody
   else has. It also raises switching costs: leaving means losing your record.

## 4. Pricing

| Tier | Price | Who | What |
| --- | --- | --- | --- |
| **Free** | £0 | Anyone | One audit at a time, public shareable report, generated fixes. The acquisition engine. |
| **Pro** | £29/mo | In-house marketer, founder | 5 sites, weekly re-audit, email alert on drift, 12-month history, PDF export |
| **Agency** | £99/mo | Agencies, consultants | 50 sites, client dashboard, white-label PDF, bulk CSV import, monthly digest |
| **Platform** | £249/mo | Hosts, CMS vendors, CDNs | API access, 1,000 audits/mo, embeddable widget |

Reasoning:

- **Free must be genuinely useful**, including the generated robots.txt. A
  crippled free tier kills the sharing that drives acquisition. The paid thing is
  *continuous* assurance, not the first answer.
- **£29 is a rounding error** against the cost of being absent from ChatGPT. It
  sits below the threshold where a marketer needs approval.
- **Agency is the real business.** One relationship, fifty sites, and they bill
  it on as part of a retainer. Churn on tools embedded in client reporting is
  dramatically lower than on individual subscriptions.
- **Platform is the asymmetric bet.** A single hosting company or CMS shipping
  this as a default site-health check is worth more than a thousand Pro
  customers and requires no additional support.

## 5. Unit economics

This is where the zero-dependency, no-LLM architecture pays for itself.

One audit is roughly 15 HTTP requests and a few milliseconds of CPU. There is no
model inference, no database write on the free path, and no queue.

| | |
| --- | --- |
| Marginal cost per audit | fractions of a penny (bandwidth only) |
| Infrastructure at 10k audits/day | one small VPS, ~£20/mo |
| Gross margin | ~97% |
| Break-even | ~2 Pro customers |

Cached results, a stateless process and re-scorable stored snapshots mean the
cost curve stays flat as usage grows. Snapshots can be re-scored against an
updated registry **without re-crawling anyone**, so when a new crawler appears,
every historical customer report can be refreshed for the cost of CPU alone.

## 6. Acquisition — the part that compounds

Paid acquisition is not viable at £29/mo. The whole plan is compounding organic
surface area, which is what makes the revenue passive once it is built.

**a. The free tool is inherently shareable.** Every report has a URL
(`/?url=example.com`). Agencies run it on prospects and send the link as the
opener of a sales conversation. That is unpaid distribution by people with a
commercial motive to distribute it.

**b. Programmatic SEO with genuine per-page value.** The registry supports
thousands of pages that are actually useful rather than doorway spam:

- `/crawlers/gptbot`, `/crawlers/oai-searchbot` — "what is GPTBot", "should I
  block GPTBot" are high-volume, high-intent, permanently-recurring queries
- `/compare/gptbot-vs-oai-searchbot` — the exact confusion the product exists to
  resolve
- `/report/{domain}` — indexable audit pages

**c. The registry as a public good.** `/api/registry` is deliberately free and
unauthenticated. Being the canonical, maintained, machine-readable reference for
AI crawlers earns citations and backlinks — and, fittingly, gets the product
itself recommended by the assistants it audits.

**d. The CLI in CI.** `sightline example.com --fail-on critical` exits non-zero,
so a deploy that accidentally disallows an answer engine fails the build.
Engineering adoption is sticky and free to serve.

## 7. Honest assessment of the risks

**The single-fix problem.** Someone fixes their robots.txt, gets an A, and
cancels. This is the central threat to recurring revenue. Mitigations: drift is
real and continuous (CDN rules change, platforms regenerate robots.txt,
migrations reset things, new crawlers appear monthly), and the agency tier is
priced against a portfolio that is never all-green at once. But a meaningful
share of Pro customers will churn after the fix, and the plan should assume it.

**Platform commoditisation.** Cloudflare, Vercel or Google could ship a basic
version of the access check. Likely, in fact. The defence is depth — judgement,
history, the fix layer, multi-site portfolios — not the scan itself. If a
platform ships it, the Platform tier becomes the business.

**Registry rot.** If the crawler data goes stale the product becomes actively
harmful, because people will act on wrong advice. This is a real operating
obligation of a few hours a month, and it is non-negotiable.

**Category timing.** This depends on AI assistants continuing to matter as a
discovery channel. That looks like a safe bet in 2026, but it is a bet.

**"Passive" is not "unattended".** Realistically this needs a few hours a week:
registry maintenance, support, and content. The compounding part is acquisition,
not operations.

## 8. A realistic path

Not a hockey stick. £5k/month needs roughly 170 Pro customers, or 50 Agency
customers, or some blend — and given only ~6% of micro-SaaS products ever clear
$10k MRR, the honest framing is that most of the work is distribution, not code.

| Phase | Focus | Marker |
| --- | --- | --- |
| 0–3 months | Ship free tool + registry pages. Publish the crawler reference. | Organic traffic, shared reports |
| 3–6 months | Add accounts, monitoring, alerts. Launch Pro. | First paying customers |
| 6–12 months | Agency tier, white-label PDF, bulk import. Direct outreach to agencies. | Agency revenue exceeds Pro |
| 12–18 months | Platform/API tier. Partner conversations with hosts and CMS vendors. | One platform deal |

The compounding asset is the content and the registry. Both get more valuable
every month without further capital, which is the closest thing to passive that
software honestly offers.

## 9. What is built versus what remains

**Built and working now:** the complete analysis engine, crawler registry,
RFC 9309 robots parser, four scoring pillars, posture judgement, fix generation,
HTTP API, web UI, and CLI. 86 tests, zero runtime dependencies.

**Required before charging money:** accounts and billing (Stripe), a database
for scheduled monitoring and history, the programmatic SEO pages, PDF export,
and email alerting. None of it is architecturally hard — the engine is already a
pure function that returns a storable snapshot, which is the part that is
expensive to retrofit and is done.
