import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Prerender SEO shell (scripts/prerender.mjs, no deps): dist/</route>/index.html per public route.
const prerenderPlugin = () => ({
  name: 'ujrat-prerender',
  closeBundle() {
    if (process.env.UJRAT_SKIP_PRERENDER) return
    const script = path.resolve(import.meta.dirname, '../scripts/prerender.mjs')
    if (existsSync(script)) execFileSync(process.execPath, [script], { stdio: 'inherit' })
  },
})

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@/app': path.resolve(import.meta.dirname, './src/app'),
      '@/shared': path.resolve(import.meta.dirname, './src/shared'),
      '@/features': path.resolve(import.meta.dirname, './src/features'),
      '@/supabase': path.resolve(import.meta.dirname, '../backend/supabase'),
      '@ujrat/shared-types': path.resolve(import.meta.dirname, '../packages/shared-types/src'),
    },
  },
  plugins: [
    prerenderPlugin(),
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV === 'production' ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
      },
    })] : []),
  ],
  build: {
    sourcemap: !!process.env.SENTRY_AUTH_TOKEN,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('lucide-react') || id.includes('qrcode.react')) {
              return 'vendor-icons';
            }
            if (id.includes('@sentry')) {
              return 'vendor-sentry';
            }
            if (id.includes('posthog')) {
              return 'vendor-posthog';
            }
            if (id.includes('zod')) {
              return 'vendor-validation';
            }
            return 'vendor-utils';
          }
        }
      }
    }
  }
})

