// Only export non-route components, hooks, services, and repositories.
// Template components (ClientsTemplate) are lazy-loaded directly in WorkspaceView
// to enable proper code-splitting.
export { useClients } from './hooks/useClients';
export { ClientService } from './services/ClientService';
export { ClientRepository } from './repositories/ClientRepository';
