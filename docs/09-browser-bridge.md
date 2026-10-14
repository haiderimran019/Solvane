# Browser Bridge Architecture

## Purpose

Browser Bridge is Solvane's free default mode. It lets a user continue work in another AI product using the consumer account already signed in to that website. It does not convert a ChatGPT, Claude, Gemini, or Perplexity subscription into API access.

## End-to-end flow

1. The user reviews or edits the current Continuity Capsule in the Solvane dashboard.
2. **Continue in** builds a bounded relay prompt, copies it, opens the target provider, and records a `handoff.launched` event.
3. With the extension installed, the floating Capsule control can instead capture selected text or bounded visible conversation text on a supported provider page.
4. The extension stores the pending capsule in `chrome.storage.local`, opens the target provider, and offers **Insert capsule** after the target page loads.
5. The user reviews the provider composer and presses Send. Solvane never sends automatically.
6. If provider markup has changed, the capsule remains on the clipboard for manual paste.

## Trust boundaries

- The extension runs only on the four declared provider origins.
- It reads selected text or visible DOM text; it does not read cookies, passwords, account tokens, network traffic, or hidden model reasoning.
- Pending extension handoffs are device-local and are only offered for 30 minutes.
- The hosted dashboard stores user-owned projects, capsule versions, and handoff metadata in D1 using the authenticated Site user ID.
- Dashboard privacy preferences are local to the browser. Capsule content and versions are cross-device.

## Provider DOM risk

Automatic insertion is progressive enhancement because provider HTML changes without notice. Each provider has an ordered list of composer selectors. If no supported composer is found, the extension explains that the capsule is already copied and requires manual paste. Automatic Send is deliberately excluded.

## Coding-agent mode

The dashboard can export `handoff.md` for a repository. An MVP user places it at `.solvane/handoff.md` or supplies it directly to Codex or Claude Code. A future CLI or MCP server can synchronize this file, but the file export does not claim automatic terminal integration.

## API Automation remains supported

The existing encrypted BYOK adapters, provider ordering, citations, persistent messages, snapshot reduction, and guarded fallback remain available under **Modes & settings**. Browser Bridge is the acquisition wedge; API Automation is the serious-developer path.
