import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@/app/styles/index.css'
import App, { type PreloadedPublicPages } from '@/app/router/App.tsx'

// Auth/portal routes never render marketing pages, so their chunks stay out of
// the app entry. Public routes preload the matching page module before hydrate
// so the prerendered HTML is reused instead of replaced by a Suspense fallback.
const APP_ROUTE = /^\/(?:dashboard|clients|projects|invoices|payments|settings|login|signup|forgot|reset|portal|waitlist)(?:\/|$)/;

async function preloadPublicPages(): Promise<PreloadedPublicPages | undefined> {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (APP_ROUTE.test(path)) return undefined;
  if (path === '/') {
    const { LandingPage } = await import('@/features/landing/pages/LandingPage');
    return { LandingPage };
  }
  return import('@/features/public/pages/PublicPages');
}

async function bootstrap() {
  const preloaded = await preloadPublicPages();
  const container = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <App preloaded={preloaded} />
    </StrictMode>
  );

  // Prerendered routes arrive with real HTML (see scripts/prerender.mjs); hydrate
  // those so the static content is not thrown away on first paint.
  if (container.hasChildNodes()) {
    hydrateRoot(container, app);
  } else {
    createRoot(container).render(app);
  }
}

void bootstrap();

// Register the PWA service worker after first paint
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      if (import.meta.env.DEV) {
        console.debug('[PWA] ServiceWorker registration skipped or failed:', err);
      }
    });
  }
};

if ('requestIdleCallback' in window) {
  (window as any).requestIdleCallback(registerServiceWorker, { timeout: 3000 });
} else {
  setTimeout(registerServiceWorker, 3000);
}
