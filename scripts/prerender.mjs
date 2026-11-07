// Prerender: builds server HTML for every public route and injects it into
// <div id="root">, then sets per-route title/description/canonical/OG tags.
// Without this, crawlers that skip JavaScript see an empty #root.
// Usage: node scripts/prerender.mjs [distDir]   (default: frontend/dist)
// Warns and exits 0 without dist/index.html so a partial build never hard-fails.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const BASE = 'https://ujrat.ninety5.in';

const ROUTES = [
  { path: '/', title: 'Ujrat — Free Freelance Invoicing, GST & Zero-Fee UPI Payments Platform', description: 'The free workspace for Indian freelancers. Manage clients, create digital contracts, generate GST invoices, and get paid directly via zero-fee UPI QR codes.' },
  { path: '/privacy', title: 'Privacy Policy', description: 'Ujrat Privacy Policy and Digital Personal Data Protection (DPDP) Act 2023 compliance guidelines for Indian freelancers.' },
  { path: '/terms', title: 'Terms of Service', description: 'Ujrat Terms of Service and legal usage agreement under the Indian Information Technology Act 2000.' },
  { path: '/security', title: 'Security & Isolation Architecture', description: 'Ujrat security model: PostgreSQL Row-Level Security, private storage escrow, and tamper-evident audit logs.' },
  { path: '/pricing', title: 'Free Pricing — No Subscription, No Commission', description: 'Ujrat is free to use. No monthly subscription, 0% payment gateway commission, and no client limits for Indian freelancers.' },
  { path: '/features', title: 'Freelance CRM, GST Invoices & UPI Payments Features', description: "Explore Ujrat's freelance workspace: client CRM, contract templates, digital signature audit trails, Indian GST invoices, and zero-fee UPI QR payments." },
  { path: '/gst', title: 'Indian GST Invoicing for Freelancers — CGST, SGST, IGST & SAC 998314', description: 'GST calculation for freelancers: place-of-supply routing for CGST + SGST vs IGST, HSN/SAC codes, and Section 194J TDS handling.' },
  { path: '/upi', title: 'Zero-Fee UPI QR & Intent Payment Invoicing for Freelancers | Ujrat', description: 'Accept freelance client payments with 0% payment gateway commission. Generate dynamic UPI QR codes and intent links compatible with GPay, PhonePe, and Paytm.' },
  { path: '/contracts', title: 'Freelance Contracts & Signature Audit Trails | Ujrat', description: 'Create freelance agreements in India with a tamper-evident signature audit trail: signer email, UTC timestamp, IP address, and browser metadata.' },
  { path: '/docs', title: 'Setup & Self-Hosting Guide | Ujrat', description: 'Setup instructions, Supabase database schemas, Row-Level Security policies, and self-hosting notes for Ujrat.' },
  { path: '/contact', title: 'Contact & Community Support | Ujrat', description: 'Connect with the Ujrat team for assistance, developer feedback, and open-source contributions.' },
  { path: '/status', title: 'System Status & Service Health | Ujrat', description: 'Check uptime status for the Ujrat database, authentication API, and storage services.' },
  { path: '/faq', title: 'Freelance Invoicing & Tax FAQs — GST, UPI, Contracts | Ujrat', description: 'Frequently asked questions about Indian freelance invoicing, CGST/SGST/IGST tax rates, zero-fee UPI QR codes, and digital contracts.' },
  { path: '/404', title: 'Page Not Found', description: 'This page does not exist.', noindex: true },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Set content="..." of a <meta name|property="key"> tag; inject before </head> if absent.
function setMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`);
  return re.test(html)
    ? html.replace(re, (_m, pre, post) => `${pre}${esc(content)}${post}`)
    : html.replace('</head>', `    <meta ${attr}="${key}" content="${esc(content)}" />\n  </head>`);
}

function renderRoute(baseHtml, { path, title, description, noindex }) {
  // Same fullTitle rule as SEOMeta.tsx.
  const fullTitle = title.includes('Ujrat') ? title : `${title} | Ujrat`;
  const canonical = `${BASE}${path}`;
  let html = baseHtml;
  html = /<title>.*?<\/title>/s.test(html)
    ? html.replace(/<title>.*?<\/title>/s, `<title>${esc(fullTitle)}</title>`)
    : html.replace('</head>', `    <title>${esc(fullTitle)}</title>\n  </head>`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', fullTitle);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', canonical);
  html = setMeta(html, 'property', 'og:image:alt', fullTitle);
  html = setMeta(html, 'name', 'twitter:title', fullTitle);
  html = setMeta(html, 'name', 'twitter:description', description);
  html = setMeta(html, 'name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
  const canRe = /(<link[^>]*rel="canonical"[^>]*href=")[^"]*(")/;
  html = canRe.test(html)
    ? html.replace(canRe, (_m, pre, post) => `${pre}${canonical}${post}`)
    : html.replace('</head>', `    <link rel="canonical" href="${canonical}" />\n  </head>`);
  return html;
}

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '..', 'frontend');
const distDir = resolve(process.argv[2] ?? join(frontendDir, 'dist'));
const source = join(distDir, 'index.html');

if (!existsSync(source)) {
  console.warn(`[prerender] skip: ${source} not found (run build first)`);
  process.exit(0);
}

// The SSR bundle is built once per client build. Only the real dist gets content;
// custom dist dirs (tests) stay head-only. UJRAT_SKIP_PRERENDER stops the
// prerender plugin in vite.config.ts from re-entering during that nested build.
const ssrEntry = join(frontendDir, 'dist-ssr', 'entry-server.js');
const isDefaultDist = !process.argv[2];
if (isDefaultDist && !process.env.UJRAT_SKIP_PRERENDER) {
  console.log('[prerender] building server bundle…');
  execFileSync(
    process.execPath,
    [resolve(here, '..', 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--ssr', 'src/entry-server.tsx', '--outDir', 'dist-ssr', '--emptyOutDir'],
    { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, UJRAT_SKIP_PRERENDER: '1' } },
  );
}

let serverRender = null;
try {
  serverRender = await import(pathToFileURL(ssrEntry).href);
} catch (err) {
  console.warn(`[prerender] WARN: server bundle unavailable, writing head-only shells: ${err.message}`);
}


const baseHtml = readFileSync(source, 'utf8');
// SPA shell for app routes (/login, /dashboard, /portal…): same head, empty root.
// Those paths rewrite here, so they never hydrate against marketing markup.
// Header rules match the request path, not the rewrite target, so noindex has to
// live in the document.
writeFileSync(join(distDir, 'app.html'), setMeta(baseHtml, 'name', 'robots', 'noindex, follow'));
let withContent = 0;
for (const route of ROUTES) {
  let html = renderRoute(baseHtml, route);
  if (serverRender?.render) {
    try {
      const markup = serverRender.render(route.path)
        // React 19 hoists <link rel="preload"> for in-tree images to the front of the
        // root; the client does not render them there, so strip them before hydrating.
        .replace(/^(?:\s*<link[^>]*>)+/, '');
      html = html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
      withContent += 1;
    } catch (err) {
      console.warn(`[prerender] WARN: render failed for ${route.path}: ${err.message}`);
    }
  }
  const out = route.path === '/' ? source : route.path === '/404'
    ? join(distDir, '404.html')
    : join(distDir, route.path.replace(/^\//, ''), 'index.html');
  if (out !== source) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`[prerender] ${route.path} -> ${out}`);
}
console.log(`[prerender] wrote ${ROUTES.length} routes (${withContent} with static content)`);
