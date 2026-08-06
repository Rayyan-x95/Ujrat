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

export class WaitlistService {
  private static readonly EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  /**
   * Validate waitlist inputs before submission
   */
  static validate(payload: WaitlistSubmission): { valid: boolean; error?: string } {
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const service = (payload.service || '').trim();

    if (!name || name.length < 2) {
      return { valid: false, error: 'Please enter your full name (minimum 2 characters).' };
    }

    if (!email || !this.EMAIL_REGEX.test(email)) {
      return { valid: false, error: 'Please provide a valid email address.' };
    }

    if (!service || service.length < 2) {
      return { valid: false, error: 'Please specify the service or freelance skill you provide.' };
    }

    return { valid: true };
  }

  /**
   * Submit a new entry to the waitlist database table
   */
  static async joinWaitlist(payload: WaitlistSubmission): Promise<Result<WaitlistRecord>> {
    const validation = this.validate(payload);
    if (!validation.valid) {
      return { success: false, error: new Error(validation.error || 'Invalid form input') };
    }

    const cleanName = payload.name.trim();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanService = payload.service.trim();

    try {
      const { data, error } = await supabase
        .from('waitlist')
        .insert({
          name: cleanName,
          email: cleanEmail,
          service: cleanService,
        })
        .select()
        .single();

      if (error) {
        // Handle Postgres Unique Constraint Violation (Code 23505)
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('waitlist_email_unique_idx')) {
          return {
            success: true,
            data: {
              name: cleanName,
              email: cleanEmail,
              service: cleanService,
              alreadyRegistered: true,
            },
          };
        }
        return { success: false, error: new Error(error.message) };
      }

      return {
        success: true,
        data: {
          ...(data as WaitlistRecord),
          name: cleanName,
          email: cleanEmail,
          service: cleanService,
          alreadyRegistered: false,
        },
      };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
