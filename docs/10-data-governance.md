# Solvane Data Governance for the Pilot

## What a signed-in user can see

Open the avatar in the app header to reach **Profile & Data Center**. It shows live counts for projects, Capsule versions, API messages, handoffs, connected API credentials, and consented analytics events. **Download all my data** exports the complete account-owned record set as JSON.

The export contains safe API-connection metadata such as provider, model, and timestamps. It never contains an API key, encryption material, provider password, provider cookie, or hidden browser history.

## What Solvane stores

| Category | Purpose | Scope |
| --- | --- | --- |
| Account identity | Authenticate and isolate data | Sites-provided stable user ID, display name, email |
| Projects and Capsules | Cross-device continuity | Account-scoped project settings and versioned state |
| API-mode messages | User-requested automated relay | Account and project scoped |
| Handoff events | Visible activity history | Destination, mode, Capsule version, timestamp |
| Encrypted API credentials | Optional API Automation | Server-only encrypted value and model metadata |
| Optional analytics | Improve navigation and handoff usability | Allowlisted action name, route, bounded non-content metadata, timestamp |
| Device preferences | Privacy selections and UI preference | Browser local storage |

## Consent model

Essential authentication and local preferences are necessary for the service. Optional first-party product analytics starts only after the user selects **Allow product analytics**. Selecting **Essential only** records no analytics event. The choice can be changed from Profile & Data Center.

The analytics endpoint rejects unknown event names and removes unknown metadata fields. It has no field for prompts, messages, Capsule text, cookies, passwords, or browsing history.

## Authentication boundary

ChatGPT sign-in is provided by the Sites runtime. Google and GitHub require separately registered OAuth applications, verified production callback URLs, and secret configuration. They remain visibly marked **Setup required** until those real integrations exist; Solvane does not simulate them.

## Founder visibility

The MVP intentionally does not provide a founder dashboard for reading every user’s private project content. Each user can inspect and export their own data. Before broader testing, define a least-privilege support process, retention/deletion schedule, privacy notice, legal basis, subprocessor list, and incident-response owner.
