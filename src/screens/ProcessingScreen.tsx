import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Pill, PrimaryButton, ProgressBar } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack } from '../models';
import { processDocument, StudyBoltProcessingError, validateImport } from '../services/documentProcessor';

const STAGES = [
  'Uploading slides',
  'Reading your lecture',
  'Finding important concepts',
  'Building simplified notes',
  'Creating flashcards and quiz',
  'Preparing audio review',
];

export function ProcessingScreen({ asset, onCancel, onSuccess, onTrySample }: { asset: ImportAsset; onCancel: () => void; onSuccess: (deck: StudyPack) => void; onTrySample: () => void }) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    let mounted = true;
    let ticker: ReturnType<typeof setInterval> | null = null;
    try {
      validateImport(asset);
      ticker = setInterval(() => setStage((value) => Math.min(STAGES.length - 1, value + 1)), 1100);
      processDocument(asset, 'New Course')
        .then((deck) => {
          if (mounted) onSuccess(deck);
        })
        .catch((reason: unknown) => {
          if (!mounted) return;
          const message = reason instanceof StudyBoltProcessingError
            ? reason.userMessage
            : 'StudyBolt could not process this file. No study pack was created.';
          setError(message);
        });
    } catch (reason) {
      const message = reason instanceof StudyBoltProcessingError ? reason.userMessage : 'Choose a PDF or PowerPoint file and try again.';
      setError(message);
    }
    return () => {
      mounted = false;
      if (ticker) clearInterval(ticker);
    };
  }, [asset, onSuccess]);

  const progress = ((stage + 1) / STAGES.length) * 92;
  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.closeButton}><Icon name="close" size={26} color={colors.text} /></Pressable>
        <Pill label="PRIVATE PROCESSING" tone="mint" />
        <View style={styles.closeButton} />
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.boltOrb, { backgroundColor: error ? `${colors.danger}18` : colors.primarySoft, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
          <View style={[styles.boltInner, { backgroundColor: error ? colors.danger : colors.primary }]}>
            <Icon name={error ? 'alert-outline' : 'lightning-bolt'} size={50} color="#FFFFFF" />
          </View>
        </Animated.View>

        {error ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Processing isn’t connected yet</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{error}</Text>
            <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="file-document-outline" color={colors.primary} />
              <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>{asset.name}</Text>
              <Icon name="shield-check-outline" color={colors.mint} />
            </View>
            <PrimaryButton label="Explore the sample Study Pack" icon="arrow-right" onPress={onTrySample} style={styles.action} />
            <Pressable onPress={onCancel} style={styles.secondaryAction}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Choose another file</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Building your Study Pack</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>One upload creates your notes, flashcards, quiz, and audio review together.</Text>
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
                    <View style={[styles.stageIcon, { backgroundColor: complete ? colors.mintSoft : current ? colors.primarySoft : colors.cardStrong }]}>
                      <Icon name={complete ? 'check' : current ? 'lightning-bolt' : 'circle-small'} size={17} color={complete ? colors.mint : current ? colors.primary : colors.textMuted} />
                    </View>
                    <Text style={[styles.stageText, { color: current ? colors.text : colors.textMuted, fontWeight: current ? '800' : '500' }]}>{label}</Text>
                    {current ? <Text style={[styles.working, { color: colors.primary }]}>Working…</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
      <Text style={[styles.privacy, { color: colors.textMuted }]}><Icon name="lock-outline" size={12} color={colors.textMuted} /> Your class material is treated as private content.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  boltOrb: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  boltInner: { width: 83, height: 83, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
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
  action: { width: '100%', marginTop: 18 },
  secondaryAction: { padding: 13 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  privacy: { textAlign: 'center', fontSize: 10 },
});
