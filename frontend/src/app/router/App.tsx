import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

// UI Components
import { Spinner, ToastContainer } from '@/shared/ui/Feedback';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { useAuth, AuthProvider } from '@/features/auth';
import { RoutingRedirects } from './RoutingRedirects';

// Public marketing pages are eager: their route HTML is prerendered, so the
// client tree must match on the first hydration render (lazy() suspends).
import { LandingPage } from '@/features/landing/pages/LandingPage';
import {
  PrivacyPage,
  TermsPage,
  SecurityPage,
  PricingPage,
  FeaturesPage,
  GSTPage,
  UPIPage,
  ContractsPage,
  DocsPage,
  ContactPage,
  StatusPage,
  FAQPage,
  NotFoundPage,
} from '@/features/public/pages/PublicPages';

// Lazy-loaded route components — each route only downloads its chunk on first visit
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

  const renderLandingPage = () => {
    // Check if there is a previously stored Supabase auth session token in localStorage
    const hasPreviousSession = typeof window !== 'undefined' && 
      Object.keys(localStorage).some(key => key.includes('auth-token'));

    if (hasPreviousSession && authLoading) {
      return <RouteLoader />;
    }
    return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
  };

  return (
    <Suspense fallback={<RouteLoader />}>
      <RoutingRedirects />
      <Routes>
        {/* Public Marketing Landing Page */}
        <Route path="/" element={renderLandingPage()} />

        {/* Public Legal, Marketing & Docs Pages */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/gst" element={<GSTPage />} />
        <Route path="/upi" element={<UPIPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/faq" element={<FAQPage />} />
        {/* Old pre-launch funnel — the product is live, so send it to signup. */}
        <Route path="/waitlist" element={<Navigate to="/signup" replace />} />

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
        <Route path="/settings/:tab" element={authGate(<ErrorBoundary><WorkspaceView view="settings" /></ErrorBoundary>)} />

        {/* Dedicated 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <ToastContainer />
    </Suspense>
  );
}

// Everything above the router. The prerenderer renders this same tree inside a
// MemoryRouter so the server markup matches what the client hydrates.
export function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <UjratApp />
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
