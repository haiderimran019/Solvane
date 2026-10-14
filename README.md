# Solvane

Solvane is a continuity layer for people who work across Claude, Gemini, ChatGPT, Perplexity, Codex, and Claude Code. It turns the active state of a project into a small, inspectable **Continuity Capsule** and carries that capsule to the next model.

The product has two complementary modes:

| Mode | For | Cost model | Handoff |
| --- | --- | --- | --- |
| Browser Bridge | Most users | Uses existing signed-in AI accounts; no provider API key | Review capsule, open target model, insert or paste |
| API Automation | Developers and power users | Bring-your-own provider APIs today; managed usage can be added later | Server routing, citations, guarded automatic fallback |

## What the MVP includes

- Account-scoped, cross-device project workspaces backed by D1.
- Editable, versioned Continuity Capsules with objective, current task, decisions, constraints, changes, open questions, do-not-repeat guidance, artifacts, sources, and a locked next step.
- One-click Browser Bridge handoffs to Claude, Gemini, ChatGPT, and Perplexity.
- A Manifest V3 extension that captures visible/selected context, opens the target provider, and inserts the capsule without pressing Send.
- Trust Preview, Context Health, memory-budget estimate, privacy controls, quick capture, handoff history, and capsule rollback.
- Working profile and data center with live account totals, cookie/analytics choices, sign-out, and a complete user-owned JSON export.
- Consent-gated first-party product analytics using a strict event and metadata allowlist; prompt and capsule content is excluded.
- `handoff.md` export for Codex and Claude Code.
- Optional encrypted BYOK API connections, ordered routing, automatic fallback, a developer relay console, persistent messages, and citations.

## Repository map

| Path | Purpose |
| --- | --- |
| `apps/web` | Authenticated Vinext/React app, Worker APIs, D1 schema, and hosted Site configuration |
| `apps/extension` | Chromium Browser Bridge extension source |
| `apps/web/public/solvane-extension.zip` | Installable MVP extension package generated from `apps/extension` |
| `docs` | Product, architecture, state, API, security, reliability, delivery, and verification documentation |
| `index.html` | Static tester entry page linking to the live product and source |

## Product truth

Solvane preserves explicit working state; it does not copy hidden chain-of-thought, bypass provider limits, or guarantee identical output across models. Browser insertion depends on provider page markup, so clipboard paste remains the supported fallback. API automation remains available for users who need deterministic server-side orchestration.

## Current hosted pilot

- App: <https://solvane.rareyew64.chatgpt.site/>
- Source: <https://github.com/haiderimran019/Solvane>
- Hosted identity and data remain isolated per signed-in user.

ChatGPT is the active Sites-managed sign-in provider. Google and GitHub sign-in are intentionally marked as requiring setup until real OAuth applications, production callback URLs, and secrets are configured; the UI does not pretend those providers are connected.

Start with the [real-world test guide](docs/11-real-world-test-guide.md), then see [implementation status](docs/08-implementation-status.md) for the exact validation boundary before treating a revision as production-ready.
