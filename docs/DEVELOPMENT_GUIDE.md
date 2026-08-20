# 🛠️ Developer Onboarding & Operations Guide

Welcome to the **Ujrat** codebase. This guide explains how to set up, develop, test, and deploy the application.

---

## 1. Prerequisites

* **Node.js**: `v20.x` or higher (LTS recommended)
* **npm**: `v10.x` or higher
* **Python**: `3.12` or higher (for backend operations service)
* **Git**

---

## 2. Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/Rayyan-x95/Ujrat.git
cd Ujrat

# 2. Install Node monorepo dependencies
npm install

# 3. Install Python backend dependencies
pip install -r backend/requirements.txt

# 4. Configure environment variables
cp .env.example .env

# 5. Start local development servers
npm run dev          # Frontend Vite SPA at http://localhost:5173
npm run dev:backend  # Backend FastAPI at http://localhost:8000
```

The web application will be available at `http://localhost:5173` and the backend API documentation at `http://localhost:8000/docs`.

---

## 3. Environment Variables (`.env`)

### Client-Side Variables (Vite Bundled)

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project API URL | Yes | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous client API key | Yes | `eyJhbGciOi...` |
| `VITE_APP_URL` | Application base URL | Yes | `https://ujrat.ninety5.in` |
| `VITE_SENTRY_DSN` | Sentry Error Tracking DSN | No | `https://xxx@sentry.io/xxx` |

### Server-Side Secrets (Never bundle with `VITE_`)

| Secret | Description | Required | Scope |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Administrative service role key | For migrations/admin scripts | Edge Functions / CI |
| `PLUNK_API_KEY` | Plunk transactional email API key | For email notifications | Edge Functions |
| `SMTP_*` | Custom SMTP credentials | For self-hosted email delivery | Edge Functions |

---

## 4. Common Scripts

* **`npm run dev`**: Starts Vite development server for the frontend (`@ujrat/frontend`).
* **`npm run dev:backend`**: Starts FastAPI backend with auto-reload at `http://localhost:8000`.
* **`npm run build`**: Builds production bundle into `dist/` folder via `tsc -b && vite build`.
* **`npm run typecheck`**: Compiles TypeScript project references across all workspaces (`tsc -b --noEmit`).
* **`npm run lint`**: Lints the codebase with oxlint.
* **`npm test`**: Executes the 24 Vitest frontend test suites once.
* **`npm run test:backend`**: Runs Python unit & API tests with `unittest`.
* **`npm run test:all`**: Runs the complete test suite (frontend Vitest + backend Python).
* **`npm run validate:migrations`**: Validates SQL migration sequence, table naming, and RPC contracts.
* **`npm run validate:security`**: Verifies RLS invariants, HMAC payment webhook guards, and storage policies.
* **`npm run test:e2e`**: Executes end-to-end browser tests with Playwright.

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
