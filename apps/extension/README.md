# Solvane Browser Bridge

This Manifest V3 extension provides the free, account-based Solvane handoff path.

## Install for MVP testing

1. Download and unzip `solvane-extension.zip`.
2. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open Claude, Gemini, ChatGPT, or Perplexity while signed in.

The floating **Capsule** button captures only visible conversation text or the text the user explicitly selects. The user reviews the content, chooses another provider, and Solvane stores the pending handoff locally. On the target site, **Insert capsule** places it in the prompt composer. The extension never presses Send.

## Security boundary

- No provider API key is required.
- No cookies, passwords, hidden reasoning, or provider account tokens are read.
- Pending handoffs remain in `chrome.storage.local` and expire from the UI after 30 minutes.
- Provider DOM changes can break automatic insertion. Clipboard paste remains the supported fallback.
