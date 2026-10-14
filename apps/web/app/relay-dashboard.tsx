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
  Clock3,
  Cloud,
  Code2,
  Cookie,
  Copy,
  Database,
  Download,
  Folder,
  FolderPlus,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_SNAPSHOT,
  PROVIDER_IDS,
  PROVIDERS,
  normalizeSnapshot,
  type Citation,
  type ProviderId,
  type RelaySnapshot,
} from "../lib/product";

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
  snapshot: { version: number; state: RelaySnapshot; createdAt: string | null };
};

type SnapshotVersion = FolderDetail["snapshot"] & { sourceMessageCount?: number };
type HandoffRecord = {
  id: string;
  target: ProviderId;
  mode: "browser" | "api" | "code";
  snapshotVersion: number;
  createdAt: string;
};
type WorkspaceView = "capsule" | "activity" | "settings";

type ConsentState = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  version: "1.0";
};

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

const CONSENT_STORAGE_KEY = "solvane-consent-v1";

const DEFAULT_PRIVACY = {
  includeDecisions: true,
  includeConstraints: true,
  includeArtifacts: true,
  excludeCode: false,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
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
  const item = PROVIDERS[provider];
  return (
    <span
      className={small ? "provider-mark provider-mark-small" : "provider-mark"}
      style={{ "--provider-color": item.color } as React.CSSProperties}
      title={`${item.name} logo`}
      aria-hidden="true"
    >
      {provider === "gemini" && <svg viewBox="0 0 32 32"><defs><linearGradient id="gemini-gradient" x1="4" y1="28" x2="28" y2="4"><stop stopColor="#4e8cff"/><stop offset=".48" stopColor="#a875ff"/><stop offset="1" stopColor="#ff78b5"/></linearGradient></defs><path fill="url(#gemini-gradient)" d="M16 2c1.2 7.4 6.6 12.8 14 14-7.4 1.2-12.8 6.6-14 14C14.8 22.6 9.4 17.2 2 16 9.4 14.8 14.8 9.4 16 2Z"/></svg>}
      {provider === "claude" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8 6.8 25.2"/><path d="m10.7 3.7 10.6 24.6M28.3 10.7 3.7 21.3M21.3 3.7 10.7 28.3M28.3 21.3 3.7 10.7"/></g></svg>}
      {provider === "openai" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M15.9 4.2a6 6 0 0 1 10.2 4.3v4.7a6 6 0 0 1-3 10.4l-4.1 2.3a6 6 0 0 1-9-5.2V16"/><path d="M7.8 9a6 6 0 0 1 9-5.2l4 2.3a6 6 0 0 1 0 10.4l-4 2.3"/><path d="M26 19a6 6 0 0 1-9 5.2l-4-2.3a6 6 0 0 1 0-10.4l4-2.3"/><path d="M6 13a6 6 0 0 0 3 10.4l4 2.3a6 6 0 0 0 9-5.2V16"/></g></svg>}
      {provider === "perplexity" && <svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 8h16v16H8zM16 3v26M5 12l11-9 11 9M5 20l11 9 11-9M8 8l8 8 8-8M8 24l8-8 8 8"/></g></svg>}
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

function buildRelayPrompt(
  project: FolderSummary,
  state: RelaySnapshot,
  privacy: typeof DEFAULT_PRIVACY,
) {
  const clean = (value: string) =>
    privacy.excludeCode ? value.replace(/```[\s\S]*?```/g, "[code intentionally excluded]") : value;
  const lines = [
    "SOLVANE CONTINUITY CAPSULE",
    `Project: ${project.name}`,
    `Objective: ${clean(state.objective)}`,
    `Current task: ${clean(state.currentTask)}`,
  ];
  if (privacy.includeDecisions && state.decisions.length) {
    lines.push(`Decisions:\n${state.decisions.map((item) => `- ${clean(item)}`).join("\n")}`);
  }
  if (privacy.includeConstraints && state.constraints.length) {
    lines.push(`Constraints:\n${state.constraints.map((item) => `- ${clean(item)}`).join("\n")}`);
  }
  if (state.completed.length) lines.push(`Completed:\n${state.completed.map((item) => `- ${clean(item)}`).join("\n")}`);
  if (state.openQuestions.length) lines.push(`Open questions:\n${state.openQuestions.map((item) => `- ${clean(item)}`).join("\n")}`);
  if (state.doNotRepeat.length) lines.push(`Do not repeat:\n${state.doNotRepeat.map((item) => `- ${clean(item)}`).join("\n")}`);
  if (privacy.includeArtifacts && state.artifacts.length) lines.push(`Artifacts:\n${state.artifacts.map((item) => `- ${clean(item)}`).join("\n")}`);
  if (privacy.includeArtifacts && state.sources.length) lines.push(`Sources:\n${state.sources.map((item) => `- ${item}`).join("\n")}`);
  lines.push(
    `NEXT STEP: ${clean(state.nextAction)}`,
    "Continue from this state. Do not claim access to hidden reasoning or missing chat history. Ask only for information that truly blocks the next step.",
  );
  return lines.join("\n\n");
}

export function RelayDashboard({ user }: { user: { name: string; email: string } }) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [versions, setVersions] = useState<SnapshotVersion[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [view, setView] = useState<WorkspaceView>("capsule");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RelaySnapshot>(EMPTY_SNAPSHOT);
  const [captureText, setCaptureText] = useState("");
  const [apiComposer, setApiComposer] = useState("");
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [showConnections, setShowConnections] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQuickSwitch, setShowQuickSwitch] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [launchProvider, setLaunchProvider] = useState<ProviderId | null>(null);
  const [consent, setConsent] = useState<ConsentState | null>(null);
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
        api<{ handoffs: HandoffRecord[] }>(`/api/handoffs?folderId=${encodeURIComponent(folderId)}`),
      ]);
      const normalized = normalizeSnapshot(folderData.snapshot.state);
      setDetail({ ...folderData, snapshot: { ...folderData.snapshot, state: normalized } });
      setDraft(normalized);
      setVersions(versionData.snapshots);
      setHandoffs(handoffData.handoffs);
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
        try { setPrivacy({ ...DEFAULT_PRIVACY, ...(JSON.parse(stored) as typeof DEFAULT_PRIVACY) }); }
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

  const activeState = editing ? draft : detail?.snapshot.state ?? EMPTY_SNAPSHOT;
  const relayPrompt = detail ? buildRelayPrompt(detail.folder, activeState, privacy) : "";
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
    window.setTimeout(() => setNotice(null), 3200);
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
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, state: draft }) });
      const normalized = normalizeSnapshot(data.snapshot.state);
      setDetail({ ...detail, snapshot: { ...data.snapshot, state: normalized } });
      setDraft(normalized); setEditing(false);
      await loadFolder(detail.folder.id);
      flash(`Continuity Capsule v${data.snapshot.version} saved.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the capsule."); }
    finally { setSaving(false); }
  }

  async function rescueSession() {
    if (!detail || saving) return;
    setSaving(true); setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id }) });
      const normalized = normalizeSnapshot(data.snapshot.state);
      setDetail({ ...detail, snapshot: { ...data.snapshot, state: normalized } });
      setDraft(normalized);
      await loadFolder(detail.folder.id);
      flash("Session rescued into a fresh capsule.");
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
    void copyText(relayPrompt);
    void api<{ handoff: HandoffRecord }>("/api/handoffs", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, target: provider, mode: "browser", snapshotVersion: detail.snapshot.version }) })
      .then((data) => setHandoffs((items) => [data.handoff, ...items]))
      .catch(() => { /* The normal provider link still works if audit logging is unavailable. */ });
    setLaunchProvider(null);
    track("handoff.started", { provider, mode: "browser" });
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
    setDraft((current) => ({ ...current, currentTask: value }));
    setCaptureText(""); setEditing(true);
    flash("Captured into the capsule draft. Review and save it.");
  }
  function updatePrivacy(key: keyof typeof DEFAULT_PRIVACY, value: boolean) {
    const next = { ...privacy, [key]: value };
    setPrivacy(next); window.localStorage.setItem("solvane-privacy", JSON.stringify(next));
  }

  async function sendApiMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !apiComposer.trim() || sending) return;
    const content = apiComposer.trim(); const turnId = crypto.randomUUID();
    setSending(true); setError(null);
    try {
      const data = await api<{ message: RelayMessage; provider: ProviderId }>("/api/chat", { method: "POST", body: JSON.stringify({ folderId: detail.folder.id, content, turnId }) });
      setApiComposer("");
      setDetail({ ...detail, messages: [...detail.messages, { id: crypto.randomUUID(), turnId, role: "user", provider: null, content, citations: [], createdAt: new Date().toISOString() }, data.message] });
      await rescueSession();
      flash(`API relay completed with ${PROVIDERS[data.provider].name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The API relay could not complete."); }
    finally { setSending(false); }
  }

  return (
    <main className="solvane-shell">
      <header className="app-header">
        <button className="mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <Brand />
        <div className="header-context"><span>{detail?.folder.name || "Opening workspace"}</span><i /><b>Synced</b></div>
        <div className="header-actions"><button className="shortcut-button" onClick={() => setShowQuickSwitch(true)}><Zap size={15} /><span>Quick handoff</span><kbd>⇧⌘S</kbd></button><button className="avatar" title={user.email} aria-label="Open profile and data center" onClick={openProfile}>{initials}</button></div>
      </header>

      <div className="app-frame">
        <aside className={showMobileNav ? "project-rail mobile-open" : "project-rail"}>
          <div className="mobile-rail-head"><Brand /><button onClick={() => setShowMobileNav(false)} aria-label="Close navigation"><X size={19} /></button></div>
          <nav className="primary-nav" aria-label="Workspace views">
            <NavButton active={view === "capsule"} icon={<LayoutDashboard size={17} />} label="Continuity" onClick={() => { setView("capsule"); setShowMobileNav(false); }} />
            <NavButton active={view === "activity"} icon={<History size={17} />} label="Activity" count={handoffs.length} onClick={() => { setView("activity"); setShowMobileNav(false); }} />
            <NavButton active={view === "settings"} icon={<Settings2 size={17} />} label="Modes & settings" onClick={() => { setView("settings"); setShowMobileNav(false); }} />
          </nav>
          <div className="rail-section-head"><span>Projects</span><button onClick={() => setShowNewFolder(true)} aria-label="New project"><Plus size={16} /></button></div>
          {showNewFolder && <form className="new-project-form" onSubmit={createFolder}><input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Project name" maxLength={80} /><button type="submit" aria-label="Create project"><Check size={15} /></button><button type="button" onClick={() => setShowNewFolder(false)} aria-label="Cancel"><X size={15} /></button></form>}
          <nav className="project-list" aria-label="Projects">{folders.map((folder) => <button key={folder.id} className={folder.id === activeFolderId ? "project-item active" : "project-item"} onClick={() => { setActiveFolderId(folder.id); setView("capsule"); setShowMobileNav(false); }}><span className="project-icon"><Folder size={15} /></span><span><strong>{folder.name}</strong><small>{formatRelative(folder.updatedAt)}</small></span><ChevronRight size={14} /></button>)}</nav>
          <button className="new-project-card" onClick={() => setShowNewFolder(true)}><FolderPlus size={17} /><span><strong>New project</strong><small>Start with a clean capsule</small></span></button>
          <div className="rail-footer"><div className="device-status"><Cloud size={15} /><span><strong>Cloud workspace</strong><small>Available on every device</small></span><i /></div><button className="account-row" onClick={openProfile}><span className="mini-avatar">{initials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><ChevronRight size={14} /></button></div>
        </aside>

        <section className="workspace-main">
          {loading || !detail ? <div className="workspace-loader"><LoaderCircle className="spin" size={28} /><span>Assembling your workspace…</span></div> : <>
            <div className="workspace-titlebar"><div><p className="eyebrow"><Activity size={12} /> Active project</p><h1>{detail.folder.name}</h1><p>{detail.folder.description || "One living state for every AI you use."}</p></div><div className="mode-switch" aria-label="Solvane mode"><button className={view === "settings" ? "" : "active"} onClick={() => { setView("capsule"); track("mode.opened", { mode: "browser" }); }}><AppWindow size={14} /> Browser Bridge</button><button className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); track("mode.opened", { mode: "api" }); }}><Code2 size={14} /> API mode</button></div></div>
            <ProviderRoute folder={detail.folder} providers={providers} onMove={moveProvider} />
            {view === "capsule" && <CapsuleWorkspace state={activeState} draft={draft} editing={editing} version={detail.snapshot.version} createdAt={detail.snapshot.createdAt} tokenEstimate={tokenEstimate} contextHealth={contextHealth} saving={saving} captureText={captureText} onDraftChange={setDraft} onCaptureText={setCaptureText} onCapture={captureIntoDraft} onEdit={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setEditing(true); }} onCancel={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setEditing(false); }} onSave={() => void saveCapsule()} onRescue={() => void rescueSession()} onPreview={() => setShowPreview(true)} />}
            {view === "activity" && <ActivityWorkspace handoffs={handoffs} versions={versions} onRestore={(snapshot) => { setDraft(normalizeSnapshot(snapshot.state)); setEditing(true); setView("capsule"); }} />}
            {view === "settings" && <SettingsWorkspace providers={providers} folder={detail.folder} messages={detail.messages} privacy={privacy} apiComposer={apiComposer} sending={sending} onPrivacy={updatePrivacy} onConnections={() => setShowConnections(true)} onToggleFallback={(value) => void persistFolderSettings({ autoFallback: value })} onComposer={setApiComposer} onSend={sendApiMessage} onExport={exportCodeHandoff} />}
          </>}
        </section>

        <aside className="action-rail">
          <section className="continue-card"><div className="card-kicker"><Sparkles size={13} /> Continue in</div><h2>Choose the best mind for what comes next.</h2><div className="provider-actions">{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => prepareHandoff(provider)} disabled={!detail}><ProviderMark provider={provider} /><span><strong>{PROVIDERS[provider].name}</strong><small>{PROVIDERS[provider].role}</small></span><ArrowRight size={16} /></button>)}</div><p className="free-note"><ShieldCheck size={13} /> Free mode uses your existing logged-in accounts. No API key required.</p></section>
          <section className="health-card"><div className="health-head"><span><Gauge size={15} /> Context health</span><strong>{contextHealth}%</strong></div><div className="health-track"><i style={{ width: `${contextHealth}%` }} /></div><p>{contextHealth >= 75 ? "Strong enough for a clean handoff." : "Add a decision and clear next step before switching."}</p><div className="memory-budget"><span>Capsule budget</span><b>{tokenEstimate} / 1,500 tokens</b></div></section>
          <section className="recent-card"><div className="recent-head"><span>Recent handoffs</span><button onClick={() => setView("activity")}>View all</button></div>{handoffs.length ? handoffs.slice(0, 3).map((handoff) => <div className="handoff-mini" key={handoff.id}><ProviderMark provider={handoff.target} small /><span><strong>Continued in {PROVIDERS[handoff.target].name}</strong><small>Capsule v{handoff.snapshotVersion} · {formatRelative(handoff.createdAt)}</small></span></div>) : <p className="empty-note">Your first handoff will appear here.</p>}</section>
        </aside>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation"><button className={view === "capsule" ? "active" : ""} onClick={() => setView("capsule")}><LayoutDashboard size={19} /><span>Capsule</span></button><button onClick={() => setShowQuickSwitch(true)}><span className="handoff-fab"><Zap size={20} /></span><span>Handoff</span></button><button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><History size={19} /><span>Activity</span></button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings2 size={19} /><span>Modes</span></button></nav>
      {(error || notice) && <div className={error ? "toast error" : "toast success"}>{error ? <CircleAlert size={16} /> : <Check size={16} />}<span>{error || notice}</span><button onClick={() => { setError(null); setNotice(null); }} aria-label="Dismiss"><X size={14} /></button></div>}
      {showPreview && detail && <PreviewDialog prompt={relayPrompt} tokenEstimate={tokenEstimate} onCopy={() => void copyRelayPrompt()} onContinue={prepareHandoff} onClose={() => setShowPreview(false)} />}
      {showQuickSwitch && detail && <QuickSwitchDialog version={detail.snapshot.version} health={contextHealth} onContinue={prepareHandoff} onClose={() => setShowQuickSwitch(false)} />}
      {launchProvider && detail && <HandoffLaunchDialog provider={launchProvider} version={detail.snapshot.version} tokenEstimate={tokenEstimate} onLaunch={() => launchInProvider(launchProvider)} onClose={() => setLaunchProvider(null)} />}
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

function CapsuleWorkspace(props: { state: RelaySnapshot; draft: RelaySnapshot; editing: boolean; version: number; createdAt: string | null; tokenEstimate: number; contextHealth: number; saving: boolean; captureText: string; onDraftChange: (state: RelaySnapshot) => void; onCaptureText: (value: string) => void; onCapture: () => void; onEdit: () => void; onCancel: () => void; onSave: () => void; onRescue: () => void; onPreview: () => void }) {
  const { state, draft, editing } = props;
  const update = (field: keyof RelaySnapshot, value: string | string[]) => props.onDraftChange({ ...draft, [field]: value });
  return <div className="capsule-layout"><article className="capsule-sheet"><header className="capsule-head"><div className="capsule-title"><span className="capsule-glyph"><Target size={19} /></span><div><p>Continuity Capsule</p><h2>The state that travels with you</h2></div></div><div className="capsule-tools"><span className="version-pill">v{props.version}</span><button className="tool-button" onClick={props.onPreview}><Clipboard size={14} /> Trust preview</button>{editing ? <><button className="tool-button" onClick={props.onCancel}>Cancel</button><button className="primary-button compact" onClick={props.onSave} disabled={props.saving}>{props.saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Save capsule</button></> : <button className="tool-button" onClick={props.onEdit}><Pencil size={14} /> Edit</button>}</div></header>{props.contextHealth < 75 && <div className="context-warning"><CircleAlert size={16} /><span><strong>Missing context.</strong> Add at least one decision and make the next step specific before a high-stakes handoff.</span></div>}<div className="capsule-grid"><CapsuleField label="North star" value={state.objective} editing={editing} onChange={(value) => update("objective", value)} large /><CapsuleField label="Current task" value={state.currentTask} editing={editing} onChange={(value) => update("currentTask", value)} large accent /><CapsuleList label="Decisions locked" items={state.decisions} editing={editing} onChange={(items) => update("decisions", items)} icon={<LockKeyhole size={14} />} /><CapsuleList label="Constraints" items={state.constraints} editing={editing} onChange={(items) => update("constraints", items)} icon={<ShieldCheck size={14} />} /><CapsuleList label="What changed" items={state.completed} editing={editing} onChange={(items) => update("completed", items)} icon={<Activity size={14} />} /><CapsuleList label="Open questions" items={state.openQuestions} editing={editing} onChange={(items) => update("openQuestions", items)} icon={<CircleAlert size={14} />} /><CapsuleList label="Do not repeat" items={state.doNotRepeat} editing={editing} onChange={(items) => update("doNotRepeat", items)} icon={<RefreshCw size={14} />} /><CapsuleList label="Artifacts & files" items={state.artifacts} editing={editing} onChange={(items) => update("artifacts", items)} icon={<Folder size={14} />} /></div><section className="next-step-block"><div><span><Zap size={13} /> Next step lock</span>{editing ? <textarea value={draft.nextAction} onChange={(event) => update("nextAction", event.target.value)} rows={3} /> : <h3>{state.nextAction}</h3>}</div><LockKeyhole size={20} /></section><footer className="capsule-footer"><span><Clock3 size={13} /> {props.createdAt ? `Updated ${formatRelative(props.createdAt)}` : "Not saved yet"}</span><span>{props.tokenEstimate} estimated tokens</span><button onClick={props.onRescue} disabled={props.saving}><RefreshCw className={props.saving ? "spin" : ""} size={13} /> Rescue session</button></footer></article><aside className="capture-card"><div className="capture-icon"><Sparkles size={18} /></div><p className="eyebrow">Quick capture</p><h3>What changed since the last capsule?</h3><textarea value={props.captureText} onChange={(event) => props.onCaptureText(event.target.value)} placeholder="Paste a result, decision, correction, or selected text…" rows={6} /><button className="primary-button" onClick={props.onCapture} disabled={!props.captureText.trim()}><Plus size={15} /> Add to capsule draft</button><p className="capture-note">Nothing is sent to an AI until you choose a handoff or API action.</p></aside></div>;
}

function CapsuleField({ label, value, editing, onChange, large, accent }: { label: string; value: string; editing: boolean; onChange: (value: string) => void; large?: boolean; accent?: boolean }) { return <section className={`capsule-field ${large ? "large" : ""} ${accent ? "accent" : ""}`}><span>{label}</span>{editing ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} /> : <p>{value || "Not established yet."}</p>}</section>; }
function CapsuleList({ label, items, editing, onChange, icon }: { label: string; items: string[]; editing: boolean; onChange: (items: string[]) => void; icon: React.ReactNode }) { return <section className="capsule-list"><span>{icon}{label}</span>{editing ? <textarea value={items.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} rows={5} placeholder="One item per line" /> : items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>Nothing recorded.</p>}</section>; }

function ActivityWorkspace({ handoffs, versions, onRestore }: { handoffs: HandoffRecord[]; versions: SnapshotVersion[]; onRestore: (snapshot: SnapshotVersion) => void }) { return <div className="activity-grid"><section className="surface-card"><div className="surface-head"><div><p className="eyebrow">Audit trail</p><h2>Handoff history</h2></div><History size={21} /></div>{handoffs.length ? <div className="timeline-list">{handoffs.map((handoff) => <article key={handoff.id}><ProviderMark provider={handoff.target} /><span><strong>Continued in {PROVIDERS[handoff.target].name}</strong><small>{handoff.mode} handoff · Capsule v{handoff.snapshotVersion}</small></span><time>{formatRelative(handoff.createdAt)}</time></article>)}</div> : <EmptyState icon={<ArrowRight size={21} />} title="No handoffs yet" copy="Choose a model from the Continue In panel to create your first audited handoff." />}</section><section className="surface-card"><div className="surface-head"><div><p className="eyebrow">Recoverable memory</p><h2>Capsule versions</h2></div><Clock3 size={21} /></div>{versions.length ? <div className="version-list">{versions.map((snapshot) => <article key={snapshot.version}><span className="version-number">v{snapshot.version}</span><span><strong>{snapshot.state.currentTask}</strong><small>{snapshot.createdAt ? formatRelative(snapshot.createdAt) : "Saved"} · {snapshot.sourceMessageCount ?? 0} source messages</small></span><button onClick={() => onRestore(snapshot)}>Restore as draft</button></article>)}</div> : <EmptyState icon={<Clock3 size={21} />} title="No saved versions" copy="Edit and save the capsule to start version history." />}</section></div>; }
function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p></div>; }

function SettingsWorkspace(props: { providers: ProviderStatus[]; folder: FolderSummary; messages: RelayMessage[]; privacy: typeof DEFAULT_PRIVACY; apiComposer: string; sending: boolean; onPrivacy: (key: keyof typeof DEFAULT_PRIVACY, value: boolean) => void; onConnections: () => void; onToggleFallback: (value: boolean) => void; onComposer: (value: string) => void; onSend: (event: React.FormEvent) => void; onExport: () => void }) {
  const connected = props.providers.filter((provider) => provider.connected).length;
  const privacyRows: Array<[keyof typeof DEFAULT_PRIVACY, string]> = [["includeDecisions", "Include decisions"], ["includeConstraints", "Include constraints"], ["includeArtifacts", "Include artifacts and sources"], ["excludeCode", "Exclude fenced code"]];
  return <div className="settings-grid"><section className="surface-card mode-card featured"><div className="surface-head"><div><p className="eyebrow">Free default</p><h2>Browser Bridge</h2></div><AppWindow size={22} /></div><p>Use the AI subscriptions and free accounts you already have. Solvane copies a reviewed capsule, opens the target model, and the extension can insert it for you.</p><div className="mode-actions"><a className="primary-button" href="/solvane-extension.zip" download><AppWindow size={15} /> Download extension</a><button className="secondary-action" onClick={props.onExport}><Code2 size={15} /> Export for coding agents</button></div><div className="mode-facts"><span><Check size={13} /> No provider API keys</span><span><Check size={13} /> Claude, Gemini, ChatGPT, Perplexity</span><span><Check size={13} /> Manual paste fallback</span></div></section><section className="surface-card mode-card"><div className="surface-head"><div><p className="eyebrow">Serious developer mode</p><h2>API Automation</h2></div><Code2 size={22} /></div><p>Server-side provider routing, automatic fallback, citations, and durable responses. Bring your own keys or add managed usage later.</p><div className="automation-status"><span><KeyRound size={15} /> {connected}/4 provider APIs connected</span><button onClick={props.onConnections}>Manage keys</button></div><label className="setting-toggle"><span><strong>Automatic API fallback</strong><small>Try the next connected API after an eligible failure.</small></span><input type="checkbox" checked={props.folder.autoFallback} onChange={(event) => props.onToggleFallback(event.target.checked)} /><i /></label></section><section className="surface-card privacy-card"><div className="surface-head"><div><p className="eyebrow">This browser</p><h2>Privacy controls</h2></div><ShieldCheck size={22} /></div>{privacyRows.map(([key, label]) => <label className="setting-toggle compact-setting" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={props.privacy[key]} onChange={(event) => props.onPrivacy(key, event.target.checked)} /><i /></label>)}</section><section className="surface-card api-console"><div className="surface-head"><div><p className="eyebrow">Developer test surface</p><h2>API relay console</h2></div><Zap size={22} /></div>{props.messages.length ? <div className="api-message-list">{props.messages.slice(-4).map((message) => <article className={message.role} key={message.id}><span>{message.role === "assistant" && message.provider ? PROVIDERS[message.provider].name : "You"}</span><p>{message.content}</p></article>)}</div> : <p className="empty-note">No API relay messages in this project yet.</p>}<form onSubmit={props.onSend}><textarea value={props.apiComposer} onChange={(event) => props.onComposer(event.target.value)} placeholder={connected ? "Send through your ordered provider APIs…" : "Connect an API key to test automated relay"} rows={4} /><button className="primary-button" disabled={!props.apiComposer.trim() || props.sending}>{props.sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Run API relay</button></form></section></div>;
}

function PreviewDialog({ prompt, tokenEstimate, onCopy, onContinue, onClose }: { prompt: string; tokenEstimate: number; onCopy: () => void; onContinue: (provider: ProviderId) => void; onClose: () => void }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]); return <div className="modal-backdrop" onMouseDown={onClose}><section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Trust preview</p><h2 id="preview-title">Exactly what the next AI receives</h2></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="preview-meta"><span><ShieldCheck size={13} /> Secrets are never added automatically</span><b>≈ {tokenEstimate} tokens</b></div><pre>{prompt}</pre><footer><button className="secondary-action" onClick={onCopy}><Copy size={15} /> Copy only</button><div>{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => onContinue(provider)} title={`Continue in ${PROVIDERS[provider].name}`}><ProviderMark provider={provider} small /></button>)}</div></footer></section></div>; }
function QuickSwitchDialog({ version, health, onContinue, onClose }: { version: number; health: number; onContinue: (provider: ProviderId) => void; onClose: () => void }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]); return <div className="modal-backdrop" onMouseDown={onClose}><section className="quick-switch" role="dialog" aria-modal="true" aria-labelledby="quick-title" onMouseDown={(event) => event.stopPropagation()}><header><span className="capsule-glyph"><Zap size={19} /></span><div><p>Quick handoff</p><h2 id="quick-title">Where should the work continue?</h2></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="quick-status"><span>Capsule v{version}</span><span>{health}% context health</span><span>Browser Bridge · free</span></div><div className="quick-providers">{PROVIDER_IDS.map((provider) => <button key={provider} onClick={() => onContinue(provider)}><ProviderMark provider={provider} /><span><strong>{PROVIDERS[provider].name}</strong><small>{PROVIDERS[provider].role}</small></span><ArrowRight size={16} /></button>)}</div><p><Clipboard size={13} /> The capsule is copied before the target site opens. The extension inserts it; without the extension, press Paste.</p></section></div>; }

function HandoffLaunchDialog({ provider, version, tokenEstimate, onLaunch, onClose }: { provider: ProviderId; version: number; tokenEstimate: number; onLaunch: () => void; onClose: () => void }) {
  const item = PROVIDERS[provider];
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="handoff-launch" role="dialog" aria-modal="true" aria-labelledby="handoff-launch-title" onMouseDown={(event) => event.stopPropagation()}><header><div className="handoff-destination"><ProviderMark provider={provider} /><div><p className="eyebrow">Browser Bridge handoff</p><h2 id="handoff-launch-title">Continue in {item.name}</h2><span>{item.role}</span></div></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="handoff-summary"><span>Capsule v{version}</span><span>≈ {tokenEstimate} tokens</span><span>No provider API key</span></div><div className="handoff-steps"><article><b>1</b><div><strong>Copy the reviewed Capsule</strong><p>Solvane places only the visible handoff state on your clipboard.</p></div></article><article><b>2</b><div><strong>Open the official {item.name} website</strong><p>The button below is a direct browser link, so it does not depend on scripted popups.</p></div></article><article><b>3</b><div><strong>Insert, review, and send</strong><p>The extension can insert it. Manual paste remains available and Solvane never presses Send.</p></div></article></div><div className="handoff-destination-url"><ShieldCheck size={15} /><span>Destination</span><strong>{new URL(item.webUrl).hostname}</strong></div><footer><button className="secondary-action" onClick={onClose}>Cancel</button><a className="primary-button" href={item.webUrl} target="_blank" rel="noopener noreferrer" onClick={onLaunch}>Copy Capsule & open {item.name}<ArrowRight size={15} /></a></footer></section></div>;
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
