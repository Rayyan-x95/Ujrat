import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/styles/index.css'
import App from '@/app/router/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Defer monitoring SDKs off the critical path — loads after first paint
const initMonitoringAndSW = () => {
  import('@/shared/lib/sentry').then(m => m.initSentry());
  import('@/shared/lib/posthog').then(m => m.initPostHog());

  // Register PWA service worker
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] ServiceWorker registration failed:', err);
    });
  }
};

if ('requestIdleCallback' in window) {
  (window as any).requestIdleCallback(initMonitoringAndSW);
} else {
  setTimeout(initMonitoringAndSW, 200);
}