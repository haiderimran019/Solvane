import { checkpointTextHash, parseSolvaneUpdateBlock, redactSecrets, type CheckpointPatch } from "./checkpoint.ts";
import type { ProviderId } from "./product.ts";

export type DetectedUpdate = { hash: string; block: string; patch: CheckpointPatch };

/** Parse only a complete, bounded update block. Streaming fragments return null. */
export function detectCompleteUpdate(text: string): DetectedUpdate | null {
  const start = text.lastIndexOf("<<<SOLVANE_UPDATE");
  const end = text.lastIndexOf("SOLVANE_UPDATE>>>");
  if (start < 0 || end < start) return null;
  const block = text.slice(start, end + "SOLVANE_UPDATE>>>".length).trim();
  const parsed = parseSolvaneUpdateBlock(block);
  return parsed.ok ? { hash: checkpointTextHash(block), block, patch: parsed.patch } : null;
}

export function redactCapture(text: string) {
  return redactSecrets(text);
}

export const LIMIT_PATTERNS: Record<ProviderId, RegExp[]> = {
  claude: [/usage limit/i, /capacity constraints/i, /try again later/i],
  gemini: [/rate limit/i, /high demand/i, /try again later/i],
  openai: [/message limit/i, /limit reached/i, /try again later/i],
  perplexity: [/usage limit/i, /rate limit/i, /try again later/i],
};

export function detectLimitMessage(provider: ProviderId, text: string): boolean {
  return LIMIT_PATTERNS[provider].some((pattern) => pattern.test(text));
}

export function shouldReadForAutoDetect(autoDetect: boolean): boolean {
  return autoDetect === true;
}

export function failoverPlan(order: ProviderId[], failed: ProviderId, connected: Set<ProviderId>): ProviderId[] {
  const start = Math.max(0, order.indexOf(failed) + 1);
  return order.slice(start).filter((provider) => connected.has(provider));
}

export function safePageDiagnostic(provider: ProviderId, selectorVersion: string, url: string, at = new Date()): string {
  let host = "unknown";
  try { host = new URL(url).hostname; } catch { /* diagnostic remains safe */ }
  return `Solvane page diagnostic\nprovider=${provider}\nselector_version=${selectorVersion}\nhost=${host}\ntime=${at.toISOString()}\ncontent_excluded=true`;
}

export function shouldRemind(input: { startedAt: number; now: number; messageCount: number; lastSavedAt?: number; lastSavedMessageCount?: number; remindedAt?: number; snoozedUntil?: number }): boolean {
  if (input.snoozedUntil && input.snoozedUntil > input.now) return false;
  if (input.remindedAt && input.remindedAt >= input.startedAt) return false;
  return input.now - input.startedAt >= 30 * 60_000 || (input.messageCount - (input.lastSavedMessageCount ?? 0) >= 15);
}

export type RetryCapture = { id: string; folderId: string; text: string; hash: string; target?: ProviderId; attempts: number; nextAttemptAt: number };

export function enqueueCapture(queue: RetryCapture[], capture: Omit<RetryCapture, "attempts" | "nextAttemptAt">, now = Date.now()): RetryCapture[] {
  if (queue.some((item) => item.hash === capture.hash)) return queue;
  return [...queue, { ...capture, attempts: 0, nextAttemptAt: now }];
}

export function retryDelay(attempts: number): number {
  return Math.min(15 * 60_000, 2 ** Math.min(8, Math.max(0, attempts)) * 1_000);
}

export function markRetry(queue: RetryCapture[], id: string, now = Date.now()): RetryCapture[] {
  return queue.map((item) => item.id === id ? { ...item, attempts: item.attempts + 1, nextAttemptAt: now + retryDelay(item.attempts) } : item);
}
