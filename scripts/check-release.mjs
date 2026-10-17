import { readFileSync } from 'node:fs';
const c = JSON.parse(readFileSync('release/config.json', 'utf8'));
const problems = [];
if (!c.publisher?.trim()) problems.push('Identité publique de l’éditeur manquante.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.supportEmail || '')) problems.push('Adresse de support manquante ou invalide.');
try { if (new URL(c.privacyUrl).protocol !== 'https:') throw Error(); } catch { problems.push('URL HTTPS publique de confidentialité manquante.'); }
const policy = readFileSync('public/privacy.html', 'utf8');
if (policy.includes('DOCUMENT PRÉPARATOIRE')) problems.push('Politique encore préparatoire : compléter les coordonnées puis relire le texte.');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Champs éditoriaux locaux présents. Accessibilité de l’URL et signature à vérifier séparément.');
