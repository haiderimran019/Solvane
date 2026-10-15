import assert from "node:assert/strict";
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
