# Canonical State Model

## 1. Why this model exists

The model must preserve two distinct things:

1. **Evidence:** durable, ordered facts about what occurred.
2. **Working state:** a compact, portable summary that makes the next model useful immediately.

Snapshots are not evidence. They are versioned, inspectable interpretations of evidence.

## 2. Core entities

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | `id`, `created_at` | MVP supports an individual owner. |
| Project | `id`, `owner_id`, `title`, `status`, `active_session_id` | Durable scope for a task or research effort. |
| Session | `id`, `project_id`, `sequence`, `active_provider`, `status` | Ordered conversation scope. |
| Turn | `id`, `session_id`, `ordinal`, `user_content_ref`, `status` | One user intent and one execution outcome. |
| Event | `id`, `project_id`, `session_id`, `type`, `payload`, `occurred_at` | Append-only authoritative history. |
| Snapshot | `id`, `project_id`, `version`, `state`, `source_event_range`, `status` | Compact derived state. |
| Handoff | `id`, `from_provider`, `to_provider`, `reason`, `snapshot_version`, `status` | Audit record for provider transition. |
| Citation | `id`, `project_id`, `url`, `title`, `publisher`, `captured_at` | Source metadata, especially for research. |
| Claim-source link | `claim_id`, `citation_id`, `support_type` | Prevents citations becoming detached from their claims. |
| Provider credential | `id`, `owner_id`, `provider`, `secret_ref`, `mode` | Stores a secret reference only, never plaintext keys. |

## 3. Event types

| Event | Meaning |
| --- | --- |
| `project.created` | Project initialized. |
| `turn.accepted` | Input durably received. |
| `turn.completed` | Provider response normalized and stored. |
| `turn.failed` | Attempt ended without a usable result. |
| `snapshot.published` | Valid derived state became available. |
| `snapshot.corrected` | User corrected a snapshot field. |
| `handoff.started` | Target-provider handoff began. |
| `handoff.completed` | Target provider produced a usable continuation. |
| `handoff.failed` | Target provider could not continue. |
| `citation.recorded` | A research source was added. |
| `artifact.attached` | Project artifact was securely linked. |

## 4. Portable snapshot contract

This is an illustrative, human-readable contract. Enforce its formal schema in implementation.

```json
{
  "schema_version": "1.0",
  "project_id": "prj_123",
  "snapshot_version": 12,
  "created_at": "2026-10-13T10:00:00Z",
  "source_event_range": { "from": 1, "to": 48 },
  "objective": "Build and validate the Solvane MVP architecture.",
  "current_task": "Define the handoff orchestration flow.",
  "constraints": [
    "Use provider APIs; do not access consumer chat histories.",
    "Keep state portable and user-reviewable."
  ],
  "decisions": [
    {
      "id": "dec_01",
      "statement": "The event log is authoritative; snapshots are derived.",
      "source_event_id": "evt_22"
    }
  ],
  "completed": ["Defined canonical project entities."],
  "open_questions": ["Choose managed-key or BYOK launch model."],
  "next_action": "Implement and test a manual provider handoff.",
  "artifacts": [{ "id": "art_01", "label": "Architecture pack", "access": "project" }],
  "research": {
    "claims": [],
    "citation_ids": []
  },
  "handoff_instructions": {
    "continue_from": "the current task",
    "do_not_repeat": ["already-settled architecture decisions"],
    "ask_before_assuming": ["missing security or provider configuration"]
  },
  "confidence": "reviewed"
}
```

## 5. Snapshot field rules

- `objective`, `current_task`, and `next_action` are required and concise.
- A `decision` must include an event reference or user confirmation.
- A research claim must retain at least one citation reference or be marked unverified.
- `confidence` is `draft`, `reviewed`, or `user_corrected`; it is not a truth score.
- State must stay within a configurable prompt budget. The initial target is below 1,500 tokens, with a lower operating target around 800 tokens.
- Never include provider credentials, raw cookies, access tokens, or unredacted personal secrets.

## 6. Correction semantics

User edits do not rewrite history. A correction creates `snapshot.corrected`, references the earlier snapshot version, and produces a new published snapshot. This preserves trust, enables rollback, and prevents model-generated state from silently replacing user intent.

## 7. Data retention defaults

Define retention as product policy before launch. A conservative MVP default is: retain project events while the account is active; allow project-level permanent deletion; asynchronously delete derived snapshots, artifacts, and secret references; retain only minimal non-content security/audit records for a documented limited period.
