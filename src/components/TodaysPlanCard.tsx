import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { ImportClass } from '../hooks/useStudyMaterialPicker';
import type { StudyPack, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import type { HomeDashboard, HomeTodayProgress } from '../services/homeDashboard';
import { buildLearningMastery } from '../services/learningMastery';
import { typography } from '../theme';
import { TodaysPlanArtwork } from './TodaysPlanArtwork';
import { ClassIdentity } from './ClassIdentity';
import { todaysPlanCourse, type TodaysPlanAction } from './todaysPlanPresentation';
import { Icon, GradientSurface } from './ui';
import { GuideAnchor, useGuidanceBlocker } from './StudyGuidance';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = {
  dashboard: HomeDashboard;
  now: Date;
  selectedId?: string;
  onSelectClass: (id?: string) => void;
  onOpenPlan: () => void;
  onOpenStats: () => void;
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onStartStudy: (mode: SmartStudyMode, focus: { deckId: string; sectionIds?: string[] }) => void;
  onOpenMistakes: (itemIds?: string[]) => void;
  onPracticeTest: (deckId: string) => void;
  onShowUpload: (course?: ImportClass) => void;
  onOpenPriority: (kind: HomePriority) => void;
};

const labels = { notes: 'Open notes', audio: 'Open StudyCast', quiz: 'Start quiz', flashcards: 'Start flashcards' } as const;
const priorityLinks = [
  { id: 'due', icon: 'cards-outline', label: 'Due reviews' },
  { id: 'weak', icon: 'target', label: 'Topics to revisit' },
  { id: 'mistakes', icon: 'book-alert-outline', label: 'Missed questions' },
] as const;

export function TodaysPlanCard({
  dashboard, now, selectedId, onSelectClass, onOpenPlan, onOpenStats,
  onOpenDeck, onStartStudy, onOpenMistakes, onPracticeTest, onShowUpload, onOpenPriority,
}: Props) {
  const { state, colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  useGuidanceBlocker(classPickerOpen);
  const [more, setMore] = useState(false);
  const groups = useMemo(() => buildLearningMastery(state, now), [state, now]);
  const choices = groups.filter(group => group.kind !== 'overview');
  const selected = choices.find(group => group.id === selectedId);
  const course = state.classes.find(item => selected?.id === `class:${item.id}`);
  const plan = useMemo(() => {
    if (selected) return todaysPlanCourse(state, selected, now);
    const recentGroup = dashboard.recent.map(({ deck }) => groups.find(group => group.nextPractice?.deckId === deck.id)).find(Boolean);
    return todaysPlanCourse(state, {
      packs: groups.flatMap(group => group.packs),
      practicedPacks: groups.reduce((total, group) => total + group.practicedPacks, 0),
      nextPractice: recentGroup?.nextPractice ?? null,
    }, now, dashboard);
  }, [dashboard, groups, now, selected, state]);
  const { primary, examLabel } = plan;
  const action = primary.action;
  const isEmpty = action.kind === 'materials';
  const isAudio = action.kind === 'deck' && action.tool === 'audio';
  const title = isEmpty ? selected ? 'Add material for this class' : 'Build your first Study Pack' : primary.title;
  const detail = isEmpty ? 'Turn slides, a PDF, or your own notes into flashcards and quizzes.' : primary.reason;
  const label = isEmpty ? 'Add course material' : action.kind === 'mistakes' ? 'Review mistakes'
    : action.kind === 'exam' ? 'Set up practice test' : action.kind === 'smart' ? 'Open Smart Study' : isAudio && action.resume ? 'Resume StudyCast'
      : action.tool ? labels[action.tool] : 'View Study Pack';
  const source = 'deck' in action ? [action.deck.courseName, action.deck.title].filter((text, index, names) => text && names.indexOf(text) === index).join(' · ') : selected?.name;
  const start = (step: TodaysPlanAction) => {
    switch (step.kind) {
      case 'materials': onShowUpload(course); break;
      case 'mistakes': onOpenMistakes(step.itemIds); break;
      case 'exam': onPracticeTest(step.deck.id); break;
      case 'smart': onStartStudy('smart', { deckId: step.deck.id, sectionIds: step.sectionId ? [step.sectionId] : undefined }); break;
      case 'deck': onOpenDeck(step.deck, step.tool, step.cardIds); break;
    }
  };

  const counts = { due: dashboard.dueCount, weak: dashboard.weak.length, mistakes: dashboard.mistakeIds.length };
  // Secondary tools already have a home below. Keep this drawer for review evidence.
  const priorities = priorityLinks.filter(item => counts[item.id] > 0
    && !(item.id === 'mistakes' && action.kind === 'mistakes' && action.itemIds.length === counts.mistakes));
  const heroColors = colors.neon?.hero ?? colors.night?.hero ?? ['#15316E', '#1748A5', '#2058BD'];
  const heroText = colors.mode === 'dark' ? colors.text : '#FFFFFF';
  const heroDetail = colors.mode === 'dark' ? colors.textSecondary : '#E2EBFF';
  const kickerColor = colors.neon?.season.primary ?? colors.goldBright;
  const actionText = colors.neon ? colors.primaryText : colors.onGold;
  const showArt = width >= 260 && fontScale < 1.25;

  return (
    <View>
      <GuideAnchor id="home-plan" style={styles.heading}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, styles.headingText, { color: colors.text }]}>Today’s Learning Plan</Text>
        {choices.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Choose class for today’s plan. ${selected?.name ?? 'All classes'} selected`}
            accessibilityState={{ expanded: classPickerOpen }} onPress={() => setClassPickerOpen(true)}
            style={({ pressed }) => [styles.classButton, { backgroundColor: pressed ? colors.primarySoft : colors.card, borderColor: colors.border }]}>
            {course ? <ClassIdentity course={course} size={25} /> : <Icon name="school-outline" size={16} color={colors.primary} />}
            <Text numberOfLines={2} style={[styles.classLabel, { color: colors.text }]}>{selected?.name ?? 'All classes'}</Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </GuideAnchor>
      <LinearGradient
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        colors={heroColors} start={{ x: 0, y: 0.15 }} end={{ x: 1, y: 0.9 }}
        style={[styles.hero, { borderColor: colors.neon?.edge ?? (colors.night ? colors.border : heroColors[1]) }]}
      >
        <View style={styles.heroRow}>
          <View style={styles.fill}>
            {examLabel || !isEmpty ? <View style={styles.kicker}>
              <Icon name={examLabel ? 'calendar-outline' : 'lightning-bolt'} color={kickerColor} size={16} />
              <Text style={[styles.kickerLabel, { color: kickerColor }]}>{examLabel ?? 'Up next'}</Text>
            </View> : null}
            <Text accessibilityRole="header" style={[styles.taskTitle, width >= 510 && styles.taskTitleWide, { color: heroText }]}>{title}</Text>
            {source && !isEmpty ? <Text style={[styles.source, { color: heroDetail }]}>{source}</Text> : null}
          </View>
          {showArt ? <TodaysPlanArtwork still={reducedMotion} size={width >= 510 ? 'large' : width >= 304 ? 'medium' : 'small'} /> : null}
        </View>
        <Text style={[styles.reason, { color: heroDetail }]}>{detail}</Text>
        <GuideAnchor id={action.kind === 'materials' && !dashboard.decks.length && Platform.OS !== 'web' ? 'home-import' : undefined}
          onActivate={() => start(action)} actionLabel="Add material">
        <Pressable accessibilityRole="button" accessibilityHint={source ? `For ${source}` : undefined} onPress={() => start(action)}
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.neon ? colors.primary : colors.goldBright, opacity: pressed ? 0.88 : 1 }, pressed && !reducedMotion && styles.pressed]}>
          {colors.neon ? <GradientSurface colors={colors.neon.action} borderRadius={styles.primary.borderRadius} /> : null}
          <Icon name={isEmpty ? 'plus' : isAudio ? 'headphones' : 'play'} color={actionText} size={22} />
          <Text style={[styles.primaryText, { color: actionText }]}>{label}</Text>
          <Icon name="arrow-right" color={actionText} size={20} />
        </Pressable>
        </GuideAnchor>
      </LinearGradient>
      {!isEmpty || dashboard.today.planTotal > 0 || dashboard.today.focusSessions > 0 ? (
        <PlanProgress today={dashboard.today} onOpenStats={onOpenStats} onOpenPlan={onOpenPlan} />
      ) : null}
      {priorities.length ? (
        <View style={{ marginTop: 4 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore(!more)}
            style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.linkLabel, { color: colors.primary }]}>More to review</Text>
            <Icon name={more ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
          </Pressable>
          {more ? <View style={[styles.reviewList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {priorities.map(item => (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => onOpenPriority(item.id)}
                style={({ pressed }) => [styles.reviewRow, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}>
                <Icon name={item.icon} size={19} color={colors.primary} />
                <Text style={[styles.fill, styles.linkLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[typography.secondary, { color: colors.textSecondary }]}>{counts[item.id]}</Text>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View> : null}
        </View>
      ) : null}
      {classPickerOpen ? (
        <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setClassPickerOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable accessible={false} onPress={() => setClassPickerOpen(false)} style={StyleSheet.absoluteFill} />
            <View role="dialog" aria-modal accessibilityViewIsModal onAccessibilityEscape={() => setClassPickerOpen(false)}
              style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(16, insets.bottom) }]}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={[typography.sectionTitle, styles.headingText, { color: colors.text }]}>Choose a class</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close class picker" onPress={() => setClassPickerOpen(false)}
                  style={[styles.close, { backgroundColor: colors.cardStrong }]}><Icon name="close" size={20} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
                {[{ id: undefined, name: 'All classes' }, ...choices].map(option => {
                  const active = selected?.id === option.id;
                  const optionCourse = state.classes.find(item => option.id === `class:${item.id}`);
                  return <Pressable key={option.id ?? 'all'} accessibilityRole="radio" accessibilityLabel={option.name} accessibilityState={{ checked: active }}
                    onPress={() => { onSelectClass(option.id); setClassPickerOpen(false); }}
                    style={({ pressed }) => [styles.choice, { backgroundColor: active || pressed ? colors.primarySoft : 'transparent' }]}>
                    {option.id ? <ClassIdentity course={optionCourse ?? { name: option.name }} size={32} /> : null}
                    <Text style={[typography.body, styles.fill, { color: colors.text }]}>{option.name}</Text>
                    {active ? <Icon name="check" size={20} color={colors.primary} /> : null}
                  </Pressable>;
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function PlanProgress({ today, onOpenStats, onOpenPlan }: {
  today: HomeTodayProgress; onOpenStats: () => void; onOpenPlan: () => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const fraction = today.planTotal ? today.planCompleted / today.planTotal : 0;
  const value = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    if (reducedMotion) {
      value.setValue(fraction);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: fraction, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fraction, reducedMotion, value]);

  const complete = today.planTotal > 0 && today.planCompleted === today.planTotal;
  const activity = [
    today.reviewedCards > 0 ? `${today.reviewedCards} ${today.reviewedCards === 1 ? 'card' : 'cards'} reviewed` : '',
    today.quizSessions > 0 ? `${today.quizSessions} ${today.quizSessions === 1 ? 'quiz' : 'quizzes'} finished` : '',
    today.completedAudio > 0 ? `${today.completedAudio} ${today.completedAudio === 1 ? 'StudyCast' : 'StudyCasts'} finished` : '',
    today.focusSessions > 0 ? `${today.focusSessions} focus ${today.focusSessions === 1 ? 'session' : 'sessions'}` : '',
  ].filter(Boolean).join(' · ');
  const plannerStatus = complete ? 'Today’s plan is complete' : `${today.planCompleted} of ${today.planTotal} Planner tasks complete`;

  return (
    <View style={[styles.progress, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.progressRow}>
        <View style={[styles.progressIcon, { backgroundColor: complete || activity ? colors.mintSoft : colors.primarySoft }]}>
          <Icon name={complete || activity ? 'check-circle-outline' : 'chart-timeline-variant'} size={19} color={complete || activity ? colors.mint : colors.primary} />
        </View>
        <View style={styles.fill} accessibilityLiveRegion="polite">
          <Text style={[styles.progressTitle, { color: colors.text }]}>{today.planTotal ? plannerStatus : 'Today’s progress'}</Text>
          {activity || !today.planTotal ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{activity || 'Your first activity will appear here.'}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={today.planTotal ? onOpenPlan : onOpenStats} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.linkLabel, { color: colors.primary }]}>{today.planTotal ? 'Planner' : 'Stats'}</Text>
          <Icon name="chevron-right" size={17} color={colors.primary} />
        </Pressable>
      </View>
      {today.planTotal ? <View accessibilityRole="progressbar" accessibilityLabel="Today’s Planner tasks" accessibilityValue={{ min: 0, now: today.planCompleted, max: today.planTotal }}
        style={[styles.track, { backgroundColor: colors.neon?.progressTrack ?? colors.cardStrong }]}>
        <Animated.View style={[styles.bar, { backgroundColor: complete ? colors.mint : colors.neon?.progressFill ?? colors.primary,
          width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginBottom: 9, minHeight: 44 },
  headingText: { flexGrow: 1, flexShrink: 1 },
  classButton: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 44, paddingHorizontal: 8, borderRadius: 13, borderWidth: 1, maxWidth: '100%' },
  classLabel: { fontSize: 13, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  fill: { flex: 1, minWidth: 0 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 19, gap: 11, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  kickerLabel: { fontSize: 13, lineHeight: 19, fontWeight: '800' },
  taskTitle: { fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.75 },
  taskTitleWide: { fontSize: 35, lineHeight: 41 },
  source: { fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 7 },
  reason: { ...typography.secondary, maxWidth: 510 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 52, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginTop: 3 },
  primaryText: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.986 }] },
  progress: { borderRadius: 17, borderWidth: 1, marginTop: 10, paddingHorizontal: 12, paddingVertical: 7 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  progressIcon: { height: 34, width: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  progressTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 3, paddingHorizontal: 4, flexShrink: 1 },
  linkLabel: { fontSize: 13, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  track: { height: 6, borderRadius: 4, marginTop: 5, marginBottom: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  reviewList: { borderWidth: 1, borderRadius: 16, padding: 4 },
  reviewRow: { minHeight: 46, borderRadius: 12, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backdrop: { flex: 1, backgroundColor: '#080F235C', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 42 },
  sheet: { maxHeight: '90%', width: '100%', maxWidth: 530, flexShrink: 1, padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  close: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 13 },
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 },
});
