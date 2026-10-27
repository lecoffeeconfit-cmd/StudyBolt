import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Pill, PrimaryButton } from '../components/ui';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack } from '../models';
import { documentIcon, documentTypeLabel, getImportDocumentType } from '../services/documentTypes';
import { processDocument, type DocumentProcessPhase, StudyBoltProcessingError, validateImport, validateImportBatch } from '../services/documentProcessor';
import { combineImportedPowerPoints } from '../services/studyPack';
import { useAuth } from '../AuthContext';

export function ProcessingScreen({ assets, courseId, courseName, onCancel, onSuccess, onTrySample, onRequireAuth }: { assets: ImportAsset[]; courseId?: string; courseName?: string; onCancel: () => void; onSuccess: (deck: StudyPack) => void; onTrySample: () => void; onRequireAuth: () => void }) {
  const { colors } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const reducedMotion = useReducedMotion();
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
  const [started, setStarted] = useState(Boolean(courseName));
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<DocumentProcessPhase>('validating');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (!started || error || reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [error, pulse, reducedMotion, started]);

  useEffect(() => {
    setClassName(courseName ?? '');
    setStarted(Boolean(courseName));
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
        .then((accessToken) => {
          if (!accessToken) {
            if (mounted) {
              setAuthRequired(true);
              setError('Sign in to securely process and save this study material.');
            }
            return undefined;
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

  const processingMessage = importDocumentType === 'powerpoint'
    ? 'Processing slides…'
    : importDocumentType === 'pdf' ? 'Processing your PDF…' : 'Processing your notes…';
  const allSourcesProcessed = assets.length > 1 && processedPacks.length === assets.length;
  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.closeButton}><Icon name="close" size={26} color={colors.text} /></Pressable>
        <Pill label="PRIVATE PROCESSING" tone="mint" />
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={styles.center}
        contentContainerStyle={styles.centerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.boltOrb, !started && !error && styles.setupBoltOrb, { backgroundColor: error ? `${colors.danger}18` : colors.goldSoft, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
          <View style={[styles.boltInner, !started && !error && styles.setupBoltInner, { backgroundColor: error ? colors.danger : colors.goldBright }]}>
            <Icon name={error ? 'alert-outline' : 'lightning-bolt'} size={!started && !error ? 32 : 50} color={error ? '#FFFFFF' : colors.onGold} />
          </View>
        </Animated.View>

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
              : authRequired
                ? <PrimaryButton label="Sign in to continue" icon="account-outline" onPress={onRequireAuth} style={styles.action} />
                : <PrimaryButton label={assets.length > 1 ? 'Retry this PowerPoint' : 'Try again'} icon="refresh" onPress={retryProcessing} style={styles.action} />}
            <Pressable onPress={onTrySample} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.primary }]}>Explore the sample Study Pack</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.secondaryAction}>
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
            <PrimaryButton label={assets.length > 1 ? 'Build integrated Study Pack' : 'Build my Study Pack'} icon="creation" onPress={startProcessing} style={styles.action} />
            <Pressable onPress={onCancel} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Choose another file</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{assets.length > 1 ? 'Building your integrated Study Pack' : 'Building your Study Pack'}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{assets.length > 1 ? `Processing presentation ${currentIndex + 1} of ${assets.length} in order. We’ll combine their topics into one source-linked set of notes, recall cards, and mixed practice.` : 'We’re securely extracting your source once. Your Study Pack will open as soon as that source is ready.'}</Text>
            <View accessibilityLiveRegion="polite" style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.activityHeader}>
                <View style={[styles.stageIcon, { backgroundColor: colors.goldSoft }]}><ActivityIndicator size="small" color={colors.goldText} /></View>
                <View style={styles.activityHeaderCopy}>
                  <Text style={[styles.activityTitle, { color: colors.text }]}>Live activity</Text>
                  <Text style={[styles.activitySubtitle, { color: colors.textMuted }]}>Secure processing · {formatElapsed(elapsedSeconds)}</Text>
                </View>
                <Text style={[styles.working, { color: colors.goldText }]}>Private</Text>
              </View>
              <View style={styles.activityRows}>
                <ProcessingStepRow label={assets.length > 1 ? 'Prepare the study set' : 'Check your source'} detail={assets.length > 1 ? `${assets.length} presentations selected · ${processedPacks.length} ready` : 'Format and size verified'} state="done" colors={colors} />
                <ProcessingStepRow label={processingMessage} detail={phase === 'finalizing' ? 'Response received · finishing up' : 'Secure request in progress'} state={phase === 'finalizing' ? 'done' : 'active'} colors={colors} />
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
                          {active && !complete ? <ActivityIndicator size="small" color={colors.goldText} /> : <Icon name={complete ? 'check' : 'clock-outline'} size={13} color={complete ? colors.mint : colors.textMuted} />}
                        </View>
                        <Text numberOfLines={1} style={[styles.selectedFileName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.selectedFileIndex, { color: complete ? colors.mint : colors.textMuted }]}>{complete ? 'Ready' : active ? 'Working' : 'Next'}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
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
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1 },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  boltOrb: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  boltInner: { width: 83, height: 83, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  setupBoltOrb: { width: 86, height: 86, borderRadius: 43, marginBottom: 18 },
  setupBoltInner: { width: 60, height: 60, borderRadius: 30 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 330 },
  activityCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 19, padding: 14, marginTop: 15, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityHeaderCopy: { flex: 1 },
  activityTitle: { fontSize: 12, fontWeight: '900' },
  activitySubtitle: { fontSize: 9, lineHeight: 14, marginTop: 2, fontWeight: '700' },
  activityRows: { marginTop: 11, gap: 8 },
  stageIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  working: { fontSize: 9, fontWeight: '800' },
  activityRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 9 },
  activityStatus: { width: 23, height: 23, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activityRowCopy: { flex: 1 },
  activityRowLabel: { fontSize: 10, fontWeight: '800' },
  activityRowDetail: { fontSize: 9, lineHeight: 12, marginTop: 1 },
  fileCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 22 },
  fileName: { flex: 1, fontSize: 12, fontWeight: '700' },
  selectedFilesCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, gap: 8, padding: 14, marginTop: 22 },
  selectedFilesTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 2 },
  selectedFileRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedFileName: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '700' },
  selectedFileIndex: { fontSize: 9, fontWeight: '800' },
  sourceList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128, 145, 165, 0.24)', marginTop: 12, paddingTop: 10, gap: 7 },
  sourceStatus: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { alignSelf: 'flex-start', fontSize: 11, lineHeight: 14, fontWeight: '800', marginTop: 19, marginBottom: 7, marginLeft: 2 },
  inputWrap: { width: '100%', minHeight: 54, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 52, fontSize: 14 },
  nameError: { alignSelf: 'flex-start', fontSize: 11, marginTop: 6, marginLeft: 2 },
  action: { width: '100%', marginTop: 18 },
  secondaryAction: { padding: 13 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  privacy: { textAlign: 'center', fontSize: 10 },
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
        {state === 'active' ? <ActivityIndicator size="small" color={iconColor} /> : <Icon name={icon} size={14} color={iconColor} />}
      </View>
      <View style={styles.activityRowCopy}>
        <Text style={[styles.activityRowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.activityRowDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Text style={[styles.working, { color: state === 'done' ? colors.mint : state === 'active' ? colors.goldText : colors.textMuted }]}>{state === 'done' ? 'Done' : state === 'active' ? 'Working' : 'Next'}</Text>
    </View>
  );
}
