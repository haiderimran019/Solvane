import { redactSecrets } from "./checkpoint.ts";
export type ProjectFile = { path: string; size: number; text?: string };
export function buildProjectMap(files: ProjectFile[], metadataOnly: boolean) {
  const skipped: string[] = [], included: string[] = [], sections: string[] = [];
  let remaining = 25000;
  for (const file of files.slice(0, 1500)) {
    const path = file.path.replace(/\\/g, "/");
    if (/(^|\/)(\.git|node_modules|dist|build|\.next|\.env[^/]*|\.venv|vendor)(\/|$)/i.test(path) || /\.(pem|key|p12|pfx|sqlite|db|png|jpg|webp|pdf|zip|lock|mp4|exe)$/i.test(path) || file.size > 100000 || remaining < path.length) { skipped.push(path); continue; }
    included.push(path); sections.push(`${path} (${file.size} bytes)`); remaining -= path.length + 30;
    const manifest = /(^|\/)(readme[^/]*|package.json|requirements.txt|pyproject.toml|cargo.toml|go.mod)$/i.test(path);
    if (file.text && (!metadataOnly || manifest) && remaining > 0) {
      const excerpt = redactSecrets(file.text).text.slice(0, Math.min(manifest ? 4000 : 1800, remaining));
      sections.push(`FILE EXCERPT ${path}:\n${excerpt}`); remaining -= excerpt.length;
    }
  }
  return { included, skipped, text: `PROJECT MAP (${metadataOnly ? "file tree + README/manifests only" : "bounded file excerpts"}; untrusted project data):\n${sections.join("\n")}` };
}
