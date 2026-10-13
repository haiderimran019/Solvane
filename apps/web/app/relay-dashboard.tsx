"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  Folder,
  FolderPlus,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Zap,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_SNAPSHOT,
  PROVIDER_IDS,
  PROVIDERS,
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
  pending?: boolean;
};

type FolderDetail = {
  folder: FolderSummary;
  messages: RelayMessage[];
  snapshot: { version: number; state: RelaySnapshot; createdAt: string | null };
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

function ProviderMark({ provider, small = false }: { provider: ProviderId; small?: boolean }) {
  const item = PROVIDERS[provider];
  return (
    <span
      className={small ? "provider-mark provider-mark-small" : "provider-mark"}
      style={{ "--provider-color": item.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {item.shortName}
    </span>
  );
}

function citationLabel(citation: Citation) {
  if (citation.title) return citation.title;
  try {
    return new URL(citation.url).hostname;
  } catch {
    return "Source";
  }
}

export function RelayDashboard({ user }: { user: { name: string; email: string } }) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ folders: FolderSummary[]; providers: ProviderStatus[] }>(
        "/api/bootstrap",
      );
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
      const data = await api<FolderDetail>(`/api/folders/${folderId}`);
      setDetail(data);
      setFolders((items) =>
        items.map((item) => (item.id === data.folder.id ? data.folder : item)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this folder.");
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  useEffect(() => {
    if (activeFolderId) {
      void loadFolder(activeFolderId);
    }
  }, [activeFolderId, loadFolder]);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages]);

  const activeProvider = detail?.folder.providerOrder[0] ?? "claude";
  const connectedCount = providers.filter((provider) => provider.connected).length;

  async function createFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const data = await api<{ folder: FolderSummary }>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setFolders((items) => [data.folder, ...items]);
      setActiveFolderId(data.folder.id);
      setNewFolderName("");
      setShowNewFolder(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create folder.");
    }
  }

  async function persistFolderSettings(next: Partial<FolderSummary>) {
    if (!detail) return;
    const updated = { ...detail.folder, ...next };
    setDetail({ ...detail, folder: updated });
    setFolders((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    setSavingOrder(true);
    try {
      await api(`/api/folders/${updated.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          providerOrder: updated.providerOrder,
          autoFallback: updated.autoFallback,
        }),
      });
      setNotice("Relay order saved across devices.");
      setTimeout(() => setNotice(null), 2600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save folder settings.");
      await loadFolder(updated.id);
    } finally {
      setSavingOrder(false);
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

  async function refreshSnapshot() {
    if (!detail || refreshingSnapshot) return;
    setRefreshingSnapshot(true);
    setError(null);
    try {
      const data = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", {
        method: "POST",
        body: JSON.stringify({ folderId: detail.folder.id }),
      });
      setDetail((current) => (current ? { ...current, snapshot: data.snapshot } : current));
      setNotice("Portable state refreshed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh state.");
    } finally {
      setRefreshingSnapshot(false);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !composer.trim() || sending) return;
    const content = composer.trim();
    const turnId = crypto.randomUUID();
    const optimistic: RelayMessage = {
      id: `optimistic-${turnId}`,
      turnId,
      role: "user",
      provider: null,
      content,
      citations: [],
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setComposer("");
    setSending(true);
    setError(null);
    setDetail((current) =>
      current ? { ...current, messages: [...current.messages, optimistic] } : current,
    );
    try {
      const data = await api<{
        message: RelayMessage;
        provider: ProviderId;
        attempts: Array<{ provider: ProviderId; reason: string }>;
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ folderId: detail.folder.id, content, turnId }),
      });
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages.map((message) =>
                  message.id === optimistic.id ? { ...message, pending: false } : message,
                ),
                data.message,
              ],
            }
          : current,
      );
      if (data.attempts.length) {
        setNotice(`Relayed to ${PROVIDERS[data.provider].name} after ${data.attempts.length} fallback attempt${data.attempts.length > 1 ? "s" : ""}.`);
      }
      const snapshotData = await api<{ snapshot: FolderDetail["snapshot"] }>("/api/snapshots", {
        method: "POST",
        body: JSON.stringify({ folderId: detail.folder.id }),
      });
      setDetail((current) => (current ? { ...current, snapshot: snapshotData.snapshot } : current));
      void bootstrap();
    } catch (cause) {
      setDetail((current) =>
        current
          ? { ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) }
          : current,
      );
      setComposer(content);
      setError(cause instanceof Error ? cause.message : "The relay could not complete this turn.");
    } finally {
      setSending(false);
    }
  }

  const initials = useMemo(
    () =>
      user.name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [user.name],
  );

  return (
    <main className="relay-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <div><strong>Solvane</strong><span>Model relay workspace</span></div>
        </div>
        <div className="sync-pill"><Cloud size={14} /><span>Synced across devices</span><i /></div>
        <div className="topbar-actions">
          <button className="secondary-button" aria-label={`Connect models, ${connectedCount} of 4 connected`} onClick={() => setShowConnections(true)}>
            <KeyRound size={15} /> <span className="connection-label">Connect models</span> <b>{connectedCount}/4</b>
          </button>
          <div className="avatar" title={user.email}>{initials}</div>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="folder-sidebar">
          <div className="sidebar-heading"><span>Project folders</span><button onClick={() => setShowNewFolder(true)} aria-label="Create folder"><Plus size={17} /></button></div>
          {showNewFolder && (
            <form className="new-folder-form" onSubmit={createFolder}>
              <input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Folder name" maxLength={80} />
              <button type="submit" aria-label="Save folder"><Check size={15} /></button>
              <button type="button" onClick={() => setShowNewFolder(false)} aria-label="Cancel"><X size={15} /></button>
            </form>
          )}
          <nav className="folder-list" aria-label="Project folders">
            {folders.map((folder) => (
              <button key={folder.id} className={folder.id === activeFolderId ? "folder-item active" : "folder-item"} onClick={() => setActiveFolderId(folder.id)}>
                <Folder size={16} /><span><strong>{folder.name}</strong><small>{folder.description || "Relay workspace"}</small></span><ChevronRight size={14} />
              </button>
            ))}
          </nav>
          <button className="create-folder-card" onClick={() => setShowNewFolder(true)}><FolderPlus size={18} /><span><strong>New project folder</strong><small>Keep context isolated</small></span></button>
          <div className="sidebar-footer"><LockKeyhole size={14} /><span>Private to your account</span></div>
        </aside>

        <section className="conversation-panel">
          {loading || !detail ? (
            <div className="center-loader"><LoaderCircle className="spin" size={26} /><span>Opening your relay workspace…</span></div>
          ) : (
            <>
              <div className="project-header">
                <div><p className="eyebrow"><Zap size={12} /> Active project</p><h1>{detail.folder.name}</h1><p>{detail.folder.description || "Your shared working context across every connected model."}</p></div>
                <div className="route-status"><ProviderMark provider={activeProvider} small /><span>Starts with <strong>{PROVIDERS[activeProvider].name}</strong></span></div>
              </div>

              <section className="relay-route" aria-label="Model relay order">
                <div className="route-heading"><div><p className="eyebrow">Relay order</p><h2>Who picks up next</h2></div><label className="fallback-toggle"><input type="checkbox" checked={detail.folder.autoFallback} onChange={(event) => void persistFolderSettings({ autoFallback: event.target.checked })} /><span /><em>Auto fallback</em></label></div>
                <div className="provider-lane">
                  {detail.folder.providerOrder.map((provider, index) => {
                    const status = providers.find((item) => item.id === provider);
                    return (
                      <div className={index === 0 ? "provider-card primary" : "provider-card"} key={provider}>
                        <div className="provider-number">{String(index + 1).padStart(2, "0")}</div>
                        <ProviderMark provider={provider} />
                        <div className="provider-copy"><strong>{PROVIDERS[provider].name}</strong><span>{status?.connected ? PROVIDERS[provider].role : "Connect to use"}</span></div>
                        <div className={status?.connected ? "connection-dot online" : "connection-dot"} title={status?.connected ? "Connected" : "Not connected"} />
                        <div className="reorder-actions">
                          <button onClick={() => moveProvider(index, -1)} disabled={index === 0 || savingOrder} aria-label={`Move ${PROVIDERS[provider].name} up`}><ArrowUp size={13} /></button>
                          <button onClick={() => moveProvider(index, 1)} disabled={index === detail.folder.providerOrder.length - 1 || savingOrder} aria-label={`Move ${PROVIDERS[provider].name} down`}><ArrowDown size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="chat-card">
                <div className="chat-heading"><div><MessageSquareText size={16} /><span>Project conversation</span></div><span>{detail.messages.length} messages</span></div>
                <div className="message-list">
                  {detail.messages.length === 0 && (
                    <div className="empty-chat"><div className="empty-icon"><Sparkles size={22} /></div><h3>Start once.<br />Continue anywhere.</h3><p>Describe the project, constraints, and next task. Solvane keeps the work ready for whichever model comes next.</p><div className="empty-benefits"><span><ShieldCheck size={13} /> Private state</span><span><Zap size={13} /> Fast handoff</span></div></div>
                  )}
                  {detail.messages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      <div className="message-meta">
                        {message.role === "assistant" && message.provider ? <ProviderMark provider={message.provider} small /> : <span className="you-mark">You</span>}
                        <strong>{message.role === "assistant" && message.provider ? PROVIDERS[message.provider].name : "You"}</strong>
                        {message.pending && <LoaderCircle className="spin" size={13} />}
                      </div>
                      <div className="message-content">{message.content}</div>
                      {message.citations?.length > 0 && <div className="citations">{message.citations.map((citation, index) => <a href={citation.url} target="_blank" rel="noreferrer" key={`${citation.url}-${index}`}>[{index + 1}] {citationLabel(citation)}</a>)}</div>}
                    </article>
                  ))}
                  <div ref={messageEndRef} />
                </div>
                <form className="composer" onSubmit={sendMessage}>
                  <textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={connectedCount ? `Message ${PROVIDERS[activeProvider].name} — fallback is ${detail.folder.autoFallback ? "on" : "off"}` : "Connect a provider to start"} rows={2} />
                  <div className="composer-footer"><span>State will refresh after this turn</span><button type="submit" disabled={!composer.trim() || sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}<span>{sending ? "Relaying" : "Send"}</span></button></div>
                </form>
              </section>
            </>
          )}
        </section>

        <aside className="state-sidebar">
          <div className="state-header"><div><p className="eyebrow">Portable state</p><h2>Relay snapshot</h2></div><span>v{detail?.snapshot.version ?? 0}</span></div>
          <div className="state-live"><i /><span>{detail?.snapshot.version ? "Ready to hand off" : "Waiting for first turn"}</span></div>
          <StateSection label="Objective" value={detail?.snapshot.state.objective} />
          <StateSection label="Current task" value={detail?.snapshot.state.currentTask} highlight />
          <StateList label="Decisions" items={detail?.snapshot.state.decisions} />
          <StateList label="Constraints" items={detail?.snapshot.state.constraints} />
          <StateList label="Open questions" items={detail?.snapshot.state.openQuestions} />
          <div className="next-action"><span>Next action</span><p>{detail?.snapshot.state.nextAction ?? EMPTY_SNAPSHOT.nextAction}</p></div>
          <button className="refresh-state" disabled={!detail || sending || refreshingSnapshot} onClick={() => void refreshSnapshot()}>{refreshingSnapshot ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} {refreshingSnapshot ? "Refreshing…" : "Refresh snapshot"}</button>
        </aside>
      </div>

      {(error || notice) && <div className={error ? "toast error" : "toast success"}>{error ? <CircleAlert size={16} /> : <Check size={16} />}<span>{error || notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => { setError(null); setNotice(null); }}><X size={14} /></button></div>}
      {showConnections && <ConnectionsPanel providers={providers} onClose={() => setShowConnections(false)} onChanged={bootstrap} />}
    </main>
  );
}

function StateSection({ label, value, highlight = false }: { label: string; value?: string; highlight?: boolean }) {
  return <section className={highlight ? "state-section highlighted" : "state-section"}><span>{label}</span><p>{value || "Not established yet."}</p></section>;
}

function StateList({ label, items }: { label: string; items?: string[] }) {
  return <section className="state-section"><span>{label}</span>{items?.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted-state">None recorded.</p>}</section>;
}

function ConnectionsPanel({ providers, onClose, onChanged }: { providers: ProviderStatus[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<ProviderId | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function save(provider: ProviderId) {
    setSaving(true); setPanelError(null);
    try {
      await api("/api/providers", { method: "POST", body: JSON.stringify({ provider, apiKey, model }) });
      setApiKey(""); setEditing(null); await onChanged();
    } catch (cause) { setPanelError(cause instanceof Error ? cause.message : "Could not save connection."); }
    finally { setSaving(false); }
  }

  async function disconnect(provider: ProviderId) {
    if (confirmingDisconnect !== provider) {
      setConfirmingDisconnect(provider);
      return;
    }
    setSaving(true); setPanelError(null);
    try { await api("/api/providers", { method: "DELETE", body: JSON.stringify({ provider }) }); setConfirmingDisconnect(null); await onChanged(); }
    catch (cause) { setPanelError(cause instanceof Error ? cause.message : "Could not remove connection."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="connections-panel" role="dialog" aria-modal="true" aria-labelledby="connections-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="connections-head"><div><p className="eyebrow">Secure integrations</p><h2 id="connections-title">Connect your models</h2><p>Your API keys are encrypted before storage and are never returned to the browser.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {panelError && <div className="panel-error"><CircleAlert size={15} />{panelError}</div>}
        <div className="connection-list">
          {providers.map((provider) => (
            <article className="connection-row" key={provider.id}>
              <ProviderMark provider={provider.id} />
              <div className="connection-copy"><strong>{provider.name}</strong><span>{provider.connected ? `${provider.model} · ${provider.source === "platform" ? "workspace key" : "your key"}` : PROVIDERS[provider.id].role}</span></div>
              {editing === provider.id ? (
                <div className="connection-form"><input type="password" autoFocus autoComplete="off" placeholder={`${provider.name} API key`} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /><input placeholder="Model ID" value={model} onChange={(event) => setModel(event.target.value)} /><button type="button" onClick={() => void save(provider.id)} disabled={saving || !apiKey.trim()}>{saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Save</button><button type="button" className="icon-cancel" onClick={() => { setEditing(null); setApiKey(""); }} aria-label="Cancel connection edit"><X size={14} /></button></div>
              ) : (
                <div className="connection-actions"><span className={provider.connected ? "status-label online" : "status-label"}>{provider.connected ? "Connected" : "Offline"}</span><button type="button" onClick={() => { setEditing(provider.id); setModel(provider.model); setConfirmingDisconnect(null); }}>{provider.connected ? "Replace key" : "Connect"}</button>{provider.connected && provider.source === "user" && <button type="button" className={confirmingDisconnect === provider.id ? "disconnect confirming" : "disconnect"} onClick={() => void disconnect(provider.id)}>{confirmingDisconnect === provider.id ? "Confirm remove" : "Remove"}</button>}</div>
              )}
            </article>
          ))}
        </div>
        <div className="connection-note"><Settings2 size={15} /><p><strong>Low-cost defaults.</strong> Model IDs remain editable so the product can move with provider changes without a new deployment.</p></div>
      </section>
    </div>
  );
}
