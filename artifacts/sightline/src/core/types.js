/**
 * Sightline domain model.
 *
 * This file defines the vocabulary of the whole system. It contains no logic and
 * no I/O — only types. Everything in `core/` is a pure function over these
 * shapes, which is what makes the engine deterministic, testable, and cheap to
 * run. All network access lives in `io/`.
 *
 * @module core/types
 */

// ---------------------------------------------------------------------------
// The crawler registry
// ---------------------------------------------------------------------------

/**
 * What an AI crawler is actually *for*. This distinction is the single most
 * misunderstood thing in the space: operators run separate bots for separate
 * jobs, each with its own robots.txt token, and blocking one says nothing about
 * the others.
 *
 * - `training`  Collects content that may be used to train a foundation model.
 *               Blocking costs you nothing in visibility. It is purely a
 *               "do I want my content in the model weights" decision.
 * - `search`    Builds and refreshes the index that an assistant consults when
 *               answering. Blocking this removes you from AI answers and
 *               citations. This is the expensive mistake.
 * - `user`      Fetches a page on demand because a human asked the assistant
 *               about it. Blocking it means the assistant cannot open your link
 *               even when a user explicitly requests it.
 * - `agent`     An autonomous agent acting on a user's behalf (browsing,
 *               transacting). The emerging surface.
 * - `infra`     Operational crawlers (previews, verification) that are neither
 *               training nor answering, but whose blocking still has effects.
 *
 * @typedef {'training' | 'search' | 'user' | 'agent' | 'infra'} AgentPurpose
 */

/**
 * How reliably the operator honours robots.txt, stated honestly.
 *
 * - `documented` Operator publicly documents compliance and we have no credible
 *                evidence of systematic violation.
 * - `disputed`   Operator claims compliance but there are credible, documented
 *                reports of violations.
 * - `violating`  Well documented history of ignoring robots.txt.
 * - `token-only` Not a real user-agent at all — a robots.txt token that exists
 *                purely as an opt-out control (e.g. Google-Extended).
 *
 * @typedef {'documented' | 'disputed' | 'violating' | 'token-only'} RobotsCompliance
 */

/**
 * A single entry in the AI crawler registry.
 *
 * @typedef {object} AgentDefinition
 * @property {string} token          Exact robots.txt user-agent token (match is
 *                                   case-insensitive per RFC 9309).
 * @property {string} operator       Company operating the crawler.
 * @property {string} product        Consumer surface it feeds ("ChatGPT Search").
 * @property {AgentPurpose} purpose  What the crawler is for.
 * @property {RobotsCompliance} compliance
 * @property {number} reachWeight    0–100. How much AI visibility you forfeit by
 *                                   blocking this agent. `training` agents are
 *                                   always 0: blocking them costs no reach.
 * @property {string} blockingMeans  Plain-English consequence of disallowing it.
 * @property {string} [note]         Caveat worth surfacing to the user.
 * @property {string} docs           Operator documentation URL.
 * @property {string[]} [aliases]    Other tokens seen in the wild for the same bot.
 */

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/**
 * A single parsed rule line.
 *
 * @typedef {object} RobotsRule
 * @property {'allow' | 'disallow'} type
 * @property {string} path     Raw path pattern, may contain `*` and `$`.
 * @property {number} line     1-based source line, so findings can cite it.
 */

/**
 * A group of user-agents sharing a rule set, per RFC 9309 §2.2.1.
 *
 * @typedef {object} RobotsGroup
 * @property {string[]} agents          Lowercased user-agent tokens.
 * @property {RobotsRule[]} rules
 * @property {number|null} crawlDelay   Non-standard but widely used.
 * @property {number} line              1-based line of the first `User-agent`.
 */

/**
 * The result of parsing a robots.txt document.
 *
 * @typedef {object} RobotsDocument
 * @property {RobotsGroup[]} groups
 * @property {string[]} sitemaps
 * @property {ParseIssue[]} issues     Syntax problems worth reporting.
 * @property {boolean} present         False when the file is absent (404).
 * @property {string} raw
 */

/**
 * @typedef {object} ParseIssue
 * @property {'warning' | 'error'} severity
 * @property {string} message
 * @property {number} line
 */

/**
 * Why a URL was allowed or disallowed — the evidence, not just the verdict.
 *
 * @typedef {object} RobotsDecision
 * @property {boolean} allowed
 * @property {RobotsRule|null} rule    The winning rule, or null if none matched.
 * @property {string[]} matchedAgents  Agent tokens of the group that applied.
 * @property {'explicit' | 'wildcard' | 'default'} basis
 *           `explicit`  a group named this agent directly
 *           `wildcard`  matched via `User-agent: *`
 *           `default`   no group matched, so access is allowed
 */

// ---------------------------------------------------------------------------
// Fetched evidence
// ---------------------------------------------------------------------------

/**
 * The raw result of one HTTP request. Produced in `io/`, consumed by pure
 * probes. Probes never perform I/O themselves — they only read these.
 *
 * @typedef {object} FetchResult
 * @property {string} url             Final URL after redirects.
 * @property {string} requestedUrl
 * @property {number} status          0 when the request failed outright.
 * @property {Record<string,string>} headers  Lowercased header names.
 * @property {string} body
 * @property {number} elapsedMs
 * @property {string[]} redirectChain
 * @property {string|null} error
 */

/**
 * Everything gathered about a site, before any judgement is applied. Keeping
 * this separate from the report means an audit can be re-scored later, or
 * re-scored under new rules, without re-crawling.
 *
 * @typedef {object} SiteSnapshot
 * @property {string} origin              e.g. "https://example.com"
 * @property {string} pageUrl             The page actually analysed.
 * @property {FetchResult} robotsTxt
 * @property {FetchResult} page
 * @property {FetchResult|null} llmsTxt
 * @property {FetchResult|null} sitemap
 * @property {AgentProbe[]} agentProbes   Live per-user-agent HTTP checks.
 * @property {string} fetchedAt           ISO 8601.
 */

/**
 * A live check of how the origin responds to a specific AI user-agent. This
 * catches the large class of blocking that robots.txt cannot show you: WAF
 * rules, bot managers, and CDN edge policies that silently 403 AI crawlers
 * while the robots.txt says "allow".
 *
 * @typedef {object} AgentProbe
 * @property {string} token
 * @property {number} status
 * @property {boolean} blocked
 * @property {string|null} blockReason
 * @property {number} elapsedMs
 */

// ---------------------------------------------------------------------------
// Findings and reports
// ---------------------------------------------------------------------------

/**
 * @typedef {'critical' | 'high' | 'medium' | 'low' | 'info'} Severity
 */

/**
 * @typedef {'reach' | 'comprehension' | 'attribution' | 'governance'} Pillar
 */

/**
 * A single judgement about the site. Findings are the atoms of the report:
 * every score is derived from findings, and every finding carries its own
 * evidence and its own fix. Nothing is asserted without a reason.
 *
 * @typedef {object} Finding
 * @property {string} id              Stable slug, safe to use as a dedupe key.
 * @property {Pillar} pillar
 * @property {Severity} severity
 * @property {string} title           One line, states the problem.
 * @property {string} detail          What is wrong and why it matters.
 * @property {string} [evidence]      Verbatim proof (a robots.txt line, a header).
 * @property {string} [fix]           What to change.
 * @property {number} scoreImpact     Points deducted from the pillar (0–100).
 * @property {string} [docs]
 */

/**
 * The declared intent we infer from a site's configuration.
 *
 * @typedef {'open' | 'citation-only' | 'training-only' | 'closed' | 'incoherent' | 'unconfigured'} Posture
 */

/**
 * @typedef {object} PillarScore
 * @property {Pillar} pillar
 * @property {number} score      0–100.
 * @property {number} weight     Contribution to the overall score.
 * @property {Finding[]} findings
 */

/**
 * @typedef {object} AuditReport
 * @property {string} origin
 * @property {string} pageUrl
 * @property {string} generatedAt
 * @property {number} score                 0–100 overall AI reach score.
 * @property {string} grade                 A–F.
 * @property {Posture} posture
 * @property {string} postureSummary
 * @property {PillarScore[]} pillars
 * @property {Finding[]} findings           All findings, severity-ordered.
 * @property {AgentVerdict[]} agents        Per-crawler verdicts.
 * @property {Remediation} remediation
 * @property {SnapshotMeta} meta
 */

/**
 * @typedef {object} AgentVerdict
 * @property {AgentDefinition} agent
 * @property {boolean} allowed
 * @property {'robots' | 'http' | 'both' | null} blockedBy
 * @property {RobotsDecision} decision
 * @property {AgentProbe|null} probe
 */

/**
 * Generated, copy-pasteable fixes. The report is only half the product; the
 * fixes are what people actually pay for.
 *
 * @typedef {object} Remediation
 * @property {string} robotsTxt      A corrected robots.txt.
 * @property {string} llmsTxt        A starter llms.txt.
 * @property {string} jsonLd         Suggested Organization JSON-LD.
 * @property {string[]} steps        Ordered, human-readable actions.
 */

/**
 * @typedef {object} SnapshotMeta
 * @property {string} fetchedAt
 * @property {number} durationMs
 * @property {boolean} robotsTxtPresent
 * @property {boolean} llmsTxtPresent
 * @property {number} pageBytes
 * @property {string} engineVersion
 */

export {};
