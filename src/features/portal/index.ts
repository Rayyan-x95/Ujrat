// PortalView is a route page lazy-loaded by the router.
// ClientPortalTemplate is lazy-loaded inside PortalView.
// Neither is re-exported here to preserve code-splitting.
export { useClientPortal } from './hooks/useClientPortal';
export { PortalService } from './services/PortalService';
export { PortalRepository } from './repositories/PortalRepository';
