import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extension = join(here, "..");
const manifest = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
const content = await readFile(join(extension, "content.js"), "utf8");
const config = await readFile(join(extension, "provider-config.js"), "utf8");
const background = await readFile(join(extension, "background.js"), "utf8");
const options = await readFile(join(extension, "options.js"), "utf8");
const core = await readFile(join(extension, "checkpoint-core.js"), "utf8");

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions.sort(), ["clipboardWrite", "storage"]);
assert.ok(manifest.host_permissions.every((host) => host.includes("chatgpt.com") || host.includes("claude.ai") || host.includes("gemini.google.com") || host.includes("perplexity.ai") || host.includes("solvane.rareyew64.chatgpt.site") || host.includes("127.0.0.1:5173")));
assert.deepEqual(manifest.content_scripts[0].js, ["provider-config.js", "checkpoint-core.js", "content.js"]);
assert.equal(manifest.background.service_worker, "background.js");
assert.equal(manifest.options_ui.page, "options.html");
assert.match(content, /api\/checkpoint/);
assert.match(content, /altKey/);
assert.match(content, /navigator\.clipboard/);
assert.match(content, /sv-review/);
assert.match(content, /SolvaneCore.redactSecrets/);
assert.match(content, /solvaneBindings/);
assert.match(content, /pendingBinding: null/);
assert.match(content, /isUnscopedPage/);
assert.match(content, /Linked for this new chat/);
assert.match(content, /rejects: new Set\(\)/);
assert.match(content, /state\.rejects\.has\(item\.key\)/);
assert.match(content, /state\.rejects\.delete\(button\.dataset\.accept\)/);
assert.match(content, /state\.rejects\.add\(button\.dataset\.reject\)/);
assert.match(content, /defaultHandoff: "openai"/);
assert.match(content, /Save project progress/);
// Handoffs use the dashboard's builder (compiled into checkpoint-core.js), not a separate JSON dump.
assert.match(content, /SolvaneCore\.buildCapsulePrompt/);
assert.match(core, /function buildCapsulePrompt/);
assert.doesNotMatch(content, /JSON\.stringify\(value, null, 2\)/);
// Mac shortcut, link storage, capture expiry, and no direct page-origin requests to Solvane.
assert.match(content, /event\.code === "KeyS"/);
assert.match(content, /setStorage\(chrome\.storage\.local, \{ solvaneBindings/);
assert.doesNotMatch(content, /setStorage\(chrome\.storage\.sync, \{ solvaneBindings/);
assert.match(content, /QUEUE_TTL_MS/);
assert.doesNotMatch(content, /\bfetch\(/);
assert.doesNotMatch(background, /127\.0\.0\.1/);

// The release zip is built from the source with production origins only.
const archive = join(extension, "..", "web", "public", "solvane-extension.zip");
const released = JSON.parse(execFileSync("unzip", ["-p", archive, "manifest.json"], { encoding: "utf8" }));
assert.equal(released.version, manifest.version, "run npm run build:extension after changing the extension");
assert.ok(!JSON.stringify(released).includes("127.0.0.1"), "the release manifest must not include the local dev origin");
assert.deepEqual(released.content_scripts[1].matches, ["https://solvane.rareyew64.chatgpt.site/*"]);
assert.match(config, /version:/);
for (const path of ['openai: {', 'claude: {', 'gemini: {', 'perplexity: {']) {
  const section = config.slice(config.indexOf(path), config.indexOf('},', config.indexOf(path)) + 2);
  assert.match(section, /unscopedPaths:/, `${path} must define generic new-chat paths`);
}
assert.match(background, /solvane-api/);
assert.match(options, /autoDetect/);
for (const provider of ["chatgpt", "claude", "gemini", "perplexity"]) {
  const fixture = await readFile(join(extension, "fixtures", `${provider}.html`), "utf8");
  assert.ok(fixture.includes("<main>"), `${provider} fixture should contain a main region`);
}

console.log("extension contract: manifest, runtime, selector, and fixture assertions passed");
