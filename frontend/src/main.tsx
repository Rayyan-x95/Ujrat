import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@/app/styles/index.css'
import App from '@/app/router/App.tsx'

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Prerendered routes arrive with real HTML (see scripts/prerender.mjs); hydrate
// those so the static content is not thrown away on first paint.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}

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