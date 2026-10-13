# Solvane — MVP Architecture Pack

**Selected product name:** Solvane.

Solvane is a backend-first workspace that preserves a project’s working state while a user moves between AI providers. It does not copy private chats from provider-owned consumer applications. Instead, the user works through Solvane, which records the session, creates a portable state snapshot, and sends that snapshot to the next chosen provider.

## The MVP in one sentence

When an AI provider is unavailable, rate-limited, or no longer the best fit, Solvane continues the same project with another provider without making the user re-explain the work.

## Architecture documents

| Document | Purpose |
| --- | --- |
| [Product brief](docs/00-product-brief.md) | Problem, audience, scope, and success criteria |
| [System architecture](docs/01-system-architecture.md) | Components, data flow, deployment boundaries, and handoff sequence |
| [State model](docs/02-state-model.md) | Canonical data entities and portable snapshot contract |
| [API contract](docs/03-api-contract.md) | MVP-facing HTTP endpoints, lifecycle, and errors |
| [Provider adapters](docs/04-provider-adapters.md) | Claude, Gemini, OpenAI, and Perplexity integration boundary |
| [Security and privacy](docs/05-security-privacy.md) | Key handling, retention, deletion, and threat controls |
| [Reliability and quality](docs/06-reliability-quality.md) | Failover policy, observability, fidelity evaluation, and tests |
| [Delivery plan](docs/07-delivery-plan.md) | Incremental build plan, release gates, and risk register |
| [Implementation status](docs/08-implementation-status.md) | What is built, configuration, and current verification evidence |
| [Architecture decisions](docs/adr/README.md) | Decisions that must stay explicit as the system evolves |

## Non-negotiable product truths

- Solvane owns the session only when conversation traffic flows through its backend.
- The canonical project state belongs to Solvane, not to any one model provider.
- A compact snapshot accelerates handoff; an immutable event log makes the snapshot auditable and recoverable.
- A switch must be visible to the user. Solvane never silently claims that two models are the same model.
- Perplexity research requires a citation ledger; a prose summary alone is insufficient.

## Initial delivery boundary

The first production slice supports account-isolated users, multiple project folders, text conversations, manual switching, and safe automatic fallback after a provider error. The private pilot currently admits only its owner; additional pilot accounts can be granted access without changing the data model. It excludes team collaboration inside one folder, browser scraping of consumer chats, autonomous agents, vector-memory graphs, payment, and enterprise compliance features.

## Implemented stack

The working MVP lives in [`apps/web`](apps/web): a Vinext/React application deployed as a Cloudflare Worker through Sites, with hosted ChatGPT sign-in, D1 persistence, Drizzle migrations, server-only provider adapters, and encrypted per-user API credentials.

The current local candidate includes the bold lime/yellow/green and black visual redesign, responsive phone/tablet/desktop layouts, and the corrected atomic message-persistence path. It remains behind the requested visual-approval gate before publication or GitHub push.

## Private pilot

- Production: <https://solvane.rareyew64.chatgpt.site>
- Access: owner-private/custom while the MVP is being verified.
- Cross-device behavior: sign in with the same ChatGPT account to load the same D1-backed folders, messages, provider order, credentials, and snapshots.
- Multi-account behavior: every record is scoped to the authenticated account. Additional pilot accounts must be explicitly admitted before they can sign in.

## Tester entry page

The repository root includes [`index.html`](index.html), a static product and testing guide that links testers to the hosted application. The full authenticated MVP is a Worker-backed application and cannot run from GitHub Pages alone; its implementation lives in [`apps/web`](apps/web).
