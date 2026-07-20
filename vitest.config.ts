import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './src/app'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/supabase': path.resolve(__dirname, './supabase'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});