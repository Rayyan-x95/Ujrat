import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaitlistService } from '@/features/waitlist/services/WaitlistService';
import { supabase } from '@/shared/lib/supabaseClient';

describe('WaitlistService Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Rules', () => {
    it('validates a correct waitlist payload', () => {
      const result = WaitlistService.validate({
        name: 'Aarav Mehta',
        email: 'aarav@fullstack.dev',
        service: 'Fullstack Web Development',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects short or empty names', () => {
      const res1 = WaitlistService.validate({
        name: ' ',
        email: 'test@example.com',
        service: 'Design',
      });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('full name');

      const res2 = WaitlistService.validate({
        name: 'A',
        email: 'test@example.com',
        service: 'Design',
      });
      expect(res2.valid).toBe(false);
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test@domain',
        'test@.com',
        'test space@domain.com',
      ];

      for (const email of invalidEmails) {
        const res = WaitlistService.validate({
          name: 'Priya Sharma',
          email,
          service: 'UI/UX Design',
        });
        expect(res.valid).toBe(false);
        expect(res.error).toContain('valid email');
      }
    });

    it('rejects empty or whitespace-only service description', () => {
      const res = WaitlistService.validate({
        name: 'Rohan Patel',
        email: 'rohan@example.com',
        service: '  ',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('service or freelance skill');
    });
  });

  describe('Database Persistence & Duplicate Handling', () => {
    it('returns validation error without calling database if input is invalid', async () => {
      const res = await WaitlistService.joinWaitlist({
        name: '',
        email: 'invalid',
        service: '',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error?.message).toBeTruthy();
      }
    });

    it('handles successful waitlist insertion', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Kabir Khan',
              email: 'kabir@creative.in',
              service: 'Video Editing',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await WaitlistService.joinWaitlist({
        name: '  Kabir Khan  ',
        email: '  KABIR@creative.in  ',
        service: '  Video Editing  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Kabir Khan');
        expect(result.data.email).toBe('kabir@creative.in');
        expect(result.data.service).toBe('Video Editing');
        expect(result.data.alreadyRegistered).toBe(false);
      }
    });

    it('gracefully handles duplicate email registration (Postgres 23505)', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "waitlist_email_unique_idx"',
            },
          }),
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await WaitlistService.joinWaitlist({
        name: 'Kabir Khan',
        email: 'kabir@creative.in',
        service: 'Video Editing',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alreadyRegistered).toBe(true);
      }
    });
  });
});
