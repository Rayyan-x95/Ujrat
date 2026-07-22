import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { Spinner } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/features/auth';
import { useToastStore } from '@/shared/hooks/useToastStore';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { ProjectService } from '@/features/projects/services/ProjectService';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';

// Lazy-loaded Templates with preloader references
const loadDashboard = () => import('@/features/dashboard/components/DashboardTemplate').then(m => ({ default: m.DashboardTemplate }));
const loadClients = () => import('@/features/clients/components/ClientsTemplate').then(m => ({ default: m.ClientsTemplate }));
const loadProjects = () => import('@/features/projects/components/ProjectsTemplate').then(m => ({ default: m.ProjectsTemplate }));
const loadProjectDetails = () => import('@/features/projects/components/ProjectDetailsTemplate').then(m => ({ default: m.ProjectDetailsTemplate }));
const loadInvoices = () => import('@/features/invoices/components/InvoicesTemplate').then(m => ({ default: m.InvoicesTemplate }));
const loadSettings = () => import('@/features/settings/components/SettingsTemplate').then(m => ({ default: m.SettingsTemplate }));
const loadPayments = () => import('@/features/payments/components/PaymentsTemplate').then(m => ({ default: m.PaymentsTemplate }));

const DashboardTemplate = React.lazy(loadDashboard);
const ClientsTemplate = React.lazy(loadClients);
const ProjectsTemplate = React.lazy(loadProjects);
const ProjectDetailsTemplate = React.lazy(loadProjectDetails);
const InvoicesTemplate = React.lazy(loadInvoices);
const SettingsTemplate = React.lazy(loadSettings);
const PaymentsTemplate = React.lazy(loadPayments);

export interface WorkspaceViewProps {
  view: 'dashboard' | 'clients' | 'projects' | 'project-details' | 'invoices' | 'payments' | 'settings';
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ view }) => {
  const navigate = useNavigate();
  const { projectId, tab } = useParams<{ projectId?: string; tab?: string }>();
  const addToast = useToastStore((state) => state.addToast);

  const { user, workspaceId, profileId, authLoading, signOut: handleSignOut } = useAuth();

  // Preload all workspace component chunks in idle time for instant (0ms) tab switching
  React.useEffect(() => {
    const preloadAll = () => {
      loadDashboard();
      loadClients();
      loadProjects();
      loadInvoices();
      loadPayments();
      loadSettings();
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadAll);
    } else {
      setTimeout(preloadAll, 200);
    }
  }, []);

  // getPortalToken and getInvoiceDetails are called directly via services
  // inside event handlers rather than pre-loading full collections via hooks,
  // which was firing redundant Supabase fetches on every WorkspaceView mount.

  const handleViewChange = (v: string) => {
    navigate(`/${v}`);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardLayout
        currentView={view === 'project-details' ? 'projects' : view}
        onViewChange={handleViewChange}
        breadcrumbs={['Ujrat Workspace', view.toUpperCase()]}
        user={user}
        workspaceId={workspaceId}
        profileId={profileId}
      >
        <ErrorBoundary fallback={<div className="p-24 text-center"><p className="text-destructive">Failed to load this view. Please try refreshing or contact support.</p></div>}>
          <React.Suspense fallback={<div className="flex items-center justify-center p-24"><Spinner size="lg" /></div>}>
            {view === 'project-details' && projectId ? (
              <ProjectDetailsTemplate
                projectId={projectId}
                workspaceId={workspaceId}
                profileId={profileId}
                onBack={() => navigate('/projects')}
                onShowInvoice={async (invoiceId: string) => {
                  try {
                    const tokenRes = await ProjectService.getProjectPortalToken(workspaceId, projectId);
                    if (tokenRes.success && tokenRes.data) {
                      window.open(`/portal/${tokenRes.data}/invoice/${invoiceId}/print`, '_blank', 'noopener,noreferrer');
                    } else {
                      addToast('warning', 'No portal token', 'This project does not have a portal link yet.');
                    }
                  } catch (e: any) {
                    addToast('error', 'Failed to open invoice', e.message);
                  }
                }}
                addToast={addToast}
              />
            ) : (
              <>
                {view === 'dashboard' && (
                  <DashboardTemplate workspaceId={workspaceId} profileId={profileId} />
                )}
                {view === 'clients' && (
                  <ClientsTemplate workspaceId={workspaceId} profileId={profileId} addToast={addToast} />
                )}
                {view === 'projects' && (
                  <ProjectsTemplate
                    workspaceId={workspaceId}
                    profileId={profileId}
                    onSelectProject={(id) => navigate(`/projects/${id}`)}
                    addToast={addToast}
                  />
                )}
                {view === 'invoices' && (
                  <InvoicesTemplate
                    workspaceId={workspaceId}
                    profileId={profileId}
                    onShowInvoiceDetail={async (invoiceId) => {
                      try {
                        const invoiceRes = await InvoiceService.getInvoiceDetails(workspaceId, invoiceId);
                        if (invoiceRes.success && invoiceRes.data?.project_id) {
                          const tokenRes = await ProjectService.getProjectPortalToken(workspaceId, invoiceRes.data.project_id);
                          if (tokenRes.success && tokenRes.data) {
                            navigate(`/portal/${tokenRes.data}`);
                          }
                        }
                      } catch (e: any) {
                        addToast('error', 'Failed to open invoice link', e.message);
                      }
                    }}
                    addToast={addToast}
                  />
                )}
                {view === 'payments' && (
                  <PaymentsTemplate workspaceId={workspaceId} profileId={profileId} addToast={addToast} />
                )}
                {view === 'settings' && (
                  <div className="space-y-6">
                    <SettingsTemplate workspaceId={workspaceId} profileId={profileId} addToast={addToast} activeTab={tab || 'profile'} />
                    <div className="flex justify-end border-t border-border pt-4">
                      <Button variant="ghost" size="sm" onClick={handleSignOut}>
                        Sign Out / Exit Workspace
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </React.Suspense>
        </ErrorBoundary>
      </DashboardLayout>
    </div>
  );
};
export default WorkspaceView;
