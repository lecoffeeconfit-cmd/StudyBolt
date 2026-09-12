import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { Card, Icon, Pill, PrimaryButton } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { SharedStudyPackLink, StudyPack } from '../models';
import {
  createSharedStudyPack,
  isSharingBackendConfigured,
  loadStoredShareLink,
  markShareLinkRevoked,
  revokeSharedStudyPack,
  shareMessageFor,
  storeShareLink,
} from '../services/sharing';
import { radius } from '../theme';

export function StudyPackShareSheet({ deck, visible, onClose }: { deck: StudyPack; visible: boolean; onClose: () => void }) {
  const { colors, recordStudyEvent } = useStudyBolt();
  const { user, getAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<SharedStudyPackLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setCopied(false);
    setBusy(true);
    void loadStoredShareLink(deck.id).then((stored) => {
      setLink(stored);
      setBusy(false);
    });
  }, [deck.id, visible]);

  const ensureLink = async (): Promise<SharedStudyPackLink | null> => {
    if (link && !link.revokedAt) return link;
    if (!user) {
      setError('Sign in to create a share link for your Study Pack.');
      return null;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Your session has expired. Sign in again to share this Study Pack.');
      return null;
    }
    setBusy(true);
    setError(null);
    const result = await createSharedStudyPack(deck, accessToken, user.id);
    if (result.error || !result.link) {
      setBusy(false);
      setError(result.error ?? 'Could not create a share link. Please try again.');
      return null;
    }
    await storeShareLink(result.link);
    setLink(result.link);
    setBusy(false);
    recordStudyEvent({ type: 'share-link-created', deckId: deck.id, courseId: deck.courseId });
    return result.link;
  };

  const openShareSheet = async () => {
    const nextLink = await ensureLink();
    if (!nextLink) return;
    setError(null);
    recordStudyEvent({ type: 'share-sheet-opened', deckId: deck.id, courseId: deck.courseId });
    try {
      await Share.share({
        message: shareMessageFor(deck, nextLink.url),
        title: deck.title,
        url: nextLink.url,
      });
    } catch {
      setError('Could not open the share sheet. Please try again.');
    }
  };

  const copyLink = async () => {
    const nextLink = await ensureLink();
    if (!nextLink) return;
    try {
      await Clipboard.setStringAsync(nextLink.url);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setError('Could not copy the link. Try Share again and choose Copy Link.');
    }
  };

  const disableLink = async () => {
    if (!link) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Your session has expired. Sign in again to stop sharing.');
      return;
    }
    setBusy(true);
    const result = await revokeSharedStudyPack(link.token, accessToken);
    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await markShareLinkRevoked(link);
    setLink(null);
    setBusy(false);
    setError(null);
  };

  const requestDisable = () => {
    if (Platform.OS === 'web') {
      void disableLink();
      return;
    }
    Alert.alert('Stop sharing this Study Pack?', 'Anyone with the current link will lose access. You can create a new link later.', [
      { text: 'Keep link', style: 'cancel' },
      { text: 'Stop sharing', style: 'destructive', onPress: () => void disableLink() },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]}>
        <Pressable accessibilityLabel="Close share dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="share-variant" size={23} color={colors.primary} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Share Study Pack</Text>
              <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{deck.title}</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.closeButton}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={[styles.privacyCard, { backgroundColor: colors.mintSoft }]}>
            <Icon name="shield-check-outline" size={20} color={colors.mint} />
            <View style={styles.privacyCopy}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>Study material only</Text>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Notes, cards, quiz content, and quick review are shared. Your mastery and history stay private.</Text>
            </View>
          </View>

          {!user ? (
            <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
              <Icon name="account-lock-outline" size={19} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Sign in to create and manage a share link.</Text>
            </View>
          ) : null}
          {!isSharingBackendConfigured ? (
            <View style={[styles.notice, { backgroundColor: colors.cardStrong }]}>
              <Icon name="cloud-alert-outline" size={19} color={colors.textMuted} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Link sharing needs the StudyBolt backend connection.</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.notice, { backgroundColor: `${colors.danger}14` }]}>
              <Icon name="alert-circle-outline" size={19} color={colors.danger} />
              <Text style={[styles.noticeText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          {link ? (
            <Card style={[styles.activeCard, { backgroundColor: colors.backgroundRaised }]}>
              <View style={styles.activeTop}>
                <View style={[styles.activeIcon, { backgroundColor: colors.mintSoft }]}><Icon name="link-variant" size={19} color={colors.mint} /></View>
                <View style={styles.activeCopy}>
                  <View style={styles.activeLabelRow}><Text style={[styles.activeTitle, { color: colors.text }]}>Link active</Text><Pill label="Anyone with the link" tone="mint" /></View>
                  <Text numberOfLines={1} style={[styles.linkText, { color: colors.textMuted }]}>{link.url}</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" onPress={() => void copyLink()} style={[styles.secondaryAction, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="content-copy" size={18} color={colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: colors.primary }]}>{copied ? 'Copied' : 'Copy link'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void openShareSheet()} style={[styles.secondaryAction, { backgroundColor: colors.cardStrong }]}>
                  <Icon name="share-variant" size={18} color={colors.textSecondary} />
                  <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>Share again</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={requestDisable} style={styles.disableAction}>
                <Icon name="link-off" size={17} color={colors.danger} />
                <Text style={[styles.disableText, { color: colors.danger }]}>Stop sharing</Text>
              </Pressable>
            </Card>
          ) : (
            <View style={[styles.createCard, { backgroundColor: colors.primarySoft }]}>
              <View style={styles.privateState}><Icon name="lock-outline" size={16} color={colors.textSecondary} /><Text style={[styles.privateStateText, { color: colors.textSecondary }]}>Private until you create a link</Text></View>
              <View style={[styles.createIcon, { backgroundColor: colors.card }]}><Icon name="send-outline" size={23} color={colors.primary} /></View>
              <Text style={[styles.createTitle, { color: colors.text }]}>Send this pack to someone</Text>
              <Text style={[styles.createText, { color: colors.textSecondary }]}>Create a private link, then use Messages, WhatsApp, Mail, AirDrop, or Copy Link.</Text>
            </View>
          )}

          <PrimaryButton
            label={link ? 'Open share sheet' : user ? 'Create share link' : 'Sign in to share'}
            icon={link ? 'share-variant' : user ? 'link-plus' : 'account-arrow-right-outline'}
            onPress={link ? () => void openShareSheet() : user ? () => void openShareSheet() : onClose}
            loading={busy}
            disabled={!user || (!isSharingBackendConfigured && !link)}
            style={styles.primaryAction}
          />
          {!link && !user ? <Text style={[styles.helper, { color: colors.textMuted }]}>Your recipient can still preview a link after you sign in.</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, marginBottom: 17 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeButton: { width: 34, height: 34, alignItems: 'flex-end', justifyContent: 'center' },
  privacyCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: radius.md, marginTop: 19 },
  privacyCopy: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 12, fontWeight: '900' },
  privacyText: { fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, marginTop: 10 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  createCard: { alignItems: 'center', padding: 17, borderRadius: radius.md, marginTop: 14 },
  privateState: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  privateStateText: { fontSize: 10, fontWeight: '800' },
  createIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  createTitle: { fontSize: 15, fontWeight: '900' },
  createText: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  activeCard: { marginTop: 14, padding: 13 },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeCopy: { flex: 1, minWidth: 0 },
  activeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeTitle: { fontSize: 13, fontWeight: '900' },
  linkText: { fontSize: 10, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  secondaryAction: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryActionText: { fontSize: 12, fontWeight: '900' },
  disableAction: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 39, marginTop: 4 },
  disableText: { fontSize: 11, fontWeight: '800' },
  primaryAction: { marginTop: 14 },
  helper: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
});
