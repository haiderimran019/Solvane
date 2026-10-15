# Solvane Web MVP

Cross-device Continuity Capsule workspace built with Vinext, React, Cloudflare Workers, D1, and Sites authentication. Browser Bridge is the free default; encrypted BYOK API Automation is optional and remains fully supported.

## Local setup

```bash
npm ci
npm run db:generate
npm run build
```

For a fresh checkout, apply each SQL file in `drizzle/` in filename order to the local preview database (once per migration). Use this command with each filename, then start the app:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cheerful_molten_man.sql
# Repeat for 0001_milky_mikhail_rasputin.sql and 0002_wide_stranger.sql on a fresh database.
```

```bash
npm run dev
```

Portable local development simulates sign-in at `/signin-with-chatgpt?return_to=/`.

## Environment

For the Sites local runtime, put `PROVIDER_CREDENTIAL_MASTER_KEY` in `.dev.vars`. That file is explicitly ignored and must never be committed. To enable ordinary-text checkpoint extraction for the free tier, add a server-only `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `GEMINI_DAILY_LIMIT`, and `CHECKPOINT_TOKEN_BUDGET`) to `.dev.vars` or the hosted secret store. Browser Bridge never receives that key. Provider keys are optional for the rest of the app; Browser Bridge uses the AI accounts already signed in within the user's browser, and serious developers can add encrypted BYOK connections for server-side routing and fallback.

Production values belong in Sites runtime environment variables, never source control or `.openai/hosting.json`.

## Main surfaces

- `app/relay-dashboard.tsx` — dashboard state and actions. Its views live in `app/_dashboard/` (`home`, `memory`, `checkpoint`, `activity`, `settings`, `dialogs`, `account`, and `shared` types and helpers).
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

The checkpoint regression gates are `test:checkpoint`, `test:automation`, `test:engine`, `test:providers`, and `test:extension`. Run `npm run build:extension` after changing the shared parser or extension. `tests/api-smoke.mjs` is intentionally restricted to a disposable server/database on port 5175: it deletes that test database's mock-user data and must never target the normal app on port 5173.
