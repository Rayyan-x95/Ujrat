import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from '@/shared/lib/sentry'
import { initPostHog } from '@/shared/lib/posthog'
import '@/app/styles/index.css'
import App from '@/app/router/App.tsx'

initSentry();
initPostHog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)