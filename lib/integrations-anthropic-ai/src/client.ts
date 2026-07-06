import Anthropic from "@anthropic-ai/sdk";

// Lazily initialised so the server can boot without the Anthropic integration
// configured; the error is raised only when an AI feature is actually used.
function createClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

let _client: Anthropic | null = null;

export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    _client ??= createClient();
    const value = (_client as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? (value as Function).bind(_client) : value;
  },
});
