export const PROVIDER_IDS = [
  "claude",
  "gemini",
  "openai",
  "perplexity",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDERS: Record<
  ProviderId,
  { name: string; shortName: string; role: string; defaultModel: string; color: string }
> = {
  claude: {
    name: "Claude",
    shortName: "CL",
    role: "Thoughtful builder",
    defaultModel: "claude-3-5-haiku-latest",
    color: "#f59e7a",
  },
  gemini: {
    name: "Gemini",
    shortName: "GE",
    role: "Long-context analyst",
    defaultModel: "gemini-2.5-flash",
    color: "#7cb4ff",
  },
  openai: {
    name: "OpenAI",
    shortName: "OA",
    role: "Fast generalist",
    defaultModel: "gpt-4o-mini",
    color: "#70d6b3",
  },
  perplexity: {
    name: "Perplexity",
    shortName: "PX",
    role: "Cited research",
    defaultModel: "sonar",
    color: "#b892ff",
  },
};

export type Citation = { url: string; title?: string };

export type RelaySnapshot = {
  objective: string;
  currentTask: string;
  constraints: string[];
  decisions: string[];
  completed: string[];
  openQuestions: string[];
  nextAction: string;
};

export const EMPTY_SNAPSHOT: RelaySnapshot = {
  objective: "Start the first conversation in this folder.",
  currentTask: "No active task yet.",
  constraints: [],
  decisions: [],
  completed: [],
  openQuestions: [],
  nextAction: "Send a message to establish the project state.",
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDER_IDS.includes(value as ProviderId);
}

export function parseProviderOrder(value: string): ProviderId[] {
  try {
    const parsed = JSON.parse(value) as unknown[];
    const valid = parsed.filter(isProviderId);
    const missing = PROVIDER_IDS.filter((provider) => !valid.includes(provider));
    return [...valid, ...missing];
  } catch {
    return [...PROVIDER_IDS];
  }
}
