import type { Deliverable, DeliverableInsert, QueryOptions, PaginatedResult } from '@/shared/types';
import { buildPaginatedQuery, buildGetByProjectIdQuery, buildCreateQuery, buildUpdateQuery, buildSoftDeleteQuery } from '@/shared/lib/queryBuilder';

export class DeliverableRepository {
  private static readonly config = {
    table: 'deliverables',
    selectColumns: '*',
    allowedFilters: ['project_id'],
    allowedSearches: ['name'],
    defaultSortBy: 'created_at',
    defaultSortOrder: 'desc' as const,
  };

  static async getByProjectId(workspaceId: string, projectId: string): Promise<Deliverable[]> {
    return buildGetByProjectIdQuery<Deliverable>(workspaceId, projectId, this.config.table);
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Deliverable>> {
    return buildPaginatedQuery<Deliverable>(workspaceId, options, this.config);
  }

  static async addDeliverable(workspaceId: string, deliverableData: DeliverableInsert): Promise<Deliverable> {
    return buildCreateQuery<DeliverableInsert, Deliverable>(workspaceId, deliverableData, this.config.table);
  }

  static async markDownloaded(workspaceId: string, id: string): Promise<Deliverable> {
    return buildUpdateQuery<Partial<DeliverableInsert>, Deliverable>(workspaceId, id, { downloaded_at: new Date().toISOString() } as unknown as Partial<DeliverableInsert>, this.config.table);
  }

  static async update(workspaceId: string, id: string, deliverableData: Partial<DeliverableInsert>): Promise<Deliverable> {
    return buildUpdateQuery<Partial<DeliverableInsert>, Deliverable>(workspaceId, id, deliverableData, this.config.table);
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return buildSoftDeleteQuery(workspaceId, id, this.config.table);
  }
}