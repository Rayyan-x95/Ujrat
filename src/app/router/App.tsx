import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../providers/ThemeProvider';
import * as Sentry from '@sentry/react';
import { useEffect, lazy, Suspense } from 'react';

// UI Components
import { Spinner, ToastContainer } from '@/shared/ui/Feedback';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { useAuth } from '@/features/auth';
import { RoutingRedirects } from './RoutingRedirects';
import { analytics } from '@/shared/lib/analytics';

// Lazy-loaded route components — each route only downloads its chunk on first visit
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('@/features/auth/pages/AuthPage').then(m => ({ default: m.AuthPage })));
const WorkspaceView = lazy(() => import('@/features/workspace/pages/WorkspaceView').then(m => ({ default: m.WorkspaceView })));
const PortalView = lazy(() => import('@/features/portal/pages/PortalView').then(m => ({ default: m.PortalView })));
const InvoicePrintView = lazy(() => import('@/features/invoices/components/InvoicePrintView').then(m => ({ default: m.InvoicePrintView })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // data is fresh for 60s — no refetch on mount
      gcTime: 5 * 60_000,          // keep cache 5 min after all subscribers unmount
      retry: 1,                    // retry once on failure (default is 3)
      refetchOnWindowFocus: false, // don't refetch when switching browser tabs
    },
  },
});

// PageTracker triggers unified analytics on route transitions
function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    analytics.pageView(location.pathname + location.search);
  }, [location]);

  return null;
}

// Minimal loading fallback shown while lazy chunks download
function RouteLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function UjratApp() {
  const { user, authLoading } = useAuth();

  // Public routes (landing, portal, print) render immediately.
  // Auth-gated routes get a spinner only while the session resolves.
  const authGate = (element: React.ReactNode) => {
    if (authLoading) return <RouteLoader />;
    return user ? <>{element}</> : <Navigate to="/login" replace />;
  };

  const guestOnly = (element: React.ReactNode) => {
    if (authLoading) return <RouteLoader />;
    return !user ? <>{element}</> : <Navigate to="/dashboard" replace />;
  };

  return (
    <Suspense fallback={<RouteLoader />}>
      <RoutingRedirects />
      <Routes>
        {/* Public Marketing Landing Page — renders immediately, no auth wait */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Client Portal */}
        <Route path="/portal/:portalToken" element={<PortalView />} />
        <Route path="/portal/:portalToken/invoice/:invoiceId/print" element={<InvoicePrintView />} />

        {/* Auth Routes */}
        <Route path="/login" element={guestOnly(<AuthPage mode="signin" />)} />
        <Route path="/signup" element={guestOnly(<AuthPage mode="signup" />)} />
        <Route path="/forgot" element={guestOnly(<AuthPage mode="forgot" />)} />
        <Route path="/reset" element={<AuthPage mode="reset" />} />

        {/* Authenticated Workspace Routes */}
        <Route path="/dashboard" element={authGate(<ErrorBoundary><WorkspaceView view="dashboard" /></ErrorBoundary>)} />
        <Route path="/clients" element={authGate(<ErrorBoundary><WorkspaceView view="clients" /></ErrorBoundary>)} />
        <Route path="/projects" element={authGate(<ErrorBoundary><WorkspaceView view="projects" /></ErrorBoundary>)} />
        <Route path="/projects/:projectId" element={authGate(<ErrorBoundary><WorkspaceView view="project-details" /></ErrorBoundary>)} />
        <Route path="/invoices" element={authGate(<ErrorBoundary><WorkspaceView view="invoices" /></ErrorBoundary>)} />
        <Route path="/payments" element={authGate(<ErrorBoundary><WorkspaceView view="payments" /></ErrorBoundary>)} />
        <Route path="/settings" element={authGate(<ErrorBoundary><WorkspaceView view="settings" /></ErrorBoundary>)} />

        {/* Catch-all Redirect */}
        <Route path="*" element={authLoading ? <RouteLoader /> : <Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
      <ToastContainer />
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Sentry.ErrorBoundary
            fallback={<div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
              <h2 className="text-heading font-semibold text-foreground">Something went wrong</h2>
              <p className="text-body text-muted-foreground mt-2">We encountered an unexpected error. Our team has been notified.</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Reload Page
              </button>
            </div>}
            showDialog={false}
          >
            <PageTracker />
            <UjratApp />
          </Sentry.ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
