import { supabase } from '@/shared/lib/supabaseClient';
import type { Result, ActivityLog } from '@/shared/types';

export interface DashboardMetrics {
  profileName: string;
  activeProjects: number;
  outstanding: number;
  earnedThisMonth: number;
  totalClients: number;
  pipeline: { label: string; count: number; variant: 'outline' | 'primary' | 'success' | 'warning' }[];
  activities: ActivityLog[];
  monthlyRevenue: number[];
}

export class DashboardService {
  static getEmptyMetrics(profileName: string = 'Freelancer'): DashboardMetrics {
    return {
      profileName,
      activeProjects: 0,
      outstanding: 0,
      earnedThisMonth: 0,
      totalClients: 0,
      pipeline: [],
      activities: [],
      monthlyRevenue: new Array(12).fill(0),
    };
  }

  static async getDashboardData(workspaceId: string, profileId: string): Promise<Result<DashboardMetrics>> {
    if (!workspaceId) {
      return { success: true, data: this.getEmptyMetrics('Freelancer') };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_data', {
        p_workspace_id: workspaceId,
        p_profile_id: profileId || '',
      });

      if (!rpcError && rpcData) {
        const typedData = rpcData as {
          profile_name: string;
          activities: ActivityLog[];
          invoices: { total: number | null; status: string; created_at: string }[];
          projects: { status: string }[];
          total_clients: number;
        };

        return this.calculateMetrics(
          typedData.profile_name || 'Freelancer',
          typedData.total_clients || 0,
          typedData.projects || [],
          typedData.invoices || [],
          typedData.activities || []
        );
      }

      return await this.getDashboardDataFromTables(workspaceId, profileId);
    } catch {
      return await this.getDashboardDataFromTables(workspaceId, profileId);
    }
  }

  private static async getDashboardDataFromTables(
    workspaceId: string,
    profileId: string
  ): Promise<Result<DashboardMetrics>> {
    try {
      const [profileRes, clientsRes, projectsRes, invoicesRes, activitiesRes] = await Promise.allSettled([
        profileId ? supabase.from('profiles').select('full_name').eq('id', profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from('clients').select('id', { count: 'exact' }).eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('projects').select('status').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('invoices').select('total, status, created_at').eq('workspace_id', workspaceId).is('deleted_at', null),
        profileId
          ? supabase
              .from('activity_logs')
              .select('id, workspace_id, profile_id, project_id, action, details, created_at')
              .eq('workspace_id', workspaceId)
              .eq('profile_id', profileId)
              .order('created_at', { ascending: false })
              .limit(5)
          : supabase
              .from('activity_logs')
              .select('id, workspace_id, profile_id, project_id, action, details, created_at')
              .eq('workspace_id', workspaceId)
              .order('created_at', { ascending: false })
              .limit(5),
      ]);

      const profileName = (profileRes.status === 'fulfilled' && (profileRes.value as any)?.data?.full_name) || 'Freelancer';
      const totalClients = (clientsRes.status === 'fulfilled' && (clientsRes.value as any)?.count) || 0;
      const projects = (projectsRes.status === 'fulfilled' && ((projectsRes.value as any)?.data || [])) as { status: string }[];
      const invoiceData = (invoicesRes.status === 'fulfilled' && ((invoicesRes.value as any)?.data || [])) as { total: number | null; status: string; created_at: string }[];
      const activities = (activitiesRes.status === 'fulfilled' && ((activitiesRes.value as any)?.data || [])) as ActivityLog[];

      return this.calculateMetrics(profileName, totalClients, projects, invoiceData, activities);
    } catch {
      return { success: true, data: this.getEmptyMetrics('Freelancer') };
    }
  }

  private static calculateMetrics(
    profileName: string,
    totalClients: number,
    projects: { status: string }[],
    invoiceData: { total: number | null; status: string; created_at: string }[],
    activities: ActivityLog[]
  ): Result<DashboardMetrics> {
    let activeProjects = 0;
    let outstanding = 0;
    let earnedThisMonth = 0;
    const pipelineMap = new Map<string, number>();
    const monthlyRevenue = new Array(12).fill(0);

    (projects || []).forEach((p) => {
      if (!p) return;
      const status = p.status;
      if (['proposal', 'approved', 'contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent'].includes(status)) {
        activeProjects++;
      }
      if (status === 'proposal') pipelineMap.set('Proposal Sent', (pipelineMap.get('Proposal Sent') || 0) + 1);
      if (status === 'contract_signed') pipelineMap.set('Contract Sent', (pipelineMap.get('Contract Sent') || 0) + 1);
      if (['advance_paid', 'in_progress', 'delivered'].includes(status)) pipelineMap.set('In Progress', (pipelineMap.get('In Progress') || 0) + 1);
      if (status === 'invoice_sent') pipelineMap.set('Invoice Shared', (pipelineMap.get('Invoice Shared') || 0) + 1);
    });

    (invoiceData || []).forEach((inv) => {
      if (!inv) return;
      const amount = Number(inv.total) || 0;
      if (inv.status === 'paid') {
        earnedThisMonth += amount;
        if (inv.created_at) {
          const monthIndex = new Date(inv.created_at).getMonth();
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyRevenue[monthIndex] += amount;
          }
        }
      } else if (inv.status !== 'cancelled') {
        outstanding += amount;
      }
    });

    const pipelineVariants: Record<string, 'outline' | 'primary' | 'success' | 'warning'> = {
      'Proposal Sent': 'outline',
      'Contract Sent': 'primary',
      'In Progress': 'success',
      'Invoice Shared': 'warning',
    };

    const pipeline = Array.from(pipelineMap.entries()).map(([label, count]) => ({
      label,
      count,
      variant: pipelineVariants[label] || 'outline',
    }));

    return {
      success: true,
      data: {
        profileName: profileName || 'Freelancer',
        activeProjects,
        outstanding,
        earnedThisMonth,
        totalClients,
        pipeline,
        activities: activities || [],
        monthlyRevenue,
      },
    };
  }
}