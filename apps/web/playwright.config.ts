// @ts-nocheck
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.05 } },
  use: {
    baseURL: "http://127.0.0.1:5174",
    extraHTTPHeaders: {
      "oai-authenticated-user-id": "playwright-checkpoint-user",
      "oai-authenticated-user-email": "checkpoint@example.com",
      "oai-authenticated-user-full-name": "Checkpoint%20Tester",
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174/favicon.svg",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
