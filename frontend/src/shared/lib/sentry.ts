import * as Sentry from '@sentry/react';
import { deepRedact } from '@/shared/utils/sanitize';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.debug('[Sentry] DSN not configured, skipping initialization');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    release: import.meta.env.VITE_APP_VERSION || '0.0.0',
    integrations: [
      Sentry.browserTracingIntegration(),
      // ponytail: Replay loaded lazily below — saves ~50 kB from the critical monitoring chunk
    ],
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    debug: import.meta.env.DEV,
    // Transaction events (traces) are NOT routed through beforeSend —
    // they need their own hook:
    beforeSendTransaction(transactionEvent) {
      return deepRedact(transactionEvent);
    },
    beforeSend(event) {
      // Filter out development errors
      if (import.meta.env.DEV) {
        console.debug('[Sentry] Event captured:', event);
      }

      // The portal URL contains the passwordless bearer token; never ship it.
      // Askew shapes (span descriptions, span data, tags) sneak past point-fixes —
      // redact every string in the event.
      const redacted = deepRedact(event);
      if (redacted.exception) {
        for (const exc of redacted.exception.values || []) {
          if (exc.value?.includes('AbortError') || exc.value?.includes('Cancelled')) {
            return null;
          }
        }
      }
      return redacted;
    },
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network Error',
      'Failed to fetch',
    ],
  });

  // Lazy-load session replay after init — not needed on critical path
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      Sentry.addIntegration(Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }));
    });
  }

  if (import.meta.env.DEV) {
    console.debug('[Sentry] Initialized');
  }
}

export { Sentry };