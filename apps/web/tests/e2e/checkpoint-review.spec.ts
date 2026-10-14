import { expect, test, type Page, type Route } from "@playwright/test";
import { applyCheckpointPatch, diffCheckpoint, estimatePatchTokens, type CheckpointPatch } from "../../lib/checkpoint";
import { normalizeSnapshot, type RelaySnapshot } from "../../lib/product";

const folder = {
  id: "folder-checkpoint-review",
  name: "Checkpoint regression",
  description: "Review every capsule change before it is saved.",
  providerOrder: ["claude", "gemini", "openai", "perplexity"],
  autoFallback: true,
  updatedAt: "2026-10-14T10:00:00.000Z",
};

const original: RelaySnapshot = normalizeSnapshot({
  objective: "Ship the habit tracker",
  currentTask: "Implement the daily streak",
  nextAction: "Send a message to establish the project state.",
});

const patch: CheckpointPatch = {
  decisions_add: ["Use local persistence for the pilot."],
  done_add: ["Built the tracker shell."],
  open_questions_add: [],
  open_questions_resolve: [],
  constraints_add: ["Local persistence must be used for the pilot."],
  next_step: "Write the streak logic.",
  changes: [{
    field: "next_step",
    from: original.nextAction,
    to: "Write the streak logic.",
    source_excerpt: "The next step is to write the streak logic.",
  }],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function prepare(page: Page) {
  let state = original;
  let version = 1;
  let commitAcceptedKeys: string[] = [];
  const previewDiff = diffCheckpoint(original, patch);

  await page.addInitScript(() => {
    localStorage.setItem("solvane-consent-v1", JSON.stringify({ essential: true, analytics: false, decidedAt: "2026-10-14T10:00:00.000Z", version: "1.0" }));
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/bootstrap") return json(route, { folders: [folder], providers: [] });
    if (url.pathname === `/api/folders/${folder.id}`) return json(route, { folder, messages: [], snapshot: { version, state, createdAt: "2026-10-14T10:00:00.000Z", schemaVersion: 1, pinnedFields: [] } });
    if (url.pathname === "/api/snapshots") return json(route, { snapshots: [] });
    if (url.pathname === "/api/handoffs") return json(route, { handoffs: [], failovers: [] });
    if (url.pathname === "/api/checkpoint" && request.method() === "POST") {
      const payload = request.postDataJSON() as { mode: string; acceptedKeys?: string[] };
      if (payload.mode === "preview") return json(route, { checkpointHash: "fixture-hash", baseVersion: version, source: "gemini", redactedCount: 0, patch, diff: previewDiff, current: state, tokenEstimate: estimatePatchTokens(patch), pinnedFields: [] });
      commitAcceptedKeys = payload.acceptedKeys ?? [];
      const previousState = state;
      state = applyCheckpointPatch(state, patch, new Set(commitAcceptedKeys));
      version += 1;
      return json(route, { idempotent: false, snapshot: { version, state, createdAt: "2026-10-14T10:01:00.000Z" }, previousState, source: "gemini", redactedCount: 0, diff: previewDiff });
    }
    return json(route, { error: `Unexpected test request: ${url.pathname}` }, 500);
  });

  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1280) <= 600) await page.getByRole("button", { name: "Save", exact: true }).click();
  else await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Save checkpoint" }).click();
  await page.getByRole("textbox", { name: "Paste your recent chat or update block here." }).fill("Use local persistence. The tracker shell is built. Next, write the streak logic.");
  await page.getByRole("button", { name: "Save checkpoint", exact: true }).nth(1).click();
  await expect(page.getByRole("heading", { name: "Gemini drafted this patch" })).toBeVisible();
  return { previewDiff, acceptedKeys: () => commitAcceptedKeys };
}

test("Accept and Reject work for Added and Changed rows, and save applies exactly accepted items", async ({ page }) => {
  const harness = await prepare(page);
  const addedRows = page.locator(".diff-group.added .diff-item");
  const changedRows = page.locator(".diff-group.changed .diff-item");
  await expect(addedRows).toHaveCount(2);
  await expect(changedRows).toHaveCount(1);
  await expect(changedRows.getByText("Next step", { exact: true })).toHaveCount(1);
  await expect(changedRows.getByText("nextAction", { exact: true })).toHaveCount(0);

  const changedAccept = changedRows.getByRole("button", { name: "Accept" });
  const changedReject = changedRows.getByRole("button", { name: "Reject" });
  await expect(changedAccept).toHaveAttribute("aria-pressed", "false");
  await expect(changedReject).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/2 accepted.*1 still to review/)).toBeVisible();

  await changedAccept.click();
  await expect(changedAccept).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/3 accepted/)).toBeVisible();
  await changedReject.click();
  await expect(changedReject).toHaveAttribute("aria-pressed", "true");
  await expect(changedAccept).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/2 accepted.*1 rejected/)).toBeVisible();
  await changedAccept.click();

  const completedRow = addedRows.filter({ hasText: "Built the tracker shell." });
  await completedRow.getByRole("button", { name: "Reject" }).click();
  await expect(completedRow.getByRole("button", { name: "Reject" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/2 accepted.*1 rejected/)).toBeVisible();

  await page.getByRole("button", { name: "Accept & save capsule" }).click();
  await expect(page.getByText("Saved (v2)", { exact: true })).toBeVisible();
  expect(harness.acceptedKeys()).toHaveLength(2);
  expect(harness.acceptedKeys()).toContain(harness.previewDiff.find((item) => item.field === "nextAction")?.key);
  expect(harness.acceptedKeys()).not.toContain(harness.previewDiff.find((item) => item.field === "completed")?.key);
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Continuity" }).click();
  await expect(page.getByRole("heading", { name: "Write the streak logic." })).toBeVisible();
  await expect(page.getByText("Built the tracker shell.", { exact: true })).toHaveCount(0);
});

test("Changed row layout remains compact on desktop", async ({ page }) => {
  await prepare(page);
  await expect(page.locator(".diff-group.changed")).toHaveScreenshot("checkpoint-change-desktop.png", { animations: "disabled" });
});

test("Changed row layout remains compact at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await expect(page.locator(".diff-group.changed")).toHaveScreenshot("checkpoint-change-mobile-390.png", { animations: "disabled" });
});
