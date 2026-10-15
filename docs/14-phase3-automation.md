# Phase 3: automation and reliability

Phase 3 adds opt-in automation around the existing Browser Bridge and API Automation flows. It does not silently send messages or replace the Trust Preview.

## User workflow

1. Install the extension and open a supported Claude, ChatGPT, Gemini, or Perplexity page.
2. Link that chat URL to a Solvane project from the chip drawer. The binding is explicit so a capture cannot silently land in the wrong project.
3. Click **Save**, or press `Alt+S`. Solvane reads only the last visible messages on that user action, redacts common secrets locally, and sends the bounded capture to `/api/checkpoint`.
4. If the paste contains a valid `<<<SOLVANE_UPDATE v1 ... SOLVANE_UPDATE>>>` block, the extension can detect it only when the opt-in setting is enabled and the assistant message is stable. That path skips Gemini and is deduplicated by hash.
5. Review Added / Changed / Removed items. Accept the patch, creating a new capsule version. Undo creates a new version from the prior state rather than deleting history.
6. Choose **Continue in**. Solvane copies the approved capsule, opens the official provider site, and the extension attempts insertion. Clipboard paste is always the fallback. Solvane never presses Send.

## Automation controls

The dashboard Settings view and the extension options page expose:

- Auto-detect update blocks (off by default; when off the extension does not read assistant messages).
- Checkpoint reminders after roughly 30 minutes or 15 messages without a save, with Snooze.
- Enabled provider pages, default handoff provider, token budget, and “always show what will be sent”.
- Copy project instruction, export, and delete-all-data actions.

The extension watches only the latest configured assistant selector after a mutation. It waits for the text to remain unchanged before parsing, ignores partial blocks, and stores a hash so edited or repeated blocks do not create duplicate prompts.

## Limit banner and retry queue

Provider limit patterns are best-effort and live in `apps/extension/provider-config.js`. If a known pattern is seen, a non-blocking banner offers Save & continue to the next provider in the configured order. The Report button copies provider, selector version, hostname, timestamp, and `content_excluded=true`; it never copies chat text.

Network, Gemini, or expired-session failures are stored as redacted captures in extension-local storage. Retries use exponential backoff and hash deduplication. The queue is not synced to the cloud and is removed only after a successful version commit.

## API mode failover

API Automation keeps its existing ordered routing. HTTP 402/429 and server errors are retryable. Each provider failover is written as a privacy-safe event and appears in Activity as `provider A -> provider B`, including the approved capsule version. Browser Bridge and API mode remain separate: Browser Bridge needs no provider key; API mode uses the user’s or workspace’s encrypted keys.

## Gemini and limits

The server reads `GEMINI_API_KEY` (or an encrypted user BYOK key) only in Worker code. Never put it in the extension, browser bundle, or Git. Configure `GEMINI_DAILY_LIMIT`, `GEMINI_DAILY_INPUT_CHARS`, `CHECKPOINT_MAX_INPUT_CHARS`, and `CHECKPOINT_TOKEN_BUDGET` in the deployment environment. The free server-side key has per-user daily and user/IP burst limits plus an atomic conservative daily cost reservation cap; the UI returns a plain-language 429 when a limit is reached.

## What is deliberately not automatic

The MVP cannot safely read arbitrary project folders or provider cookies. Folder adoption now uses an explicit directory input and a locally filtered compact map. OAuth Google/GitHub is not falsely represented as active until real OAuth apps and production callbacks exist. The application enforces user/IP processing limits and a conservative reservation cap before Gemini requests. Provider billing limits remain useful because actual prices depend on the configured model.

## Manual real-world checklist

- Claude: enable Auto-detect, paste the project instruction into Project Instructions, finish a task with a valid update block, wait for the chip pulse, click Save, review, accept, Continue in ChatGPT.
- ChatGPT: click Save on a normal conversation and verify the last visible messages are captured; use Paste text instead if selectors changed.
- Gemini: repeat with a long-context task; confirm a valid block does not call Gemini again and a normal paste uses the configured server key/BYOK.
- Perplexity: trigger a research handoff and confirm the copied capsule contains sources only when they are present in the approved state.
- Simulate offline mode, reload, and verify the chip says `N save queued`, then reconnect and confirm one retry produces one reviewable update.
- Trigger a provider limit message if available; confirm the banner offers the next configured provider and never auto-sends.
- In API mode, connect two keys, force a 429/402 from the first provider, and verify the Activity failover entry and the same approved capsule version.

## Chrome Web Store readiness checklist

- [x] Manifest V3 with narrow host permissions for the four provider sites and Solvane.
- [x] `storage` and `clipboardWrite` only; no broad `*://*/*` permission.
- [x] Single purpose: user-reviewed continuity snapshots and handoff.
- [x] First-run/extension description discloses click capture, optional latest-message detection, local redaction, and Gemini processing.
- [x] Privacy page at /privacy and a GitHub issue support link are included; verify public access when preparing the store listing.
- [ ] Replace development localhost host permission before store submission.
- [ ] Verify provider selectors and insertion behavior against current Chrome and Edge pages.
- [ ] Complete store review screenshots, data-use declaration, and an external security review.
