// The service worker keeps Solvane API requests out of the provider page's
// JavaScript world. It does not read or persist cookies; the browser supplies
// the signed-in Solvane session only for the explicit request.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "solvane-api" || typeof message.url !== "string") return false;
  let target;
  try { target = new URL(message.url); } catch { return false; }
  if (!["https://solvane.rareyew64.chatgpt.site", "http://127.0.0.1:5173"].includes(target.origin) || !["/api/bootstrap", "/api/checkpoint", "/api/snapshots", "/api/handoffs", "/api/folders"].includes(target.pathname)) {
    sendResponse({ok:false,status:403,body:JSON.stringify({error:"Unsupported Solvane endpoint."})}); return false;
  }
  fetch(target.href, { ...(message.init || {}), credentials: "include" })
    .then(async (response) => sendResponse({ ok: response.ok, status: response.status, body: await response.text() }))
    .catch((error) => sendResponse({ ok: false, status: 0, body: JSON.stringify({ error: error instanceof Error ? error.message : "network error" }) }));
  return true;
});
