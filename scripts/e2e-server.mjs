// E2E-only static server for the production build (frontend/dist).
// Mimics production routing closely enough for Playwright:
//   - directory -> index.html (prerendered pages)
//   - SPA routes (no file match) -> index.html (BrowserRouter fallback)
//   - truly-missing -> 404.html (404 status, matching deployed behaviour)
// Not used at runtime; production hosting stays on Vercel.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'frontend/dist';
const PORT = 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

// SPA app routes (see vercel.json rewrites) — anything else missing is a
// true 404 via 404.html.
const SPA_PREFIXES = ['/login', '/signup', '/forgot', '/reset', '/dashboard', '/clients', '/projects', '/invoices', '/payments', '/settings', '/portal'];

function resolvePath(url) {
  for (const p of SPA_PREFIXES) if (url === p || url.startsWith(p + '/')) return join(ROOT, 'app.html');
  let file = join(ROOT, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && existsSync(file + '.html')) file = file + '.html';
  if (!existsSync(file)) {
    if (url.includes('.')) return null; // missing asset -> 404.html below
    // extensionless -> prerendered page dir without index, or SPA fallback
    const dirIndex = join(ROOT, url, 'index.html');
    return existsSync(dirIndex) ? dirIndex : join(ROOT, 'app.html');
  }
  return file;
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = resolvePath(url);
  if (file && existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  const nf = join(ROOT, '404.html');
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(existsSync(nf) ? readFileSync(nf) : 'Not found');
}).listen(PORT, () => console.log('e2e static server on ' + PORT));
