# Phase 2 — Browser chip

Date: 2026-10-14

Phase 2 adds an assisted browser capture path without changing the Phase 1 checkpoint schema, review rules, API mode, or existing insertion behavior.

## User flow

1. Install `apps/web/public/solvane-extension.zip` in Chrome or Edge.
2. Sign in to Solvane in the same browser profile.
3. Open a supported Claude, ChatGPT, Gemini, or Perplexity page.
4. Click the small green **Save** chip near the bottom-right (or press `Alt+S`). The chip is collapsed until the user acts.
5. The drawer reads up to 20 visible message nodes, caps the capture at 30,000 characters, and redacts common API-key/bearer/`.env` patterns locally.
6. Link the URL to a Solvane project explicitly. A URL binding is stored in `chrome.storage.sync`; a page is never silently assigned to an unknown project.
7. Click **Save checkpoint**. A valid `<<<SOLVANE_UPDATE v1 ... SOLVANE_UPDATE>>>` block is validated by the existing server schema and does not call Gemini. Ordinary text goes through `/api/checkpoint`, which uses the server-side `GEMINI_API_KEY` or the user's encrypted Gemini BYOK key.
8. Review Added / Changed / Removed items. Additions are selected by default; edits and removals require Accept. **Accept & save capsule** creates the next snapshot version.
9. **Undo for 10 seconds** restores the previous state by creating a new snapshot version. **Save & continue** copies the approved capsule, opens the selected official provider, and shows an explicit Insert capsule action. It never presses Send.

## Privacy and auth boundary

- The extension does not read cookies, passwords, provider account tokens, hidden reasoning, or arbitrary files.
- It reads page text only after an explicit click or `Alt+S`, using the versioned selectors in `apps/extension/provider-config.js`.
- The extension never receives a Gemini key. Set `GEMINI_API_KEY` in the Solvane deployment secret store or add a Gemini key through API mode. The server applies `GEMINI_DAILY_LIMIT` and `CHECKPOINT_TOKEN_BUDGET`.
- Cross-origin extension requests are restricted to the four provider origins and include credentials only for the signed-in Solvane session. If the session is missing, the drawer explains how to sign in and keeps the paste fallback available.
- The diagnostic and fallback paths do not send chat content to analytics.

## Selector maintenance

Provider selectors are in one file with a version note. Static fixtures are in `apps/extension/fixtures/`. If a provider changes markup, update that file and rerun the extension contract test; the user can still paste manually when selectors fail.

## Local checks

From `apps/web`:

```bash
npm run test:checkpoint
npm run test:extension
npx tsc --noEmit
npm run lint
npm run build
```

The extension archive is regenerated at `apps/web/public/solvane-extension.zip` after source changes.

## Known verification boundary

The automated checks validate the manifest, selector fixtures, redaction contract, checkpoint tests, TypeScript, lint, and production build. A real four-provider click-through still needs the user's signed-in Chrome/Edge sessions because provider markup, account state, and quota messages are external and change frequently. Use the manual checklist in `docs/11-real-world-test-guide.md` and verify the visible Trust Preview before every real handoff.
