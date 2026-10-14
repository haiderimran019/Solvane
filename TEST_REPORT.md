# Solvane pilot test report

Date: 14 October 2026. Scope: paste/checkpoint, browser chip, Gemini boundary, review/versioning, handoff, API fallback, and release packaging.

## Passed

| Gate | Actual result |
| --- | --- |
| Checkpoint schema and merge | 18 tests passed |
| Automation helpers | 10 Node test results passed (9 child cases plus parent) |
| Extraction/review/file-map regressions | 6 tests passed; includes 12 extraction transport fixtures |
| Actual API route with simulated provider transport | 2 tests passed: 429 fallback, replay, all providers failing, account isolation, real SQLite quota reservation SQL |
| Extension contract and four provider HTML fixtures | Passed |
| Isolated HTTP API acceptance | 23 checks passed against Vite + local D1 on port 5175 |
| TypeScript / ESLint / production build | Passed |
| Extension JavaScript syntax / ZIP integrity / whitespace | Passed |

The 23 HTTP checks exercised bootstrap, creating a project, block preview, rejecting an addition, editing and pinning a fact, accepting a next action, new version creation, duplicate-save replay, version history, four provider handoff records, unauthenticated rejection, oversized input, malformed block, empty paste, missing Gemini key, restore, stale-base rejection, API mode without keys, export, founder metrics access control, and delete-all. Test data lived in an isolated checkout/database and was deleted. Existing user projects were not deleted.

Measured valid-block HTTP preview: 10–53 ms across acceptance runs (46 ms on the final run). This is local timing, not a production latency promise. The live Gemini path could not be timed because no Gemini key was configured.

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

## Not verified / external gates

- Real Gemini extraction quality, hallucination resistance, source fidelity, blocked output, 429 and timeout latency. Mocked responses test our pipeline; they do not prove model behavior. Server and hosted configuration had no GEMINI_API_KEY.
- Real installed extension auth/cookies, selectors and insertion on Claude, ChatGPT, Gemini and Perplexity in Chrome/Edge. They require the user's authenticated browser sessions and an actual unpacked extension install.
- A real provider usage-limit hit and the target LLM's response correctly restating a real project. No automated Send is performed.
- Full browser reload/recovery of every offline/session-expiry path. Queue helpers and recovery UI exist; multi-tab queue races and browser storage quota remain pilot risks.
- Cross-device acceptance and two real admitted production accounts. User-scoped backend queries and simulated account isolation were tested.
- GitHub Actions run `38570641813` completed successfully for commit `5936d674f212aebd546273a65a4db3c255183893`: extension build, all test suites, TypeScript, ESLint, and production build passed from a clean checkout.
- Hosted audience remains unchanged. Only admitted testers can access the existing pilot; GitHub Pages alone cannot run the Worker/D1 backend.

## Cost and privacy limits

Processing reservations are atomic and conservative. They enforce per-user/per-IP burst limits, per-user daily calls/input, and a configurable daily reserved cost. Reservations live in the account event table; account deletion clears that table, so provider-side billing caps and the closed pilot access policy remain important against deliberate quota-reset abuse. Actual provider billing depends on configured model/prices.

Redaction is pattern-based. It covers common API keys, bearer tokens, .env-style lines, JWTs and multiline private keys; it cannot identify every private fact. Pinned protection is currently at capsule-field granularity. Folder adoption is a bounded, reviewed project map, not an automatic whole-repository watcher.

## Hosted publication\n\nThe supported Sites workflow packaged source commit `dc960bd723650acfb68bf4781ee9cd2df0351270` and deployed it successfully to https://solvane.rareyew64.chatgpt.site on 14 October 2026. The existing owner-only audience was preserved. Hosted Gemini key configuration is still missing; valid update blocks work without it.\n\n## Reproduce

From apps/web run:
```sh
npm run build:extension
npm run test:checkpoint
npm run test:automation
npm run test:engine
npm run test:providers
npm run test:extension
npx tsc --noEmit
npm run lint
npm run build
```

See [pilot acceptance](docs/15-pilot-acceptance.md) for the real Claude -> ChatGPT workflow, key setup, Chrome/Edge checklist, and external acceptance gates. `tests/api-smoke.mjs` is restricted to an isolated, migrated test server/database on port 5175 and deletes only that test database's mock-user data.
