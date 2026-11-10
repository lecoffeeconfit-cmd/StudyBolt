import { LoadingArtwork } from './StudyBoltLoading';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { Card, Icon } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StatDetail } from '../data/statExplanations';
import type { LearningMasteryGroup, LearningPracticeAction } from '../services/learningMastery';
import { radius, typography } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const plural = (count: number, word: string) => count + ' ' + word + (count === 1 ? '' : 's');
const materialSummary = (group: LearningMasteryGroup) => [
  group.powerpoints ? plural(group.powerpoints, 'presentation') : '',
  group.pdfs ? plural(group.pdfs, 'PDF') : '',
  group.noteSets ? plural(group.noteSets, 'note set') : '',
].filter(Boolean).join(' · ');

function classBreakdown(group: LearningMasteryGroup): StatDetail {
  return {
    label: group.name + ' · course evidence',
    value: group.mastery === null ? '—' : group.mastery + '%',
    supporting: (materialSummary(group) || 'No material added') + '. ' + group.explanation,
    description: group.packs.map(pack => pack.title + ': ' + (pack.practiced ? 'practice recorded' : 'no recorded practice') + ', ' + plural(pack.topics, 'identified topic') + '.').join('\n\n'),
    calculation: 'Readiness here means the share of identified topics showing consistent, spaced recall in your saved material. It is shown only when every pack has complete topic mapping, every topic has at least two distinct practice items, and every current item has responses on separate days at least 24 hours apart within the last 30 days. Each item’s two latest daily responses must succeed, including a successful spaced response, for a topic to count as consistent. Same-day retries cannot replace the first response. Quiz accuracy separately counts fully correct first answers once per source question. Practice coverage counts packs with a quiz answer or flashcard review. Uploads, reading time, and listening do not establish recall. Bundled examples and seeded history are excluded.',
    insight: group.assessedTopics + ' of ' + plural(group.topicCount, 'topic') + ' assessed. ' + plural(group.supportedTopics, 'topic') + ' showing consistent recall.' + (group.focusTopics.length ? '\n\nFocus next:\n' + group.focusTopics.map(topic => topic.title + ' — ' + topic.packTitle).join('\n') : ''),
    whyItMatters: 'Use the results to choose your next practice. Flashcard ratings are self-reported recall outcomes. This conservative reporting rule is not a validated prediction of an exam grade or knowledge of the full course syllabus. Older or incomplete evidence stays unassessed.',
  };
}

export function LearningMasteryHero({ groups, onExplore, onPractice, onAddMaterial }: {
  groups: LearningMasteryGroup[];
  onExplore: (detail: StatDetail) => void;
  onPractice: (action: LearningPracticeAction) => void;
  onAddMaterial: () => void;
}) {
  const { colors, hydrated } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const list = useRef<FlatList<LearningMasteryGroup>>(null);
  const ids = groups.map(group => group.id).join('|');
  const selectedIndex = Math.max(0, groups.findIndex(group => group.id === selectedId));
  const selected = groups[selectedIndex]!;

  const select = (index: number, announce = false) => {
    const group = groups[index];
    if (!group) return;
    const changed = group.id !== selectedRef.current;
    selectedRef.current = group.id;
    if (changed) setSelectedId(group.id);
    if (announce) AccessibilityInfo.announceForAccessibility(group.name + ', ' + (index + 1) + ' of ' + groups.length);
  };

  useEffect(() => {
    const current = groupsRef.current;
    const index = Math.max(0, current.findIndex(group => group.id === selectedRef.current));
    selectedRef.current = current[index]!.id;
    setSelectedId(current[index]!.id);
    if (width) list.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [ids, width]);

  const navigate = (index: number) => {
    if (index < 0 || index >= groups.length) return;
    select(index, true);
    list.current?.scrollToOffset({ offset: index * width, animated: !reducedMotion });
  };

  if (!hydrated) return <Card style={styles.card}><View accessibilityState={{ busy: true }} style={styles.loading}><LoadingArtwork colors={colors} /><Text style={[styles.copy, { color: colors.textSecondary }]}>Loading your course progress…</Text></View></Card>;

  return (
    <Card style={styles.card}>
      <LinearGradient pointerEvents="none" colors={[colors.primarySoft, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wash} />
      <View style={styles.topRow}>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>COURSE READINESS</Text>
          <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{groups.length > 1 ? (selectedIndex + 1) + ' of ' + groups.length + ' · swipe to explore' : 'Your saved study material'}</Text>
        </View>
        {groups.length > 1 ? <View style={styles.arrows}>
          <ClassArrow direction="left" disabled={selectedIndex === 0} onPress={() => navigate(selectedIndex - 1)} />
          <ClassArrow direction="right" disabled={selectedIndex === groups.length - 1} onPress={() => navigate(selectedIndex + 1)} />
        </View> : null}
      </View>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? <FlatList
          ref={list}
          data={groups}
          keyExtractor={group => group.id}
          horizontal pagingEnabled directionalLockEnabled
          decelerationRate="fast" showsHorizontalScrollIndicator={false}
          scrollEnabled={groups.length > 1}
          initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          extraData={selectedId}
          onScroll={event => select(Math.max(0, Math.min(groups.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
          onMomentumScrollEnd={() => AccessibilityInfo.announceForAccessibility((groupsRef.current.find(group => group.id === selectedRef.current)?.name ?? '') + ', course selected')}
          scrollEventThrottle={32}
          renderItem={({ item }) => <CoursePage group={item} width={width} active={item.id === selected.id} onPractice={onPractice} onAddMaterial={onAddMaterial} />}
        /> : <CoursePage group={selected} width={undefined} active onPractice={onPractice} onAddMaterial={onAddMaterial} />}
      </View>
      <Pressable accessibilityRole="button" onPress={() => onExplore(classBreakdown(selected))} style={({ pressed }) => [styles.evidenceLink, { opacity: pressed ? 0.65 : 1 }]}>
        <Icon name="information-outline" size={16} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.primary }]}>View evidence and material</Text>
        <Icon name="chevron-right" size={18} color={colors.primary} />
      </Pressable>
      {groups.length > 1 && groups.length <= 7 ? <View accessible={false} style={styles.pager}>{groups.map((group, index) => <View key={group.id} style={[styles.dot, { width: index === selectedIndex ? 20 : 5, backgroundColor: index === selectedIndex ? colors.primary : colors.border }]} />)}</View> : null}
    </Card>
  );
}

function ClassArrow({ direction, disabled, onPress }: { direction: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" accessibilityLabel={direction === 'left' ? 'Previous course' : 'Next course'} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.arrow, { backgroundColor: colors.card, borderColor: colors.border, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}><Icon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} color={colors.text} size={24} /></Pressable>;
}

function CoursePage({ group, width, active, onPractice, onAddMaterial }: {
  group: LearningMasteryGroup; width: number | undefined; active: boolean;
  onPractice: (action: LearningPracticeAction) => void; onAddMaterial: () => void;
}) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const wide = (width ?? 0) >= 285 && fontScale <= 1.2;
  return (
    <View aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'} style={[styles.page, { width }]}>
      <Text accessibilityRole="header" style={[styles.courseName, { color: colors.text }]}>{group.name}</Text>
      <Text style={[styles.copy, { color: colors.textSecondary }]}>{materialSummary(group) || 'Add your first Study Pack to begin'}</Text>
      <View style={[styles.main, wide && styles.mainWide]}>
        <RecallRing value={group.mastery} />
        <View style={styles.status}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>Knowledge readiness</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>{group.mastery === null ? 'Building evidence through practice' : plural(group.supportedTopics, 'topic') + ' with consistent recall'}</Text>
          <Text style={[styles.smallCopy, { color: colors.textMuted }]}>{group.topicCount ? group.assessedTopics + ' of ' + plural(group.topicCount, 'topic') + ' assessed' : 'Your topics will appear with your material'}</Text>
          {group.pendingPacks ? <Text style={[styles.smallCopy, { color: group.failedPacks ? colors.warning : colors.textSecondary }]}>{group.failedPacks ? 'Some practice tools need attention. Check the Study Pack in Library.' : 'Some practice tools are still being prepared.'}</Text> : null}
        </View>
      </View>
      <View style={[styles.counts, { backgroundColor: colors.cardStrong }, fontScale > 1.4 && styles.stacked]}>
        <CourseCount value={group.packs.length} label="Study Packs" />
        <CourseCount value={group.flashcards} label="Flashcards" />
        <CourseCount value={group.completedQuizzes} label="Quizzes recorded" />
      </View>
      <View style={[styles.metrics, fontScale > 1.4 && styles.stacked]}>
        <HeroMetric label="Practice coverage" value={group.materialPracticed} detail={group.packs.length ? group.practicedPacks + ' of ' + plural(group.packs.length, 'pack') : 'Add material to begin'} />
        <HeroMetric label="Quiz accuracy" value={group.quizAccuracy} detail={group.quizQuestions ? plural(group.quizQuestions, 'first answer') : 'No quiz answers yet'} />
      </View>
      <View style={[styles.focus, { backgroundColor: colors.mintSoft }]}>
        <View style={styles.focusHeading}><Icon name="compass-outline" size={18} color={colors.mint} /><Text style={[styles.focusTitle, { color: colors.text }]}>Your next step</Text></View>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{group.nextPractice?.reason ?? (group.packs.length ? group.failedPacks ? 'A practice tool needs attention. Open its Study Pack from Library to check or retry it.' : group.pendingPacks ? 'Practice tools are still being prepared. Your saved activity stays here.' : 'Open your Study Pack from Library to check the available study tools.' : 'Add material from Home. Your activity will build as you study.')}</Text>
        {group.focusTopics.length > 1 ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{group.focusTopics.length - 1} more topic{group.focusTopics.length === 2 ? '' : 's'} to revisit in the evidence breakdown</Text> : null}
      </View>
      {group.nextPractice || !group.packs.length ? <Pressable accessibilityRole="button" accessibilityLabel={(group.nextPractice?.label ?? 'Add study material') + ' · ' + group.name} onPress={() => group.nextPractice ? onPractice(group.nextPractice) : onAddMaterial()} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={[styles.actionText, { color: colors.primaryText }]}>{group.nextPractice?.label ?? 'Add study material'}</Text><Icon name="arrow-right" size={19} color={colors.primaryText} />
      </Pressable> : null}
    </View>
  );
}

function RecallRing({ value }: { value: number | null }) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const size = Math.min(190, 120 * Math.max(1, fontScale));
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(value ?? 0)).current;
  const previous = useRef(value);
  useEffect(() => {
    progress.stopAnimation();
    if (value === null || previous.current === null || reducedMotion || Platform.OS === 'web') progress.setValue(value ?? 0);
    else Animated.timing(progress, { toValue: value, duration: 400, useNativeDriver: false }).start();
    previous.current = value;
    return () => progress.stopAnimation();
  }, [progress, reducedMotion, value]);
  return <View accessible accessibilityRole="image" accessibilityLabel={value === null ? 'Knowledge readiness is not assessed yet. More spaced practice is needed.' : value + ' percent of identified topics show consistent spaced recall.'} style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 120 120" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Circle cx={60} cy={60} r={radius} stroke={colors.border} strokeWidth={8} fill="none" />
      {value !== null ? Platform.OS === 'web' ? <Circle cx={60} cy={60} r={radius} stroke={colors.primary} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={circumference + ' ' + circumference} strokeDashoffset={circumference * (1 - value / 100)} transform="rotate(-90 60 60)" /> : <AnimatedCircle cx={60} cy={60} r={radius} stroke={colors.primary} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={circumference + ' ' + circumference} strokeDashoffset={progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })} transform="rotate(-90 60 60)" /> : null}
    </Svg>
    <View style={styles.ringCenter}><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.ringValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : value + '%'}</Text><Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{value === null ? 'Not assessed' : 'Recall evidence'}</Text></View>
  </View>;
}

function CourseCount({ value, label }: { value: number; label: string }) {
  const { colors } = useStudyBolt();
  return <View accessible accessibilityLabel={value + ' ' + label} style={styles.count}><Text style={[styles.countValue, { color: colors.text }]}>{value}</Text><Text style={[styles.countLabel, { color: colors.textSecondary }]}>{label}</Text></View>;
}

function HeroMetric({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  const { colors } = useStudyBolt();
  return <View accessible accessibilityLabel={label + ': ' + (value === null ? 'not assessed' : value + ' percent') + '. ' + detail} style={styles.metric}><Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.metricValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : value + '%'}</Text><Text style={[styles.smallCopy, { color: colors.textMuted }]}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 18, overflow: 'hidden' },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  heading: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1 },
  arrows: { flexDirection: 'row', gap: 6 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  page: { paddingBottom: 2 },
  courseName: { fontSize: 23, lineHeight: 31, fontWeight: '800', letterSpacing: -0.55, marginBottom: 4 },
  copy: { ...typography.secondary },
  smallCopy: { ...typography.caption },
  main: { alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 18 },
  mainWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  status: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: 5 },
  statusTitle: { ...typography.cardTitle },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ringValue: { fontSize: 32, lineHeight: 41, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  counts: { flexDirection: 'row', borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 12, gap: 6 },
  count: { flex: 1, alignItems: 'center', gap: 2 },
  countValue: { fontSize: 19, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 18, paddingVertical: 16 },
  stacked: { flexDirection: 'column' },
  metric: { flex: 1, gap: 2 },
  metricValue: { fontSize: 25, lineHeight: 33, fontWeight: '800', fontVariant: ['tabular-nums'] },
  focus: { borderRadius: radius.md, padding: 13, gap: 6 },
  focusHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  focusTitle: { ...typography.cardTitle },
  primaryAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, marginTop: 14 },
  actionText: { ...typography.control, flexShrink: 1 },
  evidenceLink: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 11, marginTop: 4 },
  linkText: { fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  pager: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 4 },
  dot: { height: 5, borderRadius: 3 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 24 },
});
