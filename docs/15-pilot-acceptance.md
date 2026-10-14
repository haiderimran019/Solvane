# Solvane pilot: the one-minute handoff

Ali keeps working in Claude. Solvane keeps only the explicit state he reviews. He clicks Save, reviews the proposed facts, accepts them as a new version, and chooses Continue in ChatGPT. ChatGPT receives the project goal, active task, decisions, constraints, completed work, questions, sources and the next action, followed by instructions to restate understanding and continue. Solvane never sends the provider message itself.

## Start without a Gemini key

1. Open the dashboard and create or choose a project. Open Save checkpoint.
2. Copy project instruction into your existing Claude/ChatGPT project instructions. It contains a complete v1 JSON example, not an ellipsis placeholder.
3. Work normally. Copy the model's SOLVANE_UPDATE block into Solvane, or use the browser chip.
4. Save checkpoint. A valid block is validated without Google processing. Additions start accepted by default. Changed and removed rows start neutral; Accept turns the row green, Reject turns it red, and the counter confirms the choice. Use Edit & pin to correct a fact.
5. Accept & save. Check the new version and Undo; Activity has Preview and Restore as new version.
6. Continue in ChatGPT. Inspect the exact payload in the handoff dialog, copy/open the official site, insert or paste, then press Send yourself.
7. Confirm that ChatGPT restates the project accurately and proposes the recorded next action. That final response is the manual acceptance criterion, not something a GitHub build can establish.

## Normal chat and project folders

Normal prose requires a Gemini key. Add an encrypted Gemini BYOK connection in API mode, or configure the server's GEMINI_API_KEY. The key never belongs in an extension file, public environment variable, or Git commit.

Folder adoption uses a directory input under Save checkpoint. Metadata mode includes the file tree, README and manifests; content mode includes bounded text excerpts. It skips .git, node_modules, build output, binaries, .env and common key files. Review included/excluded files before adding the map. This is a compact project map and a single extraction call, not an unlimited whole-repository agent or a background folder watcher.

## Gemini behavior

- A normal preview makes one structured-output call. Invalid JSON or unsupported source excerpts get one repair attempt within the same total deadline. Timeout/429 errors are surfaced without a second transport retry.
- Commit uses the reviewed patch; it never calls Gemini again. Repeating the same source text is idempotent, and a stale base version asks for a new review.
- The shared schema/parser is compiled into the extension with npm run build:extension. It is the same validation implementation used by the server.
- Changed facts include a verbatim source_excerpt. The server rejects unsupported excerpts. Human review is still needed to judge whether a model extracted a fact correctly.
- Final capsule budgeting removes oldest unpinned completed items first. Pinned content is never trimmed; if it cannot fit, saving asks the user to shorten it or change the budget. Token counts are estimates, not provider tokenizer counts.

## Model research, checked 14 October 2026

The hosted checkpoint is configured for `gemini-3.1-flash-lite`, selected as a current low-cost structured-output model compatible with the deployed GenerateContent request. One safe live checkpoint completed in about 9.3 seconds. A broader real-key quality/latency evaluation is still required before claiming it passes every model fixture; deterministic and controlled-transport tests do not prove all live-model behavior.

Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini data-use terms](https://ai.google.dev/gemini-api/terms). Google's unpaid service can use content to improve products; paid service terms differ. The app discloses Google processing and links the terms before submitting a paste.

## Real provider checklist

Repeat this in Chrome and Edge for Claude, ChatGPT, Gemini and Perplexity:

- [ ] Install the unpacked 0.3.0 extension, sign in to Solvane, and link the chat to the right project.
- [ ] With auto-detect off, no assistant messages are read until Save/Alt+S.
- [ ] With auto-detect on, partial streaming does not produce an update; completed blocks pulse the chip; duplicate blocks do not create another version.
- [ ] Save/review/accept a real update. Check pinned fields, rejected additions, one clear next action, Undo, version restore, and source excerpts.
- [ ] Continue in another provider. Confirm the exact capsule is inserted, with clipboard/manual-copy fallback, and Send remains under your control.
- [ ] If a real limit occurs, confirm the banner uses your project order. If it is not detected, manual Save remains available.
- [ ] Disconnect the network during save, reload, reconnect, and recover the queued capture without losing it. Captures remain until a version is successfully committed.
- [ ] Sign out of Solvane and confirm the re-login message; another account must not see the first account's projects or queued project data through the API.
- [ ] Use the same account on a second device to verify project/version persistence. Extension installation and local retry captures are device-specific.

## API mode checklist

- [ ] Connect at least two valid provider keys, order them, enable fallback, and simulate an actual quota error.
- [ ] Check Activity shows the source/destination and approved capsule version.
- [ ] A capsule older than recent API work asks once before that turn proceeds with the saved state.
- [ ] All providers failing leaves the prompt available with a plain error; no false assistant message is persisted.

## Release boundary

The code includes CI, Playwright review tests, migrations, extension source/archive, a privacy page, and a static index.html tester entry. GitHub Pages can host index.html but cannot run this authenticated Worker/D1 backend. The Sites deployment has a masked server-side Gemini key; the existing audience remains unchanged, so admitted testers still need access. Live external-provider capture and insertion remain manual acceptance gates.
