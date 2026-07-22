import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '@/features/auth';
import { WorkspaceService } from '@/features/workspace';
import type { User } from '@supabase/supabase-js';
import { useToastStore } from '@/shared/hooks/useToastStore';

export function useAuth() {
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
        } else if (workspacesRes.success && workspacesRes.data.length === 0) {
          const createRes = await WorkspaceService.createWorkspace(userId, 'My Workspace');
          if (createRes.success && createRes.data) {
            return createRes.data.id;
          }
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

  const signInWithGoogle = useCallback(async () => {
    return AuthService.signInWithGoogle();
  }, []);

  return {
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
    signInWithGoogle,
  };
}

export default useAuth;
