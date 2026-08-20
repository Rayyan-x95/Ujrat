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
      if (authPassword.length < 12) {
        addToast('warning', 'Weak Password', 'Password must be at least 12 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        addToast('warning', 'Password Mismatch', 'Passwords do not match.');
        return;
      }
    }

    try {
      if (mode === 'signup') {
        setAuthLoading(true);
        const res = await signUp(authEmail, authPassword, authName);
        if (res.success) {
          addToast('success', 'Account Created', 'Check your email to confirm registration or sign in.');
          navigate('/login');
        } else {
          throw res.error;
        }
      } else if (mode === 'signin') {
        setAuthLoading(true);
        const res = await signIn(authEmail, authPassword);
        if (res.success) {
          addToast('success', 'Welcome back!');
          await fetchSession();
          navigate('/dashboard');
        } else {
          throw res.error;
        }
      } else if (mode === 'forgot') {
        setAuthLoading(true);
        const res = await resetPassword(authEmail);
        if (res.success) {
          addToast('success', 'Reset Email Dispatched', 'Please check your inbox for password reset instructions.');
        } else {
          throw res.error;
        }
      } else if (mode === 'reset') {
        setAuthLoading(true);
        const res = await updatePassword(authPassword);
        if (res.success) {
          addToast('success', 'Password Updated', 'Your password has been successfully updated.');
          navigate('/login');
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <AuthLayout>
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-heading text-foreground font-semibold tracking-tight m-0 select-none">
              {mode === 'signin' && 'Sign In to Ujrat'}
              {mode === 'signup' && 'Create Your Workspace'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Create New Password'}
            </h1>
            <p className="text-small text-muted-foreground m-0">
              {mode === 'signin' && 'Enter your credentials to access your account'}
              {mode === 'signup' && 'Get started with free freelance billing in seconds'}
              {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
              {mode === 'reset' && 'Set a new password for your account'}
            </p>
          </div>
          
          <div className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full Name or Business Name"
                placeholder="e.g. Acme Designs"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
                autoComplete="name"
              />
            )}
            
            {mode !== 'reset' && (
              <Input
                label="Email Address"
                type="email"
                placeholder="freelancer@ujrat.ninety5.in"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                autoComplete="email"
              />
            )}

            {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-foreground select-none">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      onClick={() => navigate('/forgot-password')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                {mode === 'signup' && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Must be 12+ characters with uppercase, lowercase, number, and symbol.
                  </p>
                )}
              </div>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••••••"
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
