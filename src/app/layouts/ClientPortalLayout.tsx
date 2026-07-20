import React from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/ui/Button';

interface ClientPortalLayoutProps {
  children: React.ReactNode;
  projectName: string;
  freelancerName: string;
  nextStepLabel: string;
  nextStepActionLabel?: string;
  onNextStepClick?: () => void;
}

export const ClientPortalLayout: React.FC<ClientPortalLayoutProps> = ({
  children,
  projectName,
  freelancerName,
  nextStepLabel,
  nextStepActionLabel,
  onNextStepClick,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className="h-14 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 bg-background/95"
        style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display font-semibold text-small shrink-0">
            K
          </div>
          <div className="min-w-0">
            <h1 className="text-body font-medium m-0 truncate">{projectName}</h1>
            <p className="text-[11px] text-muted-foreground m-0 truncate">with {freelancerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-block text-[11px] text-muted-foreground bg-surface px-2.5 py-1 rounded-md">
            Client portal
          </span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              {theme === 'dark' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {(nextStepLabel || nextStepActionLabel) && (
        <div
          className="py-3 px-4 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface"
          style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}
        >
          <p className="text-small text-muted-foreground m-0">
            Next step: <span className="text-foreground font-medium">{nextStepLabel}</span>
          </p>
          {nextStepActionLabel && onNextStepClick && (
            <Button size="sm" onClick={onNextStepClick}>{nextStepActionLabel}</Button>
          )}
        </div>
      )}

      <main className="flex-1 px-4 md:px-8 py-8 max-w-3xl mx-auto w-full">
        {children}
      </main>

      <footer
        className="py-5 text-center text-[11px] text-muted-foreground"
        style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}
      >
        Powered by Ujrat
      </footer>
    </div>
  );
};

export default ClientPortalLayout;
