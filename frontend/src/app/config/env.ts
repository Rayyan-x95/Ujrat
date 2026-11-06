const getEnvVars = () => {
  const isTest = Boolean((import.meta.env as any)?.VITEST);
  const env = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || (isTest ? 'http://localhost:54321' : undefined),
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || (isTest ? 'test-anon-key' : undefined),
    VITE_APP_URL: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  };

  let urlValid = false;
  try { urlValid = Boolean(new URL(env.VITE_SUPABASE_URL as string)); } catch { urlValid = false; }
  if (!urlValid || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Invalid environment configuration');
  }

  return env;
};

export const env = getEnvVars();
export default env;
