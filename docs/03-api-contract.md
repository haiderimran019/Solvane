# MVP API Contract

> Browser Bridge can operate without provider API credentials. These authenticated endpoints persist projects, capsules, handoff audit records, and optional API Automation state.

## 1. API principles

- All endpoints require authenticated project ownership.
- Client requests that create work require an idempotency key.
- Responses expose normalized provider names and stable Solvane identifiers, never raw provider credentials.
- Streaming content is delivered over a dedicated stream endpoint; final turn state is persisted before it is reported as complete.

## 2. Resource endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/projects` | Create a project. |
| `GET` | `/v1/projects/{projectId}` | Read project metadata and active state. |
| `PATCH` | `/v1/projects/{projectId}` | Rename/archive project. |
| `POST` | `/v1/projects/{projectId}/sessions` | Create a session with an initial provider. |
| `POST` | `/v1/sessions/{sessionId}/turns` | Send a user message to the active provider. |
| `GET` | `/v1/sessions/{sessionId}/turns/{turnId}` | Fetch final normalized result. |
| `GET` | `/v1/sessions/{sessionId}/stream` | Subscribe to turn progress. |
| `GET` | `/v1/projects/{projectId}/snapshots/current` | Get the latest valid state. |
| `GET` | `/v1/projects/{projectId}/snapshots` | List snapshot history. |
| `PATCH` | `/v1/projects/{projectId}/snapshots/{version}` | Submit a user correction. |
| `POST` | `/v1/sessions/{sessionId}/handoffs` | Start a manual provider switch. |
| `GET` | `/v1/projects/{projectId}/handoffs` | Read switch history. |
| `POST` | `/v1/projects/{projectId}/citations` | Add a source record or provider-extracted citation. |
| `DELETE` | `/v1/projects/{projectId}` | Request project data deletion. |

## 3. Send-turn request

```json
{
  "content": "Continue by defining our safe fallback rules.",
  "idempotency_key": "client-generated-uuid",
  "options": {
    "provider": "active",
    "allow_automatic_fallback": false
  }
}
```

`provider` may be `active` or an explicitly supported provider. The server may reject an explicit provider if it is not configured for that user. Automatic fallback remains opt-in at the user/project level in the MVP.

## 4. Handoff request

```json
{
  "target_provider": "gemini",
  "reason": "user_selected",
  "message": "Now analyze the attached long document.",
  "snapshot_version": 12,
  "idempotency_key": "client-generated-uuid"
}
```

`snapshot_version` makes a handoff reproducible. If omitted, the server uses the latest valid snapshot and returns the selected version in the response.

## 5. Handoff result

```json
{
  "handoff_id": "hof_456",
  "status": "completed",
  "from_provider": "claude",
  "to_provider": "gemini",
  "reason": "user_selected",
  "snapshot_version": 12,
  "turn_id": "trn_789",
  "user_notice": "Continued in Gemini using Snapshot v12."
}
```

## 6. Error contract

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMITED",
    "message": "The selected provider is temporarily unavailable.",
    "retryable": true,
    "request_id": "req_abc",
    "safe_fallbacks": ["openai", "gemini"]
  }
}
```

| Code | Client action |
| --- | --- |
| `PROVIDER_RATE_LIMITED` | Offer retry or approved fallback. |
| `PROVIDER_TIMEOUT_UNKNOWN` | Show pending/uncertain state; avoid blind repeat. |
| `PROVIDER_UNAVAILABLE` | Offer fallback if configured. |
| `PROVIDER_AUTH_REQUIRED` | Ask user to configure/reconnect that provider. |
| `SNAPSHOT_UNAVAILABLE` | Block automatic handoff; offer user-created state card or retry reduction. |
| `SESSION_BUSY` | Wait for active turn or allow explicit cancellation. |
| `IDEMPOTENCY_CONFLICT` | Return original operation result. |
| `PROJECT_ACCESS_DENIED` | Return no project details. |

## 7. Internal adapter interface

Every adapter accepts the same internal request shape:

```text
ProviderRequest = {
  projectId, sessionId, turnId, provider,
  systemInstructions, portableSnapshot, userMessage,
  artifacts, citationLedger, idempotencyKey, timeoutPolicy
}
```

Every adapter returns a normalized result containing response text/content blocks, citations, provider request correlation ID, usage metadata when available, provider-native continuation handle when available, and normalized failure class when unsuccessful.
