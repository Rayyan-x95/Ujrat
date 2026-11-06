import posthog from 'posthog-js';
import { deepRedact, redactPortalToken } from '@/shared/utils/sanitize';

let initialized = false;

export function initPostHog() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
  
  if (!apiKey || initialized) {
    if (!apiKey && import.meta.env.DEV && !initialized) {
      console.debug('[PostHog] API key not configured, skipping initialization');
    }
    return;
  }

  posthog.init(apiKey, {
    api_host: host,
    autocapture: false,           // PageTracker handles page views; autocapture adds DOM overhead per click
    capture_pageview: false,       // manual trackPageView() in App.tsx PageTracker handles this
    capture_pageleave: true,
    persistence: 'localStorage',
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        posthog.debug(true);
        console.debug('[PostHog] Initialized');
      }
    },
    disable_session_recording: true,
    person_profiles: 'identified_only',
    respect_dnt: true,
    mask_all_element_attributes: true,
    // Autocapture is off, but pageleave and error events still carry the URL;
    // strip the portal bearer token before anything is sent.
    before_send: (event) => (event ? deepRedact(event) : event),
  });

  initialized = true;
}

export function trackPageView(url: string, title?: string) {
  if (!initialized) return;
  
  posthog.capture('$pageview', {
    $current_url: redactPortalToken(url),
    $title: title || document.title,
  });
}

