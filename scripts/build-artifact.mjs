// Fabrique une version du jeu en un seul fichier HTML (tout inclus),
// pour un aperçu local sur téléphone (la politique reste un document séparé).
// À lancer après « vite build » : npm run build:artifact

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const read = (ext) =>
  assets
    .filter((f) => f.endsWith(ext))
    .map((f) => readFileSync('dist/assets/' + f, 'utf8'))
    .join('\n');

// Les polices sont glissées dans le CSS (data:), pour que le fichier se suffise à lui-même.
const css = read('.css').replace(/url\((?:\.\/)?([\w.-]+\.woff2)\)/g, (_, file) => {
  const data = readFileSync('dist/assets/' + file).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});
const js = read('.js').replaceAll('</script', '<\\/script');
const start = html.indexOf('<!-- APP:START -->');
const end = html.indexOf('<!-- APP:END -->');
if (start < 0 || end < 0) throw new Error('Marqueurs APP:START / APP:END introuvables dans index.html');
const body = html.slice(start, end);

const out = `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Bauform</title>
<style>
${css}
</style></head><body>
${body}
<script type="module">
${js}
</script></body></html>
`;

mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/bauform.html', out);
writeFileSync('dist-artifact/privacy.html', readFileSync('dist/privacy.html', 'utf8'));
console.log('dist-artifact/bauform.html', (out.length / 1024).toFixed(1), 'Ko');
