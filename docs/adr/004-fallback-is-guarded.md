# ADR 004: Automatic fallback is opt-in and guarded

## Status

Accepted.

## Decision

Automatic fallback runs only after an eligible provider error, with a validated snapshot, a configured target provider, user/project opt-in, and idempotency protection.

Eligible errors (revised 16 October 2026):
- **Retryable:** a rate limit or exhausted quota (402/429), an outage (5xx), a timeout, or a network failure.
- **Rejected:** the provider cannot serve the turn as configured. This means a rejected key (401/403), an unknown or retired model (404), a rejected request (400), a Claude refusal, or Solvane's own platform spending cap. Retrying the same provider cannot help, but another connected provider can.

The first version allowed only retryable errors, so a retired default model stopped the turn even when another provider was connected.

## Consequences

- The product may sometimes ask the user to choose rather than maximizing apparent automation.
- It avoids expensive, surprising, or unsafe model switches.
- Failure classification and snapshot validity become release-critical components.
