import { Sparkles } from "lucide-react";
import { PROVIDER_IDS, PROVIDERS, type Citation, type ProviderId, type RelaySnapshot } from "../../lib/product";
import { type CheckpointDiffItem as CheckpointDiff } from "../../lib/checkpoint";

export type FolderSummary = {
  id: string;
  name: string;
  description: string;
  providerOrder: ProviderId[];
  autoFallback: boolean;
  updatedAt: string;
};

export type ProviderStatus = {
  id: ProviderId;
  name: string;
  connected: boolean;
  source: "user" | "platform" | null;
  model: string;
  credentialStorageReady: boolean;
};

export type RelayMessage = {
  id: string;
  turnId: string;
  role: "user" | "assistant";
  provider: ProviderId | null;
  content: string;
  citations: Citation[];
  createdAt: string;
};

export type FolderDetail = {
  folder: FolderSummary;
  messages: RelayMessage[];
  snapshot: { version: number; state: RelaySnapshot; createdAt: string | null; schemaVersion?: number; pinnedFields?: string[] };
};

export type SnapshotVersion = FolderDetail["snapshot"] & { sourceMessageCount?: number };

export type HandoffRecord = {
  id: string;
  target: ProviderId;
  mode: "browser" | "api" | "code";
  snapshotVersion: number;
  createdAt: string;
};

export type FailoverRecord = { id: string; from: ProviderId; to: ProviderId; reason: string; snapshotVersion: number; createdAt: string };

export type WorkspaceView = "capsule" | "memory" | "checkpoint" | "activity" | "settings";

export type CheckpointPreview = {
  checkpointHash: string;
  baseVersion: number;
  source: "update_block" | "gemini";
  redactedCount: number;
  patch: import("../../lib/checkpoint").CheckpointPatch;
  diff: CheckpointDiff[];
  current: RelaySnapshot;
  tokenEstimate: number;
  pinnedFields: string[];
};

export type ConsentState = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  version: "1.0";
};

export type AutomationSettings = { autoDetect: boolean; reminders: boolean; defaultHandoff: "last" | ProviderId; enabledSites: ProviderId[]; tokenBudget: number; alwaysShowWhatWillBeSent: boolean };

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = { autoDetect: false, reminders: true, defaultHandoff: "last", enabledSites: [...PROVIDER_IDS], tokenBudget: 1500, alwaysShowWhatWillBeSent: true };

export type AccountSummary = {
  profile: { name: string; email: string; signInProvider: string };
  counts: {
    projects: number;
    messages: number;
    capsuleVersions: number;
    handoffs: number;
    apiConnections: number;
    analyticsEvents: number;
  };
};

export type Onboarding = { instruction: boolean; installed: boolean; linked: boolean; saved: boolean; continued: boolean; dismissed: boolean };

export const DEFAULT_ONBOARDING: Onboarding = { instruction: false, installed: false, linked: false, saved: false, continued: false, dismissed: false };

export const CONSENT_STORAGE_KEY = "solvane-consent-v1";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { error?: string; rawPatch?:string };
  if (!response.ok) throw Object.assign(new Error(data.error || "Request failed."),{rawPatch:data.rawPatch});
  return data;
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

export function ProviderMark({ provider, small = false }: { provider: ProviderId; small?: boolean }) {
  const resolvedProvider = provider;
  const item = PROVIDERS[resolvedProvider];
  return (
    <span
      className={small ? "provider-mark provider-mark-small" : "provider-mark"}
      style={{ "--provider-color": item.color } as React.CSSProperties}
      title={`${item.name} logo`}
      aria-hidden="true"
    >
      {resolvedProvider === "gemini" && <svg viewBox="0 0 32 32"><defs><linearGradient id="gemini-gradient" x1="4" y1="28" x2="28" y2="4"><stop stopColor="#4e8cff"/><stop offset=".48" stopColor="#a875ff"/><stop offset="1" stopColor="#ff78b5"/></linearGradient></defs><path fill="url(#gemini-gradient)" d="M16 2c1.2 7.4 6.6 12.8 14 14-7.4 1.2-12.8 6.6-14 14C14.8 22.6 9.4 17.2 2 16 9.4 14.8 14.8 9.4 16 2Z"/></svg>}
      {resolvedProvider === "claude" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8 6.8 25.2"/><path d="m10.7 3.7 10.6 24.6M28.3 10.7 3.7 21.3M21.3 3.7 10.7 28.3M28.3 21.3 3.7 10.7"/></g></svg>}
      {resolvedProvider === "openai" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M15.9 4.2a6 6 0 0 1 10.2 4.3v4.7a6 6 0 0 1-3 10.4l-4.1 2.3a6 6 0 0 1-9-5.2V16"/><path d="M7.8 9a6 6 0 0 1 9-5.2l4 2.3a6 6 0 0 1 0 10.4l-4 2.3"/><path d="M26 19a6 6 0 0 1-9 5.2l-4-2.3a6 6 0 0 1 0-10.4l4-2.3"/><path d="M6 13a6 6 0 0 0 3 10.4l4 2.3a6 6 0 0 0 9-5.2V16"/></g></svg>}
      {resolvedProvider === "perplexity" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 8h16v16H8zM16 3v26M5 12l11-9 11 9M5 20l11 9 11-9M8 8l8 8 8-8M8 24l8-8 8 8"/></g></svg>}
    </span>
  );
}

export function formatRelative(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function suggestProvider(text: string, order: ProviderId[], lastUsed?: ProviderId | null) {
  const lower = text.toLocaleLowerCase();
  if (/\b(pdf|paper|long document|large file)\b/.test(lower)) return order.includes("gemini") ? "gemini" : order[0];
  if (/\b(search|research|sources|citations|latest)\b/.test(lower)) return order.includes("perplexity") ? "perplexity" : order[0];
  if (/\b(code|coding|bug|repository|repo|typescript|python|claude code|codex)\b/.test(lower)) return order.includes("claude") ? "claude" : order[0];
  return (lastUsed && order.includes(lastUsed) ? lastUsed : order[0]) ?? "claude";
}

export function Brand() { return <div className="brand-lockup"><span className="brand-mark"><Sparkles size={17} /></span><span><strong>Solvane</strong><small>Continuity OS</small></span></div>; }

export function NavButton({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) { return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>{icon}<span>{label}</span>{typeof count === "number" && count > 0 ? <b>{count}</b> : null}</button>; }

export function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p></div>; }
