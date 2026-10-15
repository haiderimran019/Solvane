# Focused v1 experience

## Product promise

Solvane lets a person keep working on one project when Claude stops, without rebuilding the project inside Solvane and without re-explaining it to ChatGPT.

## Default journey

1. The user works normally in Claude.
2. Solvane's browser companion saves explicit progress into the linked project.
3. Gemini converts new, redacted text into a small patch when a valid Solvane update block is not already present.
4. The user reviews the material that will become project memory.
5. Solvane creates a recoverable capsule version.
6. The user chooses Continue in ChatGPT.
7. Solvane shows the exact payload, copies it, and opens the official ChatGPT site. It never presses Send.

## Information architecture

- **Home:** current project, continuity readiness, next action, Save and Continue.
- **Project memory:** the detailed, editable capsule and Trust Preview.
- **Save progress:** pasted or captured text, Gemini/local extraction, diff review, versioned save.
- **Activity:** handoff and capsule-version history.
- **Advanced:** provider order, Browser Bridge download, privacy controls, optional API Automation, metrics and data controls.

## Design direction

The interface uses calm off-white surfaces, soft depth, compact rounded cards, a dark mobile dock, teal continuity accents, and Manrope typography. The dominant screen avoids engineering language and exposes one obvious action at a time. Technical controls remain accessible but are not allowed to compete with the core handoff story.

The browser companion uses the same design system: a small dark/teal Save progress chip and a light review drawer. It defaults new users to ChatGPT after Claude, while keeping the existing provider chooser and stored per-project order.

## Scope boundary

The browser product and Claude → ChatGPT story are the v1 acceptance target. Gemini, Perplexity, coding-agent exports, API Automation, desktop capture, and mobile sharing remain supported foundations or future routes; they do not expand the default onboarding flow.

## Acceptance gate

A real user must be able to work in Claude, save progress, review the capsule update, continue in ChatGPT, and receive a correct restatement and next step in under one minute. Local UI and deterministic tests do not replace that live-provider test.
