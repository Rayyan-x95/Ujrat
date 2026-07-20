import { trackEvent as trackPostHogEvent, trackPageView as trackPostHogPageView } from './posthog';

// Declarations for third-party analytics libraries injected in window
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props: Record<string, unknown> }) => void;
    va?: (eventName: string, properties?: Record<string, unknown>) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Unified Analytics Dispatcher
 * Sends events and page views to PostHog, Google Analytics, Plausible, Microsoft Clarity, and Vercel Analytics.
 */
export const analytics = {
  /**
   * Track a page view
   */
  pageView: (url: string, title?: string) => {
    const pageTitle = title || document.title;
    
    // 1. PostHog
    trackPostHogPageView(url, pageTitle);

    // 2. Google Analytics (gtag)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: url,
        page_title: pageTitle,
      });
    }

    // 3. Plausible
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible('pageview', { props: { path: url } });
    }

    if (import.meta.env.DEV) {
      console.log(`[Analytics] PageView tracked: ${url} (${pageTitle})`);
    }
  },

  /**
   * Track a custom user interaction/event
   */
  event: (name: string, properties?: Record<string, any>) => {
    // 1. PostHog
    trackPostHogEvent(name, properties);

    // 2. Google Analytics (gtag)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', name, properties);
    }

    // 3. Microsoft Clarity
    if (typeof window !== 'undefined' && window.clarity) {
      window.clarity('event', name);
    }

    // 4. Plausible
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible(name, { props: properties || {} });
    }

    // 5. Vercel Analytics
    if (typeof window !== 'undefined' && window.va) {
      window.va(name, properties);
    }

    if (import.meta.env.DEV) {
      console.log(`[Analytics] Event tracked: ${name}`, properties);
    }
  },
};

export default analytics;
