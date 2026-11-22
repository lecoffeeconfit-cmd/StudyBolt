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
  updateAuthProfile,
  readAuthProfile,
} from './services/auth';
import type { AuthProfile, AuthProfileUpdate, AuthProviderName, AuthResult, AuthSession, AuthUser } from './services/auth';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  recoveryMode: boolean;
  user: AuthUser | null;
  profile: AuthProfile | null;
  needsStudyOnboarding: boolean;
  callbackError: string | null;
  clearCallbackError: () => void;
  getAccessToken: () => Promise<string | null>;
  getDocumentAccessToken: () => Promise<string>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signInWithProvider: (provider: AuthProviderName) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resendConfirmationEmail: (email: string) => Promise<AuthResult>;
  changeEmail: (email: string) => Promise<AuthResult>;
  changePassword: (password: string) => Promise<AuthResult>;
  updateProfile: (updates: AuthProfileUpdate) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const profile = useMemo(() => readAuthProfile(session?.user), [session?.user]);

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
    setCallbackError(result.error ?? null);
    if (result.session) setSession(result.session);
    if (result.recovery) setRecoveryMode(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const saved = await loadAuthSession();
      if (mounted) setSession(saved);
      try {
        const initialUrl = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.href
          : await Linking.getInitialURL();
        if (initialUrl && mounted) await handleUrl(initialUrl);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void hydrate().catch(() => undefined);
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
    callbackError,
    clearCallbackError: () => setCallbackError(null),
    user: session?.user.is_anonymous ? null : session?.user ?? null,
    profile,
    needsStudyOnboarding: Boolean(profile?.onboardingRequired && !profile.onboardingCompleted),
    getAccessToken: async () => session?.user.is_anonymous ? null : (await activeSession())?.access_token ?? null,
    getDocumentAccessToken: async () => {
      if (!session || session.user.is_anonymous) {
        throw new Error('Create a free StudyBolt account to unlock AI-powered document processing and sync your study packs across devices.');
      }
      const current = await activeSession();
      if (!current) throw new Error('Your account session expired. Sign in again, then retry your import.');
      return current.access_token;
    },
    signIn: async (email, password) => {
      const result = await signInWithEmail(email, password);
      if (result.session) setSession(result.session);
      return result;
    },
    signUp: async (email, password, displayName) => {
      const result = await createAccount(email, password, displayName);
      if (result.session) setSession(result.session);
      return result;
    },
    signInWithProvider: async (provider) => {
      setCallbackError(null);
      const result = await openProviderSignIn(provider);
      if (result.session) setSession(result.session);
      return result;
    },
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
    updateProfile: async (updates) => {
      const current = await activeSession();
      if (!current) return { error: 'Please sign in again to update your profile.' };
      const result = await updateAuthProfile(current, updates);
      if (result.session) setSession(result.session);
      else if (result.user) setSession((previous) => previous ? { ...previous, user: result.user! } : previous);
      return result;
    },
    signOut: async () => {
      await signOutAccount(session);
      setSession(null);
    },
    deleteAccount: async () => {
      // A just-deleted Auth row cannot refresh, but the original token can
      // acknowledge the already-recorded deletion after a lost response.
      const current = await activeSession() ?? session;
      if (!current) return { error: 'Please sign in again before deleting your account.' };
      const result = await deleteRemoteAccount(current);
      if (!result.error) setSession(null);
      return result;
    },
    finishRecovery: () => setRecoveryMode(false),
  }), [activeSession, callbackError, loading, profile, recoveryMode, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
