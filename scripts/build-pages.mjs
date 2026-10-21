import { mkdir, readFile, writeFile, copyFile, cp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';

await rm('_site', { recursive: true, force: true });
await mkdir('_site/lib', { recursive: true });
const stylesheet = await readFile('pages/styles.css', 'utf8');
const stylesheetName = `styles-${createHash('sha256').update(stylesheet).digest('hex').slice(0, 12)}.css`;
await writeFile(`_site/${stylesheetName}`, stylesheet);
const html = await readFile('index.html', 'utf8');
await writeFile('_site/index.html', html.replace('./styles.css', `./${stylesheetName}`));
for (const file of ['app.mjs', 'workspace.mjs']) {
  await copyFile(`pages/${file}`, `_site/${file}`);
}
// The public workspace uses the same parsing, review and handoff engine as the server app.
for (const name of ['checkpoint', 'product']) {
  const source = await readFile(`apps/web/lib/${name}.ts`, 'utf8');
  await writeFile(`_site/lib/${name}.mjs`, stripTypeScriptTypes(source));
}
await cp('pages/fonts', '_site/fonts', { recursive: true });
await copyFile('pages/favicon.svg', '_site/favicon.svg');
await copyFile('LICENSE', '_site/LICENSE');
await writeFile('_site/.nojekyll', '');
console.log('Built GitHub Pages workspace in _site (no server or secrets required).');
