import { env } from "cloudflare:workers";
import type { Citation, ProviderId } from "./product";
import { PROVIDERS } from "./product";

export type CanonicalMessage = { role: "user" | "assistant"; content: string };

export type ProviderResult = {
  text: string;
  citations: Citation[];
  requestId?: string;
};

type ClaudeResponse = { content?: Array<{ type?: string; text?: string }> };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};
type PerplexityResponse = {
  citations?: string[];
  choices?: Array<{ message?: { content?: string } }>;
};

export class ProviderCallError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly status: number,
    readonly retryable: boolean,
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
      const retryable = response.status === 402 || response.status === 429 || response.status >= 500;
      throw new ProviderCallError(
        retryable
          ? `${provider} is temporarily unavailable.`
          : `${provider} rejected the request.`,
        provider,
        response.status,
        retryable,
      );
    }
    return { data, response };
  } catch (error) {
    if (error instanceof ProviderCallError) throw error;
    throw new ProviderCallError(
      error instanceof DOMException && error.name === "AbortError"
        ? `${provider} timed out.`
        : `${provider} could not be reached.`,
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
    const { data, response } = await requestJson<ClaudeResponse>(
      provider,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, system, messages, max_tokens: maxTokens }),
      },
      timeoutMs,
    );
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
          generationConfig: { maxOutputTokens: maxTokens, ...(args.responseSchema ? { responseMimeType: "application/json", responseJsonSchema: args.responseSchema, temperature: 0, thinkingConfig: { thinkingBudget: 0 } } : {}) },
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
  const citations = (data.citations ?? []).map((citation: string) => ({
    url: citation,
  }));
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    citations,
    requestId: response.headers.get("x-request-id") ?? undefined,
  };
}
