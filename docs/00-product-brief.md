# Solvane MVP — Product Brief

> Status: implemented MVP. Selected product name: **Solvane**.

## 1. User problem

Solo builders and researchers use multiple AI models because each has a different strength: conversation, reasoning, long documents, or web research. A project stalls when a provider is rate-limited, fails, loses the thread, or is simply the wrong tool for the next task. The user currently has to re-explain the project manually.

## 2. Product promise

Solvane maintains a small, inspectable **Continuity Capsule** and uses it to continue the project with another selected provider. Browser Bridge works with the consumer AI accounts a user already has; API Automation remains available for developer-grade routing.

The truthful promise is **portable working state**, not “zero context loss.” A model switch may change writing style, capability, and answer quality; Solvane preserves the important explicit state so the next model starts oriented.

## 3. Primary user

An individual builder or researcher who actively alternates between Claude, Gemini, ChatGPT, and Perplexity while working on a single project.

## 4. MVP jobs to be done

1. Start a project or capture visible work from a supported AI website.
2. See the project’s current goal, decisions, open questions, sources, and next action.
3. Choose another provider and continue without composing a handoff prompt or buying API usage.
4. Recover when the active provider hits a limit, stalls, or is no longer the right tool.
5. Review and correct the relay state before a consequential handoff.

## 5. In scope

- Provider-agnostic project and session lifecycle.
- Free Browser Bridge handoffs across signed-in Claude, Gemini, ChatGPT, and Perplexity accounts.
- Optional text conversations through Solvane’s server-side provider adapters.
- Structured snapshot generation after completed turns.
- Manual Browser Bridge switch and guarded automatic API fallback.
- Claude, Gemini, OpenAI, and Perplexity adapter contracts.
- Source/citation ledger for research-originated information.
- User-visible handoff history and snapshot version history.

## 6. Explicitly out of scope

- Reading hidden content, cookies, credentials, or private model reasoning inside provider websites.
- Transferring hidden chain-of-thought, proprietary provider state, or a user’s consumer subscription quota.
- Long-term personality memory, autonomous multi-agent workflows, team sharing, billing, or retrieval/vector graphs.
- Claiming legal, medical, financial, or research verification from a model handoff.

## 7. MVP success criteria

| Outcome | Acceptance measure |
| --- | --- |
| Fast continuity | A user can switch providers from an active project in one action. |
| Accurate orientation | In controlled handoff tests, the target model correctly identifies the goal, current task, latest decision, and next action. |
| Honest recovery | Every automated switch has a visible reason, source provider, target provider, and snapshot version. |
| Protected data | Provider credentials and raw session content never appear in browser logs, analytics, or application error payloads. |
| Research integrity | A handoff that uses research retains source URLs and claim-to-source references. |

## 8. Product vocabulary

| Term | Meaning |
| --- | --- |
| Project | A durable user-owned workstream. |
| Session | An ordered set of user and model turns within a project. |
| Turn | One user input and its resulting provider output. |
| Event log | Append-only record of turns, failures, provider switches, and snapshot publication. |
| Continuity Capsule | Compact, structured, versioned representation of the current working state. |
| Browser Bridge | Free, user-reviewed handoff that opens and inserts a capsule into another signed-in AI site. |
| API Automation | Optional server-side provider routing for developers and power users. |
| Handoff | Starting a target-provider turn using a selected snapshot. |
| Provider adapter | Backend boundary that normalizes one provider’s API. |
| Citation ledger | Structured source records and the claims they support. |

## 9. Product differentiation

Solvane should be evaluated as a **session-continuity product**, not a generic memory layer. The visual proof is simple: work begins in one model, that model becomes unavailable, and another model continues with the same project constraints and next action.
