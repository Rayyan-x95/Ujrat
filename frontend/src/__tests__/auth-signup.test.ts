import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { AuthService } from '@/features/auth';
import { supabase } from '@/shared/lib/supabaseClient';

describe('Auth Signup Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully maps successful signup response', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: mockUser as any, session: null },
      error: null,
    });

    const signupRes = await AuthService.signUp('test@example.com', 'SecurePassword123!', 'Test User');
    expect(signupRes.success).toBe(true);
    if (signupRes.success) {
      expect(signupRes.data).toEqual(mockUser);
    }
  });

  it('handles backend signup error correctly', async () => {
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', name: 'AuthApiError', status: 400 } as any,
    });

    const signupRes = await AuthService.signUp('existing@example.com', 'SecurePassword123!', 'Existing User');
    expect(signupRes.success).toBe(false);
    if (!signupRes.success) {
      expect(signupRes.error.message).toBe('User already registered');
    }
  });

  it('caches workspace id synchronously and dropped the 200ms retry sleep', () => {
    const ROOT = process.cwd();
    const file = existsSync(path.join(ROOT, 'frontend/src/features/auth/hooks/useAuth.ts'))
      ? path.join(ROOT, 'frontend/src/features/auth/hooks/useAuth.ts')
      : path.join(ROOT, 'src/features/auth/hooks/useAuth.ts');
    const src = readFileSync(file, 'utf8');
    expect(src).toContain("WORKSPACE_CACHE_KEY = 'ujrat.workspaceId'");
    expect(src).toContain('localStorage.setItem(WORKSPACE_CACHE_KEY');
    expect(src).toContain('readWorkspaceCache()');
    expect(src).not.toContain('setTimeout(resolve, 200)');
    const wsFile = existsSync(path.join(ROOT, 'frontend/src/features/workspace/services/WorkspaceService.ts'))
      ? path.join(ROOT, 'frontend/src/features/workspace/services/WorkspaceService.ts')
      : path.join(ROOT, 'src/features/workspace/services/WorkspaceService.ts');
    const wsSrc = readFileSync(wsFile, 'utf8');
    expect(wsSrc).toContain(".select('id,name,profile_id,created_at')");
  });

  it('rejects short passwords before invoking backend', async () => {
    const signUpSpy = vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as any);
    const signupRes = await AuthService.signUp('test@example.com', 'short', 'Test User');

    expect(signupRes.success).toBe(false);
    if (!signupRes.success) {
      expect(signupRes.error.message).toContain('at least 12 characters');
    }
    expect(signUpSpy).not.toHaveBeenCalled();
  });
});

