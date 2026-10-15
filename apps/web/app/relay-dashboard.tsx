"use client";

import {
  Activity,
  AppWindow,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Clipboard,
  ChevronDown,
  Clock3,
  Cloud,
  Code2,
  Cookie,
  Copy,
  Database,
  Download,
  Folder,
  FolderPlus,
  FileDiff,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_SNAPSHOT,
  PROVIDER_IDS,
  PROVIDERS,
  isProviderId,
  normalizeSnapshot,
  type Citation,
  type ProviderId,
  type RelaySnapshot,
} from "../lib/product";
import { DEFAULT_CAPSULE_PRIVACY, PROJECT_INSTRUCTION, buildCapsulePrompt, checkpointFieldLabel, isPinned, itemPinKey, redactSecrets, type CapsulePrivacy, type CheckpointDiffItem as CheckpointDiff } from "../lib/checkpoint";
import ProjectIntake from "./project-intake";

type FolderSummary = {
  id: string;
  name: string;
  description: string;
  providerOrder: ProviderId[];
  autoFallback: boolean;
  updatedAt: string;
};

type ProviderStatus = {
  id: ProviderId;
  name: string;
  connected: boolean;
  source: "user" | "platform" | null;
  model: string;
  credentialStorageReady: boolean;
};

type RelayMessage = {
  id: string;
  turnId: string;
  role: "user" | "assistant";
  provider: ProviderId | null;
  content: string;
  citations: Citation[];
  createdAt: string;
};

type FolderDetail = {
  folder: FolderSummary;
  messages: RelayMessage[];
  snapshot: { version: number; state: RelaySnapshot; createdAt: string | null; schemaVersion?: number; pinnedFields?: string[] };
};

type SnapshotVersion = FolderDetail["snapshot"] & { sourceMessageCount?: number };
type HandoffRecord = {
  id: string;
  target: ProviderId;
  mode: "browser" | "api" | "code";
  snapshotVersion: number;
  createdAt: string;
};
type FailoverRecord = { id: string; from: ProviderId; to: ProviderId; reason: string; snapshotVersion: number; createdAt: string };
type WorkspaceView = "capsule" | "memory" | "checkpoint" | "activity" | "settings";

type CheckpointPreview = {
  checkpointHash: string;
  baseVersion: number;
  source: "update_block" | "gemini";
  redactedCount: number;
  patch: import("../lib/checkpoint").CheckpointPatch;
  diff: CheckpointDiff[];
  current: RelaySnapshot;
  tokenEstimate: number;
  pinnedFields: string[];
};

type ConsentState = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  version: "1.0";
};

type AutomationSettings = { autoDetect: boolean; reminders: boolean; defaultHandoff: "last" | ProviderId; enabledSites: ProviderId[]; tokenBudget: number; alwaysShowWhatWillBeSent: boolean };
const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = { autoDetect: false, reminders: true, defaultHandoff: "last", enabledSites: [...PROVIDER_IDS], tokenBudget: 1500, alwaysShowWhatWillBeSent: true };

type AccountSummary = {
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

type Onboarding = { instruction: boolean; installed: boolean; linked: boolean; saved: boolean; continued: boolean; dismissed: boolean };
const DEFAULT_ONBOARDING: Onboarding = { instruction: false, installed: false, linked: false, saved: false, continued: false, dismissed: false };

const CONSENT_STORAGE_KEY = "solvane-consent-v1";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { error?: string; rawPatch?:string };
  if (!response.ok) throw Object.assign(new Error(data.error || "Request failed."),{rawPatch:data.rawPatch});
  return data;
}

async function copyText(value: string) {
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

function ProviderMark({ provider, small = false }: { provider: ProviderId; small?: boolean }) {
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

function formatRelative(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function suggestProvider(text: string, order: ProviderId[], lastUsed?: ProviderId | null) {
  const lower = text.toLocaleLowerCase();
  if (/\b(pdf|paper|long document|large file)\b/.test(lower)) return order.includes("gemini") ? "gemini" : order[0];
  if (/\b(search|research|sources|citations|latest)\b/.test(lower)) return order.includes("perplexity") ? "perplexity" : order[0];
  if (/\b(code|coding|bug|repository|repo|typescript|python|claude code|codex)\b/.test(lower)) return order.includes("claude") ? "claude" : order[0];
  return (lastUsed && order.includes(lastUsed) ? lastUsed : order[0]) ?? "claude";
}

export function RelayDashboard({ user }: { user: { name: string; email: string } }) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [versions, setVersions] = useState<SnapshotVersion[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [failovers, setFailovers] = useState<FailoverRecord[]>([]);
  const [view, setView] = useState<WorkspaceView>("capsule");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RelaySnapshot>(EMPTY_SNAPSHOT);
  // What the editor started from, so saving pins only the person's own changes (not a Rescue draft).
  const [draftOrigin, setDraftOrigin] = useState<RelaySnapshot>(EMPTY_SNAPSHOT);
  const [captureText, setCaptureText] = useState("");
  const [checkpointText, setCheckpointText] = useState("");
  const [checkpointPreview, setCheckpointPreview] = useState<CheckpointPreview | null>(null);
  const [checkpointAccepts, setCheckpointAccepts] = useState<Set<string>>(new Set());
  const [checkpointRejects, setCheckpointRejects] = useState<Set<string>>(new Set());
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [checkpointSavedVersion, setCheckpointSavedVersion] = useState<number | null>(null);
  const [checkpointUndo, setCheckpointUndo] = useState<{ folderId: string; version: number } | null>(null);
  const [versionPreview, setVersionPreview] = useState<SnapshotVersion | null>(null);
  const [lastProvider, setLastProvider] = useState<ProviderId | null>(null);
  const [apiComposer, setApiComposer] = useState("");
  const [privacy, setPrivacy] = useState<CapsulePrivacy>(DEFAULT_CAPSULE_PRIVACY);
  const [showConnections, setShowConnections] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQuickSwitch, setShowQuickSwitch] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [launchProvider, setLaunchProvider] = useState<ProviderId | null>(null);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [checkpointRawPatch,setCheckpointRawPatch]=useState("");
  const [checkpointEdits, setCheckpointEdits] = useState<Record<string,string>>({});
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
  const [onboarding, setOnboarding] = useState<Onboarding>(DEFAULT_ONBOARDING);
  const [newFolderName, setNewFolderName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ folders: FolderSummary[]; providers: ProviderStatus[] }>("/api/bootstrap");
      setFolders(data.folders);
      setProviders(data.providers);
      setActiveFolderId((current) => current ?? data.folders[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolder = useCallback(async (folderId: string) => {
    try {
      const [folderData, versionData, handoffData] = await Promise.all([
        api<FolderDetail>(`/api/folders/${folderId}`),
        api<{ snapshots: SnapshotVersion[] }>(`/api/snapshots?folderId=${encodeURIComponent(folderId)}`),
        api<{ handoffs: HandoffRecord[]; failovers?: FailoverRecord[] }>(`/api/handoffs?folderId=${encodeURIComponent(folderId)}`),
      ]);
      const normalized = normalizeSnapshot(folderData.snapshot.state);
      setDetail({ ...folderData, snapshot: { ...folderData.snapshot, state: normalized } });
      setDraft(normalized);
      setVersions(versionData.snapshots);
      setHandoffs(handoffData.handoffs);
      setFailovers(handoffData.failovers || []);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this project.");
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void bootstrap()); }, [bootstrap]);
  useEffect(() => { if (activeFolderId) queueMicrotask(() => void loadFolder(activeFolderId)); }, [activeFolderId, loadFolder]);
  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem("solvane-privacy");
      if (stored) {
        try { setPrivacy({ ...DEFAULT_CAPSULE_PRIVACY, ...(JSON.parse(stored) as CapsulePrivacy) }); }
        catch { window.localStorage.removeItem("solvane-privacy"); }
      }
      const storedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (storedConsent) {
        try {
          const parsed = JSON.parse(storedConsent) as ConsentState;
          if (parsed.essential === true && typeof parsed.analytics === "boolean") setConsent(parsed);
          else window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        } catch { window.localStorage.removeItem(CONSENT_STORAGE_KEY); }
      }
      const storedProvider = window.localStorage.getItem("solvane-last-provider");
      if (storedProvider && isProviderId(storedProvider)) setLastProvider(storedProvider);
      const storedAutomation = window.localStorage.getItem("solvane-automation-settings");
      if (storedAutomation) { try { setAutomationSettings({ ...DEFAULT_AUTOMATION_SETTINGS, ...(JSON.parse(storedAutomation) as Partial<AutomationSettings>) }); } catch { window.localStorage.removeItem("solvane-automation-settings"); } }
      const storedOnboarding = window.localStorage.getItem("solvane-onboarding");
      if (storedOnboarding) { try { setOnboarding({ ...DEFAULT_ONBOARDING, ...(JSON.parse(storedOnboarding) as Partial<Onboarding>) }); } catch { window.localStorage.removeItem("solvane-onboarding"); } }
    });
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setShowQuickSwitch(true);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const announce = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== "solvane-extension-ready") return;
      setOnboarding((current) => { const value = {...current,installed:true,linked:Boolean(detail),saved:current.saved||Boolean(detail?.snapshot.version),continued:current.continued||handoffs.length>0}; window.localStorage.setItem("solvane-onboarding",JSON.stringify(value)); return value; });
      window.postMessage({type:"solvane-settings",settings:{...automationSettings,providerOrder:detail?.folder.providerOrder,privacy}},window.location.origin);
    };
    window.addEventListener("message",announce);
    // The extension builds the same capsule, so it receives the privacy choices along with the other settings.
    window.postMessage({type:"solvane-settings",settings:{...automationSettings,providerOrder:detail?.folder.providerOrder,privacy}},window.location.origin);
    return () => window.removeEventListener("message",announce);
  },[automationSettings,detail,handoffs.length,privacy]);

  const activeState = editing ? draft : detail?.snapshot.state ?? EMPTY_SNAPSHOT;
  const relayPrompt = detail ? buildCapsulePrompt({ projectName: detail.folder.name, state: activeState, privacy }) : "";
  const versionPrompt = detail && versionPreview ? buildCapsulePrompt({ projectName: detail.folder.name, state: versionPreview.state, privacy }) : "";
  const setupSteps = { instruction: onboarding.instruction, installed: onboarding.installed, saved: onboarding.saved || Boolean(detail?.snapshot.version) };
  const showSetup = !onboarding.dismissed && !(setupSteps.instruction && setupSteps.installed && setupSteps.saved);
  const tokenEstimate = Math.max(1, Math.ceil(relayPrompt.length / 4));
  const contextHealth = useMemo(() => {
    let score = 10;
    if (activeState.objective !== EMPTY_SNAPSHOT.objective) score += 20;
    if (activeState.currentTask !== EMPTY_SNAPSHOT.currentTask) score += 20;
    if (activeState.nextAction !== EMPTY_SNAPSHOT.nextAction) score += 20;
    score += Math.min(12, activeState.decisions.length * 4);
    score += Math.min(8, activeState.constraints.length * 4);
    score += Math.min(10, activeState.completed.length * 3);
    return Math.min(100, score);
  }, [activeState]);
  const initials = useMemo(() => user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), [user.name]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => { setNotice(null); setCheckpointUndo(null); }, 10000);
  }

  async function previewCheckpoint() {
    if (!detail || checkpointBusy) return;
    const redaction = redactSecrets(checkpointText.trim());
    const text = redaction.text;
    if (redaction.count) { setCheckpointText(text); flash(`${redaction.count} secret-like value(s) removed on this device before sending.`); }
    if (!text) { setError("Paste a recent chat or update block first."); return; }
    setCheckpointBusy(true); setError(null); setCheckpointPreview(null);
    try {
      const data = await api<CheckpointPreview>("/api/checkpoint", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, text, mode: "preview", tokenBudget: automationSettings.tokenBudget }) });
      setCheckpointPreview(data);
      setCheckpointRawPatch("");
      setCheckpointEdits({});
      setCheckpointAccepts(new Set(data.diff.filter((item) => item.autoApplicable).map((item) => item.key)));
      setCheckpointRejects(new Set());
      setCheckpointSavedVersion(null);
      track("checkpoint.previewed", { source: data.source, redactions: data.redactedCount, items: data.diff.length });
    } catch (cause) { setCheckpointRawPatch((cause as {rawPatch?:string}).rawPatch || ""); setError(cause instanceof Error ? cause.message : "Could not read this checkpoint."); }
    finally { setCheckpointBusy(false); }
  }

  async function commitCheckpoint() {
    if (!detail || !checkpointPreview || checkpointBusy) return;
    setCheckpointBusy(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"]; previousVersion: number | null; idempotent?: boolean; unchanged?: boolean }>("/api/checkpoint", {
        method: "POST",
        body: JSON.stringify({ folderId: detail.folder.id, text: checkpointText, mode: "commit", patch: checkpointPreview.patch, acceptedKeys: [...checkpointAccepts], checkpointHash: checkpointPreview.checkpointHash, baseVersion: checkpointPreview.baseVersion, tokenBudget: automationSettings.tokenBudget, editedItems: checkpointEdits }),
      });
      setCheckpointUndo(!data.idempotent && typeof data.previousVersion === "number" ? { folderId: detail.folder.id, version: data.previousVersion } : null);
      setCheckpointSavedVersion(data.snapshot.version);
      setCheckpointPreview(null);
      await loadFolder(detail.folder.id);
      flash(data.unchanged ? `Nothing new to save — still v${data.snapshot.version}.` : data.idempotent ? `Already saved (v${data.snapshot.version}).` : `Saved (v${data.snapshot.version}).`);
      track("checkpoint.saved", { version: data.snapshot.version, idempotent: Boolean(data.idempotent) });
      markOnboarding("saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this checkpoint."); }
    finally { setCheckpointBusy(false); }
  }

  async function undoCheckpoint() {
    if (!checkpointUndo || checkpointBusy) return;
    setCheckpointBusy(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: checkpointUndo.folderId, restoreVersion: checkpointUndo.version }) });
      setCheckpointUndo(null); setCheckpointSavedVersion(null);
      await loadFolder(checkpointUndo.folderId);
      flash(`Undo saved as v${data.snapshot.version}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not undo this checkpoint."); }
    finally { setCheckpointBusy(false); }
  }

  async function restoreVersion(snapshot: SnapshotVersion) {
    if (!detail || checkpointBusy) return;
    setCheckpointBusy(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, restoreVersion: snapshot.version }) });
      await loadFolder(detail.folder.id);
      setView("capsule");
      flash(`Restored v${snapshot.version} as new v${data.snapshot.version}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not restore this version."); }
    finally { setCheckpointBusy(false); }
  }

  async function copyProjectInstruction() {
    await copyText(PROJECT_INSTRUCTION);
    markOnboarding("instruction");
    flash("Project instruction copied. Paste it into your LLM project instructions once.");
  }

  function updateAutomationSettings(next: Partial<AutomationSettings>) {
    const value = { ...automationSettings, ...next };
    setAutomationSettings(value);
    window.localStorage.setItem("solvane-automation-settings", JSON.stringify(value));
    window.postMessage({type:"solvane-settings", settings:{...value, providerOrder:detail?.folder.providerOrder, privacy}}, window.location.origin);
    flash("Settings saved. The installed extension receives them on this device.");
  }

  function markOnboarding(step: keyof Onboarding) {
    setOnboarding((current) => {
      const value = { ...current, [step]: true };
      window.localStorage.setItem("solvane-onboarding", JSON.stringify(value));
      return value;
    });
  }

  async function deleteAllData() {
    if (!window.confirm("Delete every Solvane project, capsule, handoff, message, and API connection for this account? This cannot be undone.")) return;
    try {
      await api("/api/account/delete-all", { method: "DELETE" });
      window.postMessage({type:"solvane-revoke"},window.location.origin);
      window.localStorage.removeItem("solvane-onboarding");
      setFolders([]); setDetail(null); setVersions([]); setHandoffs([]); setFailovers([]);
      flash("All account data deleted. Reload to start a fresh demo project.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete account data."); }
  }

  function track(eventName: string, metadata: Record<string, string | number | boolean> = {}) {
    if (!consent?.analytics) return;
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, path: window.location.pathname, metadata }),
      keepalive: true,
    });
  }

  function saveConsent(analytics: boolean) {
    const next: ConsentState = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
      version: "1.0",
    };
    setConsent(next);
    setShowCookieSettings(false);
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    if (analytics) {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventName: "consent.updated", path: window.location.pathname, metadata: { analytics: true } }),
        keepalive: true,
      });
    }
    flash(analytics ? "Privacy-safe product analytics enabled." : "Essential storage only. Analytics remains off.");
  }

  function openProfile() {
    setShowProfile(true);
    track("profile.opened", { surface: "account" });
  }

  async function createFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const data = await api<{ folder: FolderSummary }>("/api/folders", { method: "POST", body: JSON.stringify({ name, description: "A Continuity Capsule workspace." }) });
      setFolders((items) => [data.folder, ...items]);
      setActiveFolderId(data.folder.id);
      setNewFolderName("");
      setShowNewFolder(false);
      setShowMobileNav(false);
      setView("capsule");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create project."); }
  }

  async function persistFolderSettings(next: Partial<FolderSummary>) {
    if (!detail) return;
    const updated = { ...detail.folder, ...next };
    setDetail({ ...detail, folder: updated });
    setFolders((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    try {
      await api(`/api/folders/${updated.id}`, { method: "PATCH", body: JSON.stringify({ providerOrder: updated.providerOrder, autoFallback: updated.autoFallback }) });
      flash("Provider route saved across devices.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save provider route.");
      await loadFolder(updated.id);
    }
  }

  function moveProvider(index: number, direction: -1 | 1) {
    if (!detail) return;
    const target = index + direction;
    if (target < 0 || target >= detail.folder.providerOrder.length) return;
    const next = [...detail.folder.providerOrder];
    [next[index], next[target]] = [next[target], next[index]];
    void persistFolderSettings({ providerOrder: next });
  }

  async function saveCapsule() {
    if (!detail || saving) return;
    setSaving(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, state: draft, reason: "edit", editedFrom: draftOrigin }) });
      const normalized = normalizeSnapshot(data.snapshot.state);
      setDetail({ ...detail, snapshot: { ...data.snapshot, state: normalized } });
      setCheckpointUndo({ folderId: detail.folder.id, version: detail.snapshot.version });
      setDraft(normalized); setEditing(false);
      await loadFolder(detail.folder.id);
      flash(`Saved (v${data.snapshot.version}).`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the capsule."); }
    finally { setSaving(false); }
  }

  async function togglePin(key: string) {
    if (!detail || saving || !detail.snapshot.version) return;
    const pins = detail.snapshot.pinnedFields ?? [];
    const next = pins.includes(key) ? pins.filter((pin) => pin !== key) : [...pins, key];
    setSaving(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, version: detail.snapshot.version, pins: next }) });
      setDetail({ ...detail, snapshot: { ...detail.snapshot, pinnedFields: data.snapshot.pinnedFields ?? [] } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the pin."); }
    finally { setSaving(false); }
  }

  async function rescueSession() {
    if (!detail || saving) return;
    setSaving(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id }) });
      const normalized = normalizeSnapshot(data.snapshot.state);
      setDraft(normalized);
      setDraftOrigin(normalized);
      setEditing(true);
      flash("Rescue prepared a draft. Review and save it before continuing.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not rescue this session."); }
    finally { setSaving(false); }
  }

  function prepareHandoff(provider: ProviderId) {
    if (!detail) return;
    setShowQuickSwitch(false);
    setShowPreview(false);
    setLaunchProvider(provider);
  }

  function launchInProvider(provider: ProviderId) {
    if (!detail) return;
    window.localStorage.setItem("solvane-last-provider", provider);
    setLastProvider(provider);
    void copyText(relayPrompt);
    window.postMessage({type:"solvane-handoff",pending:{target:provider,capsule:relayPrompt,createdAt:Date.now(),source:"Solvane dashboard"}},window.location.origin);
    void api<{ handoff: HandoffRecord }>("/api/handoffs", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, target: provider, mode: "browser", snapshotVersion: detail.snapshot.version }) })
      .then((data) => setHandoffs((items) => [data.handoff, ...items]))
      .catch(() => { /* The normal provider link still works if audit logging is unavailable. */ });
    setLaunchProvider(null);
    track("handoff.started", { provider, mode: "browser" });
    markOnboarding("continued");
    flash(`Capsule copied. Paste it into ${PROVIDERS[provider].name} and continue.`);
  }

  async function copyRelayPrompt() { await copyText(relayPrompt); flash("Relay prompt copied to clipboard."); }
  function exportCodeHandoff() {
    if (!detail) return;
    const blob = new Blob([`# Solvane handoff — ${detail.folder.name}\n\n${relayPrompt}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "handoff.md"; anchor.click(); URL.revokeObjectURL(url);
    track("code_handoff.exported", { mode: "code" });
    flash("handoff.md exported for Codex or Claude Code.");
  }
  function captureIntoDraft() {
    const value = captureText.trim();
    if (!value) return;
    if (!editing && detail) setDraftOrigin(normalizeSnapshot(detail.snapshot.state));
    setDraft((current) => ({ ...current, currentTask: value }));
    setCaptureText(""); setEditing(true);
    flash("Captured into the capsule draft. Review and save it.");
  }
  function updatePrivacy(key: keyof CapsulePrivacy, value: boolean) {
    const next = { ...privacy, [key]: value };
    setPrivacy(next); window.localStorage.setItem("solvane-privacy", JSON.stringify(next));
  }

  async function sendApiMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !apiComposer.trim() || sending) return;
    const content = apiComposer.trim(); const turnId = crypto.randomUUID();
    const latestApi = detail.messages.filter((message)=>message.role==="assistant").at(-1);
    if(latestApi && (!detail.snapshot.createdAt || latestApi.createdAt>detail.snapshot.createdAt) && !window.confirm("The saved capsule is older than your latest API work. Continue this turn with the visible saved capsule? You can cancel and Save checkpoint first.")) return;
    setSending(true); setError(null);
    try {
      const data = await api<{ message: RelayMessage; provider: ProviderId }>("/api/chat", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, content, turnId, approvedSnapshotVersion: detail.snapshot.version }) });
      setApiComposer("");
      setDetail({ ...detail, messages: [...detail.messages, { id: crypto.randomUUID(), turnId, role: "user", provider: null, content, citations: [], createdAt: new Date().toISOString() }, data.message] });
      await loadFolder(detail.folder.id);
      flash(`API relay completed with ${PROVIDERS[data.provider].name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The API relay could not complete."); }
    finally { setSending(false); }
  }

  return (
    <main className="solvane-shell">
      <header className="app-header app-header-v2">
        <button className="mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <Brand />
        <div className="header-context"><span>{detail?.folder.name || "Opening project"}</span><i /><b>Up to date</b></div>
        <div className="header-actions"><button className="shortcut-button" onClick={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }}><Sparkles size={15} /><span>Save progress</span></button><button className="avatar" title={user.email} aria-label="Open profile and data center" onClick={openProfile}>{initials}</button></div>
      </header>

      <div className="app-frame">
        <aside className={showMobileNav ? "project-rail mobile-open" : "project-rail"}>
          <div className="mobile-rail-head"><Brand /><button onClick={() => setShowMobileNav(false)} aria-label="Close navigation"><X size={19} /></button></div>
          <nav className="primary-nav" aria-label="Workspace views">
            <NavButton active={view === "capsule"} icon={<LayoutDashboard size={17} />} label="Home" onClick={() => { setView("capsule"); setShowMobileNav(false); }} />
            <NavButton active={view === "memory"} icon={<Database size={17} />} label="Project memory" onClick={() => { setView("memory"); setShowMobileNav(false); }} />
            <NavButton active={view === "checkpoint"} icon={<Sparkles size={17} />} label="Save progress" onClick={() => { setView("checkpoint"); setShowMobileNav(false); }} />
            <NavButton active={view === "activity"} icon={<History size={17} />} label="Activity" count={handoffs.length} onClick={() => { setView("activity"); setShowMobileNav(false); }} />
            <NavButton active={view === "settings"} icon={<Settings2 size={17} />} label="Advanced" onClick={() => { setView("settings"); setShowMobileNav(false); }} />
          </nav>
          <div className="rail-section-head"><span>Projects</span><button onClick={() => setShowNewFolder(true)} aria-label="New project"><Plus size={16} /></button></div>
          {showNewFolder && <form className="new-project-form" onSubmit={createFolder}><input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Project name" maxLength={80} /><button type="submit" aria-label="Create project"><Check size={15} /></button><button type="button" onClick={() => setShowNewFolder(false)} aria-label="Cancel"><X size={15} /></button></form>}
          <nav className="project-list" aria-label="Projects">{folders.map((folder) => <button key={folder.id} className={folder.id === activeFolderId ? "project-item active" : "project-item"} onClick={() => { setActiveFolderId(folder.id); setView("capsule"); setShowMobileNav(false); }}><span className="project-icon"><Folder size={15} /></span><span><strong>{folder.name}</strong><small>{formatRelative(folder.updatedAt)}</small></span><ChevronRight size={14} /></button>)}</nav>
          <button className="new-project-card" onClick={() => setShowNewFolder(true)}><FolderPlus size={17} /><span><strong>New project</strong><small>Start with a clean capsule</small></span></button>
          <div className="rail-footer"><div className="device-status"><Cloud size={15} /><span><strong>Project memory synced</strong><small>Ready on your devices</small></span><i /></div><button className="account-row" onClick={openProfile}><span className="mini-avatar">{initials}</span><span><strong>{user.name}</strong><small>Profile & privacy</small></span><ChevronRight size={14} /></button></div>
        </aside>

        <section className="workspace-main workspace-main-v2">
          {loading || !detail ? <div className="workspace-loader"><LoaderCircle className="spin" size={28} /><span>Assembling your workspace…</span></div> : <>
            {view !== "capsule" && <div className="workspace-titlebar workspace-titlebar-v2"><div><button className="back-home" onClick={() => setView("capsule")}><ArrowRight size={14} /> Back home</button><p className="eyebrow"><Activity size={12} /> {detail.folder.name}</p><h1>{view === "memory" ? "Project memory" : view === "checkpoint" ? "Save progress" : view === "activity" ? "Project history" : "Advanced controls"}</h1></div>{view === "settings" && <span className="advanced-pill">API mode stays available</span>}</div>}
            {view === "capsule" && <ContinuityHome project={detail.folder} state={activeState} version={detail.snapshot.version} createdAt={detail.snapshot.createdAt} tokenEstimate={tokenEstimate} contextHealth={contextHealth} handoffs={handoffs} setup={showSetup ? <SetupCard steps={setupSteps} onCopyInstruction={() => void copyProjectInstruction()} onSave={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onDismiss={() => markOnboarding("dismissed")} /> : null} onSave={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onContinue={() => prepareHandoff("openai")} onPreview={() => setShowPreview(true)} onOpenMemory={() => setView("memory")} />}
            {view === "memory" && <CapsuleWorkspace state={activeState} draft={draft} editing={editing} version={detail.snapshot.version} pins={detail.snapshot.pinnedFields ?? []} onTogglePin={detail.snapshot.version ? (key) => void togglePin(key) : undefined} createdAt={detail.snapshot.createdAt} tokenEstimate={tokenEstimate} contextHealth={contextHealth} saving={saving} captureText={captureText} onDraftChange={setDraft} onCaptureText={setCaptureText} onCapture={captureIntoDraft} onCheckpoint={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onEdit={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setDraftOrigin(normalizeSnapshot(detail.snapshot.state)); setEditing(true); }} onCancel={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setEditing(false); }} onSave={() => void saveCapsule()} onRescue={() => void rescueSession()} onPreview={() => setShowPreview(true)} />}
            {view === "checkpoint" && <CheckpointWorkspace rawPatch={checkpointRawPatch} onRawPatch={setCheckpointRawPatch} text={checkpointText} preview={checkpointPreview} accepts={checkpointAccepts} rejects={checkpointRejects} busy={checkpointBusy} savedVersion={checkpointSavedVersion} suggestedProvider={suggestProvider(checkpointText || activeState.currentTask, detail.folder.providerOrder, automationSettings.defaultHandoff === "last" ? lastProvider : automationSettings.defaultHandoff)} onIntake={(text) => setCheckpointText((prior) => [prior,text].filter(Boolean).join("\n\n"))} edits={checkpointEdits} onEdit={(item) => { const value = window.prompt("Edit this fact. Your accepted edit will be pinned.", checkpointEdits[item.key] || item.to || item.text); if(value?.trim()) { setCheckpointEdits((prev)=>({...prev,[item.key]:value.trim()})); setCheckpointAccepts((prev)=>new Set([...prev,item.key])); setCheckpointRejects((prev)=>{const next=new Set(prev);next.delete(item.key);return next;}); } }} onText={setCheckpointText} onPreview={() => void previewCheckpoint()} onCommit={() => void commitCheckpoint()} onDecision={(key, decision) => { setCheckpointAccepts((current) => { const next = new Set(current); if (decision === "accepted") next.add(key); else next.delete(key); return next; }); setCheckpointRejects((current) => { const next = new Set(current); if (decision === "rejected") next.add(key); else next.delete(key); return next; }); }} onAcceptAdditions={() => { const keys=checkpointPreview?.diff.filter((item) => item.kind === "added").map((item) => item.key) ?? []; setCheckpointAccepts((current) => new Set([...current, ...keys])); setCheckpointRejects((current)=>{const next=new Set(current);keys.forEach((key)=>next.delete(key));return next;}); }} onContinue={prepareHandoff} onCopyInstruction={() => void copyProjectInstruction()} />}
            {view === "activity" && <ActivityWorkspace handoffs={handoffs} failovers={failovers} versions={versions} onPreview={(snapshot) => setVersionPreview(snapshot)} onRestore={(snapshot) => void restoreVersion(snapshot)} />}
            {view === "settings" && <><ProviderRoute folder={detail.folder} providers={providers} onMove={moveProvider} /><SettingsWorkspace providers={providers} folder={detail.folder} messages={detail.messages} privacy={privacy} apiComposer={apiComposer} sending={sending} automation={automationSettings} onboarding={onboarding} onPrivacy={updatePrivacy} onConnections={() => setShowConnections(true)} onToggleFallback={(value) => void persistFolderSettings({ autoFallback: value })} onAutomation={updateAutomationSettings} onComposer={setApiComposer} onSend={sendApiMessage} onExport={exportCodeHandoff} onDeleteAll={deleteAllData} onCopyInstruction={() => void copyProjectInstruction()} /><AutomationSettingsPanel automation={automationSettings} onboarding={onboarding} onAutomation={updateAutomationSettings} onDeleteAll={deleteAllData} onCopyInstruction={() => void copyProjectInstruction()} /></>}
          </>}
        </section>
      </div>

      <nav className="mobile-bottom-nav mobile-bottom-nav-v2" aria-label="Mobile navigation"><button className={view === "capsule" ? "active" : ""} onClick={() => setView("capsule")}><LayoutDashboard size={18} /><span>Home</span></button><button className={view === "checkpoint" ? "active" : ""} onClick={() => setView("checkpoint")}><Sparkles size={18} /><span>Save</span></button><button className="continue-nav" onClick={() => detail ? prepareHandoff("openai") : setShowQuickSwitch(true)}><span className="handoff-fab"><ArrowRight size={20} /></span><span>Continue</span></button><button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><History size={18} /><span>History</span></button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings2 size={18} /><span>More</span></button></nav>
      {(error || notice) && <div className={error ? "toast error" : "toast success"}>{error ? <CircleAlert size={16} /> : <Check size={16} />}<span>{error || notice}</span>{!error && checkpointUndo && notice?.startsWith("Saved") && <button className="toast-undo" onClick={() => void undoCheckpoint()}><Undo2 size={13} /> Undo</button>}<button onClick={() => { setError(null); setNotice(null); }} aria-label="Dismiss"><X size={14} /></button></div>}
      {showPreview && detail && <PreviewDialog prompt={relayPrompt} tokenEstimate={tokenEstimate} onCopy={() => void copyRelayPrompt()} onContinue={prepareHandoff} onClose={() => setShowPreview(false)} />}
      {versionPreview && detail && <PreviewDialog prompt={versionPrompt} tokenEstimate={Math.ceil(versionPrompt.length / 4)} onCopy={() => void copyText(versionPrompt)} onContinue={prepareHandoff} onClose={() => setVersionPreview(null)} />}
      {showQuickSwitch && detail && <QuickSwitchDialog version={detail.snapshot.version} health={contextHealth} onContinue={prepareHandoff} onClose={() => setShowQuickSwitch(false)} />}
      {launchProvider && detail && <HandoffLaunchDialog provider={launchProvider} version={detail.snapshot.version} tokenEstimate={tokenEstimate} prompt={automationSettings.alwaysShowWhatWillBeSent ? relayPrompt : undefined} onLaunch={() => launchInProvider(launchProvider)} onClose={() => setLaunchProvider(null)} />}
      {showConnections && <ConnectionsPanel providers={providers} onClose={() => setShowConnections(false)} onChanged={bootstrap} />}
      {showProfile && <ProfilePanel user={user} consent={consent} onManageCookies={() => { setShowCookieSettings(true); setShowProfile(false); }} onClose={() => setShowProfile(false)} />}
      {(!consent || showCookieSettings) && <CookieConsent current={consent} onChoose={saveConsent} onClose={consent ? () => setShowCookieSettings(false) : undefined} />}
    </main>
  );
}

function Brand() { return <div className="brand-lockup"><span className="brand-mark"><Sparkles size={17} /></span><span><strong>Solvane</strong><small>Continuity OS</small></span></div>; }
function NavButton({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) { return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>{icon}<span>{label}</span>{typeof count === "number" && count > 0 ? <b>{count}</b> : null}</button>; }

function ProviderRoute({ folder, providers, onMove }: { folder: FolderSummary; providers: ProviderStatus[]; onMove: (index: number, direction: -1 | 1) => void }) {
  return <section className="provider-route" aria-label="Provider preference order"><div className="route-copy"><span>Preferred route</span><small>Priority for Browser Bridge and API fallback</small></div><div className="route-lane">{folder.providerOrder.map((provider, index) => { const apiConnected = providers.find((item) => item.id === provider)?.connected; return <div className="route-node" key={provider}><b>{index + 1}</b><ProviderMark provider={provider} small /><span><strong>{PROVIDERS[provider].name}</strong><small>{apiConnected ? "Browser + API" : "Browser ready"}</small></span><div><button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${PROVIDERS[provider].name} earlier`}><ArrowUp size={11} /></button><button onClick={() => onMove(index, 1)} disabled={index === folder.providerOrder.length - 1} aria-label={`Move ${PROVIDERS[provider].name} later`}><ArrowDown size={11} /></button></div></div>; })}</div></section>;
}

// Shown until all three steps are done or the person hides it. Step 1 comes first because Claude's update
// blocks only exist once its project instructions ask for them.
function SetupCard({ steps, onCopyInstruction, onSave, onDismiss }: { steps: { instruction: boolean; installed: boolean; saved: boolean }; onCopyInstruction: () => void; onSave: () => void; onDismiss: () => void }) {
  const rows = [
    { done: steps.instruction, title: "Add Solvane's instruction to your Claude project", copy: "Paste it once into the project's custom instructions. Claude then ends useful replies with an update block that saves without Gemini.", action: <button className="secondary-action" onClick={onCopyInstruction}><Clipboard size={14} /> Copy instruction</button> },
    { done: steps.installed, title: "Install the browser extension", copy: "Unzip it, then choose Load unpacked in chrome://extensions. It adds Save progress to Claude and ChatGPT.", action: <a className="secondary-action" href="/solvane-extension.zip" download><Download size={14} /> Download</a> },
    { done: steps.saved, title: "Save your first progress", copy: "In Claude, click Save progress or press Alt+S (Option+S on a Mac). You can also paste here.", action: <button className="secondary-action" onClick={onSave}><Sparkles size={14} /> Save progress</button> },
  ];
  return <section className="setup-card" aria-labelledby="setup-title"><div className="card-topline"><span className="soft-icon"><Zap size={17} /></span><span id="setup-title">Set up in 3 steps</span><button onClick={onDismiss}>Hide</button></div><ol>{rows.map((row, index) => <li key={row.title} className={row.done ? "done" : ""}><b aria-hidden="true">{row.done ? <Check size={13} /> : index + 1}</b><span><strong>{row.title}</strong><small>{row.copy}</small></span>{row.done ? <em>Done</em> : row.action}</li>)}</ol></section>;
}

function ContinuityHome({ project, state, version, createdAt, tokenEstimate, contextHealth, handoffs, setup, onSave, onContinue, onPreview, onOpenMemory }: { project: FolderSummary; state: RelaySnapshot; version: number; createdAt: string | null; tokenEstimate: number; contextHealth: number; handoffs: HandoffRecord[]; setup: React.ReactNode; onSave: () => void; onContinue: () => void; onPreview: () => void; onOpenMemory: () => void }) {
  const ready = contextHealth >= 75;
  return <div className="continuity-home">
    <section className="continuity-hero">
      <div className="hero-copy">
        <div className="live-status"><i /> {createdAt ? `Saved ${formatRelative(createdAt)}` : "Ready for your first save"}</div>
        <p className="eyebrow">Active project</p>
        <h1>{project.name}</h1>
        <p className="hero-description">Work in Claude. Solvane keeps the important state ready, so ChatGPT can continue without you explaining everything again.</p>
        <div className="hero-actions">
          <button className="continue-primary" onClick={onContinue}><span><ProviderMark provider="openai" small /><b>Continue in ChatGPT</b></span><ArrowRight size={18} /></button>
        </div>
        <p className="trust-line"><ShieldCheck size={14} /> You review what moves. Solvane never presses Send.</p>
      </div>
      <div className="continuity-orbit" aria-label="Claude to ChatGPT continuity status">
        <div className="orbit-provider source"><ProviderMark provider="claude" /><span><strong>Claude</strong><small>Current work</small></span></div>
        <div className="orbit-path"><i /><span className="orbit-capsule"><Sparkles size={21} /></span><i /></div>
        <div className="orbit-provider target"><ProviderMark provider="openai" /><span><strong>ChatGPT</strong><small>Ready next</small></span></div>
        <div className="orbit-note"><Check size={14} /><span><strong>Project memory ready</strong><small>Capsule v{version} · {tokenEstimate} tokens</small></span></div>
      </div>
    </section>

    <button className="continuity-composer" onClick={onSave} aria-label="Save the latest project progress">
      <span className="composer-spark"><Sparkles size={18} /></span>
      <span className="composer-copy"><strong>Save what changed…</strong><small>Paste the latest exchange or use the browser chip</small></span>
      <kbd>Alt S</kbd>
      <span className="composer-send"><ArrowUp size={18} /></span>
    </button>

    {setup}

    <section className="continuity-grid">
      <article className="next-card">
        <div className="card-topline"><span className="soft-icon"><Target size={17} /></span><span>Next action</span><button onClick={onPreview}>Review memory</button></div>
        <h2>{state.nextAction || "Save your latest work to set the next action."}</h2>
        <div className="project-now"><span><b>Working on</b>{state.currentTask || "Project state not established yet."}</span><ChevronRight size={18} /></div>
      </article>

      <article className="readiness-card">
        <div className="readiness-head"><span><Gauge size={16} /> Handoff readiness</span><strong>{contextHealth}%</strong></div>
        <div className="readiness-track"><i style={{ width: `${contextHealth}%` }} /></div>
        <p>{ready ? "Everything important is ready to carry forward." : "Save the latest chat before moving so the next model gets the full picture."}</p>
        <div className="readiness-facts"><span><Check size={13} /> User-approved state</span><span><ShieldCheck size={13} /> Secrets redacted</span></div>
      </article>

      <article className="memory-card">
        <div className="card-topline"><span className="soft-icon"><Database size={17} /></span><span>What Solvane remembers</span><button onClick={onOpenMemory}>Trust preview</button></div>
        <div className="memory-summary">
          <div><strong>{state.decisions.length}</strong><span>decisions</span></div>
          <div><strong>{state.completed.length}</strong><span>completed</span></div>
          <div><strong>{state.openQuestions.length}</strong><span>open questions</span></div>
        </div>
        <p>{state.objective || "Your project goal will appear here after the first save."}</p>
      </article>

      <article className="recent-continuity-card">
        <div className="card-topline"><span className="soft-icon"><History size={17} /></span><span>Recent continuity</span></div>
        {handoffs.length ? handoffs.slice(0, 2).map((handoff) => <div className="continuity-row" key={handoff.id}><ProviderMark provider={handoff.target} small /><span><strong>Continued in {PROVIDERS[handoff.target].name}</strong><small>v{handoff.snapshotVersion} · {formatRelative(handoff.createdAt)}</small></span><Check size={14} /></div>) : <div className="continuity-empty"><Sparkles size={18} /><span><strong>Your first handoff starts here</strong><small>Save in Claude, then continue in ChatGPT.</small></span></div>}
      </article>
    </section>
  </div>;
}

function CapsuleWorkspace(props: { state: RelaySnapshot; draft: RelaySnapshot; editing: boolean; version: number; pins: string[]; onTogglePin?: (key: string) => void; createdAt: string | null; tokenEstimate: number; contextHealth: number; saving: boolean; captureText: string; onDraftChange: (state: RelaySnapshot) => void; onCaptureText: (value: string) => void; onCapture: () => void; onCheckpoint: () => void; onEdit: () => void; onCancel: () => void; onSave: () => void; onRescue: () => void; onPreview: () => void }) {
  const { state, draft, editing } = props;
  const update = (field: keyof RelaySnapshot, value: string | string[]) => props.onDraftChange({ ...draft, [field]: value });
  const onTogglePin = editing ? undefined : props.onTogglePin;
  const list = (field: "decisions" | "constraints" | "completed" | "openQuestions" | "doNotRepeat" | "artifacts", label: string, icon: React.ReactNode) => <CapsuleList field={field} label={label} items={state[field]} pins={props.pins} onTogglePin={onTogglePin} editing={editing} onChange={(items) => update(field, items)} icon={icon} />;
  return <div className="capsule-layout"><article className="capsule-sheet"><header className="capsule-head"><div className="capsule-title"><span className="capsule-glyph"><Target size={19} /></span><div><p>Continuity Capsule</p><h2>The state that travels with you</h2></div></div><div className="capsule-tools"><span className="version-pill">v{props.version}</span><button className="tool-button" onClick={props.onPreview}><Clipboard size={14} /> Trust preview</button><button className="tool-button checkpoint-tool" onClick={props.onCheckpoint}><FileDiff size={14} /> Save checkpoint</button>{editing ? <><button className="tool-button" onClick={props.onCancel}>Cancel</button><button className="primary-button compact" onClick={props.onSave} disabled={props.saving}>{props.saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Save capsule</button></> : <button className="tool-button" onClick={props.onEdit}><Pencil size={14} /> Edit</button>}</div></header>{props.contextHealth < 75 && <div className="context-warning"><CircleAlert size={16} /><span><strong>Missing context.</strong> Add at least one decision and make the next step specific before a high-stakes handoff.</span></div>}<div className="capsule-grid"><CapsuleField label="North star" value={state.objective} pinned={props.pins.includes("objective")} onTogglePin={onTogglePin && (() => onTogglePin("objective"))} editing={editing} onChange={(value) => update("objective", value)} large /><CapsuleField label="Current task" value={state.currentTask} pinned={props.pins.includes("currentTask")} onTogglePin={onTogglePin && (() => onTogglePin("currentTask"))} editing={editing} onChange={(value) => update("currentTask", value)} large accent />{list("decisions", "Decisions locked", <LockKeyhole size={14} />)}{list("constraints", "Constraints", <ShieldCheck size={14} />)}{list("completed", "What changed", <Activity size={14} />)}{list("openQuestions", "Open questions", <CircleAlert size={14} />)}{list("doNotRepeat", "Do not repeat", <RefreshCw size={14} />)}{list("artifacts", "Artifacts & files", <Folder size={14} />)}</div><section className="next-step-block"><div><span><Zap size={13} /> Next step lock{onTogglePin && <PinToggle pinned={props.pins.includes("nextAction")} label="next step" onClick={() => onTogglePin("nextAction")} />}</span>{editing ? <textarea value={draft.nextAction} onChange={(event) => update("nextAction", event.target.value)} rows={3} /> : <h3>{state.nextAction}</h3>}</div><LockKeyhole size={20} /></section><footer className="capsule-footer"><span><Clock3 size={13} /> {props.createdAt ? `Updated ${formatRelative(props.createdAt)}` : "Not saved yet"}</span><span>{props.tokenEstimate} estimated tokens</span><button onClick={props.onRescue} disabled={props.saving}><RefreshCw className={props.saving ? "spin" : ""} size={13} /> Rescue session</button></footer></article><aside className="capture-card"><div className="capture-icon"><Sparkles size={18} /></div><p className="eyebrow">Quick capture</p><h3>What changed since the last capsule?</h3><textarea value={props.captureText} onChange={(event) => props.onCaptureText(event.target.value)} placeholder="Paste a result, decision, correction, or selected text…" rows={6} /><button className="primary-button" onClick={props.onCapture} disabled={!props.captureText.trim()}><Plus size={15} /> Add to capsule draft</button><button className="secondary-action capture-checkpoint" onClick={props.onCheckpoint}><FileDiff size={14} /> Review with Gemini</button><p className="capture-note">Nothing is sent to an AI until you choose a handoff or API action.</p></aside></div>;
}

function CheckpointWorkspace(props: { rawPatch:string;onRawPatch:(value:string)=>void; text: string; preview: CheckpointPreview | null; accepts: Set<string>; rejects: Set<string>; busy: boolean; savedVersion: number | null; suggestedProvider: ProviderId; onIntake:(text:string)=>void; edits:Record<string,string>; onEdit:(item:CheckpointDiff)=>void; onText: (value: string) => void; onPreview: () => void; onCommit: () => void; onDecision: (key: string, decision: "accepted" | "rejected") => void; onAcceptAdditions: () => void; onContinue: (provider: ProviderId) => void; onCopyInstruction: () => void }) {
  const [showProviders, setShowProviders] = useState(false);
  const additions = props.preview?.diff.filter((item) => item.kind === "added") ?? [];
  const changes = props.preview?.diff.filter((item) => item.kind === "changed") ?? [];
  const removals = props.preview?.diff.filter((item) => item.kind === "removed") ?? [];
  const unresolved = props.preview ? props.preview.diff.length - props.accepts.size - props.rejects.size : 0;
  return <div className="checkpoint-layout"><section className="surface-card checkpoint-card"><div className="surface-head"><div><p className="eyebrow"><FileDiff size={13} /> Checkpoint intake</p><h2>Save the work before you switch.</h2><p className="surface-subtitle">Paste a recent Claude, Gemini, ChatGPT, Perplexity, Codex, or Claude Code exchange. Solvane turns it into a small, reviewable capsule patch.</p></div><span className="checkpoint-badge">v1 schema</span></div><ProjectIntake onUse={props.onIntake} /><textarea className="checkpoint-input" value={props.text} onChange={(event) => props.onText(event.target.value)} placeholder="Paste your recent chat or update block here." rows={13} />{props.rawPatch && <details open className="project-intake"><summary>Gemini output to fix manually</summary><textarea className="checkpoint-input" aria-label="Raw patch to edit" value={props.rawPatch} onChange={(event)=>props.onRawPatch(event.target.value)} rows={7}/><button className="secondary-action" onClick={()=>props.onText(`<<<SOLVANE_UPDATE v1\n${props.rawPatch}\nSOLVANE_UPDATE>>>`)}>Use edited update block</button></details>}<div className="checkpoint-actions"><button className="primary-button" onClick={props.onPreview} disabled={props.busy || !props.text.trim()}>{props.busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Save checkpoint</button><button className="secondary-action" onClick={props.onCopyInstruction}><Clipboard size={14} /> Copy project instruction</button></div><div className="privacy-disclosure"><ShieldCheck size={15} /><p><strong>Privacy first.</strong> Solvane redacts common secrets before Gemini sees this paste. The text is sent to Google Gemini for processing only when a valid update block is not present, and pasted content is not logged as analytics.</p></div>{props.preview && <div className="checkpoint-review"><div className="review-head"><div><p className="eyebrow">Trust preview</p><h3>{props.preview.source === "update_block" ? "Update block validated locally" : "Gemini drafted this patch"}</h3><small>{props.preview.redactedCount ? `${props.preview.redactedCount} secret-like value(s) redacted. ` : "No secrets detected. "}{props.preview.tokenEstimate} estimated patch tokens.</small></div><button className="secondary-action compact-action" onClick={props.onAcceptAdditions} disabled={!additions.length}>Accept all additions</button></div>{props.preview.diff.length ? <><DiffGroup title="Added" items={additions} accepts={props.accepts} rejects={props.rejects} edits={props.edits} onEdit={props.onEdit} onDecision={props.onDecision} tone="added" /><DiffGroup title="Changed" items={changes} accepts={props.accepts} rejects={props.rejects} edits={props.edits} onEdit={props.onEdit} onDecision={props.onDecision} tone="changed" /><DiffGroup title="Removed" items={removals} accepts={props.accepts} rejects={props.rejects} edits={props.edits} onEdit={props.onEdit} onDecision={props.onDecision} tone="removed" /><div className="checkpoint-commit"><span><strong>{props.accepts.size} accepted</strong>{props.rejects.size ? ` · ${props.rejects.size} rejected` : ""}{unresolved > 0 ? ` · ${unresolved} still to review` : ""}. Changed and removed items stay neutral until you choose.</span><button className="primary-button" onClick={props.onCommit} disabled={props.busy}><Check size={15} /> Accept & save capsule</button></div></> : <div className="empty-review"><Check size={17} /><p>No changes were found. Add more context or edit the capsule manually.</p></div>}</div>}{props.savedVersion && <div className="checkpoint-saved"><Check size={17} /><div><strong>Saved (v{props.savedVersion})</strong><small>Your reviewed state is now the handoff source.</small></div><div className="continue-split"><button className="primary-button" onClick={() => props.onContinue(props.suggestedProvider)}>Continue in {PROVIDERS[props.suggestedProvider].name}</button><button className="primary-button split-toggle" onClick={() => setShowProviders((value) => !value)} aria-label="Choose a provider"><ChevronDown size={15} /></button>{showProviders && <div className="checkpoint-provider-menu">{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => { setShowProviders(false); props.onContinue(provider); }}><ProviderMark provider={provider} small /><span>{PROVIDERS[provider].name}</span></button>)}</div>}</div></div>}</section><aside className="checkpoint-side"><section className="surface-card"><p className="eyebrow">How it works</p><h3>Paste → improve → review → continue.</h3><ol><li><b>1</b><span>Solvane finds a valid block or asks Gemini to extract only facts from your paste.</span></li><li><b>2</b><span>You accept additions, edits, and removals before anything becomes a new version.</span></li><li><b>3</b><span>Trust Preview and the existing provider handoff copy the approved capsule.</span></li></ol></section><section className="surface-card checkpoint-format"><p className="eyebrow">Ask any LLM for a block</p><pre>{["<<<SOLVANE_UPDATE v1", "{\"decisions_add\":[],\"done_add\":[],\"open_questions_add\":[],\"open_questions_resolve\":[],\"constraints_add\":[],\"next_step\":\"\",\"changes\":[]}", "SOLVANE_UPDATE>>>"] .join("\n")}</pre></section></aside></div>;
}

function DiffGroup({ title, items, accepts, rejects, edits, onEdit, onDecision, tone }: { edits:Record<string,string>; onEdit:(item:CheckpointDiff)=>void; title: string; items: CheckpointDiff[]; accepts: Set<string>; rejects: Set<string>; onDecision: (key: string, decision: "accepted" | "rejected") => void; tone: "added" | "changed" | "removed" }) {
  if (!items.length) return null;
  return <section className={`diff-group ${tone}`}><div className="diff-group-head"><strong>{title}</strong><small>{items.length} item{items.length === 1 ? "" : "s"}</small></div>{items.map((item) => <article className={`diff-item ${accepts.has(item.key) ? "accepted" : rejects.has(item.key) ? "rejected" : "neutral"}`} key={item.key}><div className="diff-copy"><span className="diff-field">{checkpointFieldLabel(item.field)}</span>{(item.kind !== "changed" || edits[item.key]) && <p>{edits[item.key] || item.text}</p>}{(item.pinned || edits[item.key] || item.contradiction) && <p className="diff-notes">{item.pinned && <em>{item.kind === "removed" ? "Pinned by you. Accepting removes it anyway." : "Pinned by you, so not pre-selected. Accepting replaces it."}</em>}{edits[item.key] && <em>Your edit will be pinned.</em>}{item.contradiction && <em>{item.kind === "added" ? "Meant to replace an item that isn't in the capsule. Accepting adds it as new." : "Contradiction — review the current capsule before accepting."}</em>}</p>}{item.kind === "changed" && <small><s>{item.from}</s> <ArrowRight size={11} /> <b>{item.to}</b></small>}{item.sourceExcerpt && <blockquote><span>Source</span>{item.sourceExcerpt}</blockquote>}</div><div className="diff-controls">{item.kind !== "removed" && <button onClick={() => onEdit(item)}>Edit & pin</button>}<button className={accepts.has(item.key) ? "diff-accept selected" : "diff-accept"} aria-pressed={accepts.has(item.key)} onClick={() => onDecision(item.key, "accepted")}><Check size={13} /> Accept</button><button className={rejects.has(item.key) ? "diff-reject selected" : "diff-reject"} aria-pressed={rejects.has(item.key)} onClick={() => onDecision(item.key, "rejected")}><X size={13} /> Reject</button></div></article>)}</section>;
}

function PinToggle({ pinned, label, onClick }: { pinned: boolean; label: string; onClick: () => void }) { return <button type="button" className={pinned ? "pin-toggle pinned" : "pin-toggle"} aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${label}`} title={pinned ? "Pinned: Solvane won't change this automatically. Click to unpin." : "Pin so Solvane never changes this automatically."} onClick={onClick}><Pin size={11} /></button>; }
function CapsuleField({ label, value, pinned, onTogglePin, editing, onChange, large, accent }: { label: string; value: string; pinned: boolean; onTogglePin?: () => void; editing: boolean; onChange: (value: string) => void; large?: boolean; accent?: boolean }) { return <section className={`capsule-field ${large ? "large" : ""} ${accent ? "accent" : ""}`}><span>{label}{onTogglePin && <PinToggle pinned={pinned} label={label} onClick={onTogglePin} />}</span>{editing ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} /> : <p>{value || "Not established yet."}</p>}</section>; }
function CapsuleList({ field, label, items, pins, onTogglePin, editing, onChange, icon }: { field: string; label: string; items: string[]; pins: string[]; onTogglePin?: (key: string) => void; editing: boolean; onChange: (items: string[]) => void; icon: React.ReactNode }) { return <section className="capsule-list"><span>{icon}{label}</span>{editing ? <textarea value={items.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} rows={5} placeholder="One item per line" /> : items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}><span>{item}</span>{onTogglePin && <PinToggle pinned={isPinned(pins, field, item)} label={item} onClick={() => onTogglePin(itemPinKey(field, item))} />}</li>)}</ul> : <p>Nothing recorded.</p>}</section>; }

function ActivityWorkspace({ handoffs, failovers, versions, onPreview, onRestore }: { handoffs: HandoffRecord[]; failovers: FailoverRecord[]; versions: SnapshotVersion[]; onPreview: (snapshot: SnapshotVersion) => void; onRestore: (snapshot: SnapshotVersion) => void }) { return <div className="activity-grid"><section className="surface-card"><div className="surface-head"><div><p className="eyebrow">Audit trail</p><h2>Handoff history</h2></div><History size={21} /></div>{handoffs.length || failovers.length ? <div className="timeline-list">{handoffs.map((handoff) => <article key={handoff.id}><ProviderMark provider={handoff.target} /><span><strong>Continued in {PROVIDERS[handoff.target].name}</strong><small>{handoff.mode} handoff · Capsule v{handoff.snapshotVersion}</small></span><time>{formatRelative(handoff.createdAt)}</time></article>)}{failovers.map((failover) => <article key={failover.id}><Zap size={18} /><span><strong>API failover: {PROVIDERS[failover.from]?.name || failover.from} → {PROVIDERS[failover.to]?.name || failover.to}</strong><small>{failover.reason} · approved Capsule v{failover.snapshotVersion}</small></span><time>{formatRelative(failover.createdAt)}</time></article>)}</div> : <EmptyState icon={<ArrowRight size={21} />} title="No handoffs yet" copy="Choose a model from the Continue In panel to create your first audited handoff." />}</section><section className="surface-card"><div className="surface-head"><div><p className="eyebrow">Recoverable memory</p><h2>Capsule versions</h2></div><Clock3 size={21} /></div>{versions.length ? <div className="version-list">{versions.map((snapshot) => <article key={snapshot.version}><span className="version-number">v{snapshot.version}</span><span><strong>{snapshot.state.currentTask}</strong><small>{snapshot.createdAt ? formatRelative(snapshot.createdAt) : "Saved"} · {snapshot.sourceMessageCount ?? 0} source messages</small></span><div className="version-actions"><button onClick={() => onPreview(snapshot)}>Preview</button><button onClick={() => onRestore(snapshot)}>Restore as new version</button></div></article>)}</div> : <EmptyState icon={<Clock3 size={21} />} title="No saved versions" copy="Edit and save the capsule to start version history." />}</section></div>; }
function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p></div>; }

function SettingsWorkspace(props: { providers: ProviderStatus[]; folder: FolderSummary; messages: RelayMessage[]; privacy: CapsulePrivacy; apiComposer: string; sending: boolean; automation: AutomationSettings; onboarding: Onboarding; onPrivacy: (key: keyof CapsulePrivacy, value: boolean) => void; onConnections: () => void; onToggleFallback: (value: boolean) => void; onAutomation: (next: Partial<AutomationSettings>) => void; onComposer: (value: string) => void; onSend: (event: React.FormEvent) => void; onExport: () => void; onDeleteAll: () => void; onCopyInstruction: () => void }) {
  const connected = props.providers.filter((provider) => provider.connected).length;
  const privacyRows: Array<[keyof CapsulePrivacy, string]> = [["includeDecisions", "Include decisions"], ["includeConstraints", "Include constraints"], ["includeArtifacts", "Include artifacts and sources"], ["excludeCode", "Exclude fenced code"]];
  return <div className="settings-grid"><section className="surface-card mode-card featured"><div className="surface-head"><div><p className="eyebrow">Free default</p><h2>Browser Bridge</h2></div><AppWindow size={22} /></div><p>Use the AI subscriptions and free accounts you already have. Solvane copies a reviewed capsule, opens the target model, and the extension can insert it for you.</p><div className="mode-actions"><a className="primary-button" href="/solvane-extension.zip" download><AppWindow size={15} /> Download extension</a><button className="secondary-action" onClick={props.onExport}><Code2 size={15} /> Export for coding agents</button></div><div className="mode-facts"><span><Check size={13} /> No provider API keys</span><span><Check size={13} /> Claude, Gemini, ChatGPT, Perplexity</span><span><Check size={13} /> Manual paste fallback</span></div></section><section className="surface-card mode-card"><div className="surface-head"><div><p className="eyebrow">Serious developer mode</p><h2>API Automation</h2></div><Code2 size={22} /></div><p>Server-side provider routing, automatic fallback, citations, and durable responses. Bring your own keys or add managed usage later.</p><div className="automation-status"><span><KeyRound size={15} /> {connected}/4 provider APIs connected</span><button onClick={props.onConnections}>Manage keys</button></div><label className="setting-toggle"><span><strong>Automatic API fallback</strong><small>Try the next connected API after an eligible failure.</small></span><input type="checkbox" checked={props.folder.autoFallback} onChange={(event) => props.onToggleFallback(event.target.checked)} /><i /></label></section><section className="surface-card privacy-card"><div className="surface-head"><div><p className="eyebrow">This browser</p><h2>Privacy controls</h2></div><ShieldCheck size={22} /></div>{privacyRows.map(([key, label]) => <label className="setting-toggle compact-setting" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={props.privacy[key]} onChange={(event) => props.onPrivacy(key, event.target.checked)} /><i /></label>)}</section><section className="surface-card api-console"><div className="surface-head"><div><p className="eyebrow">Developer test surface</p><h2>API relay console</h2></div><Zap size={22} /></div>{props.messages.length ? <div className="api-message-list">{props.messages.slice(-4).map((message) => <article className={message.role} key={message.id}><span>{message.role === "assistant" && message.provider ? PROVIDERS[message.provider].name : "You"}</span><p>{message.content}</p></article>)}</div> : <p className="empty-note">No API relay messages in this project yet.</p>}<form onSubmit={props.onSend}><textarea value={props.apiComposer} onChange={(event) => props.onComposer(event.target.value)} placeholder={connected ? "Send through your ordered provider APIs…" : "Connect an API key to test automated relay"} rows={4} /><button className="primary-button" disabled={!props.apiComposer.trim() || props.sending}>{props.sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Run API relay</button></form></section></div>;
}

function AutomationSettingsPanel({ automation, onboarding, onAutomation, onDeleteAll, onCopyInstruction }: { automation: AutomationSettings; onboarding: Onboarding; onAutomation: (next: Partial<AutomationSettings>) => void; onDeleteAll: () => void; onCopyInstruction: () => void }) {
  const toggleSite = (provider: ProviderId) => onAutomation({ enabledSites: automation.enabledSites.includes(provider) ? automation.enabledSites.filter((item) => item !== provider) : [...automation.enabledSites, provider] });
  return <section className="surface-card automation-panel"><div className="surface-head"><div><p className="eyebrow">Phase 3 controls</p><h2>Automation & reliability</h2></div><Zap size={22} /></div><p className="surface-subtitle">Auto-detection is off by default. When enabled, the extension reads only the latest stable assistant message and never reads anything when disabled.</p><label className="setting-toggle"><span><strong>Auto-detect update blocks</strong><small>Pulse “Update ready — Save” and skip Gemini for valid blocks.</small></span><input type="checkbox" checked={automation.autoDetect} onChange={(event) => onAutomation({ autoDetect: event.target.checked })} /><i /></label><label className="setting-toggle"><span><strong>Checkpoint reminders</strong><small>About 30 minutes or 15 messages without a save.</small></span><input type="checkbox" checked={automation.reminders} onChange={(event) => onAutomation({ reminders: event.target.checked })} /><i /></label><label className="setting-toggle"><span><strong>Always show what will be sent</strong><small>Keep Trust Preview open before a browser handoff.</small></span><input type="checkbox" checked={automation.alwaysShowWhatWillBeSent} onChange={(event) => onAutomation({ alwaysShowWhatWillBeSent: event.target.checked })} /><i /></label><div className="automation-inline-fields"><label><span>Default handoff</span><select value={automation.defaultHandoff} onChange={(event) => onAutomation({ defaultHandoff: event.target.value as AutomationSettings["defaultHandoff"] })}><option value="last">Last used provider</option>{PROVIDER_IDS.map((provider) => <option key={provider} value={provider}>{PROVIDERS[provider].name}</option>)}</select></label><label><span>Token budget</span><input type="number" min={300} max={1500} step={50} value={automation.tokenBudget} onChange={(event) => onAutomation({ tokenBudget: Math.min(1500, Math.max(300, Number(event.target.value) || 1500)) })} /></label></div><div className="enabled-sites"><p className="eyebrow">Enabled provider pages</p>{PROVIDER_IDS.map((provider) => <label key={provider}><input type="checkbox" checked={automation.enabledSites.includes(provider)} onChange={() => toggleSite(provider)} /><ProviderMark provider={provider} small /><span>{PROVIDERS[provider].name}</span></label>)}</div><div className="onboarding-inline"><p className="eyebrow">First handoff checklist</p><ol><li className={onboarding.instruction ? "done" : ""}>Add the project instruction to Claude</li><li className={onboarding.installed ? "done" : ""}>Install extension</li><li className={onboarding.linked ? "done" : ""}>Link a project</li><li className={onboarding.saved ? "done" : ""}>Save a checkpoint</li><li className={onboarding.continued ? "done" : ""}>Continue in another model</li></ol><button className="secondary-action" onClick={onCopyInstruction}><Clipboard size={14} /> Copy project instruction</button></div><div className="automation-danger"><a className="secondary-action" href="/api/export" download>Export my data</a><button className="secondary-action" onClick={() => {onAutomation(DEFAULT_AUTOMATION_SETTINGS);window.localStorage.removeItem(CONSENT_STORAGE_KEY);window.postMessage({type:"solvane-revoke"},window.location.origin);window.location.reload();}}>Revoke extension consent</button><a href="/privacy">Privacy & Google processing</a><button className="secondary-action" onClick={onDeleteAll}><Database size={14} /> Delete all account data</button><small>Deletes projects, capsules, messages, handoffs, API connections, and analytics events.</small></div></section>;
}

function PreviewDialog({ prompt, tokenEstimate, onCopy, onContinue, onClose }: { prompt: string; tokenEstimate: number; onCopy: () => void; onContinue: (provider: ProviderId) => void; onClose: () => void }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]); return <div className="modal-backdrop" onMouseDown={onClose}><section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Trust preview</p><h2 id="preview-title">Exactly what the next AI receives</h2></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="preview-meta"><span><ShieldCheck size={13} /> Secrets are never added automatically</span><b>≈ {tokenEstimate} tokens</b></div><pre>{prompt}</pre><footer><button className="secondary-action" onClick={onCopy}><Copy size={15} /> Copy only</button><div>{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => onContinue(provider)} title={`Continue in ${PROVIDERS[provider].name}`}><ProviderMark provider={provider} small /></button>)}</div></footer></section></div>; }
function QuickSwitchDialog({ version, health, onContinue, onClose }: { version: number; health: number; onContinue: (provider: ProviderId) => void; onClose: () => void }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]); return <div className="modal-backdrop" onMouseDown={onClose}><section className="quick-switch" role="dialog" aria-modal="true" aria-labelledby="quick-title" onMouseDown={(event) => event.stopPropagation()}><header><span className="capsule-glyph"><Zap size={19} /></span><div><p>Quick handoff</p><h2 id="quick-title">Where should the work continue?</h2></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="quick-status"><span>Capsule v{version}</span><span>{health}% context health</span><span>Browser Bridge · free</span></div><div className="quick-providers">{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => onContinue(provider)}><ProviderMark provider={provider} /><span><strong>{PROVIDERS[provider].name}</strong><small>{PROVIDERS[provider].role}</small></span><ArrowRight size={16} /></button>)}</div><p><Clipboard size={13} /> The capsule is copied before the target site opens. The extension inserts it; without the extension, press Paste.</p></section></div>; }

function HandoffLaunchDialog({ provider, version, tokenEstimate, prompt, onLaunch, onClose }: { provider: ProviderId; version: number; tokenEstimate: number; prompt?:string; onLaunch: () => void; onClose: () => void }) {
  const item = PROVIDERS[provider];
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="handoff-launch" role="dialog" aria-modal="true" aria-labelledby="handoff-launch-title" onMouseDown={(event) => event.stopPropagation()}><header><div className="handoff-destination"><ProviderMark provider={provider} /><div><p className="eyebrow">Browser Bridge handoff</p><h2 id="handoff-launch-title">Continue in {item.name}</h2><span>{item.role}</span></div></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="handoff-summary"><span>Capsule v{version}</span><span>≈ {tokenEstimate} tokens</span><span>No provider API key</span></div>{prompt && <details className="handoff-payload" open><summary>Exactly what will be sent</summary><pre>{prompt}</pre></details>}<div className="handoff-steps"><article><b>1</b><div><strong>Copy the reviewed Capsule</strong><p>Solvane places only the visible handoff state on your clipboard.</p></div></article><article><b>2</b><div><strong>Open the official {item.name} website</strong><p>The button below is a direct browser link, so it does not depend on scripted popups.</p></div></article><article><b>3</b><div><strong>Insert, review, and send</strong><p>The extension can insert it. Manual paste remains available and Solvane never presses Send.</p></div></article></div><div className="handoff-destination-url"><ShieldCheck size={15} /><span>Destination</span><strong>{new URL(item.webUrl).hostname}</strong></div><footer><button className="secondary-action" onClick={onClose}>Cancel</button><a className="primary-button" href={item.webUrl} target="_blank" rel="noopener noreferrer" onClick={onLaunch}>Copy Capsule & open {item.name}<ArrowRight size={15} /></a></footer></section></div>;
}

function ConnectionsPanel({ providers, onClose, onChanged }: { providers: ProviderStatus[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<ProviderId | null>(null); const [apiKey, setApiKey] = useState(""); const [model, setModel] = useState(""); const [saving, setSaving] = useState(false); const [panelError, setPanelError] = useState<string | null>(null); const [confirming, setConfirming] = useState<ProviderId | null>(null);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  async function save(provider: ProviderId) { setSaving(true); setPanelError(null); try { await api("/api/providers", { method: "POST", body: JSON.stringify({ provider, apiKey, model }) }); setApiKey(""); setEditing(null); await onChanged(); } catch (cause) { setPanelError(cause instanceof Error ? cause.message : "Could not save connection."); } finally { setSaving(false); } }
  async function disconnect(provider: ProviderId) { if (confirming !== provider) { setConfirming(provider); return; } setSaving(true); setPanelError(null); try { await api("/api/providers", { method: "DELETE", body: JSON.stringify({ provider }) }); setConfirming(null); await onChanged(); } catch (cause) { setPanelError(cause instanceof Error ? cause.message : "Could not remove connection."); } finally { setSaving(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="connections-panel" role="dialog" aria-modal="true" aria-labelledby="connections-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Optional developer mode</p><h2 id="connections-title">API connections</h2><p>Browser Bridge remains free without these. Add keys only for automated server-side relay.</p></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header>{panelError && <div className="panel-error"><CircleAlert size={15} />{panelError}</div>}<div className="connection-list">{providers.map((provider) => <article className="connection-row" key={provider.id}><ProviderMark provider={provider.id} /><div><strong>{provider.name}</strong><span>{provider.connected ? `${provider.model} · ${provider.source === "platform" ? "workspace key" : "your key"}` : "Browser Bridge ready · API not connected"}</span></div>{editing === provider.id ? <div className="connection-form"><input type="password" autoFocus autoComplete="off" placeholder={`${provider.name} API key`} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /><input placeholder="Model ID" value={model} onChange={(event) => setModel(event.target.value)} /><button onClick={() => void save(provider.id)} disabled={saving || !apiKey.trim()}>{saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Save</button><button className="cancel" onClick={() => setEditing(null)} aria-label="Cancel"><X size={14} /></button></div> : <div className="connection-actions"><span className={provider.connected ? "online" : ""}>{provider.connected ? "Connected" : "Optional"}</span><button onClick={() => { setEditing(provider.id); setModel(provider.model); setConfirming(null); }}>{provider.connected ? "Replace" : "Add key"}</button>{provider.connected && provider.source === "user" && <button className={confirming === provider.id ? "danger confirm" : "danger"} onClick={() => void disconnect(provider.id)}>{confirming === provider.id ? "Confirm" : "Remove"}</button>}</div>}</article>)}</div><div className="connection-note"><KeyRound size={15} /><p>Keys are encrypted before storage and never returned to the browser. Serious developers can use API mode; everyone else can stay on Browser Bridge.</p></div></section></div>;
}

function ProfilePanel({ user, consent, onManageCookies, onClose }: { user: { name: string; email: string }; consent: ConsentState | null; onManageCookies: () => void; onClose: () => void }) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    void api<AccountSummary>("/api/account").then(setSummary).catch((cause: unknown) => setProfileError(cause instanceof Error ? cause.message : "Could not load account data."));
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const counts = summary?.counts;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}><header><div className="profile-identity"><span className="profile-avatar">{initials}</span><div><p className="eyebrow">Profile & data center</p><h2 id="profile-title">{user.name}</h2><p>{user.email}</p></div></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header>{profileError && <div className="panel-error"><CircleAlert size={15} />{profileError}</div>}<div className="profile-body"><section className="profile-section"><div className="profile-section-title"><Database size={17} /><div><strong>Your Solvane data</strong><small>Everything below is isolated to this signed-in account.</small></div></div>{counts ? <div className="data-count-grid"><DataCount label="Projects" value={counts.projects} /><DataCount label="Capsule versions" value={counts.capsuleVersions} /><DataCount label="Messages" value={counts.messages} /><DataCount label="Handoffs" value={counts.handoffs} /><DataCount label="API connections" value={counts.apiConnections} /><DataCount label="Analytics events" value={counts.analyticsEvents} /></div> : <div className="profile-loading"><LoaderCircle className="spin" size={17} /> Reading your account data…</div>}<a className="profile-download" href="/api/export" download><Download size={16} /><span><strong>Download all my data</strong><small>JSON export. API keys are always excluded.</small></span><ArrowRight size={15} /></a></section><section className="profile-section"><div className="profile-section-title"><UserRound size={17} /><div><strong>Sign-in methods</strong><small>Your current production identity is managed by Sites.</small></div></div><div className="identity-provider active"><ProviderMark provider="openai" small /><span><strong>ChatGPT</strong><small>Connected · active sign-in</small></span><Check size={15} /></div><div className="future-auth-row"><span><strong>Google</strong><small>Requires a Google OAuth app and production callback URL.</small></span><b>Setup required</b></div><div className="future-auth-row"><span><strong>GitHub</strong><small>Requires a GitHub OAuth app and production callback URL.</small></span><b>Setup required</b></div></section><section className="profile-section compact-profile"><div className="profile-section-title"><Cookie size={17} /><div><strong>Cookie & analytics choices</strong><small>{consent?.analytics ? "Essential storage + privacy-safe product analytics." : "Essential storage only. Optional analytics is off."}</small></div></div><button className="secondary-action" onClick={onManageCookies}>Manage choices</button></section><div className="profile-privacy-note"><ShieldCheck size={17} /><p>Solvane does not collect AI-provider cookies, passwords, hidden browsing history, or prompt text for analytics. A cookie banner is not permission to scrape third-party accounts.</p></div></div><footer><a className="signout-button" href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut size={15} /> Sign out</a><span>Privacy controls are product safeguards, not legal advice.</span></footer></section></div>;
}

function DataCount({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function CookieConsent({ current, onChoose, onClose }: { current: ConsentState | null; onChoose: (analytics: boolean) => void; onClose?: () => void }) {
  return <div className="cookie-layer" role="presentation"><section className="cookie-banner" role="dialog" aria-modal={Boolean(onClose)} aria-labelledby="cookie-title"><div className="cookie-icon"><Cookie size={21} /></div><div className="cookie-copy"><p className="eyebrow">Your privacy, your choice</p><h2 id="cookie-title">Essential storage or helpful product analytics?</h2><p>Essential auth and device preferences keep Solvane working. Optional first-party analytics records only allowlisted actions such as opening a mode or starting a handoff—never capsule text, prompts, provider cookies, passwords, or browsing history.</p>{current && <small>Current choice: {current.analytics ? "analytics allowed" : "essential only"} · saved {new Date(current.decidedAt).toLocaleDateString()}</small>}</div><div className="cookie-actions"><button className="secondary-action" onClick={() => onChoose(false)}>Essential only</button><button className="primary-button" onClick={() => onChoose(true)}>Allow product analytics</button>{onClose && <button className="cookie-close" onClick={onClose} aria-label="Close cookie settings"><X size={16} /></button>}</div></section></div>;
}
