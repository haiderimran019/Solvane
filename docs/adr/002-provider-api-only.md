# ADR 002: Integrate provider APIs, not consumer chat products

## Status

Accepted.

## Decision

Solvane routes work through provider APIs from its backend. It does not promise to observe, export, or automatically resume conversations occurring inside provider-owned consumer web applications.

## Consequences

- The product can reliably persist events, enforce security boundaries, and detect API outcomes.
- Users need API-capable provider configuration; consumer subscription limits are not the routing signal.
- The onboarding language must make this distinction unmistakable.
