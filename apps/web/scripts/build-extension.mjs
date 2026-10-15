import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = new URL("../../extension/", import.meta.url);
// Build the very same parser, redactor and merge code used by the server; no forked validator.
const source = readFileSync(new URL("../lib/checkpoint.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
writeFileSync(new URL("checkpoint-core.js", root), `// Generated from apps/web/lib/checkpoint.ts. Run npm run build:extension.\n(() => { const exports = {};\n${compiled}\nwindow.SolvaneCore = exports; })();\n`);
const files = ["manifest.json", "provider-config.js", "checkpoint-core.js", "content.js", "background.js", "app-bridge.js", "options.html", "options.js", "README.md"];
const archive = fileURLToPath(new URL("../public/solvane-extension.zip", import.meta.url));
// The unpacked source keeps the local dev origin for development; the release zip ships production origins only.
const DEV_ORIGIN = "http://127.0.0.1:5173/*";
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
manifest.host_permissions = manifest.host_permissions.filter((host) => host !== DEV_ORIGIN);
manifest.content_scripts = manifest.content_scripts.map((script) => ({ ...script, matches: script.matches.filter((match) => match !== DEV_ORIGIN) }));
const stage = mkdtempSync(join(tmpdir(), "solvane-extension-"));
try {
  for (const name of files) copyFileSync(new URL(name, root), join(stage, name));
  writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // Rebuild the archive from scratch so files dropped from the list never linger in it.
  rmSync(archive, { force: true });
  execFileSync("zip", ["-j", "-X", archive, ...files.map((name) => join(stage, name))], { stdio: "inherit" });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
