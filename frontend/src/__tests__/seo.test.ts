import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SEOMeta } from '@/shared/ui/SEOMeta';

const root = join(__dirname, '../../');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('index.html SEO', () => {
  const html = read('index.html');
  it('lang en-IN, title<=60, desc<=160', () => {
    expect(html).toContain('lang="en-IN"');
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
    expect(title.length).toBeLessThanOrEqual(60);
    const desc = html.match(/name="description" content="(.*?)"/)?.[1] ?? '';
    expect(desc.length).toBeLessThanOrEqual(160);
  });
  it('og site_name/locale/image:alt + twitter:site', () => {
    expect(html).toContain('og:site_name" content="Ujrat"');
    expect(html).toContain('og:locale" content="en_IN"');
    expect(html).toContain('og:image:alt"');
    expect(html).toContain('twitter:site" content="@ujrat"');
  });
  it('og:title/description divergence >10 chars warns (not fails)', () => {
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
    const desc = html.match(/name="description" content="(.*?)"/)?.[1] ?? '';
    const ogTitle = html.match(/property="og:title" content="(.*?)"/)?.[1] ?? '';
    const ogDesc = html.match(/property="og:description" content="(.*?)"/)?.[1] ?? '';
    // Guard: validator must fail on title>60/desc>160 (see above); og divergence is warn-only.
    const divergences: string[] = [];
    if (ogTitle && Math.abs(ogTitle.length - title.length) > 10) divergences.push(`og:title len ${ogTitle.length} vs title len ${title.length}`);
    if (ogDesc && Math.abs(ogDesc.length - desc.length) > 10) divergences.push(`og:description len ${ogDesc.length} vs meta desc len ${desc.length}`);
    // Test stays green either way; if diverged, the warning path must exist (validator covers it).
    // Assert warning logic at least runs without throwing and og tags are present.
    expect(ogTitle.length).toBeGreaterThan(0);
    expect(ogDesc.length).toBeGreaterThan(0);
    if (divergences.length) console.warn(`SEO og divergence warning: ${divergences.join('; ')}`);
  });
});

describe('sitemap/robots/manifest', () => {
  it('16 public routes, lastmod 2026-11-07, no protected routes', () => {
    const xml = read('public/sitemap.xml');
    const locs = xml.match(/<loc>(.*?)<\/loc>/g) ?? [];
    expect(locs).toHaveLength(16);
    expect(xml).not.toContain('2026-08-20');
    for (const p of ['/faq', '/privacy', '/terms', '/security', '/contact', '/status']) {
      expect(xml).toContain(`https://ujrat.ninety5.in${p}</loc>`);
    }
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('/portal');
  });
  it('AI bots allow privacy/terms/security/contact/status + sitemap line', () => {
    const txt = read('public/robots.txt');
    expect(txt).toContain('Sitemap: https://ujrat.ninety5.in/sitemap.xml');
    const blocks = txt.split(/User-agent:/).slice(2); // skip wildcard + first bot header handling
    expect(blocks.length).toBeGreaterThanOrEqual(8);
    for (const b of blocks) {
      for (const p of ['/privacy', '/terms', '/security', '/contact', '/status']) {
        expect(b).toContain(`Allow: ${p}`);
      }
    }
  });
  it('manifest name Ujrat, maskable, categories', () => {
    const m = JSON.parse(read('public/site.webmanifest'));
    expect(m.name).toBe('Ujrat');
    expect(m.categories).toEqual(['business', 'finance']);
    expect(m.theme_color).toBe('#2563eb');
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'any maskable')).toBe(true);
  });
});

describe('SEOMeta', () => {
  let container: HTMLDivElement;
  afterEach(() => {
    container?.remove();
    document.title = '';
  });
  it('writes og:site_name/locale/image:alt + title/canonical', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const r = createRoot(container);
    act(() => { r.render(React.createElement(SEOMeta, { title: 'Sign In', description: 'd', canonicalPath: '/login' })); });
    expect(document.title).toContain('Sign In');
    const get = (attr: string, v: string) => document.querySelector(`meta[${attr}="${v}"]`)?.getAttribute('content');
    expect(get('property', 'og:site_name')).toBe('Ujrat');
    expect(get('property', 'og:locale')).toBe('en_IN');
    expect(get('property', 'og:image:alt')).toBeTruthy();
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://ujrat.ninety5.in/login');
    act(() => r.unmount());
  });
});

describe('AuthPage SEO wiring', () => {
  it('renders SEOMeta per mode (static check)', () => {
    const src = read('src/features/auth/pages/AuthPage.tsx');
    expect(src).toContain("import { SEOMeta }");
    expect(src).toContain('AUTH_SEO[mode]');
    for (const p of ['/login', '/signup', '/forgot', '/reset']) expect(src).toContain(p);
  });
});

describe('MobileLayout a11y (verified, no change)', () => {
  it('drawer role=dialog aria-modal + Escape handler present', () => {
    const src = read('src/app/layouts/MobileLayout.tsx');
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("e.key === 'Escape'");
  });
});
