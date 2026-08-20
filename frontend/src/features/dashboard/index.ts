// Only export non-route components, hooks, services, and repositories.
// Template components are lazy-loaded directly in WorkspaceView for code-splitting.
export { useDashboard } from './hooks/useDashboard';
export { DashboardService } from './services/DashboardService';
