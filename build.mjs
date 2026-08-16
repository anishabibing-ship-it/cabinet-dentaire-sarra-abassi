/* Assemble les sources en un fichier HTML autonome.
   Deux sorties :
     dist/cabinet-erp.html          document complet (poste local, hébergeur statique)
     dist/cabinet-erp.artifact.html fragment sans <html>/<head>/<body> (publication Artifact)
   Usage : node build.mjs                                                        */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

const read = p => readFile(p, 'utf8');

const css = await read(join(src, 'css', 'app.css'));

const jsDir = join(src, 'js');
const jsFiles = (await readdir(jsDir)).filter(f => f.endsWith('.js')).sort();
const js = (await Promise.all(jsFiles.map(f => read(join(jsDir, f)))))
  .map((code, i) => `/* ===== ${jsFiles[i]} ===== */\n${code}`)
  .join('\n\n');

/* Une chaîne fermant la balise casserait le script en ligne */
const safeJs = js.replace(/<\/script/gi, '<\\/script');

/* Les remplacements passent par une fonction : sinon $&, $' et $` du code
   source seraient interprétés comme des motifs de substitution. */
const shell = await read(join(src, 'index.html'));
const body = shell
  .replace('<!--@CSS-->', () => `<style>\n${css}\n</style>`)
  .replace('<!--@JS-->', () => `<script>\n${safeJs}\n</script>`);

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Progiciel de gestion du cabinet dentaire Dr. Sarra Abassi : agenda, dossiers patients, odontogramme, facturation, CNAM, stock, laboratoire et comptabilité.">
<meta name="color-scheme" content="light dark">
${body}
</html>`;

await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'cabinet-erp.html'), page, 'utf8');
await writeFile(join(dist, 'cabinet-erp.artifact.html'), body, 'utf8');

/* Racine du dépôt : point d'entrée servi par GitHub Pages */
await writeFile(join(root, 'index.html'), page, 'utf8');
await writeFile(join(root, '.nojekyll'), '', 'utf8');

const ko = n => (n / 1024).toFixed(0) + ' Ko';
console.log(`Sources    : ${jsFiles.length} fichiers JS + 1 feuille de style`);
console.log(`dist/cabinet-erp.html           ${ko(page.length)}`);
console.log(`dist/cabinet-erp.artifact.html  ${ko(body.length)}`);
console.log(`index.html (GitHub Pages)       ${ko(page.length)}`);
