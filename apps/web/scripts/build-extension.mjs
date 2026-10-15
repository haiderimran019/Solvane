import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = new URL("../../extension/", import.meta.url);
// Build the very same parser, redactor and merge code used by the server; no forked validator.
const source = readFileSync(new URL("../lib/checkpoint.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
writeFileSync(new URL("checkpoint-core.js", root), `// Generated from apps/web/lib/checkpoint.ts. Run npm run build:extension.\n(() => { const exports = {};\n${compiled}\nwindow.SolvaneCore = exports; })();\n`);
const files = ["manifest.json", "provider-config.js", "checkpoint-core.js", "content.js", "background.js", "app-bridge.js", "options.html", "options.js", "README.md"];
const archive = new URL("../public/solvane-extension.zip", import.meta.url);
// zip updates matching entries; this fixed list is the complete runtime payload.
execFileSync("zip", ["-j", fileURLToPath(archive), ...files.map((name) => fileURLToPath(new URL(name, root)))], { stdio: "inherit" });
