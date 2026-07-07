import { anthropic } from "./client";

// Single model for all app AI features. Thinking headroom is added on top of
// the caller's output budget because max_tokens caps thinking + answer combined.
const MODEL = "claude-opus-4-8";
const THINKING_HEADROOM_TOKENS = 8192;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ClaudeCompleteOptions = {
  messages: ChatMessage[];
  /** Output budget for the answer itself (thinking headroom is added on top). */
  maxTokens?: number;
  signal?: AbortSignal;
  /** Replaces OpenAI's response_format json_object: instructs JSON-only output
   *  and strips fences/prose down to the outermost JSON value. */
  jsonOnly?: boolean;
};

function extractJson(text: string): string {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = Math.min(
    ...["{", "["].map(c => clean.indexOf(c)).filter(i => i !== -1),
  );
  if (!Number.isFinite(start)) return clean;
  const end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  return end > start ? clean.slice(start, end + 1) : clean;
}

function splitSystem(messages: ChatMessage[]) {
  const system = messages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));
  return { system: system || undefined, rest };
}

/** One-shot completion — returns the response text. */
export async function claudeComplete({ messages, maxTokens = 4096, signal, jsonOnly }: ClaudeCompleteOptions): Promise<string> {
  const withFormat: ChatMessage[] = jsonOnly
    ? [...messages, { role: "system", content: "Respond with a single valid JSON value only — no markdown fences, no prose before or after it." }]
    : messages;
  const { system, rest } = splitSystem(withFormat);
  // Stream internally (required by the SDK for large max_tokens; also avoids
  // HTTP timeouts on long generations) and return the final message.
  const response = await anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: maxTokens + THINKING_HEADROOM_TOKENS,
      thinking: { type: "adaptive" },
      system,
      messages: rest,
    },
    { signal },
  ).finalMessage();
  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request.");
  }
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map(b => b.text)
    .join("");
  return jsonOnly ? extractJson(text) : text;
}

/** Streaming completion — yields text deltas as they arrive. */
export async function* claudeStreamText({ messages, maxTokens = 4096, signal }: ClaudeCompleteOptions): AsyncGenerator<string> {
  const { system, rest } = splitSystem(messages);
  const stream = anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: maxTokens + THINKING_HEADROOM_TOKENS,
      thinking: { type: "adaptive" },
      system,
      messages: rest,
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
