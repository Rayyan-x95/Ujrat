// Build-time only: renders the real app shell to static HTML so crawlers that do
// not execute JavaScript see content. Used by scripts/prerender.mjs; never
// imported by the client bundle.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/app/router/App';
import * as PublicPages from '@/features/public/pages/PublicPages';
import { LandingPage } from '@/features/landing/pages/LandingPage';

export function render(path: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppShell preloaded={{ ...PublicPages, LandingPage }} />
    </MemoryRouter>,
  );
}
