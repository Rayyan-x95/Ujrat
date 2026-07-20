import React from 'react';
import { Button } from '@/shared/ui/Button';
import { ErrorLayout } from '@/app/layouts/ErrorLayout';

export const NotFoundTemplate: React.FC<{ onGoHome?: () => void }> = ({ onGoHome }) => (
  <ErrorLayout>
    <p className="font-display text-7xl font-semibold text-muted-foreground/30 m-0">404</p>
    <h1 className="text-heading text-foreground m-0">Page not found</h1>
    <p className="text-body text-muted-foreground m-0">The page you're looking for doesn't exist or has been moved.</p>
    {onGoHome && (
      <div className="pt-4">
        <Button onClick={onGoHome}>Return to workspace</Button>
      </div>
    )}
  </ErrorLayout>
);

export const ServerErrorTemplate: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <ErrorLayout>
    <p className="font-display text-7xl font-semibold text-muted-foreground/30 m-0">500</p>
    <h1 className="text-heading text-foreground m-0">Something went wrong</h1>
    <p className="text-body text-muted-foreground m-0">We encountered an unexpected error. Please try again.</p>
    {onRetry && (
      <div className="pt-4">
        <Button onClick={onRetry}>Try again</Button>
      </div>
    )}
  </ErrorLayout>
);
