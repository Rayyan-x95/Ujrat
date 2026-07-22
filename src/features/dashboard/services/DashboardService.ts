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
  static async getDashboardData(workspaceId: string, profileId: string): Promise<Result<DashboardMetrics>> {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_data', {
        p_workspace_id: workspaceId,
        p_profile_id: profileId,
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

      // If RPC fails or is missing, fallback to querying database tables directly
      return await this.getDashboardDataFromTables(workspaceId, profileId);
    } catch {
      // Direct table query fallback on exception
      return await this.getDashboardDataFromTables(workspaceId, profileId);
    }
  }

  private static async getDashboardDataFromTables(
    workspaceId: string,
    profileId: string
  ): Promise<Result<DashboardMetrics>> {
    try {
      const [profileRes, clientsRes, projectsRes, invoicesRes, activitiesRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', profileId).maybeSingle(),
        supabase.from('clients').select('id', { count: 'exact' }).eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('projects').select('status').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('invoices').select('total, status, created_at').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase
          .from('activity_logs')
          .select('id, workspace_id, profile_id, project_id, action, details, created_at')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const profileName = profileRes.data?.full_name || 'Freelancer';
      const totalClients = clientsRes.count || 0;
      const projects = (projectsRes.data || []) as { status: string }[];
      const invoiceData = (invoicesRes.data || []) as { total: number | null; status: string; created_at: string }[];
      const activities = (activitiesRes.data || []) as ActivityLog[];

      return this.calculateMetrics(profileName, totalClients, projects, invoiceData, activities);
    } catch (e) {
      return { success: false, error: e as Error };
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

    projects.forEach((p) => {
      const status = p.status;
      if (['proposal', 'approved', 'contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent'].includes(status)) {
        activeProjects++;
      }
      if (status === 'proposal') pipelineMap.set('Proposal Sent', (pipelineMap.get('Proposal Sent') || 0) + 1);
      if (status === 'contract_signed') pipelineMap.set('Contract Sent', (pipelineMap.get('Contract Sent') || 0) + 1);
      if (['advance_paid', 'in_progress', 'delivered'].includes(status)) pipelineMap.set('In Progress', (pipelineMap.get('In Progress') || 0) + 1);
      if (status === 'invoice_sent') pipelineMap.set('Invoice Shared', (pipelineMap.get('Invoice Shared') || 0) + 1);
    });

    // Calculate from invoices
    invoiceData.forEach((inv) => {
      if (inv.status === 'paid') {
        earnedThisMonth += Number(inv.total) || 0;
      }
      if (inv.status !== 'paid' && inv.status !== 'cancelled') {
        outstanding += Number(inv.total) || 0;
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

    // Initialize monthly revenue for all 12 months with zeros
    const monthlyRevenue = new Array(12).fill(0);
    invoiceData.forEach((inv) => {
      if (inv.status === 'paid') {
        const date = new Date(inv.created_at);
        const monthIndex = date.getMonth();
        monthlyRevenue[monthIndex] = (monthlyRevenue[monthIndex] ?? 0) + (Number(inv.total) || 0);
      }
    });

    return {
      success: true,
      data: {
        profileName,
        activeProjects,
        outstanding,
        earnedThisMonth,
        totalClients,
        pipeline,
        activities,
        monthlyRevenue,
      },
    };
  }
}