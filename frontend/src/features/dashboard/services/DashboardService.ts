import { supabase } from '@/shared/lib/supabaseClient';
import type { ActivityLog } from '@/shared/types';

export interface DashboardAging {
  overdue: number;
  due_7d: number;
  later: number;
}

export interface DashboardMetrics {
  profileName: string;
  activeProjects: number;
  outstanding: number;
  earnedThisMonth: number;
  totalClients: number;
  pipeline: { label: string; count: number; variant: 'outline' | 'primary' | 'success' | 'warning' }[];
  activities: ActivityLog[];
  monthlyRevenue: number[];
  aging: DashboardAging;
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
      aging: { overdue: 0, due_7d: 0, later: 0 },
    };
  }

  static async getDashboardData(workspaceId: string, profileId: string): Promise<DashboardMetrics> {
    if (!workspaceId) return this.getEmptyMetrics('Freelancer');

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_data', {
      p_workspace_id: workspaceId,
      p_profile_id: profileId || '',
    });
    if (rpcError) throw rpcError;
    if (!rpcData) throw new Error('Dashboard RPC returned no data');

    const raw = rpcData as {
      profile?: { name?: string };
      profile_name?: string;
      metrics?: {
        total_clients?: number;
        outstanding?: number;
        earned_this_month?: number;
        monthly_revenue?: unknown[];
        aging?: { overdue?: number; due_7d?: number; later?: number };
      };
      aging?: { overdue?: number; due_7d?: number; later?: number };
      total_clients?: number;
      recent_projects?: { status: string }[];
      projects?: { status: string }[];
      recent_invoices?: { total: number | null; outstanding_balance?: number | null; status: string; created_at: string }[];
      invoices?: { total: number | null; outstanding_balance?: number | null; status: string; created_at: string }[];
      recent_activities?: ActivityLog[];
      activities?: ActivityLog[];
    };

    const profileName = raw.profile?.name || raw.profile_name || 'Freelancer';
    const totalClients = raw.metrics?.total_clients ?? raw.total_clients ?? 0;
    const projects = raw.recent_projects || raw.projects || [];
    const invoices = raw.recent_invoices || raw.invoices || [];
    const activities = raw.recent_activities || raw.activities || [];

    const agingRaw = raw.metrics?.aging ?? raw.aging ?? { overdue: 0, due_7d: 0, later: 0 };
    const aging: DashboardAging = {
      overdue: Number(agingRaw.overdue) || 0,
      due_7d: Number(agingRaw.due_7d) || 0,
      later: Number(agingRaw.later) || 0,
    };

    const result = this.calculateMetrics(profileName, totalClients, projects, invoices, activities, aging);
    if (raw.metrics) {
      if (raw.metrics.outstanding !== undefined) result.outstanding = Number(raw.metrics.outstanding) || 0;
      if (raw.metrics.earned_this_month !== undefined) result.earnedThisMonth = Number(raw.metrics.earned_this_month) || 0;
      if (Array.isArray(raw.metrics.monthly_revenue)) {
        result.monthlyRevenue = raw.metrics.monthly_revenue.map((v: unknown) => Number(v) || 0);
      }
    }
    return result;
  }

  private static calculateMetrics(
    profileName: string,
    totalClients: number,
    projects: { status: string }[],
    invoiceData: { total: number | null; outstanding_balance?: number | null; status: string; created_at: string }[],
    activities: ActivityLog[],
    aging: DashboardAging = { overdue: 0, due_7d: 0, later: 0 }
  ): DashboardMetrics {
    let activeProjects = 0;
    let outstanding = 0;
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
      if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') return;
      outstanding += Number(inv.outstanding_balance ?? inv.total) || 0;
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
        profileName: profileName || 'Freelancer',
        activeProjects,
        outstanding,
        earnedThisMonth: 0,
        totalClients,
        pipeline,
        activities: activities || [],
        monthlyRevenue,
        aging,
    };
  }
}
