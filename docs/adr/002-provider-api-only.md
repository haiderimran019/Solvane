# ADR 002: Integrate provider APIs, not consumer chat products

## Status

Superseded by ADR 005.

## Decision

This decision originally limited Solvane to provider APIs. ADR 005 retains that backend path as API Automation while adding an explicit, user-reviewed Browser Bridge for consumer AI websites.

## Consequences

- The product can reliably persist events, enforce security boundaries, and detect API outcomes.
- API Automation still requires API-capable provider configuration; consumer subscription limits are not an API routing signal.
- Browser Bridge does not observe provider errors or press Send automatically. It carries visible, reviewed state through the browser and keeps clipboard paste as a fallback.
