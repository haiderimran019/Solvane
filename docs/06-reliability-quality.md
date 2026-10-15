# Reliability, Fidelity, and Quality

## 1. Reliability objectives

| Objective | MVP target |
| --- | --- |
| No lost accepted user message | Every accepted turn is recoverable from the event log. |
| No silent provider switch | Every switch produces a user-visible handoff record. |
| No duplicate completion | Idempotency applies to turns and handoffs. |
| No automatic handoff on invalid state | Snapshot must be latest valid or the automation stops. |
| Recoverable summaries | Any snapshot can be traced to source events and replaced. |

## 2. Failure policy

| Situation | Behavior |
| --- | --- |
| Provider responds successfully | Complete turn; schedule snapshot reduction. |
| Explicit rate limit / temporary unavailable | Record failure; offer retry and eligible fallback. |
| Timeout with unknown completion state | Mark uncertain; do not blindly retry; expose retry-after-resolution. |
| Bad credential | Fail clearly; never fallback silently unless another credential/provider is explicitly enabled. |
| Snapshot worker failure | Keep current valid snapshot; retry worker; prohibit automatic switch if none exists. |
| Target handoff failure | Keep source session state and create an auditable failed handoff. |

## 3. Handoff fidelity evaluation

Create a fixed internal evaluation set of realistic projects. For each test, start with source history, generate a snapshot, pass it to a different provider, then score the target’s orientation.

Required score dimensions:

- Correct objective.
- Correct current task.
- Correct accepted decisions and constraints.
- Correct next action.
- No invented completed work.
- Research claims retain appropriate source references.
- Snapshot stays within token budget.

Use human review at MVP stage. Do not claim a numerical accuracy rate until the dataset, rubric, and sample size are documented.

## 4. Test matrix

| Layer | Essential tests |
| --- | --- |
| State reducer | Schema validation, source references, correction versioning, secret redaction, budget enforcement. |
| Session service | Ordering, idempotency, concurrent sends, event durability. |
| Router | Manual selection priority, fallback eligibility, provider health/configuration. |
| Adapters | Normalization, streaming completion, error classification, correlation IDs. |
| Handoff | Every source/target provider pair, no valid snapshot, failed target, citation preservation. |
| Security | Project isolation, credential non-disclosure, log redaction, deletion. |
| User flow | Start project, switch manually, automatic fallback disclosure, snapshot correction. |

With four providers, validate all 12 directed source-to-target handoff pairs. Do not assume one successful Claude-to-Gemini test proves the reverse direction or another pair.

## 5. Observability

Track operational facts, not customer content:

- Turn acceptance/completion/failure counts.
- Handoff attempt, success, failure, and reason counts by directed provider pair.
- Snapshot latency, validation failure, size, and version publication counts.
- Provider latency, normalized error classes, and retry outcomes.
- User corrections to snapshot fields, categorized without recording sensitive text.
- Cost/usage estimates where the provider returns them.

Create alerts for sustained provider failure, snapshot refresh/publication failures, error-rate spikes, and unexpected cross-project authorization denials.
