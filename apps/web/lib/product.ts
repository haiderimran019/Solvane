export const PROVIDER_IDS = [
  "claude",
  "gemini",
  "openai",
  "perplexity",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDERS: Record<
  ProviderId,
  {
    name: string;
    shortName: string;
    role: string;
    defaultModel: string;
    color: string;
    webUrl: string;
  }
> = {
  claude: {
    name: "Claude",
    shortName: "CL",
    role: "Thoughtful builder",
    defaultModel: "claude-opus-5-5",
    color: "#f59e7a",
    webUrl: "https://claude.ai/new",
  },
  gemini: {
    name: "Gemini",
    shortName: "GE",
    role: "Long-context analyst",
    defaultModel: "gemini-3.8-flash",
    color: "#7cb4ff",
    webUrl: "https://gemini.google.com/app",
  },
  openai: {
    name: "ChatGPT",
    shortName: "GP",
    role: "Fast creative partner",
    defaultModel: "gpt-6-luna",
    color: "#70d6b3",
    webUrl: "https://chatgpt.com/",
  },
  perplexity: {
    name: "Perplexity",
    shortName: "PX",
    role: "Cited research",
    defaultModel: "sonar",
    color: "#b892ff",
    webUrl: "https://www.perplexity.ai/",
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
  doNotRepeat: string[];
  artifacts: string[];
  sources: string[];
};

export const EMPTY_SNAPSHOT: RelaySnapshot = {
  objective: "Start the first conversation in this folder.",
  currentTask: "No active task yet.",
  constraints: [],
  decisions: [],
  completed: [],
  openQuestions: [],
  nextAction: "Send a message to establish the project state.",
  doNotRepeat: [],
  artifacts: [],
  sources: [],
};

export function normalizeSnapshot(value: Partial<RelaySnapshot> | null | undefined): RelaySnapshot {
  return {
    objective: value?.objective || EMPTY_SNAPSHOT.objective,
    currentTask: value?.currentTask || EMPTY_SNAPSHOT.currentTask,
    constraints: Array.isArray(value?.constraints) ? value.constraints : [],
    decisions: Array.isArray(value?.decisions) ? value.decisions : [],
    completed: Array.isArray(value?.completed) ? value.completed : [],
    openQuestions: Array.isArray(value?.openQuestions) ? value.openQuestions : [],
    nextAction: value?.nextAction || EMPTY_SNAPSHOT.nextAction,
    doNotRepeat: Array.isArray(value?.doNotRepeat) ? value.doNotRepeat : [],
    artifacts: Array.isArray(value?.artifacts) ? value.artifacts : [],
    sources: Array.isArray(value?.sources) ? value.sources : [],
  };
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDER_IDS.includes(value as ProviderId);
}

/**
 * Where "Continue" goes: the chosen default handoff, else the provider continued in last, else ChatGPT (the v1
 * Claude → ChatGPT route), then the rest of the order. Never the provider the person works in (first in order).
 */
export function continueTarget(order: ProviderId[], defaultHandoff: "last" | ProviderId, lastProvider?: ProviderId | null): ProviderId {
  const source = order[0];
  const candidates: Array<ProviderId | null | undefined> = [defaultHandoff === "last" ? null : defaultHandoff, lastProvider, "openai", ...order];
  return candidates.find((provider): provider is ProviderId => Boolean(provider) && provider !== source) ?? "openai";
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
