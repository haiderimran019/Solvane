import assert from "node:assert/strict";
import test from "node:test";
import { detectCompleteUpdate, detectLimitMessage, enqueueCapture, failoverPlan, markRetry, safePageDiagnostic, shouldReadForAutoDetect, shouldRemind } from "../lib/automation.ts";

const block = `<<<SOLVANE_UPDATE v1 {"decisions_add":["Use a reviewed handoff"],"done_add":[],"open_questions_add":[],"open_questions_resolve":[],"constraints_add":[],"next_step":"Run the smoke test","changes":[]} SOLVANE_UPDATE>>>`;

test("automation fixtures", async (t) => {
  await t.test("valid block is detected only after the stream closes", () => {
    assert.equal(detectCompleteUpdate(block.slice(0, -3)), null);
    const detected = detectCompleteUpdate(block);
    assert.equal(detected?.patch.decisions_add[0], "Use a reviewed handoff");
  });
  await t.test("edited messages produce a new idempotency hash", () => {
    assert.notEqual(detectCompleteUpdate(block)?.hash, detectCompleteUpdate(block.replace("Run the smoke test", "Run the regression test"))?.hash);
  });
  await t.test("invalid block falls back to capture", () => assert.equal(detectCompleteUpdate(block.replace("next_step", "unknown")), null));
  await t.test("limit patterns fail silently when text changes", () => {
    assert.equal(detectLimitMessage("claude", "usage limit reached"), true);
    assert.equal(detectLimitMessage("claude", "everything is fine"), false);
  });
  await t.test("auto-detect off performs no read", () => assert.equal(shouldReadForAutoDetect(false), false));
  await t.test("reminders respect snooze and timing", () => {
    const now = 1_800_000_000_000;
    assert.equal(shouldRemind({ startedAt: now - 31 * 60_000, now, messageCount: 2 }), true);
    assert.equal(shouldRemind({ startedAt: now - 31 * 60_000, now, messageCount: 2, snoozedUntil: now + 60_000 }), false);
  });
  await t.test("offline queue deduplicates and backs off", () => {
    const item = { id: "a", folderId: "f", text: "x", hash: "h", attempts: 0, nextAttemptAt: 0 };
    const queue = enqueueCapture([], item, 10);
    assert.equal(enqueueCapture(queue, item, 11).length, 1);
    assert.equal(markRetry(queue, "a", 100)[0].nextAttemptAt, 1_100);
  });
  await t.test("diagnostic excludes page content", () => {
    const diagnostic = safePageDiagnostic("claude", "fixture-1", "https://claude.ai/chat/secret");
    assert.match(diagnostic, /content_excluded=true/);
    assert.doesNotMatch(diagnostic, /secret/);
  });
  await t.test("API failover skips disconnected providers", () => assert.deepEqual(failoverPlan(["claude", "gemini", "openai", "perplexity"], "claude", new Set(["openai", "perplexity"])), ["openai", "perplexity"]));
});
