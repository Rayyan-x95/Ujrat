import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '@/features/auth';
import { WorkspaceService } from '@/features/workspace';
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

const WORKSPACE_CACHE_KEY = 'ujrat.workspaceId';

// The cache is keyed by user: on an account switch the previous user's
// workspace id must never drive queries, even briefly (RLS is the only
// barrier until ensureWorkspace resolves).
function readWorkspaceCache(userId: string): string {
  if (!userId) return '';
  try {
    const raw = localStorage.getItem(WORKSPACE_CACHE_KEY);
    if (!raw) return '';
    const cached = JSON.parse(raw) as { userId?: string; workspaceId?: string };
    return cached.userId === userId ? cached.workspaceId || '' : '';
  } catch {
    return '';
  }
}

function writeWorkspaceCache(userId: string, id: string) {
  try {
    if (id && userId) {
      localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify({ userId, workspaceId: id }));
    }
  } catch {}
}

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
          const id = workspacesRes.data[0]?.id || '';
          writeWorkspaceCache(userId, id);
          return id;
        }

        // NOTE: there is no `workspace_members` table (single-owner workspaces
        // keyed by workspaces.profile_id; auto-created by the
        // handle_new_user() DB trigger). Do not query it — PostgREST answers
        // 404 and spams the console. Fall straight through to the
        // get-or-create below.

        const createRes = await WorkspaceService.createWorkspace(userId, 'My Workspace');
        if (createRes.success && createRes.data) {
          writeWorkspaceCache(userId, createRes.data.id);
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
        setAuthLoading(false);
        const cached = readWorkspaceCache(res.data.id);
        if (cached) setWorkspaceId(cached);
        ensureWorkspace(res.data.id).then(setWorkspaceId).catch(() => {});
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    } catch {
      setUser(null);
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
        // A different user's cached workspace resolves to '' here, so an
        // account switch never carries the previous workspace into state.
        const cached = readWorkspaceCache(typedSession.user.id);
        if (isMounted) setWorkspaceId(cached);
        if (isMounted) setAuthLoading(false);
        ensureWorkspace(typedSession.user.id)
          .then((wsId) => { if (isMounted) setWorkspaceId(wsId); })
          .catch(() => { if (isMounted) setWorkspaceId(''); });
        return;
      } else {
        setUser(null);
        setWorkspaceId('');
        setProfileId('');
        if (isMounted) setAuthLoading(false);
      }
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchSession, navigate, addToast, ensureWorkspace]);

  const signOut = useCallback(async () => {
    const res = await AuthService.signOut();
    if (!res.success) {
      // Surface the failure instead of silently pretending the session died;
      // the local session is still cleared so the UI returns to login.
      addToast('error', 'Sign Out Failed', res.error?.message || 'The server did not confirm sign-out.');
    }
    try {
      localStorage.removeItem(WORKSPACE_CACHE_KEY);
    } catch {}
    setUser(null);
    setWorkspaceId('');
    setProfileId('');
    if (res.success) addToast('info', 'Signed Out');
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
