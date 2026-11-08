import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Pill, PrimaryButton } from '../components/ui';
import { LoadingArtwork } from '../components/StudyBoltLoading';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack } from '../models';
import { documentIcon, documentTypeLabel, getImportDocumentType } from '../services/documentTypes';
import { processDocument, type DocumentProcessPhase, StudyBoltProcessingError, validateImport, validateImportBatch } from '../services/documentProcessor';
import { combineImportedPowerPoints } from '../services/studyPack';
import { fetchTutorQuota } from '../services/aiTutor';
import { canUseRevenueCat, syncRevenueCatEntitlement } from '../services/subscriptions';
import { useAuth } from '../AuthContext';
import { LEGAL_URLS } from '../config/legal';

export function ProcessingScreen({ assets, courseId, courseName, onCancel, onSuccess, onTrySample, onRequireAuth }: { assets: ImportAsset[]; courseId?: string; courseName?: string; onCancel: () => void; onSuccess: (deck: StudyPack) => void; onTrySample: () => void; onRequireAuth: (className: string) => void }) {
  const { colors } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [processedPacks, setProcessedPacks] = useState<StudyPack[]>([]);
  const processedPacksRef = useRef<StudyPack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const asset: ImportAsset = assets[currentIndex] ?? assets[0] ?? { name: 'study material', uri: '' };
  const importDocumentType = getImportDocumentType(asset.name, asset.mimeType);
  const importLabel = importDocumentType ? documentTypeLabel(importDocumentType) : 'document';
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [className, setClassName] = useState(courseName ?? '');
  const [cloudConsent, setCloudConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<DocumentProcessPhase>('validating');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    setClassName(courseName ?? '');
    setStarted(false);
    setCloudConsent(false);
    setError(null);
    setAuthRequired(false);
    setNameError(null);
    setAttempt(0);
    startedAt.current = courseName ? Date.now() : null;
    setElapsedSeconds(0);
    setPhase('validating');
    setProcessedPacks([]);
    processedPacksRef.current = [];
    setCurrentIndex(0);
  }, [assets, courseName]);

  useEffect(() => {
    if (!started || error || !startedAt.current) return;
    const updateElapsed = () => {
      if (startedAt.current) setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [error, started]);

  useEffect(() => {
    if (!started) return;
    let mounted = true;
    try {
      validateImportBatch(assets);
      validateImport(asset);
      void getAccessToken()
        .then(async (accessToken) => {
          if (!mounted) return undefined;
          if (!accessToken) {
            if (mounted) {
              setAuthRequired(true);
              setError('Sign in to securely process and save this study material.');
            }
            return undefined;
          }
          if (getImportDocumentType(asset.name, asset.mimeType) === 'powerpoint' && canUseRevenueCat()) {
            const subscriptionStatus = await syncRevenueCatEntitlement(accessToken);
            if (!mounted) return undefined;
            if (subscriptionStatus.error && subscriptionStatus.status !== 'throttled') {
              setError(subscriptionStatus.error);
              return undefined;
            }
          }
          if (assets.length > 1) {
            const membership = await fetchTutorQuota(accessToken);
            if (!mounted) return undefined;
            if (membership.quota?.plan !== 'premium') {
              setError(membership.quota
                ? 'Free accounts can import one PowerPoint each month. Choose one presentation or subscribe to import more.'
                : 'StudyBolt could not confirm your plan. Please try importing one PowerPoint at a time.');
              return undefined;
            }
          }
          return processDocument(asset, className.trim(), accessToken, (nextPhase) => {
            if (mounted) setPhase(nextPhase);
          });
        })
        .then((deck) => {
          if (!mounted || !deck) return;
          const preparedDeck = {
            ...deck,
            ...(courseId ? { courseId } : {}),
            ...(className.trim() ? { courseName: className.trim() } : {}),
          };
          const completedPacks = [...processedPacksRef.current, preparedDeck];
          processedPacksRef.current = completedPacks;
          setProcessedPacks(completedPacks);
          if (currentIndex + 1 < assets.length) {
            setCurrentIndex(currentIndex + 1);
            setPhase('validating');
            return;
          }
          const finalDeck = completedPacks.length === 1
            ? preparedDeck
            : combineImportedPowerPoints(
              completedPacks,
              courseId ?? preparedDeck.courseId,
              className.trim() || courseName || preparedDeck.courseName,
            );
          onSuccess(finalDeck);
        })
        .catch((reason: unknown) => {
          if (!mounted) return;
          const message = reason instanceof StudyBoltProcessingError
            ? reason.userMessage
            : 'StudyBolt could not process this file. No study pack was created.';
          setError(message);
        });
    } catch (reason) {
      const message = reason instanceof StudyBoltProcessingError ? reason.userMessage : 'Choose a PDF, PowerPoint, or notes file and try again.';
      setError(message);
    }
    return () => {
      mounted = false;
    };
  }, [assets, asset, attempt, className, courseId, courseName, currentIndex, getAccessToken, onRequireAuth, onSuccess, started]);

  const retryProcessing = () => {
    setError(null);
    setAuthRequired(false);
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    setPhase('validating');
    setStarted(true);
    setAttempt((value) => value + 1);
  };

  const startProcessing = () => {
    if (!cloudConsent) return;
    const name = className.trim();
    if (!name) {
      setNameError('Add a class name to continue.');
      return;
    }
    try {
      validateImportBatch(assets);
    } catch (reason) {
      const message = reason instanceof StudyBoltProcessingError ? reason.userMessage : 'Choose valid PowerPoint files and try again.';
      setError(message);
      return;
    }
    setNameError(null);
    setError(null);
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    setPhase('validating');
    setStarted(true);
  };

  const processingMessage = phase === 'validating' ? 'Checking your selected file…'
    : phase === 'finalizing' ? 'Finishing your Study Pack…'
      : `Sending your ${importLabel} for processing…`;
  const allSourcesProcessed = assets.length > 1 && processedPacks.length === assets.length;
  const mustChooseSinglePowerPoint = assets.length > 1 && Boolean(error?.includes('one PowerPoint'));
  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel import" onPress={onCancel} hitSlop={12} style={styles.closeButton}><Icon name="close" size={26} color={colors.text} /></Pressable>
        <Pill label="PRIVATE PROCESSING" tone="mint" />
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={styles.center}
        contentContainerStyle={styles.centerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {started && !error ? <View style={{ marginBottom: 24 }}><LoadingArtwork variant="documentProcessing" colors={colors} /></View> : <View style={[styles.boltOrb, !started && !error && styles.setupBoltOrb, { backgroundColor: error ? `${colors.danger}18` : colors.goldSoft }]}>
          <View style={[styles.boltInner, !started && !error && styles.setupBoltInner, { backgroundColor: error ? colors.danger : colors.goldBright }]}>
            <Icon name={error ? 'alert-outline' : 'lightning-bolt'} size={!started && !error ? 32 : 50} color={error ? '#FFFFFF' : colors.onGold} />
          </View>
        </View>}

        {error ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>We couldn’t build that Study Pack</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{assets.length > 1 && processedPacks.length > 0 && !allSourcesProcessed ? `${error} ${processedPacks.length} of ${assets.length} PowerPoints are ready; retry continues with this presentation.` : error}</Text>
            <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={importDocumentType ? documentIcon(importDocumentType) : 'file-document-outline'} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>{asset.name}</Text>
              <Icon name="shield-check-outline" color={colors.mint} />
            </View>
            {allSourcesProcessed
              ? <PrimaryButton label="Choose fewer presentations" icon="layers-triple-outline" onPress={onCancel} style={styles.action} />
              : mustChooseSinglePowerPoint
                ? <PrimaryButton label="Choose one PowerPoint" icon="file-presentation-box" onPress={onCancel} style={styles.action} />
              : authRequired
                ? <PrimaryButton label="Sign in to continue" icon="account-outline" onPress={() => onRequireAuth(className.trim())} style={styles.action} />
                : <PrimaryButton label={assets.length > 1 ? 'Retry this PowerPoint' : 'Try again'} icon="refresh" onPress={retryProcessing} style={styles.action} />}
            <Pressable accessibilityRole="button" onPress={onTrySample} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.primary }]}>Explore the sample Study Pack</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel import" onPress={onCancel} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Choose another file</Text>
            </Pressable>
          </>
        ) : !started ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Name this class</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{assets.length > 1 ? `${assets.length} PowerPoints will become one integrated Study Pack with connected notes, recall cards, and mixed practice.` : `Your ${importLabel} will be turned into one organized Study Pack inside this class.`}</Text>
            {assets.length > 1 ? (
              <View style={[styles.selectedFilesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.selectedFilesTitle, { color: colors.textSecondary }]}>PRESENTATIONS IN THIS STUDY SET</Text>
                {assets.map((item, index) => (
                  <View key={`${item.uri}-${index}`} style={styles.selectedFileRow}>
                    <Icon name="microsoft-powerpoint" size={16} color={colors.primary} />
                    <Text numberOfLines={1} style={[styles.selectedFileName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.selectedFileIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }] }>
                <Icon name={importDocumentType ? documentIcon(importDocumentType) : 'file-document-outline'} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>{asset.name}</Text>
                <Icon name="shield-check-outline" color={colors.mint} />
              </View>
            )}
            <View style={[styles.disclosureCard, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
              <Text style={[styles.disclosure, { color: colors.textSecondary }]}>To build this Study Pack, StudyBolt sends the selected file and class name to its secure server and OpenAI for processing. Don’t upload sensitive or confidential information unless you’re allowed to share it.</Text>
              <Pressable aria-checked={cloudConsent}
                accessibilityRole="checkbox"
                accessibilityLabel="I agree to send this study material to StudyBolt and OpenAI for processing"
                accessibilityState={{ checked: cloudConsent }}
                onPress={() => setCloudConsent((value) => !value)}
                style={styles.consentRow}
              >
                <View style={[styles.consentCheck, { backgroundColor: cloudConsent ? colors.primary : colors.card, borderColor: cloudConsent ? colors.primary : colors.border }]}>
                  {cloudConsent ? <Icon name="check" size={14} color={colors.primaryText} /> : null}
                </View>
                <Text style={[styles.consentText, { color: colors.text }]}>I understand and agree to cloud processing.</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(LEGAL_URLS.privacyPolicy).catch(() => undefined); }} style={styles.privacyLink}>
                <Text style={[styles.privacyLinkText, { color: colors.primary }]}>Read the Privacy Policy</Text>
              </Pressable>
            </View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Class name</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: nameError ? colors.danger : colors.border }]}>
              <Icon name="school-outline" size={19} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Class name"
                autoFocus
                value={className}
                onChangeText={(value) => { setClassName(value); setNameError(null); }}
                onSubmitEditing={startProcessing}
                placeholder="e.g. Anatomy & Physiology"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[styles.input, { color: colors.text }]}
              />
            </View>
            {nameError ? <Text style={[styles.nameError, { color: colors.danger }]}>{nameError}</Text> : null}
            <PrimaryButton label={assets.length > 1 ? 'Build integrated Study Pack' : 'Build my Study Pack'} icon="creation" onPress={startProcessing} disabled={!cloudConsent} style={styles.action} />
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel import" onPress={onCancel} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Choose another file</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{assets.length > 1 ? 'Building your integrated Study Pack' : 'Building your Study Pack'}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{assets.length > 1 ? `Processing presentation ${currentIndex + 1} of ${assets.length} in order. We’ll combine their topics into one source-linked set of notes, recall cards, and mixed practice.` : 'We’re securely extracting your source once. Your Study Pack will open as soon as that source is ready.'}</Text>
            <View accessibilityRole="progressbar" accessibilityLabel={processingMessage} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.activityHeader}>
                <View style={[styles.stageIcon, { backgroundColor: colors.primarySoft }]}><Icon name="shield-check-outline" size={17} color={colors.primary} /></View>
                <View style={styles.activityHeaderCopy}>
                  <Text style={[styles.activityTitle, { color: colors.text }]}>Live activity</Text>
                  <Text style={[styles.activitySubtitle, { color: colors.textMuted }]}>Secure processing · {formatElapsed(elapsedSeconds)}</Text>
                </View>
                <Text style={[styles.working, { color: colors.goldText }]}>Private</Text>
              </View>
              <View style={styles.activityRows}>
                <ProcessingStepRow label={assets.length > 1 ? 'Selected study set' : 'Selected source'} detail={assets.length > 1 ? `${assets.length} presentations selected · ${processedPacks.length} ready` : asset.name} state="done" colors={colors} />
                <ProcessingStepRow label={processingMessage} detail={phase === 'finalizing' ? 'Response received · finishing up' : 'Secure request in progress'} state="active" colors={colors} />
                <ProcessingStepRow label="Build study materials" detail="Notes, cards, quiz, and audio follow next" state="queued" colors={colors} />
              </View>
              {assets.length > 1 ? (
                <View style={styles.sourceList}>
                  {assets.map((item, index) => {
                    const complete = index < processedPacks.length;
                    const active = index === currentIndex;
                    return (
                      <View key={`${item.uri}-${index}`} style={styles.selectedFileRow}>
                        <View style={[styles.sourceStatus, { backgroundColor: complete ? colors.mintSoft : active ? colors.goldSoft : colors.cardStrong }]}>
                          <Icon name={complete ? 'check' : active ? 'circle-small' : 'clock-outline'} size={13} color={complete ? colors.mint : active ? colors.primary : colors.textMuted} />
                        </View>
                        <Text numberOfLines={1} style={[styles.selectedFileName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.selectedFileIndex, { color: complete ? colors.mint : colors.textMuted }]}>{complete ? 'Ready' : active ? 'Working' : 'Next'}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
            {elapsedSeconds >= 30 ? <Text style={[styles.description, { color: colors.textSecondary, marginTop: 14 }]}>This request is taking a little longer. You can keep waiting here or close this screen to leave the import.</Text> : null}
          </>
        )}
      </ScrollView>
      <Text style={[styles.privacy, { color: colors.textMuted }]}><Icon name="lock-outline" size={12} color={colors.textMuted} /> Your class material is treated as private content.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1 },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  boltOrb: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  boltInner: { width: 83, height: 83, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  setupBoltOrb: { width: 86, height: 86, borderRadius: 43, marginBottom: 18 },
  setupBoltInner: { width: 60, height: 60, borderRadius: 30 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 330 },
  activityCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 19, padding: 14, marginTop: 15, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityHeaderCopy: { flex: 1 },
  activityTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  activitySubtitle: { fontSize: 16, lineHeight: 24, marginTop: 2, fontWeight: '700' },
  activityRows: { marginTop: 11, gap: 8 },
  stageIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  working: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  activityRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 9 },
  activityStatus: { width: 23, height: 23, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activityRowCopy: { flex: 1 },
  activityRowLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  activityRowDetail: { fontSize: 14, lineHeight: 21, marginTop: 1 },
  fileCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 22 },
  fileName: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  selectedFilesCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, gap: 8, padding: 14, marginTop: 22 },
  selectedFilesTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', letterSpacing: 0.7, marginBottom: 2 },
  selectedFileRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedFileName: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  selectedFileIndex: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sourceList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128, 145, 165, 0.24)', marginTop: 12, paddingTop: 10, gap: 7 },
  sourceStatus: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { alignSelf: 'flex-start', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 19, marginBottom: 7, marginLeft: 2 },
  inputWrap: { width: '100%', minHeight: 54, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 52, fontSize: 14 },
  nameError: { alignSelf: 'flex-start', fontSize: 14, lineHeight: 21, marginTop: 6, marginLeft: 2 },
  action: { width: '100%', marginTop: 18 },
  secondaryAction: { padding: 13 },
  secondaryText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  disclosureCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 13, marginTop: 13 },
  disclosure: { fontSize: 14, lineHeight: 21 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11, paddingVertical: 4 },
  consentCheck: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  consentText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  privacyLink: { alignSelf: 'flex-start', paddingVertical: 6, marginLeft: 30 },
  privacyLinkText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  privacy: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
});

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function ProcessingStepRow({ label, detail, state, colors }: {
  label: string;
  detail: string;
  state: 'done' | 'active' | 'queued';
  colors: ReturnType<typeof useStudyBolt>['colors'];
}) {
  const icon = state === 'done' ? 'check' : state === 'active' ? 'circle-small' : 'clock-outline';
  const iconColor = state === 'done' ? colors.mint : state === 'active' ? colors.goldText : colors.textMuted;
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityStatus, { backgroundColor: state === 'done' ? colors.mintSoft : state === 'active' ? colors.goldSoft : colors.cardStrong }]}>
        <Icon name={state === 'active' ? 'circle-small' : icon} size={14} color={iconColor} />
      </View>
      <View style={styles.activityRowCopy}>
        <Text style={[styles.activityRowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.activityRowDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Text style={[styles.working, { color: state === 'done' ? colors.mint : state === 'active' ? colors.goldText : colors.textMuted }]}>{state === 'done' ? 'Done' : state === 'active' ? 'Working' : 'Next'}</Text>
    </View>
  );
}
