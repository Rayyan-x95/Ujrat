import { ClientRepository } from '../repositories/ClientRepository';
import { ClientSchema } from '@/shared/validation/schemas';
import type { Client, ClientInsert, Result, QueryOptions, PaginatedResult } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';

export class ClientService {
  static async listClients(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<Client>>> {
    try {
      const data = await ClientRepository.getAll(workspaceId, options);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async addClient(
    workspaceId: string,
    profileId: string,
    clientData: Omit<Client, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ): Promise<Result<Client>> {
    try {
      // 1. Zod Validation
      const validated = ClientSchema.parse(clientData);

      // 2. Call Repository
      const client = await ClientRepository.create(workspaceId, validated as ClientInsert);

      // 3. Log Activity
      await LoggingService.logActivity({
        workspaceId,
        profileId,
        action: 'Client Created',
        details: { clientId: client.id, name: client.name },
      });

      return { success: true, data: client };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async editClient(
    workspaceId: string,
    profileId: string,
    id: string,
    clientData: Partial<Client>
  ): Promise<Result<Client>> {
    try {
      const client = await ClientRepository.update(workspaceId, id, clientData);

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        action: 'Client Updated',
        details: { clientId: id },
      });

      return { success: true, data: client };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async removeClient(workspaceId: string, profileId: string, id: string): Promise<Result<void>> {
    try {
      await ClientRepository.softDelete(workspaceId, id);

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        action: 'Client Archived',
        details: { clientId: id },
      });

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
