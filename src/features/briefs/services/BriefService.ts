import { BriefRepository } from '@/features/briefs';
import type { ProjectBrief, Result, ProjectBriefInsert } from '@/shared/types';
import { BriefSchema } from '@/shared/validation/schemas';

export class BriefService {
  static async getBrief(workspaceId: string, projectId: string): Promise<Result<ProjectBrief | null>> {
    try {
      const data = await BriefRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async saveBrief(
    workspaceId: string,
    _profileId: string,
    projectId: string,
    briefData: {
      description: string;
      goals: string;
      deadline?: string;
      budget?: number;
      references?: string;
    }
  ): Promise<Result<ProjectBrief>> {
    try {
      const validated = BriefSchema.parse(briefData);
      const brief = await BriefRepository.createOrUpdate(workspaceId, projectId, {
        description: validated.description,
        goals: validated.goals,
        deadline: validated.deadline || null,
        budget: validated.budget || null,
        references: validated.references || null,
      } as ProjectBriefInsert);
      return { success: true, data: brief };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}