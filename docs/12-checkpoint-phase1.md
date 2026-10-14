# Phase 1: Paste-based Checkpoint

Phase 1 adds a reviewable checkpoint pipeline inside an existing Solvane project:

`paste → redact → local update-block validation or Gemini extraction → diff → accept/reject → new capsule version → existing handoff`

## What changed

- Added a `Save checkpoint` workspace in the dashboard.
- Added the shared versioned v1 patch schema:

```json
{
  "decisions_add": [],
  "done_add": [],
  "open_questions_add": [],
  "open_questions_resolve": [],
  "constraints_add": [],
  "next_step": "",
  "changes": [{ "field": "", "from": "", "to": "" }]
}
```

- Added `POST /api/checkpoint` with `preview` and `commit` modes.
- Valid `<<<SOLVANE_UPDATE v1 ... SOLVANE_UPDATE>>>` blocks are parsed locally and do not call Gemini.
- Other pastes are redacted and sent to Gemini using a strict JSON-only, untrusted-data prompt. Gemini has a 10-second request deadline and one invalid-output retry.
- Added per-user platform-key daily limits (`GEMINI_DAILY_LIMIT`, default `20`) and BYOK support through the existing API connections.
- Added token-budget configuration (`CHECKPOINT_TOKEN_BUDGET`, default `1,500`).
- Added secret redaction notice, contradiction flags, accept/reject controls, “Accept all additions”, idempotent source hashes, pinned-field protection, and new-version undo.
- Added version preview and restore-as-new-version controls in Activity.
- Existing Trust Preview, provider order, browser handoff dialog, official provider links, clipboard fallback, API mode, export, and extension code were reused and remain unchanged in scope.

## Privacy boundary

Solvane never reads provider cookies, passwords, hidden reasoning, or browser history. A user explicitly pastes the text. Before Gemini processing, common API keys, bearer tokens, GitHub tokens, and env-style secrets are redacted. Only hashes, counts, patch metadata, and the approved capsule are persisted; pasted text is not written to analytics events.

## Configuration

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_DAILY_LIMIT=20
CHECKPOINT_TOKEN_BUDGET=1500
```

The platform Gemini key is used for the free Browser Bridge tier. A user Gemini key configured in API mode is treated as BYOK and is not subject to the platform-key daily counter.

## Manual real-world checklist

1. Open a project and choose **Save checkpoint**.
2. Paste a real Claude/ChatGPT/Gemini exchange and click **Save checkpoint**.
3. Confirm the privacy disclosure appears before processing and that a secret-like value is shown as redacted if included.
4. Confirm the result is grouped as Added / Changed / Removed.
5. Reject one change, accept the additions, and click **Accept & save capsule**.
6. Confirm the toast shows `Saved (vN)` and click **Undo**. Confirm undo creates a later version.
7. Open Activity → Capsule versions. Preview an older version and restore it; confirm restoration creates a new version instead of overwriting history.
8. Save the exact same paste again. Confirm the UI says `Already saved (vN)` and no extra version is created.
9. Click **Continue in** and choose ChatGPT, Claude, Gemini, and Perplexity one at a time. Confirm the existing Trust Preview/handoff dialog opens, the approved capsule is copied, and the official provider site opens in a new tab.
10. In a provider chat, paste the capsule and ask it to continue. At the end, require the provider to output a `SOLVANE_UPDATE v1` block, then paste that block back into Solvane.
11. Repeat with a malformed block, prompt-injection text, a non-English update, and a long paste. Confirm plain-language errors and no invented facts.
12. Switch to API mode and confirm the existing API relay console, provider order, fallback setting, export, and connections panel still work.

## Known limits for this phase

- The Gemini path cannot be verified end-to-end without a configured server-side Gemini key (or a user's Gemini BYOK key) and a signed-in runtime database. The local tests cover the validator, redaction, merge, idempotency boundary, fixtures, and token compression.
- Browser Bridge remains user-initiated. It cannot silently read another provider's private chat or detect every rate-limit page. The user pastes the checkpoint and clicks Continue.
- The split Continue control uses the existing provider-order list and handoff dialog; provider-specific automation still belongs to the extension/API phases.
