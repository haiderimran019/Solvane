# Delivery Plan and Release Gates

> Implementation update, 2026-10-13: the local MVP now covers the core code paths through Milestone 4. Production deployment, real provider-key calls, hosted migration verification, and the full 12-pair handoff matrix remain release gates rather than assumed successes.

## Delivery principle

Ship a narrow, demonstrable continuity loop before expanding integrations or features:

```text
project → turn → validated snapshot → switch → continued turn → visible audit trail
```

## Milestone 0 — Foundation decisions

Deliverables:

- Confirm final product name and domain after appropriate legal/availability review.
- Decide launch credential model: managed provider keys or BYOK.
- Approve data retention/deletion policy and provider disclosure language.
- Create one provider-neutral canonical request/response contract.
- Create the initial snapshot JSON schema and fidelity rubric.

Exit gate: decisions are recorded in ADRs and no secret-handling ambiguity remains.

## Milestone 1 — Local single-provider continuity

Deliverables:

- Project/session/turn/event persistence.
- One provider adapter operating through server-side credentials.
- Snapshot worker that creates and validates state after a turn.
- State-card UI/API showing current snapshot and provenance.
- Idempotency and basic audit events.

Exit gate: an accepted turn survives process restart; snapshot can be corrected and regenerated.

## Milestone 2 — Manual handoff

Deliverables:

- At least two production-shaped adapters.
- Manual target-provider chooser.
- Handoff prompt assembly with snapshot version pinning.
- Target response streamed back as a normal turn.
- Visible handoff timeline and explicit destination notice.

Exit gate: a user can complete controlled handoffs in both directions with no raw credential or cross-project leakage.

## Milestone 3 — Four-provider adapter coverage

Deliverables:

- Claude, Gemini, OpenAI, and Perplexity adapters conform to the contract.
- Citation ledger and research-source preservation.
- Artifact manifest support with clear unsupported-mode errors.
- Pairwise handoff test matrix across all providers.

Exit gate: all 12 directed provider-pair handoffs pass the defined fidelity and failure tests.

## Milestone 4 — Guarded automatic fallback

Deliverables:

- Provider health/error classification.
- User-configured fallback order and explicit opt-in.
- Rate-limit/unavailability switch policy.
- User notifications and retry controls.
- Operational dashboards and alerts.

Exit gate: a simulated rate limit produces exactly one auditable, user-visible fallback with no duplicated turn.

## Milestone 5 — Private pilot

Deliverables:

- Secure account lifecycle, deletion, and support process.
- Pilot onboarding with provider/key disclosure.
- Fidelity feedback prompt after handoffs.
- Weekly review of corrections, failures, cost, and retention behavior.

Exit gate: pilot evidence shows repeat usage and handoff completion is materially better than manual copy/paste.

## Risk register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Snapshot omits a critical fact | User loses trust at the exact moment of switch | Event-backed state, visible card, correction flow, fidelity tests. |
| Provider behavior/API changes | Adapters can fail independently | Capability flags, contract tests, provider-specific incident isolation. |
| Consumer-app expectation mismatch | Users expect Solvane to read existing chats | State the API-only boundary prominently in onboarding. |
| Provider costs grow quickly | Background reduction and multi-provider usage multiply spend | Small snapshot budget, only reduce on meaningful events, BYOK/usage limits decision. |
| Brand collision | Launch is delayed or confusing | Treat working name as temporary; complete review before public release. |
| Sensitive content transfer | Project context may contain secrets | Server-side credentials, redaction, per-handoff disclosure, deletion. |

## What not to build before pilot proof

- Enterprise memory graphs.
- Vector database retrieval.
- Shared team workspaces.
- Autonomous agent orchestration.
- Browser automation for consumer AI chats.
- Payments, marketplace integrations, or complex role systems.
