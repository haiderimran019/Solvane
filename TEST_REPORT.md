# Solvane pilot test report

## Code health (Phase 4, #11) — 16 October 2026

- **Removed scaffolding the app never used:**
  - the 61 shadcn UI components, plus the `use-mobile` hook, the `cn` helper and `components.json` that only they used;
  - the connector-error template component;
  - the vendored shadcn stylesheet;
  - `examples/d1`;
  - three Next.js template icons;
  - the committed Vite dependency cache (`.vite/`, now git-ignored).
- **Removed 19 npm dependencies used only by those files**, which drops 169 installed packages. Runtime dependencies are now `next`, `react`, `react-dom`, `drizzle-orm`, `lucide-react` and `zod`; `zod` is kept for the Sites connector runtime. The connector and Sites build files stay because the Sites hosting runtime uses them.
- **Split the dashboard.** `app/relay-dashboard.tsx` (884 lines) keeps the state and actions. Its 44 view components, types and helpers moved to `app/_dashboard/` (the underscore keeps the folder out of routing). All 45 declarations are byte-identical to before; only `export` and one relative import path changed. The result type-checks cleanly with `--noUnusedLocals`.

Verified: TypeScript, ESLint, every test suite and the production build pass. In the running dashboard, every view, the handoff dialog and the profile panel render with no console errors or failed requests.

## API mode hygiene (Phase 4, #10) — 16 October 2026

- **Current default models (checked against provider docs today):**
  - Claude `claude-opus-5-5`, replacing the retired `claude-3-5-haiku-latest`.
  - ChatGPT `gpt-6-luna`, OpenAI's named replacement for `gpt-4o-mini`, which shuts down on 14 January 2027.
  - Gemini `gemini-3.8-flash`, and `gemini-3.5-flash-lite` for checkpoints. Gemini 2.5 now serves only accounts that already used it.
  - Perplexity `sonar`, unchanged.
  - All are still overridable with environment variables and per-key model fields.
- **Provider request shapes:**
  - Current Claude models send an explicit medium effort.
  - Claude models that support it opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), and a Claude refusal is detected rather than read as an empty answer.
  - Gemini extraction sends `thinkingLevel: LOW` to 3.x models and `thinkingBudget: 0` to 2.x.
  - Perplexity sources are read from `search_results` when `citations` is absent.
  - Chat turns allow 8,000 output tokens and 90 seconds.
- **Spending caps on every platform key.** Each call made with a workspace-owned key, for any provider, is reserved against the daily caps first, at that provider's conservative prices. `PLATFORM_DAILY_SPEND_USD` is the overall cap; the old `GEMINI_DAILY_SPEND_USD` still applies when it is unset. Personal (BYOK) keys are not capped. Before, only Gemini platform calls were capped.
- **Fallback on rejection.**
  - A rejected key (401/403), an unknown or retired model (404), a rejected request (400), a Claude refusal, or the platform cap now hands the turn to the next connected provider. Before, it stopped the turn.
  - Error messages name each provider's reason, for example "Claude doesn't recognize the model."
  - ADR 004 records the revised rule.

Tests: four route tests cover rejection and refusal fallback with readable errors, the Claude request body and headers for current and older models, platform-key reservation and the cap stopping calls, and Gemini thinking control by generation. All four fail against the previous code.

Not verified: live calls with real keys. The request shapes come from the providers' current docs and are exercised against scripted responses only.

## Honest UI (Phase 3) — 16 October 2026

- **Home follows your providers.** The source is the first provider in the project's order. The target is the default handoff, else the provider continued in last, else ChatGPT, then the rest of the order, never the source. The hero, button, diagram and phone Continue all use them. Existing projects with default settings still show Claude → ChatGPT.
- **No hardcoded status:**
  - The header shows the real capsule version and save time, or "Not saved yet" with an amber dot.
  - The sidebar says "Saved to your account / Open it on any signed-in device" instead of claiming live sync.
  - The Home note reports "Nothing saved yet", "Capsule needs more context" (amber) or "Ready to continue" from the actual capsule.
  - The readiness facts describe the process ("Saved only after your review", "Common secret formats redacted").
- **Rename and delete:**
  - A pencil beside the project title renames inline.
  - Advanced → Delete this project removes its capsule versions, messages and events, keeping only an archived "Deleted project" row with its processing-limit reservations. Deleting projects therefore cannot reset the daily Gemini allowance.
  - Deleted projects return 404 for reads, renames, restores, handoffs and deletes, and are not counted on the account page.
- **Full history.** Version history loads 12 at a time with "Show older versions".

Tests:
- Continue-target rules: unit test.
- History paging, rename, and deletion (content removed, reservations kept, 404s afterwards): route tests.

Verified in the dashboard:
- Default settings show Claude → ChatGPT, and switching the default handoff to Gemini changed the hero, button and diagram.
- The header and the amber note reflect a 45% capsule.
- Rename updated the title, header, sidebar and server.
- A 14-version project paged v14–v3, then v2–v1.
- Deleting a project showed the confirmation, switched projects, returned 404 for the old ID, and kept the account count consistent.
- A fresh tab visiting every view logged no console errors.

## Extension reliability (Phase 2) — 15 October 2026

- **One capsule builder (0.4.3).** The dashboard, the extension and `handoff.md` all use `buildCapsulePrompt` from the shared core. Extension handoffs are now readable sections with the project name and real line breaks (previously a JSON dump with literal `\n`), and they apply the dashboard's privacy choices, which now sync to the extension.
- **0.4.4:**
  - Alt+S uses the physical key, so Option+S works on macOS (it types `ß`).
  - Insert capsule simulates a paste over the composer, so ProseMirror keeps line breaks as paragraphs and the draft is replaced. The fallback is `execCommand("insertText")`.
  - Chat links moved from synced storage (8 KB per item, about 80 links) to local storage. Old links migrate on first read.
  - Queued captures expire after 7 days, and the chip no longer pulses every 30 seconds.
  - The direct page-origin fetch fallback and the server CORS allowance for provider sites are removed. An extension update now shows "Reload this tab".
  - The release ZIP is rebuilt from scratch without the `127.0.0.1:5173` dev origin, and the service worker reads its allowed origins from the manifest.

Verified in the runtime fixture against the local API:
- An Option+S key event opened the drawer.
- Legacy synced links merged into local storage and left synced storage.
- An 8-day-old capture was removed; a legacy capture was given a timestamp.
- The chip stayed still.
- A real ProseMirror editor received the capsule as six paragraphs, with the draft replaced.
- A textarea composer received it with newlines and one input event.
- A lost extension connection showed the reload message and kept the capture.
- The service worker forwards to production in both builds, reaches the dev origin only from the unpacked source, and refuses other origins.

- **Fewer clicks (0.4.5):**
  - An unlinked chat preselects the last-used project with a visible note.
  - Review update links the chat to the selected project, so there is no separate Link click, and the review shows "Saving to <project>".
  - With no previous project nothing is preselected, and saving asks for a choice.
  - The dashboard Home shows a 3-step setup card until every step is done or it is hidden: add the project instruction to Claude (copying it marks the step done), install the extension, save once. The Advanced checklist starts with the instruction step.

Live Claude, ChatGPT and Gemini composers still need a manual insertion check.

## Save-logic fixes — 15 October 2026

Three defects in save → review → continue were reproduced against a local build and fixed:

1. **Pins froze fields.** Undo, Restore and every manual edit pinned whole fields permanently, there was no unpin, and a pinned field silently ignored changes the user accepted ("Saved" with nothing changed). Pins are now per item (list items, plus goal/current task/next step). Only manual edits and Edit & pin create them. Undo and Restore copy an earlier version with that version's pins. A pinned item is never pre-selected, and accepting a change to it is applied and releases the pin. Project memory shows a pin toggle on every item. Older whole-field pins are converted to pins on the items present at read time.
2. **A list change wiped the list.** A `changes` entry on a list field replaced the entire list and split the new text at commas. It now replaces only the matching item. If nothing matches, the value is offered as an unselected new item and nothing is deleted.
3. **Re-saving after Undo was ignored.** Save idempotency was keyed on the pasted text, so saving the same paste after an Undo answered "Already saved" with an older version. It is now keyed on the review (text, base version, decisions and edits), so retries still replay. A review that accepts nothing creates no new version.

Undo and Restore send `restoreVersion`; bare-state Undo from extension 0.4.1 still works and pins nothing. The extension is now 0.4.2.

| Gate | Result |
| --- | --- |
| Checkpoint / engine / automation / providers | 28 / 6 / 10 / 2 passed |
| New save-route tests (`npm run test:save`) | 6 passed; all 6 fail against the previous code |
| Extension contract | Passed |
| Production build | Passed |
| TypeScript / ESLint | No new errors. The existing `hosting.json` typing error and 3 lint errors remain (separate fix). |

## Focused continuity UI — 15 October 2026

The primary product surface was rebuilt around the agreed Claude → Solvane → ChatGPT flow. The previous three-column operations dashboard is no longer the default experience.

The next browser-companion slice now uses the same Manrope/teal design, defaults new installs to the Claude → ChatGPT route, and fixes extension review decisions so a neutral item no longer looks rejected.

### Passed in this local revision

| Gate | Actual result |
| --- | --- |
| TypeScript | `npx tsc --noEmit` passed |
| ESLint | `npm run lint` passed with zero warnings |
| Production build | `npm run build` passed |
| Checkpoint regression | 20/20 tests passed |
| Automation regression | 10/10 tests passed |
| Extension contract | Passed |
| Desktop visual QA | 1440 × 1000: home, Save, Continue dialog, and Advanced inspected |
| Phone visual QA | 390 × 844: home and Advanced inspected; bottom navigation and route scroller remained usable |
| Browser runtime | No console warnings or errors during the inspected flows |

Verified behavior: the home screen exposes one dominant `Continue in ChatGPT` action and one `Save latest progress` action; Save opens the existing checkpoint/Gemini review flow; Continue opens the existing exact-payload handoff review; Project memory preserves capsule editing; Advanced preserves Browser Bridge, provider order, privacy controls, and API Automation.

Verified later in this report: the unpacked extension on authenticated Claude and ChatGPT pages, a reviewed block save, safe insertion into ChatGPT without sending, GitHub publication, and a production deployment. The Site was subsequently opened to public visitors while retaining per-user sign-in and data isolation. Still not claimed: a real Claude usage-limit event, a live ordinary-prose Gemini extraction, or the target model's final response.

Date: 15 October 2026. Scope: paste/checkpoint, browser chip, Gemini boundary, review/versioning, handoff, API fallback, and release packaging.

## Focused browser companion update — 15 October 2026

- Replaced the hosted app typography with Manrope and a native system fallback stack.
- Reworked the extension chip, project picker, privacy disclosure, review drawer, and continuation controls into the same calm off-white and teal product language as the focused dashboard.
- Changed the default continuation target to ChatGPT while preserving Claude, Gemini, and Perplexity overrides.
- Added explicit neutral, accepted, and rejected review states. Reject no longer merely means “not accepted.”
- Fixed the runtime fixture paths, then visually verified the real content script renders a collapsed “Save progress” chip and its review drawer at 627 × 753.
- Removed the extension settings page's remote font request; the settings UI uses the local/native font stack when Manrope is unavailable.
- Rebuilt `public/solvane-extension.zip` from the updated extension source.

Verification completed after these changes: checkpoint 20/20, engine 6/6, provider route 2/2, automation 10/10, extension contract passed, TypeScript passed, ESLint passed, production build passed, and extension packaging passed. This remains fixture evidence, not proof of the unpacked extension on a logged-in real Claude or ChatGPT page.

## Live Chrome acceptance — 15 October 2026

The unpacked Solvane Browser Bridge 0.4.1 was installed and enabled in the user's existing Chrome profile after explicit approval. The focused path was then exercised on authenticated real provider pages:

1. `claude.ai/new` displayed the collapsed Solvane **Save progress** chip.
2. The drawer loaded the production Solvane projects and explicitly linked the page to the existing `test hello` test project.
3. A valid `SOLVANE_UPDATE v1` test block was previewed. The UI reported that Gemini was not called.
4. The changed next action was explicitly accepted and the reviewed capsule saved as version 3.
5. **Continue in ChatGPT** opened `chatgpt.com`, where the extension offered the reviewed capsule.
6. **Insert capsule** populated the real ChatGPT composer with the approved v3 state and the update-block instruction.
7. The ChatGPT **Send** button remained untouched. No provider message was submitted.

After that acceptance run exposed a project-safety edge case, generic start URLs (`/new`, `/app`, or `/`) were changed to use a temporary project choice. The extension removes any legacy binding from a generic start page and persists the choice only after the provider assigns a unique conversation URL. Chrome was reloaded with 0.4.1 and a fresh `claude.ai/new` drawer was verified to show the project chooser instead of silently reusing the earlier `test hello` binding.

The focused owner-private Sites build was deployed successfully from commit `e814eeb75447c6b063f68f9424f3ebf47622371b`, then the 0.4.1 project-binding safety update was deployed from commit `fd9686c54db6b5355e964e3d9392e6fee7f5f9f9`. The live dashboard was reloaded and visually verified at `https://solvane.rareyew64.chatgpt.site/`; it showed the focused Claude → ChatGPT continuity home, capsule v3, the accepted next step, and 96% readiness.

Still unverified: a real provider-generated chat capture with ordinary prose through live Gemini, a real Claude usage-limit banner, automatic marker detection after live streaming completes, offline retry across a full browser restart, and real-page selector/insertion checks for Gemini and Perplexity.

## Passed

| Gate | Actual result |
| --- | --- |
| Checkpoint schema and merge | 20 tests passed |
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
- Real installed extension behavior remains unverified on Gemini and Perplexity and in Edge. Authenticated Claude capture/review and ChatGPT insertion were verified in Chrome.
- A real provider usage-limit hit and the target LLM's response correctly restating a real project. No automated Send is performed.
- Full browser reload/recovery of every offline/session-expiry path. Queue helpers and recovery UI exist; multi-tab queue races and browser storage quota remain pilot risks.
- Cross-device acceptance and two real admitted production accounts. User-scoped backend queries and simulated account isolation were tested.
- A prior GitHub Actions run `38570641813` completed successfully for commit `5936d674f212aebd546273a65a4db3c255183893`. The final local `main` revision also passed checkpoint, engine, provider, automation, extension, TypeScript, ESLint, and production-build gates before push.
- Hosted audience remains unchanged. Only admitted testers can access the existing pilot; GitHub Pages alone cannot run the Worker/D1 backend.

## Cost and privacy limits

Processing reservations are atomic and conservative. They enforce per-user/per-IP burst limits, per-user daily calls/input, and a configurable daily reserved cost. Reservations live in the account event table; account deletion clears that table, so provider-side billing caps and the closed pilot access policy remain important against deliberate quota-reset abuse. Actual provider billing depends on configured model/prices.

Redaction is pattern-based. It covers common API keys, bearer tokens, .env-style lines, JWTs and multiline private keys; it cannot identify every private fact. Pins protect individual list items and the goal, current task and next step (see the save-logic section above). Folder adoption is a bounded, reviewed project map, not an automatic whole-repository watcher.

## Hosted publication

The supported Sites workflow packaged source commit `c341f07f3358e7514cada64a58ea89f055ac4f79` and deployed saved version `appgprj_6ace76bef1208191b660ee30650b9ae6~appgver_277dd0ede2008191a0e06f5d6786d190` successfully to https://solvane.rareyew64.chatgpt.site on 15 October 2026. Site access was changed from the owner-only pilot to public-link access on 15 October 2026; visitors still authenticate so projects remain isolated per user and work across devices. GitHub `main` contains the release source and documentation. Valid update blocks work without a Gemini call; ordinary prose through the live Gemini boundary remains a separate real-world verification gate.

## Reproduce

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
