# MVP Implementation Status

## Deployment identity

- Existing private pilot: <https://solvane.rareyew64.chatgpt.site>
- GitHub source: <https://github.com/haiderimran019/Solvane>
- Sites project: `appgprj_6ace76bef1208191b660ee30650b9ae6`
- Previously published version: 3
- Current workspace revision: Browser Bridge + Continuity Capsule redesign; deployment status must be updated only after a successful publish.

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
- Authenticated production deployment of this revision.
- Cross-device test using one account and account-isolation test using a second admitted user.
- Google and GitHub login require real OAuth applications, production callback URLs, secret configuration, and end-to-end provider testing. ChatGPT remains the only active sign-in method in this source revision.
- Privacy policy, data-retention/deletion policy, processor inventory, and jurisdiction-specific legal review before a public pilot.

Provider website markup and model availability change independently of Solvane. A passing build cannot prove live extension insertion, provider quota, model access, or second-account access.

Follow [the real-world test guide](11-real-world-test-guide.md) for a repeatable browser, account, cross-device, extension, and API-mode acceptance pass.
