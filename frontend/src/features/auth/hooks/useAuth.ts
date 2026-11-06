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

function readWorkspaceCache(): string {
  try {
    return localStorage.getItem(WORKSPACE_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

function writeWorkspaceCache(id: string) {
  try {
    if (id) localStorage.setItem(WORKSPACE_CACHE_KEY, id);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const addToast = useToastStore((state) => state.addToast);
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>(readWorkspaceCache);
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
          writeWorkspaceCache(id);
          return id;
        }

        // NOTE: there is no `workspace_members` table (single-owner workspaces
        // keyed by workspaces.profile_id; auto-created by the
        // handle_new_user() DB trigger). Do not query it — PostgREST answers
        // 404 and spams the console. Fall straight through to the
        // get-or-create below.

        const createRes = await WorkspaceService.createWorkspace(userId, 'My Workspace');
        if (createRes.success && createRes.data) {
          writeWorkspaceCache(createRes.data.id);
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
    const cached = readWorkspaceCache();
    if (cached) setWorkspaceId(cached);
    try {
      setAuthLoading(true);
      const res = await AuthService.getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        setProfileId(res.data.id);
        setAuthLoading(false);
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
        const cached = readWorkspaceCache();
        if (isMounted && cached) setWorkspaceId(cached);
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
    await AuthService.signOut();
    try {
      localStorage.removeItem(WORKSPACE_CACHE_KEY);
    } catch {}
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
