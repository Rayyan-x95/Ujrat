import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react() as any],
  resolve: {
    alias: {
      '@/app': import.meta.dirname + '/src/app',
      '@/shared': import.meta.dirname + '/src/shared',
      '@/features': import.meta.dirname + '/src/features',
      '@/supabase': import.meta.dirname + '/../backend/supabase',
      '@ujrat/shared-types': import.meta.dirname + '/../packages/shared-types/src',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});