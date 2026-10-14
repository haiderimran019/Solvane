# ADR 005: Browser Bridge is default; API Automation remains optional

- Status: accepted
- Date: 2026-10-14

## Decision

Solvane ships with two explicit modes. Browser Bridge is the free default and uses signed-in consumer AI accounts through a user-reviewed clipboard/extension handoff. API Automation preserves server-side BYOK routing and fallback for developers and power users.

## Consequences

- Provider API keys are not required to understand or adopt the product.
- Solvane cannot promise invisible automatic transfer between consumer websites; provider security boundaries require review, insertion, and user Send.
- DOM insertion can break when provider websites change, so clipboard paste is a first-class fallback.
- The API implementation, encryption boundary, and provider adapters remain maintained rather than being removed during the browser-first pivot.
