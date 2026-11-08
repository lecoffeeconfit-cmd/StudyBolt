import { useReducedMotion } from '../hooks/useReducedMotion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { Card, Header, Icon, PrimaryButton, Screen } from '../components/ui';
import { hasApprovedLegalDocuments, LEGAL_URLS } from '../config/legal';
import { useAuth } from '../AuthContext';
import { useStudyBolt } from '../StudyBoltContext';
import type { AiTutorQuota } from '../models';
import { fetchTutorQuota } from '../services/aiTutor';
import {
  buyRevenueCatPackage,
  canUseRevenueCat,
  loadRevenueCatPackages,
  openRevenueCatSubscriptionManagement,
  restoreRevenueCatPurchases,
  syncRevenueCatEntitlement,
} from '../services/subscriptions';
import { radius } from '../theme';
import { StudyBoltLoading } from '../components/StudyBoltLoading';

export function PremiumScreen({ onBack, onOpenLegal, onRequireAuth }: { onBack: () => void; onOpenLegal: () => void; onRequireAuth: () => void }) {
  const reducedMotion = useReducedMotion();
  const { colors } = useStudyBolt();
  const { user, getAccessToken } = useAuth();
  const accountId = useRef(user?.id);
  accountId.current = user?.id;
  useEffect(() => { accountId.current = user?.id; return () => { accountId.current = undefined; }; }, [user?.id]);
  const entrance = useRef(new Animated.Value(0)).current;
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [quota, setQuota] = useState<AiTutorQuota | null>(null);
  const [subscriptionSyncReady, setSubscriptionSyncReady] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshQuota = useCallback(async () => {
    const requestedFor = user?.id;
    try {
      const token = await getAccessToken();
      if (accountId.current !== requestedFor) return null;
      if (!token) {
        setQuota(null);
        setError('Sign in again to check your secure membership status.');
        return null;
      }
      const result = await fetchTutorQuota(token);
      if (accountId.current !== requestedFor) return null;
      if (!result.quota) {
        setQuota(null);
        setError(result.error ?? 'StudyBolt could not verify your membership right now.');
        return null;
      }
      setQuota(result.quota);
      setError(null);
      return result.quota;
    } catch {
      if (accountId.current !== requestedFor) return null;
      setQuota(null);
      setError('StudyBolt could not verify your membership right now.');
      return null;
    }
  }, [getAccessToken, user?.id]);

  const load = useCallback(async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setLoading(true);
    setSubscriptionSyncReady(false);
    setError(null);
    setNotice(null);
    try {
      const [offerResult] = await Promise.all([
        canUseRevenueCat() ? loadRevenueCatPackages(user.id).then((value) => ({ packages: value, error: null as string | null })).catch((reason: unknown) => ({ packages: [], error: errorText(reason, 'Premium offers are not available right now.') }))
          : Promise.resolve({ packages: [] as PurchasesPackage[], error: null as string | null }),
        (async () => {
          if (canUseRevenueCat()) {
            const token = await getAccessToken();
            const status = token ? await syncRevenueCatEntitlement(token) : { error: 'Sign in again to check your subscription.' };
            if (accountId.current !== user.id) return;
            setSubscriptionSyncReady(isSubscriptionSyncReady(status));
            if (status.error) setError(status.error);
            else if (status.status === 'throttled') setNotice('Subscription verification is still cooling down. Refresh status in a moment before checking out.');
          }
          await refreshQuota();
        })(),
      ]);
      if (accountId.current !== user.id) return;
      setPackages(offerResult.packages);
      setSelectedPackageId((current) => offerResult.packages.some((item) => item.identifier === current) ? current : offerResult.packages[0]?.identifier ?? null);
      if (offerResult.error) setError(offerResult.error);
    } catch {
      if (accountId.current === user.id) {
        setSubscriptionSyncReady(false);
        setError('StudyBolt could not load your plan right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, onRequireAuth, refreshQuota, user]);

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return; }
    Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [entrance, reducedMotion]);

  useEffect(() => { void load(); }, [load]);

  const selectedPackage = packages.find((item) => item.identifier === selectedPackageId) ?? packages[0] ?? null;
  const active = quota?.plan === 'premium';
  const canCheckout = Boolean(user && selectedPackage && hasApprovedLegalDocuments && acceptedLegal && subscriptionSyncReady && quota && !active && !busy && !loading);

  const refreshStatus = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getAccessToken();
      const syncResult = token ? await syncRevenueCatEntitlement(token) : { error: 'Sign in again to check your subscription.' };
      setSubscriptionSyncReady(isSubscriptionSyncReady(syncResult));
      const verifiedQuota = await refreshQuota();
      if (verifiedQuota?.plan === 'premium') setNotice('Premium is active on your account.');
      else if (syncResult.status === 'throttled') setNotice('Subscription verification is still cooling down. Wait a moment, then refresh status again.');
      else if (syncResult.error) setError(syncResult.error);
      else setNotice('No active Premium subscription is confirmed for this account.');
    } catch {
      setError('StudyBolt could not refresh your subscription status. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const buy = async () => {
    if (!user || !selectedPackage) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await buyRevenueCatPackage(user.id, selectedPackage);
      setNotice('Purchase received. StudyBolt is checking the store confirmation.');
      const token = await getAccessToken();
      const syncResult = token ? await syncRevenueCatEntitlement(token) : { error: 'Sign in again to check your subscription.' };
      setSubscriptionSyncReady(isSubscriptionSyncReady(syncResult));
      const verifiedQuota = await refreshQuota();
      if (verifiedQuota?.plan === 'premium') setNotice('Premium is active on your account.');
      else if (syncResult.status === 'throttled') setNotice('Your purchase is waiting for secure account confirmation. Wait a moment, then refresh status.');
      else setNotice('Your purchase is waiting for secure account confirmation. Refresh status in a moment.');
    } catch (reason) {
      if (!String((reason as { code?: unknown } | null)?.code ?? '').toUpperCase().includes('CANCEL')) {
        setError(errorText(reason, 'StudyBolt could not complete this purchase. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await restoreRevenueCatPurchases(user.id);
      if (accountId.current !== user.id) return;
      const token = await getAccessToken();
      const syncResult = token ? await syncRevenueCatEntitlement(token) : { error: 'Sign in again to check your subscription.' };
      if (accountId.current !== user.id) return;
      setSubscriptionSyncReady(isSubscriptionSyncReady(syncResult));
      const verifiedQuota = await refreshQuota();
      if (accountId.current !== user.id) return;
      if (verifiedQuota?.plan === 'premium') setNotice('Your Premium access has been restored.');
      else if (syncResult.error || syncResult.status === 'throttled') setNotice('Store restore completed. Secure account confirmation is still syncing; refresh status in a moment.');
      else setNotice('Restore complete. No active Premium access was found for this account.');
    } catch (reason) {
      setError(errorText(reason, 'StudyBolt could not restore purchases right now.'));
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await openRevenueCatSubscriptionManagement(user.id);
    } catch (reason) {
      setError(errorText(reason, 'Subscription settings could not be opened.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="StudyBolt Premium" subtitle="Membership & usage" onBack={onBack} />
      <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}><Icon name="lightning-bolt" size={28} color={colors.primaryText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{active ? 'Premium is active' : 'More room to study'}</Text>
            <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>Premium adds more monthly AI support for Tutor and document study. Your usage and reset date are below.</Text>
          </View>
        </View>

        <Card style={styles.statusCard}>
          <View style={styles.statusTop}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Account status</Text>
            <View style={[styles.statusPill, { backgroundColor: active ? colors.mintSoft : colors.cardStrong }]}>
              <Text style={[styles.statusPillText, { color: active ? colors.mint : colors.textSecondary }]}>{loading ? 'Checking' : active ? 'Premium' : quota ? 'Free' : 'Unavailable'}</Text>
            </View>
          </View>
          {quota ? (
            <>
              <Text style={[styles.usageTitle, { color: colors.text }]}>{quota.remaining} of {quota.limit} AI interactions left</Text>
              <Text style={[styles.usageCopy, { color: colors.textSecondary }]}>Allowance resets {quota.periodEnd}. Document processing and AI Tutor use the same allowance.</Text>
              {quota.plan === 'free' ? <Text style={[styles.usageCopy, { color: colors.textSecondary }]}>You can keep using your saved Study Packs and import one PowerPoint each month.</Text> : null}
            </>
          ) : (
            <Text style={[styles.usageCopy, { color: colors.textSecondary }]}>{loading ? 'Checking the current plan with the StudyBolt server…' : 'Sign-in and the secure AI service must be available to verify a plan.'}</Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => { setError(null); void refreshStatus(); }} disabled={loading || busy} style={styles.refresh}>
            <Icon name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh status</Text>
          </Pressable>
        </Card>

        {!active ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose a plan</Text>
            {Platform.OS === 'web' ? (
              <Card><Text style={[styles.noticeText, { color: colors.textSecondary }]}>Subscriptions are available in the iOS and Android apps.</Text></Card>
            ) : !canUseRevenueCat() ? (
              <Card><Text style={[styles.noticeText, { color: colors.textSecondary }]}>Store checkout will appear when StudyBolt is connected to its App Store and Google Play products.</Text></Card>
            ) : packages.length ? (
              <View style={styles.packageList}>
                {packages.map((item) => {
                  const selected = item.identifier === selectedPackage?.identifier;
                  return (
                    <Pressable aria-checked={selected} key={item.identifier} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setSelectedPackageId(item.identifier)} style={[styles.packageCard, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.packageTitle, { color: colors.text }]}>{packagePlanName(item)}</Text>
                        <Text style={[styles.packageDetail, { color: colors.textSecondary }]}>{packageBillingDetail(item)}</Text>
                      </View>
                      <Text style={[styles.packagePrice, { color: colors.text }]}>{item.product.priceString}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Card>{loading ? <StudyBoltLoading compact colors={colors} message="Loading store plans…" /> : <Text style={[styles.noticeText, { color: colors.textSecondary }]}>No store offers are available. Please try again later.</Text>}</Card>
            )}

            {!hasApprovedLegalDocuments ? (
              <Card style={[styles.legalGate, { backgroundColor: `${colors.warning}1A` }]}>
                <Icon name="lock-outline" size={19} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legalGateTitle, { color: colors.text }]}>Checkout is paused</Text>
                  <Text style={[styles.noticeText, { color: colors.textSecondary }]}>The privacy policy and terms must be complete and approved before a new subscription can be purchased.</Text>
                  <Pressable onPress={onOpenLegal} accessibilityRole="button"><Text style={[styles.link, { color: colors.primary }]}>View legal links</Text></Pressable>
                </View>
              </Card>
            ) : (
              <>
                <View style={styles.legalLinks}>
                  <LegalLink title="Privacy policy" url={LEGAL_URLS.privacyPolicy} />
                  <LegalLink title="Terms of service" url={LEGAL_URLS.termsOfService} />
                </View>
                <Pressable aria-checked={acceptedLegal} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedLegal }} onPress={() => setAcceptedLegal((value) => !value)} style={styles.consentRow}>
                  <View style={[styles.consentBox, { backgroundColor: acceptedLegal ? colors.primary : colors.card, borderColor: acceptedLegal ? colors.primary : colors.border }]}>
                    {acceptedLegal ? <Icon name="check" size={14} color={colors.primaryText} /> : null}
                  </View>
                  <Text style={[styles.consentText, { color: colors.textSecondary }]}>I agree to the Terms of Service and acknowledge the Privacy Policy.</Text>
                </Pressable>
              </>
            )}

            <PrimaryButton label="Continue to store" icon="arrow-right" disabled={!canCheckout} loading={busy} onPress={() => void buy()} style={styles.primaryButton} />
            <Text style={[styles.billingNote, { color: colors.textMuted }]}>Billed through your selected app store. Subscriptions auto-renew under the store terms until cancelled in your store account settings.</Text>
            {!subscriptionSyncReady && canUseRevenueCat() && !loading ? <Text style={[styles.billingNote, { color: colors.warning }]}>Checkout will open after secure subscription verification is connected.</Text> : null}
          </>
        ) : (
          <Card style={styles.activeCard}>
            <View style={[styles.activeIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check-decagram" size={22} color={colors.mint} /></View>
            <Text style={[styles.activeTitle, { color: colors.text }]}>You’re all set</Text>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Premium status comes from your verified store subscription.</Text>
            <PrimaryButton label="Manage subscription" icon="cog-outline" disabled={busy} loading={busy} onPress={() => void manage()} style={styles.primaryButton} />
          </Card>
        )}

        <Pressable accessibilityRole="button" disabled={busy || loading} onPress={() => void restore()} style={styles.restoreButton}>
          <Text style={[styles.restoreText, { color: colors.primary }]}>{busy ? 'Please wait…' : 'Restore purchases'}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.danger }]}>{error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.mint }]}>{notice}</Text> : null}
      </Animated.View>
    </Screen>
  );
}

function LegalLink({ title, url }: { title: string; url: string }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.legalLink}>
      <Text style={[styles.legalLinkText, { color: colors.primary }]}>{title}</Text>
      <Icon name="open-in-new" size={14} color={colors.primary} />
    </Pressable>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function isSubscriptionSyncReady(result: { status?: string; error?: string }): boolean {
  return !result.error && result.status !== 'throttled';
}

function packagePlanName(item: PurchasesPackage): string {
  return subscriptionPeriodMonths(item.product.subscriptionPeriod) === 12 ? 'Annual plan' : 'Monthly plan';
}

function packageBillingDetail(item: PurchasesPackage): string {
  const months = subscriptionPeriodMonths(item.product.subscriptionPeriod);
  const billingCadence = months === 12 ? 'yearly' : 'monthly';
  const intro = item.product.introPrice;
  if (intro?.price === 0) {
    const duration = introTrialDuration(intro.periodUnit, intro.periodNumberOfUnits);
    return `${duration ? `${duration} free trial` : 'Free trial'} for eligible subscribers · then billed ${billingCadence}`;
  }
  return `Billed ${billingCadence}`;
}

function introTrialDuration(unit: string, count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null;
  const normalizedUnit = unit.toUpperCase();
  if (normalizedUnit === 'DAY') return `${count}-day`;
  if (normalizedUnit === 'WEEK') return `${count * 7}-day`;
  if (normalizedUnit === 'MONTH') return `${count}-month`;
  if (normalizedUnit === 'YEAR') return `${count}-year`;
  return null;
}

function subscriptionPeriodMonths(period: string | null): number | null {
  if (!period) return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(period);
  if (!match) return null;
  const months = (Number(match[1] ?? 0) * 12) + Number(match[2] ?? 0);
  return months > 0 ? months : null;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderRadius: radius.md, marginTop: 12 },
  heroIcon: { width: 51, height: 51, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  heroCopy: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  statusCard: { marginTop: 15 },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  usageTitle: { fontSize: 16, fontWeight: '900', marginTop: 13 },
  usageCopy: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingTop: 12 },
  refreshText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginTop: 23, marginBottom: 10 },
  packageList: { gap: 9 },
  packageCard: { borderWidth: 1.5, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  packageTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  packageDetail: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  packagePrice: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  noticeText: { fontSize: 14, lineHeight: 21 },
  legalGate: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 13 },
  legalGateTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginBottom: 4 },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 8 },
  legalLinks: { flexDirection: 'row', gap: 18, marginTop: 13 },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  legalLinkText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 11 },
  consentBox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  consentText: { flex: 1, fontSize: 14, lineHeight: 21 },
  primaryButton: { marginTop: 16 },
  billingNote: { fontSize: 14, lineHeight: 21, marginTop: 9, textAlign: 'center' },
  activeCard: { alignItems: 'center', marginTop: 18, paddingVertical: 20 },
  activeIcon: { width: 47, height: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  activeTitle: { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  restoreButton: { alignItems: 'center', paddingVertical: 17 },
  restoreText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 10 },
});
