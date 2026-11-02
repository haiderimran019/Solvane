# Solvane

**Start once. Continue anywhere.**

Solvane is an open-source continuity workspace for moving a project between ChatGPT, Claude, Gemini, Perplexity, Codex, and Claude Code without rebuilding the context each time.

[![Acceptance checks](https://github.com/haiderimran019/Solvane/actions/workflows/ci.yml/badge.svg)](https://github.com/haiderimran019/Solvane/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/haiderimran019/Solvane/actions/workflows/pages.yml/badge.svg)](https://github.com/haiderimran019/Solvane/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg)](LICENSE)

**[Try Solvane](https://haiderimran019.github.io/Solvane/)** · [How it works](#how-it-works) · [Contribute](CONTRIBUTING.md) · [Architecture](docs/01-system-architecture.md)

## About

AI tools are good at different things, but switching between them usually means writing the same project summary again. Solvane keeps the useful state in a small, editable **Continuity Capsule**: the goal, current task, decisions, constraints, completed work, open questions, sources, and next step.

You review every change before it is saved or shared. Solvane does not transfer hidden reasoning, provider sessions, cookies, passwords, subscriptions, or private model state.

## Try the public workspace

The [live GitHub Pages app](https://haiderimran019.github.io/Solvane/) works without an account or API key. Its data stays in your browser.

1. Select **Try an example** or create a project.
2. Add progress and choose **Review changes**.
3. Accept or reject each proposed change, then save a new version.
4. Copy the reviewed capsule and continue in another AI tool.
5. Export a JSON backup if you want to move the workspace to another browser.

The public app supports multiple projects, version history, restore, structured update blocks, JSON import/export, `handoff.md` export, and common secret-pattern redaction.

## How it works

```text
Your project
    ↓
Continuity Capsule
    ↓
Review changes
    ↓
Save a version
    ↓
Continue in another AI tool
```

The repository contains two related experiences:

| Experience | Best for | Storage | Status |
| --- | --- | --- | --- |
| Public workspace | Trying the core workflow | Browser local storage | Live on GitHub Pages |
| Server app + browser extension | Account sync, assisted capture, and optional BYOK APIs | Cloudflare D1 + extension-local data | Source available; live integration checks remain |

GitHub Pages cannot run the Worker APIs or database. Cloud sync, AI extraction, API Automation, and automatic extension insertion are therefore not part of the public workspace.

## Run it locally

The public workspace requires Node.js 22.13 or newer. Python 3 is only used here as a simple preview server.

```sh
git clone https://github.com/haiderimran019/Solvane.git
cd Solvane
npm test
npm run build
python3 -m http.server 4173 --directory _site
```

Open `http://localhost:4173`.

For the full server app and extension, see [`apps/web/README.md`](apps/web/README.md) and [`apps/extension/README.md`](apps/extension/README.md).

## Contributing

Contributions are welcome. Useful places to start include:

- making the public workspace easier to understand and use;
- improving keyboard, screen-reader, mobile, and reduced-motion behavior;
- adding edge-case tests for capsule review, version history, import/export, and redaction;
- maintaining provider fixtures and resilient browser-extension adapters;
- improving examples, diagrams, setup instructions, and privacy documentation.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. It explains the two app paths, local checks, privacy boundaries, and how to propose a change. Please use the issue templates for bugs and feature ideas.

## Project status

The local-first GitHub Pages workspace is usable today. The server app and browser extension are still pre-production: provider websites change independently, and live authentication, insertion, API fallback, cross-device isolation, and legal/privacy review need real-world verification before broader deployment claims.

See [implementation status](docs/08-implementation-status.md), [verification report](TEST_REPORT.md), and [real-world test guide](docs/11-real-world-test-guide.md) for the detailed boundary.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `pages/` | Public local-first workspace |
| `scripts/build-pages.mjs` | Static Pages build |
| `apps/web` | React/Vinext server app, Worker APIs, D1 schema, and shared capsule engine |
| `apps/extension` | Chromium Browser Bridge extension |
| `docs` | Product, architecture, security, API, and verification notes |

## Privacy and security

The public workspace adds no analytics, tracking cookies, external fonts, or third-party scripts. Its data is tied to the current browser profile, so export backups and review text before sharing it. Secret redaction is a safety aid, not a guarantee.

Please report suspected vulnerabilities privately using the instructions in [SECURITY.md](SECURITY.md). Do not include secrets, private chats, or personal data in a public issue.

## License

Solvane is available under the [MIT License](LICENSE). The bundled Poppins font files use the [SIL Open Font License](pages/fonts/OFL.txt).
