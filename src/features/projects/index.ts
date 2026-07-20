// Template components (ProjectsTemplate, ProjectDetailsTemplate) are lazy-loaded
// directly in WorkspaceView for code-splitting — not exported here.
export { useProjects } from './hooks/useProjects';
export { useProjectDetails } from './hooks/useProjectDetails';
export { ProjectService } from './services/ProjectService';
export { ProjectRepository } from './repositories/ProjectRepository';
