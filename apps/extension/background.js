// The service worker keeps Solvane API requests out of the provider page's
// JavaScript world. It does not read or persist cookies; the browser supplies
// the signed-in Solvane session only for the explicit request.
// Solvane's own origins come from the manifest, so the release zip (built without the local dev origin) allows production only.
const SOLVANE_ORIGINS = chrome.runtime.getManifest().content_scripts
  .find((script) => script.js.includes("app-bridge.js")).matches
  .map((match) => new URL(match.replace("/*", "/")).origin);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "solvane-api" || typeof message.url !== "string") return false;
  let target;
  try { target = new URL(message.url); } catch { return false; }
  if (!SOLVANE_ORIGINS.includes(target.origin) || !["/api/bootstrap", "/api/checkpoint", "/api/snapshots", "/api/handoffs", "/api/folders"].includes(target.pathname)) {
    sendResponse({ok:false,status:403,body:JSON.stringify({error:"Unsupported Solvane endpoint."})}); return false;
  }
  fetch(target.href, { ...(message.init || {}), credentials: "include" })
    .then(async (response) => sendResponse({ ok: response.ok, status: response.status, body: await response.text() }))
    .catch((error) => sendResponse({ ok: false, status: 0, body: JSON.stringify({ error: error instanceof Error ? error.message : "network error" }) }));
  return true;
});
