# 🛠️ Developer Onboarding & Operations Guide

Welcome to the **Ujrat** codebase. This guide explains how to set up, develop, test, and deploy the application.

---

## 1. Prerequisites

* **Node.js**: `v20.x` or higher (LTS recommended)
* **npm**: `v10.x` or higher
* **Git**

---

## 2. Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/Rayyan-x95/Ujrat.git
cd Ujrat

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start local development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 3. Environment Variables (`.env`)

### Client-Side Variables (Vite Bundled)
| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project API URL | Yes | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous client API key | Yes | `eyJhbGciOi...` |
| `VITE_APP_URL` | Application base URL | Yes | `https://ujrat.ninety5.in` |
| `VITE_SENTRY_DSN` | Sentry Error Tracking DSN | No | `https://xxx@sentry.io/xxx` |

### Server-Side Edge Function Secrets (Never bundle with `VITE_`)
| Secret | Description | Required | Scope |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Administrative service role key | For migrations/admin scripts | Edge Functions / CI |
| `PLUNK_API_KEY` | Plunk transactional email API key | For email notifications | Edge Functions |

---

## 4. Common Scripts

* **`npm run dev`**: Starts Vite development server with Hot Module Replacement (HMR).
* **`npm run build`**: Builds production bundle into `dist/` folder with minification and tree shaking.
* **`npm run preview`**: Serves the local production build for pre-deployment inspection.
* **`npm test`**: Runs the Vitest test runner in watch mode.
* **`npm test -- --run`**: Runs all 22 Vitest test suites once in headless CI mode.
* **`npx tsc --noEmit`**: Type checks all TypeScript files without generating output files.
* **`npx playwright test`**: Executes end-to-end browser tests.

---

## 5. Deployment Guide (Vercel)

Ujrat is optimized for zero-config edge deployments on **Vercel**:

1. Connect your repository to Vercel.
2. Ensure Build Settings are configured:
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
3. Add Environment Variables:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
   * `VITE_APP_URL`
4. The included `vercel.json` automatically handles client-side SPA route rewrites and security headers:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
