(() => {
  if (window.__solvaneBridgeInstalled) return;
  window.__solvaneBridgeInstalled = true;

  const config = window.SOLVANE_PROVIDER_CONFIG;
  const current = Object.values(config.providers).find((provider) => provider.hostname === location.hostname);
  if (!current) return;

  const SOLVANE_ORIGIN = "https://solvane.rareyew64.chatgpt.site";
  const MAX_CAPTURE_CHARS = 30_000;
  const MAX_MESSAGES = 20;
  const pageKey = (value = location.href) => { const url = new URL(value, location.origin); return `${url.origin}${url.pathname}`; };
  const isUnscopedPage = (key = pageKey()) => (current.unscopedPaths || []).includes(new URL(key).pathname);
  const state = { root: null, drawer: null, projects: [], binding: null, pendingBinding: null, preview: null, accepts: new Set(), rejects: new Set(), sourceText: "", origin: SOLVANE_ORIGIN, prefillText: "", continueTarget: null, chatUrl: location.href, observer: null, scanTimer: null, reminderTimer: null, pulseTimer: null, automation: null, limitHash: null, queued: 0, reminded: false, editedItems: {}, queueBusy: false, activeQueueId: null, lastSavedMessageCount: 0, lastMessageCount: 0, activeMs: 0, activeTick: Date.now() };
  const DEFAULT_AUTOMATION = { tokenBudget:1500, autoDetect: false, enabledSites: ["openai", "claude", "gemini", "perplexity"], providerOrder: ["claude", "openai", "gemini", "perplexity"], defaultHandoff: "openai", reminders: true };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const hash = (value) => { let result = 2166136261; for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); } return (result >>> 0).toString(16); };
  const redact = (value) => window.SolvaneCore.redactSecrets(value);
  const getStorage = (area, key) => new Promise((resolve) => area.get(key, (value) => resolve(value || {})));
  const setStorage = (area, value) => new Promise((resolve) => area.set(value, resolve));
  const removeStorage = (area, key) => new Promise((resolve) => area.remove(key, resolve));
  // Chat-to-project links live in local storage: synced storage caps one item at 8 KB (about 80 links) and then
  // silently stops saving. Links saved by older versions move over the first time they are read.
  async function getBindings() {
    const [local, synced] = await Promise.all([getStorage(chrome.storage.local, "solvaneBindings"), getStorage(chrome.storage.sync, "solvaneBindings")]);
    if (!synced.solvaneBindings) return local.solvaneBindings || {};
    const merged = { ...synced.solvaneBindings, ...(local.solvaneBindings || {}) };
    await setStorage(chrome.storage.local, { solvaneBindings: merged }); await removeStorage(chrome.storage.sync, "solvaneBindings");
    return merged;
  }
  const setBindings = (bindings) => setStorage(chrome.storage.local, { solvaneBindings: bindings });
  const copyCapsule = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const area=document.createElement("textarea");area.value=text;root.appendChild(area);area.select();const copied=document.execCommand("copy");area.remove();return copied; } };
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  // Every Solvane request goes through the extension's service worker, so provider pages never see Solvane data.
  // Tabs opened before an extension update lose that connection; they get a reload message, not a direct fetch.
  async function apiRequest(url, init) {
    const reload = "Solvane's extension was updated or restarted. Reload this tab, then try again.";
    let bridged;
    try {
      bridged = await new Promise((resolve, reject) => chrome.runtime.sendMessage({ type: "solvane-api", url, init }, (response) => { if (chrome.runtime.lastError) reject(chrome.runtime.lastError); else resolve(response); }));
    } catch { throw new Error(reload); }
    if (!bridged || typeof bridged.body !== "string") throw new Error(reload);
    return { ok: bridged.ok, status: bridged.status, json: async () => JSON.parse(bridged.body || "{}") };
  }

  function parseUpdateBlock(text) {
    const match = [...text.matchAll(/<<<SOLVANE_UPDATE\s+v1\s*([\s\S]*?)\s*SOLVANE_UPDATE>>>/gi)].at(-1);
    if (!match) return null;
    const result = window.SolvaneCore.parseSolvaneUpdateBlock(match[0]);
    return result.ok ? { block: match[0], hash: hash(match[0]) } : null;
  }

  function refreshChatUrl() {
    if (state.chatUrl === location.href) return;
    const previousKey = pageKey(state.chatUrl); const nextKey = pageKey(); const pending = state.pendingBinding;
    state.chatUrl=location.href;state.prefillText="";state.preview=null;state.limitHash=null;state.reminded=false;
    if (pending && previousKey !== nextKey && !isUnscopedPage(nextKey)) {
      state.binding = pending; state.pendingBinding = null;
      void getBindings().then((bindings) => setBindings({ ...bindings, [nextKey]: pending }));
    } else if (previousKey !== nextKey) state.binding = null;
  }

  function latestAssistantText() {
    const nodes = current.assistant.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((node, index, all) => all.indexOf(node) === index);
    nodes.sort((a,b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1); return textOf(nodes.at(-1));
  }

  function nextProvider() {
    const order = state.automation?.providerOrder || ["claude", "gemini", "openai", "perplexity"];
    const index = order.indexOf(current.id);
    const preferred = state.automation?.defaultHandoff;
    if (preferred && preferred !== "last" && preferred !== current.id) return Object.values(config.providers).find((item) => item.id === preferred);
    return Object.values(config.providers).find((item) => item.id === (order[(index + 1 + order.length) % order.length] || "openai")) || Object.values(config.providers).find((item) => item.id !== current.id);
  }

  function pulse(label = "Update ready — Save") {
    const chip = root.querySelector("#sv-chip"); const save = root.querySelector("#sv-save");
    if (!chip || !save) return;
    chip.dataset.pulse = "true"; save.setAttribute("aria-label", label); const text = save.querySelector("span:last-child"); if (text) text.firstChild.textContent = label;
    window.clearTimeout(state.pulseTimer); state.pulseTimer = window.setTimeout(() => { chip.dataset.pulse = "false"; if (text) text.firstChild.textContent = "Save progress"; }, 10_000);
  }

  function showLimitBanner() {
    if (root.querySelector(".sv-limit-banner")) return;
    const target = nextProvider(); if (!target) return;
    const banner = document.createElement("div"); banner.className = "sv-toast sv-limit-banner"; banner.innerHTML = `<span>Limit reached. Save & continue in ${escapeHtml(target.name)}?</span><button class="sv-limit-save">Save</button><button class="sv-report">Report this page</button><button class="sv-dismiss" aria-label="Dismiss">×</button>`; root.appendChild(banner);
    banner.querySelector(".sv-dismiss").addEventListener("click", () => banner.remove());
    banner.querySelector(".sv-report").addEventListener("click", async () => { const diagnostic = `Solvane page diagnostic\nprovider=${current.id}\nselector_version=${config.version}\nhost=${location.hostname}\ntime=${new Date().toISOString()}\ncontent_excluded=true`; try { await navigator.clipboard.writeText(diagnostic); } catch {} banner.querySelector("span").textContent = "Safe diagnostic copied. No chat content was included."; });
    banner.querySelector(".sv-limit-save").addEventListener("click", () => { banner.remove(); void openDrawer(target.id, visibleConversation().text); });
  }

  async function saveAutomationSettings() {
    const stored = await getStorage(chrome.storage.sync, "solvaneAutomationSettings"); state.automation = { ...DEFAULT_AUTOMATION, ...(stored.solvaneAutomationSettings || {}) };
    if (!state.automation.enabledSites.includes(current.id)) state.automation.autoDetect = false;
  }

  async function scanLatestAssistant() {
    refreshChatUrl();
    if (!state.automation?.autoDetect) return;
    if ((current.streaming || []).some((selector) => document.querySelector(selector))) return;
    const first = latestAssistantText(); if (!first) return; await wait(900); if (!state.automation?.autoDetect || (current.streaming || []).some((selector) => document.querySelector(selector))) return; const second = latestAssistantText(); if (!second || first !== second) return;
    const detected = parseUpdateBlock(second); if (detected) { const seen = await getStorage(chrome.storage.local, "solvaneDetectedUpdates"); if (!seen.solvaneDetectedUpdates?.[detected.hash]) { await setStorage(chrome.storage.local, { solvaneDetectedUpdates: { ...(seen.solvaneDetectedUpdates || {}), [detected.hash]: Date.now() } }); state.prefillText = detected.block; pulse("Update ready — Save"); } }
    const limitMatch = current.limit?.some((pattern) => pattern.test(second)); if (limitMatch && hash(second) !== state.limitHash) { state.limitHash = hash(second); showLimitBanner(); }
    updateReminder();
  }

  function updateReminder() {
    if (!state.automation?.reminders || (state.automation.snoozedUntil && state.automation.snoozedUntil > Date.now())) return;
    state.automation.messageCount = document.querySelectorAll(current.messages.join(",")).length;
    if (!state.lastMessageCount) state.lastSavedMessageCount=state.automation.messageCount;
    state.lastMessageCount = state.automation.messageCount;
    if (state.activeMs >= 30 * 60_000 || state.automation.messageCount - state.lastSavedMessageCount >= 15) { if (!state.reminded) { pulse("Checkpoint reminder — Save"); showReminderToast(); } }
  }

  function showReminderToast() {
    if (state.reminded || root.querySelector(".sv-reminder")) return; state.reminded = true; const toast = document.createElement("div"); toast.className = "sv-toast sv-reminder"; toast.innerHTML = `<span>Long session? Save a checkpoint before you switch.</span><button class="sv-remind-save">Save</button><button class="sv-remind-snooze">Snooze</button>`; root.appendChild(toast); toast.querySelector(".sv-remind-save").addEventListener("click", () => { toast.remove(); void openDrawer(); }); toast.querySelector(".sv-remind-snooze").addEventListener("click", async () => { const stored = await getStorage(chrome.storage.sync, "solvaneAutomationSettings"); await setStorage(chrome.storage.sync, { solvaneAutomationSettings: { ...(stored.solvaneAutomationSettings || {}), snoozedUntil: Date.now() + 30 * 60_000 } }); toast.remove(); });
  }

  async function configureAutomation() {
    await saveAutomationSettings();
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    if (state.scanTimer) window.clearTimeout(state.scanTimer);
    window.clearInterval(state.reminderTimer);
    state.activeTick = Date.now();
    if (state.automation.reminders) state.reminderTimer=window.setInterval(()=>{const now=Date.now();if(document.visibilityState==="visible"&&document.hasFocus())state.activeMs+=Math.min(30000,now-state.activeTick);state.activeTick=now;if(state.activeMs>=1800000&&!state.reminded&&!(state.automation.snoozedUntil>now)){pulse("Checkpoint reminder — Save");showReminderToast();}},30000);
    if (!state.automation.autoDetect) return;
    const schedule = () => { window.clearTimeout(state.scanTimer); state.scanTimer = window.setTimeout(() => void scanLatestAssistant(), 900); };
    state.observer = new MutationObserver(schedule); state.observer.observe(document.body, { childList: true, subtree: true, characterData: true }); schedule();
  }

  const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  // Captures hold chat text, so they expire after a week even if never saved. Older entries start their clock now.
  async function loadQueue() {
    const stored = await getStorage(chrome.storage.local, "solvaneRetryQueue"); const queue = stored.solvaneRetryQueue || []; const now = Date.now();
    const kept = queue.map((item) => (item.createdAt ? item : { ...item, createdAt: now })).filter((item) => now - item.createdAt < QUEUE_TTL_MS);
    if (kept.length !== queue.length || kept.some((item, index) => item !== queue[index])) await setStorage(chrome.storage.local, { solvaneRetryQueue: kept });
    return kept;
  }

  async function queueCapture(text, target = null) {
    const redacted = redact(text); const queue = await loadQueue(); const key = hash(redacted.text);
    const existing = queue.find((item) => item.hash === key && item.folderId === state.binding);
    const item = existing || { id: crypto.randomUUID(), folderId: state.binding, text: redacted.text, hash: key, target, attempts: 0, nextAttemptAt: Date.now(), createdAt: Date.now(), ready: false };
    if (!existing) await setStorage(chrome.storage.local, {solvaneRetryQueue:[...queue,item]});
    state.activeQueueId = item.id; state.queued = queue.length + (existing ? 0 : 1); return item;
  }

  async function clearQueuedCapture(text) {
    const stored = await getStorage(chrome.storage.local, "solvaneRetryQueue");
    await setStorage(chrome.storage.local, {solvaneRetryQueue:(stored.solvaneRetryQueue || []).filter((item) => item.folderId !== state.binding || item.hash !== hash(text))});
  }

  async function showQueuedCaptures() {
    if (!state.drawer) return;
    const queue=await loadQueue();
    if (!queue.length) return;
    const list=document.createElement("details");list.innerHTML=`<summary>${queue.length} saved capture(s) waiting for review</summary>`;
    for(const item of queue){const project=state.projects.find((entry)=>entry.id===item.folderId);const button=document.createElement("button");button.className="sv-secondary";button.textContent=`Review capture for ${project?.name || "another project"}`;button.onclick=()=>{state.drawer.querySelector("#sv-state").value=item.text;state.preview=null;state.drawer.querySelector("#sv-commit").disabled=true;state.drawer.querySelector("#sv-project").value=item.folderId;const link=state.drawer.querySelector("#sv-link");link.disabled=false;link.textContent="Confirm queued capture's project";};list.appendChild(button);const discard=document.createElement("button");discard.className="sv-secondary";discard.textContent="Discard local capture";discard.onclick=async()=>{if(!window.confirm("Delete this queued capture from this device?"))return;const saved=await getStorage(chrome.storage.local,"solvaneRetryQueue");await setStorage(chrome.storage.local,{solvaneRetryQueue:(saved.solvaneRetryQueue||[]).filter((entry)=>entry.id!==item.id)});button.remove();discard.remove();};list.appendChild(discard);}
    state.drawer.querySelector(".sv-drawer-body").prepend(list);
  }

  async function retryQueuedCaptures() {
    if (state.queueBusy) return; state.queueBusy = true;
    try {
      const queue = await loadQueue();
      state.queued = queue.length;
      // Never discard on a successful preview: only an accepted, durable version (or expiry) removes a capture.
      // The chip pulses only when a retry succeeds, not on every 30-second check.
      for (const item of queue) {
        if (item.ready || item.nextAttemptAt > Date.now()) continue;
        try {
          const response = await apiRequest(state.origin + "/api/checkpoint", {method:"POST",headers:{"content-type":"application/json","x-solvane-extension":"browser-bridge-v2"},body:JSON.stringify({folderId:item.folderId,text:item.text,mode:"preview"})});
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Retry failed");
          item.ready = true; item.preview = data; if(item.folderId===state.binding) state.prefillText = item.text;
          pulse("Queued update ready — Save");
        } catch { item.attempts++; item.nextAttemptAt = Date.now() + Math.min(900000, 2 ** Math.min(9,item.attempts) * 1000); }
        const latest = await getStorage(chrome.storage.local,"solvaneRetryQueue");
        await setStorage(chrome.storage.local,{solvaneRetryQueue:(latest.solvaneRetryQueue || []).map((entry) => entry.id === item.id ? item : entry)});
      }
    } finally {state.queueBusy = false;}
  }

  const host = document.createElement("div");
  host.id = "solvane-bridge-root";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  state.root = root;
  root.innerHTML = `
    <style>
      :host{all:initial}*{box-sizing:border-box}button,textarea,select{font:inherit}button:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid rgba(44,198,160,.28);outline-offset:2px}
      .sv-chip{position:fixed;z-index:2147483646;right:18px;bottom:18px;height:52px;display:flex;align-items:stretch;border:1px solid #2a3631;border-radius:18px;background:#17201d;color:#fff;box-shadow:0 18px 45px rgba(15,24,20,.28);font:700 12px/1.2 "Manrope","SF Pro Display",Inter,system-ui,sans-serif;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease}.sv-chip:hover{transform:translateY(-2px);box-shadow:0 22px 52px rgba(15,24,20,.34)}
      .sv-save,.sv-menu{border:0;background:transparent;color:inherit;cursor:pointer}.sv-save{padding:0 14px 0 9px;display:flex;align-items:center;gap:9px;text-align:left}.sv-menu{width:36px;border-left:1px solid #33413b;font-size:15px}.sv-save:hover,.sv-menu:hover{background:#23302b}
      .sv-mark{width:33px;height:33px;display:grid;place-items:center;flex:0 0 auto;border-radius:11px;background:linear-gradient(145deg,#45d8b4,#1db18b);color:#fff;font-size:15px;box-shadow:0 8px 18px rgba(29,177,139,.24)}.sv-fresh{display:block;margin-top:2px;color:#91a29a;font-size:9px;font-weight:600;white-space:nowrap}
      .sv-chip[data-fresh="old"]{border-color:#665c35;background:#29271e}.sv-chip[data-fresh="old"] .sv-fresh{color:#d3bd6a}.sv-chip[data-fresh="none"] .sv-fresh{color:#8d9a94}
      .sv-chip[data-pulse="true"]{animation:svPulse 1.4s ease-in-out 3}@keyframes svPulse{50%{box-shadow:0 0 0 7px rgba(44,198,160,.20),0 18px 45px rgba(15,24,20,.28)}}
      .sv-menu-list{position:fixed;z-index:2147483647;right:18px;bottom:78px;width:230px;padding:7px;border:1px solid #dce3de;border-radius:17px;background:#fff;color:#17201d;box-shadow:0 22px 62px rgba(21,34,29,.22);font:12px "Manrope","SF Pro Display",Inter,system-ui,sans-serif}.sv-menu-list button{width:100%;padding:11px;border:0;border-radius:11px;background:transparent;color:#25332e;text-align:left;cursor:pointer}.sv-menu-list button:hover{background:#eaf7f3;color:#137b64}
      .sv-drawer{position:fixed;z-index:2147483647;top:14px;right:14px;bottom:14px;width:min(460px,calc(100vw - 28px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #dce3de;border-radius:26px;background:#f7f9f7;color:#17201d;box-shadow:0 32px 100px rgba(20,34,29,.28);font:13px/1.5 "Manrope","SF Pro Display",Inter,system-ui,sans-serif}.sv-drawer-head{padding:18px;display:flex;align-items:flex-start;gap:11px;border-bottom:1px solid #e1e7e3;background:#fff}.sv-drawer-head>div{flex:1}.sv-drawer-head strong,.sv-drawer-head small{display:block}.sv-drawer-head strong{font-size:16px;letter-spacing:-.02em}.sv-drawer-head small{margin-top:3px;color:#7f8b85;font-size:10px}.sv-close{width:34px;height:34px;border:1px solid #dce3de;border-radius:11px;background:#f1f4f2;color:#53615b;cursor:pointer}.sv-close:hover{color:#17201d;background:#e6ebe8}.sv-drawer-body{flex:1;overflow:auto;padding:16px}.sv-label{display:block;margin:14px 0 7px;color:#75827c;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.sv-select,.sv-textarea{width:100%;border:1px solid #d7dfda;border-radius:13px;background:#fff;color:#1a2722;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}.sv-select{height:43px;padding:0 11px}.sv-textarea{min-height:180px;padding:12px;resize:vertical;font-size:12px;line-height:1.6}.sv-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sv-primary,.sv-secondary{min-height:43px;padding:0 13px;border-radius:12px;cursor:pointer;font-weight:800;transition:transform .16s ease,background .16s ease}.sv-primary{border:1px solid #20ad88;background:linear-gradient(145deg,#3bd2ac,#1fb58f);color:#fff;box-shadow:0 9px 20px rgba(27,168,132,.17)}.sv-secondary{border:1px solid #d7dfda;background:#fff;color:#3b4943}.sv-primary:hover,.sv-secondary:hover{transform:translateY(-1px)}.sv-secondary:hover{border-color:#97d7c5;background:#edf8f4}.sv-primary:disabled,.sv-secondary:disabled{opacity:.45;cursor:not-allowed;transform:none}.sv-notice{margin:10px 0;padding:11px;border:1px solid #cce7dd;border-radius:13px;background:#eaf7f3;color:#356a5b;font-size:10px}.sv-error{margin:10px 0;padding:11px;border:1px solid #edc5be;border-radius:13px;background:#fff0ed;color:#9a4336;font-size:11px}.sv-success{margin:10px 0;padding:11px;border:1px solid #c7e8dc;border-radius:13px;background:#e9f8f3;color:#256b58;font-size:11px}.sv-help{color:#84908a;font-size:10px}.sv-review{margin-top:15px;border-top:1px solid #dfe5e1;padding-top:14px}.sv-review h3{margin:0 0 9px;font-size:14px}.sv-review details{padding:10px;border:1px solid #dde4df;border-radius:13px;background:#fff}.sv-review pre{color:#33413b;background:#f2f5f3;border-radius:9px;padding:9px}.sv-review-item{display:flex;gap:9px;align-items:flex-start;margin-top:8px;padding:11px;border:1px solid #dce3de;border-radius:13px;background:#fff}.sv-review-item>div:first-child{flex:1;min-width:0}.sv-review-item small{display:block;color:#84908a;font-size:9px}.sv-review-item p{margin:4px 0;color:#26332e;font-size:11px}.sv-review-controls{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.sv-review-controls button{padding:6px 8px;border:1px solid #d4ddd7;border-radius:8px;background:#f5f7f5;color:#52605a;font-size:9px;cursor:pointer}.sv-review-controls .selected{background:#daf5ec;color:#116a55;border-color:#69cdb3}.sv-review-controls .reject.selected{background:#fff0ed;color:#a54b3d;border-color:#e8b5ac}.sv-foot{padding:13px 16px 16px;border-top:1px solid #dfe5e1;background:#fff}.sv-foot .sv-row{grid-template-columns:1fr}.sv-toast{position:fixed;z-index:2147483647;left:50%;bottom:20px;width:min(560px,calc(100vw - 24px));padding:12px 13px;display:flex;align-items:center;gap:9px;transform:translateX(-50%);border:1px solid #2b3732;border-radius:17px;background:#17201d;color:#fff;box-shadow:0 20px 60px rgba(15,24,20,.34);font:600 11px/1.4 "Manrope","SF Pro Display",Inter,system-ui,sans-serif}.sv-toast span{flex:1}.sv-toast button{height:35px;padding:0 12px;border:0;border-radius:10px;background:#2cc6a0;color:#fff;font-weight:800;cursor:pointer}.sv-toast .sv-dismiss{width:31px;padding:0;background:#2b3832;color:#fff}
      @media(max-width:600px){.sv-chip{right:12px;bottom:12px;height:50px}.sv-drawer{top:8px;right:8px;bottom:8px;width:calc(100vw - 16px);border-radius:22px}.sv-menu-list{right:12px;bottom:70px}.sv-review-item{display:block}.sv-review-controls{margin-top:9px;justify-content:flex-start}}
    </style>
    <div class="sv-chip" id="sv-chip" data-fresh="none"><button class="sv-save" id="sv-save"><span class="sv-mark">✦</span><span>Save progress<small class="sv-fresh" id="sv-fresh">Not saved yet</small></span></button><button class="sv-menu" id="sv-menu" aria-label="Save and continue">⌄</button></div>
  `;

  function setMessage(type, message) {
    const existing = state.drawer?.querySelector(".sv-error,.sv-success"); if (existing) existing.remove(); if (!state.drawer) return;
    const element = document.createElement("div"); element.className = type === "error" ? "sv-error" : "sv-success"; element.textContent = message; state.drawer.querySelector(".sv-drawer-body").prepend(element);
  }

  function visibleConversation() {
    const selected = window.getSelection()?.toString().trim(); if (selected) return redact(selected.slice(-MAX_CAPTURE_CHARS));
    const nodes = current.messages.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((node, index, all) => all.indexOf(node) === index);
    nodes.sort((a,b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const messages = nodes.filter((node) => node.getClientRects().length).slice(-MAX_MESSAGES).map((node) => textOf(node)).filter(Boolean); const text = messages.join("\n\n").slice(-MAX_CAPTURE_CHARS); return redact(text);
  }

  function renderProjects() {
    if (!state.drawer) return; const select = state.drawer.querySelector("#sv-project"); const link = state.drawer.querySelector("#sv-link"); if (!select) return;
    select.innerHTML = `<option value="">Choose a Solvane project…</option>${state.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("")}`;
    if (state.binding) { select.value = state.binding; link.textContent = "Page linked"; link.disabled = true; select.onchange = () => { state.preview = null; state.drawer.querySelector("#sv-commit").disabled = true; link.textContent = "Confirm new project"; link.disabled = false; }; } else { link.textContent = state.projects.length ? "Link this page" : "Sign in to choose a project"; link.disabled = !state.projects.length; }
  }

  async function loadBindingAndProjects() {
    const bindings = await getBindings();
    if (isUnscopedPage()) {
      if (bindings[pageKey()]) { const next = { ...bindings }; delete next[pageKey()]; await setBindings(next); }
      state.binding = state.pendingBinding;
    } else state.binding = bindings[pageKey()] || null;
    try { const response = await apiRequest(`${state.origin}/api/bootstrap`, { headers: { "x-solvane-extension": "browser-bridge-v2" } }); if (response.ok) { const data = await response.json(); state.projects = data.folders || []; } else if (response.status === 401) throw new Error("Sign in to Solvane first, then return to this page."); else throw new Error("Solvane could not load your projects."); }
    catch (error) { state.projects = []; if (state.drawer) setMessage("error", error instanceof Error ? error.message : "Could not load Solvane projects. Use Paste text instead."); }
    if (state.binding && !state.projects.some((project)=>project.id===state.binding)) state.binding = null;
    if (state.binding) state.automation.providerOrder = state.projects.find((project)=>project.id===state.binding)?.providerOrder || state.automation.providerOrder;
    renderProjects();
  }

  async function linkProject() {
    const selected = state.drawer?.querySelector("#sv-project")?.value; if (!selected) { setMessage("error", "Choose a project before linking this chat page."); return; }
    if (isUnscopedPage()) state.pendingBinding = selected;
    else await setBindings({ ...(await getBindings()), [pageKey()]: selected });
    state.binding = selected; state.automation.providerOrder = state.projects.find((project)=>project.id===selected)?.providerOrder || state.automation.providerOrder; renderProjects(); setMessage("success", isUnscopedPage() ? "Linked for this new chat. Solvane will remember the project after the chat gets its own URL." : "This chat page is linked to the selected project.");
  }

  function renderReview() {
    const review = state.drawer?.querySelector("#sv-review"); if (!review || !state.preview) return; const diff = state.preview.diff || [];
    let proposed="";try { proposed=buildCapsule({state:window.SolvaneCore.fitCapsuleBudget(window.SolvaneCore.applyCheckpointPatch(state.preview.current,state.preview.patch,state.accepts,state.preview.pinnedFields,state.editedItems),state.preview.pinnedFields,state.automation?.tokenBudget||1500)}); }catch(error){proposed=error.message;}
    const groups = ["added", "changed", "removed"].map((kind) => ({ kind, items: diff.filter((item) => item.kind === kind) })).filter((group) => group.items.length);
    review.innerHTML = `<h3>${state.preview.source === "update_block" ? "Update block validated locally" : "Gemini drafted a patch"}</h3><details ${state.automation?.alwaysShowWhatWillBeSent !== false ? "open" : ""}><summary>Exactly what will be sent</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:180px;overflow:auto">${escapeHtml(proposed)}</pre></details><p class="sv-help">${state.preview.redactedCount ? `${state.preview.redactedCount} secret-like value(s) were redacted locally. ` : "No secrets detected. "}${state.preview.tokenEstimate || 0} estimated tokens.</p>${groups.length ? groups.map((group) => `<p class="sv-label">${group.kind[0].toUpperCase() + group.kind.slice(1)}</p>${group.items.map((item) => `<article class="sv-review-item"><div><small>${escapeHtml(item.field)}</small><p>${escapeHtml(state.editedItems[item.key] || item.text)}${item.pinned ? (item.kind === "removed" ? " · Pinned by you — accepting removes it" : " · Pinned by you — accepting replaces it") : ""}</p>${item.sourceExcerpt ? `<small>Source: ${escapeHtml(item.sourceExcerpt)}</small>` : ""}${item.kind === "changed" ? `<small>${escapeHtml(item.from || "")} → ${escapeHtml(item.to || "")}</small>` : ""}</div><div class="sv-review-controls">${item.kind !== "removed" ? `<button data-edit="${escapeHtml(item.key)}">Edit & pin</button>` : ""}<button data-accept="${escapeHtml(item.key)}" class="${state.accepts.has(item.key) ? "selected" : ""}">Accept</button><button data-reject="${escapeHtml(item.key)}" class="reject ${state.rejects.has(item.key) ? "selected" : ""}">Reject</button></div></article>`).join("")}`).join("") : `<p class="sv-help">No changes were found. Add more context or edit the capsule in Solvane.</p>`}<button class="sv-secondary" id="sv-accept-additions" ${diff.some((item) => item.kind === "added") ? "" : "disabled"}>Accept all additions</button>`;
    review.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => { const item = diff.find((row) => row.key === button.dataset.edit); const value = window.prompt("Edit this fact. Your accepted edit will be pinned.", state.editedItems[item.key] || item.to || item.text); if (value?.trim()) {state.editedItems[item.key]=value.trim();state.accepts.add(item.key);renderReview();} }));
    review.querySelectorAll("[data-accept]").forEach((button) => button.addEventListener("click", () => { state.accepts.add(button.dataset.accept); state.rejects.delete(button.dataset.accept); renderReview(); })); review.querySelectorAll("[data-reject]").forEach((button) => button.addEventListener("click", () => { state.accepts.delete(button.dataset.reject); state.rejects.add(button.dataset.reject); renderReview(); })); review.querySelector("#sv-accept-additions")?.addEventListener("click", () => { diff.filter((item) => item.kind === "added").forEach((item) => { state.accepts.add(item.key); state.rejects.delete(item.key); }); renderReview(); });
  }

  // Same builder as the dashboard, so both routes send identical text with the dashboard's privacy choices.
  function buildCapsule(snapshot) {
    const projectName = state.projects.find((project) => project.id === state.binding)?.name;
    return window.SolvaneCore.buildCapsulePrompt({ projectName, state: snapshot?.state || snapshot, privacy: state.automation?.privacy });
  }

  async function handoff(target, snapshot, openedWindow = null) {
    const provider = Object.values(config.providers).find((item) => item.id === target) || Object.values(config.providers)[0]; const capsule = buildCapsule(snapshot);
    await setStorage(chrome.storage.local, { solvaneLastProvider:provider.id, solvanePending: { target: provider.id, capsule, createdAt: Date.now(), source: current.name } }); const copied = await copyCapsule(capsule); if (openedWindow && !openedWindow.closed) openedWindow.location.href = provider.url; else window.open(provider.url, "_blank", "noopener,noreferrer"); closeDrawer(); if (!copied) { const notice=document.createElement("div"); notice.className="sv-toast";notice.innerHTML='<span>Clipboard blocked. Select and copy the reviewed capsule below, then paste in the target model.</span><textarea aria-label="Capsule to copy"></textarea><button>Close</button>';notice.querySelector("textarea").value=capsule;notice.querySelector("button").onclick=()=>notice.remove();root.appendChild(notice); }
  }

  async function previewCheckpoint() {
    if (state.drawer?.querySelector("#sv-project").value !== state.binding) { setMessage("error","Confirm this page’s project before saving."); return; }
    const textArea = state.drawer?.querySelector("#sv-state"); const text = textArea?.value.trim() || ""; if (!text) { setMessage("error", "I couldn't read useful visible messages. Paste the recent exchange here instead."); return; } if (!state.binding) { setMessage("error", "Link this chat page to a Solvane project before saving, so nothing goes to the wrong project."); return; }
    const redacted = redact(text); state.sourceText = redacted.text; const queuedCapture = await queueCapture(redacted.text, state.continueTarget); const button = state.drawer.querySelector("#sv-preview"); button.disabled = true; button.textContent = "Reading with Solvane…";
    try { let response; try { response = queuedCapture.preview ? {ok:true,json:async()=>queuedCapture.preview} : await apiRequest(`${state.origin}/api/checkpoint`, { method: "POST", headers: { "content-type": "application/json", "x-solvane-extension": "browser-bridge-v2" }, body: JSON.stringify({ folderId: state.binding, text: redacted.text, mode: "preview" }) }); } catch (error) { throw new Error(error instanceof Error ? error.message : "Solvane could not be reached. Keep this drawer open and try again, or copy the text into the dashboard."); } const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || (response.status === 401 ? "Sign in to Solvane in another tab, then try again." : "Solvane could not read this checkpoint.")); const queueStore = await getStorage(chrome.storage.local,"solvaneRetryQueue"); await setStorage(chrome.storage.local,{solvaneRetryQueue:(queueStore.solvaneRetryQueue || []).map((entry)=>entry.id===queuedCapture.id ? {...entry,ready:true,preview:data}:entry)}); state.preview = {...data, redactedCount:(data.redactedCount||0)+redacted.count}; state.editedItems = {}; state.accepts = new Set((data.diff || []).filter((item) => item.autoApplicable).map((item) => item.key)); state.rejects = new Set(); state.drawer.querySelector("#sv-review").hidden = false; renderReview(); state.drawer.querySelector("#sv-commit").disabled = !(data.diff || []).length; setMessage("success", data.source === "update_block" ? "Valid update block found. Gemini was not called." : "Gemini prepared a reviewable patch."); } catch (error) { const message = error instanceof Error ? error.message : "Could not prepare the checkpoint."; setMessage("error", `${message} Your capture is kept locally and will retry.`); void queueCapture(redacted.text, state.continueTarget); }
    button.disabled = false; button.textContent = "Review update";
  }

  async function commitCheckpoint() {
    state.reminded = false;
    if (!state.preview || !state.binding) return; const button = state.drawer.querySelector("#sv-commit"); button.disabled = true; button.textContent = "Saving…";
    try { const response = await apiRequest(`${state.origin}/api/checkpoint`, { method: "POST", headers: { "content-type": "application/json", "x-solvane-extension": "browser-bridge-v2" }, body: JSON.stringify({ folderId: state.binding, text: state.sourceText, mode: "commit", patch: state.preview.patch, acceptedKeys: [...state.accepts], checkpointHash: state.preview.checkpointHash, baseVersion: state.preview.baseVersion, editedItems: state.editedItems, tokenBudget: state.automation?.tokenBudget || 1500 }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { if(response.status===409) {const saved=await getStorage(chrome.storage.local,"solvaneRetryQueue");await setStorage(chrome.storage.local,{solvaneRetryQueue:(saved.solvaneRetryQueue||[]).map((entry)=>entry.id===state.activeQueueId?{...entry,ready:false,preview:null,nextAttemptAt:Date.now()}:entry)});state.preview=null;} throw new Error(data.error || "Solvane could not save this version. Run the review again."); } const savedAt = Date.now(); await clearQueuedCapture(state.sourceText); state.lastSavedMessageCount = state.lastMessageCount; state.activeMs=0; state.automation.startedAt = savedAt; const last = await getStorage(chrome.storage.local, "solvaneLastSaved"); await setStorage(chrome.storage.local, { solvaneLastSaved: { ...(last.solvaneLastSaved || {}), [pageKey()]: savedAt } }); updateFreshness(savedAt); setMessage("success", data.unchanged ? `Nothing new to save — still v${data.snapshot?.version ?? 0}. Your approved state is ready to continue.` : `Saved (v${data.snapshot?.version || "new"}). Your approved state is ready to continue.`); state.drawer.querySelector("#sv-commit").textContent = data.unchanged ? `No changes (v${data.snapshot?.version ?? 0})` : `Saved (v${data.snapshot?.version || "new"})`; state.drawer.querySelector("#sv-commit").disabled = true; state.drawer.querySelector("#sv-continue").disabled = false; state.drawer.querySelector("#sv-continue").onclick = () => { const openedWindow = window.open("about:blank", "_blank"); void handoff(state.drawer.querySelector("#sv-target").value, data.snapshot, openedWindow); }; const undo = state.drawer.querySelector("#sv-undo"); if (undo && !data.idempotent && typeof data.previousVersion === "number") { undo.hidden = false; undo.onclick = async () => { undo.disabled = true; try { const undoResponse = await apiRequest(`${state.origin}/api/snapshots`, { method: "POST", headers: { "content-type": "application/json", "x-solvane-extension": "browser-bridge-v2" }, body: JSON.stringify({ folderId: state.binding, restoreVersion: data.previousVersion }) }); const undoData = await undoResponse.json().catch(() => ({})); if (!undoResponse.ok) throw new Error(undoData.error || "Undo could not create a new version."); undo.hidden = true; setMessage("success", `Undo saved as v${undoData.snapshot?.version || "new"}.`); } catch (error) { undo.disabled = false; setMessage("error", error instanceof Error ? error.message : "Undo could not be completed."); } }; window.setTimeout(() => { undo.hidden = true; }, 10_000); } } catch (error) { setMessage("error", error instanceof Error ? error.message : "Could not save this version."); button.disabled = false; button.textContent = "Approve project memory"; }
  }

  function updateFreshness(value) { const fresh = root.querySelector("#sv-fresh"); const chip = root.querySelector("#sv-chip"); if (!value) { fresh.textContent = "Not saved yet"; chip.dataset.fresh = "none"; return; } const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000)); fresh.textContent = minutes < 1 ? "Saved just now" : minutes < 60 ? `Saved ${minutes} min ago` : `${Math.floor(minutes / 60)}h since save`; chip.dataset.fresh = minutes > 30 ? "old" : "fresh"; }

  async function openDrawer(continueTarget = null, prefill = null) {
    refreshChatUrl();
    state.continueTarget = continueTarget;
    if (state.drawer) { closeDrawer(); } const drawer = document.createElement("aside"); drawer.className = "sv-drawer"; state.drawer = drawer;
    drawer.innerHTML = `<header class="sv-drawer-head"><span class="sv-mark">✦</span><div><strong>Save project progress</strong><small>Review the useful state before it becomes project memory.</small></div><button class="sv-close" aria-label="Close">×</button></header><div class="sv-drawer-body"><div class="sv-notice" id="sv-first-notice">Solvane reads only when you click Save progress or press Alt+S. Common secrets are removed on this device. If there is no valid update block, the redacted text is sent to Solvane and Google Gemini.</div><label class="sv-label" for="sv-project">This chat belongs to</label><select class="sv-select" id="sv-project"></select><button class="sv-secondary" id="sv-link" style="margin-top:7px">Link this chat to project</button><label class="sv-label" for="sv-state">Latest visible work</label><textarea class="sv-textarea" id="sv-state" placeholder="If the chat could not be read, paste the latest exchange here."></textarea><p class="sv-help">Up to ${MAX_MESSAGES} recent visible messages. Nothing is committed until you approve the review.</p><div class="sv-row" style="margin-top:10px"><button class="sv-primary" id="sv-preview">Review update</button><button class="sv-secondary" id="sv-paste">Paste instead</button></div><section class="sv-review" id="sv-review" hidden></section></div><footer class="sv-foot"><label class="sv-label" for="sv-target">Continue after saving</label><select class="sv-select" id="sv-target">${Object.values(config.providers).filter((item) => item.id !== current.id).map((item) => `<option value="${item.id}">${item.name}</option>`).join("")}</select><div class="sv-row" style="margin-top:8px"><button class="sv-secondary" id="sv-dashboard">Open Solvane</button><button class="sv-primary" id="sv-commit">Approve project memory</button></div><button class="sv-secondary" id="sv-undo" style="width:100%;margin-top:8px" hidden>Undo for 10 seconds</button><button class="sv-primary" id="sv-continue" style="width:100%;margin-top:8px" disabled>Continue in selected AI</button></footer>`;
    root.appendChild(drawer); drawer.querySelector(".sv-close").addEventListener("click", closeDrawer); drawer.querySelector("#sv-state").value = prefill || state.prefillText || visibleConversation().text; state.prefillText = ""; drawer.querySelector("#sv-link").addEventListener("click", () => void linkProject()); drawer.querySelector("#sv-preview").addEventListener("click", () => void previewCheckpoint()); drawer.querySelector("#sv-commit").addEventListener("click", () => void commitCheckpoint()); drawer.querySelector("#sv-paste").addEventListener("click", () => { const area = drawer.querySelector("#sv-state"); area.value = ""; area.focus(); setMessage("success", "Paste the latest exchange or a SOLVANE_UPDATE block here."); }); drawer.querySelector("#sv-dashboard").addEventListener("click", () => window.open(`${state.origin}/`, "_blank", "noopener,noreferrer")); if (continueTarget) drawer.querySelector("#sv-target").value = continueTarget;
    const first = await getStorage(chrome.storage.local, "solvaneFirstNotice"); if (first.solvaneFirstNotice) drawer.querySelector("#sv-first-notice")?.remove(); else await setStorage(chrome.storage.local, { solvaneFirstNotice: true }); await loadBindingAndProjects();
    await showQueuedCaptures();
    drawer.querySelector("#sv-commit").disabled = true;
    drawer.querySelector("#sv-target").value = continueTarget || nextProvider()?.id || "openai";
  }

  function closeDrawer() { state.drawer?.remove(); state.drawer = null; state.preview = null; state.accepts = new Set(); state.rejects = new Set(); }
  function openProviderMenu() { const existing = root.querySelector(".sv-menu-list"); if (existing) { existing.remove(); return; } const menu = document.createElement("div"); menu.className = "sv-menu-list"; menu.innerHTML = Object.values(config.providers).filter((item) => item.id !== current.id).map((item) => `<button data-provider="${item.id}">Save & continue in ${item.name}</button>`).join(""); root.appendChild(menu); menu.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { menu.remove(); void openDrawer(button.dataset.provider); })); }
  // Rich composers (ProseMirror on ChatGPT and Claude, Quill on Gemini) keep line breaks from a paste, so insertion
  // simulates one over the whole composer, then falls back to the browser's insertText command, then to plain text.
  async function insertText(editor, text) {
    editor.focus();
    if (!(editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement)) {
      const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
      // Editors read the new selection on the next task; pasting before that would append instead of replacing.
      await wait(0);
      const data = new DataTransfer(); data.setData("text/plain", text);
      if (!editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })) || document.execCommand("insertText", false, text)) return;
      editor.innerText = text;
    } else { const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), "value")?.set; if (setter) setter.call(editor, text); else editor.value = text; }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })); editor.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function offerPending() { const stored = await getStorage(chrome.storage.local, "solvanePending"); const pending = stored.solvanePending; if (!pending || pending.target !== current.id || Date.now() - pending.createdAt > 30 * 60 * 1000) return; const toast = document.createElement("div"); toast.className = "sv-toast"; toast.innerHTML = `<span>Solvane has a reviewed capsule ready for ${current.name}.</span><button class="sv-insert">Insert capsule</button><button class="sv-dismiss" aria-label="Dismiss">×</button>`; root.appendChild(toast); toast.querySelector(".sv-dismiss").addEventListener("click", () => toast.remove()); toast.querySelector(".sv-insert").addEventListener("click", async () => { const editor = current.composer.map((selector) => document.querySelector(selector)).find(Boolean); if (!editor) { try { await navigator.clipboard.writeText(pending.capsule); } catch {} toast.querySelector("span").textContent = "Composer not found yet. Capsule copied—click the prompt box and paste."; return; } await insertText(editor, pending.capsule); await removeStorage(chrome.storage.local, "solvanePending"); toast.remove(); }); }

  root.querySelector("#sv-save").addEventListener("click", () => void openDrawer()); root.querySelector("#sv-menu").addEventListener("click", openProviderMenu); window.addEventListener("keydown", (event) => { /* event.code is the physical key: on a Mac, Option+S reports event.key as "ß". */ if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyS" && !event.defaultPrevented) { event.preventDefault(); void openDrawer(); } }); window.addEventListener("online", () => void retryQueuedCaptures()); getStorage(chrome.storage.local, "solvaneLastSaved").then((stored) => updateFreshness(stored.solvaneLastSaved?.[pageKey()])); window.setInterval(() => { getStorage(chrome.storage.local, "solvaneLastSaved").then((stored) => updateFreshness(stored.solvaneLastSaved?.[pageKey()])); void retryQueuedCaptures(); }, 30_000); window.setTimeout(offerPending, 1200); window.setTimeout(()=>void retryQueuedCaptures(),2000); void configureAutomation(); chrome.storage.onChanged?.addListener((changes, area) => { if (area === "sync" && changes.solvaneAutomationSettings) void configureAutomation(); });
})();
