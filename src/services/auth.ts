import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const SESSION_KEY = '@studybolt/auth-session/v1';

export type AuthProviderName = 'google' | 'apple';

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

export interface AuthResult {
  session?: AuthSession;
  message?: string;
  error?: string;
  recovery?: boolean;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function configurationError(): AuthResult {
  return { error: 'Secure sign-in is not connected yet. Add the Supabase URL and publishable key to enable it.' };
}

async function request(path: string, init: RequestInit = {}, accessToken?: string): Promise<Response> {
  return fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken ?? supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error_description?: string; msg?: string; message?: string; error?: string };
    return payload.error_description ?? payload.msg ?? payload.message ?? payload.error ?? 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}

function toSession(payload: Record<string, unknown>): AuthSession | undefined {
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : undefined;
  const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined;
  const user = payload.user as AuthUser | undefined;
  if (!accessToken || !refreshToken || !user?.id) return undefined;
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  const expiresAt = typeof payload.expires_at === 'number' ? payload.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
  return { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, user };
}

async function saveSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (!isAuthConfigured) return null;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.access_token || !session.refresh_token || !session.user?.id) return null;
    if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
    const refreshed = await refreshAuthSession(session.refresh_token);
    return refreshed.session ?? null;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await request('/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return { error: await readError(response) };
    const session = toSession(await response.json() as Record<string, unknown>);
    if (!session) return { error: 'The refreshed session was incomplete. Please sign in again.' };
    await saveSession(session);
    return { session };
  } catch {
    return { error: 'Could not refresh your session. Check your connection and try again.' };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await request('/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return { error: await readError(response) };
    const session = toSession(await response.json() as Record<string, unknown>);
    if (!session) return { error: 'The sign-in response was incomplete. Please try again.' };
    await saveSession(session);
    return { session };
  } catch {
    return { error: 'Could not sign in. Check your connection and try again.' };
  }
}

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await request('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return { error: await readError(response) };
    const payload = await response.json() as Record<string, unknown>;
    const session = toSession(payload);
    if (session) {
      await saveSession(session);
      return { session };
    }
    return { message: 'Check your inbox to confirm your email, then come back to sign in.' };
  } catch {
    return { error: 'Could not create your account. Check your connection and try again.' };
  }
}

export function authRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/`;
  return 'studybolt://auth/callback';
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const redirectTo = authRedirectUrl();
    const response = await request(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (!response.ok) return { error: await readError(response) };
    return { message: 'Password reset link sent. Check your inbox.' };
  } catch {
    return { error: 'Could not send the reset email. Check your connection and try again.' };
  }
}

export async function updateAccountEmail(session: AuthSession, email: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await request('/user', { method: 'PUT', body: JSON.stringify({ email }) }, session.access_token);
    if (!response.ok) return { error: await readError(response) };
    return { message: 'Check both inboxes to confirm your new email address.' };
  } catch {
    return { error: 'Could not update your email. Check your connection and try again.' };
  }
}

export async function updateAccountPassword(session: AuthSession, password: string): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  try {
    const response = await request('/user', { method: 'PUT', body: JSON.stringify({ password }) }, session.access_token);
    if (!response.ok) return { error: await readError(response) };
    return { message: 'Your password has been updated.' };
  } catch {
    return { error: 'Could not update your password. Check your connection and try again.' };
  }
}

export async function openProviderSignIn(provider: AuthProviderName): Promise<AuthResult> {
  if (!isAuthConfigured) return configurationError();
  const redirectTo = authRedirectUrl();
  const url = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
    else await Linking.openURL(url);
    return {};
  } catch {
    return { error: `Could not open ${provider === 'google' ? 'Google' : 'Apple'} sign-in.` };
  }
}

function callbackParams(url: string): Map<string, string> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const values = new Map<string, string>();
  for (const item of [query, hash].filter(Boolean).join('&').split('&')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = decodeURIComponent(item.slice(0, separator));
    const value = decodeURIComponent(item.slice(separator + 1).replace(/\+/g, ' '));
    values.set(key, value);
  }
  return values;
}

export async function consumeAuthCallback(url: string): Promise<AuthResult | null> {
  if (!isAuthConfigured) return null;
  const params = callbackParams(url);
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { error };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  try {
    const response = await request('/user', { method: 'GET' }, accessToken);
    if (!response.ok) return { error: await readError(response) };
    const user = await response.json() as AuthUser;
    const expiresIn = Number(params.get('expires_in') ?? 3600);
    const session: AuthSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user,
    };
    await saveSession(session);
    return { session, recovery: params.get('type') === 'recovery' };
  } catch {
    return { error: 'Could not finish authentication. Please try again.' };
  }
}

export async function signOutAccount(session: AuthSession | null): Promise<void> {
  if (isAuthConfigured && session) {
    try {
      await request('/logout', { method: 'POST' }, session.access_token);
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
    if (!response.ok) return { error: await readError(response) };
    await clearAuthSession();
    return { message: 'Your account and synced data were deleted.' };
  } catch {
    return { error: 'Could not delete your account. Check your connection and try again.' };
  }
}
