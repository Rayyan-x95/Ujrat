import { z } from 'zod';
import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

export interface WaitlistSubmission {
  name: string;
  email: string;
  service: string;
}

export interface WaitlistRecord {
  id?: string;
  name: string;
  email: string;
  service: string;
  created_at?: string;
  alreadyRegistered?: boolean;
}

const waitlistSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name (minimum 2 characters).'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
  service: z.string().trim().min(2, 'Please specify the service or freelance skill you provide.'),
});

export class WaitlistService {
  static validate(payload: WaitlistSubmission): { valid: boolean; error?: string } {
    const res = waitlistSchema.safeParse(payload);
    if (!res.success) {
      return { valid: false, error: res.error.issues[0]?.message || 'Invalid form input' };
    }
    return { valid: true };
  }

  static async joinWaitlist(payload: WaitlistSubmission): Promise<Result<WaitlistRecord>> {
    const parsed = waitlistSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: new Error(parsed.error.issues[0]?.message || 'Invalid form input') };
    }

    const { name, email, service } = parsed.data;

    try {
      const { data, error } = await supabase
        .from('waitlist')
        .insert({ name, email, service })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('waitlist_email_unique_idx')) {
          return {
            success: true,
            data: { name, email, service, alreadyRegistered: true },
          };
        }
        return { success: false, error: new Error(error.message) };
      }

      return {
        success: true,
        data: { ...(data as WaitlistRecord), name, email, service, alreadyRegistered: false },
      };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
