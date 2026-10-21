# Solvane

**Start once. Continue anywhere.** Keep your project’s goal, decisions, constraints and next step in a reviewable **Continuity Capsule**, then carry it into your next AI conversation.

**[Open Solvane →](https://haiderimran019.github.io/Solvane/)** · [Architecture](docs/01-system-architecture.md) · [Verification report](TEST_REPORT.md) · [MIT license](LICENSE)

The public app runs on **GitHub Pages**. It opens directly into a working workspace: no Solvane account, invitation, extension or API key is required. Work stays in the visitor’s browser.

## Try it in a minute

1. Open [Solvane](https://haiderimran019.github.io/Solvane/) and select **Try an example**, or **Save progress** to enter your own context.
2. Select **Review changes**. Accept or reject each addition, replacement or removal.
3. Save your selected changes as a new capsule version.
4. In **Project memory**, review the handoff, copy your capsule, and open ChatGPT, Claude, Gemini or Perplexity. Paste it into the provider and press Send yourself.
5. Use **Version history** to restore earlier context. Use **Your data** to export a JSON backup or import it in another browser.

For structured updates, select **Paste an update block** and copy the AI instruction into your conversation. Paste the returned `SOLVANE_UPDATE v1` block into Solvane. Parsing and review happen locally using the same checkpoint engine as the server app. Ordinary chat summarization is not enabled on GitHub Pages; enter a short summary manually instead.

## What visitors can use

- Multiple named projects, saved in browser local storage.
- Editable goals, tasks, decisions, constraints, completed work, questions, artifacts and next steps.
- Individual change review, with replacements and removals requiring explicit acceptance for structured updates.
- Version history, restore and undo that preserve earlier versions.
- Clipboard handoffs to four providers and `handoff.md` export for coding agents.
- JSON workspace export/import and local data reset.
- Common secret-format redaction before review and handoff.
- Responsive layouts, keyboard navigation, visible focus states and clipboard fallback.

The app adds no analytics, tracking cookies, external fonts or third-party scripts. GitHub may receive ordinary hosting request data. Local storage is specific to this browser profile; anyone using that profile can read it. Export backups regularly. Redaction recognizes common patterns, so always review your text before sharing it.

## Public workspace and server architecture

| | Public GitHub Pages app | Server app and extension |
| --- | --- | --- |
| Location | Root `index.html`, `pages/` | `apps/web`, `apps/extension` |
| Data | Browser local storage, JSON backups | Authenticated account-scoped Cloudflare D1 |
| Capture | Manual context, structured update blocks | Chat/file extraction and extension capture |
| Handoff | Review, copy, open provider, paste | Browser Bridge and extension insertion |
| AI APIs | No API keys or API calls | Server-only BYOK, routing and guarded failover |
| Hosting | GitHub Pages | Requires Worker APIs, D1, identity and secrets |

GitHub Pages serves static files; it cannot run the Worker APIs or database. The public app is a usable browser-based workflow with an explicit storage boundary. The existing server app and extension remain in the repository; they are not part of the Pages deployment. Cloud sync, AI extraction, API Automation and automatic extension insertion are not offered by the public workspace.

## Run the public app locally

Requires Node.js 22.13 or newer and Python 3 for the preview server. The Pages build has no package dependencies.

```sh
npm test
npm run build
python3 -m http.server 4173 --directory _site
```

Open `http://localhost:4173`. The build generates `_site`, including browser JavaScript from the shared TypeScript checkpoint engine. Publish `_site`, rather than the repository root. All app assets use relative paths so the `/Solvane/` project URL works.

## GitHub Pages deployment

[The Pages workflow](.github/workflows/pages.yml) runs the shared engine and workspace tests, builds the static app, and deploys `_site` on changes to the public app on `main`. Repository **Settings → Pages → Source** must be **GitHub Actions**. No hosting keys or provider credentials are needed.

The separate acceptance workflow continues to check the server app. Historical server validation and current Pages verification are recorded separately in [TEST_REPORT.md](TEST_REPORT.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `pages/` | Public workspace interface, local persistence and focused tests |
| `scripts/build-pages.mjs` | Dependency-free static build reusing the shared engine |
| `.github/workflows/pages.yml` | GitHub Pages tests, build and deployment |
| `apps/web` | Vinext/React server app, Worker APIs, D1 schema and shared capsule engine |
| `apps/extension` | Chromium Browser Bridge extension source |
| `docs` | Product, architecture, state, API, security and test documentation |

## Engineering notes

The public app uses browser-native JavaScript modules and CSS, with self-hosted Poppins fonts under the [SIL Open Font License](pages/fonts/OFL.txt). Its black, coral, cream and warm-sand interface follows the supplied design reference. The existing platform uses **TypeScript, React 19, Vinext, Cloudflare Workers, D1 (SQLite), Drizzle ORM, Tailwind CSS, Manifest V3, Node tests and Playwright**. The Pages build reuses the existing parser, redactor, diff/merge rules and capsule formatter rather than maintaining a second engine.

Solvane carries explicit, user-reviewed project state. It does not transfer hidden reasoning, provider sessions or subscriptions, bypass usage limits, or guarantee identical results across models. Provider accounts and availability are separate from Solvane.

For the server architecture, see [system architecture](docs/01-system-architecture.md), [provider adapters](docs/04-provider-adapters.md), [security and privacy](docs/05-security-privacy.md), and the [server pilot acceptance guide](docs/15-pilot-acceptance.md).
