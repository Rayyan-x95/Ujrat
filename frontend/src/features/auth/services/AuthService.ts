import { supabase } from '@/shared/lib/supabaseClient';
import { ProfileSchema } from '@/shared/validation/schemas';
import type { Profile, Result } from '@/shared/types';

export class AuthService {
  static async getCurrentUser(): Promise<Result<any>> {
    try {
      // getUser() validates the token against the auth server. getSession()
      // alone trusts localStorage and would render a stale/tampered session
      // as authenticated.
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // No local session is the normal logged-out state, not a failure.
        if (error.name === 'AuthSessionMissingError' || /session/i.test(error.message)) {
          return { success: true, data: null };
        }
        return { success: false, error: new Error(error.message) };
      }
      return { success: true, data: data.user ?? null };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getProfile(profileId: string): Promise<Result<Profile | null>> {
    try {
      if (!profileId) {
        return { success: true, data: null };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .is('deleted_at', null)
        .maybeSingle();

      // Check the error BEFORE any enrichment: an RLS/network failure must
      // never be masked as a synthesized profile.
      if (error) return { success: false, error: new Error(error.message) };
      if (data) return { success: true, data };

      // Missing profile row (pre-trigger legacy account): self-heal from the
      // server-validated auth user, awaited so a failure is never silent.
      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user;
      if (!authUser || authUser.id !== profileId) {
        return { success: true, data: null };
      }

      const { data: healed, error: healError } = await (supabase.from('profiles') as any)
        .upsert({
          id: profileId,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Freelancer',
          email: authUser.email || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (healError) return { success: false, error: new Error(healError.message) };
      return { success: true, data: healed ?? null };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updateProfile(profileId: string, profileData: Partial<Profile>): Promise<Result<Profile>> {
    try {
      const parsed = ProfileSchema.partial().safeParse(profileData);
      if (!parsed.success) {
        return { success: false, error: new Error(parsed.error.issues[0]?.message || 'Invalid profile data') };
      }

      const payload: Record<string, any> = {};
      if (parsed.data.full_name !== undefined) payload.full_name = parsed.data.full_name ?? null;
      if (parsed.data.email !== undefined) payload.email = parsed.data.email ?? null;
      if (parsed.data.avatar_url !== undefined) payload.avatar_url = parsed.data.avatar_url ?? null;
      payload.updated_at = new Date().toISOString();

      if (parsed.data.full_name) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { full_name: parsed.data.full_name }
        });
        if (metaError) return { success: false, error: new Error(metaError.message) };
      }

      const { data, error } = await (supabase
        .from('profiles') as any)
        .update(payload)
        .eq('id', profileId)
        .select()
        .maybeSingle();

      if (error) return { success: false, error: new Error(error.message) };

      if (!data) {
        // 0 rows updated (profile row missing): upsert, but return only the
        // DB row — never a client-fabricated object.
        const { data: authUserData } = await supabase.auth.getUser();
        const userEmail = parsed.data.email || authUserData?.user?.email || '';

        const { data: upsertData, error: upsertError } = await (supabase
          .from('profiles') as any)
          .upsert({ id: profileId, email: userEmail, ...payload }, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (upsertError) return { success: false, error: new Error(upsertError.message) };
        if (!upsertData) return { success: false, error: new Error('Profile could not be saved') };
        return { success: true, data: upsertData as Profile };
      }

      return { success: true, data: data as Profile };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updateEmail(email: string): Promise<Result<any>> {
    try {
      if (!email || !email.includes('@')) {
        return { success: false, error: new Error('Valid email address is required') };
      }
      const { data, error } = await supabase.auth.updateUser({ email });
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
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
