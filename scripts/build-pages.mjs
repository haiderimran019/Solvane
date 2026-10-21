import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

await rm('_site', { recursive: true, force: true });
await mkdir('_site/lib', { recursive: true });
await copyFile('index.html', '_site/index.html');
for (const file of ['app.mjs', 'workspace.mjs', 'styles.css']) {
  await copyFile(`pages/${file}`, `_site/${file}`);
}
// The public workspace uses the same parsing, review and handoff engine as the server app.
for (const name of ['checkpoint', 'product']) {
  const source = await readFile(`apps/web/lib/${name}.ts`, 'utf8');
  await writeFile(`_site/lib/${name}.mjs`, stripTypeScriptTypes(source));
}
await copyFile('apps/web/public/favicon.svg', '_site/favicon.svg');
await copyFile('LICENSE', '_site/LICENSE');
await writeFile('_site/.nojekyll', '');
console.log('Built GitHub Pages workspace in _site (no server or secrets required).');
