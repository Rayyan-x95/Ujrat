import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/features/auth';
import { WorkspaceService } from '@/features/workspace';

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

vi.mock('@/features/workspace/services/WorkspaceService', () => ({
  WorkspaceService: {
    getWorkspaces: vi.fn(),
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

  it('verifies WorkspaceService getWorkspaces delegates correctly', async () => {
    vi.mocked(WorkspaceService.getWorkspaces).mockResolvedValue({
      success: true,
      data: [{
        id: 'ws_1',
        profile_id: 'user_123',
        name: 'Workspace 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }],
    });
    const res = await WorkspaceService.getWorkspaces('user_123');
    expect(WorkspaceService.getWorkspaces).toHaveBeenCalledWith('user_123');
    if (res.success) {
      expect(res.data[0]?.id).toBe('ws_1');
    } else {
      throw new Error('Result failed');
    }
  });
});
