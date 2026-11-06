// Prerender SEO shell: clone dist/index.html per public route with per-route
// title/description/canonical/OG tags injected (string replace only, no SSR).
// Usage: node scripts/prerender.mjs [distDir]  (default: frontend/dist)
// Warns and exits 0 without dist/index.html so `vite build` never breaks pre-build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://ujrat.ninety5.in';

// 12 public routes from frontend/src/features/public/pages/PublicPages.tsx (SEOMeta props).
const ROUTES = [
  { path: '/privacy', title: 'Privacy Policy', description: 'Ujrat Privacy Policy and Digital Personal Data Protection (DPDP) Act 2023 compliance guidelines for Indian freelancers.' },
  { path: '/terms', title: 'Terms of Service', description: 'Ujrat Terms of Service and legal usage agreement under the Indian Information Technology Act 2000.' },
  { path: '/security', title: 'Security & Isolation Architecture', description: 'Learn about Ujrat enterprise-grade PostgreSQL Row-Level Security, private storage escrow, and cryptographic audit logs.' },
  { path: '/pricing', title: '100% Free & Open-Source Pricing', description: 'Ujrat is 100% free forever. No monthly subscriptions, 0% payment gateway fees, and no client limits for Indian freelancers.' },
  { path: '/features', title: 'Freelance CRM, GST Invoices & UPI Payments Features', description: "Explore Ujrat's end-to-end freelance workspace: client CRM, proposal templates, IT Act compliant digital contracts, Indian GST invoices, and zero-fee UPI QR payments." },
  { path: '/gst', title: 'Indian GST Invoicing Engine for Freelancers — CGST, SGST, IGST & HSN 998314', description: 'Automated Indian GST calculation engine for freelancers. Instant place of supply routing for CGST + SGST vs IGST, HSN/SAC codes, and Section 194J TDS compliance.' },
  { path: '/upi', title: 'Zero-Fee UPI QR & Intent Payment Invoicing for Freelancers | Ujrat', description: 'Accept freelance client payments with 0% payment gateway commission. Generate dynamic UPI QR codes and intent links compatible with GPay, PhonePe, and Paytm.' },
  { path: '/contracts', title: 'Digital Freelance Contracts & IT Act Compliant E-Signatures | Ujrat', description: 'Create legally binding freelance agreements and contracts in India. Tamper-evident cryptographic signature logs under Section 10A of the Information Technology Act 2000.' },
  { path: '/docs', title: 'Developer Documentation & Self-Hosting Guide | Ujrat', description: 'Complete setup instructions, Supabase database schemas, Row-Level Security policies, and self-hosting documentation for Ujrat.' },
  { path: '/contact', title: 'Contact & Community Support | Ujrat', description: 'Connect with the Ujrat team for assistance, developer feedback, and open-source contributions.' },
  { path: '/status', title: 'System Status & Real-Time Service Health | Ujrat', description: 'Check real-time uptime status for Ujrat database, authentication API, and storage services.' },
  { path: '/faq', title: 'Freelance Invoicing & Tax FAQs — GST, UPI, Contracts | Ujrat', description: 'Frequently asked questions about Indian freelance invoicing, CGST/SGST/IGST tax rates, zero-fee UPI QR codes, and digital contracts.' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Set content="..." of a <meta name|property="key"> tag; inject before </head> if absent.
function setMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`);
  return re.test(html)
    ? html.replace(re, (_m, pre, post) => `${pre}${esc(content)}${post}`)
    : html.replace('</head>', `    <meta ${attr}="${key}" content="${esc(content)}" />\n  </head>`);
}

function renderRoute(baseHtml, { path, title, description }) {
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
  const canRe = /(<link[^>]*rel="canonical"[^>]*href=")[^"]*(")/;
  html = canRe.test(html)
    ? html.replace(canRe, (_m, pre, post) => `${pre}${canonical}${post}`)
    : html.replace('</head>', `    <link rel="canonical" href="${canonical}" />\n  </head>`);
  return html;
}

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(process.argv[2] ?? join(here, '..', 'frontend', 'dist'));
const source = join(distDir, 'index.html');

if (!existsSync(source)) {
  console.warn(`[prerender] skip: ${source} not found (run build first)`);
  process.exit(0);
}

const baseHtml = readFileSync(source, 'utf8');
for (const route of ROUTES) {
  const out = join(distDir, route.path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderRoute(baseHtml, route));
  console.log(`[prerender] ${route.path} -> ${out}`);
}
console.log(`[prerender] wrote ${ROUTES.length} route shells`);
