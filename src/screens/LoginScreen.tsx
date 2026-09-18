import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { AuthField } from '../components/AuthField';
import { GoogleLogo } from '../components/GoogleLogo';
import { BoltLogo, Icon, PrimaryButton } from '../components/ui';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';

export type AuthMode = 'signin' | 'signup' | 'forgot';

export function LoginScreen({
  onContinueAsGuest,
}: {
  onContinueAsGuest: () => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { configured, signIn, signUp, signInWithProvider, forgotPassword, resendConfirmationEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState<'google' | 'apple' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ displayName?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const entrance = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entrance, mode, reducedMotion]);

  useEffect(() => {
    bob.stopAnimation();
    bob.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bob, { toValue: 0, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [bob, reducedMotion]);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setNotice(null);
    setConfirmationEmail(null);
    setPassword('');
    setConfirmPassword('');
    setFieldErrors({});
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (confirmationEmail) setConfirmationEmail(null);
    if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (fieldErrors.displayName) setFieldErrors((current) => ({ ...current, displayName: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password || fieldErrors.confirmPassword) {
      setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }));
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (fieldErrors.confirmPassword) setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const nextErrors: typeof fieldErrors = {};
    if (mode === 'signup' && !cleanDisplayName) nextErrors.displayName = 'Tell us what to call you.';
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) nextErrors.email = 'Enter a valid email address.';
    if (mode !== 'forgot' && password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (mode === 'signup' && confirmPassword !== password) nextErrors.confirmPassword = 'Passwords must match exactly.';
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setNotice(null);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setNotice(null);
    const result = mode === 'forgot'
      ? await forgotPassword(cleanEmail)
      : mode === 'signup'
        ? await signUp(cleanEmail, password, cleanDisplayName)
        : await signIn(cleanEmail, password);
    setBusy(false);
    if (result.error) setNotice({ tone: 'error', text: result.error });
    else if (result.message) {
      setNotice({ tone: 'success', text: result.message });
      setConfirmationEmail(mode === 'signup' ? cleanEmail : null);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setResendBusy(true);
    const result = await resendConfirmationEmail(confirmationEmail);
    setResendBusy(false);
    if (result.error) setNotice({ tone: 'error', text: result.error });
    else if (result.message) setNotice({ tone: 'success', text: result.message });
  };

  const useProvider = async (provider: 'google' | 'apple') => {
    setProviderBusy(provider);
    setNotice(null);
    const result = await signInWithProvider(provider);
    setProviderBusy(null);
    if (result.error) setNotice({ tone: 'error', text: result.error });
  };

  const title = mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Welcome back';
  const subtitle = mode === 'forgot'
    ? 'We’ll send a secure reset link to your inbox.'
    : mode === 'signup'
      ? 'Keep your study packs available across devices.'
      : 'Pick up exactly where you left off.';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 22) }]}
      >
        <View style={styles.topBar}>
          <BoltLogo compact />
          <Pressable accessibilityRole="button" onPress={onContinueAsGuest} hitSlop={9} style={styles.closeButton}>
            <Icon name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <LinearGradient
          colors={colors.mode === 'dark' ? ['#172536', '#10161D', '#302713'] : ['#E8F2FF', '#F6FAFF', '#FFF4D2']}
          locations={[0, 0.72, 1]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={[styles.heroOrb, { backgroundColor: `${colors.goldBright}22` }]} />
          <Animated.View
            style={[
              styles.heroMark,
              {
                backgroundColor: colors.goldBright,
                shadowColor: colors.gold,
                transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-3, 5] }) }, { rotate: '-6deg' }],
              },
            ]}
          >
            <Icon name="lightning-bolt" size={39} color={colors.onGold} />
          </Animated.View>
          <View style={[styles.floatingMini, styles.miniCards, { backgroundColor: colors.card }]}><Icon name="cards-outline" size={20} color={colors.purple} /></View>
          <View style={[styles.floatingMini, styles.miniBrain, { backgroundColor: colors.card }]}><Icon name="brain" size={20} color={colors.mint} /></View>
        </LinearGradient>

        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

          {notice ? (
            <View
              style={[styles.notice, { backgroundColor: notice.tone === 'error' ? `${colors.danger}14` : colors.mintSoft }]}
            >
              <Icon name={notice.tone === 'error' ? 'alert-circle-outline' : 'email-check-outline'} size={19} color={notice.tone === 'error' ? colors.danger : colors.mint} />
              <View style={styles.noticeBody}>
                <Text style={[styles.noticeText, { color: notice.tone === 'error' ? colors.danger : colors.mint }]}>{notice.text}</Text>
                {notice.tone === 'success' && confirmationEmail ? (
                  <View style={styles.confirmationHelp}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Resend confirmation email"
                      disabled={resendBusy}
                      onPress={() => void resendConfirmation()}
                      style={({ pressed }) => [styles.resendButton, { opacity: resendBusy ? 0.55 : pressed ? 0.7 : 1 }]}
                    >
                      {resendBusy ? <ActivityIndicator size="small" color={colors.mint} /> : <Icon name="refresh" size={16} color={colors.mint} />}
                      <Text style={[styles.resendText, { color: colors.mint }]}>{resendBusy ? 'Sending…' : 'Resend email'}</Text>
                    </Pressable>
                    <Text style={[styles.folderHint, { color: colors.textSecondary }]}>Also check your spam or junk folder.</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {!configured && !notice ? (
            <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
              <Icon name="information-outline" size={19} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Demo mode: connect Supabase to activate secure accounts.</Text>
            </View>
          ) : null}

          {mode !== 'forgot' ? (
            <View style={styles.providers}>
              <ProviderButton label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'} icon="google" onPress={() => void useProvider('google')} loading={providerBusy === 'google'} />
              <ProviderButton label={mode === 'signup' ? 'Sign up with Apple' : 'Continue with Apple'} icon="apple" onPress={() => void useProvider('apple')} loading={providerBusy === 'apple'} />
            </View>
          ) : null}

          {mode !== 'forgot' ? (
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR USE EMAIL</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          ) : null}

          <View style={styles.fields}>
            {mode === 'signup' ? <AuthField label="Name" icon="account-outline" value={displayName} onChangeText={handleDisplayNameChange} placeholder="What should we call you?" autoCapitalize="words" autoComplete="name" error={fieldErrors.displayName} /> : null}
            <AuthField label="Email address" icon="email-outline" value={email} onChangeText={handleEmailChange} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" error={fieldErrors.email} />
            {mode !== 'forgot' ? <AuthField label="Password" icon="lock-outline" value={password} onChangeText={handlePasswordChange} placeholder="At least 8 characters" secure autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} error={fieldErrors.password} /> : null}
            {mode === 'signup' ? <AuthField label="Confirm password" icon="lock-check-outline" value={confirmPassword} onChangeText={handleConfirmPasswordChange} placeholder="Re-enter your password" secure autoComplete="new-password" error={fieldErrors.confirmPassword} /> : null}
          </View>

          {mode === 'signin' ? (
            <Pressable accessibilityRole="button" onPress={() => changeMode('forgot')} style={styles.forgotButton}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <PrimaryButton
            label={mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
            icon={mode === 'forgot' ? 'email-fast-outline' : 'arrow-right'}
            onPress={() => void submit()}
            loading={busy}
            style={styles.submit}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchPrompt, { color: colors.textSecondary }]}>
              {mode === 'signin' ? 'New to StudyBolt?' : mode === 'signup' ? 'Already have an account?' : 'Remembered your password?'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} hitSlop={7}>
              <Text style={[styles.switchAction, { color: colors.primary }]}>{mode === 'signin' ? 'Create account' : 'Log in'}</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={onContinueAsGuest} style={styles.guestButton}>
            <Text style={[styles.guestText, { color: colors.textMuted }]}>Continue without an account</Text>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProviderButton({ label, icon, onPress, loading }: { label: string; icon: 'google' | 'apple'; onPress: () => void; loading: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.providerButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      {icon === 'google' ? <GoogleLogo size={21} /> : <Icon name="apple" size={21} color={colors.text} />}
      <Text style={[styles.providerLabel, { color: colors.text }]}>{loading ? 'Opening…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 42, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  hero: { height: 142, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, marginBottom: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -58, bottom: -120 },
  heroMark: { width: 72, height: 72, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 6 },
  floatingMini: { position: 'absolute', width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  miniCards: { left: '20%', top: 22, transform: [{ rotate: '-9deg' }] },
  miniBrain: { right: '20%', bottom: 19, transform: [{ rotate: '8deg' }] },
  title: { fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  notice: { minHeight: 48, borderRadius: 14, marginTop: 16, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeBody: { flex: 1, gap: 8 },
  noticeText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  confirmationHelp: { gap: 4 },
  resendButton: { alignSelf: 'flex-start', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5 },
  resendText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  folderHint: { fontSize: 10, lineHeight: 14 },
  providers: { gap: 9, marginTop: 19 },
  providerButton: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  providerLabel: { fontSize: 14, fontWeight: '800' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  fields: { gap: 13 },
  forgotButton: { alignSelf: 'flex-end', minHeight: 35, justifyContent: 'center' },
  forgotText: { fontSize: 12, fontWeight: '800' },
  submit: { marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5, marginTop: 19 },
  switchPrompt: { fontSize: 12 },
  switchAction: { fontSize: 12, fontWeight: '900' },
  guestButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  guestText: { fontSize: 11, fontWeight: '700' },
});
