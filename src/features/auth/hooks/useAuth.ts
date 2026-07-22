import { useState, useEffect, useCallback } from 'react';
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

  const navigate = useNavigate();

  const fetchSession = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await AuthService.getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        setProfileId(res.data.id);
        
        let workspacesRes = await WorkspaceService.getWorkspaces(res.data.id);
        if (workspacesRes.success && workspacesRes.data.length > 0) {
          setWorkspaceId(workspacesRes.data[0]?.id || '');
        } else if (workspacesRes.success && workspacesRes.data.length === 0) {
          const createRes = await WorkspaceService.createWorkspace(res.data.id, 'My Workspace');
          if (createRes.success && createRes.data) {
            setWorkspaceId(createRes.data.id);
          }
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

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
          const workspacesRes = await WorkspaceService.getWorkspaces(typedSession.user.id);
          if (isMounted) {
            if (workspacesRes.success && workspacesRes.data.length > 0) {
              setWorkspaceId(workspacesRes.data[0]?.id || '');
            } else if (workspacesRes.success && workspacesRes.data.length === 0) {
              const createRes = await WorkspaceService.createWorkspace(typedSession.user.id, 'My Workspace');
              if (createRes.success && createRes.data) {
                setWorkspaceId(createRes.data.id);
              } else {
                setWorkspaceId('');
              }
            } else {
              setWorkspaceId('');
            }
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
  }, [fetchSession, navigate, addToast]);

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
