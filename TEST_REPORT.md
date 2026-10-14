# Solvane pilot test report

Date: 14 October 2026. Scope: paste/checkpoint, browser chip, Gemini boundary, review/versioning, handoff, API fallback, and release packaging.

## Passed

| Gate | Actual result |
| --- | --- |
| Checkpoint schema and merge | 20 tests passed, including accepted next-step replacement and cross-field near-duplicate removal |
| Automation helpers | 10 Node test results passed (9 child cases plus parent) |
| Extraction/review/file-map regressions | 6 tests passed; includes 12 extraction transport fixtures |
| Actual API route with simulated provider transport | 2 tests passed: 429 fallback, replay, all providers failing, account isolation, real SQLite quota reservation SQL |
| Extension contract and four provider HTML fixtures | Passed |
| Playwright checkpoint review | 3 tests passed: Added/Changed Accept/Reject clicks, accepted-count transitions, exact accepted-key save, one next-step row, desktop and 390px visual snapshots |
| Isolated HTTP API acceptance | 23 checks passed against Vite + local D1 on port 5175 |
| TypeScript / ESLint / production build | Passed |
| Extension JavaScript syntax / ZIP integrity / whitespace | Passed |

The 23 HTTP checks exercised bootstrap, creating a project, block preview, rejecting an addition, editing and pinning a fact, accepting a next action, new version creation, duplicate-save replay, version history, four provider handoff records, unauthenticated rejection, oversized input, malformed block, empty paste, missing Gemini key, restore, stale-base rejection, API mode without keys, export, founder metrics access control, and delete-all. Test data lived in an isolated checkout/database and was deleted. Existing user projects were not deleted.

Measured valid-block HTTP preview: 10–53 ms across acceptance runs (46 ms on the final run). A safe hosted ordinary-text checkpoint produced a real Gemini Trust Preview in about 9.3 seconds after the server key was configured. This is one production smoke result, not a general latency guarantee.

## Browser evidence

The actual content script and compiled shared validator ran inside a Claude-shaped HTML fixture with a browser-storage/runtime adapter and the real local checkpoint API. This is stronger than source-marker assertions, but is not an installed extension on claude.ai.

- Auto-detect off: the fixture's assistant-read counter remained zero through a page edit.
- Complete assistant block: chip visibly pulsed “Update ready — Save”.
- Explicit project binding and valid block preview: real drawer displayed Added/Changed review and “Gemini was not called”.
- Reject completed item, accept next action, commit: Saved (v1), freshness update, ten-second Undo, and enabled Continue.
- Continue: selected the official ChatGPT destination. Browser clipboard writing was unavailable in the background fixture; explicit manual-copy fallback is retained.
- Known usage-limit text: non-blocking banner followed the linked project's order and suggested Gemini.
- Final dashboard: paste, folder adoption, Edit & pin, accept/reject diff, and source state rendered successfully.
- Phone layout at 390 x 844: document width 390, no horizontal page overflow.

The browser fixture found a real over-escaped update-block regex bug. It was fixed and the detection/save/handoff flow was rerun successfully.

## Fixed defects

1. Rejected additions were previously saved regardless of the review checkbox.
2. Commit previously re-ran Gemini before using the reviewed patch.
3. Queue entries previously disappeared after preview, before a version was durable.
4. Dashboard automation switches previously only changed local UI storage; the app/extension bridge now passes settings and pending handoffs.
5. The extension used a weaker copied validator; it now builds the shared parser/redactor.
6. Version restore truncated longer lists to six items; list preservation now matches checkpoint capacity.
7. API follow-up work previously triggered an unreviewed automatic snapshot; it now keeps the last approved version and offers draft review.
8. Budget trimming is explicit in the diff and requires accepted removal keys. Pinned fields are never trimmed.
9. Stale version/concurrent save conflicts now return a review-again action, and stale queued previews can be invalidated.
10. Captures use live chat URLs for project binding, ignore broken selectors in favor of paste, and reset state when a single-page provider changes chats.
11. Changed-row Accept/Reject now uses explicit neutral, accepted and rejected states; only an explicit rejection appears red.
12. `next_step` and a matching `changes[]` replacement now produce one human-readable **Next step** row, and accepting it changes the saved capsule.
13. Near-identical additions across fields are reduced to one best-fit fact before review; source excerpts use the same compact row layout at desktop and 390px.

## Not verified / external gates

- Broad real Gemini extraction quality, hallucination resistance, blocked output, 429 and timeout behavior. One safe hosted extraction passed, while the fixture suite still uses controlled provider responses and does not prove all live-model behavior.
- Real installed extension auth/cookies, selectors and insertion on Claude, ChatGPT, Gemini and Perplexity in Chrome/Edge. They require the user's authenticated browser sessions and an actual unpacked extension install.
- A real provider usage-limit hit and the target LLM's response correctly restating a real project. No automated Send is performed.
- Full browser reload/recovery of every offline/session-expiry path. Queue helpers and recovery UI exist; multi-tab queue races and browser storage quota remain pilot risks.
- Cross-device acceptance and two real admitted production accounts. User-scoped backend queries and simulated account isolation were tested.
- GitHub Actions run `38570641813` completed successfully for commit `5936d674f212aebd546273a65a4db3c255183893`: extension build, all test suites, TypeScript, ESLint, and production build passed from a clean checkout.
- Hosted audience remains unchanged. Only admitted testers can access the existing pilot; GitHub Pages alone cannot run the Worker/D1 backend.

## Cost and privacy limits

Processing reservations are atomic and conservative. They enforce per-user/per-IP burst limits, per-user daily calls/input, and a configurable daily reserved cost. Reservations live in the account event table; account deletion clears that table, so provider-side billing caps and the closed pilot access policy remain important against deliberate quota-reset abuse. Actual provider billing depends on configured model/prices.

Redaction is pattern-based. It covers common API keys, bearer tokens, .env-style lines, JWTs and multiline private keys; it cannot identify every private fact. Pinned protection is currently at capsule-field granularity. Folder adoption is a bounded, reviewed project map, not an automatic whole-repository watcher.

## Hosted publication

The supported Sites workflow deployed Solvane successfully to https://solvane.rareyew64.chatgpt.site on 14 October 2026. The existing owner-only audience was preserved. `GEMINI_API_KEY` is stored as a masked server secret and checkpoint extraction uses the configured `gemini-3.1-flash-lite` model.

## Reproduce

From apps/web run:
```sh
npm run build:extension
npm run test:checkpoint
npm run test:automation
npm run test:engine
npm run test:providers
npm run test:extension
npm run test:e2e
npx tsc --noEmit
npm run lint
npm run build
```

See [pilot acceptance](docs/15-pilot-acceptance.md) for the real Claude -> ChatGPT workflow, key setup, Chrome/Edge checklist, and external acceptance gates. `tests/api-smoke.mjs` is restricted to an isolated, migrated test server/database on port 5175 and deletes only that test database's mock-user data.
