import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';

import type { StudyType } from '../models';

const AUTH_REDIRECT_URL = 'studybolt://auth/callback';
const OAUTH_STARTED_AT_KEY = '@studybolt/auth/oauth-started-at';
const OAUTH_NEW_USER_GRACE_MS = 60_000;

export type AuthProviderName = 'google' | 'apple';
export type AuthUser = User;
export type AuthSession = Session;

export interface AuthProfile {
  displayName: string;
  studyType: StudyType | null;
  onboardingCompleted: boolean;
  onboardingRequired: boolean;
}

export interface AuthProfileUpdate {
  displayName?: string;
  studyType?: StudyType;
  onboardingCompleted?: boolean;
  onboardingRequired?: boolean;
}

export interface AuthResult {
  session?: AuthSession;
  user?: AuthUser;
  newUser?: boolean;
  message?: string;
  error?: string;
  recovery?: boolean;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const hasPlaceholderAnonKey = supabaseAnonKey === 'PASTE_ANON_KEY_HERE';
export const isAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey && !hasPlaceholderAnonKey);

// The client is deliberately the only Supabase client in the app. The anon key
// is public by design; service-role credentials never belong in this bundle.
export const supabase = isAuthConfigured
  ? createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      },
    )
  : null;

function configurationError(): AuthResult {
  return { error: 'Secure sign-in is not connected yet. Add the Supabase URL and public anon key to enable it.' };
}

function errorMessage(error: { message?: string } | null | undefined): string {
  return error?.message ?? 'Something went wrong. Please try again.';
}

function metadataFor(user: AuthUser | null | undefined): Record<string, unknown> {
  return user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
}

function metadataString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isStudyType(value: unknown): value is StudyType {
  return value === 'college' || value === 'graduate_school' || value === 'professional' || value === 'other';
}

export function readAuthProfile(user: AuthUser | null | undefined): AuthProfile | null {
  if (!user) return null;
  const metadata = metadataFor(user);
  const displayName = metadataString(metadata.display_name)
    || metadataString(metadata.full_name)
    || metadataString(metadata.name);
  const onboardingCompleted = metadata.onboarding_completed === true;
  return {
    displayName,
    studyType: isStudyType(metadata.study_type) ? metadata.study_type : null,
    onboardingCompleted,
    onboardingRequired: metadata.studybolt_onboarding_required === true || metadata.onboarding_completed === false,
  };
}

async function readResponseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error_description?: string; msg?: string; message?: string; error?: string };
    return payload.error_description ?? payload.msg ?? payload.message ?? payload.error ?? 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}

export async function clearAuthSession(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // The local client may already be empty; there is nothing else to clear.
  }
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) return { error: errorMessage(error) };
    if (!data.session) return { error: 'The refreshed session was incomplete. Please sign in again.' };
    return { session: data.session };
  } catch {
    return { error: 'Could not refresh your session. Check your connection and try again.' };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: errorMessage(error) };
    if (!data.session) return { error: 'The sign-in response was incomplete. Please try again.' };
    return { session: data.session };
  } catch {
    return { error: 'Could not sign in. Check your connection and try again.' };
  }
}

export async function createAccount(email: string, password: string, displayName: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: {
          display_name: displayName.trim().slice(0, 80),
          onboarding_completed: false,
          studybolt_onboarding_required: true,
        },
      },
    });
    if (error) return { error: errorMessage(error) };
    if (data.session) return { session: data.session, user: data.user ?? undefined, newUser: true };
    return { message: 'Check your inbox to confirm your email, then come back to sign in.' };
  } catch {
    return { error: 'Could not create your account. Check your connection and try again.' };
  }
}

export async function updateAuthProfile(session: AuthSession, updates: AuthProfileUpdate): Promise<AuthResult> {
  if (!supabase) return configurationError();
  const data: Record<string, unknown> = {};
  if (updates.displayName !== undefined) data.display_name = updates.displayName.trim().slice(0, 80);
  if (updates.studyType !== undefined) data.study_type = updates.studyType;
  if (updates.onboardingCompleted !== undefined) data.onboarding_completed = updates.onboardingCompleted;
  if (updates.onboardingRequired !== undefined) data.studybolt_onboarding_required = updates.onboardingRequired;
  if (!Object.keys(data).length) return { session, user: session.user };
  try {
    const { data: result, error } = await supabase.auth.updateUser({ data });
    if (error) return { error: errorMessage(error) };
    const current = await supabase.auth.getSession();
    const nextSession = current.data.session ?? session;
    return { session: { ...nextSession, user: result.user }, user: result.user };
  } catch {
    return { error: 'Could not save your profile. Check your connection and try again.' };
  }
}

export async function resendSignupConfirmation(email: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) return { error: errorMessage(error) };
    return { message: 'Confirmation email sent again. Check your inbox, spam, or junk folder.' };
  } catch {
    return { error: 'Could not resend the confirmation email. Check your connection and try again.' };
  }
}

export function authRedirectUrl(): string {
  return AUTH_REDIRECT_URL;
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT_URL });
    if (error) return { error: errorMessage(error) };
    return { message: 'Password reset link sent. Check your inbox.' };
  } catch {
    return { error: 'Could not send the reset email. Check your connection and try again.' };
  }
}

export async function updateAccountEmail(_session: AuthSession, email: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return { error: errorMessage(error) };
    return { message: 'Check both inboxes to confirm your new email address.' };
  } catch {
    return { error: 'Could not update your email. Check your connection and try again.' };
  }
}

export async function updateAccountPassword(_session: AuthSession, password: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: errorMessage(error) };
    return { message: 'Your password has been updated.' };
  } catch {
    return { error: 'Could not update your password. Check your connection and try again.' };
  }
}

export async function openProviderSignIn(provider: AuthProviderName): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: errorMessage(error) };
    if (!data.url) return { error: 'Could not open sign-in. Please try again.' };
    await AsyncStorage.setItem(OAUTH_STARTED_AT_KEY, String(Date.now()));
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(data.url);
    else await Linking.openURL(data.url);
    return {};
  } catch {
    return { error: `Could not open ${provider === 'google' ? 'Google' : 'Apple'} sign-in.` };
  }
}

async function markNewProviderUser(session: AuthSession): Promise<AuthSession> {
  if (!supabase) return session;
  let startedAt = 0;
  try {
    const value = await AsyncStorage.getItem(OAUTH_STARTED_AT_KEY);
    await AsyncStorage.removeItem(OAUTH_STARTED_AT_KEY);
    startedAt = Number(value);
  } catch {
    return session;
  }
  const createdAt = Date.parse(session.user.created_at);
  if (!Number.isFinite(startedAt) || !Number.isFinite(createdAt)) return session;
  if (createdAt < startedAt - OAUTH_NEW_USER_GRACE_MS || createdAt > Date.now() + OAUTH_NEW_USER_GRACE_MS) return session;
  const profile = readAuthProfile(session.user);
  if (profile?.onboardingRequired || profile?.onboardingCompleted) return session;

  const providerName = profile?.displayName || metadataString(metadataFor(session.user).full_name) || metadataString(metadataFor(session.user).name);
  const data: Record<string, unknown> = {
    onboarding_completed: false,
    studybolt_onboarding_required: true,
  };
  if (providerName) data.display_name = providerName.slice(0, 80);
  try {
    const { data: result, error } = await supabase.auth.updateUser({ data });
    if (error) return session;
    const current = await supabase.auth.getSession();
    const nextSession = current.data.session ?? session;
    return result.user ? { ...nextSession, user: result.user } : nextSession;
  } catch {
    return session;
  }
}

function callbackParams(url: string): Map<string, string> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const values = new Map<string, string>();
  for (const item of [query, hash].filter(Boolean).join('&').split('&')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    try {
      const key = decodeURIComponent(item.slice(0, separator));
      const value = decodeURIComponent(item.slice(separator + 1).replace(/\+/g, ' '));
      values.set(key, value);
    } catch {
      // Ignore malformed parameters and let the normal auth flow continue.
    }
  }
  return values;
}

export async function consumeAuthCallback(url: string): Promise<AuthResult | null> {
  if (!supabase || !url.includes('/auth/callback')) return null;
  const params = callbackParams(url);
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { error };

  const code = params.get('code');
  if (code) {
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) return { error: errorMessage(exchangeError) };
      const isRecovery = params.get('type') === 'recovery';
      const session = data.session && !isRecovery ? await markNewProviderUser(data.session) : data.session ?? undefined;
      return { session, user: session?.user, recovery: isRecovery };
    } catch {
      return { error: 'Could not finish authentication. Please try again.' };
    }
  }

  // Keep compatibility with implicit-flow callbacks already issued by older builds.
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  try {
    const { data, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) return { error: errorMessage(sessionError) };
    const isRecovery = params.get('type') === 'recovery';
    const session = data.session && !isRecovery ? await markNewProviderUser(data.session) : data.session ?? undefined;
    return { session, user: session?.user, recovery: isRecovery };
  } catch {
    return { error: 'Could not finish authentication. Please try again.' };
  }
}

export async function signOutAccount(session: AuthSession | null): Promise<void> {
  if (supabase && session) {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Always clear the local session, even when the server is unreachable.
    }
  }
  await clearAuthSession();
}

export async function deleteRemoteAccount(session: AuthSession): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return { error: await readResponseError(response) };
    await clearAuthSession();
    return { message: 'Your account and synced data were deleted.' };
  } catch {
    return { error: 'Could not delete your account. Check your connection and try again.' };
  }
}
