import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '../../');
const script = join(root, '../scripts/prerender.mjs');
const distDir = join(root, 'dist');

// 12 public routes from PublicPages.tsx, with SEOMeta full-title rule applied.
const EXPECTED: Array<[string, string]> = [
  ['/privacy', 'Privacy Policy | Ujrat'],
  ['/terms', 'Terms of Service | Ujrat'],
  ['/security', 'Security & Isolation Architecture | Ujrat'],
  ['/pricing', '100% Free & Open-Source Pricing | Ujrat'],
  ['/features', 'Freelance CRM, GST Invoices & UPI Payments Features | Ujrat'],
  ['/gst', 'Indian GST Invoicing Engine for Freelancers — CGST, SGST, IGST & HSN 998314 | Ujrat'],
  ['/upi', 'Zero-Fee UPI QR & Intent Payment Invoicing for Freelancers | Ujrat'],
  ['/contracts', 'Digital Freelance Contracts & IT Act Compliant E-Signatures | Ujrat'],
  ['/docs', 'Developer Documentation & Self-Hosting Guide | Ujrat'],
  ['/contact', 'Contact & Community Support | Ujrat'],
  ['/status', 'System Status & Real-Time Service Health | Ujrat'],
  ['/faq', 'Freelance Invoicing & Tax FAQs — GST, UPI, Contracts | Ujrat'],
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const fileFor = (base: string, p: string) => join(base, p.replace(/^\//, ''), 'index.html');
const read = (p: string) => readFileSync(p, 'utf8');

describe('prerender script (static output)', () => {
  it('writes dist/<route>/index.html with title/canonical/OG from a fixture dist', () => {
    expect(existsSync(script), 'scripts/prerender.mjs missing').toBe(true);
    const tmp = mkdtempSync(join(tmpdir(), 'ujrat-prerender-'));
    try {
      writeFileSync(join(tmp, 'index.html'), read(join(root, 'index.html')));
      execFileSync(process.execPath, [script, tmp], { stdio: 'pipe' });
      expect(EXPECTED).toHaveLength(12);
      for (const [p, title] of EXPECTED) {
        const file = fileFor(tmp, p);
        expect(existsSync(file), `${p} shell missing`).toBe(true);
        const html = read(file);
        expect(html).toContain(`<title>${esc(title)}</title>`);
        expect(html).toContain(`rel="canonical" href="https://ujrat.ninety5.in${p}"`);
        expect(html).toContain(`property="og:title" content="${esc(title)}"`);
        expect(html).toContain(`property="og:url" content="https://ujrat.ninety5.in${p}"`);
      }
      // Spot checks: per-route description + HTML-escaping of &.
      const gst = read(fileFor(tmp, '/gst'));
      expect(gst).toContain('name="description" content="Automated Indian GST calculation engine');
      expect(gst).toContain('twitter:description" content="Automated Indian GST calculation engine');
      const sec = read(fileFor(tmp, '/security'));
      expect(sec).toContain('Security &amp; Isolation Architecture | Ujrat');
      const upi = read(fileFor(tmp, '/upi'));
      expect(upi).toContain('0% payment gateway commission');
      // Root shell untouched by the fixture run.
      expect(read(join(tmp, 'index.html'))).toContain('<title>Ujrat — Free Freelance Invoicing');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('prerender output (post-build)', () => {
  it.runIf(existsSync(join(distDir, 'index.html')))('dist/<route>/index.html exists for all 12 routes', () => {
    for (const [p, title] of EXPECTED) {
      const file = fileFor(distDir, p);
      expect(existsSync(file), `${p} missing in dist — run npm run build`).toBe(true);
      const html = read(file);
      expect(html).toContain(`<title>${esc(title)}</title>`);
      expect(html).toContain(`rel="canonical" href="https://ujrat.ninety5.in${p}"`);
    }
  });
});
