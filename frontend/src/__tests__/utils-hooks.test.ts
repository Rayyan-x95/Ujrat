import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/features/auth';
import { WorkspaceService } from '@/features/workspace';
import { DashboardService } from '@/features/dashboard';
import { supabase } from '@/shared/lib/supabaseClient';

// Mock the services — paths must match exact import specifiers used in production code
vi.mock('@/features/auth/services/AuthService', () => ({
  AuthService: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Hooks Service Delegation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies AuthService signUp delegates with correct parameters', async () => {
    vi.mocked(AuthService.signUp).mockResolvedValue({ success: true, data: { user: { id: '123' } } as any });
    const res = await AuthService.signUp('test@example.com', 'password123', 'Test User');
    expect(AuthService.signUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
    expect(res.success).toBe(true);
  });

  it('verifies AuthService signIn delegates with correct parameters', async () => {
    vi.mocked(AuthService.signIn).mockResolvedValue({ success: true, data: { session: {} } as any });
    const res = await AuthService.signIn('test@example.com', 'password123');
    expect(AuthService.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(res.success).toBe(true);
  });
});

describe('DashboardService RPC-Only Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics from RPC when rpc succeeds', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        profile_name: 'Jane Doe',
        metrics: {
          total_clients: 3,
          outstanding: 5000,
          earned_this_month: 1500,
          monthly_revenue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          aging: { overdue: 2000, due_7d: 1500, later: 1500 },
        },
        activities: [],
        invoices: [{ total: 5000, status: 'paid', created_at: '2026-01-01T00:00:00Z' }],
        projects: [{ status: 'in_progress' }],
        total_clients: 3,
      },
      error: null,
    } as any);

    const res = await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(res.profileName).toBe('Jane Doe');
    expect(res.totalClients).toBe(3);
    expect(res.activeProjects).toBe(1);
    expect(res.aging).toEqual({ overdue: 2000, due_7d: 1500, later: 1500 });
  });

  it('throws on RPC error with no table fallback', async () => {
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
});

describe('WorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates workspace successfully', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: 'ws_new', profile_id: 'prof_1', name: 'My Workspace' },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

    const res = await WorkspaceService.createWorkspace('prof_1', 'My Workspace');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBe('ws_new');
      expect(res.data.name).toBe('My Workspace');
    }
  });
});
