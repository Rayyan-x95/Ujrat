import { supabase } from '@/shared/lib/supabaseClient';
import type { Profile, Result } from '@/shared/types';

export class AuthService {
  static async getCurrentUser(): Promise<Result<any>> {
    try {
      // getSession() reads from localStorage — instant, no network call.
      // The onAuthStateChange listener in useAuth handles background token validation.
      const { data, error } = await supabase.auth.getSession();
      if (error) return { success: false, error: new Error(error.message) };
      if (!data.session?.user) return { success: true, data: null };
      return { success: true, data: data.session.user };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getProfile(profileId: string): Promise<Result<Profile | null>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updateProfile(profileId: string, profileData: Partial<Profile>): Promise<Result<Profile>> {
    try {
      const payload: Record<string, any> = {};
      if (profileData.full_name !== undefined) payload.full_name = profileData.full_name ?? null;
      if (profileData.avatar_url !== undefined) payload.avatar_url = profileData.avatar_url ?? null;
      payload.updated_at = new Date().toISOString();

      const { data, error } = await (supabase
        .from('profiles') as any)
        .update(payload)
        .eq('id', profileId)
        .select()
        .maybeSingle();

      if (error) return { success: false, error: new Error(error.message) };

      if (!data) {
        // If 0 rows were updated (profile record did not exist in profiles table yet), perform an upsert fallback
        const { data: authUserData } = await supabase.auth.getUser();
        const userEmail = authUserData?.user?.email || profileData.email || '';

        const upsertPayload = {
          id: profileId,
          email: userEmail,
          full_name: profileData.full_name ?? null,
          avatar_url: profileData.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        };

        const { data: upsertData, error: upsertError } = await (supabase
          .from('profiles') as any)
          .upsert(upsertPayload, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (upsertError) return { success: false, error: new Error(upsertError.message) };

        return {
          success: true,
          data: upsertData || (upsertPayload as Profile),
        };
      }

      return { success: true, data: data as Profile };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async signIn(email: string, password: string): Promise<Result<any>> {
    try {
      if (!password) {
        return { success: false, error: new Error('Password is required') };
      }
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: data.user };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async signUp(email: string, password: string, fullName?: string): Promise<Result<any>> {
    try {
      if (!password) {
        return { success: false, error: new Error('Password is required') };
      }
      if (password.length < 12) {
        return { success: false, error: new Error('Password must be at least 12 characters') };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || email.split('@')[0] }
        }
      });
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: data.user };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async resetPassword(email: string): Promise<Result<any>> {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?mode=reset`
      });
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updatePassword(password: string): Promise<Result<any>> {
    try {
      if (!password || password.length < 12) {
        return { success: false, error: new Error('Password must be at least 12 characters') };
      }
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async signOut(): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static onAuthChange(callback: (event: string, session: unknown) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}
