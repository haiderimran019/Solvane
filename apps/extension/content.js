(() => {
  if (window.__solvaneBridgeInstalled) return;
  window.__solvaneBridgeInstalled = true;

  const providers = {
    "chatgpt.com": { id: "openai", name: "ChatGPT", url: "https://chatgpt.com/" },
    "claude.ai": { id: "claude", name: "Claude", url: "https://claude.ai/new" },
    "gemini.google.com": { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
    "www.perplexity.ai": { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/" }
  };
  const current = providers[location.hostname];
  if (!current) return;

  const host = document.createElement("div");
  host.id = "solvane-bridge-root";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  root.innerHTML = `
    <style>
      *{box-sizing:border-box}button,textarea,select{font:inherit}
      .sv-btn{position:fixed;z-index:2147483646;right:18px;bottom:18px;height:46px;padding:0 15px;display:flex;align-items:center;gap:8px;border:1px solid #b6df45;border-radius:14px;background:linear-gradient(140deg,#e2ff86,#c8ff32);color:#11130f;box-shadow:0 16px 40px rgba(0,0,0,.28);font:700 12px/1.2 system-ui,sans-serif;cursor:pointer}
      .sv-mark{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:#141711;color:#c8ff32;font-size:13px}
      .sv-panel{position:fixed;z-index:2147483647;right:18px;bottom:74px;width:min(390px,calc(100vw - 24px));overflow:hidden;border:1px solid #373c33;border-radius:20px;background:#151714;color:#fff;box-shadow:0 28px 80px rgba(0,0,0,.48);font-family:system-ui,-apple-system,sans-serif}
      .sv-head{padding:16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2d312a}.sv-head div{flex:1}.sv-head strong,.sv-head span{display:block}.sv-head strong{font-size:14px}.sv-head span{margin-top:3px;color:#858c80;font-size:10px}.sv-close{width:32px;height:32px;border:1px solid #383d34;border-radius:9px;background:#23261f;color:#fff;cursor:pointer}
      .sv-body{padding:14px}.sv-label{display:block;margin-bottom:6px;color:#899082;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.sv-body textarea{width:100%;min-height:148px;padding:11px;resize:vertical;border:1px solid #383d34;border-radius:11px;background:#0f110e;color:#e8ebe5;font-size:11px;line-height:1.5}.sv-row{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.sv-body select,.sv-secondary,.sv-primary{height:40px;padding:0 10px;border-radius:10px}.sv-body select{border:1px solid #3a3f36;background:#22251f;color:#fff;font-size:11px}.sv-primary{border:1px solid #a9d62b;background:#c8ff32;color:#11130f;font-weight:800;cursor:pointer}.sv-secondary{width:100%;margin-top:7px;border:1px solid #3a3f36;background:#22251f;color:#d9ddd4;font-size:11px;cursor:pointer}.sv-note{margin:10px 0 0;color:#737a6f;font-size:9px;line-height:1.5}
      .sv-toast{position:fixed;z-index:2147483647;left:50%;bottom:20px;width:min(520px,calc(100vw - 24px));padding:11px 12px;display:flex;align-items:center;gap:9px;transform:translateX(-50%);border:1px solid #3c4137;border-radius:15px;background:#151714;color:#fff;box-shadow:0 18px 55px rgba(0,0,0,.42);font:600 11px/1.35 system-ui,sans-serif}.sv-toast span{flex:1}.sv-toast button{height:34px;padding:0 12px;border:0;border-radius:9px;background:#c8ff32;color:#11130f;font-weight:800;cursor:pointer}.sv-toast .sv-dismiss{width:30px;padding:0;background:#292d27;color:#fff}
      @media(max-width:600px){.sv-btn{right:12px;bottom:12px}.sv-panel{right:12px;bottom:66px}}
    </style>
    <button class="sv-btn" id="sv-open"><span class="sv-mark">✦</span> Capsule</button>
  `;

  const selectors = {
    openai: ["[data-message-author-role]"],
    claude: ["[data-testid='user-message']", "[data-testid='assistant-message']"],
    gemini: ["user-query", "model-response"],
    perplexity: ["main [class*='prose']"]
  };
  const editors = {
    openai: ["#prompt-textarea", "textarea", "[contenteditable='true']"],
    claude: ["div[contenteditable='true']", "textarea"],
    gemini: [".ql-editor", "[contenteditable='true']", "textarea"],
    perplexity: ["textarea", "[contenteditable='true']"]
  };

  function visibleConversation() {
    const selected = window.getSelection()?.toString().trim();
    if (selected) return selected.slice(0, 12000);
    const matches = selectors[current.id].flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const text = matches.slice(-16).map((node) => node.innerText || node.textContent || "").filter(Boolean).join("\n\n");
    if (text) return text.slice(-12000);
    return (document.querySelector("main")?.innerText || "").slice(-8000);
  }

  function capsuleFrom(text) {
    return `SOLVANE CONTINUITY CAPSULE\n\nSource: visible conversation from ${current.name}\n\nRECENT WORK:\n${text || "No visible conversation was detected. Add the essential state here before continuing."}\n\nNEXT STEP:\nContinue the active task from the latest explicit user request. Preserve settled decisions and constraints. Do not claim access to hidden reasoning or unavailable history.`;
  }

  function closePanel() { root.querySelector(".sv-panel")?.remove(); }
  function openPanel() {
    if (root.querySelector(".sv-panel")) return closePanel();
    const panel = document.createElement("section");
    panel.className = "sv-panel";
    panel.innerHTML = `
      <div class="sv-head"><span class="sv-mark">✦</span><div><strong>Continuity Capsule</strong><span>Review what leaves ${current.name}</span></div><button class="sv-close" aria-label="Close">×</button></div>
      <div class="sv-body"><label class="sv-label" for="sv-state">Visible context</label><textarea id="sv-state"></textarea><div class="sv-row"><select id="sv-target" aria-label="Target model">${Object.values(providers).filter((provider) => provider.id !== current.id).map((provider) => `<option value="${provider.id}">${provider.name}</option>`).join("")}</select><button class="sv-primary">Continue there →</button></div><button class="sv-secondary">Open Solvane dashboard</button><p class="sv-note">Only visible page text or your current selection is captured. Solvane never reads hidden model reasoning and never presses Send for you.</p></div>`;
    root.appendChild(panel);
    panel.querySelector("textarea").value = visibleConversation();
    panel.querySelector(".sv-close").addEventListener("click", closePanel);
    panel.querySelector(".sv-secondary").addEventListener("click", () => window.open("https://solvane.rareyew64.chatgpt.site/", "_blank", "noopener,noreferrer"));
    panel.querySelector(".sv-primary").addEventListener("click", async () => {
      const target = Object.values(providers).find((provider) => provider.id === panel.querySelector("select").value);
      const capsule = capsuleFrom(panel.querySelector("textarea").value.trim());
      await chrome.storage.local.set({ solvanePending: { target: target.id, capsule, createdAt: Date.now() } });
      try { await navigator.clipboard.writeText(capsule); } catch {}
      window.open(target.url, "_blank", "noopener,noreferrer");
      closePanel();
    });
  }

  function insertText(editor, text) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), "value")?.set;
      if (setter) setter.call(editor, text); else editor.value = text;
    } else {
      editor.textContent = text;
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function offerPending() {
    const { solvanePending } = await chrome.storage.local.get("solvanePending");
    if (!solvanePending || solvanePending.target !== current.id || Date.now() - solvanePending.createdAt > 30 * 60 * 1000) return;
    const toast = document.createElement("div");
    toast.className = "sv-toast";
    toast.innerHTML = `<span>Solvane has a Continuity Capsule ready for ${current.name}.</span><button class="sv-insert">Insert capsule</button><button class="sv-dismiss" aria-label="Dismiss">×</button>`;
    root.appendChild(toast);
    toast.querySelector(".sv-dismiss").addEventListener("click", () => toast.remove());
    toast.querySelector(".sv-insert").addEventListener("click", async () => {
      const editor = editors[current.id].map((selector) => document.querySelector(selector)).find(Boolean);
      if (!editor) {
        try { await navigator.clipboard.writeText(solvanePending.capsule); } catch {}
        toast.querySelector("span").textContent = "Composer not found yet. Capsule copied—click the prompt box and paste.";
        return;
      }
      insertText(editor, solvanePending.capsule);
      await chrome.storage.local.remove("solvanePending");
      toast.remove();
    });
  }

  root.getElementById("sv-open").addEventListener("click", openPanel);
  window.setTimeout(offerPending, 1200);
})();
