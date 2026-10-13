# MVP Implementation Status

## Deployment

- Private production pilot: <https://solvane.rareyew64.chatgpt.site>
- GitHub source: <https://github.com/haiderimran019/Solvane>
- Sites project: `appgprj_6ace76bef1208191b660ee30650b9ae6`
- Published version: 3
- Audience: custom/owner-private. Widening access is a separate product decision, not a deployment shortcut.

## What is built

The working application is in `apps/web` and currently includes:

- Hosted account identity with per-user data ownership.
- Cross-device project folders stored in D1.
- Folder-specific ordering of Claude, Gemini, OpenAI, and Perplexity.
- Opt-in automatic fallback controlled independently for every folder.
- Encrypted bring-your-own-key provider connections.
- Server-side adapters for the four provider APIs.
- Persistent conversations with turn IDs and basic idempotent replay.
- Perplexity citation capture.
- Versioned portable snapshots generated after successful turns.
- A responsive dashboard with folders, relay order, chat, connections, and state card.
- A high-contrast Poppins visual system derived from the approved reference direction: geometric lime/yellow/green framing, deep-black relay surfaces, oversized white content cards, and responsive phone/tablet/desktop layouts.

## Runtime flow

1. Sites authenticates the visitor and supplies a stable user ID to server routes.
2. The dashboard loads only folders and provider status belonging to that user.
3. The user creates/selects a folder and orders the four providers.
4. The router calls the first configured provider with the newest user turn held in memory. Eligible rate-limit, timeout, or service failures move to the next connected provider when auto fallback is enabled.
5. After a provider succeeds, the user turn and normalized assistant response are stored atomically with citations, attempts, and provider identity. Failed attempts do not create duplicate user messages.
6. The dashboard calls the snapshot endpoint, which asks the first available low-cost model for bounded JSON and falls back to deterministic state if reduction fails.
7. Any device signed into the same Site account reads the same folders, conversations, settings, and snapshots.

## Required hosted secret

`PROVIDER_CREDENTIAL_MASTER_KEY` encrypts user-supplied provider keys using AES-GCM. It must exist before BYOK connections are accepted. Optional workspace-owned keys are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `PERPLEXITY_API_KEY`.

## Honest verification boundary

Verified locally on 2026-10-14:

- TypeScript completed with no errors.
- The production build completed for all dashboard and API routes.
- The local D1 migration applied successfully.
- Browser QA covered folder creation and switching, provider-order changes, reload persistence, auto-fallback persistence, connection forms, modal dismissal, notification dismissal, snapshot refresh, and the failed-provider path.
- The failed-provider path returns the expected error without persisting a duplicate user turn.
- Responsive checks passed at 390 px, 1024 px, and 1440 px with no horizontal overflow; the final browser console had no warnings or errors.
- The local provider-secret file is explicitly ignored by Git.
- The private production deployment succeeded and its unauthenticated boundary correctly presents ChatGPT sign-in.

Still requires real provider credentials and owner consent at the hosted sign-in screen:

- A live response from each external provider.
- A forced rate-limit handoff across every provider pair.
- Snapshot-fidelity evaluation against the documented rubric.
- Authenticated production data creation from a second physical device.
- A second-user pilot test after the owner chooses an invite-only tester or deliberately widens the access policy.

A successful build does not prove that an external account has quota or that a configured model ID is enabled for that account. Those checks are deliberately reported as unverified until real credentials are connected.
