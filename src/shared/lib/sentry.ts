import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    release: import.meta.env.VITE_APP_VERSION || '0.0.0',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    debug: import.meta.env.DEV,
    beforeSend(event) {
      // Filter out development errors
      if (import.meta.env.DEV) {
        console.warn('[Sentry] Event captured:', event);
      }
      
      // Don't send cancelled requests
      if (event.exception) {
        for (const exc of event.exception.values || []) {
          if (exc.value?.includes('AbortError') || exc.value?.includes('Cancelled')) {
            return null;
          }
        }
      }
      
      return event;
    },
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network Error',
      'Failed to fetch',
    ],
  });

  console.warn('[Sentry] Initialized');
}

export { Sentry };