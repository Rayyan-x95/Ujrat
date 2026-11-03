import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid Supabase URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_APP_URL: z.string().url().default('http://localhost:5173'),
});

const getEnvVars = () => {
  const isTest = Boolean(import.meta.env?.VITEST);
  const vars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || (isTest ? 'http://localhost:54321' : undefined),
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || (isTest ? 'test-anon-key' : undefined),
    VITE_APP_URL: import.meta.env.VITE_APP_URL || (isTest ? 'http://localhost:5173' : undefined),
  };

  const parsed = envSchema.safeParse(vars);

  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
};

export const env = getEnvVars();
export default env;
