"use client";

import { Activity, ArrowRight, Check, ChevronRight, CircleAlert, Cloud, Database, Folder, FolderPlus, History, LayoutDashboard, LoaderCircle, Menu, Plus, Settings2, Sparkles, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPTY_SNAPSHOT, PROVIDERS, continueTarget, isProviderId, normalizeSnapshot, type ProviderId, type RelaySnapshot } from "../lib/product";
import { DEFAULT_CAPSULE_PRIVACY, PROJECT_INSTRUCTION, buildCapsulePrompt, redactSecrets, type CapsulePrivacy } from "../lib/checkpoint";
import { type FolderSummary, type ProviderStatus, type RelayMessage, type FolderDetail, type SnapshotVersion, type HandoffRecord, type FailoverRecord, type WorkspaceView, type CheckpointPreview, type ConsentState, type AutomationSettings, DEFAULT_AUTOMATION_SETTINGS, type Onboarding, DEFAULT_ONBOARDING, CONSENT_STORAGE_KEY, api, copyText, formatRelative, suggestProvider, Brand, NavButton } from "./_dashboard/shared";
import { SetupCard, ContinuityHome } from "./_dashboard/home";
import { CapsuleWorkspace } from "./_dashboard/memory";
import { CheckpointWorkspace } from "./_dashboard/checkpoint";
import { ActivityWorkspace } from "./_dashboard/activity";
import { ProviderRoute, SettingsWorkspace, AutomationSettingsPanel } from "./_dashboard/settings";
import { PreviewDialog, QuickSwitchDialog, HandoffLaunchDialog, ConnectionsPanel } from "./_dashboard/dialogs";
import { ProfilePanel, CookieConsent } from "./_dashboard/account";

export function RelayDashboard({ user }: { user: { name: string; email: string } }) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [versions, setVersions] = useState<SnapshotVersion[]>([]);
  const [versionsHasMore, setVersionsHasMore] = useState(false);
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
        api<{ snapshots: SnapshotVersion[]; hasMore?: boolean }>(`/api/snapshots?folderId=${encodeURIComponent(folderId)}`),
        api<{ handoffs: HandoffRecord[]; failovers?: FailoverRecord[] }>(`/api/handoffs?folderId=${encodeURIComponent(folderId)}`),
      ]);
      const normalized = normalizeSnapshot(folderData.snapshot.state);
      setDetail({ ...folderData, snapshot: { ...folderData.snapshot, state: normalized } });
      setDraft(normalized);
      setVersions(versionData.snapshots);
      setVersionsHasMore(Boolean(versionData.hasMore));
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
  const workProvider: ProviderId = detail?.folder.providerOrder[0] ?? "claude";
  const nextProvider = detail ? continueTarget(detail.folder.providerOrder, automationSettings.defaultHandoff, lastProvider) : "openai";
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

  async function loadOlderVersions() {
    const oldest = versions.at(-1);
    if (!detail || !oldest) return;
    try {
      const data = await api<{ snapshots: SnapshotVersion[]; hasMore?: boolean }>(`/api/snapshots?folderId=${encodeURIComponent(detail.folder.id)}&before=${oldest.version}`);
      setVersions((items) => [...items, ...data.snapshots.filter((item) => !items.some((existing) => existing.version === item.version))]);
      setVersionsHasMore(Boolean(data.hasMore));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load older versions."); }
  }

  async function renameProject(name: string) {
    if (!detail) return;
    try {
      await api(`/api/folders/${detail.folder.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      const updated = { ...detail.folder, name: name.slice(0, 80) };
      setDetail({ ...detail, folder: updated });
      setFolders((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      flash("Project renamed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not rename the project."); }
  }

  async function deleteProject() {
    if (!detail) return;
    const { id, name } = detail.folder;
    if (!window.confirm(`Delete "${name}"? Its capsule versions, API messages and handoff history are removed. This cannot be undone.`)) return;
    try {
      await api(`/api/folders/${id}`, { method: "DELETE" });
      const remaining = folders.filter((folder) => folder.id !== id);
      setFolders(remaining); setVersions([]); setHandoffs([]); setFailovers([]); setView("capsule");
      // With no projects left, bootstrap creates a fresh starter project.
      if (remaining.length) setActiveFolderId(remaining[0].id); else { setDetail(null); setActiveFolderId(null); await bootstrap(); }
      flash(`Deleted "${name}".`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the project."); }
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
        <div className="header-context"><span>{detail?.folder.name || "Opening project"}</span><i /><b className={detail?.snapshot.version ? undefined : "pending"}>{detail?.snapshot.version ? `Capsule v${detail.snapshot.version}${detail.snapshot.createdAt ? ` · saved ${formatRelative(detail.snapshot.createdAt)}` : ""}` : "Not saved yet"}</b></div>
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
          <div className="rail-footer"><div className="device-status"><Cloud size={15} /><span><strong>Saved to your account</strong><small>Open it on any signed-in device</small></span></div><button className="account-row" onClick={openProfile}><span className="mini-avatar">{initials}</span><span><strong>{user.name}</strong><small>Profile & privacy</small></span><ChevronRight size={14} /></button></div>
        </aside>

        <section className="workspace-main workspace-main-v2">
          {loading || !detail ? <div className="workspace-loader"><LoaderCircle className="spin" size={28} /><span>Assembling your workspace…</span></div> : <>
            {view !== "capsule" && <div className="workspace-titlebar workspace-titlebar-v2"><div><button className="back-home" onClick={() => setView("capsule")}><ArrowRight size={14} /> Back home</button><p className="eyebrow"><Activity size={12} /> {detail.folder.name}</p><h1>{view === "memory" ? "Project memory" : view === "checkpoint" ? "Save progress" : view === "activity" ? "Project history" : "Advanced controls"}</h1></div>{view === "settings" && <span className="advanced-pill">API mode stays available</span>}</div>}
            {view === "capsule" && <ContinuityHome project={detail.folder} state={activeState} version={detail.snapshot.version} createdAt={detail.snapshot.createdAt} tokenEstimate={tokenEstimate} contextHealth={contextHealth} handoffs={handoffs} setup={showSetup ? <SetupCard steps={setupSteps} onCopyInstruction={() => void copyProjectInstruction()} onSave={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onDismiss={() => markOnboarding("dismissed")} /> : null} onSave={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onContinue={() => prepareHandoff(nextProvider)} source={workProvider} target={nextProvider} onRename={renameProject} onPreview={() => setShowPreview(true)} onOpenMemory={() => setView("memory")} />}
            {view === "memory" && <CapsuleWorkspace state={activeState} draft={draft} editing={editing} version={detail.snapshot.version} pins={detail.snapshot.pinnedFields ?? []} onTogglePin={detail.snapshot.version ? (key) => void togglePin(key) : undefined} createdAt={detail.snapshot.createdAt} tokenEstimate={tokenEstimate} contextHealth={contextHealth} saving={saving} captureText={captureText} onDraftChange={setDraft} onCaptureText={setCaptureText} onCapture={captureIntoDraft} onCheckpoint={() => { setCheckpointText(""); setCheckpointPreview(null); setView("checkpoint"); }} onEdit={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setDraftOrigin(normalizeSnapshot(detail.snapshot.state)); setEditing(true); }} onCancel={() => { setDraft(normalizeSnapshot(detail.snapshot.state)); setEditing(false); }} onSave={() => void saveCapsule()} onRescue={() => void rescueSession()} onPreview={() => setShowPreview(true)} />}
            {view === "checkpoint" && <CheckpointWorkspace rawPatch={checkpointRawPatch} onRawPatch={setCheckpointRawPatch} text={checkpointText} preview={checkpointPreview} accepts={checkpointAccepts} rejects={checkpointRejects} busy={checkpointBusy} savedVersion={checkpointSavedVersion} suggestedProvider={suggestProvider(checkpointText || activeState.currentTask, detail.folder.providerOrder, automationSettings.defaultHandoff === "last" ? lastProvider : automationSettings.defaultHandoff)} onIntake={(text) => setCheckpointText((prior) => [prior,text].filter(Boolean).join("\n\n"))} edits={checkpointEdits} onEdit={(item) => { const value = window.prompt("Edit this fact. Your accepted edit will be pinned.", checkpointEdits[item.key] || item.to || item.text); if(value?.trim()) { setCheckpointEdits((prev)=>({...prev,[item.key]:value.trim()})); setCheckpointAccepts((prev)=>new Set([...prev,item.key])); setCheckpointRejects((prev)=>{const next=new Set(prev);next.delete(item.key);return next;}); } }} onText={setCheckpointText} onPreview={() => void previewCheckpoint()} onCommit={() => void commitCheckpoint()} onDecision={(key, decision) => { setCheckpointAccepts((current) => { const next = new Set(current); if (decision === "accepted") next.add(key); else next.delete(key); return next; }); setCheckpointRejects((current) => { const next = new Set(current); if (decision === "rejected") next.add(key); else next.delete(key); return next; }); }} onAcceptAdditions={() => { const keys=checkpointPreview?.diff.filter((item) => item.kind === "added").map((item) => item.key) ?? []; setCheckpointAccepts((current) => new Set([...current, ...keys])); setCheckpointRejects((current)=>{const next=new Set(current);keys.forEach((key)=>next.delete(key));return next;}); }} onContinue={prepareHandoff} onCopyInstruction={() => void copyProjectInstruction()} />}
            {view === "activity" && <ActivityWorkspace handoffs={handoffs} failovers={failovers} versions={versions} hasMore={versionsHasMore} onLoadMore={() => void loadOlderVersions()} onPreview={(snapshot) => setVersionPreview(snapshot)} onRestore={(snapshot) => void restoreVersion(snapshot)} />}
            {view === "settings" && <><ProviderRoute folder={detail.folder} providers={providers} onMove={moveProvider} /><SettingsWorkspace providers={providers} folder={detail.folder} messages={detail.messages} privacy={privacy} apiComposer={apiComposer} sending={sending} automation={automationSettings} onboarding={onboarding} onPrivacy={updatePrivacy} onConnections={() => setShowConnections(true)} onToggleFallback={(value) => void persistFolderSettings({ autoFallback: value })} onAutomation={updateAutomationSettings} onComposer={setApiComposer} onSend={sendApiMessage} onExport={exportCodeHandoff} onDeleteAll={deleteAllData} onCopyInstruction={() => void copyProjectInstruction()} /><AutomationSettingsPanel automation={automationSettings} onboarding={onboarding} onAutomation={updateAutomationSettings} onDeleteProject={() => void deleteProject()} onDeleteAll={deleteAllData} onCopyInstruction={() => void copyProjectInstruction()} /></>}
          </>}
        </section>
      </div>

      <nav className="mobile-bottom-nav mobile-bottom-nav-v2" aria-label="Mobile navigation"><button className={view === "capsule" ? "active" : ""} onClick={() => setView("capsule")}><LayoutDashboard size={18} /><span>Home</span></button><button className={view === "checkpoint" ? "active" : ""} onClick={() => setView("checkpoint")}><Sparkles size={18} /><span>Save</span></button><button className="continue-nav" onClick={() => detail ? prepareHandoff(nextProvider) : setShowQuickSwitch(true)}><span className="handoff-fab"><ArrowRight size={20} /></span><span>Continue</span></button><button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><History size={18} /><span>History</span></button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings2 size={18} /><span>More</span></button></nav>
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
