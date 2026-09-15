import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack } from '../models';
import { calculateMastery } from '../services/mastery';
import { buildMistakeNotebook, buildSmartStudyBrief } from '../services/adaptiveStudy';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import { DOCUMENT_PICKER_TYPE, pageLabel } from '../services/documentTypes';
import { BoltMark, Card, Header, Icon, Pill, ProgressBar, Screen, SectionHeader } from '../components/ui';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAuth } from '../AuthContext';

export function HomeScreen({
  onOpenDeck,
  onImport,
  onStartStudy,
  onOpenMistakes,
  onOpenFlagged,
  onOpenPlanner,
}: {
  onOpenDeck: (deck: StudyPack) => void;
  onImport: (asset: ImportAsset) => void;
  onStartStudy: (mode: SmartStudyMode) => void;
  onOpenMistakes: () => void;
  onOpenFlagged: () => void;
  onOpenPlanner: () => void;
}) {
  const { colors, state, setTheme } = useStudyBolt();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const energySweep = useRef(new Animated.Value(0)).current;
  const avatarInitial = (user?.email?.[0] ?? 'H').toUpperCase();
  const brief = useMemo(() => buildSmartStudyBrief(state), [state]);
  const mistakeCount = useMemo(() => buildMistakeNotebook(state).length, [state]);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const studyNowPalette = colors.mode === 'dark'
    ? {
        gradient: ['#18243D', '#153049', '#302A18'] as const,
        pillBackground: '#FFD45E18',
        dot: colors.goldBright,
        pillText: '#F6D988',
        estimate: '#B6C6DD',
        title: '#F8FBFF',
        body: '#C1CDDD',
        metricValue: '#F8FBFF',
        metricLabel: '#9FB0C8',
        divider: '#88A8CE4D',
        actionBackground: colors.goldBright,
        actionIcon: colors.onGold,
        borderGradient: ['#6E96C4', '#536F8B', '#B08F43'] as const,
        borderShadow: '#000000',
        glow: '#FFD45E18',
        streak: '#FFF2B8',
      }
    : {
        gradient: ['#EAF2FF', '#E4F1FF', '#FFF3C8'] as const,
        pillBackground: '#FFFFFFB8',
        dot: colors.gold,
        pillText: '#72521B',
        estimate: '#55708D',
        title: '#16204A',
        body: '#53657A',
        metricValue: '#16204A',
        metricLabel: '#64758A',
        divider: '#AFC2D8',
        actionBackground: colors.goldBright,
        actionIcon: colors.onGold,
        borderGradient: ['#82B1EE', '#BFD3E9', '#E9C456'] as const,
        borderShadow: '#6683A8',
        glow: '#FFD45E24',
        streak: '#FFFFFF',
      };

  useEffect(() => {
    energySweep.stopAnimation();
    if (reducedMotion) {
      energySweep.setValue(1);
      return;
    }
    energySweep.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(520),
      Animated.timing(energySweep, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [energySweep, reducedMotion]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_PICKER_TYPE,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      onImport({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file });
    } catch {
      Alert.alert('Couldn’t open files', 'Check file permissions, then try again.');
    }
  };

  return (
    <Screen>
      <Header
        title="Study Bolt"
        right={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={`Switch to ${colors.mode === 'dark' ? 'light' : 'dark'} mode`}
              onPress={() => setTheme(colors.mode === 'dark' ? 'light' : 'dark')}
              style={[styles.roundButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Icon name={colors.mode === 'dark' ? 'weather-sunny' : 'weather-night'} size={19} color={colors.mode === 'dark' ? colors.warning : colors.primary} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: colors.mintSoft }]}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
          </View>
        }
      />

      <View style={styles.heroCopy}>
        <View style={styles.dateRow}>
          <Icon name="lightning-bolt" size={12} color={colors.goldText} />
          <Text style={[styles.date, { color: colors.textMuted }]}>{today.toUpperCase()}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Ready when you are</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your next best session is ready.</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Start your smart study session" onPress={() => onStartStudy('smart')}>
        {({ pressed }) => (
          <LinearGradient
            colors={studyNowPalette.borderGradient}
            locations={[0, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.studyNowFrame,
              {
                opacity: pressed ? 0.9 : 1,
                shadowColor: studyNowPalette.borderShadow,
                shadowOpacity: colors.mode === 'dark' ? 0.24 : 0.14,
              },
            ]}
          >
            <LinearGradient
              colors={studyNowPalette.gradient}
              locations={[0, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.studyNowCard}
            >
              <View style={[styles.energyGlow, { backgroundColor: studyNowPalette.glow }]} />
              <Animated.View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.energySweep,
                  {
                    backgroundColor: studyNowPalette.streak,
                    opacity: energySweep.interpolate({ inputRange: [0, 0.16, 0.84, 1], outputRange: [0, 0.32, 0.24, 0] }),
                    transform: [
                      { translateX: energySweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 480] }) },
                      { rotate: '18deg' },
                    ],
                  },
                ]}
              />
              <BoltMark animated={false} size={74} iconSize={42} style={styles.energyBolt} />
              <View style={styles.studyNowTop}>
                <View style={[styles.todayPill, { backgroundColor: studyNowPalette.pillBackground }]}><View style={[styles.liveDot, { backgroundColor: studyNowPalette.dot }]} /><Text style={[styles.todayPillText, { color: studyNowPalette.pillText }]}>TODAY’S PLAN</Text></View>
                <Text style={[styles.estimate, { color: studyNowPalette.estimate }]}>{brief.estimatedMinutes} MIN</Text>
              </View>
              <Text style={[styles.studyNowTitle, { color: studyNowPalette.title }]}>Study Now</Text>
              <Text style={[styles.studyNowText, { color: studyNowPalette.body }]}>Due reviews, weak topics, and recent misses—prioritized for you.</Text>
              <View style={styles.studyMetrics}>
                <View><Text style={[styles.studyMetricValue, { color: studyNowPalette.metricValue }]}>{brief.dueReviews}</Text><Text style={[styles.studyMetricLabel, { color: studyNowPalette.metricLabel }]}>reviews</Text></View>
                <View style={[styles.metricDivider, { backgroundColor: studyNowPalette.divider }]} />
                <View><Text style={[styles.studyMetricValue, { color: studyNowPalette.metricValue }]}>{brief.weakTopics}</Text><Text style={[styles.studyMetricLabel, { color: studyNowPalette.metricLabel }]}>weak topics</Text></View>
                <View style={[styles.metricDivider, { backgroundColor: studyNowPalette.divider }]} />
                <View><Text style={[styles.studyMetricValue, { color: studyNowPalette.metricValue }]}>{brief.recentMistakes}</Text><Text style={[styles.studyMetricLabel, { color: studyNowPalette.metricLabel }]}>{brief.recentMistakes === 1 ? 'mistake area' : 'mistake areas'}</Text></View>
                <View style={[styles.startCircle, { backgroundColor: studyNowPalette.actionBackground }]}><Icon name="arrow-right" size={23} color={studyNowPalette.actionIcon} /></View>
              </View>
            </LinearGradient>
          </LinearGradient>
        )}
      </Pressable>

      {brief.examDaysLeft !== null ? (
        <Pressable onPress={onOpenPlanner} style={[styles.examCard, { backgroundColor: colors.cardStrong }]}>
          <View style={[styles.examIcon, { backgroundColor: brief.examDaysLeft <= 1 ? `${colors.danger}15` : colors.primarySoft }]}><Icon name="school-outline" size={22} color={brief.examDaysLeft <= 1 ? colors.danger : colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.examTitle, { color: colors.text }]}>{brief.examDaysLeft === 0 ? 'Exam day' : `${brief.examDaysLeft} days left`} <Text style={{ color: colors.textMuted }}>· {brief.examConceptsRemaining} concepts remaining</Text></Text>
            <Text style={[styles.examText, { color: colors.textMuted }]}>≈ {Math.max(5, Math.ceil((brief.examConceptsRemaining * 3) / Math.max(1, brief.examDaysLeft ?? 1)))} min/day · Plan adjusts if you miss a day</Text>
          </View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Pressable>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Quick start</Text>
      <View style={styles.quickActions}>
        <QuickAction icon="radar" label="Pre-Test" detail="Find your baseline" color={colors.primary} background={colors.primarySoft} onPress={() => onStartStudy('pretest')} />
        <QuickAction icon="fire" label="Cram" detail="Highest yield first" color={colors.warning} background={`${colors.warning}18`} onPress={() => onStartStudy('cram')} />
        <QuickAction icon="book-alert-outline" label="Mistakes" detail={`${mistakeCount} to review`} color={colors.purple} background={colors.purpleSoft} onPress={onOpenMistakes} />
        <QuickAction icon="flag-outline" label="Saved" detail={`${state.flaggedItems.length} flagged`} color={colors.goldText} background={colors.goldSoft} onPress={onOpenFlagged} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import study material"
        onPress={pickDocument}
        style={({ pressed }) => [
          styles.uploadCard,
          { backgroundColor: colors.backgroundRaised, borderColor: `${colors.primary}66`, opacity: pressed ? 0.86 : 1 },
        ]}
      >
        <View style={[styles.cloudCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name="cloud-upload-outline" size={34} color={colors.primary} />
        </View>
        <Text style={[styles.uploadTitle, { color: colors.text }]}>Drop your files here</Text>
        <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>or tap to upload</Text>
        <Text style={[styles.formats, { color: colors.textMuted }]}>PPT, PPTX, PDF, or notes</Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fileTypes}>
          <FileTypeIcon icon="microsoft-powerpoint" color="#D9472F" background="#FFF0EC" />
          <FileTypeIcon icon="file-pdf-box" color="#E5535D" background="#FFF0F2" />
          <FileTypeIcon icon="note-text-outline" color="#7D5CFF" background="#F0ECFF" />
        </View>
      </Pressable>

      <SectionHeader title="Recent uploads" />
      <View style={styles.deckList}>
        {state.decks.slice(0, 2).map((deck) => (
          <RecentDeck key={deck.id} deck={deck} onPress={() => onOpenDeck(deck)} />
        ))}
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, detail, color, background, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; detail: string; color: string; background: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
      <View style={[styles.quickActionIcon, { backgroundColor: background }]}><Icon name={icon} size={20} color={color} /></View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.quickActionDetail, { color: colors.textMuted }]}>{detail}</Text>
    </Pressable>
  );
}

function FileTypeIcon({ icon, color, background }: { icon: Parameters<typeof Icon>[0]['name']; color: string; background: string }) {
  return (
    <View style={[styles.fileIcon, { backgroundColor: background }]}>
      <Icon name={icon} size={24} color={color} />
    </View>
  );
}

function RecentDeck({ deck, onPress }: { deck: StudyPack; onPress: () => void }) {
  const { colors } = useStudyBolt();
  const mastery = calculateMastery(deck).overall;
  return (
    <Card onPress={onPress} style={[styles.deckCard, styles.flatCard]}>
      <View style={[styles.deckThumb, { backgroundColor: `${deck.color}24` }]}>
        <Text style={styles.deckEmoji}>{deck.emoji}</Text>
      </View>
      <View style={styles.deckCopy}>
        <View style={styles.deckTitleRow}>
          <Text numberOfLines={1} style={[styles.deckTitle, { color: colors.text }]}>{deck.courseName}</Text>
          <Pill label={`${mastery}%`} tone={mastery >= 75 ? 'mint' : 'blue'} />
        </View>
        <Text numberOfLines={1} style={[styles.deckSubtitle, { color: colors.textSecondary }]}>{deck.title}</Text>
        <View style={styles.deckMetaRow}>
          <Text style={[styles.deckMeta, { color: colors.textMuted }]}>{deck.pageCount} {pageLabel(deck.fileType)}</Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.deckMeta, { color: colors.textMuted }]}>Available offline</Text>
        </View>
        <View style={styles.miniProgress}><ProgressBar progress={mastery} color={deck.color} /></View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  roundButton: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#12775E' },
  heroCopy: { marginTop: 14, marginBottom: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 7 },
  date: { fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { marginTop: 5, fontSize: 13, lineHeight: 18, maxWidth: 500 },
  studyNowFrame: { borderRadius: 23.5, padding: 1.75, shadowOffset: { width: 0, height: 7 }, shadowRadius: 16, elevation: 3 },
  studyNowCard: { minHeight: 204, borderRadius: 21.25, padding: 18, overflow: 'hidden' },
  energyGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -72, top: -92, pointerEvents: 'none' },
  energySweep: { position: 'absolute', width: 54, height: 290, left: 0, top: -42, pointerEvents: 'none' },
  energyBolt: { position: 'absolute', right: 16, top: 54, opacity: 0.28 },
  studyNowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFFFFF12', borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#71E3BE' },
  todayPillText: { color: '#C8D8EF', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  estimate: { color: '#9EB5D1', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  studyNowTitle: { color: '#FFFFFF', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -1, marginTop: 18 },
  studyNowText: { color: '#BBCADF', fontSize: 12, lineHeight: 18, maxWidth: 365, marginTop: 6 },
  studyMetrics: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 19 },
  studyMetricValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  studyMetricLabel: { color: '#93A8C4', fontSize: 8, marginTop: 1 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 29, backgroundColor: '#FFFFFF24' },
  startCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#79E0C1', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  examCard: { minHeight: 62, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  examIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  examTitle: { fontSize: 11, fontWeight: '900' },
  examText: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  sectionLabel: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, marginTop: 22 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickAction: { flexBasis: '48%', flexGrow: 1, minHeight: 74, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: 10, paddingLeft: 50, justifyContent: 'center' },
  quickActionIcon: { position: 'absolute', left: 10, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 11, fontWeight: '900' },
  quickActionDetail: { fontSize: 8, lineHeight: 11, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  uploadCard: { minHeight: 232, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 20 },
  cloudCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 17, fontWeight: '900' },
  uploadHint: { fontSize: 13, marginTop: 3 },
  fileTypes: { flexDirection: 'row', gap: 10, marginTop: 17 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formats: { fontSize: 11, fontWeight: '600', marginTop: 14 },
  promise: { marginTop: 14, minHeight: 58, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11 },
  promiseIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  promiseText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  deckList: { gap: 10 },
  deckCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
  deckThumb: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deckEmoji: { fontSize: 25 },
  deckCopy: { flex: 1, minWidth: 0 },
  deckTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  deckTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  deckSubtitle: { fontSize: 12, marginTop: 2 },
  deckMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  deckMeta: { fontSize: 10 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  miniProgress: { marginTop: 7 },
  tipCard: { marginTop: 22 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800' },
  tipText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
});
