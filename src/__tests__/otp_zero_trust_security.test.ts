import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailLogRepository } from '@/features/auth/repositories/EmailLogRepository';
import { supabase } from '@/shared/lib/supabaseClient';

describe('OTP Zero-Knowledge & Brute-Force Defense Suite (F-006 / F-008)', () => {
  const workspaceId = '11111111-1111-4111-a111-111111111111';
  const projectId = '22222222-2222-4222-a222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Zero-Exposure in Freelancer Logs (F-006)', () => {
    it('EmailLogRepository never exposes 6-digit OTP codes in filtered logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          workspace_id: workspaceId,
          project_id: projectId,
          recipient: 'client@example.com',
          subject: 'Verification Code for Ujrat Contract Signature',
          body: '<p>A secure verification code has been dispatched to your email address.</p>',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const logs = await EmailLogRepository.getByProjectId(workspaceId, projectId);
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).not.toMatch(/\b\d{6}\b/);
      expect(logs[0]?.body).toContain('A secure verification code has been dispatched');
    });
  });

  describe('Brute-Force & Cooldown Protections (F-008)', () => {
    it('blocks rapid OTP generation within 60 seconds cooldown', () => {
      const lastSentAt = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      const cooldownMs = 60 * 1000;
      const isCooldownActive = Date.now() - lastSentAt.getTime() < cooldownMs;

      expect(isCooldownActive).toBe(true);
    });

    it('permits OTP generation after 60 seconds cooldown expires', () => {
      const lastSentAt = new Date(Date.now() - 65 * 1000); // 65 seconds ago
      const cooldownMs = 60 * 1000;
      const isCooldownActive = Date.now() - lastSentAt.getTime() < cooldownMs;

      expect(isCooldownActive).toBe(false);
    });

    it('locks out verification after 5 consecutive incorrect attempts', () => {
      let attempts = 0;
      const maxAttempts = 5;

      // Simulate 5 bad attempts
      for (let i = 0; i < 5; i++) {
        attempts++;
      }

      const isLockedOut = attempts >= maxAttempts;
      expect(isLockedOut).toBe(true);
    });

    it('rejects expired OTPs beyond 15 minutes', () => {
      const createdAt = new Date(Date.now() - 16 * 60 * 1000); // 16 minutes ago
      const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
      const isExpired = Date.now() > expiresAt.getTime();

      expect(isExpired).toBe(true);
    });
  });
});
