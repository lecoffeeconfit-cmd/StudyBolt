import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import {
  consumeAuthCallback,
  createAccount,
  deleteRemoteAccount,
  isAuthConfigured,
  loadAuthSession,
  openProviderSignIn,
  refreshAuthSession,
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithEmail,
  signOutAccount,
  supabase,
  updateAccountEmail,
  updateAccountPassword,
} from './services/auth';
import type { AuthProviderName, AuthResult, AuthSession, AuthUser } from './services/auth';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  recoveryMode: boolean;
  user: AuthUser | null;
  getAccessToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithProvider: (provider: AuthProviderName) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resendConfirmationEmail: (email: string) => Promise<AuthResult>;
  changeEmail: (email: string) => Promise<AuthResult>;
  changePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const activeSession = useCallback(async (): Promise<AuthSession | null> => {
    if (!session) return null;
    if ((session.expires_at ?? 0) > Math.floor(Date.now() / 1000) + 60) return session;
    const refreshed = await refreshAuthSession(session.refresh_token);
    if (refreshed.session) {
      setSession(refreshed.session);
      return refreshed.session;
    }
    return null;
  }, [session]);

  const handleUrl = useCallback(async (url: string) => {
    const result = await consumeAuthCallback(url);
    if (!result) return;
    if (result.session) setSession(result.session);
    if (result.recovery) setRecoveryMode(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const saved = await loadAuthSession();
      if (mounted) setSession(saved);
      const initialUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : await Linking.getInitialURL();
      if (initialUrl) await handleUrl(initialUrl);
      if (mounted) setLoading(false);
    };
    void hydrate();
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleUrl]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;
    void client.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isAuthConfigured,
    loading,
    recoveryMode,
    user: session?.user ?? null,
    getAccessToken: async () => (await activeSession())?.access_token ?? null,
    signIn: async (email, password) => {
      const result = await signInWithEmail(email, password);
      if (result.session) setSession(result.session);
      return result;
    },
    signUp: async (email, password) => {
      const result = await createAccount(email, password);
      if (result.session) setSession(result.session);
      return result;
    },
    signInWithProvider: openProviderSignIn,
    forgotPassword: requestPasswordReset,
    resendConfirmationEmail: resendSignupConfirmation,
    changeEmail: async (email) => {
      const current = await activeSession();
      return current ? updateAccountEmail(current, email) : { error: 'Please sign in again to change your email.' };
    },
    changePassword: async (password) => {
      const current = await activeSession();
      return current ? updateAccountPassword(current, password) : { error: 'Your reset link has expired. Request a new one.' };
    },
    signOut: async () => {
      await signOutAccount(session);
      setSession(null);
    },
    deleteAccount: async () => {
      const current = await activeSession();
      if (!current) return { error: 'Please sign in again before deleting your account.' };
      const result = await deleteRemoteAccount(current);
      if (!result.error) setSession(null);
      return result;
    },
    finishRecovery: () => setRecoveryMode(false),
  }), [activeSession, loading, recoveryMode, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
