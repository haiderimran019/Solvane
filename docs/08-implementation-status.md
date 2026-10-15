# MVP Implementation Status

## Deployment identity

- Existing private pilot: <https://solvane.rareyew64.chatgpt.site>
- GitHub source: <https://github.com/haiderimran019/Solvane>
- Sites project: `appgprj_6ace76bef1208191b660ee30650b9ae6`
- Previous hosted version: 3; the checkpoint/reliability revision was successfully deployed on 14 October 2026 (Site source commit dc960bd723650acfb68bf4781ee9cd2df0351270).
- Current revision includes the reviewed checkpoint flow, shared extension validation, folder-map intake, and reliability controls. The hosted Site is public-link accessible; sign-in remains required for per-user project ownership and cross-device continuity.

## Implemented in this source revision

### Free Browser Bridge

- Guided handoff to Claude, Gemini, ChatGPT, and Perplexity using the user's signed-in browser accounts.
- A provider-specific confirmation dialog explains exactly what will be copied and uses a direct official-site link, avoiding browser popup blockers.
- Reviewed relay prompt copied before the target website opens.
- Manifest V3 companion extension with a floating Capsule control on the four supported provider sites.
- Selected-text or bounded visible-context capture, local pending handoff, target-site insertion, and clipboard fallback.
- The extension never reads cookies or hidden reasoning and never presses Send.

### Continuity Capsule workspace

- Account-scoped, cross-device project folders and provider preference order.
- Editable capsule fields: objective, current task, decisions, constraints, completed changes, open questions, do-not-repeat items, artifacts, sources, and next step.
- User corrections create new snapshot versions instead of rewriting history.
- Trust Preview, Context Health, approximate 1,500-token budget, missing-context warning, Quick Capture, Rescue Session, version restore, and audited handoff history.
- Privacy switches for decisions, constraints, artifacts/sources, and fenced-code exclusion.
- `handoff.md` export for Codex and Claude Code.
- Clickable account profile with live record totals, sign-out, cookie/analytics controls, and full per-user JSON export.
- Consent-gated allowlisted product analytics with no prompt, Capsule, password, provider-cookie, or browsing-history collection.
- Branded inline provider marks, serif interface typography, and hover/pressed feedback across desktop and phone navigation.

### Optional API Automation

- Encrypted per-user BYOK provider connections.
- Server-side Claude, Gemini, OpenAI, and Perplexity adapters.
- Folder-specific provider order and guarded automatic fallback.
- Persistent API conversations, idempotent turn replay, Perplexity citations, and post-turn capsule reduction.
- Developer relay console in the dashboard.

### Phase 1 paste-based Checkpoint

- In-project Save checkpoint screen with local `SOLVANE_UPDATE v1` validation and Gemini extraction for ordinary chat pastes.
- Redaction, strict server-side patch validation, token-budget compression, contradiction flags, additive auto-apply, accept/reject review, pinned-field protection, idempotent source hashes, new-version undo, and version preview/restore.
- Existing provider-order handoff is reused after save; the handoff wrapper asks the next model to output a SOLVANE_UPDATE block.
- Full Phase 1 notes and manual checklist: [12-checkpoint-phase1.md](12-checkpoint-phase1.md). Automated report: [TEST_REPORT.md](../TEST_REPORT.md).

### Phase 2 browser chip

- The Manifest V3 extension now ships a collapsed Shadow DOM Save chip with `Alt+S`, freshness state, bounded visible capture, local secret redaction, explicit URL-to-project binding, and a side drawer review.
- It reuses `/api/checkpoint`, the shared v1 schema, accept/reject merge rules, versioned snapshots, and provider handoff. Valid update blocks skip Gemini; ordinary text uses the server-side Gemini key or encrypted BYOK.
- The extension adds ten-second Undo through `/api/snapshots`, explicit Save & continue provider selection, and the existing target-site insertion plus clipboard fallback.
- Provider selectors and four HTML fixtures are isolated in `apps/extension/provider-config.js`; source and package instructions are in [13-browser-chip-phase2.md](13-browser-chip-phase2.md).

### Phase 3 automation and reliability

- Opt-in update-block detection watches only the latest stable assistant message, validates the shared v1 shape, waits through streaming, and deduplicates by content hash. With the setting off, the content script does not read assistant messages.
- Best-effort provider limit banners, safe diagnostic copy, one-shot long-session reminders, redacted offline retry queue, and plain-language failure states are included in the extension.
- API Automation treats quota/rate-limit responses as retryable, records provider failovers in the Activity log, and keeps the approved capsule version in the event record.
- Settings now include auto-detect, reminders, enabled sites, default handoff, token budget, always-show Trust Preview, onboarding checklist, project-instruction copy, and delete-all account data.
- Authenticated privacy-safe metrics are allowlisted and contain no prompt or capsule content. A founder-only aggregate endpoint exists behind `FOUNDER_METRICS_USER_ID`.
- Full Phase 3 workflow, limits, and manual checklist: [14-phase3-automation.md](14-phase3-automation.md).

## Runtime flow

### Browser Bridge

1. Sites authenticates the visitor and loads their D1-backed projects and latest capsule.
2. The user edits or rescues the capsule and inspects the Trust Preview.
3. Continue In copies the bounded capsule, opens the chosen provider, and stores a `handoff.launched` audit event.
4. The extension can insert a device-local pending capsule into a supported provider composer; manual paste remains the fallback.
5. The user reviews and sends in the provider product.

### API Automation

1. The user connects an encrypted provider key in Modes & settings.
2. The API console sends through the folder's preferred route.
3. Eligible failures may move to the next connected provider when fallback is enabled.
4. A completed turn persists with provider identity and citations, then produces a new capsule version.

## Required hosted secret for BYOK

`PROVIDER_CREDENTIAL_MASTER_KEY` encrypts user-supplied provider keys using AES-GCM. Browser Bridge does not require it. Optional workspace-owned API secrets remain `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `PERPLEXITY_API_KEY`.

## Verification boundary

Verified in the current workspace on 2026-10-14:

- The extension manifest and content script parse successfully.
- The extension ZIP passes archive integrity testing and the local app download route returns HTTP 200 with `application/zip`.
- TypeScript, ESLint, and the production Vinext build complete successfully after the dual-mode redesign.
- Authenticated local browser QA passed for capsule editing and saving, version history, Trust Preview, clipboard equality, Quick Handoff, handoff audit persistence, settings, API connection modal, and reload persistence.
- The browser console contained no warnings or errors during the tested flow.
- Responsive visual QA passed at 390 px, 760 px, 900 px, 1,100 px, and 1,280 px with no page-level horizontal overflow.
- Preferred-route arrows remained inside every provider card at all five widths; smaller surfaces use an intentional internal horizontal scroller.
- All four provider dialogs expose direct `_blank` links to the correct official destinations, and the Claude launch opened its official sign-in/new-chat route in a separate tab.
- The handoff dialog fits completely inside a 390 × 844 phone viewport.
- The interface accent and interactive yellow resolve to the same `#d8ff32` design token.

Must still be completed before calling this revision production-ready:

- Real extension insertion checks on the current DOM of all four provider websites.
- Live API response and forced fallback checks using valid provider credentials and quota.
- Live update-block and usage-limit behavior on current provider pages; fixture/contract coverage is green but cannot replace a signed-in browser session.
- Authenticated production deployment of this revision.
- Cross-device test using one account and account-isolation test using a second admitted user.
- Google and GitHub login require real OAuth applications, production callback URLs, secret configuration, and end-to-end provider testing. ChatGPT remains the only active sign-in method in this source revision.
- Privacy policy, data-retention/deletion policy, processor inventory, and jurisdiction-specific legal review before a public pilot.
- Public privacy/support URLs, IP/WAF throttling, and real Google/GitHub OAuth configuration remain launch work rather than claims of completion.

Provider website markup and model availability change independently of Solvane. A passing build cannot prove live extension insertion, provider quota, model access, or second-account access.

Follow [the real-world test guide](11-real-world-test-guide.md) for a repeatable browser, account, cross-device, extension, and API-mode acceptance pass.
