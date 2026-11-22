import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';

import type { StudyType } from '../models';
import { resolveBackendUrl } from '../config/backend';
import { prepareRevenueCatAccountDeletion, releaseRevenueCatDeletionHold } from './subscriptions';
import { submitAccountDeletion } from './accountDeletionClient';

import { NATIVE_AUTH_REDIRECT, readAuthCallback } from './authCallback';

const nativeAuth = Platform.OS === 'ios' ? requireOptionalNativeModule<{
  open(url: string): Promise<{ type: 'success'; url: string } | { type: 'cancel' | 'error' }>;
}>('StudyBoltAuthSession') : null;
const OAUTH_STARTED_AT_KEY = '@studybolt/auth/oauth-started-at';
const OAUTH_FLOW_STATE_KEY = '@studybolt/auth/oauth-flow-state';
const OAUTH_NEW_USER_GRACE_MS = 60_000;
const OAUTH_FLOW_MAX_AGE_MS = 15 * 60_000;

interface PendingOAuthFlowState {
  flowId: string | null;
  startedAt: number;
}

async function savePendingOAuthFlow(flowId: string | null): Promise<PendingOAuthFlowState> {
  const state = { flowId, startedAt: Date.now() };
  await AsyncStorage.setItem(OAUTH_FLOW_STATE_KEY, JSON.stringify(state));
  // Kept for compatibility with any older callback already in progress.
  await AsyncStorage.setItem(OAUTH_STARTED_AT_KEY, String(state.startedAt));
  return state;
}

async function readPendingOAuthFlow(): Promise<PendingOAuthFlowState | null> {
  try {
    const raw = await AsyncStorage.getItem(OAUTH_FLOW_STATE_KEY);
    let startedAt: number;
    let flowId: string | null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PendingOAuthFlowState>;
      startedAt = Number(parsed.startedAt);
      flowId = typeof parsed.flowId === 'string' ? parsed.flowId : null;
    } else {
      // An OAuth session may have started just before an app update, when only
      // the timestamp key existed and the legacy verifier slot was in use.
      startedAt = Number(await AsyncStorage.getItem(OAUTH_STARTED_AT_KEY));
      flowId = null;
      if (!startedAt) return null;
    }
    const age = Date.now() - startedAt;
    if (!Number.isFinite(startedAt) || age < 0 || age > OAUTH_FLOW_MAX_AGE_MS) {
      await AsyncStorage.multiRemove([OAUTH_FLOW_STATE_KEY, OAUTH_STARTED_AT_KEY]);
      return null;
    }
    return { flowId, startedAt };
  } catch {
    await AsyncStorage.multiRemove([OAUTH_FLOW_STATE_KEY, OAUTH_STARTED_AT_KEY]).catch(() => undefined);
    return null;
  }
}

async function clearPendingOAuthFlow(state?: PendingOAuthFlowState | null): Promise<void> {
  if (state) {
    const current = await readPendingOAuthFlow();
    if (!current || current.startedAt !== state.startedAt || current.flowId !== state.flowId) return;
  }
  await AsyncStorage.multiRemove([OAUTH_FLOW_STATE_KEY, OAUTH_STARTED_AT_KEY]);
}

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
  deletionPending?: boolean;
  sessionCleanupFailed?: boolean;
  awaitingCallback?: boolean;
}

const supabaseUrl = resolveBackendUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const authStorageKey = supabaseUrl ? 'sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token' : '';

const hasPlaceholderAnonKey = supabaseAnonKey === 'PASTE_ANON_KEY_HERE';
export const isAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey && !hasPlaceholderAnonKey);

// The client is deliberately the only Supabase client in the app. The anon key
// is public by design; service-role credentials never belong in this bundle.
export const supabase = isAuthConfigured
  ? createClient(
      supabaseUrl,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: authStorageKey,
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
  latestExchange = undefined;
  if (authStorageKey) await AsyncStorage.multiRemove([authStorageKey, authStorageKey + '-code-verifier', authStorageKey + '-user']);
  await clearPendingOAuthFlow();
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
        emailRedirectTo: authRedirectUrl(),
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
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) return { error: errorMessage(error) };
    return { message: 'Confirmation email sent again. Check your inbox, spam, or junk folder.' };
  } catch {
    return { error: 'Could not resend the confirmation email. Check your connection and try again.' };
  }
}

export function authRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL('/?studybolt_auth=1', window.location.origin).href;
  }
  return NATIVE_AUTH_REDIRECT;
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return configurationError();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
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
  let pendingFlow: PendingOAuthFlowState | null = null;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectUrl(),
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: errorMessage(error) };
    if (!data.url) return { error: 'Could not open sign-in. Please try again.' };
    pendingFlow = await savePendingOAuthFlow(data.flowId ?? null);
    if (nativeAuth) {
      const result = await nativeAuth.open(data.url);
      if (result.type === 'cancel') {
        await clearPendingOAuthFlow(pendingFlow);
        return {};
      }
      if (result.type === 'success') {
        return await consumeAuthCallback(result.url, data.flowId ?? undefined) ?? { error: 'StudyBolt did not receive a valid sign-in response. Please try again.' };
      }
      await clearPendingOAuthFlow(pendingFlow);
      return { error: 'Could not open the secure sign-in window. Please try again.' };
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(data.url);
    else await Linking.openURL(data.url);
    return { awaitingCallback: true };
  } catch {
    await clearPendingOAuthFlow(pendingFlow).catch(() => undefined);
    return { error: `Could not open ${provider === 'google' ? 'Google' : 'Apple'} sign-in.` };
  }
}

async function markNewProviderUser(session: AuthSession, startedAt: number): Promise<AuthSession> {
  if (!supabase || !startedAt) return session;
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

let latestExchange: { code: string; pending?: Promise<AuthResult> } | undefined;

export async function consumeAuthCallback(url: string, flowId?: string | null): Promise<AuthResult | null> {
  const callback = readAuthCallback(url, Platform.OS === 'web' ? authRedirectUrl() : undefined);
  if (!callback || !supabase) return null;
  if (callback.rejected || !callback.code) {
    const pendingFlow = await readPendingOAuthFlow();
    const returnedFlowId = flowId ?? callback.flowId;
    if (pendingFlow && (!returnedFlowId || returnedFlowId === pendingFlow.flowId)) {
      await clearPendingOAuthFlow(pendingFlow);
    }
    return { error: 'Sign-in could not be completed. Try again or use email.' };
  }
  if (latestExchange?.code === callback.code) return latestExchange.pending ?? {};
  const pending = finishCodeExchange(supabase, callback.code, flowId ?? callback.flowId);
  const exchange: NonNullable<typeof latestExchange> = { code: callback.code, pending };
  latestExchange = exchange;
  try {
    return await pending;
  } finally {
    exchange.pending = undefined;
  }
}

async function finishCodeExchange(client: NonNullable<typeof supabase>, code: string, callbackFlowId?: string | null): Promise<AuthResult> {
  const pendingFlow = await readPendingOAuthFlow();
  const flowId = callbackFlowId ?? pendingFlow?.flowId ?? undefined;
  const startedAt = pendingFlow && pendingFlow.flowId === flowId ? pendingFlow.startedAt : 0;
  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error || !data.session) return { error: 'This sign-in link could not be verified. Start sign-in again in StudyBolt.' };
    const recovery = 'redirectType' in data && data.redirectType === 'recovery';
    const session = recovery ? data.session : await markNewProviderUser(data.session, startedAt);
    return { session, user: session.user, recovery };
  } catch {
    return { error: 'Could not finish authentication. Check your connection and try again.' };
  } finally {
    if (pendingFlow && (flowId === pendingFlow.flowId || !flowId)) {
      await clearPendingOAuthFlow(pendingFlow).catch(() => undefined);
    }
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
    await prepareRevenueCatAccountDeletion(session.user.id);
    return await submitAccountDeletion(() => fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation: 'DELETE_ACCOUNT' }),
    }), clearAuthSession, () => releaseRevenueCatDeletionHold(session.user.id));
  } catch {
    return { error: 'Could not delete your account. Check your connection and try again.' };
  }
}
