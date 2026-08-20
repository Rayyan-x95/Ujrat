import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('rejects short passwords before invoking backend', async () => {
    const signUpSpy = vi.spyOn(supabase.auth, 'signUp');
    const signupRes = await AuthService.signUp('test@example.com', 'short', 'Test User');

    expect(signupRes.success).toBe(false);
    if (!signupRes.success) {
      expect(signupRes.error.message).toContain('at least 12 characters');
    }
    expect(signUpSpy).not.toHaveBeenCalled();
  });
});

