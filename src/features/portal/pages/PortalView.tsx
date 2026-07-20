import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Feedback';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const ClientPortalTemplate = React.lazy(() => import('../components/ClientPortalTemplate').then(m => ({ default: m.ClientPortalTemplate })));

export const PortalView: React.FC = () => {
  const { portalToken } = useParams<{ portalToken: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasFreelancerSession = !!user;

  if (!portalToken) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8">
      {hasFreelancerSession && (
        <div className="max-w-4xl mx-auto px-4 mb-4 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← Back to Freelancer view
          </Button>
        </div>
      )}
      <ErrorBoundary fallback={<div className="flex items-center justify-center p-24"><p className="text-destructive">Failed to load client portal. Please try refreshing or contact support.</p></div>}>
        <React.Suspense fallback={<div className="flex items-center justify-center p-24"><Spinner size="lg" /></div>}>
          <ClientPortalTemplate portalToken={portalToken} />
        </React.Suspense>
      </ErrorBoundary>
    </div>
  );
};
