import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../AuthContext';
import { AuthField } from '../components/AuthField';
import { Card, Header, Icon, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';

export function AccountScreen({ onBack, onSignedOut, onDeleted }: { onBack: () => void; onSignedOut: () => void; onDeleted: () => void }) {
  const { colors, resetLocalData } = useStudyBolt();
  const { user, changeEmail, forgotPassword, signOut, deleteAccount } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState<'email' | 'reset' | 'signout' | 'delete' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entrance]);

  const saveEmail = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setNotice({ tone: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (cleanEmail === user?.email?.toLowerCase()) {
      setNotice({ tone: 'error', text: 'Enter a different email address.' });
      return;
    }
    setBusy('email');
    const result = await changeEmail(cleanEmail);
    setBusy(null);
    setNotice({ tone: result.error ? 'error' : 'success', text: result.error ?? result.message ?? 'Email update requested.' });
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setBusy('reset');
    const result = await forgotPassword(user.email);
    setBusy(null);
    setNotice({ tone: result.error ? 'error' : 'success', text: result.error ?? result.message ?? 'Reset link sent.' });
  };

  const logOut = async () => {
    setConfirmingSignOut(false);
    setBusy('signout');
    await signOut();
    setBusy(null);
    onSignedOut();
  };

  const removeAccount = async () => {
    setBusy('delete');
    const result = await deleteAccount();
    setBusy(null);
    if (result.error) {
      setConfirmingDelete(false);
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    resetLocalData();
    setConfirmingDelete(false);
    onDeleted();
  };

  const initial = (user?.email?.[0] ?? 'S').toUpperCase();

  return (
    <>
      <Screen>
        <Header title="Account" subtitle="Security & access" onBack={onBack} />
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.identityTitle, { color: colors.text }]}>Your StudyBolt account</Text>
              <Text style={[styles.identityEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            </View>
            <View style={[styles.securePill, { backgroundColor: colors.mintSoft }]}>
              <Icon name="shield-check" size={15} color={colors.mint} />
              <Text style={[styles.secureText, { color: colors.mint }]}>Secure</Text>
            </View>
          </View>

          {notice ? (
            <View style={[styles.notice, { backgroundColor: notice.tone === 'error' ? `${colors.danger}14` : colors.mintSoft }]}>
              <Icon name={notice.tone === 'error' ? 'alert-circle-outline' : 'check-circle-outline'} size={19} color={notice.tone === 'error' ? colors.danger : colors.mint} />
              <Text style={[styles.noticeText, { color: notice.tone === 'error' ? colors.danger : colors.mint }]}>{notice.text}</Text>
            </View>
          ) : null}

          <SectionHeader title="Email address" />
          <Card style={styles.formCard}>
            <AuthField label="New email" icon="email-edit-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" />
            <Text style={[styles.helper, { color: colors.textMuted }]}>For security, your current and new inbox may both need to confirm this change.</Text>
            <PrimaryButton label="Send verification" icon="email-fast-outline" loading={busy === 'email'} onPress={() => void saveEmail()} style={styles.cardButton} />
          </Card>

          <SectionHeader title="Password & session" />
          <Card style={styles.actionCard}>
            <AccountAction icon="lock-reset" title="Reset password" detail="Email a secure reset link" onPress={() => void sendPasswordReset()} loading={busy === 'reset'} />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <AccountAction icon="logout" title="Sign out" detail="Study packs remain on this device" onPress={() => setConfirmingSignOut(true)} loading={busy === 'signout'} />
          </Card>

          <SectionHeader title="Danger zone" />
          <Card style={[styles.dangerCard, { backgroundColor: `${colors.danger}0D`, borderColor: `${colors.danger}45` }]}>
            <View style={styles.dangerTop}>
              <View style={[styles.dangerIcon, { backgroundColor: `${colors.danger}18` }]}><Icon name="delete-outline" size={22} color={colors.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dangerTitle, { color: colors.text }]}>Delete account</Text>
                <Text style={[styles.dangerCopy, { color: colors.textSecondary }]}>Permanently removes your account and synced data. This cannot be undone.</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setConfirmingDelete(true)} style={[styles.deleteButton, { borderColor: colors.danger }]}>
              <Text style={[styles.deleteLabel, { color: colors.danger }]}>Delete my account</Text>
            </Pressable>
          </Card>
        </Animated.View>
      </Screen>

      <Modal visible={confirmingDelete} transparent animationType="fade" onRequestClose={() => setConfirmingDelete(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${colors.danger}16` }]}><Icon name="delete-alert-outline" size={30} color={colors.danger} /></View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete your account?</Text>
            <Text style={[styles.modalCopy, { color: colors.textSecondary }]}>This permanently deletes {user?.email ?? 'your account'} and its synced data. StudyBolt cannot restore it later.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy === 'delete'}
              onPress={() => void removeAccount()}
              style={[styles.modalDelete, { backgroundColor: colors.danger, opacity: busy === 'delete' ? 0.65 : 1 }]}
            >
              <Text style={[styles.modalDeleteText, { color: colors.primaryText }]}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete account'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy === 'delete'} onPress={() => setConfirmingDelete(false)} style={styles.modalCancel}>
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Keep my account</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmingSignOut} transparent animationType="fade" onRequestClose={() => setConfirmingSignOut(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[styles.modalIcon, { backgroundColor: colors.primarySoft }]}><Icon name="logout-variant" size={30} color={colors.primary} /></View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign out of StudyBolt?</Text>
            <Text style={[styles.modalCopy, { color: colors.textSecondary }]}>Your study packs stay safely on this device. You can sign back in whenever you’re ready.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy === 'signout'}
              onPress={() => void logOut()}
              style={[styles.modalSignOut, { backgroundColor: colors.primary, opacity: busy === 'signout' ? 0.65 : 1 }]}
            >
              <Text style={[styles.modalDeleteText, { color: colors.primaryText }]}>{busy === 'signout' ? 'Signing out…' : 'Sign out'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy === 'signout'} onPress={() => setConfirmingSignOut(false)} style={styles.modalCancel}>
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Keep studying</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AccountAction({ icon, title, detail, onPress, loading }: { icon: 'lock-reset' | 'logout'; title: string; detail: string; onPress: () => void; loading: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={({ pressed }) => [styles.accountAction, pressed && { opacity: 0.65 }]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, { color: colors.text }]}>{loading ? 'Please wait…' : title}</Text>
        <Text style={[styles.actionDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '900' },
  identityTitle: { fontSize: 14, fontWeight: '900' },
  identityEmail: { fontSize: 11, marginTop: 3 },
  securePill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', gap: 4, alignItems: 'center' },
  secureText: { fontSize: 9, fontWeight: '900' },
  notice: { borderRadius: 14, marginTop: 10, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  formCard: { gap: 12 },
  helper: { fontSize: 10, lineHeight: 15 },
  cardButton: { minHeight: 48 },
  actionCard: { paddingVertical: 2 },
  accountAction: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 13, fontWeight: '800' },
  actionDetail: { fontSize: 10, marginTop: 3 },
  separator: { height: StyleSheet.hairlineWidth },
  dangerCard: { marginBottom: 10 },
  dangerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  dangerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 14, fontWeight: '900' },
  dangerCopy: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  deleteButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  deleteLabel: { fontSize: 13, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3, 7, 20, 0.62)', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 430, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 22, alignItems: 'center', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.24, shadowRadius: 30, elevation: 12 },
  modalIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5, marginTop: 15 },
  modalCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  modalDelete: { width: '100%', minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  modalSignOut: { width: '100%', minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  modalDeleteText: { fontSize: 14, fontWeight: '900' },
  modalCancel: { minHeight: 42, justifyContent: 'center', marginTop: 4 },
  modalCancelText: { fontSize: 12, fontWeight: '800' },
});
