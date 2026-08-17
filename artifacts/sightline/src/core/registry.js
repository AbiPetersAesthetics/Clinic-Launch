/**
 * The AI crawler registry.
 *
 * This is the knowledge base the whole product is built on, and the part that is
 * genuinely hard to assemble and keep current.
 *
 * The central insight it encodes: **the major AI operators run several separate
 * crawlers with separate robots.txt tokens, doing completely different jobs.**
 * Blocking the training crawler costs you nothing in visibility. Blocking the
 * search crawler removes you from AI answers entirely. They are usually confused
 * for each other, and the resulting misconfiguration is invisible without a tool
 * like this — the site owner simply stops being cited and never learns why.
 *
 * `reachWeight` quantifies that: it is the share of AI answer exposure forfeited
 * by disallowing the agent, on a 0–100 scale. Training crawlers are always 0 —
 * refusing to feed a model costs you no visibility whatsoever. That single
 * distinction is the difference between advice that protects a business and
 * advice that quietly destroys its traffic.
 *
 * Weights are calibrated to assistant reach as of Q3 2026 and are deliberately
 * coarse: they express the shape of the risk, not a false precision.
 *
 * @module core/registry
 */

/** @typedef {import('./types.js').AgentDefinition} AgentDefinition */

/** Bumped whenever weights or entries change, so stored reports stay explainable. */
export const REGISTRY_VERSION = '2026.09';

/**
 * @type {readonly AgentDefinition[]}
 */
export const AGENTS = Object.freeze([
  // -------------------------------------------------------------------------
  // OpenAI — three bots, three jobs. The most commonly misconfigured operator.
  // -------------------------------------------------------------------------
  {
    token: 'GPTBot',
    operator: 'OpenAI',
    product: 'Foundation model training',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans:
      'Your content is excluded from future OpenAI model training. It has no effect on whether ChatGPT cites you.',
    note: 'The most blocked AI crawler on the web. Blocking it is a reasonable content-rights choice and costs zero visibility — but many sites block it believing it also stops ChatGPT reading them, which is not what it does.',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    token: 'OAI-SearchBot',
    operator: 'OpenAI',
    product: 'ChatGPT Search',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 85,
    blockingMeans:
      'You are removed from the index behind ChatGPT Search. ChatGPT can no longer surface or cite you in answers.',
    note: 'This is the single most expensive block on the modern web. It is frequently disallowed by accident, by sites that meant to opt out of training only.',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    token: 'ChatGPT-User',
    operator: 'OpenAI',
    product: 'ChatGPT (user-initiated browsing)',
    purpose: 'user',
    compliance: 'documented',
    reachWeight: 60,
    blockingMeans:
      'When a user explicitly asks ChatGPT to open or summarise your page, it cannot. The assistant reports that the site refused access.',
    note: 'Not an automated crawl — every request corresponds to a real person asking for your page by name.',
    docs: 'https://platform.openai.com/docs/bots',
  },

  // -------------------------------------------------------------------------
  // Anthropic — same three-way split.
  // -------------------------------------------------------------------------
  {
    token: 'ClaudeBot',
    operator: 'Anthropic',
    product: 'Foundation model training',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans:
      'Your content is excluded from future Claude model training. No effect on whether Claude can cite you.',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    token: 'Claude-SearchBot',
    operator: 'Anthropic',
    product: 'Claude web search',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 35,
    blockingMeans:
      'You are dropped from the index Claude consults when searching the web, so Claude stops citing you in answers.',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    token: 'Claude-User',
    operator: 'Anthropic',
    product: 'Claude (user-initiated browsing)',
    purpose: 'user',
    compliance: 'documented',
    reachWeight: 30,
    blockingMeans:
      'Claude cannot fetch your page when a user asks it to read or summarise a specific URL.',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    token: 'anthropic-ai',
    operator: 'Anthropic',
    product: 'Legacy token',
    purpose: 'training',
    compliance: 'token-only',
    reachWeight: 0,
    blockingMeans:
      'Nothing. This token is superseded by the named ClaudeBot / Claude-SearchBot / Claude-User agents.',
    note: 'Extremely common leftover from 2023-era block lists. Harmless, but its presence usually signals a robots.txt that has not been revisited since the current bots existed.',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },

  // -------------------------------------------------------------------------
  // Google — the highest-stakes entry, and the most misunderstood token.
  // -------------------------------------------------------------------------
  {
    token: 'Googlebot',
    operator: 'Google',
    product: 'Google Search, AI Overviews and AI Mode',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 100,
    blockingMeans:
      'You disappear from Google Search and from AI Overviews and AI Mode, which are built on the same index. This is the most damaging block available.',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
  },
  {
    token: 'Google-Extended',
    operator: 'Google',
    product: 'Gemini training and grounding',
    purpose: 'training',
    compliance: 'token-only',
    reachWeight: 0,
    blockingMeans:
      'Your content is not used to improve Gemini models. It does not remove you from Google Search, and it does not remove you from AI Overviews.',
    note: 'Not a real user-agent — it never appears in your logs. It is a control token only. Widely and wrongly believed to govern AI Overviews; those follow Googlebot.',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
  },
  {
    token: 'GoogleOther',
    operator: 'Google',
    product: 'Internal research and product crawls',
    purpose: 'infra',
    compliance: 'documented',
    reachWeight: 5,
    blockingMeans: 'Minor. Used for one-off internal fetches rather than the main search index.',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
  },

  // -------------------------------------------------------------------------
  // Microsoft — Bing is the substrate under Copilot.
  // -------------------------------------------------------------------------
  {
    token: 'bingbot',
    operator: 'Microsoft',
    product: 'Bing Search and Microsoft Copilot',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 55,
    blockingMeans:
      'You leave the Bing index, which also removes you from Microsoft Copilot answers and from the several assistants that license Bing results.',
    docs: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
  },

  // -------------------------------------------------------------------------
  // Perplexity — an answer engine first; blocking it is purely a reach decision.
  // -------------------------------------------------------------------------
  {
    token: 'PerplexityBot',
    operator: 'Perplexity',
    product: 'Perplexity answer index',
    purpose: 'search',
    compliance: 'disputed',
    reachWeight: 40,
    blockingMeans: 'You are removed from Perplexity’s index and stop appearing as a cited source.',
    note: 'Perplexity states it honours robots.txt. Independent network-level research has reported fetches from undeclared agents, so treat robots.txt alone as necessary but not sufficient here.',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    token: 'Perplexity-User',
    operator: 'Perplexity',
    product: 'Perplexity (user-initiated)',
    purpose: 'user',
    compliance: 'disputed',
    reachWeight: 30,
    blockingMeans: 'Perplexity cannot open your page when a user asks for it directly.',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },

  // -------------------------------------------------------------------------
  // Apple
  // -------------------------------------------------------------------------
  {
    token: 'Applebot',
    operator: 'Apple',
    product: 'Siri, Spotlight and Apple Intelligence answers',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 35,
    blockingMeans:
      'You are removed from Siri and Spotlight suggestions and from the sources Apple Intelligence draws on.',
    docs: 'https://support.apple.com/en-us/119829',
  },
  {
    token: 'Applebot-Extended',
    operator: 'Apple',
    product: 'Apple foundation model training',
    purpose: 'training',
    compliance: 'token-only',
    reachWeight: 0,
    blockingMeans:
      'Your content is excluded from Apple foundation model training. Applebot still crawls you for Siri and Spotlight.',
    note: 'A control token, like Google-Extended. Blocking it is a clean way to refuse training while keeping every ounce of Apple visibility.',
    docs: 'https://support.apple.com/en-us/119829',
  },

  // -------------------------------------------------------------------------
  // Meta
  // -------------------------------------------------------------------------
  {
    token: 'meta-externalagent',
    operator: 'Meta',
    product: 'Llama and Meta AI training',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans: 'Your content is excluded from Meta AI model training.',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
  },
  {
    token: 'meta-externalfetcher',
    operator: 'Meta',
    product: 'Meta AI (user-initiated)',
    purpose: 'user',
    compliance: 'documented',
    reachWeight: 20,
    blockingMeans: 'Meta AI cannot fetch your page in response to a user request.',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
  },

  // -------------------------------------------------------------------------
  // Amazon
  // -------------------------------------------------------------------------
  {
    token: 'Amazonbot',
    operator: 'Amazon',
    product: 'Alexa and Rufus answers',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 20,
    blockingMeans: 'You stop being available to Alexa answers and Amazon’s assistant surfaces.',
    docs: 'https://developer.amazon.com/amazonbot',
  },

  // -------------------------------------------------------------------------
  // Bulk training crawlers — zero reach cost to block.
  // -------------------------------------------------------------------------
  {
    token: 'CCBot',
    operator: 'Common Crawl',
    product: 'Open web corpus',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans:
      'You are excluded from the Common Crawl corpus, which is an ingredient in a very large number of third-party training datasets.',
    note: 'High-leverage block if your goal is to limit training use broadly, since many model builders start from Common Crawl rather than crawling you directly.',
    docs: 'https://commoncrawl.org/ccbot',
  },
  {
    token: 'Bytespider',
    operator: 'ByteDance',
    product: 'Doubao / TikTok model training',
    purpose: 'training',
    compliance: 'violating',
    reachWeight: 0,
    blockingMeans:
      'Signals opt-out from ByteDance training, but this crawler has a well documented history of ignoring robots.txt.',
    note: 'Frequently the heaviest bot on a small site’s bandwidth bill. If you genuinely need it stopped, enforce at the WAF or CDN — robots.txt is not reliably obeyed here.',
    docs: 'https://developers.tiktok.com/doc/bytespider',
  },
  {
    token: 'AI2Bot',
    operator: 'Allen Institute for AI',
    product: 'Open research corpora',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans: 'Excludes you from AI2’s open research datasets.',
    docs: 'https://allenai.org/crawler',
  },
  {
    token: 'cohere-ai',
    operator: 'Cohere',
    product: 'Model training and retrieval',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans: 'Excludes you from Cohere’s crawls.',
    docs: 'https://cohere.com/crawler',
  },
  {
    token: 'Diffbot',
    operator: 'Diffbot',
    product: 'Knowledge graph',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans:
      'You are excluded from Diffbot’s knowledge graph, which is resold as an entity source to other AI products. No direct citation loss, though it slightly weakens how well third-party systems can resolve your brand as an entity.',
    docs: 'https://docs.diffbot.com/docs/en/guides-crawlbot-faq',
  },
  {
    token: 'Timpibot',
    operator: 'Timpi',
    product: 'Decentralised index',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans: 'Excludes you from Timpi’s index.',
    docs: 'https://timpi.io',
  },
  {
    token: 'omgili',
    operator: 'Webz.io',
    product: 'Data resale corpus',
    purpose: 'training',
    compliance: 'documented',
    reachWeight: 0,
    blockingMeans:
      'Excludes you from a corpus that is resold in bulk to model builders and data brokers.',
    docs: 'https://webz.io/blog/machine-learning/what-is-the-omgili-bot-and-why-is-it-crawling-my-website/',
  },

  // -------------------------------------------------------------------------
  // Smaller answer engines
  // -------------------------------------------------------------------------
  {
    token: 'MistralAI-User',
    operator: 'Mistral',
    product: 'Le Chat (user-initiated)',
    purpose: 'user',
    compliance: 'documented',
    reachWeight: 10,
    blockingMeans: 'Le Chat cannot fetch your page for a user.',
    docs: 'https://docs.mistral.ai/robots',
  },
  {
    token: 'YouBot',
    operator: 'You.com',
    product: 'You.com answers',
    purpose: 'search',
    compliance: 'documented',
    reachWeight: 8,
    blockingMeans: 'You are removed from You.com’s answer index.',
    docs: 'https://about.you.com/youbot/',
  },
]);

/** Lowercased token → definition. Built once. */
const BY_TOKEN = new Map(
  AGENTS.flatMap((a) => [
    /** @type {[string, AgentDefinition]} */ ([a.token.toLowerCase(), a]),
    ...(a.aliases ?? []).map(
      (alias) => /** @type {[string, AgentDefinition]} */ ([alias.toLowerCase(), a]),
    ),
  ]),
);

/**
 * Look up an agent by its robots.txt token, case-insensitively.
 *
 * @param {string} token
 * @returns {AgentDefinition | undefined}
 */
export function findAgent(token) {
  return BY_TOKEN.get(token.trim().toLowerCase());
}

/**
 * All agents with a given purpose.
 *
 * @param {import('./types.js').AgentPurpose} purpose
 * @returns {AgentDefinition[]}
 */
export function agentsByPurpose(purpose) {
  return AGENTS.filter((a) => a.purpose === purpose);
}

/**
 * Agents whose blocking actually costs visibility. These are the ones the
 * report leads with.
 *
 * @returns {AgentDefinition[]}
 */
export function reachCriticalAgents() {
  return AGENTS.filter((a) => a.reachWeight > 0).sort((a, b) => b.reachWeight - a.reachWeight);
}

/**
 * Agents that can be blocked with no visibility cost — the safe opt-outs.
 *
 * @returns {AgentDefinition[]}
 */
export function zeroCostOptOuts() {
  return AGENTS.filter((a) => a.purpose === 'training');
}

/**
 * Total reach weight in the registry, used to normalise the reach score so it
 * stays stable as entries are added.
 *
 * @returns {number}
 */
export function totalReachWeight() {
  return AGENTS.reduce((sum, a) => sum + a.reachWeight, 0);
}

/**
 * Agents that are real user-agents and therefore worth probing over HTTP.
 * Control tokens like `Google-Extended` never appear in a request, so probing
 * them would be meaningless.
 *
 * @returns {AgentDefinition[]}
 */
export function probeableAgents() {
  return AGENTS.filter((a) => a.compliance !== 'token-only' && a.reachWeight > 0);
}
