import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '@/features/auth';
import { WorkspaceService } from '@/features/workspace';
import { supabase } from '@/shared/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useToastStore } from '@/shared/hooks/useToastStore';
import type { Result } from '@/shared/types';

interface AuthState {
  user: User | null;
  workspaceId: string;
  profileId: string;
  authLoading: boolean;
  setAuthLoading: (v: boolean) => void;
  fetchSession: () => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<Result<any>>;
  signIn: (email: string, pass: string) => Promise<Result<any>>;
  resetPassword: (email: string) => Promise<Result<any>>;
  updatePassword: (pass: string) => Promise<Result<any>>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const addToast = useToastStore((state) => state.addToast);
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [profileId, setProfileId] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const activeWorkspaceInitRef = useRef<Map<string, Promise<string>>>(new Map());

  const navigate = useNavigate();

  const ensureWorkspace = useCallback(async (userId: string): Promise<string> => {
    if (!userId) return '';
    if (activeWorkspaceInitRef.current.has(userId)) {
      return activeWorkspaceInitRef.current.get(userId)!;
    }

    const promise = (async () => {
      try {
        const workspacesRes = await WorkspaceService.getWorkspaces(userId);
        if (workspacesRes.success && workspacesRes.data.length > 0) {
          return workspacesRes.data[0]?.id || '';
        }

        try {
          const { data: memberData } = await (supabase as any)
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          if (memberData?.workspace_id) {
            return memberData.workspace_id;
          }
        } catch {
          // ignore member lookup error
        }

        const createRes = await WorkspaceService.createWorkspace(userId, 'My Workspace');
        if (createRes.success && createRes.data) {
          return createRes.data.id;
        }
        return '';
      } catch {
        return '';
      } finally {
        activeWorkspaceInitRef.current.delete(userId);
      }
    })();

    activeWorkspaceInitRef.current.set(userId, promise);
    return promise;
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await AuthService.getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        setProfileId(res.data.id);
        const wsId = await ensureWorkspace(res.data.id);
        setWorkspaceId(wsId);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [ensureWorkspace]);

  useEffect(() => {
    // Run initial session check
    fetchSession();

    // Check if recovery in query params or url hash
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    if (params.get('type') === 'recovery' || hashParams.get('type') === 'recovery') {
      if (addToast) {
        addToast('info', 'Recovery Mode Activated', 'Please enter your new workspace password.');
      }
      navigate('/reset', { replace: true });
    }

    let isMounted = true;

    const { data: { subscription } } = AuthService.onAuthChange(async (_event: string, session: unknown) => {
      if (!isMounted) return;
      setAuthLoading(true);
      const typedSession = session as { user: User } | null;
      if (typedSession?.user) {
        setUser(typedSession.user);
        setProfileId(typedSession.user.id);
        try {
          const wsId = await ensureWorkspace(typedSession.user.id);
          if (isMounted) {
            setWorkspaceId(wsId);
          }
        } catch {
          if (isMounted) setWorkspaceId('');
        }
      } else {
        setUser(null);
        setWorkspaceId('');
        setProfileId('');
      }
      if (isMounted) {
        setAuthLoading(false);
      }
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchSession, navigate, addToast, ensureWorkspace]);

  const signOut = useCallback(async () => {
    await AuthService.signOut();
    setUser(null);
    setWorkspaceId('');
    setProfileId('');
    addToast('info', 'Signed Out');
    navigate('/login');
  }, [addToast, navigate]);

  const signUp = useCallback(async (email: string, pass: string, name: string) => {
    return AuthService.signUp(email, pass, name);
  }, []);

  const signIn = useCallback(async (email: string, pass: string) => {
    return AuthService.signIn(email, pass);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return AuthService.resetPassword(email);
  }, []);

  const updatePassword = useCallback(async (pass: string) => {
    return AuthService.updatePassword(pass);
  }, []);

  const value: AuthState = {
    user,
    workspaceId,
    profileId,
    authLoading,
    setAuthLoading,
    fetchSession,
    signOut,
    signUp,
    signIn,
    resetPassword,
    updatePassword,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export default useAuth;
