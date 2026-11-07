# Ujrat — Marketing & SEO Audit

**Site:** https://ujrat.ninety5.in
**Date:** 2026-11-07
**Scope:** Full public surface (17 routes), indexation, technical SEO, on-page/content, AI search visibility (GEO), positioning, funnel, competitive landscape.
**Data sources:** Google Search Console API (28-day window to 2026-11-04), URL Inspection API, live HTTP checks, Playwright crawl of all routes, Lighthouse (mobile), lab perf runs, DuckDuckGo SERP checks, GitHub API, live competitor sites.
**Caveat:** Performance numbers are single-run lab measurements, not field data (CrUX/PSI was rate-limited). Treat them as directional.

---

## 1. Executive Summary

**Verdict: the product ships, the marketing does not exist.**

- **0 clicks, 0 impressions, 0 average position** in Google Search Console for the last 28 days. The site has never received a single organic impression.
- The homepage was last crawled **2026-08-20** and was left as **"Crawled — currently not indexed"**. Every other public route is **unknown to Google**.
- The submitted sitemap has **never been downloaded** (`is_pending: true`, `last_downloaded: null`) since submission on 2026-08-20.
- **The root cause is technical, not content:** every page is served as `<div id="root"></div>` with **0 static H1s and ~81 static words**. All copy, headings, and per-route metadata are injected client-side by `useEffect` after JS executes. Google can render this; it is choosing not to index it. Every non-JS crawler — including most AI crawlers feeding ChatGPT/Perplexity/Claude — sees nothing.
- **Unknown URL returns HTTP 200** with a canonical of `/404` and `index, follow` — a soft 404. Google reports this as a low-quality signal sitewide.
- There is **no content layer at all**: no blog, no guides, no comparison pages, no templates, no `/gst-calculator`, no `/invoice-template`. The 16-URL sitemap contains 12 thin utility pages (contact = 80 words, status = 74, security = 137) and the two auth pages.

So the positioning is defensible ("zero-fee UPI invoicing + GST + contracts for Indian freelancers") but the site is not eligible for the search results where that positioning would win. **Fixing indexation is worth more than every other item in this document combined.**

| Area | Score | State |
|---|---|---|
| Indexation | 1/10 | Nothing indexed, sitemap dead, soft 404s |
| Technical SEO | 4/10 | Good headers/CSP/robots; broken rendering model, no SSR |
| On-page / content | 2/10 | 12 thin pages, 0 content, unsupported claims |
| Performance | 7/10 | 268 KB, CLS 0.004; slow mobile TTFB (1.7 s) |
| Accessibility | 8/10 | Lighthouse 92; contrast + landmark issues |
| AI / GEO readiness | 5/10 | Good robots + llms.txt intent, empty HTML defeats it |
| Positioning & funnel | 3/10 | Waitlist vs live signup conflict, dead social links |
| Measurement | 0/10 | No analytics, no error tracking deployed |

---

## 2. Critical: Indexation Is Broken

### 2.1 Empty HTML shell (P0)

`scripts/prerender.mjs` clones `dist/index.html` per route and string-replaces the title/description/canonical/OG tags. It does **not** render the React tree. Result, verified in `dist/pricing/index.html`:

```
<div id="root"></div>   ← present
<h1> count: 0
words in static text: 81
JSON-LD blocks: 1
```

Implications:
- Google's renderer executes JS and does eventually see 1,077 words on `/`. But it first crawls a page that looks like an empty template, and the HTML it caches for 3+ months on 15 routes is not worth indexing. That is exactly the "Crawled — currently not indexed" verdict.
- AI crawlers split three ways: `GPTBot`/`ClaudeBot` generally **do not execute JS**; `OAI-SearchBot` and `PerplexityBot` sometimes do. On the non-executing path, Ujrat is an empty page. Your `llms.txt` is the only thing they can read, and it contains factual errors (see §6).
- Non-JS link discovery is also crippled: 16 internal links exist only after hydration.

**Fix (choose one):**
1. **Static prerender with real content (recommended).** Vite SSR via `vite build --ssr` + `renderToString` in `scripts/prerender.mjs`, writing a real `<div id="root">…html…</div>` plus the meta tags that already work. ~1 day. No infra change, no framework migration, keeps Vercel static hosting.
2. **Prerender service** (react-snap / `vite-plugin-prerender` / Puppeteer post-build step). Faster, fragile, heavier CI.
3. **Move public marketing routes to a separate Astro/Next static site** at the domain root. Correct long-term if marketing grows, but it is a rewrite. Do not do this before option 1 proves the traffic.

**Do not** ship a marketing site on a client-rendered SPA and expect organic traffic. That is the whole bug.

### 2.2 Sitemap never fetched (P0)

- `is_pending: true`, `last_downloaded: null` since 2026-08-20. Google has not read it.
- The sitemap uses `lastmod: 2026-11-07` and `changefreq: daily` on every URL — regenerated on each deploy. `lastmod` that changes on every deploy for pages that did not change is a trust-destroying signal; Google learns to ignore it.
- It contains `/login` and `/signup`. Auth walls are not useful index targets and dilute the crawl budget on a site with 16 URLs.

**Fix:** real `lastmod` from git commit date per file (or drop `lastmod` entirely), drop `changefreq`/`priority` (ignored by Google), remove `/login` and `/signup`, resubmit, and use **Request Indexing** in GSC on `/`, `/pricing`, `/features` after the prerender fix ships.

### 2.3 Soft 404 (P0)

`GET /this-page-does-not-exist-xyz` → **HTTP 200**, page renders the 404 UI, canonical points at `/404`, `robots: index, follow`.

This means:
- Any typo'd inbound link creates an indexable phantom page.
- Google's soft-404 classifier historically discounts the whole host, not just the URL.

**Fix:** Vercel `rewrites` cannot return 404 from a SPA. Use `vercel.json` `routes`/`headers` with a `404.html` fallback (Vite emits one) or a small edge function that returns 404 for unknown paths. Minimum viable: serve `dist/404.html` with `status: 404` and `X-Robots-Tag: noindex`.

### 2.4 Zero impressions despite the brand ranking in DuckDuckGo

The branded query "Ujrat" returns the homepage, `ninety5.in/products`, and `ninety5.in/work/ujrat` on DuckDuckGo, so the pages are fetchable. Zero Google impressions for 28 days with `Crawled — currently not indexed` is a **quality/eligibility** verdict, not a discovery problem. The empty shell + soft 404 + 12 thin pages is the explanation.

---

## 3. Technical SEO

### Working
- HTTPS, HSTS 2 years with `includeSubDomains`, `nosniff`, `strict-origin-when-cross-origin`.
- CSP present (inline `onload` font handler was fixed by loading fonts CSP-safely).
- `robots.txt` is unusually well-considered: explicit allowlist for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, cohere-ai.
- Canonicals correct on all 17 routes; per-route titles/descriptions/OG present in prerendered head.
- CLS 0.004 on mobile — genuinely good.
- `llms.txt` exists at 4.6 KB and is served as `text/plain`.

### Broken
| # | Issue | Impact |
|---|---|---|
| T1 | Empty `#root` in prerendered HTML | **P0** — root cause of zero indexing |
| T2 | Unknown URLs return 200 | **P0** — soft 404 sitewide discount |
| T3 | Sitemap never downloaded, fake `lastmod`, auth pages listed | **P0/P1** |
| T4 | No `<main>` landmark on landing (and most routes) | P1 — a11y + semantic extraction |
| T5 | `og-image.png` = **1.65 MB**, served `max-age=0` | P1 — WhatsApp/LinkedIn previews slow or dropped; social CTR loss |
| T6 | HTML served `Cache-Control: max-age=0, must-revalidate` | P1 — every visit revalidates; mobile TTFB 1.69 s |
| T7 | Mobile lab TTFB **1,690 ms**, FCP 2,668 ms, LCP 3,716 ms | P1 — fails CWV "good" (LCP ≤ 2.5 s) on 4G |
| T8 | 13 JS chunks, 100 KB JS, 151 KB "other" | P2 — acceptable but lazy routes are splitting too aggressively for a 1-page visit |
| T9 | Two `SoftwareApplication` JSON-LD blocks on `/` (one from `index.html`, one from React) | P2 — duplicate entity, weakens schema |
| T10 | `sameAs` → `github.com/ujrat` (404), `twitter.com/ujrat_in` (404), `x.com/ujrat_in` (404) | P1 — brand entity verification fails |
| T11 | Auth pages indexable | P2 — crawl waste + unnecessary SERP surface |
| T12 | Accessibility: 26 low-contrast nodes (8 px status text, 4.31:1), footer `h4` after `h2` | P2 — Lighthouse a11y 92 |
| T13 | Permission/no `HEAD` issues not found; but `og-image.png` had no `immutable` | P2 |

### Perf detail (lab, single run)

| | Mobile (390×844) | Desktop (1440) |
|---|---|---|
| TTFB | 1,690 ms | 325 ms |
| FCP | 2,668 ms | 368 ms |
| LCP | 3,716 ms | 940 ms |
| CLS | 0.004 | 0.013 |
| Transfer | 268 KB | cached |

Mobile TTFB of 1.69 s on a static Vercel deployment with `x-vercel-cache: HIT` is not edge latency — it is the cold-start of the third-party Google Fonts CSS→gstatic chain plus 13 JS requests on a throttled mobile profile. Self-host Inter as woff2 with `font-display: swap` and `preload`, drop `fonts.googleapis.com`, and mobile LCP should land near 2 s.

---

## 4. On-Page & Content

### The content gap
Every route's word count, from the live crawl:

| Route | Words | Notes |
|---|---|---|
| `/` | 1,077 | Real landing page, 1 H1, 9 H2, 22 H3 |
| `/faq` | ~600 | FAQ text present |
| `/features` | thin | Feature grid, no depth |
| `/gst` | thin | |
| `/upi` | thin | |
| `/contracts` | thin | |
| `/pricing` | **198** | A pricing page with 198 words cannot rank for "free invoicing software" |
| `/docs` | **143** | No actual documentation |
| `/security` | **137** | Claims without evidence |
| `/terms` | ~200 | "Last updated: January 15, 2025" |
| `/privacy` | ~250 | "Last updated: January 15, 2025" |
| `/contact` | **80** | |
| `/status` | **74** | |
| `/waitlist` | thin | Contradicts the live product |
| `/login`, `/signup` | — | Indexable, should not be |

**Nothing targets a real query.** There is no page whose title answers "how do I create a GST invoice as a freelancer in India", "what is SAC 998314", "UPI payment link vs Razorpay fee comparison", "freelance contract template India", "GST for exports/LUT", "advance tax for freelancers". Those are the queries in this market. Ujrat's pages describe Ujrat; they do not answer anything a searcher typed.

### Claims that will cost you trust (P0 from a marketing standpoint)

These appear in live copy and in JSON-LD/`llms.txt`:

1. **"The #1 free workspace for Indian freelancers"** — on what metric? You have 0 GSC impressions, 0 GitHub stars, and no user count anywhere. Unsupported superlatives are an FTC/ASCI-style problem in India and a credibility problem everywhere.
2. **"MIT License" / "open-source under MIT"** — the GitHub repo `Rayyan-x95/Ujrat` returns `license: null`; there is **no LICENSE file** in the repo. Claiming MIT without the license file means the claim is not legally true and nobody can actually reuse the code.
3. **"IT Act 2000 compliant digital contracts"** and **"cryptographic e-signatures"** — what you implement is an audit log of email + timestamp + IP + UA. That is **not** a cryptographic signature, not an Aadhaar eSign, and not a certifying-authority-backed signature under the IT Act. The IT Act recognises e-signatures under §3A/§5 and Second Schedule; a hashed log is evidence, not a qualified signature. **This claim is the single biggest legal exposure on the site.** Reword to: "tamper-evident signature audit trail (email, timestamp, IP, user agent)". If you want the strong claim, integrate an Aadhaar eSign/ESP.
4. **"guaranteeing data isolation"** / "enterprise-grade" — RLS is good engineering, not a guarantee. Same for "read-only ledger" unless the table is genuinely append-only with revoked UPDATE/DELETE.
5. **"legally binding"** — depends on stamp duty, state, and whether the counterparty is a consumer. Say "designed to create a documented acceptance record."

### Other on-page issues
- Landing page has **no `<main>`**; content sits directly under the shell. Add the landmark.
- Footer heading order jumps `h2` → `h4`; fix to `h3`.
- 8 px status text (`0% fee via UPI`, `2 awaiting payment`) at 4.31:1 contrast — both unreadable and inaccessible.
- `inputsNoLabel: 1` on `/` and **2 unlabeled inputs on `/waitlist`** — the primary conversion form is invisible to screen readers and to form-filling agents.
- `/pricing` has no comparison table and no "what happens at scale" answer, so a buyer comparing Refrens/Zoho/Vyapar has nothing to decide on.
- `/docs` at 143 words is worse than having no docs page: it ranks for nothing and signals abandonment.
- Privacy and Terms both still say **January 15, 2025** — nine months stale, and Terms are the page you point at when a dispute happens.
- Missing from the sitemap *and* the site: `/blog`, `/guides`, `/templates`, `/gst-calculator`, `/invoice-generator`, `/compare/*`, `/alternatives/*`.

---

## 5. Funnel & Positioning

### The contradiction
| Surface | Message |
|---|---|
| Header CTA | "Start Free Workspace" → `/signup` (live signup) |
| `/waitlist` | "Join Early Access Priority Waitlist", "pre-launch VIP early access" |
| `/pricing` | "100% free forever" |
| Share copy on waitlist | "Just reserved my pre-launch spot" |

A visitor who lands on `/waitlist` from a tweet is told the product does not exist yet. A visitor who lands on `/` is asked to sign up now. **One of these pages must be deleted.** If signup works, delete the waitlist and its share copy. If you still want an email list, make it a newsletter block, not a fake queue with a "position".

### Dead brand links
`sameAs` points at `github.com/ujrat`, `twitter.com/ujrat_in`, `x.com/ujrat_in` — all three return 404. The waitlist copy tags `@UjratApp`, which is not linked anywhere. Meanwhile the real repo is `github.com/Rayyan-x95/Ujrat` with **no description, no topics, no license, no stars**, and its homepage field points at the stale `https://ujrat.vercel.app`. Every structured-data entity verification (Google Knowledge Panel, Bing, AI entity linking) fails on this.

### Domain
`ujrat.in` is a parked "Work in progress" page owned by someone else. For an India-first product, the `.in` is the branded search term users will type. Options: buy it if the owner will sell, or pick a distinct brand name. Do not build years of equity on `ujrat.ninety5.in`.

### Positioning inconsistency
The Ninety5 case study describes Ujrat as a **"Freelance Rate Calculator"**. The product is a GST + UPI + contracts + client-portal workspace. Anyone who follows that link gets whiplash. Fix the case study to match the product.

### No proof anywhere
- No testimonials, no logos, no user count, no "used by N freelancers", no screenshots of a real invoice, no video, no case study.
- No pricing anchor to the thing you are replacing: "Razorpay charges 2% + GST; on ₹1,00,000 that's ₹2,360 you keep." That number is the entire pitch and it appears nowhere on the site as a concrete calculation.
- No analytics (`VITE_POSTHOG_KEY` unset) and no error tracking (`VITE_SENTRY_DSN` unset) in Vercel → you cannot know which page converts, where signups die, or whether the app errors in production. Given the site was down yesterday from a missing env var, this is the most expensive omission in this document after indexation.
- Signup is **email + 12-character password, no Google login**. Every consumer Indian SaaS expects Google. A 12-char minimum on a free freelancer tool kills signups.

---

## 6. AI / GEO (Generative Engine Optimization)

You have done more than most sites here, and it still cannot work.

**What is right**
- `robots.txt` explicitly admits GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, cohere-ai.
- `llms.txt` published at the right path, right content type.
- JSON-LD for `Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`.
- Clean semantic copy on the landing page.

**What breaks it**
1. **JS-only rendering.** GPTBot, ClaudeBot, CCBot, and most retrieval crawlers do not execute JavaScript. They receive `<div id="root"></div>`. Your `llms.txt` is the only retrievable artifact.
2. **`llms.txt` contains errors that AI will repeat verbatim:**
   - `(?0 forever ...)` — an encoding bug; the rupee sign became `?0`. Any model quoting your pricing will quote "?0".
   - "MIT License" — no LICENSE file exists (see §4).
   - "#1 free ... platform" — unsupported.
   - "cryptographic e-signatures" / "IT Act 2000 compliant" — overstated (see §4).
   AI answer engines will confidently repeat these to buyers. That is worse than being absent.
3. **No `llms-full.txt`, no `pricing.md`** — both 404. The two files that let an agent answer "what does Ujrat cost" and "what does it do" without crawling.
4. **Dead `sameAs`** means the entity graph never resolves to the GitHub repo or any social account.
5. **Missing bot allowlist entries:** `Claude-SearchBot`, `Perplexity-User`, `meta-externalagent`/`FacebookBot`, `CCBot` (Common Crawl — feeds many training and retrieval pipelines). Add them.
6. **Duplicate `SoftwareApplication` schema** on `/` (one static in `index.html`, one React-injected).
7. **No citable depth.** AI answers cite pages that state a specific, checkable fact. You have no page stating "GST on export of services is zero-rated under LUT, and here is the format", no "SAC 998314 covers…", no fee comparison. There is nothing to cite.

**The honest read:** GEO does not substitute for indexing. Fix the render model (§2.1), then `llms.txt` becomes genuinely useful. In the meantime it is a liability because of the encoding and license errors.

---

## 7. Competitive Landscape

Searches for the exact buying intent — "free GST invoice software India freelancers", "zero fee UPI invoicing freelancers India" — return a dense field of purpose-built competitors. Ujrat appears in none of them.

| Competitor | Positioning | What they have that you don't |
|---|---|---|
| **Refrens** | Broad freelancer back-office | 15 free documents, ISO/IEC 27001:2022, YourStory/VCCircle/ET press, programmatic SEO (templates + per-service pages), blog, MCP page, apps. This is the benchmark. |
| **Zoho Invoice** | Free invoicing inside Zoho | Domain authority, brand trust, integrations, India GST native |
| **Zivo** (`zivoinvoice.in`) | "Invoices clients pay by UPI in one tap" — *your exact pitch* | Already indexing for the money query; one-minute invoice UX; WhatsApp send + pay-now button; free signup |
| **Vyapar** | SMB billing app | Mobile app, offline, GST filing, huge install base |
| **Quikbil / Billvale / SnappyInvoice / invoiceforfreelance / Clienter / Sheet2Bill / ZapInvoice / BillClerk** | Same niche, smaller | Already indexed and ranking; most have template libraries |

**Takeaway:** "free + GST + UPI" is not a moat, it is a category. Zivo already occupies the exact sentence Ujrat uses. Differentiation has to come from the parts nobody else has — **contracts + client portal + escrow-style file delivery + zero-fee settlement in one flow** — and that is the story currently buried below the fold.

### Keyword targets you should own (none are currently targeted)
| Intent | Query | Page needed |
|---|---|---|
| High | free gst invoice software india | `/` + `/pricing` rewrite |
| High | upi invoice generator freelancers | `/upi` rewrite |
| High | freelance contract template india | `/contracts` + template library |
| High | sac code 998314 freelancer | `/guides/sac-998314` |
| High | gst for freelancers india guide | `/guides/gst-for-freelancers` |
| High | razorpay fees vs upi freelancers | `/compare/razorpay-vs-upi` |
| High | invoice template freelancer india | `/templates/invoice` |
| Mid | gst calculator india | `/gst-calculator` (tool, link magnet) |
| Mid | export services lut freelancer | `/guides/lut-export-services` |
| Brand | ujrat | already ranks DDG; needs Google index |

---

## 8. Prioritized Action Plan

### 30 days — make the site indexable and honest
1. **Prerender real HTML** for all public routes (`renderToString` into `#root`). *(P0, ~1 day)*
2. **Return 404 for unknown paths** with `X-Robots-Tag: noindex`. *(P0, ~2 h)*
3. **Fix the sitemap**: real `lastmod`, drop `changefreq`/`priority`, remove `/login` + `/signup`, resubmit, then **Request Indexing** on `/`, `/pricing`, `/features`. *(P0, ~1 h)*
4. **Delete `/waitlist`** (or strip "pre-launch") and its share copy. One funnel. *(P0)*
5. **Fix every claim**: remove "#1", add a real `LICENSE` (MIT) file to the repo, rewrite e-signature copy to "tamper-evident signature audit trail", soften "guaranteeing". *(P0 — legal)*
6. **Fix `llms.txt`**: `₹0` encoding, drop unsupported claims, match the corrected copy. *(P0, 30 min)*
7. **Fix `sameAs`** → real GitHub repo + a real X/LinkedIn handle; or remove. Add repo description, topics, license, correct homepage. *(P1, 30 min)*
8. **Ship analytics + error tracking**: set `VITE_POSTHOG_KEY` and `VITE_SENTRY_DSN` in Vercel. *(P0 for decisions, 30 min)*
9. **Replace the 1.65 MB og-image** with a ≤ 200 KB 1200×630 PNG/WebP and set `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` and images. *(P1, 1 h)*
10. **Self-host Inter woff2**; remove `fonts.googleapis.com`; preload the two used weights. *(P1, 2 h)*
11. Add Google sign-in to signup; lower the 12-char minimum to 8. *(P1)*
12. Update Privacy/Terms dates; trim the auth pages from the index.

**Exit criteria for day 30:** GSC shows > 0 impressions; homepage moves off "Crawled — currently not indexed"; sitemap `last_downloaded` is a date; `/nope` returns 404.

### 60 days — build the two pages that can rank
13. **Rewrite `/pricing` from 198 → 1,200+ words** with a real comparison table (Ujrat vs Refrens vs Zoho vs Zivo vs Razorpay), a worked fee example on ₹1,00,000, and an explicit "how we make money" paragraph (free forever needs an answer or a stated intention).
14. **Rewrite `/upi`** to own "UPI invoice generator for freelancers": how intent/QR works, what the client sees, the 0% math, and the limits (no card/auto-debit, settlement is direct).
15. **Launch 4 guide pages** in a `/guides` hub: GST for freelancers, SAC 998314, LUT/exports, payment-link fee comparison. 1,200–2,000 words each, one H1, FAQ block, `Article` + `FAQPage` schema, internal links up to `/pricing` and `/signup`.
16. **Ship `/gst-calculator`** and `/invoice-template` as free tools — the highest-link-value assets in this niche.
17. **Add social proof**: 3 real testimonials with name + role, a screenshot of a real (redacted) invoice and contract audit trail, and a number if you have one ("N invoices generated"). If you have zero users, say "built by a freelancer, used daily by its author" — honest beats fake.

### 90 days — distribution
18. **Product Hunt + r/india, r/freelanceIndia, r/developersIndia, Indie Hackers, X** launch with the fee-math hook ("Razorpay takes ₹2,360 on ₹1,00,000; Ujrat takes ₹0"). One asset per channel, not one blast.
19. **10 directory listings** (AlternativeTo, SaaSHub, Product Hunt, G2, Capterra India, GetApp, Startup India, YC Directory if eligible). These are the entity signals that fix a brand SERP.
20. **3 editorial backlinks** via pitch, not spam: one freelancer-community piece, one personal-finance/GST explainer, one "India SaaS under ₹0" roundup.
21. **Fix the Ninety5 case study** so the brand story is consistent ("freelance billing and client workspace", not "rate calculator").
22. **Decide on `ujrat.in`**: buy it or rename, before the backlink profile compounds.
23. Add `llms-full.txt` and `pricing.md`; re-audit AI citations monthly by asking ChatGPT/Perplexity "what is Ujrat" and correcting whatever they say wrong.

---

## 9. Measurement

You currently cannot answer any of these questions. Set this up with item 8 before spending another rupee of effort:

- Organic sessions, signup conversion by landing page, and activation (first invoice created) — PostHog funnels.
- GSC: impressions/clicks by query and page weekly; index coverage weekly; sitemap `last_downloaded`.
- Core Web Vitals field data via `web-vitals` → PostHog (until CrUX has volume).
- Error rate on signup/login (Sentry).
- AI referral traffic: parse `referer` for `chatgpt.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com`.

**North star for the next 90 days:** GSC impressions > 0 (week 2) → first non-branded click (week 6) → 10 organic signups (week 12). Nothing else matters until the first is true.

---

## Appendix — Evidence

- GSC `site_overview` (`https://ujrat.ninety5.in/`, 2026-10-08 → 2026-11-04): clicks 0, impressions 0, CTR 0, position 0. Prior 28 days identical.
- GSC `list_sitemaps`: 1 sitemap, `is_pending: true`, `last_submitted: 2026-08-20T15:32:33.399Z`, `last_downloaded: null`.
- GSC `inspect_url` `/`: `coverage: "Crawled - currently not indexed"`, `last_crawled: 2026-08-20T13:30:50Z`, `crawled_as: MOBILE`, canonical matches.
- Live crawl of 17 routes: all 200, all client-rendered, no console errors; `/this-page-does-not-exist-xyz` → 200 with canonical `/404`.
- `dist/pricing/index.html`: `#root` empty, 0 `<h1>`, 81 words, 1 JSON-LD.
- Lighthouse mobile: Accessibility 92, Best Practices 100, SEO 100, Agentic Browsing 67; 26 contrast failures at 4.31:1 on 8 px text; footer heading order; missing `<main>`.
- Lab perf mobile: TTFB 1,690 ms, FCP 2,668 ms, LCP 3,716 ms, CLS 0.004, 268 KB, 13 JS. Desktop: TTFB 325 ms, LCP 940 ms.
- `/og-image.png`: 200, `image/png`, **1,654,599 bytes**, `cache-control: public, max-age=0, must-revalidate`.
- `/llms.txt`: 200, `text/plain`, 4,607 bytes; contains `(?0` encoding bug, "#1", "MIT License".
- `/pricing.md`, `/llms-full.txt`: 404.
- `sameAs` targets `github.com/ujrat`, `twitter.com/ujrat_in`, `x.com/ujrat_in`: 404.
- GitHub API `Rayyan-x95/Ujrat`: public, `license: null`, `stargazers: 0`, `description: ""`, `topics: []`, `homepage: "https://ujrat.vercel.app"`.
- Vercel env: `VITE_POSTHOG_KEY` and `VITE_SENTRY_DSN` unset.
- DuckDuckGo SERPs: "Ujrat" → homepage + Ninety5 `/products` + `/work/ujrat`; target commercial queries → Zivo, Refrens, Zoho Invoice, Vyapar, Quikbil, Billvale, SnappyInvoice, and others; Ujrat absent.
