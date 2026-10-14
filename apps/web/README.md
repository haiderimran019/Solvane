# Solvane Web MVP

Cross-device Continuity Capsule workspace built with Vinext, React, Cloudflare Workers, D1, and Sites authentication. Browser Bridge is the free default; encrypted BYOK API Automation is optional and remains fully supported.

## Local setup

```bash
npm ci
npm run db:generate
npm run build
```

Apply the generated D1 migration to local preview state using the command documented in the generated Sites starter/runtime instructions, then run:

```bash
npm run dev
```

Portable local development simulates sign-in at `/signin-with-chatgpt?return_to=/`.

## Environment

For the Sites local runtime, put `PROVIDER_CREDENTIAL_MASTER_KEY` in `.dev.vars`. That file is explicitly ignored and must never be committed. Provider keys are optional. Browser Bridge uses the AI accounts already signed in within the user's browser; serious developers can add encrypted BYOK connections for server-side routing and fallback.

Production values belong in Sites runtime environment variables, never source control or `.openai/hosting.json`.

## Main surfaces

- `app/relay-dashboard.tsx` — authenticated product dashboard.
- `app/api/bootstrap` — account-scoped folders and connection status.
- `app/api/folders` — folder creation and settings.
- `app/api/chat` — provider routing, fallback, persistence, and citations.
- `app/api/providers` — encrypted BYOK connection management.
- `app/api/snapshots` — portable state reduction and versioning.
- `app/api/handoffs` — account-scoped Browser Bridge activity records.
- `lib/providers.ts` — normalized four-provider adapter boundary.
- `db/schema.ts` — D1 schema for folders, messages, events, snapshots, and credentials.

## Security boundaries

- All user-owned queries include the stable authenticated user ID.
- Provider keys are encrypted with AES-GCM before database storage.
- API responses expose connection status, never stored credential values.
- Provider requests are server-side only.
- Browser Bridge copies only the reviewed capsule; the companion extension reads visible or selected page text and never presses Send.
- The deployed Site remains owner-private until access policy is deliberately widened for a pilot.

## Verification

Before publishing, run `npx tsc --noEmit` and `npm run build`, then verify the authenticated dashboard at phone, tablet, and desktop widths. Test extension insertion separately on every supported provider because their page markup can change. Live API-provider success and cross-provider fallback checks require real credentials and quota; do not report them as passed based only on a build or simulated failure.
