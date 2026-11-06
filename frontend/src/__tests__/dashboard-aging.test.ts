import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '@/features/dashboard';
import { supabase } from '@/shared/lib/supabaseClient';

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

const rpcWithAging = {
  profile: { name: 'Jane Doe' },
  metrics: {
    total_clients: 3,
    outstanding: 9000,
    earned_this_month: 1500,
    monthly_revenue: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
    aging: { overdue: 4000, due_7d: 3000, later: 2000 },
  },
  recent_projects: [{ status: 'in_progress' }],
  recent_invoices: [],
  recent_activities: [],
};

describe('Dashboard aging (RPC-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps RPC aging buckets onto metrics', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rpcWithAging, error: null } as any);

    const res = await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(res.aging).toEqual({ overdue: 4000, due_7d: 3000, later: 2000 });
    expect(res.profileName).toBe('Jane Doe');
    expect(res.totalClients).toBe(3);
    expect(res.outstanding).toBe(9000);
  });

  it('calls the RPC exactly once and never touches tables', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rpcWithAging, error: null } as any);
    vi.mocked(supabase.from).mockClear();

    await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('defaults aging to zeros when the RPC omits it', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { profile_name: 'Jane Doe', activities: [], invoices: [], projects: [], total_clients: 1 },
      error: null,
    } as any);

    const res = await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(res.aging).toEqual({ overdue: 0, due_7d: 0, later: 0 });
  });

  it('throws on RPC error (no table fallback)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'function get_dashboard_data does not exist' },
    } as any);
    vi.mocked(supabase.from).mockClear();

    await expect(DashboardService.getDashboardData('ws_123', 'prof_123')).rejects.toMatchObject({
      message: 'function get_dashboard_data does not exist',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns empty metrics (with zero aging) without a workspace', async () => {
    const res = await DashboardService.getDashboardData('', '');
    expect(res.aging).toEqual({ overdue: 0, due_7d: 0, later: 0 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
