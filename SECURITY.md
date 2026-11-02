# Security policy

## Supported version

Security fixes are considered for the latest code on the `main` branch. Older commits, forks, and unpublished deployments are not separately supported.

## Report a vulnerability

Please use [GitHub's private vulnerability reporting](https://github.com/haiderimran019/Solvane/security/advisories/new) so the report and any proof of concept remain private.

Include, when possible:

- the affected component and revision;
- a minimal reproduction;
- the impact you observed;
- any suggested mitigation;
- whether the issue may already have exposed data.

Do not include real API keys, provider cookies, private chats, personal data, or production database content. Use synthetic examples.

Security-sensitive areas include authentication or account isolation, API-key handling, data export or deletion, extension permissions and capture, redaction bypasses, prompt injection through captured content, and any path that could send context without explicit review.

Please do not open a public issue until a fix or safe disclosure plan is agreed. General bugs and feature requests can use the public [issue tracker](https://github.com/haiderimran019/Solvane/issues).
