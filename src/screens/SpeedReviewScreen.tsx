import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SpeedPickerSheet } from '../components/StudyCastSheets';
import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar, Screen } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { StudyPack } from '../models';

const SPEEDS = [1.25, 1.5, 1.75, 2];
const DEFAULT_SPEED = 1.5;
const MAX_WORDS_PER_PACK = 120;

type SpeedReviewItem = {
  deck: StudyPack;
  text: string;
  words: number;
};

function compactReviewText(deck: StudyPack): string {
  const source = deck.audioSummary || deck.quickReview || deck.overview || deck.originalText;
  const normalized = source.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentences = normalized.match(/[^.!?]+[.!?]+/g) ?? [normalized];
  const selected: string[] = [];
  let wordCount = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (wordCount && wordCount + words.length > MAX_WORDS_PER_PACK) break;
    selected.push(sentence.trim());
    wordCount += words.length;
    if (wordCount >= MAX_WORDS_PER_PACK) break;
  }
  if (!selected.length) return normalized.split(/\s+/).slice(0, MAX_WORDS_PER_PACK).join(' ');
  return selected.join(' ');
}

function formatMinutes(words: number, rate: number): string {
  const minutes = Math.max(1, Math.ceil(words / (135 * rate)));
  return `${minutes} min`;
}

export function SpeedReviewScreen({
  deckId,
  courseId,
  onBack,
  onOpenDeck,
}: {
  deckId?: string;
  courseId?: string;
  onBack: () => void;
  onOpenDeck: (deckId: string) => void;
}) {
  const { colors, state } = useStudyBolt();
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(DEFAULT_SPEED);
  const [playing, setPlaying] = useState(false);
  const [complete, setComplete] = useState(false);
  const [speedSheetVisible, setSpeedSheetVisible] = useState(false);
  const speechGeneration = useRef(0);

  const selectedDecks = useMemo(() => {
    if (deckId) return state.decks.filter((deck) => deck.id === deckId);
    return state.decks.filter((deck) => !courseId || deck.courseId === courseId).sort((a, b) => a.order - b.order);
  }, [courseId, deckId, state.decks]);
  const items = useMemo<SpeedReviewItem[]>(() => selectedDecks
    .map((deck) => {
      const text = compactReviewText(deck);
      return { deck, text, words: text.split(/\s+/).filter(Boolean).length };
    })
    .filter((item) => item.text.length > 0), [selectedDecks]);
  const item = items[index];
  const scopeName = deckId ? selectedDecks[0]?.title ?? 'PowerPoint' : state.classes.find((course) => course.id === courseId)?.name ?? selectedDecks[0]?.courseName ?? 'Class';
  const totalWords = items.reduce((sum, current) => sum + current.words, 0);
  const totalMinutes = formatMinutes(totalWords, rate);

  useEffect(() => () => {
    speechGeneration.current += 1;
    void Speech.stop();
  }, []);

  const stopSpeech = () => {
    speechGeneration.current += 1;
    setPlaying(false);
    void Speech.stop();
  };

  const speakAt = (targetIndex: number) => {
    const target = items[targetIndex];
    if (!target) return;
    const generation = ++speechGeneration.current;
    setIndex(targetIndex);
    setComplete(false);
    setPlaying(true);
    void Speech.stop().then(() => {
      if (generation !== speechGeneration.current) return;
      Speech.speak(target.text, {
        rate,
        onDone: () => {
          if (generation !== speechGeneration.current) return;
          setPlaying(false);
          if (targetIndex < items.length - 1) {
            const nextIndex = targetIndex + 1;
            setIndex(nextIndex);
            setTimeout(() => {
              if (generation === speechGeneration.current) speakAt(nextIndex);
            }, 120);
          } else {
            setComplete(true);
          }
        },
        onStopped: () => {
          if (generation === speechGeneration.current) setPlaying(false);
        },
        onError: () => {
          if (generation === speechGeneration.current) setPlaying(false);
        },
      });
    });
  };

  const togglePlay = () => {
    if (playing) stopSpeech();
    else speakAt(index);
  };

  const jump = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, index + direction));
    if (nextIndex === index) return;
    const shouldPlay = playing;
    stopSpeech();
    setIndex(nextIndex);
    if (shouldPlay) setTimeout(() => speakAt(nextIndex), 80);
  };

  const selectRate = (nextRate: number) => {
    setRate(nextRate);
    setSpeedSheetVisible(false);
    if (playing) stopSpeech();
  };

  const restart = () => {
    setIndex(0);
    setComplete(false);
    setPlaying(false);
    speechGeneration.current += 1;
    void Speech.stop();
  };

  if (!items.length) {
    return (
      <Screen>
        <Header title="Speed Review" onBack={onBack} />
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="headphones-off" size={32} color={colors.purple} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Speed Review is still preparing</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>This {deckId ? 'PowerPoint' : 'class'} does not have a short summary ready yet. Try again after StudyBolt finishes preparing it.</Text>
          <PrimaryButton label="Go back" icon="arrow-left" onPress={onBack} style={styles.emptyButton} />
        </Card>
      </Screen>
    );
  }

  if (complete) {
    return (
      <Screen>
        <Header title="Speed Review" onBack={onBack} right={<Pill label="Complete" tone="mint" />} />
        <View style={[styles.completeCard, { backgroundColor: colors.mintSoft }]}>
          <View style={[styles.completeIcon, { backgroundColor: colors.card }]}><Icon name="check-decagram" size={42} color={colors.mint} /></View>
          <Text style={[styles.completeTitle, { color: colors.text }]}>Quick pass complete</Text>
          <Text style={[styles.completeText, { color: colors.textSecondary }]}>You reviewed {items.length} {items.length === 1 ? 'PowerPoint' : 'PowerPoints'} in {scopeName}.</Text>
        </View>
        <PrimaryButton label="Listen again" icon="refresh" onPress={restart} style={styles.primaryAction} />
        <Pressable onPress={onBack} style={[styles.secondaryAction, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
          <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Back to studying</Text>
        </Pressable>
      </Screen>
    );
  }

  const current = item!;
  const currentRateLabel = `${Number.isInteger(rate) ? rate.toFixed(1) : rate.toString()}×`;
  return (
    <Screen>
      <Header title="Speed Review" subtitle={scopeName} onBack={onBack} right={<Pill label={`${index + 1} / ${items.length}`} tone="purple" />} />
      <View style={styles.heroRow}>
        <View style={[styles.heroIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="speedometer" size={25} color={colors.purple} /></View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>A fast pass through the ideas</Text>
          <Text style={[styles.heroText, { color: colors.textSecondary }]}>{items.length} {items.length === 1 ? 'PowerPoint' : 'PowerPoints'} · about {totalMinutes} at {currentRateLabel}</Text>
        </View>
      </View>
      <ProgressBar progress={((index + 1) / Math.max(1, items.length)) * 100} color={colors.purple} />

      <Card style={[styles.playerCard, { backgroundColor: colors.mode === 'dark' ? '#17152A' : '#17142F' }]}>
        <View style={styles.playerTop}>
          <Pill label="QUICK REVIEW" tone="purple" />
          <Text style={styles.playerPosition}>{formatMinutes(current.words, rate)}</Text>
        </View>
        <View style={styles.playerIcon}><Icon name="headphones" size={36} color="#D9CCFF" /></View>
        <Text style={styles.playerTitle}>{current.deck.title}</Text>
        <Text style={styles.playerSubtitle}>{current.deck.courseName} · {current.deck.pageCount} {current.deck.fileType === 'pdf' ? 'pages' : 'slides'}</Text>
        <View style={styles.summaryPreview}>
          <Text style={styles.summaryLabel}>YOU’LL HEAR</Text>
          <Text numberOfLines={4} style={styles.summaryText}>{current.text}</Text>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityLabel="Previous PowerPoint" onPress={() => jump(-1)} style={styles.skipButton}><Icon name="skip-previous" size={27} color="#D9DCF0" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause speed review' : 'Play speed review'} onPress={togglePlay} style={[styles.playButton, { backgroundColor: colors.purple }]}><Icon name={playing ? 'pause' : 'play'} size={32} color={colors.primaryText} /></Pressable>
          <Pressable accessibilityLabel="Next PowerPoint" onPress={() => jump(1)} style={styles.skipButton}><Icon name="skip-next" size={27} color="#D9DCF0" /></Pressable>
        </View>
      </Card>

      <Card style={styles.settingsCard}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose speed review playback speed" onPress={() => setSpeedSheetVisible(true)} style={styles.speedSetting}>
          <Icon name="speedometer" color={colors.primary} />
          <View style={styles.settingCopy}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>SPEED</Text><Text style={[styles.settingValue, { color: colors.text }]}>{currentRateLabel}</Text></View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Pressable>
        <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
        <Pressable onPress={() => onOpenDeck(current.deck.id)} style={styles.speedSetting}>
          <Icon name="book-open-page-variant" color={colors.mint} />
          <View style={styles.settingCopy}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>WANT MORE DETAIL?</Text><Text style={[styles.settingValue, { color: colors.text }]}>Open this PowerPoint</Text></View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Pressable>
      </Card>
      <Text style={[styles.footerHint, { color: colors.textMuted }]}>Uses the saved Quick Review and your device voice. No new AI request is made.</Text>

      <SpeedPickerSheet visible={speedSheetVisible} rates={SPEEDS} selected={rate} onSelect={selectRate} onClose={() => setSpeedSheetVisible(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  playerCard: { marginTop: 18, padding: 18, borderWidth: 0, alignItems: 'center' },
  playerTop: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerPosition: { color: '#B9B1D6', fontSize: 10, fontWeight: '800' },
  playerIcon: { width: 76, height: 76, borderRadius: 28, backgroundColor: '#302753', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  playerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  playerSubtitle: { color: '#B9B1D6', fontSize: 10, marginTop: 4 },
  summaryPreview: { width: '100%', borderRadius: 14, backgroundColor: '#211D40', padding: 12, marginTop: 17 },
  summaryLabel: { color: '#B9A9EC', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  summaryText: { color: '#E6E1F6', fontSize: 11, lineHeight: 17, marginTop: 5 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 28, marginTop: 18 },
  skipButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  settingsCard: { marginTop: 13, paddingVertical: 4 },
  speedSetting: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingCopy: { flex: 1 },
  settingLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  settingValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  settingDivider: { height: StyleSheet.hairlineWidth, marginLeft: 31 },
  primaryAction: { marginTop: 16 },
  secondaryAction: { minHeight: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryActionText: { fontSize: 13, fontWeight: '900' },
  footerHint: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 15 },
  emptyCard: { alignItems: 'center', paddingVertical: 38, marginTop: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 14 },
  emptyText: { maxWidth: 290, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  emptyButton: { alignSelf: 'stretch', marginTop: 18 },
  completeCard: { alignItems: 'center', borderRadius: 20, padding: 24, marginTop: 12 },
  completeIcon: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  completeTitle: { fontSize: 22, fontWeight: '900', marginTop: 16 },
  completeText: { maxWidth: 290, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});
