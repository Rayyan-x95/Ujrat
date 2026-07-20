import posthog from 'posthog-js';

let initialized = false;

export function initPostHog() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
  
  if (!apiKey || initialized) {
    console.warn('[PostHog] Not initialized - missing API key or already initialized');
    return;
  }

  posthog.init(apiKey, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        posthog.debug(true);
        console.warn('[PostHog] Initialized');
      }
    },
    disable_session_recording: import.meta.env.PROD ? false : true,
    person_profiles: 'identified_only',
    respect_dnt: true,
    mask_all_element_attributes: true,
  });

  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) {
    console.warn('[PostHog] Not initialized, cannot identify user');
    return;
  }
  
  posthog.identify(userId, {
    ...traits,
    last_seen: new Date().toISOString(),
  });
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!initialized) {
    console.warn('[PostHog] Not initialized, cannot track event');
    return;
  }
  
  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

export function trackPageView(url: string, title?: string) {
  if (!initialized) return;
  
  posthog.capture('$pageview', {
    $current_url: url,
    $title: title || document.title,
  });
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function isPostHogInitialized() {
  return initialized;
}

export { posthog };