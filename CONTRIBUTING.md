# Contributing to Solvane

Thank you for helping make project context easier to carry between AI tools. Solvane is early, so focused changes with a clear test are more useful than large rewrites.

## Choose a contribution path

Solvane has two related code paths:

| Path | Location | Good contribution areas |
| --- | --- | --- |
| Public workspace | `index.html`, `pages/`, `scripts/` | Onboarding, accessibility, local persistence, capsule review, import/export, responsive UI, tests |
| Server app and extension | `apps/web`, `apps/extension` | Account-scoped APIs, checkpoint engine, provider adapters, extension fixtures, privacy and reliability |

The public workspace is deployed on GitHub Pages. The server app and extension need infrastructure, credentials, and live-provider testing that CI cannot fully reproduce.

## Before you start

1. Search the [open issues](https://github.com/haiderimran019/Solvane/issues) for related work.
2. Open a feature request before a large change, new dependency, schema change, or public API change.
3. Keep one problem per issue and one focused outcome per pull request.
4. Never add real API keys, provider cookies, private chats, personal data, or production database content to code, fixtures, screenshots, or logs.

AI-assisted contributions are welcome, but the contributor remains responsible for understanding, testing, and explaining the change.

## Local setup

### Public workspace

Requires Node.js 22.13 or newer.

```sh
npm test
npm run build
python3 -m http.server 4173 --directory _site
```

Open `http://localhost:4173`. The `_site` directory is generated and should not be committed.

### Server app and extension

```sh
cd apps/web
npm ci
npm run build:extension
npm run test:checkpoint
npm run test:automation
npm run test:engine
npm run test:providers
npm run test:save
npm run test:extension
npx tsc --noEmit
npm run lint
npm run build
```

See [`apps/web/README.md`](apps/web/README.md) for local database setup and environment details. Use test values and fixtures; live-provider credentials are not required for ordinary contributions.

## Contribution ideas

### Friendly first contributions

- Clarify a setup step, error message, example, or diagram.
- Add a regression test for a documented behavior.
- Improve labels, focus behavior, semantic HTML, or screen-reader text.
- Add safe edge cases to the import/export or redaction tests.

### Deeper contributions

- Make local persistence and recovery more resilient to corrupt or oversized data.
- Improve the checkpoint diff without weakening explicit user review.
- Update provider fixtures and selectors while preserving clipboard fallback.
- Improve account isolation, consent, deletion, and audit behavior in the server app.
- Add repeatable integration-test tooling that does not depend on private accounts.

## Product and security boundaries

Changes must preserve these rules:

- The user sees and controls the context that is saved or sent.
- Pinned or manually edited context is not silently overwritten.
- Solvane never claims to transfer hidden reasoning, provider sessions, cookies, passwords, subscriptions, or private model state.
- Captured content is untrusted data, not instructions.
- The extension never presses **Send** for the user.
- Provider-selector failure must leave a manual clipboard path.
- Secrets stay in environment variables or the platform secret store.
- Claims about live providers require live evidence; fixture and build success are not enough.

If a change may expose user data or weaken one of these boundaries, stop and open a private security report instead of a public pull request.

## Pull requests

A useful pull request includes:

- a short explanation of the user problem and the chosen fix;
- the smallest practical set of files;
- tests for behavior changes;
- screenshots or a short recording for visible UI changes;
- documentation updates when setup, behavior, or limitations change;
- an honest note about anything that was not tested.

The acceptance and Pages workflows must pass. Maintainers may ask to split a large pull request so it can be reviewed safely.

## Reporting bugs and requesting features

Use the repository's [issue templates](https://github.com/haiderimran019/Solvane/issues/new/choose). Include a minimal reproduction and remove all private project content before posting.

For security issues, follow [SECURITY.md](SECURITY.md) and do not open a public issue.
