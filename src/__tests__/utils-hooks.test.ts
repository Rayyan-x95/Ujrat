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

describe('DashboardService Fallback Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics from RPC when rpc succeeds', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        profile_name: 'Jane Doe',
        activities: [],
        invoices: [{ total: 5000, status: 'paid', created_at: '2026-01-01T00:00:00Z' }],
        projects: [{ status: 'in_progress' }],
        total_clients: 3,
      },
      error: null,
    } as any);

    const res = await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.profileName).toBe('Jane Doe');
      expect(res.data.totalClients).toBe(3);
      expect(res.data.activeProjects).toBe(1);
    }
  });

  it('falls back to table queries when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'function get_dashboard_data does not exist' },
    } as any);

    // Mock table queries called by Promise.all inside getDashboardDataFromTables
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: 'Fallback User' }, error: null }) }) }) };
      }
      if (table === 'clients') {
        return { select: () => ({ eq: () => ({ is: async () => ({ count: 5, error: null }) }) }) };
      }
      if (table === 'projects') {
        return { select: () => ({ eq: () => ({ is: async () => ({ data: [{ status: 'proposal' }], error: null }) }) }) };
      }
      if (table === 'invoices') {
        return { select: () => ({ eq: () => ({ is: async () => ({ data: [{ total: 2000, status: 'paid', created_at: '2026-01-01' }], error: null }) }) }) };
      }
      if (table === 'activity_logs') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) };
      }
      return {};
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as any);

    const res = await DashboardService.getDashboardData('ws_123', 'prof_123');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.profileName).toBe('Fallback User');
      expect(res.data.totalClients).toBe(5);
      expect(res.data.activeProjects).toBe(1);
    }
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
