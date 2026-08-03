import { describe, it, expect } from 'vitest';
import { AuthService } from '@/features/auth';

describe('Auth Signup Verification', () => {
  it('should attempt sign up without top-level side effects', async () => {
    const email = `test-${Date.now()}@example.com`;
    const signupRes = await AuthService.signUp(email, 'password123', 'Test User');
    expect(signupRes).toBeDefined();
  });
});

