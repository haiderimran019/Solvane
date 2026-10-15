# Solvane Browser Bridge

This Manifest V3 extension provides the free, account-based Solvane handoff path. Version 0.4.1 focuses the first real workflow on Claude → reviewed project memory → ChatGPT, while preserving the other provider routes.

## Install for MVP testing

1. Download and unzip `solvane-extension.zip`.
2. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open Claude, Gemini, ChatGPT, or Perplexity while signed in.

The floating **Save progress** chip is collapsed by default. Click it (or press `Alt+S`, `Option+S` on a Mac) to read the last 20 visible messages, locally redact common secrets, and open a side drawer. Pick the Solvane project for this chat (an unlinked chat starts on the project you used last, with a visible note), then Review update links the chat to the selected project and shows "Saving to …" above the added/changed/removed diff. Approve it to save. On a provider's generic new-chat page, that choice is temporary and is migrated only after the provider assigns the conversation its own URL; Solvane never reuses one blank-page binding for unrelated chats. A valid `SOLVANE_UPDATE v1` block is validated with the shared parser and skips Gemini; ordinary text is processed by the authenticated Solvane `/api/checkpoint` endpoint, which may use the configured server-side Gemini key.

Review decisions are neutral until the user chooses. Accept and Reject are mutually exclusive, accepted additions may start selected, and a rejected item is never sent as an accepted key.

Pins protect text a person wrote (an Edit & pin, or a manual capsule edit in the dashboard) from automatic changes. A pinned item is never pre-selected in the review; accepting a change to it is an explicit override and is applied. Undo restores the previous version together with that version's pins, and pins nothing new. Since 0.4.2.

Open the extension's **Options** page to opt in to update-block detection and checkpoint reminders. Auto-detection is off by default. When enabled, it reads only the latest stable assistant message, ignores partial streaming text, deduplicates by hash, and can show a best-effort limit banner. A changed provider page simply produces no banner and leaves manual Save available.

The split arrow offers **Save & continue** for Claude, Gemini, ChatGPT, or Perplexity. It saves only after review, copies the approved capsule, opens the official provider URL, and shows an explicit **Insert capsule** action in the target composer. Insert replaces the composer's draft with the capsule as a simulated paste, so rich editors keep its line breaks; the browser's insert-text command is the fallback. The extension never presses Send. If Solvane auth, a provider selector, or the composer is unavailable, the drawer gives a plain-language paste fallback.

## Security boundary

- No provider API key is required.
- No cookies, passwords, hidden reasoning, or provider account tokens are read.
- With auto-detect off, the extension reads chat messages only after Save/Alt+S. Opting in permits reading only the latest stable assistant message using provider-config.js.
- Common API keys, bearer tokens, and `.env`-style lines are redacted before any network request.
- Chat-to-project links and pending handoffs stay in this browser's local extension storage (links are not synced between Chrome profiles). Pending handoffs expire from the UI after 30 minutes.
- The first drawer notice discloses that ordinary text may be sent to Solvane and Google Gemini for checkpoint processing. A pasted update block stays local to validation until the reviewed patch is sent to Solvane.
- API requests are proxied through the extension service worker so the provider page never receives Solvane response data; the worker does not persist cookies or credentials. There is no direct-from-page fallback, and the Solvane API does not allow requests from provider origins. After an extension update, reload open provider tabs.
- The unpacked source also allows a local Solvane at `http://127.0.0.1:5173` for development. The release ZIP built by `npm run build:extension` contains production origins only.
- Provider DOM changes can break automatic insertion. Clipboard paste remains the supported fallback.

Queued captures remain until an accepted version is committed, including after a successful preview, or until they expire after 7 days. The chip pulses only when a queued capture becomes ready to review. Use the queued-capture recovery controls in the drawer after a failure. Settings from the Solvane dashboard synchronize to this extension on the same device. Build the shared validator and ZIP using `npm run build:extension` from apps/web.

## Gemini setup

The extension does not receive or store a Gemini key. Configure `GEMINI_API_KEY` on the Solvane server (or add a Gemini BYOK connection from API mode). Keep the value in the deployment secret store or a local `.env` file; never put it in this extension or commit it to Git. The server also applies the configured `GEMINI_DAILY_LIMIT` and token budget.

## Supported selectors and fixtures

Provider selectors are versioned in `provider-config.js`. Static fixture pages for the four providers live in `fixtures/` so selector changes can be reviewed without opening a real account. A selector failure is not a crash: on click, the drawer remains available for manual paste.
