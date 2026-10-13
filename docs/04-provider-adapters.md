# Provider Adapter Architecture

## 1. Adapter purpose

Adapters make the rest of Solvane independent from individual provider request formats, streaming protocols, continuation IDs, attachments, and error codes.

The provider API—not the provider’s consumer chat product—is the integration surface. A consumer subscription does not automatically grant API usage or server-side access to consumer chat history.

## 2. Required adapter capabilities

| Capability | Requirement |
| --- | --- |
| `sendTurn` | Send canonical content and return normalized streamed/final output. |
| `classifyFailure` | Map provider failures to Solvane’s safe error taxonomy. |
| `health` | Report configuration and recent availability without leaking credentials. |
| `extractCitations` | Return source/citation metadata if supplied by the provider. |
| `attachArtifacts` | Report supported artifact modes; reject unsupported modes clearly. |
| `continuationHandle` | Preserve a provider-native handle as an optional performance optimization. |
| `estimateCost` | Return best-effort usage/cost metadata where available. |

## 3. Provider roles in the MVP

| Provider | Default product role | What Solvane must preserve |
| --- | --- | --- |
| Claude | General project conversation and drafting | Normalized response, native handle, attachments/citations if used |
| Gemini | Large-context and document-oriented continuation | File/artifact references, extraction provenance, native handle |
| OpenAI | General project conversation and structured output | Normalized response, native handle, structured-output validation |
| Perplexity | Research-oriented responses | Source URLs, titles, provider citation IDs, claim links |

Roles are defaults, not routing mandates. The user retains provider choice. Do not market an adapter role as a guarantee of answer quality.

## 4. Provider selection policy

### Manual switch

Manual selection always wins when the provider is configured and healthy enough to attempt. Solvane builds a new target request from portable state rather than exposing raw cross-provider transcript internals.

### Automatic fallback

Automatic fallback is permitted only when all conditions hold:

1. The user or project has opted in.
2. The error is classified as retryable and eligible (for example rate limiting or service unavailability).
3. A latest valid snapshot exists.
4. The target provider has an active credential/configuration.
5. No target attempt has already been made for the same turn and idempotency key.

Default automatic fallback order should be user-configurable. Do not infer that a lower-cost provider is acceptable for a sensitive or complex task.

## 5. Handoff prompt assembly

Prompt assembly is a controlled server function, not free-form concatenation:

1. Stable Solvane instruction: explain that this is a continuation and prohibit invention of missing history.
2. Portable snapshot: bounded structured working state.
3. Citation ledger: only citations relevant to active research claims.
4. Artifact manifest: IDs, labels, permissions, and provider-compatible representations.
5. Current user message: always last, so it has clear recency.

Do not paste raw prior provider system prompts, hidden reasoning, API secrets, or unrelated transcript history into the target request.

## 6. Research source integrity

If a provider supplies a citation, store its canonical URL and metadata when available. If a model makes a claim without citation support, mark it as model-generated and unverified. A target provider must receive the source ledger as data, not as a statement that every claim is true.

## 7. Provider configuration modes

| Mode | MVP fit | Trade-off |
| --- | --- | --- |
| Solvane-managed key | Best onboarding simplicity | Solvane pays usage cost and carries stronger security/abuse obligations. |
| Bring your own key (BYOK) | Best early cost containment and user control | Requires secure key management and more setup. |

Choose one primary launch mode. Supporting both is possible but should not delay core handoff reliability.
