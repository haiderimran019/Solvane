# ADR 004: Automatic fallback is opt-in and guarded

## Status

Accepted.

## Decision

Automatic fallback runs only after an eligible retryable provider error, with a validated snapshot, a configured target provider, user/project opt-in, and idempotency protection.

## Consequences

- The product may sometimes ask the user to choose rather than maximizing apparent automation.
- It avoids expensive, surprising, or unsafe model switches.
- Failure classification and snapshot validity become release-critical components.
