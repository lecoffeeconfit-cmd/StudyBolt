import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Pill, PrimaryButton, ProgressBar } from '../components/ui';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack } from '../models';
import { documentIcon, documentTypeLabel, getImportDocumentType } from '../services/documentTypes';
import { processDocument, StudyBoltProcessingError, validateImport } from '../services/documentProcessor';
import { useAuth } from '../AuthContext';

const STAGES = [
  'Uploading your material',
  'Reading your source',
  'Finding important concepts',
  'Building simplified and detailed notes',
  'Creating flashcards, quiz, and full test',
  'Preparing audio review',
];

export function ProcessingScreen({ asset, courseId, courseName, onCancel, onSuccess, onTrySample }: { asset: ImportAsset; courseId?: string; courseName?: string; onCancel: () => void; onSuccess: (deck: StudyPack) => void; onTrySample: () => void }) {
  const { colors } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const importDocumentType = getImportDocumentType(asset.name, asset.mimeType);
  const importLabel = importDocumentType ? documentTypeLabel(importDocumentType) : 'document';
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [className, setClassName] = useState(courseName ?? '');
  const [started, setStarted] = useState(Boolean(courseName));
  const [attempt, setAttempt] = useState(0);
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
    setStage(0);
    setError(null);
    setNameError(null);
    setAttempt(0);
  }, [asset, courseName]);

  useEffect(() => {
    if (!started) return;
    let mounted = true;
    let ticker: ReturnType<typeof setInterval> | null = null;
    try {
      validateImport(asset);
      ticker = setInterval(() => setStage((value) => Math.min(STAGES.length - 1, value + 1)), 1100);
      void getAccessToken()
        .then((accessToken) => processDocument(asset, className.trim(), accessToken))
        .then((deck) => {
          if (!mounted) return;
          onSuccess({
            ...deck,
            ...(courseId ? { courseId } : {}),
            ...(className.trim() ? { courseName: className.trim() } : {}),
          });
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
      if (ticker) clearInterval(ticker);
    };
  }, [asset, attempt, className, courseId, getAccessToken, onSuccess, started]);

  const retryProcessing = () => {
    setError(null);
    setStage(0);
    setStarted(true);
    setAttempt((value) => value + 1);
  };

  const startProcessing = () => {
    const name = className.trim();
    if (!name) {
      setNameError('Add a class name to continue.');
      return;
    }
    setNameError(null);
    setError(null);
    setStarted(true);
  };

  const progress = ((stage + 1) / STAGES.length) * 92;
  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.closeButton}><Icon name="close" size={26} color={colors.text} /></Pressable>
        <Pill label="PRIVATE PROCESSING" tone="mint" />
        <View style={styles.closeButton} />
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.boltOrb, !started && !error && styles.setupBoltOrb, { backgroundColor: error ? `${colors.danger}18` : colors.goldSoft, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
          <View style={[styles.boltInner, !started && !error && styles.setupBoltInner, { backgroundColor: error ? colors.danger : colors.goldBright }]}>
            <Icon name={error ? 'alert-outline' : 'lightning-bolt'} size={!started && !error ? 32 : 50} color={error ? '#FFFFFF' : colors.onGold} />
          </View>
        </Animated.View>

        {error ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>We couldn’t build that Study Pack</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{error}</Text>
            <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={importDocumentType ? documentIcon(importDocumentType) : 'file-document-outline'} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>{asset.name}</Text>
              <Icon name="shield-check-outline" color={colors.mint} />
            </View>
            <PrimaryButton label="Try again" icon="refresh" onPress={retryProcessing} style={styles.action} />
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
            <Text style={[styles.description, { color: colors.textSecondary }]}>Your {importLabel} will be turned into one organized Study Pack inside this class.</Text>
            <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={importDocumentType ? documentIcon(importDocumentType) : 'file-document-outline'} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>{asset.name}</Text>
              <Icon name="shield-check-outline" color={colors.mint} />
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
            <PrimaryButton label="Build my Study Pack" icon="creation" onPress={startProcessing} style={styles.action} />
            <Pressable onPress={onCancel} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Choose another file</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Building your Study Pack</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>One upload creates layered notes, flashcards, practice quiz, full test, and audio review together.</Text>
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress} />
              <Text style={[styles.progressLabel, { color: colors.primary }]}>{Math.round(progress)}%</Text>
            </View>
            <View style={[styles.stageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {STAGES.map((label, index) => {
                const complete = index < stage;
                const current = index === stage;
                return (
                  <View key={label} style={styles.stageRow}>
                    <View style={[styles.stageIcon, { backgroundColor: complete ? colors.mintSoft : current ? colors.goldSoft : colors.cardStrong }]}>
                      <Icon name={complete ? 'check' : current ? 'lightning-bolt' : 'circle-small'} size={17} color={complete ? colors.mint : current ? colors.goldText : colors.textMuted} />
                    </View>
                    <Text style={[styles.stageText, { color: current ? colors.text : colors.textMuted, fontWeight: current ? '800' : '500' }]}>{label}</Text>
                    {current ? <Text style={[styles.working, { color: colors.goldText }]}>Working…</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
      <Text style={[styles.privacy, { color: colors.textMuted }]}><Icon name="lock-outline" size={12} color={colors.textMuted} /> Your class material is treated as private content.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  boltOrb: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  boltInner: { width: 83, height: 83, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  setupBoltOrb: { width: 86, height: 86, borderRadius: 43, marginBottom: 18 },
  setupBoltInner: { width: 60, height: 60, borderRadius: 30 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 330 },
  progressWrap: { width: '100%', marginTop: 27 },
  progressLabel: { alignSelf: 'flex-end', marginTop: 7, fontSize: 11, fontWeight: '800' },
  stageCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 19, padding: 16, gap: 12, marginTop: 15 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stageText: { flex: 1, fontSize: 12 },
  working: { fontSize: 9, fontWeight: '800' },
  fileCard: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 22 },
  fileName: { flex: 1, fontSize: 12, fontWeight: '700' },
  inputLabel: { alignSelf: 'flex-start', fontSize: 11, lineHeight: 14, fontWeight: '800', marginTop: 19, marginBottom: 7, marginLeft: 2 },
  inputWrap: { width: '100%', minHeight: 54, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 52, fontSize: 14 },
  nameError: { alignSelf: 'flex-start', fontSize: 11, marginTop: 6, marginLeft: 2 },
  action: { width: '100%', marginTop: 18 },
  secondaryAction: { padding: 13 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  privacy: { textAlign: 'center', fontSize: 10 },
});
