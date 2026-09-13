import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import type { CommunityClass, SharedStudyPackLink, SharedStudyPackVisibility, StudyPack } from '../models';
import { listCommunityClasses } from '../services/community';
import {
  createSharedStudyPack,
  isSharingBackendConfigured,
  loadStoredShareLink,
  markShareLinkRevoked,
  revokeSharedStudyPack,
  shareMessageFor,
  storeShareLink,
} from '../services/sharing';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';
import { Card, Icon, Pill, PrimaryButton } from './ui';
import type { IconName } from './ui';

const VISIBILITIES: Array<{ id: SharedStudyPackVisibility; title: string; detail: string; icon: IconName }> = [
  { id: 'private', title: 'Private', detail: 'Only me', icon: 'lock-outline' },
  { id: 'link', title: 'Anyone with link', detail: 'People with the link can view and import it', icon: 'link-variant' },
  { id: 'public', title: 'Public', detail: 'Eligible to appear in Discover', icon: 'earth' },
];

export function StudyPackShareSheet({ deck, visible, onClose, onRequireAuth }: { deck: StudyPack; visible: boolean; onClose: () => void; onRequireAuth?: () => void }) {
  const { colors, recordStudyEvent } = useStudyBolt();
  const { user, getAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<SharedStudyPackLink | null>(null);
  const [visibility, setVisibility] = useState<SharedStudyPackVisibility>('private');
  const [classes, setClasses] = useState<CommunityClass[]>([]);
  const [classId, setClassId] = useState<string>();
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
      setVisibility(stored?.visibility ?? 'private');
      setClassId(stored?.classId);
      setBusy(false);
    });
    if (user && isSharingBackendConfigured) {
      void listCommunityClasses({ limit: 8 }).then((classResult) => setClasses(classResult.data.filter((item) => item.joined)));
    } else setClasses([]);
  }, [deck.id, user, visible]);

  const creatorDisplayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? 'StudyBolt student';

  const saveVisibility = async (): Promise<SharedStudyPackLink | null> => {
    if (!user) {
      setError('Sign in to share or publish a Study Pack.');
      return null;
    }
    if (visibility === 'private' && !link) {
      onClose();
      return null;
    }
    if (!isSharingBackendConfigured && link && link.visibility === visibility && link.classId === classId) return link;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Your session expired. Sign in again to manage sharing.');
      return null;
    }
    setBusy(true);
    setError(null);
    const result = await createSharedStudyPack(deck, accessToken, visibility, {
      creatorDisplayName,
      ...(visibility === 'public' && classId ? { classId } : {}),
    });
    setBusy(false);
    if (result.error || !result.link) {
      setError(result.error ?? 'StudyBolt could not update sharing.');
      return null;
    }
    const firstShare = !link;
    await storeShareLink(result.link);
    setLink(result.link);
    if (firstShare && visibility !== 'private') recordStudyEvent({ type: 'share-link-created', deckId: deck.id, courseId: deck.courseId });
    return result.link;
  };

  const openNativeShare = async () => {
    if (visibility === 'private') {
      setError('Choose “Anyone with link” or “Public” before sharing.');
      return;
    }
    const nextLink = await saveVisibility();
    if (!nextLink) return;
    recordStudyEvent({ type: 'share-sheet-opened', deckId: deck.id, courseId: deck.courseId });
    try {
      await Share.share({ message: shareMessageFor(deck, nextLink.url), title: deck.title, url: nextLink.url });
    } catch {
      setError('Could not open the share sheet. Please try again.');
    }
  };

  const copyLink = async () => {
    if (visibility === 'private') return;
    const nextLink = await saveVisibility();
    if (!nextLink) return;
    try {
      await Clipboard.setStringAsync(nextLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Could not copy the link. Try the native share sheet instead.');
    }
  };

  const stopSharing = async () => {
    if (!link) return;
    const accessToken = await getAccessToken();
    if (!accessToken) return setError('Sign in again to stop sharing.');
    setBusy(true);
    const result = await revokeSharedStudyPack(link.token, accessToken);
    setBusy(false);
    if (result.error) return setError(result.error);
    await markShareLinkRevoked(link);
    setLink(null);
    setVisibility('private');
    setClassId(undefined);
    setError(null);
  };

  const confirmStopSharing = () => {
    if (Platform.OS === 'web') return void stopSharing();
    Alert.alert('Stop sharing this Study Pack?', 'The current link will stop working and it will leave Discover.', [
      { text: 'Keep sharing', style: 'cancel' },
      { text: 'Stop sharing', style: 'destructive', onPress: () => void stopSharing() },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.34)' }]}>
        <Pressable accessibilityLabel="Close share dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: colors.primarySoft }]}><Icon name="share-variant" size={23} color={colors.primary} /></View>
            <View style={styles.headingCopy}><Text style={[styles.title, { color: colors.text }]}>Share Study Pack</Text><Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{deck.title}</Text></View>
            <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.closeButton}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.privacyCard, { backgroundColor: colors.mintSoft }]}><Icon name="shield-check-outline" size={20} color={colors.mint} /><View style={styles.privacyCopy}><Text style={[styles.privacyTitle, { color: colors.text }]}>Your progress stays private</Text><Text style={[styles.privacyText, { color: colors.textSecondary }]}>Only generated notes, cards, quiz content, and quick review are copied. Source files, history, and mastery are excluded.</Text></View></View>

            {!user ? <Notice icon="account-lock-outline" text="Sign in to create and manage sharing." tone="primary" /> : null}
            {!isSharingBackendConfigured ? <Notice icon="cloud-alert-outline" text="Sharing needs the secure StudyBolt backend connection." tone="neutral" /> : null}
            {error ? <Notice icon="alert-circle-outline" text={error} tone="danger" /> : null}

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>VISIBILITY</Text>
            <View style={styles.visibilityList}>
              {VISIBILITIES.map((item) => {
                const selected = visibility === item.id;
                return (
                  <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setVisibility(item.id)} style={[styles.visibility, { backgroundColor: selected ? colors.primarySoft : colors.cardStrong, borderColor: selected ? colors.primary : colors.border }]}>
                    <View style={[styles.visibilityIcon, { backgroundColor: colors.card }]}><Icon name={item.icon} size={20} color={selected ? colors.primary : colors.textMuted} /></View>
                    <View style={styles.visibilityCopy}><Text style={[styles.visibilityTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.visibilityDetail, { color: colors.textSecondary }]}>{item.detail}</Text></View>
                    <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
                  </Pressable>
                );
              })}
            </View>

            {visibility === 'public' ? (
              <View style={styles.classSection}>
                <View style={styles.classHeading}><Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>CLASS · OPTIONAL</Text>{classId ? <Pressable onPress={() => setClassId(undefined)}><Text style={[styles.clearClass, { color: colors.primary }]}>Clear</Text></Pressable> : null}</View>
                {classes.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
                    {classes.map((item) => {
                      const selected = classId === item.id;
                      return <Pressable key={item.id} onPress={() => setClassId(item.id)} style={[styles.classChip, { backgroundColor: selected ? colors.mintSoft : colors.cardStrong, borderColor: selected ? colors.mint : colors.border }]}><Text style={[styles.classChipCode, { color: selected ? colors.mint : colors.text }]}>{item.courseCode}</Text><Text numberOfLines={1} style={[styles.classChipName, { color: colors.textMuted }]}>{item.courseName}</Text></Pressable>;
                    })}
                  </ScrollView>
                ) : <Text style={[styles.classEmpty, { color: colors.textMuted }]}>Join a class in Discover to associate this public set.</Text>}
              </View>
            ) : null}

            {link && visibility !== 'private' ? (
              <Card style={[styles.activeCard, { backgroundColor: colors.backgroundRaised }]}>
                <View style={styles.activeTop}><View style={[styles.activeIcon, { backgroundColor: visibility === 'public' ? colors.purpleSoft : colors.mintSoft }]}><Icon name={visibility === 'public' ? 'earth' : 'link-variant'} size={19} color={visibility === 'public' ? colors.purple : colors.mint} /></View><View style={styles.activeCopy}><View style={styles.activeLabelRow}><Text style={[styles.activeTitle, { color: colors.text }]}>{visibility === 'public' ? 'Public set' : 'Link active'}</Text><Pill label={visibility === 'public' ? 'Discover eligible' : 'Anyone with link'} tone={visibility === 'public' ? 'purple' : 'mint'} /></View><Text numberOfLines={1} style={[styles.linkText, { color: colors.textMuted }]}>{link.url}</Text></View></View>
                <View style={styles.actionRow}><Pressable onPress={() => void copyLink()} style={[styles.secondaryAction, { backgroundColor: colors.primarySoft }]}><Icon name="content-copy" size={18} color={colors.primary} /><Text style={[styles.secondaryActionText, { color: colors.primary }]}>{copied ? 'Copied' : 'Copy link'}</Text></Pressable><Pressable onPress={() => void openNativeShare()} style={[styles.secondaryAction, { backgroundColor: colors.cardStrong }]}><Icon name="share-variant" size={18} color={colors.textSecondary} /><Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>Share</Text></Pressable></View>
              </Card>
            ) : null}
          </ScrollView>

          <PrimaryButton
            label={!user ? 'Sign in to share' : visibility === 'private' ? link ? 'Save as private' : 'Keep private' : link ? 'Save & share' : 'Create & share'}
            icon={!user ? 'account-arrow-right-outline' : visibility === 'private' ? 'lock-outline' : 'share-variant'}
            onPress={() => !user ? onRequireAuth?.() : visibility === 'private' ? void saveVisibility() : void openNativeShare()}
            loading={busy}
            disabled={!user ? !onRequireAuth : (!isSharingBackendConfigured && Boolean(link) === false)}
            style={styles.primaryAction}
          />
          {link ? <Pressable disabled={busy} onPress={confirmStopSharing} style={styles.stopAction}><Icon name="link-off" size={17} color={colors.danger} /><Text style={[styles.stopText, { color: colors.danger }]}>Disable current share link</Text></Pressable> : null}
        </View>
      </View>
    </Modal>
  );
}

function Notice({ icon, text, tone }: { icon: IconName; text: string; tone: 'primary' | 'neutral' | 'danger' }) {
  const { colors } = useStudyBolt();
  const color = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.primary : colors.textMuted;
  const background = tone === 'danger' ? `${colors.danger}14` : tone === 'primary' ? colors.primarySoft : colors.cardStrong;
  return <View style={[styles.notice, { backgroundColor: background }]}><Icon name={icon} size={19} color={color} /><Text style={[styles.noticeText, { color: tone === 'danger' ? colors.danger : colors.textSecondary }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '94%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, marginBottom: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { width: 34, height: 34, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { marginTop: 11 },
  scrollContent: { paddingBottom: 6 },
  privacyCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: radius.md },
  privacyCopy: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 12, fontWeight: '900' },
  privacyText: { fontSize: 10, lineHeight: 15 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 13, marginTop: 9 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  sectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  visibilityList: { gap: 8 },
  visibility: { minHeight: 62, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9 },
  visibilityIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { fontSize: 12, fontWeight: '900' },
  visibilityDetail: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  classSection: { marginTop: 1 },
  classHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  clearClass: { fontSize: 9, fontWeight: '900' },
  classChips: { gap: 8 },
  classChip: { width: 125, minHeight: 54, borderRadius: 14, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 11 },
  classChipCode: { fontSize: 11, fontWeight: '900' },
  classChipName: { fontSize: 8, marginTop: 3 },
  classEmpty: { fontSize: 9, lineHeight: 14 },
  activeCard: { marginTop: 14, padding: 13 },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeCopy: { flex: 1, minWidth: 0 },
  activeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeTitle: { fontSize: 12, fontWeight: '900' },
  linkText: { fontSize: 9, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryAction: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryActionText: { fontSize: 11, fontWeight: '900' },
  primaryAction: { marginTop: 10 },
  stopAction: { alignSelf: 'center', minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stopText: { fontSize: 10, fontWeight: '800' },
});
