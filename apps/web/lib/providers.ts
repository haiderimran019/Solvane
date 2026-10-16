import { env } from "cloudflare:workers";
import type { Citation, ProviderId } from "./product";
import { PROVIDERS } from "./product";

export type CanonicalMessage = { role: "user" | "assistant"; content: string };

export type ProviderResult = {
  text: string;
  citations: Citation[];
  requestId?: string;
};

type ClaudeResponse = { stop_reason?: string; content?: Array<{ type?: string; text?: string }> };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};
type PerplexityResponse = {
  citations?: string[];
  search_results?: Array<{ url?: string; title?: string }>;
  choices?: Array<{ message?: { content?: string } }>;
};

// Current Claude models: run at an explicit medium effort (adaptive thinking stays on). Those with Anthropic's
// server-side refusal fallback opt into it, so a classifier decline is retried on another Claude model in-call.
const CLAUDE_CURRENT_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
const CLAUDE_FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export class ProviderCallError extends Error {
  /**
   * `retryable`: the same provider may succeed later (rate limit, outage, timeout).
   * `fallback`: another provider should get the turn, which also covers a rejected key, unknown model or refusal.
   */
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly status: number,
    readonly retryable: boolean,
    readonly fallback: boolean = retryable,
  ) {
    super(message);
  }
}

export function platformKey(provider: ProviderId): string | undefined {
  const keys: Record<ProviderId, string | undefined> = {
    claude: env.ANTHROPIC_API_KEY,
    gemini: env.GEMINI_API_KEY,
    openai: env.OPENAI_API_KEY,
    perplexity: env.PERPLEXITY_API_KEY,
  };
  return keys[provider];
}

export function configuredModel(
  provider: ProviderId,
  storedModel?: string | null,
): string {
  const models: Record<ProviderId, string | undefined> = {
    claude: env.ANTHROPIC_MODEL,
    gemini: env.GEMINI_MODEL,
    openai: env.OPENAI_MODEL,
    perplexity: env.PERPLEXITY_MODEL,
  };
  return storedModel?.trim() || models[provider] || PROVIDERS[provider].defaultModel;
}

async function requestJson<T>(
  provider: ProviderId,
  url: string,
  init: RequestInit,
  timeoutMs = 45_000,
): Promise<{ data: T; response: Response }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) {
      const status = response.status;
      const retryable = status === 402 || status === 429 || status >= 500;
      // 400/401/403/404 mean this provider can't serve the turn as configured (bad key, retired model, no access):
      // pointless to retry here, but another connected provider may succeed.
      const rejected = [400, 401, 403, 404].includes(status);
      throw new ProviderCallError(
        retryable ? `${PROVIDERS[provider].name} is temporarily unavailable.`
          : status === 401 || status === 403 ? `${PROVIDERS[provider].name} rejected the API key.`
            : status === 404 ? `${PROVIDERS[provider].name} doesn't recognize the model.`
              : `${PROVIDERS[provider].name} rejected the request.`,
        provider,
        status,
        retryable,
        retryable || rejected,
      );
    }
    return { data, response };
  } catch (error) {
    if (error instanceof ProviderCallError) throw error;
    throw new ProviderCallError(
      error instanceof DOMException && error.name === "AbortError"
        ? `${PROVIDERS[provider].name} timed out.`
        : `${PROVIDERS[provider].name} could not be reached.`,
      provider,
      0,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function callProvider(args: {
  provider: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  messages: CanonicalMessage[];
  maxTokens?: number;
  timeoutMs?: number;
  responseSchema?: Record<string, unknown>;
}): Promise<ProviderResult> {
  const { provider, apiKey, model, system, messages, timeoutMs } = args;
  const maxTokens = args.maxTokens ?? 1200;

  if (provider === "claude") {
    const fallbacks = CLAUDE_FALLBACK_MODELS.has(model);
    const { data, response } = await requestJson<ClaudeResponse>(
      provider,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...(fallbacks ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
        },
        body: JSON.stringify({
          model,
          system,
          messages,
          max_tokens: maxTokens,
          ...(CLAUDE_CURRENT_MODELS.has(model) ? { output_config: { effort: "medium" } } : {}),
          ...(fallbacks ? { fallbacks: "default" } : {}),
        }),
      },
      timeoutMs,
    );
    // A refusal is an HTTP 200 without a usable answer; another provider may still continue the project.
    if (data.stop_reason === "refusal") throw new ProviderCallError(`${PROVIDERS[provider].name} declined this request.`, provider, 200, false, true);
    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");
    return {
      text,
      citations: [],
      requestId: response.headers.get("request-id") ?? undefined,
    };
  }

  if (provider === "gemini") {
    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    const { data, response } = await requestJson<GeminiResponse>(
      provider,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          // Gemini 3+ takes thinkingLevel (an error on 2.x); 2.x models take a token budget instead.
          generationConfig: { maxOutputTokens: maxTokens, ...(args.responseSchema ? { responseMimeType: "application/json", responseJsonSchema: args.responseSchema, temperature: 0, thinkingConfig: /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "LOW" } } : {}) },
        }),
      },
      timeoutMs,
    );
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n");
    return {
      text,
      citations: [],
      requestId: response.headers.get("x-request-id") ?? undefined,
    };
  }

  if (provider === "openai") {
    const input = [
      { role: "developer", content: system },
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ];
    const { data, response } = await requestJson<OpenAIResponse>(
      provider,
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input, max_output_tokens: maxTokens }),
      },
      timeoutMs,
    );
    const text =
      data.output_text ??
      (data.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("\n");
    return {
      text,
      citations: [],
      requestId: response.headers.get("x-request-id") ?? undefined,
    };
  }

  const { data, response } = await requestJson<PerplexityResponse>(
    provider,
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: maxTokens,
      }),
    },
    timeoutMs,
  );
  // Newer Sonar responses list sources in search_results; older ones in a top-level citations array.
  const citations: Citation[] = data.citations?.length
    ? data.citations.map((url) => ({ url }))
    : (data.search_results ?? []).filter((result) => result.url).map((result) => ({ url: result.url as string, ...(result.title ? { title: result.title } : {}) }));
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    citations,
    requestId: response.headers.get("x-request-id") ?? undefined,
  };
}
