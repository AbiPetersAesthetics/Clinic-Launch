import Anthropic from "@anthropic-ai/sdk";

// Lazily initialised so the server can boot without the API key configured;
// the error is raised only when an AI feature is actually used.
function createClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY must be set to use AI features. Add it to the repo-root .env file.",
    );
  }

  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
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
