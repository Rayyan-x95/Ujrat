import type { ProjectStatus } from '@/shared/types';

/**
 * Single source of truth for "how far along is this project" — the projects
 * list and the project detail page must never disagree on what 60% means.
 * Archived and completed projects are terminal, so they read as 100%.
 */
export const PROJECT_PROGRESS: Record<ProjectStatus, number> = {
  lead: 10,
  proposal: 20,
  approved: 40,
  contract_signed: 60,
  advance_paid: 70,
  in_progress: 75,
  delivered: 90,
  invoice_sent: 95,
  paid: 100,
  completed: 100,
  archived: 100,
};
