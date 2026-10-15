// Runs only on Solvane origins declared in the manifest. Never forwards auth or cookies.
window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const value = event.data;
  if (value?.type === "solvane-settings") {
    chrome.storage.sync.set({ solvaneAutomationSettings: value.settings });
  } else if (value?.type === "solvane-handoff" && typeof value.pending?.capsule === "string") {
    chrome.storage.local.set({ solvanePending: value.pending });
  } else if (value?.type === "solvane-revoke") {
    chrome.storage.sync.clear(); chrome.storage.local.clear();
  }
});
window.postMessage({ type: "solvane-extension-ready" }, location.origin);
