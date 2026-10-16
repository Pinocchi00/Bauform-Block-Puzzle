// Fabrique une version du jeu en un seul fichier HTML (tout inclus),
// pour la publier comme page à ouvrir sur le téléphone.
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

const out = `<title>Bauform</title>
<style>
${css}
</style>
${body}
<script type="module">
${js}
</script>
`;

mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/bauform.html', out);
console.log('dist-artifact/bauform.html', (out.length / 1024).toFixed(1), 'Ko');
