# Security and Privacy Baseline

## 1. Security objective

The product holds highly sensitive project context. The MVP must minimize collection, isolate projects, encrypt content, and make deletion real. “We summarize it” is not a privacy control.

## 2. Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| Secret | API keys, OAuth tokens, session cookies | Managed secrets vault only; never logs, snapshots, or client storage. |
| Private project content | Prompts, outputs, decisions, uploads | Encrypt at rest; restrict by project owner; content-minimized telemetry. |
| Research metadata | Source URLs, titles, claim links | Project-scoped; disclose external source access. |
| Operational metadata | Latency, provider, error class, token totals | Retain only as needed; avoid prompt/output payloads. |
| Public configuration | Supported providers, product settings | Normal application controls. |

## 3. Required controls before real-user pilot

- TLS for all client, worker, database, storage, and provider connections.
- Encryption at rest for databases and object storage.
- Per-project authorization checks on every read/write path.
- Credential envelope encryption or a managed secrets provider; database stores only a secret reference and metadata.
- Server-only provider calls. Browser code never receives platform keys.
- Structured logs with redaction and allowlisted fields.
- Explicit consent before optional product analytics. Essential authentication and device preferences remain separate from analytics consent.
- A self-service account data inventory and JSON export that excludes provider API keys and encryption material.
- Project deletion workflow that covers event content, snapshots, artifacts, and credential references.
- Dependency scanning, secret scanning, and least-privilege deployment identities.

## 4. Snapshot-specific controls

Snapshots are especially risky because they concentrate sensitive details. Before publishing, run deterministic checks for common secret formats and redact/block on a match. Expose a user edit/delete action for the state card. Do not send a snapshot to a target provider if it contains a blocked secret or has not passed validation.

## 5. Provider disclosure

Before a handoff, Solvane must clearly show the destination provider. The user is authorizing Solvane to send the selected snapshot, relevant artifacts, and current prompt to that provider. Provider retention/training terms differ and must be presented accurately in the product’s privacy notice before launch.

## 6. Threat model

| Threat | Minimum mitigation |
| --- | --- |
| Cross-project data access | Owner checks plus project-scoped queries and automated authorization tests. |
| Key exposure in logs or UI | Vault references, log redaction, client/server boundary review. |
| Prompt injection in imported content | Treat artifacts and citations as untrusted data; never let them override system instructions or authorization rules. |
| Malicious snapshot content | Schema validation, source references, size limits, user review. |
| Duplicate provider charge/output | Idempotency keys, request correlation, uncertain-timeout state. |
| Deletion gap | Deletion inventory, asynchronous job status, and verification logs. |
| Overbroad vendor transfer | Per-handoff destination disclosure and artifact allowlist. |

## 7. Privacy decisions still required

Before public launch, the founder must decide and document: data retention period, whether provider prompts/outputs may be used to improve Solvane, analytics vendor list, legal basis/region, BYOK versus managed keys, account deletion SLA, and incident-response contact.

## 8. Implemented consent and data boundary

- Essential Sites authentication and local device preferences keep the service functional.
- Optional first-party analytics is off until the user chooses it in the cookie banner.
- Analytics accepts only allowlisted event names and the metadata keys `analytics`, `mode`, `provider`, and `surface`.
- Analytics never receives prompt text, Capsule fields, messages, provider cookies, passwords, API keys, or browsing history.
- The Profile & Data Center shows account-scoped record totals and exports projects, messages, Capsule versions, handoff events, safe API-connection metadata, and analytics events.
- API credentials remain encrypted and are excluded from export. No founder-wide content dashboard or hidden administrator access is implemented.

These controls support a safer pilot but do not by themselves establish compliance with every jurisdiction. A public launch still requires an accurate privacy notice, retention/deletion policy, processor inventory, and qualified legal review.
