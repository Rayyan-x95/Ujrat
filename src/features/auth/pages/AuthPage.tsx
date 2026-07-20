import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '@/shared/hooks/useToastStore';

export interface AuthPageProps {
  mode: 'signin' | 'signup' | 'forgot' | 'reset';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  
  const {
    signUp,
    signIn,
    resetPassword,
    updatePassword,
    signInWithGoogle,
    authLoading,
    setAuthLoading,
    fetchSession,
  } = useAuth();

  // Auth form states
  const [authEmail, setAuthEmail] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode !== 'reset' && !authEmail.trim()) {
      addToast('warning', 'Validation Warning', 'Email address is required.');
      return;
    }
    
    // Password validation for signup & reset
    if (mode === 'signup' || mode === 'reset') {
      if (authPassword.length < 6) {
        addToast('warning', 'Weak Password', 'Password must be at least 6 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        addToast('warning', 'Password Mismatch', 'Passwords do not match.');
        return;
      }
    }

    try {
      setAuthLoading(true);
      if (mode === 'signup') {
        const res = await signUp(authEmail, authPassword, authName);
        if (res.success) {
          await fetchSession();
          if (res.data) {
            addToast('success', 'Registration Successful', 'Welcome to Ujrat! Your workspace has been created.');
            navigate('/dashboard');
          } else {
            addToast('info', 'Confirmation Required', 'Verification link sent. Please check your inbox and verify your email.');
            navigate('/login');
          }
        } else {
          throw res.error;
        }
      } else if (mode === 'signin') {
        const res = await signIn(authEmail, authPassword);
        if (res.success) {
          addToast('success', 'Sign In Successful');
          await fetchSession();
        } else {
          throw res.error;
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(authEmail);
        if (res.success) {
          addToast('success', 'Recovery Email Sent', 'Check your inbox for password reset instructions.');
          navigate('/login');
        } else {
          throw res.error;
        }
      } else if (mode === 'reset') {
        const res = await updatePassword(authPassword);
        if (res.success) {
          addToast('success', 'Password Updated', 'Your new password is set. Please sign in.');
          navigate('/login');
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          throw res.error;
        }
      }
    } catch (e) {
      addToast('error', 'Authentication Failed', (e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      const res = await signInWithGoogle();
      if (res.success) {
        addToast('success', 'Google Authentication Successful');
        await fetchSession();
      } else {
        throw res.error;
      }
    } catch (err: any) {
      addToast('error', 'Google Sign In Failed', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <AuthLayout>
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-heading text-foreground font-semibold tracking-tight m-0 select-none">
              {mode === 'signin' && 'Sign In to Ujrat'}
              {mode === 'signup' && 'Create Your Workspace'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Set New Password'}
            </h1>
            <p className="text-[12px] text-muted-foreground leading-normal m-0 max-w-xs mx-auto">
              {mode === 'signin' && 'The billing and pipeline engine for modern freelancers'}
              {mode === 'signup' && 'Draft proposals, sign contracts, and verify payments instantly'}
              {mode === 'forgot' && 'Enter your email to receive password recovery instructions'}
              {mode === 'reset' && 'Enter a secure, memorable password for your workspace access'}
            </p>
          </div>
          
          <div className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Your Full Name"
                placeholder="Rohan Sharma"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
                autoComplete="name"
              />
            )}
            
            {mode !== 'reset' && (
              <Input
                label="Email Address"
                type="email"
                placeholder="freelancer@ujrat.app"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                autoComplete="email"
              />
            )}

            {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center select-none">
                  <label className="block text-label font-semibold text-muted-foreground tracking-wider">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot')}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={authConfirmPassword}
                onChange={e => setAuthConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </div>

          <div className="space-y-3 pt-3">
            <Button variant="primary" className="w-full font-semibold" type="submit" loading={authLoading}>
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Workspace'}
              {mode === 'forgot' && 'Send Recovery Email'}
              {mode === 'reset' && 'Update Password'}
            </Button>

            {(mode === 'signin' || mode === 'signup') && (
              <Button
                variant="outline"
                className="w-full text-foreground flex items-center justify-center gap-2 font-medium"
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Google
              </Button>
            )}
          </div>
          
          <div className="text-center pt-2">
            {mode === 'signin' && (
              <button
                type="button"
                className="text-[12px] text-primary hover:underline font-semibold cursor-pointer"
                onClick={() => navigate('/signup')}
              >
                Create an account
              </button>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                className="text-[12px] text-primary hover:underline font-semibold cursor-pointer"
                onClick={() => navigate('/login')}
              >
                Sign in to existing workspace
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="text-[12px] text-primary hover:underline font-semibold cursor-pointer"
                onClick={() => navigate('/login')}
              >
                ← Back to sign in
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                className="text-[12px] text-primary hover:underline font-semibold cursor-pointer"
                onClick={() => navigate('/login')}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </AuthLayout>
    </div>
  );
};
