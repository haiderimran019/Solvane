# ADR 003: Handoffs are explicit and user-visible

## Status

Accepted.

## Decision

Every provider handoff records source, destination, reason, snapshot version, and outcome. The UI tells the user when a provider changed.

## Consequences

- Users can assess answers with the correct provider context.
- Support can investigate continuity failures.
- The product avoids misleading claims that a target model is literally continuing the source model’s private state.
