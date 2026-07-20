import { createClient } from '@supabase/supabase-js';
import { env } from '@/app/config/env';
import type { Database } from '@/shared/types/database.types';

const fetchWithRetry = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  const maxRetries = 3;
  let delay = 300;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      // Retry on transient server errors (500+)
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return fetch(url, options);
};

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: fetchWithRetry,
    },
  }
);

