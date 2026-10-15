# ADR 001: Event log is authoritative; snapshots are derived

## Status

Accepted.

## Decision

Store an append-only event history for project turns, provider results, citations, user corrections, and handoffs. Generate compact snapshots from referenced ranges of that history.

## Consequences

- Bad summaries can be replaced without losing source facts.
- A handoff is reproducible against a snapshot version.
- Storage and deletion responsibilities are more explicit than a summary-only design.

## Rejected alternative

Make the latest AI-generated summary the only durable session state. This is cheaper initially but creates irrecoverable context loss and makes user trust impossible to earn.
