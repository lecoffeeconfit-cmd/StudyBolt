import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

import { hasApprovedLegalDocuments } from '../config/legal';
import { resolveBackendUrl } from '../config/backend';

let lastRevenueCatUserId: string | null | undefined;
let sdkQueue: Promise<unknown> = Promise.resolve();

export function canUseRevenueCat(): boolean {
  return Platform.OS !== 'web' && Boolean(publicApiKey());
}

/** Keep the store's customer identity tied to the signed-in Supabase account. */
export function syncRevenueCatUser(userId: string | null): Promise<void> {
  return withRevenueCatUser(userId, async () => undefined).catch(() => undefined);
}

export async function loadRevenueCatPackages(userId: string): Promise<PurchasesPackage[]> {
  const offerings = await withRevenueCatUser(userId, () => Purchases.getOfferings());
  // Keep the paywall limited to the two plans StudyBolt supports. This prevents
  // an accidental lifetime, weekly, or custom package from appearing here.
  return (offerings.current?.availablePackages ?? [])
    .filter((item) => subscriptionPeriodMonths(item.product.subscriptionPeriod) === 1
      || subscriptionPeriodMonths(item.product.subscriptionPeriod) === 12)
    .sort((left, right) => subscriptionPeriodMonths(left.product.subscriptionPeriod)! - subscriptionPeriodMonths(right.product.subscriptionPeriod)!);
}

export async function buyRevenueCatPackage(userId: string, aPackage: PurchasesPackage): Promise<void> {
  if (!hasApprovedLegalDocuments) throw new Error('Subscription purchases are paused until the privacy policy and terms are complete and approved.');
  await withRevenueCatUser(userId, () => Purchases.purchasePackage(aPackage));
  // Client purchase results never grant StudyBolt access. The signed RevenueCat
  // webhook updates server-owned metadata and all AI endpoints read that state.
}

export async function restoreRevenueCatPurchases(userId: string): Promise<void> {
  await withRevenueCatUser(userId, () => Purchases.restorePurchases());
}

export async function openRevenueCatSubscriptionManagement(userId: string): Promise<void> {
  await withRevenueCatUser(userId, () => Purchases.showManageSubscriptions());
}

export async function syncRevenueCatEntitlement(accessToken: string): Promise<{ status?: string; error?: string }> {
  const supabaseUrl = resolveBackendUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'PASTE_ANON_KEY_HERE') {
    return { error: 'Subscription status service is not connected yet.' };
  }
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/studybolt-sync-subscription`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return { error: 'StudyBolt could not check subscription status.' };
    if (response.status === 429 && payload.status === 'throttled') return { status: 'throttled' };
    if (!response.ok) return { error: typeof payload.error === 'string' ? payload.error : 'StudyBolt could not check subscription status.' };
    return { status: typeof payload.status === 'string' ? payload.status : 'processed' };
  } catch {
    return { error: 'StudyBolt could not reach the subscription service.' };
  }
}

function withRevenueCatUser<T>(userId: string | null, action: () => Promise<T>): Promise<T> {
  const operation = sdkQueue.then(async () => {
    const key = publicApiKey();
    if (Platform.OS === 'web') throw new Error('In-app subscriptions are available in the iOS and Android apps.');
    if (!key) throw new Error('Premium checkout is not connected to the app stores yet.');

    const configured = await Purchases.isConfigured();
    if (!userId) {
      if (configured && lastRevenueCatUserId !== null) await Purchases.logOut();
      lastRevenueCatUserId = null;
      return undefined as T;
    }

    if (!configured) {
      Purchases.configure({ apiKey: key, appUserID: userId });
      lastRevenueCatUserId = userId;
    } else if (lastRevenueCatUserId !== userId) {
      await Purchases.logIn(userId);
      lastRevenueCatUserId = userId;
    }
    return action();
  });
  sdkQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function publicApiKey(): string {
  if (Platform.OS === 'ios') return usableKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY);
  if (Platform.OS === 'android') return usableKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY);
  return '';
}

function usableKey(value: string | undefined): string {
  const key = value?.trim() ?? '';
  return key && !key.startsWith('PASTE_') ? key : '';
}

function subscriptionPeriodMonths(period: string | null): number | null {
  if (!period) return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(period);
  if (!match) return null;
  const months = (Number(match[1] ?? 0) * 12) + Number(match[2] ?? 0);
  return months > 0 ? months : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
