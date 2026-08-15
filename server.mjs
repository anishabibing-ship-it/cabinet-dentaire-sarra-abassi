/* Serveur statique minimal pour tester le build localement.
   Usage : node server.mjs   →   http://localhost:5173                          */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 5273;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = url === '/' ? 'cabinet-erp.html' : url.replace(/^\/+/, '');
  try {
    const buf = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable : ' + file);
  }
}).listen(PORT, () => console.log(`Cabinet Dr. Sarra Abassi — http://localhost:${PORT}`));
